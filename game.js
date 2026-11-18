/* Drift Zone v2 — circuit urbain, course IA, multijoueur en ligne, nitro, garage */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapAng = a => Math.atan2(Math.sin(a), Math.cos(a));
const fmtInt = n => Math.round(n).toLocaleString('fr-FR');
const fmtTime = t => { if (!isFinite(t) || t <= 0) return '--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const TEST = /[?&]test/.test(location.search);
const FORCE_MOBILE = /[?&]mobile/.test(location.search);
const isTouch = FORCE_MOBILE || ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
if (isTouch) document.body.classList.add('has-touch');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ======================= Profil & sauvegarde ======================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('dz2_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dz2_' + k, JSON.stringify(v)); } catch (e) {} }
};
const prof = {
  name: store.get('name', 'Pilote' + (100 + Math.floor(Math.random() * 900))),
  credits: store.get('credits', 2500),
  paint: store.get('paint', 0), rim: store.get('rim', 0),
  upg: Object.assign({ engine: 0, tires: 0, nitro: 0 }, store.get('upg', {})),
  mode: store.get('mode', 0), diff: store.get('diff', 1), laps: store.get('laps', 3),
  qual: store.get('qual', isTouch ? 0 : 1), muted: store.get('muted', false), cam: store.get('cam', 0),
};
const LOW = prof.qual === 0;
const EXT = window.DZ_ASSET_EXT || 'gltf.json';
function saveProf() { for (const k of ['name', 'credits', 'paint', 'rim', 'upg', 'mode', 'diff', 'laps', 'qual', 'muted', 'cam']) store.set(k, prof[k]); }
function addCredits(n) { n = Math.max(0, Math.round(n)); prof.credits += n; store.set('credits', prof.credits); return n; }

const MODES = [
  { id: 'race', ic: '🏁', name: 'Course', desc: 'Affronte 5 pilotes IA sur le circuit urbain.' },
  { id: 'drift', ic: '💨', name: 'Drift libre', desc: 'Enchaîne les combos, sans limite de temps.' },
  { id: 'chrono', ic: '⏱️', name: 'Défi drift 90 s', desc: 'Le plus gros score de drift en 90 secondes.' },
  { id: 'time', ic: '👻', name: 'Contre-la-montre', desc: 'Bats ton meilleur tour face à ton fantôme.' },
  { id: 'online', ic: '🌐', name: 'En ligne', desc: 'Roule et fais la course avec d’autres joueurs.', badge: 'MULTI' },
];
const PAINTS = [0xc8102e, 0x1d4ed8, 0xf5f5f5, 0x111214, 0x9aa3ad, 0x16a34a, 0xf97316, 0x7c3aed, 0xfacc15, 0x0ea5b7];
const RIMS = [{ n: 'Argent', c: 0xe2e5ea }, { n: 'Noir', c: 0x1d1e21 }, { n: 'Or', c: 0xc9a227 }, { n: 'Bronze', c: 0x8a5a2b }];
const UPGRADES = [
  { k: 'engine', name: 'Moteur', desc: 'Plus de puissance et de vitesse de pointe' },
  { k: 'tires', name: 'Pneus', desc: 'Plus d’adhérence dans les virages' },
  { k: 'nitro', name: 'Nitro', desc: 'Dure plus longtemps, se recharge plus vite' },
];
const UPG_COST = [1500, 3500, 7000];
const AI_DRIVERS = [
  { name: 'Kenji', c: 0x1d4ed8 }, { name: 'Lina', c: 0xf5f5f5 }, { name: 'Marco', c: 0x16a34a },
  { name: 'Sofia', c: 0xfacc15 }, { name: 'Diego', c: 0x7c3aed }, { name: 'Aya', c: 0xf97316 }
];
const DIFF = [{ aLat: 9.2, power: 0.9, brake: 15 }, { aLat: 11, power: 0.98, brake: 17 }, { aLat: 12.4, power: 1.05, brake: 19 }];
const mode = () => MODES[prof.mode].id;

function makeSpec(m, u) {
  return {
    power: 15.5 * (1 + 0.09 * u.engine), maxSpeed: 55 * (1 + 0.05 * u.engine),
    grip: 7.2 * (1 + 0.06 * u.tires), driftGrip: (m === 'race' || m === 'time') ? 1.8 : 1.45,
    steer: 2.2, latMax: 12.5 + 1.2 * u.tires,
    nitroDrain: 0.3 / (1 + 0.35 * u.nitro), nitroGain: 1 + 0.35 * u.nitro, nitroPower: 9
  };
}

/* ======================= Rendu ======================= */
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
const PR_MAX = Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : 2), PR_MIN = LOW ? 0.55 : 0.75;
let pixelRatio = LOW ? Math.min(PR_MAX, 1) : PR_MAX;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
function applyQuality() {
  const hi = prof.qual === 1;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const was = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = hi;
  if (was !== hi) scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
}
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = LOW ? new THREE.Fog(0xd99a80, 150, 620) : new THREE.Fog(0xd99a80, 220, 950);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, LOW ? 900 : 3000);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x1f2d5c) }, mid: { value: new THREE.Color(0x8d5b8f) }, bot: { value: new THREE.Color(0xffa46e) }, sunDir: { value: new THREE.Vector3(-0.55, 0.17, -0.82).normalize() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(bot, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.2, 0.75, h)); if(h<0.0) c = mix(bot, vec3(0.25,0.22,0.24), smoothstep(0.0,-0.2,h)); float s = max(dot(vP, sunDir), 0.0); c += vec3(1.0,0.75,0.45)*pow(s, 400.0)*2.5 + vec3(1.0,0.55,0.3)*pow(s, 8.0)*0.35; gl_FragColor = vec4(c,1.0); }'
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(LOW ? 850 : 2000, 32, 16), skyMat);
sky.renderOrder = -1; scene.add(sky);
// Reflets réalistes : cube map du ciel calculée sur canvas (pas de rendu hors-écran)
{
  const S = 64, top = new THREE.Color(0x1f2d5c), mid = new THREE.Color(0x8d5b8f), bot = new THREE.Color(0xffa46e), gnd = new THREE.Color(0x3a3a40);
  const sunD = new THREE.Vector3(-0.55, 0.17, -0.82).normalize(), c = new THREE.Color(), d = new THREE.Vector3();
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const dirs = [(u, v) => d.set(1, -v, -u), (u, v) => d.set(-1, -v, u), (u, v) => d.set(u, 1, v), (u, v) => d.set(u, -1, -v), (u, v) => d.set(u, -v, 1), (u, v) => d.set(-u, -v, -1)];
  const faces = dirs.map(f => {
    const cv = document.createElement('canvas'); cv.width = cv.height = S; const ctx = cv.getContext('2d'); const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      f((x + 0.5) / S * 2 - 1, (y + 0.5) / S * 2 - 1).normalize();
      const h = d.y;
      if (h < 0) c.copy(bot).lerp(gnd, ss(0, -0.15, h));
      else { c.copy(bot).lerp(mid, ss(0, 0.22, h)); c.lerp(top, ss(0.2, 0.75, h)); }
      const sdot = Math.max(d.dot(sunD), 0); const glow = Math.pow(sdot, 8) * 0.5 + Math.pow(sdot, 200) * 3;
      const k = (y * S + x) * 4;
      img.data[k] = clamp((c.r + glow) * 255, 0, 255); img.data[k + 1] = clamp((c.g + glow * 0.7) * 255, 0, 255); img.data[k + 2] = clamp((c.b + glow * 0.45) * 255, 0, 255); img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return cv;
  });
  const cube = new THREE.CubeTexture(faces); cube.encoding = THREE.sRGBEncoding; cube.needsUpdate = true;
  scene.environment = cube;
}
scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x5a4a3c, LOW ? 0.7 : 0.45));
const sun = new THREE.DirectionalLight(0xffd6ae, 1.7);
sun.castShadow = true;
const SH = 55;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 320 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(70, 110, 110);
applyQuality();
sun.shadow.mapSize.set(prof.qual ? 2048 : 1024, prof.qual ? 2048 : 1024);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function noise(ctx, w, h, base, amp, n) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amp;
    ctx.fillStyle = v > 0 ? 'rgba(255,255,255,' + v + ')' : 'rgba(0,0,0,' + (-v) + ')';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

/* ======================= Circuit ======================= */
function surf(o) { if (!LOW) return new THREE.MeshStandardMaterial(o); const l = { map: o.map, color: o.color, side: o.side }; for (const k of ['color', 'map', 'side']) if (l[k] === undefined) delete l[k]; return new THREE.MeshLambertMaterial(l); }
const ROAD_W = 20, HALF = ROAD_W / 2, CURB_W = 1.4, WALL = HALF + 6;
const CTRL = [[214,0],[182,26],[155,45],[128,59],[103,69],[87,83],[81,112],[75,164],[50,229],[0,279],[-64,292],[-117,258],[-141,196],[-139,132],[-131,88],[-139,64],[-166,48],[-200,28],[-222,0],[-228,-32],[-223,-65],[-215,-99],[-202,-135],[-175,-167],[-131,-182],[-78,-171],[-31,-142],[0,-116],[25,-114],[63,-139],[126,-175],[204,-195],[270,-181],[299,-138],[288,-84],[253,-36]];
const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
const N = 1400, TRACK_LEN = curve.getLength(), SEG = TRACK_LEN / N;
const PX = new Float32Array(N), PZ = new Float32Array(N), TX = new Float32Array(N), TZ = new Float32Array(N), NX = new Float32Array(N), NZ = new Float32Array(N), K = new Float32Array(N);
{
  const sp = curve.getSpacedPoints(N); sp.pop();
  for (let i = 0; i < N; i++) { PX[i] = sp[i].x; PZ[i] = sp[i].z; }
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N;
    let tx = PX[b] - PX[a], tz = PZ[b] - PZ[a]; const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l; TX[i] = tx; TZ[i] = tz; NX[i] = tz; NZ[i] = -tx;
  }
  const W = 7;
  for (let i = 0; i < N; i++) {
    const a = (i - W + N) % N, b = (i + W) % N;
    K[i] = wrapAng(Math.atan2(TX[b], TZ[b]) - Math.atan2(TX[a], TZ[a])) / (2 * W * SEG);
  }
}
const idxWrap = i => ((i % N) + N) % N;
function nearest(x, z, hint) {
  let best = 0, bd = Infinity;
  const scan = (from, count) => {
    for (let k = 0; k < count; k++) {
      const i = idxWrap(from + k); const dx = x - PX[i], dz = z - PZ[i]; const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
  };
  if (hint >= 0) scan(hint - 45, 91); else scan(0, N);
  if (bd > 900) scan(0, N);
  const lat = (x - PX[best]) * NX[best] + (z - PZ[best]) * NZ[best];
  return { i: best, lat, d: Math.sqrt(bd) };
}
// côté extérieur de la boucle
const POLY = []; for (let i = 0; i < N; i += 7) POLY.push([PX[i], PZ[i]]);
function insideLoop(x, z) {
  let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, zi] = POLY[i], [xj, zj] = POLY[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const OUT_SIGN = insideLoop(PX[0] + NX[0] * 40, PZ[0] + NZ[0] * 40) ? -1 : 1; // multiplie N pour aller vers l'extérieur

function ribbon(o1, o2, y, mat, vScale, uScale) {
  const pos = [], uv = [], idx = [];
  let dist = 0;
  for (let k = 0; k <= N; k++) {
    const i = k % N;
    if (k) dist += SEG;
    pos.push(PX[i] + NX[i] * o1, y, PZ[i] + NZ[i] * o1, PX[i] + NX[i] * o2, y, PZ[i] + NZ[i] * o2);
    const v = dist / vScale; uv.push(0, v, uScale || 1, v);
    if (k < N) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
const asphaltTex = canvasTex(512, 512, (c, w, h) => {
  noise(c, w, h, '#383a40', 0.2, 26000);
  const gr = c.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ececec'; c.fillRect(9, 0, 8, h); c.fillRect(w - 17, 0, 8, h);
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(w / 2 - 3, 0, 6, h * 0.45);
}, true);
const curbTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#d62828'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#f2f2f2'; c.fillRect(0, h / 2, w, h / 2); }, true);
const runoffTex = canvasTex(256, 256, (c, w, h) => noise(c, w, h, '#55585e', 0.2, 12000), true);
const walkTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, '#a9a8a2', 0.16, 9000);
  c.strokeStyle = 'rgba(60,60,60,0.35)'; c.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); }
}, true);
const groundTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, '#4a4c50', 0.18, 14000);
  c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 2);
}, true);
groundTex.repeat.set(260, 260);
ribbon(-HALF, HALF, 0.05, surf({ map: asphaltTex, roughness: 0.9, envMapIntensity: 0.4 }), ROAD_W);
const curbMat = surf({ map: curbTex, roughness: 0.7, envMapIntensity: 0.4 });
ribbon(HALF, HALF + CURB_W, 0.07, curbMat, 6); ribbon(-HALF - CURB_W, -HALF, 0.07, curbMat, 6);
const runMat = surf({ map: runoffTex, roughness: 1, envMapIntensity: 0.3 });
ribbon(HALF + CURB_W, WALL + 0.8, 0.04, runMat, 14); ribbon(-WALL - 0.8, -HALF - CURB_W, 0.04, runMat, 14);
const walkMat = surf({ map: walkTex, roughness: 0.95, envMapIntensity: 0.3 });
ribbon(WALL + 0.8, WALL + 7, 0.06, walkMat, 7, 1); ribbon(-WALL - 7, -WALL - 0.8, 0.06, walkMat, 7, 1);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(3400, 3400), surf({ map: groundTex, roughness: 1, envMapIntensity: 0.25 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// Instancing découpé par zones de la carte : seules les zones visibles sont dessinées
function addInstanced(geo, mat, mats, colors, opt) {
  opt = opt || {};
  const CELL = opt.cell || 140, cells = new Map(), v = new THREE.Vector3();
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const c0 = geo.boundingSphere.center, r0 = geo.boundingSphere.radius;
  mats.forEach((m, i) => { v.copy(c0).applyMatrix4(m); const k = Math.floor(v.x / CELL) + ',' + Math.floor(v.z / CELL); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
  const out = [];
  for (const list of cells.values()) {
    const g = new THREE.BufferGeometry();
    for (const n in geo.attributes) g.setAttribute(n, geo.attributes[n]);
    if (geo.index) g.setIndex(geo.index);
    const im = new THREE.InstancedMesh(g, mat, list.length);
    const box = new THREE.Box3(); let ms = 1;
    list.forEach((idx, j) => { const m = mats[idx]; im.setMatrixAt(j, m); if (colors) im.setColorAt(j, colors[idx]); v.copy(c0).applyMatrix4(m); box.expandByPoint(v); ms = Math.max(ms, m.getMaxScaleOnAxis()); });
    const sph = new THREE.Sphere(); box.getBoundingSphere(sph); sph.radius += r0 * ms; g.boundingSphere = sph;
    im.castShadow = !!opt.cast; im.receiveShadow = !!opt.receive;
    scene.add(im); out.push(im);
  }
  return out;
}
// Murs de pneus
{
  const list = [];
  for (const side of [1, -1]) {
    let acc = 0, lx = null, lz = null;
    for (let i = 0; i < N; i++) {
      const x = PX[i] + NX[i] * WALL * side, z = PZ[i] + NZ[i] * WALL * side;
      if (lx !== null) acc += Math.hypot(x - lx, z - lz);
      lx = x; lz = z;
      if (acc >= 1.25) { acc = 0; list.push([x, z]); }
    }
  }
  const geo = LOW ? new THREE.CylinderGeometry(0.62, 0.62, 1, 7, 1, true) : new THREE.CylinderGeometry(0.62, 0.62, 0.5, 12);
  const mats = [], cols = [];
  list.forEach(([x, z], k) => {
    const levels = LOW ? 1 : 2;
    for (let l = 0; l < levels; l++) {
      mats.push(new THREE.Matrix4().makeTranslation(x, LOW ? 0.5 : 0.25 + l * 0.5, z));
      cols.push(new THREE.Color(Math.floor(k / 3) % 2 === 0 ? (l ? 0xf2f2f2 : 0x1a1a1a) : (l ? 0x1a1a1a : 0xd62828)));
    }
  });
  addInstanced(geo, surf({ roughness: 0.85, envMapIntensity: 0.3, side: THREE.DoubleSide }), mats, cols, { cast: !LOW, receive: !LOW, cell: 180 });
}
// Ligne de départ + portique
{
  const ang = Math.atan2(TX[0], TZ[0]);
  const ck = canvasTex(256, 32, (c, w, h) => { const s = 16; for (let x = 0; x < w / s; x++) for (let y = 0; y < h / s; y++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * s, y * s, s, s); } });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2.2), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.8 }));
  line.rotation.set(-Math.PI / 2, 0, ang); line.position.set(PX[0], 0.075, PZ[0]); line.receiveShadow = true; scene.add(line);
  // cases de grille
  const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
  for (let k = 0; k < 6; k++) {
    const s = gridSlot(k); const g = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.25), gm);
    g.rotation.set(-Math.PI / 2, 0, Math.atan2(TX[s.i], TZ[s.i])); g.position.set(s.x + TX[s.i] * 2.8, 0.075, s.z + TZ[s.i] * 2.8); scene.add(g);
  }
  const g = new THREE.Group(); g.position.set(PX[0], 0, PZ[0]); g.rotation.y = ang;
  const pm = new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.6, roughness: 0.4 });
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9, 0.9), pm); p.position.set(s * (HALF + 2.5), 4.5, 0); p.castShadow = true; g.add(p); }
  const bannerTex = canvasTex(1024, 128, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ff3d5a'); gr.addColorStop(1, '#ff7a45'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = 'italic 86px "Russo One", Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DRIFT ZONE', w / 2, h / 2 + 4);
  });
  const bm = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.35 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6, 2, 0.6), [pm, pm, pm, pm, bm, bm]);
  beam.position.y = 8.4; beam.castShadow = true; g.add(beam);
  scene.add(g);
}
function gridSlot(k) {
  const row = Math.floor(k / 2), col = k % 2;
  const back = 9 + row * 9 + col * 3;
  const i = idxWrap(-Math.round(back / SEG));
  const lat = (col ? -1 : 1) * 4.2;
  return { i, x: PX[i] + NX[i] * lat, z: PZ[i] + NZ[i] * lat, h: Math.atan2(TX[i], TZ[i]) };
}

