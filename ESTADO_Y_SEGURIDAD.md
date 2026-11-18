# Estado y límites de seguridad — GAMVORAQ v7

## Reglas en la base de datos

Todo lo siguiente lo aplica PostgreSQL con RLS, triggers y funciones: no depende de que la app oculte botones.

### Heredado de la v4/v5
- Mensajes privados solo entre las dos personas de la conversación; bloqueos respetados.
- Chat de squad solo para integrantes; anuncios solo los publica la moderación de la comunidad.
- Recuerdos (MEMORIES) visibles para el squad solo cuando todas las personas mencionadas aceptan; fotos en bucket **privado** con URL firmadas de 10 minutos.
- Retos: nadie aprueba su propia evidencia.
- Solo se usa la clave **publishable** en el navegador.

### Nuevo en la v6 (`003_gamvoraq_v6.sql`)

| Regla | Cómo se cumple |
|---|---|
| Menores solo se escriben en privado con menores | `private.same_age_band()` dentro de las políticas de `conversations` y `direct_messages`. Una cuenta sin edad tampoco puede escribir a un menor |
| Nadie ve la edad de nadie | El año de nacimiento vive en `profile_private`, legible solo por su dueño. La app pregunta al servidor con `private_ok()`, que responde «sí/no» sin revelar edades |
| Rango de edad conservador | Solo con el año: quien cumple 18 este año cuenta como menor hasta el siguiente |
| Disponibilidad acotada | Trigger que exige un final futuro y lo limita a 6 horas |
| Agenda | Solo integrantes ven las partidas de su squad; las abiertas respetan bloqueos y rango de edad. El cupo se valida con bloqueo de fila. No se puede cambiar quién organiza |
| Química | Solo entre quienes confirmaron «Voy», desde que empieza la partida y durante 14 días; solo etiquetas positivas de una lista fija; una calificación por persona y partida |
| Anonimato de la química | Cada quien solo puede leer las calificaciones que **dio**. Lo recibido llega agregado por `gg_passport()` y `my_chemistry()` |
| Anti-spam | Trigger por tabla: 20 mensajes/min en chats privados y de squad, 10 en anuncios y comentarios, 5 publicaciones/min |
| Caché de traducciones | `message_translations` y `translation_usage` sin acceso para usuarios: solo la Edge Function con la clave secreta |

Estas reglas se probaron en un PostgreSQL 16 real con una simulación de Supabase (22 comprobaciones actuando como distintos usuarios). Repite las pruebas con cuentas reales en tu proyecto antes de publicar.

### Nuevo en la v7 (`004_gamvoraq_v7.sql`)

| Regla | Cómo se cumple |
|---|---|
| Guías solo de juegos propios | Solo puedes ofrecerte como guía de un juego que está en tu biblioteca |
| Guías respetan la protección de menores | Pedir guía exige el mismo rango de edad, porque después hablan en privado |
| Cada quien cambia solo lo suyo | Trigger: la guía acepta o rechaza; quien aprende cierra y valora. Nadie cambia el mensaje ni las personas |
| Sala tranquila sin acoso | Solo se saluda a quien está en modo silencioso; un saludo por pareja cada 30 minutos; respeta bloqueos |
| Ligas | Solo el dueño de un squad lo inscribe y solo mientras hay inscripciones; solo quien organiza crea partidos y registra resultados; ambos squads deben estar inscritos |
| Segunda oportunidad privada | Los avisos de conducta los ven solo la persona y la moderación de esa comunidad. Se crean únicamente cuando la moderación marca un reporte como «revisado» |
| Modo familia | Solo un adulto puede pedirlo y solo para un menor; solo el menor acepta; cualquiera de los dos lo termina y el otro recibe aviso. `family_overview()` devuelve actividad y reportes, **nunca** texto de mensajes |
| Buscar al menor sin exponer edades | `family_lookup()` solo responde a adultos y solo devuelve cuentas de menores |
| Push | Suscripciones visibles solo para su dueño; la URL y el secreto de la función viven en `private.settings`, sin acceso para usuarios. Un fallo de push nunca impide guardar un aviso |
| Funciones con costo | `function_usage` y `use_function()` solo para el servidor: límite diario de IA y de importaciones de Steam por persona |

