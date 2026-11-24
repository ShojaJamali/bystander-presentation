'use strict';
/* Act 3: coloured lines fly in from outside and draw the Bystander home screen. Each line ends as one
   ring around the button: the rings are the band. */
const Sketch = (() => {
  const K = 1.12, CX = 960, CY = 540, SPEED = 1500, TAIL = 380;
  const P = (x, y) => [CX + (x - 201) * K, CY + (y - 437) * K];
  const ringR = (i) => 108 + 18 * i;
  const NOTES = [146.83, 220.0, 293.66, 369.99, 440.0, 659.25, 739.99];
  // Who comes in first, and from where (instrument index into INST).
  const ORDER = [
    { i: 5, from: [960, -300] }, { i: 1, from: [2240, 90] }, { i: 3, from: [2260, 1180] }, { i: 0, from: [-300, 140] },
    { i: 4, from: [2240, 640] }, { i: 2, from: [-320, 760] }, { i: 6, from: [640, 1360] },
  ];
  const st = { t0: 0, done: false, partsAlpha: 1, ringsHidden: false, alpha: 1 };
  let plans = null;

  const path = (pts, extra = {}) => Object.assign({ poly: new Poly(pts), persist: true }, extra);
  function text(str, x, y, size, weight, align = 'left', letter = 0) {
    ctx.save();
    ctx.font = font(size, weight);
    ctx.letterSpacing = letter + 'px';
    const w = ctx.measureText(str).width;
    ctx.restore();
    const left = align === 'center' ? x - w / 2 : x, mid = y - size * 0.34;
    return { poly: new Poly([[left, mid], [left + w, mid]]), persist: true, scale: 1.8, text: { str, x: left, y, size, weight, letter, w } };
  }
  function parts() {
    const pp = (list) => list.map(([x, y]) => P(x, y));
    const [px, py] = P(0, 0), [ix, iy] = P(154, 14), [gx, gy] = P(366, 88);
    const gear = [];
    for (let j = 0; j <= 32; j++) { const a = (j / 32) * Math.PI * 2, r = (j % 4 < 2 ? 10 : 7.4) * K; gear.push([gx + r * Math.cos(a), gy + r * Math.sin(a)]); }
    return {
      5: [path(rrectPts(px, py, 402 * K, 874 * K, 55 * K)), path(rrectPts(ix, iy, 94 * K, 37 * K, 18.5 * K))],
      1: [
        path(pp([[70, 152], [76, 152], [79, 145], [82, 159], [85, 148], [87, 152], [93, 152]])),
        text('EMERGENCY ASSIST', P(104, 160)[0], P(104, 160)[1], 24 * K, 700, 'left', 1.2),
        path(pp([[6, 437], [28, 437], [33, 431], [38, 402], [43, 452], [47, 437], [113, 437]]), { pulse: true }),
        path(rrectPts(P(191, 404)[0], P(191, 404)[1], 20 * K, 36 * K, 10 * K)),
        path(arcPts(CX, P(0, 430)[1], 17 * K, 0, Math.PI, 30)),
        path(pp([[201, 447], [201, 457]])), path(pp([[190, 457], [212, 457]])),
        path(pp([[289, 437], [352, 437], [356, 431], [361, 402], [366, 452], [370, 437], [396, 437]]), { pulse: true }),
      ],
      3: [path(circlePts(CX, CY, 84 * K)), path(circlePts(CX, CY, 70 * K))],
      0: [
        path(rrectPts(P(16, 68)[0], P(16, 68)[1], 118 * K, 39.5 * K, 19.75 * K)),
        path(pp([[27, 86], [37, 81], [47, 86], [37, 91], [27, 86]])), path(pp([[44, 88], [44, 95]])),
        path(pp([[31, 89], [31, 94], [37, 97], [43, 94], [43, 89]])),
        text('Practice', P(56, 94)[0], P(56, 94)[1], 17 * K, 600),
      ],
      4: [path(circlePts(gx, gy, 20 * K, Math.PI, 80)), path(gear), path(circlePts(gx, gy, 3.4 * K, 0, 24))],
      2: [text('Tap to say your medical emergency', CX, P(0, 193)[1], 16.5 * K, 500, 'center'), text('or symptoms.', CX, P(0, 214)[1], 16.5 * K, 500, 'center')],
      6: [text('Tap to talk', CX, P(0, 808)[1], 22 * K, 600, 'center')],
    };
  }
  function build() {
    const all = parts();
    plans = ORDER.map(({ i, from }, n) => {
      const list = all[i], segs = [];
      const s = list[0].poly.p[0], d = Math.hypot(s[0] - from[0], s[1] - from[1]);
      const nx = -(s[1] - from[1]) / d, ny = (s[0] - from[0]) / d;
      const c1 = [lerp(from[0], s[0], 0.3) + nx * d * 0.28, lerp(from[1], s[1], 0.3) + ny * d * 0.28];
      const c2 = [lerp(from[0], s[0], 0.72) - nx * d * 0.12, lerp(from[1], s[1], 0.72) - ny * d * 0.12];
      segs.push({ poly: new Poly(bezPts(from, c1, c2, s, 60)), persist: false });
      list.forEach((seg, k) => {
        if (k > 0) {
          const a = segs[segs.length - 1].poly.p.at(-1), b = seg.poly.p[0];
          if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 2) segs.push({ poly: new Poly([a, b]), persist: false });
        }
        segs.push(seg);
      });
      const end = segs[segs.length - 1].poly.p.at(-1), ring = circlePts(CX, CY, ringR(i), Math.atan2(end[1] - CY, end[0] - CX), 200);
      segs.push({ poly: new Poly([end, ring[0]]), persist: false });
      segs.push({ poly: new Poly(ring), persist: true, ring: true });
      let at = 0;
      for (const g of segs) { g.s0 = at; at += g.poly.total * (g.scale || 1); g.s1 = at; }
      return { i, segs, total: at, delay: n * 0.55 };
    });
  }

  function drawText(c, seg, shown, style, alpha) {
    const t = seg.text;
    c.save();
    c.beginPath();
    c.rect(t.x - 6, t.y - t.size * 1.3, shown + 6 + (shown >= t.w ? 30 : 0), t.size * 1.8);
    c.clip();
    c.font = font(t.size, t.weight);
    c.letterSpacing = t.letter + 'px';
    c.fillStyle = style;
    c.shadowColor = typeof style === 'string' ? style : '#BF5AF2';
    c.shadowBlur = 10;
    c.globalAlpha = alpha;
    c.fillText(t.str, t.x, t.y);
    c.restore();
  }
  function draw(c, t) {
    const aiG = aiGradient(c, 760, 0, 1160, 0);
    for (const plan of plans) {
      const h = st.done ? plan.total : clamp((t - st.t0 - plan.delay) * SPEED, 0, plan.total);
      if (h <= 0) continue;
      const style = INST[plan.i].color || aiG;
      let head = null;
      for (const seg of plan.segs) {
        if (h <= seg.s0) break;
        const sc = seg.scale || 1, len = seg.poly.total, local = Math.min(len, (h - seg.s0) / sc);
        head = seg.poly.at(local);
        if (seg.ring) {
          if (st.ringsHidden) continue;
          if (st.done) {
            const r = ringR(plan.i) + 1.6 * Math.sin(t * 0.9 + plan.i * 0.8);
            const p = new Path2D(); p.arc(CX, CY, r, 0, Math.PI * 2);
            glow(c, p, style, 2.2, st.alpha * (0.82 + 0.18 * Math.sin(t * 0.7 + plan.i)));
          } else { const p = new Path2D(); seg.poly.trace(p, 0, local); glow(c, p, style, 2.2, st.alpha); }
          continue;
        }
        const alpha = st.alpha * (seg.persist ? st.partsAlpha : 1);
        if (seg.text) { drawText(c, seg, local, style, alpha); continue; }
        const from = seg.persist ? 0 : Math.max(0, (h - TAIL - seg.s0) / sc);
        if (local > from) { const p = new Path2D(); seg.poly.trace(p, from, local); glow(c, p, style, 2.2, alpha); }
        if (seg.pulse && st.done) {
          const q = ((t * 240) % (len + 160)) - 40, p = new Path2D();
          seg.poly.trace(p, clamp(q - 70, 0, len), clamp(q, 0, len));
          glow(c, p, '#fff', 2.6, alpha * 0.7, 0.6);
        }
      }
      if (head && h < plan.total) {
        c.globalAlpha = st.alpha * 0.3; c.fillStyle = typeof style === 'string' ? style : '#BF5AF2';
        c.beginPath(); c.arc(head[0], head[1], 12, 0, Math.PI * 2); c.fill();
        c.globalAlpha = st.alpha; c.fillStyle = '#fff';
        c.beginPath(); c.arc(head[0], head[1], 3.6, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
    }
  }

  function showDone() {
    if (!plans) build();
    Object.assign(st, { done: true, partsAlpha: 1, ringsHidden: false, alpha: 1 });
    layer('sketch', 20, draw);
  }
  async function play(run) {
    if (!plans) build();
    Object.assign(st, { t0: now() / 1000 + 0.15, done: false, partsAlpha: 1, ringsHidden: false, alpha: 1 });
    layer('sketch', 20, draw);
    const end = Math.max(...plans.map((p) => p.delay + p.total / SPEED));
    plans.forEach((p, n) => Sound.pluck({ at: 0.15 + p.delay + p.segs[1].s0 / SPEED, f: NOTES[n], gain: 0.1 }));
    Sound.pad({ at: 0.15 + end - 0.3, freqs: [146.83, 220, 293.66, 369.99, 659.25], gain: 0.045, attack: 1.2, hold: 1.4, release: 5 });
    await run.wait((end + 0.4) * 1000);
    st.done = true;
  }
  return { build, play, showDone, hide: () => unlayer('sketch'), st, ringR, CX, CY, NOTES };
})();
