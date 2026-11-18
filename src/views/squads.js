// Squads: tu gente cercana. Chat del squad (traducido), agenda con asistencia, recuerdos con consentimiento
// y mensajes directos. Tres vistas: Mis squads · Mensajes · Explorar.
import { e, icon, avatar, ago, time, chip, btn, safeUrl, hueFor } from '../ui.js';
import { state, d, getProfile, game, squadMember, byDate } from '../state.js';
import { sessionState, togetherLabel, anniversaries } from '../features.js';
import { pageIntro, seg, messageBubble, chatForm, langHint, sessionCard, canMessage, empty, olderButton, noV6 } from './components.js';
import { musicPane, pollsPane } from '../v12.js';
import { squadRole, isSquadStaff, squadCount, squadFull, squadFitsMe, myInvites, isMuted, unreadIn, seenUpTo, dmUnreadTotal, ROLE_LABEL, ageGateCard, needsAge, gameArt, groupArt } from '../v11.js';

const asc = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
const openPolls = s => (d().squad_polls || []).filter(p => p.squad_id === s.id && (!p.closes_at || new Date(p.closes_at) > new Date()) && !(d().squad_poll_votes || []).some(v => v.poll_id === p.id && v.user_id === state.user.id)).length;
// Mis squads: donde soy integrante o que yo creé (aunque faltara mi registro de integrante).
const mySquads = () => d().squads.filter(s => squadMember(s.id) || s.owner_id === state.user.id);

function squadTile(s, active) {
  const members = d().squad_members.filter(m => m.squad_id === s.id);
  const last = d().squad_messages.filter(m => m.squad_id === s.id).sort(byDate)[0];
  const next = (d().play_sessions || []).filter(x => x.squad_id === s.id && ['upcoming', 'soon', 'live'].includes(sessionState(x))).sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))[0];
  const unread = unreadIn('squad', s.id);
  return `<button class="card item item-btn squad-tile ${active ? 'active' : ''} ${unread ? 'has-unread' : ''}" data-action="open-squad" data-id="${e(s.id)}" style="--h:${hueFor(s.name)}">${groupArt('squad', s, 'sm', gameArt(game(s.game_id) || { name: s.name }, 'sm'))}<div class="grow"><b>${e(s.name)}</b><div class="card-desc clamp1">${last ? `${e(getProfile(last.sender_id).display_name)}: ${e(last.body)}` : e(s.description || 'Aún sin mensajes')}</div><div class="tiny muted">${members.length}/${s.max_members || 12} integrantes${next ? ` · próxima: ${e(next.title)}` : ''}${isMuted(s.id) ? ` · ${icon('bell-off', 11)} silenciado` : ''}</div></div>${unread ? `<span class="unread-pill" aria-label="${unread} sin leer">${unread > 99 ? '99+' : unread}</span>` : icon('chevron-right', 16)}</button>`;
}

