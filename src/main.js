import * as THREE from '../vendor/three.module.min.js';

const V3 = THREE.Vector3;

// ---------------------------------------------------------------- constants
const L = 100, W = 64, HALF_L = L / 2, HALF_W = W / 2;
const GOAL_HALF = 3.25, BAR_H = 2.5, POST_H = 7;
const G = 9.8, BALL_R = 0.18, DRAG = 0.08;
const MATCH_SECONDS = 300;
const DEG = Math.PI / 180;

const TEAMS = [
  { name: 'MAROONS', jersey: 0x7a1030, trim: 0xffffff, shorts: 0xffffff, helmet: 0x7a1030, gk: 0x1b8a3a, css: '#c2185b' },
  { name: 'SKY BLUES', jersey: 0x4aa3e0, trim: 0x0b2a5b, shorts: 0x0b2a5b, helmet: 0x0b2a5b, gk: 0xf29a1f, css: '#4aa3e0' },
];

// Home formation (attacking +x). Away is mirrored in x.
const FORMATION = [
  { role: 'GK', x: -48, z: 0 },
  { role: 'B', x: -30, z: -10 },
  { role: 'B', x: -30, z: 10 },
  { role: 'M', x: -8, z: -14 },
  { role: 'M', x: -8, z: 14 },
  { role: 'F', x: 20, z: -9 },
  { role: 'F', x: 24, z: 9 },
];

const SQUAD = [
  [['Conor Walsh', 1], ['Declan Murphy', 4], ['Seán Brennan', 6], ['Tadhg Kelly', 8], ['Pádraig Ryan', 9], ['Cian Doyle', 11], ['Eoin Byrne', 14]],
  [['Niall Quinn', 1], ['Ciarán Nolan', 3], ['Darragh Fox', 5], ['Fionn Hayes', 7], ['Rory Gleeson', 10], ['Colm Dunne', 12], ['Shane Lacey', 15]],
];

const ROLE_ATTR = {
  GK: { speed: 55, strike: 62, pass: 58, tackle: 40, stamina: 70, keeping: 80 },
  B: { speed: 62, strike: 55, pass: 58, tackle: 76, stamina: 72, keeping: 0 },
  M: { speed: 68, strike: 65, pass: 76, tackle: 62, stamina: 82, keeping: 0 },
  F: { speed: 76, strike: 80, pass: 62, tackle: 46, stamina: 68, keeping: 0 },
};
const ATTR_LABELS = [['speed', 'Speed'], ['strike', 'Striking'], ['pass', 'Passing'], ['tackle', 'Tackling'], ['stamina', 'Stamina']];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fcfff);
scene.fog = new THREE.Fog(0x9fcfff, 140, 320);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(-70, 20, 0);
const camLook = new V3(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x355e2a, 0.9));
const sun = new THREE.DirectionalLight(0xfff3dd, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- world
function makePitchTexture() {
  const PX = 20, M = 6;
  const c = document.createElement('canvas');
  c.width = (L + M * 2) * PX; c.height = (W + M * 2) * PX;
  const g = c.getContext('2d');
  const stripe = 5 * PX;
  for (let i = 0; i * stripe < c.width; i++) {
    g.fillStyle = i % 2 ? '#3d8b37' : '#46a040';
    g.fillRect(i * stripe, 0, stripe, c.height);
  }
  const X = (x) => (x + HALF_L + M) * PX, Z = (z) => (z + HALF_W + M) * PX;
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 0.15 * PX;
  const line = (x1, z1, x2, z2) => { g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke(); };
  g.strokeRect(X(-HALF_L), Z(-HALF_W), L * PX, W * PX);
  line(0, -HALF_W, 0, HALF_W);
  g.beginPath(); g.arc(X(0), Z(0), 0.4 * PX, 0, Math.PI * 2); g.stroke();
  for (const s of [-1, 1]) {
    const e = s * HALF_L;
    for (const d of [9, 14, 31, 45]) line(e - s * d, -HALF_W, e - s * d, HALF_W);
    // large and small rectangles
    g.strokeRect(Math.min(X(e), X(e - s * 9)), Z(-9.5), 9 * PX, 19 * PX);
    g.strokeRect(Math.min(X(e), X(e - s * 3)), Z(-5), 3 * PX, 10 * PX);
    // arc on the 20m line
    g.beginPath();
    const cx = X(e - s * 14);
    if (s > 0) g.arc(cx, Z(0), 9 * PX, Math.PI / 2, Math.PI * 1.5);
    else g.arc(cx, Z(0), 9 * PX, -Math.PI / 2, Math.PI / 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { tex, w: L + M * 2, h: W + M * 2 };
}

function makeCrowdTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#23262c'; g.fillRect(0, 0, 512, 256);
  const palette = ['#7a1030', '#7a1030', '#4aa3e0', '#4aa3e0', '#ffffff', '#ffd60a', '#e8b894', '#333'];
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = Math.random() < 0.55 ? palette[(Math.random() * palette.length) | 0] : `hsl(${Math.random() * 360},40%,${35 + Math.random() * 35}%)`;
    g.fillRect(Math.random() * 512, Math.random() * 256, 3, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeBoardTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  const cols = ['#7a1030', '#0b2a5b', '#1b8a3a', '#222'];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = cols[i]; g.fillRect(i * 256, 0, 256, 64);
    g.fillStyle = '#fff'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(['HURLING 3D', 'SLIOTAR', 'CÚL!', 'UP THE BANNER'][i], i * 256 + 128, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function buildWorld() {
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2f6e2b, roughness: 1 }));
  surround.rotation.x = -Math.PI / 2; surround.position.y = -0.02; surround.receiveShadow = true;
  scene.add(surround);

  const pt = makePitchTexture();
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(pt.w, pt.h), new THREE.MeshStandardMaterial({ map: pt.tex, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true;
  scene.add(pitch);

  for (const s of [-1, 1]) buildGoal(s);

  const crowd = makeCrowdTexture();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6, metalness: 0.2 });
  const addStand = (x, z, rotY, len, depth, rise, roof) => {
    const grp = new THREE.Group();
    const slope = Math.atan2(rise, depth);
    const slopeLen = Math.hypot(rise, depth);
    const tex = crowd.clone(); tex.needsUpdate = true; tex.repeat.set(len / 14, slopeLen / 7);
    const seats = new THREE.Mesh(new THREE.PlaneGeometry(len, slopeLen), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, side: THREE.DoubleSide }));
    seats.rotation.x = -(Math.PI / 2 + slope);
    seats.position.set(0, 1 + rise / 2, depth / 2);
    seats.receiveShadow = true;
    grp.add(seats);
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, rise + 3, 0.6), concrete);
    back.position.set(0, (rise + 3) / 2, depth + 0.3); grp.add(back);
    const front = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 0.4), concrete);
    front.position.set(0, 0.6, -0.2); grp.add(front);
    if (roof) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, depth * 0.7), roofMat);
      r.position.set(0, rise + 6, depth * 0.62); r.castShadow = true; grp.add(r);
    }
    grp.position.set(x, 0, z); grp.rotation.y = rotY;
    scene.add(grp);
  };
  addStand(0, HALF_W + 7, 0, L + 10, 16, 10, true);
  addStand(0, -(HALF_W + 7), Math.PI, L + 10, 16, 10, true);
  addStand(HALF_L + 9, 0, Math.PI / 2, W + 10, 10, 5, false);
  addStand(-(HALF_L + 9), 0, -Math.PI / 2, W + 10, 10, 5, false);

  // advertising boards
  const boardTex = makeBoardTexture();
  const boardMat = (len) => { const t = boardTex.clone(); t.needsUpdate = true; t.repeat.set(len / 40, 1); return new THREE.MeshBasicMaterial({ map: t }); };
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(L, 1), boardMat(L));
    b.position.set(0, 0.5, s * (HALF_W + 3.5)); b.rotation.y = s > 0 ? Math.PI : 0;
    scene.add(b);
  }

  // floodlights
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 40, 8), poleMat);
    pole.position.set(sx * (HALF_L + 16), 20, sz * (HALF_W + 16));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 1), lampMat);
    lamp.position.set(sx * (HALF_L + 15), 40, sz * (HALF_W + 15));
    lamp.lookAt(0, 0, 0);
    scene.add(pole, lamp);
  }
}

