/* ==========================================================================
   Hollow Wardens 3D - made by Rubaiyat
   A small three.js action roguelite. No build step: open index.html.

   Sections
     1. Data (wardens, enemies, boons, forge upgrades)
     2. Save data
     3. Scene and helpers
     4. Combat (player, enemies, projectiles)
     5. Run flow (waves, boons, game over)
     6. UI (menu, HUD, overlays)
     7. Input and main loop
   ========================================================================== */
(function () {
'use strict';

if (typeof THREE === 'undefined') {
  const err = document.getElementById('err');
  if (err) err.hidden = false;
  return;
}

/* ==========================================================================
   1. DATA
   ========================================================================== */

const CHARS = [
  { n: 'Aren Voss', role: 'Ironclad. Slow, tough, hits hard.', col: 0xff7a59, hp: 140, spd: 5.5, dmg: 11,
    rn: 'Unbroken Realm',
    sk: { n: 'Shockwave', cost: 30, cd: 1.2, t: 'proj', dmg: 22, v: 14, stun: 0, pierce: true },
    rm: { dmg: 60, stun: 1.4, inv: 1.5 } },
  { n: 'Suki Marrow', role: 'Sealwright. Her seals stun enemies.', col: 0x4aa8ff, hp: 100, spd: 6.5, dmg: 8,
    rn: 'Hall of Thousand Seals',
    sk: { n: 'Binding Seal', cost: 30, cd: 1.4, t: 'proj', dmg: 10, v: 18, stun: 1.4 },
    rm: { dmg: 40, stun: 3 } },
  { n: 'Dain Kuro', role: 'Veilstep. Fast, blinks behind foes.', col: 0xb46bff, hp: 110, spd: 8, dmg: 9,
    rn: 'Moonless Realm',
    sk: { n: 'Veil Cut', cost: 25, cd: 1, t: 'blink', dmg: 24 },
    rm: { dmg: 80, stun: 1.2 } },
  { n: 'Imi Haru', role: 'Lanternkeeper. Heals herself.', col: 0xffc247, hp: 115, spd: 6, dmg: 8,
    rn: 'Lantern Realm',
    sk: { n: 'Warm Light', cost: 35, cd: 2, t: 'heal', heal: 35, nova: 14 },
    rm: { dmg: 45, stun: 1.6, heal: 40, sp: true } }
];

const ENEMY_TYPES = {
  wisp:    { n: 'Dusk Wisp',        hp: 55,  spd: 3.6, dmg: 8,  s: .75, fly: 1, col: 0x7d6bb5, shards: 3 },
  brute:   { n: 'Hollow Brute',     hp: 150, spd: 2.6, dmg: 15, s: 1.15, horns: 1, col: 0xa8476b, shards: 7 },
  shade:   { n: 'Shade Stalker',    hp: 85,  spd: 3.4, dmg: 12, s: .95, dash: 1, shape: [.8, 1.5, .8], col: 0x5b8bd9, shards: 6 },
  spitter: { n: 'Gloom Spitter',    hp: 65,  spd: 2.6, dmg: 8,  s: .9,  orb: 1, keep: 7.5, mouth: 1, col: 0x4aa05a, shards: 6 },
  choir:   { n: 'The Rotted Choir', hp: 260, spd: 2.9, dmg: 18, s: 1.6, orb: 1, volley: 1, orbit: 1, boss: 1, col: 0x3e8a7a, shards: 40 },
  titan:   { n: 'Hollow Titan',     hp: 480, spd: 2.2, dmg: 22, s: 1.9, slam: 1, horns: 1, boss: 1, col: 0xd0553b, shards: 80 }
};

const STORY = [['wisp'], ['brute'], ['choir']];
const STORY_FIGHTS = STORY.length;
const WAVE_COST = { wisp: 1, brute: 2.5, shade: 1.6, spitter: 1.6 };

/* Boons: r = rarity (1 common, 2 rare, 3 epic). ap() applies one level. */
const BOONS = [
  { id: 'fury',   n: 'Fury Blade',     r: 1, max: 6, ab: 'FB', d: '+18% damage.',                                  ap: p => { p.mods.dmg += .18; } },
  { id: 'skin',   n: 'Iron Skin',      r: 1, max: 5, ab: 'IS', d: '+22 max health and heal 22.',                   ap: p => { p.max += 22; p.hp += 22; } },
  { id: 'soles',  n: 'Swift Soles',    r: 1, max: 4, ab: 'SS', d: '+10% move speed.',                              ap: p => { p.mods.spd += .1; } },
  { id: 'siphon', n: 'Soul Siphon',    r: 1, max: 5, ab: 'SP', d: 'Heal 1 health on every hit you land.',          ap: p => { p.mods.siphon += 1; } },
  { id: 'lungs',  n: 'Second Lungs',   r: 1, max: 4, ab: 'SL', d: '+30% stamina regeneration.',                    ap: p => { p.mods.spRegen += .3; } },
  { id: 'well',   n: 'Soulwell',       r: 1, max: 4, ab: 'SW', d: '+25% Realm charge from fighting.',              ap: p => { p.mods.chGain += .25; } },
  { id: 'focus',  n: 'Arcane Focus',   r: 2, max: 4, ab: 'AF', d: 'Skill costs 15% less and recharges 15% faster.', ap: p => { p.mods.skillCost *= .85; p.mods.skillCd *= .85; } },
  { id: 'phantom',n: 'Phantom Step',   r: 2, max: 3, ab: 'PS', d: 'Dodge recharges 25% faster.',                   ap: p => { p.mods.dodgeCd *= .75; } },
  { id: 'ward',   n: 'Mirror Ward',    r: 2, max: 3, ab: 'MW', d: 'Parry window is 0.07s longer.',                 ap: p => { p.mods.parry += .07; } },
  { id: 'storm',  n: 'Storm Finisher', r: 2, max: 4, ab: 'ST', d: 'Your third strike releases lightning around you.', ap: p => { p.mods.lightning += 1; } },
  { id: 'edge',   n: 'Keen Edge',      r: 2, max: 5, ab: 'KE', d: '+10% critical chance. Crits deal double damage.', ap: p => { p.mods.crit += .1; } },
  { id: 'exec',   n: 'Executioner',    r: 2, max: 3, ab: 'EX', d: '+40% damage to enemies under 30% health.',      ap: p => { p.mods.exec += .4; } },
  { id: 'ember',  n: 'Phoenix Ember',  r: 3, max: 1, ab: 'PE', d: 'Return from death once with half health.',      ap: p => { p.mods.revive += 1; } },
  { id: 'heart',  n: 'Titan Heart',    r: 3, max: 2, ab: 'TH', d: '+50 max health and +20% damage.',               ap: p => { p.max += 50; p.hp += 50; p.mods.dmg += .2; } },
  { id: 'tempest',n: 'Tempest Soul',   r: 3, max: 2, ab: 'TS', d: 'Attack 20% faster and move 10% faster.',        ap: p => { p.mods.atkSpd += .2; p.mods.spd += .1; } }
];
const RARITY_NAME = ['', 'Common', 'Rare', 'Epic'];

/* Soul Forge: permanent upgrades bought with shards. Cost = base * (level + 1). */
const FORGE = [
  { id: 'hp',   n: 'Vital Core',       d: '+8% max health per level.',        max: 5, base: 40 },
  { id: 'dmg',  n: 'Sharpened Intent', d: '+6% damage per level.',            max: 5, base: 50 },
  { id: 'sp',   n: 'Deep Breath',      d: '+8% stamina regen per level.',     max: 5, base: 35 },
  { id: 'ch',   n: 'Resonance',        d: '+8% Realm charge per level.',      max: 5, base: 35 },
  { id: 'gain', n: 'Soul Magnet',      d: '+10% shards earned per level.',    max: 5, base: 45 }
];

/* ==========================================================================
   2. SAVE DATA
   ========================================================================== */

const SAVE_KEY = 'hollowWardens3d.save.v1';

function defaultSave() {
  return { shards: 0, up: {}, seen: false,
    best: { endless: { wave: 0, score: 0 }, story: { score: 0, time: 0 } },
    stats: { runs: 0, kills: 0 } };
}
function loadSave() {
  const d = defaultSave();
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      d.shards = Math.max(0, +s.shards || 0);
      d.up = Object.assign({}, s.up);
      d.seen = !!s.seen;
      if (s.best && s.best.endless) Object.assign(d.best.endless, s.best.endless);
      if (s.best && s.best.story) Object.assign(d.best.story, s.best.story);
      if (s.stats) Object.assign(d.stats, s.stats);
    }
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return d;
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
const save = loadSave();
const upLv = id => save.up[id] || 0;
const shardMul = () => 1 + .1 * upLv('gain');

/* ==========================================================================
   3. SCENE AND HELPERS
   ========================================================================== */

const $ = id => document.getElementById(id);
const V = THREE.Vector3;
const YUP = new V(0, 1, 0);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const ARENA = 13;
const vibe = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };

let state = 'menu';            // menu | fight | pick | over
let P = null, G = null;        // player, run state
let enemies = [], proj = [], parts = [], drops = [], fxs = [];
let keys = {}, joy = { x: 0, y: 0 };
let time = 0, last = 0, hitStop = 0, shake = 0, flash = 0, redFlash = 0, uid = 0;
let paused = false, soundOn = true, audio = null, music = null;
let diff = 1, mode = 'endless', selChar = 0;
const aim = new V(1, 0, 0), camLook = new V();

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120b24);
scene.fog = new THREE.Fog(0x120b24, 18, 44);
const cam = new THREE.PerspectiveCamera(55, 1, .1, 90);

