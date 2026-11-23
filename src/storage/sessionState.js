const fs = require('fs');
const { safeAtomicWriteFile } = require('./fileUtils');

// Evita que Playwright aborte el arranque si el archivo de sesión está corrupto o incompleto
function getValidSessionStatePath(statePath) {
    if (!statePath || !fs.existsSync(statePath)) {
        return null;
    }

    try {
        const raw = fs.readFileSync(statePath, 'utf8');
        const parsed = JSON.parse(raw);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !Array.isArray(parsed.cookies)) {
            console.warn('⚠️ Estructura inválida en archivo de sesión. Se iniciará sesión limpia.');
            return null;
        }

        return statePath;
    } catch (err) {
        console.warn(`⚠️ Error leyendo/parseando sesión (${err.message}). Se iniciará sesión limpia.`);
        return null;
    }
}

async function saveSessionStateAtomic(browserContext, statePath) {
    if (!browserContext || !statePath) return false;

    try {
        const state = await browserContext.storageState();
        await safeAtomicWriteFile(statePath, JSON.stringify(state, null, 2));
        return true;
    } catch (err) {
        console.error(`❌ Error guardando estado de sesión de TikTok: ${err.message}`);
        return false;
    }
}

module.exports = {
    getValidSessionStatePath,
    saveSessionStateAtomic
};
