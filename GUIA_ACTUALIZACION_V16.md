# GAMVORAQ v16 · Diseño profesional y portadas para todos los juegos

## Qué cambió
- **Tipografía nueva**: Instrument Sans para leer y Tektur para títulos. Ahora vienen dentro de la app: cargan más rápido, funcionan sin conexión y ya no dependen de Google Fonts.
- **Diseño más limpio**: menos brillos y animaciones, superficies planas, etiquetas en texto normal (sin MAYÚSCULAS espaciadas), botones y pestañas más precisos, y mejor orden en el teléfono (squads, invitaciones, cabecera de comunidad).
- **Portadas para todos los juegos**:
  1. Portada oficial de Steam (25 juegos más reconocidos con la migración 012).
  2. Para los que no están en Steam (Fortnite, Valorant, Minecraft, Nintendo, móviles…): la de **RAWG**, si configuras la llave gratis (abajo).
  3. Si no hay imagen, una **portada de diseño** con el color y el símbolo de su género. Ningún juego queda vacío.
- **Biblioteca de juegos** con la portada grande arriba, y la portada del juego en «Disponibles ahora».
- **Revisión completa de la base de datos** (013): repara de una vez las reglas de lectura que falten en cualquier tabla.

## Pasos (en este orden)
1. **Supabase → SQL Editor**: ejecuta `012_portadas.sql`, después `013_revision_completa.sql`.
   - El informe final de la 013 muestra cada tabla. Lo importante: la columna **lectura** no debe decir «✗ ninguna» y **tu_cuenta_ve** no debe tener ✗.
   - Que «tu_cuenta_ve» sea menor que «en_la_base» es normal en tablas privadas (avisos, mensajes de otros, etc.).
2. **Portadas de RAWG (opcional, recomendado)**:
   - Crea una cuenta gratis en https://rawg.io/apidocs y copia tu API key.
   - En CMD:
     ```cmd
     npx supabase secrets set RAWG_API_KEY=TU_LLAVE --project-ref jqzkectzbqlybuscxsht
     npx supabase functions deploy game-feed --use-api --project-ref jqzkectzbqlybuscxsht
     ```
   - Las portadas se buscan solas la primera vez que alguien ve cada juego y quedan guardadas para todos.
3. **Publicar la app**: descomprime el zip encima de tu carpeta y
   ```cmd
   npx vercel --prod
   ```
