let ctx;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  return ctx;
}

function isMuted() {
  if (typeof window === "undefined") return false;
  return window.localStorage?.getItem("warp-muted") === "1";
}

export function setMuted(muted) {
  if (typeof window === "undefined") return;
  window.localStorage?.setItem("warp-muted", muted ? "1" : "0");
}

export function getMuted() {
  return isMuted();
}

function tone({ freq, duration, type = "sine", gain = 0.08, delay = 0 }) {
  if (isMuted()) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = audioCtx.currentTime + delay;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.05);
}

export const sounds = {
  connect() {
    tone({ freq: 520, duration: 0.12, type: "sine" });
    tone({ freq: 780, duration: 0.15, type: "sine", delay: 0.1 });
  },
  complete() {
    tone({ freq: 660, duration: 0.14, type: "sine" });
    tone({ freq: 880, duration: 0.14, type: "sine", delay: 0.12 });
    tone({ freq: 1100, duration: 0.2, type: "sine", delay: 0.24 });
  },
  error() {
    tone({ freq: 180, duration: 0.3, type: "sawtooth", gain: 0.06 });
  },
};
