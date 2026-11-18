// Un único diálogo controlado para todas las escrituras. Devuelve [título, html].
import { soundOn } from '../notices.js';
import { groupArt } from '../v11.js';
import { e, icon, btn, empty, avatar, chip } from '../ui.js';
import { state, d, me, getProfile, member, staff, myGames, squadMember, game } from '../state.js';
import { LANGUAGES } from '../translate.js';
import { GUIDES, GUIDE_ORDER } from '../install.js';
import { PLAY_TAGS, CHEM_TAGS, AVAIL_DURATIONS, BIRTH_YEARS, localInputValue, rateableMates, ageBand, LEAGUE_SCOPES, whenLabel } from '../features.js';
import { gameArt } from '../v11.js';
import { v12Modal } from '../v12.js';
import { uiLang } from '../i18n/index.js';
const LANG_FLAG = { es: '🇲🇽', en: '🇺🇸', pt: '🇧🇷', fr: '🇫🇷', it: '🇮🇹', de: '🇩🇪', ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳' };

const labelField = (label, name, opts = '') => `<label class="field">${e(label)}<input class="input" name="${name}" ${opts}></label>`;
const selectField = (label, name, options, value) => `<label class="field">${e(label)}<select class="select" name="${name}">${options.map(o => `<option ${o === value ? 'selected' : ''}>${e(o)}</option>`).join('')}</select></label>`;
const selectPairs = (label, name, pairs, value, extra = '') => `<label class="field">${e(label)}<select class="select" name="${name}" ${extra}>${pairs.map(([v, l]) => `<option value="${e(v)}" ${String(v) === String(value) ? 'selected' : ''}>${e(l)}</option>`).join('')}</select></label>`;
const textField = (label, name, placeholder = '', value = '', maxlength = 1600, req = '') => `<label class="field">${e(label)}<textarea class="textarea" name="${name}" placeholder="${e(placeholder)}" maxlength="${maxlength}" ${req}>${e(value)}</textarea></label>`;
const fileField = (label = 'Imagen', name = 'image') => `<label class="field">${e(label)}<input class="input" type="file" name="${name}" accept="image/jpeg,image/png,image/webp,image/gif"><small>Máximo 5 MB. JPG, PNG, WEBP o GIF.</small></label>`;
const arg = () => state.modal.split(':')[1] || '';

export const ACCENTS = [['crimson', 'Carmesí', '#e11d2e'], ['cyan', 'Cian', '#0891b2'], ['violet', 'Violeta', '#7c3aed'], ['amber', 'Ámbar', '#d97706'], ['mint', 'Menta', '#059669']];

/** Juegos ordenados: primero los de mi biblioteca. */
function gameOptions(selected = '') {
  const mine = new Set(myGames().map(String));
  const list = [...d().games].sort((a, b) => (mine.has(String(b.id)) - mine.has(String(a.id))) || a.name.localeCompare(b.name));
  return `<option value="">Cualquier juego</option>${list.slice(0, 400).map(g => `<option value="${g.id}" ${String(g.id) === String(selected) ? 'selected' : ''}>${mine.has(String(g.id)) ? '★ ' : ''}${e(g.name)}</option>`).join('')}`;
}

function settingsHtml(ctx) {
  const { pwa, vora, translator } = ctx, p = me();
  const blocked = d().blocks.filter(b => b.blocker_id === state.user.id);
  return `<div class="settings">
    <h4>${icon('languages', 16)} Idioma</h4>
    <p class="help">Un solo idioma para todo: menús y botones de la app, y los mensajes que recibes en otros idiomas (verás el original y debajo la traducción).</p>
    <form data-form="language" class="set-form lang-form">
      <div class="lang-grid" role="radiogroup" aria-label="Idioma">${LANGUAGES.map(([code, label]) => `<label class="lang-opt ${(p.language || uiLang()) === code ? 'on' : ''}" data-noi18n><input type="radio" name="language" value="${code}" ${(p.language || uiLang()) === code ? 'checked' : ''}><span class="lang-flag">${LANG_FLAG[code] || '🌐'}</span><span>${e(label)}</span></label>`).join('')}</div>
      <p class="help tiny">Toda la página cambia al idioma elegido. La primera vez, con francés, italiano, alemán, japonés, coreano o chino, tarda unos segundos en traducirse por completo (después queda guardado).</p>
      <label class="switch"><input type="checkbox" name="auto_translate" ${p.auto_translate !== false ? 'checked' : ''}><span class="sw"></span><span><b>Traducir mensajes automáticamente</b><small>Si lo apagas, aparece un botón «Traducir» en cada mensaje.</small></span></label>
      <button class="btn btn-primary btn-sm" type="submit">${icon('check', 15)} Aplicar idioma</button>
    </form>
    <div class="set-row"><div><b>Traducciones guardadas</b><small>${translator?.stats().cached || 0} en este dispositivo para no volver a pedirlas.</small></div>${btn('clear-translations', 'Borrar', 'btn btn-soft btn-sm')}</div>

    <h4>${icon('shield-check', 16)} Seguridad · GUARDIAN</h4>
    <p class="help">Antes de enviar, GUARDIAN revisa el texto con reglas visibles y te propone una versión más amable. El servidor también limita los envíos masivos. Tú decides qué enviar.</p>
    <div class="set-row"><div><b>Personas bloqueadas</b><small>${blocked.length ? 'No pueden escribirte ni ver tu actividad en Jugar.' : 'No has bloqueado a nadie.'}</small></div></div>
    ${blocked.map(b => `<div class="set-row">${avatar(getProfile(b.blocked_id), 'xs')}<div class="grow"><b>${e(getProfile(b.blocked_id).display_name)}</b></div>${btn('unblock-user', 'Desbloquear', 'btn btn-soft btn-sm', `data-id="${e(b.blocked_id)}"`)}</div>`).join('')}

    <h4>${icon('bell-ring', 16)} Notificaciones en este dispositivo</h4>
    <div class="set-row"><div><b>Avisos push</b><small>${ctx.push?.text || 'Recibe mensajes, partidas y saludos aunque la app esté cerrada.'}</small></div>${ctx.push?.on ? btn('push-off', 'Desactivar', 'btn btn-soft btn-sm') : btn('push-on', 'Activar', 'btn btn-primary btn-sm', ctx.push?.available ? '' : 'disabled')}</div>
    <div class="set-row"><div><b>Sonido y vibración</b><small>Cuando llega un aviso con la app abierta, suena y aparece una tarjeta arriba.</small></div>${soundOn() ? btn('notice-sound', 'Silenciar', 'btn btn-soft btn-sm') : btn('notice-sound', 'Activar', 'btn btn-primary btn-sm')}</div>
    ${ctx.push?.on || state.pushCheck || state.demo ? `<div class="push-diag">${pushDiag(state.pushCheck)}<div class="row wrap">${btn('push-test', `${icon('bell-ring', 15)} Enviar aviso de prueba`, 'btn btn-soft btn-sm')}${btn('push-check', `${icon('stethoscope', 15)} Revisar configuración`, 'btn btn-ghost btn-sm')}</div></div>` : ''}

    <h4>${icon('sparkles', 16)} VORA con inteligencia artificial</h4>
    <div class="set-row"><div><b>Respuestas con IA</b><small>${state.demo ? 'Disponible con una cuenta real y el servidor configurado.' : 'Cuando VORA no sepa responder con sus reglas, usará IA. Tus mensajes con VORA se envían a un proveedor de IA y no se guardan.'}</small></div>${ctx.ai ? btn('ai-off', 'Desactivar', 'btn btn-soft btn-sm') : btn('ai-on', 'Activar', 'btn btn-primary btn-sm', state.demo ? 'disabled' : '')}</div>

    <h4>${icon('users', 16)} Modo familia</h4>
    ${familyHtml()}

    <h4>${icon('palette', 16)} Apariencia</h4>
    <div class="vp-swatches" role="radiogroup" aria-label="Color de la interfaz">${ACCENTS.map(([id, label, c]) => `<button type="button" role="radio" aria-checked="${state.accent === id}" class="${state.accent === id ? 'on' : ''}" style="--c1:${c};--c2:${c}" data-action="set-accent" data-id="${id}" aria-label="${label}" title="${label}"></button>`).join('')}</div>

    <h4>${icon('bot', 16)} Tu compañero</h4>
    <div class="set-row"><div><b>${e(vora.name)}</b><small>${vora.hidden ? 'Está oculto' : 'Está flotando contigo'}</small></div>${vora.hidden ? btn('vora-show', 'Mostrar', 'btn btn-primary btn-sm') : btn('vora-hide', 'Ocultar', 'btn btn-soft btn-sm')}</div>
    <div class="set-row"><div><b>Personalizar</b><small>Nombre, color, accesorios y modo silencioso.</small></div>${btn('vora-me', 'Abrir', 'btn btn-soft btn-sm')}</div>

    <h4>${icon('smartphone', 16)} La app</h4>
    <div class="set-row"><div><b>Instalación</b><small>${pwa.standalone ? 'Ya la tienes instalada.' : pwa.installable ? 'Disponible para instalar en este dispositivo.' : pwa.ios ? 'En iPhone: Compartir → Añadir a pantalla de inicio.' : 'Usa el menú del navegador → Instalar aplicación.'}</small></div>${pwa.standalone ? '' : btn(pwa.installable ? 'install' : 'install-guide', pwa.installable ? 'Instalar' : 'Cómo instalar', pwa.installable ? 'btn btn-primary btn-sm' : 'btn btn-soft btn-sm')}</div>
    <div class="set-row"><div><b>Datos sin conexión</b><small>${pwa.snapshotAt ? 'Hay una copia local de tu última sesión.' : 'Aún no hay copia local.'} Solo en este dispositivo.</small></div>${btn('clear-offline', 'Borrar copia', 'btn btn-danger btn-sm')}</div>
    <div class="set-row"><div><b>Actualizaciones</b><small>Buscar una versión nueva de la app.</small></div>${btn('check-update', icon('refresh-cw', 15) + ' Buscar', 'btn btn-soft btn-sm')}</div>
    <div class="set-row"><div><b>Cerrar sesión</b><small>Borra la copia local y la cola de envíos de esta cuenta.</small></div>${btn('logout', icon('log-out', 15) + ' Salir', 'btn btn-ghost btn-sm')}</div>
    <p class="help" style="margin-top:16px">GAMVORAQ SOCIAL v12 · PWA</p>
  </div>`;
}

function familyHtml() {
  const links = d().family_links || [], band = d()._ageBand;
  const asGuardian = links.filter(l => l.guardian_id === state.user.id), asMinor = links.filter(l => l.minor_id === state.user.id);
  const row = (l, minorSide) => {
    const other = getProfile(minorSide ? l.guardian_id : l.minor_id);
    const acts = minorSide
      ? (l.status === 'pending' ? btn('family-accept', 'Aceptar', 'btn btn-primary btn-sm', `data-id="${e(l.guardian_id)}"`) + btn('family-remove', 'Rechazar', 'btn btn-ghost btn-sm', `data-id="${e(l.guardian_id)}" data-kind="guardian"`) : btn('family-remove', 'Terminar', 'btn btn-ghost btn-sm', `data-id="${e(l.guardian_id)}" data-kind="guardian"`))
      : (l.status === 'accepted' ? btn('family-view', 'Ver resumen', 'btn btn-primary btn-sm', `data-id="${e(l.minor_id)}"`) : `<span class="chip">Esperando respuesta</span>`) + btn('family-remove', 'Quitar', 'btn btn-ghost btn-sm', `data-id="${e(l.minor_id)}" data-kind="minor"`);
    return `<div class="set-row">${avatar(other, 'xs')}<div class="grow"><b>${e(other.display_name)}</b><small>${minorSide ? (l.status === 'pending' ? 'Quiere acompañar tu cuenta' : 'Acompaña tu cuenta') : l.status === 'accepted' ? 'Aceptó el acompañamiento' : 'Solicitud enviada'}</small></div>${acts}</div>`;
  };
  const intro = '<p class="help">Un adulto de confianza puede ver la actividad de un menor que lo acepta: squads, partidas agendadas, con quién habla y si hubo reportes. <b>Nunca</b> el contenido de los mensajes. El menor puede terminarlo cuando quiera y el adulto recibe aviso.</p>';
  if (band === 'minor') return intro + (asMinor.map(l => row(l, true)).join('') || '<p class="muted small">Nadie acompaña tu cuenta.</p>');
  if (band !== 'adult') return intro + '<p class="muted small">Indica tu año de nacimiento en tu perfil para usar el modo familia.</p>';
  return intro + asGuardian.map(l => row(l, false)).join('') + `<form data-form="family" class="inline-form">${'<input class="input" name="username" required minlength="3" maxlength="25" placeholder="Usuario del menor (sin @)" aria-label="Usuario del menor">'}<button class="btn btn-soft btn-sm" type="submit">Enviar solicitud</button></form>`;
}

function familyOverview() {
  const f = state.familyData, p = getProfile(state.modal.split(':')[1]);
  if (!f) return '<p class="muted">Cargando resumen…</p>';
  if (f.error) return `<p class="muted">${e(f.error)}</p>`;
  const list = (arr, empty_) => (arr && arr.length ? `<ul class="fam-list">${arr.map(x => `<li>${e(typeof x === 'string' ? x : `${x.title} · ${whenLabel(x.starts_at)}`)}</li>`).join('')}</ul>` : `<p class="muted small">${empty_}</p>`);
  return `<p class="help">Resumen de ${e(p.display_name)}. No incluye el contenido de ningún mensaje.</p>
  <div class="fam-grid"><div><b>${f.messages_week}</b><small>mensajes enviados esta semana</small></div><div><b>${f.reports_about}</b><small>reportes recibidos (30 días)</small></div><div><b>${f.blocked}</b><small>personas bloqueadas</small></div><div><b>${f.available_now ? 'Sí' : 'No'}</b><small>disponible ahora</small></div></div>
  <h4>Squads</h4>${list(f.squads, 'No está en squads.')}<h4>Partidas agendadas</h4>${list(f.sessions, 'Sin partidas próximas.')}<h4>Habla en privado con (últimos 30 días)</h4>${list(f.chats_with, 'Nadie.')}
  <p class="help tiny">Última actividad: ${f.last_active ? e(whenLabel(f.last_active)) : 'sin actividad reciente'}. Si algo te preocupa, habla primero con tu familiar y usa reportar o bloquear.</p>`;
}

function coachForm() {
  const s = (d().play_sessions || []).find(x => x.id === state.modal.split(':')[1]);
  const out = state.coachOut;
  return `<p class="help">${s ? `«${e(s.title)}» · ` : ''}Cuéntale a VORA cómo te fue y te da 3 consejos para la próxima.</p>
  <form data-form="coach" data-id="${e(s?.id || '')}"><input type="hidden" name="game" value="${e(game(s?.game_id)?.name || '')}">
    <fieldset class="field"><legend>Resultado</legend><div class="radio-row">${[['win', 'Ganamos'], ['loss', 'Perdimos'], ['draw', 'Empate']].map(([v, l], i) => `<label class="radio-chip"><input type="radio" name="result" value="${v}" ${i === 1 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    ${textField('¿Qué pasó?', 'notes', 'Ej.: nadie hablaba, perdimos las primeras rondas, me dio tilt…', '', 700, 'required')}
    <button class="btn btn-primary" type="submit">${icon('brain', 16)} Pedir consejos</button></form>
  ${out ? `<div class="coach-out" role="status"><b>${out.ai ? 'Consejos de VORA (IA)' : 'Consejos de VORA'}</b>${out.text ? `<div class="coach-text">${e(out.text)}</div>` : `<ol>${out.tips.map(t => `<li>${e(t)}</li>`).join('')}</ol><p>${e(out.cheer)}</p>`}</div>` : ''}`;
}

function profileForm() {
  const p = me(), priv = (d().profile_private || []).find(x => x.user_id === state.user.id);
  const tags = new Set(p.play_tags || []);
  const band = ageBand(priv?.birth_year);
  return `<form data-form="profile">
    ${labelField('Nombre visible', 'display_name', `required maxlength="60" value="${e(p.display_name)}"`)}
    ${labelField('Usuario único', 'username', `required minlength="3" maxlength="25" pattern="[a-z0-9_]{3,25}" value="${e(p.username)}"`)}
    ${selectPairs('Idioma principal (para leer mensajes traducidos)', 'language', LANGUAGES, p.language || 'es')}
    ${textField('Biografía', 'bio', 'Cuéntanos de tus gustos…', p.bio, 600)}
    ${labelField('Región o país', 'region', `maxlength="60" value="${e(p.region || '')}"`)}
    <div class="grid-2 tight">${selectField('Plataforma', 'platform', ['PC', 'PlayStation', 'Xbox', 'Nintendo', 'Móvil', 'Multiplataforma'], p.platform)}${selectField('Estilo', 'play_style', ['Casual', 'Competitivo', 'Ambos'], p.play_style)}
    ${selectField('Micrófono', 'mic_preference', ['Con micrófono', 'Sin micrófono', 'Indistinto'], p.mic_preference)}${selectField('Horario', 'schedule', ['Mañana', 'Tarde', 'Noche', 'Variable'], p.schedule)}</div>
    <fieldset class="field"><legend>Cómo prefiero jugar <small>(opcional, ayuda a encontrar compañeros que encajen)</small></legend><div class="check-grid">${PLAY_TAGS.map(([k, l, ic]) => `<label class="check-chip"><input type="checkbox" name="play_tags" value="${k}" ${tags.has(k) ? 'checked' : ''}>${icon(ic, 14)}<span>${e(l)}</span></label>`).join('')}</div></fieldset>
    ${priv?.birth_year ? `<div class="field"><span>Año de nacimiento <small>(privado)</small></span><div class="input locked">${icon('lock', 14)} ${e(priv.birth_year)} · registrado</div><small>Para proteger a menores no se puede cambiar desde la app. Si te equivocaste, escribe a soporte. ${band === 'minor' ? 'Tu cuenta está en el espacio para menores.' : ''}</small></div>`
    : `<label class="field">Año de nacimiento <small>(privado: nadie más lo ve · se registra una sola vez)</small><select class="select" name="birth_year"><option value="">Aún no</option>${BIRTH_YEARS().map(y => `<option value="${y}">${y}</option>`).join('')}</select>
      <small>Lo necesitas para mensajes privados, squads y guías. Menores solo se escriben en privado con otros menores.</small></label>`}
    <label class="switch"><input type="checkbox" name="looking_for" ${p.looking_for ? 'checked' : ''}><span class="sw"></span><span><b>Aparecer en Jugar</b><small>Otras personas podrán encontrarte como compañero de juego.</small></span></label>
    <label class="switch"><input type="checkbox" name="discord_visible" ${p.discord_visible ? 'checked' : ''}><span class="sw"></span><span><b>Mostrarme en el bot de Discord</b><small>Tu nombre, disponibilidad y Pasaporte GG podrán verse en servidores de Discord con el bot de GAMVORAQ. Nunca se muestra a menores.</small></span></label>
    ${fileField('Nuevo avatar (opcional)')}${fileField('Imagen de portada (opcional)', 'cover')}
    <button class="btn btn-primary" type="submit">Guardar perfil</button></form>`;
}

function availabilityForm() {
  const cur = (d().availability || []).find(a => a.user_id === state.user.id);
  const fav = myGames()[0];
  return `<p class="help">Tu estado aparece en Jugar y en el Inicio de tu gente, y desaparece solo cuando termina el tiempo.</p>
  <form data-form="availability"><label class="field">¿A qué quieres jugar?<select class="select" name="game_id">${gameOptions(cur?.game_id ?? fav ?? '')}</select></label>
    <fieldset class="field"><legend>¿Cómo quieres estar?</legend><div class="radio-row"><label class="radio-chip"><input type="radio" name="mode" value="normal" ${state.availMode !== 'silencioso' ? 'checked' : ''}><span>Buscando partida</span></label><label class="radio-chip"><input type="radio" name="mode" value="silencioso" ${state.availMode === 'silencioso' ? 'checked' : ''}><span>Sala tranquila (sin hablar)</span></label></div></fieldset>
    <fieldset class="field"><legend>¿Por cuánto tiempo?</legend><div class="radio-row">${AVAIL_DURATIONS.map(([m, l], i) => `<label class="radio-chip"><input type="radio" name="minutes" value="${m}" ${i === 1 ? 'checked' : ''}><span>${e(l)}</span></label>`).join('')}</div></fieldset>
    ${selectField('Plataforma', 'platform', ['PC', 'PlayStation', 'Xbox', 'Nintendo', 'Móvil', 'Multiplataforma'], cur?.platform || me().platform || 'Multiplataforma')}
    ${labelField('Nota corta (opcional)', 'note', `maxlength="120" placeholder="Ej.: Casual, sin micrófono" value="${e(cur?.note || '')}"`)}
    <button class="btn btn-primary" type="submit">${icon('circle-dot', 16)} Estoy disponible</button></form>`;
}

function scheduleForm() {
  // Solo los squads donde puedes agendar: dueño/admin, o integrante si el dueño lo permite.
  const squads = d().squads.filter(s => squadMember(s.id) && (s.members_can_schedule !== false || ['owner', 'admin'].includes(d().squad_members.find(m => m.squad_id === s.id && m.user_id === state.user.id)?.role)));
  const pre = arg() || state.selectedSquad || squads[0]?.id || '';
  const start = new Date(Date.now() + 2 * 3600000); start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
  const squad = squads.find(s => s.id === pre);
  return `<form data-form="session">${labelField('Título', 'title', 'required minlength="3" maxlength="80" value="Partida de esta noche"')}
    ${selectPairs('¿Quién puede unirse?', 'squad_id', [...squads.map(s => [s.id, `Squad: ${s.name}`]), ['', 'Partida abierta (cualquiera en Jugar)']], pre)}
    <label class="field">Juego<select class="select" name="game_id">${gameOptions(squad?.game_id || myGames()[0] || '')}</select></label>
    <div class="grid-2 tight"><label class="field">Día y hora<input class="input" type="datetime-local" name="starts_at" required value="${localInputValue(start)}" min="${localInputValue(Date.now())}"></label>
    ${selectPairs('Duración', 'duration_min', [[30, '30 min'], [60, '1 hora'], [90, '1 h 30 min'], [120, '2 horas'], [180, '3 horas']], 60)}</div>
    ${selectPairs('Cupo', 'capacity', [[2, '2 personas'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [8, '8'], [10, '10'], [20, '20']], 5)}
    <p class="help tiny">${icon('bell', 13)} El squad recibe un aviso al crearla. Cada quien puede añadirla a su calendario con recordatorio 15 minutos antes.</p>
    <button class="btn btn-primary" type="submit">${icon('calendar-plus', 16)} Agendar partida</button></form>`;
}

function rateForm() {
  const s = (d().play_sessions || []).find(x => x.id === arg());
  if (!s) return '<p class="muted">Esta partida ya no está disponible.</p>';
  const rated = new Set((d().chemistry_ratings || []).filter(c => c.session_id === s.id && c.rater_id === state.user.id).map(c => c.ratee_id));
  const mates = rateableMates(s, d().session_rsvps || [], state.user.id).filter(u => !rated.has(u));
  if (!mates.length) return empty('Ya calificaste a todas las personas de esta partida. ¡Gracias!', 'circle-check');
  return `<p class="help">«${e(s.title)}» · Elige lo que aplique para cada persona. Solo hay etiquetas positivas: si algo salió mal, usa reportar o bloquear. Nadie ve quién dio cada etiqueta.</p>
  <form data-form="rate" data-id="${e(s.id)}">${mates.map(u => `<fieldset class="rate-person"><legend>${avatar(getProfile(u), 'sm')}<b>${e(getProfile(u).display_name)}</b></legend><div class="check-grid">${CHEM_TAGS.map(([k, l, ic]) => `<label class="check-chip"><input type="checkbox" name="tag:${e(u)}" value="${k}">${icon(ic, 14)}<span>${e(l)}</span></label>`).join('')}</div></fieldset>`).join('')}
  <button class="btn btn-primary" type="submit">${icon('handshake', 16)} Enviar química</button></form>`;
}

function passportShare() {
  return `<p class="help">Comparte tu Pasaporte GG en Discord, redes o tu inscripción a un torneo. Se genera como imagen en tu dispositivo.</p>
  <div class="pp-preview" id="pp-preview"><canvas id="pp-canvas" width="1200" height="630" aria-label="Vista previa del Pasaporte GG"></canvas></div>
  <div class="row wrap">${btn('passport-download', `${icon('download', 15)} Descargar imagen`, 'btn btn-primary btn-sm')}${btn('passport-copy', `${icon('copy', 15)} Copiar texto`, 'btn btn-soft btn-sm')}</div>`;
}

/** Guía de instalación: la plataforma detectada primero, botón de un toque donde el navegador lo permite y el resto plegado. */
function installHtml(pwa) {
  const p = pwa.platform || { id: 'other' }, g = GUIDES[p.id] || GUIDES.other;
  if (pwa.standalone) return `<div class="inst-done">${icon('badge-check', 30)}<div><b>Ya la tienes instalada.</b><p class="help">Estás usando GAMVORAQ como app. Puedes instalarla también en tus otros dispositivos.</p></div></div>${otherGuides(p.id)}${shareRow()}`;
  const steps = `<ol class="inst-steps">${g.steps.map(s => `<li>${e(s)}</li>`).join('')}</ol>`;
  return `<div class="inst-hero"><span class="inst-ic">${icon(g.icon, 22)}</span><div><small>Tu dispositivo</small><b>${e(g.label)}</b></div></div>
  ${pwa.installable ? `<button class="btn btn-primary btn-lg btn-block" data-action="install">${icon('download', 18)} Instalar app</button>` : ''}
  ${steps}
  <ul class="inst-perks">${[['maximize', 'Pantalla completa, sin barra del navegador'], ['bell-ring', 'Avisos push de tu squad y tus partidas'], ['wifi-off', 'Abre y lee aunque no tengas conexión'], ['share-2', 'Comparte desde otras apps directo a GAMVORAQ'], ['zap', 'Accesos rápidos: «Disponible», «Agendar»…']].map(([i, t]) => `<li>${icon(i, 15)}<span>${t}</span></li>`).join('')}</ul>
  ${otherGuides(p.id)}${shareRow()}
  <p class="help tiny">${icon('shield-check', 13)} No descarga archivos raros: se instala desde el navegador, ocupa muy poco y se actualiza sola.</p>`;
}
const otherGuides = current => `<details class="inst-more"><summary>${icon('monitor-smartphone', 15)} Instalar en otro dispositivo</summary>${GUIDE_ORDER.filter(id => id !== current).map(id => `<div class="inst-alt"><b>${icon(GUIDES[id].icon, 14)} ${e(GUIDES[id].label)}</b><ol>${GUIDES[id].steps.map(s => `<li>${e(s)}</li>`).join('')}</ol></div>`).join('')}</details>`;
const shareRow = () => `<div class="row wrap inst-share">${btn('install-share', `${icon('send', 15)} Enviar enlace a mi teléfono`, 'btn btn-soft btn-sm')}</div>`;

function pushDiag(c) {
  if (!c) return '<p class="help tiny">Prueba que los avisos lleguen a este dispositivo, o revisa qué falta configurar en el servidor.</p>';
  const row = (ok, text, fix) => `<li class="${ok ? 'ok' : 'bad'}">${icon(ok ? 'circle-check' : 'circle-alert', 14)}<span>${text}${ok ? '' : ` — <small>${fix}</small>`}</span></li>`;
  return `<ul class="diag">${row(c.pg_net, 'Extensión pg_net activa en Supabase', 'Database → Extensions → pg_net')}${row(c.url, 'Dirección de la función «push» guardada', 'ver GUIA_NOTIFICACIONES.md, paso 4')}${row(c.secret, 'Clave secreta guardada', 'ver GUIA_NOTIFICACIONES.md, paso 4')}${row(c.devices > 0, `Este usuario tiene ${c.devices} dispositivo(s) suscrito(s)`, 'pulsa «Activar» en este dispositivo')}</ul>`;
}

function squadSettingsFields(sq) {
  return `<div class="grid-2 tight"><label class="field">¿Quién puede unirse?<select class="select" name="privacy"><option value="abierto" ${sq.privacy !== 'invitacion' ? 'selected' : ''}>Cualquiera (abierto)</option><option value="invitacion" ${sq.privacy === 'invitacion' ? 'selected' : ''}>Solo por invitación</option></select></label>
    <label class="field">Cupo máximo<input class="input" type="number" name="max_members" min="2" max="50" required value="${Number(sq.max_members) || 12}"></label></div>
    <label class="switch"><input type="checkbox" name="members_can_schedule" ${sq.members_can_schedule !== false ? 'checked' : ''}><span class="sw"></span><span><b>Todos pueden agendar partidas</b><small>Si lo apagas, solo el dueño y los admins agendan.</small></span></label>`;
}

export function modalContent(ctx = {}) {
  if (state.modal === 'install') return ['Instala GAMVORAQ', installHtml(ctx.pwa || {})];
  const v12 = v12Modal(); if (v12) return v12;
  const comm = d().communities.filter(c => staff(c.id));
  const joined = d().communities.filter(c => member(c.id));
  switch (state.modal.split(':')[0]) {
    case 'settings': return ['Ajustes', settingsHtml(ctx)];
    case 'edit-profile': return ['Tu perfil', profileForm()];
    case 'set-available': return ['Estoy disponible', availabilityForm()];
    case 'schedule-session': return ['Agendar partida', scheduleForm()];
    case 'rate-session': return ['Química de equipo', rateForm()];
    case 'share-passport': return ['Compartir Pasaporte GG', passportShare()];
    case 'compose': {
      const pre = arg();
      return ['Crear publicación', `<form data-form="post">${textField('¿Qué estás jugando?', 'body', 'Comparte un momento, un consejo o una invitación…', state.composeDraft || '', 5000, 'required')}<label class="field">¿Dónde se publica?<select class="select" name="community_id"><option value="">Mi perfil (lo ven quienes me siguen)</option>${d().communities.filter(c => member(c.id)).map(c => `<option value="${e(c.id)}" ${c.id === pre ? 'selected' : ''}>${e(c.name)}</option>`).join('')}</select></label>${fileField('Imagen adjunta (opcional)')}<p class="help tiny">${icon('languages', 13)} Quien hable otro idioma verá tu publicación traducida.</p><button class="btn btn-primary" type="submit">Publicar</button></form>`];
    }
    case 'create-community': return ['Crear comunidad', `<form data-form="community">${labelField('Nombre', 'name', 'required minlength="3" maxlength="65"')}${textField('Descripción', 'description', 'De qué trata y cuáles son sus reglas', '', 1000)}<button class="btn btn-primary" type="submit">Crear comunidad</button></form>`];
    case 'create-channel': {
      const pre = arg();
      return ['Crear canal de anuncios', `<form data-form="channel"><label class="field">Comunidad que moderas<select class="select" name="community_id" required>${comm.map(c => `<option value="${e(c.id)}" ${c.id === pre ? 'selected' : ''}>${e(c.name)}</option>`).join('')}</select></label>${labelField('Título del canal', 'title', 'required minlength="3" maxlength="70"')}${textField('Descripción', 'description', '', '', 300)}<button class="btn btn-primary" type="submit" ${comm.length ? '' : 'disabled'}>Crear canal</button></form>`];
    }
    case 'create-squad': {
      const owned = d().squads.filter(x => x.owner_id === state.user.id).length;
      return ['Nuevo squad', `${owned >= 5 ? `<div class="banner warn">${icon('triangle-alert', 16)}<span>Ya creaste 5 squads, el máximo. Transfiere o elimina uno para crear otro.</span></div>` : `<p class="help">Llevas ${owned} de 5 squads creados. Serás el dueño: podrás nombrar admins, invitar y agendar.</p>`}<form data-form="squad">${labelField('Nombre del equipo', 'name', 'required minlength="3" maxlength="60"')}${textField('Descripción', 'description', 'Nuestro estilo de juego…', '', 500)}<label class="field">Videojuego principal<select class="select" name="game_id">${gameOptions()}</select></label>${squadSettingsFields({ privacy: 'abierto', max_members: 12 })}<button class="btn btn-primary" type="submit" ${owned >= 5 ? 'disabled' : ''}>Crear squad</button></form>`];
    }
    case 'squad-edit': {
      const sq = d().squads.find(x => x.id === arg()); if (!sq) return ['Squad', empty('Este squad ya no existe.', 'users-round')];
      const owner = sq.owner_id === state.user.id;
      return ['Editar squad', `<div class="photo-row">${groupArt('squad', sq, 'lg', `<span class="group-ph lg">${icon('users-round', 30)}</span>`, true)}<div class="grow"><b>Foto del squad</b><small class="muted">Toca la imagen para elegir una. JPG, PNG, WEBP o GIF de máximo 5 MB.</small></div>${sq.avatar_url ? btn('group-photo-remove', 'Quitar foto', 'btn btn-ghost btn-sm', `data-kind="squad" data-id="${e(sq.id)}"`) : ''}</div>
        <form data-form="squad-edit" data-id="${e(sq.id)}">${labelField('Nombre del equipo', 'name', `required minlength="3" maxlength="60" value="${e(sq.name)}"`)}${textField('Descripción', 'description', '', sq.description, 500)}<label class="field">Videojuego principal<select class="select" name="game_id">${gameOptions(sq.game_id)}</select></label>${squadSettingsFields(sq)}<button class="btn btn-primary" type="submit">Guardar cambios</button></form>
        ${owner ? `<div class="danger-zone"><b>Zona de peligro</b><p class="help">Eliminar el squad borra su chat, agenda y recuerdos para todos. No se puede deshacer.</p>${btn('squad-delete', `${icon('trash-2', 15)} Eliminar squad`, 'btn btn-danger btn-sm', `data-id="${e(sq.id)}"`)}</div>` : ''}`];
    }
    case 'squad-invite': {
      const sq = d().squads.find(x => x.id === arg()); if (!sq) return ['Invitar', empty('Este squad ya no existe.', 'users-round')];
      const inSquad = new Set(d().squad_members.filter(m => m.squad_id === sq.id).map(m => m.user_id));
      const invited = new Set((d().squad_invites || []).filter(i => i.squad_id === sq.id).map(i => i.user_id));
      const term = (state.inviteSearch || '').toLowerCase();
      const follows = new Set(d().follows.filter(f => f.follower_id === state.user.id || f.followed_id === state.user.id).flatMap(f => [f.follower_id, f.followed_id]));
      const people = d().profiles.filter(p => p.id !== state.user.id && !inSquad.has(p.id) && (!state.privateOk || state.privateOk.has(p.id)) && (!term || (p.display_name + ' ' + p.username).toLowerCase().includes(term)))
        .sort((a, b) => (follows.has(b.id) - follows.has(a.id)) || a.display_name.localeCompare(b.display_name)).slice(0, 30);
      const full = d().squad_members.filter(m => m.squad_id === sq.id).length >= (sq.max_members || 12);
      return [`Invitar a ${sq.name}`, `${full ? `<div class="banner warn">${icon('triangle-alert', 16)}<span>El squad está lleno (${sq.max_members || 12}). Sube el cupo en «Editar» para invitar a más.</span></div>` : ''}<form class="search-row" data-form="invite-search" data-id="${e(sq.id)}" role="search"><label class="searchfield">${icon('search', 17)}<input class="input" name="term" value="${e(state.inviteSearch || '')}" placeholder="Busca por nombre o usuario" aria-label="Buscar personas"></label><button class="btn btn-soft" type="submit">Buscar</button></form>
        <p class="help tiny">Solo aparecen personas con las que puedes interactuar (mismo rango de edad y sin bloqueos). Primero, gente que sigues o te sigue.</p>
        <div class="member-list">${people.map(p => `<div class="member-row">${avatar(p, 'sm')}<div class="grow"><b>${e(p.display_name)}</b><small class="muted"> @${e(p.username)}${follows.has(p.id) ? ' · se siguen' : ''}</small></div>${invited.has(p.id) ? chip('Invitado', 'ok') : btn('squad-invite-send', `${icon('user-plus', 14)} Invitar`, 'btn btn-primary btn-sm', `data-id="${e(sq.id)}" data-user="${e(p.id)}" ${full ? 'disabled' : ''}`)}</div>`).join('') || empty('No encontramos personas con esa búsqueda.', 'users')}</div>`];
    }
    case 'follow-list': {
      const [, uid, kind] = state.modal.split(':');
      const p = getProfile(uid), ids = kind === 'following' ? d().follows.filter(f => f.follower_id === uid).map(f => f.followed_id) : d().follows.filter(f => f.followed_id === uid).map(f => f.follower_id);
      return [`${kind === 'following' ? 'Sigue a' : 'Seguidores de'} ${p.display_name}`, `<div class="member-list">${ids.map(id => { const x = getProfile(id), mine = id === state.user.id, fol = d().follows.some(f => f.follower_id === state.user.id && f.followed_id === id), back = d().follows.some(f => f.follower_id === id && f.followed_id === state.user.id);
        return `<div class="member-row">${avatar(x, 'sm')}<button class="link grow" data-action="view-user" data-id="${e(id)}"><b>${e(x.display_name)}</b><small class="muted"> @${e(x.username)}${back && !mine ? ' · te sigue' : ''}</small></button>${mine ? chip('Tú', 'accent') : btn('follow', fol ? 'Siguiendo' : back ? 'Seguir también' : 'Seguir', fol ? 'btn btn-soft btn-sm' : 'btn btn-primary btn-sm', `data-id="${e(id)}"`)}</div>`; }).join('') || empty(kind === 'following' ? 'Todavía no sigue a nadie.' : 'Todavía no tiene seguidores.', 'users')}</div>`];
    }
    case 'game-image': {
      const g = game(arg()); if (!g) return ['Juego', empty('Juego no encontrado.', 'gamepad-2')];
      return [`Portada de ${g.name}`, `<div class="game-image-preview">${gameArt(g, 'lg')}</div><p class="help">Sube una imagen horizontal (ideal 460×215) o escribe el número del juego en la tienda de Steam para usar su portada oficial.</p>
        <form data-form="game-image" data-id="${e(g.id)}">${fileField('Imagen de portada')}${labelField('Número de Steam (opcional)', 'steam_appid', `inputmode="numeric" pattern="[0-9]{1,8}" value="${e(g.steam_appid || '')}" placeholder="Ej. 413150 (está en la dirección de la tienda)"`)}<button class="btn btn-primary" type="submit">Guardar portada</button></form>`];
    }
    case 'quest-edit': {
      const q = d().quests.find(x => x.id === arg()); if (!q) return ['Reto', empty('Este reto ya no existe.', 'target')];
      const ended = q.ends_at && new Date(q.ends_at) <= new Date();
      return ['Editar reto', `<form data-form="quest-edit" data-id="${e(q.id)}">${labelField('Título del reto', 'title', `required minlength="4" maxlength="90" value="${e(q.title)}"`)}${textField('Descripción y reglas', 'description', '', q.description, 1600)}${labelField('Insignia a ganar', 'badge_name', `required minlength="3" maxlength="48" value="${e(q.badge_name)}"`)}<button class="btn btn-primary" type="submit">Guardar cambios</button></form>
        <div class="row wrap" style="margin-top:12px">${btn('quest-close', ended ? `${icon('rotate-ccw', 15)} Reabrir reto` : `${icon('lock', 15)} Cerrar reto`, 'btn btn-soft btn-sm', `data-id="${e(q.id)}" data-kind="${ended ? 'open' : 'close'}"`)}${btn('quest-delete', `${icon('trash-2', 15)} Eliminar`, 'btn btn-danger btn-sm', `data-id="${e(q.id)}"`)}</div>`];
    }
    case 'create-quest': {
      const pre = arg();
      return ['Nuevo reto positivo', `<form data-form="quest">${labelField('Título del reto', 'title', 'required minlength="4" maxlength="90"')}${textField('Descripción y reglas', 'description', 'Explica la actividad que deben realizar…', '', 1600)}${labelField('Insignia a ganar', 'badge_name', 'required minlength="3" maxlength="48" value="Compañero GG"')}<label class="field">Comunidad<select class="select" name="community_id"><option value="">Abierto para todos</option>${joined.map(c => `<option value="${e(c.id)}" ${c.id === pre ? 'selected' : ''}>${e(c.name)}</option>`).join('')}</select></label><button class="btn btn-primary" type="submit">Publicar reto</button></form>`];
    }
    case 'submit-quest': return ['Entregar evidencia', `<p class="help">Describe qué hiciste. Quien organiza revisa tu participación antes de aprobarla.</p><form data-form="quest-proof" data-id="${e(arg())}">${textField('Mi participación', 'proof', '¿A quién ayudaste o qué creaste?', '', 1600)}<button class="btn btn-primary" type="submit">Enviar para revisión</button></form>`];
    case 'review-quest': {
      const id = arg(), entries = d().quest_entries.filter(x => x.quest_id === id && x.status === 'submitted');
      return ['Revisar reto', `<div class="stack">${entries.map(x => `<div class="card card-pad"><b>${e(getProfile(x.user_id).display_name)}</b><p class="card-desc" style="margin:10px 0">${e(x.proof || 'Sin evidencia')}</p><div class="row">${btn('approve-quest', 'Aprobar', 'btn btn-primary btn-sm', `data-id="${e(id)}" data-user="${e(x.user_id)}"`)}${btn('reject-quest', 'Pedir ajustes', 'btn btn-soft btn-sm', `data-id="${e(id)}" data-user="${e(x.user_id)}"`)}</div></div>`).join('') || empty('Nadie ha enviado evidencia todavía.', 'target')}</div>`];
    }
    case 'add-gallery': return ['Añadir a mi galería', `<form data-form="gallery">${fileField('Tu fotografía')}${labelField('Descripción', 'caption', 'maxlength="240" placeholder="Recuerdo de mi partida"')}<button class="btn btn-primary" type="submit">Guardar imagen</button></form>`];
    case 'report-post': return ['Reportar publicación', `<p class="help">El reporte es privado y lo revisa el equipo moderador. No compartas datos personales.</p><form data-form="report" data-id="${e(arg())}">${selectField('Motivo', 'reason', ['acoso', 'odio', 'spam', 'contenido', 'otro'])}${textField('Detalles (opcional)', 'detail', '¿Qué ocurrió?', '', 1000)}<button class="btn btn-primary" type="submit">Enviar reporte</button></form>`];
    case 'create-memory': {
      const pre = state.memoryPrefill || {};
      const squad = d().squads.find(s => s.id === (pre.squad_id || arg())) || d().squads.find(s => s.id === state.selectedSquad);
      const members = d().squad_members.filter(m => m.squad_id === squad?.id && m.user_id !== state.user.id);
      const picked = new Set(pre.participants || []);
      return ['Guardar recuerdo del squad', `<form data-form="memory-create"><input type="hidden" name="squad_id" value="${e(squad?.id || '')}"><p class="small muted" style="margin-bottom:12px">Squad: ${e(squad?.name || '')}</p>${labelField('Título', 'title', `required minlength="3" maxlength="90" value="${e(pre.title || 'Nuestra mejor partida')}"`)}${textField('Qué pasó', 'story', 'Describe el momento que compartieron…', pre.story || '', 1800, 'required')}${fileField('Fotografía opcional')}<fieldset class="field"><legend>Quiénes aparecen <small>(opcional)</small></legend><div class="participant-list">${members.map(m => `<label><input type="checkbox" name="participant_id" value="${e(m.user_id)}" ${picked.has(m.user_id) ? 'checked' : ''}> ${e(getProfile(m.user_id).display_name)}</label>`).join('') || '<p class="muted small">Aún no hay más integrantes en tu squad.</p>'}</div></fieldset><button class="btn btn-primary" type="submit">Guardar recuerdo</button></form>`];
    }
    case 'coach': return ['Coach de partida', coachForm()];
    case 'family': return ['Modo familia · resumen', familyOverview()];
    case 'guide-offer': {
      const mine = myGames().map(id => game(id)).filter(Boolean);
      return ['Ofrecerme como guía', mine.length ? `<p class="help">Acompañarás a quien empieza en sus primeras partidas. Puedes aceptar o rechazar cada solicitud.</p><form data-form="guide-offer"><label class="field">Juego que dominas<select class="select" name="game_id" required>${mine.map(g => `<option value="${g.id}">${e(g.name)}</option>`).join('')}</select></label>${labelField('En qué puedes ayudar', 'note', 'maxlength="160" placeholder="Ej.: roles, controles, no tiltearse"')}<button class="btn btn-primary" type="submit">${icon('hand-heart', 16)} Ofrecerme</button></form>` : empty('Primero agrega a tu biblioteca los juegos que dominas.', 'gamepad-2', btn('nav-games', 'Ir a mis juegos', 'btn btn-primary btn-sm'))];
    }
    case 'guide-ask': {
      const p = getProfile(arg()), g = game(state.guideAsk?.game);
      return ['Pedir guía', `<p class="help">${e(p.display_name)} te acompañará en ${e(g?.name || 'el juego')}. Cuéntale tu nivel y qué te gustaría aprender.</p><form data-form="guide-ask" data-id="${e(p.id)}">${textField('Mensaje', 'message', 'Ej.: Nunca he jugado en equipo y me da pena equivocarme', '', 300)}<button class="btn btn-primary" type="submit">Enviar solicitud</button></form>`];
    }
    case 'guide-done': return ['¿Te ayudó tu guía?', `<p class="help">Tu respuesta es privada para la guía y le ayuda a ganar la insignia «Mentor GG».</p><div class="row wrap">${btn('guide-helpful', '👍 Sí, me ayudó', 'btn btn-primary', `data-id="${e(arg())}" data-kind="yes"`)}${btn('guide-helpful', 'No mucho', 'btn btn-soft', `data-id="${e(arg())}" data-kind="no"`)}</div>`];
    case 'create-league': return ['Crear liga local', `<form data-form="league">${labelField('Nombre', 'name', 'required minlength="3" maxlength="80" placeholder="Ej.: Liga Valorant Prepa 5"')}<div class="grid-2 tight">${selectPairs('Tipo', 'scope', LEAGUE_SCOPES, 'ciudad')}${labelField('Lugar (sin dirección exacta)', 'place', 'maxlength="80" placeholder="Ej.: Guadalajara, UNAM, Prepa 5"')}</div><label class="field">Juego<select class="select" name="game_id">${gameOptions(myGames()[0] || '')}</select></label>${textField('Reglas y descripción', 'description', 'Formato, horarios, premios o patrocinadores locales…', '', 600)}<button class="btn btn-primary" type="submit">${icon('trophy', 16)} Crear liga</button></form>`];
    case 'league-register': {
      const teams = new Set(d().league_teams.filter(t => t.league_id === arg()).map(t => t.squad_id));
      const owned = d().squad_members.filter(m => m.user_id === state.user.id && ['owner', 'admin'].includes(m.role) && !teams.has(m.squad_id)).map(m => d().squads.find(s => s.id === m.squad_id)).filter(Boolean);
      return ['Inscribir mi squad', owned.length ? `<form data-form="league-register" data-id="${e(arg())}">${selectPairs('Squad', 'squad_id', owned.map(s => [s.id, s.name]), owned[0].id)}<button class="btn btn-primary" type="submit">Inscribir</button></form>` : empty('Solo el dueño o los admins de un squad pueden inscribirlo.', 'users-round')];
    }
    case 'league-result': {
      const m = d().league_matches.find(x => x.id === arg()); if (!m) return ['Resultado', ''];
      const n = id => d().squads.find(s => s.id === id)?.name || 'Squad';
      return ['Registrar resultado', `<form data-form="league-result" data-id="${e(m.id)}"><div class="score-form"><label class="field">${e(n(m.home_squad))}<input class="input" type="number" name="home_score" min="0" max="999" required value="${m.home_score ?? ''}"></label><span>-</span><label class="field">${e(n(m.away_squad))}<input class="input" type="number" name="away_score" min="0" max="999" required value="${m.away_score ?? ''}"></label></div><p class="help tiny">Ambos squads recibirán el aviso del resultado.</p><button class="btn btn-primary" type="submit">Guardar resultado</button></form>`];
    }
    case 'steam-import': return ['Importar desde Steam', `<p class="help">Pega la URL de tu perfil de Steam (o tu nombre personalizado). En Steam, la privacidad de «Detalles del juego» debe estar en <b>Público</b>.</p><form data-form="steam"><label class="field">Perfil de Steam<input class="input" name="profile" required placeholder="https://steamcommunity.com/id/tu-nombre" autocomplete="off"></label><button class="btn btn-primary" type="submit">${icon('download', 16)} Importar mis juegos</button></form>${state.steamOut ? `<div class="coach-out" role="status">${e(state.steamOut)}</div>` : ''}`];
    default: return ['GAMVORAQ', '<p class="small muted">Selecciona una acción.</p>'];
  }
}
