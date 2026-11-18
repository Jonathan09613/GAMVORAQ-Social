# GAMVORAQ v12: cómo actualizar (Windows · CMD)

## Qué arregla la v12

| Problema | Causa | Arreglo |
|---|---|---|
| «No tienes permiso» al crear squads, retos o agendar partidas | La migración 006 creó funciones internas que tu base de datos no dejaba usar | La migración **007** vuelve a dar esos permisos. Además los errores ahora dicen la causa exacta |
| No se podían mandar mensajes privados | Sin año de nacimiento registrado, el servidor bloquea lo privado (protección de menores) | La app pide la edad al entrar. Si no puedes escribirle a alguien, te dice por qué |
| El idioma «se aceptaba» pero la página no cambiaba | La traducción perdía el texto original al cambiar de idioma por segunda vez | Hay un solo selector de idioma (Ajustes → Idioma) y la página entera cambia al momento |
| Mensajes en otro idioma sin traducir | El traductor necesitaba una clave de pago | Traductor gratuito automático. Ves el **original y debajo la traducción** |
| No había sección de mensajes | Los chats estaban escondidos dentro de Squads | Nueva pestaña **Mensajes** con buscador, «Nuevo chat», borrar chat, reportar y bloquear |
| No se veían los seguidos | Estaban en una ventana poco visible | Pestañas **Seguidores** y **Siguiendo** dentro de cada perfil |

## Qué hay de nuevo

- **Moderación**: pestaña para las personas administradoras con:
  - reportes de publicaciones, comentarios, mensajes, perfiles, squads y comunidades;
  - pausar cuentas 24 h, 7 o 30 días;
  - eliminar contenido, advertir o descartar reportes;
  - frases bloqueadas e historial de acciones.
- **Protección automática**:
  - el servidor rechaza amenazas («mátate», «kys»…);
  - frena el spam;
  - con 3 reportes de personas distintas en 24 h, la cuenta queda en pausa automática.
- **Música del squad**:
  - busca la canción (portada y adelanto de 30 s) o escríbela a mano (nombre y artista);
  - «Sonando en el squad», me gusta, top del squad y enlaces a Spotify, YouTube Music y Apple Music.
- **Encuestas del squad**: «¿A qué jugamos?», con duración, votos en vivo y opción de cambiar el voto.
- **Radar gamer** en Inicio: juegos gratis por tiempo limitado (GamerPower) y ofertas de PC (CheapShark).
- **VORA/NOVA personalizable**: 6 ojos, 4 bocas, 4 cabezas, 3 formas, 10 colores, accesorios nuevos y botón «Sorpréndeme». Se guarda en tu perfil y se ve igual en el teléfono y la laptop.
- **Squads**: el dueño decide si todos pueden agendar partidas (por defecto, sí).
- **Comunidades**:
  - cualquier integrante crea retos;
  - pestaña Integrantes para nombrar moderadores o sacar a alguien;
  - el fundador puede eliminar la comunidad.
- **Borrar** mensajes, chats, comentarios, publicaciones, squads, comunidades, canciones y encuestas.
- Maquetación revisada en teléfono (390 px) y computadora (1366 px): el chat abierto ocupa toda la pantalla del teléfono.

---

## Paso 1 · Copia los archivos nuevos

1. Descomprime `GAMVORAQ-SOCIAL-v12.zip`.
2. Copia todo su contenido encima de tu carpeta `C:\Users\deivi\GAMVORAQ-SOCIAL-v11` y reemplaza los archivos.
3. **No borres tu archivo `.env`.** El zip no lo trae, así que se conserva.

```cmd
cd C:\Users\deivi\GAMVORAQ-SOCIAL-v11
npm install
npm test
npm run check:pwa
```

Debe decir `pass 97`, `fail 0` y «Lista para instalarse como app».

## Paso 2 · Ejecuta la migración 007 en Supabase (lo más importante)

1. Abre https://supabase.com/dashboard/project/jqzkectzbqlybuscxsht/sql/new
2. Abre el archivo `supabase\migrations\007_gamvoraq_v12.sql` con el Bloc de notas, copia **todo** y pégalo.
3. Presiona **Run**. Debe decir `Success. No rows returned`.

Se puede ejecutar más de una vez sin problema. Si te dice que falta algo de la 006, ejecuta primero `006_gamvoraq_v11.sql` y luego la 007.

## Paso 3 · Hazte administrador (para ver la pestaña Moderación)

En el mismo editor SQL ejecuta:

```sql
insert into public.app_admins(user_id)
select id from auth.users where email = 'deividmora93@gmail.com'
on conflict do nothing;
```

Cierra sesión y vuelve a entrar: aparece **Moderación** en el menú lateral. Para agregar a otra persona, cambia el correo y repite.

## Paso 4 · Sube las funciones del servidor

```cmd
npx supabase functions deploy translate
npx supabase functions deploy game-feed
npx supabase functions deploy push
```

- `translate` ya traduce gratis sin ninguna clave. Si algún día quieres más calidad o volumen, puedes poner una clave de DeepL con `npx supabase secrets set DEEPL_API_KEY=tu_clave`.
- `game-feed` hace más rápida la búsqueda de canciones y el radar de ofertas. Sin ella, la app llama directo a las APIs.

## Paso 5 · Publica

Si usas GitHub con Netlify o Vercel:

```cmd
git add .
git commit -m "GAMVORAQ v12"
git push
```

Si la pruebas en tu computadora:

```cmd
npm run dev
```

Abre la dirección que aparece. En el teléfono, la app instalada se actualiza sola: aparece «Hay una versión nueva» y tocas **Actualizar ahora**.

## Paso 6 · Comprueba que todo funciona

1. Al entrar, si no registraste tu año de nacimiento, la app te lo pide. Regístralo (solo se puede una vez).
2. **Ajustes → Idioma**: elige English y presiona «Aplicar idioma». Todo el menú cambia. Vuelve a Español.
3. **Mensajes → Nuevo chat**: escríbele a alguien. Si la otra persona no ha registrado su edad, la app te lo explica.
4. **Squads → Crear squad**, luego **Agenda → Agendar**, **Música** y **Encuestas**.
5. **Comunidades → Retos → Crear reto**.
6. **Moderación**: revisa que aparecen los contadores.

Si aparece arriba un aviso naranja «Falta actualizar el servidor», todavía no se ejecutó la migración 007 (Paso 2).

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| «El servidor necesita una actualización de permisos» | Ejecuta la migración 007 (Paso 2) |
| «Esa persona todavía no confirma su edad» | La otra persona debe entrar a la app y registrar su año de nacimiento |
| «Por protección de menores…» | Adultos y menores no pueden escribirse en privado. Es intencional |
| «No puedes agendar en este squad» | El dueño desactivó «Todos pueden agendar partidas» en Editar squad |
| «Tu mensaje contiene una expresión que no se permite» | El filtro detectó una amenaza o acoso. Las frases se cambian en Moderación → Frases bloqueadas |
| «Vas muy rápido» | Freno anti-spam: espera un minuto |
| No veo la pestaña Moderación | Haz el Paso 3, cierra sesión y vuelve a entrar |
| Las traducciones no aparecen | Revisa tu conexión a internet. En Ajustes → Idioma, comprueba que «Traducir mensajes automáticamente» está activado |
