// Fotos y notas de voz en los chats (privados y de squad).
// · Foto: se reduce a máx. 1600 px antes de subirla (más rápida y ligera); los GIF se suben tal cual.
// · Voz: se graba con el micrófono (máx. 2 min). Tocar ✓ envía, tocar la papelera cancela.
// · Archivos privados: se ven con enlaces firmados que duran 1 hora (solo las personas del chat).
import { e, icon } from './ui.js';
import { translate } from './i18n/index.js';

export const AUTO_LABELS = new Set(['📷 Foto', '🎤 Mensaje de voz']);
const MAX_VOICE = 120, MAX_BYTES = 8 * 1024 * 1024;
const pending = new Map();      // clave del chat → { blob, type, meta, url, ext }
const signed = new Map();       // ruta → { url, until }
let rec = null;                 // grabación en curso

const keyOf = (kind, id) => `${kind}:${id}`;
export const pendingFor = (kind, id) => pending.get(keyOf(kind, id)) || null;
export function clearPending(kind, id) { const p = pending.get(keyOf(kind, id)); if (p?.url) URL.revokeObjectURL(p.url); pending.delete(keyOf(kind, id)); }
export const isRecording = (kind, id) => rec?.key === keyOf(kind, id);
export const recordingSeconds = () => (rec ? Math.floor((Date.now() - rec.started) / 1000) : 0);

// ───── Foto ─────
export async function prepareImage(kind, id, file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG, WEBP o GIF).');
  let blob = file, ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), meta = {};
  if (file.type !== 'image/gif') {
    const out = await shrink(file, 1600).catch(() => null);
    if (out) { blob = out.blob; ext = out.blob.type === 'image/webp' ? 'webp' : 'jpg'; meta = { w: out.w, h: out.h }; }
  }
  if (blob.size > MAX_BYTES) throw new Error('La imagen pesa más de 8 MB.');
  clearPending(kind, id);
  pending.set(keyOf(kind, id), { blob, type: 'image', meta, ext, url: URL.createObjectURL(blob) });
}
function shrink(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve({ blob: b, w, h }) : reject(new Error('sin imagen'))), 'image/webp', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen no válida')); };
    img.src = url;
  });
}