scene.add(new THREE.HemisphereLight(0x9a86ff, 0x1a1030, .85));
const sun = new THREE.DirectionalLight(0xdfd4ff, .95);
sun.position.set(6, 14, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 40 });
scene.add(sun);

const stdMat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .7 }, o || {}));
const basicMats = {};
const basicMat = c => basicMats[c] || (basicMats[c] = new THREE.MeshBasicMaterial({ color: c }));

/* arena */
const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 64), stdMat(0x2a1f47));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
[[13.6, 14, 0x8a6bff], [5, 5.12, 0x5a46a0], [2, 2.1, 0x5a46a0]].forEach(r => {
  const m = new THREE.Mesh(new THREE.RingGeometry(r[0], r[1], 64), new THREE.MeshBasicMaterial({ color: r[2] }));
  m.rotation.x = -Math.PI / 2; m.position.y = .02; scene.add(m);
});
const pillars = [];
for (let i = 0; i < 10; i++) {
  const a = i / 10 * 6.283;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.6, .8, 6 + i % 3 * 2, 8), stdMat(0x181030));
  m.position.set(Math.cos(a) * 16.5, 3, Math.sin(a) * 16.5);
  m.castShadow = true; scene.add(m);
  const t = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xa98bff }));
  t.position.set(m.position.x, 6.5 + i % 3 * 2, m.position.z);
  scene.add(t); pillars.push(t);
}
const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe9e3ff, fog: false }));
moon.position.set(-30, 26, -50);
scene.add(moon);
{
  const g = new THREE.BufferGeometry(), a = [];
  for (let i = 0; i < 260; i++) {
    const u = Math.random() * 6.283, v = Math.random() * 1.2 + .1;
    a.push(Math.cos(u) * 60, v * 40, Math.sin(u) * 60);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .5, fog: false })));
}

/* shared geometry */
const partGeo = new THREE.BoxGeometry(.14, .14, .14);
const ringGeo = new THREE.RingGeometry(.85, 1, 40);
const orbGeoP = new THREE.SphereGeometry(.35, 12, 10);
const orbGeoE = new THREE.SphereGeometry(.45, 12, 10);
const eyeGeo = new THREE.SphereGeometry(.17, 8, 8);
const dropGeo = new THREE.SphereGeometry(.28, 10, 8);
const dropMat = new THREE.MeshBasicMaterial({ color: 0x7dffb0 });

/* target marker under the enemy you are facing */
const marker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
marker.rotation.x = -Math.PI / 2;
marker.position.y = .06;
marker.visible = false;
scene.add(marker);

function person(col) {
  const g = new THREE.Group();
  const m = (geo, c, e) => { const o = new THREE.Mesh(geo, stdMat(c, e ? { emissive: e } : null)); o.castShadow = true; return o; };
  const body = m(new THREE.CylinderGeometry(.38, .45, 1.1, 10), col);
  const legs = m(new THREE.CylinderGeometry(.3, .3, .7, 8), 0x1b1830);
  const head = m(new THREE.SphereGeometry(.3, 14, 12), 0xf2c9a4);
  const hair = m(new THREE.SphereGeometry(.32, 14, 8, 0, 6.3, 0, 1.5), 0x14111f);
  const band = m(new THREE.TorusGeometry(.3, .04, 6, 16), col, col);
  body.position.y = 1.15; legs.position.y = .35; head.position.y = 1.95; hair.position.y = 1.98;
  band.rotation.x = 1.57; band.position.y = 2.02;
  const cape = m(new THREE.ConeGeometry(.55, 1.5, 4, 1, true), col);
  cape.material.side = THREE.DoubleSide; cape.material.transparent = true; cape.material.opacity = .65;
  cape.position.set(0, 1.1, -.38); cape.rotation.x = .25;
  const arm = new THREE.Group();
  const a1 = m(new THREE.BoxGeometry(.18, .8, .18), col);
  const bl = m(new THREE.BoxGeometry(.08, .08, 1.2), 0xffffff, col);
  a1.position.y = -.4; bl.position.set(0, -.8, .6);
  arm.add(a1, bl); arm.position.set(.5, 1.6, 0);
  g.add(body, legs, head, hair, band, cape, arm);
  g.userData = { arm, bm: body.material, legs };
  return g;
}

function monster(t) {
  const g = new THREE.Group();
  const mt = stdMat(t.col, { emissive: t.col, emissiveIntensity: .15, roughness: .5 });
  const sq = t.shape || [1, 1.3, 1];
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mt);
  b.scale.set(sq[0], sq[1], sq[2]); b.position.y = 1.4; b.castShadow = true; g.add(b);
  const eye = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-.35, .35].forEach(x => {
    const e = new THREE.Mesh(eyeGeo, eye);
    e.position.set(x * sq[0], 1.7, .85 * sq[2]); g.add(e);
  });
  if (t.horns) {
    const hm = stdMat(0x2a1a22);
    [-1, 1].forEach(s => {
      const h = new THREE.Mesh(new THREE.ConeGeometry(.22, .9, 8), hm);
      h.position.set(.6 * s, 2.6, 0); h.rotation.z = -.5 * s; h.castShadow = true; g.add(h);
    });
  }
  if (t.mouth) {
    const mo = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 8), stdMat(0x12301a));
    mo.position.set(0, 1.2, .9); g.add(mo);
  }
  if (t.orbit) {
    const og = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * 6.283;
      const o = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9ff5df }));
      o.position.set(Math.cos(a) * 1.7, 1.6, Math.sin(a) * 1.7); og.add(o);
    }
    g.add(og); g.userData.orbit = og;
  }
  g.scale.setScalar(t.s);
  g.userData.mt = mt;
  return g;
}

