// Pantalla de acceso: presentación de GAMVORAQ + formulario. VORA ya saluda aquí a quien aún no ha iniciado sesión.
import { e, icon } from '../ui.js';
import { avatarSvg } from '../companion/avatar.js';

// Las ideas que hacen distinta a GAMVORAQ (todas funcionan hoy dentro de la app).
export const INNOVATIONS = [
  ['languages', 'Chat sin idiomas', 'Cada mensaje llega traducido a tu idioma, con «Ver original» a un toque.'],
  ['handshake', 'Química y Pasaporte GG', 'Tras jugar, tus compañeros te califican en positivo: tu reputación viaja contigo.'],
  ['circle-dot', 'Disponible ahora', 'Un toque avisa a tu squad que puedes jugar; o agenda la partida con su archivo de calendario.'],
  ['hand-heart', 'Modo primer día', 'Quien empieza pide guía y un veterano lo acompaña. Ser guía da la insignia Mentor GG.'],
  ['moon', 'Sala tranquila', 'Busca partida sin micrófono, sin presión y sin toxicidad, avisando solo a quien elijas.'],
  ['trophy', 'Ligas locales', 'Torneos por ciudad o escuela con calendario automático y tabla de posiciones.'],
  ['rotate-ccw', 'Segunda oportunidad', 'Las sanciones se pueden limpiar con buena conducta: se corrige, no solo se castiga.'],
  ['shield-check', 'Modo familia', 'Madres, padres o tutores ven el bienestar de un menor sin leer sus conversaciones.'],
  ['bot', 'VORA, tu compañero', 'Planea tu noche, arma equipos, te recuerda la partida, detecta el tilt y juega contigo 5 mini-juegos.']
];

const birthOptions = () => { const y = new Date().getFullYear(); return '<option value="">Elige el año</option>' + Array.from({ length: y - 7 - 1930 + 1 }, (_, i) => `<option value="${y - 7 - i}">${y - 7 - i}</option>`).join(''); };

export function renderAuth({ mode, configured, showPass, online, installable, standalone }) {
  const register = mode === 'register';
  return `<div class="auth">
  <section class="auth-stage" aria-label="Presentación de GAMVORAQ">
    <div class="auth-top"><img src="/icons/icon-192.png" alt="" width="44" height="44"><div class="brand-word">GAM<b>VORAQ</b></div></div>
    <div class="auth-copy">
      <h1>Más que partidas.<span>Conexiones reales.</span></h1>
      <p>La red social gamer que te cuida: encuentra con quién jugar bien, habla con jugadores de cualquier país y juega sin toxicidad.</p>
    </div>
    <div class="auth-scene" aria-hidden="true">
      <div class="as-orb"></div><div class="as-ring r1"></div><div class="as-ring r2"></div>
      <span class="as-portal p1">${icon('radio', 18)}</span><span class="as-portal p2">${icon('images', 18)}</span><span class="as-portal p3">${icon('users-round', 18)}</span><span class="as-portal p4">${icon('book-open', 18)}</span>
      <div class="as-vora" data-mood="excited" data-acc="none" style="--vora-a:#e11d2e;--vora-b:#ff6b75;--vora-rgb:255,74,92">${avatarSvg('au')}</div>
      <div class="as-bubble">¡Hola! Soy VORA. Te acompaño desde que entras.</div>
    </div>
    <h2 class="auth-ideas-title">${INNOVATIONS.length} ideas que solo encuentras aquí</h2>
    <ul class="auth-features">${INNOVATIONS.map(([ic, t, d]) => `<li><span>${icon(ic, 18)}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ul>
    <div class="auth-foot">GAMVORAQ © 2026 · Comunidad primero · ${configured ? 'Acceso protegido con Supabase' : 'Supabase aún no está configurado'}</div>
  </section>
  <section class="auth-side">
    <div class="auth-card card">
      <div class="seg auth-seg" role="tablist" aria-label="Acceso">
        <button role="tab" class="${register ? '' : 'on'}" aria-selected="${!register}" data-action="set-auth" data-id="login">Iniciar sesión</button>
        <button role="tab" class="${register ? 'on' : ''}" aria-selected="${register}" data-action="set-auth" data-id="register">Crear cuenta</button>
      </div>
      <h2>${register ? 'Únete al universo' : 'Bienvenido de vuelta'}</h2>
      <p class="auth-sub">${register ? 'Crea tu identidad gamer y empieza a conectar.' : 'Entra para continuar la partida donde la dejaste.'}</p>
      ${!configured ? `<div class="banner warn">${icon('triangle-alert', 16)}<span>Supabase no está conectado. Revisa el archivo <b>.env</b> (hay una guía incluida). Mientras tanto puedes explorar la demostración.</span></div>` : ''}
      ${!online ? `<div class="banner warn">${icon('wifi-off', 16)}<span>Estás sin conexión. Para entrar con tu cuenta necesitas internet; la demostración sí funciona.</span></div>` : ''}
      <form class="auth-form" data-form="auth" novalidate>
        ${register ? `<label class="field">Nombre gamer<input class="input" name="display_name" maxlength="60" placeholder="Cómo quieres que te vean" required autocomplete="nickname"></label>
        <label class="field">Año de nacimiento <small>(privado · protege a menores)</small><select class="select" name="birth_year" required>${birthOptions()}</select><small>Nadie más lo ve. Menores y adultos no pueden escribirse en privado.</small></label>` : ''}
        <label class="field">Correo electrónico<input class="input" name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tucorreo@ejemplo.com"></label>
        <label class="field">Contraseña<span class="input-wrap"><input class="input" name="password" type="${showPass ? 'text' : 'password'}" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="6" required placeholder="Mínimo 6 caracteres"><button type="button" class="btn btn-ghost btn-icon btn-sm peek" data-action="toggle-pass" aria-label="${showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}" aria-pressed="${showPass}">${icon(showPass ? 'eye-off' : 'eye', 17)}</button></span></label>
        <button class="btn btn-primary btn-lg btn-block" type="submit" data-busy-label="${register ? 'Creando cuenta…' : 'Entrando…'}">${icon(register ? 'rocket' : 'log-in', 18)} ${register ? 'Crear mi cuenta' : 'Iniciar sesión'}</button>
      </form>
      <div class="auth-or"><span>o</span></div>
      <button class="btn btn-soft btn-lg btn-block" data-action="demo">${icon('play', 17)} Explorar la demostración</button>
      <p class="auth-note">La demostración usa datos de ejemplo y no necesita cuenta. Puedes probar casi todo; los cambios se guardan solo en esta ventana.</p>
      ${standalone ? '' : `<button class="btn ${installable ? 'btn-soft' : 'btn-ghost'} btn-sm btn-block auth-install" data-action="install">${icon('download', 16)} Instalar la app en este dispositivo</button>`}
    </div>
  </section>
</div>`;
}
