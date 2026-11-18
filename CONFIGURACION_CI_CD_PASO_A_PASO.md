# GAMVORAQ Social — Configuración de CI/CD y evidencias del Producto 3

## ¿Qué lleva este ZIP?

Código completo del proyecto (sin secretos locales), `.github/workflows/ci-cd.yml`, `.github/workflows/monitor.yml`, scripts de verificación, release y smoke test, además de las guías del proyecto original. **No** incluye `.env`, `.env.local`, `.vercel/`, `node_modules/`, `dist/` ni `supabase/.temp/`, porque contienen datos locales, credenciales o archivos generados.

## 1. Subir a GitHub

1. Extraer el ZIP en una carpeta normal de Windows. Activar la vista de archivos ocultos para confirmar que existe `.github/workflows/ci-cd.yml`.
2. Instalar Git si no está instalado. Crear un **repositorio privado vacío** en GitHub (nombre sugerido: `GAMVORAQ-Social`). No crear README desde GitHub porque este proyecto ya lo incluye.
3. Abrir PowerShell en la carpeta que contiene `package.json`, ejecutar y sustituir `TU_USUARIO`:

```powershell
git init
git branch -M main
git add .
git status
git commit -m "Agregar GAMVORAQ con CI/CD"
git remote add origin https://github.com/TU_USUARIO/GAMVORAQ-Social.git
git push -u origin main
```

4. Si Git pide `user.name` y `user.email`, configurarlos con tu cuenta GitHub y repetir el commit. Si pide autenticación, usar el inicio de sesión seguro del gestor de Git o GitHub Desktop: nunca pegar contraseñas en archivos.
5. En GitHub, sección **Actions**, abrir "GAMVORAQ Social | CI/CD". Tras el `push`, debe correr el trabajo **validar**, con `npm ci`, 102 pruebas, revisión PWA, `npm run build`, `verify:dist`, paquete de liberación y artifact. Guardar una captura mostrando check verde y otra del detalle de pasos.

> El despliegue NO se hace hasta que existan un proyecto Vercel y los secretos correspondientes. Esto permite comprobar CI sin credenciales y evita publicar por accidente.

## 2. Crear proyecto Vercel

1. Ingresar a Vercel con tu cuenta. Crear un proyecto llamado `gamvoraq-social` con framework **Vite**, root directory `./`, build command `npm run build` y output `dist`. Si decides importar el GitHub repo, ten en cuenta que Vercel también puede iniciar despliegues por su cuenta al hacer push; para tener un único pipeline con pruebas antes de publicar, administra las publicaciones con GitHub Actions.
2. En **Project > Settings > Environment Variables**, agregar para el entorno *Production*:
   - `VITE_SUPABASE_URL`: URL HTTPS de tu proyecto de Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: clave **publishable/anon pública** de Supabase, NO `service_role`, `sb_secret_`, ni tokens personales.
   - `VITE_VAPID_PUBLIC_KEY` (opcional): solamente la clave pública de notificaciones.
3. Copiar `orgId` y `projectId` de la vinculación de Vercel (puedes obtenerlos ejecutando `npx vercel link` localmente y leyendo `.vercel/project.json`; **nunca** subir esa carpeta al repositorio). Crear un token en la configuración de Vercel de tu propia cuenta; no compartirlo.
4. En GitHub > repositorio > **Settings > Secrets and variables > Actions > Repository secrets**, agregar estos tres nombres con sus valores reales: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Los valores no se escriben dentro de YAML, README o capturas.

## 3. Probar despliegue seguro y activar CD

1. GitHub > **Actions > GAMVORAQ Social | CI/CD > Run workflow**.
2. Seleccionar rama `main` y activar `deploy_production = true`; ejecutar. El job `desplegar` se activa **únicamente si `validar` terminó correctamente**. Esperar a que termine y revisar que al final el smoke test informe cuatro rutas correctas: `/`, `/manifest.webmanifest`, `/sw.js`, `/offline.html`.
3. Copiar la URL HTTPS real. Guardar capturas del job `validar`, del job `desplegar`, del sitio público y del manifiesto PWA en producción.
4. Para convertirlo en **despliegue continuo automático**, en GitHub > Settings > Secrets and variables > Actions > pestaña **Variables**, crear `ENABLE_PRODUCTION_DEPLOY` con valor `true`. A partir de entonces, un `push` a `main` publica si pasan las pruebas. Los PR solamente comprueban la calidad. Puedes dejarlo sin activar si el proyecto aún no debe publicarse.

## 4. Monitoreo y niveles de servicio

1. En la misma pestaña **Variables** crear `PRODUCTION_URL` con `https://...` de tu app publicada.
2. El workflow `.github/workflows/monitor.yml` hace pruebas de cuatro rutas aproximadamente cada 30 minutos (los horarios de GitHub Actions pueden retrasarse). También se puede iniciar manualmente desde Actions.
3. Objetivos propuestos, **no todavía acordados ni medidos**:
   - Disponibilidad HTTP mensual: >= 99 % (se necesita historial de mediciones).
   - Ruta principal con respuesta menor de 3 segundos en el monitoreo, como meta orientativa, no garantía del usuario final.
   - Incidente crítico: revisión dentro de 24 h y plan de recuperación.
   - Criterio de liberación: 100 % de pruebas automatizadas, revisión PWA y compilación exitosas.
4. La revisión de monitoreo detecta disponibilidad superficial de páginas estáticas. Para confirmar registro, autenticación, base de datos, chat, push y Edge Functions, se necesitan pruebas funcionales adicionales y configurar correctamente Supabase.

## 5. Backend Supabase: comprobaciones pendientes

- El código incluye `supabase/functions/` y `supabase/migrations/` pero **este pipeline NO aplica migraciones ni despliega Edge Functions** para evitar modificar datos reales sin supervisión.
- Comprobar el proyecto correcto de Supabase, aplicar **solo migraciones necesarias** mediante el procedimiento que ya usa el equipo, verificar RLS y desplegar las Edge Functions según las guías del propio proyecto.
- Revisar `ALLOWED_ORIGINS` de las funciones cuando se conozca el dominio Vercel. Si usas Auth con redirecciones, configurar la URL del sitio y las URLs autorizadas en Supabase Auth.
- **NO** introducir `SUPABASE_SERVICE_ROLE_KEY`, tokens privados de IA, secretos Discord ni claves VAPID privadas en variables `VITE_*` (esas variables llegan al navegador).

## 6. Evidencias para la lista de cotejo

- **E1:** Captura de `github.com/TU_USUARIO/GAMVORAQ-Social` con rama `main`, `.github/workflows/` y scripts `scripts/release/` visibles.
- **E2:** Captura del job `validar` con pruebas exitosas, revisión PWA y compilación.
- **E3:** Captura del artefacto `gamvoraq-release-...` en la ejecución de GitHub Actions.
- **E4:** Captura del job `desplegar` con la URL real y el resultado de cuatro checks HTTP.
- **E5:** Captura de la aplicación publicada en Vercel y de `manifest.webmanifest` por HTTPS.
- **E6:** Captura de `GAMVORAQ Social | Monitoreo web` cuando se configure `PRODUCTION_URL` y pase su primera ejecución.
- **E7:** Captura/configuración de Supabase con datos sensibles ocultos, o anotación explícita de lo pendiente.

**Importante:** este archivo es una guía y la configuración está incluida. Hasta ejecutar los workflows en tus cuentas, no se puede afirmar que GitHub Actions o el despliegue de producción se hayan verificado allí.
