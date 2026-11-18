// GAMVORAQ v12: módulo de Mensajes, música y encuestas del squad, panel de moderación, reportes de cualquier cosa,
// radar de ofertas/juegos gratis, diagnóstico del servidor y mensajes de error que explican qué pasa.
// Todo lo importante lo hace cumplir el servidor (migración 007); aquí se decide qué mostrar y se llaman las acciones.
import { e, icon, avatar, ago, chip, btn, empty, safeUrl, hueFor } from './ui.js';
import { state, d, getProfile, byDate, isBlocked, member, staff } from './state.js';
import { pageIntro, seg, messageBubble, chatForm, langHint } from './views/components.js';
import { unreadIn, seenUpTo, isSquadStaff, needsAge, ageGateCard, groupArt } from './v11.js';
import { listenLinks } from './apis.js';
import { availabilityActive } from './features.js';

const asc = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
const meId = () => state.user?.id;
const missing = t => (d()._missing || []).includes(t);

// ═════════════════════ Errores que se entienden ═════════════════════
const TABLE_HINT = {
  squads: 'No se pudo crear o editar el squad. Ejecuta la migración 008 en Supabase.',
  squad_members: 'No se pudo cambiar a los integrantes del squad.',
  play_sessions: 'No puedes agendar en este squad: el dueño solo permite agendar a admins (se cambia en «Editar squad»).',
  quests: 'No se pudo crear el reto. Ejecuta la migración 008 en Supabase.',
  conversations: 'No puedes iniciar este chat (edad sin registrar, rango de edad distinto o bloqueo).',
  direct_messages: 'No puedes escribir en este chat (edad sin registrar, rango de edad distinto o bloqueo).',
  follows: 'No puedes seguir a esta persona (protección de menores o bloqueo).',
  reports: 'No se pudo enviar el reporte.',
  squad_tracks: 'Solo integrantes del squad pueden compartir canciones.',
  squad_polls: 'Solo integrantes del squad pueden crear encuestas.'
};
/** Convierte errores técnicos del servidor en explicaciones claras (o null si no aplica). */
export function explainError(err) {
  const m = `${err?.code || ''} ${err?.message || ''} ${err?.details || ''}`;
  if (/permission denied for (function|schema)/i.test(m)) return 'El servidor necesita una actualización de permisos: ejecuta la migración 007 en Supabase (está en la guía de la v12).';
  if (/Could not find the function|PGRST202|function .* does not exist/i.test(m)) return 'Falta ejecutar la migración 007 en Supabase para usar esta función.';
  if (/column .* does not exist|PGRST204/i.test(m)) return 'Tu base de datos está desactualizada: ejecuta las migraciones 006 y 007 en Supabase.';
  const t = m.match(/(?:row-level security policy for table|permission denied for table) "?([a-z_]+)"?/i)?.[1];
  if (t) return TABLE_HINT[t] || `No tienes permiso para hacer eso (${t}).`;
  return null;
}
export const DM_REASON = {
  my_age: 'Primero registra tu año de nacimiento: es obligatorio para los mensajes privados.',
  their_age: 'Esa persona todavía no confirma su edad. Podrás escribirle cuando entre a la app y la registre.',
  age_band: 'Por protección de menores, un menor de edad solo puede escribirse en privado con otros menores.',
  missing: 'Esa cuenta ya no existe.',
  blocked: 'Hay un bloqueo entre ustedes.',
  suspended: 'Tu cuenta está en pausa por moderación. Podrás escribir cuando termine.',
  self: 'No puedes escribirte a ti mismo.',
  login: 'Inicia sesión para escribir.'
};

// ═════════════════════ Diagnóstico ═════════════════════
export function healthBanner() {
  const errs = d()?._errors || [];
  const loadErr = errs.length && !state.demo ? `<div class="banner warn health">${icon('database', 16)}<span><b>No se pudieron cargar algunos datos:</b> ${errs.map(x => `<code data-noi18n>${e(x.table)}</code> (${e(x.message.slice(0, 120))})`).join(', ')}. Manda captura de este aviso.</span></div>` : '';
  return loadErr + healthBanner2();
}
function healthBanner2() {
  const h = state.health; if (!h || state.demo) return '';
  if (h.v13 === false) return `<div class="banner warn health">${icon('database', 16)}<span><b>Falta actualizar el servidor.</b> Ejecuta la migración <code>008_gamvoraq_v13.sql</code> en Supabase: arregla crear squads, retos y chats.</span></div>`;
  if (h.missing) return `<div class="banner warn health">${icon('database', 16)}<span><b>Falta actualizar el servidor.</b> Ejecuta la migración <code>007_gamvoraq_v12.sql</code> en Supabase para que funcionen mensajes, squads, retos, agenda y moderación sin errores de permisos.</span></div>`;
  if (h.grants === false) return `<div class="banner warn health">${icon('key-round', 16)}<span><b>Permisos incompletos en el servidor.</b> Vuelve a ejecutar la migración 007 en Supabase.</span></div>`;
  if (h.suspended_until) return `<div class="banner warn health">${icon('ban', 16)}<span><b>Tu cuenta está en pausa</b> hasta ${e(new Date(h.suspended_until).toLocaleString())}.${h.suspend_reason ? ' Motivo: ' + e(h.suspend_reason) + '.' : ''} Puedes leer, pero no publicar ni escribir.</span></div>`;
  return '';
}

