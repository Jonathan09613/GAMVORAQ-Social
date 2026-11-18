// Perfil: identidad gamer, Pasaporte GG, biblioteca de juegos, galería e insignias. Y la vista de avisos.
import { e, icon, avatar, ago, chip, btn, safeUrl, hueFor } from '../ui.js';
import { state, d, getProfile, game, myGames, theirGames, isBlocked, byDate } from '../state.js';
import { LANG_NAME } from '../translate.js';
import { availabilityActive, remainingLabel } from '../features.js';
import { postCard, seg, sectionHead, passportCard, tagChips, dmButton, followButton, empty, secondChanceCard } from './components.js';
import { gameArt, followsMe } from '../v11.js';
import { followPane } from '../v12.js';

function library(own, userId) {
  if (!own) {
    const games = theirGames(userId).map(id => game(id)).filter(Boolean);
    const mine = new Set(myGames().map(String));
    return `<div class="card card-pad"><h3>Biblioteca gamer</h3>${games.length ? `<div class="cover-grid">${games.map(g => `<div class="cover-tile">${gameArt(g)}<span>${e(g.name)}</span>${mine.has(String(g.id)) ? `<small class="chip ok">En común</small>` : ''}</div>`).join('')}</div>` : '<p class="muted small">Sin juegos añadidos.</p>'}</div>`;
  }
  const term = state.search.toLowerCase();
  const genres = [...new Set(d().games.map(g => g.genre).filter(Boolean))].sort();
  const mineSet = new Set(myGames().map(String));
  let games = d().games.filter(g => (g.name + ' ' + (g.genre || '')).toLowerCase().includes(term));
  if (state.gameGenre) games = games.filter(g => g.genre === state.gameGenre);
  games.sort((a, b) => (mineSet.has(String(b.id)) - mineSet.has(String(a.id))) || a.name.localeCompare(b.name));
  return `<div class="steam-row card"><span class="steam-ic">${icon('download', 20)}</span><div class="grow"><b>Importa tu biblioteca de Steam</b><small class="muted">Agrega en segundos los juegos que tienes y juegas. Tu perfil de Steam debe tener los juegos en público.</small></div>${btn('steam-import', 'Importar', 'btn btn-primary btn-sm')}</div>
  <p class="muted small" style="margin-bottom:12px">Tus juegos ayudan a encontrar gente compatible en Jugar. Tienes ${mineSet.size} en tu biblioteca.</p>
  <form class="search-row" data-form="search" role="search"><label class="searchfield">${icon('search', 17)}<input class="input" name="term" value="${e(state.search)}" placeholder="Busca un juego o género" aria-label="Buscar juego"></label><button class="btn btn-primary" type="submit">Buscar</button></form>
  <div class="pills" role="group" aria-label="Filtrar por género">${btn('game-genre', 'Todos', 'pill ' + (!state.gameGenre ? 'on' : ''), 'data-id=""')}${genres.map(g => btn('game-genre', e(g), 'pill ' + (state.gameGenre === g ? 'on' : ''), `data-id="${e(g)}"`)).join('')}</div>
  <div class="grid-3">${games.slice(0, 60).map(g => {
    const own_ = mineSet.has(String(g.id));
    return `<div class="card game-card ${own_ ? 'own' : ''}" style="--h:${hueFor(g.genre || g.name)}">${gameArt(g)}${state.isAdmin ? btn('game-image', icon('image-up', 14), 'btn btn-ghost btn-sm btn-icon game-img-btn', `data-id="${g.id}" title="Cambiar portada" aria-label="Cambiar portada de ${e(g.name)}"`) : ''}<div class="grow"><h3 class="card-heading">${e(g.name)}</h3><div class="card-desc">${e(g.genre || 'Videojuego')} · ${e(g.platform || '')}</div></div>${btn('toggle-game', own_ ? icon('check', 16) : icon('plus', 16), own_ ? 'btn btn-soft btn-sm btn-icon on' : 'btn btn-primary btn-sm btn-icon', `data-id="${g.id}" title="${own_ ? 'Quitar de mi biblioteca' : 'Agregar a mi biblioteca'}" aria-label="${own_ ? 'Quitar' : 'Agregar'} ${e(g.name)}" aria-pressed="${own_}"`)}</div>`;
  }).join('') || `<div style="grid-column:1/-1">${empty('No hay juegos con esa búsqueda.', 'gamepad-2')}</div>`}</div>`;
}

