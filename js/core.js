'use strict';
/* Core: the 1920 × 1080 stage, the clock, cancellable sequences, navigation and line geometry. */
const W = 1920, H = 1080;
const $ = (s) => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const now = () => performance.now();
const rand = (a, b) => a + Math.random() * (b - a);
const Ease = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

const COL = { red: '#FF453A', green: '#3DD6A3', amber: '#FFB020', blue: '#4DA3FF', white: '#F2F4F5', pink: '#FF8AC2' };
const AI_STOPS = ['#FF9F0A', '#FF375F', '#BF5AF2', '#5E5CE6', '#40C8E0'];
const INST = [
  { id: 'protocol', name: 'Protocol', color: COL.green, desc: '293 steps, written in advance.' },
  { id: 'voice', name: 'Voice', color: COL.red, desc: 'One calm voice for every step. It only listens to a voice near the phone.' },
  { id: 'ai', name: 'Apple Intelligence', color: null, desc: "Understands your own words. Picks one of the step's options." },
  { id: 'camera', name: 'Camera + AR', color: COL.amber, desc: 'Finds the chest. Watches your arms.' },
  { id: 'watch', name: 'Watch', color: COL.blue, desc: 'Feels every push on your wrist.' },
  { id: 'beat', name: 'Beat', color: COL.white, desc: 'Keeps 110 a minute. Tells you faster or slower.' },
  { id: 'chest', name: 'Chest', color: COL.pink, desc: 'Lying on the chest, the phone reads the breathing.' },
];
const FONT = '"SF Pro Rounded", "SF Compact Rounded", system-ui, sans-serif';
const font = (size, weight = 600) => `${weight} ${size}px ${FONT}`;

