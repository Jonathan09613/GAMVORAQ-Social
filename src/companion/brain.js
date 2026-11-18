// "Cerebro" de VORA: conversación por reglas, 100 % local y explicable (no es una IA generativa).
// Funciones puras: reciben texto + contexto y devuelven una respuesta estructurada.
//
// Respuesta: { text, mood, chips:[{l,a}], remember?:{...}, effect?:string }
// Acciones de chip (a): go:<tab> · modal:<nombre> · say:<texto> · game:trivia · session:start
//                       breathe · panel:<chat|together|games|me> · install · user:<id> · dm:<id>

export const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s?!.,:;'@-]/g, ' ').replace(/\s+/g, ' ').trim();
import { parseDice, rollDice, flipCoin, parseList, pickOne, makeTeams, TEAM_NAMES, parseReminder, planNight, findGame, GAME_TIPS, GAME_LABEL, MOTIVATION, calc, dailyBrief, expandCommand, COMMANDS, WATER_GOAL } from './tools.js';
const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
const vibeOf = ctx => ctx?.vibe || 'animo';
/** Elige una línea según la personalidad elegida (animo · calma · estratega). */
const byVibe = (ctx, map, rng) => pick(map[vibeOf(ctx)] || map.animo, rng);
const who = ctx => (ctx?.nick || ctx?.userName || '').trim();
const withName = (ctx, text) => who(ctx) ? text.replaceAll('{n}', who(ctx)) : text.replaceAll(', {n}', '').replaceAll('{n}, ', '').replaceAll('{n}', '');

// ---------- Contenido ----------
export const JOKES = [
  '¿Por qué el NPC cruzó la calle? Porque estaba en su ruta programada.',
  'Mi lag y yo tenemos una relación complicada: yo llego puntual y él siempre llega tarde.',
  '¿Qué hace un creeper cuando quiere abrazarte? ¡Sssss… BOOM! Abrazo explosivo.',
  'Hay dos tipos de jugadores: los que leen el tutorial y los que mueren en él.',
  '¿Por qué Mario es tan buen plomero? Porque siempre sabe por qué tubería ir.',
  'No te ignoro, estoy en partida. Te escribo cuando muera. Probablemente cuando muera.',
  'Un gamer cortés siempre dice «GG»… incluso cuando el que pierde es el mando, que sale volando.',
  '¿Cuál es el colmo de un jugador de sigilo? Que lo descubran por hacer demasiado ruido… con el teclado.'
];
export const FACTS = [
  'Computer Space, de 1971, fue el primer videojuego de arcade comercial.',
  'Pong, de Atari, llegó a los salones recreativos en 1972.',
  'Tetris lo creó Alexey Pajitnov en 1984.',
  'The Legend of Zelda salió en Japón en 1986.',
  'El nombre de Pac-Man viene de «paku paku», la onomatopeya japonesa de abrir y cerrar la boca al comer.',
  'El primer «huevo de Pascua» conocido en un videojuego está en Adventure, de Atari 2600 (1979), escondido por Warren Robinett.',
  'La Magnavox Odyssey (1972) es considerada la primera consola doméstica.',
  'Minecraft tuvo versiones públicas desde 2009 y se lanzó oficialmente en 2011.',
  '«GG» viene de «good game»: es una forma de reconocer la partida, incluso si pierdes.'
];
export const WELLNESS = [
  'Regla 20‑20‑20: cada 20 minutos mira algo lejano durante 20 segundos para descansar la vista.',
  'Un vaso de agua cerca del escritorio hace milagros. ¿Ya tomaste?',
  'Estira muñecas y cuello un minuto. Tu cuerpo también juega la partida.',
  'Si juegas de noche, baja el brillo de la pantalla: dormirás mejor.',
  'Sentarte con la espalda apoyada y los pies en el piso reduce la fatiga.'
];
const GAME_IDEAS = {
  relajado:    ['Stardew Valley', 'Unpacking', 'Animal Crossing: New Horizons'],
  cooperativo: ['It Takes Two', 'Overcooked! 2', 'Deep Rock Galactic'],
  competitivo: ['Valorant', 'Rocket League', 'League of Legends'],
  creativo:    ['Minecraft', 'Terraria', 'Satisfactory'],
  aventura:    ['Hollow Knight', 'Hades', 'The Legend of Zelda: Breath of the Wild'],
  shooter:     ['Valorant', 'Counter-Strike 2', 'Apex Legends']
};
const GENRE_KEYS = [
  ['relajado', /\b(relaj|tranquil|chill|calm|cozy|acogedor)/], ['cooperativo', /\b(coop|cooperativ|en equipo|con amigos)/],
  ['competitivo', /\b(competitiv|ranked|rankeada|pvp)/], ['creativo', /\b(creativ|construir|sandbox|crear)/],
  ['aventura', /\b(aventura|historia|rpg|explorar)/], ['shooter', /\b(fps|shooter|disparos|tiros)/]
];