function memoriesPane(s) {
  const items = (d().squad_memories || []).filter(m => m.squad_id === s.id).sort(byDate);
  return `<div class="row between pane-head"><p class="muted small">Los recuerdos se comparten al momento con todo el squad.</p>${btn('create-memory', `${icon('plus', 15)} Guardar recuerdo`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`)}</div>
  <div class="memory-timeline">${items.map(m => {
    const people = (d().memory_consents || []).filter(c => c.memory_id === m.id && c.status !== 'declined').map(c => getProfile(c.user_id).display_name);
    const owner = m.author_id === state.user.id;
    return `<article class="card card-pad memory-card"><span class="memory-line-dot"></span>
      <div class="row between wrap"><div class="row">${avatar(getProfile(m.author_id), 'xs')}<div><strong>${e(getProfile(m.author_id).display_name)}</strong><small class="muted"> · ${e(time(m.created_at))}</small></div></div></div>
      <h3>${e(m.title)}</h3>${m.story ? `<p>${e(m.story)}</p>` : ''}
      ${m.image_url ? `<img class="memory-photo" src="${safeUrl(m.image_url)}" alt="Foto del recuerdo" loading="lazy">` : ''}
      ${people.length ? `<div class="meta">${icon('users', 13)} <span class="muted small">Con ${e(people.join(', '))}</span></div>` : ''}
      ${owner ? btn('memory-delete', `${icon('trash-2', 14)} Eliminar recuerdo`, 'btn btn-ghost btn-sm', `data-id="${e(m.id)}"`) : ''}</article>`;
  }).join('') || empty('Este squad todavía no tiene recuerdos. ¿Cuál fue su mejor partida?', 'images')}</div>`;
}

function agendaPane(s) {
  const list = (d().play_sessions || []).filter(x => x.squad_id === s.id && x.status !== 'cancelled');
  const upcoming = list.filter(x => sessionState(x) !== 'ended').sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  const past = list.filter(x => sessionState(x) === 'ended').sort((a, b) => String(b.starts_at).localeCompare(String(a.starts_at))).slice(0, 5);
  const staff = isSquadStaff(s.id) || s.members_can_schedule !== false;
  return `<div class="row between pane-head"><p class="muted small">${staff ? 'Propón una partida: el squad recibe un aviso, cada quien confirma y puede añadirla a su calendario.' : 'En este squad solo el dueño y los admins agendan; tú confirmas si vas.'}</p>${staff ? btn('schedule-session', `${icon('calendar-plus', 15)} Agendar`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`) : ''}</div>
  <div class="stack">${upcoming.map(x => sessionCard(x)).join('') || empty('No hay partidas agendadas en este squad.', 'calendar-days')}</div>
  ${past.length ? `<h4 class="pane-sub">Partidas recientes</h4><div class="stack">${past.map(x => sessionCard(x, { compact: true })).join('')}</div>` : ''}`;
}

function chatPane(s) {
  const messages = d().squad_messages.filter(m => m.squad_id === s.id).sort(asc);
  return `<div class="chat-card flat">${langHint()}<div class="chatbox" role="log" aria-live="polite">${olderButton('squad_messages', 'squad_id', s.id, messages)}${messages.map(m => messageBubble('squad_messages', m.sender_id, m, { canDelete: m.sender_id === state.user.id || isSquadStaff(s.id), report: 'squad_message' })).join('') || empty('Un saludo es un gran comienzo.', 'message-square')}</div>${chatForm('squad-message', s.id)}</div>`;
}

function squadDetail(s) {
  if (!s) return `<div class="card card-pad">${empty('Elige un squad para ver su chat, su agenda y sus recuerdos.', 'users-round')}</div>`;
  const members = d().squad_members.filter(m => m.squad_id === s.id);
  const pane = state.squadPane || 'chat';
  const pend = (d().memory_consents || []).filter(c => c.user_id === state.user.id && c.status === 'pending' && (d().squad_memories || []).some(m => m.id === c.memory_id && m.squad_id === s.id)).length;
  const next = (d().play_sessions || []).filter(x => x.squad_id === s.id && ['upcoming', 'soon', 'live'].includes(sessionState(x))).length;
  const mine = members.find(m => m.user_id === state.user.id);
  const anniv = anniversaries([s], members, state.user.id)[0];
  return `<section class="card squad-detail" id="squad-detail">${anniv ? `<div class="anniv-strip">${icon('party-popper', 18)}<span>${e(anniv.text)}</span>${btn('anniv-memory', 'Celebrar con un recuerdo', 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`)}</div>` : ''}<header class="sd-head" style="--h:${hueFor(s.name)}">${groupArt('squad', s, 'lg', `<span class="group-ph lg">${icon('users-round', 30)}</span>`, isSquadStaff(s.id))}<div class="grow"><span class="eyebrow">${e(game(s.game_id)?.name || 'Multijuego')}</span><h2>${e(s.name)}</h2><p class="card-desc">${e(s.description || '')}</p>
      <div class="faces">${members.slice(0, 8).map(m => `<button class="face-btn" data-action="view-user" data-id="${e(m.user_id)}" title="${e(getProfile(m.user_id).display_name)}">${avatar(getProfile(m.user_id), 'sm')}</button>`).join('')}<span class="muted small">${members.length}/${s.max_members || 12} integrantes</span>${mine?.joined_at ? `<span class="chip accent together">${icon('heart', 12)} ${e(togetherLabel(mine.joined_at))}</span>` : ''}</div>
      <div class="meta">${chip(ROLE_LABEL[mine?.role] || 'Integrante', mine?.role === 'member' ? '' : 'accent')}${chip(s.privacy === 'invitacion' ? 'Por invitación' : 'Abierto', '')}</div></div>
      <div class="sd-actions">${isSquadStaff(s.id) ? btn('squad-invite', `${icon('user-plus', 15)} Invitar`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`) + btn('squad-edit', `${icon('settings', 15)} Editar`, 'btn btn-soft btn-sm', `data-id="${e(s.id)}"`) : ''}
        ${btn('squad-mute', `${icon(isMuted(s.id) ? 'bell' : 'bell-off', 15)} ${isMuted(s.id) ? 'Activar avisos' : 'Silenciar'}`, 'btn btn-ghost btn-sm', `data-id="${e(s.id)}" aria-pressed="${isMuted(s.id)}"`)}
        ${mine?.role !== 'owner' ? btn('leave-squad', 'Salir', 'btn btn-ghost btn-sm', `data-id="${e(s.id)}"`) + btn('report', icon('flag', 15), 'btn btn-ghost btn-sm btn-icon', `data-kind="squad" data-id="${e(s.id)}" title="Reportar squad" aria-label="Reportar squad"`) : ''}</div></header>
    ${seg('squad-pane', [['chat', `${icon('message-circle', 15)} Chat`], ['agenda', `${icon('calendar-days', 15)} Agenda`, next], ['music', `${icon('music', 15)} Música`], ['polls', `${icon('vote', 15)} Encuestas`, openPolls(s)], ['memories', `${icon('images', 15)} Recuerdos`, pend], ['members', `${icon('users', 15)} Integrantes`, isSquadStaff(s.id) ? (d().squad_invites || []).filter(i => i.squad_id === s.id).length : 0]], pane, 'Secciones del squad')}
    <div class="sd-body">${pane === 'agenda' ? agendaPane(s) : pane === 'music' ? musicPane(s) : pane === 'polls' ? pollsPane(s) : pane === 'memories' ? memoriesPane(s) : pane === 'members' ? membersPane(s) : chatPane(s)}</div></section>`;
}

const ROLE_ORDER = { owner: 0, admin: 1, member: 2 };
function membersPane(s) {
  const myRole = squadRole(s.id), staff = isSquadStaff(s.id);
  const members = d().squad_members.filter(m => m.squad_id === s.id).sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || getProfile(a.user_id).display_name.localeCompare(getProfile(b.user_id).display_name));
  const invites = staff ? (d().squad_invites || []).filter(i => i.squad_id === s.id) : [];
  const actions = m => {
    if (m.user_id === state.user.id) return chip('Tú', 'accent');
    const out = [];
    if (myRole === 'owner') {
      out.push(m.role === 'admin' ? btn('squad-role', 'Quitar admin', 'btn btn-ghost btn-sm', `data-id="${e(s.id)}" data-user="${e(m.user_id)}" data-kind="member"`) : btn('squad-role', 'Hacer admin', 'btn btn-soft btn-sm', `data-id="${e(s.id)}" data-user="${e(m.user_id)}" data-kind="admin"`));
      out.push(btn('squad-transfer', 'Transferir', 'btn btn-ghost btn-sm', `data-id="${e(s.id)}" data-user="${e(m.user_id)}"`));
    }
    if ((myRole === 'owner' && m.role !== 'owner') || (myRole === 'admin' && m.role === 'member')) out.push(btn('squad-kick', 'Expulsar', 'btn btn-ghost btn-sm danger-text', `data-id="${e(s.id)}" data-user="${e(m.user_id)}"`));
    return out.join('');
  };
  return `<div class="row between pane-head"><p class="muted small">${squadCount(s.id)} de ${s.max_members || 12} lugares ocupados. ${staff ? 'El dueño cambia roles y transfiere; dueño y admins invitan, expulsan, agendan y editan.' : 'El dueño y los admins administran el squad.'}</p>${staff ? btn('squad-invite', `${icon('user-plus', 15)} Invitar`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`) : ''}</div>
  <div class="member-list">${members.map(m => { const p = getProfile(m.user_id); return `<div class="member-row">${avatar(p, 'sm')}<button class="link grow" data-action="view-user" data-id="${e(p.id)}"><b>${e(p.display_name)}</b><small class="muted"> @${e(p.username)}</small></button>${chip(ROLE_LABEL[m.role] || 'Integrante', m.role === 'member' ? '' : 'accent')}<div class="row wrap member-actions">${actions(m)}</div></div>`; }).join('')}</div>
  ${invites.length ? `<h4 class="pane-sub">Invitaciones pendientes</h4><div class="member-list">${invites.map(i => { const p = getProfile(i.user_id); return `<div class="member-row">${avatar(p, 'sm')}<div class="grow"><b>${e(p.display_name)}</b><small class="muted"> · invitó ${e(getProfile(i.invited_by).display_name)}</small></div>${btn('squad-invite-cancel', 'Cancelar', 'btn btn-ghost btn-sm', `data-id="${e(s.id)}" data-user="${e(i.user_id)}"`)}</div>`; }).join('')}</div>` : ''}`;
}

function invitesStrip() {
  const list = myInvites();
  if (!list.length) return '';
  return `<section class="card card-pad invite-strip"><div class="row">${icon('mail', 18)}<b>${list.length === 1 ? 'Tienes una invitación a un squad' : `Tienes ${list.length} invitaciones a squads`}</b></div>${list.map(i => { const sq = d().squads.find(x => x.id === i.squad_id); if (!sq) return ''; return `<div class="member-row">${groupArt('squad', sq, 'sm', gameArt(game(sq.game_id) || { name: sq.name }, 'sm'))}<div class="grow"><b>${e(sq.name)}</b><small class="muted"> · te invitó ${e(getProfile(i.invited_by).display_name)} · ${squadCount(sq.id)}/${sq.max_members || 12}</small></div>${btn('squad-invite-accept', 'Aceptar', 'btn btn-primary btn-sm', `data-id="${e(sq.id)}"`)}${btn('squad-invite-decline', 'Rechazar', 'btn btn-ghost btn-sm', `data-id="${e(sq.id)}"`)}</div>`; }).join('')}</section>`;
}

function exploreView() {
  const invited = new Set(myInvites().map(i => i.squad_id));
  // Se muestran todos los squads; si no es para tu rango de edad, se indica en vez de ocultarlo.
  const others = d().squads.filter(s => !squadMember(s.id) && s.owner_id !== state.user.id);
  return `<div class="grid-2">${others.map(s => {
    const count = d().squad_members.filter(m => m.squad_id === s.id).length;
    const faces = d().squad_members.filter(m => m.squad_id === s.id).slice(0, 4).map(m => avatar(getProfile(m.user_id), 'xs')).join('');
    return `<div class="card squad-card" style="--h:${hueFor(s.name)}"><div class="row">${groupArt('squad', s, 'md', `<span class="group-ph md">${icon('users-round', 22)}</span>`)}<div class="grow"><span class="eyebrow">${e(game(s.game_id)?.name || 'Squad')}</span><h3>${e(s.name)}</h3></div></div><p class="card-desc">${e(s.description || 'Squad gamer')}</p><div class="meta">${chip(game(s.game_id)?.name || 'Multijuego')}${chip(`${count}/${s.max_members || 12} integrantes`)}${s.privacy === 'invitacion' ? chip('Por invitación') : ''}</div><div class="faces">${faces}</div>
      <div class="row">${!squadFitsMe(s) ? btn('noop', `${icon('shield', 14)} ${s.age_band === 'minor' ? 'Solo para menores' : 'Solo para adultos'}`, 'btn btn-soft btn-sm', 'disabled') : invited.has(s.id) ? btn('squad-invite-accept', 'Aceptar invitación', 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`) : squadFull(s) ? btn('noop', 'Lleno', 'btn btn-soft btn-sm', 'disabled') : s.privacy === 'invitacion' ? btn('noop', `${icon('lock', 14)} Solo por invitación`, 'btn btn-soft btn-sm', 'disabled') : btn('join-squad', 'Unirme', 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`)}</div></div>`;
  }).join('') || `<div style="grid-column:1/-1">${empty(d().squads.length ? 'Ya estás en todos los squads que existen. ¡Crea uno nuevo!' : 'Todavía nadie ha creado un squad. ¡Sé el primero!', 'users-round', btn('create-squad', `${icon('plus', 15)} Crear squad`, 'btn btn-primary btn-sm'))}</div>`}</div>`;
}

export function viewSquads() {
  const view = state.squadsView || 'mine';
  const mine = mySquads();
  const head = pageIntro('SQUADS', 'Tu gente cercana', 'Chat que se traduce solo, agenda de partidas y recuerdos que nadie publica sin permiso.', btn('create-squad', `${icon('plus', 16)} Crear squad`, 'btn btn-primary btn-sm')) + noV6() + ageGateCard() + invitesStrip();
  const tabs = seg('squads-view', [['mine', 'Mis squads', mine.length], ['explore', 'Explorar']], view, 'Vista de squads');
  if (view === 'explore') return head + tabs + exploreView();
  const selected = mine.find(s => s.id === state.selectedSquad) || mine[0];
  return head + tabs + (mine.length ? `<div class="squads-layout"><div class="cards-list">${mine.map(s => squadTile(s, s.id === selected?.id)).join('')}</div>${squadDetail(selected)}</div>`
    : empty('Aún no estás en ningún squad. Únete a uno o crea el tuyo.', 'users-round', `<div class="row" style="justify-content:center">${btn('squads-view', 'Explorar squads', 'btn btn-primary btn-sm', 'data-id="explore"')}${btn('create-squad', 'Crear squad', 'btn btn-soft btn-sm')}</div>`));
}
