// Inicio: qué pasa con mi gente hoy. Resumen «Mientras no estabas», próximas partidas, quién está disponible,
// la química pendiente de calificar y un feed con final («Estás al día»), sin scroll infinito.
import { e, icon, avatar, chip, btn, greeting, progress, ring } from '../ui.js';
import { state, d, me, getProfile, myGames, theirGames, isBlocked, byDate, squadMember, isFollowing } from '../state.js';
import { compatibility } from '../sync.js';
import { avatarSvg } from '../companion/avatar.js';
import { PALETTES } from '../companion/memory.js';
import { availabilityActive, sessionState, rateableMates, chemistryBonus, anniversaries } from '../features.js';
import { postCard, composer, sessionCard, myAvailability, dmButton, noV6, secondChanceCard } from './components.js';
import { radarCard } from '../v12.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const FEED_LIMIT = 8;

function heroHtml(v, nAvail) {
  const name = v.nickname || me().display_name || 'gamer';
  const pal = PALETTES[v.color] || PALETTES.crimson;
  const claimable = v.missions.filter(m => m.done && !m.claimed).length, done = v.missions.filter(m => m.done).length;
  const line = claimable ? `Tienes ${plural(claimable, 'misión lista', 'misiones listas')} para reclamar.` : v.missions.length ? `Hoy llevamos ${done} de ${v.missions.length} misiones.` : 'Cada día traigo misiones nuevas.';
  const next = upcomingMine()[0];
  const sub = next ? `Tu próxima partida: «${next.title}».` : nAvail ? `${plural(nAvail, 'persona está disponible', 'personas están disponibles')} para jugar ahora.` : 'Todo está en calma. Buen momento para agendar algo con tu squad.';
  return `<section class="home-hero card">
    <div class="hh-copy">
      <span class="eyebrow">${state.demo ? 'Modo demostración' : 'Tu centro de mando'}</span>
      <h2>${greeting(new Date().getHours())}, ${e(name)}</h2>
      <p>${e(sub)}</p>
      <div class="hh-actions">
        ${btn('set-available', `${icon('circle-dot', 17)} Estoy disponible`, 'btn btn-primary btn-lg')}
        ${btn('nav', `${icon('user-round-search', 17)} Buscar equipo`, 'btn btn-soft btn-lg', 'data-id="play"')}
        ${btn('vora-session', `${icon('timer', 17)} Sesión con ${e(v.name)}`, 'btn btn-ghost btn-lg')}
      </div>
    </div>
    <div class="hh-vora" data-mood="${e(v.hidden ? 'sleepy' : v.mood)}" data-acc="${e(v.accessory || 'none')}" data-eyes="${e(v.eyes || 'classic')}" data-mouth="${e(v.mouth || 'smile')}" data-ears="${e(v.ears || 'crest')}" data-shell="${e(v.shell || 'hex')}" style="--vora-a:${pal.a};--vora-b:${pal.b};--vora-rgb:${pal.rgb}">
      <div class="hv-stage">${avatarSvg('home')}</div>
      <div class="hv-card">
        <div class="row between"><b>${e(v.name)}</b><span class="chip accent">Nivel ${v.level.level}</span></div>
        <p>${v.hidden ? 'Está descansando. Puedes llamarlo cuando quieras.' : e(line)}</p>
        ${progress(v.level.pct, 'Progreso de nivel')}
        <div class="hv-foot"><small>${v.level.into}/${v.level.need} XP · racha ${v.streak}</small>${v.hidden ? btn('vora-show', 'Llamar', 'btn btn-primary btn-sm') : btn('vora-open', `${icon('message-circle', 15)} Hablar`, 'btn btn-soft btn-sm')}</div>
      </div>
    </div>
  </section>`;
}

function upcomingMine() {
  const rs = d().session_rsvps || [];
  return (d().play_sessions || []).filter(s => ['upcoming', 'soon', 'live'].includes(sessionState(s)) && rs.some(r => r.session_id === s.id && r.user_id === state.user.id && r.status !== 'no'))
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
}