/* ---------- audio ---------- */
function sfx(f, d, type, vol, slide) {
  if (!soundOn || !audio) return;
  try {
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
    g.gain.setValueAtTime(vol || .07, t);
    g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + d);
  } catch (e) { /* ignore */ }
}
/* Generative calm soundtrack: slow pad chords, sparse bell notes and a soft echo. No audio files needed. */
const TRACKS = {
  calm:  { step: 2.6, density: .75,
    chords: [[146.83, 220, 293.66, 369.99], [123.47, 185, 246.94, 293.66], [98, 146.83, 196, 246.94], [110, 164.81, 220, 277.18]],
    scale: [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99] },
  night: { step: 3.4, density: .6,
    chords: [[110, 164.81, 220, 261.63], [87.31, 130.81, 174.61, 220], [130.81, 196, 261.63, 329.63], [98, 146.83, 196, 246.94]],
    scale: [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33] }
};
let musicStyle = 'calm', mus = null;
try { musicStyle = localStorage.getItem('hw3d.music') || 'calm'; } catch (e) { /* ignore */ }
if (musicStyle !== 'off' && !TRACKS[musicStyle]) musicStyle = 'calm';
function initAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    startMusic();
  } catch (e) { /* no audio */ }
}
function startMusic() {
  if (mus || !audio) return;
  try {
    const out = audio.createGain(); out.gain.value = 0; out.connect(audio.destination);
    const lp = audio.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.connect(out);
    const dl = audio.createDelay(2); dl.delayTime.value = .6;
    const fb = audio.createGain(); fb.gain.value = .45;
    const dlp = audio.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1300;
    dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(lp);
    const bus = audio.createGain(); bus.connect(lp); bus.connect(dl);
    const t0 = audio.currentTime;
    mus = { out, bus, next: t0 + .2, nb: t0 + 1, ci: 0, timer: setInterval(musicTick, 300) };
    musicTick();
  } catch (e) { /* ignore */ }
}
function musicVol() {
  if (!soundOn || musicStyle === 'off') return 0;
  return state === 'fight' ? .2 : .3;
}
function musicTick() {
  if (!mus || !audio) return;
  mus.out.gain.setTargetAtTime(musicVol(), audio.currentTime, 1.2);
  const T = TRACKS[musicStyle]; if (!T || musicStyle === 'off') return;
  const now = audio.currentTime;
  while (mus.next < now + 1.5) {
    T.chords[mus.ci++ % T.chords.length].forEach(f => musPad(f, mus.next, 12));
    mus.next += 12;
  }
  while (mus.nb < now + 1.5) {
    if (Math.random() < T.density) musBell(pick(T.scale), mus.nb);
    mus.nb += T.step * (.8 + Math.random() * .6);
  }
}
function musPad(f, t, d) {
  [-4, 4].forEach(det => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + 4); g.gain.linearRampToValueAtTime(.0001, t + d + 2);
    o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + d + 2.1);
  });
}
function musBell(f, t) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.type = 'triangle'; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
  o.connect(g); g.connect(mus.bus); o.start(t); o.stop(t + 2.5);
}
function setMusic(s) {
  musicStyle = s;
  try { localStorage.setItem('hw3d.music', s); } catch (e) { /* ignore */ }
  if (mus && audio) { mus.ci = 0; mus.next = audio.currentTime + .1; musicTick(); }
  [...$('mus').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.s === s));
}
function setSound(on) {
  soundOn = on;
  if (mus && audio) musicTick();
  $('bs').style.opacity = on ? 1 : .4;
}

/* ---------- effects ---------- */
function txt(v, s, color, cls) {
  const w = v.clone(); w.y += 2.4; w.project(cam);
  if (w.z > 1) return;
  const layer = $('fxl');
  if (layer.childElementCount > 40) layer.removeChild(layer.firstChild);
  const d = document.createElement('div');
  d.textContent = s;
  if (cls) d.className = cls;
  d.style.left = (w.x * .5 + .5) * 100 + '%';
  d.style.top = (-w.y * .5 + .5) * 100 + '%';
  d.style.color = color || '';
  layer.appendChild(d);
  setTimeout(() => d.remove(), 900);
}
function burst(p, c, n) {
  for (let i = 0; i < n && parts.length < 320; i++) {
    const m = new THREE.Mesh(partGeo, basicMat(c));
    m.position.copy(p); m.position.y += 1.3;
    scene.add(m);
    parts.push({ m, v: new V((Math.random() - .5) * 7, Math.random() * 5 + 1, (Math.random() - .5) * 7), t: .55, T: .55 });
  }
}
function ringFx(pos, col, r1, T) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, .08, pos.z);
  scene.add(m);
  fxs.push({ m, t: T, T, r1 });
}
function banner(title, ms, sub) {
  const b = $('bn');
  b.innerHTML = '<div>' + title + '</div>' + (sub ? '<small>' + sub + '</small>' : '');
  b.classList.add('on');
  clearTimeout(banner.h);
  banner.h = setTimeout(() => b.classList.remove('on'), ms || 1500);
}
function face(g, dx, dz, dt) {
  let d = Math.atan2(dx, dz) - g.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * Math.min(1, 14 * dt);
}

/* ==========================================================================
   4. COMBAT
   ========================================================================== */

const targetable = e => !e.dead && e.spawnT <= 0;
const addScore = n => { G.score += Math.round(n); };
const comboMult = () => 1 + Math.min(P.hits, 30) * .05;

function nearest() {
  let best = null, bd = 1e9;
  const pp = P.g.position;
  for (const e of enemies) {
    if (!targetable(e)) continue;
    const d = Math.hypot(e.g.position.x - pp.x, e.g.position.z - pp.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function spawnEnemy(id) {
  const t = ENEMY_TYPES[id];
  const w = G.mode === 'story' ? 1 : G.wave;
  const hpm = 1 + (w - 1) * .15, dmm = (1 + (w - 1) * .08) * diff;
  const e = {
    id: ++uid, t, g: monster(t), hp: Math.round(t.hp * hpm), max: Math.round(t.hp * hpm), r: .9 * t.s,
    dmg: t.dmg * dmm, stun: 0, kb: new V(), hurt: 0, dead: false, dt: 0, ph: 'move', wt: 0, rt: 0, cnt: 0,
    hv: false, oc: 1.5 + Math.random() * 2, dc: 2 + Math.random() * 2, spawnT: .8, dhit: false,
    dashDir: new V(), tele: null, bar: null
  };
  let x = 0, z = 0;
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.283, r = 8.5 + Math.random() * 2.5;
    x = Math.cos(a) * r; z = Math.sin(a) * r;
    if (Math.hypot(x - P.g.position.x, z - P.g.position.z) > 6) break;
  }
  e.g.position.set(x, -1, z);
  e.g.scale.setScalar(.01);
  scene.add(e.g);
  if (t.slam) {
    e.tele = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0, depthWrite: false }));
    e.tele.rotation.x = -Math.PI / 2; e.tele.position.y = .05; scene.add(e.tele);
  }
  e.bar = document.createElement('div');
  e.bar.className = 'eb' + (t.boss ? ' boss' : '');
  e.bar.innerHTML = '<i></i>';
  $('ebars').appendChild(e.bar);
  enemies.push(e);
  burst(e.g.position.clone().setY(-.8), t.col, 8);
  sfx(160, .25, 'sine', .05, 2);
}

function removeEnemy(e) {
  scene.remove(e.g);
  if (e.tele) { scene.remove(e.tele); e.tele.geometry.dispose(); e.tele.material.dispose(); }
  if (e.bar) e.bar.remove();
  const i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
}

function shoot(from, dir, dmg, speed) {
  const m = new THREE.Mesh(orbGeoE, new THREE.MeshBasicMaterial({ color: 0x6fe0c0 }));
  m.position.copy(from); m.position.y = 1.3;
  scene.add(m);
  proj.push({ m, v: dir.clone().multiplyScalar(speed), own: false, dmg, stun: 0, pierce: false, hit: new Set(), t: 3 });
}
function playerProj(from, dir, dmg, speed, col, stun, pierce) {
  const m = new THREE.Mesh(orbGeoP, new THREE.MeshBasicMaterial({ color: col }));
  m.position.copy(from); m.position.y = 1.3;
  scene.add(m);
  proj.push({ m, v: dir.clone().multiplyScalar(speed), own: true, dmg, stun, pierce, hit: new Set(), t: 2.5 });
}

