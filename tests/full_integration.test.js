const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 INICIANDO TEST DE INTEGRACIÓN COMPLETO (E2E EN SECO)\n');

// 1. Verificación de ausencia de ciclos y exportaciones
console.log('1️⃣ Verificando importaciones de módulos y ausencia de dependencias cíclicas...');
const config = require('../src/config');
const fileUtils = require('../src/storage/fileUtils');
const sessionState = require('../src/storage/sessionState');
const stickerStorage = require('../src/storage/stickerStorage');
const mediaProcessor = require('../src/media/mediaProcessor');
const StickerQueue = require('../src/queue/stickerQueue');
const { WhatsAppService } = require('../src/whatsapp/whatsappClient');
const CommandHandler = require('../src/whatsapp/commandHandler');
const TikTokMonitor = require('../src/tiktok/tiktokMonitor');
const TerminalInterface = require('../src/cli/terminalInterface');

assert.ok(config && typeof config === 'object', 'config debe ser un objeto');
assert.ok(typeof fileUtils.safeAtomicWriteFileSync === 'function', 'fileUtils debe exportar safeAtomicWriteFileSync');
assert.ok(typeof sessionState.getValidSessionStatePath === 'function', 'sessionState debe exportar getValidSessionStatePath');
assert.ok(typeof stickerStorage.loadSentStickers === 'function', 'stickerStorage debe exportar loadSentStickers');
assert.ok(typeof mediaProcessor.prepareSticker === 'function', 'mediaProcessor debe exportar prepareSticker');
assert.ok(typeof StickerQueue === 'function', 'StickerQueue debe ser clase/función constructora');
assert.ok(typeof WhatsAppService === 'function', 'WhatsAppService debe ser clase/función constructora');
assert.ok(typeof CommandHandler === 'function', 'CommandHandler debe ser clase/función constructora');
assert.ok(typeof TikTokMonitor === 'function', 'TikTokMonitor debe ser clase/función constructora');
assert.ok(typeof TerminalInterface === 'function', 'TerminalInterface debe ser clase/función constructora');
console.log('   ✅ Todos los 10 módulos cargados limpiamente sin dependencias cíclicas.');

// 2. Simulación de cables del orquestador
console.log('\n2️⃣ Probando integración y cableado de eventos del orquestador...');
(async () => {
    const stickersEnviados = new Set();
    const mockSentMessages = [];

    // Mock WhatsApp Service para el test de integración
    const mockWhatsApp = {
        ready: true,
        isReady: () => true,
        sendMessage: async (destino, media, options) => {
            mockSentMessages.push({ destino, media, options });
            return true;
        },
        createMediaFromFile: (filePath) => {
            return { filePath, mimetype: 'image/webp', data: 'mockbase64' };
        },
        verifyContact: async (numberId) => {
            return { isRegistered: true, name: 'Contacto Test' };
        }
    };

    const commandHandler = new CommandHandler({
        defaultDestination: '34600000000@c.us',
        contactVerifier: mockWhatsApp
    });

    // Worker idéntico a index.js
    async function testWorker(tarea) {
        const { buffer, destino, clave, contentType } = tarea;
        const uniqueId = `test_${Date.now()}`;
        const fileExt = contentType.includes('video') ? '.mp4' : '.webp';
        const rawFilePath = path.join(config.TEMP_DIR, `raw_${uniqueId}${fileExt}`);
        let finalFilePath = rawFilePath;

        try {
            fileUtils.ensureDirSync(config.TEMP_DIR);
            await fs.promises.writeFile(rawFilePath, buffer, { mode: 0o600 });
            finalFilePath = await mediaProcessor.prepareSticker(rawFilePath, fileExt);

            const media = mockWhatsApp.createMediaFromFile(finalFilePath);
            await mockWhatsApp.sendMessage(destino, media, { sendMediaAsSticker: true });

            stickersEnviados.add(clave);
            return true;
        } catch (err) {
            return false;
        } finally {
            mediaProcessor.cleanupTempFiles(rawFilePath, finalFilePath);
        }
    }

    const stickerQueue = new StickerQueue({
        delayMs: 10,
        maxRetries: 1,
        worker: testWorker
    });

    // Simular recepción de sticker WebP válido desde TikTok
    const sharp = require('sharp');
    const validWebpBuffer = await sharp({
        create: { width: 120, height: 80, channels: 4, background: { r: 10, g: 200, b: 100, alpha: 1 } }
    }).webp().toBuffer();

    const mockTikTokSticker = {
        buffer: validWebpBuffer,
        contentType: 'image/webp',
        url: 'https://p16-tiktok-dm-sticker.tiktokcdn.com/test-sticker.webp?token=123'
    };

    // Lógica de cableado de TikTok a Cola
    const destino = commandHandler.getDestination();
    const clave = stickerStorage.generateStickerKey(destino, mockTikTokSticker.url);

    assert.strictEqual(stickersEnviados.has(clave), false, 'No debe estar en la BD antes de enviar');
    const enqueued = stickerQueue.enqueue({
        buffer: mockTikTokSticker.buffer,
        destino,
        clave,
        contentType: mockTikTokSticker.contentType
    });
    assert.strictEqual(enqueued, true, 'El sticker debe ser encolado con éxito');

    // Esperar a que la cola procese
    await new Promise((r) => setTimeout(r, 60));

    assert.strictEqual(mockSentMessages.length, 1, 'Debe haberse enviado 1 mensaje a WhatsApp');
    assert.strictEqual(mockSentMessages[0].destino, '34600000000@c.us', 'El destino debe ser el del comando');
    assert.strictEqual(mockSentMessages[0].options.sendMediaAsSticker, true, 'Debe enviarse como sticker');
    assert.strictEqual(stickersEnviados.has(clave), true, 'La clave debe registrarse en la BD');

    // Comprobar que no quedan archivos temporales huérfanos
    const tempFiles = fs.readdirSync(config.TEMP_DIR).filter(f => f.startsWith('raw_test_'));
    assert.strictEqual(tempFiles.length, 0, 'Los archivos temporales deben haberse limpiado');
    console.log('   ✅ Cableado TikTok -> Cola -> Media -> WhatsApp -> Storage validado');

    // 3. Probar pausa en desconexión y reactivación
    console.log('\n3️⃣ Probando respuesta ante eventos de conexión...');
    stickerQueue.pause();
    assert.strictEqual(stickerQueue.isPaused, true, 'La cola debe pausarse');
    stickerQueue.resume();
    assert.strictEqual(stickerQueue.isPaused, false, 'La cola debe reactivarse');
    console.log('   ✅ Control de estado de conexión verificado');

    console.log('\n🎉 ¡EL TEST DE INTEGRACIÓN COMPLETO HA PASADO CON 100% DE ÉXITO!');
})().catch((err) => {
    console.error('\n❌ ERROR EN TEST DE INTEGRACIÓN:', err);
    process.exit(1);
});
