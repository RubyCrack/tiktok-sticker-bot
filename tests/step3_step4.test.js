const assert = require('assert');
const StickerQueue = require('../src/queue/stickerQueue');
const CommandHandler = require('../src/whatsapp/commandHandler');
const { WhatsAppService } = require('../src/whatsapp/whatsappClient');
const TikTokMonitor = require('../src/tiktok/tiktokMonitor');
const TerminalInterface = require('../src/cli/terminalInterface');

console.log('🧪 INICIANDO VERIFICACIÓN EN SECO: PASO 3 Y PASO 4\n');

async function testStickerQueue() {
    console.log('1️⃣ Comprobando src/queue/stickerQueue.js...');

    // A. Encolado y prevención de duplicados
    const processedTasks = [];
    const queue = new StickerQueue({
        delayMs: 10,
        maxQueueSize: 3,
        maxRetries: 2,
        worker: async (task) => {
            processedTasks.push(task.clave);
            return true;
        }
    });

    const enqueued1 = queue.enqueue({ clave: 'user1|url1', buffer: Buffer.from('a'), destino: 'user1', contentType: 'image/webp' });
    const enqueuedDuplicate = queue.enqueue({ clave: 'user1|url1', buffer: Buffer.from('b'), destino: 'user1', contentType: 'image/webp' });
    assert.strictEqual(enqueued1, true, 'La primera tarea debe encolarse');
    assert.strictEqual(enqueuedDuplicate, false, 'La tarea duplicada debe ser rechazada');

    // Esperar a que se procese
    await new Promise((r) => setTimeout(r, 50));
    assert.deepStrictEqual(processedTasks, ['user1|url1'], 'La tarea 1 debió procesarse');

    // B. Límite máximo de cola (overflow)
    const queueOverflow = new StickerQueue({
        delayMs: 100,
        maxQueueSize: 2,
        worker: async () => {
            await new Promise((r) => setTimeout(r, 50));
            return true;
        }
    });
    // Pausar para llenar la cola sin procesar
    queueOverflow.pause();
    assert.strictEqual(queueOverflow.enqueue({ clave: 'c1', destino: 'u1' }), true);
    assert.strictEqual(queueOverflow.enqueue({ clave: 'c2', destino: 'u2' }), true);
    assert.strictEqual(queueOverflow.enqueue({ clave: 'c3', destino: 'u3' }), false, 'Debe rechazar por cola llena');
    queueOverflow.clear();

    // C. Pausa y Reanudación
    const pauseQueueResults = [];
    const queuePaused = new StickerQueue({
        delayMs: 5,
        worker: async (task) => {
            pauseQueueResults.push(task.clave);
            return true;
        }
    });

    queuePaused.pause();
    queuePaused.enqueue({ clave: 'paused|url1', destino: 'u1' });
    await new Promise((r) => setTimeout(r, 30));
    assert.strictEqual(pauseQueueResults.length, 0, 'No debe procesar nada mientras está pausada');

    queuePaused.resume();
    await new Promise((r) => setTimeout(r, 50));
    assert.deepStrictEqual(pauseQueueResults, ['paused|url1'], 'Debe procesar tras reanudarse');

    // D. Reintentos y descarte tras fallos continuados
    let attemptCount = 0;
    const retryQueue = new StickerQueue({
        delayMs: 5,
        maxRetries: 2,
        worker: async () => {
            attemptCount++;
            return false; // simular fallo continuo
        }
    });

    retryQueue.enqueue({ clave: 'fail|url', destino: 'u1' });
    // Esperar tiempo suficiente para 1 intento inicial + 2 reintentos con backoff
    await new Promise((r) => setTimeout(r, 5000));
    // Intento 0 (inicial), intento 1 (primer retry), intento 2 (segundo retry) -> total 3 ejecuciones
    assert.strictEqual(attemptCount, 3, 'Debe ejecutar exactamente 1 intento inicial + 2 reintentos');
    assert.strictEqual(retryQueue.stickersEnProceso.has('fail|url'), false, 'Debe liberarse de stickersEnProceso al descartarse');

    // E. Watchdog Timeout por tarea con AbortSignal
    let timedOutHandled = false;
    let signalAborted = false;
    const timeoutQueue = new StickerQueue({
        delayMs: 5,
        maxRetries: 0,
        taskTimeoutMs: 60, // 60ms para el test en seco
        worker: async (_task, signal) => {
            signal.addEventListener('abort', () => { signalAborted = true; }, { once: true });
            await new Promise(() => {});
        }
    });

    timeoutQueue.on('failed', ({ reason }) => {
        if (reason === 'MAX_RETRIES_EXCEEDED') timedOutHandled = true;
    });

    timeoutQueue.enqueue({ clave: 'hang|url', destino: 'u1' });
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(timedOutHandled, true, 'El watchdog timeout debe dispararse y abortar la tarea colgada');
    assert.strictEqual(signalAborted, true, 'El AbortSignal debe señalizar la cancelación al worker');
    assert.strictEqual(timeoutQueue.isProcessing, false, 'La cola no debe quedarse bloqueada tras timeout');

    // E2. Fallo mientras se pausa la cola no debe consumir reintentos
    let pauseRetryAttempts = 0;
    const pauseRetryQueue = new StickerQueue({
        delayMs: 5,
        maxRetries: 0,
        worker: async () => {
            pauseRetryAttempts++;
            if (pauseRetryAttempts === 1) {
                pauseRetryQueue.pause();
                return false;
            }
            return true;
        }
    });
    pauseRetryQueue.enqueue({ clave: 'pause-no-burn', destino: 'u1' });
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(pauseRetryAttempts, 1);
    pauseRetryQueue.resume();
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(pauseRetryAttempts, 2, 'Al reanudar debe reintentar sin haber quemado maxRetries');

    // F. clear() durante una tarea lenta en vuelo no debe corromper la nueva generación
    const genResults = [];
    const clearRaceQueue = new StickerQueue({
        delayMs: 5,
        maxRetries: 0,
        worker: async (task) => {
            if (task.clave === 'old|1') {
                await new Promise((r) => setTimeout(r, 80));
            }
            genResults.push(task.clave);
            return true;
        }
    });
    clearRaceQueue.enqueue({ clave: 'old|1', destino: 'u1' });
    await new Promise((r) => setTimeout(r, 15));
    clearRaceQueue.clear();
    clearRaceQueue.enqueue({ clave: 'new|2', destino: 'u1' });
    await new Promise((r) => setTimeout(r, 110));
    assert.ok(genResults.includes('new|2'), 'La nueva tarea tras clear() debe procesarse');
    assert.strictEqual(clearRaceQueue.isProcessing, false, 'isProcessing debe quedar en false al terminar');
    assert.strictEqual(clearRaceQueue.stickersEnProceso.size, 0, 'stickersEnProceso debe quedar vacío');

    console.log('   ✅ stickerQueue OK (FIFO, pausa/resume, deduplicación, watchdog timeout, clear seguro y reintentos validados)');
}

