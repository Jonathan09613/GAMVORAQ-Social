# GAMVORAQ v8 · Instalarla en teléfono, computadora y tiendas de apps

GAMVORAQ es una **aplicación web progresiva (PWA)**: un mismo código que se instala como app en Android, iPhone, iPad, Windows, Mac, Linux y Chromebook, y que además se puede empaquetar para Google Play y Microsoft Store.

> Requisito único para que se pueda instalar: **publicarla en internet con HTTPS** (en `localhost` también funciona para probar).

---

## 1. Revisión rápida antes de publicar

```cmd
npm install
npm test
npm run check:pwa
npm run build
```

`check:pwa` revisa el manifiesto, los iconos (tamaños reales), las capturas, los atajos, las pantallas de arranque de iPhone, el service worker y la página sin conexión. Debe terminar con **✓ Lista para instalarse como app**.

### Las 16 capacidades de PWA (las que revisa PWABuilder)

`npm run check:pwa` las comprueba una por una:

1. Instalable (manifiesto completo e iconos adaptables)
2. Funciona sin conexión
3. Instalación enriquecida (capturas para teléfono y computadora)
4. Notificaciones push
5. Sincronización en segundo plano: lo que escribes sin internet se envía solo al volver la conexión
6. Sincronización periódica: la app instalada se refresca sola cada ~12 h
7. Insignia con los avisos sin leer en el icono
8. Atajos al mantener pulsado el icono
9. Compartir desde otras apps hacia GAMVORAQ
10. Abrir imágenes con GAMVORAQ (clic derecho → Abrir con) para publicarlas
11. Enlaces propios `web+gamvoraq://perfil/usuario`, `…/squad/ID`, `…/mensajes`
12. Control de lanzamiento: reutiliza la ventana abierta
13. Abre los enlaces de GAMVORAQ dentro de la app instalada
14. Barra de título integrada en la computadora (window controls overlay)
15. Panel lateral de Microsoft Edge
16. Widget para el panel de widgets de Windows 11

## 2. Publicarla con HTTPS (gratis)

El proyecto ya trae la configuración para los tres servicios más usados:

| Servicio | Archivo incluido | Qué hacer |
|---|---|---|
| **Vercel** | `vercel.json` | vercel.com → *Add New Project* → importa el repositorio. Detecta Vite solo. |
| **Netlify** | `netlify.toml`, `public/_headers`, `public/_redirects` | netlify.com → *Add new site* → importa el repositorio. |
| **Cloudflare Pages** | `public/_headers`, `public/_redirects` | Build command `npm run build`, carpeta `dist`. |

En el servicio elegido agrega las **variables de entorno** (las mismas de tu `.env`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_VAPID_PUBLIC_KEY=...        (solo si activaste los avisos push)
```

Las configuraciones ya hacen esto por ti: el `sw.js` y el manifiesto nunca se quedan en caché (las actualizaciones llegan al instante), los archivos de `/assets/` se guardan un año, cualquier ruta abre la app y se añaden cabeceras de seguridad.

### Muy importante: avisa a Supabase de tu nuevo dominio

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://tu-dominio.com`
- **Redirect URLs:** agrega `https://tu-dominio.com/**`

Si no lo haces, los enlaces de confirmación de correo y de cambio de contraseña seguirán apuntando a `localhost`.

## 3. Cómo la instala cada persona

La app ya lo explica sola: detecta el dispositivo y muestra los pasos exactos (botón **Instalar la app** en la portada, invitación dentro de la app, **Ajustes → Instalación** o `Ctrl K` → «Instalar»).

| Dispositivo | Cómo |
|---|---|
| Android (Chrome, Edge, Samsung Internet) | Botón **Instalar** de un toque. Queda en el cajón de apps. |
| iPhone / iPad (Safari) | Compartir → **Añadir a pantalla de inicio**. Avisos push desde iOS 16.4. |
| Windows / Linux / Chromebook (Chrome, Edge) | Botón **Instalar** o icono de instalar en la barra de direcciones. |
| Mac (Safari 17+) | Archivo → **Añadir al Dock**. En Chrome/Edge, botón Instalar. |
| Firefox de escritorio | No instala apps web; la guía sugiere abrirla en Chrome o Edge. |

Lo que gana quien la instala: pantalla completa, icono propio con insignia de avisos sin leer, avisos push, funciona sin conexión, **atajos** al mantener pulsado el icono (Disponible, Agendar, Jugar, Mensajes) y **compartir desde otras apps** (un clip de YouTube, una captura de enlace…) directo a una publicación de GAMVORAQ.

## 4. Publicarla en tiendas de apps (opcional)

Con la app ya publicada en HTTPS, entra a **https://www.pwabuilder.com**, escribe tu dirección y pulsa *Package for stores*. PWABuilder lee el manifiesto de GAMVORAQ y genera los paquetes.

### Google Play (Android)

1. En PWABuilder elige **Android** → nombre de paquete, por ejemplo `com.gamvoraq.social`. Descarga el `.aab` y **guarda bien el archivo de firma (keystore) y su contraseña**: sin él no podrás publicar actualizaciones.
2. PWABuilder te entrega un `assetlinks.json`. Cópialo a `public/.well-known/assetlinks.json` (hay un ejemplo en `tiendas/assetlinks.json.ejemplo`), vuelve a publicar la web y comprueba que abre en `https://tu-dominio.com/.well-known/assetlinks.json`. Esto quita la barra del navegador dentro de la app de Android.
3. Crea tu cuenta en Google Play Console (pago único de registro) y sube el `.aab`.
4. Cuentas **personales** nuevas: Google exige una prueba cerrada con **al menos 12 personas durante 14 días seguidos** antes de poder publicar para todo el mundo. Planéalo desde el inicio (amigos, tu comunidad de Discord).

### Microsoft Store (Windows)

1. En PWABuilder elige **Windows** y descarga el paquete.
2. Crea tu cuenta de desarrollador en storedeveloper.microsoft.com: **el registro es gratuito** (individual o empresa), con verificación de identidad.
3. Sube el paquete en Partner Center. Las actualizaciones de la web llegan solas a la app.

### App Store (iPhone / iPad)

En iPhone la forma recomendada es **instalarla desde Safari** (paso 3): funciona hoy, gratis y con avisos push. Publicarla en la App Store es posible con el paquete iOS de PWABuilder, pero requiere una Mac con Xcode y la cuenta Apple Developer (cuota anual), y Apple revisa que una app basada en web aporte funciones propias; GAMVORAQ tiene argumentos para ello (avisos, compartir, sin conexión), pero la aprobación no está garantizada.

## 5. Comprobarlo en un teléfono real

1. Abre tu dominio en el teléfono y pulsa **Instalar la app**.
2. Abre la app desde el icono: no debe verse la barra del navegador.
3. Activa el modo avión y ábrela: debe abrir y mostrar tu última sesión guardada en modo lectura.
4. Mantén pulsado el icono (Android): deben aparecer los 4 atajos.
5. En otra app pulsa **Compartir → GAMVORAQ** (Android con la app instalada): se abre «Crear publicación» con el contenido.

En Chrome de computadora: F12 → **Application → Manifest** debe mostrar «Installability: no errors».