/* ======================= Chargement des assets ======================= */
const ASSETS = { audiHi: null, audiLo: null, audiXlo: null, city: null, fans: null };
function loadAll(onDone) {
  const J = EXT === 'glb' ? 0.75 : 1;
  const files = [LOW ? null : ['audiHi', 'assets/audi_hi.' + EXT, 4.2 * J], ['audiLo', 'assets/audi_lo.' + EXT, 1.5 * J], LOW ? ['audiXlo', 'assets/audi_xlo.' + EXT, 0.88 * J] : null, ['city', 'assets/city.' + EXT, 3.9 * J], ['fans', 'assets/fans' + (LOW ? '_lo.' : '.') + EXT, (LOW ? 0.17 : 0.72) * J]].filter(Boolean);
  const total = files.reduce((a, f) => a + f[2], 0);
  const prog = {};
  const upd = () => { const v = Object.values(prog).reduce((a, b) => a + b, 0) / total; $('loadBar').firstElementChild.style.width = (v * 100).toFixed(0) + '%'; };
  let left = files.length;
  if (!THREE.GLTFLoader) { onDone(); return; }
  const loader = new THREE.GLTFLoader();
  files.forEach(([key, url, mb]) => {
    loader.load(url, g => { ASSETS[key] = g.scene; prog[key] = mb; upd(); if (--left === 0) onDone(); },
      x => { if (x.total) prog[key] = mb * x.loaded / x.total; upd(); },
      e => { console.warn('asset', url, e); prog[key] = mb; upd(); if (--left === 0) onDone(); });
  });
}

