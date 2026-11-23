const readline = require('readline');

/**
 * Interfaz de consola para leer comandos desde stdin.
 */
class TerminalInterface {
    constructor(options = {}) {
        this.onLine = options.onLine || (async () => {});
        this.rl = null;
        this.closed = false;
    }

    start() {
        if (this.rl || this.closed) return;

        this.rl = readline.createInterface({
            input: process.stdin,
            terminal: false
        });

        this.rl.on('line', async (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            try {
                await this.onLine(trimmed);
            } catch (err) {
                console.error('❌ Error procesando entrada de terminal:', err.message);
            }
        });
    }

    close() {
        this.closed = true;
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }
}

module.exports = TerminalInterface;