function buildGoal(sign) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, POST_H, 12);
  for (const z of [-GOAL_HALF, GOAL_HALF]) {
    const p = new THREE.Mesh(postGeo, mat);
    p.position.set(0, POST_H / 2, z); p.castShadow = true; grp.add(p);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, GOAL_HALF * 2, 12), mat);
  bar.rotation.x = Math.PI / 2; bar.position.y = BAR_H; bar.castShadow = true; grp.add(bar);

  // net as a grid of lines
  const depth = 2.2, pts = [];
  const grid = (o, a, b, na, nb) => {
    for (let i = 0; i <= na; i++) { const t = i / na; pts.push(o.clone().addScaledVector(a, t), o.clone().addScaledVector(a, t).add(b)); }
    for (let j = 0; j <= nb; j++) { const t = j / nb; pts.push(o.clone().addScaledVector(b, t), o.clone().addScaledVector(b, t).add(a)); }
  };
  const d = sign * depth;
  grid(new V3(d, 0, -GOAL_HALF), new V3(0, 0, GOAL_HALF * 2), new V3(0, BAR_H, 0), 26, 10); // back
  grid(new V3(0, BAR_H, -GOAL_HALF), new V3(0, 0, GOAL_HALF * 2), new V3(d, 0, 0), 26, 9); // top
  for (const z of [-GOAL_HALF, GOAL_HALF]) grid(new V3(0, 0, z), new V3(d, 0, 0), new V3(0, BAR_H, 0), 9, 10);
  const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
  grp.add(net);
  grp.position.x = sign * HALF_L;
  scene.add(grp);
}

buildWorld();

// ---------------------------------------------------------------- player meshes
const GEO = {
  thigh: new THREE.CapsuleGeometry(0.078, 0.26, 3, 8),
  shin: new THREE.CapsuleGeometry(0.062, 0.26, 3, 8),
  knee: new THREE.SphereGeometry(0.07, 8, 6),
  sockTop: new THREE.CylinderGeometry(0.068, 0.068, 0.05, 10),
  boot: new THREE.BoxGeometry(0.27, 0.1, 0.13),
  shorts: new THREE.CylinderGeometry(0.19, 0.22, 0.3, 14),
  torso: new THREE.CapsuleGeometry(0.2, 0.3, 4, 12),
  hoop: new THREE.TorusGeometry(0.205, 0.028, 6, 20),
  collar: new THREE.TorusGeometry(0.1, 0.022, 6, 14),
  shoulder: new THREE.SphereGeometry(0.078, 8, 6),
  upperArm: new THREE.CapsuleGeometry(0.048, 0.2, 3, 8),
  sleeve: new THREE.CylinderGeometry(0.066, 0.072, 0.2, 10),
  foreArm: new THREE.CapsuleGeometry(0.042, 0.2, 3, 8),
  hand: new THREE.SphereGeometry(0.052, 8, 6),
  neck: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8),
  head: new THREE.SphereGeometry(0.13, 16, 12),
  eye: new THREE.SphereGeometry(0.014, 6, 4),
  helmet: new THREE.SphereGeometry(0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hair: new THREE.SphereGeometry(0.1, 10, 8),
  grillBar: new THREE.BoxGeometry(0.018, 0.012, 0.2),
  grillPost: new THREE.BoxGeometry(0.018, 0.14, 0.012),
  handle: new THREE.CylinderGeometry(0.02, 0.026, 0.8, 6),
  bas: new THREE.BoxGeometry(0.035, 0.3, 0.12),
  basTip: new THREE.BoxGeometry(0.035, 0.08, 0.1),
  numberPlane: new THREE.PlaneGeometry(0.3, 0.3),
};
const woodMat = new THREE.MeshStandardMaterial({ color: 0xd9b47a, roughness: 0.7 });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
const bootMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
const grillMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.7, roughness: 0.3 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
const SKINS = [0xf0c4a0, 0xe8b894, 0xd99e76, 0xc58a62, 0x8d5a3b];
const HAIRS = [0x2b1b10, 0x5a3a1c, 0x9a6a2a, 0xc9a45a, 0x121212, 0x7a2e12];

const numberTexCache = new Map();
function numberTexture(n, color) {
  const key = `${n}|${color}`;
  if (numberTexCache.has(key)) return numberTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0');
  g.font = 'bold 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 32, 35);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  numberTexCache.set(key, tex);
  return tex;
}

function buildPlayerMesh(kit, isGK, look) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const jerseyCol = isGK ? kit.gk : kit.jersey;
  const trimCol = isGK ? 0x111111 : kit.trim;
  const jersey = new THREE.MeshStandardMaterial({ color: jerseyCol, roughness: 0.75 });
  const trim = new THREE.MeshStandardMaterial({ color: trimCol, roughness: 0.7 });
  const shorts = new THREE.MeshStandardMaterial({ color: isGK ? 0x111111 : kit.shorts, roughness: 0.8 });
  const helmet = new THREE.MeshStandardMaterial({ color: kit.helmet, roughness: 0.35, metalness: 0.1 });
  const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.9 });
  const glove = isGK ? new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 }) : skin;
  const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

  // legs: hip -> knee
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.88, s * 0.11);
    hip.add(mk(GEO.thigh, skin, 0, -0.2, 0));
    const knee = new THREE.Group();
    knee.position.set(0, -0.41, 0);
    knee.add(mk(GEO.knee, skin, 0, 0, 0), mk(GEO.shin, jersey, 0, -0.2, 0), mk(GEO.sockTop, trim, 0, -0.06, 0), mk(GEO.boot, bootMat, 0.05, -0.43, 0));
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee });
  }
  const shortsMesh = mk(GEO.shorts, shorts, 0, 0.94, 0);
  shortsMesh.scale.set(0.85, 1, 1.22);
  body.add(shortsMesh);

  // torso (pivots at the waist so it can lean / twist)
  const torso = new THREE.Group();
  torso.position.set(0, 1.0, 0);
  const chest = new THREE.Group();
  chest.scale.set(0.82, 1, 1.12);
  chest.add(mk(GEO.torso, jersey, 0, 0.36, 0));
  for (const y of [0.3, 0.46]) { const h = mk(GEO.hoop, trim, 0, y, 0); h.rotation.x = Math.PI / 2; chest.add(h); }
  torso.add(chest);
  const collar = mk(GEO.collar, trim, 0, 0.73, 0); collar.rotation.x = Math.PI / 2; torso.add(collar);
  const num = new THREE.Mesh(GEO.numberPlane, new THREE.MeshBasicMaterial({ map: numberTexture(look.number, trimCol), transparent: true, depthWrite: false }));
  num.position.set(-0.178, 0.4, 0); num.rotation.y = -Math.PI / 2;
  torso.add(num);
  torso.add(mk(GEO.neck, skin, 0, 0.77, 0));

  // arms: shoulder -> elbow
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0, 0.62, s * 0.27);
    sh.add(mk(GEO.shoulder, jersey, 0, 0, 0), mk(GEO.upperArm, skin, 0, -0.14, 0), mk(GEO.sleeve, jersey, 0, -0.1, 0));
    const el = new THREE.Group();
    el.position.set(0, -0.29, 0);
    el.add(mk(GEO.foreArm, skin, 0, -0.135, 0), mk(GEO.hand, glove, 0, -0.29, 0));
    sh.add(el);
    torso.add(sh);
    arms.push({ sh, el });
  }

  // head
  const head = new THREE.Group();
  head.position.set(0, 0.9, 0);
  head.add(mk(GEO.head, skin, 0, 0, 0));
  const hr = mk(GEO.hair, hairMat, -0.05, -0.02, 0); hr.scale.set(1, 0.9, 1.05); head.add(hr);
  head.add(mk(GEO.helmet, helmet, 0, 0.015, 0));
  for (const z of [-0.1, 0.1]) { const e = new THREE.Mesh(GEO.eye, eyeMat); e.position.set(0.118, 0.02, z * 0.55); head.add(e); }
  for (const y of [-0.045, 0.0, 0.045]) head.add(mk(GEO.grillBar, grillMat, 0.15, y, 0));
  for (const z of [-0.07, 0, 0.07]) head.add(mk(GEO.grillPost, grillMat, 0.15, 0, z));
  torso.add(head);
  body.add(torso);

  // hurley, gripped by the right hand (end of the right forearm)
  const pivot = new THREE.Group();
  pivot.position.set(0, -0.29, 0);
  const grip = mk(GEO.handle, woodMat, 0, -0.3, 0); grip.scale.set(1, 1, 1);
  const tape = mk(new THREE.CylinderGeometry(0.028, 0.028, 0.22, 6), gripMat, 0, -0.08, 0);
  pivot.add(grip, tape, mk(GEO.bas, woodMat, 0.012, -0.76, 0), mk(GEO.basTip, woodMat, 0.03, -0.92, 0));
  arms[1].el.add(pivot);

  root.scale.setScalar(look.height);
  return { root, body, torso, chest, head, legs, arms, pivot };
}