/* ======================= Voitures (modèles) ======================= */
const std = o => new THREE.MeshStandardMaterial(o);
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const CM = {
  carbon: std({ color: 0x1c1c1f, metalness: 0.45, roughness: 0.35 }),
  blackMetal: std({ color: 0x101113, metalness: 0.7, roughness: 0.35 }),
  blackMatte: std({ color: 0x131315, roughness: 0.85 }),
  grey: std({ color: 0x45484d, roughness: 0.55, metalness: 0.3 }),
  window: LOW ? std({ color: 0x080b10, metalness: 0.3, roughness: 0.05 }) : new THREE.MeshPhysicalMaterial({ color: 0x080b10, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02 }),
  clear: std({ color: 0xffffff, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.2, depthWrite: false }),
  tailGlass: std({ color: 0x3a0a0e, metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }),
  chrome: std({ color: 0xe6e6e6, metalness: 1, roughness: 0.1 }),
  headGrey: std({ color: 0x8b8f95, metalness: 0.85, roughness: 0.3 }),
  headEmit: std({ color: 0xffffff, emissive: 0xf2f6ff, emissiveIntensity: 2.4 }),
  red: std({ color: 0xb3121b, metalness: 0.4, roughness: 0.4 }),
  tire: std({ color: 0x141414, roughness: 0.93, envMapIntensity: 0.3 }),
  disk: std({ color: 0x6b6e72, metalness: 0.9, roughness: 0.45 }),
};
const rimMats = {};
const rimMat = hex => rimMats[hex] || (rimMats[hex] = std({ color: lin(hex), metalness: 0.85, roughness: 0.3 }));
function mapMat(name, paint, rim, tail) {
  if (name.includes('Paint')) return paint;
  if (name.startsWith('Tail lights')) return tail;
  if (name === 'Glass Tail') return CM.tailGlass;
  if (name === 'Black Glass') return CM.window;
  if (name.startsWith('Glass')) return CM.clear;
  if (name.includes('Emission') || name.includes('Emissiom')) return CM.headEmit;
  if (name === 'Glossy Headlights' || name === 'Glossy Mirror') return CM.chrome;
  if (name === 'HeadLights_Grey') return CM.headGrey;
  if (name === 'Red metal') return CM.red;
  if (name === 'Tire') return CM.tire;
  if (name.startsWith('Rims')) return rim;
  if (name === 'Brake Disk') return CM.disk;
  if (name === 'Matte Grey') return CM.grey;
  if (name === 'Black Matte') return CM.blackMatte;
  if (name === 'Carbon Fibre') return CM.carbon;
  return CM.blackMetal;
}
// Fusionne des morceaux de maillage (moins d'appels de dessin = plus fluide)
const _mv = new THREE.Vector3(), _mn = new THREE.Vector3(), _m3 = new THREE.Matrix3();
function mergeParts(parts, colorOf) {
  let nV = 0, nI = 0;
  for (const { geo } of parts) { nV += geo.attributes.position.count; nI += geo.index ? geo.index.count : geo.attributes.position.count; }
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = colorOf ? new Float32Array(nV * 3) : null, idx = new Uint32Array(nI);
  let vo = 0, io = 0; const ranges = [];
  for (const { geo, m, mat } of parts) {
    const P = geo.attributes.position, Nn = geo.attributes.normal; _m3.getNormalMatrix(m);
    const c = colorOf ? colorOf(mat) : null;
    for (let i = 0; i < P.count; i++) {
      _mv.fromBufferAttribute(P, i).applyMatrix4(m); pos[(vo + i) * 3] = _mv.x; pos[(vo + i) * 3 + 1] = _mv.y; pos[(vo + i) * 3 + 2] = _mv.z;
      if (Nn) { _mn.fromBufferAttribute(Nn, i).applyMatrix3(_m3).normalize(); nor[(vo + i) * 3] = _mn.x; nor[(vo + i) * 3 + 1] = _mn.y; nor[(vo + i) * 3 + 2] = _mn.z; }
      if (c) { col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b; }
    }
    if (geo.index) for (let k = 0; k < geo.index.count; k++) idx[io + k] = geo.index.getX(k) + vo;
    else for (let k = 0; k < P.count; k++) idx[io + k] = vo + k;
    ranges.push({ mat, start: vo, count: P.count });
    vo += P.count; io += geo.index ? geo.index.count : P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
  g.userData.ranges = ranges;
  return g;
}
// regroupe tous les maillages sous `node` (repère de `node`) : par matériau, ou en un seul maillage à couleurs de sommets
function compactNode(node, bake, skip) {
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const meshes = []; node.traverse(o => { if (o.isMesh && !(skip && skip(o))) meshes.push(o); });
  const out = [];
  if (bake) {
    const parts = meshes.filter(o => !o.material.transparent).map(o => ({ geo: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), mat: o.material }));
    if (parts.length) out.push(new THREE.Mesh(mergeParts(parts, mat => (mat.emissiveIntensity > 1 ? new THREE.Color(1, 1, 1) : mat.color)), bakedMat));
  } else {
    const buckets = new Map();
    for (const o of meshes) { const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push({ geo: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), mat: o.material }); }
    for (const list of buckets.values()) out.push(new THREE.Mesh(mergeParts(list), list[0].mat));
  }
  for (const o of meshes) if (o.parent) o.parent.remove(o);
  for (const o of out) node.add(o);
  return out;
}
const bakedMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x101216 });
function setCarPaint(model, hex) {
  const c = lin(hex);
  model.paint.color.copy(c);
  if (model.bakedBody) {
    const g = model.bakedBody.geometry, col = g.attributes.color;
    const k = c.clone().multiplyScalar(1.7); k.r = Math.min(1, k.r + 0.03); k.g = Math.min(1, k.g + 0.03); k.b = Math.min(1, k.b + 0.03);
    for (const r of g.userData.ranges) if (r.mat === model.paint) for (let i = r.start; i < r.start + r.count; i++) col.setXYZ(i, k.r, k.g, k.b);
    col.needsUpdate = true;
  }
}
const flameMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const flameGeo = new THREE.ConeGeometry(0.13, 1.0, 10, 1, true); flameGeo.rotateX(-Math.PI / 2); flameGeo.translate(0, 0, -0.5);
const blobTex = canvasTex(64, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.setTransform(1, 0, 0, 2, 0, 0); c.fillStyle = g; c.fillRect(0, 0, w, h / 2); });
function buildCar(lod, paintHex, rimHex, ghost) {
  const src = lod === 'hi' ? (ASSETS.audiHi || ASSETS.audiLo || ASSETS.audiXlo) : (LOW ? (ASSETS.audiXlo || ASSETS.audiLo) : (ASSETS.audiLo || ASSETS.audiHi));
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = LOW ? std({ color: lin(paintHex), metalness: 0.35, roughness: 0.32 }) : new THREE.MeshPhysicalMaterial({ color: lin(paintHex), metalness: 0.3, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  const tail = std({ color: 0x2a0000, emissive: 0xff1a1a, emissiveIntensity: 0.8 });
  const rim = rimMat(rimHex);
  const wheels = [], rimMeshes = []; let bakedBody = null;
  const ghostMat = ghost ? new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.28, depthWrite: false }) : null;
  if (src) {
    const sc = src.clone(true);
    sc.traverse(o => { if (o.isMesh) { o.material = ghost ? ghostMat : mapMat(o.material.name || '', paint, rim, tail); o.castShadow = !ghost; o.receiveShadow = false; } });
    for (const key of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
      const node = sc.getObjectByName(key);
      if (!node) continue;
      const pivot = new THREE.Group(); pivot.position.copy(node.position); node.position.set(0, 0, 0);
      node.parent.remove(node); pivot.add(node); root.add(pivot);
      wheels.push({ pivot, spin: node, front: key[6] === 'F' });
    }
    body.add(sc);
    {
      const bake = LOW && lod !== 'hi' && !ghost;
      const bodyMeshes = compactNode(sc, bake);
      for (const w of wheels) compactNode(w.spin, bake);
      if (bake) bakedBody = bodyMeshes[0];
      body.traverse(o => { if (o.isMesh) { o.castShadow = !ghost; if (o.material === rim) rimMeshes.push(o); } });
      for (const w of wheels) w.spin.traverse(o => { if (o.isMesh) { o.castShadow = !ghost; if (o.material === rim) rimMeshes.push(o); } });
    }
  } else {
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; body.add(o); return o; };
    add(new THREE.BoxGeometry(2, 0.8, 4.8), ghost ? ghostMat : paint, 0, 0.75, 0);
    add(new THREE.BoxGeometry(1.8, 0.6, 2.6), ghost ? ghostMat : CM.window, 0, 1.4, -0.3);
    for (const [x, z] of [[0.9, 1.5], [-0.9, 1.5], [0.9, -1.5], [-0.9, -1.5]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.4, z); root.add(pivot);
      const g = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14); g.rotateZ(Math.PI / 2);
      const w = new THREE.Mesh(g, ghost ? ghostMat : CM.tire); pivot.add(w); wheels.push({ pivot, spin: w, front: z > 0 });
    }
  }
  const flames = [];
  if (!ghost) for (const s of [1, -1]) { const f = new THREE.Mesh(flameGeo, flameMat); f.position.set(s * 0.52, 0.42, -2.45); f.visible = false; body.add(f); flames.push(f); }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3, 6.2), new THREE.MeshBasicMaterial({ map: blobTex, color: 0, transparent: true, opacity: ghost ? 0.15 : 0.6, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.09; root.add(blob);
  const model = { root, body, paint, tail, wheels, flames, rimMeshes, bakedBody };
  if (bakedBody) setCarPaint(model, paintHex);
  return model;
}

/* ======================= Ville ======================= */
const fansData = [];
let fanMeshes = null;
function buildCity() {
  const city = ASSETS.city;
  const rnd = (() => { let s = 20261118; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const occ = [];
  const free = (x, z, r, minTrack) => {
    for (const o of occ) if (Math.hypot(x - o.x, z - o.z) < r + o.r) return false;
    const nn = nearest(x, z, -1);
    return nn.d - r >= (minTrack === undefined ? WALL + 7.2 : minTrack);
  };
  const toward = (i, side) => Math.atan2(-NX[i] * side, -NZ[i] * side);
  const inst = {};
  const put = (key, x, z, rot, s, y) => { (inst[key] = inst[key] || []).push([x, y || 0, z, rot, s || 1]); };
  const sizes = {};
  if (city) {
    city.children.forEach(o => {
      const b = new THREE.Box3().setFromObject(o); const sz = b.getSize(new THREE.Vector3());
      sizes[o.name] = { w: sz.x, d: sz.z, h: sz.y };
    });
  }
  const has = k => !!sizes[k];
  // 1) Fans dans les virages et devant le stade
  const corners = [];
  const byK = [...Array(N).keys()].sort((a, b) => Math.abs(K[b]) - Math.abs(K[a]));
  for (const i of byK) { if (corners.length >= 7) break; if (corners.every(c => Math.min(Math.abs(c - i), N - Math.abs(c - i)) * SEG > 140)) corners.push(i); }
  const maxFans = LOW ? 40 : 140;
  const fanSpots = corners.map(i => ({ i, side: K[i] > 0 ? -1 : 1, n: 14 }));
  fanSpots.push({ i: idxWrap(-60), side: OUT_SIGN, n: 22 }, { i: idxWrap(-25), side: -OUT_SIGN, n: 12 });
  for (const sp of fanSpots) {
    for (let k = 0; k < sp.n && fansData.length < maxFans; k++) {
      const row = k % 2, along = (Math.floor(k / 2) - sp.n / 4) * 1.6 + (rnd() - 0.5) * 0.6;
      const i = idxWrap(sp.i + Math.round(along / SEG));
      const off = (WALL + 1.6 + row * 1.5 + rnd() * 0.4) * sp.side;
      const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
      fansData.push({ x, z, rot: toward(i, sp.side) + (rnd() - 0.5) * 0.5, phase: rnd() * 6.28, pose: 0, excite: 0, kind: rnd() < 0.5 ? 1 : 2, jumpy: 0.6 + rnd() * 0.6 });
      occ.push({ x, z, r: 0.6 });
    }
  }
  if (!city) return;
  // 2) Stade le long de la ligne droite de départ
  if (has('B_Stadium')) {
    const i = idxWrap(-70), s = sizes.B_Stadium, side = OUT_SIGN;
    const off = (WALL + 9 + s.w / 2) * side;
    const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
    put('B_Stadium', x, z, Math.atan2(TX[i], TZ[i]), 1); occ.push({ x, z, r: Math.hypot(s.w, s.d) / 2 * 0.95 });
  }
  // 3) Lampadaires et panneaux
  for (let d = 0; d < TRACK_LEN; d += 38) {
    const i = Math.floor(d / SEG) % N;
    for (const side of [1, -1]) {
      const off = (WALL + 2.2) * side; const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
      if (!free(x, z, 0.6, WALL + 1)) continue;
      put('P_StreetLight', x, z, Math.atan2(-NZ[i] * side, -NX[i] * side) + Math.PI, 1); occ.push({ x, z, r: 0.8 });
    }
  }
  corners.slice(0, 6).forEach((ci, k) => {
    const side = K[ci] > 0 ? -1 : 1, i = idxWrap(ci + (k % 2 ? 40 : -40));
    const key = k % 2 ? 'P_BillBoardlarge' : 'P_BillBoardmedium';
    const off = (WALL + 7.5) * side, x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
    if (has(key) && free(x, z, 3, WALL + 4)) { put(key, x, z, toward(i, side), 1.5); occ.push({ x, z, r: 4 }); }
  });
  // cônes à la corde des virages
  corners.forEach(ci => {
    const side = K[ci] > 0 ? 1 : -1;
    for (let k = -3; k <= 3; k++) { const i = idxWrap(ci + Math.round(k * 4 / SEG)); const off = (HALF + CURB_W + 0.8) * side; put('P_Trafficcone', PX[i] + NX[i] * off, PZ[i] + NZ[i] * off, rnd() * 6, 1); }
  });
  // 4) Bâtiments : 1er rang (boutiques), 2e rang (immeubles), horizon (gratte-ciel)
  const SHOPS = ['B_AutoService', 'B_Bakery', 'B_Bar', 'B_BooksShop', 'B_ChickenShop', 'B_Clothing', 'B_CoffeeShop', 'B_DrugStore', 'B_FastFood', 'B_FruitsShop', 'B_GasStation', 'B_GiftShop', 'B_MusicStore', 'B_Pizza', 'B_Restaurant', 'B_ShoesShop', 'B_SuperMarket', 'B_House01', 'B_House02', 'B_House03', 'B_House04'].filter(has);
  const TALL = ['B_big', 'B_small', 'B_Residential', 'B_Factory', 'B_Residential', 'B_big'].filter(has);
  const VEH = ['V_Car1', 'V_Car2', 'V_Car3', 'V_SUV1', 'V_SUV2', 'V_SUV3', 'V_Taxi', 'V_PoliceCar', 'V_PickupTruck1', 'V_PickupTruck2', 'V_Ambulance', 'V_Bus1'].filter(has);
  const ring = (keys, stepM, extra, scaleR) => {
    for (let d = 0; d < TRACK_LEN; d += stepM) {
      const i = Math.floor(d / SEG) % N;
      for (const side of [1, -1]) {
        let placed = false;
        for (let tries = 0; tries < 4 && !placed; tries++) {
          const key = pick(keys), s = sizes[key], sc = scaleR ? lerp(scaleR[0], scaleR[1], rnd()) : 1;
          const off = (WALL + 7.5 + extra + rnd() * 3 + s.d * sc / 2) * side;
          const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
          const r = Math.max(s.w, s.d) * sc / 2 * 0.92;
          if (free(x, z, r)) { put(key, x, z, toward(i, side) + (rnd() < 0.15 ? Math.PI / 2 : 0) * 0, sc); occ.push({ x, z, r }); placed = true; }
        }
        if (!placed && VEH.length && rnd() < 0.5) {
          const key = pick(VEH), off = (WALL + 10 + extra) * side, x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
          if (free(x, z, 3)) { put(key, x, z, Math.atan2(TX[i], TZ[i]) - Math.PI / 2 + (rnd() < 0.5 ? Math.PI : 0), 0.78); occ.push({ x, z, r: 3 }); }
        }
      }
    }
  };
  if (LOW) { SHOPS.splice(11); TALL.splice(3); }
  ring(SHOPS, 9, 0, null);
  ring(TALL, LOW ? 30 : 18, 22, [1, 1.3]);
  if (!LOW) ring(TALL, 30, 55, [1.2, 1.8]);
  // horizon lointain
  for (let k = 0; k < (LOW ? 0 : 70); k++) {
    const a = rnd() * Math.PI * 2, r = 380 + rnd() * 260;
    const x = Math.cos(a) * r * 1.1, z = Math.sin(a) * r + 50, key = pick(TALL), s = sizes[key], sc = 1.5 + rnd() * 1.4;
    if (free(x, z, Math.max(s.w, s.d) * sc / 2)) { put(key, x, z, rnd() * 6.28, sc); occ.push({ x, z, r: Math.max(s.w, s.d) * sc / 2 }); }
  }
  // 5) Arbres et végétation
  const TREES = ['N_FirTree', 'N_BigTree', 'N_CubeTree', 'N_FirTree'].filter(has);
  const maxTrees = LOW ? 80 : 260; let nt = 0;
  for (let k = 0; k < 4000 && nt < maxTrees; k++) {
    const x = (rnd() - 0.5) * 760, z = (rnd() - 0.5) * 700 + 50;
    if (!free(x, z, 2.6)) continue;
    const key = pick(TREES); put(key, x, z, rnd() * 6.28, 0.9 + rnd() * 0.7); occ.push({ x, z, r: 2.2 }); nt++;
    if (rnd() < 0.4 && has('N_Bush01')) { const bx = x + (rnd() - 0.5) * 6, bz = z + (rnd() - 0.5) * 6; if (free(bx, bz, 1)) put(rnd() < 0.5 ? 'N_Bush01' : 'N_Bush02', bx, bz, rnd() * 6, 1); }
  }
  // création des InstancedMesh (un appel de rendu par type d'objet)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const key in inst) {
    const src = city.getObjectByName(key); if (!src) continue;
    const meshes = []; src.updateMatrixWorld(true);
    src.traverse(o => { if (o.isMesh) meshes.push(o); });
    const rootInv = new THREE.Matrix4().copy(src.matrixWorld).invert();
    for (const me of meshes) {
      const local = new THREE.Matrix4().multiplyMatrices(rootInv, me.matrixWorld);
      if (LOW && me.material && !me.material.isMeshLambertMaterial) { const o = me.material; me.material = new THREE.MeshLambertMaterial({ map: o.map, color: o.color }); }
      const mats = inst[key].map(([x, y, z, rot, sc]) => { q.setFromAxisAngle(Y, rot); p.set(x, y, z); s3.set(sc, sc, sc); return new THREE.Matrix4().compose(p, q, s3).multiply(local); });
      const big = key.startsWith('B_');
      addInstanced(me.geometry, me.material, mats, null, { cast: !LOW, receive: big && !LOW, cell: big ? 300 : 1e6 });
      if (me.material) { me.material.envMapIntensity = 0.35; }
    }
  }
}
function buildFans() {
  const src = ASSETS.fans; if (!src || !fansData.length) return;
  const poses = ['Fan_idle', 'Fan_cheer', 'Fan_pump'].map(n => src.getObjectByName(n)).filter(Boolean);
  if (poses.length < 3) return;
  const n = fansData.length;
  const skin = new Float32Array(n), jacket = new THREE.Color();
  const JK = [0xff3d5a, 0xffffff, 0x1d4ed8, 0xffb703, 0x22c55e, 0x111111, 0x9b5de5, 0xf97316, 0x0ea5b7];
  for (let k = 0; k < n; k++) skin[k] = Math.random();
  fanMeshes = poses.map(src => {
    let me = null; src.traverse(o => { if (o.isMesh && !me) me = o; });
    const g = me.geometry.clone();
    if (g.attributes.uv) { g.setAttribute('fmask', g.attributes.uv); g.deleteAttribute('uv'); }
    else g.setAttribute('fmask', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.setAttribute('skinTone', new THREE.InstancedBufferAttribute(new Float32Array(skin), 1));
    const mat = LOW ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, envMapIntensity: 0.4 });
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 fmask;\nattribute float skinTone;')
        .replace('#include <color_vertex>', [
          'vColor = vec3(1.0);',
          '#ifdef USE_COLOR', 'vColor *= color.rgb;', '#endif',
          '#ifdef USE_INSTANCING_COLOR', 'vColor = mix(vColor, vColor * instanceColor.rgb, step(0.5, fmask.x));', '#endif',
          'vec3 sk = mix(vec3(0.86,0.55,0.38), vec3(0.16,0.08,0.04), skinTone);',
          'vColor = mix(vColor, sk, step(0.5, 1.0 - fmask.y));'].join('\n'));
    };
    const im = new THREE.InstancedMesh(g, mat, n);
    im.userData.skin = skin;
    for (let k = 0; k < n; k++) im.setColorAt(k, jacket.setHex(JK[k % JK.length]));
    im.castShadow = true; im.frustumCulled = false;
    scene.add(im); return im;
  });
  updateFans(0, 0);
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(1, 1, 1), _Y = new THREE.Vector3(0, 1, 0);
let fanT = 0;
let fanSkip = 0;
const fanCount = [0, 0, 0], _fc = new THREE.Color(), FAN_JK = [0xff3d5a, 0xffffff, 0x1d4ed8, 0xffb703, 0x22c55e, 0x111111, 0x9b5de5, 0xf97316, 0x0ea5b7];
function updateFans(dt, time) {
  if (!fanMeshes) return;
  fanT += dt;
  if (LOW && (fanSkip++ & 1)) return;
  const pc = player;
  fanCount[0] = fanCount[1] = fanCount[2] = 0;
  fansData.forEach((f, k) => {
    if (f.skin === undefined) f.skin = Math.random();
    let near = 0;
    if (pc && (state === 'play' || state === 'finish' || state === 'results')) {
      const d = Math.hypot(pc.x - f.x, pc.z - f.z);
      near = d < 45 ? 1 : 0;
      if (near && pc.drifting) near = 2;
    }
    if (state === 'menu') near = Math.sin(time * 0.3 + f.phase) > 0.85 ? 1 : 0;
    f.excite = Math.max(near ? 1.6 : 0, f.excite - dt);
    const ex = f.excite > 0;
    const pose = ex ? (Math.sin(fanT * 3 + f.phase) > 0 ? f.kind : (f.kind === 1 ? 2 : 1)) : 0;
    const y = ex ? Math.abs(Math.sin(fanT * 7 * f.jumpy + f.phase)) * 0.28 : 0;
    const rot = f.rot + (ex ? 0 : Math.sin(fanT * 0.8 + f.phase) * 0.15);
    _fq.setFromAxisAngle(_Y, rot); _fp.set(f.x, y + 0.06, f.z); _fm.compose(_fp, _fq, _fs);
    const im = fanMeshes[pose], j = fanCount[pose]++;
    im.setMatrixAt(j, _fm);
    im.setColorAt(j, _fc.setHex(FAN_JK[k % FAN_JK.length])); im.geometry.attributes.skinTone.array[j] = f.skin;
  });
  for (let p = 0; p < 3; p++) { const m = fanMeshes[p]; m.count = fanCount[p]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.geometry.attributes.skinTone.needsUpdate = true; }
}

/* ======================= Effets : fumée, traces ======================= */
const smokeTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(240,240,240,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const SMOKE_N = LOW ? 90 : 200, smoke = [];
// fumée : un seul nuage de points (1 appel de dessin pour toute la fumée)
const smokeGeo = new THREE.BufferGeometry();
const sPos = new Float32Array(SMOKE_N * 3).fill(-9999), sSize = new Float32Array(SMOKE_N), sAlpha = new Float32Array(SMOKE_N), sTint = new Float32Array(SMOKE_N * 3).fill(0.88);
smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
smokeGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1));
smokeGeo.setAttribute('tint', new THREE.BufferAttribute(sTint, 3));
const smokeMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: smokeTex }, scale: { value: 300 } },
  vertexShader: 'attribute float size; attribute float alpha; attribute vec3 tint; uniform float scale; varying float vA; varying vec3 vC; void main(){ vA = alpha; vC = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * scale / max(-mv.z, 0.1), 900.0); gl_Position = projectionMatrix * mv; }',
  fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a * vA < 0.01) discard; gl_FragColor = vec4(vC, t.a * vA); }',
  transparent: true, depthWrite: false
});
const smokePts = new THREE.Points(smokeGeo, smokeMat); smokePts.frustumCulled = false; scene.add(smokePts);
for (let i = 0; i < SMOKE_N; i++) smoke.push({ on: false, life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, base: 0.3 });
let smokeIdx = 0;
function spawnSmoke(x, z, vx, vz, intensity, dirt) {
  const k = smokeIdx, p = smoke[k]; smokeIdx = (smokeIdx + 1) % SMOKE_N;
  p.on = true; p.life = 0; p.max = 1.2 + Math.random() * 1.3 * intensity;
  p.vx = vx * 0.15 + (Math.random() - 0.5) * 1.5; p.vz = vz * 0.15 + (Math.random() - 0.5) * 1.5; p.vy = 0.6 + Math.random() * 0.8;
  p.size = 1.3 + Math.random() * 0.8; p.x = x; p.y = 0.45; p.z = z; p.base = 0.3 + 0.3 * intensity;
  const c = dirt ? [0.61, 0.52, 0.38] : [0.89, 0.89, 0.89]; sTint.set(c, k * 3);
  smokeGeo.attributes.tint.needsUpdate = true;
}
function updateSmoke(dt) {
  smokeMat.uniforms.scale.value = camera.projectionMatrix.elements[5] * renderer.domElement.height / 2;
  let any = false;
  for (let k = 0; k < SMOKE_N; k++) {
    const p = smoke[k];
    if (!p.on) continue;
    any = true;
    p.life += dt; const t = p.life / p.max;
    if (t >= 1) { p.on = false; sAlpha[k] = 0; sPos[k * 3 + 1] = -9999; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.97; p.vz *= 0.97;
    sPos[k * 3] = p.x; sPos[k * 3 + 1] = p.y; sPos[k * 3 + 2] = p.z;
    sSize[k] = p.size + t * 6;
    sAlpha[k] = p.base * (1 - t) * Math.min(1, t * 8);
  }
  if (any || updateSmoke.was) { smokeGeo.attributes.position.needsUpdate = true; smokeGeo.attributes.size.needsUpdate = true; smokeGeo.attributes.alpha.needsUpdate = true; }
  updateSmoke.was = any;
}
function clearSmoke() { for (let k = 0; k < SMOKE_N; k++) { smoke[k].on = false; sAlpha[k] = 0; sPos[k * 3 + 1] = -9999; } updateSmoke.was = true; }
const SKID_MAX = LOW ? 2500 : 6000;
const skidPos = new Float32Array(SKID_MAX * 12).fill(-1000);
const skidGeo = new THREE.BufferGeometry();
skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
{ const idx = new Uint32Array(SKID_MAX * 6); for (let q = 0; q < SKID_MAX; q++) { const a = q * 4; idx.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], q * 6); } skidGeo.setIndex(new THREE.BufferAttribute(idx, 1)); }
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x0d0d0d, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }));
skidMesh.frustumCulled = false; scene.add(skidMesh);
let skidQ = 0, skidDirty = false;
function addSkid(c, w, x, z, sx, sz) {
  const hw = 0.17, L = [x + sx * hw, z + sz * hw], R = [x - sx * hw, z - sz * hw];
  const last = c.skidLast[w];
  if (last && Math.hypot(L[0] - last[0][0], L[1] - last[0][1]) < 4) {
    skidPos.set([last[0][0], 0.09, last[0][1], last[1][0], 0.09, last[1][1], L[0], 0.09, L[1], R[0], 0.09, R[1]], skidQ * 12);
    skidQ = (skidQ + 1) % SKID_MAX; skidDirty = true;
  }
  c.skidLast[w] = [L, R];
}
function clearSkids() { skidPos.fill(-1000); skidGeo.attributes.position.needsUpdate = true; }

