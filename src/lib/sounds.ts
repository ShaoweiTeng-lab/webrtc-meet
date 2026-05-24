function playChime(frequencies: number[], noteDuration = 0.28) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.14;

      osc.type = "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + noteDuration);
    });

    const totalMs = frequencies.length * 140 + noteDuration * 1000 + 200;
    setTimeout(() => ctx.close(), totalMs);
  } catch {}
}

// Ascending two-note chime — someone joined
export const playJoinSound = () => playChime([880, 1047]);

// Descending two-note chime — someone left
export const playLeaveSound = () => playChime([1047, 784]);
