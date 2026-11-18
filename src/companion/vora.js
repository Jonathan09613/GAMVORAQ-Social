// VORA — compañero virtual flotante de GAMVORAQ.
// Se monta fuera del #app para no perder su estado cuando la app vuelve a renderizar.
import { avatarSvg } from './avatar.js';
import { loadMemory, saveMemory, forgetMemory, pushHistory, PALETTES, defaultMemory, EYES, MOUTHS, EARS, SHELLS, lookOf, applyLookTo } from './memory.js';
import {
  dayKey, touchDay, award, addBond, bondLevel, levelFromXp, track, claim, todaysMissions, checkAchievements, missionById
} from './gamification.js';
import { reply, proactive, tabTip } from './brain.js';
import { buildTrivia, buildEmojiQuiz, buildMemoryDeck, flipCard, memoryXp, reactionDelay, reactionGrade, rpsResult, rpsBot } from './minigames.js';
import { rollDice, parseDice, flipCoin, parseList, pickOne, makeTeams, TEAM_NAMES, planNight, addWater, waterToday, dueReminders } from './tools.js';
import { startSession, remainingMs, sessionProgress, nextNudge, formatClock, NUDGES, SESSION_KINDS, breathAt } from './session.js';
import { startAmbient, stopAmbient } from './ambient.js';
import { tabsHtml, chatHtml, typingHtml, chipsHtml, togetherHtml, gamesHtml, meHtml, introHtml, toolsHtml, commandHints } from './panel.js';
import { e, icon, greeting } from '../ui.js';

// Reglas: qué evento de la app da XP, avanza una misión y/o provoca una reacción de VORA.
const EVENT_RULES = {
  post:             { xp: 15, mission: 'post',       line: 'post' },
  comment:          { xp: 5,  mission: 'comment',    line: 'comment' },
  react:            { xp: 2,  mission: 'react',      line: 'react', cap: 'react', capXp: 10 },
  follow:           { xp: 5,  mission: 'follow',     line: 'follow' },
  squad_join:       { xp: 20,                        line: 'squad_join' },
  available:        { xp: 10, mission: 'available',  line: 'available' },
  rsvp:             { xp: 10, mission: 'rsvp',       line: 'rsvp' },
  session_created:  { xp: 15, mission: 'rsvp',       line: 'session_created' },
  chemistry:        { xp: 15, mission: 'chemistry',  line: 'chemistry' },
  quest_join:       { xp: 10, mission: 'quest',      line: 'quest_join' },
  dm:               { xp: 3,  mission: 'dm',         line: 'dm' },
  game_added:       { xp: 5,  mission: 'game_added', line: 'game_added' },
  memory:           { xp: 10, mission: 'memory',     line: 'memory' },
  profile_saved:    { xp: 5,                         line: 'profile_saved' }
};