/* ======================= Audio ======================= */
const audio = { ctx: null };
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); audio.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = prof.muted ? 0 : 0.5; master.connect(ctx.destination); audio.master = master;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 1.5;
    const eg = ctx.createGain(); eg.gain.value = 0; lp.connect(eg); eg.connect(master);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.connect(lp);
    const o2 = ctx.createOscillator(); o2.type = 'square'; const g2 = ctx.createGain(); g2.gain.value = 0.35; o2.connect(g2); g2.connect(lp);
    o1.start(); o2.start();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, f, q) => { const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(master); src.start(); return { bp, g }; };
    const scr = mk('bandpass', 1150, 7), nit = mk('bandpass', 2400, 0.8), wind = mk('lowpass', 500, 0.5);
    Object.assign(audio, { o1, o2, lp, eg, scr, nit, wind, noise: buf });
    ctx.resume().catch(() => {});
  } catch (e) { audio.ctx = null; }
}
function setMuted(m) {
  prof.muted = m; store.set('muted', m); $('btnMute').textContent = m ? '🔇' : '🔊';
  if (audio.master) audio.master.gain.setTargetAtTime(m ? 0 : 0.5, audio.ctx.currentTime, 0.05);
  renderOptions();
}
function blip(f, dur, vol) {
  if (!audio.ctx) return;
  try { const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(vol || 0.15, audio.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur); o.connect(g); g.connect(audio.master); o.start(); o.stop(audio.ctx.currentTime + dur + 0.05); } catch (e) {}
}
function crashSound(p) {
  if (!audio.ctx) return;
  try { const ctx = audio.ctx, s = ctx.createBufferSource(); s.buffer = audio.noise; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = ctx.createGain(); g.gain.setValueAtTime(clamp(p, 0.15, 1) * 0.9, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35); s.connect(f); f.connect(g); g.connect(audio.master); s.start(); s.stop(ctx.currentTime + 0.4); } catch (e) {}
}
const GEARS = [0, 9, 17, 26, 36, 48, 999];
function updateAudio(c, inp, screech, active) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime, rpm = c ? c.rpm : 0;
  audio.o1.frequency.setTargetAtTime(38 + rpm * 175, t, 0.03); audio.o2.frequency.setTargetAtTime((38 + rpm * 175) * 0.5, t, 0.03);
  audio.lp.frequency.setTargetAtTime(600 + (inp.thr ? 1600 : 300) + rpm * 900, t, 0.05);
  audio.eg.gain.setTargetAtTime(active ? 0.06 + (inp.thr ? 0.08 : 0.02) : 0, t, 0.08);
  audio.scr.g.gain.setTargetAtTime(active ? screech * 0.2 : 0, t, 0.05);
  audio.scr.bp.frequency.setTargetAtTime(950 + screech * 450, t, 0.1);
  audio.nit.g.gain.setTargetAtTime(active && c && c.nitroOn ? 0.16 : 0, t, 0.06);
  audio.wind.g.gain.setTargetAtTime(active && c ? clamp(c.speed / 60, 0, 1) * 0.12 : 0, t, 0.2);
}

/* ======================= Entrées ======================= */
const keys = {};
const touch = { left: false, right: false, gas: false, brake: false, hb: false, nitro: false };
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play' || state === 'countdown') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state !== 'play' && state !== 'countdown') return;
  if (e.code === 'KeyR' && state === 'play') resetToTrack(player, true);
  if (e.code === 'KeyC') cycleCam();
  if (e.code === 'KeyM') setMuted(!prof.muted);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play' && mode() !== 'online') pauseGame(); });
function bindTouch(id, key) {
  const el = $(id);
  const on = e => { e.preventDefault(); touch[key] = true; el.classList.add('on'); initAudio(); };
  const off = e => { e.preventDefault(); touch[key] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
window.addEventListener('message', e => { if (e.origin !== location.origin || !e.data || e.data.dz !== 'autogas') return; touch.autogas = !!e.data.on; });
bindTouch('tLeft', 'left'); bindTouch('tRight', 'right'); bindTouch('tGas', 'gas'); bindTouch('tBrake', 'brake'); bindTouch('tHb', 'hb'); bindTouch('tNitro', 'nitro');
let padStart = false;
function readInput() {
  const k = keys;
  let thr = (k.KeyW || k.ArrowUp || touch.gas || touch.autogas) ? 1 : 0;
  let brk = (k.KeyS || k.ArrowDown || touch.brake) ? 1 : 0;
  let steer = ((k.KeyA || k.ArrowLeft || touch.left) ? 1 : 0) - ((k.KeyD || k.ArrowRight || touch.right) ? 1 : 0);
  let hb = (k.Space || touch.hb) ? 1 : 0;
  let nitro = (k.ShiftLeft || k.ShiftRight || k.KeyN || touch.nitro) ? 1 : 0;
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] || 0; if (Math.abs(ax) > 0.12) steer = -ax;
      const rt = p.buttons[7] ? p.buttons[7].value : 0, lt = p.buttons[6] ? p.buttons[6].value : 0;
      if (rt > 0.05) thr = Math.max(thr, rt); if (lt > 0.05) brk = Math.max(brk, lt);
      if (p.buttons[0] && p.buttons[0].pressed) hb = 1;
      if (p.buttons[2] && p.buttons[2].pressed) nitro = 1;
      const st = p.buttons[9] && p.buttons[9].pressed;
      if (st && !padStart && state === 'play') setTimeout(pauseGame, 0);
      padStart = st;
    }
  } catch (e) {}
  return { thr, brk, steer: clamp(steer, -1, 1), hb, nitro };
}

/* ======================= Physique ======================= */
let carSeq = 0;
function newCar(o) {
  return Object.assign({
    id: ++carSeq, name: 'Pilote', color: 0xc8102e, isPlayer: false, isAI: false, spec: makeSpec('race', { engine: 0, tires: 0, nitro: 0 }),
    x: 0, z: 0, h: 0, vx: 0, vz: 0, w: 0, steer: 0, idx: 0, lat: 0, off: false, drifting: false, slip: 0, speed: 0, vF: 0,
    lap: 0, cp: false, lapStart: 0, lapTimes: [], bestLap: Infinity, finished: false, finishTime: 0, prog: 0,
    nitro: 0.35, nitroOn: false, crash: 0, rpm: 0, gear: 1, wheelRot: 0, rearRot: 0, skidLast: [null, null], boost: 1, stuck: 0, frozen: false,
    model: null, ai: null
  }, o);
}
function placeCar(c, i, lat, h) {
  i = idxWrap(i);
  c.x = PX[i] + NX[i] * (lat || 0); c.z = PZ[i] + NZ[i] * (lat || 0); c.h = h === undefined ? Math.atan2(TX[i], TZ[i]) : h;
  c.vx = c.vz = c.w = c.steer = 0; c.idx = i; c.drifting = false; c.slip = 0; c.speed = 0; c.vF = 0; c.nitroOn = false;
  c.skidLast[0] = c.skidLast[1] = null;
}
function physicsStep(c, inp, dt) {
  const sp = c.spec;
  c.steer += (inp.steer - c.steer) * Math.min(1, dt * (c.drifting ? 6 : 9));
  const fx = Math.sin(c.h), fz = Math.cos(c.h), sx = Math.cos(c.h), sz = -Math.sin(c.h);
  let vF = c.vx * fx + c.vz * fz, vS = c.vx * sx + c.vz * sz;
  const speed = Math.hypot(vF, vS);
  const slip = Math.atan2(vS, Math.max(Math.abs(vF), 1.5)), absSlip = Math.abs(slip);
  const off = c.off;
  const nitroOn = !!inp.nitro && c.nitro > 0.01 && vF > 2;
  c.nitroOn = nitroOn;
  if (nitroOn) c.nitro = Math.max(0, c.nitro - dt * sp.nitroDrain);
  const vmax = sp.maxSpeed * (nitroOn ? 1.22 : 1) * c.boost;
  let acc = 0;
  if (inp.thr > 0) {
    if (vF < -1) acc += 22 * inp.thr;
    else acc += sp.power * c.boost * inp.thr * Math.max(0, 1 - Math.max(vF, 0) / vmax) * (off ? 0.55 : 1) * (c.drifting ? 0.8 : 1);
  }
  if (nitroOn) acc += sp.nitroPower * Math.max(0, 1 - Math.max(vF, 0) / vmax);
  if (inp.brk > 0) { if (vF > 1) acc -= 28 * inp.brk; else if (vF > -11) acc -= sp.power * 0.55 * inp.brk; }
  vF += acc * dt;
  if (inp.hb) { const d = Math.min(Math.abs(vF), 7 * dt); vF -= Math.sign(vF) * d; }
  vF -= (vF * (off ? 1.1 : 0.06) + vF * Math.abs(vF) * 0.0011) * dt;
  if (!inp.thr && !inp.brk && Math.abs(vF) < 0.3) vF *= 0.9;
  if (!c.drifting) { if ((inp.hb && speed > 7) || (absSlip > 0.2 && speed > 9)) c.drifting = true; }
  else if (absSlip < 0.07 || speed < 4) c.drifting = false;
  let grip = sp.grip;
  if (c.drifting) grip = sp.driftGrip * (inp.thr ? 1 : 1.8) * (1 + Math.max(0, 0.25 - absSlip) * 4);
  if (inp.hb) grip = Math.min(grip, 0.75);
  if (off) grip *= 0.75;
  const vS0 = vS; vS *= Math.exp(-grip * dt);
  const removed = Math.abs(vS0 - vS);
  if (c.drifting && vF > 0 && vF < sp.maxSpeed * 0.8) vF += removed * (inp.thr ? 0.4 : 0.12);
  const dir = vF >= -0.5 ? 1 : -1;
  let targetW = c.steer * sp.steer * Math.min(1, speed / 6) * dir;
  if (!c.drifting) {
    targetW /= (1 + Math.max(0, speed - 18) * 0.035);
    const lim = sp.latMax * 1.15 / Math.max(speed, 4);
    targetW = clamp(targetW, -lim, lim);
  } else targetW *= 1.3;
  c.w += (targetW - c.w) * Math.min(1, (c.drifting ? 3.2 : 9) * dt);
  if (c.drifting && inp.thr) c.w -= Math.sign(slip) * Math.min(absSlip, 0.6) * 1.1 * dt;
  if (inp.hb && speed > 6) c.w += c.steer * 2.6 * dt;
  if (absSlip > 1.25) c.w += Math.sign(slip) * (absSlip - 1.25) * 7 * dt;
  c.h += c.w * dt;
  c.vx = fx * vF + sx * vS; c.vz = fz * vF + sz * vS;
  c.x += c.vx * dt; c.z += c.vz * dt;
  const nn = nearest(c.x, c.z, c.idx);
  const prev = c.idx; c.idx = nn.i; c.lat = nn.lat;
  c.off = Math.abs(nn.lat) > HALF + CURB_W + 0.6;
  const lim = WALL - 1.3;
  if (Math.abs(nn.lat) > lim) {
    const sg = Math.sign(nn.lat), nx = NX[nn.i] * sg, nz = NZ[nn.i] * sg, ex = Math.abs(nn.lat) - lim;
    c.x -= nx * ex; c.z -= nz * ex;
    const vn = c.vx * nx + c.vz * nz;
    if (vn > 0) {
      c.vx -= nx * vn * 1.35; c.vz -= nz * vn * 1.35;
      const keep = vn > 6 ? 0.7 : 0.9; c.vx *= keep; c.vz *= keep; c.w *= 0.5;
      if (vn > 3.5) c.crash = Math.max(c.crash, vn);
    }
  }
  c.vF = vF; c.slip = slip; c.speed = Math.hypot(c.vx, c.vz);
  return prev;
}
// collisions entre voitures (2 cercles par voiture)
const CR = 1.15, COFF = 1.35;
function collidePair(a, b, bStatic) {
  for (const oa of [COFF, -COFF]) for (const ob of [COFF, -COFF]) {
    const ax = a.x + Math.sin(a.h) * oa, az = a.z + Math.cos(a.h) * oa;
    const bx = b.x + Math.sin(b.h) * ob, bz = b.z + Math.cos(b.h) * ob;
    let dx = bx - ax, dz = bz - az; const d = Math.hypot(dx, dz);
    if (d >= CR * 2 || d < 1e-4) continue;
    dx /= d; dz /= d; const ov = CR * 2 - d;
    const rvx = (b.vx || 0) - a.vx, rvz = (b.vz || 0) - a.vz, vn = rvx * dx + rvz * dz;
    if (bStatic) {
      a.x -= dx * ov; a.z -= dz * ov;
      if (vn < 0) { a.vx += dx * vn * 1.3; a.vz += dz * vn * 1.3; }
    } else {
      a.x -= dx * ov / 2; a.z -= dz * ov / 2; b.x += dx * ov / 2; b.z += dz * ov / 2;
      if (vn < 0) { const j = -1.3 * vn / 2; a.vx -= dx * j; a.vz -= dz * j; b.vx += dx * j; b.vz += dz * j; b.w += (Math.random() - 0.5) * j * 0.15; }
    }
    if (vn < 0) { a.w += (Math.random() - 0.5) * (-vn) * 0.15; if (-vn > 4) { a.crash = Math.max(a.crash, -vn * 0.8); if (!bStatic) b.crash = Math.max(b.crash, -vn * 0.8); } }
  }
}

