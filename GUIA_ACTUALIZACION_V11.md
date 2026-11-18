# Actualizar a GAMVORAQ v11

## 1. Base de datos (5 minutos)

Supabase → **SQL Editor → New query**. Ejecuta, en orden, las que **no** hayas corrido (todas se pueden repetir sin problema):

1. `005_storage_fix.sql` — espacio para imágenes (arregla «Bucket not found»).
2. `006_gamvoraq_v11.sql` — todo lo nuevo de esta versión.

Si la app muestra un aviso amarillo «Falta ejecutar…», te dice cuál migración falta.

## 2. Código

Reemplaza los archivos (conserva tu `.env`), y luego:

```cmd
npm install
npm test
npm run check:pwa
npm run build
```

`npm test`: **92 pruebas correctas**. `check:pwa`: **16/16 capacidades**. Si usas GitHub + Vercel: `git add . && git commit -m "v11" && git push`.

## 3. Hazte administrador de la app (para subir portadas de juegos)

En el SQL Editor, cambia el correo por el tuyo:

```sql
insert into public.app_admins(user_id)
select id from auth.users where email = 'TU_CORREO@ejemplo.com'
on conflict do nothing;
```

Recarga la app: en **Perfil → Mis juegos** cada tarjeta muestra un botón para cambiar la portada (subir imagen o poner el número de Steam).

## 4. Notificaciones al teléfono y a la laptop

Sigue `GUIA_NOTIFICACIONES.md` (6 pasos, ya trae tu proyecto).

## Qué cambió

### Protección de menores (revisión completa)
- **El año de nacimiento se pide al crear la cuenta** y se registra **una sola vez**: ya no se puede cambiar desde la app (antes un menor podía ponerse un año de adulto).
- **Sin edad registrada no hay nada privado**: ni mensajes, ni squads, ni guías, ni saludos de la sala tranquila. La app muestra una tarjeta para registrarla.
- **Squads por rango de edad**: cada squad toma el rango de quien lo crea; un adulto no puede entrar ni ser invitado a un squad de menores (y viceversa). Antes cualquiera podía unirse a cualquier squad y chatear con menores.
- **«Disponible ahora» solo dentro del mismo rango**: un adulto ya no ve en tiempo real cuándo está jugando un menor.
- **Un adulto no puede seguir a un menor** (un menor sí puede seguir a creadores adultos).
- Saludos de la sala tranquila y guías: misma regla.

### Squads con roles y límites
- **Roles**: dueño, admin e integrante. El dueño nombra y quita admins, **transfiere** el squad y lo **elimina**. Dueño y admins **invitan, expulsan, agendan y editan**. Los integrantes chatean, confirman partidas y guardan recuerdos.
- **Máximo 5 squads creados por persona**, **cupo** configurable (2 a 50) y squads **abiertos o solo por invitación**.
- **Invitaciones**: el squad invita, la persona acepta o rechaza (también desde Avisos).
- **Silenciar** el chat de un squad.

### Mensajes
- **«Visto»** en mensajes privados y **no leídos por chat**, sincronizados entre teléfono y computadora.
- **Borrar** tus mensajes (en el squad, dueño y admins pueden borrar cualquiera para moderar).
- **Un aviso por chat** con nombre y vista previa, en vez de «Tienes un mensaje nuevo» repetido.
- **Avisos del chat del squad** (antes no había).

### Seguimientos
- Listas de **seguidores y seguidos** (toca los números del perfil), «**Te sigue**» y «**Seguir también**» desde el aviso.
- El aviso dice **quién** te siguió y celebra cuando ya se siguen mutuamente.
- **Bloquear** deja de seguirse en ambos sentidos. Nadie puede seguirse a sí mismo.

### Imágenes de juegos
- **Portadas automáticas de Steam** para ~130 juegos del catálogo y para todo lo que importes de Steam.
- Los **administradores** pueden subir una portada o indicar el número de Steam de cualquier juego.
- Si una imagen no carga, se muestra un degradado con la inicial (nunca un hueco roto).

### Retos de comunidad (revisión)
- Quien organiza puede **editar, cerrar, reabrir y eliminar** su reto.
- Los participantes pueden **abandonar**.
- **Avisos**: a quien organiza cuando llega evidencia (con botón «Revisar») y al participante cuando le piden ajustes.
- Los retos cerrados ya no muestran «Participar» (antes daba error).
- Anti-spam: máximo **3 retos abiertos por persona**.
- La sección «Retos abiertos para todos» siempre está visible para poder crear el primero.

### Idioma de la app
- La interfaz completa en **español, inglés y portugués** (Ajustes → Idioma de la app; «Auto» usa el idioma del teléfono). Fechas y «hace 5 min» también cambian de idioma.

### 16 capacidades de PWA
Ver la lista en `GUIA_PWA_Y_TIENDAS.md`. Nuevas: sincronización en segundo plano, sincronización periódica, abrir imágenes con GAMVORAQ, enlaces `web+gamvoraq://`, barra de título integrada en computadora y widget para Windows 11.

### Correcciones
- El botón de notificaciones tenía botones dentro de botones (no accesible): ahora cada aviso tiene sus acciones aparte.
- La versión en Ajustes decía «v6.0».
- La inscripción a ligas ahora la pueden hacer también los admins del squad.