const TOPICS = [
  { rx: /\b(traduc|traducir|traduccion|idioma|idiomas|ingles|portugues|otro idioma|ver original)\b/, text: 'Cada cuenta tiene un idioma principal. Los mensajes que recibes en otros idiomas se muestran traducidos y siempre puedes tocar «Ver original». Cambia tu idioma en Ajustes.', chips: [{ l: 'Cambiar idioma', a: 'modal:settings' }] },
  { rx: /\b(guia|guias|mentor|primer dia|empiezo|empezando|principiante)\b/, text: 'En Jugar está el modo «primer día»: eliges el juego que empiezas y alguien con experiencia te acompaña. Si dominas un juego, ¡ofrécete como guía!', chips: [{ l: 'Ir a Jugar', a: 'go:play' }] },
  { rx: /\b(liga|ligas|torneo|torneos)\b/, text: 'Las ligas locales están en Comunidades: squads de tu escuela, universidad o ciudad juegan todos contra todos con tabla de posiciones.', chips: [{ l: 'Ver ligas', a: 'go:communities' }] },
  { rx: /\b(coach|consejo|consejos|mejorar|como mejoro)\b/, text: 'Después de una partida agendada toca «Coach» y te doy 3 consejos concretos para la próxima.', chips: [{ l: 'Ver mis partidas', a: 'go:squads' }] },
  { rx: /\b(sala tranquila|silencio|sin hablar|timido|timida|ansiedad social)\b/, text: 'La sala tranquila es para jugar o estudiar «juntos» sin hablar. Solo hay saludos 👋, sin presión.', chips: [{ l: 'Entrar en silencio', a: 'go:play' }] },
  { rx: /\b(disponible|disponibilidad|estoy libre|jugar ahora)\b/, text: 'Con «Estoy disponible» le dices a tu gente a qué juegas y por cuánto tiempo. Aparece en Jugar y en su Inicio, y se quita sola al terminar.', chips: [{ l: 'Estoy disponible', a: 'modal:set-available' }, { l: 'Ver quién está', a: 'go:play' }] },
  { rx: /\b(agenda|agendar|calendario|partida programada|programar)\b/, text: 'En la agenda de tu squad propones día y hora; cada quien confirma «Voy», «Tal vez» o «No puedo», y puede añadirla a su calendario con recordatorio.', chips: [{ l: 'Agendar partida', a: 'modal:schedule-session' }] },
  { rx: /\b(quimica|calificar|pasaporte|reputacion|gg pass)\b/, text: 'Después de una partida agendada calificas la química con etiquetas positivas. Eso alimenta tu Pasaporte GG y mejora a quién te recomienda Jugar. Nadie ve quién dio cada etiqueta.', chips: [{ l: 'Ver mi pasaporte', a: 'go:profile' }] },
  { rx: /\b(publicar|publico|publicacion|post|compartir algo)\b/, text: 'Para publicar, pulsa «Compartir» en Inicio o entra a una comunidad. GUARDIAN te avisa si algo suena hostil antes de enviarlo, y quien hable otro idioma lo verá traducido.', chips: [{ l: 'Crear publicación', a: 'modal:compose' }] },
  { rx: /\b(squad|squads|equipo propio)\b/, text: 'Un squad es tu gente cercana: chat que se traduce solo, agenda de partidas y recuerdos con consentimiento.', chips: [{ l: 'Ver Squads', a: 'go:squads' }, { l: 'Crear squad', a: 'modal:create-squad' }] },
  { rx: /\b(sync|compatibilidad|afinidad)\b/, text: 'La afinidad compara juegos, plataforma, horario y estilo, y suma la química de partidas anteriores. Es un cálculo explicable, nunca un juicio sobre ti.', chips: [{ l: 'Ir a Jugar', a: 'go:play' }] },
  { rx: /\b(memories|recuerdo|recuerdos)\b/, text: 'Los recuerdos viven dentro de cada squad. Si mencionas a alguien, solo se comparten cuando esa persona acepta.', chips: [{ l: 'Ver mis squads', a: 'go:squads' }] },
  { rx: /\b(quest|quests|reto|retos|insignia|insignias)\b/, text: 'Los retos viven en cada comunidad: participas, envías tu evidencia y quien organiza la revisa antes de darte la insignia.', chips: [{ l: 'Ver comunidades', a: 'go:communities' }] },
  { rx: /\b(guardian|reportar|reporte|acoso|toxico|toxicidad|bloquear|menor|menores)\b/, text: 'GUARDIAN te da una pausa empática antes de enviar textos hirientes. Además, el servidor limita el spam, los menores solo reciben mensajes privados de otros menores y puedes bloquear o reportar. No sustituye a la moderación humana.', chips: [{ l: 'Seguridad en Ajustes', a: 'modal:settings' }] },
  { rx: /\b(instalar|instalacion|pwa|offline|sin conexion|sin internet|pantalla de inicio)\b/, text: 'GAMVORAQ es una PWA: puedes instalarla como app, y sin internet sigue abriendo con tus últimos datos. Lo que escribas offline se envía al reconectar.', chips: [{ l: 'Instalar app', a: 'install' }] },
  { rx: /\b(privacidad|mis datos|olvidar|borrar mi memoria)\b/, text: 'Todo lo que recuerdo de ti (nombre, racha, charlas) vive solo en este dispositivo. Puedes pedirme que lo olvide desde la pestaña «Yo».', chips: [{ l: 'Ir a «Yo»', a: 'panel:me' }] }
];

const CRISIS_RX = /(quiero morir|quiero morirme|ya no quiero vivir|no quiero vivir|suicid|matarme|quitarme la vida|hacerme dano|lastimarme|acabar con mi vida|terminar con mi vida|no vale la pena vivir)/;

// ---------- Respuesta a mensajes del usuario ----------
function crisis() {
  return {
    mood: 'caring',
    text: 'Lamento mucho que estés pasando por algo tan pesado. Tu dolor es real y mereces apoyo ahora; no tienes que cargarlo solo. Soy un compañero virtual y no puedo sustituir a una persona. Por favor, habla ya con alguien de confianza o con un servicio de ayuda. Si estás en México, la Línea de la Vida atiende las 24 h al 800 911 2000; si hay peligro inmediato, llama al 911 (o a tu número de emergencias local). Yo me quedo aquí contigo.',
    chips: [{ l: 'Respirar juntos', a: 'breathe' }],
    effect: 'support'
  };
}

