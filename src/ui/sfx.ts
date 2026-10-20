import { settings } from '../game/state';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, len: number, type: OscillatorType = 'square', vol = 0.15): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol * settings.volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + len + 0.05);
}

export const sfx = {
  click: () => tone(660, 0, 0.06, 'square', 0.08),
  cash: () => { tone(988, 0, 0.08); tone(1319, 0.07, 0.25); },
  good: () => { tone(523, 0, 0.1, 'triangle'); tone(659, 0.08, 0.1, 'triangle'); tone(784, 0.16, 0.2, 'triangle'); },
  bad: () => { tone(220, 0, 0.18, 'sawtooth', 0.12); tone(165, 0.15, 0.3, 'sawtooth', 0.12); },
  chime: () => { tone(880, 0, 0.3, 'sine', 0.2); tone(660, 0.25, 0.5, 'sine', 0.2); },
  research: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.2, 'triangle')); },
};
