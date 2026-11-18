# GAMVORAQ v18
- **Recuerdos sin aprobación**: se comparten al momento con todo el squad. Mencionar a alguien es opcional y solo aparece como «Con …». Las menciones que estaban pendientes se aprueban solas.
- **Fotos de recuerdos** ya se guardan (había una protección de la base que fallaba con cualquier cambio).
- **Volumen siempre visible**: en la barra del reproductor (también en el teléfono) y dentro de «Sonando en el squad». Los dos controles están sincronizados y la app recuerda el volumen.

## Pasos
1. Supabase → SQL Editor: ejecuta `017_recuerdos_directos.sql` (si no corriste la 015 y la 016, ejecútalas antes).
2. Descomprime el zip encima de tu carpeta y `npx vercel --prod`.

Nota: en iPhone, Safari no deja que las páginas cambien el volumen; ahí se usan los botones de volumen del teléfono (pausa, avance y silencio sí funcionan).