/* Damage the player deals. src: atk | skill | nova | realm | parry */
function hitEnemy(e, raw, kb, dir, src, finisher) {
  let d = raw, crit = false;
  if (src !== 'realm') {
    d *= P.mods.dmg;
    if (e.hp < e.max * .3) d *= 1 + P.mods.exec;
    if ((src === 'atk' || src === 'skill') && Math.random() < P.mods.crit) { d *= 2; crit = true; }
  }
  d = Math.max(1, Math.round(d));
  e.hp = Math.max(0, e.hp - d);
  e.hurt = .12;
  e.kb.copy(dir).multiplyScalar(kb * (e.t.boss ? .4 : 1));
  if (finisher && !e.t.boss && !e.dead) { e.stun = Math.max(e.stun, .4); e.ph = 'move'; }
  P.ch = Math.min(100, P.ch + d * .8 * P.mods.chGain);
  P.hits++; P.hT = 2.2;
  G.maxCombo = Math.max(G.maxCombo, P.hits);
  addScore(d * comboMult());
  if (P.mods.siphon && src === 'atk') P.hp = Math.min(P.max, P.hp + P.mods.siphon);
  if (P.hits % 10 === 0) {
    txt(P.g.position, 'RAMPAGE x' + P.hits, '#ffd24a');
    P.ch = Math.min(100, P.ch + 8);
    sfx(520, .2, 'triangle', .06, 1.6);
  }
  txt(e.g.position, crit ? d + '!' : d, crit ? '#ffd24a' : '#fff', crit ? 'crit' : '');
  burst(e.g.position, crit ? 0xffd24a : 0xffffff, crit ? 10 : 6);
  sfx(crit ? 260 : 190, .07);
  hitStop = Math.max(hitStop, crit ? .09 : .06);
  shake = Math.max(shake, crit ? .2 : .12);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true; e.dt = 1.1; e.stun = 0;
  G.kills++;
  const boss = !!e.t.boss;
  shake = boss ? .7 : .4; hitStop = Math.max(hitStop, boss ? .25 : .1);
  sfx(70, .4, 'sawtooth'); vibe(boss ? [90, 40, 90] : 25);
  burst(e.g.position, e.t.col, boss ? 40 : 24);
  ringFx(e.g.position, e.t.col, boss ? 8 : 3.5, .45);
  const sh = Math.round(e.t.shards * shardMul() * (1 + (G.wave - 1) * .03));
  G.shards += sh;
  addScore(boss ? 500 : 50);
  txt(e.g.position, '+' + sh + ' ◆', '#a8f0e0');
  P.ch = Math.min(100, P.ch + (boss ? 30 : 8) * P.mods.chGain);
  if (boss || Math.random() < .14) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.position.set(e.g.position.x, .6, e.g.position.z);
    scene.add(m);
    drops.push({ m, t: 14, heal: boss ? .3 : .12 });
  }
  if (e.tele) e.tele.material.opacity = 0;
  if (e.bar) e.bar.style.display = 'none';
}

/* Damage the player takes. src is the attacking enemy, if any. */
function dmgP(d, kb, dir, src) {
  if (P.inv > 0) {
    if (P.dgT > 0 && time - (P.pdAt || -9) > 1) {   /* perfect dodge: brief bullet time and a reward */
      P.pdAt = time; P.ch = Math.min(100, P.ch + 12 * P.mods.chGain); addScore(75);
      txt(P.g.position, 'PERFECT DODGE', '#8fe8ff'); hitStop = Math.max(hitStop, .22); flash = .1;
      sfx(700, .12, 'sine', .06, 1.8); vibe(15);
    }
    return 'inv';
  }
  if (P.gd) {
    if (P.gT < P.parryWin) {
      if (src) { src.stun = 1; src.ph = 'move'; hitEnemy(src, 10, 6, dir.clone().negate(), 'parry'); }
      parryFx();
      P.inv = Math.max(P.inv, .3);
      return 'parry';
    }
    d = Math.round(d * .25); P.sp = Math.max(0, P.sp - 8); kb *= .3;
  }
  d = Math.max(1, Math.round(d));
  P.hp = Math.max(0, P.hp - d);
  P.hurt = .15; P.inv = .5;
  P.kb.copy(dir).multiplyScalar(kb);
  P.ch = Math.min(100, P.ch + d * .8);
  P.hits = 0;
  G.hurtWave++;
  txt(P.g.position, P.gd ? d + ' blocked' : d, '#ff7a8a');
  sfx(110, .12);
  shake = .25; redFlash = .35; vibe(60);
  if (P.hp <= 0) {
    if (P.mods.revive > 0) revive(); else end(false);
  }
  return 'hit';
}
function parryFx() {
  P.ch = Math.min(100, P.ch + 15 * P.mods.chGain); vibe([20, 30, 20]);
  G.parries++;
  addScore(100);
  txt(P.g.position, 'PARRY', '#7dffb0');
  flash = .15; hitStop = Math.max(hitStop, .08);
  sfx(900, .15, 'sine');
  burst(P.g.position, 0x7dffb0, 10);
  ringFx(P.g.position, 0x7dffb0, 3, .3);
}
function revive() {
  P.mods.revive--;
  P.hp = Math.ceil(P.max * .5);
  P.inv = 2; flash = .6; shake = .6;
  banner('Phoenix Ember', 1500, 'You rise again');
  ringFx(P.g.position, 0xffa04a, 10, .6);
  burst(P.g.position, 0xffa04a, 30);
  sfx(330, .6, 'triangle', .08, 3);
  for (const e of enemies) if (targetable(e)) { e.stun = 2; e.ph = 'move'; }
}

function storm() {
  const n = P.mods.lightning, pp = P.g.position;
  ringFx(pp, 0xfff27a, 5, .35);
  sfx(600, .15, 'sawtooth', .05, .4);
  for (const e of enemies) {
    if (!targetable(e)) continue;
    const v = new V(e.g.position.x - pp.x, 0, e.g.position.z - pp.z);
    if (v.length() < 5) hitEnemy(e, 7 + 6 * n, 2, v.normalize(), 'nova');
  }
}

function skill(toE, T, cost) {
  const k = P.c.sk, pp = P.g.position;
  P.sp -= cost; P.sCd = k.cd * P.mods.skillCd;
  sfx(420, .12, 'triangle');
  if (k.t === 'proj') playerProj(pp, toE, k.dmg, k.v, P.c.col, k.stun, k.pierce);
  if (k.t === 'blink' && T) {
    burst(pp, P.c.col, 10);
    pp.copy(T.g.position).addScaledVector(toE, 2.4);
    pp.y = 0;
    const rl = Math.hypot(pp.x, pp.z);
    if (rl > ARENA) { pp.x *= ARENA / rl; pp.z *= ARENA / rl; }
    hitEnemy(T, k.dmg, 5, toE, 'skill');
    for (const e of enemies) {
      if (e === T || !targetable(e)) continue;
      const v = new V(e.g.position.x - pp.x, 0, e.g.position.z - pp.z);
      if (v.length() < 3) hitEnemy(e, 10, 3, v.normalize(), 'nova');
    }
    P.sw = .25; P.inv = Math.max(P.inv, .15);
    burst(pp, P.c.col, 10);
  }
  if (k.t === 'heal') {
    P.hp = Math.min(P.max, P.hp + k.heal);
    txt(pp, '+' + k.heal, '#7dffb0');
    burst(pp, 0xffc247, 14);
    ringFx(pp, 0xffc247, 3.5, .35);
    for (const e of enemies) {
      if (!targetable(e)) continue;
      const v = new V(e.g.position.x - pp.x, 0, e.g.position.z - pp.z);
      if (v.length() < 3.5) hitEnemy(e, k.nova, 4, v.normalize(), 'nova');
    }
  }
}

function realm() {
  const r = P.c.rm;
  P.ch = 0; flash = .5; shake = .6;
  banner(P.c.rn, 1600);
  sfx(80, .6, 'sawtooth');
  ringFx(P.g.position, P.c.col, 14, .6);
  for (const e of enemies) {
    if (!targetable(e)) continue;
    hitEnemy(e, r.dmg, 0, new V(), 'realm');
    if (!e.dead) { e.stun = e.t.boss ? r.stun * .5 : r.stun; e.ph = 'move'; }
  }
  if (r.heal) { P.hp = Math.min(P.max, P.hp + r.heal); txt(P.g.position, '+' + r.heal, '#7dffb0'); }
  if (r.sp) P.sp = 100;
  if (r.inv) P.inv = Math.max(P.inv, r.inv);
}

/* ---------- enemy behaviour ---------- */
function attackersNow() {
  let n = 0;
  for (const e of enemies) if (!e.dead && (e.ph === 'wind' || e.ph === 'dashw' || e.ph === 'dash')) n++;
  return n;
}

