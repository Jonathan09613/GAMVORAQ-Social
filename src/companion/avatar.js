// Avatar SVG de VORA. Un solo dibujo con variantes que se activan por CSS con atributos del contenedor:
// data-mood (ánimo), data-acc (accesorio), data-eyes, data-mouth, data-ears y data-shell (apariencia elegida). `uid` evita colisiones de ids entre instancias.
export function avatarSvg(uid = 'a') {
  const id = n => `${n}-${uid}`;
  return `<svg class="vora-svg" viewBox="0 0 160 176" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id('shell')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3c45"/><stop offset=".55" stop-color="#241a21"/><stop offset="1" stop-color="#0f0a0e"/></linearGradient>
    <linearGradient id="${id('rim')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--vora-b)"/><stop offset="1" stop-color="var(--vora-a)"/></linearGradient>
    <linearGradient id="${id('blade')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--vora-b)"/><stop offset="1" stop-color="var(--vora-a)"/></linearGradient>
    <linearGradient id="${id('visor')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150d16"/><stop offset="1" stop-color="#05030a"/></linearGradient>
    <radialGradient id="${id('glow')}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="var(--vora-b)" stop-opacity=".55"/><stop offset="1" stop-color="var(--vora-a)" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id('gold')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#d97706"/></linearGradient>
    <linearGradient id="${id('flame')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--vora-b)"/><stop offset="1" stop-color="var(--vora-a)" stop-opacity="0"/></linearGradient>
  </defs>
  <ellipse class="vora-shadow" cx="80" cy="166" rx="30" ry="5" fill="#000" opacity=".4"/>
  <g class="vora-tilt"><g class="vora-float">
    <path class="vora-flame" d="M70 140 Q80 168 90 140 Q80 146 70 140Z" fill="url(#${id('flame')})"/>
    <ellipse cx="80" cy="140" rx="30" ry="22" fill="url(#${id('glow')})" opacity=".8"/>
    <!-- orejas / propulsores laterales -->
    <rect x="18" y="70" width="17" height="38" rx="8.5" fill="#1b1318" stroke="url(#${id('rim')})" stroke-width="2"/>
    <rect x="125" y="70" width="17" height="38" rx="8.5" fill="#1b1318" stroke="url(#${id('rim')})" stroke-width="2"/>
    <circle class="vora-led" cx="26.5" cy="89" r="3.2" fill="var(--vora-b)"/><circle class="vora-led" cx="133.5" cy="89" r="3.2" fill="var(--vora-b)"/>
    <!-- cabeza: cresta (guiño al logo), orejas de gato, antena o cuernos (data-ears) -->
    <g class="ears ears-crest"><path d="M80 22 L63 4 L73 28Z" fill="url(#${id('blade')})"/><path d="M80 22 L97 4 L87 28Z" fill="url(#${id('blade')})"/></g>
    <g class="ears ears-cat"><path d="M40 46 L44 6 L72 30Z" fill="#241a21" stroke="url(#${id('rim')})" stroke-width="3" stroke-linejoin="round"/><path d="M120 46 L116 6 L88 30Z" fill="#241a21" stroke="url(#${id('rim')})" stroke-width="3" stroke-linejoin="round"/><path d="M47 34 L49 16 L62 28Z M113 34 L111 16 L98 28Z" fill="var(--vora-b)" opacity=".55"/></g>
    <g class="ears ears-antenna"><path d="M80 24 L80 4" stroke="url(#${id('rim')})" stroke-width="3.5" stroke-linecap="round"/><circle class="vora-led" cx="80" cy="4" r="6" fill="var(--vora-b)"/><circle cx="78" cy="2" r="2" fill="#fff" opacity=".8"/></g>
    <g class="ears ears-horns" fill="url(#${id('blade')})"><path d="M48 40 Q30 22 38 2 Q46 22 64 30Z"/><path d="M112 40 Q130 22 122 2 Q114 22 96 30Z"/></g>
    <!-- casco -->
    <g class="shell shell-hex"><path d="M80 20 L124 38 L134 74 L124 112 L80 140 L36 112 L26 74 L36 38Z" fill="url(#${id('shell')})" stroke="url(#${id('rim')})" stroke-width="3" stroke-linejoin="round"/>
    <path d="M80 28 L117 43 L126 74 L117 107 L80 131 L43 107 L34 74 L43 43Z" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.5" stroke-linejoin="round"/></g>
    <g class="shell shell-orb"><circle cx="80" cy="80" r="56" fill="url(#${id('shell')})" stroke="url(#${id('rim')})" stroke-width="3"/><circle cx="80" cy="80" r="48" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.5"/><path d="M48 46 Q62 32 80 30" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/></g>
    <g class="shell shell-cube"><rect x="28" y="26" width="104" height="108" rx="26" fill="url(#${id('shell')})" stroke="url(#${id('rim')})" stroke-width="3"/><rect x="36" y="34" width="88" height="92" rx="20" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.5"/></g>
    <path d="M44 120 L80 142 L116 120" fill="none" stroke="var(--vora-a)" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>
    <!-- visor -->
    <rect x="42" y="52" width="76" height="48" rx="20" fill="url(#${id('visor')})" stroke="var(--vora-b)" stroke-opacity=".35" stroke-width="1.5"/>
    <ellipse cx="80" cy="60" rx="30" ry="5" fill="#fff" opacity=".05"/>
    <circle class="vora-blush" cx="52" cy="88" r="5" fill="#ff7aa2"/><circle class="vora-blush" cx="108" cy="88" r="5" fill="#ff7aa2"/>
    <g class="vora-eyes">
      <g class="eye eye-open">
        <g class="eo eo-classic"><ellipse class="blink" cx="63" cy="73" rx="6.5" ry="9.5" fill="var(--vora-b)"/><ellipse class="blink" cx="97" cy="73" rx="6.5" ry="9.5" fill="var(--vora-b)"/><circle cx="65" cy="69" r="2.2" fill="#fff"/><circle cx="99" cy="69" r="2.2" fill="#fff"/></g>
        <g class="eo eo-pixel" fill="var(--vora-b)"><g class="blink"><rect x="56" y="65" width="14" height="16" rx="1.5"/><rect x="90" y="65" width="14" height="16" rx="1.5"/></g><rect x="62" y="67" width="5" height="5" fill="#fff"/><rect x="96" y="67" width="5" height="5" fill="#fff"/><rect x="56" y="84" width="14" height="2.5" opacity=".35"/><rect x="90" y="84" width="14" height="2.5" opacity=".35"/></g>
        <g class="eo eo-cat"><g class="blink"><path d="M52 74 Q63 60 74 74 Q63 86 52 74Z" fill="var(--vora-b)"/><path d="M86 74 Q97 60 108 74 Q97 86 86 74Z" fill="var(--vora-b)"/></g><ellipse cx="63" cy="74" rx="2.2" ry="7.5" fill="#0a0710"/><ellipse cx="97" cy="74" rx="2.2" ry="7.5" fill="#0a0710"/><circle cx="66" cy="70" r="1.8" fill="#fff"/><circle cx="100" cy="70" r="1.8" fill="#fff"/></g>
        <g class="eo eo-star" fill="var(--vora-b)"><path class="blink" d="M63 62 L66 70 L74 70 L67.5 75 L70 83 L63 78 L56 83 L58.5 75 L52 70 L60 70Z"/><path class="blink" d="M97 62 L100 70 L108 70 L101.5 75 L104 83 L97 78 L90 83 L92.5 75 L86 70 L94 70Z"/></g>
        <g class="eo eo-visor"><rect class="blink" x="50" y="68" width="60" height="11" rx="5.5" fill="var(--vora-b)"/><rect x="54" y="70" width="18" height="3" rx="1.5" fill="#fff" opacity=".7"/><path d="M50 73.5 L110 73.5" stroke="#0a0710" stroke-opacity=".35" stroke-width="1"/></g>
        <g class="eo eo-sleepy"><path class="blink" d="M54 70 Q63 64 72 70 L72 76 Q63 82 54 76Z" fill="var(--vora-b)"/><path class="blink" d="M88 70 Q97 64 106 70 L106 76 Q97 82 88 76Z" fill="var(--vora-b)"/><path d="M53 69 L73 69 M87 69 L107 69" stroke="#0a0710" stroke-width="3" stroke-linecap="round"/><circle cx="66" cy="73" r="1.8" fill="#fff"/><circle cx="100" cy="73" r="1.8" fill="#fff"/></g>
      </g>
      <g class="eye eye-arc" fill="none" stroke="var(--vora-b)" stroke-width="4.5" stroke-linecap="round"><path d="M55 78 Q63 65 71 78"/><path d="M89 78 Q97 65 105 78"/></g>
      <g class="eye eye-closed" fill="none" stroke="var(--vora-b)" stroke-width="4.5" stroke-linecap="round"><path d="M55 73 Q63 81 71 73"/><path d="M89 73 Q97 81 105 73"/></g>
      <g class="eye eye-wow"><circle cx="63" cy="73" r="10" fill="var(--vora-b)"/><circle cx="97" cy="73" r="10" fill="var(--vora-b)"/><circle cx="63" cy="73" r="4.5" fill="#0a0710"/><circle cx="97" cy="73" r="4.5" fill="#0a0710"/><circle cx="66" cy="69" r="2.5" fill="#fff"/><circle cx="100" cy="69" r="2.5" fill="#fff"/></g>
      <g class="eye eye-love" fill="#ff6b9a"><path d="M63 82 C50 72 53 63 59 63 C62 63 63 66 63 67 C63 66 64 63 67 63 C73 63 76 72 63 82Z"/><path d="M97 82 C84 72 87 63 93 63 C96 63 97 66 97 67 C97 66 98 63 101 63 C107 63 110 72 97 82Z"/></g>
      <g class="eye eye-laugh" fill="none" stroke="var(--vora-b)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M57 66 L69 73 L57 80"/><path d="M103 66 L91 73 L103 80"/></g>
      <g class="eye eye-focus"><rect x="55" y="70" width="16" height="7" rx="3.5" fill="var(--vora-b)"/><rect x="89" y="70" width="16" height="7" rx="3.5" fill="var(--vora-b)"/><path d="M53 63 L72 66 M107 63 L88 66" stroke="var(--vora-b)" stroke-width="3" stroke-linecap="round" fill="none"/></g>
      <g class="eye eye-soft"><ellipse cx="63" cy="75" rx="6.5" ry="7" fill="var(--vora-b)"/><ellipse cx="97" cy="75" rx="6.5" ry="7" fill="var(--vora-b)"/><path d="M54 66 Q63 70 72 66 M106 66 Q97 70 88 66" stroke="var(--vora-b)" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".7"/><circle cx="65" cy="72" r="2" fill="#fff"/><circle cx="99" cy="72" r="2" fill="#fff"/></g>
    </g>
    <g class="mouths" fill="none" stroke="var(--vora-b)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <g class="mouth m-smile"><path class="ms ms-smile" d="M71 90 Q80 98 89 90"/><g class="ms ms-fang"><path d="M71 90 Q80 98 89 90"/><path d="M75 93.5 L77 99 L79.5 95Z" fill="#fff" stroke="#fff" stroke-width="1"/></g><path class="ms ms-cat" d="M70 90 Q75 96 80 91 Q85 96 90 90"/><path class="ms ms-wide" d="M66 89 Q80 102 94 89"/></g>
      <path class="mouth m-grin" d="M68 88 Q80 104 92 88Z" fill="var(--vora-b)" fill-opacity=".9"/>
      <path class="mouth m-flat" d="M73 92 L87 92"/>
      <circle class="mouth m-o" cx="80" cy="92" r="4" fill="#0a0710"/>
      <path class="mouth m-soft" d="M73 91 Q80 95 87 91"/>
    </g>
    <!-- accesorios -->
    <g class="acc acc-headset"><path d="M32 78 Q32 14 80 14 Q128 14 128 78" fill="none" stroke="#cfcfda" stroke-width="5" stroke-linecap="round"/><rect x="24" y="72" width="12" height="26" rx="6" fill="#cfcfda"/><rect x="124" y="72" width="12" height="26" rx="6" fill="#cfcfda"/><path d="M30 96 Q32 116 56 118" fill="none" stroke="#cfcfda" stroke-width="3.5" stroke-linecap="round"/><circle cx="58" cy="118" r="4.5" fill="var(--vora-b)"/></g>
    <g class="acc acc-cap"><path d="M40 44 Q80 0 120 44 L120 50 L40 50Z" fill="#1d1d28" stroke="var(--vora-a)" stroke-width="2.5" stroke-linejoin="round"/><path d="M100 48 L144 52 Q148 60 138 60 L100 56Z" fill="var(--vora-a)"/><circle cx="80" cy="22" r="4" fill="var(--vora-b)"/></g>
    <g class="acc acc-glasses" fill="rgba(255,255,255,.06)" stroke="#e9e9f2" stroke-width="2.8"><circle cx="63" cy="73" r="15"/><circle cx="97" cy="73" r="15"/><path d="M78 73 L82 73" fill="none"/><path d="M48 70 L40 66 M112 70 L120 66" fill="none" stroke-linecap="round"/></g>
    <g class="acc acc-crown"><path d="M50 30 L55 4 L68 20 L80 -2 L92 20 L105 4 L110 30Z" fill="url(#${id('gold')})" stroke="#b45309" stroke-width="2" stroke-linejoin="round"/><circle cx="55" cy="4" r="3" fill="#fff6c8"/><circle cx="80" cy="-2" r="3" fill="#fff6c8"/><circle cx="105" cy="4" r="3" fill="#fff6c8"/></g>
    <g class="acc acc-halo"><ellipse cx="80" cy="6" rx="26" ry="7" fill="none" stroke="url(#${id('gold')})" stroke-width="4"/><ellipse cx="80" cy="6" rx="26" ry="7" fill="none" stroke="#fff7cc" stroke-width="1" opacity=".7"/></g>
    <g class="acc acc-bow"><path d="M80 30 L58 18 Q52 30 58 42Z M80 30 L102 18 Q108 30 102 42Z" fill="#ff5c8a" stroke="#b81f4b" stroke-width="2" stroke-linejoin="round"/><circle cx="80" cy="30" r="6" fill="#ff8fb0" stroke="#b81f4b" stroke-width="2"/></g>
    <g class="acc acc-bandana"><path d="M34 52 Q80 34 126 52 L124 62 Q80 46 36 62Z" fill="var(--vora-a)" stroke="#000" stroke-opacity=".25"/><path d="M124 56 L146 50 L140 64 L148 72 L126 64Z" fill="var(--vora-a)"/><circle cx="60" cy="50" r="2" fill="#fff" opacity=".8"/><circle cx="80" cy="46" r="2" fill="#fff" opacity=".8"/><circle cx="100" cy="50" r="2" fill="#fff" opacity=".8"/></g>
  </g></g>
</svg>`;
}