function awayHtml(summary) {
  if (!summary?.lines?.length) return '';
  const go = { squad: l => `data-action="open-squad" data-id="${e(l.id)}"`, dm: () => 'data-action="open-dms"', posts: () => 'data-action="nav" data-id="communities"', sessions: () => 'data-action="open-agenda"' };
  return `<section class="card card-pad away-card"><div class="row between"><div class="row">${icon('bot', 20)}<h3>Mientras no estabas</h3></div>${btn('dismiss-away', 'Listo', 'btn btn-ghost btn-sm')}</div>
    <ul class="away-list">${summary.lines.map(l => `<li><button class="away-row" ${go[l.kind](l)}>${icon({ squad: 'users-round', dm: 'messages-square', posts: 'newspaper', sessions: 'calendar-clock' }[l.kind], 16)}<span>${e(l.text)}</span>${icon('chevron-right', 15)}</button></li>`).join('')}</ul></section>`;
}

function annivHtml() {
  return anniversaries(d().squads, d().squad_members, state.user.id).map(a => `<section class="card card-pad anniv-card"><div class="row">${icon('party-popper', 22)}<span class="eyebrow">Aniversario de squad</span></div><h3>${e(a.text)}</h3><p class="card-desc">Las mejores partidas son las que se juegan con la misma gente. ¿Lo celebran?</p><div class="row wrap">${btn('anniv-memory', `${icon('images', 15)} Guardar un recuerdo`, 'btn btn-primary btn-sm', `data-id="${e(a.squad.id)}"`)}${btn('schedule-session', `${icon('calendar-plus', 15)} Agendar partida de festejo`, 'btn btn-soft btn-sm', `data-id="${e(a.squad.id)}"`)}</div></section>`).join('');
}
function guideHtml() {
  const n = (d().guide_requests || []).filter(r => r.guide_id === state.user.id && r.status === 'pending').length;
  if (!n) return '';
  return `<section class="card card-pad guide-alert"><div class="row">${icon('hand-heart', 20)}<span class="eyebrow">Modo primer día</span></div><h3>${n === 1 ? 'Alguien te pidió ser su guía' : `${n} personas te pidieron ser su guía`}</h3><p class="card-desc">Acompañar a quien empieza es de lo más valioso de la comunidad. Con 3 ayudas útiles ganas la insignia «Mentor GG».</p>${btn('open-guides', 'Ver solicitudes', 'btn btn-primary btn-sm')}</section>`;
}
function rateHtml() {
  const rs = d().session_rsvps || [], given = d().chemistry_ratings || [];
  const pending = (d().play_sessions || []).filter(s => {
    const mates = rateableMates(s, rs, state.user.id);
    return mates.length && sessionState(s) === 'ended' && mates.some(u => !given.some(g => g.session_id === s.id && g.ratee_id === u));
  }).slice(0, 1);
  if (!pending.length) return '';
  const s = pending[0];
  return `<section class="card card-pad rate-card"><span class="eyebrow">Química de equipo</span><h3>¿Cómo te fue en «${e(s.title)}»?</h3><p class="card-desc">Califica en 5 segundos con quién te entendiste. Es privado: nadie ve quién dio cada etiqueta, solo suma al Pasaporte GG.</p>${btn('rate-session', `${icon('handshake', 16)} Calificar ahora`, 'btn btn-primary btn-sm', `data-id="${e(s.id)}"`)}</section>`;
}

function agendaHtml() {
  const list = upcomingMine().slice(0, 3);
  return `<section class="card card-pad home-card"><div class="row between"><h3>Tus próximas partidas</h3>${btn('schedule-session', `${icon('calendar-plus', 15)} Agendar`, 'btn btn-ghost btn-sm')}</div>
    <div class="stack">${list.map(s => sessionCard(s, { compact: true })).join('') || '<p class="muted small">No tienes partidas agendadas. Propón una a tu squad: todos confirman y pueden añadirla a su calendario.</p>'}</div></section>`;
}

