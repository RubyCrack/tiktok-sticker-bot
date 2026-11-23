# TikTok Sticker Bot for WhatsApp

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-Stealth-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Web.js-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://wwebjs.dev/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-brightgreen.svg?style=flat-square)](SECURITY.md)

Bot que captura stickers estáticos y animados de TikTok Web y los envía directamente a WhatsApp. Ajusta las imágenes WebP que no tienen formato cuadrado a 512 × 512 píxeles, conservando la transparencia del canal alfa.

## Características

- **Captura automática:** detecta stickers de los mensajes directos de TikTok mediante Playwright y su configuración Stealth.
- **Procesamiento de imágenes:** utiliza Sharp para adaptar los stickers WebP no cuadrados a 512 × 512 píxeles con fondo transparente. Los stickers que ya son cuadrados, los WebP animados con más de 300 fotogramas y los vídeos `.mp4` se envían en su formato original.
- **Cola de envíos:** procesa los stickers de forma secuencial, con un intervalo configurable y reintentos para reducir el riesgo de bloqueos en WhatsApp.
- **Control de duplicados:** mantiene un registro local por destinatario mediante firmas MD5 y evita volver a enviar stickers que ya se han procesado.
- **Comandos interactivos:** permite gestionar el bot en tiempo real desde la terminal o mediante un chat de WhatsApp.
- **Sesiones persistentes:** guarda las sesiones de TikTok y WhatsApp para evitar tener que autenticarse cada vez que se inicia el servicio.

## Inicio rápido

### 1. Requisitos

- Node.js >= 18.0.0
- Google Chrome o Chromium

### 2. Instalación

Clona el repositorio e instala las dependencias:

```bash
# Clonar repositorio e instalar dependencias
git clone https://github.com/RubyCrack/tiktok-sticker-bot.git
cd tiktok-sticker-bot
npm install

# Instalar binarios de Chromium para Playwright
npx playwright install chromium
```

### 3. Configuración

Crea el archivo `.env` a partir de la plantilla `.env.example`:

```bash
cp .env.example .env
```

Después, configura tu número de WhatsApp y los parámetros del bot:

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

Puedes modificar estos valores según tus necesidades. `CHROME_PATH` es opcional y solo hace falta configurarlo cuando quieras utilizar una instalación de Chrome ubicada en una ruta personalizada.

## Uso

Para iniciar el bot:

```bash
npm start
```

También tienes disponibles estos comandos:

| Comando | Función |
|---|---|
| `npm run dev` | Inicia el servicio con recarga automática mediante nodemon. |
| `npm test` | Ejecuta la suite de pruebas en modo seco. |
| `npm run graph` | Sirve el grafo en `127.0.0.1:3000`. |

La primera vez que ejecutes el bot tendrás que vincular tus cuentas:

1. **Conecta WhatsApp:** escanea el código QR que aparecerá en la terminal.
2. **Inicia sesión en TikTok:** se abrirá una ventana de Chromium con los mensajes directos de TikTok. Inicia sesión; el estado de la sesión se guardará automáticamente en `tiktok_state.json`.
3. **Envía los stickers:** navega por tus conversaciones de TikTok y reproduce o abre los stickers que quieras exportar. El bot se encargará de capturarlos y enviarlos a WhatsApp.

## Comandos disponibles

Los comandos se pueden ejecutar desde la terminal o enviándolos en un chat contigo mismo en WhatsApp.

| Comando | Acción |
|---|---|
| `!destino <numero>` | Cambia el destinatario de los stickers. Por ejemplo, `!destino 34600112233`. El bot comprueba que el número exista y solicita confirmación antes de aplicar el cambio. |
| `si` / `sí` / `no` | Confirma o cancela el cambio de destinatario pendiente. |
| `!destino default` | Vuelve a utilizar tu propio número, definido en `OWNER_NUMBER`. |
| `!reset-db` / `!limpiar-db` | Vacía la cola activa y reinicia el historial de stickers enviados. Esto permite volver a enviar stickers anteriores. |

## Detener el servicio

Para detener el bot, pulsa `Ctrl + C` en la terminal.

El servicio realiza un cierre controlado (*graceful shutdown*) para guardar el estado y liberar los recursos utilizados:

1. Cierra la consola, pausa y limpia la cola de envíos, y guarda la sesión y las cookies de TikTok de forma atómica.
2. Cierra las instancias de Chromium y WhatsApp Web.
3. Limpia el directorio `temp/` y las cachés temporales del navegador en `.wwebjs_auth/`.

## Licencia, aspectos legales y privacidad

- **Licencia:** el proyecto se distribuye bajo la licencia [GNU GPL v3.0](LICENSE).
- **Términos de uso:** consulta [TERMS.md](TERMS.md) para conocer los avisos legales, el descargo de responsabilidad y las condiciones de uso responsable.
- **Privacidad:** el procesamiento se realiza localmente y el proyecto sigue una política de *Zero Telemetry* (sin telemetría). Más información en [PRIVACY.md](PRIVACY.md).
- **Seguridad:** las instrucciones para informar de vulnerabilidades de forma responsable y la información sobre el aislamiento de credenciales están disponibles en [SECURITY.md](SECURITY.md).
