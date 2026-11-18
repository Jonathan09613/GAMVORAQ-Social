// Marco de la aplicación: barra lateral, barra superior, navegación móvil, paleta de comandos y panel de ajustes.
import { e, icon, avatar, progress } from '../ui.js';
import { NAV, ROUTES, TITLES, SUBTITLES, state, d, me, unreadCount, pendingMemoryCount } from '../state.js';
import { unreadChats } from '../v12.js';


function badgeFor(id) {
  if (id === 'squads') return pendingMemoryCount() + (d().notifications || []).filter(n => n.user_id === state.user?.id && !n.read_at && n.kind === 'squad_message').length;
  if (id === 'messages') return unreadChats();
  if (id === 'admin') return (d().reports || []).filter(r => r.status === 'open').length;
  return 0;
}
const navBtn = (id, ic, label, cls = 'nav-btn') => {
  const n = badgeFor(id);
  return `<button class="${cls} ${state.tab === id ? 'active' : ''}" data-action="nav" data-id="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>${icon(ic, 19)}<span>${e(label)}</span>${n ? `<span class="nav-badge" aria-label="${n} pendientes">${n}</span>` : ''}</button>`;
};


export function xpChipHtml(v) {
  if (!v?.level) return '';
  return `<button class="xp-chip" data-action="vora-open" title="Tu progreso con ${e(v.name)}" aria-label="Racha de ${v.streak} días, nivel ${v.level.level}">${icon('flame', 17)}<span>${v.streak}</span><small>· Nv ${v.level.level}</small></button>`;
}
export function sideVoraHtml(v = {}) {
  return `<button class="side-vora" data-action="${v.hidden ? 'vora-show' : 'vora-open'}" aria-label="${v.hidden ? 'Llamar a VORA' : 'Hablar con VORA'}">
        <span class="sv-orb">${icon('bot', 20)}</span>
        <span class="grow"><b>${e(v.name || 'VORA')}</b><small>${v.hidden ? 'Oculto · toca para llamarlo' : v.level ? `Nivel ${v.level.level} · racha ${v.streak || 0} ${v.streak === 1 ? 'día' : 'días'}` : 'Tu compañero'}</small>${v.level ? progress(v.level.pct, 'Progreso de nivel') : ''}</span>
      </button>`;
}

export function renderShell({ page, vora, net }) {
  const user = me(), unread = unreadCount(), v = vora || {};
  return `<a class="skip-link" href="#main">Saltar al contenido</a>
<div class="shell">
  <aside class="sidebar" aria-label="Navegación principal">
    <div class="side-logo"><img src="/icons/icon-192.png" alt="" width="42" height="42"><div><div class="brand-word">GAM<b>VORAQ</b></div><small>Tu universo gamer</small></div></div>
    <nav class="side-nav">${NAV.map(([id, ic, label]) => navBtn(id, ic, label)).join('')}${state.isAdmin ? navBtn('admin', 'shield-alert', 'Moderación') : ''}
      <div class="nav-label">Acciones rápidas</div>
      <button class="nav-btn" data-action="set-available">${icon('circle-dot', 19)}<span>Estoy disponible</span></button>
      <button class="nav-btn" data-action="schedule-session">${icon('calendar-plus', 19)}<span>Agendar partida</span></button>
      <button class="nav-btn" data-action="compose">${icon('pencil', 19)}<span>Publicar</span></button></nav>
    <div class="side-foot">
      ${sideVoraHtml(v)}
      <div class="row"><button class="btn btn-soft btn-sm grow" data-action="settings">${icon('settings', 16)} Ajustes</button><button class="btn btn-ghost btn-sm" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">${icon('log-out', 16)}</button></div>
    </div>
  </aside>
  <div class="main-col">
    ${net || ''}
    <header class="topbar">
      <div class="topbar-title"><h1>${e(TITLES[state.tab] || 'Inicio')}</h1><p>${e(SUBTITLES[state.tab] || '')}</p></div>
      <div class="topbar-tools">
        ${xpChipHtml(v)}
        <button class="cmd-btn" data-action="palette" aria-label="Buscar y ejecutar comandos">${icon('search', 17)}<span>Buscar…</span><span class="kbd">Ctrl K</span></button>
        <button class="tool-btn" data-action="nav" data-id="notifications" aria-label="Notificaciones${unread ? ': ' + unread + ' sin leer' : ''}">${icon('bell', 19)}${unread ? `<span class="tool-badge">${unread > 9 ? '9+' : unread}</span>` : ''}</button>
        <button class="me-btn" data-action="nav" data-id="profile" aria-label="Mi perfil">${avatar(user, 'sm')}<span class="me-name">${e(user.display_name)}</span></button>
      </div>
    </header>
    <main id="main" class="page" tabindex="-1">${page}</main>
  </div>
  <nav class="bottom-nav" aria-label="Navegación móvil">${NAV.filter(([id]) => id !== 'profile').map(([id, ic, label]) => navBtn(id, ic, label, 'bn-btn')).join('')}</nav>
</div>`;
}

