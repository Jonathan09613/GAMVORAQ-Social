// Componentes compartidos por las vistas de la v6. Funciones puras: estado → HTML.
import { e, icon, avatar, ago, chip, btn, safeUrl, ring, empty } from '../ui.js';
import { state, d, me, getProfile, game, staff, isFollowing } from '../state.js';
import { fromLabel, LANG_NAME } from '../translate.js';
import { gameArt } from '../v11.js';
import { attachmentHtml, composeExtras, AUTO_LABELS } from '../chatmedia.js';
import { PLAY_TAG_LABEL, PLAY_TAGS, sessionState, SESSION_LABEL, going, whenLabel, availabilityActive, remainingLabel, passportLevel, topTags, rateableMates } from '../features.js';

// El traductor lo crea main.js; las vistas solo lo consultan.
let T = null;
export const useTranslator = t => { T = t; };

export const pageIntro = (eyebrow, title, text, actions = '') => `<section class="page-intro"><div><span class="eyebrow">${e(eyebrow)}</span><h2>${e(title)}</h2>${text ? `<p>${e(text)}</p>` : ''}</div>${actions ? `<div class="intro-actions">${actions}</div>` : ''}</section>`;
export const sectionHead = (title, right = '', sub = '') => `<div class="sec-head"><div><h2>${e(title)}</h2>${sub ? `<p class="sub">${e(sub)}</p>` : ''}</div>${right}</div>`;
export const searchForm = (placeholder, value = state.search) => `<form class="search-row" data-form="search" role="search"><label class="searchfield">${icon('search', 17)}<input class="input" name="term" value="${e(value)}" placeholder="${e(placeholder)}" aria-label="${e(placeholder)}"></label><button class="btn btn-primary" type="submit">Buscar</button></form>`;
export const seg = (action, items, current, label) => `<div class="seg" role="tablist" aria-label="${e(label)}">${items.map(([id, l, n]) => `<button role="tab" class="${current === id ? 'on' : ''}" data-action="${e(action)}" data-id="${e(id)}" aria-selected="${current === id}">${l}${n ? ` <span class="seg-n">${n}</span>` : ''}</button>`).join('')}</div>`;

// ───────────────────────── Traducción ─────────────────────────
/**
 * Texto de un mensaje recibido, traducido al idioma de la cuenta, con «Ver original».
 * source: tabla de origen (direct_messages, squad_messages, channel_messages, comments, posts).
 */
export function trText(source, row, mine = false) {
  const body = row.body ?? '';
  const v = T ? T.view({ source, id: row.id, body, mine, pending: row.pending }) : { mode: 'plain', text: body };
  // Siempre se ve el mensaje original; la traducción aparece debajo, en tu idioma.
  const text = `<span class="tr-body">${e(body)}</span>`;
  const meta = (inner, action = '') => `<span class="tr-meta">${inner}${action}</span>`;
  const toggle = label => `<button type="button" class="tr-link" data-action="tr-toggle" data-key="${e(v.key)}">${label}</button>`;
  switch (v.mode) {
    case 'translated': return text + `<span class="tr-block"><span class="tr-label">${icon('languages', 12)} Traducción ${e(fromLabel(v.from))}</span><span class="tr-text" lang="${e(T?.lang || '')}">${e(v.text)}</span></span>` + meta('', toggle('Ocultar traducción'));
    case 'original': return text + meta(`${icon('languages', 13)}<span>${v.from && LANG_NAME[v.from] ? `Escrito en ${e(LANG_NAME[v.from])}` : 'Otro idioma'}</span>`, toggle('Ver traducción'));
    case 'pending': return text + meta('<span class="tr-spin" aria-hidden="true"></span><span>Traduciendo…</span>');
    case 'offer': return text + meta('', `<button type="button" class="tr-link" data-action="tr-now" data-source="${e(source)}" data-id="${e(row.id)}">${icon('languages', 13)} ${v.retry ? 'Reintentar traducción' : 'Traducir'}</button>`);
    case 'unavailable': return text + meta(`${icon('languages', 13)}<span>En la demostración solo hay traducciones de ejemplo</span>`);
    default: return text;
  }
}

