// Reproductor de música del squad: barra fija que sigue sonando al cambiar de pantalla.
// Dos motores:
//  · Canción COMPLETA con YouTube (video oficial; YouTube exige que el video se vea mientras suena).
//  · Adelanto de 30 s de iTunes cuando la canción no tiene video.
// Pausa, anterior/siguiente, barra de avance, volumen y silencio, y controles de pantalla bloqueada (Media Session).
import { e, icon } from './ui.js';
import { translate } from './i18n/index.js';

const VOL_KEY = 'gvq:volume';
let queue = [], index = -1, bar = null, listeners = new Set(), resolver = null, poll = null, loadingId = null;
let volume = (() => { try { const raw = localStorage.getItem(VOL_KEY); const v = Number(raw); return raw !== null && v >= 0 && v <= 1 ? v : 0.8; } catch { return 0.8; } })();
let muted = false;
const COMPACT_KEY = 'gvq:playerCompact';
let compact = (() => { try { return localStorage.getItem(COMPACT_KEY) === '1'; } catch { return false; } })();
const t = s => translate(s);
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* nada */ } });
const current = () => queue[index] || null;
const playable = x => Boolean(x?.youtube_id || x?.preview_url);

// ═════ Motor 1: adelanto (etiqueta <audio>) ═════
let audio = null;
const audioEngine = {
  load(tr) {
    if (!audio) {
      audio = new Audio(); audio.preload = 'auto';
      audio.addEventListener('timeupdate', paintTime); audio.addEventListener('loadedmetadata', paintTime);
      audio.addEventListener('play', () => { paint(); emit(); }); audio.addEventListener('pause', () => { paint(); emit(); });
      audio.addEventListener('ended', next);
      audio.addEventListener('error', () => { if (engine === audioEngine) next(); });
    }
    audio.src = tr.preview_url; audio.currentTime = 0; this.volume(); audio.play().catch(() => { paint(); emit(); });
  },
  play() { audio?.play().catch(() => {}); }, pause() { audio?.pause(); },
  playing: () => Boolean(audio && !audio.paused), time: () => audio?.currentTime || 0,
  duration: () => (audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30),
  seek(s) { if (audio) audio.currentTime = s; },
  volume() { if (audio) { audio.volume = volume; audio.muted = muted || volume === 0; } },
  stop() { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } }
};

// ═════ Motor 2: YouTube (canción completa) ═════
let yt = null, ytReady = null, ytState = -1;
function loadYouTubeApi() {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve, reject) => {
    if (window.YT?.Player) { resolve(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { ytReady = null; reject(new Error('No se pudo cargar YouTube')); };
    document.head.append(s);
    setTimeout(() => reject(new Error('YouTube tardó demasiado')), 12000);
  });
  return ytReady;
}
const ytEngine = {
  async load(tr) {
    const YT = await loadYouTubeApi();
    const host = bar?.querySelector('.pl-video-host'); if (!host) return;
    if (yt && !host.contains(yt.getIframe?.())) { try { yt.destroy(); } catch { /* nada */ } yt = null; }
    if (!yt) {
      const div = document.createElement('div'); host.replaceChildren(div);
      await new Promise(resolve => {
        yt = new YT.Player(div, {
          videoId: tr.youtube_id, width: '100%', height: '100%',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, controls: 0, disablekb: 1, origin: location.origin },
          events: {
            onReady: () => { this.volume(); try { yt.playVideo(); } catch { /* nada */ } resolve(); },
            onStateChange: ev => { ytState = ev.data; if (ev.data === 0) next(); paint(); emit(); },
            onError: () => { if (engine === ytEngine) fallbackToPreview(); }
          }
        });
      });
    } else { yt.loadVideoById(tr.youtube_id); this.volume(); }
  },
  play() { try { yt?.playVideo(); } catch { /* nada */ } }, pause() { try { yt?.pauseVideo(); } catch { /* nada */ } },
  playing: () => ytState === 1 || ytState === 3,
  time: () => { try { return yt?.getCurrentTime?.() || 0; } catch { return 0; } },
  duration: () => { try { return yt?.getDuration?.() || 0; } catch { return 0; } },
  seek(s) { try { yt?.seekTo(s, true); } catch { /* nada */ } },
  volume() { try { yt?.setVolume(Math.round(volume * 100)); if (muted || volume === 0) yt?.mute(); else yt?.unMute(); } catch { /* nada */ } },
  stop() { try { yt?.stopVideo(); yt?.destroy(); } catch { /* nada */ } yt = null; ytState = -1; }
};
let engine = null;
function fallbackToPreview() {
  const tr = current(); if (!tr) return;
  if (tr.preview_url) { tr._ytFailed = true; switchEngine(audioEngine); audioEngine.load(tr); }
  else { tr._ytFailed = true; next(); }
}
function switchEngine(eng) {
  if (engine && engine !== eng) engine.stop();
  engine = eng; render();
}

