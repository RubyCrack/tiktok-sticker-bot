const EventEmitter = require('events');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

/**
 * Servicio de WhatsApp Web con reconexión exponencial y cierre limpio de Chromium.
 */
class WhatsAppService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.chromeExecutablePath = options.chromeExecutablePath;
        this.ffmpegPath = options.ffmpegPath;
        this.headless = options.headless !== undefined ? options.headless : false;
        this.chromiumArgs = options.chromiumArgs || [
            '--disk-cache-size=10485760',
            '--media-cache-size=10485760',
            '--disable-gpu-cache',
            ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])
        ];

        this.rawClient = null;
        this.ready = false;
        this.isShuttingDown = false;
        this.isReconnecting = false;
        this._reconnectTimer = null;
        this._reconnectPromise = null;

        this._buildInternalClient();
    }

    _buildInternalClient() {
        this.rawClient = new Client({
            authStrategy: new LocalAuth(),
            ffmpegPath: this.ffmpegPath,
            puppeteer: {
                headless: this.headless,
                executablePath: this.chromeExecutablePath,
                args: [...this.chromiumArgs, '--aggressive-cache-discard']
            }
        });

        this.rawClient.on('qr', (qr) => {
            this.emit('qr', qr);
        });

        this.rawClient.on('ready', () => {
            this.ready = true;
            this.emit('ready');
        });

        this.rawClient.on('auth_failure', (msg) => {
            this.ready = false;
            console.error('❌ Fallo de autenticación en WhatsApp:', msg);
            this.emit('auth_failure', msg);
        });

        this.rawClient.on('disconnected', (reason) => {
            this.ready = false;
            this.emit('disconnected', reason);

            if (this.isShuttingDown || this.isReconnecting) {
                return;
            }

            console.log('❌ WhatsApp se ha desconectado. Motivo:', reason);
            this._reconnectPromise = this._reconnectLoop().finally(() => {
                this._reconnectPromise = null;
            });
        });

        this.rawClient.on('message_create', (msg) => {
            this.emit('message_create', msg);
        });
    }

    async _reconnectLoop() {
        this.isReconnecting = true;
        let attempt = 0;

        try {
            while (!this.isShuttingDown) {
                const delayMs = Math.min(3000 * (2 ** attempt), 30000);
                attempt++;
                console.log(`🔄 Reintentando conectar WhatsApp en ${delayMs / 1000}s (intento ${attempt})...`);

                if (this.rawClient) {
                    const stale = this.rawClient;
                    this.rawClient = null;
                    try { stale.removeAllListeners(); } catch (_) {}
                    try { await stale.destroy(); } catch (err) {
                        console.warn('⚠️ Error al destruir cliente tras desconexión:', err.message);
                    }
                }

                await new Promise((resolve) => {
                    this._reconnectTimer = setTimeout(() => {
                        this._reconnectTimer = null;
                        resolve();
                    }, delayMs);
                });

                if (this.isShuttingDown) return;

                try {
                    this._buildInternalClient();
                    await this.rawClient.initialize();
                    return;
                } catch (err) {
                    console.error('❌ Error al reinicializar WhatsApp:', err.message);
                }
            }
        } finally {
            this.isReconnecting = false;
        }
    }

    async initialize() {
        if (!this.rawClient) {
            this._buildInternalClient();
        }
        await this.rawClient.initialize();
    }

    async sendMessage(chatId, content, options = {}) {
        if (!this.rawClient || !this.ready) {
            throw new Error('Cliente de WhatsApp no conectado');
        }
        return this.rawClient.sendMessage(chatId, content, options);
    }

    async verifyContact(numberId) {
        if (!this.rawClient || !this.ready) {
            throw new Error('Cliente de WhatsApp no conectado');
        }
        const isRegistered = await this.rawClient.isRegisteredUser(numberId);
        if (!isRegistered) {
            return { isRegistered: false, name: null };
        }
        const contact = await this.rawClient.getContactById(numberId);
        return {
            isRegistered: true,
            name: contact?.name || contact?.pushname || null
        };
    }

    createMediaFromFile(filePath) {
        return MessageMedia.fromFilePath(filePath);
    }

    async destroy() {
        this.isShuttingDown = true;
        this.ready = false;
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
        if (this._reconnectPromise) {
            try { await this._reconnectPromise; } catch (_) {}
        }
        if (this.rawClient) {
            const clientToClose = this.rawClient;
            this.rawClient = null;
            try { clientToClose.removeAllListeners(); } catch (_) {}
            try { await clientToClose.destroy(); } catch (_) {}
        }
    }
}

module.exports = {
    WhatsAppService
};
