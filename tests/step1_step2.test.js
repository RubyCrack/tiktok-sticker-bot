const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('🧪 INICIANDO VERIFICACIÓN EN SECO: PASO 1 Y PASO 2\n');

// 1. Verificar Config
console.log('1️⃣ Comprobando src/config/index.js...');
const prevDelay = process.env.STICKER_DELAY_MS;
const prevRetries = process.env.MAX_REINTENTOS_ENVIO;
process.env.STICKER_DELAY_MS = '0';
process.env.MAX_REINTENTOS_ENVIO = '0';
process.env.MAX_COLA_STICKERS = '100abc';
delete require.cache[require.resolve('../src/config')];
const configZero = require('../src/config');
assert.strictEqual(configZero.STICKER_DELAY_MS, 0, 'STICKER_DELAY_MS=0 debe respetarse');
assert.strictEqual(configZero.MAX_REINTENTOS_ENVIO, 0, 'MAX_REINTENTOS_ENVIO=0 debe respetarse');
assert.strictEqual(configZero.MAX_COLA_STICKERS, 100, 'Valores con sufijo no numérico como 100abc deben usar fallback');
delete process.env.MAX_COLA_STICKERS;
if (prevDelay === undefined) delete process.env.STICKER_DELAY_MS; else process.env.STICKER_DELAY_MS = prevDelay;
if (prevRetries === undefined) delete process.env.MAX_REINTENTOS_ENVIO; else process.env.MAX_REINTENTOS_ENVIO = prevRetries;
delete require.cache[require.resolve('../src/config')];

const config = require('../src/config');
assert.ok(Number.isInteger(config.STICKER_DELAY_MS) && config.STICKER_DELAY_MS >= 0, 'STICKER_DELAY_MS debe ser entero >= 0');
assert.ok(Number.isInteger(config.MAX_DB) && config.MAX_DB >= 1, 'MAX_DB debe ser entero >= 1');
assert.ok(typeof config.NUMERO_OWNER === 'string', 'NUMERO_OWNER debe ser string');
assert.ok(Object.isFrozen(config), 'El objeto config debe estar congelado (freeze)');
console.log(`   ✅ Config OK (Owner: ${config.NUMERO_OWNER}, Delay: ${config.STICKER_DELAY_MS}ms, Temp: ${config.TEMP_DIR})`);

// 2. Verificar FileUtils
console.log('\n2️⃣ Comprobando src/storage/fileUtils.js...');
const fileUtils = require('../src/storage/fileUtils');
const testDir = path.join(config.TEMP_DIR, 'test_sandbox');
fileUtils.ensureDirSync(testDir);
assert.ok(fs.existsSync(testDir), 'test_sandbox debe existir');

const testFile = path.join(testDir, 'atomic_test.txt');
fileUtils.safeAtomicWriteFileSync(testFile, 'contenido atómico síncrono');
assert.strictEqual(fs.readFileSync(testFile, 'utf8'), 'contenido atómico síncrono', 'Contenido atómico síncrono coincide');

fileUtils.cleanTempDir(testDir);
assert.strictEqual(fs.readdirSync(testDir).length, 0, 'cleanTempDir debe vaciar la carpeta');
fs.rmdirSync(testDir);
console.log('   ✅ fileUtils OK (creación, escritura atómica y limpieza verificadas)');

// 3. Verificar SessionState
console.log('\n3️⃣ Comprobando src/storage/sessionState.js...');
const sessionState = require('../src/storage/sessionState');
const validStateFile = path.join(config.TEMP_DIR, 'valid_state.json');
fs.writeFileSync(validStateFile, JSON.stringify({ cookies: [], origins: [] }));
const validPath = sessionState.getValidSessionStatePath(validStateFile);
assert.strictEqual(validPath, validStateFile, 'Un archivo JSON válido debe devolver su ruta');
fs.unlinkSync(validStateFile);

// Probar caso archivo vacío (0 bytes)
const emptyStateFile = path.join(config.TEMP_DIR, 'empty_state.json');
fs.writeFileSync(emptyStateFile, '');
const emptyResult = sessionState.getValidSessionStatePath(emptyStateFile);
assert.strictEqual(emptyResult, null, 'Un archivo vacío debe devolver null');
fs.unlinkSync(emptyStateFile);

// Probar caso JSON corrupto
const corruptStateFile = path.join(config.TEMP_DIR, 'corrupt_state.json');
fs.writeFileSync(corruptStateFile, '{ "incompleto": ');
const corruptResult = sessionState.getValidSessionStatePath(corruptStateFile);
assert.strictEqual(corruptResult, null, 'Un archivo con JSON corrupto debe devolver null');
fs.unlinkSync(corruptStateFile);

// Probar JSON sin campo cookies
const noCookiesFile = path.join(config.TEMP_DIR, 'no_cookies_state.json');
fs.writeFileSync(noCookiesFile, JSON.stringify({}));
assert.strictEqual(sessionState.getValidSessionStatePath(noCookiesFile), null, 'Objeto sin array cookies debe devolver null');
fs.unlinkSync(noCookiesFile);
console.log('   ✅ sessionState OK (valida correctamente archivos JSON reales y descarta corruptos/vacíos)');

