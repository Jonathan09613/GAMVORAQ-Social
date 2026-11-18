# GAMVORAQ v13 · La red social gamer que te cuida

> **v13** (instrucciones en `GUIA_ACTUALIZACION_V13.md`):
> - Mensajes sin bloqueos falsos de edad; desde los 18 años cuentas como adulto.
> - Crear squads y retos con funciones del servidor (migración 008).
> - Portadas de Steam para todos los juegos.
> - Traducción completa de la página.
> - La ventana del reto ya no se cierra sola.

> **Novedades de la v12** (instrucciones en `GUIA_ACTUALIZACION_V12.md`):
> - Pestaña **Mensajes**: nuevo chat, búsqueda, borrar chat y reportar o bloquear.
> - Traducción gratuita con el **original y la traducción** juntos.
> - Idioma de toda la app en un solo selector.
> - Permisos corregidos con la **migración 007**.
> - Panel de **Moderación**: reportes, pausas, frases bloqueadas y pausa automática.
> - **Música** y **encuestas** del squad.
> - **Radar** de juegos gratis y ofertas.
> - VORA personalizable: ojos, boca, cabeza y forma.

PWA instalable para encontrar con quién jugar **bien**: sin barreras de idioma, sin toxicidad y sin quemarte, con **VORA** acompañándote.

Cada pantalla responde a una de tres preguntas: **¿con quién juego?**, **¿cómo me va con mi gente?** y **¿quién soy como jugador?** Lo que no respondía a ninguna se quitó.

**Frontend:** Vite 7 + JavaScript modular. **Backend:** Supabase (Auth, PostgreSQL con RLS, Storage, Realtime y una Edge Function de traducción).

## Novedades de la v11

Menores protegidos de verdad (edad obligatoria y fija, squads por rango de edad), squads con roles y límites, «Visto» y no leídos en mensajes, seguidores y seguidos, portadas de juegos, notificaciones al teléfono y la laptop con prueba y diagnóstico, retos de comunidad revisados, interfaz en español/inglés/portugués y las 16 capacidades de PWA. Detalle y pasos: **`GUIA_ACTUALIZACION_V11.md`**. Notificaciones: **`GUIA_NOTIFICACIONES.md`**.

## Novedades de la v9 y v10: diseño premium y VORA mucho más completo

### Diseño premium en el rojo de GAMVORAQ (v10)
- La v10 **vuelve al rojo original** (logo, iconos, botones, pantallas de arranque y capturas) y conserva todo lo nuevo de la v9. En Ajustes siguen los tonos Carmesí (predeterminado), Cian, Violeta, Ámbar y Menta; quien probó un tono verde de la v9 vuelve a Carmesí automáticamente.
- **Fondo aurora animado** con cuadrícula sutil, **tarjetas con borde degradado** que brillan al pasar el cursor, **botones con resplandor y destello**, barra lateral con indicador luminoso, barras y modales de cristal, navegación móvil flotante y animaciones de entrada. Todo se desactiva con «reducir movimiento».

### VORA, ahora con 5 pestañas
| Pestaña | Qué hay |
|---|---|
| **Chat** | 6 accesos rápidos y **comandos con «/»** (aparecen sugerencias al escribir): `/resumen`, `/plan`, `/dado 2d6`, `/moneda`, `/elige`, `/equipos`, `/recordar 15m …`, `/tips valorant`, `/calc`, `/agua`, `/frase`. También entiende lenguaje natural: «recuérdame a las 21:30 la partida», «arma 3 equipos: …», «quién está disponible», «mi próxima partida», «consejos de minecraft» |
| **Juntos** | Sesiones de foco/calma y respiración (como antes) |
| **Juegos** | **5 mini-juegos**: Trivia (30 preguntas), **Adivina el juego por emojis**, **Reflejos** (mide tus milisegundos), **Memoria** de parejas y **Piedra, papel o tijera** contra VORA |
| **Útiles** (nuevo) | Dados y moneda · **Ruleta «¿a qué jugamos?»** con tu biblioteca · **Armar equipos parejos** · **Planear mi noche** (tranquila, con squad o competitiva, con pausas y aviso si terminas tarde) · **Recordatorios** que suenan a la hora (con notificación si la app está en segundo plano) · **Contador de agua** |
| **Yo** | Personalización y **14 logros** (7 nuevos: Ojo de emoji, Reflejos de pro, Memoria de elefante, Leo tu mente, Bien hidratado, Estratega…) |

