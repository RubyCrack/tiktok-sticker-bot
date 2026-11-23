const EventEmitter = require('events');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const { getValidSessionStatePath, saveSessionStateAtomic } = require('../storage/sessionState');

chromium.use(stealth);

/**
 * Monitor de TikTok con Playwright + Stealth que intercepta stickers y persiste la sesión.
 */
class TikTokMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        this.statePath = options.statePath;
        this.saveIntervalMs = options.saveIntervalMs || 60000;
        this.headless = options.headless !== undefined ? options.headless : false;
        this.chromiumArgs = options.chromiumArgs || [
            '--disk-cache-size=10485760',
            '--media-cache-size=10485760',
            '--disable-gpu-cache',
            ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])
        ];

        this.browser = null;
        this.browserContext = null;
        this.tiktokPage = null;
        this.saveInterval = null;
        this.reconnectTimer = null;
        this.isSavingState = false;
        this._activeSavePromise = null;
        this._sessionId = 0;
        this.isRunning = false;
        this.isShuttingDown = false;
    }

    async start() {
        if (this.isRunning || this.isShuttingDown) return;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.isRunning = true;
        const sessionId = ++this._sessionId;

        console.log('🌐 Iniciando navegador de TikTok...');

        try {
            this.browser = await chromium.launch({
                headless: this.headless,
                args: [...this.chromiumArgs]
            });

            this.browser.on('disconnected', () => {
                if (!this.isShuttingDown && sessionId === this._sessionId) {
                    console.warn('⚠️ El navegador de TikTok se ha desconectado inesperadamente.');
                    this.emit('disconnected');
                    this._cleanupResources().finally(() => this._scheduleReconnect());
                }
            });

            const validStatePath = getValidSessionStatePath(this.statePath);
            this.browserContext = await this.browser.newContext({
                storageState: validStatePath || undefined
            });

            this.tiktokPage = await this.browserContext.newPage();

            this.tiktokPage.on('close', () => {
                if (!this.isShuttingDown && sessionId === this._sessionId) {
                    console.warn('⚠️ La pestaña de TikTok fue cerrada por el usuario o cayó.');
                    this._cleanupResources().finally(() => this._scheduleReconnect());
                }
            });

            this.tiktokPage.on('response', async (response) => {
                try {
                    if (response.status() !== 200) return;

                    const url = response.url();
                    const esSticker = url.includes('dm-sticker') || url.includes('dm_sticker') || url.includes('/sticker/');
                    if (!esSticker) return;

                    const headers = response.headers();
                    const contentType = (headers['content-type'] || '').toLowerCase();
                    const isMediaMime = !contentType || contentType.startsWith('image/') || contentType.startsWith('video/');
                    if (!isMediaMime || contentType.includes('svg')) {
                        return;
                    }

                    const contentLength = parseInt(headers['content-length'] || '0', 10);
                    const MAX_STICKER_BYTES = 10 * 1024 * 1024;

                    // Evita cargar respuestas gigantes en RAM ante respuestas CDN maliciosas
                    if (contentLength > MAX_STICKER_BYTES) {
                        console.warn('⚠️ Sticker omitido: excede el tamaño máximo permitido (10 MB).');
                        return;
                    }

                    let buffer;
                    try {
                        buffer = await response.body();
                    } catch (e) {
                        console.error('❌ No se pudo descargar el sticker (respuesta expirada):', e.message);
                        return;
                    }

                    if (this.isShuttingDown || sessionId !== this._sessionId) return;
                    if (!buffer || buffer.length === 0 || buffer.length > MAX_STICKER_BYTES) {
                        return;
                    }

                    this.emit('sticker', {
                        buffer,
                        contentType,
                        url
                    });
                } catch (e) {
                    console.error('❌ Error interceptando respuesta en TikTok:', e.message);
                }
            });

            await this.tiktokPage.goto('https://www.tiktok.com/messages');
            console.log('\n====================================================');
            console.log('📱 Todo configurado. Simplemente navega por tus chats de TikTok, abre los stickers que quieras pasar y ¡listo!');
            console.log('====================================================');

            this.saveInterval = setInterval(() => {
                if (this.browserContext && !this.isShuttingDown && !this.isSavingState && sessionId === this._sessionId) {
                    this.isSavingState = true;
                    this._activeSavePromise = saveSessionStateAtomic(this.browserContext, this.statePath)
                        .finally(() => {
                            this.isSavingState = false;
                            this._activeSavePromise = null;
                        });
                }
            }, this.saveIntervalMs);

            this.emit('started');
        } catch (err) {
            console.error('❌ Error al iniciar TikTok Scraper:', err.message);
            await this._cleanupResources();
            this.isRunning = false;
            this.emit('error', err);
            this._scheduleReconnect();
        }
    }

    async _cleanupResources() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        const browserToClose = this.browser;
        this.browser = null;
        this.browserContext = null;
        this.tiktokPage = null;
        if (browserToClose) {
            try {
                await browserToClose.close();
            } catch (_) {}
        }
    }

    _scheduleReconnect() {
        if (this.isShuttingDown || this.reconnectTimer) return;
        this.isRunning = false;

        console.log('🔄 Reintentando arrancar TikTok Scraper en 5 segundos...');
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isShuttingDown) {
                this.start().catch((err) => console.error('Error en reconexión de TikTok:', err.message));
            }
        }, 5000);
    }

    async stop() {
        this.isShuttingDown = true;
        this.isRunning = false;
        this._sessionId++;

        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this._activeSavePromise) {
            try { await this._activeSavePromise; } catch (_) {}
        }

        if (this.browserContext) {
            try {
                console.log('💾 Guardando estado final de sesión de TikTok...');
                await saveSessionStateAtomic(this.browserContext, this.statePath);
            } catch (_) {}
        }

        if (this.browser) {
            console.log('🌐 Cerrando navegador de TikTok...');
        }
        await this._cleanupResources();

        this.emit('stopped');
    }
}

module.exports = TikTokMonitor;