async function testCommandHandler() {
    console.log('\n2️⃣ Comprobando src/whatsapp/commandHandler.js...');

    const responses = [];
    const responder = async (msg) => responses.push(msg);

    // Mock verifier
    const mockVerifier = {
        verifyContact: async (numberId) => {
            if (numberId === '34600111222@c.us') {
                return { isRegistered: true, name: 'Juan Pérez' };
            }
            return { isRegistered: false };
        }
    };

    const handler = new CommandHandler({
        defaultDestination: '34699999999@c.us',
        contactVerifier: mockVerifier
    });

    assert.strictEqual(handler.getDestination(), '34699999999@c.us', 'Destino inicial debe ser el default');

    // A. Comando inválido
    await handler.handleCommand('hola bot', responder);
    assert.ok(responses.pop().includes('Comando no reconocido'), 'Debe indicar comando no reconocido');

    // B. Número inválido (muy corto)
    await handler.handleCommand('!destino 123', responder);
    assert.ok(responses.pop().includes('no parece válido'), 'Debe validar longitud mínima');

    // C. Número no registrado
    await handler.handleCommand('!destino 34600000000', responder);
    assert.ok(responses.pop().includes('NO tiene cuenta de WhatsApp'), 'Debe indicar número no registrado');

    // D. Flujo de confirmación: solicitar cambio y confirmar con "si"
    await handler.handleCommand('!destino 34600111222', responder);
    const askConfirmation = responses.pop();
    assert.ok(askConfirmation.includes('Juan Pérez'), 'Debe pedir confirmación mencionando el nombre del contacto');
    assert.ok(handler.getPendingState() !== null, 'Debe haber un estado pendiente');

    await handler.handleCommand('si', responder);
    const confirmResponse = responses.pop();
    assert.ok(confirmResponse.includes('Confirmado'), 'Debe confirmar el cambio');
    assert.strictEqual(handler.getDestination(), '34600111222@c.us', 'El destino debió actualizarse a 34600111222@c.us');
    assert.strictEqual(handler.getPendingState(), null, 'El estado pendiente debe limpiarse');

    // E. Flujo de cancelación con "no"
    await handler.handleCommand('!destino 34600111222', responder);
    responses.length = 0; // vaciar
    await handler.handleCommand('no', responder);
    assert.ok(responses.pop().includes('cancelada'), 'Debe cancelar la operación');
    assert.strictEqual(handler.getDestination(), '34600111222@c.us', 'El destino no debió alterarse');

    // F. Regreso a default
    await handler.handleCommand('!destino default', responder);
    assert.ok(responses.pop().includes('destino por defecto'), 'Debe volver al default');
    assert.strictEqual(handler.getDestination(), '34699999999@c.us', 'El destino debe ser el default');

    // G. Comando !reset-db
    let dbResetCalled = false;
    const resetHandler = new CommandHandler({
        defaultDestination: '34699999999@c.us',
        onResetDb: async () => { dbResetCalled = true; }
    });
    await resetHandler.handleCommand('!reset-db', responder);
    assert.ok(responses.pop().includes('reiniciado'), 'Debe confirmar reinicio de historial');
    assert.strictEqual(dbResetCalled, true, 'El callback onResetDb debió ejecutarse');

    // H. !reset-db cancela confirmación pendiente y verifyContact con name=null no lanza error
    let resetWithPending = false;
    const nullNameHandler = new CommandHandler({
        defaultDestination: '34699999999@c.us',
        contactVerifier: {
            verifyContact: async () => ({ isRegistered: true, name: null })
        },
        onResetDb: async () => { resetWithPending = true; }
    });
    assert.strictEqual(nullNameHandler.isCommandOrPendingReply('si'), false, 'si sin pendiente no es comando');
    assert.strictEqual(nullNameHandler.isCommandOrPendingReply('hola'), false, 'texto libre no es comando');
    await nullNameHandler.handleCommand('!destino', responder);
    assert.ok(responses.pop().includes('Falta el número'), '!destino sin argumentos debe mostrar ayuda de uso');
    await nullNameHandler.handleCommand('!destino 34600111222', responder);
    assert.ok(nullNameHandler.getPendingState() !== null, 'Debe quedar pendiente incluso si name es null');
    assert.strictEqual(nullNameHandler.isCommandOrPendingReply('si'), true, 'si con pendiente sí debe aceptarse');
    await nullNameHandler.handleCommand('!limpiar-db', responder);
    assert.strictEqual(resetWithPending, true, '!limpiar-db debe cancelar confirmación pendiente y ejecutarse');
    assert.strictEqual(nullNameHandler.getPendingState(), null, 'estadoPendiente debe limpiarse tras !limpiar-db');

    console.log('   ✅ commandHandler OK (validaciones, resolución de contactos, confirmación si/no, default y reset-db)');
}

