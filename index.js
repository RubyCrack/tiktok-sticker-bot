const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

const config = require('./src/config');
const { ensureDirSync, cleanTempDir, cleanBrowserCache } = require('./src/storage/fileUtils');
const { loadSentStickers, saveSentStickersAtomic, generateStickerKey } = require('./src/storage/stickerStorage');
const { prepareSticker, cleanupTempFiles } = require('./src/media/mediaProcessor');
const StickerQueue = require('./src/queue/stickerQueue');
const { WhatsAppService } = require('./src/whatsapp/whatsappClient');
const CommandHandler = require('./src/whatsapp/commandHandler');
const TikTokMonitor = require('./src/tiktok/tiktokMonitor');
const TerminalInterface = require('./src/cli/terminalInterface');

let tiktokIniciado = false;
let apagando = false;
let workerCounter = 0;
const stickersEnviados = loadSentStickers(config.STICKERS_DB_PATH);

const whatsapp = new WhatsAppService({
    chromeExecutablePath: config.CHROME_EXECUTABLE_PATH,
    ffmpegPath: config.FFMPEG_PATH,
    chromiumArgs: config.CHROMIUM_ARGS
});

const commandHandler = new CommandHandler({
    defaultDestination: config.NUMERO_OWNER,
    contactVerifier: whatsapp,
    onResetDb: async () => {
        stickerQueue.clear();
        stickersEnviados.clear();
        saveSentStickersAtomic(config.STICKERS_DB_PATH, stickersEnviados, config.MAX_DB);
        console.log('🗑️ Base de datos de stickers_enviados.json reiniciada a 0 registros.');
    }
});

async function procesarTareaSticker(tarea, signal) {
    if (signal?.aborted) return false;
    const { buffer, destino, clave, contentType = '' } = tarea;
    const uniqueId = `${Date.now()}_${++workerCounter}`;
    const fileExt = contentType.includes('video') ? '.mp4' : '.webp';
    const rawFilePath = path.join(config.TEMP_DIR, `raw_${uniqueId}${fileExt}`);
    let finalFilePath = rawFilePath;

    try {
        ensureDirSync(config.TEMP_DIR);
        await fs.promises.writeFile(rawFilePath, buffer, { mode: 0o600 });
        if (signal?.aborted) return false;

        finalFilePath = await prepareSticker(rawFilePath, fileExt);
        if (signal?.aborted) return false;

        console.log(`🚀 Enviando sticker a ${destino}...`);
        const media = whatsapp.createMediaFromFile(finalFilePath);
        await whatsapp.sendMessage(destino, media, { sendMediaAsSticker: true });
        if (signal?.aborted) return false;

        console.log('✅ ¡Sticker enviado y entregado!');
        stickersEnviados.add(clave);
        saveSentStickersAtomic(config.STICKERS_DB_PATH, stickersEnviados, config.MAX_DB);
        return true;
    } catch (err) {
        console.error('❌ Error al procesar o enviar el sticker:', err.message);
        return false;
    } finally {
        cleanupTempFiles(rawFilePath, finalFilePath);
    }
}

const stickerQueue = new StickerQueue({
    delayMs: config.STICKER_DELAY_MS,
    maxQueueSize: config.MAX_COLA_STICKERS,
    maxRetries: config.MAX_REINTENTOS_ENVIO,
    worker: procesarTareaSticker
});

const tiktok = new TikTokMonitor({
    statePath: config.TIKTOK_STATE_PATH,
    saveIntervalMs: config.TIKTOK_SAVE_INTERVAL_MS,
    chromiumArgs: config.CHROMIUM_ARGS
});

const terminal = new TerminalInterface({
    onLine: (line) => commandHandler.handleCommand(line, (m) => console.log(m))
});

whatsapp.on('qr', (qr) => {
    console.log('\n====================================================');
    console.log('🤖 ESCANEA ESTE QR CON TU WHATSAPP PARA CONECTAR EL BOT');
    console.log('====================================================\n');
    qrcode.generate(qr, { small: true });
});