VORA ahora **conoce tu día**: quién de tu gente está disponible, tu próxima partida y tus avisos sin leer, y lo resume con `/resumen`. Todo funciona sin internet y sin IA; la IA opcional sigue disponible para preguntas abiertas.

## Novedades de la v8: instálala en todos lados

| Qué | Detalle |
|---|---|
| **Instalación guiada por dispositivo** | Detecta Android, iPhone, iPad, Windows, Mac, Linux o Chromebook y el navegador, y muestra los pasos exactos. Donde se puede, instala con un toque |
| **Invitación a instalar** | Barra discreta dentro de la app («Instalar» / «Ahora no»; si dices que no, no vuelve en 14 días) y botón en la portada, Ajustes y `Ctrl K` |
| **Compartir hacia GAMVORAQ** | Con la app instalada, «Compartir» en YouTube, el navegador u otra app ofrece GAMVORAQ y abre «Crear publicación» con el contenido |
| **Atajos del icono** | Mantén pulsado el icono: Disponible, Agendar, Jugar y Mensajes, cada uno con su icono |
| **Arranque nativo en iPhone/iPad** | 16 pantallas de arranque con el logo para todos los tamaños de iPhone y iPad |
| **Enviar a mi teléfono** | Desde la computadora, comparte o copia el enlace para instalarla en el móvil |
| **Lista para publicar** | `vercel.json`, `netlify.toml`, `_headers` y `_redirects` con caché correcta y cabeceras de seguridad |
| **Revisión automática** | `npm run check:pwa` valida manifiesto, tamaños reales de iconos, capturas, atajos y service worker |
| **Tiendas** | Paso a paso para Google Play y Microsoft Store con PWABuilder (`GUIA_PWA_Y_TIENDAS.md`) |

### Las ideas que hacen distinta a GAMVORAQ

1. **Chat sin idiomas**: cada mensaje llega traducido, con «Ver original».
2. **Química de equipo y Pasaporte GG**: reputación positiva que te dan compañeros reales.
3. **«Estoy disponible» y agenda de squad** con archivo de calendario.
4. **Modo primer día**: veteranos guían a principiantes (insignia Mentor GG).
5. **Sala tranquila**: jugar juntos sin presión ni micrófono.
6. **Ligas locales** con calendario automático y tabla.
7. **Segunda oportunidad**: las sanciones se corrigen con buena conducta.
8. **Modo familia**: bienestar del menor sin leer sus conversaciones.
9. **VORA con IA**: detecta el tilt, da consejos de coach y celebra aniversarios.

Se muestran en la portada de la app.

## Novedades de la v7

Todas las ideas del plan, funcionando:

| Función | Qué hace | Dónde |
|---|---|---|
| **Modo primer día** | Quien empieza un juego pide una guía a alguien con experiencia. La guía acepta, hablan por chat y al final quien aprende dice si le sirvió. 3 ayudas útiles = insignia **Mentor GG** | Jugar |
| **Sala tranquila** | Estar «juntos» sin hablar: solo saludos 👋, sin mensajes ni presión. Ideal para días tímidos o de concentración | Jugar |
| **Ligas locales** | Por escuela, universidad, ciudad o comunidad. Inscripción de squads, calendario todos contra todos automático, resultados y tabla de posiciones | Comunidades → Ligas |
| **Segunda oportunidad** | Si la moderación valida un reporte, la persona recibe un aviso **privado** con el código de la comunidad. Al comprometerse y recibir trato amable de 2 personas, lo cierra y gana una insignia | Inicio y Perfil |
| **Modo familia** | Un adulto acompaña la cuenta de un menor que lo acepta: squads, partidas, con quién habla y reportes. **Nunca** el contenido de los mensajes. El menor puede terminarlo cuando quiera | Ajustes |
| **Aniversarios de squad** | 1, 3 y 6 meses, y cada año desde que entraste, con botón para celebrarlo con un recuerdo o una partida | Inicio y Squads |
| **Recuerdo automático** | Al calificar una partida del squad se propone guardar el recuerdo, con título y personas ya elegidas | Squads |
| **Coach de partida** | Cuentas cómo te fue y recibes 3 consejos concretos (con IA si está activada; si no, por reglas) | Agenda del squad |
| **VORA con IA** | Opcional: cuando sus reglas no saben responder, VORA usa IA (Anthropic u otro proveedor) con límite diario | Ajustes |
| **Importar desde Steam** | Agrega tu biblioteca de Steam en segundos | Perfil → Mis juegos |
| **Notificaciones push** | Avisos aunque la app esté cerrada, con cifrado estándar Web Push | Ajustes |
| **Bot de Discord** | `/disponibles`, `/partidas` y `/pasaporte` en cualquier servidor; solo para quien lo permite y nunca menores | Discord |
| **Ver anteriores** | Carga publicaciones y mensajes más antiguos en comunidades y chats | Comunidades y Squads |

