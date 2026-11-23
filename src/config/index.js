const path = require('path');
const fs = require('fs');
require('dotenv').config();

const ROOT_DIR = path.resolve(__dirname, '../../');
const TEMP_DIR = path.join(ROOT_DIR, 'temp');
const STICKERS_DB_PATH = path.join(ROOT_DIR, 'stickers_enviados.json');
const TIKTOK_STATE_PATH = path.join(ROOT_DIR, 'tiktok_state.json');

const CHROME_PATHS_POR_SO = {
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    linux: '/usr/bin/google-chrome'
};

const rawOwnerNumber = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
if (!rawOwnerNumber) {
    console.warn('⚠️ AVISO: OWNER_NUMBER no está definido en el archivo .env. Configúralo para recibir los stickers.');
}

function parseIntEnv(value, fallback, min = 0) {
    if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return fallback;
    const parsed = parseInt(value.trim(), 10);
    return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
}

const NUMERO_OWNER = rawOwnerNumber ? `${rawOwnerNumber}@c.us` : '';
const STICKER_DELAY_MS = parseIntEnv(process.env.STICKER_DELAY_MS, 1000, 0);
const MAX_DB = parseIntEnv(process.env.MAX_DB_ENTRIES, 5000, 1);
const TIKTOK_SAVE_INTERVAL_MS = parseIntEnv(process.env.TIKTOK_SAVE_INTERVAL_MS, 60000, 1);
const MAX_COLA_STICKERS = parseIntEnv(process.env.MAX_COLA_STICKERS, 100, 1);
const MAX_REINTENTOS_ENVIO = parseIntEnv(process.env.MAX_REINTENTOS_ENVIO, 2, 0);

let ffmpegStatic = null;
try {
    ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
        process.env.FFMPEG_PATH = ffmpegStatic;
    }
} catch (e) {
    console.warn('⚠️ ffmpeg-static no encontrado. Se dependerá del FFmpeg global del sistema.');
}

const chromePathCandidate = process.env.CHROME_PATH || CHROME_PATHS_POR_SO[process.platform] || '';
const CHROME_EXECUTABLE_PATH = fs.existsSync(chromePathCandidate) ? chromePathCandidate : undefined;
const CHROMIUM_ARGS = Object.freeze([
    '--disk-cache-size=10485760',
    '--media-cache-size=10485760',
    '--disable-gpu-cache',
    ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])
]);

const config = Object.freeze({
    ROOT_DIR,
    TEMP_DIR,
    STICKERS_DB_PATH,
    TIKTOK_STATE_PATH,
    rawOwnerNumber,
    NUMERO_OWNER,
    STICKER_DELAY_MS,
    MAX_DB,
    TIKTOK_SAVE_INTERVAL_MS,
    MAX_COLA_STICKERS,
    MAX_REINTENTOS_ENVIO,
    CHROME_EXECUTABLE_PATH,
    CHROMIUM_ARGS,
    FFMPEG_PATH: ffmpegStatic
});

module.exports = config;
