// Comunidades: grupos grandes por juego o tema. Dentro de cada una: publicaciones, anuncios (canales),
// retos y, para quien modera, la cola de reportes.
import { e, icon, avatar, chip, btn, hueFor, time } from '../ui.js';
import { state, d, getProfile, member, staff, byDate, isBlocked } from '../state.js';
import { pageIntro, seg, postCard, composer, messageBubble, chatForm, langHint, empty, olderButton } from './components.js';
import { viewLeagues } from './leagues.js';
import { communityMembersPane } from '../v12.js';
import { groupArt } from '../v11.js';

const asc = (a, b) => String(a.created_at).localeCompare(String(b.created_at));

function communityCard(c) {
  const count = d().community_members.filter(m => m.community_id === c.id).length;
  const posts = d().posts.filter(p => p.community_id === c.id).length;
  return `<div class="card item" style="--h:${hueFor(c.name)}">${groupArt('community', c, 'md', `<div class="community-art">${icon('users', 24)}</div>`)}<div class="grow"><button class="link card-heading" data-action="view-community" data-id="${e(c.id)}">${e(c.name)}</button><p class="card-desc">${e(c.description)}</p><div class="meta">${chip(count + ' miembros')}${chip(posts + ' publicaciones')}${staff(c.id) ? chip('Moderación', 'accent') : member(c.id) ? chip('Eres miembro', 'ok') : ''}</div></div>
    <div class="stack">${btn('view-community', 'Entrar', 'btn btn-primary btn-sm', `data-id="${e(c.id)}"`)}${member(c.id) && !staff(c.id) ? btn('join-community', 'Salir', 'btn btn-ghost btn-sm', `data-id="${e(c.id)}"`) : ''}</div></div>`;
}

const QUEST_STATE = { joined: ['En proceso', 'accent'], rejected: ['Ajusta y reenvía', 'warn'], submitted: ['Esperando revisión', ''], approved: ['✓ Insignia ganada', 'ok'] };
const myEntry = q => d().quest_entries.find(x => x.quest_id === q.id && x.user_id === state.user.id);
const isMyQuest = q => Boolean(myEntry(q)) || q.creator_id === state.user.id;
// Primero los míos que siguen en curso, luego los demás y al final los terminados.
const questRank = q => { const m = myEntry(q); return m ? ({ rejected: 0, joined: 1, submitted: 2, approved: 4 })[m.status] ?? 3 : q.creator_id === state.user.id ? 2.5 : 3; };
const sortQuests = list => [...list].sort((a, b) => questRank(a) - questRank(b) || String(b.created_at).localeCompare(String(a.created_at)));

/** Retos en los que participo o que organizo, con su estado, en una sola lista. */
function myQuestsSection() {
  const list = sortQuests(d().quests.filter(isMyQuest));
  if (!list.length) return '';
  const active = list.filter(q => myEntry(q)?.status !== 'approved').length;
  return `<div class="sec-head"><div><h2>${icon('target', 18)} Mis retos</h2><p class="sub">${active ? `${active} en curso` : 'Todos terminados'} · los que organizas y en los que participas.</p></div></div><div class="grid-2">${list.map(q => questCard(q, { showCommunity: true })).join('')}</div>`;
}

function questCard(q, { showCommunity = false } = {}) {
  const mine = d().quest_entries.find(x => x.quest_id === q.id && x.user_id === state.user.id), n = d().quest_entries.filter(x => x.quest_id === q.id).length;
  const reviewer = q.creator_id === state.user.id || (q.community_id && staff(q.community_id));
  const step = !mine ? 0 : mine.status === 'joined' || mine.status === 'rejected' ? 1 : mine.status === 'submitted' ? 2 : 3;
  const closed = Boolean(q.ends_at && new Date(q.ends_at) <= new Date());
  const pending = reviewer ? d().quest_entries.filter(x => x.quest_id === q.id && x.status === 'submitted').length : 0;
  const st = mine ? QUEST_STATE[mine.status] : q.creator_id === state.user.id ? ['Organizas', ''] : null;
  const comm = showCommunity && q.community_id ? d().communities.find(c => c.id === q.community_id) : null;
  return `<div class="card quest-card ${mine ? 'quest-mine quest-' + mine.status : ''}"><div class="row between"><span class="eyebrow">${n} ${n === 1 ? 'participante' : 'participantes'}</span><span class="row">${st ? chip(st[0], st[1]) : ''}${chip('✦ ' + q.badge_name, 'accent')}</span></div><h3>${e(q.title)}</h3>
    ${comm ? `<button class="link small" data-action="view-community" data-id="${e(comm.id)}">${icon('users', 13)} ${e(comm.name)}</button>` : showCommunity && !q.community_id ? `<span class="muted small">${icon('globe', 13)} Abierto para todos</span>` : ''}<p class="card-desc">${e(q.description)}</p>
    <div class="steps" aria-label="Progreso del reto">${['Unirme', 'Enviar evidencia', 'Revisión', 'Insignia'].map((l, i) => `<span class="${i <= step ? 'done' : ''} ${i === step ? 'now' : ''}">${l}</span>`).join('')}</div>
    <div class="meta">${chip('Organiza: ' + getProfile(q.creator_id).display_name)}${q.ends_at ? chip((closed ? 'Cerró ' : 'Hasta ') + time(q.ends_at), closed ? 'warn' : '') : ''}${mine?.status === 'rejected' ? chip('Revisión: ajusta y reenvía', 'warn') : ''}</div>
    <div class="row wrap">${!mine ? (closed ? btn('noop', `${icon('lock', 14)} Reto cerrado`, 'btn btn-soft btn-sm', 'disabled') : btn('join-quest', `${icon('target', 15)} Participar`, 'btn btn-primary btn-sm', `data-id="${e(q.id)}"`)) : mine.status === 'joined' || mine.status === 'rejected' ? btn('submit-quest', mine.status === 'rejected' ? 'Reenviar evidencia' : 'Enviar evidencia', 'btn btn-primary btn-sm', `data-id="${e(q.id)}"`) : btn('noop', mine.status === 'approved' ? '✓ Insignia ganada' : 'Esperando revisión', 'btn btn-soft btn-sm', 'disabled')}
      ${mine && mine.status !== 'approved' ? btn('leave-quest', 'Abandonar', 'btn btn-ghost btn-sm', `data-id="${e(q.id)}"`) : ''}
      ${reviewer ? btn('review-quest', `Revisar envíos${pending ? ` (${pending})` : ''}`, pending ? 'btn btn-soft btn-sm' : 'btn btn-ghost btn-sm', `data-id="${e(q.id)}"`) + btn('quest-edit', `${icon('pencil', 14)} Editar`, 'btn btn-ghost btn-sm', `data-id="${e(q.id)}"`) : ''}</div></div>`;
}