function gallery(userId, own) {
  const images = d().gallery.filter(g => g.user_id === userId).sort(byDate);
  return `${own ? sectionHead('Mis fotografías', btn('add-gallery', `${icon('camera', 15)} Subir imagen`, 'btn btn-primary btn-sm')) : ''}${images.length ? `<div class="gallery-grid">${images.map(g => `<figure><img loading="lazy" src="${safeUrl(g.url)}" alt="${e(g.caption)}"><figcaption>${e(g.caption)}${own ? btn('delete-gallery', icon('x', 14), 'btn btn-ghost btn-sm btn-icon', `data-id="${e(g.id)}" aria-label="Quitar foto"`) : ''}</figcaption></figure>`).join('')}</div>` : empty('Todavía no hay fotografías.', 'images')}`;
}

export function viewProfile() {
  const p = getProfile(state.selectedUser || state.user.id), own = p.id === state.user.id;
  if (!own && isBlocked(p.id)) return `${btn('nav', `${icon('arrow-left', 15)} Volver`, 'link back-link', 'data-id="play"')}${empty('No puedes ver este perfil porque hay un bloqueo entre ustedes.', 'ban', own ? '' : btn('unblock-user', 'Desbloquear', 'btn btn-soft btn-sm', `data-id="${e(p.id)}"`))}`;
  const followers = d().follows.filter(x => x.followed_id === p.id).length, following = d().follows.filter(x => x.follower_id === p.id).length;
  const badges = d().badges.filter(x => x.user_id === p.id);
  const avail = (d().availability || []).find(a => a.user_id === p.id);
  const tab = state.profileTab || 'posts';
  const passport = (d()._passport || {})[p.id];
  const squads = d().squad_members.filter(x => x.user_id === p.id).map(x => d().squads.find(s => s.id === x.squad_id)?.name).filter(Boolean);
  const tabs = [['posts', 'Publicaciones'], ['games', own ? 'Mis juegos' : 'Juegos'], ['followers', 'Seguidores', followers], ['following', 'Siguiendo', following], ['gallery', 'Galería'], ['badges', 'Insignias']];
  const body = tab === 'games' ? library(own, p.id) : tab === 'followers' || tab === 'following' ? followPane(p.id, tab) : tab === 'gallery' ? gallery(p.id, own)
    : tab === 'badges' ? `<div class="card card-pad"><h3>Reconocimientos</h3><div class="badge-shelf">${badges.map(x => `<div class="badge-item ${x.kind && x.kind !== 'quest' ? 'special' : ''}">${icon({ guide: 'hand-heart', conduct: 'heart-handshake' }[x.kind] || 'award', 22)}<span>${e(x.name)}</span></div>`).join('') || '<p class="muted small">Aún no tiene insignias. Se ganan en los retos de las comunidades.</p>'}</div></div>`
    : `<div class="stack-lg">${d().posts.filter(x => x.author_id === p.id).sort(byDate).map(postCard).join('') || empty('Todavía no hay publicaciones.', 'message-square')}</div>`;
  return `${!own ? `<button class="link back-link" data-action="back">${icon('arrow-left', 15)} Volver</button>` : secondChanceCard()}
  <div class="profile-layout"><div class="card profile"><div class="profile-banner" style="--h:${hueFor(p.username)}">${p.cover_url ? `<img class="cover-photo" src="${safeUrl(p.cover_url)}" alt="Portada del perfil">` : ''}</div>
    <div class="profile-main"><div class="profile-top">${avatar(p, 'xl')}<div class="row wrap">${own ? btn('edit-profile', `${icon('pencil', 15)} Editar perfil`, 'btn btn-soft btn-sm') + btn('settings', `${icon('settings', 15)} Ajustes`, 'btn btn-ghost btn-sm') : dmButton(p, 'Mensaje') + followButton(p) + btn('block-user', `${icon('ban', 14)} Bloquear`, 'btn btn-ghost btn-sm', `data-id="${e(p.id)}"`) + btn('report', icon('flag', 14), 'btn btn-ghost btn-sm btn-icon', `data-kind="user" data-id="${e(p.id)}" title="Reportar perfil" aria-label="Reportar perfil"`)}</div></div>
    <h2>${e(p.display_name)}</h2><div class="muted small">@${e(p.username)}${p.region ? ' · ' + e(p.region) : ''} · ${icon('languages', 13)} habla ${e(LANG_NAME[p.language || 'es'] || 'español')}</div>
    ${availabilityActive(avail) ? `<div class="chip ok live-chip"><span class="avail-dot" aria-hidden="true"></span>Disponible: ${e(game(avail.game_id)?.name || 'cualquier juego')} · ${e(remainingLabel(avail.until))}</div>` : ''}
    <p class="bio">${e(p.bio || 'Este perfil aún no tiene biografía.')}</p>
    ${!own && followsMe(p.id) ? `<div class="chip accent follows-you">${icon('user-check', 12)} Te sigue</div>` : ''}
    <div class="profile-stats"><button class="stat-link" data-action="profile-tab" data-id="followers"><b>${followers}</b> seguidores</button><button class="stat-link" data-action="profile-tab" data-id="following"><b>${following}</b> siguiendo</button><span><b>${theirGames(p.id).length}</b> juegos</span><span><b>${badges.length}</b> insignias</span></div>
    <div class="meta">${chip(p.platform || 'Multiplataforma')}${chip(p.play_style || 'Casual')}${chip(p.schedule || 'Variable')}${chip(p.mic_preference || 'Indistinto')}${p.looking_for ? chip('Buscando equipo', 'ok') : ''}${tagChips(p.play_tags, 8)}</div>
    ${squads.length ? `<p class="muted small" style="margin-top:10px">${icon('users-round', 13)} Squads: ${e(squads.join(' · '))}</p>` : ''}</div></div>
    ${passportCard(p.id, passport, { own })}</div>
  ${seg('profile-tab', tabs, tab, 'Secciones del perfil')}${body}`;
}