// ---------------------------------------------------------------- audio
const sfx = {
  ctx: null,
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; }
  },
  noise(dur, filterType, freq, gain, attack = 0.002) {
    const ctx = this.ctx; if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  },
  hit(power = 0.5) { this.noise(0.08, 'bandpass', 1800 + power * 1200, 0.5 + power * 0.4); },
  bounce() { this.noise(0.05, 'lowpass', 600, 0.15); },
  post() { this.noise(0.25, 'bandpass', 3200, 0.5); },
  cheer(level = 1) { this.noise(2.5 * level + 0.5, 'bandpass', 900, 0.35 * level, 0.3); },
  groan() { this.noise(1.2, 'lowpass', 400, 0.25, 0.2); },
  whistle(long = false) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.frequency.value = 2900; lfo.frequency.value = 28; lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency);
    const t = ctx.currentTime, d = long ? 1.2 : 0.45;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.setValueAtTime(0.18, t + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination);
    o.start(); lfo.start(); o.stop(t + d); lfo.stop(t + d);
  },
};

// ---------------------------------------------------------------- game state
const ball = {
  pos: new V3(0, 2, 0), vel: new V3(), prev: new V3(),
  carrier: null, lastTeam: -1, shotId: 0,
  mesh: new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 18, 12), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5 })),
};
ball.mesh.castShadow = true;
scene.add(ball.mesh);

const game = {
  state: 'menu', // menu | play | dead | paused | fulltime
  clock: 0, time: 0,
  score: [{ g: 0, p: 0 }, { g: 0, p: 0 }],
  deadTimer: 0, onDeadEnd: null,
  plan: [{ chasers: [], target: new V3(), mode: '' }, { chasers: [], target: new V3(), mode: '' }],
  camMode: 0, autoSwitch: true,
  prevState: 'play',
};

let human = null;
let charging = null; // 'loft' | 'drive'
let charge = 0;
const inputDir = new V3();

// indicators
const humanRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.9, depthWrite: false }));
humanRing.rotation.x = -Math.PI / 2;
const humanMarker = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 12), new THREE.MeshBasicMaterial({ color: 0xffd60a }));
humanMarker.rotation.x = Math.PI;
const aimArrow = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.12); s.lineTo(1.6, -0.12); s.lineTo(1.6, -0.35); s.lineTo(2.3, 0); s.lineTo(1.6, 0.35); s.lineTo(1.6, 0.12); s.lineTo(0, 0.12);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.75, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  const grp = new THREE.Group(); grp.add(m);
  return grp;
})();
const landMarker = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
landMarker.rotation.x = -Math.PI / 2;
const ballShadowMarker = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
ballShadowMarker.rotation.x = -Math.PI / 2;
scene.add(humanRing, humanMarker, aimArrow, landMarker, ballShadowMarker);

// ---------------------------------------------------------------- players
class Player {
  constructor(team, form, idx) {
    this.team = team;
    this.role = form.role;
    this.dir = team === 0 ? 1 : -1;
    this.base = new V3(form.x * this.dir, 0, form.z);
    this.pos = this.base.clone();
    this.vel = new V3();
    this.des = new V3();
    this.facing = new V3(this.dir, 0, 0);
    this.pickupCooldown = 0; this.protect = 0; this.holdTimer = 0;
    this.tackleTimer = 0.5; this.decisionTimer = 0; this.carryTime = 0;
    this.swing = 0; this.phase = Math.random() * 6;
    this.saveRoll = -1; this.saveOk = false; this.freeShot = false;
    const [name, number] = SQUAD[team][idx];
    this.name = name; this.number = number;
    this.attr = {};
    for (const k in ROLE_ATTR[form.role]) {
      const b = ROLE_ATTR[form.role][k];
      this.attr[k] = b === 0 ? 0 : Math.round(clamp(b + rand(-12, 12), 35, 99));
    }
    // speed 40 -> 0.86x, 100 -> 1.11x
    this.speedMul = 0.86 + 0.25 * (this.attr.speed - 40) / 60;
    this.energy = 1; this.winded = false; this.celebrate = 0; this.headYaw = 0;
    const look = { skin: SKINS[(Math.random() * SKINS.length) | 0], hair: HAIRS[(Math.random() * HAIRS.length) | 0], number, height: 0.95 + (this.attr.speed > 70 ? 0.02 : 0.05) * Math.random() + rand(0, 0.06) };
    this.mesh = buildPlayerMesh(TEAMS[team], form.role === 'GK', look);
    scene.add(this.mesh.root);
  }

  get isGK() { return this.role === 'GK'; }

