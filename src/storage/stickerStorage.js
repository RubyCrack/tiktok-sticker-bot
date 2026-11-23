const fs = require('fs');
const crypto = require('crypto');
const { safeAtomicWriteFileSync } = require('./fileUtils');

// Quita los query params porque los tokens firmados del CDN expiran y cambiarían la clave del mismo sticker
function getStickerIdentifier(url) {
    if (!url) return '';
    const cleanUrl = url.split('?')[0];
    return crypto.createHash('md5').update(cleanUrl).digest('hex');
}

function generateStickerKey(destino, url) {
    return `${destino}|${getStickerIdentifier(url)}`;
}

/**
 * Carga el historial desde JSON migrando URLs legacy al formato compacto "destino|hash".
 */
function loadSentStickers(dbPath) {
    const stickersSet = new Set();
    if (!dbPath || !fs.existsSync(dbPath)) {
        return stickersSet;
    }

    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            for (const item of data) {
                if (typeof item === 'string' && item.includes('|')) {
                    const parts = item.split('|');
                    const destino = parts[0];
                    const idOrUrl = parts.slice(1).join('|');

                    if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) {
                        // Migración transparente de URLs largas a hash compacto
                        stickersSet.add(`${destino}|${getStickerIdentifier(idOrUrl)}`);
                    } else {
                        stickersSet.add(item);
                    }
                }
            }
        }
    } catch (err) {
        console.error(`⚠️ Error al leer ${dbPath}: ${err.message}. Se respalda como corrupto y se iniciará historial vacío.`);
        try { fs.renameSync(dbPath, `${dbPath}.corrupt.${Date.now()}`); } catch (_) {}
    }

    return stickersSet;
}

function trimStickersSet(stickersSet, maxDb) {
    if (!stickersSet || stickersSet.size <= maxDb) return;
    const excess = stickersSet.size - maxDb;
    let removed = 0;
    for (const item of stickersSet) {
        stickersSet.delete(item);
        if (++removed >= excess) break;
    }
}

function saveSentStickersAtomic(dbPath, stickersSet, maxDb = 5000) {
    if (!dbPath || !stickersSet) return;

    try {
        trimStickersSet(stickersSet, maxDb);
        safeAtomicWriteFileSync(dbPath, JSON.stringify([...stickersSet]));
    } catch (err) {
        console.error(`❌ Error guardando historial de stickers en ${dbPath}: ${err.message}`);
    }
}

module.exports = {
    generateStickerKey,
    loadSentStickers,
    saveSentStickersAtomic
};