const NOTICE_ICON = { follow: 'user-plus', message: 'message-circle', squad_message: 'messages-square', quest: 'trophy', quest_review: 'clipboard-check', memory: 'images', session: 'calendar-days', squad: 'users-round', squad_invite: 'mail', test: 'bell-ring', system: 'bell' };
/** Acción rápida dentro del aviso (sin abrirlo). */
function noticeAction(x) {
  if (x.kind === 'follow' && x.actor_id && !d().follows.some(f => f.follower_id === state.user.id && f.followed_id === x.actor_id) && x.actor_id !== state.user.id)
    return btn('follow', `${icon('user-plus', 14)} Seguir también`, 'btn btn-primary btn-sm', `data-id="${e(x.actor_id)}"`);
  if (x.kind === 'squad_invite' && (d().squad_invites || []).some(i => i.squad_id === x.ref_id && i.user_id === state.user.id))
    return btn('squad-invite-accept', 'Aceptar', 'btn btn-primary btn-sm', `data-id="${e(x.ref_id)}"`) + btn('squad-invite-decline', 'Rechazar', 'btn btn-ghost btn-sm', `data-id="${e(x.ref_id)}"`);
  if (x.kind === 'quest_review') return btn('review-quest', 'Revisar', 'btn btn-soft btn-sm', `data-id="${e(x.ref_id)}"`);
  return '';
}
export function viewNotifications() {
  const n = d().notifications.filter(x => x.user_id === state.user.id).sort(byDate);
  return `<section class="page-intro"><div><span class="eyebrow">AVISOS</span><h2>Lo que te perdiste</h2><p>Seguidores, mensajes, partidas e insignias.</p></div><div class="intro-actions">${btn('read-all', `${icon('check-check', 16)} Marcar leídas`, 'btn btn-soft btn-sm')}</div></section>
  <div class="notices">${n.map(x => { const act = noticeAction(x); return `<div class="card notice ${x.read_at ? '' : 'unread'}"><button class="notice-main" data-action="open-notice" data-id="${e(x.id)}"><span class="notice-ic">${x.actor_id ? avatar(getProfile(x.actor_id), 'sm') : icon(NOTICE_ICON[x.kind] || 'bell', 18)}</span><div class="grow"><strong>${e(x.body)}</strong><small>${e(ago(x.created_at))}</small></div>${x.read_at ? '' : '<i class="dot-new" aria-label="Sin leer"></i>'}</button>${act ? `<div class="notice-actions">${act}</div>` : ''}</div>`; }).join('') || empty('No hay notificaciones nuevas.', 'bell')}</div>`;
}