export function createVora(host) {
  const reduceMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => globalThis.matchMedia?.('(max-width: 800px)').matches;

  let uid = null, userName = '', mem = defaultMemory();
  let root, bodyBtn, bubbleEl, panel, fxEl, timerChip, badgeEl, introEl;
  let panelOpen = false, tab = 'chat', baseMoodOverride = null, moodTimer = null;
  let bubbleTimer = null, typeTimer = null, lastSpoke = 0, spokeLog = [];
  let lastActive = Date.now(), wasSleepy = false, lastBreak = Date.now(), lastLateDay = '';
  let session = null, finished = null, breath = null, setup = { kind: 'focus', minutes: 25, ambient: 'off' };
  let game = null, chips = [], seenTabs = new Set(), tickN = 0, mounted = false, dragInfo = null;
  let introStep = 0;
  let tools = { teamsN: 2, planH: 2, planMood: 'chill', remMin: 15 }, reflexTimer = null, memTimer = null;

  // ---------- utilidades ----------
  const persist = () => saveMemory(uid, mem);
  const hourNow = () => new Date().getHours();
  const timeLabel = () => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }).format(new Date());
  const level = () => levelFromXp(mem.xp);
  const claimable = () => todaysMissions(mem).filter(m => m.done && !m.claimed).length;

  function ctx(extra = {}) {
    const h = host.getContext?.() || {};
    const missions = todaysMissions(mem);
    return {
      vibe: mem.vibe, nick: mem.nickname, userName, companionName: mem.name, favGame: mem.favGame,
      greet: greeting(hourNow()), hour: hourNow(), timeLabel: timeLabel(), level: level().level, streak: mem.streak,
      days: mem.days, bond: bondLevel(mem.bond).level, missionsDone: missions.filter(m => m.done).length, missionsTotal: missions.length,
      topMatch: h.topMatch || null, catalog: h.catalog || [], libraryHint: h.libraryHint || [], online: h.online !== false,
      availableNow: h.availableNow || [], nextSession: h.nextSession || null, unread: h.unread || 0, water: waterToday(mem, dayKey()), now: Date.now(), minute: new Date().getMinutes(), ...extra
    };
  }

  // ---------- montaje ----------
  function mount() {
    if (mounted) return; mounted = true;
    root = document.createElement('div');
    root.className = 'vora';
    root.id = 'vora-root';
    root.dataset.mood = 'happy';
    root.innerHTML = `
      <div class="vora-bubble" role="status" aria-live="polite" hidden></div>
      <button type="button" class="vora-body" aria-label="Abrir a ${e(mem.name)}, tu compañero virtual" aria-expanded="false" aria-controls="vora-panel">
        <span class="vora-aura"></span>${avatarSvg('f')}<span class="vora-fx"></span>
        <span class="vora-badge" hidden>0</span><span class="vora-timer" hidden>00:00</span>
      </button>
      <section class="vora-panel" id="vora-panel" role="dialog" aria-label="${e(mem.name)}, compañero virtual" hidden>
        <header class="vp-head"><div class="vp-avatar">${avatarSvg('p')}<span class="vora-fx vp-fx"></span></div>
          <div class="vp-id"><b class="vp-name"></b><span class="vp-status"></span></div>
          <button type="button" class="vp-icon" data-v="pet" aria-label="Acariciar">${icon('heart', 18)}</button>
          <button type="button" class="vp-icon" data-v="close" aria-label="Cerrar panel">${icon('x', 18)}</button></header>
        <nav class="vp-tabs" role="tablist" aria-label="Secciones de VORA"></nav>
        <div class="vp-body" tabindex="0"></div>
        <footer class="vp-foot"><div class="vp-chips"></div><form class="vp-form" autocomplete="off"><input class="input" name="msg" maxlength="300" placeholder="Escríbele a VORA…" aria-label="Mensaje para VORA"><button class="btn btn-primary btn-icon" type="submit" aria-label="Enviar">${icon('send', 17)}</button></form></footer>
      </section>`;
    document.body.append(root);
    bodyBtn = root.querySelector('.vora-body'); bubbleEl = root.querySelector('.vora-bubble'); panel = root.querySelector('.vora-panel');
    fxEl = root.querySelectorAll('.vora-fx'); timerChip = root.querySelector('.vora-timer'); badgeEl = root.querySelector('.vora-badge');
    wire();
    applyLook(); applyPos(); renderPanel();
    setInterval(tick, 1000);
  }

  function wire() {
    // arrastre + pulsación larga (acariciar) + clic (abrir panel)
    bodyBtn.addEventListener('pointerdown', ev => {
      dragInfo = { sx: ev.clientX, sy: ev.clientY, ox: root.offsetLeft, oy: root.offsetTop, moved: false, long: false, id: ev.pointerId };
      bodyBtn.setPointerCapture?.(ev.pointerId);
      dragInfo.timer = setTimeout(() => { if (dragInfo && !dragInfo.moved) { dragInfo.long = true; pet(); } }, 600);
    });
    bodyBtn.addEventListener('pointermove', ev => {
      if (!dragInfo) return;
      const dx = ev.clientX - dragInfo.sx, dy = ev.clientY - dragInfo.sy;
      if (!dragInfo.moved && Math.hypot(dx, dy) > 7) { dragInfo.moved = true; root.classList.add('dragging'); hideBubble(); }
      if (dragInfo.moved) {
        root.style.left = Math.max(4, Math.min(innerWidth - root.offsetWidth - 4, dragInfo.ox + dx)) + 'px'; root.style.right = 'auto';
        root.style.top = Math.max(60, Math.min(innerHeight - root.offsetHeight - 8, dragInfo.oy + dy)) + 'px'; root.style.bottom = 'auto';
      }
    });
    const end = () => {
      if (!dragInfo) return; clearTimeout(dragInfo.timer);
      const d = dragInfo; dragInfo = null; root.classList.remove('dragging');
      if (d.moved) { const cx = root.offsetLeft + root.offsetWidth / 2; mem.pos = { side: cx < innerWidth / 2 ? 'left' : 'right', y: root.offsetTop / innerHeight }; persist(); applyPos(true); }
      else if (!d.long) togglePanel();
    };
    bodyBtn.addEventListener('pointerup', end);
    bodyBtn.addEventListener('pointercancel', () => { if (dragInfo) { clearTimeout(dragInfo.timer); dragInfo = null; root.classList.remove('dragging'); applyPos(); } });
    bodyBtn.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); togglePanel(); } });
    bubbleEl.addEventListener('click', ev => { const c = ev.target.closest('[data-a]'); if (c) { doAction(c.dataset.a); hideBubble(); } else { openPanel('chat'); } });
    bubbleEl.addEventListener('pointerenter', () => clearTimeout(bubbleTimer));
    bubbleEl.addEventListener('pointerleave', () => scheduleHide(2200));

    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('change', onPanelChange);
    panel.addEventListener('submit', onPanelSubmit);
    panel.addEventListener('input', ev => { if (!ev.target.matches('.vp-form input')) return; const v = ev.target.value; panel.querySelector('.vp-chips').innerHTML = v.startsWith('/') ? chipsHtml(commandHints(v)) : chipsHtml(chips); });
    panel.addEventListener('keydown', ev => { if (ev.key === 'Escape') closePanel(true); });
    // Escape también cierra el panel aunque el foco ya no esté dentro (p. ej. tras re-renderizar). Cede ante modales y menús.
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape' || !panelOpen || ev.defaultPrevented) return;
      if (document.querySelector('.modal-back, .cmdk-back, .drawer-back, .g-back')) return;
      closePanel(true);
    });

    // seguimiento de ojos + actividad
    let raf = 0;
    document.addEventListener('pointermove', ev => {
      markActive();
      if (reduceMotion() || raf) return;
      raf = requestAnimationFrame(() => { raf = 0; lookAt(ev.clientX, ev.clientY); });
    }, { passive: true });
    ['keydown', 'pointerdown', 'scroll', 'touchstart'].forEach(t => document.addEventListener(t, markActive, { passive: true, capture: true }));
    addEventListener('resize', () => applyPos());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) markActive(); });
  }

  function lookAt(x, y) {
    const target = panelOpen ? panel.querySelector('.vp-avatar') : bodyBtn; if (!target) return;
    const r = target.getBoundingClientRect(); if (!r.width) return;
    const dx = Math.max(-1, Math.min(1, (x - (r.left + r.width / 2)) / (innerWidth / 2)));
    const dy = Math.max(-1, Math.min(1, (y - (r.top + r.height / 2)) / (innerHeight / 2)));
    root.style.setProperty('--ex', (dx * 3.6).toFixed(2)); root.style.setProperty('--ey', (dy * 2.6).toFixed(2)); root.style.setProperty('--tilt', (dx * 5).toFixed(1) + 'deg');
  }

  function applyLook() {
    const p = PALETTES[mem.color] || PALETTES.crimson;
    root.style.setProperty('--vora-a', p.a); root.style.setProperty('--vora-b', p.b); root.style.setProperty('--vora-rgb', p.rgb);
    root.dataset.acc = mem.accessory;
    root.dataset.eyes = mem.eyes || 'classic'; root.dataset.mouth = mem.mouth || 'smile'; root.dataset.ears = mem.ears || 'crest'; root.dataset.shell = mem.shell || 'hex';
    root.classList.toggle('is-hidden', Boolean(mem.hidden));
    root.querySelector('.vp-name').textContent = mem.name;
    bodyBtn.setAttribute('aria-label', `Abrir a ${mem.name}, tu compañero virtual`);
    updateStatus(); updateBadge();
  }
  function applyPos(animate = false) {
    const size = bodyBtn.offsetWidth || 84, margin = 10, bottomSafe = isMobile() ? 96 : 24;
    const top = Math.max(64, Math.min(innerHeight - size - bottomSafe, (mem.pos.y ?? 0.92) * innerHeight));
    root.dataset.side = mem.pos.side; root.classList.toggle('snap', animate);
    root.style.top = top + 'px'; root.style.bottom = 'auto';
    if (mem.pos.side === 'left') { root.style.left = margin + 'px'; root.style.right = 'auto'; } else { root.style.right = margin + 'px'; root.style.left = 'auto'; }
    root.classList.toggle('below', top < 150);
    if (animate) setTimeout(() => root.classList.remove('snap'), 350);
  }
  function updateStatus() {
    const st = panel.querySelector('.vp-status'); if (!st) return;
    const names = { happy: 'contento', excited: 'emocionado', celebrate: 'celebrando', laugh: 'riendo', love: 'enamorado', sleepy: 'con sueño', surprised: 'sorprendido', curious: 'curioso', caring: 'atento', calm: 'tranquilo', focus: 'concentrado' };
    st.innerHTML = `<i class="dot"></i>${names[root.dataset.mood] || 'contento'} · vínculo ${bondLevel(mem.bond).level}`;
  }
  function updateBadge() {
    const n = claimable();
    badgeEl.hidden = n === 0; badgeEl.textContent = String(n);
    badgeEl.title = n ? `${n} misión(es) lista(s) para reclamar` : '';
  }

  // ---------- estado de ánimo ----------
  function baseMood() {
    if (session) return SESSION_KINDS[session.kind].mood;
    if (Date.now() - lastActive > 120000) return 'sleepy';
    return 'happy';
  }
  function setMood(m, ms = 3800) {
    clearTimeout(moodTimer); root.dataset.mood = m; updateStatus();
    if (ms) moodTimer = setTimeout(() => { root.dataset.mood = baseMood(); updateStatus(); }, ms);
  }
  function fx(kind) {
    const glyph = { hearts: '♥', sparkles: '✦', zzz: 'z', confetti: '✺' }[kind] || '✦';
    const count = kind === 'confetti' ? 10 : 5;
    fxEl.forEach(box => {
      if (box.closest('.vora-body') && panelOpen) return;
      if (box.classList.contains('vp-fx') && !panelOpen) return;
      for (let i = 0; i < count; i++) {
        const s = document.createElement('i'); s.className = `fx fx-${kind}`; s.textContent = glyph;
        s.style.setProperty('--dx', (Math.random() * 90 - 45).toFixed(0) + 'px'); s.style.setProperty('--dr', (Math.random() * 60 - 30).toFixed(0) + 'deg');
        s.style.animationDelay = (i * 90) + 'ms'; box.append(s); setTimeout(() => s.remove(), 2200 + i * 90);
      }
    });
  }
  function floatXp(amount) {
    if (!amount || panelOpen || reduceMotion()) return;
    const s = document.createElement('i'); s.className = 'vora-xp'; s.textContent = `+${amount} XP`; root.append(s); setTimeout(() => s.remove(), 1800);
  }

  // ---------- habla (burbuja / chat) ----------
  function allowed(priority) {
    const now = Date.now();
    if (priority >= 2) return true;
    if (mem.quiet) return false;
    if (priority === 1) return now - lastSpoke > 2500;
    spokeLog = spokeLog.filter(t => now - t < 600000);
    return now - lastSpoke > 25000 && spokeLog.length < 5;
  }
  /** priority: 0 = espontáneo · 1 = reacción a una acción · 2 = importante o pedido por la persona */
  function say(res, { priority = 1, ttl } = {}) {
    if (!res || !res.text || !allowed(priority)) return false;
    lastSpoke = Date.now(); if (priority === 0) spokeLog.push(lastSpoke);
    if (res.mood) setMood(res.mood, 4200);
    if (res.effect) fx(res.effect);
    const note = panelOpen && tab === 'together' ? panel.querySelector('#vp-session-note') : null; if (note) note.textContent = res.text;
    if (panelOpen) { pushHistory(mem, 'vora', res.text); persist(); chips = res.chips || []; if (tab === 'chat') { renderChat(); } return true; }
    showBubble(res.text, res.chips || [], ttl); return true;
  }
  function showBubble(text, cs = [], ttl) {
    clearTimeout(bubbleTimer); clearInterval(typeTimer);
    bubbleEl.hidden = false; bubbleEl.classList.remove('out');
    const chipsMarkup = cs.slice(0, 2).map(c => `<button type="button" class="vb-chip" data-a="${e(c.a)}">${e(c.l)}</button>`).join('');
    const out = bubbleEl; out.innerHTML = `<span class="vb-text"></span>${chipsMarkup ? `<span class="vb-chips">${chipsMarkup}</span>` : ''}`;
    const span = out.querySelector('.vb-text');
    if (reduceMotion()) span.textContent = text;
    else { let i = 0; typeTimer = setInterval(() => { span.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeTimer); }, 16); }
    scheduleHide(ttl || Math.min(13000, 4200 + text.length * 55));
  }
  function scheduleHide(ms) { clearTimeout(bubbleTimer); bubbleTimer = setTimeout(hideBubble, ms); }
  function hideBubble() { clearTimeout(bubbleTimer); clearInterval(typeTimer); bubbleEl.classList.add('out'); setTimeout(() => { if (bubbleEl.classList.contains('out')) bubbleEl.hidden = true; }, 220); }

  // ---------- eventos de la app ----------
  function event(type, payload = {}) {
    const rule = EVENT_RULES[type];
    let xpGained = 0;
    if (rule) {
      let xp = rule.xp;
      if (rule.cap) { const used = mem.counts.reactXp || 0; xp = Math.max(0, Math.min(xp, rule.capXp - used)); mem.counts.reactXp = used + xp; }
      if (xp) { const a = award(mem, xp); xpGained = xp; if (a.leveledUp) levelUp(a.level); }
      if (rule.mission) { const t = track(mem, rule.mission); t.completed.forEach(id => missionDone(id)); }
      persist();
      if (xpGained) floatXp(xpGained);
      if (rule.line) { const p = proactive(rule.line, ctx(payload)); say(p, { priority: 1 }); }
    } else {
      const p = proactive(type, ctx(payload));
      if (p) say(p, { priority: payload.priority ?? 1 });
    }
    afterChange();
  }
  function levelUp(l) { setTimeout(() => { say(proactive('level_up', ctx({ level: l })), { priority: 2 }); fx('confetti'); }, 700); }
  function missionDone(id) {
    const m = missionById(id); if (!m) return;
    setTimeout(() => say(proactive('mission_done', ctx()), { priority: 1 }), 500);
  }
  function afterChange() {
    const fresh = checkAchievements(mem);
    fresh.forEach((a, i) => setTimeout(() => say(proactive('achievement', ctx({ label: a.label })), { priority: 2 }), 900 + i * 600));
    updateBadge(); updateStatus(); persist(); host.requestRender?.();
    if (panelOpen && tab === 'me') renderBody();
  }
  function gainBond(kind, amount) {
    const r = addBond(mem, kind, amount);
    if (r.leveledUp) setTimeout(() => { say(proactive('bond_up', ctx({ bond: r.level })), { priority: 2 }); fx('hearts'); }, 600);
    return r;
  }
  function claimMission(id) {
    const r = claim(mem, id); if (!r.ok) return r;
    floatXp(r.xp + r.bonus); fx('sparkles');
    if (r.leveledUp) levelUp(r.level);
    if (r.allDone) setTimeout(() => say(proactive('all_missions', ctx()), { priority: 2 }), 400);
    gainBond('mood', 1);
    afterChange(); return r;
  }

  // ---------- panel ----------
  function togglePanel() { panelOpen ? closePanel(true) : openPanel(tab); }
  function openPanel(t = 'chat') {
    if (t && t !== tab) tab = t;
    hideBubble();
    panelOpen = true; panel.hidden = false; root.classList.add('open'); bodyBtn.setAttribute('aria-expanded', 'true');
    renderPanel(); updateStatus();
    requestAnimationFrame(() => { panel.classList.add('in'); (tab === 'chat' && !isMobile() ? panel.querySelector('.vp-form input') : panel.querySelector('.vp-tab.on'))?.focus({ preventScroll: true }); });
  }
  function closePanel(focusBack) {
    panelOpen = false; panel.classList.remove('in'); root.classList.remove('open'); bodyBtn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!panelOpen) panel.hidden = true; }, 200);
    if (focusBack) bodyBtn.focus({ preventScroll: true });
  }
  function renderPanel() {
    panel.querySelector('.vp-tabs').innerHTML = tabsHtml(tab);
    panel.querySelector('.vp-foot').hidden = tab !== 'chat';
    renderBody();
  }
  function renderBody() {
    const body = panel.querySelector('.vp-body');
    panel.querySelector('.vp-foot').hidden = tab !== 'chat';
    if (tab === 'chat') { renderChat(); return; }
    body.className = 'vp-body';
    if (tab === 'together') body.innerHTML = togetherHtml({ session, breath, setup: { ...setup, ambient: mem.ambient || setup.ambient }, finished });
    if (tab === 'games') body.innerHTML = gamesHtml({ game, scores: mem.scores });
    if (tab === 'me') body.innerHTML = meHtml({ mem, achievements: mem.achievements });
    if (tab === 'tools') body.innerHTML = toolsHtml({ t: tools, mem, today: dayKey(), libraryHint: host.getContext?.().libraryHint || [] });
    body.scrollTop = 0;
  }
  function renderChat() {
    const body = panel.querySelector('.vp-body'); if (tab !== 'chat') return;
    body.className = 'vp-body vp-chat'; body.innerHTML = chatHtml(mem.history.slice(-24), mem.name);
    // Primero las sugerencias (cambian la altura del pie) y después el desplazamiento al último mensaje.
    panel.querySelector('.vp-chips').innerHTML = chipsHtml(chips.length ? chips : (mem.history.length ? [] : [{ l: 'Mis misiones', a: 'say:mis misiones' }, { l: 'Un chiste', a: 'say:cuéntame un chiste' }, { l: 'Sesión juntos', a: 'session:start' }, { l: 'Ayuda', a: 'say:ayuda' }]));
    const input = panel.querySelector('.vp-form input'); if (input?.value.startsWith('/')) panel.querySelector('.vp-chips').innerHTML = chipsHtml(commandHints(input.value));
    const toEnd = () => { body.scrollTop = body.scrollHeight; };
    toEnd(); requestAnimationFrame(toEnd);
  }

  function userSend(text) {
    const clean = String(text || '').trim().slice(0, 300); if (!clean) return;
    pushHistory(mem, 'me', clean); chips = []; renderChat();
    const body = panel.querySelector('.vp-body'); body.insertAdjacentHTML('beforeend', typingHtml()); body.scrollTop = body.scrollHeight;
    const local = reply(clean, ctx());
    // Si las reglas no saben responder y la persona activó la IA, se consulta al servidor (con respaldo local).
    const history = mem.history.slice(-9, -1).map(h => ({ role: h.who === 'me' ? 'user' : 'assistant', content: h.text }));
    const ask = local.fallback && host.askAI ? host.askAI(clean, history, { name: mem.name, nick: mem.nickname }) : null;
    const started = Date.now();
    Promise.resolve(ask).then(text => (text ? { text, mood: 'happy', chips: [] } : local)).catch(() => local).then(res => {
    const delay = reduceMotion() ? 0 : Math.max(0, 350 + Math.min(900, res.text.length * 7) - (Date.now() - started));
    setTimeout(() => {
      if (res.remember) { Object.assign(mem, res.remember); applyLook(); }
      if (res.reminder) addReminder(res.reminder.text, res.reminder.at);
      if (res.water) { addWater(mem, dayKey(), res.water); useTool(); }
      if (/^(🎲|🪙|🧮|📋|🎯|⏰)/.test(res.text) || res.reminder) useTool();
      pushHistory(mem, 'vora', res.text); chips = res.chips || []; lastSpoke = Date.now();
      if (res.mood) setMood(res.mood, 4200); if (res.effect) fx(res.effect);
      const t = track(mem, 'vora_chat'); t.completed.forEach(missionDone);
      const a = award(mem, (mem.counts.chatXp || 0) < 5 ? 1 : 0); if (a.gained) mem.counts.chatXp = (mem.counts.chatXp || 0) + 1; if (a.leveledUp) levelUp(a.level);
      gainBond('chat'); afterChange(); if (tab === 'chat') renderChat();
    }, delay);
    });
  }

  function doAction(a) {
    const i = a.indexOf(':'), kind = i < 0 ? a : a.slice(0, i), arg = i < 0 ? '' : a.slice(i + 1);
    switch (kind) {
      case 'say': if (!panelOpen) openPanel('chat'); tab = 'chat'; renderPanel(); userSend(arg); break;
      case 'go': host.navigate?.(arg); if (isMobile()) closePanel(); break;
      case 'modal': host.openModal?.(arg); closePanel(); break;
      case 'panel': openPanel(arg || 'chat'); break;
      case 'game': startGame(arg); break;
      case 'session': tab = 'together'; openPanel('together'); break;
      case 'breathe': tab = 'together'; openPanel('together'); startBreath(); break;
      case 'install': host.install?.(); break;
      case 'user': host.openProfile?.(arg); if (isMobile()) closePanel(); break;
      case 'dm': host.openDm?.(arg); if (isMobile()) closePanel(); break;
      case 'fill': { if (!panelOpen) openPanel('chat'); const inp = panel.querySelector('.vp-form input'); if (inp) { inp.value = arg + (arg.endsWith(' ') ? '' : ''); inp.focus(); chips = []; panel.querySelector('.vp-chips').innerHTML = ''; } break; }
      default: break;
    }
  }

  function onPanelClick(ev) {
    const t = ev.target.closest('[data-v]'); if (!t) return;
    const v = t.dataset.v, id = t.dataset.id;
    switch (v) {
      case 'close': closePanel(true); break;
      case 'pet': pet(); break;
      case 'tab': tab = id; clearTimeout(reflexTimer); if (game?.type === 'reflex' && game.state === 'wait') game.state = 'ready'; if (id !== 'games') game = game && game.done ? null : game; renderPanel(); break;
      case 'chip': doAction(t.dataset.a); break;
      case 'session-kind': setup.kind = id; renderBody(); break;
      case 'session-min': setup.minutes = Number(id); renderBody(); break;
      case 'session-amb': mem.ambient = id; setup.ambient = id; persist(); renderBody(); break;
      case 'session-start': beginSession(); break;
      case 'session-stop': endSession(false); break;
      case 'breath-start': startBreath(); break;
      case 'breath-stop': stopBreath(true); break;
      case 'game': startGame(id); break;
      case 'game-exit': game = null; renderBody(); break;
      case 'trivia-pick': triviaPick(Number(id)); break;
      case 'trivia-next': triviaNext(); break;
      case 'reflex-tap': reflexTap(); break;
      case 'mem-flip': memFlip(Number(id)); break;
      case 'rps': rpsPlay(id); break;
      case 'tool-dice': { const d = rollDice(parseDice(id)); tools.dice = `🎲 ${d.label}: ${d.rolls.join(' + ')}${d.rolls.length > 1 ? ' = ' + d.total : ''}${d.crit === 'max' ? ' · ¡CRÍTICO!' : d.crit === 'min' ? ' · pifia' : ''}`; tools.diceAnim = true; if (d.crit === 'max') fx('confetti'); setMood('excited', 1500); useTool(); renderBody(); break; }
      case 'tool-coin': tools.dice = `🪙 ¡${flipCoin()}!`; tools.diceAnim = true; setMood('excited', 1500); useTool(); renderBody(); break;
      case 'tool-wheel': { const ta = panel.querySelector('[data-v-input="wheel"]'); tools.wheelText = ta?.value || ''; const opts = parseList(tools.wheelText); if (opts.length < 2) { tools.wheel = 'Escribe al menos dos opciones.'; renderBody(); break; } tools.wheel = '…'; tools.wheelAnim = true; renderBody(); let n = 0; const spin = setInterval(() => { const el = panel.querySelector('.vp-result.spin'); if (el) el.lastChild.textContent = ' ' + pickOne(opts); if (++n > 14) { clearInterval(spin); tools.wheel = pickOne(opts); tools.wheelAnim = false; setMood('celebrate', 2000); fx('sparkles'); useTool(); renderBody(); } }, 70 + n * 4); break; }
      case 'tool-teams-n': tools.teamsN = Number(id); keepInputs(); renderBody(); break;
      case 'tool-teams': { keepInputs(); const names = parseList(tools.teamsText || ''); if (names.length < 2) { tools.teams = [{ name: 'Faltan nombres', list: ['Escribe al menos dos nombres separados por coma.'] }]; renderBody(); break; } tools.teams = makeTeams(names, tools.teamsN).map((list, i) => ({ name: TEAM_NAMES[i], list })); setMood('excited', 1800); useTool(); renderBody(); break; }
      case 'tool-plan-h': tools.planH = Number(id); keepInputs(); renderBody(); break;
      case 'tool-plan-mood': tools.planMood = id; keepInputs(); renderBody(); break;
      case 'tool-plan': { keepInputs(); const c = ctx(); tools.plan = planNight({ hours: tools.planH, mood: tools.planMood, hour: c.hour, minute: c.minute, nextSession: c.nextSession, favGame: mem.favGame }); setMood('focus', 2000); useTool(); renderBody(); break; }
      case 'tool-rem-min': tools.remMin = Number(id); { const v = panel.querySelector('.vp-rem-form input')?.value; renderBody(); const inp = panel.querySelector('.vp-rem-form input'); if (inp && v) inp.value = v; } break;
      case 'rem-del': mem.reminders = (mem.reminders || []).filter(r => r.id !== id); persist(); renderBody(); break;
      case 'water': { const n = addWater(mem, dayKey(), Number(id)); if (Number(id) > 0) { setMood(n >= 8 ? 'celebrate' : 'happy', 1800); if (n === 8) { fx('confetti'); say({ text: '¡8 vasos! Meta de agua cumplida. 💧', mood: 'celebrate' }, { priority: 2 }); } useTool(); } persist(); afterChange(); renderBody(); break; }
      case 'vibe': mem.vibe = id; persist(); introEl ? renderIntro() : renderBody(); say({ text: id === 'animo' ? '¡Perfecto! Pondré toda la energía. ✦' : id === 'calma' ? 'Entendido. Iré con calma.' : 'Recibido. Seré directo y práctico.', mood: 'happy' }, { priority: 2 }); break;
      case 'color': mem.color = id; applyLook(); persist(); if (introEl) renderIntro(); else { renderBody(); host.requestRender?.(); } host.saveLook?.(lookOf(mem)); break;
      case 'acc': mem.accessory = id; applyLook(); persist(); renderBody(); host.requestRender?.(); setMood('excited', 2500); host.saveLook?.(lookOf(mem)); break;
      case 'eyes': case 'mouth': case 'ears': case 'shell': {
        const opts = { eyes: EYES, mouth: MOUTHS, ears: EARS, shell: SHELLS }[v];
        if (!opts.some(o => o.id === id)) break;
        mem[v] = id; applyLook(); persist(); renderBody(); host.requestRender?.(); setMood(v === 'eyes' ? 'surprised' : 'excited', 1800); host.saveLook?.(lookOf(mem)); break;
      }
      case 'look-random': {
        const pick = list => list[Math.floor(Math.random() * list.length)].id;
        Object.assign(mem, { eyes: pick(EYES), mouth: pick(MOUTHS), ears: pick(EARS), shell: pick(SHELLS), color: pick(Object.keys(PALETTES).map(id => ({ id }))) });
        applyLook(); persist(); renderBody(); host.requestRender?.(); setMood('laugh', 1800); fx('confetti'); host.saveLook?.(lookOf(mem)); break;
      }
      case 'forget': if (confirm('¿Borrar todo lo que VORA recuerda de ti en este dispositivo?')) { mem = forgetMemory(uid); touchDay(mem, dayKey()); chips = []; applyLook(); persist(); renderPanel(); host.requestRender?.(); say({ text: 'Listo, empecemos de cero. Gracias por avisarme.', mood: 'caring' }, { priority: 2 }); } break;
      case 'intro-next': if (introStep === 0) { const n = document.getElementById('vi-nick')?.value.trim(); mem.nickname = (n || '').slice(0, 20); } introStep++; renderIntro(); break;
      case 'intro-prev': introStep = Math.max(0, introStep - 1); renderIntro(); break;
      case 'intro-done': finishIntro(); break;
      default: break;
    }
  }
  function onPanelChange(ev) {
    const t = ev.target.closest('[data-v="toggle"]'); if (!t) return;
    if (t.dataset.id === 'quiet') { mem.quiet = t.checked; persist(); }
    if (t.dataset.id === 'hidden' && t.checked) { mem.hidden = true; persist(); closePanel(); applyLook(); host.requestRender?.(); }
  }
  function onPanelSubmit(ev) {
    ev.preventDefault();
    const f = ev.target;
    if (f.classList.contains('vp-form')) { const input = f.elements.msg; const v = input.value; input.value = ''; userSend(v); return; }
    const kind = f.dataset.vForm;
    if (kind === 'reminder') {
      const text = String(new FormData(f).get('text') || '').trim().slice(0, 80); if (!text) return;
      addReminder(text, Date.now() + (tools.remMin || 15) * 60000); useTool(); renderBody(); return;
    }
    if (kind === 'me') {
      const fd = new FormData(f); mem.name = String(fd.get('name') || 'VORA').trim().slice(0, 12) || 'VORA';
      mem.nickname = String(fd.get('nickname') || '').trim().slice(0, 20); mem.favGame = String(fd.get('favGame') || '').trim().slice(0, 30);
      persist(); applyLook(); host.requestRender?.(); say({ text: `Guardado${mem.nickname ? ', ' + mem.nickname : ''}. ¡Gracias por personalizarme!`, mood: 'happy' }, { priority: 2 });
    }
  }

  // ---------- caricias ----------
  function pet() {
    const p = proactive('pet', ctx()); setMood('love', 3000); fx('hearts'); gainBond('pet');
    if (p) { pushHistory(mem, 'vora', p.text); persist(); if (panelOpen && tab === 'chat') renderChat(); else if (!panelOpen) showBubble(p.text, [], 2600); }
    updateStatus(); host.requestRender?.();
  }

  // ---------- sesión juntos ----------
  function beginSession() {
    session = startSession(setup.kind, setup.minutes); finished = null; mem.activeSession = session; persist();
    if ((mem.ambient || 'off') !== 'off') startAmbient(mem.ambient);
    setMood(SESSION_KINDS[session.kind].mood, 0); say(proactive('session_start', ctx()), { priority: 2 });
    timerChip.hidden = false; renderBody();
  }
  function endSession(completed) {
    const s = session; session = null; delete mem.activeSession; stopAmbient(); timerChip.hidden = true;
    if (completed && s) {
      const xp = 25 + (s.minutes >= 45 ? 15 : s.minutes >= 25 ? 5 : 0);
      const a = award(mem, xp); mem.sessionsDone += 1; const b = gainBond('session', 6); track(mem, 'session').completed.forEach(missionDone);
      finished = { xp, bond: b.gained || 6 }; if (a.leveledUp) levelUp(a.level);
      say(proactive('session_end', ctx({ xp })), { priority: 2 }); setMood('celebrate', 5000); fx('confetti'); navigator.vibrate?.([120, 60, 120]);
      afterChange();
    } else { say(proactive('session_stop', ctx()), { priority: 2 }); setMood('caring', 3000); persist(); }
    setMood(baseMood(), 0); if (panelOpen && tab === 'together') renderBody();
  }
  let breathStart = 0;
  function startBreath() {
    breath = true; breathStart = Date.now(); tab = 'together'; setMood('calm', 0); if (panelOpen) renderBody(); else openPanel('together');
    say({ text: 'Respiremos juntos. Sigue el círculo.', mood: 'calm' }, { priority: 2 });
  }
  function stopBreath(manual) {
    if (!breath) return; breath = null; const secs = (Date.now() - breathStart) / 1000;
    if (secs >= 30) { gainBond('mood', 1); track(mem, 'session'); }
    setMood(baseMood(), 0); say({ text: secs >= 30 ? 'Qué bien. Eso se siente mejor, ¿verdad? ♡' : 'Cuando quieras repetimos.', mood: secs >= 30 ? 'love' : 'happy' }, { priority: 2 });
    persist(); if (panelOpen && tab === 'together') renderBody(); void manual;
  }

  // ---------- mini-juegos ----------
  function startGame(id) {
    tab = 'games'; clearTimeout(reflexTimer); clearTimeout(memTimer);
    // v9: cinco mini-juegos rápidos.
    if (id === 'emoji') game = { type: 'emoji', questions: buildEmojiQuiz(5), i: 0, score: 0, picked: null, done: false, xp: 0 };
    else if (id === 'reflex') game = { type: 'reflex', state: 'ready', tries: 0, ms: 0, xp: 0 };
    else if (id === 'memory') game = { type: 'memory', mem: buildMemoryDeck(6), xp: 0 };
    else if (id === 'rps') game = { type: 'rps', me: 0, bot: 0, last: null, done: false };
    else game = { type: 'trivia', questions: buildTrivia(5), i: 0, score: 0, picked: null, done: false, xp: 0 };
    if (!panelOpen) openPanel('games'); else renderPanel();
  }
  function reflexTap() {
    if (!game || game.type !== 'reflex') return;
    if (game.state === 'wait') { clearTimeout(reflexTimer); game.state = 'early'; setMood('surprised', 1500); renderBody(); return; }
    if (game.state === 'go') {
      game.ms = Math.round(performance.now() - game.goAt); game.tries++; const g = reactionGrade(game.ms); game.grade = g.label; game.xp = g.xp; game.state = 'result';
      if (!mem.scores.reflex || game.ms < mem.scores.reflex) mem.scores.reflex = game.ms;
      const a = award(mem, g.xp); if (a.leveledUp) levelUp(a.level); track(mem, 'minigame').completed.forEach(missionDone);
      setMood(game.ms < 260 ? 'celebrate' : 'happy', 2000); if (game.ms < 230) fx('sparkles'); afterChange(); renderBody(); return;
    }
    game.state = 'wait'; renderBody();
    reflexTimer = setTimeout(() => { if (game?.type === 'reflex' && game.state === 'wait') { game.state = 'go'; game.goAt = performance.now(); renderBody(); } }, reactionDelay());
  }
  function memFlip(i) {
    if (!game || game.type !== 'memory') return;
    const ev = flipCard(game.mem, i); if (ev === 'ignore') return;
    if (ev === 'match') setMood('excited', 1200);
    if (ev === 'miss') { clearTimeout(memTimer); memTimer = setTimeout(() => { if (game?.type === 'memory') { game.mem.cards.forEach(c => { if (!c.matched) c.open = false; }); renderBody(); } }, 900); }
    if (ev === 'done') { const xp = memoryXp(game.mem.moves, game.mem.pairs); if (!mem.scores.memory || game.mem.moves < mem.scores.memory) mem.scores.memory = game.mem.moves; finishGame(xp, true); }
    renderBody();
  }
  function rpsPlay(choice) {
    if (!game || game.type !== 'rps' || game.done) return;
    const bot = rpsBot(), res = rpsResult(choice, bot); game.last = { me: choice, bot, res };
    if (res === 'win') game.me++; else if (res === 'lose') game.bot++;
    setMood(res === 'win' ? 'surprised' : res === 'lose' ? 'laugh' : 'curious', 1400);
    if (game.me >= 3 || game.bot >= 3) { game.done = true; const won = game.me > game.bot; if (won) mem.scores.rps = (mem.scores.rps || 0) + 1; finishGame(won ? 12 : 4, won); }
    renderBody();
  }
  // ---------- herramientas ----------
  function useTool() { mem.counts.tools = (mem.counts.tools || 0) + 1; gainBond('mood', 0); persist(); afterChange(); }
  function keepInputs() { const w = panel.querySelector('[data-v-input="wheel"]'), t = panel.querySelector('[data-v-input="teams"]'); if (w) tools.wheelText = w.value; if (t) tools.teamsText = t.value; }
  function addReminder(text, at) {
    mem.reminders = [...(mem.reminders || []), { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, at }].slice(-20);
    persist();
    try { if (globalThis.Notification?.permission === 'default') Notification.requestPermission().catch(() => {}); } catch { /* sin notificaciones */ }
  }
  function fireReminders(now) {
    if (!mem.reminders?.length) return;
    const { due, pending } = dueReminders(mem.reminders, now); if (!due.length) return;
    mem.reminders = pending; persist();
    due.forEach((r, i) => setTimeout(() => {
      say({ text: `⏰ Recordatorio: ${r.text}`, mood: 'surprised', chips: [{ l: 'Listo ✓', a: 'say:gracias' }, { l: 'En 5 min otra vez', a: `say:recuérdame en 5 minutos ${r.text}` }] }, { priority: 2, ttl: 15000 });
      fx('sparkles'); navigator.vibrate?.([160, 80, 160]);
      try { if (document.hidden && globalThis.Notification?.permission === 'granted') new Notification('GAMVORAQ · ' + mem.name, { body: r.text, icon: '/icons/icon-192.png', tag: r.id }); } catch { /* nada */ }
    }, i * 1200));
    if (panelOpen && tab === 'tools') renderBody();
  }
  function finishGame(xp, win) {
    game.done = true; game.xp = xp; const a = award(mem, xp); if (a.leveledUp) levelUp(a.level);
    track(mem, 'minigame').completed.forEach(missionDone); gainBond('mood', 1);
    setMood(win ? 'celebrate' : 'happy', 3500); if (win) fx('confetti'); afterChange();
  }
  function triviaPick(i) {
    if (!game || game.picked != null) return; const q = game.questions[game.i]; game.picked = i;
    if (i === q.correct) { game.score++; const a = award(mem, 3); if (a.leveledUp) levelUp(a.level); setMood('excited', 1800); } else setMood('curious', 1800);
    persist(); renderBody();
  }
  function triviaNext() {
    if (!game) return;
    if (game.i + 1 >= game.questions.length) {
      if (game.type === 'emoji') mem.scores.emoji = Math.max(mem.scores.emoji || 0, game.score); else mem.scores.trivia = Math.max(mem.scores.trivia, game.score);
      finishGame(game.score === 5 ? 5 : 0, game.score >= 4); game.xp += game.score * 3; game.done = true;
    } else { game.i++; game.picked = null; }
    renderBody();
  }

  // ---------- bucle de 1 s ----------
  function tick() {
    tickN++;
    const now = Date.now();
    if (session) {
      const left = remainingMs(session, now);
      timerChip.textContent = formatClock(left); timerChip.hidden = false;
      if (panelOpen && tab === 'together') {
        const t = panel.querySelector('#vp-time'), ring = panel.querySelector('#vp-ring-fg');
        if (t) t.textContent = formatClock(left);
        if (ring) { const C = 2 * Math.PI * 54; ring.setAttribute('stroke-dashoffset', (C * (1 - sessionProgress(session, now))).toFixed(1)); }
      }
      const n = nextNudge(session, now);
      if (n) { session.nudges = n; mem.activeSession = session; const list = NUDGES[session.kind][n - 1]; say({ text: list[Math.floor(Math.random() * list.length)], mood: SESSION_KINDS[session.kind].mood }, { priority: 2 }); }
      if (left <= 0) endSession(true);
    }
    if (breath) {
      const b = breathAt((now - breathStart) / 1000);
      const box = panel.querySelector('#vp-breath');
      if (box) { box.dataset.phase = b.phase; panel.querySelector('#vp-breath-label').textContent = b.label; panel.querySelector('#vp-breath-left').textContent = b.left; }
      if (now - breathStart > 64000) stopBreath(false);
    }
    if (tickN % 10 === 0) idleCheck(now);
    if (tickN % 2 === 0) fireReminders(now);
    if (panelOpen && tab === 'tools' && tickN % 30 === 0 && !panel.contains(document.activeElement)) renderBody();
    if (!reduceMotion() && tickN % 5 === 0 && now - lastActive > 4000 && root.dataset.mood !== 'sleepy') {
      root.style.setProperty('--ex', (Math.random() * 5 - 2.5).toFixed(2)); root.style.setProperty('--ey', (Math.random() * 3 - 1.5).toFixed(2));
    }
  }
  function markActive() {
    const now = Date.now();
    if (now - lastActive > 120000 && wasSleepy) { wasSleepy = false; setMood('surprised', 2200); say(proactive('wake', ctx()), { priority: 1 }); }
    lastActive = now;
    if (root && root.dataset.mood === 'sleepy' && !session) setMood('happy', 0);
  }
  function idleCheck(now) {
    if (!session && !wasSleepy && now - lastActive > 120000) { wasSleepy = true; setMood('sleepy', 0); fx('zzz'); if (!panelOpen) say(proactive('idle', ctx()), { priority: 0, ttl: 4500 }); }
    if (now - lastBreak > 3600000 && now - lastActive < 120000 && !session) { lastBreak = now; say(proactive('break', ctx()), { priority: 0, ttl: 9000 }); }
  }

  // ---------- onboarding ----------
  function showIntro() {
    introStep = 0;
    introEl = document.createElement('div'); introEl.className = 'vora-intro'; introEl.setAttribute('role', 'dialog'); introEl.setAttribute('aria-modal', 'true'); introEl.setAttribute('aria-label', 'Conoce a VORA');
    introEl.innerHTML = `<div class="vi-card"><div class="vi-art" data-mood="excited" data-acc="${mem.accessory}" data-eyes="${mem.eyes}" data-mouth="${mem.mouth}" data-ears="${mem.ears}" data-shell="${mem.shell}">${avatarSvg('i')}</div><div class="vi-step"></div></div>`;
    document.body.append(introEl);
    introEl.addEventListener('click', onPanelClick); introEl.addEventListener('keydown', ev => { if (ev.key === 'Escape') finishIntro(); });
    renderIntro(); setTimeout(() => introEl?.querySelector('input,button.btn-primary')?.focus(), 80);
  }
  function renderIntro() {
    if (!introEl) return; applyLook();
    const art = introEl.querySelector('.vi-art');
    for (const el of [introEl, art]) for (const k of ['--vora-a', '--vora-b', '--vora-rgb']) el.style.setProperty(k, root.style.getPropertyValue(k));
    introEl.querySelector('.vi-step').innerHTML = introHtml(introStep, mem, userName);
  }
  function finishIntro() {
    if (introEl) { const q = introEl.querySelector('#vi-quiet'); if (q) mem.quiet = q.checked; introEl.remove(); introEl = null; }
    mem.onboarded = true; mem.history = []; persist(); applyLook();
    setTimeout(() => { say(proactive('welcome_first', ctx()), { priority: 2, ttl: 9000 }); fx('sparkles'); }, 400);
    host.requestRender?.();
  }

  // ---------- API pública ----------
  /** Apariencia guardada en el perfil (llega del servidor al iniciar sesión en otro dispositivo). */
  function setLook(look) { if (!mounted || !look) return; const before = JSON.stringify(lookOf(mem)); applyLookTo(mem, look); if (JSON.stringify(lookOf(mem)) === before) return; applyLook(); persist(); if (panelOpen) renderBody(); }
  function setUser(id, name) {
    const changed = id !== uid; uid = id || null; userName = name || '';
    if (changed || !mounted) { mem = loadMemory(uid); }
    mount();
    if (session) endSession(false);
    chips = []; game = null; seenTabs = new Set(); lastBreak = Date.now();
    const resume = mem.activeSession && remainingMs(mem.activeSession) > 0 ? mem.activeSession : null;
    if (resume) { session = resume; timerChip.hidden = false; setMood(SESSION_KINDS[session.kind].mood, 0); if ((mem.ambient || 'off') !== 'off') { /* el audio requiere un gesto del usuario */ } } else delete mem.activeSession;
    applyLook(); applyPos(); renderPanel();
  }
  function greet() {
    if (!uid) return;
    const r = touchDay(mem, dayKey());
    if (r.firstOfDay) { award(mem, 10); gainBond('daily', 3); }
    persist(); updateBadge(); host.requestRender?.();
    if (!mem.onboarded) { showIntro(); return; }
    const h = hourNow();
    setTimeout(() => {
      if (r.firstOfDay && r.returningAfter >= 3) say(proactive('welcome_back', ctx({ away: r.returningAfter })), { priority: 2, ttl: 8000 });
      else if (r.firstOfDay && mem.streak >= 2) say(proactive('welcome_streak', ctx()), { priority: 2, ttl: 8000 });
      else say(proactive('welcome', ctx()), { priority: 2, ttl: 7000 });
      setMood('excited', 3000);
      if ((h >= 23 || h < 5) && lastLateDay !== dayKey()) { lastLateDay = dayKey(); setTimeout(() => say(proactive('late', ctx()), { priority: 0, ttl: 6000 }), 9000); }
    }, 900);
    setTimeout(() => {
      const n = host.getContext?.().unread || 0; const pm = host.getContext?.().pendingMemories || 0;
      if (pm > 0) say(proactive('memory_pending', ctx({ count: pm, chips: [{ l: 'Revisar', a: 'go:squads' }] })), { priority: 1, ttl: 9000 });
      else if (n > 0) say(proactive('notifications', ctx({ count: n, chips: [{ l: 'Ver', a: 'go:notifications' }] })), { priority: 1, ttl: 8000 });
    }, 9500);
  }
  function guestHello() {
    if (!mounted || uid || mem.quiet) return;
    setTimeout(() => say({ text: '¡Hola! Soy VORA. Inicia sesión o explora la demo; te acompaño en todo el recorrido. ✦', mood: 'excited', chips: [{ l: 'Ver demo', a: 'go:demo' }] }, { priority: 2, ttl: 9000 }), 1200);
  }
  function onNavigate(t) {
    if (!mounted || !uid || !mem.onboarded) return;
    if (seenTabs.has(t) || mem.quiet) { seenTabs.add(t); return; }
    seenTabs.add(t);
    const tip = tabTip(t); if (!tip || t === 'home' && mem.days > 1) return;
    setTimeout(() => say({ text: tip.text, mood: 'curious', chips: tip.chips }, { priority: 0, ttl: 9000 }), 1200);
  }
  function signOut() {
    if (session) endSession(false); stopAmbient(); closePanel(); hideBubble();
    uid = null; mem = loadMemory(null); applyLook();
  }
  function show() { mem.hidden = false; persist(); applyLook(); setMood('surprised', 1800); say({ text: '¡Aquí estoy de nuevo! ✦', mood: 'excited' }, { priority: 2 }); }
  function hide() { mem.hidden = true; persist(); closePanel(); applyLook(); }
  function getState() {
    const missions = todaysMissions(mem);
    return { name: mem.name, mood: root?.dataset.mood || 'happy', level: level(), xp: mem.xp, streak: mem.streak, bestStreak: mem.bestStreak, days: mem.days, bond: bondLevel(mem.bond), missions, color: mem.color, accessory: mem.accessory, eyes: mem.eyes, mouth: mem.mouth, ears: mem.ears, shell: mem.shell, hidden: mem.hidden, onboarded: mem.onboarded, nickname: mem.nickname, quiet: mem.quiet, achievements: mem.achievements, session: session ? { left: remainingMs(session) } : null };
  }

  return {
    setUser, setLook, greet, event, say: (text, o = {}) => say({ text, mood: o.mood || 'happy', chips: o.chips }, { priority: o.priority ?? 2 }), open: openPanel, close: closePanel,
    onNavigate, signOut, show, hide, claimMission, getState, isHidden: () => mem.hidden, doAction, guestHello,
    get mem() { return mem; }, isMounted: () => mounted
  };
}