// ═════ API pública ═════
export const currentId = () => (engine?.playing() ? current()?.id : null);
export const loadedId = () => current()?.id || null;
export const loadingTrack = () => loadingId;
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
/** Función que busca el video de YouTube de una canción (la pone main.js). Devuelve el id o null. */
export const setResolver = fn => { resolver = fn; };
let missing = null;
/** Aviso cuando una canción no tiene ni video ni adelanto. */
export const onMissing = fn => { missing = fn; };

export function play(track, list = [track]) {
  queue = list.filter(playable); if (!queue.some(x => x.id === track.id)) queue.unshift(track);
  index = Math.max(0, queue.findIndex(x => x.id === track.id));
  go(index);
  return true;
}
async function go(i) {
  index = i; const tr = current(); if (!tr) return;
  if (!tr.youtube_id && !tr._ytTried && resolver) {
    tr._ytTried = true; loadingId = tr.id; render(); emit();
    try { const vid = await resolver(tr); if (vid) tr.youtube_id = vid; } catch { /* sin video: adelanto */ }
    loadingId = null; if (current() !== tr) return;
  }
  // «Solo adelanto»: sin ventana de YouTube cuando la canción tiene adelanto de 30 s.
  if (tr.youtube_id && !tr._ytFailed && !(compact && tr.preview_url)) {
    switchEngine(ytEngine);
    try { await ytEngine.load(tr); } catch { fallbackToPreview(); }
  } else if (tr.preview_url) { switchEngine(audioEngine); audioEngine.load(tr); }
  else { emit(); missing?.(tr); if (index < queue.length - 1) next(); else stop(); return; }
  if (!poll) poll = setInterval(paintTime, 500);
  session(); emit();
}
function next() { if (index < queue.length - 1) go(index + 1); else { paint(); emit(); } }
export function toggle(id) {
  if (id && loadedId() !== id) return false;
  if (!engine || !current()) return false;
  if (engine.playing()) engine.pause(); else engine.play();
  setTimeout(() => { paint(); emit(); }, 120);
  return true;
}
export function stop() {
  engine?.stop(); engine = null; queue = []; index = -1; loadingId = null;
  clearInterval(poll); poll = null; bar?.remove(); bar = null; document.body.classList.remove('has-player');
  try { navigator.mediaSession.metadata = null; } catch { /* nada */ }
  emit();
}
/** Ocultar/mostrar la ventana de YouTube. Oculta → suena el adelanto de 30 s (lo que YouTube permite sin ventana). */
export function setCompact(on) {
  compact = Boolean(on); try { localStorage.setItem(COMPACT_KEY, compact ? '1' : '0'); } catch { /* nada */ }
  const tr = current(); if (tr) go(index); else emit();
}
export const isCompact = () => compact;
export const getVolume = () => (muted ? 0 : volume);
export function setVolume(v) { volume = Math.min(1, Math.max(0, Number(v) || 0)); muted = false; engine?.volume(); saveVolume(); paint(); syncPage(); }
export function toggleMute() { if (volume === 0) { volume = 0.6; muted = false; } else muted = !muted; engine?.volume(); saveVolume(); paint(); syncPage(); }
export const refreshPageControls = () => syncPage();
function saveVolume() { try { localStorage.setItem(VOL_KEY, String(volume)); } catch { /* nada */ } }