// ═════════════════════ MENSAJES ═════════════════════
const myConversations = () => (d().conversations || []).filter(c => c.user_low === meId() || c.user_high === meId());
export const peerOf = c => (c.user_low === meId() ? c.user_high : c.user_low);
const hiddenAt = c => (d().conversation_hides || []).find(h => h.conversation_id === c.id && h.user_id === meId())?.hidden_at || '';
const visibleMessages = c => { const h = hiddenAt(c); return (d().direct_messages || []).filter(m => m.conversation_id === c.id && (!h || String(m.created_at) > h)); };
const lastOf = c => visibleMessages(c).sort(byDate)[0];
/** Chats visibles: los ocultos («borrar chat») vuelven a aparecer solo si llega un mensaje nuevo. */
export function visibleConversations() {
  // Solo chats con al menos un mensaje: abrir un perfil o «Nuevo chat» sin escribir no llena la lista.
  return myConversations().filter(c => !isBlocked(peerOf(c)) && lastOf(c))
    .sort((a, b) => String(lastOf(b)?.created_at || b.created_at || '').localeCompare(String(lastOf(a)?.created_at || a.created_at || '')));
}
export const unreadChats = () => visibleConversations().filter(c => unreadIn('dm', c.id)).length;

function convRow(c, active) {
  const p = getProfile(peerOf(c)), l = lastOf(c), unread = unreadIn('dm', c.id);
  const online = availabilityActive((d().availability || []).find(a => a.user_id === p.id));
  return `<button class="conv-row ${active ? 'active' : ''} ${unread ? 'has-unread' : ''}" data-action="select-conversation" data-id="${e(c.id)}"><span class="conv-av">${avatar(p, 'md')}${online ? '<i class="online-dot" aria-label="Disponible"></i>' : ''}</span><span class="grow conv-text"><b>${e(p.display_name)}</b><span class="clamp1">${l ? (l.sender_id === meId() ? 'Tú: ' : '') + e(l.body) : 'Nuevo chat · @' + e(p.username)}</span></span><span class="dm-side">${l ? `<small class="tiny muted">${e(ago(l.created_at))}</small>` : ''}${unread ? `<span class="unread-pill">${unread}</span>` : ''}</span></button>`;
}
function seenLine(c, messages) {
  const last = [...messages].reverse().find(m => !m.pending);
  if (!last || last.sender_id !== meId()) return '';
  const seen = seenUpTo(c);
  return seen && seen >= String(last.created_at) ? `<div class="seen-line">${icon('check-check', 13)} Visto ${e(ago(seen))}</div>` : `<div class="seen-line dim">${icon('check', 13)} Enviado</div>`;
}
function composerFor(peer, c) {
  const reason = state.dmCheck?.[peer.id];
  if (reason && reason !== 'ok') return `<div class="chat-note">${icon('shield', 14)} ${e(DM_REASON[reason] || 'No puedes escribir en este chat.')}</div>`;
  return chatForm('dm', c.id, `Escribe a ${peer.display_name}…`);
}
export function viewMessages() {
  const term = (state.msgSearch || '').toLowerCase();
  const all = visibleConversations();
  // El chat que abriste (desde un perfil o «Nuevo chat») siempre aparece, aunque esté vacío o lo hubieras borrado antes.
  const opened = myConversations().find(c => c.id === state.selectedConversation);
  if (opened && !all.includes(opened)) all.unshift(opened);
  const list = term ? all.filter(c => { const p = getProfile(peerOf(c)); return (p.display_name + ' ' + p.username).toLowerCase().includes(term); }) : all;
  const active = all.find(c => c.id === state.selectedConversation) || (state.msgOpen ? null : null);
  const squads = (d().squads || []).filter(s => (d().squad_members || []).some(m => m.squad_id === s.id && m.user_id === meId()));
  const squadUnread = squads.map(s => [s, unreadIn('squad', s.id)]).filter(([, n]) => n);
  const head = pageIntro('MENSAJES', 'Tus conversaciones', 'Chats privados con traducción automática, «Visto» y borrar para ti. Nadie más puede leerlos.', btn('new-chat', `${icon('message-circle-plus', 16)} Nuevo chat`, 'btn btn-primary btn-sm'));
  const listCol = `<aside class="conv-col card"><form class="conv-search" data-form="msg-search" role="search"><label class="searchfield">${icon('search', 16)}<input class="input" name="term" value="${e(state.msgSearch || '')}" placeholder="Buscar chat" aria-label="Buscar chat"></label></form>
    ${squadUnread.length ? `<div class="conv-squads">${squadUnread.map(([s, n]) => `<button class="conv-squad" data-action="open-squad" data-id="${e(s.id)}" style="--h:${hueFor(s.name)}">${icon('users-round', 14)}<span class="clamp1">${e(s.name)}</span><span class="unread-pill">${n}</span></button>`).join('')}</div>` : ''}
    <div class="conv-list">${list.map(c => convRow(c, active?.id === c.id)).join('') || `<div class="conv-empty">${empty(term ? 'Ningún chat coincide.' : 'Aún no tienes chats. Toca «Nuevo chat» para escribirle a alguien que sigues o a tu squad.', 'message-circle', term ? '' : btn('new-chat', 'Nuevo chat', 'btn btn-primary btn-sm'))}</div>`}</div></aside>`;
  let chat;
  if (!active) chat = `<section class="card chat-card chat-empty">${empty('Elige un chat de la lista o empieza uno nuevo.', 'messages-square', btn('new-chat', `${icon('message-circle-plus', 15)} Nuevo chat`, 'btn btn-primary btn-sm'))}</section>`;
  else {
    const peer = getProfile(peerOf(active)), messages = visibleMessages(active).sort(asc);
    chat = `<section class="card chat-card"><header class="chat-head"><button class="btn btn-ghost btn-icon btn-sm chat-back" data-action="msg-back" aria-label="Volver a la lista">${icon('arrow-left', 18)}</button><button class="row link chat-peer" data-action="view-user" data-id="${e(peer.id)}">${avatar(peer, 'sm')}<span><b>${e(peer.display_name)}</b><small class="muted">@${e(peer.username)}</small></span></button>
      <div class="chat-tools">${btn('hide-chat', icon('trash-2', 16), 'btn btn-ghost btn-icon btn-sm', `data-id="${e(active.id)}" title="Borrar chat para mí" aria-label="Borrar chat para mí"`)}${btn('report', icon('flag', 16), 'btn btn-ghost btn-icon btn-sm', `data-kind="user" data-id="${e(peer.id)}" title="Reportar" aria-label="Reportar a ${e(peer.display_name)}"`)}${btn('block-user', icon('ban', 16), 'btn btn-ghost btn-icon btn-sm', `data-id="${e(peer.id)}" title="Bloquear" aria-label="Bloquear a ${e(peer.display_name)}"`)}</div></header>
      ${langHint()}<div class="chatbox" role="log" aria-live="polite">${messages.map(m => messageBubble('direct_messages', m.sender_id, m, { canDelete: m.sender_id === meId(), report: 'dm' })).join('') || empty('Envía el primer mensaje. ¡Un saludo rompe el hielo!', 'hand')}${seenLine(active, messages)}</div>${composerFor(peer, active)}</section>`;
  }
  return `<div class="msg-page ${active ? 'has-active' : ''}">${head}${healthBanner()}<div class="msg-layout ${active ? 'has-active' : ''}">${listCol}${chat}</div></div>`;
}
/** Personas para «Nuevo chat»: primero a quién sigues y quién te sigue, luego tu squad. */
export function newChatHtml() {
  const term = (state.chatSearch || '').toLowerCase();
  const close = new Set((d().follows || []).filter(f => f.follower_id === meId() || f.followed_id === meId()).flatMap(f => [f.follower_id, f.followed_id]));
  const mySquads = new Set((d().squad_members || []).filter(m => m.user_id === meId()).map(m => m.squad_id));
  (d().squad_members || []).forEach(m => { if (mySquads.has(m.squad_id)) close.add(m.user_id); });
  const people = (d().profiles || []).filter(p => p.id !== meId() && !isBlocked(p.id) && (!term || (p.display_name + ' ' + p.username).toLowerCase().includes(term)))
    .sort((a, b) => (close.has(b.id) - close.has(a.id)) || a.display_name.localeCompare(b.display_name)).slice(0, 40);
  return `<form class="search-row" data-form="chat-search" role="search"><label class="searchfield">${icon('search', 17)}<input class="input" name="term" value="${e(state.chatSearch || '')}" placeholder="Nombre o @usuario" aria-label="Buscar personas" autofocus></label><button class="btn btn-soft" type="submit">Buscar</button></form>
  <div class="member-list">${people.map(p => `<button class="member-row item-btn" data-action="open-dm" data-id="${e(p.id)}">${avatar(p, 'sm')}<span class="grow"><b>${e(p.display_name)}</b><small class="muted"> @${e(p.username)}${close.has(p.id) ? ' · cercano' : ''}</small></span>${icon('message-circle', 16)}</button>`).join('') || empty('No encontramos a nadie con ese nombre.', 'users')}</div>`;
}

