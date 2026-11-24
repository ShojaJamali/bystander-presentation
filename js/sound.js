'use strict';
/* Sound: the app's lines and the rescuer's, from the app's own voice engine, and every effect made in code. */
const Sound = (() => {
  const ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const out = ac.createGain();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
  out.connect(comp); comp.connect(ac.destination);
  const master = ac.createGain(); master.gain.value = 0.95; master.connect(out);

  const verbIn = ac.createGain(), verb = ac.createConvolver(), verbOut = ac.createGain();
  verb.buffer = impulse(3.4, 2.6); verbOut.gain.value = 0.7;
  verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(master);

  const voiceBus = ac.createGain(); voiceBus.gain.value = 1.15; voiceBus.connect(master);
  const voiceSend = ac.createGain(); voiceSend.gain.value = 0.05; voiceBus.connect(voiceSend); voiceSend.connect(verbIn);
  const analyser = ac.createAnalyser(); analyser.fftSize = 2048; voiceBus.connect(analyser);
  const wave = new Float32Array(analyser.fftSize);

  const noise = (() => {
    const b = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  const voices = {};
  const live = new Set();
  let muted = false;

  function impulse(sec, decay) {
    const len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  const T = (delay = 0) => ac.currentTime + Math.max(0, delay);

  /* Every sound can be stopped: a new step silences the last one. */
  function handle(srcs, g) {
    const h = {
      done: false,
      stop(fade = 0.06) {
        if (h.done) return;
        h.done = true;
        live.delete(h);
        const t = ac.currentTime;
        try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); } catch (e) { /* */ }
        srcs.forEach((s) => { try { s.stop(t + fade + 0.03); } catch (e) { /* */ } });
      },
      endAt(t) { srcs.forEach((s) => { try { s.stop(t); } catch (e) { /* */ } }); },
    };
    live.add(h);
    if (srcs[0]) srcs[0].onended = () => { h.done = true; live.delete(h); };
    return h;
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(type, f, t, dur, dest) {
    const o = ac.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function gainTo(dest, value = 1) { const g = ac.createGain(); g.gain.value = value; g.connect(dest); return g; }

  /* ---------- Voices ---------- */
  async function load() {
    const data = window.VOICE_DATA || {};
    await Promise.all(Object.entries(data).map(async ([name, b64]) => {
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const buf = await ac.decodeAudioData(bytes.buffer);
      const d = buf.getChannelData(0);
      let s = 0;
      while (s < d.length && Math.abs(d[s]) < 0.004) s++;
      let e = d.length - 1;
      while (e > s && Math.abs(d[e]) < 0.004) e--;
      voices[name] = { buf, offset: Math.max(0, s / buf.sampleRate - 0.01), end: e / buf.sampleRate + 0.05 };
    }));
  }
  const voiceLength = (name) => (voices[name] ? voices[name].end - voices[name].offset : 1);
  function voice(name, { at = 0, gain = 1 } = {}) {
    const v = voices[name];
    if (!v) { console.warn('missing line', name); return null; }
    const src = ac.createBufferSource(), g = gainTo(voiceBus, gain);
    src.buffer = v.buf; src.connect(g);
    src.start(T(at), v.offset, v.end - v.offset);
    return handle([src], g);
  }
  function waveData() { analyser.getFloatTimeDomainData(wave); return wave; }

  /* ---------- The monitor ---------- */
  function beep({ at = 0, f = 880, gain = 0.15, dur = 0.12 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.004, gain, dur);
    const a = osc('sine', f, t, dur + 0.03, g), b = osc('sine', f * 2, t, dur, gainTo(g, 0.22));
    return handle([a, b], g);
  }
  function flat({ at = 0, f = 880, gain = 0.13 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01);
    const a = osc('sine', f, t, 120, g), b = osc('sine', f * 2, t, 120, gainTo(g, 0.18));
    return handle([a, b], g);
  }
  /* A two-tone ambulance far away: muffled, drifting, never coming closer. */
  function siren({ at = 0, dur = 11, gain = 0.09 } = {}) {
    const t = T(at), o = ac.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 435;
    for (let k = 1, tt = t + 0.62; tt < t + dur + 1; k++, tt += 0.62) o.frequency.setTargetAtTime(k % 2 ? 580 : 435, tt, 0.03);
    const drift = ac.createOscillator(); drift.frequency.value = 0.13; drift.connect(gainTo(o.detune, 22));
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    const trem = ac.createGain(); trem.gain.value = 0.75;
    const tl = ac.createOscillator(); tl.frequency.value = 0.29; tl.connect(gainTo(trem.gain, 0.25));
    const pan = ac.createStereoPanner();
    const pl = ac.createOscillator(); pl.frequency.value = 0.05; pl.connect(gainTo(pan.pan, 0.6));
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 3.5);
    g.gain.setValueAtTime(gain, t + dur - 4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(hp); hp.connect(trem); trem.connect(pan); pan.connect(g);
    g.connect(gainTo(master, 0.3)); g.connect(gainTo(verbIn, 1));
    [o, drift, tl, pl].forEach((n) => { n.start(t); n.stop(t + dur + 0.1); });
    return handle([o, drift, tl, pl], g);
  }

  /* ---------- The rewind ---------- */
  function clunk({ at = 0, gain = 0.45 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.002, gain, 0.16);
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    o.connect(g); o.start(t); o.stop(t + 0.22);
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 1.2;
    env(ng, t, 0.001, 0.5, 0.03); n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t); n.stop(t + 0.08);
    return handle([o, n], g);
  }
  function rewind({ at = 0, dur = 6.8, gain = 0.5 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.25);
    g.gain.setValueAtTime(gain, t + dur - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const m = ac.createOscillator();
    m.type = 'sawtooth';
    m.frequency.setValueAtTime(90, t); m.frequency.exponentialRampToValueAtTime(430, t + dur * 0.45);
    m.frequency.setValueAtTime(430, t + dur * 0.72); m.frequency.exponentialRampToValueAtTime(150, t + dur);
    const mlp = ac.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 1400;
    m.connect(mlp); mlp.connect(gainTo(g, 0.1));
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter();
    n.buffer = noise; n.loop = true; bp.type = 'bandpass'; bp.Q.value = 9;
    for (let tt = t; tt < t + dur; tt += 0.035 + Math.random() * 0.04) bp.frequency.setTargetAtTime(700 + Math.random() * 3600, tt, 0.012);
    n.connect(bp); bp.connect(gainTo(g, 0.9));
    const s = ac.createOscillator();
    for (let tt = t; tt < t + dur; tt += 0.06 + Math.random() * 0.08) s.frequency.setTargetAtTime(1500 + Math.random() * 3500, tt, 0.02);
    s.connect(gainTo(g, 0.03));
    const h = ac.createBufferSource(), hp = ac.createBiquadFilter();
    h.buffer = noise; h.loop = true; hp.type = 'highpass'; hp.frequency.value = 5000;
    h.connect(hp); hp.connect(gainTo(g, 0.12));
    [m, n, s, h].forEach((x) => { x.start(t); x.stop(t + dur + 0.05); });
    clunk({ at });
    return handle([m, n, s, h], g);
  }
  function whoom({ at = 0, gain = 0.55 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    g.connect(gainTo(verbIn, 0.4));
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(36, t + 3);
    o.connect(g); o.start(t); o.stop(t + 3.3);
    return handle([o], g);
  }

  /* ---------- Notes ---------- */
  function pluck({ at = 0, f = 440, gain = 0.12, dur = 2.4, wet = 0.5 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.006, gain, dur); g.connect(gainTo(verbIn, wet));
    const a = osc('sine', f, t, dur, g), b = osc('triangle', f * 2.001, t, dur * 0.5, gainTo(g, 0.28));
    return handle([a, b], g);
  }
  function pad({ at = 0, freqs, gain = 0.05, attack = 1.6, hold = 2.5, release = 4 } = {}) {
    const t = T(at), end = t + attack + hold + release, g = gainTo(master, 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + attack + hold); g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(gainTo(verbIn, 0.8));
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1800, t + attack); lp.frequency.linearRampToValueAtTime(600, end);
    lp.connect(g);
    const srcs = [];
    for (const f of freqs) for (const d of [-7, 7]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      o.connect(gainTo(lp, 0.5 / freqs.length)); o.start(t); o.stop(end + 0.1); srcs.push(o);
    }
    return handle(srcs, g);
  }
  const chime = ({ at = 0 } = {}) => { pluck({ at, f: 1318.5, gain: 0.07, dur: 1.4, wet: 0.6 }); pluck({ at: at + 0.13, f: 1975.5, gain: 0.06, dur: 1.8, wet: 0.6 }); };
  const sparkle = ({ at = 0, gain = 0.05 } = {}) => [2093, 2637, 3136, 3951, 4699].forEach((f, i) =>
    pluck({ at: at + i * 0.045, f, gain: gain * (1 - i * 0.12), dur: 0.9, wet: 0.7 }));
  function marimba({ at = 0, f = 587, gain = 0.14 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.002, gain, 0.75); g.connect(gainTo(verbIn, 0.3));
    const a = osc('sine', f, t, 0.8, g), b = osc('sine', f * 3.98, t, 0.15, gainTo(g, 0.16));
    return handle([a, b], g);
  }
  function ping({ at = 0, gain = 0.1 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.004, gain, 1.4); g.connect(gainTo(verbIn, 0.7));
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(1250, t); o.frequency.exponentialRampToValueAtTime(1150, t + 1.2);
    o.connect(g); o.start(t); o.stop(t + 1.5);
    return handle([o], g);
  }

  /* ---------- CPR ---------- */
  function click({ at = 0, gain = 0.2 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.001, gain, 0.04);
    const a = osc('sine', 1650, t, 0.05, g);
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter();
    n.buffer = noise; bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2;
    n.connect(bp); bp.connect(gainTo(g, 0.6)); n.start(t); n.stop(t + 0.03);
    return handle([a, n], g);
  }
  function thump({ at = 0, gain = 0.3 } = {}) {
    const t = T(at), g = gainTo(master, 0);
    env(g, t, 0.003, gain, 0.12);
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    o.connect(g); o.start(t); o.stop(t + 0.16);
    return handle([o], g);
  }
  function breath({ at = 0, dur = 3.2, gain = 0.09 } = {}) {
    const t = T(at), n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = gainTo(master, 0);
    n.buffer = noise; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp); bp.connect(g); n.start(t); n.stop(t + dur + 0.05);
    return handle([n], g);
  }

  return {
    ac, T, load, voice, voiceLength, waveData,
    beep, flat, siren, clunk, rewind, whoom, pluck, pad, chime, sparkle, marimba, ping, click, thump, breath,
    resume: () => ac.resume(),
    stopAll: () => [...live].forEach((h) => h.stop(0.08)),
    toggleMute() { muted = !muted; out.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.03); document.querySelectorAll('video').forEach((v) => { v.muted = muted || v.id === 'vR' || v.id === 'vR2'; }); },
  };
})();