// 4. Verificar StickerStorage
console.log('\n4️⃣ Comprobando src/storage/stickerStorage.js...');
const stickerStorage = require('../src/storage/stickerStorage');
const testDbPath = path.join(config.TEMP_DIR, 'test_stickers.json');
const legacyUrl = 'https://cdn.tiktok.com/sticker123.webp?token=abc';
const mockSet = new Set([`user1@c.us|${legacyUrl}`, 'user2@c.us|hash2']);
stickerStorage.saveSentStickersAtomic(testDbPath, mockSet, 10);
const loadedMock = stickerStorage.loadSentStickers(testDbPath);
assert.strictEqual(loadedMock.size, 2, 'El Set guardado y cargado debe tener tamaño 2');
assert.ok(loadedMock.has(stickerStorage.generateStickerKey('user1@c.us', legacyUrl)), 'Debe migrar URL legacy a hash compacto');
stickerStorage.saveSentStickersAtomic(testDbPath, mockSet, 1);
assert.strictEqual(mockSet.size, 1, 'El Set en memoria debe sincronizarse con el límite maxDb');
fs.unlinkSync(testDbPath);
console.log('   ✅ stickerStorage OK (carga, migración de formato, límite RAM/disco y guardado atómico validados)');

// 5. Verificar MediaProcessor (Sharp)
console.log('\n5️⃣ Comprobando src/media/mediaProcessor.js...');
const mediaProcessor = require('../src/media/mediaProcessor');
assert.strictEqual(typeof mediaProcessor.prepareSticker, 'function', 'prepareSticker debe exportarse');

(async () => {
    // Crear una imagen rectangular de prueba (200x100) para forzar el redimensionado a 512x512
    const sharp = require('sharp');
    const rectangularWebp = path.join(config.TEMP_DIR, 'test_rect.webp');
    await sharp({
        create: {
            width: 200,
            height: 100,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 1 }
        }
    }).webp().toFile(rectangularWebp);

    const processedPath = await mediaProcessor.prepareSticker(rectangularWebp, '.webp');
    assert.notStrictEqual(processedPath, rectangularWebp, 'Debe generar una versión cuadrada _512.webp');
    assert.ok(fs.existsSync(processedPath), 'El archivo _512.webp debe existir en disco');

    const meta = await sharp(processedPath).metadata();
    assert.strictEqual(meta.width, 512, 'El ancho debe ser 512');
    assert.strictEqual(meta.height, 512, 'El alto debe ser 512');

    mediaProcessor.cleanupTempFiles(rectangularWebp, processedPath);
    assert.ok(!fs.existsSync(rectangularWebp) && !fs.existsSync(processedPath), 'Los archivos deben limpiarse');

    // Probar límite seguro de fotogramas animados en prepareSticker (> MAX_ANIMATED_PAGES)
    const oversizedPages = mediaProcessor.MAX_ANIMATED_PAGES + 1;
    const rawPixels = Buffer.alloc(2 * 3 * oversizedPages * 4, 255);
    for (let p = 0; p < oversizedPages; p++) {
        const c = (p % 2) * 200;
        for (let i = 0; i < 6; i++) rawPixels[(p * 6 + i) * 4] = c;
    }
    const manyFramesWebp = path.join(config.TEMP_DIR, 'test_many_frames.webp');
    await sharp(rawPixels, { raw: { width: 2, height: 3 * oversizedPages, channels: 4, pageHeight: 3 } })
        .webp()
        .toFile(manyFramesWebp);
    const skippedPath = await mediaProcessor.prepareSticker(manyFramesWebp, '.webp');
    assert.strictEqual(skippedPath, manyFramesWebp, 'WebP que excede MAX_ANIMATED_PAGES debe omitir redimensionado');
    assert.ok(!fs.existsSync(manyFramesWebp.replace(/\.webp$/, '_512.webp')), 'No debe generar _512.webp al exceder el límite');
    mediaProcessor.cleanupTempFiles(manyFramesWebp);
    console.log('   ✅ mediaProcessor OK (detección de ratio, límite de frames animados, 512x512 y limpieza)');

    // 6. Verificar ServeGraph (contención de ruta y sin CORS abierto)
    console.log('\n6️⃣ Comprobando scripts/serve_graph.js...');
    const { resolveSafePublicFile, createGraphServer } = require('../scripts/serve_graph');
    assert.strictEqual(resolveSafePublicFile('/../.env').status, 403, 'Debe bloquear path traversal hacia raíz');
    assert.strictEqual(resolveSafePublicFile('/%2e%2e/.env').status, 403, 'Debe bloquear path traversal codificado');
    assert.strictEqual(resolveSafePublicFile('/%ZZ').status, 400, 'Debe rechazar URI malformada');
    assert.strictEqual(resolveSafePublicFile('/inexistente_12345.json').status, 404, 'Archivo inexistente dentro de PUBLIC_DIR debe dar 404');

    const srv = createGraphServer();
    let capturedStatus = null;
    let capturedHeaders = null;
    await new Promise((resolve) => {
        const mockRes = {
            writeHead: (code, headers) => { capturedStatus = code; capturedHeaders = headers; },
            end: () => resolve()
        };
        srv.emit('request', { url: '/../.env' }, mockRes);
    });
    assert.strictEqual(capturedStatus, 403, 'Petición HTTP de traversal debe responder 403');
    assert.strictEqual(capturedHeaders['Access-Control-Allow-Origin'], undefined, 'No debe exponer Access-Control-Allow-Origin: *');
    console.log('   ✅ serve_graph OK (contención PUBLIC_DIR y sin CORS abierto)');

    console.log('\n🎉 ¡TODAS LAS VERIFICACIONES DEL PASO 1 Y PASO 2 HAN PASADO CON ÉXITO!');
})().catch((err) => {
    console.error('\n❌ ERROR EN PRUEBAS:', err);
    process.exit(1);
});