// ═════════════════════ SQUAD: MÚSICA ═════════════════════
export function musicPane(s) {
  if (missing('squad_tracks')) return empty('La música del squad necesita la migración 007 en el servidor.', 'music');
  const tracks = (d().squad_tracks || []).filter(t => t.squad_id === s.id).sort(byDate);
  const likes = id => (d().track_likes || []).filter(l => l.track_id === id);
  const now = tracks[0], top = [...tracks].sort((a, b) => likes(b.id).length - likes(a.id).length).slice(0, 3).filter(t => likes(t.id).length);
  const results = state.musicResults?.squad === s.id ? state.musicResults.items : null;
  const art = (t, cls = '') => t.artwork_url ? `<img class="track-art ${cls}" src="${safeUrl(t.artwork_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="track-art ${cls} ph" style="--h:${hueFor(t.title + t.artist)}">${icon('disc-3', cls ? 34 : 20)}</span>`;
  const linkRow = t => { const L = listenLinks(t); return `<div class="row wrap listen">${`<a class="pill" href="${e(L.spotify)}" target="_blank" rel="noopener">Spotify</a><a class="pill" href="${e(L.youtube)}" target="_blank" rel="noopener">YouTube Music</a><a class="pill" href="${e(L.apple)}" target="_blank" rel="noopener">Apple Music</a>`}</div>`; };
  const row = t => { const l = likes(t.id), mine = l.some(x => x.user_id === meId()), canDel = t.user_id === meId() || isSquadStaff(s.id);
    return `<div class="track-row">${art(t)}<div class="grow"><b class="clamp1">${e(t.title)}</b><small class="muted clamp1">${e(t.artist)} · ${e(getProfile(t.user_id).display_name)} · ${e(ago(t.created_at))}</small>${t.note ? `<small class="track-note">“${e(t.note)}”</small>` : ''}</div>
      <button class="btn btn-ghost btn-icon btn-sm" data-action="track-play" data-id="${e(t.id)}" aria-label="Escuchar">${icon(state.playing === t.id ? 'pause' : 'play', 16)}</button>
      <button class="btn btn-sm ${mine ? 'btn-soft on' : 'btn-ghost'} like-btn" data-action="track-like" data-id="${e(t.id)}" aria-pressed="${mine}" aria-label="Me gusta">${icon('heart', 14)} ${l.length || ''}</button>
      ${canDel ? btn('track-delete', icon('trash-2', 14), 'btn btn-ghost btn-icon btn-sm', `data-id="${e(t.id)}" aria-label="Quitar canción"`) : ''}</div>${state.trackVideoFor === t.id ? `<form class="track-video-form" data-form="track-video" data-id="${e(t.id)}"><input class="input" name="youtube" placeholder="Pega el enlace de YouTube de «${e(t.title)}»" aria-label="Enlace de YouTube" required><button class="btn btn-primary btn-sm" type="submit">Guardar</button></form>` : ''}`; };
  return `<div class="music-pane">
    ${now ? `<section class="now-playing" style="--h:${hueFor(now.title)}">${art(now, 'lg')}<div class="grow"><span class="eyebrow">${icon('headphones', 12)} Sonando en el squad</span><h3>${e(now.title)}</h3><p>${e(now.artist)}</p><small class="muted">La compartió ${e(getProfile(now.user_id).display_name)}${now.note ? ` · “${e(now.note)}”` : ''}</small>${linkRow(now)}${true ? `<div class="np-vol">${'<button type="button" class="pl-btn" data-pmute aria-label="Silenciar">' + icon('volume-2', 17) + '</button>'}<input type="range" class="pl-range" data-pvol min="0" max="1" step="0.01" value="0.8" aria-label="Volumen de la música"><span class="muted tiny" data-pvol-label>80%</span></div>` : ''}</div><button class="btn btn-primary btn-icon np-play" data-action="track-play" data-id="${e(now.id)}" aria-label="Escuchar la canción completa">${icon(state.playing === now.id ? 'pause' : 'play', 22)}</button></section>` : ''}
    <form class="card card-pad music-form" data-form="music-search" data-id="${e(s.id)}"><b>${icon('music', 16)} Comparte lo que estás escuchando</b><p class="help tiny">Busca la canción: se escucha completa desde YouTube dentro de GAMVORAQ. También puedes escribirla a mano.</p>
      <div class="row wrap"><label class="searchfield grow">${icon('search', 16)}<input class="input" name="q" placeholder="Canción o artista" aria-label="Buscar canción" value="${e(state.musicQuery || '')}"></label><button class="btn btn-soft" type="submit">Buscar</button></div></form>
    ${results ? `<div class="card card-pad music-results">${results.length ? results.map((t, i) => `<div class="track-row">${t.artwork ? `<img class="track-art" src="${safeUrl(t.artwork)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="track-art ph">${icon('disc-3', 20)}</span>`}<div class="grow"><b class="clamp1">${e(t.title)}</b><small class="muted clamp1">${e(t.artist)}${t.album ? ' · ' + e(t.album) : ''}</small></div>${tracks.some(x => x.title === t.title && x.artist === t.artist) ? `<span class="chip ok">${icon('check', 13)} Compartida</span>` : btn('track-share', `${icon('send', 14)} Compartir`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}" data-kind="${i}"`)}</div>`).join('') : `<p class="muted small">No encontramos resultados. Escríbela a mano abajo.</p>`}</div>` : ''}
    <details class="card card-pad manual-track" ${results && !results.length ? 'open' : ''}><summary>${icon('pencil', 14)} Escribir canción a mano</summary><form data-form="track-manual" data-id="${e(s.id)}" class="grid-2 tight"><label class="field">Canción<input class="input" name="title" required maxlength="120"></label><label class="field">Artista<input class="input" name="artist" required maxlength="120"></label><label class="field" style="grid-column:1/-1">Enlace de YouTube (opcional, para escucharla completa)<input class="input" name="youtube" maxlength="200" placeholder="https://youtu.be/…"></label><label class="field" style="grid-column:1/-1">Nota (opcional)<input class="input" name="note" maxlength="200" placeholder="Para la partida de hoy 🔥"></label><button class="btn btn-primary btn-sm" type="submit">Compartir</button></form></details>
    ${top.length ? `<h4 class="pane-sub">${icon('trophy', 14)} Top del squad</h4><div class="track-list">${top.map(row).join('')}</div>` : ''}
    <h4 class="pane-sub">Playlist del squad</h4><div class="track-list">${tracks.map(row).join('') || empty('Nadie ha compartido música todavía. ¡Sé el primero!', 'music')}</div></div>`;
}

