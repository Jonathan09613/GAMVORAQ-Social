import { supabase, must } from './client.js';

const ORIGIN = globalThis.location?.origin || '';
const ago = ms => new Date(Date.now() - ms).toISOString();
const ahead = ms => new Date(Date.now() + ms).toISOString();
const MIN = 60000, H = 3600000, D = 86400000;
const yearsAgo = n => { const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setHours(d.getHours() - 2); return d.toISOString(); };

// Datos de demostración (no se guardan). Sirven para explorar la app sin cuenta.
export const demoData = {
  profiles: [
    { id: 'd1', username: 'nova', display_name: 'Nova', bio: 'Valorant, amistad y buenas partidas. Aquí se juega sin toxicidad.', platform: 'PC', play_style: 'Casual', mic_preference: 'Con micrófono', schedule: 'Noche', region: 'México', looking_for: true, language: 'es' },
    { id: 'd2', username: 'pixel', display_name: 'Pixel', bio: 'Explorando mundos de Minecraft y construyendo con amigos.', platform: 'PC', play_style: 'Casual', mic_preference: 'Con micrófono', schedule: 'Noche', region: 'México', looking_for: true },
    { id: 'd3', username: 'akira', display_name: 'Akira', bio: 'Nos gustan los retos cooperativos y reírnos en equipo.', platform: 'PlayStation', play_style: 'Competitivo', mic_preference: 'Indistinto', schedule: 'Tarde', region: 'Chile', looking_for: true },
    { id: 'd4', username: 'luna', display_name: 'Luna', bio: 'Cero dramas, mucha aventura y GG siempre.', platform: 'PC', play_style: 'Casual', mic_preference: 'Con micrófono', schedule: 'Noche', region: 'México', looking_for: true },
    { id: 'd5', username: 'orion', display_name: 'Orion', bio: 'Main support. Si necesitas curación, aquí estoy.', platform: 'PC', play_style: 'Ambos', mic_preference: 'Con micrófono', schedule: 'Noche', region: 'Colombia', looking_for: true },
    { id: 'd6', username: 'kira', display_name: 'Kira', bio: 'Cozy gamer: granjas, café y música lofi.', platform: 'Nintendo', play_style: 'Casual', mic_preference: 'Sin micrófono', schedule: 'Tarde', region: 'Argentina', looking_for: true, play_tags: ['sin_presion', 'paciencia'] },
    { id: 'd7', username: 'zeta', display_name: 'Zeta', bio: 'Speedruns de plataformas. Celeste es vida.', platform: 'PC', play_style: 'Competitivo', mic_preference: 'Indistinto', schedule: 'Variable', region: 'España', looking_for: false },
    { id: 'd8', username: 'mochi', display_name: 'Mochi', bio: 'Roguelikes y té verde. Aprendo con cada derrota.', platform: 'Multiplataforma', play_style: 'Ambos', mic_preference: 'Indistinto', schedule: 'Noche', region: 'México', looking_for: true, play_tags: ['principiante'] },
    { id: 'd9', username: 'lucas', display_name: 'Lucas', bio: 'Jogo Valorant e Minecraft. Ainda estou aprendendo, mas sempre com bom humor!', platform: 'PC', play_style: 'Casual', mic_preference: 'Con micrófono', schedule: 'Noche', region: 'Brasil', looking_for: true, language: 'pt', play_tags: ['principiante', 'paciencia'] },
    { id: 'd10', username: 'emma', display_name: 'Emma', bio: 'Support main from Texas. I play by text, no mic. Good vibes only.', platform: 'PC', play_style: 'Ambos', mic_preference: 'Sin micrófono', schedule: 'Noche', region: 'Estados Unidos', looking_for: true, language: 'en', play_tags: ['solo_texto', 'sin_microfono'] },
    { id: 'd11', username: 'yuki', display_name: 'Yuki', bio: 'スターデューバレーとマインクラフトが好きです。のんびり遊びましょう。', platform: 'Nintendo', play_style: 'Casual', mic_preference: 'Sin micrófono', schedule: 'Tarde', region: 'Japón', looking_for: true, language: 'ja', play_tags: ['sin_presion', 'solo_texto'] }
  ],
  games: [
    { id: 1, name: 'Minecraft', genre: 'Sandbox', platform: 'Multiplataforma' }, { id: 2, name: 'Valorant', genre: 'FPS', platform: 'PC' },
    { id: 3, name: 'Fortnite', genre: 'Battle royale', platform: 'Multiplataforma' }, { id: 4, name: 'Rocket League', steam_appid: 252950, genre: 'Deportes', platform: 'Multiplataforma' },
    { id: 5, name: 'Stardew Valley', steam_appid: 413150, genre: 'Simulación', platform: 'Multiplataforma' }, { id: 6, name: 'League of Legends', genre: 'MOBA', platform: 'PC' },
    { id: 7, name: 'Hollow Knight', steam_appid: 367520, genre: 'Metroidvania', platform: 'Multiplataforma' }, { id: 8, name: 'Hades', steam_appid: 1145360, genre: 'Roguelike', platform: 'Multiplataforma' },
    { id: 9, name: 'It Takes Two', steam_appid: 1426210, genre: 'Cooperativo', platform: 'Multiplataforma' }, { id: 10, name: 'Overcooked! 2', steam_appid: 728880, genre: 'Cooperativo', platform: 'Multiplataforma' },
    { id: 11, name: 'Terraria', steam_appid: 105600, genre: 'Sandbox', platform: 'Multiplataforma' }, { id: 12, name: 'Apex Legends', steam_appid: 1172470, genre: 'Battle royale', platform: 'Multiplataforma' },
    { id: 13, name: 'Celeste', steam_appid: 504230, genre: 'Plataformas', platform: 'Multiplataforma' }, { id: 14, name: 'Among Us', steam_appid: 945360, genre: 'Social', platform: 'Multiplataforma' }
  ],
  user_games: [
    { user_id: 'd1', game_id: 2 }, { user_id: 'd1', game_id: 3 }, { user_id: 'd1', game_id: 1 },
    { user_id: 'd2', game_id: 1 }, { user_id: 'd2', game_id: 2 }, { user_id: 'd2', game_id: 11 },
    { user_id: 'd3', game_id: 3 }, { user_id: 'd3', game_id: 4 }, { user_id: 'd3', game_id: 2 },
    { user_id: 'd4', game_id: 1 }, { user_id: 'd4', game_id: 2 }, { user_id: 'd4', game_id: 5 },
    { user_id: 'd5', game_id: 2 }, { user_id: 'd5', game_id: 12 }, { user_id: 'd5', game_id: 6 },
    { user_id: 'd6', game_id: 5 }, { user_id: 'd6', game_id: 9 }, { user_id: 'd6', game_id: 10 },
    { user_id: 'd7', game_id: 13 }, { user_id: 'd7', game_id: 7 }, { user_id: 'd8', game_id: 8 }, { user_id: 'd8', game_id: 7 }, { user_id: 'd8', game_id: 1 },
    { user_id: 'd9', game_id: 2 }, { user_id: 'd9', game_id: 1 }, { user_id: 'd10', game_id: 2 }, { user_id: 'd10', game_id: 12 }, { user_id: 'd11', game_id: 5 }, { user_id: 'd11', game_id: 1 }
  ],
  communities: [
    { id: 'c1', owner_id: 'd1', name: 'Valorant LATAM', description: 'Partidas, clips, práctica y consejos sin toxicidad.' },
    { id: 'c2', owner_id: 'd2', name: 'Minecraft Creativo', description: 'Construcciones increíbles con una comunidad increíble.' },
    { id: 'c3', owner_id: 'd3', name: 'Noches de Indie', description: 'Cooperativos, indies y buena compañía.' },
    { id: 'c4', owner_id: 'd6', name: 'Cozy Gamers', description: 'Juegos tranquilos, música suave y mucho cariño.' }
  ],
  community_members: [
    { community_id: 'c1', user_id: 'd1', role: 'owner' }, { community_id: 'c1', user_id: 'd4', role: 'member' }, { community_id: 'c1', user_id: 'd5', role: 'member' }, { community_id: 'c1', user_id: 'd3', role: 'member' }, { community_id: 'c1', user_id: 'd9', role: 'member' }, { community_id: 'c1', user_id: 'd10', role: 'member' },
    { community_id: 'c2', user_id: 'd2', role: 'owner' }, { community_id: 'c2', user_id: 'd1', role: 'member' }, { community_id: 'c3', user_id: 'd3', role: 'owner' }, { community_id: 'c3', user_id: 'd1', role: 'member' },
    { community_id: 'c4', user_id: 'd6', role: 'owner' }, { community_id: 'c4', user_id: 'd4', role: 'member' }
  ],
  posts: [
    { id: 'p7', author_id: 'd10', community_id: 'c1', body: 'Looking for a chill duo partner for ranked this weekend. I communicate by text, no mic needed. Kindness first!', created_at: ago(25 * MIN) },
    { id: 'p1', author_id: 'd1', community_id: 'c1', body: '¡Hoy organizamos partidas casuales! No importa tu rango; venimos a aprender y pasarla bien. 🎮', created_at: ago(40 * MIN) },
    { id: 'p5', author_id: 'd5', community_id: 'c1', body: 'Busco dos personas para jugar esta noche. Prometo buen ánimo, comunicación clara y cero reclamos. 🛡️', created_at: ago(2 * H) },
    { id: 'p2', author_id: 'd2', community_id: 'c2', body: 'Terminé una construcción enorme con mi squad. Lo mejor fue que todo el servidor colaboró. ✨', created_at: ago(5 * H) },
    { id: 'p6', author_id: 'd6', community_id: 'c4', body: 'Mi granja de Stardew al fin tiene invernadero. Café, lluvia y música lofi: plan perfecto. ☕', created_at: ago(9 * H) },
    { id: 'p3', author_id: 'd4', community_id: null, body: 'Recuerda: detrás de cada nickname hay alguien. Un buen GG mejora la partida. ❤️', created_at: ago(26 * H) },
    { id: 'p4', author_id: 'd3', community_id: 'c3', body: 'Sesión cooperativa del viernes: llevamos snacks virtuales y paciencia infinita. ¿Quién se apunta?', created_at: ago(2 * D) }
  ],
  post_images: [
    { id: 'i1', post_id: 'p1', url: `${ORIGIN}/demo/art-1.svg` }, { id: 'i2', post_id: 'p2', url: `${ORIGIN}/demo/art-2.svg` }, { id: 'i3', post_id: 'p6', url: `${ORIGIN}/demo/art-3.svg` }
  ],
  post_reactions: [
    { post_id: 'p1', user_id: 'd3', kind: 'gg' }, { post_id: 'p1', user_id: 'd4', kind: 'ayuda' }, { post_id: 'p1', user_id: 'd2', kind: 'gg' }, { post_id: 'p1', user_id: 'd5', kind: 'increible' },
    { post_id: 'p2', user_id: 'd1', kind: 'increible' }, { post_id: 'p2', user_id: 'd4', kind: 'increible' }, { post_id: 'p3', user_id: 'd2', kind: 'ayuda' }, { post_id: 'p3', user_id: 'd6', kind: 'ayuda' }
  ],
  comments: [
    { id: 'x1', post_id: 'p1', author_id: 'd4', body: '¡Me apunto!', created_at: ago(30 * MIN) }, { id: 'x2', post_id: 'p1', author_id: 'd5', body: 'Llevo té y buena actitud. ✦', created_at: ago(22 * MIN) },
    { id: 'x3', post_id: 'p2', author_id: 'd1', body: 'Se ve increíble, ¡felicidades al equipo!', created_at: ago(4 * H) },
    { id: 'x4', post_id: 'p1', author_id: 'd9', body: 'Que legal! Posso entrar mesmo sendo iniciante?', created_at: ago(15 * MIN) }
  ],
  gallery: [
    { id: 'g1', user_id: 'd1', url: `${ORIGIN}/demo/art-1.svg`, caption: 'Noche de clutch', created_at: ago(3 * D) },
    { id: 'g2', user_id: 'd1', url: `${ORIGIN}/demo/art-2.svg`, caption: 'Construyendo juntos', created_at: ago(4 * D) },
    { id: 'g3', user_id: 'd1', url: `${ORIGIN}/demo/art-3.svg`, caption: 'Atardecer en el servidor', created_at: ago(6 * D) }
  ],
  follows: [{ follower_id: 'd2', followed_id: 'd1' }, { follower_id: 'd4', followed_id: 'd1' }, { follower_id: 'd5', followed_id: 'd1' }, { follower_id: 'd1', followed_id: 'd4' }],
  blocks: [],
  channels: [{ id: 'ch1', community_id: 'c1', created_by: 'd1', title: 'Anuncios Valorant', description: 'Eventos y partidas semanales' }],
  channel_messages: [{ id: 'cm1', channel_id: 'ch1', author_id: 'd1', body: 'Este viernes jugamos por diversión. ¡Traigan buena vibra!', created_at: ago(3 * H) }],
  squads: [
    { id: 's1', owner_id: 'd1', name: 'Crimson Squad', description: 'Valorant casual, compañerismo primero.', game_id: 2, privacy: 'abierto', max_members: 8, age_band: 'adult' },
    { id: 's2', owner_id: 'd2', name: 'Constructores GG', description: 'Creamos mundos en Minecraft.', game_id: 1, privacy: 'abierto', max_members: 12, age_band: 'adult' },
    { id: 's3', owner_id: 'd4', name: 'Noches Cozy', description: 'Stardew, té y conversación tranquila.', game_id: 5, privacy: 'invitacion', max_members: 6, age_band: 'adult' }
  ],
  squad_members: [
    { squad_id: 's1', user_id: 'd1', role: 'owner', joined_at: yearsAgo(1) }, { squad_id: 's1', user_id: 'd4', role: 'admin', joined_at: ago(200 * D) }, { squad_id: 's1', user_id: 'd3', role: 'member' }, { squad_id: 's1', user_id: 'd9', role: 'member' }, { squad_id: 's1', user_id: 'd10', role: 'member' },
    { squad_id: 's2', user_id: 'd2', role: 'owner' }, { squad_id: 's2', user_id: 'd1', role: 'member', joined_at: ago(40 * D) }, { squad_id: 's3', user_id: 'd4', role: 'owner' }, { squad_id: 's3', user_id: 'd6', role: 'member' }
  ],
  squad_messages: [
    { id: 'sm1', squad_id: 's1', sender_id: 'd4', body: '¿Quién se une esta noche?', created_at: ago(50 * MIN) },
    { id: 'sm2', squad_id: 's1', sender_id: 'd3', body: 'Yo llego a las 9. Llevo mi mejor GG.', created_at: ago(44 * MIN) },
    { id: 'sm3', squad_id: 's1', sender_id: 'd1', body: '¡Perfecto! Agendé la partida para las 9 en la agenda del squad.', created_at: ago(40 * MIN) },
    { id: 'sm4', squad_id: 's1', sender_id: 'd9', body: 'Boa noite, galera! Hoje à noite eu jogo com vocês, só preciso de dez minutos para chegar em casa.', created_at: ago(34 * MIN) },
    { id: 'sm5', squad_id: 's1', sender_id: 'd10', body: "Count me in! I'll be on text chat as always. Let's have fun and keep it chill.", created_at: ago(28 * MIN) }
  ],
  quests: [
    { id: 'q1', creator_id: 'd1', community_id: 'c1', title: 'Apoya a un jugador nuevo', description: 'Ayuda a una persona que está aprendiendo y cuenta cómo fue.', badge_name: 'Mentor GG', created_at: ago(2 * D) },
    { id: 'q2', creator_id: 'd2', community_id: null, title: 'Comparte tu mejor momento', description: 'Comparte una anécdota positiva de una partida.', badge_name: 'Creador Positivo', created_at: ago(3 * D) },
    { id: 'q3', creator_id: 'd6', community_id: 'c4', title: 'Una playlist para jugar en calma', description: 'Comparte tres canciones tranquilas que te acompañen mientras juegas.', badge_name: 'Vibra Cozy', created_at: ago(4 * D) }
  ],
  quest_entries: [{ quest_id: 'q2', user_id: 'd1', status: 'joined', proof: '' }, { quest_id: 'q1', user_id: 'd4', status: 'submitted', proof: 'Acompañé a una compañera nueva en su primera partida y le expliqué los mapas.' }],
  badges: [{ id: 'b1', user_id: 'd1', quest_id: 'q0', name: 'Primer GG' }, { id: 'b2', user_id: 'd1', quest_id: 'q9', name: 'Compañero GG' }, { id: 'b3', user_id: 'd4', quest_id: null, name: 'Mentor GG', kind: 'guide' }],
  reports: [
    { id: 'r1', reporter_id: 'd4', reported_user_id: 'd8', target_kind: 'comment', target_id: 'x9', reason: 'acoso', detail: 'Se burla de quienes empiezan.', snapshot: 'eres malísimo, mejor desinstala el juego', status: 'open', created_at: ago(35 * MIN) },
    { id: 'r2', reporter_id: 'd5', reported_user_id: 'd7', target_kind: 'user', target_id: 'd7', reason: 'spam', detail: 'Manda enlaces raros por mensaje.', snapshot: 'Zeta (@zeta)', status: 'open', created_at: ago(3 * H) }
  ],
  suspensions: [],
  blocked_words: [{ word: 'matate' }, { word: 'kys' }, { word: 'kill yourself' }, { word: 'se donde vives' }],
  mod_log: [{ id: 'ml1', actor_id: null, action: 'auto_mute', target_kind: 'user', target_id: 'd8', detail: '3 reportes en 24 h', created_at: ago(2 * D) }],
  conversation_hides: [],
  squad_tracks: [
    { id: 't1', squad_id: 's1', user_id: 'd4', title: 'Blinding Lights', artist: 'The Weeknd', note: 'Para entrar con todo a las rankeds 🔥', artwork_url: null, preview_url: null, link_url: null, created_at: ago(20 * MIN) },
    { id: 't2', squad_id: 's1', user_id: 'd9', title: 'Lofi para jogar', artist: 'Chillhop Music', note: '', artwork_url: null, preview_url: null, link_url: null, created_at: ago(5 * H) }
  ],
  track_likes: [{ track_id: 't1', user_id: 'd3' }, { track_id: 't1', user_id: 'd10' }, { track_id: 't2', user_id: 'd4' }],
  squad_polls: [{ id: 'po1', squad_id: 's1', creator_id: 'd4', question: '¿A qué jugamos el viernes?', options: ['Valorant', 'Minecraft', 'It Takes Two'], closes_at: ahead(26 * H), created_at: ago(2 * H) }],
  squad_poll_votes: [{ poll_id: 'po1', user_id: 'd4', choice: 0 }, { poll_id: 'po1', user_id: 'd3', choice: 0 }, { poll_id: 'po1', user_id: 'd9', choice: 1 }],
  conversations: [{ id: 'cv3', user_low: 'd1', user_high: 'd10' }, { id: 'cv4', user_low: 'd1', user_high: 'd11' }, { id: 'cv1', user_low: 'd1', user_high: 'd2' }, { id: 'cv2', user_low: 'd1', user_high: 'd4' }],
  direct_messages: [
    { id: 'm1', conversation_id: 'cv1', sender_id: 'd2', body: '¿Armamos un equipo para el fin de semana?', created_at: ago(70 * MIN) },
    { id: 'm2', conversation_id: 'cv1', sender_id: 'd1', body: '¡Claro! Yo organizo la sala.', created_at: ago(65 * MIN) },
    { id: 'm3', conversation_id: 'cv2', sender_id: 'd4', body: 'Gracias por la partida de ayer, estuvo genial. 💜', created_at: ago(5 * H) },
    { id: 'm4', conversation_id: 'cv3', sender_id: 'd10', body: 'Hey Nova! Thanks for the match yesterday, your callouts were super clear. Want to duo tonight?', created_at: ago(12 * MIN) },
    { id: 'm5', conversation_id: 'cv3', sender_id: 'd1', body: '¡Claro que sí! Nos vemos a las 9 en la partida del squad.', created_at: ago(9 * MIN) },
    { id: 'm6', conversation_id: 'cv4', sender_id: 'd11', body: 'こんにちは！今夜スターデューバレーを一緒に遊びませんか？のんびりやりましょう。', created_at: ago(55 * MIN) }
  ],
  notifications: [
    { id: 'n00', user_id: 'd1', actor_id: 'd9', kind: 'guide', body: 'Alguien que empieza en Valorant te pidió ser su guía', ref_id: 'gr1', created_at: ago(40 * MIN), read_at: null },
    { id: 'n0', user_id: 'd1', actor_id: 'd4', kind: 'session', body: 'Luna confirmó que va a «Noche de rankeds tranquilas»', created_at: ago(6 * MIN), read_at: null },
    { id: 'n1', user_id: 'd1', actor_id: 'd5', kind: 'follow', body: 'Orion comenzó a seguirte', created_at: ago(15 * MIN), read_at: null },
    { id: 'n2', user_id: 'd1', actor_id: 'd2', kind: 'message', body: 'Tienes un mensaje nuevo', created_at: ago(70 * MIN), read_at: null },
    { id: 'n3', user_id: 'd1', actor_id: 'd4', kind: 'quest', body: '¡Reto aprobado! Has ganado una insignia.', created_at: ago(5 * H), read_at: null },
    { id: 'n4', user_id: 'd1', actor_id: 'd2', kind: 'follow', body: 'Pixel comenzó a seguirte', created_at: ago(2 * D), read_at: ago(D) }
  ],
  squad_memories: [
    { id: 'mem1', squad_id: 's1', author_id: 'd1', title: 'Nuestra primera noche', story: 'Empezamos siendo desconocidos y terminamos haciendo equipo. ¡GG!', image_path: null, created_at: ago(2 * D) },
    { id: 'mem2', squad_id: 's1', author_id: 'd4', title: 'Clutch 1v3 imposible', story: 'Luna salvó la ronda final con calma y precisión. Todos gritamos en el chat de voz.', image_path: null, created_at: ago(3 * H) }
  ],
  memory_consents: [
    { memory_id: 'mem1', user_id: 'd4', status: 'approved' }, { memory_id: 'mem1', user_id: 'd3', status: 'approved' },
    { memory_id: 'mem2', user_id: 'd1', status: 'pending' }, { memory_id: 'mem2', user_id: 'd3', status: 'approved' }
  ],
  // ───── v6 ─────
  availability: [
    { user_id: 'd4', game_id: 2, platform: 'PC', note: 'Casual, con micro y buena vibra', until: ahead(90 * MIN), created_at: ago(10 * MIN) },
    { user_id: 'd9', game_id: 2, platform: 'PC', note: 'Iniciante: paciência, por favor 🙏', until: ahead(45 * MIN), created_at: ago(5 * MIN) },
    { user_id: 'd10', game_id: 2, platform: 'PC', note: 'Text chat only', until: ahead(2 * H), created_at: ago(20 * MIN) },
    { user_id: 'd6', game_id: 5, platform: 'Nintendo', note: 'Cozy, sin prisa', until: ahead(2 * H), created_at: ago(30 * MIN) },
    { user_id: 'd11', game_id: 5, platform: 'Nintendo', note: '', until: ahead(80 * MIN), created_at: ago(15 * MIN), mode: 'silencioso' },
    { user_id: 'd8', game_id: 8, platform: 'PC', note: 'Estudiando y jugando un rato', until: ahead(50 * MIN), created_at: ago(8 * MIN), mode: 'silencioso' }
  ],
  play_sessions: [
    { id: 'ps1', host_id: 'd1', squad_id: 's1', game_id: 2, title: 'Noche de rankeds tranquilas', starts_at: ahead(3 * H), duration_min: 90, capacity: 5, status: 'scheduled', created_at: ago(2 * H) },
    { id: 'ps2', host_id: 'd4', squad_id: 's1', game_id: 2, title: 'Práctica de estrategias', starts_at: ago(2 * D), duration_min: 60, capacity: 5, status: 'scheduled', created_at: ago(3 * D) },
    { id: 'ps3', host_id: 'd6', squad_id: null, game_id: 5, title: 'Granja cozy entre semana', starts_at: ahead(D + 2 * H), duration_min: 60, capacity: 4, status: 'scheduled', created_at: ago(4 * H) },
    { id: 'ps4', host_id: 'd2', squad_id: 's2', game_id: 1, title: 'Construcción del castillo', starts_at: ahead(26 * H), duration_min: 120, capacity: 8, status: 'scheduled', created_at: ago(5 * H) }
  ],
  session_rsvps: [
    { session_id: 'ps1', user_id: 'd1', status: 'going' }, { session_id: 'ps1', user_id: 'd4', status: 'going' }, { session_id: 'ps1', user_id: 'd10', status: 'going' }, { session_id: 'ps1', user_id: 'd3', status: 'maybe' },
    { session_id: 'ps2', user_id: 'd4', status: 'going' }, { session_id: 'ps2', user_id: 'd1', status: 'going' }, { session_id: 'ps2', user_id: 'd3', status: 'going' }, { session_id: 'ps2', user_id: 'd10', status: 'going' },
    { session_id: 'ps3', user_id: 'd6', status: 'going' }, { session_id: 'ps4', user_id: 'd2', status: 'going' }, { session_id: 'ps4', user_id: 'd1', status: 'maybe' }
  ],
  chemistry_ratings: [],
  profile_private: [{ user_id: 'd1', birth_year: 1999 }],
  squad_invites: [{ squad_id: 's3', user_id: 'd1', invited_by: 'd4', created_at: ago(3 * H) }],
  chat_reads: [],
  // ───── v7 ─────
  guide_offers: [
    { user_id: 'd4', game_id: 2, note: 'Te enseño roles, comunicación y a no tiltearte.' },
    { user_id: 'd2', game_id: 1, note: 'Supervivencia básica y construcción.' },
    { user_id: 'd6', game_id: 5, note: 'Tu primera semana en la granja, sin estrés.' },
    { user_id: 'd1', game_id: 2, note: 'Paciencia infinita para quien empieza.' }
  ],
  guide_requests: [
    { id: 'gr1', guide_id: 'd1', learner_id: 'd9', game_id: 2, message: 'Olá! Sou novo no Valorant, você pode me ajudar com o básico?', status: 'pending', helpful: null, created_at: ago(40 * MIN) }
  ],
  waves: [],
  leagues: [
    { id: 'lg1', owner_id: 'd1', name: 'Liga Valorant CDMX', scope: 'ciudad', place: 'Ciudad de México', game_id: 2, description: 'Liga amistosa por squads. Juego limpio, horarios flexibles y GG siempre.', status: 'en_curso', created_at: ago(10 * D) },
    { id: 'lg2', owner_id: 'd2', name: 'Copa Prepa Constructores', scope: 'escuela', place: 'Preparatoria 5', game_id: 1, description: 'Retos de construcción por equipos entre escuelas.', status: 'inscripciones', created_at: ago(2 * D) }
  ],
  league_teams: [{ league_id: 'lg1', squad_id: 's1', registered_by: 'd1' }, { league_id: 'lg1', squad_id: 's3', registered_by: 'd4' }, { league_id: 'lg1', squad_id: 's2', registered_by: 'd2' }, { league_id: 'lg2', squad_id: 's2', registered_by: 'd2' }],
  league_matches: [
    { id: 'lm1', league_id: 'lg1', round: 1, home_squad: 's1', away_squad: 's2', scheduled_at: ago(6 * D), home_score: 13, away_score: 9, status: 'played' },
    { id: 'lm2', league_id: 'lg1', round: 2, home_squad: 's3', away_squad: 's1', scheduled_at: ago(2 * D), home_score: 11, away_score: 13, status: 'played' },
    { id: 'lm3', league_id: 'lg1', round: 3, home_squad: 's2', away_squad: 's3', scheduled_at: ahead(2 * D), home_score: null, away_score: null, status: 'scheduled' }
  ],
  family_links: [],
  conduct_strikes: [],
  _secondChance: [],
  // Lo que en la versión real devuelven las funciones gg_passport() y my_chemistry().
  _passport: {
    d1: { sessions: 12, raters: 9, tags: { amable: 8, comunicacion: 7, entendimos: 6, divertido: 5, puntual: 3 } },
    d4: { sessions: 15, raters: 11, tags: { amable: 10, entendimos: 9, comunicacion: 6 } },
    d10: { sessions: 4, raters: 3, tags: { comunicacion: 3, amable: 3 } },
    d9: { sessions: 1, raters: 0, tags: {} }
  },
  _chemistry: [{ other_id: 'd4', points: 9, sessions: 3 }, { other_id: 'd3', points: 4, sessions: 2 }],
  _ageBand: 'adult'
};

