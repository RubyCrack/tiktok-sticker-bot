const EventEmitter = require('events');

class StickerQueue extends EventEmitter {
    constructor(options = {}) {
        super();
        this.delayMs = options.delayMs !== undefined ? options.delayMs : 1000;
        this.maxQueueSize = options.maxQueueSize !== undefined ? options.maxQueueSize : 100;
        this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
        this.taskTimeoutMs = options.taskTimeoutMs !== undefined ? options.taskTimeoutMs : 30000;
        this.worker = options.worker || (async () => true);

        this.queue = [];
        this.stickersEnProceso = new Set();
        this.isProcessing = false;
        this.isPaused = false;
        this._generation = 0;
        this._activeController = null;
    }

    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.emit('paused');
        }
    }

    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.emit('resumed');
            this._pump();
        }
    }

    enqueue(task) {
        const { clave } = task;

        if (this.stickersEnProceso.has(clave)) {
            return false;
        }

        if (this.queue.length >= this.maxQueueSize) {
            console.warn(`⚠️ Cola llena (${this.maxQueueSize}), se descarta sticker para no saturar memoria.`);
            this.emit('dropped', { task, reason: 'QUEUE_FULL' });
            return false;
        }

        this.stickersEnProceso.add(clave);
        this.queue.push({
            ...task,
            intentos: 0
        });

        this.emit('enqueued', { task, remaining: this.queue.length });
        this._pump();
        return true;
    }

    async _pump() {
        if (this.isProcessing || this.isPaused || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const generation = this._generation;
        const task = this.queue.shift();
        const controller = new AbortController();
        this._activeController = controller;

        let enviadoOk = false;
        let timeoutHandle = null;
        try {
            this.emit('processing', { task, remaining: this.queue.length });
            const timeoutPromise = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    controller.abort();
                    reject(new Error(`TIMEOUT_EXCEDIDO: El envío del sticker tardó más de ${Math.round(this.taskTimeoutMs / 1000)}s`));
                }, this.taskTimeoutMs);
            });

            enviadoOk = await Promise.race([this.worker(task, controller.signal), timeoutPromise]);
        } catch (err) {
            console.error('❌ Error en ejecución de tarea de cola:', err.message);
            enviadoOk = false;
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (this._activeController === controller) this._activeController = null;
        }

        if (generation !== this._generation) return;

        if (enviadoOk) {
            this.stickersEnProceso.delete(task.clave);
            this.emit('success', { task });

            if (this.queue.length > 0 && this.delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, this.delayMs));
                if (generation !== this._generation) return;
            }
        } else if (this.isPaused) {
            // Si WhatsApp se desconectó durante el envío, no quemar reintentos
            this.queue.unshift(task);
            this.isProcessing = false;
            return;
        } else {
            if (task.intentos < this.maxRetries) {
                const siguienteIntento = task.intentos + 1;
                const backoffMs = siguienteIntento * 1500;
                console.log(`🔁 Reintentando sticker en ${backoffMs}ms (intento ${siguienteIntento}/${this.maxRetries})...`);

                this.emit('retry', { task, nextAttempt: siguienteIntento, backoffMs });
                this.queue.unshift({
                    ...task,
                    intentos: siguienteIntento
                });

                if (backoffMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, backoffMs));
                    if (generation !== this._generation) return;
                }
            } else {
                console.log('🚫 Se agotaron los reintentos para este sticker, se descarta.');
                this.stickersEnProceso.delete(task.clave);
                this.emit('failed', { task, reason: 'MAX_RETRIES_EXCEEDED' });
            }
        }

        this.isProcessing = false;

        if (!this.isPaused && this.queue.length > 0) {
            this._pump();
        } else if (!this.isPaused && this.queue.length === 0) {
            this.emit('drain');
        }
    }

    clear() {
        this._generation++;
        if (this._activeController) {
            this._activeController.abort();
            this._activeController = null;
        }
        this.queue = [];
        this.stickersEnProceso.clear();
        this.isProcessing = false;
    }
}

module.exports = StickerQueue;
