const { safeUnlinkSync } = require('../storage/fileUtils');

let sharp = null;
try {
    sharp = require('sharp');
    // Desactivamos la caché interna de Sharp para evitar retención prolongada de buffers y file descriptors en RAM
    sharp.cache(false);
} catch (e) {
    console.warn('⚠️ sharp no está instalado o falló al cargar: los stickers webp no cuadrados podrían verse deformados.');
}

// Límite conservador (~10s a 30fps) para evitar amplificación de memoria en libvips al redimensionar WebP animados
const MAX_ANIMATED_PAGES = 300;
const MAX_DECODE_PIXELS = 512 * 512 * MAX_ANIMATED_PAGES;

/**
 * Cuadra stickers WebP no cuadrados a 512x512 con fondo transparente dentro de los límites de seguridad.
 */
async function prepareSticker(rawFilePath, fileExt) {
    if (!sharp || fileExt !== '.webp') {
        return rawFilePath;
    }

    const outPath = rawFilePath.replace(/\.webp$/, '_512.webp');
    try {
        const sharpOpts = { animated: true, limitInputPixels: MAX_DECODE_PIXELS };
        const meta = await sharp(rawFilePath, sharpOpts).metadata();
        const w = meta.width;
        const h = meta.pageHeight || meta.height;
        const pages = meta.pages || 1;

        if (!w || !h || w === h) {
            return rawFilePath;
        }
        if (pages > MAX_ANIMATED_PAGES) {
            console.warn(`⚠️ WebP excede límite seguro (${w}x${h} × ${pages} frames), se usará el archivo original.`);
            return rawFilePath;
        }

        await sharp(rawFilePath, sharpOpts)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .webp()
            .toFile(outPath);

        return outPath;
    } catch (e) {
        safeUnlinkSync(outPath);
        console.warn(`⚠️ No se pudo cuadrar el webp, se usará el archivo original: ${e.message}`);
        return rawFilePath;
    }
}

function cleanupTempFiles(...filePaths) {
    for (const fp of filePaths) {
        if (fp) {
            safeUnlinkSync(fp);
        }
    }
}

module.exports = {
    prepareSticker,
    cleanupTempFiles,
    MAX_ANIMATED_PAGES,
    MAX_DECODE_PIXELS
};