const tables = ['profiles', 'games', 'user_games', 'communities', 'community_members', 'posts', 'post_images', 'comments', 'post_reactions', 'channels', 'channel_messages', 'gallery', 'follows', 'blocks', 'conversations', 'direct_messages', 'squads', 'squad_members', 'squad_messages', 'quests', 'quest_entries', 'badges', 'notifications', 'reports', 'squad_memories', 'memory_consents', 'availability', 'play_sessions', 'session_rsvps', 'chemistry_ratings', 'profile_private', 'guide_offers', 'guide_requests', 'waves', 'leagues', 'league_teams', 'league_matches', 'family_links', 'conduct_strikes', 'squad_invites', 'chat_reads', 'conversation_hides', 'squad_tracks', 'track_likes', 'squad_polls', 'squad_poll_votes', 'suspensions', 'blocked_words', 'mod_log'];
// Tablas de las migraciones 002 y 003: si aún no se ejecutaron, la app sigue funcionando sin esas funciones.
export const V6_TABLES = ['availability', 'play_sessions', 'session_rsvps', 'chemistry_ratings', 'profile_private'];
export const V7_TABLES = ['guide_offers', 'guide_requests', 'waves', 'leagues', 'league_teams', 'league_matches', 'family_links', 'conduct_strikes'];
export const V11_TABLES = ['squad_invites', 'chat_reads'];
export const V12_TABLES = ['conversation_hides', 'squad_tracks', 'track_likes', 'squad_polls', 'squad_poll_votes', 'suspensions', 'blocked_words', 'mod_log'];
const OPTIONAL = new Set(['squad_memories', 'memory_consents', ...V6_TABLES, ...V7_TABLES, ...V11_TABLES, ...V12_TABLES]);
// Los límites traen lo MÁS RECIENTE.
const NEWEST_FIRST = new Set(['posts', 'comments', 'post_images', 'notifications', 'direct_messages', 'squad_messages', 'channel_messages', 'gallery', 'quests', 'squad_memories', 'play_sessions', 'guide_requests', 'waves', 'leagues', 'conduct_strikes', 'squad_tracks', 'squad_polls', 'reports', 'mod_log']);
const limits = { profiles: 300, games: 500, user_games: 1500, posts: 75, comments: 250, post_images: 300, post_reactions: 500, notifications: 60, direct_messages: 150, squad_messages: 200, channel_messages: 150, play_sessions: 120, session_rsvps: 600, availability: 200, follows: 3000, blocks: 500, track_likes: 1000, squad_poll_votes: 1000, squad_tracks: 200, mod_log: 100, reports: 200 };
const missingTable = err => /does not exist|schema cache|relation|42P01|PGRST205/i.test(`${err?.code} ${err?.message}`);