  seek(tx, tz, maxSpeed) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.25) return this.des.set(0, 0, 0);
    const s = Math.min(maxSpeed * this.speedMul, d * 2.2);
    return this.des.set((dx / d) * s, 0, (dz / d) * s);
  }

  update(dt) {
    this.pickupCooldown = Math.max(0, this.pickupCooldown - dt);
    this.protect = Math.max(0, this.protect - dt);
    this.carryTime = ball.carrier === this ? this.carryTime + dt : 0;

    const desired = this === human ? humanDesired() : this.think(dt);
    const fm = this.energy < 0.25 ? 0.7 + this.energy * 1.2 : 1;
    const k = 1 - Math.exp(-7 * dt);
    this.vel.x += (desired.x * fm - this.vel.x) * k;
    this.vel.z += (desired.z * fm - this.vel.z) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    const carrying = ball.carrier === this;
    const mx = carrying ? HALF_L - 1.4 : HALF_L + 3, mz = carrying ? HALF_W - 1.4 : HALF_W + 2;
    this.pos.x = clamp(this.pos.x, -mx, mx);
    this.pos.z = clamp(this.pos.z, -mz, mz);

    const sp = Math.hypot(this.vel.x, this.vel.z);
    const eff = sp / this.speedMul;
    if (eff > 6.2) this.energy -= (eff - 6.2) * 0.014 * (1.5 - this.attr.stamina / 100) * (this === human ? 1 : 0.6) * dt;
    else if (eff < 5) this.energy += 0.06 * dt;
    this.energy = clamp(this.energy, 0, 1);
    if (this.energy < 0.05) this.winded = true; else if (this.energy > 0.3) this.winded = false;
    let fx = this.facing.x, fz = this.facing.z;
    if (this === human && inputDir.lengthSq() > 0) { fx = inputDir.x; fz = inputDir.z; }
    else if (sp > 0.5) { fx = this.vel.x / sp; fz = this.vel.z / sp; }
    else if (carrying || this.holdTimer > 0) { fx = this.dir; fz = 0; }
    else if (!carrying) { const bx = ball.pos.x - this.pos.x, bz = ball.pos.z - this.pos.z, bd = Math.hypot(bx, bz); if (bd > 0.5) { fx = bx / bd; fz = bz / bd; } }
    const fk = 1 - Math.exp(-10 * dt);
    this.facing.x += (fx - this.facing.x) * fk;
    this.facing.z += (fz - this.facing.z) * fk;
    this.facing.normalize();
  }

  think(dt) {
    if (game.state !== 'play') { const f = formationTarget(this); return this.seek(f.x, f.z, 5.5); }
    if (this.isGK) return this.keeperThink(dt);
    if (ball.carrier === this) return this.carrierThink(dt);
    const plan = game.plan[this.team];
    if (plan.chasers.includes(this)) return this.seek(plan.target.x, plan.target.z, plan.mode === 'press' ? 7.4 : 7.8);
    const f = formationTarget(this);
    return this.seek(f.x, f.z, 6);
  }

  carrierThink(dt) {
    if (this.holdTimer > 0) { this.holdTimer -= dt; return this.des.set(0, 0, 0); }
    if (this.protect > 5) {
      // taking a free: strike from the spot
      if (this.freeShot) shootPoint(this);
      else { const tm = bestPass(this, true); if (tm) passTo(this, tm); else clearance(this); }
      return this.des.set(0, 0, 0);
    }
    const gx = this.dir * HALF_L;
    const dxGoal = Math.abs(gx - this.pos.x), dGoal = Math.hypot(dxGoal, this.pos.z);
    const opp = nearestOpponent(this);
    const nd = opp ? dist2D(opp.pos, this.pos) : 99;

    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = 0.2;
      const angleOK = Math.abs(this.pos.z) < dxGoal * 1.2 + 2;
      const range = this.freeShot ? 50 : 40;
      if (dGoal < 21 && Math.abs(this.pos.z) < 11 && Math.random() < 0.3) { shootGoal(this); return this.des.set(0, 0, 0); }
      if (dGoal < range && angleOK && (this.freeShot || nd < 3 || Math.random() < (dGoal < 30 ? 0.3 : 0.12))) { shootPoint(this); return this.des.set(0, 0, 0); }
      if (nd < 4 || this.carryTime > 4.5) {
        const tm = bestPass(this, nd < 2.2);
        if (tm) { passTo(this, tm); return this.des.set(0, 0, 0); }
        if (nd < 2) { clearance(this); return this.des.set(0, 0, 0); }
      }
    }
    const tx = gx - this.dir * 12, tz = this.pos.z * 0.5;
    let vx = tx - this.pos.x, vz = tz - this.pos.z;
    let vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    if (opp && nd < 7) {
      const w = ((7 - nd) / 7) * 1.3;
      vx += ((this.pos.x - opp.pos.x) / nd) * w; vz += ((this.pos.z - opp.pos.z) / nd) * w;
      vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    }
    const s = 6.8 * this.speedMul;
    return this.des.set(vx * s, 0, vz * s);
  }

  keeperThink(dt) {
    const ownX = -this.dir * HALF_L;
    if (ball.carrier === this) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        const tm = bestPass(this, true);
        if (tm) passTo(this, tm); else clearance(this);
      }
      return this.des.set(0, 0, 0);
    }
    let tx = ownX + this.dir * 1.0, tz = clamp(ball.pos.z * 0.2, -2.2, 2.2);
    if (!ball.carrier && ball.vel.x * this.dir < -2) {
      const t = (ownX - ball.pos.x) / ball.vel.x;
      if (t > 0 && t < 2.5) tz = clamp(ball.pos.z + ball.vel.z * t, -3.6, 3.6);
    }
    const bd = Math.hypot(ball.pos.x - ownX, ball.pos.z);
    if (!ball.carrier && bd < 11 && ball.pos.y < 1.5 && ball.vel.length() < 12) { tx = ball.pos.x; tz = ball.pos.z; }
    return this.seek(tx, tz, 7.5);
  }

  animate(dt) {
    const m = this.mesh;
    m.root.position.set(this.pos.x, 0, this.pos.z);
    m.root.rotation.y = Math.atan2(-this.facing.z, this.facing.x);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const amp = Math.min(sp / 7.5, 1);
    this.phase += sp * dt * 1.55;
    const ph = this.phase, t = game.time;
    this.celebrate = Math.max(0, this.celebrate - dt);
    const celeb = this.celebrate > 0;

    // legs: hip swing with knee flex
    for (let i = 0; i < 2; i++) {
      const phi = ph + i * Math.PI, leg = m.legs[i];
      leg.hip.rotation.z = Math.sin(phi) * 0.85 * amp;
      leg.knee.rotation.z = -(0.06 + 0.95 * Math.max(0, Math.cos(phi)) * amp);
    }

    // hurley / strike state
    let a;
    let swinging = false;
    if (this === human && charging && ball.carrier === this) { a = 0.9 - 2.5 * charge; swinging = true; }
    else if (this.swing > 0) {
      this.swing += dt / 0.3;
      const u = Math.min(this.swing, 1);
      a = -1.6 + 3.9 * (1 - (1 - u) * (1 - u));
      swinging = true;
      if (this.swing >= 1) this.swing = 0;
    } else if (ball.carrier === this) a = 1.25;
    else a = 0.75 + Math.sin(t * 2 + this.phase) * 0.05;

    // torso: forward lean, counter-rotation, breathing, swing twist
    let lean = -(0.05 + 0.26 * amp);
    if (this.swing > 0) lean -= Math.sin(Math.min(this.swing, 1) * Math.PI) * 0.3;
    let twist = Math.sin(ph) * 0.3 * amp;
    if (swinging) twist = -(a - 1.0) * 0.22;
    m.torso.rotation.z += (lean - m.torso.rotation.z) * Math.min(1, dt * 12);
    m.torso.rotation.y += (twist - m.torso.rotation.y) * Math.min(1, dt * 14);
    m.torso.rotation.x = Math.cos(ph) * 0.05 * amp;
    m.chest.scale.y = 1 + Math.sin(t * 2.4 + this.phase) * 0.012 * (1 + (1 - this.energy) * 3);
    m.body.position.y = Math.abs(Math.cos(ph)) * 0.08 * amp;

    // arms
    const [L, R] = m.arms;
    L.sh.rotation.z = -Math.sin(ph) * 0.9 * amp + 0.05;
    L.sh.rotation.x = 0.12;
    L.el.rotation.z = 0.3 + 0.7 * amp;
    R.sh.rotation.x = -0.12;
    R.sh.rotation.z = 0.15 + a * 0.4;
    R.el.rotation.z = 0.6;
    m.pivot.rotation.z = a - R.sh.rotation.z - R.el.rotation.z;
    if (ball.carrier === this && !swinging) { L.sh.rotation.z = 0.5; L.el.rotation.z = 0.9; }

    if (celeb) {
      const j = Math.abs(Math.sin(t * 9 + this.phase));
      m.body.position.y = j * 0.3;
      L.sh.rotation.z = R.sh.rotation.z = 2.9 + Math.sin(t * 12 + this.phase) * 0.25;
      L.el.rotation.z = R.el.rotation.z = 0.15;
      m.pivot.rotation.z = -R.sh.rotation.z - R.el.rotation.z + 2.6;
      m.torso.rotation.z = 0.12;
    }

    // head tracks the ball
    let want = Math.atan2(-(ball.pos.z - this.pos.z), ball.pos.x - this.pos.x) - m.root.rotation.y;
    want = Math.atan2(Math.sin(want), Math.cos(want));
    this.headYaw += (clamp(want, -0.9, 0.9) - this.headYaw) * (1 - Math.exp(-8 * dt));
    m.head.rotation.y = this.headYaw - m.torso.rotation.y;
    m.head.rotation.z = -lean * 0.8;
  }
}

const players = [];
for (let t = 0; t < 2; t++) FORMATION.forEach((f, i) => players.push(new Player(t, f, i)));

function teammates(p) { return players.filter((o) => o.team === p.team && o !== p); }
function opponents(p) { return players.filter((o) => o.team !== p.team); }
function nearestOpponent(p) {
  let best = null, bd = Infinity;
  for (const o of players) if (o.team !== p.team) { const d = dist2D(o.pos, p.pos); if (d < bd) { bd = d; best = o; } }
  return best;
}
function keeperOf(team) { return players.find((p) => p.team === team && p.isGK); }

function formationTarget(p) {
  const out = formationTarget.v || (formationTarget.v = new V3());
  if (p.isGK) return out.set(p.base.x, 0, clamp(ball.pos.z * 0.2, -2.2, 2.2));
  let x = p.base.x + ball.pos.x * 0.45;
  const z = p.base.z * 0.9 + ball.pos.z * 0.3;
  if (ball.carrier && ball.carrier.team === p.team) x += p.dir * 8;
  else if (ball.carrier) x -= p.dir * 6;
  const lim = HALF_L - 6;
  return out.set(clamp(x, -lim, lim), 0, clamp(z, -(HALF_W - 3), HALF_W - 3));
}

function setHuman(p) {
  if (!p || p.team !== 0 || p.isGK) return;
  if (human !== p) { charging = null; }
  human = p;
}

let switchLock = 0;

function switchHuman() {
  if (ball.carrier === human) return;
  const cand = players.filter((p) => p.team === 0 && !p.isGK && p !== human)
    .sort((a, b) => dist2D(a.pos, ball.pos) - dist2D(b.pos, ball.pos));
  if (cand.length) { setHuman(cand[0]); switchLock = 2.5; }
}

// Tab / Shift+Tab: step through the outfield players in formation order
function cycleHuman(dir) {
  if (ball.carrier === human) return;
  const list = players.filter((p) => p.team === 0 && !p.isGK);
  const i = list.indexOf(human);
  setHuman(list[(i + dir + list.length) % list.length]);
  switchLock = 2.5;
}

function autoSwitch(dt) {
  switchLock = Math.max(0, switchLock - dt);
  if (!game.autoSwitch || switchLock > 0 || game.state !== 'play' || !human || ball.carrier === human) return;
  if (ball.carrier && ball.carrier.team === 0) return;
  const tgt = predictBall();
  let best = null, bd = Infinity;
  for (const p of players) if (p.team === 0 && !p.isGK) { const d = dist2D(p.pos, tgt); if (d < bd) { bd = d; best = p; } }
  if (best && best !== human && dist2D(human.pos, tgt) - bd > 7) { setHuman(best); switchLock = 1.5; }
}

// ---------------------------------------------------------------- ball mechanics
function velWithAngle(from, to, theta) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.max(0.1, Math.hypot(dx, dz)), dy = to.y - from.y;
  const c = Math.cos(theta), t = Math.tan(theta);
  const denom = 2 * c * c * (d * t - dy);
  let s = denom > 0.01 ? Math.sqrt((G * d * d) / denom) : 25;
  s *= 1 + DRAG * (d / Math.max(s * c, 1)) * 0.5;
  s = Math.min(s, 40);
  return new V3((dx / d) * c * s, Math.sin(theta) * s, (dz / d) * c * s);
}

function velWithSpeed(from, to, s) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.max(0.1, Math.hypot(dx, dz)), dy = to.y - from.y;
  const a = (G * d * d) / (2 * s * s);
  const disc = d * d - 4 * a * (dy + a);
  const T = disc >= 0 ? (d - Math.sqrt(disc)) / (2 * a) : 1;
  const theta = Math.atan(T);
  const c = Math.cos(theta);
  return new V3((dx / d) * c * s, Math.sin(theta) * s, (dz / d) * c * s);
}