function announcements(c) {
  const chans = d().channels.filter(ch => ch.community_id === c.id);
  const ch = chans.find(x => x.id === state.selectedChannel) || chans[0];
  const canCreate = staff(c.id);
  if (!ch) return empty(canCreate ? 'Crea un canal de anuncios para avisar de eventos y torneos.' : 'Esta comunidad aún no tiene anuncios.', 'megaphone', canCreate ? btn('create-channel', 'Crear canal', 'btn btn-primary btn-sm', `data-id="${e(c.id)}"`) : '');
  const messages = d().channel_messages.filter(m => m.channel_id === ch.id).sort(asc);
  return `${chans.length > 1 ? `<div class="pills">${chans.map(x => btn('select-channel', e(x.title), 'pill ' + (x.id === ch.id ? 'on' : ''), `data-id="${e(x.id)}"`)).join('')}</div>` : ''}
  <div class="card chat-card"><div class="chat-head"><div><h3>${icon('megaphone', 17)} ${e(ch.title)}</h3><p class="muted small">${e(ch.description || 'Anuncios oficiales')} · solo moderadores publican</p></div>${canCreate ? btn('create-channel', icon('plus', 15), 'btn btn-ghost btn-sm btn-icon', `data-id="${e(c.id)}" aria-label="Nuevo canal"`) : ''}</div>${langHint()}
  <div class="chatbox" role="log" aria-live="polite">${messages.map(m => messageBubble('channel_messages', m.author_id, m)).join('') || empty('Sin anuncios todavía.')}</div>${staff(c.id) ? chatForm('channel-message', ch.id, 'Escribe un anuncio…') : ''}</div>`;
}

function moderation(c) {
  const reports = d().reports.filter(r => r.community_id === c.id).sort(byDate);
  return `<div class="cards-list">${reports.map(r => `<div class="card card-pad"><div class="row between"><b>${e(r.reason.toUpperCase())}</b>${chip(r.status, r.status === 'open' ? 'warn' : '')}</div><p class="card-desc" style="margin:12px 0">${e(r.detail || 'Sin detalles adicionales.')}</p><div class="row">${r.post_id ? btn('find-post', 'Ver publicación', 'btn btn-soft btn-sm', `data-id="${e(r.post_id)}"`) : ''}${r.status === 'open' ? btn('review-report', 'Revisado', 'btn btn-primary btn-sm', `data-id="${e(r.id)}"`) + btn('dismiss-report', 'Descartar', 'btn btn-soft btn-sm', `data-id="${e(r.id)}"`) : ''}</div></div>`).join('') || empty('No hay reportes en esta comunidad.', 'shield-check')}</div>
  <div class="banner info">${icon('info', 16)}<span>GUARDIAN avisa antes de enviar textos hostiles y el servidor limita los envíos masivos, pero la decisión final la toma el equipo moderador.</span></div>`;
}

