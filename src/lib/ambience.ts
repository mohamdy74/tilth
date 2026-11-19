/*
 * Focus ambience: looped noise beds generated with WebAudio, tied to the
 * active session. Everything is created lazily inside user-gesture-driven
 * calls (never at module top level — workerd forbids it), and every node is
 * stopped and disconnected on stop() so repeated sessions never leak nodes
 * or contexts. The global sound toggle gates ambience exactly like the chime.
 */

export type AmbienceKind = "off" | "rain" | "brown" | "white" | "forest" | "ocean";

export const AMBIENCE_KINDS: AmbienceKind[] = ["off", "rain", "brown", "white", "forest", "ocean"];

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let current: AmbienceKind = "off";
let thunderTimer: number | null = null;

/** Pure brown-noise integrator step, clamped so the bed never clips. */
export function brownStep(last: number, white: number): number {
  const next = (last + 0.02 * white) / 1.02;
  return Math.max(-1, Math.min(1, next));
}

function makeBuffer(kind: Exclude<AmbienceKind, "off">, context: AudioContext): AudioBuffer {
  const seconds = 8;
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, rate * seconds, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") {
      data[i] = white * 0.3;
    } else if (kind === "brown") {
      last = brownStep(last, white);
      data[i] = last * 3.0;
    } else if (kind === "rain") {
      // Rain: filtered white noise with slow amplitude droplets and occasional
      // heavier drops, so it actually sounds like rain rather than static.
      last = brownStep(last, white);
      const droplet =
        0.5 +
        0.4 * Math.sin(i / (rate * 0.12)) * Math.sin(i / (rate * 0.06)) +
        0.3 * Math.sin(i / (rate * 0.03));
      data[i] = (white * 0.18 + last * 1.4) * droplet * 0.9;
    } else if (kind === "forest") {
      // Forest: gentle brown noise with slow bird-like chirp modulation.
      last = brownStep(last, white);
      const chirp =
        0.7 +
        0.3 * Math.sin(i / (rate * 0.5)) * Math.sin(i / (rate * 0.3)) * Math.sin(i / (rate * 0.11));
      data[i] = (last * 1.2 + white * 0.1) * chirp * 0.8;
    } else {
      // ocean: rolling wave noise with slow swell modulation.
      last = brownStep(last, white);
      const swell = 0.6 + 0.4 * Math.sin(i / (rate * 1.5)) * Math.sin(i / (rate * 0.9));
      data[i] = (white * 0.25 + last * 1.8) * swell * 0.85;
    }
  }
  return buffer;
}

/** Start (or switch) the ambience bed. Safe to call repeatedly; no-op for "off". */
export function startAmbience(kind: AmbienceKind): void {
  if (kind === "off") {
    stopAmbience();
    return;
  }
  try {
    if (typeof AudioContext === "undefined") return;
    if (!ctx) ctx = new AudioContext();
    void ctx.resume();
    if (current === kind && source) return;
    stopNodes();
    stopThunder();
    source = ctx.createBufferSource();
    source.buffer = makeBuffer(kind, ctx);
    source.loop = true;
    gain = ctx.createGain();
    gain.gain.value = 0;
    filter = ctx.createBiquadFilter();
    filter.type =
      kind === "rain" || kind === "forest" ? "highpass" : kind === "brown" ? "lowpass" : "lowpass";
    filter.frequency.value =
      kind === "rain" ? 350 : kind === "forest" ? 450 : kind === "brown" ? 500 : 600;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    // fade in over 600ms so the bed never clicks
    gain.gain.linearRampToValueAtTime(kind === "brown" ? 0.14 : 0.09, ctx.currentTime + 0.6);
    current = kind;
    if (kind === "rain") startThunder();
  } catch {
    /* ambience is best-effort */
  }
}

function stopNodes(): void {
  try {
    if (source) {
      source.stop();
      source.disconnect();
    }
    filter?.disconnect();
    gain?.disconnect();
  } catch {
    /* already stopped */
  }
  source = null;
  filter = null;
  gain = null;
}

/** Stop the bed and release nodes; the context stays warm for the next session. */
export function stopAmbience(): void {
  stopNodes();
  stopThunder();
  current = "off";
}

export function currentAmbience(): AmbienceKind {
  return current;
}

/* ---------------- thunder ---------------- */

/** Play a single thunder crack: low rumble followed by a sharp crack. */
function thunderCrack(): void {
  try {
    if (!ctx) return;
    const now = ctx.currentTime;
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = "sawtooth";
    rumble.frequency.setValueAtTime(40, now);
    rumble.frequency.exponentialRampToValueAtTime(90, now + 1.2);
    rumbleGain.gain.setValueAtTime(0.02, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(now);
    rumble.stop(now + 1.5);

    const crack = ctx.createOscillator();
    const crackGain = ctx.createGain();
    const crackFilter = ctx.createBiquadFilter();
    crack.type = "square";
    crack.frequency.setValueAtTime(150, now);
    crack.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    crackFilter.type = "bandpass";
    crackFilter.frequency.value = 600;
    crackFilter.Q.value = 3;
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(now);
    crack.stop(now + 0.6);
  } catch {
    /* thunder is best-effort */
  }
}

/** Schedule occasional thunder cracks during rain sessions. */
function startThunder(): void {
  stopThunder();
  const scheduleNext = () => {
    // Next thunder in 25–90 seconds, only while rain is active.
    const delay = 25_000 + Math.random() * 65_000;
    thunderTimer = window.setTimeout(() => {
      if (current === "rain") {
        thunderCrack();
        scheduleNext();
      }
    }, delay);
  };
  scheduleNext();
}

function stopThunder(): void {
  if (thunderTimer !== null) {
    window.clearTimeout(thunderTimer);
    thunderTimer = null;
  }
}
