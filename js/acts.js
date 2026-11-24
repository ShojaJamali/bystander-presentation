'use strict';
/* The acts, in order. Every step can start on its own: a jump or a replay builds what it needs. */
const vA = $('#vA'), vR = $('#vR'), vR2 = $('#vR2'), vB = $('#vB'), film = $('#film');
const VIDEOS = [vA, vR, vR2, vB];
function filmShow(...list) { on(film, true); VIDEOS.forEach((v) => on(v, list.includes(v))); }
function filmHide() {
  on(film, false);
  VIDEOS.forEach((v) => { on(v, false); v.pause(); });
  Object.assign(film.style, { transform: '', filter: '', opacity: '', transition: '' });
}
/* His last frame, dimmed behind the monitor. */
function dimFilm(yes, now = false) {
  film.style.transition = now ? 'none' : 'filter 1.4s ease';
  film.style.filter = yes ? 'brightness(0.36) saturate(0.7) blur(1.4px)' : '';
}
async function playVideo(v) { try { await v.play(); } catch (e) { console.warn('video', e); } }
const noiseCtx = $('#noise').getContext('2d');
function vhsNoise() {
  const img = noiseCtx.createImageData(240, 135), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  noiseCtx.putImageData(img, 0, 0);
}
function resetAll() {
  clearLayers();
  filmHide();
  instant(() => {
    ['#vhs', '#title', '#icon', '#black', '#brand .name', '#brand .tag'].forEach((s) => on($(s), false));
    $('#caption').textContent = '';
    Band.hide(); Band.reset(); Tree.clear();
  });
}

/* Act 1: the street, his heart, and an ambulance far away. */
Show.add({
  act: 1, name: 'The street', film: true,
  setup: resetAll,
  async play(run) {
    vA.currentTime = 0; filmShow(vA);
    await playVideo(vA);
    await run.event(vA, 'ended', 20000);
    // His last frame stays, dimmed, and a hospital monitor comes up over it.
    dimFilm(true);
    await Monitor.story(run, { fade: (e) => { film.style.opacity = String(1 - e); } });
    filmHide();
  },
});

/* Act 2: What if… The film rolls back and plays again, and this time someone takes out a phone. */
Show.add({
  act: 2, name: 'What if…', film: true, chain: true,
  setup: resetAll,
  async play(run) {
    const title = $('#title'), cap = $('#caption'), vhs = $('#vhs');
    await run.wait(300);
    on(title); Sound.whoom();
    await run.wait(2800);
    on(title, false);
    await run.wait(800);
    on(vhs); run.loop(vhsNoise);
    const tape = Sound.rewind({ dur: 7.8 });
    // It rolls back from where it ended: the monitor over his last frame, then the street backwards.
    vR.currentTime = 0; vR2.currentTime = 0; filmShow(vR); dimFilm(true, true);
    const mon = Monitor.show(run, { s: ECG.ASY + 12, device: true });
    await run.tween(1900, (e) => { mon.s = lerp(ECG.ASY + 12, 2.4, e); }, Ease.sine);
    await run.tween(450, (e) => { mon.alpha = 1 - e; film.style.filter = `brightness(${lerp(0.36, 1, e)}) saturate(${lerp(0.7, 1, e)})`; });
    Monitor.hide(); dimFilm(false, true);
    filmShow(vR, vR2);
    const jitter = run.loop(() => { film.style.transform = `translate(${rand(-5, 5)}px, ${rand(-2, 2)}px)`; });
    await Promise.all([playVideo(vR), playVideo(vR2)]);
    await run.event(vR, 'ended', 6500);
    jitter(); film.style.transform = '';
    tape.stop(0.05); Sound.clunk();
    vB.currentTime = 0; filmShow(vB); on(vhs, false);
    await run.wait(800);
    await playVideo(vB);
    await run.until(() => vB.currentTime >= 9.6 || vB.ended);
    const len = Sound.voiceLength('m-hey-siri') * 1000;
    Sound.voice('m-hey-siri');
    revealWords(run, cap, 'Hey Siri, open Bystander.', len);
    await run.wait(len + 250);
    Sound.chime();
    await run.until(() => vB.ended || vB.currentTime >= 11.1);
    await run.wait(300);
    cap.textContent = '';
    run.wait(1150).then(() => on($('#black'))).catch(() => {});
    await run.tween(1600, (e) => { film.style.transform = `scale(${1 + 11 * e})`; }, Ease.in);
    await run.wait(250);
  },
});