function detail(c) {
  const pane = state.communityPane || 'posts';
  const isMember = member(c.id), isStaff = staff(c.id);
  const count = d().community_members.filter(m => m.community_id === c.id).length;
  const quests = sortQuests(d().quests.filter(q => q.community_id === c.id));
  const open = d().reports.filter(r => r.community_id === c.id && r.status === 'open').length;
  const tabs = [['posts', 'Publicaciones'], ['news', 'Anuncios'], ['quests', 'Retos', quests.length], ['members', 'Integrantes', count]];
  if (isStaff) tabs.push(['mod', 'Moderación', open]);
  const posts = d().posts.filter(p => p.community_id === c.id && !isBlocked(p.author_id)).sort(byDate);
  const body = pane === 'news' ? announcements(c)
    : pane === 'quests' ? `<div class="row between pane-head"><p class="muted small">Retos positivos con insignia. Quien organiza revisa la evidencia.</p>${isMember ? btn('create-quest', `${icon('plus', 15)} Crear reto`, 'btn btn-primary btn-sm', `data-id="${e(c.id)}"`) : ''}</div><div class="grid-2">${quests.map(questCard).join('') || `<div style="grid-column:1/-1">${empty('No hay retos en esta comunidad.', 'target')}</div>`}</div>`
    : pane === 'mod' && isStaff ? moderation(c)
    : pane === 'members' ? communityMembersPane(c)
    : `${isMember ? composer(c.id) : `<div class="banner info">${icon('info', 16)}<span>Únete para publicar en esta comunidad.</span></div>`}<div class="stack-lg">${posts.map(postCard).join('') || empty('Todavía no hay publicaciones aquí.', 'message-circle')}</div>${olderButton('posts', 'community_id', c.id, posts)}`;
  return `<button class="link back-link" data-action="clear-community">${icon('arrow-left', 15)} Todas las comunidades</button>
  <section class="card community-hero" style="--h:${hueFor(c.name)}">${groupArt('community', c, 'lg', `<div class="community-art lg">${icon('users', 30)}</div>`, isStaff)}<div class="grow"><span class="eyebrow">Comunidad · ${count} miembros</span><h2>${e(c.name)}</h2><p class="card-desc">${e(c.description)}</p>
    <div class="faces">${d().community_members.filter(m => m.community_id === c.id).slice(0, 8).map(m => avatar(getProfile(m.user_id), 'xs')).join('')}</div></div>
    <div class="stack">${isStaff ? chip(c.owner_id === state.user.id ? 'Tú la fundaste' : 'Moderas esta comunidad', 'accent') : btn('join-community', isMember ? 'Salir' : 'Unirme', isMember ? 'btn btn-soft btn-sm' : 'btn btn-primary btn-sm', `data-id="${e(c.id)}"`)}${c.owner_id !== state.user.id ? btn('report', `${icon('flag', 14)} Reportar`, 'btn btn-ghost btn-sm', `data-kind="community" data-id="${e(c.id)}"`) : ''}</div></section>
  ${seg('community-pane', tabs, pane, 'Secciones de la comunidad')}<div class="cm-body">${body}</div>`;
}

export function viewCommunities() {
  const c = d().communities.find(x => x.id === state.selectedCommunity);
  if (c) return detail(c);
  const view = state.communitiesView || 'list';
  const tabs = seg('communities-view', [['list', `${icon('compass', 15)} Comunidades`], ['leagues', `${icon('trophy', 15)} Ligas locales`, (d().leagues || []).filter(l => l.status !== 'terminada').length]], view, 'Comunidades o ligas');
  if (view === 'leagues') return pageIntro('COMUNIDADES', 'Ligas locales', 'Squads de tu escuela, universidad o ciudad compitiendo con juego limpio.') + tabs + viewLeagues();
  const mine = d().communities.filter(x => member(x.id)), others = d().communities.filter(x => !member(x.id));
  const globalQuests = sortQuests(d().quests.filter(q => !q.community_id && !isMyQuest(q)));
  return `${pageIntro('COMUNIDADES', 'Tu gente, tus reglas', 'Grupos por juego o tema con publicaciones, anuncios y retos. Las publicaciones en otros idiomas se traducen solas.', btn('create-community', `${icon('plus', 16)} Crear comunidad`, 'btn btn-primary btn-sm'))}${tabs}
  ${mine.length ? `<div class="sec-head"><h2>Mis comunidades</h2></div><div class="cards-list">${mine.map(communityCard).join('')}</div>` : ''}
  <div class="sec-head"><h2>Descubrir</h2></div><div class="cards-list">${others.map(communityCard).join('') || empty('Ya estás en todas. ¡Crea la tuya!', 'compass')}</div>
  ${myQuestsSection()}
  <div class="sec-head"><div><h2>Retos abiertos para todos</h2><p class="sub">Insignias por hacer el bien en cualquier comunidad. Cada persona puede tener hasta 3 retos abiertos.</p></div>${btn('create-quest', `${icon('plus', 15)} Crear reto`, 'btn btn-ghost btn-sm')}</div>${globalQuests.length ? `<div class="grid-2">${globalQuests.map(questCard).join('')}</div>` : empty(d().quests.some(q => !q.community_id) ? 'Ya estás en todos los retos abiertos. ¡Crea uno nuevo!' : 'Aún no hay retos abiertos para todos. ¡Crea el primero!', 'target')}`;
}
