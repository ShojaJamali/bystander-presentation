'use strict';
/* The patient monitor: his heart in Act 1, the rewind in Act 2, and the heartbeat at the end. */
const ECG = (() => {
  // His story: a normal rhythm, a few early beats, fibrillation, then nothing.
  const beats = [];
  let t = 0.25;
  for (let k = 0; t < 7.2; k++) { const d = 0.75 + Math.sin(k * 1.7) * 0.025; beats.push({ t, d, kind: 'n' }); t += d; }
  beats.push({ t: t + 0.05, d: 0.55, kind: 'v' }); t += 0.62;
  beats.push({ t, d: 0.7, kind: 'n' }); t += 0.72;
  beats.push({ t, d: 0.5, kind: 'v' }); t += 0.5;
  beats.push({ t, d: 0.45, kind: 'v' }); t += 0.45;
  const VF = t, ASY = VF + 5.4;
  const g = (x, c, w, a) => a * Math.exp(-(((x - c) / w) ** 2));
  const normal = (x) => g(x, 0.16, 0.035, 0.11) + g(x, 0.31, 0.012, -0.1) + g(x, 0.335, 0.011, 1) + g(x, 0.36, 0.013, -0.24) + g(x, 0.58, 0.06, 0.26);
  const early = (x) => g(x, 0.2, 0.05, -0.25) + g(x, 0.3, 0.06, 0.95) + g(x, 0.5, 0.09, -0.35);
  function story(s) {
    if (s < 0) return 0;
    if (s >= ASY) return 0.004 * Math.sin(s * 5.3) + 0.003 * Math.sin(s * 13.1);
    if (s >= VF) {
      const u = (s - VF) / (ASY - VF), a = 0.62 * (1 - u) ** 1.25 + 0.02;
      return a * (0.55 * Math.sin(2 * Math.PI * 4.7 * s + 0.3) + 0.38 * Math.sin(2 * Math.PI * 6.1 * s + 1.7) +
        0.27 * Math.sin(2 * Math.PI * 3.2 * s + 2.2) + 0.1 * Math.sin(2 * Math.PI * 9.3 * s));
    }
    for (let i = beats.length - 1; i >= 0; i--) {
      const b = beats[i];
      if (s >= b.t) { const x = (s - b.t) / b.d; return x > 1 ? 0 : b.kind === 'n' ? normal(x) : early(x); }
    }
    return 0;
  }
  // The number on the monitor: beats a minute, nothing during fibrillation, then zero.
  function hr(s) {
    if (s >= ASY) return 0;
    if (s >= VF) return null;
    for (let i = beats.length - 1; i >= 0; i--) if (s >= beats[i].t) return Math.round(60 / beats[i].d);
    return Math.round(60 / beats[0].d);
  }
  const peaks = beats.map((b) => b.t + (b.kind === 'n' ? 0.335 : 0.3) * b.d);
  const RATE = 60 / 72;
  const alive = (s) => (s < 0 ? 0 : normal((((s % RATE) + RATE) % RATE) / RATE));
  return { story, alive, hr, peaks, VF, ASY, RATE };
})();

