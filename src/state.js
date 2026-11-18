// Estado global y selectores compartidos por las vistas.
export const state = {
  demo: false, user: null, data: null, tab: 'home', modal: '', authMode: 'login', loading: false,
  selectedUser: null, selectedSquad: null, selectedChannel: null, selectedConversation: null, selectedCommunity: null,
  squadsView: 'mine', squadPane: 'chat', msgSearch: '', chatSearch: '', dmCheck: {}, health: null, radar: null, communityPane: 'posts', prevTab: 'home',
  search: '', filter: '', profileTab: 'posts', gameGenre: '', syncFilter: 'all',
  busy: false, online: true, stale: null, pendingCount: 0, installable: false, updateReady: false, composeDraft: '',
  accent: 'crimson', palette: false, showPass: false, menuOpen: false,
  privateOk: null, away: null, flags: {},
  communitiesView: 'list', selectedLeague: null, guideGame: '', guideAsk: null, memoryPrefill: null,
  coachOut: null, steamOut: '', familyData: null, availMode: 'normal', exhausted: {}, aiOn: false, push: { available: false, on: false, text: '' }
};

// v6: cinco secciones. «notifications» existe como ruta, pero se abre desde la campana.
export const NAV = [
  ['home', 'house', 'Inicio'], ['play', 'gamepad-2', 'Jugar'], ['messages', 'message-circle', 'Mensajes'], ['squads', 'users-round', 'Squads'],
  ['communities', 'compass', 'Comunidades'], ['profile', 'user-round', 'Perfil']
];
export const ROUTES = [...NAV, ['notifications', 'bell', 'Avisos'], ['admin', 'shield-alert', 'Moderación']];
export const TITLES = Object.fromEntries(ROUTES.map(([id, , label]) => [id, label]));
export const SUBTITLES = {
  home: 'Lo que pasa con tu gente hoy', play: 'Con quién jugar ahora o más tarde', squads: 'Chat, agenda y recuerdos',
  communities: 'Grupos por juego o tema', profile: 'Tu identidad gamer', notifications: 'Lo que te perdiste',
  messages: 'Chats privados con traducción', admin: 'Reportes, pausas y normas'
};
// Rutas antiguas (enlaces guardados de la v5) → sección nueva.
export const LEGACY_TABS = { feed: 'home', sync: 'play', people: 'play', pulse: 'play', universe: 'home', memories: 'squads', dms: 'messages', chronicles: 'communities', quests: 'communities', channels: 'communities', games: 'profile', gallery: 'profile', guardian: 'profile' };

export const d = () => state.data || {};
export const getProfile = id => d().profiles?.find(p => p.id === id) || { id, username: 'gamer', display_name: 'Gamer' };
export const me = () => getProfile(state.user?.id);
export const game = id => d().games?.find(g => String(g.id) === String(id));
export const member = (id, user = state.user?.id) => d().community_members?.some(m => m.community_id === id && m.user_id === user);
export const staff = id => d().community_members?.some(m => m.community_id === id && m.user_id === state.user?.id && ['owner', 'moderator'].includes(m.role));
export const squadMember = (id, user = state.user?.id) => d().squad_members?.some(m => m.squad_id === id && m.user_id === user);
export const squadStaff = id => d().squads?.find(s => s.id === id)?.owner_id === state.user?.id;
export const isFollowing = id => d().follows?.some(f => f.follower_id === state.user?.id && f.followed_id === id);
export const isBlocked = id => d().blocks?.some(b => (b.blocker_id === state.user?.id && b.blocked_id === id) || (b.blocked_id === state.user?.id && b.blocker_id === id));
export const myGames = () => d().user_games?.filter(g => g.user_id === state.user?.id).map(g => g.game_id) || [];
export const theirGames = id => d().user_games?.filter(g => g.user_id === id).map(g => g.game_id) || [];
export const byDate = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));
export const unreadCount = () => (d().notifications || []).filter(n => n.user_id === state.user?.id && !n.read_at).length;
// Los recuerdos ya no necesitan aprobación (migración 017): no hay pendientes.
export const pendingMemoryCount = () => 0;