/* ---------- Stage ---------- */
const stage = $('#stage'), canvas = $('#canvas'), ctx = canvas.getContext('2d');
let pxRatio = 1, stageScale = 1;
function layout() {
  stageScale = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(${(innerWidth - W * stageScale) / 2}px, ${(innerHeight - H * stageScale) / 2}px) scale(${stageScale})`;
  pxRatio = Math.min(2, (window.devicePixelRatio || 1) * stageScale);
  canvas.width = Math.round(W * pxRatio);
  canvas.height = Math.round(H * pxRatio);
}
addEventListener('resize', layout);
layout();

/* ---------- Layers drawn every frame ---------- */
const layers = new Map();
function layer(id, z, draw) { layers.set(id, { z, draw }); }
function unlayer(id) { layers.delete(id); }
function clearLayers() { layers.clear(); }

const tickers = new Set();
let lastFrame = now();
function frame(t) {
  const dt = Math.min(0.1, (t - lastFrame) / 1000);
  lastFrame = t;
  for (const fn of [...tickers]) {
    try { fn(t, dt); } catch (e) { console.error(e); tickers.delete(fn); }
  }
  ctx.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (const l of [...layers.values()].sort((a, b) => a.z - b.z)) {
    ctx.save();
    try { l.draw(ctx, t / 1000, dt); } catch (e) { console.error(e); }
    ctx.restore();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- A sequence that can be cancelled at any moment ---------- */
const CANCEL = { cancelled: true };
addEventListener('unhandledrejection', (e) => { if (e.reason === CANCEL) e.preventDefault(); });
class Run {
  constructor() { this.dead = false; this.stops = new Set(); }
  kill() {
    if (this.dead) return;
    this.dead = true;
    for (const f of [...this.stops]) { try { f(); } catch (e) { /* already gone */ } }
    this.stops.clear();
  }
  hold(stop) { this.stops.add(stop); return () => this.stops.delete(stop); }
  wait(ms) {
    return new Promise((res, rej) => {
      if (this.dead) return rej(CANCEL);
      let release = () => {};
      const id = setTimeout(() => { release(); res(); }, Math.max(0, ms));
      release = this.hold(() => { clearTimeout(id); rej(CANCEL); });
    });
  }
  tween(ms, fn, e = Ease.inOut) {
    return new Promise((res, rej) => {
      if (this.dead) return rej(CANCEL);
      const start = now();
      let release = () => {};
      const tick = (t) => {
        const u = clamp((t - start) / ms);
        fn(e(u), u);
        if (u >= 1) { tickers.delete(tick); release(); res(); }
      };
      release = this.hold(() => { tickers.delete(tick); rej(CANCEL); });
      fn(e(0), 0);
      tickers.add(tick);
    });
  }
  loop(fn) {
    tickers.add(fn);
    const release = this.hold(() => tickers.delete(fn));
    return () => { tickers.delete(fn); release(); };
  }
  until(test) {
    return new Promise((res, rej) => {
      if (this.dead) return rej(CANCEL);
      if (test()) return res();
      let release = () => {};
      const tick = () => { if (test()) { tickers.delete(tick); release(); res(); } };
      release = this.hold(() => { tickers.delete(tick); rej(CANCEL); });
      tickers.add(tick);
    });
  }
  event(target, name, fallbackMs) {
    return new Promise((res, rej) => {
      if (this.dead) return rej(CANCEL);
      let release = () => {};
      let id = 0;
      const done = () => { target.removeEventListener(name, done); clearTimeout(id); release(); res(); };
      target.addEventListener(name, done);
      if (fallbackMs) id = setTimeout(done, fallbackMs);
      release = this.hold(() => { target.removeEventListener(name, done); clearTimeout(id); rej(CANCEL); });
    });
  }
}

/* ---------- Navigation: clicker and keys ---------- */
const Show = {
  steps: [], i: -1, run: null, busy: false, lastPress: 0, started: false,
  add(step) { this.steps.push(step); },
  go(i) {
    if (i < 0 || i >= this.steps.length) return;
    if (this.run) this.run.kill();
    Sound.stopAll();
    this.i = i;
    const step = this.steps[i];
    const run = (this.run = new Run());
    this.busy = !!step.film;
    hud();
    try { step.setup && step.setup(); } catch (e) { console.error(e); }
    Promise.resolve()
      .then(() => step.play(run))
      .then(() => {
        if (run !== this.run) return;
        this.busy = false;
        if (step.chain) this.go(i + 1);
      })
      .catch((e) => { if (e !== CANCEL) console.error(e); if (run === this.run) this.busy = false; });
  },
  // A film plays to its end: a press while it plays does nothing (Shift skips it in rehearsals).
  next(force) {
    const t = now();
    if (!force && t - this.lastPress < 650) return;
    this.lastPress = t;
    if (this.busy && !force) return;
    this.go(this.i + 1);
  },
  back() { this.go(Math.max(0, this.i - 1)); },
  act(n) { const i = this.steps.findIndex((s) => s.act === n); if (i >= 0) this.go(i); },
};

function hud() {
  const s = Show.steps[Show.i];
  $('#hud').textContent = `${Show.i + 1}/${Show.steps.length}  Act ${s ? s.act : '-'}: ${s ? s.name : 'start'}\n` +
    '→ Space PageDown: next (Shift skips a film)   ← PageUp: back   1–6: act   R: replay   B: black   F: full screen   M: mute   H: hide';
}

addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'f' || k === 'F') { toggleFullscreen(); return; }
  if (k === 'h' || k === 'H' || k === '?') { $('#hud').classList.toggle('on'); return; }
  if (!Show.started) {
    if (typeof Boot !== 'undefined' && Boot.ready) Boot.start();
    e.preventDefault();
    return;
  }
  if (['ArrowRight', ' ', 'PageDown', 'Enter', 'ArrowDown'].includes(k)) { e.preventDefault(); Show.next(e.shiftKey); }
  else if (['ArrowLeft', 'PageUp', 'ArrowUp', 'Backspace'].includes(k)) { e.preventDefault(); Show.back(); }
  else if (/^[1-6]$/.test(k)) Show.act(+k);
  else if (k === 'r' || k === 'R') Show.go(Show.i);
  else if (k === 'b' || k === 'B' || k === '.') $('#blackout').classList.toggle('on');
  else if (k === 'm' || k === 'M') Sound.toggleMute();
});
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

/* ---------- Line geometry ---------- */
class Poly {
  constructor(pts) {
    this.p = pts;
    const L = (this.L = new Float32Array(pts.length));
    for (let i = 1; i < pts.length; i++) L[i] = L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    this.total = L[pts.length - 1] || 0;
  }
  at(s) {
    const p = this.p, L = this.L;
    if (s <= 0) return p[0];
    if (s >= this.total) return p[p.length - 1];
    let lo = 0, hi = p.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < s) lo = m; else hi = m; }
    const u = (s - L[lo]) / (L[hi] - L[lo] || 1);
    return [lerp(p[lo][0], p[hi][0], u), lerp(p[lo][1], p[hi][1], u)];
  }
  trace(path, s0 = 0, s1 = this.total) {
    if (s1 <= s0) return;
    const a = this.at(s0), b = this.at(s1);
    path.moveTo(a[0], a[1]);
    for (let i = 0; i < this.p.length; i++) if (this.L[i] > s0 && this.L[i] < s1) path.lineTo(this.p[i][0], this.p[i][1]);
    path.lineTo(b[0], b[1]);
  }
}
function arcPts(cx, cy, r, a0, a1, n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
const circlePts = (cx, cy, r, a0 = -Math.PI / 2, n = 160) => arcPts(cx, cy, r, a0, a0 + Math.PI * 2, n);
function rrectPts(x, y, w, h, r) {
  const k = 12, out = [[x + w / 2, y]];
  out.push(...arcPts(x + w - r, y + r, r, -Math.PI / 2, 0, k));
  out.push(...arcPts(x + w - r, y + h - r, r, 0, Math.PI / 2, k));
  out.push(...arcPts(x + r, y + h - r, r, Math.PI / 2, Math.PI, k));
  out.push(...arcPts(x + r, y + r, r, Math.PI, Math.PI * 1.5, k));
  out.push([x + w / 2, y]);
  return out;
}
function bezPts(a, b, c, d, n = 48) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}

/* A line with a soft glow: two wide faint strokes under the line itself. */
function glow(c, path, style, width = 2.6, alpha = 1, halo = 1) {
  if (alpha <= 0.002) return;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = style;
  if (halo > 0) {
    c.globalAlpha = alpha * 0.08 * halo; c.lineWidth = width * 6.5; c.stroke(path);
    c.globalAlpha = alpha * 0.2 * halo; c.lineWidth = width * 2.6; c.stroke(path);
  }
  c.globalAlpha = alpha; c.lineWidth = width; c.stroke(path);
  c.globalAlpha = 1;
}
function aiGradient(c, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  AI_STOPS.forEach((col, i) => g.addColorStop(i / (AI_STOPS.length - 1), col));
  return g;
}
const instStyle = (c, i, x0 = 0, x1 = W) => INST[i].color || aiGradient(c, x0, 0, x1, 0);

/* A four-pointed spark, the mark of the AI's choices. */
function sparkPath(x, y, r) {
  const p = new Path2D(), k = r * 0.22;
  p.moveTo(x, y - r);
  p.quadraticCurveTo(x + k, y - k, x + r, y);
  p.quadraticCurveTo(x + k, y + k, x, y + r);
  p.quadraticCurveTo(x - k, y + k, x - r, y);
  p.quadraticCurveTo(x - k, y - k, x, y - r);
  return p;
}

/* ---------- DOM helpers ---------- */
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const on = (e, yes = true) => e.classList.toggle('on', yes);
function instant(fn) {
  document.body.classList.add('notrans');
  fn();
  void document.body.offsetWidth;
  document.body.classList.remove('notrans');
}
/* Words appear one by one over `ms`, in step with a voice. */
function revealWords(run, box, text, ms) {
  box.textContent = '';
  const words = text.split(' ');
  const spans = words.map((w, i) => el('span', '', box, (i ? ' ' : '') + w));
  const total = text.length;
  let at = 0;
  spans.forEach((s, i) => {
    const delay = (at / total) * ms;
    at += words[i].length + 1;
    const id = setTimeout(() => { s.style.opacity = 1; }, delay);
    run.hold(() => clearTimeout(id));
  });
}