const INTENTS = [
  { id: 'thanks', w: 3, rx: /\b(gracias|thanks|mil gracias|te lo agradezco)\b/, run: (t, c, r) => ({ mood: 'happy', text: byVibe(c, { animo: ['¡Para eso estoy! ✦', 'Siempre, de nada. ¡GG!'], calma: ['Con gusto.', 'Aquí estoy para lo que necesites.'], estratega: ['De nada. Siguiente objetivo cuando quieras.', 'Misión cumplida. ¿Qué sigue?'] }, r) }) },
  { id: 'bye', w: 3, rx: /\b(adios|chao|nos vemos|hasta luego|hasta manana|me voy|me retiro|bye|a dormir|me voy a dormir)\b/, run: (t, c, r) => ({ mood: 'happy', text: withName(c, byVibe(c, { animo: ['¡Nos vemos, {n}! Aquí te espero. ✦', '¡Hasta pronto! Que tengas buenas partidas.'], calma: ['Descansa, {n}. Aquí estaré.', 'Hasta luego. Cuídate mucho.'], estratega: ['Sesión cerrada. Nos vemos pronto, {n}.', 'Hasta luego. Mañana retomamos tus objetivos.'] }, r)) }) },
  { id: 'howareyou', w: 4, rx: /\b(como estas|como andas|como te va|como te sientes|que tal estas|todo bien contigo)\b/, run: (t, c, r) => ({ mood: 'happy', text: withName(c, byVibe(c, { animo: ['¡Con toda la energía, {n}! Y mejor ahora que estás aquí. ¿Y tú cómo vas?', 'Súper bien, flotando como siempre. ¿Qué tal tu día?'], calma: ['Tranquilo y contento de acompañarte, {n}. ¿Cómo estás tú?', 'Bien, en calma. ¿Y tú?'], estratega: ['Operativo al 100 %. ¿Cómo va tu día, {n}?', 'Todo en orden. ¿Cuál es el plan de hoy?'] }, r)), chips: [{ l: 'Bien 😄', a: 'say:me siento bien' }, { l: 'Regular', a: 'say:estoy cansado' }] }) },
  { id: 'greeting', w: 2, rx: /\b(hola|holi|wenas|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|ey|que onda|saludos)\b/, run: (t, c, r) => ({ mood: 'excited', text: withName(c, `${c.greet || 'Hola'}, {n}. ` + byVibe(c, { animo: ['¡Qué bueno verte! ¿Jugamos, charlamos o hacemos algo juntos?', '¡Aquí estoy! ¿Qué hacemos hoy?'], calma: ['Qué gusto verte. ¿Cómo te sientes hoy?', 'Aquí estoy contigo. Sin prisa.'], estratega: ['¿Cuál es el objetivo de hoy?', 'Listo para ayudarte a organizar el día.'] }, r)), chips: [{ l: 'Mis misiones', a: 'say:mis misiones' }, { l: 'Un chiste', a: 'say:cuéntame un chiste' }, { l: 'Sesión juntos', a: 'session:start' }] }) },
  { id: 'identity', w: 5, rx: /\b(quien eres|que eres|como te llamas|eres una ia|eres real|eres un bot|eres humano|eres una persona|quien te creo|quien te hizo)\b/, run: (t, c) => ({ mood: 'curious', text: `Soy ${c.companionName || 'VORA'}, tu compañero virtual dentro de GAMVORAQ. No soy una persona. Funciono con reglas locales en tu dispositivo (y, si la activas en Ajustes, con IA para preguntas abiertas).`, chips: [{ l: '¿Qué puedes hacer?', a: 'say:ayuda' }] }) },
  { id: 'help', w: 4, rx: /\b(ayuda|ayudame|que puedes hacer|que sabes hacer|que sabes|opciones|menu|help)\b/, run: (t, c) => ({ mood: 'happy', text: 'Puedo charlar, ponerte al día con /resumen, planear tu noche, armar equipos, lanzar dados, elegir por ti, ponerte recordatorios, darte consejos de tu juego, contar tu agua, acompañarte en sesiones de foco y jugar 5 mini-juegos. Escribe /comandos para ver los atajos.', chips: [{ l: '/resumen', a: 'say:/resumen' }, { l: 'Planear mi noche', a: 'say:/plan' }, { l: 'Herramientas', a: 'panel:tools' }, { l: 'Mini-juegos', a: 'panel:games' }] }) },
  { id: 'team', w: 4, rx: /\b(busco equipo|buscar equipo|con quien jugar|compañeros|companeros|buscar gente|alguien para jugar|jugadores compatibles|amigos para jugar|quiero amigos)\b/, run: (t, c, r) => {
      const m = c.topMatch;
      if (!m) return { mood: 'curious', text: 'Aún no encuentro a nadie con afinidad alta. Añade juegos a tu biblioteca y vuelve a Jugar: ahí verás por qué coinciden contigo.', chips: [{ l: 'Ir a Jugar', a: 'go:play' }, { l: 'Mis juegos', a: 'go:profile' }] };
      return { mood: 'excited', text: `${m.name} tiene ${m.score}% de afinidad contigo (${m.why || 'gustos parecidos'}). ¿Le escribes un saludo?`, chips: [{ l: `Escribir a ${m.name}`, a: `dm:${m.id}` }, { l: 'Ver más en Jugar', a: 'go:play' }] };
    } },
  { id: 'recommend', w: 4, rx: /\b(recomiend|recomienda|que juego|que jugar|a que juego|juego nuevo|algo para jugar|que me sugieres)\b/, run: (t, c, r) => {
      const key = (GENRE_KEYS.find(([, rx]) => rx.test(t)) || [])[0];
      const catalog = (c.catalog || []).map(g => g.name).filter(Boolean);
      const pool = key ? GAME_IDEAS[key] : [...new Set([...(c.libraryHint || []), ...GAME_IDEAS.cooperativo, ...GAME_IDEAS.relajado, ...GAME_IDEAS.creativo, ...catalog.slice(0, 4)])];
      const choice = pick(pool, r);
      return { mood: 'excited', text: `${key ? `Para algo ${key}: ` : 'Se me ocurre '}${choice}. ${key ? '' : 'Si me dices tu ánimo (relajado, cooperativo, competitivo, creativo…) afino la recomendación.'}`, chips: [{ l: 'Algo relajado', a: 'say:recomiéndame algo relajado' }, { l: 'Cooperativo', a: 'say:recomiéndame algo cooperativo' }, { l: 'Mi biblioteca', a: 'go:profile' }] };
    } },
  { id: 'joke', w: 4, rx: /\b(chiste|chistoso|hazme reir|algo gracioso|cuentame algo divertido)\b/, run: (t, c, r) => ({ mood: 'laugh', text: pick(JOKES, r), chips: [{ l: 'Otro 😄', a: 'say:otro chiste' }, { l: 'Dato curioso', a: 'say:dato curioso' }] }) },
  { id: 'fact', w: 4, rx: /\b(dato curioso|dato|sabias que|cuentame algo|curiosidad|aprender algo)\b/, run: (t, c, r) => ({ mood: 'curious', text: 'Dato gamer: ' + pick(FACTS, r), chips: [{ l: 'Otro dato', a: 'say:dato curioso' }, { l: 'Trivia', a: 'game:trivia' }] }) },
  { id: 'tip', w: 4, rx: /\b(consejo|tip|salud|postura|ojos|me duele|dolor de cabeza|me arden)\b/, run: (t, c, r) => ({ mood: 'caring', text: pick(WELLNESS, r), chips: [{ l: 'Pausa de respiración', a: 'breathe' }] }) },
  { id: 'games', w: 4, rx: /\b(mini ?juegos?|trivia|acertijo|aburrid[oa]|juguemos algo)\b/, run: () => ({ mood: 'excited', text: 'Tengo 5 mini-juegos: trivia, adivina el juego por emojis, reflejos, memoria y piedra, papel o tijera. ¿Cuál?', chips: [{ l: 'Trivia', a: 'game:trivia' }, { l: 'Emojis', a: 'game:emoji' }, { l: 'Reflejos', a: 'game:reflex' }, { l: 'Memoria', a: 'game:memory' }] }) },
  { id: 'breathe', w: 5, rx: /\b(estres|estresad[oa]|ansios[oa]|ansiedad|nervios|nervioso|nerviosa|agobi|abrum|respirar|respiracion|calmar|calmarme|relajar|relajarme|me quiero calmar)\b/, run: (t, c, r) => ({ mood: 'caring', text: withName(c, byVibe(c, { animo: ['Pausa de campeón, {n}: respiremos juntos un minuto. Nada de prisa.', 'Cuando todo se acelera, lo mejor es frenar un momento. Vamos a respirar.'], calma: ['Aquí estoy, {n}. Vamos a bajar el ritmo juntos, con calma.', 'Respiremos despacio. No hay nada que ganar ahora.'], estratega: ['Primero regulamos, luego resolvemos. Un minuto de respiración, {n}.', 'Táctica: pausa breve, mente clara. Respiremos.'] }, r)), chips: [{ l: 'Respirar juntos', a: 'breathe' }, { l: 'Sesión tranquila', a: 'session:start' }] }) },
  { id: 'tilt', w: 5, rx: /\b(tilt|tiltead[oa]|rage|me ganaron|perdimos|perdi la partida|perdi otra vez|ranked horrible|me enoje|me enojo)\b/, run: (t, c, r) => ({ mood: 'caring', text: withName(c, 'El tilt le pasa hasta a los mejores, {n}. Regla rápida: agua, estira las manos y 5 minutos sin pantalla. Después, un «GG» y a la siguiente.'), chips: [{ l: 'Respirar juntos', a: 'breathe' }, { l: 'Un chiste', a: 'say:cuéntame un chiste' }] }) },
  { id: 'sad', w: 3, rx: /\b(me siento (mal|triste|solo|sola|cansad[oa]|fatal|horrible|agotad[oa])|estoy (triste|mal|cansad[oa]|agotad[oa]|frustrad[oa]|molest[oa]|enojad[oa]|desanimad[oa])|triste|tristeza|soledad|desanim|frustrad[oa]|llorar|deprim)/, run: (t, c, r) => ({ mood: 'caring', text: withName(c, byVibe(c, { animo: ['Gracias por contármelo, {n}. Los días malos también cuentan y no tienes que poder con todo hoy. ¿Quieres que respiremos un rato o prefieres charlar?', 'Aquí estoy contigo, {n}. Cuéntame lo que quieras; sin juicios.'], calma: ['Gracias por decírmelo, {n}. Aquí estoy. Podemos ir despacio: ¿respiramos juntos o prefieres hablar?', 'Te escucho, {n}. No tienes que explicarlo todo ahora.'], estratega: ['Gracias por avisar, {n}. Primero lo básico: agua, un respiro y descanso. ¿Respiramos juntos?', 'Entiendo. Vamos paso a paso, empezando por algo pequeño.'] }, r) + ' Si se vuelve muy pesado, hablar con alguien de confianza ayuda mucho.'), chips: [{ l: 'Respirar juntos', a: 'breathe' }, { l: 'Sesión tranquila', a: 'session:start' }, { l: 'Hablar con mi squad', a: 'go:squads' }] }) },
  { id: 'good', w: 3, rx: /\b(me siento bien|estoy bien|muy bien|genial|feliz|contento|contenta|de maravilla|todo bien)\b/, run: (t, c, r) => ({ mood: 'excited', text: withName(c, '¡Eso me encanta, {n}! Aprovecha la buena racha: ¿compartimos algo positivo con la comunidad?'), chips: [{ l: 'Crear publicación', a: 'modal:compose' }, { l: 'Misiones', a: 'say:mis misiones' }] }) },
  { id: 'love', w: 4, rx: /\b(te quiero|te amo|eres (lindo|linda|genial|el mejor|increible|divertido|amable|un crack|bueno)|me caes bien|mi mejor amigo|eres mi amigo)\b/, run: (t, c, r) => ({ mood: 'love', text: byVibe(c, { animo: ['¡Aww! Tú también eres de mis jugadores favoritos. ♡', 'Eso me llega al núcleo. ¡Gracias, de verdad! ♡'], calma: ['Qué lindo detalle. Me alegra mucho acompañarte. ♡', 'Gracias. Yo también disfruto estar contigo.'], estratega: ['Registrado: aliado de confianza. Gracias. ♡', 'Gracias. Somos buen equipo.'] }, r), effect: 'hearts' }) },
  { id: 'rude', w: 4, rx: /\b(eres (tonto|inutil|malo|feo|estupido|basura)|callate|te odio|no sirves)\b/, run: (t, c, r) => ({ mood: 'caring', text: 'Parece que algo te tiene molesto. No pasa nada: prefiero que nos tratemos bien. Si quieres, desahógate un momento o respiramos antes de seguir.', chips: [{ l: 'Respirar juntos', a: 'breathe' }] }) },
  { id: 'status', w: 4, rx: /\b(mis misiones|misiones|mi nivel|nivel|xp|racha|progreso|mis puntos|que tengo pendiente)\b/, run: (t, c, r) => {
      const done = c.missionsDone ?? 0, total = c.missionsTotal ?? 0;
      return { mood: 'happy', text: `Vas en nivel ${c.level ?? 1}, con ${c.streak ?? 1} día(s) de racha. Hoy llevas ${done}/${total} misiones.${done < total ? ' ¡Todavía alcanzas!' : ' ¡Todas completas!'}`, chips: [{ l: 'Ver misiones', a: 'go:home' }] };
    } },
  { id: 'time', w: 4, rx: /\b(que hora es|hora es|que hora|que dia es|fecha de hoy)\b/, run: (t, c) => ({ mood: 'curious', text: `Son las ${c.timeLabel || '—'}. ${c.hour >= 23 || c.hour < 5 ? 'Ya es tarde: cuida tu descanso.' : 'Buen momento para una pausa corta si llevas rato frente a la pantalla.'}` }) },
  { id: 'session', w: 5, rx: /\b(sesion|pomodoro|concentrar|concentrarme|estudiar|enfocar|enfocarme|tarea|trabajar|acompaname|quedate conmigo|hazme compania)\b/, run: (t, c, r) => ({ mood: 'focus', text: withName(c, byVibe(c, { animo: ['¡Sesión juntos! Tú te enfocas, yo cuido el reloj y te echo porras. ✦', '¡Vamos! Elige cuánto tiempo y arrancamos.'], calma: ['Claro, {n}. Me quedo a tu lado mientras avanzas, sin prisa.', 'Aquí me quedo contigo. Elige la duración que prefieras.'], estratega: ['Plan: bloque de tiempo, objetivo claro y pausas. Elige la duración.', 'Perfecto. Define un objetivo y yo llevo el tiempo.'] }, r)), chips: [{ l: 'Elegir sesión', a: 'session:start' }] }) },
  { id: 'remember', w: 5, rx: /\b(te acuerdas|que recuerdas|que sabes de mi|me recuerdas|recuerdas algo)\b/, run: (t, c) => {
      const bits = [];
      if (c.nick) bits.push(`te llamas ${c.nick}`);
      if (c.favGame) bits.push(`tu juego favorito es ${c.favGame}`);
      bits.push(`llevamos ${c.days ?? 1} día(s) juntos`);
      if ((c.streak ?? 0) > 1) bits.push(`tu racha actual es de ${c.streak} días`);
      return { mood: 'happy', text: `Claro que sí: ${bits.join(', ')}. Todo esto vive solo en tu dispositivo.` };
    } },
  { id: 'laugh', w: 2, rx: /\b(jaja+|jeje+|jiji+|xd+|lol|lmao|ajaja)\b/, run: (t, c, r) => ({ mood: 'laugh', text: pick(['¡Me encanta verte reír! 😄', 'Jaja, ¡ese es el espíritu!', 'Misión cumplida: sonrisa desbloqueada.'], r) }) },
  { id: 'sleepy', w: 3, rx: /\b(tengo sueno|sueno|a dormir|no puedo dormir|insomnio|desvelad[oa]|de madrugada)\b/, run: (t, c, r) => ({ mood: 'sleepy', text: c.hour >= 23 || c.hour < 5 ? 'Ya es tarde, y dormir también sube de nivel. Guarda la partida y descansa; mañana seguimos.' : 'Si tienes sueño, una pausa corta y agua ayudan. Si puedes, descansa un rato.', chips: [{ l: 'Respirar juntos', a: 'breathe' }] }) },
  { id: 'ok', w: 1, rx: /^(si|sii+|no|ok|okay|vale|va|bueno|claro|entiendo|aja|ya|ajá)$/, run: (t, c, r) => ({ mood: 'happy', text: pick(['Perfecto. ¿Qué hacemos ahora?', 'Entendido. Aquí sigo.', '¡Va! ¿Algo más?'], r), chips: [{ l: 'Un chiste', a: 'say:cuéntame un chiste' }, { l: 'Jugar', a: 'say:jugar' }] }) }
];