whatsapp.on('ready', () => {
    console.log('✅ ¡Bot de WhatsApp conectado y listo!');
    console.log(`📨 El destino por defecto es tu número configurado: ${config.rawOwnerNumber ? '+' + config.rawOwnerNumber : 'No configurado en .env'}`);
    console.log('🕹️ Para cambiar el destino, ESCRIBE AQUÍ MISMO EN LA TERMINAL y pulsa Enter:');
    console.log('     !destino 34XXXXXXXXX     (fija un número)');
    console.log('     !destino default          (vuelve a tu propio chat)');
    console.log('     !reset-db / !limpiar-db   (reinicia el historial para reenviar stickers pasados)');
    console.log('   (También funciona enviándote esos comandos por WhatsApp a ti mismo.)');

    stickerQueue.resume();

    if (!tiktokIniciado) {
        tiktokIniciado = true;
        tiktok.start().catch((err) => console.error('❌ Error iniciando TikTok Scraper:', err.message));
    }
});

whatsapp.on('disconnected', () => {
    stickerQueue.pause();
});

whatsapp.on('message_create', async (msg) => {
    const recipientDigits = (msg.to || '').split('@')[0].split(':')[0];
    if (!config.rawOwnerNumber || !msg.fromMe || recipientDigits !== config.rawOwnerNumber) return;

    const body = msg.body || '';
    if (!commandHandler.isCommandOrPendingReply(body)) return;

    try {
        await commandHandler.handleCommand(body, (m) => whatsapp.sendMessage(config.NUMERO_OWNER, m));
    } catch (err) {
        console.error('❌ Error procesando comando por WhatsApp:', err.message);
    }
});

tiktok.on('sticker', ({ buffer, contentType, url }) => {
    const destino = commandHandler.getDestination();
    if (!destino) {
        console.log('⚠️ No hay número de destino configurado; se ignora el sticker.');
        return;
    }

    const clave = generateStickerKey(destino, url);
    if (stickersEnviados.has(clave)) {
        console.log(`⏩ Sticker ya enviado previamente a ${destino}, omitido para no repetir.`);
        return;
    }

    console.log('\n🌟 ¡Sticker NUEVO detectado en TikTok! Añadiendo a la cola de envío...');
    stickerQueue.enqueue({ buffer, destino, clave, contentType });
});

async function cerrarAplicacion(motivo = 'Desconocido', exitCode = 0) {
    if (apagando) return;
    apagando = true;

    console.log(`\n🛑 Cerrando el bot de forma segura (${motivo})...`);
    const forceExitTimer = setTimeout(() => process.exit(exitCode), 5000);
    forceExitTimer.unref();

    terminal.close();
    stickerQueue.pause();
    stickerQueue.clear();
    await tiktok.stop();
    await whatsapp.destroy();
    cleanTempDir(config.TEMP_DIR);
    cleanBrowserCache(path.join(config.ROOT_DIR, '.wwebjs_auth'));

    clearTimeout(forceExitTimer);
    console.log('🧹 Archivos temporales y caché limpiados.');
    console.log('👋 ¡Bot cerrado correctamente!');
    process.exit(exitCode);
}

process.on('SIGINT', () => cerrarAplicacion('SIGINT / Ctrl+C', 0));
process.on('SIGTERM', () => cerrarAplicacion('SIGTERM', 0));
process.on('unhandledRejection', (reason) => console.error('⚠️ Promesa no manejada:', reason));
process.on('uncaughtException', (err) => {
    console.error('🚨 Error no capturado fatal:', err);
    cerrarAplicacion('uncaughtException', 1).catch(() => process.exit(1));
});

ensureDirSync(config.TEMP_DIR);
cleanTempDir(config.TEMP_DIR);
cleanBrowserCache(path.join(config.ROOT_DIR, '.wwebjs_auth'));
terminal.start();
whatsapp.initialize().catch((err) => console.error('❌ Error al inicializar WhatsApp:', err.message));
