# Guía de actualización a GAMVORAQ v7 (Windows + CMD)

La v7 agrega **una migración (`004`)** y **cuatro Edge Functions opcionales** (IA de VORA, Steam, Discord y push). La app funciona sin ellas: cada función muestra un aviso claro mientras no esté configurada.

> **¿Vienes de la v5?** Primero ejecuta la `003` y activa el traductor (pasos 3 y 5 de `GUIA_ACTUALIZACION_V6.md`). Luego sigue esta guía.

## 1. Carpeta nueva y `.env`

Descomprime en `C:\Users\deivi\GAMVORAQ-SOCIAL-v7` (conserva la anterior como respaldo) y copia tu `.env`:

```cmd
copy C:\Users\deivi\GAMVORAQ-SOCIAL-v6\.env C:\Users\deivi\GAMVORAQ-SOCIAL-v7\.env
```

## 2. Base de datos: ejecuta la `004`

En Supabase: *SQL Editor → New query*, pega **todo** `supabase/migrations/004_gamvoraq_v7.sql` y ejecútalo. Se puede volver a ejecutar sin errores.

Revisa que existan `guide_offers`, `guide_requests`, `waves`, `leagues`, `league_teams`, `league_matches`, `family_links`, `conduct_strikes`, `push_subscriptions` y `function_usage`.

## 3. Instala y ejecuta

```cmd
cd /d C:\Users\deivi\GAMVORAQ-SOCIAL-v7
npm install
npm test
npm run dev -- --port 5174 --strictPort
```

`npm test` debe terminar con **71 pruebas correctas**.

Con solo esto ya funcionan sin configurar nada más: **ligas locales, modo primer día (guías), sala tranquila, segunda oportunidad, modo familia, aniversarios, recuerdo automático, coach de partida (con consejos sin IA) y «Ver anteriores»**.

## 4. Funciones opcionales del servidor

Necesitas la CLI de Supabase vinculada a tu proyecto una sola vez:

```cmd
npx supabase login
npx supabase link --project-ref TU_REF_DEL_PROYECTO
```

Si al desplegar te pide Docker, agrega `--use-api` al final del comando `deploy`.

### 4.1 VORA con inteligencia artificial (charla y coach)

1. Crea una clave de API en https://console.anthropic.com (o usa cualquier proveedor compatible con OpenAI).
2. En CMD:

```cmd
npx supabase secrets set ANTHROPIC_API_KEY=tu_clave
npx supabase functions deploy vora-ai
```

- Opcional: `VORA_MODEL` (modelo; por defecto `claude-haiku-5-5`) y `AI_DAILY_LIMIT` (por defecto 40 mensajes por persona al día).
- Con otro proveedor: `AI_API_KEY`, `AI_MODEL` y `AI_BASE_URL` en lugar de `ANTHROPIC_API_KEY`.
- Cada persona la activa en *Ajustes → VORA con inteligencia artificial*. VORA sigue usando sus reglas primero, y la IA solo cuando no sabe responder. Las señales de crisis siempre las atienden las reglas locales.

### 4.2 Importar juegos desde Steam

1. Pide tu clave en https://steamcommunity.com/dev/apikey (necesitas una cuenta de Steam).
2. En CMD:

```cmd
npx supabase secrets set STEAM_API_KEY=tu_clave
npx supabase functions deploy steam-import
```

Se usa en *Perfil → Mis juegos → Importar*. El perfil de Steam debe tener «Detalles del juego» en **Público**. Límite: 5 importaciones por persona al día (`STEAM_DAILY_LIMIT`).

### 4.3 Notificaciones push

1. Genera las llaves:

```cmd
node scripts/generate-vapid.mjs
```

2. Copia el comando `npx supabase secrets set ...` que imprime el script (con tu correo en `VAPID_SUBJECT`) y ejecútalo.
3. Despliega la función (sin verificación JWT: la protege el `PUSH_SECRET`):

```cmd
npx supabase functions deploy push --no-verify-jwt
```

4. En Supabase: *Database → Extensions* → activa **pg_net**. Luego, en el SQL Editor (con tu REF y el `PUSH_SECRET` del paso 1):

