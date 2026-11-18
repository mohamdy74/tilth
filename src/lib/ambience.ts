/*
 * Focus ambience: looped noise beds generated with WebAudio, tied to the
 * active session. Everything is created lazily inside user-gesture-driven
 * calls (never at module top level — workerd forbids it), and every node is
 * stopped and disconnected on stop() so repeated sessions never leak nodes
 * or contexts. The global sound toggle gates ambience exactly like the chime.
 */

export type AmbienceKind = "off" | "rain" | "brown" | "white";

export const AMBIENCE_KINDS: AmbienceKind[] = ["off", "rain", "brown", "white"];

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let current: AmbienceKind = "off";

/** Pure brown-noise integrator step, clamped so the bed never clips. */
export function brownStep(last: number, white: number): number {
  const next = (last + 0.02 * white) / 1.02;
  return Math.max(-1, Math.min(1, next));
}

function makeBuffer(kind: Exclude<AmbienceKind, "off">, context: AudioContext): AudioBuffer {
  const seconds = 4;
  const rate = context.sampleRate;
  const buffer = context.createBuffer(1, rate * seconds, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") {
      data[i] = white * 0.35;
    } else if (kind === "brown") {
      last = brownStep(last, white);
      data[i] = last * 3.5;
    } else {
      // rain: filtered white with slow amplitude droplets
      last = brownStep(last, white);
      const droplet = 0.6 + 0.4 * Math.sin(i / (rate * 0.13)) * Math.sin(i / (rate * 0.071));
      data[i] = (white * 0.22 + last * 1.6) * droplet;
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
    source = ctx.createBufferSource();
    source.buffer = makeBuffer(kind, ctx);
    source.loop = true;
    gain = ctx.createGain();
    gain.gain.value = 0;
    filter = ctx.createBiquadFilter();
    filter.type = kind === "rain" ? "highpass" : "lowpass";
    filter.frequency.value = kind === "rain" ? 400 : kind === "brown" ? 500 : 8000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    // fade in over 600ms so the bed never clicks
    gain.gain.linearRampToValueAtTime(kind === "brown" ? 0.16 : 0.1, ctx.currentTime + 0.6);
    current = kind;
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
  current = "off";
}

export function currentAmbience(): AmbienceKind {
  return current;
}