function updateEnemy(e, dt) {
  const ep = e.g.position, pp = P.g.position;

  if (e.dead) {
    e.dt -= dt;
    ep.y -= dt * 1.2;
    e.g.scale.setScalar(Math.max(.01, e.t.s * clamp(e.dt / .6, 0, 1)));
    return;
  }
  if (e.spawnT > 0) {
    e.spawnT -= dt;
    const k = clamp(1 - e.spawnT / .8, 0, 1);
    e.g.scale.setScalar(Math.max(.01, e.t.s * k));
    ep.y = -1 + k * 1 + (e.t.fly ? .7 * k : 0);
    return;
  }

  const dx = pp.x - ep.x, dz = pp.z - ep.z;
  const dist = Math.hypot(dx, dz) || .0001;
  const dir = new V(dx / dist, 0, dz / dist);
  const side = new V(-dir.z, 0, dir.x);
  const sd = Math.sin(time * .7 + e.id * 2) > 0 ? 1 : -1;
  const reach = 1.3 * e.t.s + 1.4;
  e.hurt -= dt;

  if (e.stun > 0) {
    e.stun -= dt;
    if (e.ph !== 'move') { e.ph = 'move'; e.hv = false; }
  } else {
    face(e.g, dir.x, dir.z, dt);
    switch (e.ph) {
      case 'move': {
        const spd = e.t.spd;
        if (e.t.keep) {
          if (dist < e.t.keep - 1.5) ep.addScaledVector(dir, -spd * .9 * dt);
          else if (dist > e.t.keep + 1.2) ep.addScaledVector(dir, spd * dt);
          else ep.addScaledVector(side, sd * spd * .7 * dt);
        } else if (dist > reach - .3) {
          ep.addScaledVector(dir, spd * dt);
        }
        if (e.t.fly) ep.addScaledVector(side, Math.sin(time * 2 + e.id) * 1.6 * dt);
        e.oc -= dt; e.dc -= dt;
        if (e.t.orb && e.oc <= 0 && dist > (e.t.keep ? 2.5 : 6)) {
          if (e.t.volley) {
            const n = e.hp < e.max * .5 ? 5 : 3;
            for (let k = 0; k < n; k++) shoot(ep, dir.clone().applyAxisAngle(YUP, (k - (n - 1) / 2) * .32), e.dmg * .7, 8.5);
            e.oc = 3.2;
          } else {
            shoot(ep, dir, e.dmg * 1.1, 9.5);
            e.oc = 2.2 + Math.random() * 1.2;
          }
          sfx(300, .12, 'sine', .05, .6);
        }
        const free = attackersNow() < G.maxAtk;
        if (e.t.dash && e.dc <= 0 && dist > 3.5 && dist < 11 && free) {
          e.ph = 'dashw'; e.wt = .6;
        } else if (dist <= reach) {
          if (free) {
            e.ph = 'wind'; e.cnt++;
            e.hv = e.cnt % 3 === 0;
            e.wt = e.t.slam && e.hv ? 1 : (e.hv ? .8 : .45);
          } else {
            ep.addScaledVector(side, sd * spd * .6 * dt);
          }
        }
        break;
      }
      case 'wind':
        e.wt -= dt;
        if (e.wt <= 0) {
          if (e.t.slam && e.hv) {
            ringFx(ep, 0xff5a3a, 5.2, .4);
            shake = .5; sfx(60, .3, 'sawtooth', .09);
            if (dist < 5.2) dmgP(Math.round(e.dmg * 1.6), 14, dir, e);
          } else {
            if (dist < reach + (e.hv ? .9 : .3)) dmgP(Math.round(e.dmg * (e.hv ? 1.8 : 1)), e.hv ? 12 : 6, dir, e);
            if (e.hv) shake = .3;
          }
          e.ph = 'rec'; e.rt = e.hv ? .8 : .55;
        }
        break;
      case 'dashw':
        e.wt -= dt;
        if (e.wt <= 0) { e.ph = 'dash'; e.wt = .38; e.dashDir.copy(dir); e.dhit = false; sfx(500, .2, 'sawtooth', .05, 2); }
        break;
      case 'dash':
        ep.addScaledVector(e.dashDir, 17 * dt);
        e.wt -= dt;
        if (!e.dhit && dist < e.r + .8) {
          e.dhit = true;
          dmgP(Math.round(e.dmg * 1.3), 10, e.dashDir.clone(), e);
          e.wt = Math.min(e.wt, .05);
        }
        if (e.wt <= 0) { e.ph = 'rec'; e.rt = .8; e.dc = 3 + Math.random() * 2; }
        break;
      default: // rec
        e.rt -= dt;
        if (e.rt <= 0) e.ph = 'move';
    }
  }

  ep.addScaledVector(e.kb, dt);
  e.kb.multiplyScalar(Math.pow(.02, dt));
  const el = Math.hypot(ep.x, ep.z);
  if (el > ARENA) { ep.x *= ARENA / el; ep.z *= ARENA / el; }
  ep.y = e.t.fly ? .7 + Math.sin(time * 3 + e.id) * .25 : 0;

  const winding = e.ph === 'wind', dashing = e.ph === 'dashw';
  const mt = e.g.userData.mt;
  mt.emissive.setHex(e.hurt > 0 ? 0xffffff : winding ? (e.hv ? 0xff2222 : 0xffaa33) : dashing ? 0x66aaff : e.t.col);
  mt.emissiveIntensity = winding || dashing ? .9 : .15;
  e.g.scale.setScalar(e.t.s * (winding || dashing ? 1 + .1 * Math.sin(time * 40) : 1));
  if (e.g.userData.orbit) e.g.userData.orbit.rotation.y += dt * 2;
  if (e.tele) {
    e.tele.position.set(ep.x, .05, ep.z);
    e.tele.material.opacity = winding && e.hv ? .12 + .3 * (1 - e.wt) : 0;
  }
}

function separate() {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead || a.spawnT > 0) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.dead || b.spawnT > 0) continue;
      const dx = b.g.position.x - a.g.position.x, dz = b.g.position.z - a.g.position.z;
      const d = Math.hypot(dx, dz), m = (a.r + b.r) * .9;
      if (d < m && d > 1e-4) {
        const push = (m - d) * .5, nx = dx / d, nz = dz / d;
        a.g.position.x -= nx * push; a.g.position.z -= nz * push;
        b.g.position.x += nx * push; b.g.position.z += nz * push;
      }
    }
  }
}