```sql
insert into private.settings(key, value) values
  ('push_url', 'https://TU_REF.supabase.co/functions/v1/push'),
  ('push_secret', 'EL_PUSH_SECRET_DEL_PASO_1')
on conflict (key) do update set value = excluded.value;
```

5. Agrega la llave **pública** a tu `.env` y vuelve a compilar:

```dotenv
VITE_VAPID_PUBLIC_KEY=la_llave_publica_del_paso_1
```

Cada persona las activa en *Ajustes → Notificaciones en este dispositivo*. Funcionan en la app instalada y en navegadores compatibles; en iPhone hay que **instalar la app en la pantalla de inicio** primero (iOS 16.4 o superior).

### 4.4 Bot de Discord

1. En https://discord.com/developers/applications crea una aplicación. Copia el **Application ID** y la **Public Key** (*General Information*). En *Bot*, genera el **token**.
2. En CMD:

```cmd
npx supabase secrets set DISCORD_PUBLIC_KEY=tu_public_key APP_URL=https://tu-dominio.app
npx supabase functions deploy discord --no-verify-jwt
```

3. En Discord, *General Information → Interactions Endpoint URL*: `https://TU_REF.supabase.co/functions/v1/discord` y guarda (Discord la verifica en ese momento).
4. Registra los comandos:

```cmd
set DISCORD_APP_ID=tu_application_id
set DISCORD_BOT_TOKEN=tu_token
node scripts/discord-register.mjs
```

5. Invita el bot a tu servidor: *OAuth2 → URL Generator* → marca `applications.commands` (y `bot`) → abre la URL generada.

Comandos: `/disponibles [juego]`, `/partidas` y `/pasaporte usuario`. Solo aparecen quienes activaron **«Mostrarme en el bot de Discord»** en su perfil, y nunca cuentas de menores o sin edad declarada. El bot nunca menciona a nadie.

## 5. Revisión rápida con dos cuentas (A y B)

1. **Guías:** A agrega Valorant a su biblioteca y en *Jugar → Modo primer día* se ofrece como guía. B elige Valorant y pide guía. A acepta (se abre el chat). B marca «Sí, me ayudó». Con 3 ayudas útiles A gana «Mentor GG».
2. **Sala tranquila:** A pulsa «Entrar en silencio». B lo ve y saluda 👋. A recibe el aviso. Un segundo saludo en menos de 30 min se rechaza.
3. **Ligas:** A crea una liga y la inscribe con su squad; B crea otro squad y lo inscribe. A genera el calendario, registra un resultado y la tabla se actualiza. Ambos squads reciben el aviso.
4. **Segunda oportunidad:** B publica en una comunidad de A; otra cuenta lo reporta; A marca el reporte como «Revisado». B ve el aviso privado en Inicio, lo lee y se compromete. Cuando dos personas le dan «Fue amable» en partidas, gana «Segunda oportunidad cumplida».
5. **Familia:** pon a B un año de nacimiento de menor. A (adulto) escribe el usuario de B en *Ajustes → Modo familia*. B acepta. A ve el resumen **sin el contenido de los mensajes**. B termina el vínculo y A recibe el aviso.
6. **Aniversario y recuerdo automático:** después de calificar la química de una partida del squad, se abre «Guardar recuerdo» con el título y las personas ya elegidas.

## Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| «La IA de VORA no está configurada» | Falta `ANTHROPIC_API_KEY` o desplegar `vora-ai` |
| «La importación de Steam no está configurada» | Falta `STEAM_API_KEY` o desplegar `steam-import` |
| «Tu biblioteca de Steam es privada» | En Steam: Perfil → Editar perfil → Privacidad → Detalles del juego: Público |
| El botón de push dice «Falta configurar la llave pública» | Agrega `VITE_VAPID_PUBLIC_KEY` al `.env` y vuelve a ejecutar `npm run dev` o `npm run build` |
| Push activado pero no llega nada | Revisa que **pg_net** esté activo, que `private.settings` tenga la URL y el secreto, y los *Logs* de la función `push` |
| Discord no acepta la Interactions Endpoint URL | Revisa `DISCORD_PUBLIC_KEY` y que la función se desplegó con `--no-verify-jwt` |
| «No se pudo enviar» en modo familia | El adulto y el menor deben tener su año de nacimiento en el perfil |