/* ======================= IA ======================= */
function aiInput(c, cars) {
  const ai = c.ai, sp = c.spec, speed = c.speed;
  const la = idxWrap(c.idx + Math.round((9 + speed * 0.55) / SEG));
  let kAvg = 0; for (let d = 10; d <= 70; d += 10) kAvg += K[idxWrap(c.idx + Math.round(d / SEG))]; kAvg /= 7;
  const inside = clamp(kAvg * 420, -(HALF - 2.5), HALF - 2.5);
  // évitement
  let avoid = 0;
  for (const o of cars) {
    if (o === c) continue;
    const dx = o.x - c.x, dz = o.z - c.z, fwd = dx * Math.sin(c.h) + dz * Math.cos(c.h);
    if (fwd < 0 || fwd > 16) continue;
    const side = dx * Math.cos(c.h) - dz * Math.sin(c.h);
    if (Math.abs(side) < 2.8 && (o.speed < speed + 1)) avoid += (side >= 0 ? -1 : 1) * (1 - fwd / 16) * 4;
  }
  ai.avoid = lerp(ai.avoid, avoid, 0.08);
  const lane = clamp(inside + ai.lane * (1 - Math.min(1, Math.abs(kAvg) * 90)) + ai.avoid, -(HALF - 2), HALF - 2);
  const tx = PX[la] + NX[la] * lane, tz = PZ[la] + NZ[la] * lane;
  const err = wrapAng(Math.atan2(tx - c.x, tz - c.z) - c.h);
  let target = sp.maxSpeed * 1.3;
  for (let d = 4; d <= 150; d += 7) {
    const k = Math.max(Math.abs(K[idxWrap(c.idx + Math.round(d / SEG))]), 1e-4);
    const vC = Math.sqrt(ai.aLat / k), vA = Math.sqrt(vC * vC + 2 * ai.brake * d);
    if (vA < target) target = vA;
  }
  const nitro = c.nitro > 0.35 && target > speed + 6 && Math.abs(kAvg) < 0.004 && speed > 15;
  return { thr: speed < target - 0.4 ? 1 : 0, brk: speed > target + 1.5 ? 1 : 0, steer: clamp(err * 2.6, -1, 1), hb: 0, nitro: nitro ? 1 : 0 };
}

/* ======================= État de jeu ======================= */
let state = 'loading';
let player = null, cars = [], ghostCar = null;
const game = { time: 0, raceT: 0, score: 0, best: 0, timeLeft: 90, drifts: 0, bestCombo: 0, maxAngle: 0, countdown: 0, lastCount: -1, laps: 3, earned: 0, finishWait: 0, wrongT: 0, stuck: 0, lightsT: 0, goAt: 0 };
const combo = { active: false, pts: 0, time: 0, grace: 0, mult: 1 };
const GRACE = 1.4, MULT_STEPS = [[0, 1], [2, 1.5], [4, 2], [6.5, 3], [10, 4], [15, 5]];

function ensurePlayer() {
  if (!player) { player = newCar({ isPlayer: true, name: prof.name }); }
  player.name = prof.name;
  player.spec = makeSpec(mode(), prof.upg);
  if (!player.model) { player.model = buildCar('hi', PAINTS[prof.paint], RIMS[prof.rim].c); scene.add(player.model.root); }
  if (!cars.includes(player)) cars.unshift(player);
  setCarPaint(player.model, PAINTS[prof.paint]);
  for (const o of player.model.rimMeshes) o.material = rimMat(RIMS[prof.rim].c);
  player.color = PAINTS[prof.paint];
}
function clearAI() { for (const c of cars) if (!c.isPlayer && c.model) scene.remove(c.model.root); cars = player ? [player] : []; }
function resetPlayerRun(c) { Object.assign(c, { lap: 0, cp: true, lapStart: 0, lapTimes: [], bestLap: Infinity, finished: false, finishTime: 0, nitro: 0.35, crash: 0, boost: 1, stuck: 0, frozen: true, prog: 0 }); }

