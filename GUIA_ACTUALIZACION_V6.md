# Guía de actualización a GAMVORAQ v6 (Windows + CMD)

La v6 agrega **una migración nueva (`003`)** y **una Edge Function de traducción**. No borra datos: las tablas de UNIVERSE, LIVE PULSE y CHRONICLES se quedan en tu base aunque la app ya no las muestre.

## 1. Carpeta nueva

Descomprime `GAMVORAQ-SOCIAL-v6.zip` en `C:\Users\deivi\GAMVORAQ-SOCIAL-v6`. **No sobrescribas la v5**: consérvala como respaldo.

## 2. Copia tu `.env`

```cmd
copy C:\Users\deivi\GAMVORAQ-SOCIAL-v5\.env C:\Users\deivi\GAMVORAQ-SOCIAL-v6\.env
```

Solo debe tener la URL y la clave **publishable**. Nunca pongas claves `secret` ni `service_role` ahí. El `.env` no viene en el zip.

## 3. Base de datos: ejecuta la `003`

En Supabase: *SQL Editor → New query*, pega **todo** `supabase/migrations/003_gamvoraq_v6.sql` y ejecútalo **una vez**.

> **Importante si tu `001` falló.** La `001` de versiones anteriores tenía un error de comillas en `Don't Starve Together` que cortaba el script al final. Revisa en *Table Editor* que existan `profiles`, `posts` y `games`:
> - Si **no existen**, ejecuta la `001` corregida de esta carpeta, luego la `002` y después la `003`.
> - Si **existen**, ejecuta solo la `003`: repone ese juego y activa el tiempo real que pudo faltar.

Revisa que aparezcan las tablas `availability`, `play_sessions`, `session_rsvps`, `chemistry_ratings`, `profile_private`, `message_translations` y `translation_usage`.

## 4. Instala y ejecuta

```cmd
cd /d C:\Users\deivi\GAMVORAQ-SOCIAL-v6
node -v
npm install
npm test
npm run dev -- --port 5174 --strictPort
```

- `node -v` debe ser **20.19 o superior**.
- `npm test` debe terminar con **59 pruebas correctas**.

Sin el traductor configurado la app funciona igual: en los mensajes de otros idiomas aparecerá «Traducir» y un aviso de que falta configurarlo.

## 5. Activa la traducción automática

La traducción la hace el servidor para que **tu clave del traductor nunca esté en la app**. Elige **un** proveedor:

| Proveedor | Qué necesitas | Nota |
|---|---|---|
| **DeepL** (recomendado) | Clave de API desde deepl.com/pro-api | Tiene plan gratuito con límite mensual; sus claves terminan en `:fx` y la función lo detecta sola |
| **Google Cloud Translation** | Clave de API con la *Cloud Translation API* activada | De pago por uso, con crédito inicial |
| **LibreTranslate** | URL de un servidor LibreTranslate (propio o de un tercero) | Código abierto; puedes alojarlo tú |

En CMD, dentro de la carpeta del proyecto:

```cmd
npx supabase login
npx supabase link --project-ref TU_REF_DEL_PROYECTO
npx supabase secrets set DEEPL_API_KEY=tu_clave_de_deepl
npx supabase functions deploy translate
```

- `TU_REF_DEL_PROYECTO` es la parte de tu URL: `https://TU_REF.supabase.co`.
- Con Google usa `GOOGLE_TRANSLATE_API_KEY=...`; con LibreTranslate, `LIBRETRANSLATE_URL=https://...` (y `LIBRETRANSLATE_API_KEY=...` si tu servidor la pide).
- Opcional: `TRANSLATE_DAILY_CHARS=20000` (límite diario por persona, para controlar el costo) y `ALLOWED_ORIGINS=https://tu-dominio.app`.
- Si el despliegue pide Docker, agrega `--use-api` al final del comando `deploy`.
- Si al traducir aparece un error 401 («Invalid JWT») porque tu proyecto usa las claves nuevas, despliega con `npx supabase functions deploy translate --no-verify-jwt`. Es seguro: la función comprueba la sesión del usuario por su cuenta.

**Prueba:** inicia sesión con dos cuentas, pon una en inglés (*Ajustes → Idioma y traducción*) y escríbele en español desde la otra. Debe verlo en inglés con «Ver original».

## 6. Revisión rápida (10 minutos)

1. **Inicio:** aparece «Tus próximas partidas», «Disponibles ahora» y el feed termina en «Estás al día».
2. **Jugar:** pulsa «Estoy disponible»; tu estado aparece arriba y en el Inicio de la otra cuenta.
3. **Squads → Agenda:** agenda una partida. La otra cuenta recibe un aviso, confirma «Voy» y descarga el .ics.
4. **Química:** para probar sin esperar, agenda una partida para dentro de 5 minutos y de una duración de 30 min; cuando empiece, aparece «Calificar química». Califica a la otra cuenta y revisa su **Pasaporte GG** en su perfil.
5. **Menores:** en la cuenta B pon un año de nacimiento de menor (*Perfil → Editar*). Desde la cuenta A (adulta) el botón de mensaje debe decir «Sin mensajes privados», y el servidor rechaza el chat aunque se intente por otra vía.
6. **Anti-spam:** el mensaje número 21 en un minuto se rechaza con «Vas muy rápido».

## 7. Producción y PWA

```cmd
npm run build
npm run preview -- --port 4173 --strictPort
```

Publica la carpeta `dist` en un hosting HTTPS (Netlify, Vercel o Cloudflare Pages) con las dos variables de entorno, y registra la URL en *Supabase → Authentication → URL Configuration*. El service worker pasó a `v6`, así que las copias viejas en caché se borran solas al actualizar.

## Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| Banner «Falta ejecutar 003» | Ejecuta `supabase/migrations/003_gamvoraq_v6.sql` en el SQL Editor |
| «El traductor aún no está configurado en el servidor» | Falta la clave (`supabase secrets set ...`) o desplegar la función |
| Los mensajes no se traducen y no hay aviso | Revisa *Edge Functions → translate → Logs* en Supabase |
| «Llegaste al límite diario de traducción» | Sube `TRANSLATE_DAILY_CHARS` o espera al día siguiente |
| «Vas muy rápido» | Límite anti-spam: 20 mensajes por minuto en chats, 5 publicaciones por minuto |
| Sigo viendo la versión vieja | *DevTools → Application → Storage → Clear site data*, o pulsa *Actualizar* en el aviso |
