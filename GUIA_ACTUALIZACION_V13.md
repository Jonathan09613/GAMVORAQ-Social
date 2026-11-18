# GAMVORAQ v13 · Correcciones (Windows · CMD)

## Qué se arregló

| Lo que pasaba | Causa | Arreglo |
|---|---|---|
| «Restricción de menores» sin que nadie fuera menor y no dejaba hablar con nadie | Quien no había registrado su edad no podía escribir a nadie. Además, quien cumple 18 este año contaba como menor | Desde los 18 años se cuenta como adulto. Sin edad registrada **sí** puedes hablar con adultos. Solo se bloquea menor ↔ adulto |
| No dejaba crear squads | La regla de seguridad de la base de datos rechazaba la creación | Ahora el squad lo crea una función del servidor que valida todo y dice exactamente qué falta |
| Al crear un reto decía «tienes que ser miembro» aunque lo fueras | Mismo tipo de problema que los squads | El reto se crea con una función del servidor. Si fundaste la comunidad y faltaba tu registro de integrante, se repara solo |
| Se cerraba el reto al cambiar el nombre de la insignia | Al seleccionar el texto arrastrando el ratón y soltar fuera de la ventana, la app lo tomaba como «clic fuera» | La ventana solo se cierra si el clic empieza y termina en el fondo |
| Algunos juegos sin imagen | Steam cambió dónde guarda las portadas | Se prueban 4 servidores oficiales de Steam. Si ninguno responde, la app busca la portada oficial por número de Steam o por nombre y la guarda para todos |
| La página no se traducía completa | El diccionario no tenía todos los textos | Lo que no está en el diccionario (géneros de juegos, biografías, textos de VORA…) se traduce de forma automática y se guarda en el dispositivo |

Si algo vuelve a fallar, el aviso ahora incluye el **detalle técnico** del servidor. Mándame captura de ese aviso.

---

## Paso 1 · Copia los archivos

1. Descomprime `GAMVORAQ-SOCIAL-v13.zip` encima de tu carpeta y reemplaza todo. Tu `.env` se conserva.
2. Abre CMD y ejecuta:

```cmd
cd C:\Users\deivi\GAMVORAQ-SOCIAL-v11
npm install
npm test
```

Debe salir `pass 100` y `fail 0`.

## Paso 2 · Ejecuta las migraciones en Supabase (en este orden)

1. Abre https://supabase.com/dashboard/project/jqzkectzbqlybuscxsht/sql/new
2. Si todavía no corriste la **007**: pega todo `supabase\migrations\007_gamvoraq_v12.sql` y presiona **Run**.
3. Abre una consulta nueva, pega todo `supabase\migrations\008_gamvoraq_v13.sql` y presiona **Run**.

Al terminar, la 008 muestra una tabla de comprobación. **Todas las filas deben decir ✓.** Si alguna dice «✗ FALTA», ejecuta la migración que indica (006 o 007) y luego vuelve a ejecutar la 008.

## Paso 3 · Sube la función de portadas, ofertas y música

```cmd
npx supabase functions deploy game-feed
npx supabase functions deploy translate
```

Sin `game-feed`, los juegos que no tengan portada siguen mostrando su inicial.

## Paso 4 · Publica

```cmd
git add .
git commit -m "GAMVORAQ v13"
git push
```

En el teléfono aparece «Hay una versión nueva»: toca **Actualizar ahora**.

## Paso 5 · Comprueba

1. **Mensajes → Nuevo chat**: escríbele a cualquier persona adulta, aunque no haya registrado su edad.
2. **Squads → Crear squad**: se crea y quedas como dueño.
3. **Comunidad → Retos → Crear reto**: cambia el nombre de la insignia y publícalo.
4. **Perfil → Mis juegos**: las portadas se completan solas en unos segundos (la primera vez).
5. **Ajustes → Idioma → English**: cambia toda la página, incluidos los géneros de juegos y los textos de VORA. Vuelve a Español y regresa todo al original.