Cómo activarlo: `GUIA_ACTUALIZACION_V7.md`.

## Qué cambió en la v6 respecto a la v5

### De 18 a 5 secciones

| Sección | Reúne | Para qué sirve |
|---|---|---|
| **Inicio** | Inicio, feed, avisos | Qué pasa con tu gente hoy. «Mientras no estabas», próximas partidas, quién está disponible y un feed que **termina** («Estás al día») |
| **Jugar** | SYNC, Jugadores, LIVE PULSE | Disponibles ahora, partidas abiertas y compañeros compatibles |
| **Squads** | Squads, Mensajes, MEMORIES | Chat traducido, agenda con asistencia, recuerdos con consentimiento y mensajes directos |
| **Comunidades** | Comunidades, Canales, QUESTS | Publicaciones, anuncios, retos y moderación dentro de cada comunidad |
| **Perfil** | Perfil, Videojuegos, Galería | Tu identidad, tu Pasaporte GG, tu biblioteca y tus fotos |

Se retiraron **UNIVERSE** (duplicaba el menú), **CHRONICLES** (solo funciona con comunidades enormes), **LIVE PULSE** (lo reemplaza «Disponible para jugar»), la sección GUARDIAN (ahora vive en Ajustes y actúa al escribir) y los mini-juegos de relleno (queda la trivia). **Las tablas siguen en la base de datos**: no se pierde nada.

### Funciones nuevas

- **Traducción automática.** Cada cuenta tiene un idioma principal (español, inglés, portugués, francés, italiano, alemán, japonés, coreano o chino). Los mensajes recibidos (chats de squad, mensajes directos, anuncios, publicaciones y comentarios) se muestran en tu idioma con **«Traducido del inglés · Ver original»**. Puedes apagar la traducción automática y traducir mensaje por mensaje.
- **Disponible para jugar.** Dices a qué juegas y por cuánto tiempo (30 min a 4 h). Desaparece sola.
- **Agenda de partidas.** Partidas de squad o abiertas, con «Voy / Tal vez / No puedo», cupo validado en el servidor, aviso al squad y archivo **.ics** para tu calendario con recordatorio 15 min antes.
- **Química de equipo.** Al terminar una partida agendada calificas a tus compañeros con etiquetas **solo positivas**. Nadie ve quién dio cada etiqueta. Jugar sube en tus recomendaciones a quienes tuvieron buena química contigo.
- **Pasaporte GG.** Tu reputación de buen compañero (partidas jugadas, personas que te dieron GG y etiquetas destacadas), con nivel y botón para descargarla como imagen.
- **Juego accesible.** Marca cómo prefieres jugar (sin micrófono, por texto, con paciencia, con una mano, con lector de pantalla…) y filtra por ello en Jugar.
- **«Mientras no estabas».** Resumen de lo nuevo en tus squads, mensajes, comunidades y partidas próximas.
- **Modo tilt.** Si VORA nota frustración o varios avisos de GUARDIAN seguidos, te sugiere una pausa.
- **Protección de menores.** Año de nacimiento **privado**; menores solo pueden escribirse en privado con otros menores. Lo hace cumplir la base de datos.
- **Anti-spam en el servidor.** Límite de mensajes por minuto.

### Arreglos de la v5