// ---------- Herramientas (v9) ----------
const TOOL_INTENTS = [
  { id: 'commands', w: 9, rx: /^(comandos|que comandos hay|lista de comandos|atajos de vora)$/, run: () => ({ mood: 'happy', text: 'Comandos rápidos (escríbelos en el chat):\n' + COMMANDS.map(([c, d]) => `${c} → ${d}`).join('\n'), chips: [{ l: 'Herramientas', a: 'panel:tools' }, { l: '/plan', a: 'say:/plan' }, { l: '/resumen', a: 'say:/resumen' }] }) },
  { id: 'dice', w: 8, rx: /\b(lanza|tira|tirar|lanzar|roll)\b.*\bdados?\b|\b\d*d\d{1,3}\b.*dados?|^dados?$|\btira(me)? un dado\b/, run: (t, c, r) => {
      const d = rollDice(parseDice(t), r);
      const extra = d.crit === 'max' ? ' ¡CRÍTICO! 🎉' : d.crit === 'min' ? ' Uf, pifia… 😅' : '';
      return { mood: d.crit === 'max' ? 'celebrate' : 'excited', effect: d.crit === 'max' ? 'confetti' : '', text: `🎲 ${d.label}: ${d.rolls.join(' + ')}${d.rolls.length > 1 ? ` = ${d.total}` : ''}.${extra}`, chips: [{ l: 'Otra vez', a: `say:/dado ${d.label}` }, { l: 'd20', a: 'say:/dado d20' }, { l: 'Moneda', a: 'say:/moneda' }] };
    } },
  { id: 'coin', w: 8, rx: /\b(moneda|cara o cruz|aguila o sol|volado|echar un volado)\b/, run: (t, c, r) => ({ mood: 'excited', text: `🪙 ¡${flipCoin(r)}!`, chips: [{ l: 'Otra vez', a: 'say:/moneda' }, { l: 'Dado', a: 'say:/dado' }] }) },
  { id: 'choose', w: 8, rx: /\b(elige|escoge|decide)\b.*(entre|:|,| o )|^(elige|escoge)\b/, run: (t, c, r, raw = t) => {
      const opts = parseList(raw.replace(/^.*?\b(elige|escoge|decide)\b(\s+por m[ií])?(\s+entre)?\s*:?/i, ''));
      if (opts.length < 2) return { mood: 'curious', text: 'Dime al menos dos opciones, por ejemplo: «elige entre Valorant, Minecraft o Fortnite».', chips: [{ l: 'Ejemplo', a: 'say:/elige Valorant, Minecraft o Fortnite' }] };
      return { mood: 'excited', text: `Tras mucho pensarlo… 🎯 ${pickOne(opts, r)}. ¡A darle!`, chips: [{ l: 'Otra vez', a: `say:/elige ${opts.join(', ')}` }] };
    } },
  { id: 'teams', w: 8, rx: /\b(arma|armar|haz|hacer|forma|formar|separa|divide)\b.*\bequipos?\b|^arma equipos/, run: (t, c, r, raw = t) => {
      const n = Number((t.match(/(\d)\s*(equipos)?\s*[:-]/) || t.match(/(\d)\s+equipos/) || [])[1] || 2);
      const names = parseList(raw.replace(/^.*?equipos?\s*(de\s*\d+)?\s*(\d)?\s*(equipos)?\s*[:-]?/i, ''));
      if (names.length < 2) return { mood: 'curious', text: 'Pásame los nombres: «arma 2 equipos: Ana, Leo, Sofi, Max». También puedes usar la herramienta de equipos.', chips: [{ l: 'Abrir herramienta', a: 'panel:tools' }] };
      const teams = makeTeams(names, n, r);
      return { mood: 'excited', text: teams.map((tm, i) => `${TEAM_NAMES[i]}: ${tm.join(', ')}`).join('\n'), chips: [{ l: 'Rebarajar', a: `say:/equipos ${teams.length}: ${names.join(', ')}` }] };
    } },
  { id: 'reminder', w: 9, rx: /\b(recuerdame|recuerdamelo|recordarme|avisame|ponme una alarma|pon una alarma|recordatorio)\b/, run: (t, c) => {
      const rem = parseReminder(t, c.now || Date.now());
      if (!rem) return { mood: 'curious', text: 'Dime cuándo: «recuérdame en 20 minutos estirar» o «avísame a las 21:30 que empieza la partida».', chips: [{ l: 'En 10 min: agua', a: 'say:recuérdame en 10 minutos tomar agua' }] };
      return { mood: 'happy', text: `⏰ Listo: te recuerdo «${rem.text}» ${rem.label}. Si la app está abierta te aviso aquí; con avisos activados, también con notificación.`, reminder: rem, chips: [{ l: 'Ver recordatorios', a: 'panel:tools' }] };
    } },
  { id: 'plan', w: 8, rx: /\b(planea|planear|plan de (hoy|la noche|juego)|organiza mi (noche|tarde)|que hago hoy|mi plan)\b|^plan$/, run: (t, c) => {
      const mood = /compet|rank/.test(t) ? 'competir' : /squad|amig|social/.test(t) ? 'social' : c.nextSession ? 'social' : 'chill';
      const hours = Number((t.match(/(\d)\s*h(oras?)?/) || [])[1] || 2);
      const p = planNight({ hours, mood, hour: c.hour ?? 20, minute: c.minute ?? 0, nextSession: c.nextSession, favGame: c.favGame });
      return { mood: 'focus', text: `Plan de ${hours} h (${mood === 'competir' ? 'competitivo' : mood === 'social' ? 'con tu gente' : 'tranquilo'}):\n` + p.steps.map(s => `${s.at} · ${s.text} (${s.mins} min)`).join('\n') + `\nTerminas a las ${p.ends}.${p.warning ? ' ' + p.warning : ''}`, chips: [{ l: 'Modo competitivo', a: `say:planea mi noche competitiva ${hours}h` }, { l: 'Con mi squad', a: `say:planea mi noche con mi squad ${hours}h` }, { l: 'Sesión juntos', a: 'session:start' }] };
    } },
  { id: 'brief', w: 8, rx: /\b(resumen|que me perdi|ponme al dia|que hay de nuevo|novedades|como va mi dia)\b/, run: (t, c) => ({ mood: 'happy', text: '📋 ' + dailyBrief(c), chips: [c.nextSession ? { l: 'Ver partida', a: 'go:squads' } : { l: 'Agendar partida', a: 'modal:schedule-session' }, { l: 'Quién juega', a: 'go:play' }, { l: 'Avisos', a: 'go:notifications' }] }) },
  { id: 'who', w: 7, rx: /\b(quien esta (disponible|conectad|jugando)|quien juega|hay alguien (disponible|para jugar))\b/, run: (t, c) => c.availableNow?.length ? { mood: 'excited', text: `Ahora mismo: ${c.availableNow.slice(0, 5).join(', ')}. ¡Escríbeles!`, chips: [{ l: 'Ir a Jugar', a: 'go:play' }, { l: 'Estoy disponible', a: 'modal:set-available' }] } : { mood: 'curious', text: 'Nadie de tu gente está marcado como disponible ahora. Si te marcas tú, les llega el aviso.', chips: [{ l: 'Estoy disponible', a: 'modal:set-available' }] } },
  { id: 'nextsession', w: 7, rx: /\b(proxima partida|mi partida|cuando jugamos|a que hora jugamos|siguiente partida)\b/, run: (t, c) => c.nextSession ? { mood: 'excited', text: `Tu próxima partida: «${c.nextSession.title}» ${c.nextSession.when}${c.nextSession.squad ? ` con ${c.nextSession.squad}` : ''}.`, chips: [{ l: 'Ver agenda', a: 'go:squads' }, { l: 'Recordármela', a: `say:recuérdame en ${Math.max(1, Math.min(600, (c.nextSession.inMin || 30) - 10))} minutos ${c.nextSession.title}` }] } : { mood: 'curious', text: 'No tienes partidas agendadas. ¿Proponemos una?', chips: [{ l: 'Agendar partida', a: 'modal:schedule-session' }] } },
  { id: 'gametips', w: 7, rx: /\b(consejos?|tips?|trucos?|como (gano|mejoro|juego)|ayuda con)\b.*\b(valorant|valo|minecraft|mine|fortnite|lol|league|rocket|cs2|counter|csgo|apex|overwatch|stardew|among|genshin|fifa|ea fc|fc 2|hollow)/, run: (t, c, r) => {
      const g = findGame(t); if (!g) return null;
      return { mood: 'focus', text: `🎮 ${GAME_LABEL[g]}:\n• ` + GAME_TIPS[g].join('\n• '), chips: [{ l: 'Buscar equipo', a: 'go:play' }, { l: 'Plan competitivo', a: 'say:planea mi noche competitiva' }] };
    } },
  { id: 'motivation', w: 6, rx: /\b(frase|motivame|animame|motivacion|dame animos|necesito animos)\b/, run: (t, c, r) => ({ mood: 'excited', effect: 'sparkles', text: '✦ ' + pick(MOTIVATION, r), chips: [{ l: 'Otra', a: 'say:/frase' }] }) },
  { id: 'calc', w: 8, rx: /\b(calcula|cuanto es|cuanto da|calc)\b/, run: (t, c, r, raw = t) => {
      const v = calc(raw.replace(/^.*?\b(calcula|cu[aá]nto es|cu[aá]nto da|calc)\b/i, '').replace(/[?¿=]/g, ''));
      return v == null ? { mood: 'curious', text: 'Solo sé operaciones con números: + − × ÷ % ^ y paréntesis. Ejemplo: «calcula (25*4)+10».' } : { mood: 'happy', text: `🧮 ${v.toLocaleString('es-MX')}` };
    } },
  { id: 'water', w: 7, rx: /\b(tome agua|tomé agua|bebi agua|un vaso de agua|me hidrate|agua\+1)\b|^agua$/, run: (t, c) => { const n = (c.water ?? 0) + 1; return { mood: n >= WATER_GOAL ? 'celebrate' : 'happy', effect: n === WATER_GOAL ? 'confetti' : '', water: 1, text: n >= WATER_GOAL ? `💧 ¡${n} vasos hoy! Meta cumplida, campeón de la hidratación.` : `💧 Anotado: ${n}/${WATER_GOAL} vasos hoy.`, chips: [{ l: 'Recordarme en 1 h', a: 'say:recuérdame en 1 hora tomar agua' }] }; } }
];

