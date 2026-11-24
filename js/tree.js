'use strict';
/* Act 5: AI never decides. The protocol's first question and its 13 answers, the AI pointing at one,
   the app asking, and the person deciding. */
const Tree = (() => {
  const N1 = [960, 118], N2 = [960, 248], BUS1 = 352, ROW1 = 430, BUS2 = 484, ROW2 = 540, STAR = [960, 646];
  const ROWS = [
    ['Choking', 'Fainted or feels faint', 'Collapsed or not responding', 'Chest pain', 'Face, arm or speech problem', 'Shaking or jerking', 'Heavy bleeding'],
    ['Allergic reaction', 'Diabetes, shaky or confused', 'Burn', 'Asthma or wheezing', 'Pulled from the water', 'Something else'],
  ];
  const PICK = 2;
  const T = {};
  let nodes = {}, chips = [], talk = {}, pieces = [], made = false;

  function prepare() {
    const box = $('#tree');
    nodes.n1 = el('div', 'node', box, "I'm here. First make sure it's safe to be near them.");
    nodes.n2 = el('div', 'node', box, "Tell me what's happening, in your own words.");
    nodes.n3 = el('div', 'node', box, 'Kneel next to them. Tap their shoulders firmly and shout: are you OK?');
    nodes.n4 = el('div', 'node', box, 'Do they respond?');
    nodes.doc = el('div', 'note', box, 'Written in advance. Checked by a doctor.');
    Object.assign(nodes.doc.style, { left: '80px', top: '46px' });
    chips = ROWS.flatMap((row, r) => row.map((label) => ({ el: el('div', 'chip', box, label), row: r })));
    const t = $('#talk');
    talk.words = el('div', 'say who', t); talk.words.dataset.who = 'Rescuer';
    talk.answer = el('div', 'say', t);
    // The app speaks as itself: its icon and its name.
    talk.question = el('div', 'say', t);
    const who = el('div', 'who', talk.question);
    el('img', '', who).src = 'media/icon.png';
    el('b', '', who, 'Bystander');
    talk.line = el('div', '', talk.question);
    talk.note = el('div', 'ainote', t);
    Object.assign(talk.words.style, { left: '120px', top: '770px', maxWidth: '760px' });
    Object.assign(talk.answer.style, { left: '120px', top: '900px' });
    Object.assign(talk.question.style, { right: '120px', top: '770px', maxWidth: '760px', textAlign: 'right' });
    Object.assign(talk.note.style, { left: '960px', top: '690px' });
    el('div', '', $('#dom')).id = 'cardnote';
  }
  // Positions need the font: measured once, the first time Act 5 is shown.
  function measure() {
    if (made) return;
    made = true;
    const put = (e, x, y) => { e.style.left = x + 'px'; e.style.top = y + 'px'; e._x = x; e._y = y; };
    put(nodes.n1, N1[0], N1[1]); put(nodes.n2, N2[0], N2[1]); put(nodes.n3, 960, 660); put(nodes.n4, 960, 790);
    [ROW1, ROW2].forEach((y, r) => {
      const row = chips.filter((c) => c.row === r), widths = row.map((c) => c.el.offsetWidth), gap = 14;
      let x = 960 - (widths.reduce((a, b) => a + b, 0) + gap * (row.length - 1)) / 2;
      row.forEach((c, k) => { put(c.el, x + widths[k] / 2, y); c.x = x + widths[k] / 2; c.y = y; c.w = widths[k]; c.h = c.el.offsetHeight; x += widths[k] + gap; });
    });
    const lo = Math.min(...chips.map((c) => c.x - c.w / 2)) - 22, hi = Math.max(...chips.map((c) => c.x + c.w / 2)) + 22;
    const n2b = N2[1] + nodes.n2.offsetHeight / 2, piece = (pts, p0, p1, extra = {}) => Object.assign({ poly: new Poly(pts), p0, p1 }, extra);
    pieces = [
      piece([[960, N1[1] + nodes.n1.offsetHeight / 2], [960, N2[1] - nodes.n2.offsetHeight / 2]], 0, 0.12),
      piece([[960, n2b], [960, BUS1]], 0.12, 0.26),
      piece([[960, BUS1], [lo, BUS1], [lo, BUS2]], 0.26, 0.62), piece([[960, BUS1], [hi, BUS1], [hi, BUS2]], 0.26, 0.62),
      piece([[lo, BUS2], [960, BUS2]], 0.62, 0.8), piece([[hi, BUS2], [960, BUS2]], 0.62, 0.8),
      ...chips.map((c, k) => piece([[c.x, c.row ? BUS2 : BUS1], [c.x, c.y - c.h / 2]], c.row ? 0.8 : 0.5, c.row ? 0.9 : 0.62, { chip: k })),
    ];
    const pick = chips[PICK];
    T.chosen = new Poly([[960, n2b], [960, BUS1], [pick.x, BUS1], [pick.x, pick.y - pick.h / 2]]);
    T.ext = [new Poly([[pick.x, pick.y + pick.h / 2], [pick.x, 590], [960, 590], [960, 660 - nodes.n3.offsetHeight / 2]]),
      new Poly([[960, 660 + nodes.n3.offsetHeight / 2], [960, 790 - nodes.n4.offsetHeight / 2]])];
    T.gateY = (n2b + BUS1) / 2;
  }

  function reset() {
    Object.assign(T, { p: 0, star: 0, dash: 0, gate: 0, open: 0, chosen: T.chosen, chose: 0, dim: 0, extP: [0, 0], alpha: 1 });
    Object.values(nodes).forEach((n) => n.classList.remove('on', 'dim'));
    chips.forEach((c) => c.el.classList.remove('on', 'dim', 'can', 'scan', 'pick', 'chosen', 'button'));
    [talk.words, talk.answer, talk.note, talk.line].forEach((t) => { t.classList.remove('on'); t.textContent = ''; });
    talk.question.classList.remove('on');
    $('#card').classList.remove('on'); $('#cardnote').classList.remove('on'); $('#endcard').classList.remove('on');
  }
  function clear() { reset(); unlayer('tree'); unlayer('endstar'); }

  function draw(c, time) {
    const a = T.alpha, green = COL.green;
    for (const pc of pieces) {
      const u = clamp((T.p - pc.p0) / (pc.p1 - pc.p0));
      if (u <= 0) continue;
      const p = new Path2D(); pc.poly.trace(p, 0, pc.poly.total * u);
      const dimmed = pc.chip !== undefined && pc.chip !== PICK ? 1 - 0.85 * T.dim : 1 - 0.6 * T.dim;
      glow(c, p, green, 2.2, a * 0.75 * dimmed, 0.6);
    }
    if (T.chose > 0) { const p = new Path2D(); T.chosen.trace(p, 0, T.chosen.total * T.chose); glow(c, p, green, 3.6, a, 1.6); }
    T.ext.forEach((poly, k) => { if (T.extP[k] > 0) { const p = new Path2D(); poly.trace(p, 0, poly.total * T.extP[k]); glow(c, p, green, 3.2, a, 1.2); } });
    if (T.star > 0) {
      const p = sparkPath(STAR[0], STAR[1], 21 + Math.sin(time * 3) * 1.5);
      glow(c, p, aiGradient(c, STAR[0] - 21, 0, STAR[0] + 21, 0), 2.6, T.star * a);
    }
    if (T.dash > 0) {
      const pick = chips[PICK], p = new Path2D();
      p.moveTo(STAR[0], STAR[1] - 26); p.lineTo(pick.x, pick.y + pick.h / 2 + 8);
      c.setLineDash([10, 12]); c.lineDashOffset = -time * 40;
      glow(c, p, aiGradient(c, STAR[0], 0, pick.x, 0), 2.6, T.dash * a, 0.8);
      c.setLineDash([]);
    }
    if (T.gate > 0) {
      const y = T.gateY, s = T.gate, ang = -1.4 * Ease.inOut(T.open), p = new Path2D();
      p.moveTo(936, y - 14 * s); p.lineTo(936, y + 14 * s); p.moveTo(984, y - 14 * s); p.lineTo(984, y + 14 * s);
      p.moveTo(936, y); p.lineTo(936 + 48 * Math.cos(ang), y + 48 * Math.sin(ang));
      glow(c, p, COL.white, 3, s * a, 1.2);
    }
  }

  /* ---------- Act 5, step by step ---------- */
  function base(level) {
    measure(); reset(); layer('tree', 40, draw);
    if (level >= 1) {
      T.p = 1; on(nodes.n1); on(nodes.n2); on(nodes.doc); chips.forEach((c) => on(c.el));
    }
  }
  async function draw1(run) {
    base(0);
    await run.wait(300);
    on(nodes.n1); Sound.marimba({ f: 587.33, gain: 0.1 });
    await run.wait(700);
    run.tween(500, (e) => { T.p = e * 0.12; });
    await run.wait(450);
    on(nodes.n2); Sound.marimba({ f: 739.99, gain: 0.1 });
    Sound.voice('b-tell-me', { at: 0.3 });
    on(nodes.doc);
    const shown = new Set();
    await run.tween(2600, (e) => {
      T.p = 0.12 + e * 0.88;
      pieces.forEach((pc) => { if (pc.chip !== undefined && T.p >= pc.p1 && !shown.has(pc.chip)) { shown.add(pc.chip); on(chips[pc.chip].el); } });
    }, Ease.linear);
    chips.forEach((c) => on(c.el));
  }
  async function words(run, line, text) {
    talk.words.textContent = ''; on(talk.words);
    const ms = Sound.voiceLength(line) * 1000;
    Sound.voice(line);
    const span = el('span', '', talk.words);
    span.style.opacity = 1;
    revealWords(run, span, text, ms);
    await run.wait(ms + 300);
  }
  async function heard(run) {
    base(1);
    await words(run, 'm-collapsed', '“He just collapsed. He\'s not responding.”');
  }
  async function point(run) {
    base(1);
    talk.words.textContent = '“He just collapsed. He\'s not responding.”'; on(talk.words);
    Sound.sparkle();
    await run.tween(500, (e) => { T.star = e; });
    chips.forEach((c) => c.el.classList.add('can'));
    talk.note.textContent = 'It can only answer with one of these.'; on(talk.note);
    await run.wait(1700);
    const order = [0, 7, 1, 8, 3, 9, 4, 10, 5, 11, 6, 12, 1, 2];
    for (const k of order) {
      chips.forEach((c) => c.el.classList.remove('scan'));
      chips[k].el.classList.add('scan');
      Sound.pluck({ f: 2637, gain: 0.022, dur: 0.22, wet: 0.3 });
      await run.wait(130);
    }
    chips.forEach((c) => c.el.classList.remove('scan', 'can'));
    chips[PICK].el.classList.add('pick'); Sound.sparkle({ gain: 0.04 });
    await run.tween(600, (e) => { T.dash = e; });
  }
  function pointedState() {
    base(1);
    T.star = 1; T.dash = 1;
    talk.words.textContent = '“He just collapsed. He\'s not responding.”'; on(talk.words);
    talk.note.textContent = 'It can only answer with one of these.'; on(talk.note);
    chips[PICK].el.classList.add('pick');
  }
  async function ask(run) {
    pointedState();
    await run.tween(500, (e) => { T.gate = e; }, Ease.out);
    Sound.clunk({ gain: 0.18 });
    talk.line.textContent = ''; on(talk.question);
    const ms = Sound.voiceLength('b-confirm') * 1000;
    Sound.voice('b-confirm');
    const span = el('span', '', talk.line); span.style.opacity = 1;
    revealWords(run, span, 'Collapsed or not responding. Is that right?', ms);
    await run.wait(ms + 300);
  }
  async function yes(run) {
    pointedState();
    T.gate = 1;
    talk.line.textContent = 'Collapsed or not responding. Is that right?'; on(talk.question);
    on(talk.answer); talk.answer.textContent = '“Yes.”';
    Sound.voice('m-yes');
    await run.wait(Sound.voiceLength('m-yes') * 1000 + 200);
    await run.tween(700, (e) => { T.open = e; });
    Sound.pluck({ f: 880, gain: 0.08 });
    chips[PICK].el.classList.remove('pick'); chips[PICK].el.classList.add('chosen');
    chips.forEach((c, k) => { if (k !== PICK) c.el.classList.add('dim'); });
    await run.tween(900, (e) => { T.chose = e; T.dim = e; T.dash = 1 - e; });
    await run.wait(400);
    Object.values(talk).forEach((t) => t.classList.remove('on'));
    await run.tween(500, (e) => { T.star = 1 - e; T.gate = 1 - e; });
    await run.tween(800, (e) => { T.extP[0] = e; });
    on(nodes.n3); Sound.voice('b-kneel', { at: 0.2 });
    await run.wait(Sound.voiceLength('b-kneel') * 1000 + 500);
    await run.tween(500, (e) => { T.extP[1] = e; });
    on(nodes.n4); Sound.marimba({ f: 987.77, gain: 0.1 });
  }
  async function unsure(run) {
    base(1);
    await words(run, 'm-dont-know', '“I… I don\'t know what to do.”');
    Sound.sparkle();
    await run.tween(500, (e) => { T.star = e; });
    for (let round = 0; round < 2; round++) {
      for (let k = 0; k < chips.length; k++) {
        chips.forEach((c) => c.el.classList.remove('scan'));
        chips[k].el.classList.add('scan');
        await run.wait(75);
      }
    }
    chips.forEach((c) => c.el.classList.remove('scan'));
    talk.note.textContent = 'Not sure, so it picks nothing.'; on(talk.note);
    await run.tween(600, (e) => { T.star = 1 - e * 0.6; });
    await run.wait(900);
    talk.line.textContent = ''; on(talk.question);
    const ms = Sound.voiceLength('b-closest') * 1000;
    Sound.voice('b-closest');
    const span = el('span', '', talk.line); span.style.opacity = 1;
    revealWords(run, span, 'Which of these is closest?', ms);
    chips.forEach((c) => c.el.classList.add('button'));
    await run.wait(ms + 600);
    talk.note.textContent = 'You choose.';
  }

  /* The paramedics' summary: the AI writes the sentences, but every time and number is locked. */
  async function handover(run) {
    measure(); reset(); unlayer('tree');
    const card = $('#card');
    card.innerHTML = '';
    el('div', 'head', card, 'For the paramedics');
    const facts = el('div', 'facts', card), F = [['Collapsed', '14:03'], ['CPR started', '14:05'], ['Pushes', '312'], ['Breathing again', '14:08']];
    const locks = F.map(([k, v]) => {
      const f = el('div', 'fact', facts);
      el('div', 'k', f, k);
      const row = el('div', 'v', f); el('span', '', row, v);
      row.insertAdjacentHTML('beforeend', '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="#FFB020" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>');
      return row.querySelector('.lock');
    });
    const write = el('div', 'write', card);
    on(card);
    await run.wait(1200);
    for (const l of locks) { l.classList.add('on'); Sound.pluck({ f: 1174.66, gain: 0.05, dur: 0.4 }); await run.wait(260); }
    await run.wait(600);
    const parts = ['He collapsed at ', 0, '. CPR started at ', 1, ', with ', 2, ' pushes. He was breathing again at ', 3, '.'];
    const ph = [];
    const caret = el('span', 'caret', write);
    Sound.sparkle({ gain: 0.03 });
    for (const part of parts) {
      if (typeof part === 'number') {
        const p = el('span', 'ph', null, 'V' + (part + 1));
        write.insertBefore(p, caret); ph.push(p);
        await run.wait(160);
      } else {
        const node = document.createTextNode('');
        write.insertBefore(node, caret);
        for (const ch of part) { node.data += ch; await run.wait(24); }
      }
    }
    caret.remove();
    await run.wait(700);
    for (let k = 0; k < ph.length; k++) { ph[k].textContent = F[k][1]; ph[k].classList.add('back'); Sound.pluck({ f: 880, gain: 0.05, dur: 0.5 }); await run.wait(320); }
    const note = $('#cardnote');
    note.textContent = "Every time and number is locked. The AI can't change one.";
    on(note);
  }
  async function end(run) {
    measure(); reset(); unlayer('tree');
    on($('#endcard'));
    const s = { a: 0 };
    layer('endstar', 40, (c, time) => glow(c, sparkPath(960, 352, 26 + Math.sin(time * 2.4) * 2), aiGradient(c, 934, 0, 986, 0), 2.8, s.a));
    Sound.sparkle({ gain: 0.04 });
    await run.tween(900, (e) => { s.a = e; });
  }
  return { prepare, clear, draw1, heard, point, ask, yes, unsure, handover, end };
})();