export async function loadAll(demo = false) {
  if (demo) return structuredClone(demoData);
  const obj = {}, missing = [], errors = [];
  await Promise.all(tables.map(async table => {
    let q = supabase.from(table).select('*');
    if (NEWEST_FIRST.has(table)) q = q.order('created_at', { ascending: false });
    // Solo partidas recientes o futuras: las de hace más de 15 días ya no se califican ni se muestran.
    if (table === 'play_sessions') q = q.gte('starts_at', new Date(Date.now() - 15 * 86400000).toISOString());
    if (table === 'availability') q = q.gt('until', new Date().toISOString());
    const r = await q.limit(limits[table] || 150);
    if (r.error) {
      if (OPTIONAL.has(table) && missingTable(r.error)) { obj[table] = []; missing.push(table); return; }
      // Sin conexión: se avisa para usar la copia guardada. Cualquier otro error afecta solo a esa tabla
      // (antes descartaba TODA la carga y la app se quedaba mostrando datos viejos).
      if (!r.status || /Failed to fetch|NetworkError|Load failed/i.test(r.error.message || '')) throw Object.assign(new Error(`${table}: ${r.error.message}`), { cause: r.error });
      console.error('No se pudo cargar', table, r.error);
      obj[table] = []; errors.push({ table, message: `${r.error.code || r.status || ''} ${r.error.message || ''}`.trim() }); return;
    }
    obj[table] = r.data || [];
  }));
  obj._missing = missing; obj._errors = errors;
  // Retos garantizados (migración 011): los míos, en los que participo y los de mis comunidades.
  await Promise.all([['my_quests', 'quests', r => r.id], ['my_quest_entries', 'quest_entries', r => r.quest_id + '|' + r.user_id]].map(async ([fn, table, key]) => {
    try {
      const r = await supabase.rpc(fn); if (r.error || !Array.isArray(r.data)) return;
      const seen = new Set((obj[table] || []).map(key));
      obj[table] = [...(obj[table] || []), ...r.data.filter(x => !seen.has(key(x)))];
      if (table === 'quests') obj._errors = obj._errors.filter(x => x.table !== 'quests');
    } catch { /* sin la 011 */ }
  }));
  // Funciones de la migración 003 (agregados sin revelar datos privados).
  if (!missing.includes('play_sessions')) {
    const [chem, band] = await Promise.all([supabase.rpc('my_chemistry'), supabase.rpc('my_age_band')]);
    obj._chemistry = chem.error ? [] : chem.data || [];
    obj._ageBand = band.error ? 'unknown' : band.data || 'unknown';
  } else { obj._chemistry = []; obj._ageBand = 'unknown'; }
  obj._secondChance = [];
  if (!missing.includes('conduct_strikes') && obj.conduct_strikes.some(x => !x.resolved_at)) {
    const sc = await supabase.rpc('second_chance');
    obj._secondChance = sc.error ? [] : sc.data || [];
  }
  obj._passport = {};
  return obj;
}
/** Pasaporte GG de una persona (números agregados). */
export async function loadPassport(userId) {
  const r = await supabase.rpc('gg_passport', { target: userId });
  if (r.error) { if (missingTable(r.error) || /function/i.test(r.error.message)) return null; throw r.error; }
  return r.data;
}
/** De esta lista, ¿con quiénes puedo hablar en privado? (regla de edad del servidor, sin revelar edades). */
export async function loadPrivateOk(ids) {
  if (!ids.length) return [];
  const r = await supabase.rpc('private_ok', { ids });
  if (r.error) return null;
  return r.data || [];
}
export async function addRow(table, values) { return must(await supabase.from(table).insert(values).select().single()); }
export async function deleteRow(table, filter) { let q = supabase.from(table).delete(); for (const [k, v] of Object.entries(filter)) q = q.eq(k, v); return must(await q); }
export async function updateRow(table, filter, changes) { let q = supabase.from(table).update(changes); for (const [k, v] of Object.entries(filter)) q = q.eq(k, v); return must(await q.select()); }

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
export async function upload(file, userId) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB');
  const extension = EXT[file.type];
  if (!extension) throw new Error('Formato no admitido (JPG, PNG, WEBP, GIF)');
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  must(await supabase.storage.from('gamvoraq').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false }));
  return supabase.storage.from('gamvoraq').getPublicUrl(path).data.publicUrl;
}
export async function uploadMemory(file, userId, memoryId) {
  if (!file || !EXT[file.type] || file.size > 5 * 1024 * 1024) throw new Error('Imagen inválida: usa JPG, PNG, WEBP o GIF de máximo 5 MB');
  const path = `${memoryId}/${userId}/${crypto.randomUUID()}.${EXT[file.type]}`;
  must(await supabase.storage.from('gamvoraq-memories').upload(path, file, { contentType: file.type, upsert: false }));
  return path;
}
export async function signMemory(path) {
  const { data, error } = await supabase.storage.from('gamvoraq-memories').createSignedUrl(path, 600);
  if (error) throw error; return data.signedUrl;
}

/** Trae registros más antiguos («Ver anteriores»). filter = { columna: valor }. */
export async function loadOlder(table, filter, before, limit = 30) {
  let q = supabase.from(table).select('*').lt('created_at', before).order('created_at', { ascending: false }).limit(limit);
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const r = await q; if (r.error) throw r.error;
  return r.data || [];
}
/** Llama a una Edge Function y devuelve { data, status } también cuando responde con error. */
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return { data, status: 200 };
  let payload = null; const status = error.context?.status || 0;
  try { payload = await error.context?.json?.(); } catch { /* sin JSON */ }
  return { data: payload, status, error };
}
