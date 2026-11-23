# Política de Seguridad

Nos tomamos muy en serio la seguridad y la privacidad de los usuarios que utilizan **TikTok Sticker Bot**.

---

## 🛡️ Versiones Soportadas

Actualmente se proporciona soporte y parches de seguridad únicamente para la versión principal (`main`):

| Versión | Soportada |
|---|---|
| 1.x (rama `main`) | ✅ Sí |
| < 1.0.0 | ❌ No |

---

## 🚨 Notificación de Vulnerabilidades

Si descubres una vulnerabilidad de seguridad o un fallo en el aislamiento de credenciales:

1. **NO** abras una *issue* pública en GitHub.
2. Envía un reporte detallado al mantenedor del repositorio o abre un **Security Advisory** privado en GitHub.
3. Incluye en tu reporte:
   - Descripción clara del problema y vector de ataque.
   - Pasos para reproducirlo o prueba de concepto (*PoC*).
   - Posible impacto sobre la sesión de WhatsApp o TikTok.

Nos comprometemos a acusar recibo en un plazo inferior a 48 horas y coordinar la publicación de un parche correctivo antes de la divulgación pública.

---

## 🔒 Manejo Seguro de Credenciales y Sesiones

Este proyecto interactúa con sesiones activas de dos plataformas de terceros (**TikTok** y **WhatsApp**). Para proteger tu privacidad y evitar accesos no autorizados:

### 1. Archivos Críticos que NUNCA deben compartirse

| Archivo / Carpeta | Contenido sensible | Estado en `.gitignore` |
|---|---|---|
| `tiktok_state.json` | Cookies de sesión y tokens de acceso a TikTok Web. Si se filtra, terceros podrían acceder a tu cuenta de TikTok. | ✅ Ignorado |
| `.wwebjs_auth/` | Claves de cifrado, IndexedDB y tokens de sesión de WhatsApp Web. | ✅ Ignorado |
| `.env` | Números de teléfono personales y rutas locales del sistema. | ✅ Ignorado |
| `stickers_enviados.json` | Números de teléfono de destinatarios asociados a hashes de stickers. | ✅ Ignorado |

> ⚠️ **Aviso:** Nunca hagas commit ni compartas capturas de pantalla de estos archivos o de los logs de la terminal que contengan números telefónicos o tokens de sesión.

### 2. Medidas de Mitigación Implementadas

- **Aislamiento en Memoria:** Las credenciales y cookies se leen localmente y no se transmiten a servidores externos ni servicios de telemetría.
- **Escrituras Atómicas:** La persistencia de datos utiliza archivos temporales (`0o600`) y renombrado atómico (`safeAtomicWriteFile` / `safeAtomicWriteFileSync`), previniendo archivos corruptos o datos truncados ante cierres forzados.
- **Watchdog y Desconexión Limpia:** Los procesos de Chromium se destruyen de forma explícita al cerrar el bot para evitar procesos huérfanos o escuchas residuales en memoria.
- **Cola Antispam:** El envío secuencial con retardo previene ráfagas que puedan activar los mecanismos de protección contra abuso o baneos de WhatsApp.
