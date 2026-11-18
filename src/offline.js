// Datos sin conexión: copia local de la última sincronización (IndexedDB) y cola de envíos pendientes (outbox).
const DB = 'gamvoraq-offline', STORE = 'kv';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB no disponible')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode), store = tx.objectStore(STORE), req = fn(store);
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export const kvGet = key => kv('readonly', s => s.get(key));
export const kvSet = (key, value) => kv('readwrite', s => s.put(value, key));
export const kvDel = key => kv('readwrite', s => s.delete(key));

// ---- Instantánea de datos (se muestra en modo lectura cuando no hay red) ----
const slim = data => {
  const copy = {};
  for (const [k, rows] of Object.entries(data)) copy[k] = Array.isArray(rows) ? rows.map(r => { if (r && r.image_url) { const { image_url, ...rest } = r; return rest; } return r; }) : rows;
  return copy;
};
export async function saveSnapshot(uid, data) {
  try { await kvSet(`snap:${uid}`, { at: Date.now(), data: slim(data) }); return true; } catch { return false; }
}
export async function loadSnapshot(uid) {
  try { return (await kvGet(`snap:${uid}`)) || null; } catch { return null; }
}
export async function clearOfflineData(uid) {
  try { await kvDel(`snap:${uid}`); } catch { /* nada que borrar */ }
  try { localStorage.removeItem(outboxKey(uid)); } catch { /* sin almacenamiento */ }
}

export function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err.message || err);
  return err instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed|fetch/i.test(msg);
}

// ---- Cola de envíos pendientes ----
const outboxKey = uid => `gvq:outbox:${uid}`;
export function outboxList(uid, storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(outboxKey(uid)) || '[]'); } catch { return []; }
}
function outboxWrite(uid, list, storage) { try { storage.setItem(outboxKey(uid), JSON.stringify(list.slice(-50))); } catch { /* cuota llena */ } }
export function outboxAdd(uid, item, storage = globalThis.localStorage) {
  const list = outboxList(uid, storage);
  const id = item.id || `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  list.push({ ...item, id, at: Date.now() });
  outboxWrite(uid, list, storage);
  return id;
}
export function outboxRemove(uid, id, storage = globalThis.localStorage) {
  outboxWrite(uid, outboxList(uid, storage).filter(x => x.id !== id), storage);
}
/**
 * Envía en orden lo que quedó pendiente. Si falla por red, se detiene y conserva el resto.
 * Si falla por otra razón (p. ej. permisos), descarta ese elemento y lo cuenta como fallido.
 */
export async function outboxFlush(uid, send, storage = globalThis.localStorage) {
  let sent = 0, failed = 0;
  for (const item of outboxList(uid, storage)) {
    try { await send(item); outboxRemove(uid, item.id, storage); sent++; }
    catch (err) {
      if (isNetworkError(err)) break;
      outboxRemove(uid, item.id, storage); failed++;
    }
  }
  return { sent, failed, left: outboxList(uid, storage).length };
}
