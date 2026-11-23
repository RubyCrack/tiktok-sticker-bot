# TikTok Sticker Bot for WhatsApp

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Stealth-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Web.js-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://wwebjs.dev/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-brightgreen.svg?style=flat-square)](SECURITY.md)

Bot automatizado que intercepta stickers (estáticos y animados) desde TikTok Web y los exporta directamente a WhatsApp manteniendo el formato nativo cuadrado (512x512) y canal alfa transparente.

---

## ⚡ Características

- **Intercepción en tiempo real:** Captura automática de stickers de mensajes directos mediante Playwright con evasión de detección (*Stealth*).
- **Procesamiento con Sharp:** Cuadra stickers WebP no cuadrados a 512×512 con fondo transparente (stickers ya cuadrados, WebP animados >300 fotogramas y vídeos `.mp4` se envían en su formato original).
- **Cola antispam con reintentos:** Despacho secuencial configurable para proteger la cuenta contra bloqueos en WhatsApp.
- **Deduplicación atómica:** Registro local por destinatario mediante firmas MD5 que evita envíos repetidos.
- **Control interactivo:** Comandos en tiempo real disponibles tanto en la terminal como a través de WhatsApp.
- **Sesión persistente:** Almacenamiento seguro de credenciales de TikTok y WhatsApp para evitar re-autenticaciones.

---

## 🚀 Inicio Rápido

### 1. Requisitos
- **Node.js** >= 18.0.0
- **Google Chrome** o Chromium

### 2. Instalación

```bash
# Clonar repositorio e instalar dependencias
git clone https://github.com/tu-usuario/tiktok-sticker-bot.git
cd tiktok-sticker-bot
npm install

# Instalar binarios de Chromium para Playwright
npx playwright install chromium
```

### 3. Configuración

Copia la plantilla `.env.example` y define tu número:

```bash
cp .env.example .env
```

```env
# Tu número de WhatsApp con prefijo internacional (sin '+' ni espacios)
OWNER_NUMBER=34XXXXXXXXX

# Retardo entre envíos en milisegundos (antispam)
STICKER_DELAY_MS=1000

# Capacidad máxima del historial de stickers
MAX_DB_ENTRIES=5000

# Guardado periódico de sesión de TikTok (ms), capacidad de cola y reintentos
TIKTOK_SAVE_INTERVAL_MS=60000
MAX_COLA_STICKERS=100
MAX_REINTENTOS_ENVIO=2

# Ruta personalizada a Chrome para WhatsApp Web (opcional)
CHROME_PATH=
```

---

## 💻 Uso

Inicia el servicio (`npm run dev` para recarga con nodemon, `npm test` para la suite en seco, `npm run graph` para servir el grafo en `127.0.0.1:3000`):

```bash
npm start
```

1. **Vincula WhatsApp:** Escanea el código QR que se mostrará en la terminal.
2. **Inicia sesión en TikTok:** Se abrirá una ventana de Chromium en los mensajes directos de TikTok. Inicia sesión la primera vez; se guardará automáticamente en `tiktok_state.json`.
3. **Exporta:** Navega por tus chats y reproduce o abre los stickers que desees enviar.

---

## 🕹️ Comandos

Puedes ejecutarlos desde la **consola de la terminal** o enviándotelos en un **chat contigo mismo en WhatsApp**:

| Comando | Acción |
|---|---|
| `!destino <numero>` | Solicita cambiar el receptor (ej: `!destino 34600112233`). Valida que exista y pide confirmación. |
| `si` / `sí` / `no` | Confirma o cancela el cambio de destino pendiente. |
| `!destino default` | Restablece el destino a tu propio número (`OWNER_NUMBER`). |
| `!reset-db` / `!limpiar-db` | Vacía la cola activa y reinicia el historial de enviados para poder reenviar stickers pasados. |

---

## 🛑 Detener el Servicio

Pulsa `Ctrl + C` en la terminal. El bot ejecuta un *graceful shutdown*:
1. Cierra la consola, pausa/limpia la cola y guarda la sesión y cookies de TikTok de forma atómica.
2. Cierra limpiamente las instancias de Chromium y WhatsApp Web.
3. Vacía `temp/` y las cachés temporales del navegador en `.wwebjs_auth/`.

---

## ⚖️ Licencia, Legal y Privacidad

- **Licencia:** Distribuido bajo [GNU GPL v3.0](LICENSE).
- **Términos de Uso:** Consulta [TERMS.md](TERMS.md) para avisos legales, descargo de responsabilidad y uso responsable.
- **Privacidad:** Procesamiento 100% local y política de *Zero Telemetry*. Ver [PRIVACY.md](PRIVACY.md).
- **Seguridad:** Reporte responsable de vulnerabilidades y aislamiento de credenciales en [SECURITY.md](SECURITY.md).