function startGame() {
  initAudio(); saveProf(); ensurePlayer(); clearAI();
  if (ghostCar) { scene.remove(ghostCar.model.root); ghostCar = null; }
  clearSkids(); clearSmoke();
  const m = mode();
  Object.assign(game, { time: 0, raceT: 0, score: 0, timeLeft: 90, drifts: 0, bestCombo: 0, maxAngle: 0, countdown: 3.2, lastCount: -1, laps: prof.laps, earned: 0, finishWait: 0, wrongT: 0, stuck: 0, lightsT: 0, ghostRec: [], newBest: false });
  game.best = store.get('best_' + m, 0);
  Object.assign(combo, { active: false, pts: 0, time: 0, grace: 0, mult: 1 });
  resetPlayerRun(player);
  if (m === 'race') {
    const d = DIFF[prof.diff];
    const slots = [0, 1, 2, 3, 4, 5]; const pSlot = 3;
    const ordered = AI_DRIVERS.slice(0, 5);
    let ai = 0;
    for (const k of slots) {
      const s = gridSlot(k);
      if (k === pSlot) { placeCar(player, s.i, 0, s.h); player.x = s.x; player.z = s.z; continue; }
      const dr = ordered[ai++];
      const c = newCar({ isAI: true, name: dr.name, color: dr.c, spec: makeSpec('race', { engine: prof.diff, tires: prof.diff, nitro: 1 }) });
      c.spec.power *= d.power; c.spec.latMax = d.aLat;
      const talent = 1 - ai * 0.018 + (Math.random() - 0.5) * 0.02;
      c.spec.power *= 0.97 + talent * 0.03;
      c.ai = { lane: (Math.random() - 0.5) * 6, avoid: 0, aLat: d.aLat * talent, brake: d.brake };
      resetPlayerRun(c); placeCar(c, s.i, 0, s.h); c.x = s.x; c.z = s.z;
      c.model = buildCar('lo', dr.c, RIMS[(ai + 1) % RIMS.length].c); scene.add(c.model.root);
      cars.push(c);
    }
  } else if (m === 'online') {
    placeCar(player, idxWrap(-Math.round(30 / SEG) - Math.floor(Math.random() * 40)), (Math.random() - 0.5) * 8);
  } else {
    placeCar(player, idxWrap(-Math.round(12 / SEG)), 0);
  }
  if (m === 'time') {
    const gs = store.get('ghost', null);
    game.ghost = gs && gs.p && gs.p.length > 10 ? gs : null;
    game.bestLapT = game.ghost ? game.ghost.t : Infinity;
    buildGhostIndex();
    ghostCar = { model: buildCar('lo', 0x7dd3fc, 0xffffff, true) }; ghostCar.model.root.visible = false; scene.add(ghostCar.model.root);
  }
  camState.init = false;
  showScreen(null);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('hudTimer').classList.toggle('hidden', m !== 'chrono');
  $('hudScore').classList.toggle('hidden', m === 'race' || m === 'time');
  $('hudPos').classList.toggle('hidden', m !== 'race');
  $('standings').classList.toggle('hidden', m !== 'race');
  $('onlineBar').classList.toggle('hidden', m !== 'online');
  $('popups').innerHTML = ''; $('delta').textContent = '';
  if (m === 'online') { net.active = true; net.rid = null; net.rat = 0; net.raceState = 'free'; player.frozen = false; state = 'play'; $('countdown').classList.add('hidden'); $('lights').classList.add('hidden'); popup('SESSION EN LIGNE', 'Roule librement, lance une course quand tu veux', false, 'blue'); }
  else if (m === 'race') { state = 'countdown'; game.lightsT = 0; game.goAt = 3.4 + Math.random() * 0.8; $('lights').classList.remove('hidden'); $('lights').classList.remove('go'); $('countdown').classList.add('hidden'); }
  else { state = 'countdown'; $('countdown').classList.remove('hidden'); $('lights').classList.add('hidden'); }
  updateHud();
}
function showScreen(id) { for (const s of ['menu', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id); }
function pauseGame() {
  if (state !== 'play' && state !== 'countdown') return;
  if (mode() === 'online') { // pas de vraie pause en ligne
    game.pausedFrom = state; state = 'pause'; showScreen('pause'); $('btnRestart').classList.add('hidden'); return;
  }
  game.pausedFrom = state; state = 'pause'; showScreen('pause'); $('btnRestart').classList.remove('hidden'); updateAudio(null, { thr: 0 }, 0, false);
}
function resumeGame() { showScreen(null); state = game.pausedFrom || 'play'; clock.getDelta(); }
function toMenu() {
  if (mode() === 'online') leaveOnline();
  state = 'menu'; showScreen('menu'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
  updateAudio(null, { thr: 0 }, 0, false); clearAI();
  if (ghostCar) { scene.remove(ghostCar.model.root); ghostCar = null; }
  ensurePlayer(); placeCar(player, idxWrap(-Math.round(12 / SEG)), 0); player.frozen = true;
  renderMenu();
}
function popup(text, sub, bad, cls) {
  const el = document.createElement('div'); el.className = 'popup disp' + (bad ? ' bad' : '') + (cls ? ' ' + cls : '');
  el.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
  $('popups').appendChild(el); setTimeout(() => el.remove(), 1650);
  while ($('popups').children.length > 3) $('popups').firstChild.remove();
}
const rating = p => p < 400 ? 'DRIFT' : p < 1500 ? 'BEAU DRIFT' : p < 4000 ? 'SUPER DRIFT' : p < 9000 ? 'ÉNORME DRIFT' : p < 18000 ? 'DRIFT DE FOU' : 'LÉGENDAIRE !';
const scoringMode = () => ['drift', 'chrono', 'online'].includes(mode());
function bankCombo(silent) {
  const p = Math.round(combo.pts);
  if (p > 50) {
    game.drifts++; game.bestCombo = Math.max(game.bestCombo, p);
    if (scoringMode()) {
      game.score += p;
      if (!silent) popup('+' + fmtInt(p), rating(p));
      if (mode() === 'drift' || mode() === 'online') { const cr = addCredits(p / 25); game.earned += cr; if (mode() === 'drift' && game.score > game.best) { game.best = game.score; store.set('best_drift', game.best); } }
    }
  }
  Object.assign(combo, { active: false, pts: 0, time: 0, grace: 0, mult: 1 });
}
function loseCombo(reason) {
  if (combo.active && combo.pts > 100 && scoringMode()) popup('COMBO PERDU', reason, true);
  Object.assign(combo, { active: false, pts: 0, time: 0, grace: 0, mult: 1 });
}
function resetToTrack(c, manual) {
  if (c.isPlayer && manual) loseCombo('Voiture replacée');
  placeCar(c, c.idx, 0);
}
function raceProgress(c) { return c.lap === 0 ? (c.idx > N / 2 ? c.idx - N : c.idx) : (c.lap - 1) * N + c.idx; }
function onLapCross(c) {
  // retourne le temps du tour complété (ou 0)
  if (c.lap === 0) { c.lap = 1; return 0; }
  const t = game.raceT - c.lapStart; c.lapStart = game.raceT; c.lapTimes.push(t); c.bestLap = Math.min(c.bestLap, t); c.lap++;
  return t;
}
function trackLaps(c, prevIdx) {
  if (c.idx > N * 0.45 && c.idx < N * 0.55) c.cp = true;
  if (c.cp && prevIdx > N * 0.85 && c.idx < N * 0.15) { c.cp = false; return { crossed: true, t: onLapCross(c) }; }
  return null;
}

function gameLogic(dt, prevIdx) {
  const m = mode(), pc = player;
  game.time += dt; game.raceT += dt;
  // tours du joueur
  const lp = trackLaps(pc, prevIdx);
  if (lp && lp.crossed) {
    if (m === 'race' || (m === 'online' && net.raceState === 'race')) {
      if (lp.t) popup('TOUR ' + (pc.lap - 1) + ' · ' + fmtTime(lp.t), pc.lap === game.laps ? 'DERNIER TOUR !' : '', false, pc.lap === game.laps ? 'gold' : '');
      else if (game.laps > 0) popup('TOUR 1 / ' + game.laps, '');
      if (pc.lap > game.laps && !pc.finished) { pc.finished = true; pc.finishTime = game.raceT; onPlayerFinish(); }
    } else if (lp.t) {
      const best = store.get('lap_best', Infinity) || Infinity;
      const isBest = lp.t < best;
      if (isBest) store.set('lap_best', lp.t);
      if (m === 'time') {
        const cr = addCredits(150 + (lp.t < game.bestLapT ? 600 : 0)); game.earned += cr;
        if (lp.t < game.bestLapT) {
          game.bestLapT = lp.t; game.ghost = { t: lp.t, p: game.ghostRec.slice() }; store.set('ghost', game.ghost); buildGhostIndex();
          popup('NOUVEAU RECORD · ' + fmtTime(lp.t), '+' + cr + ' crédits', false, 'gold');
        } else popup('TOUR ' + fmtTime(lp.t), '+' + cr + ' crédits');
      } else popup('TOUR ' + fmtTime(lp.t), isBest ? 'MEILLEUR TOUR !' : '');
    }
    if (m === 'time') { game.ghostRec = []; game.ghostT0 = game.raceT; }
  }
  // fantôme : enregistrement
  if (m === 'time' && pc.lap >= 1) {
    if (game.ghostT0 === undefined) game.ghostT0 = 0;
    const lt = game.raceT - pc.lapStart;
    if (!game.ghostRec.length || lt - game.ghostRec[game.ghostRec.length - 1][0] >= 0.05) game.ghostRec.push([+lt.toFixed(2), +pc.x.toFixed(2), +pc.z.toFixed(2), +pc.h.toFixed(3), pc.idx]);
  }
  // drift
  const angle = Math.abs(pc.slip) * 180 / Math.PI;
  const scoring = pc.drifting && angle > 10 && pc.speed > 8 && !pc.off && pc.vF > 0;
  if (scoring) {
    combo.active = true; combo.grace = GRACE; combo.time += dt;
    let mm = 1; for (const [t, v] of MULT_STEPS) if (combo.time >= t) mm = v;
    combo.mult = Math.max(combo.mult, mm);
    const edge = Math.abs(pc.lat) > HALF - 2.5 ? 1.25 : 1;
    combo.pts += dt * pc.speed * Math.min(angle, 70) * 0.22 * combo.mult * edge;
    game.maxAngle = Math.max(game.maxAngle, Math.min(angle, 120));
    pc.nitro = Math.min(1, pc.nitro + dt * 0.11 * pc.spec.nitroGain * Math.min(angle, 50) / 30);
  } else if (combo.active) { combo.grace -= dt; if (combo.grace <= 0) bankCombo(); }
  if (m === 'race' || m === 'time') pc.nitro = Math.min(1, pc.nitro + dt * 0.018 * pc.spec.nitroGain);
  if (combo.active && pc.off) loseCombo('Hors piste');
  if (pc.crash > 0) { loseCombo('Choc'); camShake = Math.min(1, pc.crash / 12); crashSound(pc.crash / 14); pc.crash = 0; }
  if (Math.abs(pc.slip) > 2.3 && pc.speed > 3 && combo.active) loseCombo('Tête-à-queue');
  // mauvais sens / bloqué
  const dotT = Math.sin(pc.h) * TX[pc.idx] + Math.cos(pc.h) * TZ[pc.idx];
  game.wrongT = (dotT < -0.35 && pc.speed > 4) ? game.wrongT + dt : 0;
  if (pc.speed < 2.5 && (pc.off || Math.abs(pc.lat) > WALL - 2.2)) game.stuck += dt; else game.stuck = Math.max(0, game.stuck - dt);
  if (game.stuck > 3) { game.stuck = -2; popup('BLOQUÉ ?', isTouch ? 'Touche ↺ pour te replacer' : 'Appuie sur R pour te replacer'); }
  if (m === 'chrono') { game.timeLeft -= dt; if (game.timeLeft <= 0) { game.timeLeft = 0; endSession(); } }
}
function aiLogic(dt) {
  if (mode() !== 'race') return;
  const pp = raceProgress(player);
  for (const c of cars) {
    if (!c.isAI) continue;
    const ahead = (raceProgress(c) - pp) * SEG;
    c.boost = player.finished ? 1 : clamp(1 - ahead / 2500, 0.93, 1.07);
    if (c.crash) c.crash = 0;
    c.nitro = Math.min(1, c.nitro + dt * 0.03);
    if (c.speed < 1.5 && game.raceT > 5) c.stuck += dt; else c.stuck = 0;
    if (c.stuck > 2.5) { resetToTrack(c); c.stuck = 0; }
  }
}
function onPlayerFinish() {
  const order = standings();
  const pos = order.indexOf(player) + 1;
  game.finishPos = pos;
  popup(pos === 1 ? 'VICTOIRE !' : 'ARRIVÉE · ' + pos + (pos === 1 ? 'er' : 'e'), fmtTime(player.finishTime), false, 'gold');
  state = 'finish'; game.finishWait = 3.5;
}
function standings() {
  const list = cars.slice();
  for (const c of list) c.prog = raceProgress(c);
  list.sort((a, b) => (b.finished - a.finished) || (a.finished ? a.finishTime - b.finishTime : b.prog - a.prog));
  return list;
}
function endSession() {
  const m = mode();
  if (combo.active) bankCombo(true);
  state = 'results';
  $('touch').classList.add('hidden');
  updateAudio(null, { thr: 0 }, 0, false);
  let html = '', big = '', title = 'Résultats', isNew = false;
  if (m === 'race') {
    const order = standings();
    const pos = order.indexOf(player) + 1;
    const pay = [2000, 1400, 1000, 700, 500, 400][pos - 1] * (1 + 0.25 * prof.diff);
    game.earned += addCredits(pay);
    title = 'Course · ' + ['Facile', 'Normal', 'Pro'][prof.diff] + ' · ' + game.laps + ' tours';
    big = pos === 1 ? '🏆 1er' : pos + 'e';
    html = '<table class="resTable">' + order.map((c, k) => {
      const t = c.finished ? fmtTime(c.finishTime) : 'en course';
      return '<tr class="' + (c.isPlayer ? 'me' : '') + '"><td>' + (k + 1) + '</td><td>' + esc(c.name) + '</td><td>' + (isFinite(c.bestLap) ? fmtTime(c.bestLap) : '--') + '</td><td>' + t + '</td></tr>';
    }).join('') + '</table>';
    const bestPos = store.get('best_race_pos', 99);
    if (pos < bestPos) store.set('best_race_pos', pos);
  } else if (m === 'chrono') {
    isNew = game.score > game.best && game.score > 0;
    if (isNew) { game.best = game.score; store.set('best_chrono', game.best); }
    game.earned += addCredits(game.score / 15);
    title = 'Défi drift 90 s'; big = fmtInt(game.score);
    html = '<div class="res"><div><span class="lbl">Record</span><b>' + fmtInt(game.best) + '</b></div><div><span class="lbl">Drifts</span><b>' + game.drifts + '</b></div><div><span class="lbl">Meilleur combo</span><b>' + fmtInt(game.bestCombo) + '</b></div><div><span class="lbl">Angle max</span><b>' + Math.round(game.maxAngle) + '°</b></div></div>';
  } else if (m === 'online') {
    const res = onlineResults();
    title = 'Course en ligne'; big = res.myPos ? (res.myPos === 1 ? '🏆 1er' : res.myPos + 'e') : '--';
    const pay = res.myPos ? [1500, 1000, 700, 500, 400, 300, 250, 200][Math.min(res.myPos, 8) - 1] : 0;
    game.earned += addCredits(pay);
    html = onlineTable(res);
  }
  $('resTitle').textContent = title; $('resBig').textContent = big; $('resBody').innerHTML = html;
  $('resNew').classList.toggle('hidden', !isNew);
  $('resEarn').textContent = game.earned ? '+' + fmtInt(game.earned) + ' crédits' : '';
  $('btnAgain').textContent = m === 'online' ? 'Retour à la session' : 'Rejouer';
  $('hud').classList.add('hidden');
  showScreen('results');
}

/* ======================= Fantôme ======================= */
let ghostIdxT = null;
function buildGhostIndex() {
  ghostIdxT = null;
  const g = game.ghost; if (!g) return;
  ghostIdxT = new Float32Array(N).fill(-1);
  for (const s of g.p) { const i = s[4]; if (i !== undefined && ghostIdxT[i] < 0 && s[0] > 0.5) ghostIdxT[i] = s[0]; }
  let last = 0; for (let i = 0; i < N; i++) { if (ghostIdxT[i] < 0) ghostIdxT[i] = last; else last = ghostIdxT[i]; }
}
function updateGhost() {
  if (!ghostCar) return;
  const g = game.ghost;
  if (!g || player.lap < 1 || state !== 'play') { ghostCar.model.root.visible = false; return; }
  const lt = game.raceT - player.lapStart, p = g.p;
  let a = 0, b = p.length - 1;
  while (b - a > 1) { const m = (a + b) >> 1; if (p[m][0] <= lt) a = m; else b = m; }
  const A = p[a], B = p[b], f = B[0] > A[0] ? clamp((lt - A[0]) / (B[0] - A[0]), 0, 1) : 0;
  if (lt > p[p.length - 1][0]) { ghostCar.model.root.visible = false; return; }
  ghostCar.model.root.visible = true;
  ghostCar.model.root.position.set(lerp(A[1], B[1], f), 0, lerp(A[2], B[2], f));
  ghostCar.model.root.rotation.y = A[3] + wrapAng(B[3] - A[3]) * f;
  // écart
  if (ghostIdxT && player.idx > 20 && player.idx < N - 20) {
    const d = lt - ghostIdxT[player.idx];
    const el = $('delta'); el.textContent = (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2) + ' s'; el.className = d < 0 ? 'good' : 'bad';
  }
}

/* ======================= En ligne (room) ======================= */
const net = { room: null, connected: false, status: 'init', peers: [], active: false, remotes: new Map(), rid: null, rat: 0, raceState: 'free', lastSend: 0, myPeer: null, finSent: 0 };
async function initNet() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') { net.status = 'off'; renderNet(); return; }
    const room = await window.claude.use('room');
    if (!room) { net.status = 'off'; renderNet(); return; }
    net.room = room; net.status = 'connecting';
    room.onConnection(c => { net.connected = c; net.status = c ? 'ok' : 'connecting'; renderNet(); }, e => { net.status = 'off'; net.err = e && e.code; renderNet(); });
    room.onPeers(ch => {
      net.peers = ch.peers;
      for (const p of ch.left) removeRemote(p.peer);
      const me = ch.peers.find(p => p.sameTab); if (me) net.myPeer = me.peer;
      renderNet();
    }, () => {});
    room.presence({ on: 0, nm: prof.name }).catch(() => {});
  } catch (e) { net.status = 'off'; renderNet(); }
}
function onlinePeers() { return (net.peers || []).filter(p => !p.sameTab && p.kind === 'viewer' && p.presence && p.presence.on === 1); }
function peerName(p) { const n = p.presence && typeof p.presence.nm === 'string' ? p.presence.nm : ''; return n.slice(0, 16) || 'Pilote'; }
function peerColor(p) { const c = p.presence && p.presence.pc; return typeof c === 'number' && c >= 0 && c <= 0xffffff ? c : 0x999999; }
function sendPresence(force) {
  if (!net.room) return;
  const now = performance.now();
  if (!force && now - net.lastSend < 90) return;
  net.lastSend = now;
  const pc = player;
  const data = net.active && pc ? {
    on: 1, nm: prof.name, pc: PAINTS[prof.paint],
    x: +pc.x.toFixed(2), z: +pc.z.toFixed(2), h: +pc.h.toFixed(3), vx: +pc.vx.toFixed(2), vz: +pc.vz.toFixed(2),
    sl: +pc.slip.toFixed(2), n: pc.nitroOn ? 1 : 0, d: pc.drifting ? 1 : 0,
    rid: net.rid, rat: net.rat, l: pc.lap, i: pc.idx, f: net.raceState !== 'free' && pc.finished ? Math.round(pc.finishTime * 1000) : 0, sc: Math.round(game.score)
  } : { on: 0, nm: prof.name, rid: null };
  net.room.presence(data).catch(() => {});
}
function leaveOnline() {
  net.active = false; net.rid = null; net.rat = 0; net.raceState = 'free';
  for (const id of [...net.remotes.keys()]) removeRemote(id);
  sendPresence(true);
}
function removeRemote(id) {
  const r = net.remotes.get(id); if (!r) return;
  scene.remove(r.model.root); if (r.tag) r.tag.remove(); net.remotes.delete(id);
}
function startOnlineRace() {
  if (!net.active) return;
  if (net.raceState !== 'free') return;
  net.rid = Math.random().toString(36).slice(2, 8); net.rat = Date.now() + 9000;
  sendPresence(true);
}
function netUpdate(dt) {
  if (!net.active || mode() !== 'online') return;
  const now = Date.now();
  const others = onlinePeers();
  // adopter la course annoncée la plus tôt
  if (net.raceState === 'free') {
    let best = net.rid && net.rat > now ? { rid: net.rid, rat: net.rat } : null;
    for (const p of others) {
      const pr = p.presence; if (typeof pr.rid !== 'string' || typeof pr.rat !== 'number') continue;
      if (pr.rat > now + 600 && pr.rat < now + 20000 && (!best || pr.rat < best.rat || (pr.rat === best.rat && pr.rid < best.rid))) best = { rid: pr.rid, rat: pr.rat };
    }
    if (best && (best.rid !== net.rid)) { net.rid = best.rid; net.rat = best.rat; sendPresence(true); }
    if (net.rid && net.rat - now < 5200) beginOnlineGrid();
    else if (net.rid && net.rat <= now) { net.rid = null; }
  }
  if (net.raceState === 'grid') {
    const left = (net.rat - now) / 1000;
    const lights = $('lights').children;
    for (let k = 0; k < 5; k++) lights[k].classList.toggle('on', left < 4.6 - k * 0.8 && left > 0);
    if (left <= 0) { $('lights').classList.add('go'); for (const l of lights) l.classList.remove('on'); net.raceState = 'race'; player.frozen = false; game.raceT = 0; player.lapStart = 0; blip(880, 0.35, 0.2); setTimeout(() => $('lights').classList.add('hidden'), 900); popup('GO !', '', false, 'gold'); }
    else if (Math.ceil(left) !== game.lastCount) { game.lastCount = Math.ceil(left); if (left < 4.6) blip(440, 0.12, 0.12); }
  }
  // voitures distantes
  const seen = new Set();
  for (const p of others) {
    const pr = p.presence; if (typeof pr.x !== 'number' || typeof pr.z !== 'number') continue;
    seen.add(p.peer);
    let r = net.remotes.get(p.peer);
    if (!r) {
      r = { model: buildCar('lo', peerColor(p), RIMS[0].c), x: pr.x, z: pr.z, h: pr.h || 0, last: null, t: 0, vx: 0, vz: 0, speed: 0, wheelRot: 0 };
      scene.add(r.model.root);
      r.tag = document.createElement('div'); r.tag.className = 'tag'; $('labels').appendChild(r.tag);
      net.remotes.set(p.peer, r);
    }
    if (r.last !== pr) { r.last = pr; r.color = peerColor(p); r.t = performance.now(); r.px = pr.x; r.pz = pr.z; r.ph = pr.h || 0; r.vx = pr.vx || 0; r.vz = pr.vz || 0; setCarPaint(r.model, peerColor(p)); }
    const age = Math.min(0.3, (performance.now() - r.t) / 1000);
    const tx = r.px + r.vx * age, tz = r.pz + r.vz * age;
    const k = 1 - Math.exp(-12 * dt);
    if (Math.hypot(tx - r.x, tz - r.z) > 25) { r.x = tx; r.z = tz; r.h = r.ph; }
    r.x = lerp(r.x, tx, k); r.z = lerp(r.z, tz, k); r.h += wrapAng(r.ph - r.h) * k;
    r.speed = Math.hypot(r.vx, r.vz);
    r.model.root.position.set(r.x, 0, r.z); r.model.root.rotation.y = r.h;
    r.wheelRot += r.speed / 0.4 * dt; for (const w of r.model.wheels) w.spin.rotation.x = r.wheelRot;
    for (const f of r.model.flames) { f.visible = pr.n === 1; f.scale.setScalar(0.8 + Math.random() * 0.5); }
    if (pr.d === 1 && r.speed > 6 && Math.random() < dt * 25) spawnSmoke(r.x - Math.sin(r.h) * 2, r.z - Math.cos(r.h) * 2, r.vx, r.vz, 0.6, false);
    r.tag.textContent = peerName(p); r.tag.style.color = '#' + peerColor(p).toString(16).padStart(6, '0');
    // collision locale
    if (player && !player.frozen) collidePair(player, { x: r.x, z: r.z, h: r.h, vx: r.vx, vz: r.vz }, true);
  }
  for (const id of [...net.remotes.keys()]) if (!seen.has(id)) removeRemote(id);
  // fin de course
  if (net.raceState === 'race') {
    const parts = others.filter(p => p.presence.rid === net.rid);
    if (state === 'results') {
      game.resRefresh = (game.resRefresh || 0) - dt;
      if (game.resRefresh <= 0) { game.resRefresh = 1; const res = onlineResults(); $('resBody').innerHTML = onlineTable(res); $('resBig').textContent = res.myPos === 1 ? '🏆 1er' : res.myPos + 'e'; }
    }
  }
  sendPresence(false);
}
function beginOnlineGrid() {
  net.raceState = 'grid';
  const parts = onlinePeers().filter(p => p.presence.rid === net.rid).map(p => p.peer);
  parts.push(net.myPeer || 'zzzz-me'); parts.sort();
  const slot = Math.max(0, parts.indexOf(net.myPeer || 'zzzz-me'));
  const s = gridSlot(slot % 12);
  const extraBack = Math.floor(slot / 6) * 28;
  const i = idxWrap(s.i - Math.round(extraBack / SEG));
  resetPlayerRun(player); placeCar(player, i, (slot % 2 ? -1 : 1) * 4.2); player.frozen = true;
  game.laps = 3; game.raceT = 0; game.onlineShown = false; game.lastCount = -1;
  loseCombo(); game.score = 0;
  $('lights').classList.remove('hidden', 'go'); camState.init = false;
  popup('COURSE EN LIGNE', 'Départ dans 5 secondes', false, 'blue');
}
function onlineResults() {
  const rows = [];
  const me = { name: prof.name, fin: player.finished ? player.finishTime : 0, prog: raceProgress(player), me: true };
  rows.push(me);
  for (const p of onlinePeers()) {
    const pr = p.presence; if (pr.rid !== net.rid) continue;
    const l = pr.l | 0, i = pr.i | 0;
    rows.push({ name: peerName(p), fin: pr.f > 0 ? pr.f / 1000 : 0, prog: l === 0 ? (i > N / 2 ? i - N : i) : (l - 1) * N + i });
  }
  rows.sort((a, b) => ((b.fin > 0) - (a.fin > 0)) || (a.fin > 0 ? a.fin - b.fin : b.prog - a.prog));
  return { rows, myPos: rows.indexOf(me) + 1 };
}
function onlineTable(res) {
  return '<table class="resTable">' + res.rows.map((r, k) => '<tr class="' + (r.me ? 'me' : '') + '"><td>' + (k + 1) + '</td><td>' + esc(r.name) + '</td><td></td><td>' + (r.fin ? fmtTime(r.fin) : 'en course…') + '</td></tr>').join('') + '</table>';
}
function onlinePosition() {
  if (net.raceState === 'free') return null;
  const r = onlineResults(); return { pos: r.myPos, n: r.rows.length };
}
function renderNet() {
  const st = $('netStatus');
  const others = onlinePeers();
  const allViewers = (net.peers || []).filter(p => p.kind === 'viewer' && !p.sameTab);
  st.className = 'status ' + (net.status === 'ok' ? 'ok' : net.status === 'off' ? 'bad' : '');
  st.lastElementChild.textContent = net.status === 'ok' ? 'Connecté · ' + (allViewers.length + 1) + ' joueur' + (allViewers.length ? 's' : '') + ' sur le jeu' :
    net.status === 'off' ? 'Multijoueur indisponible ici (ouvre le jeu depuis claude.ai, connecté)' : 'Connexion à la salle…';
  const pl = $('peerList');
  const list = allViewers.map(p => ({ name: peerName(p), c: peerColor(p), on: p.presence && p.presence.on === 1 }));
  pl.innerHTML = '<div><i style="background:#' + PAINTS[prof.paint].toString(16).padStart(6, '0') + '"></i>' + esc(prof.name) + ' (toi)</div>' +
    (list.length ? list.map(x => '<div><i style="background:#' + x.c.toString(16).padStart(6, '0') + '"></i>' + esc(x.name) + '<span style="margin-left:auto;opacity:.6;font-size:13px">' + (x.on ? 'sur la piste' : 'au menu') + '</span></div>').join('') : '<div style="opacity:.6">Personne d’autre pour l’instant</div>');
  $('onlineCount').textContent = 'En ligne · ' + (others.length + 1) + ' sur la piste';
  $('onlinePeers').textContent = others.map(peerName).join(' · ');
  $('btnStartOnline').disabled = net.raceState !== 'free' || !net.room;
  $('onlineMsg').textContent = net.raceState === 'free' ? (net.rid ? 'Course annoncée…' : '') : net.raceState === 'grid' ? 'Sur la grille !' : 'Course en cours';
}