function availableHtml() {
  const now = Date.now();
  const list = (d().availability || []).filter(a => a.user_id !== state.user.id && availabilityActive(a, now) && !isBlocked(a.user_id));
  const friends = list.filter(a => isFollowing(a.user_id) || d().squad_members.some(m => m.user_id === a.user_id && squadMember(m.squad_id)));
  const show = (friends.length ? friends : list).slice(0, 5);
  return `<section class="card card-pad home-card"><div class="row between"><h3>Disponibles ahora</h3>${btn('nav', 'Ver todos', 'btn btn-ghost btn-sm', 'data-id="play"')}</div>
    ${show.length ? `<div class="avail-faces">${show.map(a => `<button class="avail-face" data-action="view-user" data-id="${e(a.user_id)}" title="${e(getProfile(a.user_id).display_name)}">${avatar(getProfile(a.user_id), 'md')}<span class="avail-dot" aria-hidden="true"></span><small>${e(getProfile(a.user_id).display_name)}</small></button>`).join('')}</div><p class="muted small">${friends.length ? 'De tus squads y personas que sigues.' : 'Personas de la comunidad buscando partida.'}</p>` : '<p class="muted small">Nadie está disponible ahora. Márcate tú y avisaremos a tu gente.</p>'}</section>`;
}

function feedHtml() {
  const following = new Set(d().follows.filter(f => f.follower_id === state.user.id).map(f => f.followed_id));
  const myComms = new Set(d().community_members.filter(m => m.user_id === state.user.id).map(m => m.community_id));
  const mates = new Set(d().squad_members.filter(m => squadMember(m.squad_id)).map(m => m.user_id));
  const rank = p => (mates.has(p.author_id) ? 3 : 0) + (following.has(p.author_id) ? 2 : 0) + (p.community_id && myComms.has(p.community_id) ? 1 : 0);
  const posts = [...d().posts].filter(p => !isBlocked(p.author_id)).sort(byDate)
    .sort((a, b) => (rank(b) > 0) - (rank(a) > 0)).slice(0, FEED_LIMIT);
  return `<div class="feed-main">${composer()}<div class="stack-lg">${posts.map(postCard).join('')}</div>
    <div class="feed-end">${icon('circle-check', 22)}<b>Estás al día</b><span>Sin scroll infinito: lo demás vive en tus comunidades.</span>${btn('nav', 'Ir a Comunidades', 'btn btn-soft btn-sm', 'data-id="communities"')}</div></div>`;
}

function missionsHtml(v) {
  const all = v.missions.length && v.missions.every(m => m.done);
  return `<section class="card card-pad home-card">
    <div class="row between"><div><h3>Misiones de hoy</h3><p class="card-desc">Se renuevan cada día.</p></div>${chip(all ? '¡Todas listas!' : '+20 XP con las 3', all ? 'ok' : '')}</div>
    <ul class="missions">${v.missions.map(m => {
      const pct = (m.progress / m.goal) * 100;
      const action = m.claimed ? `<span class="chip ok">${icon('check', 13)} Reclamada</span>` : m.done ? btn('mission-claim', `Reclamar +${m.xp} XP`, 'btn btn-primary btn-sm', `data-id="${e(m.id)}"`) : btn('mission-go', 'Ir', 'btn btn-soft btn-sm', `data-id="${e(m.id)}"`);
      return `<li class="mission ${m.done ? 'done' : ''}"><span class="m-ic">${icon(m.icon || 'sparkles', 18)}</span><div class="grow"><b>${e(m.label)}</b>${progress(pct, m.label)}<small>${m.progress}/${m.goal} · ${m.xp} XP</small></div>${action}</li>`;
    }).join('') || '<li class="muted small">Las misiones aparecerán en unos segundos.</li>'}</ul>
  </section>`;
}

