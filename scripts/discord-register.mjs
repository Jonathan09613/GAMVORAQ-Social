// Registra los comandos del bot en Discord. Uso (CMD):
//   set DISCORD_APP_ID=tu_app_id
//   set DISCORD_BOT_TOKEN=tu_token
//   node scripts/discord-register.mjs
import { COMMANDS } from '../supabase/functions/discord/discord.js';
const { DISCORD_APP_ID: app, DISCORD_BOT_TOKEN: token } = process.env;
if (!app || !token) { console.error('Faltan DISCORD_APP_ID y DISCORD_BOT_TOKEN'); process.exit(1); }
const res = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, {
  method: 'PUT', headers: { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(COMMANDS)
});
console.log(res.ok ? `Listo: ${COMMANDS.map(c => '/' + c.name).join(', ')} registrados.` : `Discord respondió ${res.status}: ${await res.text()}`);
