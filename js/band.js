'use strict';
/* Act 4: the rings unwind into seven lines, the band. Each plays alone, then all of them together at 110
   a minute, and they become one beating line. */
const Band = (() => {
  const X0 = 440, X1 = 1830, N = 230, VX = 300, WX = X0 + 74, BEAT = 60 / 110, STAR = 1000;
  const Y = (i) => 212 + i * 112;
  const st = {};
  let labels = [], wave = null;

  function reset() {
    Object.assign(st, {
      unwind: 1, merge: 0, ecg: false, ecgAmp: 0, ecgT0: 0,
      nodes: [], pulse: -1, voiceOn: false, ai: null,
      cam: { panel: 0, target: 0, scan: -1, glyph: 0, flash: -1 },
      pushes: [], packets: [], backs: [], beats: [], rate: 0, rateA: 0, watchIcon: 0,
      msg: '', msgT: -9, count: '', chest: null, jolt: -1, notBreathing: 0, labelsA: 1,
    });
  }
  reset();
  st.alpha = [1, 1, 1, 1, 1, 1, 1];
  st.target = [1, 1, 1, 1, 1, 1, 1];

  function prepare() {
    const box = $('#labels');
    labels = INST.map((inst, i) => {
      const d = el('div', 'lab' + (inst.color ? '' : ' ai'), box);
      d.style.top = Y(i) + 'px';
      const n = el('span', 'name', d, inst.name);
      if (inst.color) n.style.color = inst.color;
      el('span', 'desc', d, inst.desc);
      return d;
    });
  }
  function showLabels(yes = true) { labels.forEach((l) => on(l, yes)); }
  function focus(list) {
    INST.forEach((_, i) => {
      const f = !list || list.includes(i);
      st.target[i] = f ? 1 : 0.2;
      labels[i].classList.toggle('focus', !!list && f);
      labels[i].classList.toggle('dim', !f);
    });
  }
  function ensure() {
    layer('band', 30, draw);
    showLabels(true);
    st.unwind = 1;
  }
  function hide() { unlayer('band'); showLabels(false); focus(null); }

  /* ---------- Drawing ---------- */
  const breathCurve = (u) => (1 - Math.cos(2 * Math.PI * u)) / 2;
  function disp(i, x, t) {
    let d = 0;
    if (i === 1 && st.voiceOn && wave) {
      const u = (x - X0) / (X1 - X0);
      d -= wave[Math.floor(u * (wave.length - 1))] * 170 * Math.pow(Math.sin(Math.PI * u), 0.6);
    } else if (i === 3) {
      if (st.cam.scan >= 0) { const c = X0 + (t - st.cam.scan) * 1100; d -= 16 * Math.exp(-(((x - c) / 34) ** 2)); }
    } else if (i === 4) {
      for (const p of st.pushes) {
        if (p > t) continue;
        const dx = x - (WX + (t - p) * VX);
        if (dx > -30 && dx < 30) d += -46 * Math.exp(-((dx / 5) ** 2)) + 12 * Math.exp(-(((dx - 9) / 7) ** 2));
      }
    } else if (i === 5) {
      for (const b of st.beats) { if (b > t) continue; const dx = x - (WX + (t - b) * VX); if (dx > -20 && dx < 20) d -= 18 * Math.exp(-((dx / 6) ** 2)); }
    } else if (i === 6 && st.chest) {
      const c = st.chest, pen = X0 + (t - c.t0) * c.v;
      if (x <= pen) d -= c.amp * c.fn((x - X0) / c.v);
    }
    if ((i === 3 || i === 6) && st.jolt >= 0) { const a = t - st.jolt; if (a >= 0 && a < 1.2) d += 20 * Math.exp(-4 * a) * Math.sin(30 * a + x / 37); }
    return d;
  }
  function draw(c, time, dt) {
    const t = Sound.ac.currentTime;
    wave = st.voiceOn ? Sound.waveData() : null;
    for (let i = 0; i < 7; i++) st.alpha[i] += (st.target[i] - st.alpha[i]) * Math.min(1, dt * 6);
    if (st.ecg) return drawEcg(c, t);
    const m = Ease.inOut(st.merge);
    for (let i = 0; i < 7; i++) {
      const p = new Path2D(), r = Sketch.ringR(i), pi = clamp(st.unwind * 1.3 - i * 0.05);
      for (let k = 0; k <= N; k++) {
        const u = k / N, x = lerp(X0, X1, u);
        let y = Y(i) + (pi >= 1 ? disp(i, x, t) : 0), px = x;
        if (pi < 1) {
          const b = Ease.inOut(clamp(pi * 2.2 - u * 1.2)), a = Math.PI + u * Math.PI * 2;
          px = lerp(Sketch.CX + r * Math.cos(a), x, b);
          y = lerp(Sketch.CY + r * Math.sin(a), y, b);
        }
        y = lerp(y, 540, m);
        if (k === 0) p.moveTo(px, y); else p.lineTo(px, y);
      }
      const alpha = st.alpha[i];
      if (m < 1) glow(c, p, instStyle(c, i, X0, X1), 2.4, alpha * (1 - m));
      if (m > 0) glow(c, p, COL.red, 2.6, m);
    }
    if (st.merge > 0) return;
    drawProtocol(c); drawAI(c); drawCamera(c, t); drawWatch(c, t); drawBeat(c, t); drawChest(c, t);
  }
  function txt(c, s, x, y, size, color, alpha = 1, align = 'left', weight = 700) {
    if (alpha <= 0.01 || !s) return;
    c.font = font(size, weight); c.textAlign = align; c.fillStyle = color; c.globalAlpha = alpha;
    c.fillText(s, x, y); c.globalAlpha = 1; c.textAlign = 'left';
  }
  function dot(c, x, y, r, color, alpha = 1) {
    c.globalAlpha = alpha * 0.3; c.fillStyle = color; c.beginPath(); c.arc(x, y, r * 3, 0, 7); c.fill();
    c.globalAlpha = alpha; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1;
  }
  function drawProtocol(c) {
    const y = Y(0), a0 = st.alpha[0];
    st.nodes.forEach((n) => {
      if (n.a <= 0) return;
      const p = new Path2D(); p.arc(n.x, y, 9, 0, 7);
      c.fillStyle = '#0c1011'; c.globalAlpha = n.a; c.fill(p); c.globalAlpha = 1;
      if (n.lit > 0) { c.fillStyle = COL.green; c.globalAlpha = n.a * n.lit * a0; c.fill(p); c.globalAlpha = 1; }
      glow(c, p, COL.green, 2.4, n.a * a0);
      txt(c, n.label, n.x, y - 24, 21, COL.green, n.a * a0 * (0.55 + 0.45 * n.lit), 'center', 600);
    });
    if (st.pulse >= 0 && st.nodes.length > 1) {
      const k = Math.min(st.nodes.length - 2, Math.floor(st.pulse)), f = st.pulse - k;
      dot(c, lerp(st.nodes[k].x, st.nodes[k + 1].x, f), y, 5, '#eafff7', a0);
    }
  }
  function drawAI(c) {
    const ai = st.ai;
    if (!ai) return;
    const y = Y(2), a = st.alpha[2], g = aiGradient(c, X0, 0, X1, 0);
    if (ai.words) {
      c.save(); c.font = font(22, 600);
      const w = c.measureText(ai.words).width;
      c.beginPath(); c.rect(X0 - 4, y - 50, (w + 8) * ai.shown, 44); c.clip();
      txt(c, ai.words, X0, y - 20, 22, '#fff', a * 0.92, 'left', 600);
      c.restore();
      if (ai.dot >= 0 && ai.dot < 1) dot(c, lerp(X0 + w, STAR, Ease.inOut(ai.dot)), y, 5, '#FF7AC8', a);
    }
    if (ai.star > 0) {
      const p = sparkPath(STAR, y, 17 + Math.sin(Sound.ac.currentTime * 3) * 1.5);
      c.fillStyle = '#0c1011'; c.globalAlpha = ai.star; c.fill(p); c.globalAlpha = 1;
      glow(c, p, aiGradient(c, STAR - 18, 0, STAR + 18, 0), 2.4, ai.star * a);
    }
    ai.chips.forEach((ch, k) => {
      if (ch.a <= 0) return;
      const p = new Path2D(); p.roundRect(ch.x, y - 19, ch.w, 38, 19);
      c.fillStyle = '#0c1011'; c.globalAlpha = ch.a; c.fill(p); c.globalAlpha = 1;
      const hot = ai.pick === k || ai.scan === k;
      glow(c, p, hot ? g : 'rgba(255,255,255,0.5)', hot ? 2.6 : 1.6, ch.a * a * (ai.pick >= 0 && ai.pick !== k ? 0.4 : 1), hot ? 1 : 0);
      txt(c, ch.label + (ai.pick === k ? '  ✦' : ''), ch.x + ch.w / 2, y + 7, 20, '#fff', ch.a * a * (ai.pick >= 0 && ai.pick !== k ? 0.4 : 1), 'center', 600);
    });
  }
  function drawCamera(c, t) {
    const y = Y(3), a = st.alpha[3], img = $('#chestStill');
    if (st.cam.panel > 0 && img.complete) {
      const x = 1000, top = y - 108, p = new Path2D(); p.roundRect(x, top, 384, 216, 18);
      c.save(); c.clip(p); c.globalAlpha = st.cam.panel; c.drawImage(img, x, top, 384, 216); c.restore();
      glow(c, p, COL.amber, 2.2, st.cam.panel * a);
      if (st.cam.target > 0) {
        const e = Ease.out(st.cam.target), s = lerp(2.6, 1, e), cx = x + 0.73 * 384, cy = top + 0.63 * 216, q = new Path2D();
        [10, 20, 30].forEach((r) => { q.moveTo(cx + r * s, cy); q.arc(cx, cy, r * s, 0, 7); });
        q.moveTo(cx - 42 * s, cy); q.lineTo(cx - 14 * s, cy); q.moveTo(cx + 14 * s, cy); q.lineTo(cx + 42 * s, cy);
        q.moveTo(cx, cy - 42 * s); q.lineTo(cx, cy - 14 * s); q.moveTo(cx, cy + 14 * s); q.lineTo(cx, cy + 42 * s);
        glow(c, q, COL.amber, 2.4, e);
      }
    }
    if (st.cam.glyph > 0) {
      const f = st.cam.flash >= 0 ? Math.max(0, 1 - (t - st.cam.flash) / 1.4) : 0, q = new Path2D();
      [8, 16].forEach((r) => { q.moveTo(1000 + r, y); q.arc(1000, y, r, 0, 7); });
      c.fillStyle = '#0c1011'; c.beginPath(); c.arc(1000, y, 18, 0, 7); c.fill();
      glow(c, q, COL.amber, 2.2 + f * 1.5, st.cam.glyph * a, 1 + f * 2);
    }
  }
  function drawWatch(c, t) {
    const y = Y(4), a = st.alpha[4], x = X0 + 30;
    if (st.watchIcon > 0) {
      const p = new Path2D(); p.roundRect(x - 15, y - 19, 30, 38, 9);
      p.moveTo(x - 9, y - 19); p.lineTo(x - 9, y - 29); p.moveTo(x + 9, y - 19); p.lineTo(x + 9, y - 29);
      p.moveTo(x - 9, y + 19); p.lineTo(x - 9, y + 29); p.moveTo(x + 9, y + 19); p.lineTo(x + 9, y + 29);
      c.fillStyle = '#0c1011'; c.globalAlpha = st.watchIcon; c.fillRect(x - 16, y - 20, 32, 40); c.globalAlpha = 1;
      glow(c, p, COL.blue, 2.2, st.watchIcon * a);
      for (const b of st.backs) {
        const age = t - b - 0.7;
        if (age > 0 && age < 0.7) { const r = new Path2D(); r.arc(x, y, 22 + age * 50, 0, 7); glow(c, r, COL.white, 1.6, (1 - age / 0.7) * a, 0.5); }
      }
    }
    if (st.rateA > 0) txt(c, `${Math.round(st.rate)} / min`, X1, y - 26, 24, COL.blue, st.rateA * a, 'right');
  }
  function drawBeat(c, t) {
    const y = Y(5), a = Math.max(st.alpha[5], st.alpha[4] * 0.5);
    for (const p of st.packets) {
      const age = t - p;
      if (age >= 0 && age < 0.45) dot(c, WX + age * VX, lerp(Y(4), y, Ease.out(age / 0.45)), 3.6, COL.blue, a);
    }
    for (const b of st.backs) {
      const age = t - b;
      if (age >= 0 && age < 0.7) { const e = Ease.inOut(age / 0.7); dot(c, lerp(1135, X0 + 30, e), lerp(y - 12, Y(4), e), 4, COL.white, a); }
    }
    const age = t - st.msgT;
    txt(c, st.msg, 1135, y - 30, 26, COL.white, clamp(age / 0.25) * clamp((2.6 - age) / 0.4) * st.alpha[5], 'center');
    txt(c, st.count, X1, y - 26, 30, COL.white, st.alpha[5] * 0.95, 'right');
  }
  function drawChest(c, t) {
    const ch = st.chest, y = Y(6), a = st.alpha[6];
    if (ch && ch.peaks) {
      ch.peaks.forEach((tp, k) => {
        if (t - ch.t0 < tp) return;
        const x = X0 + tp * ch.v, p = new Path2D(); p.arc(x, y - ch.amp, 7, 0, 7);
        glow(c, p, COL.pink, 2, a);
        txt(c, String(k + 1), x, y - ch.amp - 16, 18, COL.pink, a, 'center');
      });
    }
    txt(c, 'Not breathing', X1, y - 30, 24, COL.red, st.notBreathing * a, 'right');
  }
  function drawEcg(c, t) {
    const s = t - st.ecgT0, v = 300, p = new Path2D();
    for (let x = X0; x <= X1; x += 3) {
      const y = 540 - st.ecgAmp * ECG.alive(s - (X1 - x) / v);
      if (x === X0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    glow(c, p, COL.red, 3, 1);
  }

  /* ---------- Shared moves ---------- */
  const A = () => Sound.ac.currentTime;
  const message = (s) => { st.msg = s; st.msgT = A(); };
  function chips(labelsList, x0) {
    ctx.save(); ctx.font = font(20, 600);
    let x = x0;
    const out = labelsList.map((label) => { const w = ctx.measureText(label).width + 40, ch = { label, x, w, a: 0 }; x += w + 22; return ch; });
    ctx.restore();
    return out;
  }
  function counting(run, t0, beatsUntil, skip) {
    for (let k = 0; k * BEAT < beatsUntil; k++) {
      const tb = k * BEAT;
      st.beats.push(t0 + tb);
      Sound.click({ at: t0 + tb - A() });
      if (!skip.some(([s, l]) => tb > s - 0.15 && tb < s + l + 0.05)) Sound.voice('c' + ((k % 30) + 1), { at: t0 + tb - A(), gain: 0.9 });
    }
    return run.loop(() => {
      const k = Math.floor((A() - t0) / BEAT);
      st.count = k >= 0 && k * BEAT < beatsUntil ? String((k % 30) + 1) : st.count;
    });
  }
  async function pickChip(run, ai, order, pick) {
    for (const k of order) { ai.scan = k; Sound.pluck({ f: 2637, gain: 0.025, dur: 0.25, wet: 0.3 }); await run.wait(170); }
    ai.scan = -1; ai.pick = pick; Sound.sparkle({ gain: 0.04 });
  }

  /* ---------- Act 4, step by step ---------- */
  async function unwind(run) {
    reset(); ensure(); showLabels(false); focus(null);
    st.unwind = 0;
    Sketch.showDone(); Sketch.st.ringsHidden = true;
    [6, 5, 4, 3, 2, 1, 0].forEach((n, k) => Sound.pluck({ at: 0.1 + k * 0.13, f: Sketch.NOTES[n], gain: 0.08 }));
    run.tween(900, (e) => { Sketch.st.partsAlpha = 1 - e; }, Ease.out);
    await run.tween(2600, (e) => { st.unwind = e; }, Ease.sine);
    Sketch.hide();
    for (const l of labels) { on(l, true); await run.wait(110); }
  }
  async function protocol(run) {
    focus([0]);
    const names = ['Is it safe?', 'Do they respond?', 'Call 112', 'Adult, child or baby?', 'Breathing?', 'CPR'];
    st.nodes = names.map((label, k) => ({ x: lerp(X0 + 110, X1 - 90, k / 5), label, a: 0, lit: 0 }));
    await run.tween(700, (e) => st.nodes.forEach((n, k) => { n.a = clamp(e * 6 - k); }), Ease.linear);
    const notes = [587.33, 659.25, 739.99, 880, 987.77, 1174.66];
    for (let k = 0; k < 6; k++) {
      st.nodes[k].lit = 1; Sound.marimba({ f: notes[k] });
      if (k < 5) await run.tween(620, (e) => { st.pulse = k + e; }, Ease.sine);
    }
    st.pulse = -1;
  }
  async function voice(run) {
    focus([1]); st.voiceOn = true;
    Sound.voice('b-im-here');
    await run.wait(Sound.voiceLength('b-im-here') * 1000 + 500);
  }
  async function ai(run) {
    focus([2]);
    const a = (st.ai = { words: "He just collapsed. He's not responding.", shown: 0, dot: -1, star: 0, chips: chips(['Choking', 'Collapsed or not responding', 'Chest pain'], STAR + 60), pick: -1, scan: -1 });
    Sound.voice('m-collapsed');
    await run.tween(Sound.voiceLength('m-collapsed') * 1000, (e) => { a.shown = e; }, Ease.linear);
    await run.tween(650, (e) => { a.dot = e; }, Ease.linear);
    a.dot = -1; Sound.sparkle();
    await run.tween(400, (e) => { a.star = e; a.chips.forEach((ch) => { ch.a = e; }); });
    await run.wait(300);
    await pickChip(run, a, [0, 1, 2, 0, 1, 2, 0], 1);
  }
  async function camera(run) {
    focus([3]);
    await run.tween(600, (e) => { st.cam.panel = e; });
    await run.wait(250);
    Sound.ping();
    await run.tween(800, (e) => { st.cam.target = e; }, Ease.linear);
    await run.wait(400);
    st.cam.scan = A(); Sound.voice('b-arms');
    await run.wait(Sound.voiceLength('b-arms') * 1000 + 600);
  }
  async function watch(run) {
    focus([4]);
    const t0 = A() + 0.5;
    for (let k = 0; k < 10; k++) { const tp = k * (60 / 94); st.pushes.push(t0 + tp); Sound.thump({ at: t0 + tp - A() }); }
    await run.tween(400, (e) => { st.watchIcon = e; });
    st.rate = 94;
    await run.wait(1400);
    await run.tween(400, (e) => { st.rateA = e; });
    await run.wait(4200);
  }
  async function beat(run) {
    focus([4, 5]);
    st.watchIcon = 1; st.rate = 94; st.rateA = 1;
    const t0 = A() + 0.4, L = (n) => Sound.voiceLength(n), tF = 2.8, tA = 4.6, tG = 6.4, end = 11;
    counting(run, t0, end, [[tF, L('b-faster')], [tG, L('b-good')]]);
    const pushes = [];
    for (let tp = 0.15; tp < tA; tp += 60 / 94) pushes.push(tp);
    for (let k = Math.ceil(tA / BEAT); k * BEAT < end; k++) pushes.push(k * BEAT + 0.02);
    pushes.forEach((tp) => { st.pushes.push(t0 + tp); st.packets.push(t0 + tp); Sound.thump({ at: t0 + tp - A(), gain: 0.18 }); });
    Sound.voice('b-faster', { at: t0 + tF - A() }); Sound.voice('b-good', { at: t0 + tG - A() });
    const until = (x) => run.until(() => A() >= t0 + x);
    await until(tF); message('Push a bit faster'); st.backs.push(A());
    await until(tA); run.tween(1200, (e) => { st.rate = lerp(94, 112, e); });
    await until(tG); message('Good rhythm'); st.backs.push(A());
    await until(end + 0.3);
  }
  async function chest(run) {
    focus([6]);
    const t0 = A() + 0.2;
    st.chest = { t0, v: 175, amp: 36, peaks: [2.0, 5.4], fn: (ts) => (ts >= 0.3 && ts < 7.1 ? breathCurve((ts - 0.3) / 3.4) : 0) };
    Sound.breath({ at: 0.5 }); Sound.breath({ at: 3.9 });
    await run.until(() => A() >= t0 + 8.2);
    await run.tween(400, (e) => { st.notBreathing = e; });
    Sound.voice('b-start-cpr');
    await run.wait(Sound.voiceLength('b-start-cpr') * 1000 + 500);
  }

  /* All together: the same moments as the stage demo. */
  async function tutti(run) {
    focus(null);
    const t0 = A() + 0.3, L = (n) => Sound.voiceLength(n);
    const tF = 2.8, tA = 4.6, tG = 6.4, tArms = 9.3, tCough = 13.2, tQ = 14.0;
    const tYes = tQ + L('b-breathing') + 0.5, tSide = tYes + L('m-yes-normally') + 0.8, tEnd = tSide + 0.4 + L('b-side') + 0.7;
    st.nodes = ['CPR', 'Breathing normally?', 'Recovery position'].map((label, k) => ({ x: [720, 1180, 1640][k], label, a: 1, lit: k ? 0 : 1 }));
    Object.assign(st, { watchIcon: 1, rate: 94, rateA: 1, voiceOn: true });
    st.cam.glyph = 1;
    st.ai = { words: '', shown: 0, dot: -1, star: 0.5, chips: [], pick: -1, scan: -1 };
    st.chest = { t0, v: 175, amp: 26, fn: () => 0 };
    const stopCount = counting(run, t0, tCough - 0.1, [[tF, L('b-faster')], [tG, L('b-good')], [tArms, L('b-arms')]]);
    const pushes = [];
    for (let tp = 0.15; tp < tA; tp += 60 / 94) pushes.push(tp);
    for (let k = Math.ceil(tA / BEAT); k * BEAT < tCough - 0.1; k++) pushes.push(k * BEAT + 0.02);
    pushes.forEach((tp) => { st.pushes.push(t0 + tp); st.packets.push(t0 + tp); Sound.thump({ at: t0 + tp - A(), gain: 0.16 }); });
    [['b-faster', tF], ['b-good', tG], ['b-arms', tArms], ['b-breathing', tQ], ['m-yes-normally', tYes], ['b-side', tSide + 0.4]]
      .forEach(([n, x]) => Sound.voice(n, { at: t0 + x - A() }));
    const until = (x) => run.until(() => A() >= t0 + x);
    await until(tF); message('Push a bit faster'); st.backs.push(A());
    await until(tA); run.tween(1200, (e) => { st.rate = lerp(94, 112, e); });
    await until(tG); message('Good rhythm'); st.backs.push(A());
    await until(tArms - 0.3); st.cam.flash = A(); st.cam.scan = A(); Sound.ping({ gain: 0.06 });
    await until(tCough); st.jolt = A(); stopCount(); st.count = ''; st.rateA = 0;
    run.tween(800, (e) => { st.pulse = e; }, Ease.sine);
    await until(tCough + 0.8); st.pulse = -1; st.nodes[1].lit = 1; Sound.marimba({ f: 880 });
    await until(tYes);
    const a = (st.ai = { words: 'Yes, normally.', shown: 0, dot: -1, star: 0.5, chips: chips(['Yes'], STAR + 60), pick: -1, scan: -1 });
    await run.tween(L('m-yes-normally') * 1000, (e) => { a.shown = e; }, Ease.linear);
    await run.tween(500, (e) => { a.dot = e; a.star = 0.5 + e * 0.5; a.chips[0].a = e; }, Ease.linear);
    a.dot = -1; a.pick = 0; Sound.sparkle({ gain: 0.04 });
    await until(tSide);
    run.tween(800, (e) => { st.pulse = 1 + e; }, Ease.sine);
    st.chest = { t0: A(), v: 175, amp: 22, fn: (ts) => breathCurve(ts / 3.6) };
    Sound.breath({ at: 0.2, gain: 0.05 });
    await run.wait(800); st.pulse = -1; st.nodes[2].lit = 1; Sound.marimba({ f: 1174.66 });
    await until(tEnd);
    labels.forEach((l) => on(l, false));
    await run.tween(1800, (e) => { st.merge = e; }, Ease.inOut);
    Object.assign(st, { ecg: true, ecgAmp: 0, ecgT0: A() });
    let next = 0.335 * ECG.RATE;
    run.loop(() => {
      const s = A() - st.ecgT0;
      while (next < s + 0.4) { Sound.beep({ at: st.ecgT0 + next - A(), gain: 0.08 }); next += ECG.RATE; }
    });
    await run.tween(1200, (e) => { st.ecgAmp = e * 150; }, Ease.out);
  }

  return { prepare, reset, ensure, hide, focus, showLabels, unwind, protocol, voice, ai, camera, watch, beat, chest, tutti };
})();
