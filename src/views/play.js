// Jugar: ¿con quién juego ahora o más tarde? Disponibles ahora, partidas abiertas y compatibles (SYNC + química).
import { e, icon, btn, avatar, chip } from '../ui.js';
import { state, d, me, game, myGames, theirGames, isBlocked, getProfile } from '../state.js';
import { compatibility } from '../sync.js';
import { availabilityActive, sessionState, chemistryBonus } from '../features.js';
import { pageIntro, sectionHead, seg, availRow, quietRow, myAvailability, sessionCard, matchCard, searchForm, noV6, empty, canMessage, langChip } from './components.js';

const FILTERS = [['all', 'Todos'], ['games', 'Mis juegos'], ['platform', 'Mi plataforma'], ['access', 'Juego accesible']];

function scored(p) {
  const chem = (d()._chemistry || []).find(c => c.other_id === p.id);
  const m = compatibility(me(), p, myGames(), theirGames(p.id));
  const b = chemistryBonus(chem);
  return b ? { ...m, score: Math.min(100, m.score + b.bonus), why: [b.why, ...m.why] } : m;
}
function passes(p, f, gameId) {
  if (f === 'games') return gameId ? myGames().map(String).includes(String(gameId)) : theirGames(p.id).some(g => myGames().map(String).includes(String(g)));
  if (f === 'platform') return p.platform && p.platform === me().platform;
  if (f === 'access') return (p.play_tags || []).length > 0;
  return true;
}

export function viewPlay() {
  const f = state.syncFilter || 'all', term = state.search.toLowerCase(), now = Date.now();
  const byId = new Map(d().profiles.map(p => [p.id, p]));
  const quiet = (d().availability || []).filter(a => a.mode === 'silencioso' && availabilityActive(a, now) && !isBlocked(a.user_id));
  const avail = (d().availability || []).filter(a => a.mode !== 'silencioso' && a.user_id !== state.user.id && availabilityActive(a, now) && !isBlocked(a.user_id))
    .map(a => ({ a, p: byId.get(a.user_id) })).filter(x => x.p && passes(x.p, f, x.a.game_id))
    .map(x => ({ ...x, m: scored(x.p) })).sort((x, y) => y.m.score - x.m.score);
  const open = (d().play_sessions || []).filter(s => !s.squad_id && ['upcoming', 'soon', 'live'].includes(sessionState(s, now)) && !isBlocked(s.host_id))
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
  const people = d().profiles.filter(p => p.id !== state.user.id && p.looking_for !== false && !isBlocked(p.id) && passes(p, f)
    && (!term || `${p.display_name} ${p.username} ${p.region}`.toLowerCase().includes(term)))
    .map(p => ({ p, m: scored(p) })).sort((a, b) => b.m.score - a.m.score).slice(0, 30);
  const mine = myGames().map(id => game(id)?.name).filter(Boolean);

  return `${noV6()}${pageIntro('JUGAR', '¿Con quién juegas hoy?', 'Gente disponible ahora, partidas abiertas y compañeros compatibles. La afinidad es transparente: siempre ves por qué coinciden.',
    btn('schedule-session', `${icon('calendar-plus', 16)} Agendar partida`, 'btn btn-primary btn-sm'))}
  ${myAvailability()}
  ${seg('sync-filter', FILTERS, f, 'Filtro de jugadores')}
  ${f === 'access' ? `<div class="banner info">${icon('accessibility', 16)}<span>Personas que indicaron cómo prefieren jugar: sin micrófono, por texto, con paciencia, sin presión, con una mano… Puedes marcar las tuyas en tu perfil.</span></div>` : ''}
  ${f === 'games' && !mine.length ? `<div class="banner info">${icon('gamepad-2', 16)}<span>Aún no tienes juegos en tu biblioteca. ${btn('nav-games', 'Agregar juegos', 'link')}</span></div>` : ''}
  ${sectionHead('Disponibles ahora', `<span class="chip">${avail.length}</span>`, 'Su estado desaparece solo cuando termina el tiempo que eligieron.')}
  <div class="cards-list">${avail.map(x => availRow(x.a, x.m)).join('') || empty('Nadie coincide con este filtro ahora mismo. Márcate disponible y te encontrarán.', 'signal')}</div>
  ${quietRoom(quiet)}
  ${sectionHead('Partidas abiertas', btn('schedule-session', `${icon('plus', 15)} Nueva`, 'btn btn-ghost btn-sm'), 'Cualquiera puede apuntarse hasta llenar el cupo.')}
  <div class="cards-list">${open.map(s => sessionCard(s)).join('') || empty('No hay partidas abiertas. Crea una y aparecerá aquí.', 'calendar-days')}</div>
  ${firstDay()}
  ${sectionHead('Compatibles contigo', '', 'Juegos, plataforma, horario, estilo y la química de partidas anteriores.')}
  ${searchForm('Buscar por nombre, usuario o región')}
  <div class="grid-2">${people.map(x => matchCard(x.p, x.m)).join('') || `<div style="grid-column:1/-1">${empty('No encontramos jugadores con esa búsqueda.', 'users')}</div>`}</div>
  <p class="muted tiny" style="margin-top:14px">${icon('info', 13)} SYNC es un cálculo local y explicable, no una calificación de nadie como persona.</p>`;
}