// ───────────────────────── Publicaciones ─────────────────────────
export function postCard(p) {
  const author = getProfile(p.author_id), mine = p.author_id === state.user.id;
  const community = d().communities.find(c => c.id === p.community_id);
  const images = d().post_images.filter(x => x.post_id === p.id);
  const likes = d().post_reactions.filter(x => x.post_id === p.id);
  const comments = d().comments.filter(x => x.post_id === p.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const reactions = [['gg', 'sparkles', 'GG'], ['ayuda', 'heart', 'Apoyo'], ['increible', 'zap', 'Épico']];
  const canDelete = mine || (community && staff(community.id));
  const open = state.filter === 'comments:' + p.id;
  return `<article class="card post ${p.pending ? 'is-pending' : ''}" aria-label="Publicación de ${e(author.display_name)}">
    <header class="post-head">${avatar(author)}<div class="grow"><button class="link post-author" data-action="view-user" data-id="${e(author.id)}">${e(author.display_name)}</button><div class="byline">@${e(author.username)} · ${p.pending ? 'enviando al reconectar…' : e(ago(p.created_at))}</div></div>${community ? `<button class="chip chip-btn" data-action="view-community" data-id="${e(community.id)}">${e(community.name)}</button>` : ''}
      ${canDelete && !p.pending ? btn('delete-post', icon('trash-2', 15), 'btn btn-ghost btn-sm btn-icon', `data-id="${e(p.id)}" title="Eliminar" aria-label="Eliminar publicación"`) : ''}${!p.pending && !mine ? btn('report', icon('flag', 15), 'btn btn-ghost btn-sm btn-icon', `data-kind="post" data-id="${e(p.id)}" title="Reportar" aria-label="Reportar publicación"`) : ''}</header>
    <div class="post-body">${trText('posts', p, mine)}</div>
    ${images.map(i => `<img class="post-photo" src="${safeUrl(i.url)}" alt="Imagen de la publicación" loading="lazy">`).join('')}
    ${p.pending ? '' : `<footer class="post-actions">${reactions.map(([kind, ic, label]) => {
      const n = likes.filter(l => l.kind === kind).length, on = likes.some(l => l.user_id === state.user.id && l.kind === kind);
      return btn('react', `${icon(ic, 15)}<span>${n}</span>`, `btn btn-sm react ${on ? 'on' : ''}`, `data-id="${e(p.id)}" data-kind="${kind}" title="${label}" aria-label="${label}: ${n}" aria-pressed="${on}"`);
    }).join('')}${btn('toggle-comments', `${icon('message-circle', 15)}<span>${comments.length}</span>`, 'btn btn-sm btn-ghost', `data-id="${e(p.id)}" aria-label="${comments.length} comentarios" aria-expanded="${open}"`)}</footer>`}
    ${open ? `<div class="comment-list">${comments.map(c => `<div class="comment-item ${c.pending ? 'is-pending' : ''}">${avatar(getProfile(c.author_id), 'xs')}<div class="grow"><b>${e(getProfile(c.author_id).display_name)}</b><span>${trText('comments', c, c.author_id === state.user.id)}</span></div>${c.pending ? '' : c.author_id === state.user.id || (community && staff(community.id)) ? btn('delete-comment', icon('trash-2', 13), 'btn btn-ghost btn-icon btn-sm', `data-id="${e(c.id)}" aria-label="Borrar comentario"`) : btn('report', icon('flag', 13), 'btn btn-ghost btn-icon btn-sm', `data-kind="comment" data-id="${e(c.id)}" aria-label="Reportar comentario"`)}</div>`).join('') || '<p class="muted small">Sin comentarios. ¡Sé la primera persona!</p>'}
      <form data-form="comment" data-id="${e(p.id)}" class="inline-form"><input class="input" name="body" maxlength="1200" placeholder="Escribe algo positivo…" required aria-label="Comentario"><button class="btn btn-primary btn-icon" type="submit" aria-label="Enviar comentario">${icon('send', 16)}</button></form></div>` : ''}
  </article>`;
}
export const composer = (communityId = '') => `<div class="card composer">${avatar(me(), 'sm')}<button class="text-composer" data-action="compose" ${communityId ? `data-id="${e(communityId)}"` : ''}>¿Qué está pasando en tu mundo gamer?</button>${btn('compose', icon('image-plus', 18), 'btn btn-soft btn-icon', `aria-label="Añadir foto" ${communityId ? `data-id="${e(communityId)}"` : ''}`)}</div>`;

// ───────────────────────── Chat ─────────────────────────
/** Burbuja de chat. source = tabla de mensajes para la traducción. */
export function messageBubble(source, userId, m = {}, opts = {}) {
  const mine = userId === state.user.id, p = getProfile(userId);
  const del = (opts.canDelete && !m.pending && m.id ? `<button type="button" class="bubble-del" data-action="delete-message" data-kind="${e(source)}" data-id="${e(m.id)}" title="Borrar mensaje" aria-label="Borrar mensaje">${icon('trash-2', 13)}</button>` : '')
    + (opts.report && !mine && m.id && !m.pending ? `<button type="button" class="bubble-del" data-action="report" data-kind="${e(opts.report)}" data-id="${e(m.id)}" title="Reportar mensaje" aria-label="Reportar mensaje">${icon('flag', 13)}</button>` : '');
  return `<div class="bubble-row ${mine ? 'mine' : ''}">${mine ? '' : avatar(p, 'xs')}<div class="bubble ${mine ? 'mine' : ''} ${m.pending ? 'is-pending' : ''}"><div class="byline">${mine ? 'Tú' : e(p.display_name)}${m.created_at ? ' · ' + e(m.pending ? 'pendiente' : ago(m.created_at)) : ''}${del}</div>${attachmentHtml(m)}${m.attachment_type && AUTO_LABELS.has(m.body) ? '' : trText(source, m, mine)}</div></div>`;
}
export function chatForm(kind, id, placeholder = 'Escribe un mensaje respetuoso…') {
  // Mensajes privados y de squad: también fotos y notas de voz.
  const media = kind === 'dm' || kind === 'squad-message', mk = kind === 'dm' ? 'dm' : 'squad';
  const tools = media ? `<label class="btn btn-ghost btn-icon att-btn" title="Enviar foto">${icon('image-plus', 18)}<input type="file" accept="image/*" class="sr-only" data-chat-file data-kind="${mk}" data-id="${e(id)}" aria-label="Enviar foto"></label><button type="button" class="btn btn-ghost btn-icon att-btn" data-action="voice-rec" data-kind="${mk}" data-id="${e(id)}" aria-label="Grabar nota de voz" title="Grabar nota de voz">${icon('mic', 18)}</button>` : '';
  return `<form class="chat-compose ${media ? 'has-media' : ''}" data-form="${e(kind)}" data-id="${e(id)}">${media ? `<div class="att-slot" data-att-slot="${mk}:${e(id)}">${composeExtras(mk, id)}</div>` : ''}${tools}<input class="input" name="body" maxlength="2000" ${media ? '' : 'required'} placeholder="${e(placeholder)}" aria-label="Mensaje" autocomplete="off"><button class="btn btn-primary btn-icon" type="submit" aria-label="Enviar">${icon('send', 17)}</button></form>`;
}
/** Aviso discreto sobre el idioma de la conversación. */
export function langHint() {
  if (!T) return '';
  const name = LANG_NAME[T.lang] || 'tu idioma';
  if (T.disabled) return `<div class="tr-hint warn">${icon('languages', 14)}<span>${e(T.disabled)}</span></div>`;
  return `<div class="tr-hint">${icon('languages', 14)}<span>${T.auto ? `Mensajes en otros idiomas: verás el original y su traducción al ${e(name)}.` : 'Traducción automática apagada: toca «Traducir» en cada mensaje.'}</span>${btn('settings', 'Cambiar', 'tr-link')}</div>`;
}

// ───────────────────────── Personas ─────────────────────────
export const tagChips = (tags = [], max = 3) => (tags || []).filter(t => PLAY_TAG_LABEL[t]).slice(0, max).map(t => `<span class="chip tag-chip">${icon((PLAY_TAGS.find(x => x[0] === t) || [])[2] || 'sparkles', 12)}${e(PLAY_TAG_LABEL[t])}</span>`).join('');
export const langChip = p => p?.language && p.language !== (T?.lang || 'es') ? `<span class="chip lang-chip" title="Idioma principal">${icon('languages', 12)}${e(LANG_NAME[p.language] || p.language)}</span>` : '';
/** ¿Puedo escribirle en privado? Lo decide el servidor por edad y bloqueos; aquí solo se refleja. */
export const canMessage = id => !state.privateOk || state.privateOk.has(id);
export function dmButton(p, label = '') {
  if (p.id === state.user.id) return '';
  // Siempre se muestra: si no se puede escribir, al tocarlo se explica el motivo (edad, bloqueo…).
  const locked = !canMessage(p.id);
  return btn('open-dm', label ? `${icon(locked ? 'lock' : 'message-circle', 15)} ${e(label)}` : icon(locked ? 'lock' : 'message-circle', 16), label ? `btn btn-sm ${locked ? 'btn-soft' : 'btn-primary'}` : 'btn btn-sm btn-soft btn-icon', `data-id="${e(p.id)}" ${label ? '' : `title="Mensaje" aria-label="Enviar mensaje a ${e(p.display_name)}"`}`);
}
export function followButton(p) {
  if (p.id === state.user.id) return '';
  return btn('follow', isFollowing(p.id) ? 'Siguiendo' : '+ Seguir', 'btn btn-sm ' + (isFollowing(p.id) ? 'btn-soft' : 'btn-ghost'), `data-id="${e(p.id)}"`);
}
/** Tarjeta de compatibilidad (Jugar e Inicio). match = { score, why } */
export function matchCard(p, match, extra = '') {
  return `<div class="card sync-card"><div class="sync-top">${avatar(p, 'lg')}<div class="grow"><button class="link card-heading" data-action="view-user" data-id="${e(p.id)}">${e(p.display_name)}</button><div class="card-desc">@${e(p.username)} · ${e(p.region || 'Global')}</div></div>${ring(match.score, `Afinidad ${match.score}%`, 56)}</div>
    ${extra}<div class="meta">${match.why.slice(0, 3).map(w => chip(w)).join('')}${langChip(p)}${tagChips(p.play_tags, 2)}</div><div class="row">${dmButton(p, 'Escribir')}${followButton(p)}</div></div>`;
}

// ───────────────────────── Disponibilidad ─────────────────────────
export function quietRow(a) {
  const p = getProfile(a.user_id), g = game(a.game_id);
  const waved = (d().waves || []).some(w => w.from_id === state.user.id && w.to_id === p.id && Date.now() - new Date(w.created_at).getTime() < 30 * 60000);
  return `<div class="quiet-person">${avatar(p, 'md')}<div class="grow"><button class="link" data-action="view-user" data-id="${e(p.id)}">${e(p.display_name)}</button><small>${e(g?.name || 'En lo suyo')} · ${e(remainingLabel(a.until))}</small></div>
    ${p.id === state.user.id ? chip('Tú') : waved ? `<span class="chip ok">${icon('check', 12)} Saludaste</span>` : btn('wave', '👋 Saludar', 'btn btn-soft btn-sm', `data-id="${e(p.id)}" aria-label="Saludar a ${e(p.display_name)} sin mensaje"`)}</div>`;
}
export function availRow(a, match) {
  const p = getProfile(a.user_id), g = game(a.game_id);
  return `<div class="card avail-card"><span class="avail-dot" aria-hidden="true"></span>${avatar(p, 'md')}<div class="grow"><div class="row wrap"><button class="link card-heading" data-action="view-user" data-id="${e(p.id)}">${e(p.display_name)}</button>${langChip(p)}${match ? `<span class="chip accent">${match.score}% afín</span>` : ''}</div>
    <div class="card-desc">${icon('gamepad-2', 13)} ${e(g?.name || 'Cualquier juego')} · ${e(a.platform || p.platform || '')} · ${e(remainingLabel(a.until))}</div>${a.note ? `<div class="avail-note">“${e(a.note)}”</div>` : ''}<div class="meta">${tagChips(p.play_tags, 3)}</div></div>
    ${g ? gameArt(g, 'avail-art') : ''}<div class="stack">${dmButton(p, 'Invitar')}</div></div>`;
}
export function myAvailability() {
  const a = (d().availability || []).find(x => x.user_id === state.user.id);
  if (availabilityActive(a)) {
    return `<section class="card avail-me on"><span class="avail-dot big" aria-hidden="true"></span><div class="grow"><span class="eyebrow">${a.mode === 'silencioso' ? 'Estás en la sala tranquila' : 'Estás disponible'}</span><h3>${e(game(a.game_id)?.name || 'Cualquier juego')}</h3><p class="card-desc">${e(remainingLabel(a.until))}${a.note ? ` · “${e(a.note)}”` : ''}. Quien busque equipo te verá aquí.</p></div><div class="row wrap">${btn('set-available', 'Cambiar', 'btn btn-soft btn-sm')}${btn('clear-available', 'Ya no estoy disponible', 'btn btn-ghost btn-sm')}</div></section>`;
  }
  return `<section class="card avail-me"><span class="avail-ic">${icon('signal', 22)}</span><div class="grow"><span class="eyebrow">¿Con ganas de jugar?</span><h3>Márcate disponible</h3><p class="card-desc">Dile a tu gente a qué juegas y por cuánto tiempo. Desaparece sola cuando termina.</p></div>${btn('set-available', `${icon('circle-dot', 16)} Estoy disponible`, 'btn btn-primary')}</section>`;
}

// ───────────────────────── Agenda ─────────────────────────
export function sessionCard(s, { compact = false } = {}) {
  const st = sessionState(s), g = game(s.game_id), host = getProfile(s.host_id);
  const rs = d().session_rsvps || [], mine = rs.find(r => r.session_id === s.id && r.user_id === state.user.id);
  const yes = going(rs, s.id), maybe = rs.filter(r => r.session_id === s.id && r.status === 'maybe');
  const squad = s.squad_id ? d().squads.find(x => x.id === s.squad_id) : null;
  const full = yes.length >= s.capacity && mine?.status !== 'going';
  const rated = new Set((d().chemistry_ratings || []).filter(c => c.session_id === s.id && c.rater_id === state.user.id).map(c => c.ratee_id));
  const toRate = rateableMates(s, rs, state.user.id).filter(u => !rated.has(u));
  const tone = st === 'live' || st === 'soon' ? 'accent' : st === 'cancelled' ? 'warn' : st === 'ended' ? '' : 'ok';
  let actions = '';
  if (st === 'ended' || st === 'live') {
    if (toRate.length) actions += btn('rate-session', `${icon('handshake', 15)} Calificar química`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`);
    else if (mine?.status === 'going' && st === 'ended') actions += `<span class="chip ok">${icon('check', 12)} Química enviada</span>`;
    if (mine?.status === 'going') {
      actions += btn('coach', `${icon('brain', 15)} Coach`, 'btn btn-soft btn-sm', `data-id="${e(s.id)}" title="Consejos para la próxima"`);
      if (s.squad_id && st === 'ended') actions += btn('session-memory', `${icon('images', 15)} Guardar recuerdo`, 'btn btn-ghost btn-sm', `data-id="${e(s.id)}"`);
    }
  }
  if (st !== 'ended' && st !== 'cancelled') {
    actions += ['going', 'maybe', 'no'].map(k => btn('rsvp', { going: 'Voy', maybe: 'Tal vez', no: 'No puedo' }[k], `btn btn-sm ${mine?.status === k ? 'btn-primary' : 'btn-soft'}`, `data-id="${e(s.id)}" data-kind="${k}" aria-pressed="${mine?.status === k}" ${k === 'going' && full ? 'disabled title="Ya no hay lugar"' : ''}`)).join('');
    actions += btn('session-ics', icon('calendar-plus', 15), 'btn btn-ghost btn-sm btn-icon', `data-id="${e(s.id)}" title="Añadir a mi calendario" aria-label="Añadir a mi calendario"`);
    if (s.host_id === state.user.id) actions += btn('cancel-session', 'Cancelar', 'btn btn-ghost btn-sm', `data-id="${e(s.id)}"`);
  }
  return `<article class="card session-card st-${st} ${compact ? 'compact' : ''}"><div class="sess-when"><b>${e(whenLabel(s.starts_at))}</b><small>${s.duration_min} min</small></div>
    <div class="grow"><div class="row wrap">${chip(SESSION_LABEL[st], tone)}${squad ? `<button class="chip chip-btn" data-action="open-squad" data-id="${e(squad.id)}">${e(squad.name)}</button>` : chip('Abierta')}</div>
      <h3 class="card-heading">${e(s.title)}</h3><div class="card-desc">${icon('gamepad-2', 13)} ${e(g?.name || 'Multijuego')} · organiza ${e(host.display_name)} · ${yes.length}/${s.capacity} confirmados${maybe.length ? ` · ${maybe.length} tal vez` : ''}</div>
      <div class="faces">${yes.slice(0, 6).map(r => avatar(getProfile(r.user_id), 'xs')).join('')}</div>
      ${actions ? `<div class="row wrap sess-actions">${actions}</div>` : ''}</div></article>`;
}

// ───────────────────────── Pasaporte GG ─────────────────────────
export function passportCard(userId, data, { own = false, compact = false } = {}) {
  if (!data) return `<section class="card passport muted-card"><div class="pp-head"><span class="pp-ic">${icon('id-card', 22)}</span><div><span class="eyebrow">Pasaporte GG</span><p class="card-desc">Se activa cuando la base de datos tiene la migración 003.</p></div></div></section>`;
  const lv = passportLevel(data), tags = topTags(data.tags, compact ? 2 : 3);
  return `<section class="card passport lv-${lv.id}"><div class="pp-head"><span class="pp-ic">${icon(lv.icon, 22)}</span><div class="grow"><span class="eyebrow">Pasaporte GG</span><h3>${e(lv.label)}</h3></div>${own && !compact ? btn('share-passport', `${icon('share-2', 15)} Compartir`, 'btn btn-soft btn-sm', `data-id="${e(userId)}"`) : ''}</div>
    <div class="pp-stats"><div><b>${lv.sessions}</b><small>partidas jugadas</small></div><div><b>${lv.raters}</b><small>${lv.raters === 1 ? 'persona dio' : 'personas dieron'} GG</small></div></div>
    ${tags.length ? `<div class="meta">${tags.map(t => `<span class="chip ok">${e(t.label)} · ${t.count}</span>`).join('')}</div>` : `<p class="card-desc">${own ? 'Juega una partida agendada y pide a tu equipo que califique la química.' : 'Aún no tiene calificaciones.'}</p>`}
    ${lv.next && !compact ? `<div class="pp-next"><small>Siguiente: ${e(lv.next.label)} (${lv.next.sessions} partidas y ${lv.next.raters} personas)</small><div class="progress" role="progressbar" aria-valuenow="${lv.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso al siguiente nivel"><span style="width:${lv.pct}%"></span></div></div>` : ''}</section>`;
}

/** Aviso de migraciones pendientes: indica la primera que falta (van en orden). */
export const noV6 = () => {
  const miss = d()._missing || [];
  const need = miss.includes('play_sessions') ? ['003_gamvoraq_v6.sql', 'no hay agenda, disponibilidad ni Pasaporte GG']
    : miss.includes('guide_offers') ? ['004_gamvoraq_v7.sql', 'no hay guías, ligas, sala tranquila ni modo familia']
    : miss.includes('squad_invites') ? ['006_gamvoraq_v11.sql', 'no hay roles ni invitaciones en squads, «Visto» en mensajes ni portadas de juegos'] : null;
  return need ? `<div class="banner warn">${icon('database', 16)}<span>Falta ejecutar <b>supabase/migrations/${need[0]}</b> en tu proyecto (SQL Editor de Supabase). Hasta entonces ${need[1]}.</span></div>` : '';
};
export { empty };

// ───────────────────────── v7 ─────────────────────────
/** «Ver anteriores»: aparece cuando la lista llegó al límite de carga y puede haber más en el servidor. */
export function olderButton(table, column, value, rows, min = 20) {
  if (state.demo || rows.length < min || state.exhausted?.[`${table}:${value}`]) return '';
  const oldest = rows.reduce((m, r) => (!m || String(r.created_at) < m ? String(r.created_at) : m), '');
  return `<div class="older-wrap">${btn('load-older', `${icon('history', 15)} Ver anteriores`, 'btn btn-ghost btn-sm', `data-table="${e(table)}" data-column="${e(column)}" data-id="${e(value)}" data-before="${e(oldest)}"`)}</div>`;
}
/** Segunda oportunidad: aviso privado y camino de vuelta. */
export function secondChanceCard() {
  const list = d()._secondChance || [];
  if (!list.length) return '';
  return list.map(sc => `<section class="card card-pad sc-card"><div class="row">${icon('heart-handshake', 20)}<span class="eyebrow">Segunda oportunidad · privado</span></div>
    <h3>La moderación revisó un reporte sobre ti</h3>
    <p class="card-desc">Motivo: <b>${e(sc.reason)}</b>. Nadie más ve este aviso. En GAMVORAQ creemos que todos podemos mejorar: no es un castigo, es un camino de vuelta.</p>
    ${sc.acknowledged ? `<p class="small">Para cerrarlo: juega partidas agendadas y recibe «Fue amable» o «Buena comunicación» de <b>2 personas distintas</b>.</p>
      <div class="progress" role="progressbar" aria-valuenow="${sc.progress}" aria-valuemin="0" aria-valuemax="${sc.needed}" aria-label="Progreso"><span style="width:${Math.min(100, sc.progress / sc.needed * 100)}%"></span></div><small class="muted">${sc.progress}/${sc.needed} · al completarlo ganas la insignia «Segunda oportunidad cumplida»</small>`
    : `<ol class="sc-code"><li>Detrás de cada nickname hay una persona.</li><li>Critica la jugada, nunca a la persona.</li><li>Si te enojas, pausa antes de escribir.</li></ol>
      <p class="small muted">Mientras no lo leas, no podrás crear partidas abiertas al público (las de tu squad sí).</p>${btn('ack-strike', `${icon('check', 15)} Leí el código y me comprometo`, 'btn btn-primary btn-sm', `data-id="${e(sc.id)}"`)}`}</section>`).join('');
}