// ═════════════════════ SQUAD: ENCUESTAS ═════════════════════
export function pollsPane(s) {
  if (missing('squad_polls')) return empty('Las encuestas necesitan la migración 007 en el servidor.', 'vote');
  const polls = (d().squad_polls || []).filter(p => p.squad_id === s.id).sort(byDate);
  const card = p => {
    const votes = (d().squad_poll_votes || []).filter(v => v.poll_id === p.id), total = votes.length, mine = votes.find(v => v.user_id === meId());
    const closed = p.closes_at && new Date(p.closes_at) <= new Date(), opts = Array.isArray(p.options) ? p.options : [];
    const counts = opts.map((_, i) => votes.filter(v => v.choice === i).length), max = Math.max(0, ...counts);
    const canDel = p.creator_id === meId() || isSquadStaff(s.id);
    return `<article class="card card-pad poll-card"><div class="row between"><span class="eyebrow">${icon('vote', 12)} ${e(getProfile(p.creator_id).display_name)} · ${e(ago(p.created_at))}</span>${closed ? chip('Cerrada', 'warn') : p.closes_at ? chip('Cierra ' + new Date(p.closes_at).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })) : ''}</div>
      <h3>${e(p.question)}</h3><div class="poll-opts">${opts.map((o, i) => { const pct = total ? Math.round(counts[i] * 100 / total) : 0; return `<button class="poll-opt ${mine?.choice === i ? 'mine' : ''} ${closed && counts[i] === max && max ? 'win' : ''}" data-action="poll-vote" data-id="${e(p.id)}" data-kind="${i}" ${closed ? 'disabled' : ''} aria-pressed="${mine?.choice === i}"><span class="poll-bar" style="width:${pct}%"></span><span class="poll-label">${mine?.choice === i ? icon('circle-check', 14) : ''}${e(o)}</span><span class="poll-pct">${pct}%</span></button>`; }).join('')}</div>
      <div class="row between"><small class="muted">${total} ${total === 1 ? 'voto' : 'votos'}${mine ? ' · toca otra opción para cambiar tu voto' : ''}</small>${canDel ? btn('poll-delete', icon('trash-2', 14), 'btn btn-ghost btn-icon btn-sm', `data-id="${e(p.id)}" aria-label="Eliminar encuesta"`) : ''}</div></article>`;
  };
  return `<details class="card card-pad poll-new" ${polls.length ? '' : 'open'}><summary>${icon('plus', 14)} Nueva encuesta</summary><form data-form="poll" data-id="${e(s.id)}"><label class="field">Pregunta<input class="input" name="question" required minlength="3" maxlength="160" placeholder="¿A qué jugamos esta noche?"></label>
    <div class="grid-2 tight">${[0, 1, 2, 3].map(i => `<label class="field">Opción ${i + 1}${i < 2 ? '' : ' (opcional)'}<input class="input" name="opt${i}" maxlength="60" ${i < 2 ? 'required' : ''}></label>`).join('')}</div>
    <label class="field">Duración<select class="select" name="hours"><option value="2">2 horas</option><option value="24" selected>1 día</option><option value="72">3 días</option><option value="0">Sin límite</option></select></label><button class="btn btn-primary btn-sm" type="submit">${icon('vote', 15)} Publicar encuesta</button></form></details>
  <div class="stack">${polls.map(card).join('') || empty('Sin encuestas. Úsalas para decidir juego, hora o el nombre del squad.', 'vote')}</div>`;
}