## Funciones del servidor de la v7

- **vora-ai:** exige sesión; límite diario por persona; el historial se acota a pocos turnos y **no se guarda**. Las instrucciones prohíben pedir datos personales y contenido para adultos, refuerzan el cuidado con menores y remiten a ayuda ante crisis. Las señales de crisis las atiende antes VORA con sus reglas locales. Los mensajes se envían al proveedor de IA que configures: menciónalo en tu política de privacidad.
- **steam-import:** exige sesión y tiene límite diario. Solo lee la biblioteca pública de Steam y agrega juegos a la biblioteca de quien lo pide.
- **push:** la llama solo la base de datos, con un secreto compartido. Cifra cada aviso con el estándar Web Push (aes128gcm + VAPID) y borra las suscripciones vencidas. El texto del aviso viaja cifrado de punta a punta hasta el dispositivo.
- **discord:** verifica la firma Ed25519 de cada petición de Discord. Solo muestra a quienes activaron «Mostrarme en el bot de Discord», nunca menores ni cuentas sin edad, y nunca menciona a nadie.

## Traducción automática

- La Edge Function `translate` **exige sesión** y lee el texto original **con la sesión del usuario**: si las reglas RLS no le dejan leer un mensaje, tampoco puede traducirlo.
- La clave de DeepL/Google/LibreTranslate se guarda con `supabase secrets` y **nunca llega al navegador**.
- El texto de los mensajes **sí se envía al proveedor de traducción** que elijas. Menciónalo en tu política de privacidad y revisa las condiciones de ese proveedor (por ejemplo, si guarda o no los textos).
- Las traducciones se guardan en una caché compartida en tu base de datos y en el dispositivo (`localStorage`, máximo 600) para no pagar dos veces la misma traducción. *Ajustes → Borrar* limpia la del dispositivo; al cerrar sesión se olvida.
- Límite diario por persona (`TRANSLATE_DAILY_CHARS`, 20 000 caracteres por defecto) para controlar el costo.
- `ALLOWED_ORIGINS` permite limitar desde qué dominios se llama a la función.

## Qué vive solo en el dispositivo

| Elemento | Dónde | Notas |
|---|---|---|
| Memoria de VORA | `localStorage` | No se envía a ningún servicio. *Yo → Olvidar todo* la borra |
| Traducciones vistas | `localStorage` por cuenta | Se borra en *Ajustes* |
| Copia sin conexión | IndexedDB por cuenta | Se borra al cerrar sesión |
| Cola de envíos | `localStorage` por cuenta | Máximo 50; se vacía al enviar o cerrar sesión |
| «Mientras no estabas» | `localStorage` | Solo guarda la hora de tu última visita |

El service worker **no guarda** respuestas de Supabase (API, autenticación, Realtime, Edge Functions ni URL firmadas).

## GUARDIAN

Aviso preventivo con reglas visibles: ataques personales, hostilidad, amenazas, datos personales y gritos. Ofrece una versión más amable y deja la decisión a la persona. Ahora se combina con el límite anti-spam del servidor y con el **modo tilt** de VORA. **No** sustituye moderación humana ni detecta grooming o acoso contextual.

## Advertencias

Esto es un **proyecto funcional a nivel de código y esquema**, no una certificación de producción.

- `vite build` y `npm install` no se pudieron ejecutar en el entorno de generación; hazlo en tu equipo.
- Las Edge Functions no se desplegaron desde aquí. Su lógica se probó con criptografía real y respuestas simuladas de cada servicio.
- La edad es la que la persona declara: no es verificación de identidad. Para un público con muchos menores, considera verificación real y acompañamiento de un especialista.
- VORA no es una persona ni un profesional de salud. Ante señales de crisis indica la Línea de la Vida (México: 800 911 2000) y el 911; revisa esos textos según tu país.
- Antes de abrir la app al público: auditoría de permisos, política de privacidad y de menores, moderación humana con tiempos de respuesta y pruebas de rendimiento.