- La migración `001` tenía una comilla sin escapar (`Don't Starve Together`) que **cortaba el script** en el editor SQL. Corregido; la `003` repone lo que pudo faltar.
- Los botones «Conectar» y «Escribir» de SYNC no hacían nada. Ahora abren el chat.
- «1 juegos en común» → «1 juego en común».

## Cómo ejecutarlo

- **Base nueva:** `GUIA_INSTALACION_CMD_SUPABASE.md`
- **Vienes de la v9 o la v8:** la v10 no cambia la base de datos ni las funciones de Supabase. Reemplaza los archivos, ejecuta `npm install`, `npm test` y `npm run build`, y vuelve a publicar. Los iconos nuevos llegan solos a quien ya la instaló cuando se actualiza la app (si instalaste la v9 verde, en algunos teléfonos el icono rojo tarda unos días en volver a aparecer).
- **Vienes de la v7:** la v8 no cambia la base de datos. Copia los archivos nuevos, ejecuta `npm install` y `npm run check:pwa`, y publica (`GUIA_PWA_Y_TIENDAS.md`).
- **Publicar en internet, instalar en teléfonos y subir a tiendas:** `GUIA_PWA_Y_TIENDAS.md`
- **Vienes de la v6:** `GUIA_ACTUALIZACION_V7.md`
- **Vienes de la v5:** primero `GUIA_ACTUALIZACION_V6.md` (migración 003 y traductor) y después `GUIA_ACTUALIZACION_V7.md`

Resumen en CMD (Node.js 20.19 o superior):

```cmd
cd /d C:\Users\deivi\GAMVORAQ-SOCIAL-v7
npm install
npm test
npm run dev -- --port 5174 --strictPort
```

Sin Supabase puedes entrar con **Explorar la demostración**: hay jugadores que escriben en inglés, portugués y japonés con traducciones de ejemplo. Cambia tu idioma en **Ajustes** para verlo al revés.

## Estructura

```
src/
  main.js                orquestador: estado, datos, traducción, acciones, formularios, PWA
  translate.js           motor de traducción del cliente (detección, caché, lotes, «Ver original»)
  features.js            reglas de disponibilidad, agenda, química, pasaporte, tilt, edad, aniversarios, ligas y coach
  demo-translations.js   traducciones de ejemplo para la demostración
  state.js · data.js · client.js · sync.js · guardian.js · offline.js · pwa.js · ui.js · world-logic.js
  views/   auth · shell · components · home · play · squads · communities · leagues · profile · modals
  companion/   VORA (cerebro, misiones, sesiones, trivia, avatar…)
  styles/  base · layout · views · home · vora · v6
supabase/
  migrations/  001 · 002 · 003_gamvoraq_v6.sql · 004_gamvoraq_v7.sql
  functions/   translate · vora-ai · steam-import · push · discord · _shared (webpush, http)
scripts/   generate-vapid.mjs (llaves push) · discord-register.mjs (comandos del bot)
tests/     unitarias con node:test
```

## Verificación

**Probado en el entorno de generación:**

