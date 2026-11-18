# GAMVORAQ v19 · Fotos y audios en chats, canciones completas

## Qué hay de nuevo
- **Chats privados y de squad**: botón de **foto** (se reduce sola para enviarse rápido) y de **micrófono** para notas de voz (hasta 2 minutos). Las fotos se abren en grande al tocarlas. Todo se guarda en un espacio **privado**: solo las personas de ese chat pueden verlo.
- **Canciones completas**: al tocar ▶ en una canción, GAMVORAQ busca su video oficial en YouTube y la reproduce completa dentro del reproductor (pausa, avance, volumen). YouTube exige que el video se vea mientras suena: aparece una ventana pequeña sobre la barra.
  - Si no la encuentra, te pide pegar el enlace de YouTube debajo de la canción.
  - Al compartir a mano también puedes pegar el enlace.
  - El video encontrado se guarda para todo el squad (solo se busca una vez por canción).

## Pasos
1. **Supabase → SQL Editor**: ejecuta `018_chat_media_canciones.sql`. Al final: dos ✓.
2. **Búsqueda automática de canciones completas** (recomendado; sin esto solo funcionan los enlaces que pegues):
   1. Entra a https://console.cloud.google.com → crea un proyecto (por ejemplo «gamvoraq»).
   2. Menú → **APIs y servicios → Biblioteca** → busca **YouTube Data API v3** → **Habilitar**.
   3. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**. Cópiala.
      (Opcional pero recomendado: «Restringir clave» → solo *YouTube Data API v3*.)
   4. En CMD:
      ```cmd
      npx supabase secrets set YOUTUBE_API_KEY=TU_CLAVE --project-ref jqzkectzbqlybuscxsht
      npx supabase functions deploy game-feed --use-api --project-ref jqzkectzbqlybuscxsht
      ```
   - Es gratis: Google da 10 000 unidades al día y cada búsqueda gasta 100, o sea unas **100 canciones nuevas al día**. Las que ya se encontraron no vuelven a gastar.
3. Descomprime el zip encima de tu carpeta y publica: `npx vercel --prod`

## Notas
- En iPhone, la primera vez el navegador pide permiso para el micrófono.
- La música se pausa sola si empiezas a grabar una nota de voz.

## v20 · Reproductor más discreto
- La ventana de YouTube ahora es la **portada cuadrada** (200 × 200, el mínimo que pide YouTube) en la esquina del reproductor. Casi siempre muestra la portada del álbum, porque la búsqueda prefiere los canales «- Topic».
- Botón 👁 en el reproductor: **oculta la ventana** y suena el adelanto de 30 s. Tócalo otra vez para volver a la canción completa. La app recuerda tu elección.
