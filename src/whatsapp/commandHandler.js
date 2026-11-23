/**
 * Gestor de comandos interactivos (!destino, si/no, !reset-db) para consola y WhatsApp.
 */
class CommandHandler {
    constructor(options = {}) {
        this.defaultDestination = options.defaultDestination || '';
        this.numeroDestino = this.defaultDestination;
        this.estadoPendiente = null;
        this.procesandoComando = false;
        this.contactVerifier = options.contactVerifier || null;
        this.onResetDb = options.onResetDb || null;
    }

    getDestination() {
        return this.numeroDestino;
    }

    getPendingState() {
        return this.estadoPendiente;
    }

    _parseInput(rawTexto) {
        if (!rawTexto || typeof rawTexto !== 'string') return null;
        const trimmed = rawTexto.trim();
        const texto = trimmed.toLowerCase();
        if (!texto) return null;

        if (texto === 'si' || texto === 'sí') return { type: 'confirm' };
        if (texto === 'no') return { type: 'cancel' };
        if (texto === '!destino default') return { type: 'default' };
        if (texto === '!destino') return { type: 'help_dest' };
        if (texto.startsWith('!destino ')) return { type: 'set_dest', rawArg: trimmed.substring(9) };
        if (texto === '!reset-db' || texto === '!limpiar-db') return { type: 'reset_db' };
        return null;
    }

    isCommandOrPendingReply(rawTexto) {
        const parsed = this._parseInput(rawTexto);
        if (!parsed) return false;
        if (parsed.type === 'confirm' || parsed.type === 'cancel') {
            return Boolean(this.estadoPendiente);
        }
        return true;
    }

    async handleCommand(rawTexto, responder) {
        if (!rawTexto || typeof rawTexto !== 'string' || !rawTexto.trim()) return;

        if (this.procesandoComando) {
            await responder('⏳ Espera, estoy procesando el comando anterior...');
            return;
        }

        const parsed = this._parseInput(rawTexto);
        this.procesandoComando = true;
        try {
            if (this.estadoPendiente) {
                if (parsed?.type === 'confirm') {
                    this.numeroDestino = this.estadoPendiente.numero;
                    await responder(`✅ Confirmado. Los próximos stickers irán dirigidos a *${this.estadoPendiente.nombre}*.`);
                    this.estadoPendiente = null;
                    return;
                }
                if (parsed?.type === 'cancel') {
                    await responder('❌ Operación cancelada. El destino sigue siendo el anterior.');
                    this.estadoPendiente = null;
                    return;
                }
                if (parsed) {
                    this.estadoPendiente = null;
                } else {
                    await responder('❓ Responde *si* o *no* para confirmar el destino pendiente.');
                    return;
                }
            }

            if (parsed?.type === 'default') {
                this.numeroDestino = this.defaultDestination;
                await responder('✅ Regresando al destino por defecto (tu propio chat).');
                return;
            }

            if (parsed?.type === 'reset_db') {
                if (typeof this.onResetDb === 'function') {
                    await this.onResetDb();
                    await responder('🗑️ Historial de stickers enviados reiniciado. Los stickers de TikTok volverán a enviarse.');
                } else {
                    await responder('⚠️ Reinicio de base de datos no disponible.');
                }
                return;
            }

            if (parsed?.type === 'help_dest') {
                await responder('❌ Falta el número. Usa: !destino 34600111222  |  !destino default');
                return;
            }

            if (parsed?.type === 'set_dest') {
                const nuevoNumero = parsed.rawArg.replace(/[^0-9]/g, '');

                if (!nuevoNumero) {
                    await responder('❌ Falta el número. Usa: !destino 34600111222');
                    return;
                }

                if (nuevoNumero.length < 8 || nuevoNumero.length > 15) {
                    await responder('❌ Ese número no parece válido (debe incluir el prefijo de país, ej: 34600111222).');
                    return;
                }

                const numberId = `${nuevoNumero}@c.us`;
                await responder('🔍 Verificando número en WhatsApp...');

                try {
                    let isRegistered = true;
                    let nombre = 'Desconocido/Sin Nombre';

                    if (this.contactVerifier && typeof this.contactVerifier.verifyContact === 'function') {
                        const result = await this.contactVerifier.verifyContact(numberId);
                        isRegistered = result.isRegistered;
                        nombre = result.name || nombre;
                    }

                    if (!isRegistered) {
                        await responder(`❌ El número +${nuevoNumero} NO tiene cuenta de WhatsApp activa.`);
                        return;
                    }

                    this.estadoPendiente = { numero: numberId, nombre };
                    await responder(`⚠️ El número +${nuevoNumero} corresponde a *${nombre}*.\n¿Es correcto? Responde *si* o *no*.`);
                } catch (error) {
                    await responder('❌ Error al consultar la base de datos de WhatsApp.');
                    console.error('Error verificando contacto:', error.message);
                }
                return;
            }

            await responder('❓ Comando no reconocido. Usa: !destino <numero>  |  !destino default  |  !reset-db');
        } finally {
            this.procesandoComando = false;
        }
    }
}

module.exports = CommandHandler;
