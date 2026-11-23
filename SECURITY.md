# Política de seguridad

La seguridad y la privacidad de quienes utilizan **TikTok Sticker Bot** son aspectos importantes del proyecto. Esta página recoge las versiones con soporte, cómo informar de posibles vulnerabilidades y las medidas que se utilizan para proteger las sesiones y credenciales.

## Versiones soportadas

Actualmente, solo se proporciona soporte y se publican correcciones de seguridad para la versión principal del proyecto, disponible en la rama `main`.

| Versión | Soporte de seguridad |
|---|---|
| 1.x (rama `main`) | Sí |

## Notificación de vulnerabilidades

Si encuentras un fallo de seguridad o detectas algún problema relacionado con el aislamiento de credenciales, te pedimos que lo comuniques de forma privada.

Para informar de una vulnerabilidad:

1. No abras una *issue* pública en GitHub, ya que podría exponer el problema antes de que exista una solución.
2. Envía un informe detallado al mantenedor del repositorio o utiliza la opción **Security Advisory** de GitHub para crear un aviso privado.
3. Incluye toda la información que pueda ayudar a analizar el problema:
   - Una descripción del fallo y del posible vector de ataque.
   - Los pasos necesarios para reproducirlo o una prueba de concepto (*PoC*).
   - El posible impacto sobre las sesiones o cuentas de WhatsApp y TikTok.

El objetivo es confirmar la recepción del informe en un plazo inferior a 48 horas y coordinar la publicación de una corrección antes de divulgar públicamente la vulnerabilidad.

## Protección de credenciales y sesiones

TikTok Sticker Bot utiliza sesiones activas de TikTok y WhatsApp para acceder a los mensajes y gestionar el envío de stickers. Estos datos contienen información sensible y deben mantenerse fuera del repositorio y de cualquier lugar al que puedan acceder terceros.

### Archivos que no debes compartir

Los siguientes archivos y directorios contienen información privada:

| Archivo / Carpeta | Información que contiene | En `.gitignore` |
|---|---|---|
| `tiktok_state.json` | Cookies de sesión y tokens de acceso a TikTok Web. Una filtración podría permitir que otra persona accediera a tu cuenta. | Sí |
| `.wwebjs_auth/` | Claves de cifrado, datos de IndexedDB y tokens de sesión de WhatsApp Web. | Sí |
| `.env` | Números de teléfono personales y rutas locales del sistema. | Sí |
| `stickers_enviados.json` | Números de teléfono de los destinatarios asociados a hashes de stickers. | Sí |

**Importante:** no subas estos archivos a GitHub ni los compartas con otras personas. Evita también publicar capturas de pantalla o registros de la terminal (*logs*) que puedan mostrar números de teléfono, cookies o tokens de sesión.

### Medidas de seguridad implementadas

El proyecto incluye varias medidas para proteger los datos locales y gestionar correctamente las sesiones:

- **Almacenamiento local:** las credenciales y cookies se leen y almacenan localmente. El proyecto no las envía a servidores externos ni utiliza servicios de telemetría.
- **Escrituras atómicas:** los datos se guardan mediante archivos temporales con permisos `0o600` y operaciones de renombrado atómico. Para ello se utilizan `safeAtomicWriteFile` y `safeAtomicWriteFileSync`, reduciendo el riesgo de corrupción o pérdida de datos durante un cierre inesperado.
- **Control de procesos:** al detener el bot, se cierran explícitamente los procesos de Chromium para evitar que queden instancias huérfanas o procesos activos en segundo plano.
- **Control de envíos:** los stickers pasan por una cola secuencial con un retardo configurable. Esto ayuda a evitar ráfagas de mensajes que puedan activar los sistemas de protección contra abuso de WhatsApp.

Si tienes dudas sobre la seguridad del proyecto o necesitas informar de un problema, utiliza los canales privados indicados en la sección de notificación de vulnerabilidades.