/* ======================= HUD ======================= */
const mapCv = $('mapCv'), mapCtx = mapCv.getContext('2d');
const mapBg = document.createElement('canvas'); mapBg.width = mapBg.height = 320;
let mapT;
{
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < N; i++) { minX = Math.min(minX, PX[i]); maxX = Math.max(maxX, PX[i]); minZ = Math.min(minZ, PZ[i]); maxZ = Math.max(maxZ, PZ[i]); }
  const pad = 22, sc = (320 - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
  const ox = (320 - (maxX - minX) * sc) / 2, oz = (320 - (maxZ - minZ) * sc) / 2;
  mapT = (x, z) => [ox + (x - minX) * sc, oz + (z - minZ) * sc];
  const c = mapBg.getContext('2d'); c.lineJoin = c.lineCap = 'round';
  const path = () => { c.beginPath(); for (let i = 0; i <= N; i += 4) { const [a, b] = mapT(PX[i % N], PZ[i % N]); i ? c.lineTo(a, b) : c.moveTo(a, b); } c.closePath(); };
  path(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 16; c.stroke();
  path(); c.strokeStyle = '#e8e8e8'; c.lineWidth = 9; c.stroke();
  const [sx, sz] = mapT(PX[0], PZ[0]); c.fillStyle = '#ff3d5a'; c.fillRect(sx - 7, sz - 7, 14, 14);
}
const hexCss = h => '#' + (h >>> 0).toString(16).padStart(6, '0');
function drawMap() {
  mapCtx.clearRect(0, 0, 320, 320); mapCtx.drawImage(mapBg, 0, 0);
  const dot = (x, z, col, r) => { const [a, b] = mapT(x, z); mapCtx.fillStyle = col; mapCtx.strokeStyle = '#000'; mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.arc(a, b, r, 0, 6.29); mapCtx.fill(); mapCtx.stroke(); };
  for (const c of cars) if (!c.isPlayer) dot(c.x, c.z, hexCss(c.color), 7);
  for (const r of net.remotes.values()) dot(r.x, r.z, hexCss(r.color || 0x999999), 7);
  if (ghostCar && ghostCar.model.root.visible) dot(ghostCar.model.root.position.x, ghostCar.model.root.position.z, 'rgba(125,211,252,0.8)', 6);
  const [x, z] = mapT(player.x, player.z);
  mapCtx.save(); mapCtx.translate(x, z); mapCtx.rotate(-player.h + Math.PI);
  mapCtx.fillStyle = hexCss(PAINTS[prof.paint]); mapCtx.strokeStyle = '#fff'; mapCtx.lineWidth = 3;
  mapCtx.beginPath(); mapCtx.moveTo(0, -14); mapCtx.lineTo(10, 11); mapCtx.lineTo(-10, 11); mapCtx.closePath(); mapCtx.stroke(); mapCtx.fill();
  mapCtx.restore();
}
function updateHud() {
  if (!player) return;
  const m = mode(), pc = player, kmh = pc.speed * 3.6;
  $('speed').textContent = Math.round(kmh);
  $('gear').textContent = pc.vF < -0.5 ? 'R' : pc.gear;
  $('rpmBar').style.width = (pc.rpm * 100).toFixed(0) + '%';
  $('nitroBar').style.width = (pc.nitro * 100).toFixed(0) + '%';
  $('nitroM').classList.toggle('on', pc.nitroOn);
  $('speedFx').style.opacity = pc.nitroOn ? 1 : 0;
  $('score').textContent = fmtInt(game.score);
  $('scoreSub').textContent = m === 'online' ? 'Session en ligne' : 'Record : ' + fmtInt(Math.max(game.best, m === 'drift' ? game.score : 0));
  const racing = m === 'race' || (m === 'online' && net.raceState !== 'free');
  $('lapN').textContent = racing ? Math.min(Math.max(pc.lap, 1), game.laps) + ' / ' + game.laps : Math.max(pc.lap, 1);
  $('lapTime').textContent = fmtTime(state === 'countdown' || pc.frozen ? 0.0001 : (racing ? game.raceT : game.raceT - pc.lapStart)).replace('--', '0:00.00');
  const bl = m === 'time' ? game.bestLapT : (racing ? pc.bestLap : store.get('lap_best', Infinity));
  $('lapBest').textContent = (racing ? 'Meilleur tour : ' : 'Meilleur : ') + fmtTime(bl);
  if (m === 'chrono') { const t = Math.ceil(game.timeLeft); $('hudTimer').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); $('hudTimer').classList.toggle('warn', game.timeLeft < 10); }
  if (m === 'race') {
    const order = standings(); const pos = order.indexOf(pc) + 1;
    $('pos').innerHTML = pos + '<small>/' + order.length + '</small>';
    $('standings').innerHTML = order.map((c, k) => '<div class="' + (c.isPlayer ? 'me' : '') + '"><b>' + (k + 1) + '</b><i style="background:' + hexCss(c.color) + '"></i><span>' + esc(c.name) + '</span>' + (c.finished ? '<em>🏁</em>' : '') + '</div>').join('');
  }
  if (m === 'online') {
    const op = onlinePosition();
    $('hudPos').classList.toggle('hidden', !op);
    if (op) $('pos').innerHTML = op.pos + '<small>/' + op.n + '</small>';
    renderNet();
  }
  const showCombo = combo.active && scoringMode();
  $('combo').style.opacity = showCombo ? 1 : 0;
  if (showCombo) {
    $('comboPts').textContent = fmtInt(combo.pts); $('comboMult').textContent = 'x' + combo.mult;
    $('comboAng').textContent = Math.round(Math.abs(pc.slip) * 57.3) + '° · ' + Math.round(kmh) + ' KM/H';
    $('comboBar').style.transform = 'scaleX(' + clamp(combo.grace / GRACE, 0, 1).toFixed(3) + ')';
  }
  $('wrong').classList.toggle('hidden', game.wrongT < 1.2);
  drawMap();
}
// étiquettes de noms au-dessus des voitures
const _v = new THREE.Vector3();
function updateTags() {
  const w = window.innerWidth, h = window.innerHeight;
  const place = (el, x, z, label, col) => {
    _v.set(x, 2.6, z).project(camera);
    const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && Math.hypot(x - camera.position.x, z - camera.position.z) < (isTouch ? 35 : 55);
    el.style.display = vis ? '' : 'none';
    if (vis) { el.style.left = ((_v.x + 1) / 2 * w).toFixed(0) + 'px'; el.style.top = ((1 - _v.y) / 2 * h).toFixed(0) + 'px'; }
    if (label !== undefined && el.textContent !== label) el.textContent = label;
    if (col) el.style.color = col;
  };
  for (const c of cars) {
    if (c.isPlayer) continue;
    if (!c.tag) { c.tag = document.createElement('div'); c.tag.className = 'tag'; $('labels').appendChild(c.tag); }
    place(c.tag, c.x, c.z, c.name, hexCss(c.color));
  }
  for (const r of net.remotes.values()) place(r.tag, r.x, r.z);
}
function clearTags() { $('labels').querySelectorAll('.tag').forEach(t => { if (![...net.remotes.values()].some(r => r.tag === t)) t.remove(); }); for (const c of cars) c.tag = null; }

