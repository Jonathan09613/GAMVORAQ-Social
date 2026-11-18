import { createClient } from '@supabase/supabase-js';
// import.meta.env lo inyecta Vite; en pruebas de Node no existe y la app queda en modo sin servidor.
const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && /^https:\/\//.test(url) && !url.includes('TU-PROYECTO') && key && !key.includes('TU_CLAVE'));
export const supabase = configured ? createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }) : null;
export function must(result) { if (result.error) throw result.error; return result.data; }