/** Controles de volumen dentro de la página (por ejemplo, en «Sonando en el squad»). */
function syncPage() {
  const v = muted ? 0 : volume;
  document.querySelectorAll('input[data-pvol]').forEach(inp => { if (document.activeElement !== inp) inp.value = String(v); inp.style.setProperty('--p', `${v * 100}%`); });
  document.querySelectorAll('[data-pmute]').forEach(b => { b.innerHTML = icon(v === 0 ? 'volume-x' : 'volume-2', 17); b.setAttribute('aria-pressed', String(v === 0)); });
  document.querySelectorAll('[data-pvol-label]').forEach(l => { l.textContent = `${Math.round(v * 100)}%`; });
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', ev => { if (ev.target.matches?.('input[data-pvol]')) setVolume(ev.target.value); });
  document.addEventListener('click', ev => { if (ev.target.closest?.('[data-pmute]')) toggleMute(); });
}

// ═════ Barra ═════
function render() {
  const tr = current(); if (!tr) return;
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'gvq-player'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', t('Reproductor de música'));
    // La ventana de YouTube va como portada cuadrada (200 × 200, el mínimo que pide YouTube) en la esquina del reproductor.
    bar.innerHTML = `<div class="pl-video" aria-label="${e(t('Reproductor de YouTube'))}"><div class="pl-video-host"></div></div><div class="pl-ui"></div>`;
    document.body.append(bar); document.body.classList.add('has-player');
    bar.addEventListener('click', onClick); bar.addEventListener('input', onInput);
  }
  const full = engine === ytEngine;
  bar.classList.toggle('is-full', full);
  const art = tr.artwork_url ? `<img src="${e(tr.artwork_url)}" alt="" referrerpolicy="no-referrer">` : icon('disc-3', 22);
  const note = loadingId === tr.id ? t('Buscando la canción completa…') : full ? t('Canción completa · YouTube') : compact && tr.youtube_id ? t('Adelanto de 30 s · toca 👁 para escucharla completa') : t('Adelanto de 30 s');
  bar.querySelector('.pl-ui').innerHTML = `
    <div class="pl-track"><span class="pl-art">${art}</span><span class="pl-meta"><b>${e(tr.title)}</b><small>${e(tr.artist)}</small></span></div>
    <div class="pl-main">
      <div class="pl-ctrls">
        <button type="button" class="pl-btn" data-p="prev" aria-label="${e(t('Anterior'))}" ${index > 0 ? '' : 'disabled'}>${icon('skip-back', 17)}</button>
        <button type="button" class="pl-btn pl-play" data-p="toggle" aria-label="${e(t('Reproducir'))}">${icon('play', 20)}</button>
        <button type="button" class="pl-btn" data-p="next" aria-label="${e(t('Siguiente'))}" ${index < queue.length - 1 ? '' : 'disabled'}>${icon('skip-forward', 17)}</button>
      </div>
      <div class="pl-seek"><span class="pl-cur">0:00</span><input type="range" class="pl-range" data-p="seek" min="0" max="30" step="0.5" value="0" aria-label="${e(t('Avance de la canción'))}"><span class="pl-dur">0:00</span></div>
    </div>
    <div class="pl-side">
      <button type="button" class="pl-btn" data-p="mute" aria-label="${e(t('Silenciar'))}">${icon('volume-2', 17)}</button>
      <span class="pl-volwrap"><input type="range" class="pl-range pl-vol" data-p="volume" min="0" max="1" step="0.01" value="${volume}" aria-label="${e(t('Volumen'))}"></span>
      ${tr.youtube_id && tr.preview_url ? `<button type="button" class="pl-btn pl-mode" data-p="mode" aria-pressed="${compact}" title="${e(t(compact ? 'Escuchar completa (muestra la portada de YouTube)' : 'Ocultar reproductor de YouTube (suena el adelanto de 30 s)'))}" aria-label="${e(t(compact ? 'Escuchar completa' : 'Ocultar reproductor de YouTube'))}">${icon(compact ? 'eye' : 'eye-off', 17)}</button>` : ''}
      <button type="button" class="pl-btn" data-p="close" aria-label="${e(t('Cerrar reproductor'))}">${icon('x', 17)}</button>
    </div>
    <span class="pl-note ${full ? 'full' : ''}">${e(note)}</span>`;
  paint(); paintTime();
}
function paint() {
  if (!bar) return;
  const playing = Boolean(engine?.playing());
  const b = bar.querySelector('.pl-play'); if (b) { b.innerHTML = loadingId ? icon('loader', 18, 'spin') : icon(playing ? 'pause' : 'play', 20); b.setAttribute('aria-label', t(playing ? 'Pausar' : 'Reproducir')); }
  const m = bar.querySelector('[data-p="mute"]'); if (m) { const off = muted || volume === 0; m.innerHTML = icon(off ? 'volume-x' : 'volume-2', 17); m.setAttribute('aria-label', t(off ? 'Activar sonido' : 'Silenciar')); m.setAttribute('aria-pressed', String(off)); }
  const v = bar.querySelector('.pl-vol'); if (v) { v.value = muted ? 0 : volume; v.style.setProperty('--p', `${(muted ? 0 : volume) * 100}%`); }
  bar.classList.toggle('is-playing', playing);
  try { navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'; } catch { /* nada */ }
}
function paintTime() {
  if (!bar || !engine) return;
  const dur = engine.duration() || 0, cur = engine.time();
  const r = bar.querySelector('[data-p="seek"]');
  if (r && document.activeElement !== r) { r.max = String(dur || 1); r.value = String(cur); }
  if (r) r.style.setProperty('--p', `${dur ? Math.min(100, (cur / dur) * 100) : 0}%`);
  const c = bar.querySelector('.pl-cur'); if (c) c.textContent = fmt(cur);
  const d = bar.querySelector('.pl-dur'); if (d) d.textContent = fmt(dur);
  if (engine === ytEngine) paint();
}
function onClick(ev) {
  const p = ev.target.closest('[data-p]')?.dataset.p; if (!p) return;
  if (p === 'toggle') toggle();
  else if (p === 'prev' && index > 0) go(index - 1);
  else if (p === 'next' && index < queue.length - 1) go(index + 1);
  else if (p === 'close') stop();
  else if (p === 'mute') toggleMute();
  else if (p === 'mode') setCompact(!compact);
}
function onInput(ev) {
  const p = ev.target.dataset.p;
  if (p === 'seek' && engine) { engine.seek(Number(ev.target.value)); paintTime(); }
  if (p === 'volume') setVolume(ev.target.value);
}

// ═════ Controles del sistema (pantalla bloqueada, audífonos, teclado multimedia) ═════
function session() {
  const tr = current(); if (!tr || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: tr.title, artist: tr.artist, album: 'GAMVORAQ · squad', artwork: tr.artwork_url ? [{ src: tr.artwork_url, sizes: '600x600' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.setActionHandler('play', () => engine?.play());
    navigator.mediaSession.setActionHandler('pause', () => engine?.pause());
    navigator.mediaSession.setActionHandler('previoustrack', index > 0 ? () => go(index - 1) : null);
    navigator.mediaSession.setActionHandler('nexttrack', index < queue.length - 1 ? () => go(index + 1) : null);
    navigator.mediaSession.setActionHandler('seekto', d => { if (Number.isFinite(d.seekTime)) engine?.seek(d.seekTime); });
  } catch { /* navegador sin Media Session */ }
}