export function netBar({ online, pending, updateReady, stale, syncing, installOffer, platform }) {
  if (updateReady) return `<div class="net-bar info" role="status">${icon('refresh-cw', 16)}<span>Hay una versión nueva de GAMVORAQ lista.</span><button class="btn btn-primary btn-sm" data-action="apply-update">Actualizar ahora</button></div>`;
  if (!online) return `<div class="net-bar" role="status">${icon('wifi-off', 16)}<span><b>Sin conexión.</b> ${stale ? 'Estás viendo tu última sesión guardada, en modo lectura.' : 'Algunas funciones no están disponibles.'}${pending ? ` ${pending} ${pending === 1 ? 'envío' : 'envíos'} en espera.` : ' Puedes escribir mensajes y se enviarán al reconectar.'}</span></div>`;
  if (syncing) return `<div class="net-bar ok" role="status">${icon('refresh-cw', 16)}<span>Volviste a estar en línea. Enviando ${pending} pendiente${pending === 1 ? '' : 's'}…</span></div>`;
  if (pending) return `<div class="net-bar info" role="status">${icon('clock', 16)}<span>${pending} envío${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}.</span><button class="btn btn-soft btn-sm" data-action="flush">Enviar ahora</button></div>`;
  if (installOffer) return `<div class="net-bar install" role="region" aria-label="Instalar GAMVORAQ">${icon(platform?.mobile ? 'smartphone' : 'monitor', 16)}<span><b>Lleva GAMVORAQ como app.</b><small> Pantalla completa, avisos de tu squad y funciona sin conexión.</small></span><button class="btn btn-primary btn-sm" data-action="install">Instalar</button><button class="btn btn-ghost btn-sm" data-action="install-later">Ahora no</button></div>`;
  return '';
}

/** Paleta de comandos (Ctrl/⌘ + K). Los elementos se filtran por texto sin acentos. */
export function paletteItems() {
  const nav = ROUTES.map(([id, ic, label]) => ({ id: 'nav:' + id, ic, label: `Ir a ${label}`, hint: SUBTITLES[id] || '', group: 'Ir a' }));
  const act = [
    { id: 'do:set-available', ic: 'circle-dot', label: 'Marcarme disponible para jugar', group: 'Acciones' },
    { id: 'do:schedule-session', ic: 'calendar-plus', label: 'Agendar una partida', group: 'Acciones' },
    { id: 'do:compose', ic: 'pencil', label: 'Crear una publicación', group: 'Acciones' },
    { id: 'do:open-dms', ic: 'messages-square', label: 'Abrir mis mensajes', group: 'Acciones' },
    { id: 'do:new-chat', ic: 'message-circle-plus', label: 'Escribirle a alguien (nuevo chat)', hint: 'dm privado', group: 'Acciones' },
    { id: 'do:edit-profile', ic: 'languages', label: 'Cambiar mi idioma o perfil', group: 'Acciones' },
    { id: 'do:vora', ic: 'bot', label: 'Hablar con VORA', group: 'Acciones' },
    { id: 'do:session', ic: 'timer', label: 'Empezar una sesión «Juntos» con VORA', group: 'Acciones' },
    { id: 'do:settings', ic: 'settings', label: 'Abrir ajustes y apariencia', group: 'Acciones' },
    { id: 'do:install', ic: 'download', label: 'Instalar GAMVORAQ en este dispositivo', hint: 'app teléfono pwa descargar', group: 'Acciones' },
    { id: 'do:logout', ic: 'log-out', label: 'Cerrar sesión', group: 'Acciones' }
  ];
  return [...act, ...nav];
}
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function filterPalette(q) { const t = fold(q).trim(); return paletteItems().filter(i => !t || fold(i.label + ' ' + (i.hint || '')).includes(t)).slice(0, 14); }
export function paletteHtml(q = '', sel = 0) {
  const items = filterPalette(q); let last = '';
  return `<div class="cmdk-back" data-action="close-palette"><div class="cmdk" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
    <div class="cmdk-input">${icon('search', 18)}<input id="cmdk-q" value="${e(q)}" placeholder="¿A dónde quieres ir o qué quieres hacer?" autocomplete="off" aria-label="Buscar comando" role="combobox" aria-expanded="true" aria-controls="cmdk-list"><span class="kbd">Esc</span></div>
    <div class="cmdk-list" id="cmdk-list" role="listbox">${items.map((it, i) => { const g = it.group !== last ? `<div class="cmdk-group">${it.group}</div>` : ''; last = it.group; return `${g}<button role="option" aria-selected="${i === sel}" class="cmdk-item ${i === sel ? 'on' : ''}" data-action="palette-run" data-id="${e(it.id)}">${icon(it.ic, 18)}<span>${e(it.label)}</span></button>`; }).join('') || '<p class="muted small" style="padding:18px">No hay coincidencias.</p>'}</div></div></div>`;
}