/* ======================= Caméra ======================= */
const CAMS = [{ d: 8.2, h: 2.9, look: 1.2, fov: 60 }, { d: 12.5, h: 4.8, look: 1.4, fov: 56 }, { d: 22, h: 19, look: 0, fov: 52 }];
const camState = { yaw: 0, init: false, pos: new THREE.Vector3() };
let camShake = 0;
function cycleCam() { prof.cam = (prof.cam + 1) % CAMS.length; store.set('cam', prof.cam); renderOptions(); }
function updateCamera(dt) {
  const c = CAMS[prof.cam], pc = player;
  if (!camState.init) { camState.yaw = pc.h; camState.init = true; camState.pos.set(pc.x - Math.sin(pc.h) * c.d, c.h, pc.z - Math.cos(pc.h) * c.d); }
  let target = pc.h;
  if (pc.speed > 3 && pc.vF > 0) { const vel = Math.atan2(pc.vx, pc.vz); target = pc.h + wrapAng(vel - pc.h) * 0.55; }
  camState.yaw += wrapAng(target - camState.yaw) * Math.min(1, dt * (prof.cam === 2 ? 2 : 4.5));
  const d = c.d + (pc.nitroOn ? 1.2 : 0);
  const want = new THREE.Vector3(pc.x - Math.sin(camState.yaw) * d, c.h, pc.z - Math.cos(camState.yaw) * d);
  camState.pos.lerp(want, camState.pos.distanceTo(want) > 40 ? 1 : Math.min(1, dt * 10));
  camera.position.copy(camState.pos);
  if (camShake > 0) { camera.position.x += (Math.random() - 0.5) * camShake * 0.8; camera.position.y += (Math.random() - 0.5) * camShake * 0.5; camShake = Math.max(0, camShake - dt * 2.5); }
  if (pc.nitroOn) { camera.position.x += (Math.random() - 0.5) * 0.06; camera.position.y += (Math.random() - 0.5) * 0.05; }
  camera.lookAt(pc.x + Math.sin(pc.h) * 2, c.look, pc.z + Math.cos(pc.h) * 2);
  const fov = c.fov + clamp(pc.speed / 55, 0, 1) * 10 + (pc.nitroOn ? 8 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
}
let orbitAng = 0.6;
function orbitCamera(dt, r, hgt, speed) {
  orbitAng += dt * speed;
  const pc = player;
  camera.position.set(pc.x + Math.sin(orbitAng + pc.h) * r, hgt, pc.z + Math.cos(orbitAng + pc.h) * r);
  camera.lookAt(pc.x, 0.9, pc.z);
  if (Math.abs(camera.fov - 42) > 0.1) { camera.fov = 42; camera.updateProjectionMatrix(); }
}

/* ======================= Visuels des voitures ======================= */
let smokeAcc = 0;
function updateCarVisual(c, inp, dt, near) {
  const m = c.model; if (!m) return;
  m.root.position.set(c.x, 0, c.z); m.root.rotation.y = c.h;
  const roll = clamp(-c.w * c.speed * 0.004, -0.07, 0.07);
  const pitch = clamp((inp.brk ? 0.025 : 0) - (inp.thr && c.speed < 25 ? 0.015 : 0), -0.04, 0.04);
  m.body.rotation.z = lerp(m.body.rotation.z, roll, Math.min(1, dt * 6));
  m.body.rotation.x = lerp(m.body.rotation.x, pitch, Math.min(1, dt * 6));
  c.wheelRot += c.vF / 0.4 * dt;
  c.rearRot += (c.drifting && inp.thr ? Math.max(c.vF, 0) * 1.5 + 8 : c.vF) / 0.4 * dt;
  let wa = c.steer * 0.5;
  if (c.drifting && c.speed > 5) wa = clamp(-c.slip * 0.8 + c.steer * 0.25, -0.6, 0.6);
  for (const w of m.wheels) {
    w.spin.rotation.x = w.front ? c.wheelRot : c.rearRot;
    if (w.front) w.pivot.rotation.y = lerp(w.pivot.rotation.y, wa, Math.min(1, dt * 10));
  }
  m.tail.emissiveIntensity = inp.brk || inp.hb ? 3 : 0.8;
  for (const f of m.flames) { f.visible = c.nitroOn; if (c.nitroOn) f.scale.set(0.9 + Math.random() * 0.4, 0.9 + Math.random() * 0.4, 0.7 + Math.random() * 0.8); }
  if (!near) { c.skidLast[0] = c.skidLast[1] = null; return; }
  const fx = Math.sin(c.h), fz = Math.cos(c.h), sx = Math.cos(c.h), sz = -Math.sin(c.h);
  const intensity = clamp((Math.abs(c.slip) - 0.12) * 2.2, 0, 1) * clamp(c.speed / 12, 0, 1);
  const burnout = inp.thr && c.speed < 6 && (inp.hb || inp.brk) && !c.frozen ? 1 : 0;
  const sliding = (c.drifting && intensity > 0.05) || burnout || (inp.hb && c.speed > 6);
  for (let w = 0; w < 2; w++) {
    const s = w ? -1 : 1, wx = c.x + sx * 0.85 * s - fx * 1.5, wz = c.z + sz * 0.85 * s - fz * 1.5;
    if (sliding && !c.off) addSkid(c, w, wx, wz, sx, sz); else c.skidLast[w] = null;
  }
  if (sliding && (state === 'play' || state === 'finish')) {
    c.smokeAcc = (c.smokeAcc || 0) + dt * (16 + 40 * Math.max(intensity, burnout)) * (c.isPlayer ? 1 : 0.5);
    while (c.smokeAcc > 1) { c.smokeAcc -= 1; const s = Math.random() < 0.5 ? 1 : -1; spawnSmoke(c.x + sx * 0.85 * s - fx * 1.9, c.z + sz * 0.85 * s - fz * 1.9, c.vx, c.vz, Math.max(intensity, burnout * 0.8), c.off); }
  } else if (c.off && c.speed > 8 && state === 'play') {
    c.smokeAcc = (c.smokeAcc || 0) + dt * 12; while (c.smokeAcc > 1) { c.smokeAcc -= 1; spawnSmoke(c.x - fx * 2, c.z - fz * 2, c.vx, c.vz, 0.5, true); }
  }
  if (c.isPlayer) {
    const sp = Math.abs(c.vF); let g = 1; while (g < GEARS.length - 1 && sp > GEARS[g]) g++;
    c.gear = Math.min(g, 6);
    let rpm = clamp((sp - GEARS[g - 1]) / (GEARS[g] - GEARS[g - 1]), 0, 1) * 0.75 + 0.2;
    if (c.drifting && inp.thr) rpm = Math.min(1, rpm + 0.25);
    if (burnout || (c.frozen && inp.thr)) rpm = 0.92;
    c.rpm = lerp(c.rpm, rpm, Math.min(1, dt * 8));
    c.screech = Math.max(intensity, burnout);
  }
}

/* ======================= Menu ======================= */
let menuTab = 'play';
function renderMenu() {
  $('chipName').textContent = '👤 ' + prof.name;
  $('chipCr').textContent = '💰 ' + fmtInt(prof.credits) + ' cr';
  const ml = $('modeList'); ml.innerHTML = '';
  MODES.forEach((m, i) => {
    const d = document.createElement('div'); d.className = 'opt' + (i === prof.mode ? ' sel' : '');
    let rec = '';
    if (m.id === 'drift') rec = 'Record : ' + fmtInt(store.get('best_drift', 0));
    if (m.id === 'chrono') rec = 'Record : ' + fmtInt(store.get('best_chrono', 0));
    if (m.id === 'time') { const g = store.get('ghost', null); rec = 'Meilleur tour : ' + (g ? fmtTime(g.t) : '--'); }
    if (m.id === 'race') { const b = store.get('best_race_pos', 0); rec = b ? 'Meilleure place : ' + b + (b === 1 ? 'er' : 'e') : ''; }
    if (m.id === 'online') rec = net.status === 'ok' ? '🟢 ' + ((net.peers || []).filter(p => p.kind === 'viewer').length) + ' en ligne' : '';
    d.innerHTML = (m.badge ? '<div class="badge">' + m.badge + '</div>' : '') + '<div class="ic">' + m.ic + '</div><div class="nm disp">' + m.name + '</div><div class="ds">' + m.desc + '</div>' + (rec ? '<div class="ds" style="opacity:.9;margin-top:6px;color:#ffd166">' + rec + '</div>' : '');
    d.onclick = () => { prof.mode = i; store.set('mode', i); renderMenu(); };
    ml.appendChild(d);
  });
  $('raceOpts').classList.toggle('hidden', mode() !== 'race');
  setSeg('segDiff', prof.diff); setSeg('segLaps', prof.laps);
  $('modeTip').textContent = { race: 'Astuce : freine avant les virages serrés, garde le nitro pour les lignes droites.', drift: 'Astuce : frein à main pour lancer la glisse, puis contre-braque en gardant les gaz.', chrono: 'Astuce : les longs drifts près du bord rapportent plus.', time: 'Astuce : le fantôme bleu rejoue ton meilleur tour.', online: 'Astuce : partage le jeu à tes amis pour rouler ensemble.' }[mode()] || '';
  $('btnPlay').textContent = mode() === 'online' ? 'REJOINDRE ▶' : 'JOUER ▶';
  renderGarage(); renderOptions(); renderNet();
  $('nameInput').value = prof.name;
}
function setSeg(id, v) { $(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === +v)); }
function renderGarage() {
  const s = makeSpec('race', prof.upg);
  const bars = [['Puissance', s.power / 23], ['Vitesse', s.maxSpeed / 66], ['Adhérence', s.latMax / 17], ['Nitro', (1 + 0.35 * prof.upg.nitro) / 2.05]];
  $('carStats').innerHTML = bars.map(([n, v]) => '<div class="stat"><span>' + n + '</span><b><i style="width:' + (clamp(v, 0, 1) * 100).toFixed(0) + '%"></i></b></div>').join('') + '<div class="note">Vitesse max ≈ ' + Math.round(s.maxSpeed * 3.6) + ' km/h · ' + Math.round(s.maxSpeed * 1.22 * 3.6) + ' km/h avec nitro</div>';
  const pl = $('paints'); pl.innerHTML = '';
  PAINTS.forEach((p, i) => { const d = document.createElement('div'); d.className = 'sw' + (i === prof.paint ? ' sel' : ''); d.style.background = hexCss(p); d.onclick = () => { prof.paint = i; store.set('paint', i); ensurePlayer(); renderGarage(); }; pl.appendChild(d); });
  const rl = $('rims'); rl.innerHTML = '';
  RIMS.forEach((r, i) => { const d = document.createElement('div'); d.className = 'sw' + (i === prof.rim ? ' sel' : ''); d.title = r.n; d.style.background = hexCss(r.c); d.onclick = () => { prof.rim = i; store.set('rim', i); ensurePlayer(); renderGarage(); }; rl.appendChild(d); });
  const ul = $('upgrades'); ul.innerHTML = '';
  UPGRADES.forEach(u => {
    const lvl = prof.upg[u.k], cost = UPG_COST[lvl];
    const d = document.createElement('div'); d.className = 'upg';
    d.innerHTML = '<div class="t"><b>' + u.name + '</b><div>' + u.desc + '</div></div><div class="pips">' + [0, 1, 2].map(k => '<i class="' + (k < lvl ? 'on' : '') + '"></i>').join('') + '</div>';
    const b = document.createElement('button'); b.className = 'btn small';
    if (lvl >= 3) { b.textContent = 'MAX'; b.disabled = true; } else { b.textContent = fmtInt(cost) + ' cr'; b.disabled = prof.credits < cost; }
    b.onclick = () => { if (prof.credits < cost || lvl >= 3) return; prof.credits -= cost; prof.upg[u.k]++; saveProf(); blip(1200, 0.15, 0.12); renderMenu(); menuTab = 'garage'; showTab('garage'); };
    d.appendChild(b); ul.appendChild(d);
  });
  $('chipCr').textContent = '💰 ' + fmtInt(prof.credits) + ' cr';
}
function renderOptions() { setSeg('segQual', prof.qual); setSeg('segSound', prof.muted ? 0 : 1); setSeg('segCam', prof.cam); }
function showTab(t) {
  menuTab = t;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('sel', b.dataset.tab === t));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('hidden', p.id !== 'pane-' + t));
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { showTab(b.dataset.tab); if (b.dataset.tab === 'online') { prof.mode = 4; store.set('mode', 4); renderMenu(); showTab('online'); } });
$('segDiff').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.diff = +v; store.set('diff', prof.diff); setSeg('segDiff', v); };
$('segLaps').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.laps = +v; store.set('laps', prof.laps); setSeg('segLaps', v); };
$('segQual').onclick = e => { const v = e.target.dataset.v; if (v === undefined || +v === prof.qual) return; prof.qual = +v; store.set('qual', prof.qual); renderOptions(); { const qn = $('qualNote'); if (qn) qn.textContent = 'Redémarrage pour appliquer…'; } setTimeout(() => location.reload(), 600); };
$('segSound').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; initAudio(); setMuted(v === '0'); };
$('segCam').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.cam = +v; store.set('cam', prof.cam); renderOptions(); };
$('nameInput').addEventListener('input', e => { const v = [...e.target.value].filter(ch => { const c = ch.codePointAt(0); return c >= 32 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2060 && c <= 0x206f) && c !== 0xfeff && !(c >= 0xe000 && c <= 0xf8ff); }).join('').slice(0, 16); prof.name = v.trim() || 'Pilote'; store.set('name', prof.name); $('chipName').textContent = '👤 ' + prof.name; if (player) player.name = prof.name; sendPresence(true); });
$('btnPlay').onclick = startGame;
$('btnResume').onclick = resumeGame;
$('btnRestart').onclick = startGame;
$('btnMenu').onclick = toMenu;
$('btnAgain').onclick = () => {
  if (mode() === 'online') { showScreen(null); $('hud').classList.remove('hidden'); state = 'play'; net.raceState = 'free'; net.rid = null; net.rat = 0; player.frozen = false; resetPlayerRun(player); player.frozen = false; game.score = 0; $('touch').classList.toggle('hidden', !isTouch); $('hudPos').classList.add('hidden'); sendPresence(true); return; }
  startGame();
};
$('btnMenu2').onclick = toMenu;
$('btnPause').onclick = pauseGame;
$('btnCam').onclick = cycleCam;
$('btnReset').onclick = () => { if (state === 'play' && player) resetToTrack(player, true); };
$('btnMute').onclick = () => { initAudio(); setMuted(!prof.muted); };
$('btnStartOnline').onclick = () => { initAudio(); startOnlineRace(); renderNet(); };
setMuted(prof.muted);
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

/* ======================= Boucle principale ======================= */
const clock = new THREE.Clock();
const NO_INPUT = { thr: 0, brk: 0, steer: 0, hb: 0, nitro: 0 };
const AUTO = c => { // pilote automatique pour le joueur après l'arrivée
  if (!c.ai) c.ai = { lane: 0, avoid: 0, aLat: 10, brake: 16 };
  const i = aiInput(c, cars); i.nitro = 0; return i;
};
let menuTime = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  menuTime += dt;
  let inp = NO_INPUT;
  if (!player) { renderer.render(scene, camera); return; }
  const m = mode();
  const inputs = new Map();
  if (state === 'play' || state === 'finish') {
    inp = state === 'finish' ? AUTO(player) : readInput();
    if (player.frozen) inp = { thr: inp.thr, brk: 0, steer: 0, hb: 0, nitro: 0 };
    inputs.set(player, inp);
    for (const c of cars) if (c.isAI) inputs.set(c, c.finished ? Object.assign(aiInput(c, cars), { thr: 0.5, nitro: 0 }) : aiInput(c, cars));
    const SUB = 3; let prevP = player.idx;
    const prevs = new Map(cars.map(c => [c, c.idx]));
    for (let s = 0; s < SUB; s++) {
      for (const c of cars) { if (c.frozen) continue; physicsStep(c, inputs.get(c) || NO_INPUT, dt / SUB); }
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collidePair(cars[i], cars[j], false);
    for (const c of cars) if (c.isAI) { const lp = trackLaps(c, prevs.get(c)); if (lp && lp.crossed && c.lap > game.laps && !c.finished) { c.finished = true; c.finishTime = game.raceT; } }
    prevP = prevs.get(player);
    if (state === 'play') gameLogic(dt, prevP); else { game.raceT += dt; trackLaps(player, prevP); }
    aiLogic(dt);
    if (state === 'finish') { game.finishWait -= dt; if (game.finishWait <= 0) endSession(); }
  } else if (state === 'countdown') {
    const ri = readInput(); inp = { thr: ri.thr, brk: 0, steer: 0, hb: 0, nitro: 0 };
    if (m === 'race') {
      game.lightsT += dt;
      const lights = $('lights').children, n = Math.min(5, Math.floor(game.lightsT / 0.6));
      for (let k = 0; k < 5; k++) { const on = k < n; if (on && !lights[k].classList.contains('on')) blip(440, 0.12, 0.12); lights[k].classList.toggle('on', on); }
      if (game.lightsT >= game.goAt) {
        $('lights').classList.add('go'); for (const l of lights) l.classList.remove('on'); blip(880, 0.35, 0.2);
        setTimeout(() => $('lights').classList.add('hidden'), 900);
        state = 'play'; game.raceT = 0; for (const c of cars) { c.frozen = false; c.lapStart = 0; }
        popup('GO !', '', false, 'gold');
      }
    } else {
      game.countdown -= dt;
      const n = Math.ceil(game.countdown - 0.2), el = $('countdown');
      if (n !== game.lastCount) { game.lastCount = n; el.textContent = n > 0 ? n : 'GO !'; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'pop 1s ease-out'; blip(n > 0 ? 440 : 880, n > 0 ? 0.12 : 0.35, 0.15); }
      if (game.countdown <= 0.2) { state = 'play'; game.raceT = 0; player.frozen = false; player.lapStart = 0; setTimeout(() => $('countdown').classList.add('hidden'), 700); }
    }
  }
  if (m === 'online' && (state === 'play' || state === 'finish' || state === 'pause' || state === 'results')) {
    if (state === 'pause') { /* la physique continue côté autres joueurs */ }
    netUpdate(dt);
  } else if (net.room && net.active === false && performance.now() - net.lastSend > 2000) sendPresence(true);
  // visuels
  if (state !== 'loading') {
    const camPos = camera.position;
    for (const c of cars) {
      const near = c.isPlayer || Math.hypot(c.x - camPos.x, c.z - camPos.z) < 90;
      updateCarVisual(c, c.isPlayer ? inp : (inputs.get(c) || NO_INPUT), dt, near && state !== 'menu');
    }
    updateGhost();
    updateSmoke(dt);
    if (skidDirty) { skidGeo.attributes.position.needsUpdate = true; skidDirty = false; }
    updateFans(dt, menuTime);
    if (state === 'menu') orbitCamera(dt, 9.5, 2.4, 0.18);
    else if (state === 'results') orbitCamera(dt, 11, 3.2, 0.25);
    else if (state !== 'pause') updateCamera(dt);
    sun.position.set(player.x + SUN_OFF.x, SUN_OFF.y, player.z + SUN_OFF.z);
    sun.target.position.set(player.x, 0, player.z);
    sky.position.set(camera.position.x, 0, camera.position.z);
    updateAudio(player, inp, player.screech || 0, state === 'play' || state === 'countdown' || state === 'finish');
    if (state === 'play' || state === 'countdown' || state === 'finish') { hudAcc += dt; if (hudAcc > 1 / 20) { hudAcc = 0; updateHud(); updateTags(); } }
  }
  // résolution adaptative : garde le jeu fluide sur les téléphones
  perf.t += dt; perf.n++;
  if (perf.t > 1.5) {
    const fps = perf.n / perf.t; perf.t = 0; perf.n = 0; perf.fps = fps;
    if (state === 'play' || state === 'countdown' || state === 'finish') {
      let pr = pixelRatio;
      if (fps < 42 && pr > PR_MIN) pr = Math.max(PR_MIN, pr - 0.15);
      else if (fps > 57 && pr < PR_MAX) pr = Math.min(PR_MAX, pr + 0.08);
      if (pr !== pixelRatio) { pixelRatio = pr; renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight); }
    }
  }
  renderer.render(scene, camera);
}
const perf = { t: 0, n: 0, fps: 60 };
let hudAcc = 0;

/* ======================= Démarrage ======================= */
const TIPS = ['CHARGEMENT DE LA VILLE…', 'PRÉPARATION DE L’AUDI…', 'INSTALLATION DES SUPPORTERS…'];
let tipI = 0; const tipTimer = setInterval(() => { $('loadTxt').textContent = TIPS[++tipI % TIPS.length]; }, 1400);
initNet();
loadAll(() => {
  clearInterval(tipTimer);
  try { buildCity(); } catch (e) { console.error('city', e); }
  try { buildFans(); } catch (e) { console.error('fans', e); }
  ensurePlayer(); placeCar(player, idxWrap(-Math.round(12 / SEG)), 0); player.frozen = true;
  $('loading').classList.add('hidden');
  state = 'menu'; showScreen('menu'); renderMenu();
  if (TEST) window.__dz = { perf, get pixelRatio() { return pixelRatio; }, LOW, scene, renderer, camera, get player() { return player; }, get cars() { return cars; }, game, combo, keys, net, prof, get state() { return state; }, startGame, netUpdate, onlinePeers, physicsStep, aiInput, __setPlay() { state = 'play'; $('lights').classList.add('hidden'); }, standings, K, N, SEG, track: i => [PX[i], PZ[i]], endSession, toMenu,
    simulate(sec, ctl) { const dt = 1 / 60, out = []; for (let t = 0; t < sec; t += dt) { const ins = new Map(); ins.set(player, ctl ? ctl(player, t) : AUTO(player)); for (const c of cars) if (c.isAI) ins.set(c, aiInput(c, cars)); const prevs = new Map(cars.map(c => [c, c.idx])); for (let s = 0; s < 3; s++) for (const c of cars) if (!c.frozen) physicsStep(c, ins.get(c) || NO_INPUT, dt / 3); for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collidePair(cars[i], cars[j], false); for (const c of cars) if (c.isAI) { const lp = trackLaps(c, prevs.get(c)); if (lp && lp.crossed && c.lap > game.laps && !c.finished) { c.finished = true; c.finishTime = game.raceT; } } if (state === 'play') gameLogic(dt, prevs.get(player)); else { game.raceT += dt; trackLaps(player, prevs.get(player)); } aiLogic(dt); if (state === 'finish') { game.finishWait -= dt; if (game.finishWait <= 0) endSession(); } if (state === 'results') break; } return out; } };
});
frame();
})();
