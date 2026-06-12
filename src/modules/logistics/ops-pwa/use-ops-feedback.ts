let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(frequency: number, durationMs: number, type: OscillatorType = "sine") {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.15;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export function playOpsSuccess() {
  playTone(880, 80);
  window.setTimeout(() => playTone(1100, 100), 90);
  navigator.vibrate?.(80);
}

export function playOpsError() {
  playTone(220, 150, "square");
  window.setTimeout(() => playTone(180, 200, "square"), 120);
  navigator.vibrate?.([100, 50, 100]);
}
