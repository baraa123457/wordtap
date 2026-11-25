/**
 * Synthesizes crisp Monkeytype-style mechanical keyboard click sounds
 * using the Web Audio API (no external audio assets required).
 */

let sharedAudioCtx: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.0045));
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

export function playKeyClickSound(kind: "key" | "backspace" | "error" = "key"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tactile keycap click transient (bandpass-filtered noise)
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(
      kind === "backspace" ? 1350 : kind === "error" ? 900 : 2100 + Math.random() * 250,
      now,
    );
    filter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(kind === "error" ? 0.2 : 0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.032);

    // 2. Subtle switch bottom-out thock (short low-mid sine)
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const baseFreq = kind === "backspace" ? 130 : kind === "error" ? 105 : 175 + Math.random() * 22;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.032);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.16, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.038);
  } catch {
    // Ignore audio errors on restricted environments
  }
}