/* ---------- per-frame update ---------- */
function upd(dt) {
  time += dt; G.t += dt;
  const pp = P.g.position, mods = P.mods;
  const T = nearest();
  const toE = new V();
  let dist = 99;
  if (T) {
    toE.set(T.g.position.x - pp.x, 0, T.g.position.z - pp.z);
    dist = toE.length();
    if (dist > 1e-4) toE.divideScalar(dist); else toE.copy(aim);
  } else toE.copy(aim);
  aim.copy(toE);
  const rt = new V(-toE.z, 0, toE.x);

  let ix = (keys.rt ? 1 : 0) - (keys.lf ? 1 : 0) + joy.x;
  let iy = (keys.fw ? 1 : 0) - (keys.bk ? 1 : 0) + joy.y;
  const il = Math.hypot(ix, iy);
  if (il > 1) { ix /= il; iy /= il; }
  const mv = rt.clone().multiplyScalar(ix).addScaledVector(toE, iy);
  P.mv = il;

  const can = P.stun <= 0 && P.dgT <= 0;
  if (P.stun > 0) P.stun -= dt;
  P.gd = can && !!keys.gd;
  P.gT = P.gd ? P.gT + dt : 0;

  if (P.dgT > 0) { P.dgT -= dt; pp.addScaledVector(P.dgD, 16 * dt); }
  else if (can) pp.addScaledVector(mv, P.c.spd * mods.spd * (P.gd ? .4 : 1) * dt);

  if (keys.dg && P.dgCd <= 0 && P.sp >= 10 && P.stun <= 0 && P.dgT <= 0) {
    P.dgT = .28; P.dgCd = .9 * mods.dodgeCd; P.sp -= 10; P.inv = Math.max(P.inv, .4);
    P.dgD = il > .1 ? mv.clone().normalize() : toE.clone().negate();
    sfx(300, .1, 'sine'); burst(pp, 0xffffff, 4);
  }
  pp.addScaledVector(P.kb, dt);
  P.kb.multiplyScalar(Math.pow(.02, dt));
  const rl = Math.hypot(pp.x, pp.z);
  if (rl > ARENA) { pp.x *= ARENA / rl; pp.z *= ARENA / rl; }
  face(P.g, toE.x, toE.z, dt);

  P.aCd -= dt; P.sCd -= dt; P.sw -= dt; P.hurt -= dt; P.inv -= dt; P.dgCd -= dt; P.cT -= dt; P.hT -= dt;
  if (P.hT <= 0) P.hits = 0;
  P.sp = Math.min(100, P.sp + 7 * mods.spRegen * dt);

  /* attack: every enemy in a forward cone is hit */
  if (can && keys.at && P.aCd <= 0 && !P.gd) {
    P.combo = P.cT > 0 ? P.combo % 3 + 1 : 1;
    P.cT = .8;
    const fin = P.combo === 3;
    P.aCd = (fin ? .5 : .27) / mods.atkSpd;
    P.sw = .25;
    sfx(260 + P.combo * 60, .06);
    if (T && dist > 1.8) pp.addScaledVector(toE, .7);
    for (const e of enemies) {
      if (!targetable(e)) continue;
      const v = new V(e.g.position.x - pp.x, 0, e.g.position.z - pp.z);
      const d = v.length();
      if (d < 2.5 + e.r) {
        v.normalize();
        if (d < 1.3 || v.dot(toE) > .3) hitEnemy(e, (P.c.dmg + rnd(0, 3)) * (fin ? 1.8 : 1), fin ? 9 : 3, v, 'atk', fin);
      }
    }
    if (fin && mods.lightning) storm();
  }
  const sk = P.c.sk, skCost = sk.cost * mods.skillCost;
  if (can && keys.sk && P.sCd <= 0 && P.sp >= skCost && (sk.t !== 'blink' || T)) skill(toE, T, skCost);
  if (can && keys.rm && P.ch >= 100) realm();

  const u = P.g.userData;
  u.arm.rotation.x = P.sw > 0 ? -2.4 + 3 * (1 - P.sw / .25) : P.gd ? -1.4 : .1 * Math.sin(time * 3);
  u.bm.emissive.setHex(P.hurt > 0 ? 0xffffff : 0);
  pp.y = P.mv > .1 && P.dgT <= 0 ? Math.abs(Math.sin(time * 10)) * .08 : 0;
  P.g.scale.y = P.dgT > 0 ? .8 : 1;

  /* enemies */
  for (const e of enemies) updateEnemy(e, dt);
  separate();
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead && enemies[i].dt <= 0) removeEnemy(enemies[i]);

  /* projectiles */
  for (let i = proj.length - 1; i >= 0; i--) {
    const b = proj[i];
    b.m.position.addScaledVector(b.v, dt);
    b.t -= dt;
    let gone = b.t <= 0;
    if (!gone && b.own) {
      for (const e of enemies) {
        if (!targetable(e) || b.hit.has(e.id)) continue;
        if (Math.hypot(b.m.position.x - e.g.position.x, b.m.position.z - e.g.position.z) < e.r + .5) {
          hitEnemy(e, b.dmg, 3, b.v.clone().normalize(), 'skill');
          if (b.stun && !e.dead) { e.stun = b.stun; e.ph = 'move'; }
          if (b.pierce) b.hit.add(e.id); else { gone = true; break; }
        }
      }
    } else if (!gone && Math.hypot(b.m.position.x - pp.x, b.m.position.z - pp.z) < .9) {
      if (P.gd && P.gT < P.parryWin) {
        b.own = true; b.v.multiplyScalar(-1.5); b.dmg = Math.round(b.dmg * 3);
        b.hit = new Set(); b.t = 2.5; b.m.material.color.setHex(0x7dffb0);
        parryFx();
      } else if (dmgP(b.dmg, 6, b.v.clone().normalize(), null) !== 'inv') gone = true;
    }
    if (gone) { scene.remove(b.m); b.m.material.dispose(); proj.splice(i, 1); }
  }

  /* pickups */
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t -= dt;
    const dx = pp.x - d.m.position.x, dz = pp.z - d.m.position.z, dd = Math.hypot(dx, dz);
    if (dd < 3.5 && dd > .01) { d.m.position.x += dx / dd * 6 * dt; d.m.position.z += dz / dd * 6 * dt; }
    d.m.position.y = .6 + Math.sin(time * 4 + i) * .12;
    if (dd < 1.2) {
      const h = Math.round(P.max * d.heal);
      P.hp = Math.min(P.max, P.hp + h);
      txt(pp, '+' + h, '#7dffb0');
      burst(pp, 0x7dffb0, 8); sfx(700, .12, 'sine', .06, 1.5);
      d.t = 0;
    }
    if (d.t <= 0) { scene.remove(d.m); drops.splice(i, 1); }
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.t -= dt; q.v.y -= 14 * dt;
    q.m.position.addScaledVector(q.v, dt);
    q.m.scale.setScalar(Math.max(.01, q.t / q.T));
    if (q.t <= 0) { scene.remove(q.m); parts.splice(i, 1); }
  }
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i];
    f.t -= dt;
    const k = clamp(1 - f.t / f.T, 0, 1);
    f.m.scale.setScalar(f.r1 * k + .1);
    f.m.material.opacity = .8 * (1 - k);
    if (f.t <= 0) { scene.remove(f.m); f.m.material.dispose(); fxs.splice(i, 1); }
  }

  shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt); redFlash = Math.max(0, redFlash - dt);

  /* wave flow */
  for (const q of G.queue) q.d -= dt;
  while (G.queue.length && G.queue[0].d <= 0) spawnEnemy(G.queue.shift().id);
  if (!G.cleared && !G.queue.length && !enemies.some(e => !e.dead)) waveCleared();
  if (G.cleared) {
    G.clearT -= dt;
    if (G.clearT <= 0 && state === 'fight') {
      if (G.mode === 'story' && G.wave >= STORY_FIGHTS) end(true);
      else openBoons();
    }
  }
}

/* ==========================================================================
   5. RUN FLOW
   ========================================================================== */

function clearWorld() {
  enemies.slice().forEach(removeEnemy);
  proj.forEach(b => { scene.remove(b.m); b.m.material.dispose(); });
  parts.forEach(q => scene.remove(q.m));
  drops.forEach(d => scene.remove(d.m));
  fxs.forEach(f => { scene.remove(f.m); f.m.material.dispose(); });
  enemies = []; proj = []; parts = []; drops = []; fxs = [];
  $('fxl').innerHTML = '';
  $('ebars').innerHTML = '';
}

function begin(i) {
  selChar = i;
  const c = CHARS[i];
  clearWorld();
  if (P) scene.remove(P.g);
  const hp = Math.round(c.hp * (1 + .08 * upLv('hp')));
  P = {
    c, g: person(c.col), hp, max: hp, sp: 100, ch: 0, aCd: 0, sCd: 0, cT: 0, combo: 0, sw: 0, hurt: 0, inv: 0,
    stun: 0, kb: new V(), gd: false, gT: 0, dgT: 0, dgCd: 0, dgD: new V(), hits: 0, hT: 0, mv: 0,
    mods: { dmg: 1 + .06 * upLv('dmg'), spd: 1, spRegen: 1 + .08 * upLv('sp'), chGain: 1 + .08 * upLv('ch'),
      crit: 0, siphon: 0, lightning: 0, skillCd: 1, skillCost: 1, dodgeCd: 1, exec: 0, revive: 0, atkSpd: 1, parry: 0 }
  };
  Object.defineProperty(P, 'parryWin', { get() { return .22 + this.mods.parry; } });
  G = { mode, wave: 0, t: 0, score: 0, shards: 0, kills: 0, parries: 0, maxCombo: 0, boons: {}, queue: [],
    cleared: false, clearT: 0, hurtWave: 0, bossWave: false, maxAtk: diff > 1 ? 3 : 2 };
  scene.add(P.g);
  P.g.position.set(-5, 0, 0); P.g.rotation.y = 1.57;
  aim.set(1, 0, 0);
  cam.position.set(-13, 5.2, 1.6);
  camLook.set(0, 1.2, 0);
  keys = {}; joy.x = joy.y = 0;

  state = 'fight'; paused = false;
  $('ov').style.display = 'none'; $('bo').style.display = 'none';
  $('menu').style.display = 'none'; $('game').style.display = 'block';
  $('pn').textContent = c.n;
  renderChips();
  resize();
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    startMusic();
  } catch (e) { /* no audio */ }
  startWave();
  showHint();
  last = performance.now();
}

function composeEndless(w) {
  if (w % 5 === 0) {
    const list = [(w / 5) % 2 === 1 ? 'choir' : 'titan'];
    const adds = Math.min(2, Math.floor(w / 5));
    for (let i = 0; i < adds; i++) list.push(pick(['wisp', 'shade', 'spitter']));
    return list;
  }
  const un = ['wisp'];
  if (w >= 2) un.push('brute');
  if (w >= 3) un.push('shade');
  if (w >= 4) un.push('spitter');
  let budget = 1.8 + w * 1.15;
  const list = [];
  while (list.length < 6) {
    const opts = un.filter(t => WAVE_COST[t] <= budget + .01);
    if (!opts.length) break;
    const t = pick(opts);
    list.push(t); budget -= WAVE_COST[t];
  }
  if (!list.length) list.push('wisp');
  return list;
}