// ═════════════════════ COMUNIDAD: INTEGRANTES ═════════════════════
const C_ROLE = { owner: 'Fundador', moderator: 'Moderador', member: 'Integrante' };
export function communityMembersPane(c) {
  const owner = c.owner_id === meId(), isStaff = staff(c.id);
  const list = (d().community_members || []).filter(m => m.community_id === c.id).sort((a, b) => ({ owner: 0, moderator: 1, member: 2 }[a.role] - { owner: 0, moderator: 1, member: 2 }[b.role]));
  const photo = isStaff ? `<div class="card card-pad photo-row">${groupArt('community', c, 'lg', `<div class="community-art lg">${icon('users', 30)}</div>`, true)}<div class="grow"><b>Foto de la comunidad</b><small class="muted">Toca la imagen para elegir una. JPG, PNG, WEBP o GIF de máximo 5 MB.</small></div>${c.avatar_url ? btn('group-photo-remove', 'Quitar foto', 'btn btn-ghost btn-sm', `data-kind="community" data-id="${e(c.id)}"`) : ''}</div>` : '';
  return `${photo}<div class="member-list">${list.map(m => { const p = getProfile(m.user_id), mine = m.user_id === meId();
    const acts = mine ? chip('Tú', 'accent') : [owner && m.role !== 'owner' ? btn('community-role', m.role === 'moderator' ? 'Quitar moderador' : 'Hacer moderador', 'btn btn-soft btn-sm', `data-id="${e(c.id)}" data-user="${e(m.user_id)}" data-kind="${m.role === 'moderator' ? 'member' : 'moderator'}"`) : '', isStaff && m.role === 'member' ? btn('community-kick', 'Sacar', 'btn btn-ghost btn-sm danger-text', `data-id="${e(c.id)}" data-user="${e(m.user_id)}"`) : ''].join('');
    return `<div class="member-row">${avatar(p, 'sm')}<button class="link grow" data-action="view-user" data-id="${e(p.id)}"><b>${e(p.display_name)}</b><small class="muted"> @${e(p.username)}</small></button>${chip(C_ROLE[m.role] || 'Integrante', m.role === 'member' ? '' : 'accent')}<div class="row wrap member-actions">${acts}</div></div>`; }).join('')}</div>
  ${owner ? `<div class="danger-zone"><b>Zona de peligro</b><p class="help">Eliminar la comunidad borra sus canales y retos. Las publicaciones quedan en el perfil de cada autor.</p>${btn('community-delete', `${icon('trash-2', 15)} Eliminar comunidad`, 'btn btn-danger btn-sm', `data-id="${e(c.id)}"`)}</div>` : ''}`;
}