- `npm test`: **92 pruebas unitarias** (v11: diccionario completo en/pt con números coherentes, traducción en vivo, enlaces web+gamvoraq, avisos push por chat y portadas de Steam). Antes: 86 (la v9 añade dados, listas, equipos, recordatorios relativos y a una hora, plan de la noche, consejos por juego, calculadora segura, agua, resumen, comandos «/», los 4 mini-juegos nuevos y la migración de colores). Antes: 76 (v8 añade detección de 10 dispositivos/navegadores, el iPad que se presenta como Mac, contenido compartido y cuándo sugerir instalar). Incluyen traducción, reglas de la v6 y v7, VORA, iconos y las funciones del servidor: **una notificación push se cifra y se descifra** como lo haría el navegador, la firma VAPID se verifica, la **firma Ed25519 de Discord** se comprueba con llaves reales, y Steam, la IA y los proveedores de traducción se prueban con respuestas simuladas.
- Las **cuatro migraciones** se ejecutaron en un PostgreSQL 16 real con una simulación de Supabase. Se comprobaron **56 reglas de seguridad** actuando como distintos usuarios (22 de la v6 y 34 de la v7). Por ejemplo: un menor no puede pedir guía a un adulto; quien aprende no puede aceptar su propia solicitud; solo se saluda a quien está en la sala tranquila, y una vez cada 30 min; solo el dueño de un squad lo inscribe en una liga; solo quien organiza registra resultados; un menor no puede ser tutor, solo el menor acepta y el resumen no incluye mensajes; los avisos de conducta son privados; la configuración de push no es legible. La `004` también se ejecutó dos veces sin errores.
- Las Edge Functions pasan la revisión de tipos de TypeScript en modo estricto.
- La app se empaquetó con esbuild y se abrió en Chrome: todas las vistas cargan sin errores de JavaScript a 1360 px y 390 px. Pasaron **45 comprobaciones de interacción**: 18 de la v6 y 27 de la v7 (aniversario, guías, sala tranquila, ligas, coach, recuerdo automático, Steam, ajustes nuevos, insignias especiales y móvil).
- **v11 · base de datos**: la migración 006 se ejecutó dos veces en PostgreSQL 16 y pasó **59 comprobaciones de seguridad nuevas** (edad fija, sin edad nada privado, squads por rango, roles, cupo, invitaciones, transferencia, avisos agrupados, «Visto», borrar mensajes, seguimientos, retos, administradores y push), además de las 56 anteriores.
- **v11 · en Chrome**: 35 comprobaciones de interacción (roles, expulsar, invitar, editar, silenciar, aceptar invitación, salir, explorar, «Enviado», borrar mensaje, seguidores, portadas, avisos, retos, prueba push, registro de edad) y la interfaz recorrida en inglés: solo quedan sin traducir nombres propios y contenido de personas. Las 29 + 45 anteriores siguen pasando.
- **v9 · VORA y diseño en Chrome**: 29 comprobaciones de interacción, todas correctas: accesos rápidos, sugerencias «/», resumen, dados, equipos, plan, consejos, calculadora, un recordatorio que **suena a los 6 segundos**, los 5 juegos jugados hasta el final (memoria resuelta, reflejos medidos y «muy pronto», piedra-papel-tijera hasta 3), las 6 herramientas de «Útiles» y el selector de tonos. Las 45 comprobaciones anteriores siguen pasando, sin desbordamiento en móvil ni errores de JavaScript.
- **v8 · PWA en Chrome real** (compilación de producción, perfil normal): Chrome informa **0 errores de instalabilidad**; el manifiesto se lee sin errores; el service worker controla la página y crea sus cachés; la app abre **sin conexión**; los 3 atajos abren su ventana; un contenido compartido (título, texto y enlace) llega al editor de publicación aunque se comparta antes de iniciar sesión; la guía detecta Chrome de computadora, iPhone Safari y Android Chrome; la invitación aparece en iPhone y «Ahora no» la oculta; sin desbordamiento en móvil ni errores de JavaScript. `npm run check:pwa` pasa todo.

**No verificado aquí:**

- `npm install` y `vite build` (sin acceso al registro de npm). Ejecuta `npm run build` en tu equipo.
- Las Edge Functions desplegadas en tu Supabase y las respuestas reales de Anthropic, Steam, Discord, los servicios push del navegador y el traductor.
- `pg_net` (no existe fuera de Supabase): el aviso a la función push está protegido para que un fallo nunca impida guardar un aviso.
- La instalación en un teléfono real (Android/iPhone) y en Safari de Mac: se simularon sus navegadores, pero instalar requiere el dispositivo y tu dominio con HTTPS. Pasos de comprobación en `GUIA_PWA_Y_TIENDAS.md`.
- El empaquetado con PWABuilder y la revisión de las tiendas.
- Firefox y lectores de pantalla.

## Limitaciones transparentes

- La **interfaz** está en español; lo que se traduce es lo que escriben las personas. Las biografías y notas de disponibilidad no se traducen.
- La traducción automática es buena pero no perfecta: por eso siempre está «Ver original».
- Las notificaciones push, la IA, Steam y Discord necesitan configurar sus claves (guía v7). Sin ellas, la app avisa y usa la alternativa: avisos dentro de la app, consejos por reglas y biblioteca manual.
- Las solicitudes de guía y las notas de disponibilidad no se traducen automáticamente.
- La edad se basa en el año que la persona declara; no es una verificación de identidad.

Antes de abrir la app al público: pruebas con varias cuentas reales, política de privacidad y de menores, moderación humana y pruebas de rendimiento.