function startWave() {
  G.wave++; G.cleared = false; G.clearT = 0; G.hurtWave = 0;
  const list = G.mode === 'story' ? STORY[G.wave - 1] : composeEndless(G.wave);
  G.queue = list.map((id, i) => ({ id, d: .5 + i * .7 }));
  const boss = list.find(id => ENEMY_TYPES[id].boss);
  G.bossWave = !!boss;
  const title = G.mode === 'story' ? 'Fight ' + G.wave + ': ' + ENEMY_TYPES[list[0]].n : 'Wave ' + G.wave;
  banner(title, 1800, boss ? 'Boss: ' + ENEMY_TYPES[boss].n : (G.mode === 'endless' ? list.length + (list.length > 1 ? ' Hollows' : ' Hollow') : ''));
  sfx(220, .3, 'triangle', .06, 1.5);
}

function waveCleared() {
  G.cleared = true;
  const flawless = G.hurtWave === 0;
  const bonus = G.wave * 100 + (flawless ? 250 : 0);
  addScore(bonus);
  const sh = Math.round((G.wave * 2 + (flawless ? 10 : 0)) * shardMul());
  G.shards += sh;
  P.hp = Math.min(P.max, P.hp + P.max * (G.bossWave ? .5 : .25));
  P.sp = 100;
  proj.filter(b => !b.own).forEach(b => { b.t = 0; });
  banner(flawless ? 'Flawless!' : 'Cleared', 1300, '+' + bonus + ' score   +' + sh + ' shards');
  sfx(520, .3, 'triangle', .06, 1.5);
  G.clearT = 1.5;
}

/* ---------- boons ---------- */
function rollBoons() {
  const pool = BOONS.filter(b => (G.boons[b.id] || 0) < b.max);
  const out = [];
  while (out.length < 3 && pool.length) {
    const wts = pool.map(b => {
      let w = b.r === 1 ? 10 : b.r === 2 ? 5 : 1.5;
      if (G.bossWave) w = b.r === 1 ? 2 : b.r === 2 ? 8 : 5;
      else if (G.wave >= 5 && b.r === 3) w *= 2;
      return w;
    });
    let r = Math.random() * wts.reduce((a, b) => a + b, 0), idx = 0;
    for (; idx < pool.length - 1; idx++) { r -= wts[idx]; if (r <= 0) break; }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

let boonOpts = [];
function openBoons() {
  boonOpts = rollBoons();
  if (!boonOpts.length) { startWave(); return; }
  state = 'pick';
  keys = {};
  const o = $('bo');
  o.innerHTML = '<div><h3>' + (G.bossWave ? 'Boss defeated. Choose a reward' : 'Choose a boon') + '</h3><div class="boons">' +
    boonOpts.map((b, i) => {
      const lv = G.boons[b.id] || 0;
      return '<button class="boon r' + b.r + '" data-b="' + i + '"><em>' + RARITY_NAME[b.r] + ' &middot; ' + (lv ? 'Lv ' + lv + ' &rarr; ' + (lv + 1) : 'New') + '</em><b><kbd>' + (i + 1) + '</kbd>' + b.n + '</b><span>' + b.d + '</span></button>';
    }).join('') + '</div></div>';
  o.style.display = 'flex';
  const first = o.querySelector('.boon');
  if (first) first.focus();
}
function chooseBoon(i) {
  if (state !== 'pick' || !boonOpts[i]) return;
  const b = boonOpts[i];
  G.boons[b.id] = (G.boons[b.id] || 0) + 1;
  b.ap(P);
  $('bo').style.display = 'none';
  sfx(660, .2, 'triangle', .07, 1.5);
  renderChips();
  state = 'fight';
  startWave();
  last = performance.now();
}

function end(win, quit) {
  if (state === 'over' || !G) return;
  state = 'over';
  keys = {};
  const earned = G.shards + (win ? 50 : 0);
  save.shards += earned;
  save.stats.runs++; save.stats.kills += G.kills;
  const records = [];
  if (G.mode === 'endless') {
    if (G.wave > save.best.endless.wave) { save.best.endless.wave = G.wave; records.push('New best wave'); }
    if (G.score > save.best.endless.score) { save.best.endless.score = G.score; records.push('New high score'); }
  } else {
    if (G.score > save.best.story.score) { save.best.story.score = G.score; records.push('New high score'); }
    if (win && (!save.best.story.time || G.t < save.best.story.time)) { save.best.story.time = G.t; records.push('New best time'); }
  }
  persist();
  const title = win ? 'Dawn breaks. You win.' : quit ? 'You withdraw.' : 'You fall. The Hollows win.';
  const boonList = BOONS.filter(b => G.boons[b.id]).map(b => b.n + (G.boons[b.id] > 1 ? ' x' + G.boons[b.id] : '')).join(', ');
  const o = $('ov');
  o.innerHTML = '<div><h3 style="font-size:2rem">' + title + '</h3>' +
    (records.length ? '<p>' + records.map(r => '<span class="badge">' + r + '</span>').join('') + '</p>' : '') +
    '<div class="res">' +
    '<span>Score<b>' + G.score.toLocaleString() + '</b></span>' +
    '<span>' + (G.mode === 'story' ? 'Fight' : 'Wave') + '<b>' + G.wave + '</b></span>' +
    '<span>Time<b>' + G.t.toFixed(1) + ' s</b></span>' +
    '<span>Best combo<b>' + G.maxCombo + '</b></span>' +
    '<span>Kills<b>' + G.kills + '</b></span>' +
    '<span>Parries<b>' + G.parries + '</b></span>' +
    '<span>Shards<b>+' + earned + '</b></span>' +
    '<span>Bank<b>' + save.shards + '</b></span></div>' +
    (boonList ? '<p style="font-size:.85rem">Boons: ' + boonList + '</p>' : '') +
    '<p style="font-size:.85rem">Spend shards on permanent upgrades in the Soul Forge.</p>' +
    '<button id="a1">Play again</button><button id="a2" class="alt">Menu</button></div>';
  o.style.display = 'flex';
  $('a1').onclick = () => begin(selChar);
  $('a2').onclick = toMenu;
  $('a1').focus();
}
function toMenu() {
  state = 'menu'; paused = false;
  $('ov').style.display = 'none'; $('bo').style.display = 'none';
  $('menu').style.display = 'block'; $('game').style.display = 'none';
  renderMenu();
}

/* ==========================================================================
   6. UI
   ========================================================================== */

const MODE_TEXT = {
  endless: 'Endless: wave after wave, a boon after every wave, a boss every five. Chase your best wave and score.',
  story: 'Story: three fixed fights with a boon between each. A short run to learn your Warden.'
};

function renderMenu() {
  const be = save.best.endless;
  $('stats').innerHTML = '<span>&#9670; <b>' + save.shards + '</b> shards</span><span>Best wave <b>' + be.wave +
    '</b></span><span>High score <b>' + be.score.toLocaleString() + '</b></span><span>Runs <b>' + save.stats.runs + '</b></span>';
  $('mdesc').textContent = MODE_TEXT[mode];
  [...$('modes').children].forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
  [...$('df').children].forEach(b => b.setAttribute('aria-pressed', +b.dataset.d === diff));
  $('fg').innerHTML = FORGE.map(f => {
    const l = upLv(f.id), maxed = l >= f.max, cost = f.base * (l + 1);
    return '<div class="fi"><div><b>' + f.n + '</b><span>' + f.d + '</span><div class="pips">' +
      '<u class="on"></u>'.repeat(l) + '<u></u>'.repeat(f.max - l) + '</div></div>' +
      '<button data-f="' + f.id + '"' + (maxed || save.shards < cost ? ' disabled' : '') + '>' + (maxed ? 'Max' : '&#9670; ' + cost) + '</button></div>';
  }).join('');
}
function buildCards() {
  $('cards').innerHTML = CHARS.map((c, i) =>
    '<button class="card" data-p="' + i + '"><i style="background:#' + c.col.toString(16).padStart(6, '0') + '"></i><div><b>' + c.n +
    '</b><span>' + c.role + '</span><span>' + c.hp + ' health. Skill: ' + c.sk.n + '. Realm: ' + c.rn + '</span></div></button>').join('');
}

function renderChips() {
  $('chips').innerHTML = BOONS.filter(b => G && G.boons[b.id]).map(b =>
    '<span class="r' + b.r + '" title="' + b.n + '">' + b.ab + (G.boons[b.id] > 1 ? '<sup>' + G.boons[b.id] + '</sup>' : '') + '</span>').join('');
}

function showHint() {
  if (save.seen) return;
  save.seen = true; persist();
  const touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  const h = $('hint');
  h.textContent = touch
    ? 'Stick to move. Attack chains a 3-hit combo. Tap Guard just before a hit to parry.'
    : 'WASD move. J attack (chain 3 hits). K skill. Space dodge. Hold L just before a hit to parry.';
  h.classList.add('on');
  setTimeout(() => h.classList.remove('on'), 7000);
}

function updBars() {
  const w = innerWidth, h = innerHeight;
  const v = new V();
  for (const e of enemies) {
    const b = e.bar;
    if (!b) continue;
    if (e.dead || e.spawnT > 0 || e.hp >= e.max) { b.style.display = 'none'; continue; }
    v.copy(e.g.position); v.y += 2.7 * e.t.s + .3; v.project(cam);
    if (v.z > 1) { b.style.display = 'none'; continue; }
    b.style.display = 'block';
    b.style.left = (v.x * .5 + .5) * w + 'px';
    b.style.top = (-v.y * .5 + .5) * h + 'px';
    b.firstChild.style.width = e.hp / e.max * 100 + '%';
  }
}

function hud() {
  $('php').style.width = P.hp / P.max * 100 + '%';
  $('hpt').textContent = Math.ceil(P.hp) + ' / ' + P.max;
  $('psp').style.width = P.sp + '%';
  $('pch').style.width = P.ch + '%';
  const T = nearest();
  $('en').textContent = T ? T.t.n : '';
  $('ehp').style.width = T ? T.hp / T.max * 100 + '%' : '0%';
  const c = $('cmb');
  if (P.hits > 1) { c.textContent = P.hits + ' HITS  x' + comboMult().toFixed(1); c.style.opacity = 1; } else c.style.opacity = 0;
  $('brm').classList.toggle('rdy', P.ch >= 100);
  $('wv').textContent = G.mode === 'story' ? 'Fight ' + G.wave + '/' + STORY_FIGHTS : 'Wave ' + G.wave;
  $('sc').textContent = G.score.toLocaleString();
  $('sh').textContent = G.shards;
  $('vig').style.opacity = clamp(redFlash / .35, 0, 1) + (P.hp < P.max * .25 ? .25 + .1 * Math.sin(time * 6) : 0);
}

function camUpd(dt) {
  if (!P) return;
  const T = nearest();
  const to = aim.clone();
  const side = new V(-to.z, 0, to.x);
  const tp = P.g.position.clone().addScaledVector(to, -8.5).addScaledVector(side, 1.6);
  tp.y = 5.2 + (cam.aspect < 1 ? 2 : 0);
  cam.position.lerp(tp, 1 - Math.pow(.002, dt));
  const m = T ? P.g.position.clone().lerp(T.g.position, .5) : P.g.position.clone().addScaledVector(to, 2);
  m.y = 1.2;
  camLook.lerp(m, 1 - Math.pow(.001, dt));
  cam.position.x += (Math.random() - .5) * shake;
  cam.position.y += (Math.random() - .5) * shake;
  cam.lookAt(camLook);
  if (T) {
    marker.visible = true;
    marker.position.set(T.g.position.x, .06, T.g.position.z);
    marker.scale.setScalar(T.r + .5 + Math.sin(time * 6) * .06);
  } else marker.visible = false;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h;
  cam.fov = w < h ? 72 : 55;
  cam.updateProjectionMatrix();
}

function pause() {
  if (state !== 'fight') return;
  paused = !paused;
  const o = $('ov');
  if (paused) {
    keys = {};
    o.innerHTML = '<div><h3 style="font-size:2rem">Paused</h3><button id="rs1">Resume</button><button id="rs2" class="alt">Give up</button></div>';
    o.style.display = 'flex';
    $('rs1').onclick = pause;
    $('rs2').onclick = () => { paused = false; o.style.display = 'none'; end(false, true); };
    $('rs1').focus();
  } else { o.style.display = 'none'; last = performance.now(); }
}

/* ==========================================================================
   7. INPUT AND MAIN LOOP
   ========================================================================== */

function loop(t) {
  let dt = Math.min(.033, Math.max(0, (t - last) / 1000));
  last = t;
  if (state !== 'menu' && P) {
    if (state === 'fight' && !paused) {
      if (hitStop > 0) { hitStop -= dt; dt *= .06; }
      upd(dt);
    }
    if (G) { camUpd(dt || .001); hud(); updBars(); }
    scene.background.setHex(flash > 0 ? 0x3a2a66 : 0x120b24);
    const tw = .6 + .4 * Math.sin(time * 2);
    pillars.forEach((p, i) => p.scale.setScalar(.8 + .3 * Math.sin(time * 1.5 + i) * tw));
    renderer.render(scene, cam);
  }
  requestAnimationFrame(loop);
}

const KEYMAP = { w: 'fw', ArrowUp: 'fw', s: 'bk', ArrowDown: 'bk', a: 'lf', ArrowLeft: 'lf', d: 'rt', ArrowRight: 'rt',
  j: 'at', k: 'sk', l: 'gd', ' ': 'dg', u: 'rm' };

addEventListener('keydown', e => {
  if (state === 'pick') {
    if (e.key >= '1' && e.key <= '3') chooseBoon(+e.key - 1);
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { pause(); return; }
  if (state === 'over' && e.key === 'Enter') { const a = $('a1'); if (a) a.click(); return; }
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
  if (k && state === 'fight') { keys[k] = true; e.preventDefault(); }
});
addEventListener('keyup', e => { const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()]; if (k) keys[k] = false; });
addEventListener('blur', () => { keys = {}; if (state === 'fight' && !paused) pause(); });
addEventListener('resize', resize);

$('bp').onclick = pause;
$('bs').onclick = () => setSound(!soundOn);
$('mus').onclick = e => { const b = e.target.closest('button'); if (!b) return; initAudio(); setMusic(b.dataset.s); };
setMusic(musicStyle);
addEventListener('pointerdown', initAudio, { once: true });
addEventListener('keydown', initAudio, { once: true });
document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden) audio.suspend(); else if (state !== 'over' || true) audio.resume();
});
$('bo').onclick = e => { const b = e.target.closest('[data-b]'); if (b) chooseBoon(+b.dataset.b); };

