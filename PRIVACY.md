# Política de Privacidad

Última actualización: 2026-10-27

Tu privacidad es una prioridad fundamental. **TikTok Sticker Bot for WhatsApp** está diseñado bajo el principio de **privacidad absoluta por diseño** (*Privacy by Design*).

---

## 1. Principio de Cero Telemetría (*Zero Telemetry*)

- Este software **NO recopila, rastrea ni envía ningún tipo de información** a servidores externos, bases de datos remotas, servicios de análisis (*analytics*) ni a los desarrolladores del proyecto.
- Toda la ejecución ocurre **100% de forma local** en el equipo en el que se ejecuta el código.
- Las únicas conexiones de red que se establecen son las estrictamente necesarias entre tu navegador local y los servidores oficiales de **TikTok** y **WhatsApp Web**.

---

## 2. Información Procesada y Almacenada Localmente

El software gestiona localmente los siguientes datos para su correcto funcionamiento:

| Tipo de Dato | Finalidad | Dónde se guarda |
|---|---|---|
| **Números de Teléfono** | Enviar los stickers al chat de destino configurado. | Archivo local `.env` y temporalmente en memoria. |
| **Cookies y Tokens de TikTok** | Evitar tener que ingresar credenciales cada vez que inicia el bot. | Archivo local `tiktok_state.json`. |
| **Sesión de WhatsApp** | Mantener la vinculación del dispositivo mediante código QR. | Directorio local `.wwebjs_auth/`. |
| **Historial de Stickers (Hashes MD5)** | Prevenir el reenvío involuntario de stickers ya transferidos. | Archivo local `stickers_enviados.json`. |
| **Archivos Multimedia Temporales** | Normalizar el tamaño y relación de aspecto de los stickers con Sharp. | Carpeta local `temp/` (se vacía automáticamente al cerrar el bot). |

---

## 3. Seguridad y Compartición de Datos

- **Sin Venta ni Cesión:** Ningún dato procesado por este bot es compartido, comercializado o cedido a terceros.
- **Exclusión de Git:** Todos los archivos que contienen datos personales o credenciales (`.env`, `tiktok_state.json`, `.wwebjs_auth/`, `stickers_enviados.json`) están explícitamente listados en `.gitignore` para prevenir su publicación accidental en repositorios públicos.

---

## 4. Control del Usuario y Borrado de Datos

Tú tienes el control total de todos tus datos en todo momento. Para eliminar permanentemente cualquier rastro de sesiones o historiales:

1. Detén el bot pulsando `Ctrl + C`.
2. Elimina los archivos de sesión correspondientes:
   ```bash
   # Elimina la sesión de TikTok
   rm -f tiktok_state.json

   # Elimina la sesión de WhatsApp Web
   rm -rf .wwebjs_auth/ .wwebjs_cache/

   # Elimina el registro de stickers enviados
   rm -f stickers_enviados.json
   ```
Al eliminarlos, la próxima vez que arranques el software comenzará con un estado completamente limpio.