// ───── Voz ─────
export async function startRecording(kind, id, onTick) {
  if (rec) cancelRecording();
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Tu navegador no permite grabar audio.');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { throw new Error('Permite el micrófono para grabar una nota de voz.'); }
  const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => MediaRecorder.isTypeSupported?.(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
  const chunks = [];
  mr.ondataavailable = ev => { if (ev.data?.size) chunks.push(ev.data); };
  rec = { key: keyOf(kind, id), mr, stream, chunks, started: Date.now(), timer: setInterval(() => { onTick?.(); if (recordingSeconds() >= MAX_VOICE) rec?.autoStop?.(); }, 500) };
  mr.start(250);
  return rec;
}
/** Termina la grabación y la deja lista para enviar. Devuelve la duración en segundos. */
export function stopRecording(kind, id) {
  return new Promise(resolve => {
    if (!rec || rec.key !== keyOf(kind, id)) { resolve(0); return; }
    const r = rec; rec = null; clearInterval(r.timer);
    const duration = Math.max(1, Math.round((Date.now() - r.started) / 1000));
    r.mr.onstop = () => {
      r.stream.getTracks().forEach(t => t.stop());
      const type = (r.mr.mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(r.chunks, { type });
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      clearPending(kind, id);
      if (blob.size > 0) pending.set(keyOf(kind, id), { blob, type: 'audio', meta: { duration }, ext, url: URL.createObjectURL(blob) });
      resolve(blob.size > 0 ? duration : 0);
    };
    try { r.mr.stop(); } catch { resolve(0); }
  });
}
export function cancelRecording() {
  if (!rec) return; const r = rec; rec = null; clearInterval(r.timer);
  try { r.mr.stop(); } catch { /* nada */ } r.stream.getTracks().forEach(t => t.stop());
}
export function setAutoStop(fn) { if (rec) rec.autoStop = fn; }

// ───── Subir y firmar ─────
export async function upload(supabase, kind, chatId, userId, item) {
  const path = `${kind}/${chatId}/${userId}/${crypto.randomUUID()}.${item.ext}`;
  const { error } = await supabase.storage.from('gamvoraq-chat').upload(path, item.blob, { contentType: item.blob.type || undefined, upsert: false });
  if (error) {
    if (/bucket|not found/i.test(error.message || '')) throw new Error('Falta el espacio para archivos de chat: ejecuta la migración 018 en Supabase.');
    throw error;
  }
  return path;
}
/** Pone la dirección real a las fotos y audios visibles (en lote, con caché de 50 minutos). */
export async function hydrate(supabase, root = document) {
  const els = [...root.querySelectorAll('[data-att-path]')].filter(el => !el.dataset.attReady);
  if (!els.length) return;
  const now = Date.now(), need = [];
  for (const el of els) {
    const p = el.dataset.attPath;
    if (/^(blob:|https?:)/.test(p)) { setSrc(el, p); continue; }
    const hit = signed.get(p);
    if (hit && hit.until > now) setSrc(el, hit.url); else need.push(p);
  }
  const uniq = [...new Set(need)];
  if (!uniq.length || !supabase) return;
  const { data } = await supabase.storage.from('gamvoraq-chat').createSignedUrls(uniq, 3600).catch(() => ({ data: null }));
  for (const row of data || []) if (row.signedUrl) signed.set(row.path, { url: row.signedUrl, until: now + 50 * 60000 });
  for (const el of els) { const hit = signed.get(el.dataset.attPath); if (hit) setSrc(el, hit.url); else el.closest('.att')?.classList.add('att-missing'); }
}
function setSrc(el, url) { el.dataset.attReady = '1'; if (el.tagName === 'IMG') el.src = url; else el.dataset.src = url; }

// ───── Vista en los mensajes ─────
const fmt = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function attachmentHtml(m) {
  if (!m?.attachment_type || !m.attachment_path) return '';
  const path = m.attachment_path;
  if (m.attachment_type === 'image') {
    const w = Number(m.attachment_meta?.w) || 4, h = Number(m.attachment_meta?.h) || 3;
    return `<button type="button" class="att att-img" data-action="att-open" data-id="${e(path)}" aria-label="${e(translate('Ver foto'))}" style="aspect-ratio:${w} / ${h}"><img data-att-path="${e(path)}" alt="${e(translate('Foto enviada en el chat'))}" loading="lazy"></button>`;
  }
  const dur = Number(m.attachment_meta?.duration) || 0;
  const bars = Array.from({ length: 28 }, (_, i) => 30 + Math.round(55 * Math.abs(Math.sin((i + 1) * 1.7 + path.length))));
  return `<div class="att att-audio" data-voice="${e(path)}"><button type="button" class="vn-play" data-action="voice-play" data-id="${e(path)}" aria-label="${e(translate('Reproducir nota de voz'))}">${icon('play', 16)}</button>
    <span class="vn-wave" aria-hidden="true">${bars.map(b => `<i style="height:${b}%"></i>`).join('')}</span><span class="vn-time">${fmt(dur)}</span><audio preload="none" data-att-path="${e(path)}"></audio></div>`;
}

// Notas de voz: una a la vez.
let voice = null;
export function toggleVoice(path, root = document) {
  const box = root.querySelector(`.att-audio[data-voice="${CSS.escape(path)}"]`); if (!box) return;
  const el = box.querySelector('audio'), src = el?.dataset.src || (/^blob:/.test(path) ? path : '');
  if (!src) { box.classList.add('att-loading'); return false; }
  if (voice?.path === path) { if (voice.audio.paused) voice.audio.play(); else voice.audio.pause(); return true; }
  voice?.audio.pause();
  const a = new Audio(src); voice = { path, audio: a, box };
  const paint = () => {
    const b = root.querySelector(`.att-audio[data-voice="${CSS.escape(path)}"]`) || box;
    const playing = !a.paused, pct = a.duration ? (a.currentTime / a.duration) * 100 : 0;
    const btn = b.querySelector('.vn-play'); if (btn) btn.innerHTML = icon(playing ? 'pause' : 'play', 16);
    b.style.setProperty('--vp', `${pct}%`); b.classList.toggle('is-playing', playing);
    const t = b.querySelector('.vn-time'); if (t && a.duration && Number.isFinite(a.duration)) t.textContent = fmt(playing || a.currentTime ? a.currentTime : a.duration);
  };
  a.addEventListener('timeupdate', paint); a.addEventListener('play', paint); a.addEventListener('pause', paint);
  a.addEventListener('ended', () => { a.currentTime = 0; paint(); });
  a.play().catch(() => {});
  return true;
}
export function stopVoice() { voice?.audio.pause(); voice = null; }

/** Barra encima del cuadro de texto: foto lista, nota de voz lista o grabando. */
export function composeExtras(kind, id) {
  const k = isRecording(kind, id), p = pendingFor(kind, id);
  if (k) return `<div class="att-pending recording"><span class="rec-dot" aria-hidden="true"></span><b>${e(translate('Grabando'))}</b><span class="rec-time">${fmt(recordingSeconds())}</span><span class="grow muted tiny">${e(translate('Máximo 2 minutos'))}</span>
    <button type="button" class="btn btn-ghost btn-sm btn-icon" data-action="voice-cancel" data-kind="${e(kind)}" data-id="${e(id)}" aria-label="${e(translate('Cancelar grabación'))}">${icon('trash-2', 15)}</button>
    <button type="button" class="btn btn-primary btn-sm" data-action="voice-stop" data-kind="${e(kind)}" data-id="${e(id)}">${icon('send', 14)} ${e(translate('Enviar'))}</button></div>`;
  if (!p) return '';
  return `<div class="att-pending">${p.type === 'image' ? `<img src="${e(p.url)}" alt="">` : `<span class="att-ic">${icon('mic', 16)}</span>`}<span class="grow"><b>${e(translate(p.type === 'image' ? 'Foto lista' : 'Nota de voz lista'))}</b><small class="muted"> ${e(p.type === 'audio' ? fmt(p.meta.duration) : translate('Puedes escribir un comentario'))}</small></span>
    <button type="button" class="btn btn-ghost btn-sm btn-icon" data-action="att-clear" data-kind="${e(kind)}" data-id="${e(id)}" aria-label="${e(translate('Quitar adjunto'))}">${icon('x', 15)}</button></div>`;
}
