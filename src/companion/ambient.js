// Sonido ambiente opcional para las sesiones «Juntos». Se genera en el navegador con Web Audio
// (ruido filtrado): no se descarga ningún archivo y se detiene siempre con stop().
let ctx = null, nodes = null;

function noiseBuffer(audio, seconds = 4, kind = 'white') {
  const len = audio.sampleRate * seconds, buf = audio.createBuffer(1, len, audio.sampleRate), data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; data[i] = last * 3.5; } else data[i] = w;
  }
  return buf;
}

export const AMBIENT_OPTIONS = [
  { id: 'off', label: 'Sin sonido', icon: 'volume-x' },
  { id: 'rain', label: 'Lluvia suave', icon: 'cloud-rain' },
  { id: 'breeze', label: 'Brisa', icon: 'wind' }
];

export function startAmbient(kind) {
  stopAmbient();
  if (kind === 'off') return false;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 4, kind === 'breeze' ? 'brown' : 'white');
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    if (kind === 'rain') { filter.type = 'highpass'; filter.frequency.value = 1400; gain.gain.value = 0.0; }
    else { filter.type = 'lowpass'; filter.frequency.value = 520; gain.gain.value = 0.0; }
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
    gain.gain.linearRampToValueAtTime(kind === 'rain' ? 0.035 : 0.18, ctx.currentTime + 1.5); // entrada suave
    nodes = { src, gain };
    return true;
  } catch { return false; }
}

export function stopAmbient() {
  if (!nodes || !ctx) { nodes = null; return; }
  try {
    const { src, gain } = nodes;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    setTimeout(() => { try { src.stop(); src.disconnect(); gain.disconnect(); } catch { /* ya detenido */ } }, 500);
  } catch { /* sin audio */ }
  nodes = null;
}
