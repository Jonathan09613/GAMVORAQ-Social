// Ligas locales: por escuela, universidad, ciudad o comunidad. Squads contra squads, con tabla y calendario.
import { e, icon, chip, btn, hueFor, empty } from '../ui.js';
import { state, d, game } from '../state.js';
import { standings, LEAGUE_SCOPES, LEAGUE_STATUS, whenLabel } from '../features.js';

const SCOPE = Object.fromEntries(LEAGUE_SCOPES);
const squadName = id => d().squads.find(s => s.id === id)?.name || 'Squad';
const myOwnedSquads = () => d().squad_members.filter(m => m.user_id === state.user.id && m.role === 'owner').map(m => m.squad_id);

function leagueCard(l) {
  const teams = d().league_teams.filter(t => t.league_id === l.id).length;
  const mine = d().league_teams.some(t => t.league_id === l.id && d().squad_members.some(m => m.squad_id === t.squad_id && m.user_id === state.user.id));
  return `<div class="card item" style="--h:${hueFor(l.name)}"><div class="community-art">${icon('trophy', 24)}</div><div class="grow"><button class="link card-heading" data-action="view-league" data-id="${e(l.id)}">${e(l.name)}</button>
    <p class="card-desc">${e(SCOPE[l.scope] || 'Liga')}${l.place ? ` · ${e(l.place)}` : ''}${l.game_id ? ` · ${e(game(l.game_id)?.name || '')}` : ''}</p>
    <div class="meta">${chip(LEAGUE_STATUS[l.status], l.status === 'inscripciones' ? 'ok' : l.status === 'en_curso' ? 'accent' : '')}${chip(teams + ' squads')}${mine ? chip('Tu squad participa', 'ok') : ''}${l.owner_id === state.user.id ? chip('Organizas', 'accent') : ''}</div></div>
    ${btn('view-league', 'Ver', 'btn btn-primary btn-sm', `data-id="${e(l.id)}"`)}</div>`;
}

function detail(l) {
  const own = l.owner_id === state.user.id;
  const teams = d().league_teams.filter(t => t.league_id === l.id).map(t => t.squad_id);
  const matches = d().league_matches.filter(m => m.league_id === l.id).sort((a, b) => a.round - b.round || String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  const table = standings(teams, matches, squadName);
  const owned = myOwnedSquads(), canRegister = l.status === 'inscripciones' ? owned.filter(id => !teams.includes(id)) : [];
  const myTeams = new Set(d().squad_members.filter(m => m.user_id === state.user.id).map(m => m.squad_id));
  const rounds = [...new Set(matches.map(m => m.round))];
  return `<button class="link back-link" data-action="clear-league">${icon('arrow-left', 15)} Todas las ligas</button>
  <section class="card community-hero" style="--h:${hueFor(l.name)}"><div class="community-art lg">${icon('trophy', 30)}</div><div class="grow"><span class="eyebrow">${e(SCOPE[l.scope] || 'Liga')}${l.place ? ' · ' + e(l.place) : ''}</span><h2>${e(l.name)}</h2><p class="card-desc">${e(l.description || '')}</p>
    <div class="meta">${chip(LEAGUE_STATUS[l.status], l.status === 'en_curso' ? 'accent' : 'ok')}${l.game_id ? chip(game(l.game_id)?.name || 'Juego') : ''}${chip(teams.length + ' squads')}</div></div>
    <div class="stack">${canRegister.length ? btn('league-register', `${icon('plus', 15)} Inscribir mi squad`, 'btn btn-primary btn-sm', `data-id="${e(l.id)}"`) : ''}
      ${own && l.status === 'inscripciones' ? btn('league-start', `${icon('calendar-days', 15)} Generar calendario`, 'btn btn-primary btn-sm', `data-id="${e(l.id)}" ${teams.length < 2 ? 'disabled title="Hacen falta al menos 2 squads"' : ''}`) : ''}
      ${own && l.status === 'en_curso' ? btn('league-finish', 'Terminar liga', 'btn btn-soft btn-sm', `data-id="${e(l.id)}"`) : ''}</div></section>
  <div class="league-grid"><section class="card card-pad"><h3>Tabla</h3>
    ${table.length ? `<div class="table-wrap"><table class="standings"><thead><tr><th>#</th><th>Squad</th><th title="Partidos jugados">PJ</th><th title="Ganados">G</th><th title="Empatados">E</th><th title="Perdidos">P</th><th title="Diferencia">Dif</th><th>Pts</th></tr></thead>
    <tbody>${table.map((r, i) => `<tr class="${myTeams.has(r.id) ? 'mine' : ''}"><td>${i + 1}</td><td><button class="link" data-action="open-squad-public" data-id="${e(r.id)}">${e(r.name)}</button></td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf - r.gc > 0 ? '+' : ''}${r.gf - r.gc}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="muted tiny">3 puntos por victoria y 1 por empate. Desempate por diferencia.</p>` : empty('Aún no hay squads inscritos.', 'users-round')}</section>
  <section class="card card-pad"><h3>Calendario</h3>${rounds.length ? rounds.map(r => `<h4 class="pane-sub">Ronda ${r}</h4><div class="stack">${matches.filter(m => m.round === r).map(m => `<div class="match-row-l ${myTeams.has(m.home_squad) || myTeams.has(m.away_squad) ? 'mine' : ''}"><span class="mt">${e(squadName(m.home_squad))}</span>
      <b class="score">${m.status === 'played' ? `${m.home_score} - ${m.away_score}` : 'vs'}</b><span class="mt right">${e(squadName(m.away_squad))}</span>
      <small class="muted">${m.scheduled_at ? e(whenLabel(m.scheduled_at)) : 'Fecha por definir'}</small>${own && l.status !== 'terminada' ? btn('league-result', m.status === 'played' ? 'Corregir' : 'Resultado', 'btn btn-ghost btn-sm', `data-id="${e(m.id)}"`) : ''}</div>`).join('')}</div>`).join('')
    : `<p class="muted small">${l.status === 'inscripciones' ? 'Cuando cierren las inscripciones, quien organiza genera el calendario: todos contra todos.' : 'Sin partidos.'}</p>`}</section></div>
  <div class="banner info">${icon('shield-check', 16)}<span>Las ligas no piden ubicación exacta: solo un nombre de escuela, ciudad o comunidad. Quien organiza registra los resultados y ambos squads reciben el aviso.</span></div>`;
}

export function viewLeagues() {
  const l = d().leagues.find(x => x.id === state.selectedLeague);
  if (l) return detail(l);
  const list = [...d().leagues].sort((a, b) => (a.status === 'terminada') - (b.status === 'terminada') || String(b.created_at).localeCompare(String(a.created_at)));
  return `<div class="row between pane-head"><p class="muted small">Ligas amistosas entre squads de tu escuela, universidad, ciudad o comunidad. Patrocinios locales bienvenidos.</p>${btn('create-league', `${icon('plus', 15)} Crear liga`, 'btn btn-primary btn-sm')}</div>
  <div class="cards-list">${list.map(leagueCard).join('') || empty('Todavía no hay ligas. ¡Organiza la primera de tu escuela o ciudad!', 'trophy')}</div>`;
}