/** Sala tranquila: compañía sin presión. Nadie escribe; solo se saluda. */
function quietRoom(list) {
  const me_ = list.find(a => a.user_id === state.user.id);
  return `${sectionHead('Sala tranquila', `<span class="chip">${list.length}</span>`, 'Jugar o estudiar «juntos» sin hablar. Solo hay saludos 👋, sin mensajes ni presión.')}
  <section class="card quiet-room"><div class="quiet-head"><span class="quiet-ic">${icon('coffee', 22)}</span><div class="grow"><b>${list.length ? `${list.length} ${list.length === 1 ? 'persona está' : 'personas están'} aquí ahora` : 'La sala está vacía'}</b><small class="muted">Perfecto para días tímidos, de ansiedad o de concentración.</small></div>
    ${me_ ? btn('clear-available', 'Salir de la sala', 'btn btn-ghost btn-sm') : btn('quiet-join', `${icon('circle-dot', 15)} Entrar en silencio`, 'btn btn-primary btn-sm')}${btn('vora-session', `${icon('timer', 15)} Sesión con VORA`, 'btn btn-soft btn-sm')}</div>
    ${list.length ? `<div class="quiet-list">${list.map(quietRow).join('')}</div>` : ''}</section>`;
}

/** Modo «primer día»: quien empieza un juego encuentra a alguien con experiencia que se ofrece a guiar. */
function firstDay() {
  const offers = (d().guide_offers || []).filter(o => !isBlocked(o.user_id));
  const gamesWithGuides = [...new Set(offers.map(o => String(o.game_id)))].map(id => game(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const sel = state.guideGame || '';
  const guides = offers.filter(o => o.user_id !== state.user.id && (!sel || String(o.game_id) === String(sel)));
  const reqs = d().guide_requests || [];
  const incoming = reqs.filter(r => r.guide_id === state.user.id && ['pending', 'accepted'].includes(r.status));
  const outgoing = reqs.filter(r => r.learner_id === state.user.id && r.status !== 'declined' && !(r.status === 'done' && r.helpful != null));
  const myOffers = offers.filter(o => o.user_id === state.user.id);
  const reqRow = (r, asGuide) => {
    const other = getProfile(asGuide ? r.learner_id : r.guide_id), g = game(r.game_id)?.name || 'un juego';
    const status = { pending: 'Pendiente', accepted: 'Aceptada', done: 'Terminada' }[r.status];
    let actions = '';
    if (asGuide && r.status === 'pending') actions = btn('guide-accept', 'Aceptar', 'btn btn-primary btn-sm', `data-id="${e(r.id)}"`) + btn('guide-decline', 'No puedo', 'btn btn-ghost btn-sm', `data-id="${e(r.id)}"`);
    if (r.status === 'accepted' && canMessage(other.id)) actions += btn('open-dm', `${icon('message-circle', 15)} Escribir`, 'btn btn-soft btn-sm', `data-id="${e(other.id)}"`);
    if (!asGuide && r.status === 'accepted') actions += btn('guide-done', '¿Te ayudó?', 'btn btn-primary btn-sm', `data-id="${e(r.id)}"`);
    if (!asGuide && r.status === 'pending') actions += btn('guide-cancel', 'Cancelar', 'btn btn-ghost btn-sm', `data-id="${e(r.id)}"`);
    return `<div class="guide-req">${avatar(other, 'sm')}<div class="grow"><b>${e(other.display_name)}</b> ${langChip(other)}<small class="muted">${asGuide ? 'quiere aprender' : 'te guía en'} ${e(g)} · ${status}</small>${r.message && asGuide ? `<p class="small">“${e(r.message)}”</p>` : ''}</div><div class="row wrap">${actions}</div></div>`;
  };
  return `${sectionHead('Modo primer día', btn('guide-offer', `${icon('hand-heart', 15)} Ofrecerme como guía`, 'btn btn-ghost btn-sm'), '¿Empiezas un juego? Alguien con experiencia te acompaña tus primeras partidas, sin juzgar.')}
  ${incoming.length || outgoing.length ? `<section class="card card-pad guide-box"><h3>Tus guías</h3>${incoming.map(r => reqRow(r, true)).join('')}${outgoing.map(r => reqRow(r, false)).join('')}</section>` : ''}
  <div class="guide-filter"><label class="field">¿Qué juego empiezas?<select class="select" data-change="guide-game" aria-label="Juego para buscar guía"><option value="">Todos los juegos con guía</option>${gamesWithGuides.map(g => `<option value="${g.id}" ${String(g.id) === String(sel) ? 'selected' : ''}>${e(g.name)}</option>`).join('')}</select></label></div>
  <div class="grid-2">${guides.map(o => {
    const p = getProfile(o.user_id), badge = d().badges.some(b => b.user_id === p.id && b.name === 'Mentor GG');
    const open = reqs.some(r => r.guide_id === p.id && r.learner_id === state.user.id && String(r.game_id) === String(o.game_id) && ['pending', 'accepted'].includes(r.status));
    return `<div class="card guide-card">${avatar(p, 'md')}<div class="grow"><div class="row wrap"><button class="link card-heading" data-action="view-user" data-id="${e(p.id)}">${e(p.display_name)}</button>${badge ? chip('Mentor GG', 'accent') : ''}${langChip(p)}</div><div class="card-desc">${icon('gamepad-2', 13)} ${e(game(o.game_id)?.name || '')}</div>${o.note ? `<p class="small">“${e(o.note)}”</p>` : ''}
      <div class="row">${open ? chip('Solicitud enviada', 'ok') : canMessage(p.id) ? btn('guide-ask', `${icon('sparkles', 15)} Pedir guía`, 'btn btn-primary btn-sm', `data-id="${e(p.id)}" data-game="${e(o.game_id)}"`) : chip('No disponible para ti')}</div></div></div>`;
  }).join('') || `<div style="grid-column:1/-1">${empty(sel ? 'Aún no hay guías para este juego. ¿Y si te ofreces tú cuando lo domines?' : 'Aún no hay guías. Sé la primera persona en ofrecerse.', 'hand-heart')}</div>`}</div>
  ${myOffers.length ? `<p class="muted small" style="margin-top:10px">${icon('hand-heart', 13)} Te ofreces como guía en: ${myOffers.map(o => `${e(game(o.game_id)?.name || '')} ${btn('guide-unoffer', icon('x', 12), 'tr-link', `data-id="${e(o.game_id)}" aria-label="Dejar de ser guía en ${e(game(o.game_id)?.name || '')}"`)}`).join(' · ')}</p>` : ''}`;
}
