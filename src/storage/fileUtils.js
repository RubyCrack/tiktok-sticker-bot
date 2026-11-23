const fs = require('fs');
const path = require('path');

function ensureDirSync(dirPath) {
    if (dirPath) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
    }
}

function cleanTempDir(dirPath) {
    clearDirEntries(dirPath, false);
}

function buildTempPath(filePath) {
    ensureDirSync(path.dirname(filePath));
    return `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// En Windows rename falla si el archivo destino ya existe y hay que eliminarlo primero
function isWin32ReplaceErr(err) {
    return process.platform === 'win32' && (err.code === 'EPERM' || err.code === 'EBUSY');
}

function safeAtomicWriteFileSync(filePath, content) {
    const tmpPath = buildTempPath(filePath);
    fs.writeFileSync(tmpPath, content, { mode: 0o600 });

    try {
        fs.renameSync(tmpPath, filePath);
    } catch (err) {
        if (isWin32ReplaceErr(err)) {
            try {
                safeUnlinkSync(filePath);
                fs.renameSync(tmpPath, filePath);
                return;
            } catch (retryErr) {
                safeUnlinkSync(tmpPath);
                throw retryErr;
            }
        }
        safeUnlinkSync(tmpPath);
        throw err;
    }
}

async function safeAtomicWriteFile(filePath, content) {
    const tmpPath = buildTempPath(filePath);
    await fs.promises.writeFile(tmpPath, content, { mode: 0o600 });

    try {
        await fs.promises.rename(tmpPath, filePath);
    } catch (err) {
        if (isWin32ReplaceErr(err)) {
            try {
                try { await fs.promises.unlink(filePath); } catch (_) {}
                await fs.promises.rename(tmpPath, filePath);
                return;
            } catch (retryErr) {
                safeUnlinkSync(tmpPath);
                throw retryErr;
            }
        }
        safeUnlinkSync(tmpPath);
        throw err;
    }
}

function safeUnlinkSync(filePath) {
    if (!filePath) return;
    try {
        fs.unlinkSync(filePath);
    } catch (_) {}
}

function clearDirEntries(dirPath, recursive = true) {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    try {
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (recursive) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                } else {
                    fs.unlinkSync(fullPath);
                }
            } catch (_) {
                // Ignorar entradas en uso o bloqueadas temporalmente
            }
        }
    } catch (_) {}
}

/**
 * Purga de forma segura las cachés temporales de Chromium (GPU, Code Cache, HTTP Cache)
 * preservando intactas las credenciales, cookies e IndexedDB de WhatsApp Web.
 * @param {string} authDir - Ruta al directorio .wwebjs_auth
 */
function cleanBrowserCache(authDir) {
    if (!authDir || !fs.existsSync(authDir)) return;
    const defaultProfile = path.join(authDir, 'session', 'Default');
    if (!fs.existsSync(defaultProfile)) return;

    const cacheDirs = [
        path.join(defaultProfile, 'Cache'),
        path.join(defaultProfile, 'Code Cache'),
        path.join(defaultProfile, 'GPUCache'),
        path.join(defaultProfile, 'DawnWebGPUCache'),
        path.join(defaultProfile, 'DawnGraphiteCache'),
        path.join(defaultProfile, 'Service Worker', 'CacheStorage'),
        path.join(defaultProfile, 'Service Worker', 'ScriptCache')
    ];

    for (const cDir of cacheDirs) {
        clearDirEntries(cDir, true);
    }
}

module.exports = {
    ensureDirSync,
    cleanTempDir,
    safeAtomicWriteFileSync,
    safeAtomicWriteFile,
    safeUnlinkSync,
    cleanBrowserCache
};