async function testServiceGuards() {
    console.log('\n3️⃣ Comprobando guardas de WhatsAppService y reconexión de TikTokMonitor...');
    const wa = new WhatsAppService();
    let threwDisconnected = false;
    try {
        await wa.verifyContact('34600111222@c.us');
    } catch (err) {
        threwDisconnected = err.message.includes('no conectado');
    }
    assert.strictEqual(threwDisconnected, true, 'verifyContact debe rechazar si WhatsApp no está listo');

    let sendRejected = false;
    try {
        await wa.sendMessage('34600111222@c.us', 'hola');
    } catch (err) {
        sendRejected = err.message.includes('no conectado');
    }
    assert.strictEqual(sendRejected, true, 'sendMessage debe rechazar si WhatsApp no está conectado');
    await wa.destroy();

    const monitor = new TikTokMonitor({ statePath: '/tmp/nonexistent_tiktok_state.json' });
    monitor.isRunning = false;
    monitor._scheduleReconnect();
    assert.ok(monitor.reconnectTimer !== null, '_scheduleReconnect debe programar timer aunque isRunning sea false tras fallo de start()');
    await monitor.stop();
    assert.strictEqual(monitor.reconnectTimer, null, 'stop() debe cancelar cualquier reconnectTimer pendiente');
    console.log('   ✅ Guardas de WhatsAppService y TikTokMonitor._scheduleReconnect/stop OK');
}

async function testTerminalInterface() {
    console.log('\n4️⃣ Comprobando src/cli/terminalInterface.js...');
    const term = new TerminalInterface({
        onLine: async () => {}
    });
    term.start();
    assert.strictEqual(term.closed, false, 'Debe estar activo tras start');
    term.close();
    assert.strictEqual(term.closed, true, 'Debe estar cerrado tras close');
    console.log('   ✅ terminalInterface OK (ciclo de vida y cierre limpio)');
}

(async () => {
    try {
        await testStickerQueue();
        await testCommandHandler();
        await testServiceGuards();
        await testTerminalInterface();
        console.log('\n🎉 ¡TODAS LAS VERIFICACIONES DEL PASO 3 Y PASO 4 HAN PASADO CON ÉXITO!');
    } catch (err) {
        console.error('\n❌ ERROR EN PRUEBAS:', err);
        process.exit(1);
    }
})();