function rotateY(v, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const x = v.x * c - v.z * s, z = v.x * s + v.z * c;
  v.x = x; v.z = z;
  return v;
}

function givePossession(p) {
  ball.carrier = p;
  ball.vel.set(0, 0, 0);
  ball.lastTeam = p.team;
  p.protect = 0.8;
  p.holdTimer = p.isGK ? 0.9 : 0;
  p.decisionTimer = 0.3;
  if (p.team === 0 && !p.isGK) setHuman(p);
}

function strike(p, v) {
  if (ball.carrier !== p) return;
  ball.carrier = null;
  ball.vel.copy(v);
  ball.lastTeam = p.team;
  ball.shotId++;
  p.pickupCooldown = 0.45;
  p.protect = 0; p.holdTimer = 0; p.freeShot = false;
  p.swing = 0.001;
  sfx.hit(Math.min(v.length() / 36, 1));
}

const strikePower = (p) => 0.92 + 0.2 * (p.attr.strike - 40) / 60;
const strikeScatter = (p) => Math.max(0.15, 1.6 - p.attr.strike / 100);

function shootPoint(p) {
  const gx = p.dir * HALF_L;
  const d = Math.hypot(gx - ball.pos.x, ball.pos.z);
  const target = new V3(gx, rand(4.5, 6.5), rand(-1.6, 1.6));
  const v = velWithAngle(ball.pos, target, rand(26, 34) * DEG);
  rotateY(v, rand(-1, 1) * (0.015 + d * 0.0011) * strikeScatter(p));
  v.multiplyScalar(1 + rand(-0.03, 0.05) * strikeScatter(p));
  strike(p, v);
}

function shootGoal(p) {
  const gx = p.dir * HALF_L;
  const k = keeperOf(1 - p.team);
  const side = k.pos.z > 0 ? -1 : 1;
  const target = new V3(gx, rand(0.5, 2.0), side * rand(1.0, 2.9));
  const v = velWithSpeed(ball.pos, target, rand(26, 32));
  rotateY(v, rand(-0.03, 0.03) * strikeScatter(p));
  strike(p, v);
}

function passTo(p, tm) {
  const lead = tm.pos.clone().addScaledVector(tm.vel, 0.6);
  lead.x = clamp(lead.x, -HALF_L + 1, HALF_L - 1);
  lead.z = clamp(lead.z, -HALF_W + 1, HALF_W - 1);
  lead.y = 1.3;
  const d = dist2D(ball.pos, lead);
  const v = velWithAngle(ball.pos, lead, (d > 25 ? 24 : 16) * DEG);
  rotateY(v, rand(-1, 1) * (1 - p.attr.pass / 100) * 0.12);
  strike(p, v);
}

function clearance(p) {
  const v = new V3(p.dir, 0, rand(-0.3, 0.3)).normalize();
  const s = rand(24, 30) * (0.9 + 0.2 * (p.attr.strike - 40) / 60), th = rand(28, 36) * DEG;
  strike(p, new V3(v.x * Math.cos(th) * s, Math.sin(th) * s, v.z * Math.cos(th) * s));
}

function bestPass(p, desperate) {
  let best = null, bs = desperate ? -Infinity : 2;
  const maxD = p.isGK ? 60 : 38;
  const opps = opponents(p);
  for (const tm of teammates(p)) {
    if (tm.isGK) continue;
    const d = dist2D(tm.pos, p.pos);
    if (d < 6 || d > maxD) continue;
    const progress = (tm.pos.x - p.pos.x) * p.dir;
    let open = 12;
    for (const o of opps) open = Math.min(open, dist2D(o.pos, tm.pos));
    if (open < 3) continue;
    const s = progress * 0.25 + open * 0.6 - d * 0.05;
    if (s > bs) { bs = s; best = tm; }
  }
  return best;
}

function dispossess(c, tackler) {
  ball.carrier = null;
  c.pickupCooldown = 0.7;
  tackler.pickupCooldown = 0;
  const a = rand(0, Math.PI * 2);
  ball.pos.y = 0.9;
  ball.vel.set(Math.cos(a) * 3 + c.vel.x * 0.4, 2.5, Math.sin(a) * 3 + c.vel.z * 0.4);
  ball.lastTeam = tackler.team;
  sfx.hit(0.2);
  if (c === human) flash('HOOKED!', '', 0.8);
}

function predictBall() {
  const out = predictBall.v || (predictBall.v = new V3());
  if (ball.carrier) return out.copy(ball.carrier.pos);
  const p = ball.pos, v = ball.vel;
  let t = 0.4;
  if (p.y > 1.5 && (v.y > 0 || p.y > 2.5)) t = (v.y + Math.sqrt(v.y * v.y + 2 * G * Math.max(0, p.y - 1.5))) / G;
  t = Math.min(t, 3);
  return out.set(clamp(p.x + v.x * t, -HALF_L, HALF_L), 0, clamp(p.z + v.z * t, -HALF_W, HALF_W));
}

function updateBall(dt) {
  if (ball.carrier) {
    const c = ball.carrier;
    const rx = -c.facing.z, rz = c.facing.x;
    const moving = Math.hypot(c.vel.x, c.vel.z) > 1;
    const hop = moving ? Math.abs(Math.sin(game.time * 7)) * 0.35 : 0;
    ball.pos.set(c.pos.x + c.facing.x * 0.9 + rx * 0.28, 1.05 + hop, c.pos.z + c.facing.z * 0.9 + rz * 0.28);
    return;
  }
  const p = ball.pos, v = ball.vel;
  ball.prev.copy(p);
  v.y -= G * dt;
  v.multiplyScalar(1 - DRAG * dt);
  p.addScaledVector(v, dt);
  if (p.y < BALL_R) {
    p.y = BALL_R;
    if (v.y < -1.2) { v.y = -v.y * 0.45; v.x *= 0.8; v.z *= 0.8; if (v.y > 2) sfx.bounce(); }
    else v.y = 0;
  }
  if (p.y <= BALL_R + 0.001) { const f = Math.max(0, 1 - 1.6 * dt); v.x *= f; v.z *= f; }

  for (const s of [-1, 1]) {
    const gx = s * HALF_L;
    for (const pz of [-GOAL_HALF, GOAL_HALF]) {
      const dx = p.x - gx, dz = p.z - pz, d = Math.hypot(dx, dz), rr = BALL_R + 0.08;
      if (d < rr && d > 1e-6 && p.y < POST_H) {
        const nx = dx / d, nz = dz / d, vn = v.x * nx + v.z * nz;
        if (vn < 0) { v.x -= 1.7 * vn * nx; v.z -= 1.7 * vn * nz; sfx.post(); }
        p.x = gx + nx * rr; p.z = pz + nz * rr;
      }
    }
    if (Math.abs(p.z) < GOAL_HALF) {
      const dx = p.x - gx, dy = p.y - BAR_H, d = Math.hypot(dx, dy), rr = BALL_R + 0.07;
      if (d < rr && d > 1e-6) {
        const nx = dx / d, ny = dy / d, vn = v.x * nx + v.y * ny;
        if (vn < 0) { v.x -= 1.7 * vn * nx; v.y -= 1.7 * vn * ny; sfx.post(); }
        p.x = gx + nx * rr; p.y = BAR_H + ny * rr;
      }
    }
    // net stops the ball after a goal
    if (game.state === 'dead' && Math.abs(p.z) < GOAL_HALF && p.y < BAR_H && p.x * s > HALF_L + 2.0) {
      p.x = s * (HALF_L + 2.0); v.x *= -0.15; v.z *= 0.5;
    }
  }
  checkLines();
}

function checkLines() {
  if (game.state !== 'play') return;
  const p = ball.pos, q = ball.prev;
  for (const s of [-1, 1]) {
    const gx = s * HALF_L;
    if (q.x * s < HALF_L && p.x * s >= HALF_L) {
      const t = (gx - q.x) / (p.x - q.x);
      const y = q.y + (p.y - q.y) * t, z = q.z + (p.z - q.z) * t;
      onEndLine(s > 0 ? 0 : 1, y, z);
      return;
    }
  }
  if (Math.abs(p.z) > HALF_W) {
    const team = 1 - Math.max(0, ball.lastTeam);
    const x = clamp(p.x, -HALF_L + 2, HALF_L - 2), z = Math.sign(p.z) * (HALF_W - 0.3);
    endPlay('SIDELINE', `${TEAMS[team].name} cut`, 1.3, () => awardFree(team, x, z, false));
  }
}

