# GAMVORAQ v7 — Instalación desde cero en Windows con CMD y Supabase

Esta guía es para empezar con un proyecto de Supabase **nuevo**. Si ya usas la v6, sigue `GUIA_ACTUALIZACION_V7.md`.

## 1. Abre la carpeta

Descomprime `GAMVORAQ-SOCIAL-v7.zip` y en CMD:

```cmd
cd /d C:\Users\deivi\GAMVORAQ-SOCIAL-v7
node -v
npm -v
npm install
```

Requiere **Node.js 20.19 o posterior** (Vite 7).

## 2. Crea una base NUEVA en Supabase

En https://supabase.com/dashboard crea un proyecto nuevo (por ejemplo, `GAMVORAQ-V7`). **No ejecutes estos scripts sobre tablas de versiones anteriores a la v3**: presuponen una base limpia.

En *SQL Editor → New query* ejecuta, **en este orden y una sola vez cada uno**:

1. `supabase/migrations/001_gamvoraq_social.sql`
2. `supabase/migrations/002_gamvoraq_universe.sql`
3. `supabase/migrations/003_gamvoraq_v6.sql`
4. `supabase/migrations/004_gamvoraq_v7.sql`

Crean las tablas, relaciones, triggers, políticas RLS, los buckets de imágenes (`gamvoraq` público y `gamvoraq-memories` privado) y el catálogo inicial de videojuegos. Revisa en *Table Editor* que existan `profiles`, `posts`, `communities`, `channels`, `direct_messages`, `squads`, `quests`, `reports`, `games`, `squad_memories`, `availability`, `play_sessions`, `chemistry_ratings`, `profile_private`, `message_translations`, `leagues`, `guide_requests` y `family_links`.

**Si el SQL Editor muestra un error, detente y corrígelo antes de seguir.** Evita pegar el script por partes: los objetos duplicados generan más errores.

## 3. Claves PUBLICABLES

En *Project Settings → API Keys* copia la URL del proyecto y la clave **publishable** (o `anon`). **Nunca** copies `service_role` ni `secret` al frontend.

```cmd
copy .env.example .env
notepad .env
```

```dotenv
VITE_SUPABASE_URL=https://TUPROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_REAL
```

El archivo `.env` está en `.gitignore`.

## 4. Habilita el correo

En *Authentication → Providers* deja activo **Email**. En *Authentication → URL Configuration*:

- Site URL: `http://localhost:5174`
- Redirect URLs: `http://localhost:5174/**`

Con la confirmación de correo activada, quien se registre debe confirmar su correo antes de entrar. Revisa los límites de envío de correo de Supabase si vas a probar con muchas cuentas.

## 5. Ejecuta

```cmd
npm install
npm run dev -- --port 5174 --strictPort
```

Abre http://localhost:5174. No cierres CMD mientras uses la app. Puedes **registrarte**, **iniciar sesión** o **explorar la demostración** sin cuenta.

## 6. Activa el traductor

Sigue la sección 5 de `GUIA_ACTUALIZACION_V6.md` (clave de DeepL, Google o LibreTranslate y `npx supabase functions deploy translate`). Sin este paso todo funciona, pero los mensajes de otros idiomas se muestran sin traducir.

Las funciones opcionales de la v7 (VORA con IA, Steam, notificaciones push y bot de Discord) se activan con la sección 4 de `GUIA_ACTUALIZACION_V7.md`.

## 7. Prueba real con DOS cuentas (recomendado)

1. Registra A en Chrome normal y B en una ventana de incógnito (confirma los correos si corresponde).
2. Edita ambos perfiles: juegos, horario, **idioma** (pon B en inglés) y cómo prefieren jugar. En A abre **Jugar**: B aparece con su afinidad explicada.
3. Crea un squad desde A, únete desde B y escribe en español desde A: **B lo ve en inglés** con «Ver original».
4. A se marca **disponible**; B lo ve en Jugar y en su Inicio.
5. A agenda una partida del squad; B recibe el aviso, confirma «Voy» y descarga el .ics.
6. Cuando la partida empiece, ambos califican la **química**; revisa el **Pasaporte GG** del otro.
7. Mensaje privado entre A y B. **Una tercera cuenta no debe poder leerlo.**
8. Pon a B un año de nacimiento de **menor**: A ya no puede escribirle en privado.
9. A crea una comunidad; B se une. A crea un canal de anuncios: B lee pero **no** publica.
10. A crea un reto; B participa y envía evidencia; A aprueba. Revisa la insignia en el perfil de B.
11. B publica; A reporta. La moderación de la comunidad ve el reporte.
12. A bloquea a B y prueba la mensajería. Desbloquea desde *Ajustes → Seguridad*.
13. Cierra sesión y comprueba que, sin iniciar sesión, no se ve nada.

Los permisos están en PostgreSQL (RLS), no solo ocultos en botones; aun así, **estas pruebas deben hacerse en tu Supabase real antes de publicar**.

## 8. Versión de producción y PWA

```cmd
npm test
npm run build
npm run preview -- --port 4173 --strictPort
```

`dist` es lo que se publica en un hosting HTTPS (Netlify, Vercel, Cloudflare Pages) con las mismas dos variables de entorno; registra la URL pública en *Authentication → URL Configuration*. La app se instala desde un navegador compatible y abre sin conexión con la última copia que viste. Pasos para probarlo: `GUIA_ACTUALIZACION_V6.md`, sección 7.

## Notas de alcance

- **VORA** responde con reglas locales, sin IA generativa; su memoria queda en el dispositivo.
- **GUARDIAN** es un aviso preventivo; el servidor añade un límite anti-spam, pero no sustituye la moderación humana.
- **La afinidad de Jugar** es un cálculo transparente (juegos, plataforma, horario, estilo y química), no aprendizaje automático.
- **La química** solo admite etiquetas positivas; para problemas están reportar y bloquear.
- Los **squads** son de acceso abierto: cualquiera puede unirse; el chat y la agenda son solo para integrantes.
- El frontend carga con límites por consulta; una comunidad masiva requerirá paginación real.
- No guardes secretos de Supabase ni del traductor en repositorios públicos.