/* Act 3: the lines draw the app. It holds here, silent, during the live demo. */
Show.add({ act: 3, name: 'The app is drawn', film: true, setup: resetAll, play: (run) => Sketch.play(run) });

/* Act 4: the band. */
Show.add({ act: 4, name: 'The band', setup: resetAll, play: (run) => Band.unwind(run) });
const solo = (name, fn, film = false) => Show.add({
  act: 4, name, film,
  setup() { resetAll(); Band.reset(); Band.ensure(); },
  play: (run) => fn(run),
});
solo('Protocol', Band.protocol);
solo('Voice', Band.voice);
solo('Apple Intelligence', Band.ai);
solo('Camera + AR', Band.camera);
solo('Watch', Band.watch);
solo('Beat', Band.beat);
solo('Chest', Band.chest);
solo('All together', Band.tutti, true);

/* Act 5: AI never decides. */
[['The protocol', Tree.draw1], ['Their words', Tree.heard], ['The AI points', Tree.point], ['Is that right?', Tree.ask],
  ['Yes', Tree.yes], ['Not sure', Tree.unsure], ['The summary', Tree.handover], ['AI never decides', Tree.end]]
  .forEach(([name, fn]) => Show.add({ act: 5, name, setup: resetAll, play: (run) => fn(run) }));

/* Act 6: the lines close into the app, and the heart beats again. */
Show.add({
  act: 6, name: 'Finale',
  setup: resetAll,
  async play(run) {
    const R0 = (i) => 900 + i * 60, R1 = (i) => 170 + i * 16, ring = { r: INST.map((_, i) => R0(i)), a: 0 };
    layer('finale', 20, (c) => INST.forEach((_, i) => {
      const p = new Path2D(); p.arc(960, 472, ring.r[i], 0, Math.PI * 2);
      glow(c, p, instStyle(c, i, 960 - ring.r[i], 960 + ring.r[i]), 2.4, ring.a);
    }));
    Sketch.NOTES.forEach((f, i) => Sound.pluck({ at: 0.2 + i * 0.16, f, gain: 0.08 }));
    await run.tween(2400, (e) => { ring.a = Math.min(1, e * 2); ring.r = INST.map((_, i) => lerp(R0(i), R1(i), e)); }, Ease.out);
    on($('#icon'));
    Sound.pad({ freqs: [146.83, 220, 293.66, 369.99, 659.25], gain: 0.04, attack: 1.5, hold: 3, release: 6 });
    await run.tween(1400, (e) => { ring.r = INST.map((_, i) => lerp(R1(i), 150, e)); ring.a = 1 - e; });
    unlayer('finale');
    Monitor.alive(run, { y: 472, amp: 120, sweep: 4.6, beepGain: 0.06 });
    await run.wait(1600);
    on($('#brand .name'));
    await run.wait(900);
    on($('#brand .tag'));
  },
});

/* Start: everything loads behind a black screen; the first key starts Act 1 and the sound. */
const Boot = {
  ready: false,
  async init() {
    Band.prepare(); Tree.prepare();
    const loaded = (v) => new Promise((res) => {
      if (v.readyState >= 3) return res();
      v.addEventListener('canplaythrough', res, { once: true });
      v.addEventListener('error', res, { once: true });
      setTimeout(res, 10000);
    });
    await Promise.all([Sound.load().catch((e) => console.error('voices', e)), document.fonts.load(font(24, 700)), ...[vA, vR, vB].map(loaded)]);
    Sketch.build();
    this.ready = true;
    $('#start').classList.add('ready');
    hud();
  },
  async start() {
    if (Show.started) return;
    Show.started = true;
    await Sound.resume();
    $('#start').classList.add('gone');
    Show.go(0);
  },
};
$('#start').addEventListener('click', () => { if (Boot.ready) Boot.start(); });
Boot.init();