function onEndLine(att, y, z) {
  const def = 1 - att;
  const who = TEAMS[att].name;
  if (Math.abs(z) < GOAL_HALF && y < BAR_H) {
    game.score[att].g++;
    celebrate(att, 3.2);
    endPlay('GOAL!', `${who} +3`, 3, () => puckOut(def));
    sfx.cheer(att === 0 ? 1.2 : 0.6);
    sfx.whistle();
  } else if (Math.abs(z) < GOAL_HALF && y < 40) {
    game.score[att].p++;
    celebrate(att, 2);
    endPlay('POINT!', `${who} +1`, 2.2, () => puckOut(def));
    sfx.cheer(att === 0 ? 0.8 : 0.4);
  } else if (ball.lastTeam === def) {
    const x = def === 1 ? HALF_L - 45 : -(HALF_L - 45);
    endPlay('65', `${who} free`, 1.8, () => awardFree(att, x, 0, true));
  } else {
    endPlay('WIDE', '', 1.6, () => puckOut(def));
    sfx.groan();
  }
}

function celebrate(team, dur) {
  for (const p of players) if (p.team === team) p.celebrate = dur + rand(0, 0.6);
}

function checkPickup() {
  if (ball.carrier || game.state !== 'play') return;
  let best = null, bd = Infinity;
  const speed = ball.vel.length();
  for (const p of players) {
    if (p.pickupCooldown > 0) continue;
    const hd = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);
    const reach = p.isGK ? 1.5 : 1.0;
    const maxH = p.isGK ? 2.45 : 2.6;
    if (hd < reach && ball.pos.y < maxH && hd < bd) { best = p; bd = hd; }
  }
  if (!best) return;
  if (best.isGK && speed > 16 && ball.lastTeam !== best.team) {
    if (best.saveRoll !== ball.shotId) {
      best.saveRoll = ball.shotId;
      best.saveOk = Math.random() < clamp(0.9 - (speed - 15) * 0.025 + (best.attr.keeping - 70) * 0.004, 0.3, 0.9);
    }
    if (!best.saveOk) return;
    flash('SAVE!', `${TEAMS[best.team].name} keeper`, 1.2);
    sfx.cheer(0.4);
  } else if (!best.isGK && speed > 24) {
    if (best.saveRoll !== ball.shotId) { best.saveRoll = ball.shotId; best.saveOk = Math.random() < 0.4; }
    if (!best.saveOk) return;
  }
  givePossession(best);
}

function aiTackles(dt) {
  const c = ball.carrier;
  if (!c || c.protect > 0 || game.state !== 'play') return;
  for (const p of players) {
    if (p.team === c.team || p === human) continue;
    if (dist2D(p.pos, c.pos) < 1.4) {
      p.tackleTimer -= dt;
      if (p.tackleTimer <= 0) {
        p.tackleTimer = rand(0.6, 1.2);
        p.swing = 0.001;
        if (Math.random() < (c === human ? 0.35 : 0.45) * (0.5 + p.attr.tackle / 100)) { dispossess(c, p); return; }
      }
    }
  }
}

function humanTackle() {
  const p = human;
  if (!p || p.swing > 0) return;
  p.swing = 0.001;
  const c = ball.carrier;
  if (c && c.team !== 0 && c.protect <= 0 && dist2D(c.pos, p.pos) < 2.0 && Math.random() < 0.55 * (0.6 + p.attr.tackle / 125)) dispossess(c, p);
  else if (!c && ball.pos.y < 2.8 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 1.6) {
    // flick a loose ball up into the hand
    p.pickupCooldown = 0;
    givePossession(p);
  }
}

// ---------------------------------------------------------------- human control
const keys = {};

function cameraBasis() {
  const f = new V3().subVectors(camLook, camera.position); f.y = 0;
  if (f.lengthSq() < 1e-6) f.set(1, 0, 0);
  f.normalize();
  return { f, r: new V3(-f.z, 0, f.x) };
}

function readInput() {
  const up = keys.KeyW || keys.ArrowUp, down = keys.KeyS || keys.ArrowDown;
  const left = keys.KeyA || keys.ArrowLeft, right = keys.KeyD || keys.ArrowRight;
  const { f, r } = cameraBasis();
  inputDir.set(0, 0, 0)
    .addScaledVector(f, (up ? 1 : 0) - (down ? 1 : 0))
    .addScaledVector(r, (right ? 1 : 0) - (left ? 1 : 0));
  if (inputDir.lengthSq() > 0) inputDir.normalize();
}

function humanDesired() {
  const p = human;
  const sprint = (keys.ShiftLeft || keys.ShiftRight) && !p.winded;
  let s = (sprint ? 9.2 : 7) * p.speedMul;
  if (ball.carrier === p) s *= 0.92;
  if (charging) s *= 0.55;
  return p.des.copy(inputDir).multiplyScalar(s);
}

function humanAim() {
  const p = human;
  const dir = inputDir.lengthSq() > 0 ? inputDir.clone() : p.facing.clone();
  dir.y = 0; dir.normalize();
  let onGoal = false, zt = 0;
  const dGoal = HALF_L - ball.pos.x;
  if (dir.x > 0.2 && dGoal > 0 && dGoal < 60) {
    const t = dGoal / dir.x;
    const zi = ball.pos.z + dir.z * t;
    if (Math.abs(zi) < 6 + dGoal * 0.08) {
      zt = clamp(zi, -2.4, 2.4);
      dir.set(dGoal, 0, zt - ball.pos.z).normalize();
      onGoal = true;
    }
  }
  return { dir, onGoal, zt };
}

function humanStrikeVel(kind, c) {
  const aim = humanAim();
  if (kind === 'loft') {
    const s = 14 + 22 * c, th = 24 * DEG;
    return new V3(aim.dir.x * Math.cos(th) * s, Math.sin(th) * s, aim.dir.z * Math.cos(th) * s);
  }
  const s = 16 + 20 * c;
  const dGoal = HALF_L - ball.pos.x;
  if (aim.onGoal && dGoal < 35) return velWithSpeed(ball.pos, new V3(HALF_L, 1.3, aim.zt), s);
  const th = 6 * DEG;
  return new V3(aim.dir.x * Math.cos(th) * s, Math.sin(th) * s, aim.dir.z * Math.cos(th) * s);
}

// Simulates a strike to preview where it lands / whether it scores.
function simulate(v0) {
  const p = ball.pos.clone(), v = v0.clone(), dt = 1 / 60;
  for (let i = 0; i < 360; i++) {
    const px = p.x;
    v.y -= G * dt; v.multiplyScalar(1 - DRAG * dt); p.addScaledVector(v, dt);
    if (px < HALF_L && p.x >= HALF_L) {
      if (Math.abs(p.z) < GOAL_HALF) return { land: p, result: p.y < BAR_H ? 'GOAL' : 'POINT' };
      return { land: p, result: 'WIDE' };
    }
    if (p.y <= 0) return { land: p, result: null };
  }
  return { land: p, result: null };
}

function humanRelease() {
  const kind = charging;
  charging = null;
  if (!human || ball.carrier !== human || game.state !== 'play') return;
  const v = humanStrikeVel(kind, charge);
  v.multiplyScalar(strikePower(human));
  rotateY(v, rand(-1, 1) * (1 - human.attr.strike / 100) * 0.05);
  strike(human, v);
}

function humanHandPass() {
  const p = human;
  if (!p || ball.carrier !== p || game.state !== 'play') return;
  const aim = inputDir.lengthSq() > 0 ? inputDir : p.facing;
  let best = null, bs = -Infinity;
  for (const tm of teammates(p)) {
    if (tm.isGK) continue;
    const dx = tm.pos.x - p.pos.x, dz = tm.pos.z - p.pos.z, d = Math.hypot(dx, dz);
    if (d < 3 || d > 32) continue;
    const cos = (dx * aim.x + dz * aim.z) / d;
    if (cos < 0.2) continue;
    const s = cos * 2 - d * 0.03;
    if (s > bs) { bs = s; best = tm; }
  }
  if (best) { passTo(p, best); setHuman(best); switchLock = 1.0; }
  else strike(p, new V3(aim.x * 9, 4, aim.z * 9));
}

window.addEventListener('keydown', (e) => {
  sfx.init();
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Enter' && (game.state === 'menu' || game.state === 'fulltime')) { startMatch(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'KeyC') { game.camMode = (game.camMode + 1) % 2; return; }
  if (e.code === 'KeyT') { game.autoSwitch = !game.autoSwitch; flash(game.autoSwitch ? 'AUTO-SWITCH ON' : 'AUTO-SWITCH OFF', '', 1); return; }
  if (e.code === 'Tab') { e.preventDefault(); if (game.state === 'play' && human) cycleHuman(e.shiftKey ? -1 : 1); return; }
  if (game.state !== 'play' || !human) return;
  if (e.code === 'KeyQ') switchHuman();
  else if (e.code === 'KeyE') humanHandPass();
  else if (e.code === 'Space' || e.code === 'KeyX') {
    if (ball.carrier === human) { charging = e.code === 'Space' ? 'loft' : 'drive'; charge = 0; }
    else if (e.code === 'Space') humanTackle();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if ((e.code === 'Space' && charging === 'loft') || (e.code === 'KeyX' && charging === 'drive')) humanRelease();
});
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; charging = null; });

