// All sound is synthesised with WebAudio: no audio files are shipped, so
// the game stays fully offline. Engine hum, sirens, gunfire, pickups and a
// simple bass line are all built from oscillators and noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol = 0.3, low = 400) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = low;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A short two-note siren wail, called on a timer by the game loop.
  function siren() {
    tone(720, 0.28, 'sine', 0.07, 980);
    setTimeout(() => tone(980, 0.28, 'sine', 0.07, 720), 280);
  }

  // A lazy bass riff in A minor that loops while the game runs.
  const BASS_LINE = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4];
  function startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    let step = 0;
    musicTimer = setInterval(() => {
      if (muted) return;
      const note = BASS_LINE[step % BASS_LINE.length];
      step += 1;
      if (note) tone(note, 0.42, 'triangle', 0.11);
      if (step % 8 === 4) tone(220, 0.2, 'sine', 0.05);
    }, 300);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(value) { muted = value; if (master) master.gain.value = value ? 0 : 0.35; },
    isMuted() { return muted; },
    startMusic,
    shot() { noise(0.12, 0.35, 2600); },
    punch() { noise(0.08, 0.2, 900); },
    crash() { noise(0.3, 0.4, 700); },
    pickup() { tone(660, 0.12, 'sine', 0.18); setTimeout(() => tone(990, 0.18, 'sine', 0.18), 110); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.18), i * 130)); },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'sawtooth', 0.14), i * 220)); },
    siren,
    setEngine(speed01, driving) {
      if (!ensure()) return;
      const target = muted ? 0 : driving ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, ctx.currentTime, 0.1);
    },
    stop() { if (musicTimer) clearInterval(musicTimer); musicOn = false; },
  };
}