// ═════════════════════ PERFIL: SEGUIDORES Y SIGUIENDO ═════════════════════
export function followPane(userId, kind) {
  const ids = kind === 'following' ? (d().follows || []).filter(f => f.follower_id === userId).map(f => f.followed_id) : (d().follows || []).filter(f => f.followed_id === userId).map(f => f.follower_id);
  return `<div class="card card-pad"><div class="member-list">${ids.map(id => { const x = getProfile(id), mine = id === meId(), fol = (d().follows || []).some(f => f.follower_id === meId() && f.followed_id === id), back = (d().follows || []).some(f => f.follower_id === id && f.followed_id === meId());
    return `<div class="member-row">${avatar(x, 'sm')}<button class="link grow" data-action="view-user" data-id="${e(id)}"><b>${e(x.display_name)}</b><small class="muted"> @${e(x.username)}${back && !mine ? ' · te sigue' : ''}</small></button>${mine ? chip('Tú', 'accent') : btn('follow', fol ? 'Siguiendo' : back ? 'Seguir también' : 'Seguir', fol ? 'btn btn-soft btn-sm' : 'btn btn-primary btn-sm', `data-id="${e(id)}"`)}</div>`; }).join('') || empty(kind === 'following' ? 'Todavía no sigue a nadie.' : 'Todavía no tiene seguidores.', 'users')}</div></div>`;
}