function firstStepsHtml() {
  const p = me();
  const steps = [
    ['Elige tu idioma y completa tu perfil', Boolean(p.bio && p.language), 'edit-profile', 'languages'],
    ['Agrega 3 juegos a tu biblioteca', myGames().length >= 3, 'nav-games', 'gamepad-2'],
    ['Márcate disponible una vez', (d().availability || []).some(a => a.user_id === state.user.id) || state.flags?.wasAvailable, 'set-available', 'circle-dot'],
    ['Únete a un squad', d().squad_members.some(m => m.user_id === state.user.id), 'nav:squads', 'users-round'],
    ['Confirma una partida', (d().session_rsvps || []).some(r => r.user_id === state.user.id && r.status === 'going'), 'open-agenda', 'calendar-check']
  ];
  const n = steps.filter(s => s[1]).length;
  if (n === steps.length) return '';
  return `<section class="card card-pad home-card"><div class="row between"><h3>Primeros pasos</h3><span class="chip accent">${n}/${steps.length}</span></div>${progress(n / steps.length * 100, 'Primeros pasos')}
    <ul class="steps-list">${steps.map(([label, ok, act, ic]) => {
      const [a, id] = act.split(':');
      return `<li class="${ok ? 'ok' : ''}"><span>${icon(ok ? 'circle-check' : ic, 18)}</span><b>${e(label)}</b>${ok ? '' : btn(a, 'Hacer', 'btn btn-soft btn-sm', id ? `data-id="${id}"` : '')}</li>`;
    }).join('')}</ul></section>`;
}

export function rankMatches(limit = 3) {
  const chem = new Map((d()._chemistry || []).map(c => [c.other_id, c]));
  return d().profiles.filter(p => p.id !== state.user.id && p.looking_for !== false && !isBlocked(p.id))
    .map(p => {
      const m = compatibility(me(), p, myGames(), theirGames(p.id));
      const b = chemistryBonus(chem.get(p.id));
      return { ...p, match: b ? { ...m, score: Math.min(100, m.score + b.bonus), why: [b.why, ...m.why] } : m };
    })
    .sort((a, b) => b.match.score - a.match.score).slice(0, limit);
}
function matchesHtml() {
  const list = rankMatches(3);
  return `<section class="card card-pad home-card">
    <div class="row between"><h3>Compañeros para ti</h3>${btn('nav', 'Jugar', 'btn btn-ghost btn-sm', 'data-id="play"')}</div>
    <div class="match-list">${list.map(p => `<div class="match-row">${avatar(p, 'md')}<div class="grow"><button class="link" data-action="view-user" data-id="${e(p.id)}">${e(p.display_name)}</button><small class="clamp1">${e(p.match.why.slice(0, 2).join(' · '))}</small></div>${ring(p.match.score, `${p.match.score}% compatible`, 44)}${dmButton(p)}</div>`).join('') || '<p class="muted small">Cuando haya más gente buscando equipo aparecerá aquí.</p>'}</div>
  </section>`;
}

export function viewHome({ vora, away }) {
  const v = vora;
  const nAvail = (d().availability || []).filter(a => a.user_id !== state.user.id && availabilityActive(a) && !isBlocked(a.user_id)).length;
  return `${noV6()}${heroHtml(v, nAvail)}
  <div class="home-grid"><div class="home-col">${secondChanceCard()}${awayHtml(away)}${annivHtml()}${guideHtml()}${rateHtml()}${myAvailability()}${feedHtml()}</div>
  <div class="home-col">${agendaHtml()}${availableHtml()}${firstStepsHtml()}${matchesHtml()}${radarCard()}${missionsHtml(v)}
    <section class="card card-pad home-card code-card"><h3>El código GAMVORAQ</h3><ol><li>Respeta a los demás, en cualquier idioma.</li><li>Ayuda a quien está aprendiendo.</li><li>Cumple cuando confirmas una partida.</li><li>Reporta sin crear conflictos.</li></ol></section></div></div>`;
}
