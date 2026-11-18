# Notificaciones: dentro de la app y con la app cerrada (v14)

GAMVORAQ avisa de dos formas:

| Situación | Qué ves |
|---|---|
| App **abierta y a la vista** | Tarjeta arriba de la pantalla con la foto de quien te escribió, **sonido y vibración**. Al tocarla te lleva al chat, squad o reto. |
| App abierta pero **en otra pestaña o minimizada** | Notificación del sistema (funciona aunque no hayas hecho los pasos de abajo). |
| App **cerrada** (o teléfono bloqueado) | Notificación push del sistema. **Requiere los pasos 1 a 6 una sola vez.** |

Tu proyecto de Supabase es **`jqzkectzbqlybuscxsht`**. Todo se hace en CMD, dentro de `C:\Users\deivi\GAMVORAQ-SOCIAL-v11`.

## 1. Genera tus llaves (una sola vez)

```cmd
node scripts/generate-vapid.mjs
```

Te muestra **tres valores** y un comando listo. Guárdalos en un bloc de notas privado:
- **Llave pública**: va en el `.env` (paso 5) y en Supabase.
- **Llave privada**: solo en Supabase. Nunca en la app, en capturas ni en GitHub.
- **Secreto** (`PUSH_SECRET`): en Supabase y en la base de datos (paso 4).

> Si ya las habías generado antes, **usa las mismas**: si las cambias, cada dispositivo tiene que volver a activar los avisos.

## 2. Súbelas a Supabase y publica la función

Copia el comando `npx supabase secrets set ...` que te imprimió el paso 1, cambia `tu-correo@ejemplo.com` por tu correo, y ejecuta:

```cmd
npx supabase login
npx supabase link --project-ref jqzkectzbqlybuscxsht
npx supabase secrets set VAPID_PUBLIC_KEY=TU_PUBLICA VAPID_PRIVATE_KEY=TU_PRIVADA PUSH_SECRET=TU_SECRETO VAPID_SUBJECT=mailto:tu-correo
npx supabase functions deploy push --no-verify-jwt --use-api
```

## 3. Activa pg_net

Supabase → **Database → Extensions** → busca **pg_net** → actívalo.

## 4. Dile a la base de datos dónde está la función

Supabase → **SQL Editor → New query** (cambia `TU_SECRETO` por el del paso 1):

```sql
insert into private.settings(key, value) values
  ('push_url', 'https://jqzkectzbqlybuscxsht.supabase.co/functions/v1/push'),
  ('push_secret', 'TU_SECRETO')
on conflict (key) do update set value = excluded.value;
```

## 5. La llave pública en la app y vuelve a compilar

Abre el archivo `.env` de la carpeta del proyecto y agrega (o corrige) esta línea:

```
VITE_VAPID_PUBLIC_KEY=TU_PUBLICA
```

Como usas **Netlify Drop**, la llave se mete en la app al compilar. Por eso, después de cambiar el `.env`:

```cmd
npm run build
```

y sube la carpeta `dist` a Netlify (recuadro punteado → enlace **folder**).

## 6. Actívalas en cada dispositivo

- **Android / computadora:** al entrar, GAMVORAQ te muestra abajo **«Activa los avisos» → Activar**. Acepta el permiso. (También está en **Ajustes → Avisos push**.)
- **iPhone / iPad:** primero instala la app (Safari → Compartir → **Añadir a pantalla de inicio**), ábrela **desde el icono** y ahí pulsa **Activar**. Requiere iOS 16.4 o superior.

Luego, en **Ajustes**, pulsa **Enviar aviso de prueba**, **cierra la app** y espera unos segundos: te debe llegar. Si no llega, pulsa **Revisar configuración**: te dice exactamente qué falta (pg_net, la dirección, el secreto o que el dispositivo no está suscrito).

## Si no llegan con la app cerrada

- **Android:** Ajustes del teléfono → Apps → Chrome (o GAMVORAQ) → Notificaciones: activadas. Desactiva el **ahorro de batería** para Chrome.
- **Bloqueaste el permiso por error:** en Chrome, toca el candado junto a la dirección → Permisos → Notificaciones → Permitir.
- **iPhone:** solo funciona con la app abierta desde el icono de la pantalla de inicio, no desde Safari.
- Al **cerrar sesión**, ese dispositivo deja de recibir los avisos de esa cuenta (por privacidad). Al volver a entrar se reactivan solos.

## Sonido dentro de la app

**Ajustes → Sonido y vibración → Silenciar / Activar.** Solo afecta este dispositivo.