// ═════════════════════ RADAR: OFERTAS Y JUEGOS GRATIS ═════════════════════
export function radarCard() {
  const r = state.radar; if (!r || (!r.deals?.length && !r.free?.length)) return '';
  const tab = state.radarTab || (r.free?.length ? 'free' : 'deals');
  const items = tab === 'free' ? (r.free || []).slice(0, 6).map(g => `<a class="radar-item" href="${e(g.link)}" target="_blank" rel="noopener">${g.image ? `<img src="${safeUrl(g.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="grow"><b class="clamp1">${e(g.title)}</b><small>${g.worth ? `<s>${e(g.worth)}</s> ` : ''}<b class="free">GRATIS</b>${g.platforms.length ? ' · ' + e(g.platforms.join(', ')) : ''}</small></span>${icon('external-link', 14)}</a>`)
    : (r.deals || []).slice(0, 6).map(g => `<a class="radar-item" href="${e(g.link)}" target="_blank" rel="noopener">${g.thumb ? `<img src="${safeUrl(g.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span class="grow"><b class="clamp1">${e(g.title)}</b><small><s>US$${g.normal.toFixed(2)}</s> <b>US$${g.price.toFixed(2)}</b> <span class="chip ok">-${g.savings}%</span></small></span>${icon('external-link', 14)}</a>`);
  return `<section class="card card-pad radar"><div class="row between"><div><span class="eyebrow">${icon('badge-percent', 12)} RADAR GAMER</span><h3>${tab === 'free' ? 'Juegos gratis por tiempo limitado' : 'Ofertas de hoy en PC'}</h3></div><div class="seg mini">${btn('radar-tab', 'Gratis', tab === 'free' ? 'on' : '', 'data-id="free"')}${btn('radar-tab', 'Ofertas', tab === 'deals' ? 'on' : '', 'data-id="deals"')}</div></div><div class="radar-list">${items.join('')}</div><p class="tiny muted">Datos de GamerPower y CheapShark. Los enlaces abren la tienda oficial.</p></section>`;
}

// ═════════════════════ MODERACIÓN (administradores de la app) ═════════════════════
const KIND_LABEL = { post: 'Publicación', comment: 'Comentario', dm: 'Mensaje privado', squad_message: 'Mensaje de squad', user: 'Perfil', squad: 'Squad', community: 'Comunidad', track: 'Canción' };
const REASON_LABEL = { acoso: 'Acoso', odio: 'Odio', spam: 'Spam', contenido: 'Contenido inapropiado', otro: 'Otro' };
export function viewAdmin() {
  if (!state.isAdmin) return empty('Esta sección es solo para la administración de GAMVORAQ.', 'shield-alert');
  const tab = state.adminTab || 'reports', st = state.adminStats || {};
  const reports = (d().reports || []).slice().sort(byDate), open = reports.filter(r => r.status === 'open');
  const sus = (d().suspensions || []).filter(x => new Date(x.until) > new Date());
  const tiles = [['users', 'Personas', st.users], ['user-plus', 'Nuevas (7 días)', st.new_week], ['message-square', 'Publicaciones hoy', st.posts_day], ['messages-square', 'Mensajes hoy', st.messages_day], ['flag', 'Reportes abiertos', st.open_reports ?? open.length], ['ban', 'En pausa', st.suspended ?? sus.length]];
  const reportCard = r => {
    const who = r.reported_user_id ? getProfile(r.reported_user_id) : null, by = getProfile(r.reporter_id), kind = r.target_kind || (r.post_id ? 'post' : 'user');
    const deletable = !['user'].includes(kind) && r.status === 'open';
    return `<article class="card card-pad report-card ${r.status}"><div class="row between wrap"><div class="row">${chip(KIND_LABEL[kind] || kind, 'accent')}${chip(REASON_LABEL[r.reason] || r.reason, r.reason === 'acoso' || r.reason === 'odio' ? 'warn' : '')}<small class="muted">${e(ago(r.created_at))}</small></div>${chip(r.status === 'open' ? 'Abierto' : r.status === 'reviewed' ? `Resuelto${r.action ? ' · ' + r.action : ''}` : 'Descartado', r.status === 'open' ? 'warn' : 'ok')}</div>
      ${r.snapshot ? `<blockquote class="report-snap">${e(r.snapshot)}</blockquote>` : ''}${r.detail ? `<p class="small"><b>Detalle:</b> ${e(r.detail)}</p>` : ''}
      <p class="small muted">Reporta: ${e(by.display_name)}${who ? ` · Persona reportada: <button class="link" data-action="view-user" data-id="${e(who.id)}">${e(who.display_name)} (@${e(who.username)})</button>` : ''}</p>
      ${r.status === 'open' ? `<div class="row wrap">${deletable ? btn('admin-delete', `${icon('trash-2', 14)} Eliminar contenido`, 'btn btn-danger btn-sm', `data-id="${e(r.target_id || r.post_id)}" data-kind="${e(kind)}"`) : ''}${who ? btn('admin-suspend', `${icon('ban', 14)} Pausar 24 h`, 'btn btn-soft btn-sm', `data-id="${e(who.id)}" data-kind="24"`) + btn('admin-suspend', 'Pausar 7 días', 'btn btn-ghost btn-sm', `data-id="${e(who.id)}" data-kind="168"`) : ''}${btn('admin-resolve', `${icon('gavel', 14)} Advertir`, 'btn btn-ghost btn-sm', `data-id="${e(r.id)}" data-kind="reviewed"`)}${btn('admin-resolve', 'Descartar', 'btn btn-ghost btn-sm', `data-id="${e(r.id)}" data-kind="dismissed"`)}</div>` : ''}</article>`;
  };
  let body = '';
  if (tab === 'reports') {
    const showAll = state.adminAll; const rows = showAll ? reports : open;
    body = `<div class="row between pane-head"><p class="muted small">Los reportes guardan una copia del texto. Con 3 reportes de personas distintas en 24 h la cuenta queda en pausa automática y te llega un aviso.</p>${btn('admin-all', showAll ? 'Solo abiertos' : 'Ver todos', 'btn btn-ghost btn-sm')}</div><div class="stack">${rows.map(reportCard).join('') || empty('No hay reportes abiertos. ¡La comunidad está tranquila!', 'shield-check')}</div>`;
  } else if (tab === 'people') {
    const term = (state.adminSearch || '').toLowerCase();
    const people = (d().profiles || []).filter(p => !term || (p.display_name + ' ' + p.username).toLowerCase().includes(term)).slice(0, 40);
    body = `<form class="search-row" data-form="admin-search" role="search"><label class="searchfield">${icon('search', 17)}<input class="input" name="term" value="${e(state.adminSearch || '')}" placeholder="Buscar persona" aria-label="Buscar persona"></label><button class="btn btn-soft" type="submit">Buscar</button></form>
      <div class="member-list">${people.map(p => { const s = sus.find(x => x.user_id === p.id), n = reports.filter(r => r.reported_user_id === p.id).length; return `<div class="member-row">${avatar(p, 'sm')}<button class="link grow" data-action="view-user" data-id="${e(p.id)}"><b>${e(p.display_name)}</b><small class="muted"> @${e(p.username)}${n ? ` · ${n} reporte${n === 1 ? '' : 's'}` : ''}</small></button>${s ? chip('En pausa', 'warn') + btn('admin-unsuspend', 'Quitar pausa', 'btn btn-soft btn-sm', `data-id="${e(p.id)}"`) : p.id === meId() ? chip('Tú', 'accent') : btn('admin-suspend', 'Pausar 24 h', 'btn btn-ghost btn-sm', `data-id="${e(p.id)}" data-kind="24"`) + btn('admin-suspend', '30 días', 'btn btn-ghost btn-sm danger-text', `data-id="${e(p.id)}" data-kind="720"`)}</div>`; }).join('')}</div>`;
  } else if (tab === 'paused') {
    body = `<div class="member-list">${sus.map(x => { const p = getProfile(x.user_id); return `<div class="member-row">${avatar(p, 'sm')}<div class="grow"><b>${e(p.display_name)}</b><small class="muted"> hasta ${e(new Date(x.until).toLocaleString())}${x.reason ? ' · ' + e(x.reason) : ''}</small></div>${btn('admin-unsuspend', 'Quitar pausa', 'btn btn-soft btn-sm', `data-id="${e(x.user_id)}"`)}</div>`; }).join('') || empty('Nadie está en pausa.', 'circle-check')}</div>`;
  } else if (tab === 'words') {
    const words = (d().blocked_words || []).map(w => w.word).sort();
    body = `<p class="help">Frases que el servidor rechaza en publicaciones, comentarios, mensajes, squads y comunidades (sin importar mayúsculas ni acentos). Úsalas para amenazas y acoso; el resto se modera con reportes.</p>
      <form class="row wrap" data-form="admin-word"><input class="input grow" name="word" required minlength="2" maxlength="60" placeholder="Palabra o frase a bloquear" aria-label="Palabra o frase"><button class="btn btn-primary btn-sm" type="submit">${icon('plus', 15)} Agregar</button></form>
      <div class="word-cloud">${words.map(w => `<span class="chip">${e(w)} <button class="chip-x" data-action="admin-word-del" data-id="${e(w)}" aria-label="Quitar ${e(w)}">${icon('x', 12)}</button></span>`).join('') || '<p class="muted small">Sin palabras bloqueadas.</p>'}</div>`;
  } else {
    const log = (d().mod_log || []).slice().sort(byDate).slice(0, 80);
    const L = { delete: 'Eliminó', suspend: 'Pausó', unsuspend: 'Quitó la pausa', reviewed: 'Advirtió', dismissed: 'Descartó', auto_mute: 'Pausa automática', word_add: 'Bloqueó la frase', word_remove: 'Desbloqueó la frase' };
    body = `<div class="log-list">${log.map(x => `<div class="log-row"><small class="muted">${e(ago(x.created_at))}</small><span><b>${e(x.actor_id ? getProfile(x.actor_id).display_name : 'Sistema')}</b> ${e(L[x.action] || x.action)} ${x.target_kind && x.target_kind !== 'word' ? e(KIND_LABEL[x.target_kind] || x.target_kind) : ''} ${x.target_kind === 'user' ? e(getProfile(x.target_id).display_name) : ''}${x.detail ? ` · ${e(x.detail)}` : ''}</span></div>`).join('') || empty('Todavía no hay acciones registradas.', 'history')}</div>`;
  }
  return `${pageIntro('MODERACIÓN', 'Panel de administración', 'Mantén GAMVORAQ sin acoso: revisa reportes, pausa cuentas, bloquea frases y consulta el historial.', btn('admin-refresh', `${icon('refresh-cw', 15)} Actualizar`, 'btn btn-soft btn-sm'))}
  <div class="admin-tiles">${tiles.map(([ic, l, n]) => `<div class="card admin-tile">${icon(ic, 18)}<b>${n ?? '—'}</b><small>${e(l)}</small></div>`).join('')}</div>
  ${seg('admin-tab', [['reports', `${icon('flag', 14)} Reportes`, open.length], ['people', `${icon('users', 14)} Personas`], ['paused', `${icon('ban', 14)} En pausa`, sus.length], ['words', `${icon('list-checks', 14)} Frases bloqueadas`], ['log', `${icon('history', 14)} Historial`]], tab, 'Secciones de moderación')}${body}`;
}

// ═════════════════════ Diálogos de la v12 ═════════════════════
export function v12Modal() {
  const [name, a1, a2] = state.modal.split(':');
  if (name === 'new-chat') return ['Nuevo chat', newChatHtml()];
  if (name === 'report') {
    const L = { post: 'esta publicación', comment: 'este comentario', dm: 'este mensaje', squad_message: 'este mensaje', user: 'a esta persona', squad: 'este squad', community: 'esta comunidad', track: 'esta canción' };
    return [`Reportar ${L[a1] || ''}`, `<p class="help">El reporte es privado: la persona no sabrá quién la reportó. La moderación ve una copia del contenido aunque se borre. ${a1 === 'user' || a1 === 'dm' ? 'Si te sientes en peligro, bloquea a la persona y cuéntaselo a alguien de confianza.' : ''}</p>
      <form data-form="report-any" data-id="${e(a2)}" data-kind="${e(a1)}"><fieldset class="field"><legend>Motivo</legend><div class="reason-grid">${Object.entries(REASON_LABEL).map(([v, l], i) => `<label class="reason-opt"><input type="radio" name="reason" value="${v}" ${i === 0 ? 'checked' : ''}><span>${e(l)}</span></label>`).join('')}</div></fieldset>
      <label class="field">Detalles (opcional)<textarea class="textarea" name="detail" maxlength="1000" placeholder="¿Qué ocurrió?"></textarea></label>
      ${a1 === 'user' || a1 === 'dm' ? `<label class="switch"><input type="checkbox" name="also_block"><span class="sw"></span><span><b>Bloquear también</b><small>Deja de verte y no podrá escribirte.</small></span></label>` : ''}
      <button class="btn btn-primary" type="submit">${icon('flag', 15)} Enviar reporte</button></form>`];
  }
  if (name === 'age-gate') return ['Antes de seguir: tu edad', `<p class="help">GAMVORAQ protege a menores: adultos y menores no se escriben en privado ni comparten squads. Sin tu año de nacimiento no puedes enviar mensajes privados, crear o unirte a squads, ni pedir guías.</p>${ageGateCard('Elige tu año de nacimiento.')}<p class="help tiny">Solo se usa para saber tu rango (menor o adulto). No se muestra a nadie.</p>`];
  return null;
}
