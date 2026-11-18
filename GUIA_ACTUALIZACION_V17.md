# GAMVORAQ v17

## Qué arregla y qué agrega
- **Mensajes del squad** ya se envían («No tienes permiso… squad_messages»).
- **Recuerdos** ya se guardan, con foto y con las personas mencionadas («No tienes permiso… squad_memories»).
- **Reproductor de música**: barra fija con pausa, anterior/siguiente, barra de avance, volumen y silencio. Sigue sonando al cambiar de pantalla y se controla desde la pantalla bloqueada o los audífonos.
- **Foto de perfil para squads y comunidades**: el dueño o un admin (squad), y quien funda o modera (comunidad), tocan la imagen del grupo para cambiarla. También se puede quitar.
- **Revisión de reglas de escritura (015)**: igual que la 013 con la lectura, pone las reglas para crear, editar y borrar que falten en cualquier tabla.

## Pasos
1. **Supabase → SQL Editor**: pega `015_escritura_fotos.sql` y pulsa **Run**.
   - Al final muestra qué reparó (o «Todo estaba bien») y «Funciones nuevas ✓».
2. Descomprime el zip encima de tu carpeta y publica:
   ```cmd
   npx vercel --prod
   ```

## Dónde cambiar la foto
- **Squad**: en la cabecera del squad (toca la imagen con el icono de cámara) o en **Editar**.
- **Comunidad**: en la cabecera de la comunidad o en la pestaña **Integrantes**.

## Agendar partidas (016)
Si al agendar salía «No puedes agendar en este squad… play_sessions», ejecuta también `016_agendar_partidas.sql` (después de la 015).