// ---------------------------------------------------------------- flow
function planTeams() {
  const target = predictBall();
  for (let t = 0; t < 2; t++) {
    const plan = game.plan[t];
    plan.chasers.length = 0;
    if (game.state !== 'play') continue;
    const outfield = players.filter((p) => p.team === t && !p.isGK);
    if (!ball.carrier) {
      plan.mode = 'loose';
      plan.target.copy(target);
      outfield.sort((a, b) => dist2D(a.pos, target) - dist2D(b.pos, target));
      const n = dist2D(outfield[1].pos, target) < 12 ? 2 : 1;
      for (let i = 0; i < n; i++) if (outfield[i] !== human) plan.chasers.push(outfield[i]);
    } else if (ball.carrier.team !== t) {
      const c = ball.carrier;
      plan.mode = 'press';
      plan.target.set(c.pos.x + c.vel.x * 0.25, 0, c.pos.z + c.vel.z * 0.25);
      outfield.sort((a, b) => dist2D(a.pos, c.pos) - dist2D(b.pos, c.pos));
      const n = dist2D(outfield[1].pos, c.pos) < 14 ? 2 : 1;
      for (let i = 0; i < n; i++) if (outfield[i] !== human) plan.chasers.push(outfield[i]);
    }
  }
}

function separate() {
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 1e-4) {
      const push = (0.75 - d) / 2, nx = dx / d, nz = dz / d;
      a.pos.x -= nx * push; a.pos.z -= nz * push;
      b.pos.x += nx * push; b.pos.z += nz * push;
    }
  }
}

function resetPositions() {
  for (const p of players) {
    p.pos.copy(p.base); p.vel.set(0, 0, 0); p.facing.set(p.dir, 0, 0);
    p.holdTimer = 0; p.protect = 0; p.pickupCooldown = 0; p.swing = 0; p.freeShot = false;
    p.celebrate = 0; p.energy = Math.min(1, p.energy + 0.3);
  }
}

function throwIn() {
  resetPositions();
  for (const p of players) if (p.role === 'M') p.pos.set(-p.dir * 2.2, 0, p.base.z * 0.12);
  ball.carrier = null;
  ball.pos.set(0, 2.0, 0);
  ball.vel.set(0, 7.5, rand(-0.5, 0.5));
  ball.lastTeam = -1;
  human = null;
  setHuman(players.find((p) => p.team === 0 && p.role === 'M' && p.base.z < 0));
  game.state = 'play';
  sfx.whistle();
  flash('THROW IN', '', 1.2);
}

function startMatch() {
  sfx.init();
  game.score = [{ g: 0, p: 0 }, { g: 0, p: 0 }];
  game.clock = 0;
  document.getElementById('overlay').classList.add('hidden');
  throwIn();
}

function endPlay(main, sub, delay, then) {
  game.state = 'dead';
  game.deadTimer = delay;
  game.onDeadEnd = then;
  charging = null;
  flash(main, sub, delay);
}

function pushOpponents(team, x, z, r) {
  for (const o of players) {
    if (o.team === team) continue;
    const dx = o.pos.x - x, dz = o.pos.z - z, d = Math.hypot(dx, dz);
    if (d < r) {
      const nx = d > 1e-3 ? dx / d : -Math.sign(x || 1), nz = d > 1e-3 ? dz / d : 0;
      o.pos.x = clamp(x + nx * r, -HALF_L - 2, HALF_L + 2);
      o.pos.z = clamp(z + nz * r, -HALF_W - 1, HALF_W - 1);
    }
  }
}

function puckOut(team) {
  const k = keeperOf(team);
  k.pos.set(-k.dir * (HALF_L - 3), 0, 0);
  k.vel.set(0, 0, 0);
  pushOpponents(team, k.pos.x, 0, 14);
  ball.pos.set(k.pos.x, 1, 0);
  givePossession(k);
  k.holdTimer = 1.4;
  game.state = 'play';
}

function awardFree(team, x, z, freeShot) {
  const cand = players.filter((p) => p.team === team && !p.isGK)
    .sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z));
  const p = cand[0];
  p.pos.set(x, 0, z); p.vel.set(0, 0, 0);
  pushOpponents(team, x, z, 9);
  ball.pos.set(x, 1, z);
  givePossession(p);
  p.protect = p === human ? 2 : 30; // AI can't be tackled until the free is taken
  p.holdTimer = p === human ? 0 : 1.0;
  p.freeShot = freeShot;
  p.facing.set(p.dir, 0, 0);
  game.state = 'play';
  sfx.whistle();
}

function togglePause() {
  if (game.state === 'paused') {
    game.state = game.prevState;
    document.getElementById('overlay').classList.add('hidden');
  } else if (game.state === 'play' || game.state === 'dead') {
    game.prevState = game.state;
    game.state = 'paused';
    charging = null;
    showOverlay('PAUSED', 'Press P to resume', 'Resume (P)');
  }
}

function fullTime() {
  game.state = 'fulltime';
  charging = null;
  sfx.whistle(true);
  const [h, a] = game.score.map(total);
  const res = h > a ? `${TEAMS[0].name} WIN!` : h < a ? `${TEAMS[1].name} WIN` : 'A DRAW';
  showOverlay('FULL TIME', `${res} &nbsp; ${fmtScore(game.score[0])} to ${fmtScore(game.score[1])}`, 'Play again (Enter)');
}

function showOverlay(title, sub, btn) {
  const o = document.getElementById('overlay');
  o.querySelector('h1').innerHTML = title === 'PAUSED' || title === 'FULL TIME' ? title : 'HURLING <span>3D</span>';
  document.getElementById('overlaySub').innerHTML = sub;
  document.getElementById('startBtn').textContent = btn;
  o.classList.remove('hidden');
}

document.getElementById('startBtn').addEventListener('click', () => {
  sfx.init();
  if (game.state === 'paused') togglePause();
  else startMatch();
});

// ---------------------------------------------------------------- HUD
const $ = (id) => document.getElementById(id);
const hud = {
  scoreHome: $('scoreHome'), scoreAway: $('scoreAway'), clock: $('clock'),
  msg: $('message'), msgMain: $('msgMain'), msgSub: $('msgSub'),
  power: $('power'), powerFill: $('powerFill'), powerLabel: $('powerLabel'),
  minimap: $('minimap'), card: $('card'), cardBody: $('cardBody'), stamina: $('staminaFill'),
  edgeHuman: $('edgeHuman'), edgeBall: $('edgeBall'),
};
$('nameHome').textContent = TEAMS[0].name;
$('nameAway').textContent = TEAMS[1].name;
let msgTimer = 0;

function total(s) { return s.g * 3 + s.p; }
function fmtScore(s) { return `${s.g}-${String(s.p).padStart(2, '0')}`; }
function flash(main, sub, dur) {
  hud.msgMain.textContent = main;
  hud.msgSub.textContent = sub;
  hud.msg.classList.add('show');
  msgTimer = dur;
}

const mm = hud.minimap.getContext('2d');
function drawMinimap() {
  const cw = hud.minimap.width, ch = hud.minimap.height, pad = 6;
  const sx = (cw - pad * 2) / L, sz = (ch - pad * 2) / W;
  const X = (x) => pad + (x + HALF_L) * sx, Z = (z) => pad + (z + HALF_W) * sz;
  mm.fillStyle = '#2f7a2b'; mm.fillRect(0, 0, cw, ch);
  mm.strokeStyle = 'rgba(255,255,255,.7)'; mm.lineWidth = 1;
  mm.strokeRect(X(-HALF_L), Z(-HALF_W), L * sx, W * sz);
  mm.beginPath(); mm.moveTo(X(0), Z(-HALF_W)); mm.lineTo(X(0), Z(HALF_W)); mm.stroke();
  mm.fillStyle = '#fff';
  for (const s of [-1, 1]) mm.fillRect(X(s * HALF_L) - 1.5, Z(-GOAL_HALF), 3, GOAL_HALF * 2 * sz);
  for (const p of players) {
    mm.fillStyle = p.isGK ? (p.team ? '#f29a1f' : '#1b8a3a') : TEAMS[p.team].css;
    mm.beginPath(); mm.arc(X(p.pos.x), Z(p.pos.z), p === human ? 4.5 : 3.2, 0, Math.PI * 2); mm.fill();
    if (p === human) { mm.strokeStyle = '#ffd60a'; mm.lineWidth = 2; mm.stroke(); }
  }
  mm.fillStyle = '#fff';
  mm.beginPath(); mm.arc(X(ball.pos.x), Z(ball.pos.z), 2.5, 0, Math.PI * 2); mm.fill();
}