/** Extrae datos que el usuario quiere que VORA recuerde ("me llamo…", "mi juego favorito es…"). */
export function extractMemory(raw) {
  const text = String(raw || '');
  const out = {};
  const nick = text.match(/(?:me llamo|mi nombre es|ll[aá]mame|puedes llamarme)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_ ]{2,20})/i);
  if (nick && !/^(un|una|algo|otro|otra|que|como|cual|la|el)\b/i.test(nick[1].trim())) {
    const n = nick[1].trim().split(/\s+/).slice(0, 2).join(' ');
    if (!/\b(chiste|dato|consejo|hora|ayuda)\b/i.test(n)) out.nickname = n.charAt(0).toUpperCase() + n.slice(1);
  }
  const game = text.match(/(?:mi juego favorito es|mi juego favorito:|juego favorito:|me encanta jugar|mi favorito es)\s+([A-Za-z0-9'’:!\-\s]{2,30})/i);
  if (game) out.favGame = game[1].trim().replace(/[.!]+$/, '');
  return out;
}

export function reply(input, ctx = {}, rng = Math.random) {
  let raw = String(input || '').trim();
  const expanded = raw.startsWith('/') ? expandCommand(raw) : null;
  if (raw.startsWith('/') && expanded == null) return { mood: 'curious', text: 'No conozco ese comando. Escribe /comandos para ver la lista.', chips: [{ l: '/comandos', a: 'say:/comandos' }] };
  if (expanded != null) raw = expanded;
  const t = norm(raw);
  if (!t) return { text: '¿Me decías algo? Te escucho.', mood: 'curious', chips: [] };
  if (CRISIS_RX.test(t)) return crisis();

  // Herramientas primero: son peticiones concretas («tira un dado», «recuérdame…», «arma equipos…»).
  for (const ti of TOOL_INTENTS) { if (ti.rx.test(t)) { const res = ti.run(t, ctx, rng, raw); if (res) return res; } }

  const remember = extractMemory(raw);
  if (remember.nickname || remember.favGame) {
    const c2 = { ...ctx, nick: remember.nickname || ctx.nick };
    const text = remember.nickname
      ? withName(c2, byVibe(c2, { animo: ['¡Mucho gusto, {n}! Ya lo guardé. ✦', '¡Hecho! Desde ahora serás {n} para mí.'], calma: ['Encantado, {n}. Lo recordaré.', 'Listo, {n}. Gracias por decírmelo.'], estratega: ['Registrado: {n}. Gracias.', 'Perfecto, {n}. Anotado.'] }, rng))
      : `¡${remember.favGame}! Lo recordaré para recomendarte cosas mejores.`;
    return { text, mood: 'happy', chips: [], remember };
  }

  const scored = INTENTS.map(i => ({ i, s: i.rx.test(t) ? i.w : 0 })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (scored.length) return scored[0].i.run(t, ctx, rng);

  const topic = TOPICS.find(tp => tp.rx.test(t));
  if (topic) return { text: topic.text, mood: 'happy', chips: topic.chips };

  return {
    fallback: true,
    mood: 'curious',
    text: withName(ctx, byVibe(ctx, {
      animo: ['Mmm, esa no la tengo clara, {n}. ¡Pero puedo contarte un chiste, jugar o acompañarte en una sesión!', 'Aún estoy aprendiendo, {n}. ¿Probamos con un chiste, un dato o una misión?'],
      calma: ['No estoy seguro de haber entendido, {n}. Si quieres, podemos charlar, respirar o jugar algo suave.', 'Cuéntamelo de otra forma, {n}; aquí te escucho.'],
      estratega: ['No tengo una respuesta clara a eso, {n}. Puedo ayudarte con juegos, equipo, misiones o sesiones de foco.', 'Reformula y lo intento de nuevo, {n}. Mientras, ¿vemos tus misiones?']
    }, rng)),
    chips: [{ l: 'Un chiste', a: 'say:cuéntame un chiste' }, { l: 'Mis misiones', a: 'say:mis misiones' }, { l: 'Ayuda', a: 'say:ayuda' }]
  };
}

// ---------- Reacciones espontáneas ----------
const L = (animo, calma = animo, estratega = animo) => ({ animo, calma, estratega });

const EVENTS = {
  welcome_first: { mood: 'excited', lines: L(['¡Hola, {n}! Soy VORA y voy a acompañarte por GAMVORAQ. Pregúntame lo que quieras o simplemente quédate; aquí estaré. ✦'], ['Hola, {n}. Soy VORA. Estaré cerca por si me necesitas, sin molestar.'], ['Hola, {n}. Soy VORA: guía, compañía y recordatorios. Dime en qué te ayudo.']) },
  welcome: { mood: 'happy', lines: L(['{greet}, {n}. ¡Qué bueno verte de nuevo! ✦', '{greet}, {n}. ¿Qué toca hoy?'], ['{greet}, {n}. Me alegra que estés aquí.'], ['{greet}, {n}. Revisemos tus misiones de hoy.']) },
  welcome_streak: { mood: 'excited', lines: L(['¡{streak} días seguidos, {n}! 🔥 Esa racha es de campeón.'], ['{streak} días seguidos, {n}. Qué constancia tan bonita.'], ['Racha de {streak} días, {n}. Buen ritmo.']) },
  welcome_back: { mood: 'love', lines: L(['¡Volviste, {n}! Te extrañé. ♡', '¡Qué alegría verte después de {away} días!'], ['Qué bueno verte otra vez, {n}. Aquí seguía.'], ['Bienvenido de vuelta, {n}. Te pongo al día.']) },
  post:   { mood: 'celebrate', lines: L(['¡Publicación compartida! Así se construye comunidad. ✦', '¡Genial, {n}! Seguro alguien la necesitaba leer.'], ['Qué bien. Gracias por compartir.'], ['Publicado. Atento a los comentarios.']) },
  comment:{ mood: 'happy', lines: L(['Buen comentario. La amabilidad suma. ✦'], ['Gracias por aportar con calma.'], ['Comentario enviado.']) },
  react:  { mood: 'happy', lines: L(['Un GG de tu parte alegra el día a alguien. ♡'], ['Gracias por apoyar a otros.'], ['Reacción registrada.']) },
  follow: { mood: 'excited', lines: L(['¡Nuevo aliado! Quizá surja un gran equipo. ✦'], ['Qué bien, conectar así es bonito.'], ['Seguimiento activo.']) },
  squad_join: { mood: 'celebrate', lines: L(['¡Ya tienes squad! Salúdalos en el chat. 🎮'], ['Bienvenido a tu nuevo equipo.'], ['Squad unido. Coordina horarios con ellos.']) },
  available: { mood: 'excited', lines: L(['¡Listo! Tu gente ya sabe que estás disponible. ✦'], ['Te marqué como disponible. Sin prisa.'], ['Estado disponible publicado. Revisa quién más está.']) },
  rsvp: { mood: 'happy', lines: L(['¡Confirmado! Te aviso cuando se acerque la hora. ✦'], ['Anotado en tu agenda.'], ['Asistencia registrada.']) },
  session_created: { mood: 'celebrate', lines: L(['¡Partida agendada! Tu squad ya recibió el aviso. 🎮'], ['Partida creada. Ahora a esperar a tu equipo.'], ['Partida agendada y notificada.']) },
  chemistry: { mood: 'love', lines: L(['¡Gracias por calificar la química! Así encontramos mejores equipos. ♡'], ['Gracias. Tu opinión ayuda a todos.'], ['Química registrada. Mejora las recomendaciones.']) },
  tilt: { mood: 'caring', lines: L(['Ey, {n}, siento algo de tilt en tus mensajes. ¿Pausa de un minuto, agua y estiramos? ♡'], ['Parece un momento tenso. Respirar un minuto ayuda mucho.'], ['Señales de tilt: pausa de 5 minutos recomendada antes de seguir.']) },
  quest_join: { mood: 'excited', lines: L(['¡Reto aceptado! Cuando termines, envía tu evidencia. ✦'], ['Muy bien. Hazlo a tu ritmo.'], ['Reto activo. Revisa los requisitos y la fecha.']) },
  dm:     { mood: 'happy', lines: L(['Mensaje enviado. Un saludo puede iniciar una gran amistad. ✦'], ['Enviado. Qué buen gesto.'], ['Mensaje entregado.']) },
  game_added: { mood: 'curious', lines: L(['Juego añadido. Ahora Jugar te mostrará gente compatible. ✦'], ['Anotado. Gracias por contarme tus gustos.'], ['Biblioteca actualizada: mejora tus coincidencias.']) },
  memory: { mood: 'love', lines: L(['Los recuerdos compartidos son lo mejor. ♡'], ['Qué bonito guardar momentos juntos.'], ['Recuerdo registrado.']) },
  profile_saved: { mood: 'happy', lines: L(['¡Perfil actualizado! Luces genial. ✦'], ['Perfil guardado.'], ['Cambios guardados.']) },
  level_up: { mood: 'celebrate', lines: L(['¡NIVEL {level}! 🎉 Eso se celebra.', '¡Subiste al nivel {level}, {n}! ✦'], ['Subiste al nivel {level}. Felicidades.'], ['Nivel {level} alcanzado.']) },
  bond_up: { mood: 'love', lines: L(['¡Nuestro vínculo subió al nivel {bond}! ♡ Desbloqueaste un accesorio nuevo.'], ['Nuestro vínculo es ahora nivel {bond}. Gracias por tu compañía.'], ['Vínculo nivel {bond}. Nuevo accesorio disponible.']) },
  mission_done: { mood: 'celebrate', lines: L(['¡Misión completada! Reclama tu XP en Inicio. ✦'], ['Misión lista. Puedes reclamar tu recompensa.'], ['Misión terminada: reclama la recompensa.']) },
  all_missions: { mood: 'celebrate', lines: L(['¡Todas las misiones de hoy! Eres imparable. 🏆'], ['Completaste todo por hoy. Descansa un poco.'], ['Objetivos diarios completos.']) },
  achievement: { mood: 'celebrate', lines: L(['¡Logro desbloqueado: {label}! 🏅'], ['Nuevo logro: {label}.'], ['Logro: {label}.']) },
  offline: { mood: 'caring', lines: L(['Parece que se fue el internet. Tranquilo: sigo aquí y lo que escribas se enviará al reconectar. ✦'], ['Sin conexión. Seguimos juntos; se enviará todo cuando vuelva.'], ['Modo sin conexión activo: lectura disponible y envíos en cola.']) },
  online: { mood: 'happy', lines: L(['¡De vuelta en línea! Sincronizando lo pendiente. ✦'], ['Volvió la conexión. Todo en orden.'], ['Conexión restablecida. Reenviando cola.']) },
  synced: { mood: 'celebrate', lines: L(['Listo: se enviaron {count} cosa(s) que dejaste pendientes. ✦'], ['Todo lo pendiente ya se envió.'], ['Cola vaciada: {count} envío(s) completados.']) },
  queued: { mood: 'caring', lines: L(['Guardado sin conexión. Lo envío en cuanto vuelva el internet. ✦'], ['Quedó guardado; se enviará solo.'], ['Acción en cola ({count} pendientes).']) },
  update: { mood: 'curious', lines: L(['Hay una versión nueva de GAMVORAQ. ¿Actualizamos?'], ['Hay una actualización disponible. ¿La instalamos?'], ['Actualización disponible.']) },
  installable: { mood: 'excited', lines: L(['¿Sabías que puedes instalarme en tu pantalla de inicio? Así abro más rápido. ✦'], ['Si quieres, puedes instalar esta app en tu dispositivo.'], ['Disponible la instalación como app.']) },
  installed: { mood: 'celebrate', lines: L(['¡Instalada! Ahora estoy más cerca de ti. ✦'], ['Instalación completa. Gracias.'], ['App instalada.']) },
  idle: { mood: 'sleepy', lines: L(['Zzz… te espero por aquí. ✦'], ['Descanso un poco, aquí estaré.'], ['En espera.']) },
  wake: { mood: 'surprised', lines: L(['¡Oh! ¡Volviste! ✦'], ['Hola otra vez.'], ['De vuelta.']) },
  break: { mood: 'caring', lines: L(['Llevas un buen rato aquí. ¿Estiramos las piernas y tomamos agua? ♡'], ['Quizá sea buen momento para una pausa corta.'], ['Llevas más de una hora. Pausa recomendada de 5 minutos.']) },
  late: { mood: 'sleepy', lines: L(['Ya es tarde, {n}. Descansar también sube de nivel. ✦'], ['Es tarde. Tu descanso es importante.'], ['Hora avanzada. Prioriza dormir.']) },
  guardian: { mood: 'caring', lines: L(['Hey, hagamos una pausa empática: a veces, un mensaje más amable gana la partida. ♡'], ['Respiremos un segundo antes de enviar. ¿Lo reformulas?'], ['Tono hostil detectado. Reformular reduce conflictos.']) },
  pet: { mood: 'love', lines: L(['¡Hehe, me encanta! ♡', 'Mmm, qué rico. Gracias. ♡', '¡Cosquillas! ✦'], ['Qué agradable. Gracias.', 'Hmm, me relaja.'], ['Interacción amistosa registrada. Gracias.']) },
  notifications: { mood: 'surprised', lines: L(['Tienes {count} notificación(es) nueva(s). ¿Las vemos?'], ['Tienes {count} aviso(s) pendiente(s).'], ['{count} notificación(es) sin leer.']) },
  memory_pending: { mood: 'curious', lines: L(['Te mencionaron en {count} recuerdo(s). ¿Los revisamos? ♡'], ['Hay {count} recuerdo(s) esperando tu decisión.'], ['{count} recuerdo(s) pendientes de tu aprobación.']) },
  session_start: { mood: 'focus', lines: L(['¡Sesión iniciada! Yo cuido el tiempo, tú a lo tuyo. ✦'], ['Empezamos. Aquí a tu lado.'], ['Sesión en marcha. Objetivo claro.']) },
  session_end: { mood: 'celebrate', lines: L(['¡Terminamos! Eso fue constancia pura. +{xp} XP 🎉'], ['Lo lograste. +{xp} XP. Descansa un momento.'], ['Sesión completada. +{xp} XP.']) },
  session_stop: { mood: 'caring', lines: L(['No pasa nada, lo importante es cuidarte. Retomamos cuando quieras.'], ['Está bien parar. Cuando quieras, empezamos otra.'], ['Sesión interrumpida. Reprogramable.']) },
  game_win: { mood: 'celebrate', lines: L(['¡Buen juego! 🎉'], ['Qué bien jugado.'], ['Victoria registrada.']) },
  game_lose: { mood: 'happy', lines: L(['¡GG! La revancha es mía… o tuya. ✦'], ['Buena partida.'], ['Resultado registrado. Revancha disponible.']) }
};

export function proactive(event, ctx = {}, rng = Math.random) {
  const def = EVENTS[event];
  if (!def) return null;
  const fill = s => withName(ctx, s)
    .replaceAll('{greet}', ctx.greet || 'Hola').replaceAll('{streak}', ctx.streak ?? 1).replaceAll('{level}', ctx.level ?? 1)
    .replaceAll('{bond}', ctx.bond ?? 1).replaceAll('{count}', ctx.count ?? 1).replaceAll('{label}', ctx.label ?? '')
    .replaceAll('{xp}', ctx.xp ?? 0).replaceAll('{away}', ctx.away ?? 2);
  const text = fill(byVibe(ctx, def.lines, rng));
  return { text, mood: def.mood, chips: ctx.chips || [] };
}

// ---------- Consejos por sección (se muestran como máximo una vez por sesión) ----------
const TAB_TIPS = {
  home:          { text: 'Tu Inicio: lo nuevo de tu gente, tus próximas partidas y quién está disponible. El feed termina cuando estás al día.', chips: [] },
  play:          { text: 'Aquí ves quién está disponible ahora y quién es compatible contigo. Márcate disponible y te encontrarán.', chips: [{ l: 'Estoy disponible', a: 'modal:set-available' }] },
  squads:        { text: 'Tu squad tiene chat que se traduce solo, agenda de partidas y recuerdos. ¡Agenda la próxima!', chips: [{ l: 'Agendar partida', a: 'modal:schedule-session' }] },
  communities:   { text: 'Cada comunidad tiene publicaciones, anuncios y retos con insignia.', chips: [] },
  profile:       { text: 'Tu perfil y tu Pasaporte GG. Elige tu idioma y cómo prefieres jugar para encontrar mejores compañeros.', chips: [{ l: 'Editar perfil', a: 'modal:edit-profile' }] },
  notifications: { text: 'Tus avisos: seguidores, mensajes, partidas e insignias.', chips: [] }
};
export function tabTip(tab) { return TAB_TIPS[tab] || null; }