$('cards').onclick = e => { const b = e.target.closest('[data-p]'); if (b) begin(+b.dataset.p); };
$('df').onclick = e => { const b = e.target.closest('button'); if (!b) return; diff = +b.dataset.d; renderMenu(); };
$('modes').onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; renderMenu(); };
$('fg').onclick = e => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  const f = FORGE.find(x => x.id === b.dataset.f), l = upLv(f.id), cost = f.base * (l + 1);
  if (l >= f.max || save.shards < cost) return;
  save.shards -= cost; save.up[f.id] = l + 1;
  persist(); renderMenu();
};
$('rst').onclick = () => {
  if (!confirm('Erase all shards, upgrades and records?')) return;
  const fresh = defaultSave();
  Object.keys(save).forEach(k => delete save[k]);
  Object.assign(save, fresh);
  persist(); renderMenu();
};

/* touch buttons */
document.querySelectorAll('.ab button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); keys[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } };
  const off = () => { keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

/* virtual stick */
{
  const js = $('js'), jk = $('jk');
  let id = null;
  const move = e => {
    const r = js.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.min(1, Math.hypot(dx, dy) / 50), a = Math.atan2(dy, dx);
    joy.x = Math.cos(a) * l; joy.y = -Math.sin(a) * l;
    jk.style.transform = 'translate(' + Math.cos(a) * l * 40 + 'px,' + Math.sin(a) * l * 40 + 'px)';
  };
  const rel = () => { id = null; joy.x = joy.y = 0; jk.style.transform = ''; };
  js.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; try { js.setPointerCapture(id); } catch (_) { /* ignore */ } move(e); });
  js.addEventListener('pointermove', e => { if (e.pointerId === id) move(e); });
  js.addEventListener('pointerup', rel);
  js.addEventListener('pointercancel', rel);
}

buildCards();
renderMenu();
requestAnimationFrame(loop);

})();