let lastHud = '';
function updateHUD(dt) {
  const key = `${fmtScore(game.score[0])}|${fmtScore(game.score[1])}|${Math.ceil(MATCH_SECONDS - game.clock)}`;
  if (key !== lastHud) {
    lastHud = key;
    hud.scoreHome.textContent = `${fmtScore(game.score[0])} (${total(game.score[0])})`;
    hud.scoreAway.textContent = `${fmtScore(game.score[1])} (${total(game.score[1])})`;
    const rem = Math.max(0, Math.ceil(MATCH_SECONDS - game.clock));
    hud.clock.textContent = `${String(Math.floor(rem / 60)).padStart(2, '0')}:${String(rem % 60).padStart(2, '0')}`;
  }
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) hud.msg.classList.remove('show'); }

  const showAim = human && ball.carrier === human && game.state === 'play';
  aimArrow.visible = showAim;
  landMarker.visible = false;
  if (showAim) {
    const kind = charging || 'loft';
    const v = humanStrikeVel(kind, charging ? charge : 0.5);
    aimArrow.position.set(human.pos.x, 0.03, human.pos.z);
    aimArrow.rotation.y = Math.atan2(-v.z, v.x);
    const sc = charging ? 0.8 + charge * 0.8 : 0.8;
    aimArrow.scale.set(sc, 1, 1);
    if (charging) {
      const sim = simulate(v);
      landMarker.visible = true;
      landMarker.position.set(sim.land.x, 0.04, sim.land.z);
      hud.power.classList.add('show');
      hud.powerFill.style.width = `${charge * 100}%`;
      const res = sim.result === 'POINT' ? ' — on target: POINT ✓' : sim.result === 'GOAL' ? ' — on target: GOAL ✓' : sim.result === 'WIDE' ? ' — wide' : '';
      hud.powerLabel.textContent = (kind === 'loft' ? 'LOFT' : 'DRIVE') + res;
    } else hud.power.classList.remove('show');
  } else hud.power.classList.remove('show');

  if (human !== cardFor) renderCard();
  if (human) { hud.stamina.style.width = `${human.energy * 100}%`; hud.stamina.classList.toggle('low', human.winded || human.energy < 0.25); }
  drawMinimap();
}

let cardFor = null;
function renderCard() {
  cardFor = human;
  hud.card.classList.toggle('show', !!human);
  if (!human) return;
  const p = human;
  const rows = ATTR_LABELS.map(([k, n]) => `<div class="row"><span>${n}</span><div class="bar"><i style="width:${p.attr[k]}%"></i></div><b>${p.attr[k]}</b></div>`).join('');
  hud.cardBody.innerHTML = `<div class="who"><span class="num" style="background:${TEAMS[0].css}">${p.number}</span><span class="nm">${p.name}</span><span class="role">${{ B: 'Back', M: 'Midfield', F: 'Forward', GK: 'Keeper' }[p.role]}</span></div>${rows}`;
}

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  // follow the ball, leading slightly in the direction it's travelling
  const focus = new V3(ball.pos.x, 0, ball.pos.z);
  if (!ball.carrier) {
    const lx = clamp(ball.vel.x * 0.3, -10, 10), lz = clamp(ball.vel.z * 0.3, -6, 6);
    focus.x = clamp(focus.x + lx, -HALF_L, HALF_L);
    focus.z = clamp(focus.z + lz, -HALF_W, HALF_W);
  }
  const high = clamp((ball.pos.y - 3) / 12, 0, 1);
  let pos, look;
  if (game.state === 'menu') {
    const a = game.time * 0.08;
    pos = new V3(Math.cos(a) * 75, 32, Math.sin(a) * 60);
    look = new V3(0, 0, 0);
  } else if (game.camMode === 0) {
    pos = new V3(focus.x - 17 - high * 5, 10.5 + high * 4, focus.z * 0.85);
    look = new V3(focus.x + 9, 0, focus.z * 0.95);
  } else {
    pos = new V3(focus.x * 0.9, 30, HALF_W + 26);
    look = new V3(focus.x, 0, focus.z * 0.5);
  }
  const k = 1 - Math.exp(-5 * dt);
  camera.position.lerp(pos, k);
  camLook.lerp(look, k);
  camera.lookAt(camLook);

  sun.target.position.set(camLook.x, 0, camLook.z);
  sun.position.set(camLook.x + 30, 70, camLook.z + 25);
}

// ---------------------------------------------------------------- main loop
function step(dt) {
  if (game.state === 'play') {
    game.clock += dt;
    if (game.clock >= MATCH_SECONDS) { fullTime(); return; }
  }
  if (charging) {
    if (ball.carrier !== human) charging = null;
    else charge = Math.min(1, charge + dt / 0.9);
  }
  planTeams();
  autoSwitch(dt);
  for (const p of players) p.update(dt);
  separate();
  const sub = 4;
  for (let i = 0; i < sub; i++) updateBall(dt / sub);
  checkPickup();
  aiTackles(dt);
  if (game.state === 'dead') {
    game.deadTimer -= dt;
    if (game.deadTimer <= 0) { const f = game.onDeadEnd; game.onDeadEnd = null; if (f) f(); }
  }
}

const TRAIL_N = 28;
const trailPts = [];
const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: TRAIL_N }, () => new V3())), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
trail.frustumCulled = false;
scene.add(trail);
const seam = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 0.99, 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: 0x5a3a1c }));
ball.mesh.add(seam);
const spinAxis = new V3();

function updateTrail() {
  const fast = !ball.carrier && ball.vel.length() > 10 && game.state !== 'menu';
  if (fast) trailPts.push(ball.pos.clone()); else if (trailPts.length) trailPts.shift();
  while (trailPts.length > TRAIL_N) trailPts.shift();
  const attr = trail.geometry.attributes.position;
  for (let i = 0; i < TRAIL_N; i++) {
    const q = trailPts[Math.min(i, trailPts.length - 1)] || ball.pos;
    attr.setXYZ(i, q.x, q.y, q.z);
  }
  attr.needsUpdate = true;
  trail.visible = trailPts.length > 1;
}

const _p = new V3();
function edgeMarker(el, pos, label) {
  _p.copy(pos).applyMatrix4(camera.matrixWorldInverse);
  const behind = _p.z > 0;
  _p.copy(pos).project(camera);
  let x = _p.x, y = _p.y;
  if (behind) { x = -x; y = -y; }
  const w = window.innerWidth, h = window.innerHeight;
  const mx = 1 - 120 / w, my = 1 - 190 / h;
  const inside = !behind && Math.abs(x) < mx && Math.abs(y) < my;
  el.classList.toggle('show', !inside);
  if (inside) return;
  if (Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3) y = -1;
  const sc = Math.max(Math.abs(x) / mx, Math.abs(y) / my);
  x /= sc; y /= sc;
  el.style.transform = `translate(${((x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-y * 0.5 + 0.5) * h).toFixed(1)}px)`;
  el.firstElementChild.style.transform = `rotate(${Math.atan2(-y * h, x * w)}rad)`;
  if (label) el.lastElementChild.textContent = label;
}

function syncVisuals(dt) {
  ball.mesh.position.copy(ball.pos);
  if (!ball.carrier && game.state !== 'menu') {
    const sp = ball.vel.length();
    if (sp > 0.5) {
      spinAxis.set(ball.vel.z, 0, -ball.vel.x).normalize();
      ball.mesh.rotateOnWorldAxis(spinAxis, (sp * dt) / BALL_R * 0.5);
    }
  }
  updateTrail();
  const playing = !!human && game.state !== 'menu' && game.state !== 'fulltime';
  if (playing) {
    edgeMarker(hud.edgeHuman, _hp.set(human.pos.x, 1.2, human.pos.z), `${human.name} · ${Math.round(dist2D(human.pos, ball.pos))}m from ball`);
  } else hud.edgeHuman.classList.remove('show');
  if (game.state !== 'menu') edgeMarker(hud.edgeBall, ball.pos, ''); else hud.edgeBall.classList.remove('show');
  ballShadowMarker.position.set(ball.pos.x, 0.02, ball.pos.z);
  ballShadowMarker.visible = ball.pos.y > 1.2 && !ball.carrier;
  const hv = !!human && game.state !== 'menu';
  humanRing.visible = humanMarker.visible = hv;
  if (hv) {
    humanRing.position.set(human.pos.x, 0.03, human.pos.z);
    humanMarker.position.set(human.pos.x, 2.5 + Math.sin(game.time * 4) * 0.08, human.pos.z);
  }
}

const _hp = new V3();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state !== 'paused') {
    game.time += dt;
    readInput();
    if (game.state === 'play' || game.state === 'dead') step(dt);
    for (const p of players) p.animate(dt);
  }
  updateCamera(dt);
  camera.updateMatrixWorld();
  syncVisuals(dt);
  updateHUD(dt);
  renderer.render(scene, camera);
}

resetPositions();
ball.pos.set(0, BALL_R, 0);
requestAnimationFrame(frame);

// exposed for debugging in the browser console
window.__hurling = { game, ball, players, get human() { return human; } };