/* A monitor sweep: the pen runs left to right, the newest trace bright, the oldest fading ahead of it. */
function drawSweep(c, o) {
  const { sig, s, y = 540, amp = 230, sweep = 5.2, x0 = 0, x1 = W, color = COL.red, alpha = 1, gap = 70, width = 3.2 } = o;
  if (alpha <= 0.002) return;
  const w = x1 - x0, v = w / sweep, pen = (((s * v) % w) + w) % w;
  const newer = new Path2D(), older = new Path2D();
  const add = (path, from, to, wrap) => {
    let first = true;
    for (let x = from; x <= to; x += 3) {
      const ts = s - (wrap ? pen - x + w : pen - x) / v;
      if (ts < 0) { first = true; continue; }
      const yy = y - amp * sig(ts);
      if (first) { path.moveTo(x0 + x, yy); first = false; } else path.lineTo(x0 + x, yy);
    }
  };
  add(newer, 0, pen, false);
  add(older, pen + gap, w, true);
  glow(c, older, color, width, alpha * 0.45);
  glow(c, newer, color, width, alpha);
  if (s >= 0) {
    const yy = y - amp * sig(s);
    c.globalAlpha = alpha * 0.25; c.fillStyle = color;
    c.beginPath(); c.arc(x0 + pen, yy, 13, 0, Math.PI * 2); c.fill();
    c.globalAlpha = alpha * 0.95; c.fillStyle = '#fff';
    c.beginPath(); c.arc(x0 + pen, yy, 3.8, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }
}

/* A bedside monitor, like the ones in hospitals, over his last frame. */
const BED = { x: 1000, y: 150, w: 820, h: 486 };
function drawBedside(c, st, time) {
  const a = st.alpha;
  if (a <= 0.002) return;
  const { x, y, w, h } = BED, bez = 22, sx = x + bez, sy = y + bez, sw = w - bez * 2, sh = h - bez * 2 - 16;
  c.save();
  c.globalAlpha = a;
  const body = new Path2D(); body.roundRect(x, y, w, h, 30);
  c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 60; c.shadowOffsetY = 20;
  const shell = c.createLinearGradient(0, y, 0, y + h);
  shell.addColorStop(0, '#3b4146'); shell.addColorStop(1, '#1d2124');
  c.fillStyle = shell; c.fill(body);
  c.shadowColor = 'transparent';
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.12)'; c.stroke(body);
  c.fillStyle = COL.green; c.globalAlpha = a * 0.8;
  c.beginPath(); c.arc(x + w - 38, y + h - 19, 4, 0, Math.PI * 2); c.fill();
  c.globalAlpha = a;
  const screen = new Path2D(); screen.roundRect(sx, sy, sw, sh, 14);
  c.fillStyle = '#030505'; c.fill(screen);
  c.clip(screen);
  c.strokeStyle = 'rgba(255,255,255,0.035)'; c.lineWidth = 1;
  for (let gx = sx + 18; gx < sx + sw; gx += 36) { c.beginPath(); c.moveTo(gx, sy); c.lineTo(gx, sy + sh); c.stroke(); }
  for (let gy = sy + 18; gy < sy + sh; gy += 36) { c.beginPath(); c.moveTo(sx, gy); c.lineTo(sx + sw, gy); c.stroke(); }
  c.font = font(18, 700); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillText('II', sx + 18, sy + 32);
  const tx0 = sx + 12, tx1 = sx + sw - 204, s = st.s;
  drawSweep(c, { sig: st.sig, s, x0: tx0, x1: tx1, y: sy + sh * 0.62, amp: 122, sweep: 3.6, gap: 40, alpha: a, width: 3 });
  const rx = sx + sw - 180, v = ECG.hr(s), beat = ECG.peaks.some((p) => s >= p && s - p < 0.14);
  c.globalAlpha = a; c.fillStyle = COL.red;
  c.font = font(22, 700); c.fillText('HR', rx, sy + 46);
  c.globalAlpha = a * (beat ? 1 : 0.25); c.fillText('♥', rx + 42, sy + 46);
  c.globalAlpha = a; c.font = font(96, 600); c.fillText(v === null ? '---' : String(v), rx - 4, sy + 156);
  c.font = font(18, 600); c.globalAlpha = a * 0.6; c.fillText('bpm', rx, sy + 184);
  const alarm = s >= ECG.ASY ? 'ASYSTOLE' : s >= ECG.VF ? 'V-FIB' : '';
  if (alarm && Math.floor(time * 3) % 2 === 0) {
    c.globalAlpha = a; c.font = font(22, 800);
    const tw = c.measureText(alarm).width, cx = (tx0 + tx1) / 2, tag = new Path2D();
    tag.roundRect(cx - tw / 2 - 18, sy + 14, tw + 36, 36, 9);
    c.fillStyle = COL.red; c.fill(tag);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(alarm, cx, sy + 40); c.textAlign = 'left';
  }
  c.restore();
}

const Monitor = {
  st: null,
  show(run, opts = {}) {
    const st = (this.st = Object.assign({ sig: ECG.story, s: 0, alpha: 1, device: false }, opts));
    layer('monitor', 10, (c, time) => (st.device ? drawBedside(c, st, time) : drawSweep(c, st)));
    if (run) run.hold(() => this.hide());
    return st;
  },
  hide() { unlayer('monitor'); this.st = null; },

  /* Act 1: over his last frame, the beats, the chaos, the flat line, silence, and an ambulance far
     away. `fade` takes the scene down with the monitor at the end. */
  async story(run, { fade } = {}) {
    const ac = Sound.ac, t0 = ac.currentTime + 0.9;
    const st = this.show(run, { s: -0.9, alpha: 0, device: true });
    const stop = run.loop(() => { st.s = ac.currentTime - t0; });
    for (const p of ECG.peaks) Sound.beep({ at: t0 + p - ac.currentTime });
    const tone = Sound.flat({ at: t0 + ECG.ASY - ac.currentTime });
    tone.endAt(t0 + ECG.ASY + 4.2);
    Sound.siren({ at: t0 + ECG.ASY + 5.6 - ac.currentTime, dur: 11 });
    await run.wait(250);
    await run.tween(650, (e) => { st.alpha = e; }, Ease.out);
    await run.until(() => ac.currentTime >= t0 + ECG.ASY + 12);
    await run.tween(3500, (e) => { st.alpha = 1 - e; if (fade) fade(e); }, Ease.sine);
    await run.until(() => ac.currentTime >= t0 + ECG.ASY + 16.8);
    stop();
  },

  /* The steady heart: a sweep that beeps on every beat until the step ends. */
  alive(run, opts = {}) {
    const ac = Sound.ac, t0 = ac.currentTime + 0.1;
    const st = this.show(run, Object.assign({ sig: ECG.alive, s: -0.1, alpha: 1 }, opts));
    let next = 0.335 * ECG.RATE;
    run.loop(() => {
      st.s = ac.currentTime - t0;
      while (next < st.s + 0.4) {
        if (st.beep !== false) Sound.beep({ at: t0 + next - ac.currentTime, gain: opts.beepGain || 0.08 });
        next += ECG.RATE;
      }
    });
    return st;
  },
};
