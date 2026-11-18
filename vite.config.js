import { defineConfig } from 'vite';

// v5: se eliminó Tailwind (la hoja de estilos es 100 % propia, con variables CSS),
// así el proyecto depende solo de Vite, Supabase y Lucide.
export default defineConfig({
  server: { host: '0.0.0.0' },
  build: { target: 'es2020', sourcemap: false }
});
