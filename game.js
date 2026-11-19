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
  mode: store.get('mode', 0), diff: store.get('diff', 1), laps: [1, 2].includes(store.get('laps2', 1)) ? store.get('laps2', 1) : 1,
  qual: store.get('qual3', isTouch ? 1 : 2), muted: store.get('muted', false), cam: store.get('cam', 0), cleanHud: store.get('cleanHud', false), fsLand: store.get('fsLand', true),
  night: store.get('night', false), car: store.get('car', 'audi'),
  car2: store.get('car2', 'viper'), duoAI: store.get('duoAI', 1),
};
// 0 = Basse, 1 = Haute mobile (par défaut sur téléphone), 2 = Ultra (par défaut sur PC)
const LOW = prof.qual === 0, HIQ = prof.qual === 2, LITE = !HIQ;
const EXT = window.DZ_ASSET_EXT || 'gltf.json';
// circuit : la vraie Nouakchott (data/circuit_nkc.js, rues OpenStreetMap) ou l'ancien circuit dessiné à la main
const TRACK = window.DZ_CIRCUIT && store.get('track', 1) === 1 ? 1 : 0, RT = TRACK ? window.DZ_CIRCUIT : null;
const TKS = RT ? '_' + RT.id : ''; // records et fantôme propres à chaque circuit
function saveProf() { for (const k of ['name', 'credits', 'paint', 'rim', 'upg', 'mode', 'diff', 'muted', 'cam', 'night', 'car']) store.set(k, prof[k]); }
function addCredits(n) { n = Math.max(0, Math.round(n)); prof.credits += n; store.set('credits', prof.credits); return n; }

const MODES = [
  { id: 'race', ic: '🏁', name: 'Course', desc: 'Traverse Nouakchott en 3 manches contre 5 pilotes IA.' },
  { id: 'drift', ic: '💨', name: 'Drift libre', desc: 'Enchaîne les combos, sans limite de temps.' },
  { id: 'chrono', ic: '⏱️', name: 'Défi drift 90 s', desc: 'Le plus gros score de drift en 90 secondes.' },
  { id: 'time', ic: '👻', name: 'Contre-la-montre', desc: 'Bats ta meilleure traversée de la ville face à ton fantôme.' },
  { id: 'online', ic: '🌐', name: 'En ligne', desc: 'Roule et fais la course avec d’autres joueurs.', badge: 'MULTI' },
  { id: 'duo', ic: '🎮', name: '2 joueurs', desc: 'Deux manettes, un seul écran : course à deux à travers Nouakchott.', badge: 'DUO' },
  { id: 'taxi', ic: '🚕', name: 'Taxi Nouakchott', desc: 'Moulaye, Taximan Ba… prends les clients aux arrêts, respecte les feux et la police, gagne des ouguiyas !', badge: 'NOUVEAU' },
];
const MODE_ORDER = [6, 0, 1, 2, 3, 4, 5];
let TAXI = null; // mode Taxi (taxi.js)
const PAINTS = [0xc8102e, 0x1d4ed8, 0xf5f5f5, 0x111214, 0x9aa3ad, 0x16a34a, 0xf97316, 0x7c3aed, 0xfacc15, 0x0ea5b7];
const RIMS = [{ n: 'Argent', c: 0xe2e5ea }, { n: 'Noir', c: 0x1d1e21 }, { n: 'Or', c: 0xc9a227 }, { n: 'Bronze', c: 0x8a5a2b }];
const UPGRADES = [
  { k: 'engine', name: 'Moteur', desc: 'Plus de puissance et de vitesse de pointe' },
  { k: 'tires', name: 'Pneus', desc: 'Plus d’adhérence dans les virages' },
  { k: 'nitro', name: 'Nitro', desc: 'Dure plus longtemps, se recharge plus vite' },
];
const UPG_COST = [1500, 3500, 7000];
// Pilotes IA : prénoms mauritaniens, tirés au hasard à chaque course
const MRT_NAMES = ['Abdul', 'Mohamed', 'Mbouérik', 'Mbarek', 'Abdallah', 'Sidi', 'Ali', 'Aliyin', 'Mouna', 'Mariam', 'Abdoulaye', 'Mamadou', 'Samba', 'Saada',
  'Ahmed', 'Ahmedou', 'Mohamedou', 'Sidi Mohamed', 'Cheikh', 'Moctar', 'Ely', 'Brahim', 'Yahya', 'Oumar', 'Boubacar', 'Ousmane', 'Amadou', 'Moussa', 'Demba', 'Hamady',
  'Lemine', 'Isselmou', 'Bilal', 'Salem', 'Babe', 'Bakar', 'Ethmane', 'Jiddou', 'Taleb', 'Vall', 'Hamma', 'Mahfoud', 'Khalil', 'Yacoub', 'Djibril', 'Ibrahima', 'Alassane', 'Thierno',
  'Fatimetou', 'Khadijetou', 'Aïchetou', 'Mariem', 'Lalla', 'Vatma', 'Zeinabou', 'Toutou', 'Selma', 'Aminetou', 'Mekfoula', 'Oumou', 'Aïssata', 'Coumba', 'Dieynaba',
  'Kadiata', 'Houlèye', 'Penda', 'Ramata', 'Maïmouna', 'Hawa', 'Fatou', 'Néné', 'Binta', 'Tacko', 'Salka', 'Mahjouba', 'Neyla', 'Leila', 'Halima', 'Khadi', 'Batoul', 'Djeinaba'];
const AI_COLORS = [0x1d4ed8, 0xf5f5f5, 0x16a34a, 0xfacc15, 0x7c3aed, 0xf97316, 0x0ea5b7, 0x111214, 0x9aa3ad, 0xc8102e];
function pickDrivers(n) {
  const pool = MRT_NAMES.slice(), cols = AI_COLORS.slice(), out = [];
  for (let k = 0; k < n; k++) {
    const name = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const c = cols.splice(Math.floor(Math.random() * cols.length), 1)[0];
    out.push({ name, c });
  }
  return out;
}
// Voitures du garage
const CARS = [
  { id: 'audi', name: 'Audi RS Q8', tag: 'SUV sportif · V8 biturbo', hi: 'audi_hi', lo: 'audi_lo', xlo: 'audi_xlo', paint: true, engine: 'v8tt', st: { power: 1, max: 1, grip: 1, drift: 1, off: 1.2 } },
  { id: 's15', name: 'Nissan Silvia S15', tag: 'Reine du drift · 4 cyl. turbo', hi: 's15_hi', lo: 's15_lo', paint: false, color: 0xd31f2a, engine: 'i4t', st: { power: 1.02, max: 0.97, grip: 0.97, drift: 1.18, off: 0.9 }, credit: '« Nissan Silvia Neo Runner » par P. Kotwica (CC BY-NC)' },
  { id: 'hellcat', name: 'Dodge Challenger Hellcat', tag: 'Muscle car · V8 compresseur', hi: 'hellcat_hi', lo: 'hellcat_lo', paint: true, engine: 'v8sc', st: { power: 1.16, max: 1.05, grip: 0.93, drift: 1.12, off: 0.95 } },
  { id: 'viper', name: 'Dodge Viper SRT-10', tag: 'V10 · brutale', hi: 'viper_hi', lo: 'viper_lo', paint: true, engine: 'v10', st: { power: 1.12, max: 1.08, grip: 1.0, drift: 1.05, off: 0.85 } },
  { id: 'f458', name: 'Supercar 458', tag: 'V8 à haut régime', hi: 'ferrari_hi', lo: 'ferrari_lo', paint: true, engine: 'v8fp', st: { power: 1.12, max: 1.1, grip: 1.08, drift: 0.95, off: 0.85 }, credit: '« Ferrari 458 Italia » par vicent091036 (Sketchfab, CC BY 4.0)' },
  { id: 'specter', name: 'Specter GT3', tag: 'Hypercar · son de W16', hi: 'specter_hi', lo: 'specter_lo', paint: true, engine: 'w16', st: { power: 1.1, max: 1.14, grip: 1.12, drift: 0.9, off: 0.8 } },
];
const carDef = id => CARS.find(c => c.id === id) || CARS[0];
if (!CARS.some(c => c.id === prof.car)) prof.car = 'audi';
const DIFF = [{ aLat: 9.2, power: 0.9, brake: 15 }, { aLat: 11, power: 0.98, brake: 17 }, { aLat: 12.4, power: 1.05, brake: 19 }];
const mode = () => (MODES[prof.mode] || MODES[0]).id;
const raceLike = m => m === 'race' || m === 'duo';

function makeSpec(m, u, carId) {
  const st = carDef(carId || 'audi').st;
  return {
    power: 15.5 * (1 + 0.09 * u.engine) * st.power, maxSpeed: 55 * (1 + 0.05 * u.engine) * st.max,
    grip: 7.2 * (1 + 0.06 * u.tires) * st.grip, driftGrip: ((m === 'race' || m === 'duo' || m === 'time') ? 1.8 : 1.45) / st.drift,
    steer: 2.2, latMax: (12.5 + 1.2 * u.tires) * st.grip, offGrip: st.off,
    nitroDrain: 0.3 / (1 + 0.35 * u.nitro), nitroGain: 1 + 0.35 * u.nitro, nitroPower: 9
  };
}

/* ======================= Rendu ======================= */
const renderer = new THREE.WebGLRenderer({ antialias: !LOW, powerPreference: 'high-performance' });
const PR_MAX = Math.min(window.devicePixelRatio || 1, LOW ? 1.25 : HIQ ? 2 : 1.6), PR_MIN = Math.min(PR_MAX, LOW ? 0.7 : HIQ ? 0.85 : 1);
let pixelRatio = LOW ? Math.min(PR_MAX, 1) : PR_MAX;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.type = HIQ ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
let shadowsOn = prof.qual >= 1;
function applyQuality() {
  const hi = shadowsOn;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const was = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = hi;
  if (was !== hi) scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
}
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = LOW ? new THREE.Fog(0xd9a782, 170, 760) : HIQ ? new THREE.Fog(0xd9a782, 300, 1300) : new THREE.Fog(0xd9a782, 220, 920);
const FOG_DAY = [scene.fog.near, scene.fog.far];
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, LOW ? 800 : LITE ? 950 : 3200);

const SKY = {
  day: { top: 0x1f2d5c, mid: 0x8d5b8f, bot: 0xffa46e, gnd: 0x3a3a40, glow: 1, fog: 0xd9a782 },
  night: { top: 0x01030a, mid: 0x0a1330, bot: 0x2a2440, gnd: 0x0c0c12, glow: 0.18, fog: 0x141a2c },
};
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(SKY.day.top) }, mid: { value: new THREE.Color(SKY.day.mid) }, bot: { value: new THREE.Color(SKY.day.bot) }, sunDir: { value: new THREE.Vector3(-0.55, 0.17, -0.82).normalize() }, sunCol: { value: new THREE.Color(1, 0.75, 0.45) }, glowAmt: { value: 1 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glowAmt; varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(bot, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.2, 0.75, h)); if(h<0.0) c = mix(bot, bot*0.35, smoothstep(0.0,-0.2,h)); float s = max(dot(vP, sunDir), 0.0); c += sunCol*pow(s, 400.0)*2.5 + vec3(1.0,0.55,0.3)*pow(s, 8.0)*0.35*glowAmt; gl_FragColor = vec4(c,1.0); }'
});
const SKY_R = LOW ? 720 : LITE ? 880 : 2200;
const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 16), skyMat);
sky.renderOrder = -2; scene.add(sky);
// étoiles (visibles en mode nuit)
const stars = (() => {
  const n = LOW ? 700 : 1600, pos = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { do { v.set(Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1); } while (v.lengthSq() > 1 || v.y < 0.06); v.normalize().multiplyScalar(SKY_R * 0.92); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 2.1, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false });
  const pts = new THREE.Points(g, m); pts.visible = false; pts.renderOrder = -1; pts.frustumCulled = false; sky.add(pts); return pts;
})();
// Reflets réalistes : cube map du ciel calculée sur canvas (pas de rendu hors-écran)
function makeEnvCube(P) {
  const S = 64, top = new THREE.Color(P.top), mid = new THREE.Color(P.mid), bot = new THREE.Color(P.bot), gnd = new THREE.Color(P.gnd);
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
      const sdot = Math.max(d.dot(sunD), 0); const glow = (Math.pow(sdot, 8) * 0.5 + Math.pow(sdot, 200) * 3) * P.glow;
      const k = (y * S + x) * 4;
      img.data[k] = clamp((c.r + glow) * 255, 0, 255); img.data[k + 1] = clamp((c.g + glow * 0.7) * 255, 0, 255); img.data[k + 2] = clamp((c.b + glow * 0.45) * 255, 0, 255); img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); return cv;
  });
  const cube = new THREE.CubeTexture(faces); cube.encoding = THREE.sRGBEncoding; cube.needsUpdate = true;
  return cube;
}
const ENV = { day: makeEnvCube(SKY.day), night: null };
scene.environment = ENV.day;
const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x5a4a3c, LOW ? 0.7 : 0.45); scene.add(hemi);
const HEMI_DAY = hemi.intensity;
const sun = new THREE.DirectionalLight(0xffd6ae, 1.7);
sun.castShadow = true;
const SH = LITE ? 34 : 55;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 320 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(70, 110, 110);
applyQuality();
sun.shadow.mapSize.set(HIQ ? 2048 : 1024, HIQ ? 2048 : 1024);

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
const ROAD_W = RT ? 22 : 40, HALF = ROAD_W / 2, CURB_W = RT ? 1.2 : 1.6, WALL = HALF + (RT ? 2.6 : 7);
// Grande boucle continue à travers Nouakchott (x = est, z = sud) : 3 manches, 3 quartiers.
// Les carrefours giratoires (rb) ont des bras radiaux, des congés et une circulation anti-horaire.
const WAYPOINTS = RT ? RT.ctrl : [
  [-1000, -150, 'start'], [-1004, -320], [-985, -480], [-950, -610], [-890, -700], [-800, -755, 'moktar'], [-640, -768, 'nkc'], [-480, -752, 'fasq'], [-360, -760],
  { rb: [-150, -760, 72, 180, -90, 44], tag: 'citesmar' },
  [-150, -1000], [-110, -1060], [-20, -1085, 'elquods'], [120, -1080, 'iman'], [280, -1058, 'tasiast'], [420, -1080, 'sheraton'], [540, -1050], [625, -975], [660, -860, 'm2'],
  [664, -740], [668, -620, 'bmd'], [676, -500], [725, -405], [840, -360, 'gan'], [1000, -342, 'mosquee'], [1140, -356, 'marche'], [1260, -347, 'bridgeA'], [1400, -346], [1490, -346, 'madrid'], [1580, -346], [1720, -346, 'bridgeB'], [1830, -322], [1905, -250], [1932, -140, 'faycal'],
  { rb: [1935, 80, 72, -90, 90, 44], tag: 'bamako' },
  [1910, 350, 'm3'], [1840, 440, 'pk10'], [1720, 490], [1560, 470, 'rosso'], [1400, 420], [1240, 440], [1090, 505], [930, 520, 'elmina'], [770, 470], [610, 430], [450, 455], [290, 520], [130, 525], [-30, 470, 'sebkha'], [-190, 430], [-350, 450], [-520, 500], [-690, 470], [-840, 380, 'plage'], [-945, 250], [-990, 100], [-1000, -30],
];
const ROUNDABOUTS = [];
const CTRL = [], CTRL_TAG = [];
for (const w of WAYPOINTS) {
  if (!w.rb) { CTRL.push([w[0], w[1]]); CTRL_TAG.push(w[2] || null); continue; }
  const [cx, cz, R, ti, to, rf] = w.rb, D = Math.PI / 180, q = Math.sqrt(R * R + 2 * R * rf), al = Math.atan2(rf, q);
  const rot = (x, z, a) => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
  const push = (x, z, t) => { CTRL.push([cx + x, cz + z]); CTRL_TAG.push(t || null); };
  const ri = (ti - 180) * D; let [a, b] = rot(-q - 60, 0, ri); push(a, b);
  for (let k = 0; k <= 4; k++) { const ang = (-90 + (90 - al / D) * k / 4) * D; [a, b] = rot(-q + rf * Math.cos(ang), rf + rf * Math.sin(ang), ri); push(a, b); }
  const ain = ti * D - al; let aout = to * D + al; while (aout >= ain) aout -= 2 * Math.PI;
  const n = Math.max(4, Math.round((ain - aout) / (18 * D)));
  for (let k = 1; k < n; k++) { const ang = ain + (aout - ain) * k / n; push(R * Math.cos(ang), R * Math.sin(ang), k === Math.floor(n / 2) ? w.tag : null); }
  const ro = (to + 90) * D;
  for (let k = 0; k <= 4; k++) { const ang = (90 + al / D + (90 - al / D) * k / 4) * D; [a, b] = rot(rf + rf * Math.cos(ang), -q + rf * Math.sin(ang), ro); push(a, b); }
  [a, b] = rot(0, -q - 60, ro); push(a, b);
  ROUNDABOUTS.push({ x: cx, z: cz, R, arms: [ti, to], tag: w.tag });
}
const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
const TRACK_LEN = curve.getLength(), N = Math.round(TRACK_LEN / 1.8), SEG = TRACK_LEN / N;
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
const TAG = {};
CTRL.forEach(([x, z], k) => { const t = CTRL_TAG[k]; if (!t) return; let best = 0, bd = Infinity; for (let i = 0; i < N; i++) { const d = (PX[i] - x) ** 2 + (PZ[i] - z) ** 2; if (d < bd) { bd = d; best = i; } } TAG[t] = best; });
// manches : chaque manche traverse un quartier différent de la ville
const MANCHES = RT ? RT.manches.map(m => ({ from: m.frm === 'start' ? 0 : TAG[m.frm], name: m.name, ar: m.ar })) : [
  { from: 0, name: 'Tevragh Zeina', ar: 'تفرغ زينة' },
  { from: TAG.m2, name: 'Centre-ville · Ksar', ar: 'وسط المدينة · لكصر' },
  { from: TAG.m3, name: 'El Mina · Sebkha · la plage', ar: 'الميناء · السبخة · الشاطئ' },
];
const mancheAt = i => (i >= MANCHES[2].from ? 2 : i >= MANCHES[1].from ? 1 : 0);
// relief : l'autopont du carrefour Madrid (rampe, tablier, rampe)
const EL = new Float32Array(N), WI = new Float32Array(N).fill(WALL), BRIDGE_H = 7.2;
const BRIDGE = TAG.bridgeA !== undefined ? { a: TAG.bridgeA, b: TAG.bridgeB, ramp: Math.round(125 / SEG) } : { a: -1, b: -2, ramp: 1 };
for (let i = BRIDGE.a; i <= BRIDGE.b; i++) {
  const u = Math.min(1, (i - BRIDGE.a) / BRIDGE.ramp, (BRIDGE.b - i) / BRIDGE.ramp), sm = u * u * (3 - 2 * u);
  EL[i] = BRIDGE_H * sm; if (EL[i] > 0.6) WI[i] = HALF + 3.2;
}
const elevAt = (i, lat) => (Math.abs(lat) < WI[i] + 1 ? EL[i] : 0);
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

/* --- Raccourcis : routes qui coupent à travers la ville --- */
const BHALF = RT ? 4.8 : 10, BW = BHALF + (RT ? 2.2 : 5.5);
const BRANCH_DEF = RT ? RT.br.map(b => ({ a: TAG[b.a], b: TAG[b.b], name: b.name, ar: b.ar, pts: b.pts, sand: b.sand })) : [
  { a: TAG.start + 95, b: TAG.moktar + 45, name: "Rue de l'Ambassade du Sénégal", ar: 'شارع سفارة السنغال', bend: 0.06 },
  { a: TAG.bmd - 6, b: TAG.mosquee - 20, name: 'Rue Mamadou Konaté', ar: 'شارع مامادو كوناتي', bend: -0.06 },
  { a: TAG.sebkha + 380, b: idxWrap(TAG.plage + 150), name: 'Rue des Pêcheurs', ar: 'شارع الصيادين', bend: 0.05 },
];
const BR = BRANCH_DEF.map((d, bi) => {
  const P = i => { i = idxWrap(i); return new THREE.Vector3(PX[i], 0, PZ[i]); };
  const side = (i, j) => Math.sign((PX[j] - PX[i]) * NX[i] + (PZ[j] - PZ[i]) * NZ[i]) || 1;
  const sa = side(d.a, d.b), sb = side(d.b, d.a);
  const off = (i, s, l) => { i = idxWrap(i); return new THREE.Vector3(PX[i] + NX[i] * s * l, 0, PZ[i] + NZ[i] * s * l); };
  const q1 = off(d.a + 14, sa, 13), q2 = off(d.b - 14, sb, 13);
  const ch = q2.clone().sub(q1), perp = new THREE.Vector3(-ch.z, 0, ch.x).normalize().multiplyScalar(ch.length() * d.bend);
  const pts = d.pts ? [P(d.a - Math.round(30 / SEG)), P(d.a - Math.round(12 / SEG)), ...d.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), P(d.b + Math.round(12 / SEG)), P(d.b + Math.round(30 / SEG))] : [P(d.a - 30), P(d.a - 10), off(d.a + 4, sa, 4), q1,
    q1.clone().lerp(q2, 0.33).add(perp), q1.clone().lerp(q2, 0.66).add(perp.clone().multiplyScalar(-0.6)),
    q2, off(d.b - 4, sb, 4), P(d.b + 10), P(d.b + 30)];
  const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const M = Math.round(cv.getLength() / 1.5), sp = cv.getSpacedPoints(M - 1);
  const X = new Float32Array(M), Z = new Float32Array(M), TXb = new Float32Array(M), TZb = new Float32Array(M), NXb = new Float32Array(M), NZb = new Float32Array(M), S = new Float32Array(M);
  for (let k = 0; k < M; k++) { X[k] = sp[k].x; Z[k] = sp[k].z; }
  for (let k = 0; k < M; k++) {
    const k1 = Math.max(0, k - 1), k2 = Math.min(M - 1, k + 1); let tx = X[k2] - X[k1], tz = Z[k2] - Z[k1]; const l = Math.hypot(tx, tz) || 1;
    TXb[k] = tx / l; TZb[k] = tz / l; NXb[k] = tz / l; NZb[k] = -tx / l; if (k) S[k] = S[k - 1] + Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]);
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let k = 0; k < M; k++) { minX = Math.min(minX, X[k]); maxX = Math.max(maxX, X[k]); minZ = Math.min(minZ, Z[k]); maxZ = Math.max(maxZ, Z[k]); }
  return Object.assign({}, d, { id: bi, X, Z, NX: NXb, NZ: NZb, TX: TXb, TZ: TZb, S, M, L: S[M - 1], closed: false, box: [minX - BW - 30, maxX + BW + 30, minZ - BW - 30, maxZ + BW + 30] });
});
function nearestBr(br, x, z) {
  const bx = br.box; if (x < bx[0] || x > bx[1] || z < bx[2] || z > bx[3]) return null;
  let best = 0, bd = Infinity;
  for (let k = 0; k < br.M; k += 3) { const dx = x - br.X[k], dz = z - br.Z[k], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = k; } }
  for (let k = Math.max(0, best - 3); k <= Math.min(br.M - 1, best + 3); k++) { const dx = x - br.X[k], dz = z - br.Z[k], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = k; } }
  return { k: best, d: Math.sqrt(bd), lat: (x - br.X[best]) * br.NX[best] + (z - br.Z[best]) * br.NZ[best], br };
}
function nearestAnyBr(x, z) { let r = null; for (const br of BR) { const q = nearestBr(br, x, z); if (q && (!r || q.d < r.d)) r = q; } return r; }
const inBranch = (x, z, m) => { const q = nearestAnyBr(x, z); return !!q && q.d < m; };
const latMain = (x, z) => Math.abs(nearest(x, z, -1).lat);
for (const br of BR) { // zone où le raccourci quitte vraiment la piste : progression continue
  let k0 = 0, k1 = br.M - 1;
  while (k0 < br.M - 1 && latMain(br.X[k0], br.Z[k0]) < HALF + 3) k0++;
  while (k1 > 0 && latMain(br.X[k1], br.Z[k1]) < HALF + 3) k1--;
  br.k0 = k0; br.k1 = k1; br.i0 = nearest(br.X[k0], br.Z[k0], -1).i; br.i1 = nearest(br.X[k1], br.Z[k1], -1).i;
  br.mapIdx = k => Math.round(br.i0 + (br.i1 - br.i0) * clamp((br.S[k] - br.S[k0]) / (br.S[k1] - br.S[k0]), 0, 1));
}
const MAIN = { X: PX, Z: PZ, NX, NZ, M: N, closed: true, EL };
function ribbonPath(P, o1, o2, y, mat, vScale, uScale, skip) {
  const pos = [], uv = [], idx = [];
  const cnt = P.closed ? P.M : P.M - 1, om = (o1 + o2) / 2;
  let dist = 0;
  for (let k = 0; k <= cnt; k++) {
    const i = k % P.M;
    if (k) { const j = (k - 1) % P.M; dist += Math.hypot(P.X[i] - P.X[j], P.Z[i] - P.Z[j]); }
    const yy = y + (P.EL ? P.EL[i] : 0);
    pos.push(P.X[i] + P.NX[i] * o1, yy, P.Z[i] + P.NZ[i] * o1, P.X[i] + P.NX[i] * o2, yy, P.Z[i] + P.NZ[i] * o2);
    const v = dist / vScale; uv.push(0, v, uScale || 1, v);
    if (k < cnt && !(skip && skip(P.X[i] + P.NX[i] * om, P.Z[i] + P.NZ[i] * om))) { const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
const ribbon = (o1, o2, y, mat, vScale, uScale, skip) => ribbonPath(MAIN, o1, o2, y, mat, vScale, uScale, skip);
const ASZ = LOW ? 512 : 1024;
const asphaltTex = canvasTex(ASZ, ASZ, (c, w, h) => { // tuile = demi-route (bord → centre) × 20 m
  const k = w / 1024, R = Math.random;
  c.fillStyle = '#2d2f33'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); const v = R() < 0.6 ? '0,0,0' : '200,200,205'; g.addColorStop(0, 'rgba(' + v + ',' + (0.04 + R() * 0.05) + ')'); g.addColorStop(1, 'rgba(' + v + ',0)'); c.save(); c.translate(R() * w, R() * h); c.scale((40 + R() * 160) * k, (30 + R() * 120) * k); c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore(); }
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 26 + (R() < 0.03 ? 22 : 0); d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.95; }
  c.putImageData(img, 0, 0);
  for (const lx of [1 / 6, 1 / 2, 5 / 6]) for (const o of [-0.045, 0.045]) { // traces de pneus (usure) au milieu des voies
    const x = (lx + o) * w, g = c.createLinearGradient(x - 26 * k, 0, x + 26 * k, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(10,10,12,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - 26 * k, 0, 52 * k, h);
  }
  const sd = c.createLinearGradient(0, 0, 130 * k, 0); sd.addColorStop(0, 'rgba(206,170,120,0.55)'); sd.addColorStop(1, 'rgba(206,170,120,0)'); c.fillStyle = sd; c.fillRect(0, 0, 130 * k, h); // sable au bord
  c.strokeStyle = 'rgba(15,15,17,0.55)'; c.lineCap = 'round';
  for (let i = 0; i < 16; i++) { c.lineWidth = (1 + R() * 2) * k; c.beginPath(); let x = R() * w, y = R() * h; c.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (R() - 0.5) * 60 * k; y += (R() - 0.3) * 50 * k; c.lineTo(x, y); } c.stroke(); } // fissures
  c.fillStyle = 'rgba(18,18,20,0.22)'; for (let i = 0; i < 2; i++) { c.beginPath(); c.ellipse(R() * w, R() * h, (30 + R() * 50) * k, (16 + R() * 30) * k, R() * 3, 0, 6.3); c.fill(); } // rustines
  const paint = (x, y, ww, hh) => { c.fillStyle = 'rgba(238,238,232,0.92)'; c.fillRect(x, y, ww, hh); c.fillStyle = 'rgba(60,60,60,0.25)'; for (let i = 0; i < ww * hh / 30; i++) c.fillRect(x + R() * ww, y + R() * hh, 2 * k, 2 * k); };
  paint(25 * k, 0, 10 * k, h); // ligne de rive
  for (const lx of [1 / 3, 2 / 3]) for (const y0 of [0, h / 2]) paint(lx * w - 4 * k, y0 + 40 * k, 8 * k, 154 * k); // pointillés de voies (3 m tous les 10 m)
  paint(w - 6 * k, 0, 6 * k, h); // ligne centrale continue
}, true);
asphaltTex.wrapS = THREE.MirroredRepeatWrapping;
const curbTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#d62828'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#f2f2f2'; c.fillRect(0, h / 2, w, h / 2); }, true);
const curbTexG = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#0a8f3c'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#f2c200'; c.fillRect(0, h / 2, w, h / 2); }, true); // vert/jaune (couleurs du drapeau) sur les raccourcis
const runoffTex = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#8f8273', 0.2, 12000); c.fillStyle = 'rgba(214,180,131,0.35)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 8 + Math.random() * 14, Math.random() * 3, 0, 6.3); c.fill(); } }, true);
const walkTex = canvasTex(256, 256, (c, w, h) => {
  noise(c, w, h, '#c9b796', 0.16, 9000);
  c.strokeStyle = 'rgba(90,70,50,0.3)'; c.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); }
}, true);
const groundTex = canvasTex(512, 512, (c, w, h) => { // sable du Sahel
  noise(c, w, h, '#d2b07c', 0.14, 30000);
  for (let i = 0; i < 26; i++) { const y0 = Math.random() * h; c.strokeStyle = 'rgba(150,105,60,' + (0.06 + Math.random() * 0.08) + ')'; c.lineWidth = 2 + Math.random() * 3; c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, y0 + Math.sin(x / 40 + i) * 7); c.stroke(); }
  c.fillStyle = 'rgba(255,240,210,0.08)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 60, 10 + Math.random() * 20, Math.random() * 3, 0, 6.3); c.fill(); }
}, true);
groundTex.repeat.set(370, 300);
const roadMat = surf({ map: asphaltTex, roughness: 0.86, envMapIntensity: 0.45 });
if (!LOW) { roadMat.bumpMap = asphaltTex; roadMat.bumpScale = 0.012; }
ribbon(-HALF, HALF, 0.05, roadMat, HALF, 2);
const curbMat = surf({ map: curbTex, roughness: 0.7, envMapIntensity: 0.4 });
const skipCurb = (x, z) => inBranch(x, z, BHALF + 0.4), skipWalk = (x, z) => inBranch(x, z, BW + 1) || onDeckW(x, z);
const onDeckW = (x, z) => { const q = nearest(x, z, -1); return EL[q.i] > 0.6; };
ribbon(HALF, HALF + CURB_W, 0.07, curbMat, 6, 1, skipCurb); ribbon(-HALF - CURB_W, -HALF, 0.07, curbMat, 6, 1, skipCurb);
const runMat = surf({ map: runoffTex, roughness: 1, envMapIntensity: 0.3 });
const onDeck = (x, z) => { const q = nearest(x, z, -1); return EL[q.i] > 0.6; };
ribbon(HALF + CURB_W, WALL + 0.8, -0.02, runMat, 14, 1, onDeck); ribbon(-WALL - 0.8, -HALF - CURB_W, -0.02, runMat, 14, 1, onDeck);
const walkMat = surf({ map: walkTex, roughness: 0.95, envMapIntensity: 0.3 });
if (!RT) { ribbon(WALL + 0.8, WALL + 7, 0.06, walkMat, 7, 1, skipWalk); ribbon(-WALL - 7, -WALL - 0.8, 0.06, walkMat, 7, 1, skipWalk); }
{ // raccourcis : asphalte, bordures vert/jaune, bas-côtés, trottoirs
  const bRoad = surf({ map: asphaltTex, roughness: 0.9, envMapIntensity: 0.4 }); bRoad.polygonOffset = true; bRoad.polygonOffsetFactor = 1; bRoad.polygonOffsetUnits = 2;
  const bCurb = surf({ map: curbTexG, roughness: 0.7, envMapIntensity: 0.4 });
  const sandTex = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#c7a26c', 0.2, 14000); for (const x0 of [0.3, 0.72]) { const g = c.createLinearGradient((x0 - 0.1) * w, 0, (x0 + 0.1) * w, 0); g.addColorStop(0, 'rgba(120,85,45,0)'); g.addColorStop(0.5, 'rgba(120,85,45,0.32)'); g.addColorStop(1, 'rgba(120,85,45,0)'); c.fillStyle = g; c.fillRect((x0 - 0.1) * w, 0, 0.2 * w, h); } }, true);
  sandTex.wrapS = THREE.MirroredRepeatWrapping;
  const bSand = surf({ map: sandTex, roughness: 1, envMapIntensity: 0.25 }); bSand.polygonOffset = true; bSand.polygonOffsetFactor = 1; bSand.polygonOffsetUnits = 2; // rue en sable (raccourci)
  for (const br of BR) {
    ribbonPath(br, -BHALF, BHALF, 0.05, br.sand ? bSand : bRoad, BHALF, 2);
    const sc = (x, z) => latMain(x, z) < HALF + CURB_W + 0.4, sr = (x, z) => latMain(x, z) < WALL + 1.2, sw = (x, z) => latMain(x, z) < WALL + 7.5;
    ribbonPath(br, BHALF, BHALF + CURB_W, 0.07, bCurb, 6, 1, sc); ribbonPath(br, -BHALF - CURB_W, -BHALF, 0.07, bCurb, 6, 1, sc);
    ribbonPath(br, BHALF + CURB_W, BW + 0.8, -0.02, runMat, 14, 1, sr); ribbonPath(br, -BW - 0.8, -BHALF - CURB_W, -0.02, runMat, 14, 1, sr);
    if (!RT) { ribbonPath(br, BW + 0.8, BW + 6, 0.06, walkMat, 7, 1, sw); ribbonPath(br, -BW - 6, -BW - 0.8, 0.06, walkMat, 7, 1, sw); }
  }
}
const BBOX = (() => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (let i = 0; i < N; i++) { a = Math.min(a, PX[i]); b = Math.max(b, PX[i]); c = Math.min(c, PZ[i]); d = Math.max(d, PZ[i]); } return [a, b, c, d]; })();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6400, 5200), surf({ map: groundTex, roughness: 1, envMapIntensity: 0.25 }));
ground.rotation.x = -Math.PI / 2; ground.position.set((BBOX[0] + BBOX[1]) / 2, -0.05, (BBOX[2] + BBOX[3]) / 2); ground.receiveShadow = true; ground.renderOrder = -1; ground.material.depthWrite = false; scene.add(ground); // dessiné en premier, n'écrit pas la profondeur : jamais de sable qui traverse la route
// Océan Atlantique et plage à l'ouest de la ville
const OCEAN_X = RT ? -2990 : BBOX[0] - 130;
const oceanTex = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#1f5f7a', 0.12, 9000); c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 2; for (let i = 0; i < 40; i++) { const y = Math.random() * h, x = Math.random() * w; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 12, y - 4, x + 26, y); c.stroke(); } }, true);
oceanTex.repeat.set(60, 120);
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(3000, 6000), surf({ map: oceanTex, color: 0xffffff, roughness: 0.18, metalness: 0.25, envMapIntensity: 1.1 }));
ocean.rotation.x = -Math.PI / 2; ocean.position.set(OCEAN_X - 1500, 0.25, (BBOX[2] + BBOX[3]) / 2); scene.add(ocean);
const beachTex = canvasTex(64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f2f6f8'); g.addColorStop(0.18, '#bfd9dc'); g.addColorStop(0.35, '#c9a978'); g.addColorStop(1, '#e3c793'); c.fillStyle = g; c.fillRect(0, 0, w, h); noise(c, w, h, 'rgba(0,0,0,0)', 0.1, 1500); }, false);
const beach = new THREE.Mesh(new THREE.PlaneGeometry(70, 6000), surf({ map: beachTex, roughness: 1 }));
beach.rotation.x = -Math.PI / 2; beach.position.set(OCEAN_X + 33, 0.32, (BBOX[2] + BBOX[3]) / 2); scene.add(beach);

// distance d'affichage par type d'objet (les détails disparaissent au loin, la silhouette reste)
const DCULL = [], DSCALE = LOW ? 0.7 : HIQ ? 2.2 : 1;
function updateDistCull() { const p = camera.position, p2 = player2 ? camera2.position : null; for (const d of DCULL) d.m.visible = Math.min(p.distanceTo(d.c), p2 ? p2.distanceTo(d.c) : Infinity) - d.r < d.d; }
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
    im.castShadow = !!opt.cast; im.receiveShadow = !!opt.receive; im.name = opt.name || '';
    (opt.parent || scene).add(im); out.push(im);
    if (opt.maxD) (opt.cull || DCULL).push({ m: im, c: sph.center.clone(), r: sph.radius, d: opt.maxD });
  }
  return out;
}
// Murs de pneus (avec ouvertures aux raccourcis)
{
  const list = [];
  const walk = (P, off, skip) => {
    for (const side of [1, -1]) {
      let acc = 0, lx = null, lz = null, n = 0;
      const cnt = P.closed ? P.M : P.M;
      for (let i = 0; i < cnt; i++) {
        const x = P.X[i] + P.NX[i] * off * side, z = P.Z[i] + P.NZ[i] * off * side;
        if (lx !== null) acc += Math.hypot(x - lx, z - lz);
        lx = x; lz = z;
        if (acc >= (RT ? 1.3 : 1.25)) { acc = 0; if (!skip(x, z) && !(P === MAIN && EL[i] > 0.6)) list.push([x, z, n, P === MAIN ? EL[i] : 0, Math.atan2(-P.NZ[i], P.NX[i])]); n++; }
      }
    }
  };
  walk(MAIN, WALL, (x, z) => inBranch(x, z, BW + 0.6));
  for (const br of BR) walk(br, BW, (x, z) => latMain(x, z) < WALL + 0.6 || BR.some(o => o !== br && (nearestBr(o, x, z) || { d: 99 }).d < BW + 0.6));
  const geo = LOW ? new THREE.CylinderGeometry(0.62, 0.62, 1, 7, 1, true) : LITE ? new THREE.CylinderGeometry(0.62, 0.62, 0.5, 8, 1, true) : new THREE.CylinderGeometry(0.62, 0.62, 0.5, 12);
  const mats = [], cols = [];
  if (RT) { // rues fermées par des glissières rouges et blanches, comme un vrai circuit en ville
    const bg = new THREE.BoxGeometry(0.62, 0.95, 1.26), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    list.forEach(([x, z, k, e, rot]) => { mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.475 + e, z), q.setFromAxisAngle(Y, rot), one)); cols.push(new THREE.Color(Math.floor(k / 2) % 2 ? 0xd62828 : 0xf2f2f2)); });
    addInstanced(bg, surf({ roughness: 0.7, envMapIntensity: 0.3 }), mats, cols, { cast: !LITE, receive: !LOW, cell: 140, name: 'tires', maxD: 320 * DSCALE });
  } else
  list.forEach(([x, z, k, e]) => {
    const levels = LOW ? 1 : 2;
    for (let l = 0; l < levels; l++) {
      mats.push(new THREE.Matrix4().makeTranslation(x, (LOW ? 0.5 : 0.25 + l * 0.5) + e, z));
      cols.push(new THREE.Color(Math.floor(k / 3) % 2 === 0 ? (l ? 0xf2f2f2 : 0x1a1a1a) : (l ? 0x1a1a1a : 0xd62828)));
    }
  });
  if (!RT) addInstanced(geo, surf({ roughness: 0.85, envMapIntensity: 0.3, side: THREE.DoubleSide }), mats, cols, { cast: !LITE, receive: !LOW, cell: 140, name: 'tires', maxD: 300 * DSCALE });
}
// Quartiers / avenues de Nouakchott (sections nommées du circuit)
const STREETS = (RT ? RT.streets.map(st => ({ from: st.frm, name: st.name, ar: st.ar })) : [
  { from: 'start', name: 'Route de la Plage', ar: 'طريق الشاطئ' },
  { from: 'moktar', name: 'Avenue Moktar Ould Daddah', ar: 'شارع المختار ولد داداه' },
  { from: 'citesmar', d: -60, name: 'Carrefour Cité Smar', ar: 'ملتقى سيتي سمار' },
  { from: 'elquods', d: -40, name: 'Avenue El Quods', ar: 'شارع القدس' },
  { from: 'm2', d: -30, name: 'Avenue Charles de Gaulle', ar: 'شارع شارل ديغول' },
  { from: 'bmd', d: -45, name: 'Carrefour BMD', ar: 'ملتقى BMD' },
  { from: 'gan', d: -30, name: 'Avenue Gamal Abdel Nasser', ar: 'شارع جمال عبد الناصر' },
  { from: 'bridgeA', name: 'Autopont du Carrefour Madrid', ar: 'جسر ملتقى مدريد' },
  { from: 'bridgeB', d: 10, name: 'Avenue du Roi Fayçal', ar: 'شارع الملك فيصل' },
  { from: 'bamako', d: -95, name: 'Carrefour Bamako', ar: 'ملتقى باماكو' },
  { from: 'm3', name: 'PK10 · Marché', ar: 'الكيلومتر 10 · السوق' },
  { from: 'rosso', d: -60, name: 'Route de Rosso', ar: 'طريق روصو' },
  { from: 'elmina', d: -80, name: 'El Mina', ar: 'الميناء' },
  { from: 'sebkha', d: -80, name: 'Sebkha', ar: 'السبخة' },
  { from: 'plage', d: -60, name: 'Route du Port de Pêche', ar: 'طريق ميناء الصيد' },
]).map(st => Object.assign(st, { from: idxWrap(TAG[st.from] + (st.d || 0)) }));
STREETS.forEach((st, k) => { st.to = STREETS[(k + 1) % STREETS.length].from; });
function streetAt(i) { for (const s of STREETS) { if (s.from < s.to ? (i >= s.from && i < s.to) : (i >= s.from || i < s.to)) return s; } return STREETS[0]; }
// Bouteilles de nitro posées sur la route
const BOTTLES = [];
{
  const pat = [-11, 4, 12, -4, 0, -13, 9].map(v => Math.round(v * HALF / 20));
  for (let i = 95, k = 0; i < N - 60; i += 128, k++) if (EL[i] === 0 && EL[idxWrap(i + 30)] === 0) BOTTLES.push({ x: 0, z: 0, i, lat: pat[k % pat.length] });
  for (const b of BOTTLES) { b.x = PX[b.i] + NX[b.i] * b.lat; b.z = PZ[b.i] + NZ[b.i] * b.lat; }
  for (const br of BR) for (const f of [0.42, 0.62]) { const k = Math.round(br.M * f); BOTTLES.push({ x: br.X[k], z: br.Z[k], br: true }); }
  for (const b of BOTTLES) { b.t = 0; b.ph = Math.random() * 6; }
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
    c.fillStyle = '#fff'; c.font = 'italic 70px "Russo One", Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DRIFT ZONE · NOUAKCHOTT', w / 2, h / 2 + 4);
  });
  const bm = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.35 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 6, 2, 0.6), [pm, pm, pm, pm, bm, bm]);
  beam.position.y = 8.4; beam.castShadow = true; g.add(beam);
  scene.add(g);
}
function gridSlot(k) {
  const row = Math.floor(k / 2), col = k % 2;
  const back = 10 + row * 10 + col * 4;
  const i = idxWrap(-Math.round(back / SEG));
  const lat = (col ? -1 : 1) * 7;
  return { i, x: PX[i] + NX[i] * lat, z: PZ[i] + NZ[i] * lat, h: Math.atan2(TX[i], TZ[i]) };
}

/* ======================= Chargement des assets ======================= */
const ASSETS = {};
const assetWait = {};
const gltfLoader = THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
function loadAsset(key, cb, onProg) {
  if (ASSETS[key] !== undefined) { cb && cb(ASSETS[key]); return; }
  if (assetWait[key]) { if (cb) assetWait[key].push(cb); return; }
  assetWait[key] = cb ? [cb] : [];
  const done = v => { ASSETS[key] = v; const l = assetWait[key]; delete assetWait[key]; for (const f of l) f(v); };
  if (!gltfLoader) { done(null); return; }
  gltfLoader.load('assets/' + key + '.' + EXT, g => done(g.scene), x => onProg && x.total && onProg(x.loaded / x.total), e => { console.warn('asset', key, e); done(null); });
}
const carKey = (id, lod) => { const d = carDef(id); if (lod === 'hi' && d.hi && !LOW) return d.hi; if (LOW && d.xlo) return d.xlo; return d.lo; };
function loadAll(onDone) {
  const J = EXT === 'glb' ? 0.75 : 1;
  const want = [[carKey(prof.car, 'hi'), 2.5], ['city', 3.9 * J], ['mrt', 3], LOW ? null : ['lm', 3.8], [LITE ? 'fans_lo' : 'fans', (LITE ? 0.17 : 0.72) * J]]
    .concat(CARS.map(c => [LOW && c.xlo ? c.xlo : c.lo, 0.5])).filter(Boolean);
  const seen = new Set(), files = want.filter(([k]) => !seen.has(k) && seen.add(k));
  const total = files.reduce((a, f) => a + f[1], 0), prog = {};
  const upd = () => { const v = Object.values(prog).reduce((a, b) => a + b, 0) / total; $('loadBar').firstElementChild.style.width = (v * 100).toFixed(0) + '%'; };
  let left = files.length;
  files.forEach(([key, mb]) => loadAsset(key, () => { prog[key] = mb; upd(); if (--left === 0) onDone(); }, f => { prog[key] = mb * f; upd(); }));
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
  if (name === 'Caliper') return CM.red;
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
  const hasUV = !colorOf && parts.every(p => p.geo.attributes.uv);
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), col = colorOf ? new Float32Array(nV * 3) : null, idx = new Uint32Array(nI), uvs = hasUV ? new Float32Array(nV * 2) : null;
  let vo = 0, io = 0; const ranges = [];
  for (const { geo, m, mat } of parts) {
    const P = geo.attributes.position, Nn = geo.attributes.normal, UV = geo.attributes.uv; _m3.getNormalMatrix(m);
    const c = colorOf ? colorOf(mat) : null;
    for (let i = 0; i < P.count; i++) {
      _mv.fromBufferAttribute(P, i).applyMatrix4(m); pos[(vo + i) * 3] = _mv.x; pos[(vo + i) * 3 + 1] = _mv.y; pos[(vo + i) * 3 + 2] = _mv.z;
      if (Nn) { _mn.fromBufferAttribute(Nn, i).applyMatrix3(_m3).normalize(); nor[(vo + i) * 3] = _mn.x; nor[(vo + i) * 3 + 1] = _mn.y; nor[(vo + i) * 3 + 2] = _mn.z; }
      if (c) { col[(vo + i) * 3] = c.r; col[(vo + i) * 3 + 1] = c.g; col[(vo + i) * 3 + 2] = c.b; }
      if (uvs) { uvs[(vo + i) * 2] = UV.getX(i); uvs[(vo + i) * 2 + 1] = UV.getY(i); }
    }
    if (geo.index) for (let k = 0; k < geo.index.count; k++) idx[io + k] = geo.index.getX(k) + vo;
    else for (let k = 0; k < P.count; k++) idx[io + k] = vo + k;
    ranges.push({ mat, start: vo, count: P.count });
    vo += P.count; io += geo.index ? geo.index.count : P.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
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
const bakedMat = LOW ? new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x101216 }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.35, envMapIntensity: 1 });
function setCarPaint(model, hex) {
  const c = lin(hex);
  model.paint.color.copy(c);
  if (model.bakedBody) {
    const g = model.bakedBody.geometry, col = g.attributes.color;
    const k = c.clone().multiplyScalar(LOW ? 1.7 : 1); k.r = Math.min(1, k.r + 0.03); k.g = Math.min(1, k.g + 0.03); k.b = Math.min(1, k.b + 0.03);
    for (const r of g.userData.ranges) if (r.mat === model.paint) for (let i = r.start; i < r.start + r.count; i++) col.setXYZ(i, k.r, k.g, k.b);
    col.needsUpdate = true;
  }
}
const flameMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const flameGeo = new THREE.ConeGeometry(0.13, 1.0, 10, 1, true); flameGeo.rotateX(-Math.PI / 2); flameGeo.translate(0, 0, -0.5);
const blobTex = canvasTex(64, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.setTransform(1, 0, 0, 2, 0, 0); c.fillStyle = g; c.fillRect(0, 0, w, h / 2); });
const texMats = {};
const texMat = m => texMats[m.map.uuid] || (texMats[m.map.uuid] = (m.name === 'Livery' && !LOW) ? new THREE.MeshPhysicalMaterial({ map: m.map, roughness: 0.32, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.08 }) : std({ map: m.map, roughness: 0.4, metalness: 0.15, envMapIntensity: 0.9 }));
const glowSpriteTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const headGlowMat = new THREE.SpriteMaterial({ map: glowSpriteTex, color: 0xfff1d6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
const tailGlowMat = new THREE.SpriteMaterial({ map: glowSpriteTex, color: 0xff2a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75 });
function buildCar(carId, lod, paintHex, rimHex, ghost, noBake) {
  const def = carDef(carId);
  const src = ASSETS[carKey(carId, lod)] || ASSETS[def.lo] || ASSETS[def.xlo] || ASSETS.audi_lo || ASSETS.audi_xlo;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = LOW ? std({ color: lin(paintHex), metalness: 0.35, roughness: 0.32 }) : new THREE.MeshPhysicalMaterial({ color: lin(paintHex), metalness: 0.3, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.12 });
  const tail = std({ color: 0x2a0000, emissive: 0xff1a1a, emissiveIntensity: 0.8 });
  const rim = rimMat(rimHex);
  const wheels = [], rimMeshes = []; let bakedBody = null;
  const ghostMat = ghost ? new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.28, depthWrite: false }) : null;
  const box = new THREE.Box3(new THREE.Vector3(-1, 0, -2.45), new THREE.Vector3(1, 1.6, 2.45));
  if (src) {
    const sc = src.clone(true);
    sc.traverse(o => { if (o.isMesh) { o.material = ghost ? ghostMat : (o.material.map ? texMat(o.material) : mapMat(o.material.name || '', paint, rim, tail)); o.castShadow = !ghost; o.receiveShadow = false; } });
    for (const key of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) {
      const node = sc.getObjectByName(key);
      if (!node) continue;
      const pivot = new THREE.Group(); pivot.position.copy(node.position); node.position.set(0, 0, 0);
      node.parent.remove(node); pivot.add(node); root.add(pivot);
      wheels.push({ pivot, spin: node, front: key[6] === 'F' });
    }
    body.add(sc);
    {
      const bake = LITE && lod !== 'hi' && !ghost && def.paint && !noBake;
      const bodyMeshes = compactNode(sc, bake);
      for (const w of wheels) compactNode(w.spin, bake);
      if (bake) bakedBody = bodyMeshes[0];
      body.traverse(o => { if (o.isMesh) { o.castShadow = !ghost; if (o.material === rim) rimMeshes.push(o); } });
      for (const w of wheels) w.spin.traverse(o => { if (o.isMesh) { o.castShadow = !ghost; if (o.material === rim) rimMeshes.push(o); } });
    }
    box.setFromObject(sc);
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
  const W = (box.max.x - box.min.x) / 2, Hh = box.max.y - box.min.y;
  const flames = [];
  if (!ghost) for (const s of [1, -1]) { const f = new THREE.Mesh(flameGeo, flameMat); f.position.set(s * Math.min(0.52, W * 0.5), Math.max(0.35, box.min.y + Hh * 0.28), box.min.z + 0.05); f.visible = false; body.add(f); flames.push(f); }
  const glows = [];
  if (!ghost) for (const s of [1, -1]) {
    const hg = new THREE.Sprite(headGlowMat); hg.position.set(s * (W - 0.35), box.min.y + Hh * 0.42, box.max.z + 0.05); hg.scale.set(1.5, 1.5, 1); hg.visible = false; body.add(hg); glows.push(hg);
    const tg = new THREE.Sprite(tailGlowMat); tg.position.set(s * (W - 0.3), box.min.y + Hh * 0.5, box.min.z - 0.03); tg.scale.set(0.9, 0.9, 1); tg.visible = false; body.add(tg); glows.push(tg);
  }
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(3, 6.2), new THREE.MeshBasicMaterial({ map: blobTex, color: 0, transparent: true, opacity: ghost ? 0.15 : 0.6, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.09; blob.scale.set(W / 1, (box.max.z - box.min.z) / 4.9, 1); root.add(blob);
  const model = { root, body, paint, tail, wheels, flames, glows, rimMeshes, bakedBody, carId, box, paintable: def.paint };
  if (bakedBody) setCarPaint(model, paintHex);
  if (glows.length) for (const g of glows) g.visible = prof.night;
  return model;
}

/* ======================= Dégâts : carrosserie cabossée, rayures, éclats ======================= */
const _dv = new THREE.Vector3(), _dp = new THREE.Vector3(), _dd = new THREE.Vector3(), _dm = new THREE.Matrix4(), _dn = new THREE.Matrix3();
const RUST = new THREE.Color(0.42, 0.3, 0.22);
function dentModel(model, wx, wy, wz, dx, dz, power) { // point d'impact (monde), direction de l'enfoncement, vitesse du choc
  const root = model && model.root; if (!root) return;
  const amt = clamp((power - 3) * 0.028, 0, 0.34); if (amt <= 0) return;
  model.damage = Math.min(1, (model.damage || 0) + amt * 1.4);
  root.updateMatrixWorld(true);
  const rad = 0.75 + amt * 3.2, dl = Math.hypot(dx, dz) || 1;
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
    if (o.geometry.type === 'PlaneGeometry' || /^Wheel_/.test(o.name) || (o.parent && /^Wheel_/.test(o.parent.name)) || (o.material && o.material.transparent && !o.material.depthWrite)) return;
    if (!o.userData.dmg) { // copie privée (le modèle d'origine reste intact pour les autres voitures)
      o.userData.dmg = { geo: o.geometry, mat: o.material };
      const g = o.geometry.clone(); const n = g.attributes.position.count, col = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      o.geometry = g; o.material = Array.isArray(o.material) ? o.material.map(m => { const c = m.clone(); c.vertexColors = true; return c; }) : (() => { const c = o.material.clone(); c.vertexColors = true; return c; })();
    }
    const inv = _dm.copy(o.matrixWorld).invert(), sc = o.matrixWorld.getMaxScaleOnAxis() || 1;
    _dp.set(wx, wy, wz).applyMatrix4(inv); _dn.setFromMatrix4(inv); _dd.set(dx / dl, 0, dz / dl).applyMatrix3(_dn).normalize();
    const P = o.geometry.attributes.position, C = o.geometry.attributes.color, r = rad / sc, push = amt / sc; let touched = false;
    for (let i = 0; i < P.count; i++) {
      _dv.fromBufferAttribute(P, i); const d = _dv.distanceTo(_dp); if (d > r) continue;
      const f = (1 - d / r); const ff = f * f; touched = true;
      P.setXYZ(i, _dv.x + _dd.x * push * ff + (Math.random() - 0.5) * push * 0.5 * f, _dv.y + _dd.y * push * ff - push * 0.3 * ff + (Math.random() - 0.5) * push * 0.3 * f, _dv.z + _dd.z * push * ff + (Math.random() - 0.5) * push * 0.5 * f);
      const k = Math.min(0.88, (f * 0.35 + ff * 0.65) * (0.6 + amt * 2.4)), g2 = 0.55 + Math.random() * 0.6; // rouille irrégulière + éraflures sombres
      C.setXYZ(i, lerp(C.getX(i), RUST.r * g2, k), lerp(C.getY(i), RUST.g * g2, k), lerp(C.getZ(i), RUST.b * g2, k));
    }
    if (touched) { P.needsUpdate = true; C.needsUpdate = true; o.geometry.computeBoundingSphere(); }
  });
}
function repairModel(model) {
  if (!model || !model.root) return; model.damage = 0;
  model.root.traverse(o => { if (o.isMesh && o.userData.dmg) { o.geometry.dispose(); o.geometry = o.userData.dmg.geo; o.material = o.userData.dmg.mat; o.userData.dmg = null; } });
}
// éclats : étincelles (points) + morceaux de plastique / verre (petites boîtes qui tombent)
const crashFx = (() => {
  const NS = LOW ? 60 : 160, ND = LOW ? 24 : 60;
  const sp = new Float32Array(NS * 3).fill(-9999), sv = new Float32Array(NS * 3), sl = new Float32Array(NS);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ map: glowSpriteTex, color: 0xffb347, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sparks.frustumCulled = false; scene.add(sparks);
  const dg = new THREE.BoxGeometry(0.12, 0.04, 0.09);
  const deb = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.5, metalness: 0.3 }), ND); deb.frustumCulled = false; deb.castShadow = false; scene.add(deb);
  const D = []; for (let k = 0; k < ND; k++) { D.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, w: 0, t: 0, c: new THREE.Color() }); deb.setMatrixAt(k, new THREE.Matrix4().makeScale(0, 0, 0)); deb.setColorAt(k, new THREE.Color(1, 1, 1)); }
  let si = 0, di = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), s1 = new THREE.Vector3();
  const COLS = [0x111111, 0x1a1a1a, 0xc9d6df, 0x9aa3ad, 0xb3121b, 0xf2f2f2];
  const f = (x, y, z, nx, nz, power, col) => {
    const n = Math.min(40, 6 + power * 2.2);
    for (let k = 0; k < n; k++) { const i = si = (si + 1) % NS; sp[i * 3] = x; sp[i * 3 + 1] = y; sp[i * 3 + 2] = z; const sd = (Math.random() - 0.5) * 2; sv[i * 3] = nx * (2 + Math.random() * 5) - nz * sd * 4; sv[i * 3 + 1] = 1 + Math.random() * 4; sv[i * 3 + 2] = nz * (2 + Math.random() * 5) + nx * sd * 4; sl[i] = 0.3 + Math.random() * 0.4; }
    const nd = Math.min(14, Math.round(power * 0.9));
    for (let k = 0; k < nd; k++) { const d = D[di = (di + 1) % ND]; Object.assign(d, { x, y, z, vx: nx * (1 + Math.random() * 3) + (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 3, vz: nz * (1 + Math.random() * 3) + (Math.random() - 0.5) * 3, rx: Math.random() * 6, ry: Math.random() * 6, w: 6 + Math.random() * 10, t: 6 }); d.c.setHex(k % 3 === 0 && col !== undefined ? col : COLS[Math.floor(Math.random() * COLS.length)]); deb.setColorAt(di, d.c); }
    deb.instanceColor.needsUpdate = true; f.active = 7;
  };
  f.update = dt => {
    if (!f.active) return; f.active = Math.max(0, f.active - dt);
    for (let i = 0; i < NS; i++) { if (sl[i] <= 0) continue; sl[i] -= dt; sv[i * 3 + 1] -= 14 * dt; sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] = Math.max(0.03, sp[i * 3 + 1] + sv[i * 3 + 1] * dt); sp[i * 3 + 2] += sv[i * 3 + 2] * dt; if (sl[i] <= 0) sp[i * 3 + 1] = -9999; }
    sg.attributes.position.needsUpdate = true;
    for (let k = 0; k < ND; k++) { const d = D[k]; if (d.t <= 0) continue; d.t -= dt; if (d.y > 0.03) { d.vy -= 12 * dt; d.x += d.vx * dt; d.y = Math.max(0.03, d.y + d.vy * dt); d.z += d.vz * dt; d.rx += d.w * dt; d.ry += d.w * 0.7 * dt; if (d.y <= 0.03) { d.vx *= 0.3; d.vz *= 0.3; d.w = 0; } }
      const sc = d.t > 0 ? Math.min(1, d.t) : 0; m4.compose(pv.set(d.x, d.y, d.z), q.setFromEuler(e.set(d.rx, d.ry, 0)), s1.set(sc, sc, sc)); deb.setMatrixAt(k, m4); }
    deb.instanceMatrix.needsUpdate = true;
  };
  f.clear = () => { sl.fill(0); sp.fill(-9999); for (const d of D) d.t = 0; f.active = 0.1; };
  return f;
})();
function carHit(c, power) { // choc d'une voiture « à modèle » : bosse + éclats + secousse
  if (!c || !c.model || power < 4 || !c.hitP) return;
  const [x, z, nx, nz] = c.hitP, y = 0.55;
  dentModel(c.model, x, y, z, -nx, -nz, power);
  crashFx(x, y, z, nx, nz, power, c.color);
  if (c.isPlayer || c.isP2) camShake = Math.max(camShake, Math.min(1.2, power / 10));
}

/* ======================= Nouakchott : monuments, panneaux, palmiers ======================= */
const NIGHT_MATS = [], FIXED_TEX = new WeakSet(); // matériaux qui s'illuminent la nuit : { m, day, night, col }
const nightReg = (m, day, night, col) => { m.emissive = new THREE.Color(col || 0xffffff); NIGHT_MATS.push({ m, day, night }); m.emissiveIntensity = prof.night ? night : day; return m; };
const LM_PLACED = [];
const LAMPS = []; // têtes de lampadaires (pour l'éclairage de nuit)
let flagTime = { value: 0 };
const facadeCache = {};
function facadeMat(key, o) {
  if (facadeCache[key]) return facadeCache[key];
  const cols = o.cols || 4, rows = o.rows || 4, W = 256, H = 256, cw = W / cols, rh = H / rows;
  const rnd = (() => { let s = key.length * 977 + 13; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const lit = [];
  const map = canvasTex(W, H, (c) => {
    c.fillStyle = o.wall; c.fillRect(0, 0, W, H); noise(c, W, H, 'rgba(0,0,0,0)', 0.06, 2500);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const px = x * cw, py = y * rh;
      if (o.style === 'glass') { c.fillStyle = o.win; c.fillRect(px + 2, py + 3, cw - 4, rh - 6); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(px + 2, py + 3, cw * 0.4, rh - 6); }
      else if (o.style === 'arch') { c.fillStyle = o.win; c.beginPath(); const ax = px + cw * 0.22, aw = cw * 0.56, top = py + rh * 0.25; c.moveTo(ax, py + rh * 0.92); c.lineTo(ax, top + aw / 2); c.arc(ax + aw / 2, top + aw / 2, aw / 2, Math.PI, 0); c.lineTo(ax + aw, py + rh * 0.92); c.fill(); }
      else { c.fillStyle = o.win; c.fillRect(px + cw * 0.18, py + rh * 0.22, cw * 0.64, rh * 0.56); if (o.balcony) { c.fillStyle = o.balcony; c.fillRect(px + cw * 0.12, py + rh * 0.74, cw * 0.76, rh * 0.08); } }
      lit.push(rnd() < (o.lit === undefined ? 0.55 : o.lit));
    }
    if (o.band) { c.fillStyle = o.band; for (let y = 0; y < rows; y++) c.fillRect(0, y * rh, W, 5); }
  }, true);
  const emi = canvasTex(W, H, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    let k = 0;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (lit[k++]) { const px = x * cw, py = y * rh; c.fillStyle = ['#ffd9a0', '#fff1d0', '#ffc27a', '#d8ecff'][(x + y * 3) % 4]; if (o.style === 'arch') c.fillRect(px + cw * 0.22, py + rh * 0.35, cw * 0.56, rh * 0.55); else c.fillRect(px + (o.style === 'glass' ? 2 : cw * 0.18), py + rh * 0.22, o.style === 'glass' ? cw - 4 : cw * 0.64, rh * 0.56); }
    }
  }, true);
  const m = surf({ map, roughness: o.style === 'glass' ? 0.25 : 0.85, metalness: o.style === 'glass' ? 0.4 : 0, envMapIntensity: o.style === 'glass' ? 1 : 0.4 });
  m.emissiveMap = emi; nightReg(m, 0, 0.9, 0xffffff);
  m.userData.cell = [o.cellW || 3.6, o.cellH || 3.4];
  return (facadeCache[key] = m);
}
function scaleBoxUV(g, w, h, d, cw, ch) {
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / (cw * 4), uv.getY(i) * dims[f][1] / (ch * 4)); }
  uv.needsUpdate = true;
}
// fusionne tous les maillages d'un groupe par matériau (beaucoup moins d'appels de dessin)
function mergeGroup(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), buckets = new Map(), olds = [];
  g.traverse(o => {
    if (!o.isMesh || o.material === flagMat || o.isInstancedMesh) return;
    olds.push(o);
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), geo = o.geometry, n = geo.index ? geo.index.count : geo.attributes.position.count;
    const groups = Array.isArray(o.material) ? (geo.groups.length ? geo.groups : [{ start: 0, count: n, materialIndex: 0 }]) : [{ start: 0, count: n, materialIndex: -1 }];
    for (const gr of groups) { const mat = gr.materialIndex < 0 ? o.material : o.material[gr.materialIndex]; if (!mat) continue; if (!buckets.has(mat)) buckets.set(mat, []); buckets.get(mat).push({ geo, m, start: gr.start, count: Math.min(gr.count, n - gr.start) }); }
  });
  for (const o of olds) o.parent.remove(o);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const [mat, list] of buckets) {
    let tot = 0; for (const it of list) tot += it.count;
    const pos = new Float32Array(tot * 3), nor = new Float32Array(tot * 3), uv = new Float32Array(tot * 2); let o = 0;
    for (const it of list) {
      const P = it.geo.attributes.position, Nn = it.geo.attributes.normal, U = it.geo.attributes.uv, I = it.geo.index; nm.getNormalMatrix(it.m);
      for (let k = it.start; k < it.start + it.count; k++, o++) {
        const i = I ? I.getX(k) : k;
        v.fromBufferAttribute(P, i).applyMatrix4(it.m); pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
        if (Nn) { v.fromBufferAttribute(Nn, i).applyMatrix3(nm).normalize(); nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z; }
        if (U) { uv[o * 2] = U.getX(i); uv[o * 2 + 1] = U.getY(i); }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.computeBoundingSphere();
    const me = new THREE.Mesh(geo, mat); me.castShadow = !LITE && !mat.transparent; me.receiveShadow = !LOW; g.add(me);
  }
  return g;
}
const plainMat = (hex, o) => surf(Object.assign({ color: hex, roughness: 0.85, envMapIntensity: 0.4 }, o || {}));
function bbox(grp, w, h, d, fac, roof, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d); const c = fac.userData.cell; if (c) scaleBoxUV(g, w, h, d, c[0], c[1]);
  const m = new THREE.Mesh(g, [fac, fac, roof, roof, fac, fac]); m.position.set(x || 0, (y || 0) + h / 2, z || 0); m.castShadow = !LOW; m.receiveShadow = !LOW; grp.add(m); return m;
}
function prim(grp, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = !LOW; grp.add(m); return m; }
function textTex(lines, o) {
  o = o || {}; const W = o.w || 1024, H = o.h || 256;
  return canvasTex(W, H, c => {
    c.fillStyle = o.bg || '#0b3d91'; c.fillRect(0, 0, W, H);
    if (o.border) { c.strokeStyle = o.border; c.lineWidth = 10; c.strokeRect(8, 8, W - 16, H - 16); }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.fg || '#fff';
    lines.forEach((l, k) => { const sz = l.size || 80; c.font = (l.font || '700 ' + sz + 'px "Russo One", Arial Black, sans-serif').replace('SZ', sz); let tw = c.measureText(l.t).width, ss = Math.min(1, (W - 50) / tw); c.save(); c.translate(W / 2, l.y * H); c.scale(ss, 1); c.fillText(l.t, 0, 0); c.restore(); });
  });
}
function signMesh(grp, tex, w, h, x, y, z, glowN) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissiveMap: tex, side: THREE.DoubleSide });
  nightReg(m, 0.18, glowN === undefined ? 1.1 : glowN);
  const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); grp.add(me); return me;
}
const flagTex = canvasTex(300, 200, (c, w, h) => {
  c.fillStyle = '#00a95c'; c.fillRect(0, 0, w, h); c.fillStyle = '#d01c1f'; c.fillRect(0, 0, w, h * 0.15); c.fillRect(0, h * 0.85, w, h * 0.15);
  c.fillStyle = '#ffd700'; c.beginPath(); c.arc(w / 2, h * 0.47, h * 0.26, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#00a95c'; c.beginPath(); c.arc(w / 2, h * 0.36, h * 0.25, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd700'; c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? h * 0.04 : h * 0.1, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(w / 2 + Math.cos(a) * r, h * 0.34 + Math.sin(a) * r); } c.fill();
});
const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
flagMat.onBeforeCompile = sh => { sh.uniforms.ft = flagTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float ft;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fk = (position.x + 1.5) / 3.0; transformed.z += sin(position.x * 2.2 - ft * 5.0) * 0.28 * fk; transformed.y += sin(position.x * 1.3 - ft * 3.0) * 0.08 * fk;'); };
const flagGeo = new THREE.PlaneGeometry(3, 2, 12, 4); flagGeo.translate(1.5, 0, 0);
const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.7, roughness: 0.35 });
function flagPole(grp, x, z, h) { prim(grp, new THREE.CylinderGeometry(0.09, 0.12, h, 8), poleMat, x, h / 2, z); const f = new THREE.Mesh(flagGeo, flagMat); f.position.set(x + 0.1, h - 1.2, z); grp.add(f); return f; }
/* ======================= Carrefours : giratoires, croisements, autopont ======================= */
const DECO_ROADS = []; // routes décoratives (non roulables) : [x0, z0, x1, z1, demi-largeur]
const segDist = (px, pz, x0, z0, x1, z1) => { const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz; const t = l2 ? clamp(((px - x0) * dx + (pz - z0) * dz) / l2, 0, 1) : 0; return Math.hypot(px - x0 - dx * t, pz - z0 - dz * t); };
const onDecoRoad = (x, z, r) => DECO_ROADS.some(d => segDist(x, z, d[0], d[1], d[2], d[3]) < d[4] + r) || ROUNDABOUTS.some(rb => Math.hypot(x - rb.x, z - rb.z) < rb.R - WALL - 1 + r);
const concreteTex = canvasTex(256, 256, (c, w, h) => { noise(c, w, h, '#cfc8bb', 0.12, 9000); c.strokeStyle = 'rgba(90,85,75,0.35)'; c.lineWidth = 2; for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(0, h - 26, w, 26); }, true);
const concreteMat = surf({ map: concreteTex, roughness: 0.9, envMapIntensity: 0.35, side: THREE.DoubleSide });
function strip(pts, mat) { // bande de quads : pts = [[x, yBas, z, yHaut, u]…]
  const pos = [], uv = [], idx = [];
  pts.forEach(([x, y0, z, y1, u], k) => { pos.push(x, y0, z, x, y1, z); uv.push(u, y0 / 4, u, y1 / 4); if (k) { const a = (k - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = !LITE; m.receiveShadow = !LOW; scene.add(m); return m;
}
function decoRoad(x0, z0, x1, z1, half, mats) {
  const L = Math.hypot(x1 - x0, z1 - z0), M = Math.max(2, Math.ceil(L / 12) + 1), tx = (x1 - x0) / L, tz = (z1 - z0) / L;
  const P = { X: new Float32Array(M), Z: new Float32Array(M), NX: new Float32Array(M).fill(tz), NZ: new Float32Array(M).fill(-tx), M, closed: false };
  for (let k = 0; k < M; k++) { P.X[k] = x0 + (x1 - x0) * k / (M - 1); P.Z[k] = z0 + (z1 - z0) * k / (M - 1); }
  ribbonPath(P, -half, half, 0.03, mats.road, half, 2); ribbonPath(P, half, half + 5, 0.05, mats.walk, 7); ribbonPath(P, -half - 5, -half, 0.05, mats.walk, 7);
  DECO_ROADS.push([x0, z0, x1, z1, half + 6]);
}
function buildJunctions(deco) {
  const mats = { road: surf({ map: asphaltTex, roughness: 0.9, envMapIntensity: 0.4 }), walk: surf({ map: walkTex, roughness: 0.95, envMapIntensity: 0.3 }) };
  const sandMat = surf({ map: walkTex, color: 0xe8d4a8, roughness: 1 }), grassMat = surf({ color: 0x6f9c45, roughness: 1 });
  // giratoires : îlot central, bras non empruntés, anneau complet
  for (const rb of ROUNDABOUTS) {
    const rIs = rb.R - WALL - 1;
    const isl = new THREE.Mesh(new THREE.CircleGeometry(rIs, 48), sandMat); isl.rotation.x = -Math.PI / 2; isl.position.set(rb.x, 0.06, rb.z); isl.receiveShadow = true; scene.add(isl);
    const ring = new THREE.Mesh(new THREE.RingGeometry(rIs * 0.55, rIs * 0.8, 48), grassMat); ring.rotation.x = -Math.PI / 2; ring.position.set(rb.x, 0.08, rb.z); scene.add(ring);
    const g = new THREE.Group(); g.position.set(rb.x, 0, rb.z);
    prim(g, new THREE.CylinderGeometry(rIs * 0.42, rIs * 0.46, 1.1, 32), concreteMat, 0, 0.55, 0); // socle
    if (rb.tag === 'citesmar') { // colonne blanche et coupole verte
      const white = plainMat(0xf6f1e6), green = plainMat(0x1f8a5b, { roughness: 0.5 });
      prim(g, new THREE.CylinderGeometry(1.6, 2.2, 22, 12), white, 0, 12, 0); prim(g, domeGeo(2.6), green, 0, 23, 0); prim(g, new THREE.SphereGeometry(0.5, 8, 6), GOLD, 0, 26, 0);
      for (let k = 0; k < 4; k++) flagPole(g, Math.cos(k * Math.PI / 2) * 9, Math.sin(k * Math.PI / 2) * 9, 11);
    } else { // fontaine et drapeaux
      prim(g, new THREE.CylinderGeometry(6, 6.4, 0.9, 28), plainMat(0x2f7fa3, { roughness: 0.2, metalness: 0.2 }), 0, 1.4, 0);
      prim(g, new THREE.CylinderGeometry(0.8, 1.2, 6, 10), concreteMat, 0, 3.5, 0);
      for (let k = 0; k < 6; k++) flagPole(g, Math.cos(k * Math.PI / 3) * 10, Math.sin(k * Math.PI / 3) * 10, 10);
    }
    deco.add(g);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; PALM_EXTRA.push([rb.x + Math.cos(a) * rIs * 0.68, rb.z + Math.sin(a) * rIs * 0.68]); }
    // bras non empruntés + portion d'anneau non roulable
    for (const arm of [0, 90, 180, 270]) {
      if (rb.arms.some(a => ((a - arm) % 360 + 360) % 360 === 0)) continue;
      const a = arm * Math.PI / 180, r0 = rb.R + 14, r1 = rb.R + 260;
      decoRoad(rb.x + Math.cos(a) * r0, rb.z + Math.sin(a) * r0, rb.x + Math.cos(a) * r1, rb.z + Math.sin(a) * r1, 11, mats);
    }
    const M = 96, P = { X: new Float32Array(M + 1), Z: new Float32Array(M + 1), NX: new Float32Array(M + 1), NZ: new Float32Array(M + 1), M: M + 1, closed: false };
    for (let k = 0; k <= M; k++) { const a = k / M * Math.PI * 2; P.X[k] = rb.x + Math.cos(a) * rb.R; P.Z[k] = rb.z + Math.sin(a) * rb.R; P.NX[k] = Math.cos(a); P.NZ[k] = Math.sin(a); }
    ribbonPath(P, -12, 12, 0.03, mats.road, 12, 2, (x, z) => latMain(x, z) < WALL + 1);
  }
  // carrefour BMD : grand croisement à niveau, feux tricolores
  { const i = TAG.bmd, nx = NX[i], nz = NZ[i];
    const brSide = Math.sign((BR[1].X[Math.round(BR[1].M / 2)] - PX[i]) * nx + (BR[1].Z[Math.round(BR[1].M / 2)] - PZ[i]) * nz); // côté intérieur : c'est la rue Mamadou Konaté (raccourci)
    for (const sd of [1, -1]) if (sd !== brSide) decoRoad(PX[i] + nx * sd * (WALL + 2), PZ[i] + nz * sd * (WALL + 2), PX[i] + nx * sd * (WALL + 280), PZ[i] + nz * sd * (WALL + 280), 13, mats);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), grn = new THREE.MeshBasicMaterial({ color: 0x22e36b }), box = plainMat(0x1c1f24);
    for (const sd of [1, -1]) for (const fw of [1, -1]) {
      const off = (WALL + 3) * sd, x = PX[i] + nx * off + TX[i] * fw * 17, z = PZ[i] + nz * off + TZ[i] * fw * 17, tg = new THREE.Group(); tg.position.set(x, 0, z); tg.rotation.y = Math.atan2(TX[i], TZ[i]) + (fw > 0 ? Math.PI : 0);
      prim(tg, new THREE.CylinderGeometry(0.12, 0.14, 5, 8), poleMat, 0, 2.5, 0); prim(tg, new THREE.BoxGeometry(0.55, 1.5, 0.45), box, 0, 5.4, 0);
      prim(tg, new THREE.SphereGeometry(0.17, 8, 6), red, 0, 5.85, 0.24); prim(tg, new THREE.SphereGeometry(0.17, 8, 6), grn, 0, 4.95, 0.24); deco.add(tg);
    }
  }
  // autopont du carrefour Madrid : rampes en remblai, tablier sur piles, route qui passe dessous
  { const i = TAG.madrid, nx = NX[i], nz = NZ[i], open = Math.round(48 / SEG), WD = HALF + 3.4;
    decoRoad(PX[i] - nx * 300, PZ[i] - nz * 300, PX[i] + nx * 300, PZ[i] + nz * 300, 12, mats);
    const side = sd => { const pts = [], top = [], cap = []; let u = 0;
      for (let k = BRIDGE.a; k <= BRIDGE.b; k++) { const e = EL[k]; if (e <= 0.02 && k > BRIDGE.a + 2 && k < BRIDGE.b - 2) continue; if (k > BRIDGE.a) u += SEG / 4;
        const x = PX[k] + NX[k] * WD * sd, z = PZ[k] + NZ[k] * WD * sd, op = Math.abs(k - i) < open;
        pts.push([x, op ? e - 1.3 : 0, z, e + 1.15, u]); }
      strip(pts, concreteMat); };
    side(1); side(-1);
    for (const sd of [1, -1]) ribbonPath(MAIN, sd > 0 ? HALF + CURB_W : -WD, sd > 0 ? WD : -HALF - CURB_W, 0.06, mats.walk, 7, 1, (x, z) => { const q = nearest(x, z, -1); return EL[q.i] <= 0.6; });
    { // dessous du tablier au-dessus de la route
      const pos = [], idx = []; for (let k = i - open, n = 0; k <= i + open; k++, n++) { const e = EL[k] - 1.3; pos.push(PX[k] - NX[k] * WD, e, PZ[k] - NZ[k] * WD, PX[k] + NX[k] * WD, e, PZ[k] + NZ[k] * WD); if (n) { const a = (n - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); scene.add(new THREE.Mesh(g, concreteMat)); }
    for (const fw of [-1, 1]) for (const lat of [-14, 0, 14]) { const k = i + fw * Math.round(26 / SEG), e = EL[k]; prim(deco, new THREE.CylinderGeometry(1.3, 1.5, e - 1.3, 14), concreteMat, PX[k] + NX[k] * lat, (e - 1.3) / 2, PZ[k] + NZ[k] * lat); }
    const tx = textTex([{ t: 'AUTOPONT CARREFOUR MADRID', y: 0.38, size: 92 }, { t: 'جسر ملتقى مدريد', y: 0.78, size: 70, font: '700 SZpx Arial, sans-serif' }], { bg: '#0b4ea2', fg: '#ffffff', border: '#ffffff', w: 1024, h: 256 });
    for (const sd of [1, -1]) { const g = new THREE.Group(); g.position.set(PX[i] + nx * (WD + 0.15) * sd, EL[i] - 0.1, PZ[i] + nz * (WD + 0.15) * sd); g.rotation.y = Math.atan2(nx * sd, nz * sd); signMesh(g, tx, 18, 4.5, 0, 0, 0, 1); deco.add(g); }
    for (let k = BRIDGE.a + 30; k < BRIDGE.b - 30; k += Math.round(38 / SEG)) for (const sd of [1, -1]) { const x = PX[k] + NX[k] * (WD - 0.4) * sd, z = PZ[k] + NZ[k] * (WD - 0.4) * sd, rot = Math.atan2(-NZ[k] * sd, -NX[k] * sd) + Math.PI; BRIDGE_LAMPS.push([x, EL[k] + 1.15, z, rot]); }
  }
}
const PALM_EXTRA = [], BRIDGE_LAMPS = [];
const domeGeo = r => new THREE.SphereGeometry(r, LOW ? 14 : 28, LOW ? 8 : 14, 0, Math.PI * 2, 0, Math.PI / 2);
function minaret(grp, x, z, h, r, mat, top) {
  prim(grp, new THREE.CylinderGeometry(r, r * 1.15, h, LOW ? 10 : 18), mat, x, h / 2, z);
  prim(grp, new THREE.CylinderGeometry(r * 1.6, r * 1.3, 1.2, LOW ? 10 : 18), mat, x, h * 0.78, z);
  prim(grp, new THREE.CylinderGeometry(r * 0.7, r * 0.8, h * 0.14, LOW ? 8 : 14), mat, x, h + h * 0.07, z);
  prim(grp, new THREE.ConeGeometry(r * 0.85, h * 0.12, LOW ? 8 : 14), top, x, h * 1.2, z);
  prim(grp, new THREE.SphereGeometry(r * 0.25, 8, 6), GOLD, x, h * 1.29, z);
}
const GOLD = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.25 });
const LANDMARKS = {
  snim() { // Tour SNIM : la tour de bureaux de la Société Nationale Industrielle et Minière
    const g = new THREE.Group();
    const glass = facadeMat('snim', { style: 'glass', wall: '#9fb3c3', win: '#20415f', cols: 4, rows: 6, cellW: 3.2, cellH: 3.6, lit: 0.6, band: '#cfd8df' });
    const conc = facadeMat('snimB', { wall: '#e4dccb', win: '#3b4a5a', cols: 4, rows: 2, cellW: 4.5, cellH: 4.2 });
    const roof = plainMat(0x8d939a);
    bbox(g, 44, 9, 36, conc, roof); bbox(g, 26, 92, 22, glass, roof, 0, 9); bbox(g, 28, 4, 24, conc, roof, 0, 101);
    prim(g, new THREE.CylinderGeometry(0.25, 0.35, 16, 6), poleMat, 0, 113, 0);
    const t = textTex([{ t: 'SNIM', y: 0.5, size: 170 }], { bg: '#0d2f6b', w: 512, h: 256 });
    for (const [x, z, ry] of [[0, 12.05, 0], [0, -12.05, Math.PI], [14.05, 0, Math.PI / 2], [-14.05, 0, -Math.PI / 2]]) signMesh(g, t, 14, 6, x, 98, z).rotation.y = ry;
    signMesh(g, textTex([{ t: 'SNIM', y: 0.36, size: 100 }, { t: 'شركة اسنيم', y: 0.76, size: 70, font: '700 SZpx Arial, sans-serif' }], { bg: '#0d2f6b', w: 768, h: 256 }), 12, 4, 0, 6, 18.1, 0.8);
    flagPole(g, -16, 21, 14); flagPole(g, 16, 21, 14);
    return { g, r: 30, d: 36, name: 'Tour SNIM' };
  },
  mosqueSaudi() { // Grande Mosquée (mosquée saoudienne) : minarets élancés
    const g = new THREE.Group();
    const wall = facadeMat('mosS', { style: 'arch', wall: '#efe6d2', win: '#6b5a43', cols: 4, rows: 2, cellW: 4.2, cellH: 6, lit: 0.9 });
    const white = plainMat(0xf6f1e6), green = plainMat(0x1f8a5b, { roughness: 0.5 }), roof = plainMat(0xe9dfc9);
    bbox(g, 48, 13, 44, wall, roof); bbox(g, 22, 5, 22, wall, roof, 0, 13);
    prim(g, domeGeo(10.5), white, 0, 18, 0); prim(g, new THREE.SphereGeometry(0.6, 8, 6), GOLD, 0, 29, 0);
    for (const x of [-21, 21]) minaret(g, x, 19, 46, 1.9, white, green);
    for (const [x, z] of [[-24, -22], [24, -22]]) prim(g, domeGeo(3.2), white, x, 13, z);
    return { g, r: 36, d: 48, name: 'Grande Mosquée' };
  },
  mosqueMaroc() { // Mosquée marocaine : minaret carré, tuiles vertes
    const g = new THREE.Group();
    const wall = facadeMat('mosM', { style: 'arch', wall: '#e2c79a', win: '#5b4630', cols: 4, rows: 2, cellW: 4, cellH: 5.5, lit: 0.85 });
    const tower = facadeMat('mosMt', { style: 'arch', wall: '#dcbf8e', win: '#4e3b28', cols: 2, rows: 4, cellW: 3, cellH: 6, lit: 0.6 });
    const tile = plainMat(0x157347, { roughness: 0.4 }), roof = plainMat(0xd9bd8c);
    bbox(g, 44, 11, 40, wall, roof);
    const pyr = new THREE.ConeGeometry(22, 5, 4); pyr.rotateY(Math.PI / 4); prim(g, pyr, tile, 0, 13.5, 0);
    bbox(g, 8, 40, 8, tower, roof, 18, 0, 16); bbox(g, 5, 7, 5, tower, roof, 18, 40, 16);
    const pt = new THREE.ConeGeometry(3.8, 4, 4); pt.rotateY(Math.PI / 4); prim(g, pt, tile, 18, 49, 16);
    for (let k = 0; k < 3; k++) prim(g, new THREE.SphereGeometry(0.55 - k * 0.12, 8, 6), GOLD, 18, 51.5 + k * 1, 16);
    return { g, r: 32, d: 44, name: 'Mosquée Marocaine' };
  },
  hotel(name, ar, o) {
    const g = new THREE.Group();
    const fac = facadeMat('h_' + name, { wall: o.wall, win: o.win || '#2b3b4c', balcony: o.balcony, cols: 4, rows: 4, cellW: 3.8, cellH: 3.4, lit: 0.6, style: o.style, band: o.band });
    const roof = plainMat(o.roof || 0xbdb4a3);
    bbox(g, o.w, o.h, o.d, fac, roof);
    if (o.wing) { bbox(g, o.wing[0], o.wing[1], o.d * 0.8, fac, roof, -o.w / 2 - o.wing[0] / 2 + 0.5, 0, -o.d * 0.1); }
    if (o.rooftop) { // restaurant panoramique sur le toit
      bbox(g, o.w * 0.45, 4, o.d * 0.5, facadeMat('rt_' + name, { style: 'glass', wall: '#d9d2c3', win: '#304860', cols: 4, rows: 1, cellW: 3, cellH: 4, lit: 1 }), roof, -o.w * 0.15, o.h);
      prim(g, new THREE.BoxGeometry(o.w * 0.6, 0.3, o.d * 0.6), plainMat(0x9a6b45), o.w * 0.12, o.h + 4.2, 0);
    }
    const tx = textTex([{ t: name, y: ar ? 0.38 : 0.5, size: 110 }].concat(ar ? [{ t: ar, y: 0.78, size: 64, font: '700 SZpx Arial, sans-serif' }] : []), { bg: o.signBg || '#1a1a1a', fg: o.signFg || '#ffd27a', w: 1024, h: 256 });
    signMesh(g, tx, Math.min(o.w * 0.8, 30), Math.min(o.w * 0.8, 30) / 4, 0, o.h + (o.rooftop ? 7.5 : 2.4), o.d * (o.rooftop ? 0.1 : 0.32), 1.3);
    signMesh(g, tx, 10, 2.5, 0, 4.2, o.d / 2 + 0.06, 1.3);
    prim(g, new THREE.BoxGeometry(o.w * 0.4, 0.5, 5), plainMat(0xf1ede4), 0, 3, o.d / 2 + 2.5); // auvent d'entrée
    flagPole(g, -o.w * 0.3, o.d / 2 + 6, 10); flagPole(g, o.w * 0.3, o.d / 2 + 6, 10);
    return { g, r: Math.hypot(o.w + (o.wing ? o.wing[0] : 0), o.d) / 2, d: o.d, name };
  },
  palace() { // Palais présidentiel : façade blanche à arcades
    const g = new THREE.Group();
    const fac = facadeMat('palace', { style: 'arch', wall: '#f7f5ef', win: '#3d4c5c', cols: 4, rows: 2, cellW: 4, cellH: 6, lit: 0.8 });
    const roof = plainMat(0xe7e2d6), white = plainMat(0xffffff);
    bbox(g, 80, 12, 34, fac, roof); bbox(g, 26, 18, 24, fac, roof, 0, 0, 8);
    prim(g, domeGeo(8), white, 0, 18, 8);
    for (let k = -3; k <= 3; k++) prim(g, new THREE.CylinderGeometry(0.7, 0.7, 11, 12), white, k * 3.4, 5.5, 21.5);
    prim(g, new THREE.BoxGeometry(26, 1.2, 4), white, 0, 11.4, 21);
    flagPole(g, 0, 8, 34);
    const wallM = plainMat(0xf0ece2); bbox(g, 110, 3, 1, wallM, wallM, 0, 0, 30); // muret d'enceinte
    return { g, r: 56, d: 64, name: 'Palais présidentiel' };
  },
  museum() {
    const g = new THREE.Group();
    const fac = facadeMat('museum', { style: 'arch', wall: '#d8b98a', win: '#5a4228', cols: 4, rows: 2, cellW: 3.6, cellH: 4.6, lit: 0.7, band: '#8c5a2b' });
    const roof = plainMat(0xc9a877);
    bbox(g, 40, 11, 26, fac, roof);
    signMesh(g, textTex([{ t: 'MUSÉE NATIONAL', y: 0.38, size: 96 }, { t: 'المتحف الوطني', y: 0.78, size: 64, font: '700 SZpx Arial, sans-serif' }], { bg: '#5a3416', fg: '#f6e3c1', w: 1024, h: 256 }), 18, 4.5, 0, 13.6, 10, 1);
    flagPole(g, -14, 18, 9); flagPole(g, 14, 18, 9);
    return { g, r: 26, d: 26, name: 'Musée National' };
  },
};
// palmiers (géométrie procédurale, instanciée)
const PALM = (() => { // cocotier : tronc annelé et courbé, palmes découpées (texture à transparence), noix de coco
  const H = 9, RS = LOW ? 6 : 8, HS = LOW ? 4 : 6;
  const trunk = new THREE.CylinderGeometry(0.17, 0.33, H, RS, HS, true); trunk.translate(0, H / 2, 0);
  const tp = trunk.attributes.position, tu = trunk.attributes.uv;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) / H; tp.setX(i, tp.getX(i) + y * y * 1.05); tu.setY(i, y * 9); }
  trunk.computeVertexNormals();
  const parts = [trunk.toNonIndexed()];
  if (!LOW) for (let k = 0; k < 3; k++) { const c = new THREE.IcosahedronGeometry(0.21, 0); const a = k * 2.1; c.translate(1.05 + Math.cos(a) * 0.32, H - 0.45 - (k % 2) * 0.15, Math.sin(a) * 0.32); const u = c.attributes.uv || new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2); for (let q = 0; q < u.count; q++) u.setXY(q, 0.02, 0.02); c.setAttribute('uv', u); parts.push(c.toNonIndexed ? c.toNonIndexed() : c); }
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2); let o = 0;
  for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); UV.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const trunkG = new THREE.BufferGeometry(); trunkG.setAttribute('position', new THREE.BufferAttribute(P, 3)); trunkG.setAttribute('normal', new THREE.BufferAttribute(N, 3)); trunkG.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  // palmes : bandes courbes, la texture dessine la nervure et les folioles
  const pos = [], uv = [], idx = [], nf = LOW ? 8 : 12, segs = LOW ? 4 : 5;
  for (let f = 0; f < nf; f++) {
    const young = f >= nf - 3, a = f / nf * Math.PI * 2 + (f % 2) * 0.25, ca = Math.cos(a), sa = Math.sin(a), base = pos.length / 3;
    const L = young ? 3.2 : 4.4 + (f % 3) * 0.35, lift = young ? 1.6 : 0.7, droop = young ? 0.8 : 2.7 + (f % 2) * 0.5;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, r = t * L, y = H + lift * t - droop * t * t, w = 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.06)) + 0.06;
      const cx = 1.05 + ca * r, cz = sa * r, tilt = 0.18 * w; // les folioles retombent de chaque côté (forme en V)
      pos.push(cx - sa * w, y - tilt, cz + ca * w, cx, y + 0.02, cz, cx + sa * w, y - tilt, cz - ca * w);
      uv.push(0, t, 0.5, t, 1, t);
      if (k < segs) { const q = base + k * 3; idx.push(q, q + 3, q + 1, q + 1, q + 3, q + 4, q + 1, q + 4, q + 2, q + 2, q + 4, q + 5); }
    }
  }
  const crown = new THREE.BufferGeometry(); crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); crown.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); crown.setIndex(idx); crown.computeVertexNormals();
  const barkTex = canvasTex(64, 128, (c, w, h) => { noise(c, w, h, '#7a5c3e', 0.18, 2500); for (let y = 0; y < h; y += 9) { c.fillStyle = 'rgba(40,26,14,0.55)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(190,160,120,0.25)'; c.fillRect(0, y + 3, w, 2); } c.fillStyle = '#3a2614'; c.fillRect(0, 0, 6, 6); }, true);
  const leafTex = canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.lineCap = 'round';
    for (let y = 8; y < h - 6; y += 8) { const t = y / h, len = (w / 2 - 4) * Math.sin(Math.PI * Math.min(1, (1 - t) * 1.05 + 0.08)), d = 10 + t * 16; c.lineWidth = 4.2; c.strokeStyle = (y / 6) % 3 < 1 ? '#3f7424' : (y / 6) % 3 < 2 ? '#4f8a2e' : '#5b9334'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * len * 0.5, y + d * 0.3, w / 2 + s * len, y + d); c.stroke(); } }
    c.strokeStyle = '#6b5a2e'; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
  }, false);
  leafTex.anisotropy = 4;
  const trunkMat = surf({ map: barkTex, color: 0xffffff, roughness: 0.95 });
  const crownMat = LOW ? new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.4 });
  return { trunk: trunkG, crown, trunkMat, crownMat };
})();

/* ======================= Monuments modélisés dans Blender (lm.glb) ======================= */
const LM_META = {"lm_snim":{"w":44,"d":34,"signs":[[0,54.15,10.66,16,1.4,"top"],[0,6.0,20.02,10,1.3,"door"]]},"lm_afarco":{"w":42,"d":15,"signs":[[0,3.4,10.12,14,1.2,"door"],[-14.0,32.0,6.5,12,2.6,"top"]]},"lm_bmd":{"w":32,"d":24,"signs":[[0,12.5,17.55,18,1.0,"top"]]},"lm_fasq":{"w":44,"d":26,"signs":[[0,45.7,9.62,14,1.6,"top"],[0,4.75,18.02,10,1.0,"door"]]},"lm_mauricenter":{"w":50,"d":30,"signs":[[-6,31.2,9.6,18,2.2,"top"],[-8,4.4,19.2,10,1.0,"door"],[-20.5,3.9,15.62,6,1.0,"shop"],[-12.3,3.9,15.62,6,1.0,"shop"],[-4.1,3.9,15.62,6,1.0,"shop"],[4.1,3.9,15.62,6,1.0,"shop"],[12.3,3.9,15.62,6,1.0,"shop"],[20.5,3.9,15.62,6,1.0,"shop"]]},"lm_nkc":{"w":56,"d":16,"signs":[[0,23.3,6.8,22,3.2,"top"],[0,4.9,15.4,9,0.9,"door"]]},"lm_iman":{"w":30,"d":32,"signs":[[0,18.4,7.0,14,2.4,"top"],[0,3.6,11.6,7,0.8,"door"]]},"lm_tasiast":{"w":42,"d":22,"signs":[[0,22.4,8.0,16,2.4,"top"],[0,4.4,15.2,8,0.9,"door"]]},"lm_sheraton":{"w":52,"d":36,"signs":[[0,68.2,11.25,16,2.6,"top"],[0,6.4,25.4,11,1.2,"door"]]},"lm_palais":{"w":86,"d":60,"signs":[[0,13.2,27.3,26,1.4,"top"]]},"lm_marche":{"w":64,"d":36,"signs":[[0,8.1,18.31,22,1.2,"top"]]}};
const LM_STYLE = {
  lm_snim: ['SNIM', 'الشركة الوطنية للصناعة والمناجم', '#0d2f6b', '#ffffff'], lm_afarco: ['IMMEUBLE AFARCO', 'عمارة أفاركو', '#8a1c1c', '#ffffff'],
  lm_bmd: ['BMD', 'البنك الموريتاني للتنمية', '#0b5d3b', '#ffffff'], lm_fasq: ['FASQ HÔTEL', 'فندق فاسك', '#111111', '#e9c46a'],
  lm_mauricenter: ['MAURICENTER', 'موريسنتر', '#13294b', '#f4d58d'], lm_nkc: ['HÔTEL NOUAKCHOTT', 'فندق نواكشوط', '#0b3d2e', '#ffd27a'],
  lm_iman: ['HÔTEL IMAN', 'فندق إيمان', '#5b2a86', '#ffffff'], lm_tasiast: ['HÔTEL TASIAST', 'فندق تازيازت', '#7a1f2b', '#ffffff'],
  lm_sheraton: ['SHERATON NOUAKCHOTT', 'شيراتون نواكشوط', '#1f2a44', '#ffffff'], lm_palais: ['PALAIS DES CONGRÈS', 'قصر المؤتمرات', '#0b4ea2', '#ffffff'],
  lm_marche: ['MARCHÉ CAPITALE', 'سوق العاصمة', '#0b6b3a', '#ffd700'],
};
function prepLMMat(o) {
  const m = o.material; if (!m || m.userData.lm) return; m.userData.lm = true;
  const glass = /_glass$/.test(o.name);
  if (m.map && !FIXED_TEX.has(m.map)) { const tx = m.map; FIXED_TEX.add(tx); tx.minFilter = THREE.LinearMipmapLinearFilter; tx.anisotropy = Math.min(LOW ? 2 : 8, renderer.capabilities.getMaxAnisotropy()); tx.needsUpdate = true; }
  if (!LOW) { m.roughness = glass ? 0.18 : 0.88; m.metalness = glass ? 0.25 : 0; m.envMapIntensity = glass ? 0.9 : 0.35; }
  if (m.emissiveMap) nightReg(m, 0, glass ? 0.85 : 1.05, 0xfff0d8);
}
function glbLM(key) {
  const src = ASSETS.lm && ASSETS.lm.getObjectByName(key), meta = LM_META[key], st = LM_STYLE[key]; if (!src || !meta) return null;
  const g = new THREE.Group(), c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
  c.traverse(o => { if (o.isMesh) { prepLMMat(o); o.castShadow = !LITE; o.receiveShadow = !LOW; } }); g.add(c);
  let shopN = 0;
  for (const [x, y, z, w, h, k] of meta.signs) {
    const H = Math.max(96, Math.min(512, Math.round(1024 * h / w)));
    let lines;
    if (k === 'shop') { const t = SIGN_TEXT.shop[(key.length * 7 + shopN++ * 5) % SIGN_TEXT.shop.length]; lines = [{ t: t[0], y: 0.36, size: H * 0.4 }, { t: t[1], y: 0.76, size: H * 0.32, font: '700 SZpx Arial, sans-serif' }]; }
    else lines = h / w > 0.09 ? [{ t: st[0], y: 0.36, size: H * 0.42 }, { t: st[1], y: 0.76, size: H * 0.32, font: '700 SZpx Arial, sans-serif' }] : [{ t: st[0] + '  ·  ' + st[1], y: 0.54, size: H * 0.6, font: '700 SZpx Arial, sans-serif' }];
    const tx = textTex(lines, { bg: k === 'shop' ? SIGN_COLORS[shopN % SIGN_COLORS.length][0] : st[2], fg: k === 'shop' ? SIGN_COLORS[shopN % SIGN_COLORS.length][1] : st[3], w: 1024, h: H });
    signMesh(g, tx, w, h, x, y, z + 0.04, k === 'top' ? 1.4 : 1.1);
  }
  return { g, r: Math.hypot(meta.w, meta.d) / 2, d: meta.d, name: st[0] };
}
/* ======================= Enseignes de Nouakchott (français + arabe) ======================= */
const MRT_SIGNS = {"mrt_shop1A":[[-6.75,3.56,5.115,3.5,0.95,"shop"],[-2.25,3.56,5.115,3.5,0.95,"shop"],[2.25,3.56,5.115,3.5,0.95,"shop"],[6.75,3.56,5.115,3.5,0.95,"shop"]],"mrt_shop1B":[[-6.75,3.56,5.115,3.5,0.95,"shop"],[-2.25,3.56,5.115,3.5,0.95,"shop"],[2.25,3.56,5.115,3.5,0.95,"shop"],[6.75,3.56,5.115,3.5,0.95,"shop"]],"mrt_shop2A":[[-3.6,3.48,6.115,4.4,1.0,"shop"],[3.6,3.48,6.115,4.4,1.0,"shop"]],"mrt_shop2B":[[-3.6,3.48,6.115,4.4,1.0,"shop"],[3.6,3.48,6.115,4.4,1.0,"shop"]],"mrt_immA":[[-5.2,3.27,7.115,4.0,0.95,"shop"],[0,3.27,7.115,4.0,0.95,"shop"],[5.2,3.27,7.115,4.0,0.95,"shop"]],"mrt_immB":[[-5.2,3.27,7.115,4.0,0.95,"shop"],[0,3.27,7.115,4.0,0.95,"shop"],[5.2,3.27,7.115,4.0,0.95,"shop"]],"mrt_tower":[[-6,3.35,8.115,4.6,1.0,"shop"],[6,3.35,8.115,4.6,1.0,"shop"]],"mrt_mosque":[[-1.5,4.75,7.615,5,0.9,"mosque"]],"mrt_market":[[0,3.35,3.615,5,0.9,"market"]],"mrt_kioskA":[[0,3.15,2.615,3.4,0.75,"shop"]],"mrt_kioskB":[[0,3.15,2.615,3.4,0.75,"shop"]],"mrt_station":[[0,5.6,5.135,10,0.8,"station"],[-9,6.0,6.615,2.0,2.0,"station2"]]};
const SIGN_TEXT = {
  shop: [['FAST-FOOD AHMEDOU', 'مطعم أحمدو السريع'], ['FAST-FOOD LEILA', 'مطعم ليلى السريع'], ['FAST-FOOD AMADOU', 'مطعم أمادو السريع'], ['FAST-FOOD DJIGO', 'مطعم جيغو السريع'],
    ['FAST-FOOD ABDALLAHI', 'مطعم عبد الله السريع'], ['FAST-FOOD ABDOUL MAMADOU', 'مطعم عبدول مامادو'], ['BOUTIQUE SIDI', 'دكان سيدي'], ['ALIMENTATION GÉNÉRALE', 'مواد غذائية عامة'],
    ['QUINCAILLERIE EL FETH', 'خردوات الفتح'], ['PHARMACIE ECHIFA', 'صيدلية الشفاء'], ['BOULANGERIE EL BARAKA', 'مخبزة البركة'], ['SALON DE COIFFURE', 'صالون حلاقة'],
    ['TÉLÉPHONIE & RECHARGE', 'هواتف وتعبئة رصيد'], ["TRANSFERT D'ARGENT", 'تحويل الأموال'], ['CABINET MÉDICAL', 'عيادة طبية'], ['BOUCHERIE MBAREK', 'جزارة امبارك'],
    ['LIBRAIRIE ESSALAM', 'مكتبة السلام'], ['TAILLEUR MODERNE', 'خياطة عصرية'], ['MELHFA & TISSUS', 'ملاحف وأقمشة'], ['RESTAURANT LE DÉSERT', 'مطعم الصحراء'],
    ['CYBER CAFÉ', 'مقهى إنترنت'], ['DIBITERIE SAMBA', 'مشوي سامبا'], ['ÉPICERIE MAMADOU', 'بقالة مامادو'], ['MAISON DU THÉ', 'بيت الشاي'], ['LAVAGE AUTO', 'غسيل السيارات'],
    ['PNEUMATIQUE ALI', 'عجلات علي'], ['BIJOUTERIE MARIAM', 'مجوهرات مريم'], ['PÂTISSERIE MOUNA', 'حلويات منى'], ['ÉLECTRONIQUE SAADA', 'إلكترونيات سعادة'],
    ['MENUISERIE MÉTALLIQUE', 'نجارة معدنية'], ['FAST-FOOD SIDI MOHAMED', 'مطعم سيدي محمد'], ['BOUTIQUE MBOUÉRIK', 'دكان امبويريك'], ['QUINCAILLERIE ABDOULAYE', 'خردوات عبد الله'],
    ['FAST-FOOD FATIMETOU', 'مطعم فاطمة'], ['PHARMACIE EL AMANE', 'صيدلية الأمان'], ['GARAGE BRAHIM', 'ورشة إبراهيم']],
  mosque: [['MOSQUÉE EL HOUDA', 'مسجد الهدى'], ['MOSQUÉE ENNOUR', 'مسجد النور'], ['MOSQUÉE ESSALAM', 'مسجد السلام']],
  market: [['MARCHÉ CAPITALE', 'سوق العاصمة'], ['MARCHÉ DU 5E', 'سوق الخامس']],
  station: [['STATION-SERVICE', 'محطة الوقود']], station2: [['CARBURANT', 'وقود']],
};
const SIGN_COLORS = [['#0b6b3a', '#ffffff'], ['#1d4ed8', '#ffffff'], ['#b91c1c', '#ffffff'], ['#f2c200', '#1a1a1a'], ['#ffffff', '#0b5d3b'], ['#0e7490', '#ffffff'], ['#7c2d12', '#ffe9a8'], ['#111827', '#ffd27a'], ['#ffffff', '#b91c1c'], ['#16a34a', '#ffffff']];
const signAtlas = (() => {
  const cells = []; const add = (k, t) => cells.push({ k, t });
  for (const k in SIGN_TEXT) for (const t of SIGN_TEXT[k]) add(k, t);
  const CW = 512, CH = 128, COLS = 4, ROWS = Math.ceil(cells.length / COLS), H = 2 ** Math.ceil(Math.log2(ROWS * CH));
  const tex = canvasTex(CW * COLS, H, c => {
    cells.forEach((cell, n) => {
      const x0 = (n % COLS) * CW, y0 = Math.floor(n / COLS) * CH, [bg, fg] = cell.k === 'mosque' ? ['#0b5d3b', '#ffffff'] : cell.k === 'station' || cell.k === 'station2' ? ['#0b6b3a', '#ffd700'] : SIGN_COLORS[(n * 7) % SIGN_COLORS.length];
      c.save(); c.beginPath(); c.rect(x0, y0, CW, CH); c.clip();
      c.fillStyle = bg; c.fillRect(x0, y0, CW, CH);
      c.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < 60; i++) c.fillRect(x0 + Math.random() * CW, y0 + Math.random() * CH, 2 + Math.random() * 30, 1 + Math.random() * 2);
      c.strokeStyle = fg; c.lineWidth = 5; c.strokeRect(x0 + 6, y0 + 6, CW - 12, CH - 12);
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      const fit = (txt, font, size, y, sx) => { c.font = font.replace('SZ', size); const w = c.measureText(txt).width, k = Math.min(1, (CW - 40) / w) * (sx || 1); c.save(); c.translate(x0 + CW / 2, y0 + y); c.scale(k, 1); c.fillText(txt, 0, 0); c.restore(); };
      if (cell.k === 'station2') { c.save(); c.translate(x0 + CW / 2, y0 + CH / 2); c.scale(0.25, 1); c.font = '900 92px "Russo One", Arial Black, sans-serif'; c.fillText('⛽', 0, 4); c.restore(); }
      else { fit(cell.t[0], '700 SZpx "Russo One", Arial Black, sans-serif', 52, CH * 0.36); if (cell.t[1]) fit(cell.t[1], '700 SZpx Arial, Tahoma, sans-serif', 40, CH * 0.75); }
      c.restore();
    });
  });
  return { tex, cells, COLS, ROWS, CW, CH, H };
})();
const PALETTE_WALL = [0xf2e3c6, 0xe8cfa0, 0xf6f2ea, 0xc5dde9, 0x9fd6cd, 0xd4e6bd, 0xf1c1a8, 0xedd27f, 0xeccad0, 0xdedbd3, 0xf4e9d8, 0xbfe0d8].map(h => lin(h));

/* ======================= Ville ======================= */
const fansData = [];
let fanMeshes = null, RT_OCC = [];
function buildCity() {
  const city = ASSETS.city;
  const rnd = (() => { let s = 20261118; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const occ = RT_OCC;
  const free = (x, z, r, minTrack) => {
    if (x - r < OCEAN_X + 70 || onDecoRoad(x, z, r)) return false;
    for (const o of occ) if (Math.hypot(x - o.x, z - o.z) < r + o.r) return false;
    const nn = nearest(x, z, -1);
    const mt = minTrack === undefined ? WALL + 7.2 : minTrack;
    if (nn.d - r < mt) return false;
    const nb = nearestAnyBr(x, z);
    return !nb || nb.d - r >= mt - WALL + BW;
  };
  const toward = (i, side) => Math.atan2(-NX[i] * side, -NZ[i] * side);
  const inst = {};
  const put = (key, x, z, rot, s, y) => { (inst[key] = inst[key] || []).push([x, y || 0, z, rot, s || 1]); };
  const sizes = {};
  for (const lib of [city, ASSETS.mrt]) if (lib) {
    lib.updateMatrixWorld(true);
    lib.children.forEach(o => {
      const b = new THREE.Box3().setFromObject(o); const sz = b.getSize(new THREE.Vector3());
      sizes[o.name] = { w: sz.x, d: sz.z, h: sz.y };
    });
  }
  const has = k => !!sizes[k];
  // 1) Fans dans les virages et devant le stade
  const corners = [];
  const byK = [...Array(N).keys()].sort((a, b) => Math.abs(K[b]) - Math.abs(K[a]));
  for (const i of byK) { if (corners.length >= 8) break; if (corners.every(c => Math.min(Math.abs(c - i), N - Math.abs(c - i)) * SEG > 200)) corners.push(i); }
  const maxFans = LOW ? 40 : LITE ? 90 : 140;
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
  // 2) Stade Olympique le long de la ligne droite de départ
  if (!RT && has('B_Stadium')) {
    const i = idxWrap(-70), s = sizes.B_Stadium, side = OUT_SIGN;
    const off = (WALL + 9 + s.w / 2) * side;
    const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
    put('B_Stadium', x, z, Math.atan2(TX[i], TZ[i]), 1); occ.push({ x, z, r: Math.hypot(s.w, s.d) / 2 * 0.95 });
    const sg = new THREE.Group(); sg.position.set(PX[i] + NX[i] * (WALL + 8.5) * side, 0, PZ[i] + NZ[i] * (WALL + 8.5) * side); sg.rotation.y = toward(i, side);
    for (const sx of [-9, 9]) prim(sg, new THREE.BoxGeometry(0.5, 13, 0.5), poleMat, sx, 6.5, 0);
    sg.userData.deco = true;
    signMesh(sg, textTex([{ t: 'STADE OLYMPIQUE', y: 0.38, size: 100 }, { t: 'الملعب الأولمبي', y: 0.78, size: 64, font: '700 SZpx Arial, sans-serif' }], { bg: '#00703c', fg: '#ffd700', w: 1024, h: 256 }), 19, 4.8, 0, 11, 0.3, 1.2);
    scene.add(sg);
  }
  // 2b) Monuments de Nouakchott
  const placeLM = (lm, i0, side, extra) => {
    for (let t = 0; t < 14; t++) {
      const i = idxWrap(i0 + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * 14);
      const off = (WALL + 10 + (extra || 0) + lm.d / 2) * side, x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
      if (!free(x, z, lm.r, WALL + 8 + (extra || 0) - (lm.r - lm.d / 2))) continue;
      lm.g.position.set(x, 0, z); lm.g.rotation.y = toward(i, side); scene.add(lm.g); mergeGroup(lm.g); occ.push({ x, z, r: lm.r }); LM_PLACED.push({ name: lm.name, x, z, rot: lm.g.rotation.y, r: lm.r }); return true;
    }
    return false;
  };
  const placeAt = (lm, x, z, rot) => { lm.g.position.set(x, 0, z); lm.g.rotation.y = rot; scene.add(lm.g); mergeGroup(lm.g); occ.push({ x, z, r: lm.r }); LM_PLACED.push({ name: lm.name, x, z, rot, r: lm.r }); };
  const deco = new THREE.Group(); scene.add(deco); // panneaux, poteaux, portiques : fusionnés à la fin
  if (!RT) buildJunctions(deco);
  const L = LANDMARKS, O = OUT_SIGN, I = -OUT_SIGN;
  const B = (key, fallback) => glbLM(key) || (fallback ? fallback() : null);
  const pl = (lm, i, side, extra) => { if (lm) placeLM(lm, i, side, extra); };
  const H = (n, a, o) => () => L.hotel(n, a, o);
  if (!RT) {
  // Tevragh Zeina : avenue Moktar Ould Daddah, Cité Smar, avenue El Quods
  pl(B('lm_fasq', H('FASQ HÔTEL', 'فندق فاسك', { w: 26, h: 31, d: 20, wall: '#f2f2f2', win: '#1d2a38', style: 'glass', band: '#ffffff', signBg: '#111111', signFg: '#e9c46a' })), TAG.fasq, O);
  pl(B('lm_nkc', H('HÔTEL NOUAKCHOTT', 'فندق نواكشوط', { w: 44, h: 18, d: 20, wall: '#f4efe4', balcony: '#c9c0ad', signBg: '#0b3d2e', signFg: '#ffd27a' })), TAG.nkc, O);
  pl(B('lm_palais', () => L.palace()), TAG.nkc + 6, I, 4);
  pl(B('lm_mauricenter', H('MAURICENTER', 'موريسنتر', { w: 34, h: 27, d: 24, wall: '#efe2c4', win: '#33475a', rooftop: true, signBg: '#13294b', signFg: '#f4d58d' })), TAG.citesmar - 110, O);
  pl(B('lm_iman', H('HÔTEL IMAN', 'فندق إيمان', { w: 30, h: 15, d: 18, wall: '#f1e7d6', balcony: '#a9927a', signBg: '#5b2a86', signFg: '#fff' })), TAG.iman, O);
  pl(B('lm_tasiast', H('HÔTEL TASIAST', 'فندق تازيازت', { w: 36, h: 17, d: 20, wall: '#e8c9a0', balcony: '#b98b5a', wing: [14, 10], signBg: '#7a1f2b', signFg: '#fff' })), TAG.tasiast, I);
  pl(B('lm_sheraton', H('SHERATON', 'شيراتون', { w: 30, h: 46, d: 24, wall: '#e9e4da', win: '#24384c', style: 'glass', band: '#d8d2c6', signBg: '#1f2a44', signFg: '#ffffff' })), TAG.sheraton, O);
  // Centre-ville : carrefour BMD (tour SNIM, AFARCO, BMD), avenue Gamal Abdel Nasser
  pl(L.hotel('HÔTEL TFEILA', 'فندق تفيلة', { w: 40, h: 16, d: 20, wall: '#e8c9a0', balcony: '#b98b5a', signBg: '#0b3d2e', signFg: '#ffd27a' }), TAG.m2 + 40, I);
  pl(L.palace(), TAG.m2 + 110, O, 6);
  pl(B('lm_snim', () => L.snim()), TAG.bmd + 36, O);
  pl(B('lm_afarco', H('AFARCO', 'أفاركو', { w: 34, h: 26, d: 22, wall: '#e6dcc8', win: '#3a4655', balcony: '#cfc4ae', signBg: '#8a1c1c', signFg: '#fff' })), TAG.bmd + 36, I);
  pl(B('lm_bmd', H('BMD', 'البنك الموريتاني للتنمية', { w: 30, h: 16, d: 22, wall: '#f1eee6', win: '#20374f', style: 'glass', band: '#ffffff', signBg: '#0b5d3b', signFg: '#ffffff' })), TAG.bmd - 36, O);
  pl(L.mosqueSaudi(), TAG.mosquee, O);
  pl(L.hotel('AZALAÏ HÔTEL MARHABA', 'فندق مرحبا', { w: 50, h: 19, d: 18, wall: '#f4efe4', balcony: '#c9c0ad', signBg: '#7a1f2b', signFg: '#fff' }), TAG.gan + 20, I);
  pl(B('lm_marche'), TAG.marche, I);
  pl(L.museum(), TAG.marche + 25, O);
  pl(L.mosqueMaroc(), TAG.bridgeA - 10, I);
  pl(L.hotel('HÔTEL HALIMA', 'فندق حليمة', { w: 26, h: 13, d: 16, wall: '#f1e7d6', balcony: '#a9927a', signBg: '#5b2a86', signFg: '#fff' }), TAG.faycal - 40, O);
  }
  // 2c) Panneaux des avenues (français + arabe) et des raccourcis
  const plate = (i, side, lines, bg, fg, pw) => {
    const off = (WALL + 3) * side, x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
    if (!free(x, z, 1, WALL + 1)) return;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(-TX[i], -TZ[i]);
    prim(g, new THREE.CylinderGeometry(0.12, 0.12, 6, 8), poleMat, 0, 3, 0);
    signMesh(g, textTex(lines, { bg, fg, border: fg, w: 1024, h: 320 }), pw || 7, (pw || 7) * 0.31, 0, 5.4, 0.15, 0.9);
    deco.add(g); occ.push({ x, z, r: 1.2 });
  };
  for (const st of STREETS) for (const sd of [1, -1]) plate(idxWrap(st.from + 6), sd, [{ t: st.name.toUpperCase(), y: 0.36, size: 84 }, { t: st.ar, y: 0.74, size: 76, font: '700 SZpx Arial, sans-serif' }], '#0b4ea2', '#ffffff');
  for (const br of BR) {
    const sd = Math.sign((br.X[Math.round(br.M / 2)] - PX[br.a]) * NX[br.a] + (br.Z[Math.round(br.M / 2)] - PZ[br.a]) * NZ[br.a]) || 1;
    for (const di of [70, 34]) plate(idxWrap(br.a - di), sd, [{ t: (sd > 0 ? '◀ ' : '') + 'RACCOURCI' + (sd < 0 ? ' ▶' : ''), y: 0.34, size: 110 }, { t: br.name, y: 0.75, size: 64 }], '#f59e0b', '#111111', 8.5);
  }
  { // panneau de bienvenue
    const i = idxWrap(-150), side = -OUT_SIGN, off = (WALL + 9) * side, x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
    if (free(x, z, 9, WALL + 6)) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = toward(i, side);
      for (const sx of [-7, 7]) prim(g, new THREE.BoxGeometry(0.6, 10, 0.6), poleMat, sx, 5, 0);
      signMesh(g, textTex([{ t: 'BIENVENUE À NOUAKCHOTT', y: 0.36, size: 96 }, { t: 'مرحبا بكم في نواكشوط', y: 0.76, size: 80, font: '700 SZpx Arial, sans-serif' }], { bg: '#00a95c', fg: '#ffffff', border: '#ffd700', w: 1024, h: 320 }), 17, 5.3, 0, 7.6, 0.35, 1.1);
      deco.add(g); occ.push({ x, z, r: 9 });
    }
  }
  { // drapeaux mauritaniens près du départ
    const g = deco;
    for (let k = -3; k <= 3; k++) { if (!k) continue; const i = idxWrap(k * 9); for (const sd of [1, -1]) { const off = (WALL + 1.6) * sd; flagPole(g, PX[i] + NX[i] * off, PZ[i] + NZ[i] * off, 9).rotation.y = Math.atan2(TX[i], TZ[i]) + Math.PI / 2; } }
  }
  mergeGroup(deco);
  // 3) Lampadaires et panneaux
  for (const [x, y, z, rot] of BRIDGE_LAMPS) { put('P_StreetLight', x, z, rot, 1, y); for (const ax of [1.15, -1.15]) LAMPS.push([x + Math.cos(rot) * ax, y + 6.15, z - Math.sin(rot) * ax]); }
  for (let d = 0; d < TRACK_LEN; d += 38) {
    const i = Math.floor(d / SEG) % N;
    if (EL[i] > 0.2) continue;
    for (const side of [1, -1]) {
      const off = (WALL + 2.2) * side; const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off;
      if (!free(x, z, 0.6, WALL + 1)) continue;
      const rot = Math.atan2(-NZ[i] * side, -NX[i] * side) + Math.PI;
      put('P_StreetLight', x, z, rot, 1); occ.push({ x, z, r: 0.8 });
      for (const ax of [1.15, -1.15]) LAMPS.push([x + Math.cos(rot) * ax, 6.15, z - Math.sin(rot) * ax]);
    }
  }
  for (const br of BR) for (let k = 8; k < br.M - 8; k += 22) for (const side of [1, -1]) { // lampadaires des raccourcis
    const off = (BW + 2.2) * side, x = br.X[k] + br.NX[k] * off, z = br.Z[k] + br.NZ[k] * off;
    if (latMain(x, z) < WALL + 3 || !free(x, z, 0.6, WALL + 1)) continue;
    const rot = Math.atan2(-br.NZ[k] * side, -br.NX[k] * side) + Math.PI;
    put('P_StreetLight', x, z, rot, 1); occ.push({ x, z, r: 0.8 });
    for (const ax of [1.15, -1.15]) LAMPS.push([x + Math.cos(rot) * ax, 6.15, z - Math.sin(rot) * ax]);
  }

  // cônes à la corde des virages
  corners.forEach(ci => {
    const side = K[ci] > 0 ? 1 : -1;
    for (let k = -3; k <= 3; k++) { const i = idxWrap(ci + Math.round(k * 4 / SEG)); const off = (HALF + CURB_W + 0.8) * side; put('P_Trafficcone', PX[i] + NX[i] * off, PZ[i] + NZ[i] * off, rnd() * 6, 1); }
  });
  if (RT) { instanceLib(inst, {}); buildSigns(inst, rnd); return; }
  // 4) Bâtiments : 1er rang (boutiques), 2e rang (immeubles), horizon (gratte-ciel)
  // bâtiments de Nouakchott modélisés dans Blender (boutiques, immeubles, villas, mosquées, marché…)
  const SHOPS = ['mrt_shop1A', 'mrt_shop1B', 'mrt_shop2A', 'mrt_shop2B', 'mrt_shop1A', 'mrt_shop2B', 'mrt_kioskA', 'mrt_kioskB', 'mrt_market', 'mrt_immA', 'mrt_shop1B', 'mrt_station'].filter(has);
  const TALL = ['mrt_immA', 'mrt_immB', 'mrt_tower', 'mrt_villaA', 'mrt_villaB', 'mrt_mosque', 'mrt_shop2A', 'mrt_immB', 'mrt_villaA'].filter(has);
  const VEH = [];
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
  if (!SHOPS.length || !TALL.length) return;
  ring(SHOPS, LOW ? 13 : LITE ? 11 : 9, 0, null);
  ring(TALL, LOW ? 48 : LITE ? 34 : 20, 22, [1, 1.3]);
  if (!LITE) ring(TALL, 30, 55, [1.2, 1.8]);
  // horizon lointain
  for (let k = 0; k < (LOW ? 0 : LITE ? 60 : 260); k++) {
    const i = Math.floor(rnd() * N), sd = rnd() < 0.5 ? 1 : -1, off = (WALL + 120 + rnd() * 380) * sd;
    const x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off; if (x < OCEAN_X + 80) continue; const key = pick(['mrt_immA', 'mrt_immB', 'mrt_tower'].filter(has)), s = sizes[key], sc = 1.2 + rnd() * 0.6;
    if (free(x, z, Math.max(s.w, s.d) * sc / 2)) { put(key, x, z, rnd() * 6.28, sc); occ.push({ x, z, r: Math.max(s.w, s.d) * sc / 2 }); }
  }
  // 5) Arbres et végétation
  // palmiers : avenue Gamal Abdel Nasser bordée d'arbres, raccourcis, et un peu partout
  const palms = [];
  const palmAt = (x, z) => { if (!free(x, z, 1.6, WALL + 3)) return; palms.push([x, z, rnd() * 6.28, 0.85 + rnd() * 0.45]); occ.push({ x, z, r: 1.4 }); };
  for (const [f, t] of [[TAG.gan - 40, TAG.bridgeA], [TAG.moktar, TAG.citesmar - 70], [TAG.elquods, TAG.m2 - 60], [TAG.bridgeB + 20, TAG.faycal + 40]]) for (let i = f; i < t; i += 12) for (const sd of [1, -1]) { const j = idxWrap(i), off = (WALL + 9.5) * sd; palmAt(PX[j] + NX[j] * off, PZ[j] + NZ[j] * off); }
  for (const br of BR) for (let k = 4; k < br.M; k += 15) for (const sd of [1, -1]) { const off = (BW + 8) * sd; palmAt(br.X[k] + br.NX[k] * off, br.Z[k] + br.NZ[k] * off); }
  for (let k = 0, n = 0; k < 6000 && n < (LOW ? 120 : LITE ? 280 : 520); k++) { const i = Math.floor(rnd() * N), sd = rnd() < 0.5 ? 1 : -1, off = (WALL + 40 + rnd() * 260) * sd, x = PX[i] + NX[i] * off, z = PZ[i] + NZ[i] * off, before = palms.length; if (x < OCEAN_X + 60) continue; palmAt(x, z); if (palms.length > before) n++; }
  for (const [x, z] of PALM_EXTRA) palms.push([x, z, rnd() * 6.28, 0.9 + rnd() * 0.3]);
  {
    const m4s = palms.map(([x, z, r, sc]) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r), new THREE.Vector3(sc, sc, sc)));
    const cols = palms.map(() => new THREE.Color().setHSL(0.27 + Math.random() * 0.06, 0.45 + Math.random() * 0.2, 0.62 + Math.random() * 0.2));
    addInstanced(PALM.trunk, PALM.trunkMat, m4s, null, { cast: !LITE, cell: 220, name: 'palmT', maxD: 380 * DSCALE });
    addInstanced(PALM.crown, PALM.crownMat, m4s, cols, { cast: !LITE, cell: 220, name: 'palmC', maxD: 420 * DSCALE });
  }
  // tentes nomades (khaïmas) dans le sable aux abords de la ville
  for (let k = 0, n = 0; k < 400 && n < (LOW ? 6 : 16); k++) {
    const x = BBOX[0] - 40 + rnd() * (BBOX[1] - BBOX[0] + 80), z = BBOX[3] + 90 + rnd() * 260, key = rnd() < 0.5 ? 'mrt_khaimaA' : 'mrt_khaimaB';
    if (has(key) && free(x, z, 6)) { put(key, x, z, rnd() * 6.28, 1); occ.push({ x, z, r: 6 }); n++; }
  }
  const TREES = [];
  const maxTrees = 0; let nt = 0;
  for (let k = 0; k < 4000 && nt < maxTrees; k++) {
    const x = BBOX[0] + rnd() * (BBOX[1] - BBOX[0]), z = BBOX[2] + rnd() * (BBOX[3] - BBOX[2]);
    if (!free(x, z, 2.6)) continue;
    const key = pick(TREES); put(key, x, z, rnd() * 6.28, 0.9 + rnd() * 0.7); occ.push({ x, z, r: 2.2 }); nt++;
    if (rnd() < 0.4 && has('N_Bush01')) { const bx = x + (rnd() - 0.5) * 6, bz = z + (rnd() - 0.5) * 6; if (free(bx, bz, 1)) put(rnd() < 0.5 ? 'N_Bush01' : 'N_Bush02', bx, bz, rnd() * 6, 1); }
  }
  instanceLib(inst, {});
  buildSigns(inst, rnd);
}
// création des InstancedMesh (un appel de rendu par type d'objet) : aussi utilisé par le mode Taxi
function raceMask() { // emprise du circuit : la vraie ville n'y pose ni bâtiment, ni mur, ni lampadaire
  const C = 2, x0 = BBOX[0] - 300, z0 = BBOX[2] - 300, W = Math.ceil((BBOX[1] - BBOX[0] + 600) / C), H = Math.ceil((BBOX[3] - BBOX[2] + 600) / C), g = new Uint8Array(W * H);
  const disc = (x, z, r) => {
    const a0 = Math.max(0, Math.floor((x - r - x0) / C)), a1 = Math.min(W - 1, Math.floor((x + r - x0) / C)), b0 = Math.max(0, Math.floor((z - r - z0) / C)), b1 = Math.min(H - 1, Math.floor((z + r - z0) / C)), r2 = (r + C * 0.7) ** 2;
    for (let b = b0; b <= b1; b++) { const dz = z0 + (b + 0.5) * C - z; for (let a = a0; a <= a1; a++) { const dx = x0 + (a + 0.5) * C - x; if (dx * dx + dz * dz <= r2) g[b * W + a] = 1; } }
  };
  for (let i = 0; i < N; i += 2) disc(PX[i], PZ[i], WALL + 3.2);
  for (const br of BR) for (let k = 0; k < br.M; k += 2) disc(br.X[k], br.Z[k], BW + 2.4);
  for (const o of RT_OCC) disc(o.x, o.z, o.r + 1);
  return (x, z) => { const a = Math.floor((x - x0) / C), b = Math.floor((z - z0) / C); return a >= 0 && b >= 0 && a < W && b < H && g[b * W + a] === 1; };
}
function instanceLib(inst, O) {
  const city = ASSETS.city;
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s3 = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const key in inst) {
    const src = (ASSETS.mrt && ASSETS.mrt.getObjectByName(key)) || (city && city.getObjectByName(key)); if (!src) continue;
    const isM = key.startsWith('mrt_');
    const meshes = []; src.updateMatrixWorld(true);
    src.traverse(o => { if (o.isMesh) meshes.push(o); });
    const rootInv = new THREE.Matrix4().copy(src.matrixWorld).invert();
    for (const me of meshes) {
      const local = new THREE.Matrix4().multiplyMatrices(rootInv, me.matrixWorld);
      if (LOW && me.material && !me.material.isMeshLambertMaterial) { const o = me.material; me.material = new THREE.MeshLambertMaterial({ map: o.map, color: o.color, emissiveMap: o.emissiveMap || null }); }
      if (isM && me.material.emissiveMap && !me.material.userData.night) { me.material.userData.night = true; nightReg(me.material, 0, 1.05, 0xfff0d8); }
      if (isM && !LOW) { me.material.roughness = 0.88; me.material.metalness = 0; }
      const mm = me.material, tx = mm && mm.map;
      if (tx && !FIXED_TEX.has(tx)) { // filtrage lisse (pas de scintillement / d'artefacts au loin)
        FIXED_TEX.add(tx); tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearMipmapLinearFilter; tx.generateMipmaps = true; tx.anisotropy = Math.min(LOW ? 2 : 8, renderer.capabilities.getMaxAnisotropy()); tx.needsUpdate = true;
      }
      if (tx && key.startsWith('B_') && !mm.userData.night) { mm.userData.night = true; mm.emissiveMap = tx; nightReg(mm, 0, 0.32, 0xffcf8f); }
      const mats = inst[key].map(([x, y, z, rot, sc]) => { q.setFromAxisAngle(Y, rot); p.set(x, y, z); s3.set(sc, sc, sc); return new THREE.Matrix4().compose(p, q, s3).multiply(local); });
      const big = key.startsWith('B_') || isM;
      const cols = isM && /_wall/.test(me.name) ? inst[key].map((e, j) => PALETTE_WALL[(j * 5 + key.length * 3) % PALETTE_WALL.length]) : null;
      const isDet = !/_wall/.test(me.name) && isM, small = !big;
      addInstanced(me.geometry, me.material, mats, cols, { cast: !LITE, receive: big && !LOW, cell: O.cell || (isDet || small ? 170 : (LITE ? 420 : 380)), name: key + ':' + me.name, maxD: O.maxD ? O.maxD(isDet, small) : (isDet ? 280 * DSCALE : small ? 300 * DSCALE : (HIQ ? 0 : 900)), parent: O.parent, cull: O.cull });
      if (me.material) { me.material.envMapIntensity = 0.35; }
    }
  }
}
// toutes les enseignes de boutiques = un seul maillage (un seul appel de dessin)
function buildSigns(inst, rnd, parent) {
  const pos = [], uv = [], idx = [], A = signAtlas, byKind = {};
  A.cells.forEach((c, n) => (byKind[c.k] = byKind[c.k] || []).push(n));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  let used = 0;
  for (const key in inst) {
    const slots = MRT_SIGNS[key]; if (!slots) continue;
    for (const [x, y, z, rot, s] of inst[key]) {
      q.setFromAxisAngle(Y, rot); p.set(x, y, z); sc.set(s, s, s); m4.compose(p, q, sc);
      for (const [sx, sy, sz, w, h, kind] of slots) {
        const list = byKind[kind] || byKind.shop, n = list[(used++ * 7 + Math.floor(rnd() * list.length)) % list.length];
        const u0 = (n % A.COLS) * A.CW / (A.CW * A.COLS), v1 = 1 - Math.floor(n / A.COLS) * A.CH / A.H, du = A.CW / (A.CW * A.COLS), dv = A.CH / A.H;
        const base = pos.length / 3;
        for (const [ox, oy, uu, vv] of [[-w / 2, -h / 2, u0 + 0.002, v1 - dv + 0.004], [w / 2, -h / 2, u0 + du - 0.002, v1 - dv + 0.004], [w / 2, h / 2, u0 + du - 0.002, v1 - 0.004], [-w / 2, h / 2, u0 + 0.002, v1 - 0.004]]) {
          v.set(sx + ox, sy + oy, sz + 0.01).applyMatrix4(m4); pos.push(v.x, v.y, v.z); uv.push(uu, vv);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }
  if (!idx.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = surf({ map: A.tex, roughness: 0.6, envMapIntensity: 0.3 }); m.emissiveMap = A.tex; nightReg(m, 0.1, 0.85); m.polygonOffset = true; m.polygonOffsetFactor = -2;
  const me = new THREE.Mesh(g, m); (parent || scene).add(me); return me;
}
function buildFans() {
  const src = ASSETS.fans || ASSETS.fans_lo; if (!src || !fansData.length) return;
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
    im.castShadow = !LITE; im.frustumCulled = false;
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

/* ======================= Mode nuit ======================= */
const headSpot = new THREE.SpotLight(0xfff1d6, 0, 95, 0.52, 0.55, 1.1);
const headHolder = new THREE.Group(); scene.add(headHolder); headHolder.add(headSpot, headSpot.target);
const beamTex = canvasTex(64, 128, (c, w, h) => { c.setTransform(w / h, 0, 0, 1, 0, 0); const g = c.createRadialGradient(h / 2, h * 0.92, 2, h / 2, h * 0.7, h * 0.66); g.addColorStop(0, 'rgba(255,245,220,0.85)'); g.addColorStop(0.5, 'rgba(255,245,220,0.3)'); g.addColorStop(1, 'rgba(255,245,220,0)'); c.fillStyle = g; c.fillRect(0, 0, h, h); });
const beam = new THREE.Mesh(new THREE.PlaneGeometry(11, 26), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }));
beam.rotation.x = -Math.PI / 2; beam.visible = false;
function attachHeadlights(model) {
  const f = model.box ? model.box.max.z : 2.4;
  model.root.add(headSpot); model.root.add(headSpot.target); headSpot.position.set(0, 0.95, f - 0.2); headSpot.target.position.set(0, 0, f + 26);
  model.root.add(beam); beam.position.set(0, 0.11, f + 12.5);
}
let lampGlow = null, lampPools = null;
function buildNightLights() {
  if (!LAMPS.length) return;
  const n = LAMPS.length, pos = new Float32Array(n * 3);
  LAMPS.forEach((l, k) => pos.set(l, k * 3));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lampGlow = new THREE.Points(g, new THREE.PointsMaterial({ map: glowSpriteTex, color: 0xffd29a, size: 5.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  lampGlow.frustumCulled = false; scene.add(lampGlow);
  const poolTex = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,200,140,0.85)'); gr.addColorStop(0.55, 'rgba(255,170,90,0.35)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const pg = new THREE.PlaneGeometry(22, 22); pg.rotateX(-Math.PI / 2);
  const mats = LAMPS.map(([x, , z]) => new THREE.Matrix4().makeTranslation(x, 0.1, z));
  lampPools = addInstanced(pg, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }), mats, null, { cell: 260 });
  applyAmbience();
}
function applyAmbience() {
  const nt = !!prof.night, P = nt ? SKY.night : SKY.day;
  skyMat.uniforms.top.value.setHex(P.top); skyMat.uniforms.mid.value.setHex(P.mid); skyMat.uniforms.bot.value.setHex(P.bot);
  skyMat.uniforms.glowAmt.value = P.glow; skyMat.uniforms.sunCol.value.set(nt ? 0xdfe8ff : 0xffbf73);
  stars.visible = nt;
  scene.fog.color.setHex(P.fog); scene.fog.near = FOG_DAY[0] * (nt ? 0.7 : 1); scene.fog.far = FOG_DAY[1] * (nt ? 0.8 : 1);
  if (nt && !ENV.night) ENV.night = makeEnvCube(SKY.night);
  scene.environment = nt ? ENV.night : ENV.day;
  hemi.intensity = nt ? (LOW ? 0.32 : 0.2) : HEMI_DAY; hemi.color.setHex(nt ? 0x7f9cd6 : 0xbcd2ff); hemi.groundColor.setHex(nt ? 0x1c1a24 : 0x5a4a3c);
  sun.intensity = nt ? 0.38 : 1.7; sun.color.setHex(nt ? 0x9fb6ff : 0xffd6ae);
  renderer.toneMappingExposure = nt ? 1.25 : 1.0;
  for (const e of NIGHT_MATS) e.m.emissiveIntensity = nt ? e.night : e.day;
  CM.headEmit.emissiveIntensity = nt ? 4 : 2.4;
  headSpot.intensity = nt ? 3.2 : 0; beam.visible = nt;
  if (lampGlow) lampGlow.visible = nt;
  if (lampPools) for (const m of lampPools) m.visible = nt;
  const allCars = cars.concat([...net.remotes.values()]);
  for (const c of allCars) if (c.model && c.model.glows) for (const g of c.model.glows) g.visible = nt;
  document.body.classList.toggle('night', nt);
}

/* ======================= Bouteilles de nitro (visuels) ======================= */
const bottleFx = (() => {
  const n = BOTTLES.length, S = 1.75;
  const pr = [[0, 0], [0.3, 0], [0.35, 0.06], [0.35, 0.68], [0.3, 0.84], [0.15, 0.96], [0.12, 1.12], [0, 1.12]].map(([r, y]) => new THREE.Vector2(r * S, y * S));
  const glassG = new THREE.LatheGeometry(pr, LOW ? 10 : 18);
  const liqG = new THREE.CylinderGeometry(0.29 * S, 0.29 * S, 0.62 * S, LOW ? 8 : 14); liqG.translate(0, 0.38 * S, 0);
  const capG = new THREE.CylinderGeometry(0.15 * S, 0.15 * S, 0.14 * S, 10); capG.translate(0, 1.17 * S, 0);
  const glowTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(120,220,255,1)'); g.addColorStop(0.45, 'rgba(56,189,248,0.45)'); g.addColorStop(1, 'rgba(56,189,248,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const pillarTex = canvasTex(8, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const glowG = new THREE.PlaneGeometry(5, 5); glowG.rotateX(-Math.PI / 2);
  const pilG = new THREE.CylinderGeometry(0.9, 0.9, 7, 14, 1, true); pilG.translate(0, 3.5, 0);
  const mk = (g, m) => { const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; scene.add(im); return im; };
  const glass = mk(glassG, new THREE.MeshStandardMaterial({ color: 0x9fe9ff, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.38, envMapIntensity: 2, emissive: 0x0c4a6e, depthWrite: false, side: THREE.DoubleSide }));
  const liquid = mk(liqG, new THREE.MeshBasicMaterial({ color: 0x1ab2ff, transparent: true, opacity: 1, depthWrite: false }));
  const cap = mk(capG, new THREE.MeshStandardMaterial({ color: 0xff3d5a, metalness: 0.5, roughness: 0.3 }));
  const glow = mk(glowG, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }));
  const pillar = mk(pilG, new THREE.MeshBasicMaterial({ map: pillarTex, color: 0x38bdf8, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glass.renderOrder = 3; liquid.renderOrder = 2;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  return function update(t) {
    BOTTLES.forEach((b, k) => {
      let s = 1;
      if (b.t > 0) s = b.t < 0.6 ? 1 - b.t / 0.6 : 0;
      if (s <= 0) { for (const im of [glass, liquid, cap, glow, pillar]) im.setMatrixAt(k, Z0); return; }
      q.setFromAxisAngle(Y, t * 1.8 + b.ph); p.set(b.x, 0.55 + Math.sin(t * 2.6 + b.ph) * 0.18, b.z); sc.set(s, s, s);
      m4.compose(p, q, sc); glass.setMatrixAt(k, m4); liquid.setMatrixAt(k, m4); cap.setMatrixAt(k, m4);
      p.y = 0.09; const pulse = s * (1 + Math.sin(t * 4 + b.ph) * 0.12); sc.set(pulse, 1, pulse); m4.compose(p, q, sc); glow.setMatrixAt(k, m4);
      p.y = 0; sc.set(s, s, s); m4.compose(p, q, sc); pillar.setMatrixAt(k, m4);
    });
    for (const im of [glass, liquid, cap, glow, pillar]) im.instanceMatrix.needsUpdate = true;
  };
})();

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
function spawnSmoke(x, z, vx, vz, intensity, dirt, y0) {
  const k = smokeIdx, p = smoke[k]; smokeIdx = (smokeIdx + 1) % SMOKE_N;
  p.on = true; p.life = 0; p.max = 1.2 + Math.random() * 1.3 * intensity;
  p.vx = vx * 0.15 + (Math.random() - 0.5) * 1.5; p.vz = vz * 0.15 + (Math.random() - 0.5) * 1.5; p.vy = 0.6 + Math.random() * 0.8;
  p.size = 1.3 + Math.random() * 0.8; p.x = x; p.y = 0.45 + (y0 || 0); p.z = z; p.base = 0.3 + 0.3 * intensity;
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
  const last = c.skidLast[w], y = 0.09 + (c.y || 0);
  if (last && Math.hypot(L[0] - last[0][0], L[1] - last[0][1]) < 4 && Math.abs(last[2] - y) < 0.5) {
    skidPos.set([last[0][0], last[2], last[0][1], last[1][0], last[2], last[1][1], L[0], y, L[1], R[0], y, R[1]], skidQ * 12);
    skidQ = (skidQ + 1) % SKID_MAX; skidDirty = true;
  }
  c.skidLast[w] = [L, R, y];
}
function clearSkids() { skidPos.fill(-1000); skidGeo.attributes.position.needsUpdate = true; }

/* ======================= Audio ======================= */
const audio = { ctx: null };
function initAudio() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume().then(musicKick, () => {}); musicKick(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); audio.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = prof.muted ? 0 : 0.5; master.connect(ctx.destination); audio.master = master;
    // moteur : synthèse cylindre par cylindre (AudioWorklet, ou ScriptProcessor en secours)
    const eg = ctx.createGain(); eg.gain.value = 0.55; eg.connect(master);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.12; comp.connect(eg);
    audio.eng = { post: m => {}, ready: false };
    const useSP = () => {
      try {
        const dsp = new EngineDSP(ctx.sampleRate), sp = ctx.createScriptProcessor(1024, 0, 1);
        sp.onaudioprocess = e => dsp.fill(e.outputBuffer.getChannelData(0), e.outputBuffer.length);
        sp.connect(comp); audio.eng = { post: m => dsp.msg(m), ready: true, node: sp }; dsp.msg({ lite: 1 });
        const dsp2 = new EngineDSP(ctx.sampleRate), sp2 = ctx.createScriptProcessor(1024, 0, 1); // moteur du joueur 2
        sp2.onaudioprocess = e => dsp2.fill(e.outputBuffer.getChannelData(0), e.outputBuffer.length);
        sp2.connect(comp); audio.eng2 = { post: m => dsp2.msg(m), ready: true, node: sp2 }; dsp2.msg({ lite: 1, vol: 0 });
      } catch (e) {}
    };
    if (ctx.audioWorklet && window.AudioWorkletNode) {
      ctx.audioWorklet.addModule('engine-dsp.js').then(() => {
        const n = new AudioWorkletNode(ctx, 'dz-engine', { numberOfInputs: 0, outputChannelCount: [1] }); n.connect(comp);
        audio.eng = { post: m => n.port.postMessage(m), ready: true, node: n }; n.port.postMessage({ lite: LITE ? 1 : 0 });
        const n2 = new AudioWorkletNode(ctx, 'dz-engine', { numberOfInputs: 0, outputChannelCount: [1] }); n2.connect(comp); // moteur du joueur 2
        audio.eng2 = { post: m => n2.port.postMessage(m), ready: true, node: n2 }; n2.port.postMessage({ lite: 1, vol: 0 });
      }).catch(useSP);
    } else useSP();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, f, q) => { const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = type; bp.frequency.value = f; bp.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(master); src.start(); return { bp, g }; };
    // pneus : crissement tonal (deux voix légèrement désaccordées + vibrato) + roulement de gomme, jamais un sifflement de bruit blanc
    const scr = mk('bandpass', 520, 0.7), nit = mk('lowpass', 900, 0.7), wind = mk('lowpass', 420, 0.5);
    { const sq = ctx.createGain(); sq.gain.value = 0; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 820; bp.Q.value = 1.1; bp.connect(sq); sq.connect(master);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 6.3; lg.gain.value = 14; lfo.connect(lg);
      const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.77; lg2.gain.value = 26; lfo2.connect(lg2);
      const osc = [600, 637, 1205].map((f, k) => { const o = ctx.createOscillator(); o.type = k < 2 ? 'triangle' : 'sine'; o.frequency.value = f; lg.connect(o.frequency); lg2.connect(o.frequency); const g = ctx.createGain(); g.gain.value = k < 2 ? 0.5 : 0.18; o.connect(g); g.connect(bp); o.start(); return o; });
      lfo.start(); lfo2.start(); scr.sq = sq; scr.osc = osc; }
    Object.assign(audio, { eg, scr, nit, wind, noise: buf, last: 0, prof: '' });
    ctx.resume().catch(() => {});
    setTimeout(musicEnsure, 0);
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
const GEAR_TOP = [0, 0.19, 0.33, 0.48, 0.64, 0.81, 1.0]; // vitesse au rupteur de chaque rapport (× vitesse max × 1.15)
function updateAudio2(c, inp, active) { // moteur du joueur 2 (mode 2 joueurs)
  const eng = audio.eng2; if (!audio.ctx || !eng || !eng.ready) return;
  const now = performance.now(); if (now - (audio.last2 || 0) < 33) return; audio.last2 = now;
  if (!c) { if (audio.vol2 !== 0) { eng.post({ vol: 0 }); audio.vol2 = 0; } return; }
  const pid = carDef(c.carId).engine || 'v8tt', P = EngineDSP.PROFILES[pid];
  const m = { rpm: P.idle + (P.red - P.idle) * clamp((c.rpm - 0.12) / 0.88, 0, 1), load: active ? (inp.thr ? 1 : 0) : 0, vol: active ? 0.85 : 0 };
  if (pid !== audio.prof2) { audio.prof2 = pid; m.profile = pid; }
  if (c.shifted) { m.shift = 1; c.shifted = false; }
  eng.post(m); audio.vol2 = m.vol;
}
function updateAudio(c, inp, screech, active) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime, now = performance.now();
  const eng = audio.eng;
  if (eng && eng.ready && c && now - audio.last > 33) {
    audio.last = now;
    const pid = carDef(c.carId || prof.car).engine || 'v8tt', P = EngineDSP.PROFILES[pid];
    const rpm = P.idle + (P.red - P.idle) * clamp((c.rpm - 0.12) / 0.88, 0, 1);
    const m = { rpm, load: active ? (inp.thr ? 1 : 0) : 0, vol: active ? 1 : (state === 'menu' || state === 'results' ? 0.12 : 0) };
    if (pid !== audio.prof) { audio.prof = pid; m.profile = pid; }
    if (c.shifted) { m.shift = 1; c.shifted = false; }
    eng.post(m);
  }
  const sk = active ? clamp((screech - 0.12) / 0.88, 0, 1) : 0, spd = c ? clamp(c.speed / 60, 0, 1) : 0;
  audio.scr.g.gain.setTargetAtTime(sk * 0.075 * (0.5 + 0.5 * spd), t, 0.08);
  audio.scr.bp.frequency.setTargetAtTime(380 + sk * 260, t, 0.15);
  if (audio.scr.sq) {
    audio.scr.sq.gain.setTargetAtTime(sk * sk * 0.055, t, 0.09);
    const base = 560 + sk * 120 + spd * 40;
    audio.scr.osc[0].frequency.setTargetAtTime(base, t, 0.2); audio.scr.osc[1].frequency.setTargetAtTime(base * 1.062, t, 0.2); audio.scr.osc[2].frequency.setTargetAtTime(base * 2.01, t, 0.2);
  }
  audio.nit.g.gain.setTargetAtTime(active && c && c.nitroOn ? 0.09 : 0, t, 0.08);
  audio.wind.g.gain.setTargetAtTime(active && c ? spd * spd * 0.08 : 0, t, 0.25);
}

/* ======================= Musique (lecture aléatoire) ======================= */
const music = { list: [], order: [], pos: -1, el: null, gain: null, filter: null, vol: store.get('musicVol', 70) / 100, cur: null, toastT: 0 };
fetch('music/playlist.json').then(r => r.ok ? r.json() : []).then(l => { music.list = Array.isArray(l) ? l.filter(t => t && typeof t.file === 'string') : []; reshuffle(); musicEnsure(); renderMusic(); }).catch(() => {});
function reshuffle() {
  const last = music.order[music.order.length - 1];
  music.order = music.list.map((_, i) => i);
  for (let i = music.order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [music.order[i], music.order[j]] = [music.order[j], music.order[i]]; }
  if (music.order.length > 1 && music.order[0] === last) music.order.push(music.order.shift());
  music.pos = -1;
}
function musicEnsure() {
  if (!audio.ctx || music.el || !music.list.length) return;
  try {
    const el = new Audio(); el.preload = 'auto';
    const src = audio.ctx.createMediaElementSource(el);
    const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 20000; f.Q.value = 0.7;
    const g = audio.ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(audio.ctx.destination);
    el.addEventListener('ended', () => { music.fails = 0; nextTrack(); });
    el.addEventListener('playing', () => { music.fails = 0; music.blocked = false; sndHint(); musicPrefetch(); });
    el.addEventListener('error', () => { music.fails = (music.fails || 0) + 1; if (music.fails < music.list.length) setTimeout(nextTrack, 400); else setTimeout(() => { music.fails = 0; nextTrack(); }, 30000); }); // hors ligne : seules les pistes déjà écoutées sont disponibles
    Object.assign(music, { el, gain: g, filter: f });
    nextTrack();
  } catch (e) {}
}
function nextTrack() {
  if (!music.el || !music.list.length) return;
  music.pos++; if (music.pos >= music.order.length) { reshuffle(); music.pos = 0; }
  const t = music.list[music.order[music.pos]]; music.cur = t;
  music.el.src = t.file; musicPlay();
  const label = '♪ ' + t.title + (t.artist ? ' — ' + t.artist : '');
  const np = $('nowPlaying'); if (np) { np.textContent = label; np.classList.add('show'); music.toastT = 5; }
  renderMusic();
}
function musicPlay() {
  if (!music.el) return;
  const p = music.el.play(); if (p && p.catch) p.catch(e => { if (e && e.name === 'NotAllowedError') { music.blocked = true; sndHint(); } });
}
function musicKick() { // relance après un geste (clic, touche, écran) si la musique était bloquée
  if (!audio.ctx) return; if (!music.el) { musicEnsure(); return; }
  if (music.el.paused && music.el.src) musicPlay();
  sndHint();
}
function musicPrefetch() { // la piste suivante est téléchargée à l'avance : elle reste disponible hors ligne
  if (!music.list.length || !('serviceWorker' in navigator) || !navigator.onLine) return;
  const nx = music.order[(music.pos + 1) % music.order.length], t = music.list[nx]; if (!t || music.pre === t.file) return;
  music.pre = t.file; setTimeout(() => { fetch(t.file).then(r => r.blob()).catch(() => {}); }, 15000);
}
function sndHint() { // bandeau : le navigateur attend un clic / une touche pour autoriser le son
  const el = $('sndHint'); if (!el) return;
  const off = !audio.ctx || audio.ctx.state !== 'running' || (music.blocked && music.el && music.el.paused);
  el.classList.toggle('show', off && (state !== 'loading'));
  if (isTouch && el.dataset.t !== '1') { el.dataset.t = '1'; el.textContent = '🔊 Touche l’écran pour activer le son'; }
}
setInterval(sndHint, 1500);
function renderMusic() {
  const el = $('musicNow'); if (el) el.textContent = music.cur ? 'En cours : ' + music.cur.title + (music.cur.artist ? ' — ' + music.cur.artist : '') + ' · ' + music.list.length + ' morceaux en aléatoire' : (music.list.length ? music.list.length + ' morceaux en aléatoire' : 'Aucune musique');
  const v = $('musicVol'); if (v && +v.value !== Math.round(music.vol * 100)) v.value = Math.round(music.vol * 100);
}
const MUSIC_MIX = { loading: 0, menu: 0.75, countdown: 0.55, play: 0.8, finish: 1, results: 0.85, pause: 0.5 };
function updateMusic(dt) {
  if (music.toastT > 0) { music.toastT -= dt; if (music.toastT <= 0) { const np = $('nowPlaying'); if (np) np.classList.remove('show'); } }
  if (!music.gain || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  let target = prof.muted ? 0 : music.vol * (MUSIC_MIX[state] !== undefined ? MUSIC_MIX[state] : 0.7);
  if (state === 'play' && player && player.nitroOn) target *= 1.1;
  music.gain.gain.setTargetAtTime(target * 0.9, t, 0.35);
  music.filter.frequency.setTargetAtTime(state === 'pause' ? 700 : (state === 'countdown' ? 3500 : 20000), t, 0.25);
}
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { initAudio(); }, { passive: true }));
{ const sh = document.getElementById('sndHint'); if (sh) sh.addEventListener('click', () => { initAudio(); musicKick(); }); }

/* ======================= Entrées ======================= */
const keys = {};
const touch = { left: false, right: false, gas: false, brake: false, hb: false, nitro: false };
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (intro.on) { if (!e.repeat) { initAudio(); introEnd(); } return; }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play' || state === 'countdown') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state !== 'play' && state !== 'countdown') return;
  if (e.code === 'KeyR' && state === 'play') { if (TAXI && TAXI.active) TAXI.reset(); else resetToTrack(player, true); }
  if (e.code === 'KeyH' && TAXI && TAXI.active) TAXI.horn();
  if (e.code === 'KeyV' && !e.repeat && (state === 'play' || state === 'countdown')) setClean(!prof.cleanHud, true);
  if ((e.code === 'KeyF' || e.code === 'KeyE') && TAXI && TAXI.active && !e.repeat) TAXI.door();
  if (e.code === 'KeyC') cycleCam();
  if (e.code === 'KeyM') setMuted(!prof.muted);
  if (e.code === 'KeyK') nextTrack();
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
/* --- Manette (USB, Xbox, PlayStation, génériques) --- */
/* ======================= Manettes (jusqu'à 2 joueurs) ======================= */
// Chaque manette a sa configuration (Options → Configurer la manette). Sans configuration :
// ✕ accélérer · O nitro · □ drift · △ frein (puis marche arrière à l'arrêt)
// croix : gauche / droite tourner, haut avancer, bas reculer / freiner
// stick gauche : avancer / reculer · stick droit : tourner à gauche / à droite
// Start : lancer le jeu / pause · Select : options · L1 replacer la voiture · L1 / R1 onglets dans les menus
const pad = { prev: {}, active: false, name: '', sel: undefined, selFor: null };
const pad2 = { prev: {} };
const PADMAP_KEY = 'padmap4';
let padMaps = store.get(PADMAP_KEY, {}) || {};
function getPads() { const out = []; try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected !== false) out.push(p); } catch (e) {} return out; }
function getPad(k) { return getPads()[k || 0] || null; }
const bv = (p, i) => { const b = p.buttons[i]; if (!b) return 0; return typeof b === 'object' ? (b.value || (b.pressed ? 1 : 0)) : (b ? 1 : 0); };
const padKey = p => (p.id || 'manette') + '|' + (p.mapping || 'raw');
// position de repos des axes (certaines manettes ont des gâchettes au repos à -1)
const padRest = {};
function restOf(p) { const k = padKey(p) + '#' + p.index; if (!padRest[k]) padRest[k] = p.axes.map(a => (Math.abs(a) > 0.5 && Math.abs(a) <= 1.01 ? a : 0)); return padRest[k]; }
const B = i => ['b', i];
const DEF_STD = { ok: [B(0)], gas: [B(7)], rev: [B(3), B(6)], drift: [B(2), B(5)], nitro: [B(1)], left: [B(14)], right: [B(15)], up: [B(12)], down: [B(13)], start: [B(9)], select: [B(8)], reset: [B(4)], cam: [B(10), B(11)], tabL: [B(4)], tabR: [B(5)], back: [B(1)] };
// manettes USB génériques (sans « mapping standard ») : ordre habituel △ O ✕ □ L1 R1 L2 R2 Select Start L3 R3
const DEF_RAW = { ok: [B(2)], gas: [B(7)], rev: [B(0), B(6)], drift: [B(3), B(5)], nitro: [B(1)], left: [], right: [], up: [], down: [], start: [B(9)], select: [B(8)], reset: [B(4)], cam: [B(10), B(11)], tabL: [B(4)], tabR: [B(5)], back: [B(1)] };
const CUSTOM_CLEAR = { gas: [], rev: [], drift: [], nitro: [], left: [], right: [], up: [], down: [] };
function padMap(p) { const base = p.mapping === 'standard' ? DEF_STD : DEF_RAW, c = padMaps[padKey(p)]; return c ? Object.assign({}, base, CUSTOM_CLEAR, c) : base; }
function bindVal(p, bd, rest) {
  if (bd[0] === 'b') return bv(p, bd[1]);
  if (bd[0] === 'a') { const v = ((p.axes[bd[1]] || 0) - (rest[bd[1]] || 0)) * bd[2]; return v > 0.3 ? clamp((v - 0.3) / 0.55, 0, 1) : 0; }
  if (bd[0] === 'v') { const v = p.axes[bd[1]]; return v !== undefined && Math.abs(v - bd[2]) < 0.09 ? 1 : 0; }
  return 0;
}
function hat(p) { // croix lue sur l'axe « chapeau » (axe 9) ou sur les axes 6 / 7 des manettes génériques
  const d = { u: 0, d: 0, l: 0, r: 0 };
  if (p.mapping !== 'standard' && p.axes.length >= 8 && p.axes.length < 10) { const x = p.axes[6], y = p.axes[7], dig = v => Math.abs(v) < 0.02 || Math.abs(Math.abs(v) - 1) < 0.02; if (dig(x) && dig(y)) { if (x < -0.5) d.l = 1; if (x > 0.5) d.r = 1; if (y < -0.5) d.u = 1; if (y > 0.5) d.d = 1; } }
  if (p.mapping !== 'standard' && p.axes.length > 9) { const h = p.axes[9]; if (Math.abs(h) <= 1.05) { const k = Math.round((h + 1) * 3.5) % 8; if (k === 7 || k <= 1) d.u = 1; if (k >= 1 && k <= 3) d.r = 1; if (k >= 3 && k <= 5) d.d = 1; if (k >= 5 && k <= 7) d.l = 1; } }
  return d;
}
// toutes les actions d'une manette, de 0 à 1
function padActs(p) {
  const m = padMap(p), rest = restOf(p), A = i => (p.axes[i] || 0) - (rest[i] || 0), o = {};
  for (const k in m) { let v = 0; for (const bd of m[k]) v = Math.max(v, bindVal(p, bd, rest)); o[k] = v; }
  const custom = !!padMaps[padKey(p)], hh = custom ? { u: 0, d: 0, l: 0, r: 0 } : hat(p);
  o.left = Math.max(o.left, hh.l); o.right = Math.max(o.right, hh.r); o.up = Math.max(o.up, hh.u); o.down = Math.max(o.down, hh.d);
  // stick droit : volant (axe 2 par défaut) · stick gauche : avancer / reculer (axe 1)
  const sa = (m.steerAxis && m.steerAxis[0]) ? m.steerAxis[0] : ['a', 2, -1], ga = (m.gasAxis && m.gasAxis[0]) ? m.gasAxis[0] : ['a', 1, -1];
  const rx = p.axes.length > sa[1] ? A(sa[1]) * -sa[2] : 0, ly = -(A(ga[1]) * ga[2]); // rx > 0 = droite · ly < 0 = vers l'avant
  const lx = sa[1] !== 0 ? A(0) : 0; // le stick gauche tourne aussi un peu (utile si la croix passe par le stick gauche)
  const dzs = (v, z) => (Math.abs(v) > z ? Math.sign(v) * Math.min(1, (Math.abs(v) - z) / (1 - z)) : 0);
  o.stickX = dzs(rx, 0.14) || dzs(lx, 0.35);
  o.stickF = ly < -0.3 ? Math.min(1, (-ly - 0.3) / 0.5) : 0; o.stickB = ly > 0.45 ? 1 : 0;
  // pour les menus : croix, ou n'importe quel stick
  o.navL = Math.max(o.left, rx < -0.6 || lx < -0.6 ? 1 : 0); o.navR = Math.max(o.right, rx > 0.6 || lx > 0.6 ? 1 : 0);
  o.navU = Math.max(o.up, ly < -0.6 ? 1 : 0); o.navD = Math.max(o.down, ly > 0.6 ? 1 : 0);
  return o;
}
const EDGE_ACTS = ['ok', 'back', 'start', 'select', 'reset', 'cam', 'tabL', 'tabR', 'navL', 'navR', 'navU', 'navD'];
function padEdgesOf(p, st) {
  const a = padActs(p), now = {}, pressed = [];
  for (const k of EDGE_ACTS) { now[k] = a[k] > 0.5; if (now[k] && !st.prev[k]) pressed.push(k); }
  st.prev = now; return pressed;
}
function rumble(strength, ms, k) {
  const p = getPad(k || 0); if (!p) return;
  try { if (p.vibrationActuator && p.vibrationActuator.playEffect) p.vibrationActuator.playEffect('dual-rumble', { duration: ms || 180, strongMagnitude: clamp(strength, 0, 1), weakMagnitude: clamp(strength + 0.2, 0, 1) }); } catch (e) {}
}
function padStatusText() {
  const el = $('padStatus'); if (!el) return;
  const ps = getPads();
  el.textContent = ps.length ? ps.map((p, k) => '🎮 Manette ' + (k + 1) + ' : ' + ((p.id || 'manette').replace(/\(.*?\)/g, '').trim().slice(0, 34) || 'manette') + (p.mapping === 'standard' ? '' : ' (USB générique)') + (padMaps[padKey(p)] ? ' · configurée' : '')).join('   ') : 'Aucune manette détectée (branche-la puis appuie sur un bouton).';
}
window.addEventListener('gamepadconnected', e => { pad.name = (e.gamepad && e.gamepad.id || '').replace(/\(.*?\)/g, '').trim().slice(0, 40); padStatusText(); if (state === 'play') popup('🎮 MANETTE ' + (e.gamepad.index + 1) + ' CONNECTÉE', '', false, 'blue'); });
window.addEventListener('gamepaddisconnected', () => { padStatusText(); if (!getPads().length) { pad.active = false; document.body.classList.remove('pad'); } if (state === 'play') pauseGame(); });

/* --- Navigation au clavier de manette dans les menus (croix / stick, ✕ ou Start pour valider) --- */
const NAV_SEL = '.tab, .opt, .seg button, .carCard, .p2car, .sw, .btn, input[type=range]';
const nav = { el: null, ref: null };
function navRoot() { if (wiz.on) return null; if (state === 'menu') return $('menu'); if (state === 'pause') return $('pause'); if (state === 'results') return $('results'); return null; }
function navItems(root) { return [...root.querySelectorAll(NAV_SEL)].filter(e => e.offsetParent !== null && !e.disabled && e.getBoundingClientRect().width > 4); }
function navSet(e) {
  if (nav.el && nav.el !== e) nav.el.classList.remove('padsel');
  nav.el = e; if (!e) return; e.classList.add('padsel');
  const c = e.closest('[id]'), list = c ? navItems(c) : []; nav.ref = { c: c && c.id, i: list.indexOf(e) };
  try { e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) {}
}
function navResolve(root) {
  if (nav.el && root.contains(nav.el) && nav.el.offsetParent !== null) { nav.el.classList.add('padsel'); return nav.el; }
  let e = null;
  if (nav.ref && nav.ref.c) { const c = $(nav.ref.c); if (c && root.contains(c)) { const l = navItems(c); e = l[Math.min(nav.ref.i, l.length - 1)] || null; } }
  if (!e) e = root.querySelector(state === 'menu' ? (menuTab === 'play' ? '.opt.sel' : menuTab === 'garage' ? '.carCard.sel' : '.tab.sel') : '.btns .btn');
  if (e && e.offsetParent === null) e = null;
  if (!e) e = navItems(root)[0] || null;
  navSet(e); return e;
}
function navMove(dx, dy) {
  const root = navRoot(); if (!root) return;
  const cur = navResolve(root); if (!cur) return;
  if (cur.type === 'range' && dx) { cur.value = +cur.value + dx * (+cur.step || 1) * 5; cur.dispatchEvent(new Event('input', { bubbles: true })); return; }
  const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  let best = null, bs = Infinity;
  for (const e of navItems(root)) {
    if (e === cur) continue;
    const r = e.getBoundingClientRect(), ex = r.left + r.width / 2, ey = r.top + r.height / 2, ddx = ex - cx, ddy = ey - cy;
    const along = dx ? ddx * dx : ddy * dy, perp = dx ? Math.abs(ddy) : Math.abs(ddx);
    if (along <= 6) continue;
    const overlap = dx ? (r.top < r0.bottom - 2 && r.bottom > r0.top + 2) : (r.left < r0.right - 2 && r.right > r0.left + 2); // même ligne / même colonne d'abord
    const sc = overlap ? along + perp * 0.3 : along + perp * 2.2 + 2000; if (sc < bs) { bs = sc; best = e; }
  }
  if (best) { navSet(best); blip(660, 0.04, 0.05); }
}
function navOk() { const root = navRoot(); if (!root) return; const e = navResolve(root); if (!e) return; blip(880, 0.05, 0.06); e.click(); setTimeout(() => { const r = navRoot(); if (r) navResolve(r); }, 0); }
function navClear() { if (nav.el) nav.el.classList.remove('padsel'); nav.el = null; }

/* --- Assistant de configuration : on appuie sur chaque bouton de sa manette --- */
const WIZ_STEPS = [
  ['ok', '✕ — ACCÉLÉRER (et valider dans les menus)'], ['nitro', 'O — NITRO'], ['drift', '□ — DRIFT'], ['rev', '△ — FREIN (marche arrière à l\'arrêt)'],
  ['left', 'CROIX GAUCHE (tourner à gauche)'], ['right', 'CROIX DROITE (tourner à droite)'], ['up', 'CROIX HAUT (avancer)'], ['down', 'CROIX BAS (reculer / freiner)'],
  ['gasAxis', 'STICK GAUCHE poussé vers l\'AVANT'], ['steerAxis', 'STICK DROIT poussé vers la GAUCHE'], ['start', 'START (lancer le jeu / pause)'], ['select', 'SELECT (options)'],
];
const wiz = { on: false, k: 0, pi: 0, base: null, map: null, wait: 0 };
function wizSnap(p) { return { b: p.buttons.map((b, i) => bv(p, i)), a: p.axes.slice() }; }
function wizOpen(pi) {
  const p = getPad(pi);
  if (!p) { $('wizMsg').textContent = 'Branche la manette ' + (pi + 1) + ' et appuie sur un de ses boutons, puis recommence.'; $('padWiz').classList.remove('hidden'); wiz.on = true; wiz.k = -1; wiz.pi = pi; return; }
  Object.assign(wiz, { on: true, k: 0, pi, base: wizSnap(p), map: {}, armed: false });
  $('padWiz').classList.remove('hidden'); wizShow();
}
function wizShow() {
  const p = getPad(wiz.pi), st = WIZ_STEPS[wiz.k];
  $('wizPad').textContent = 'Manette ' + (wiz.pi + 1) + (p ? ' · ' + (p.id || '').replace(/\(.*?\)/g, '').trim().slice(0, 40) : '');
  $('wizStep').textContent = (wiz.k + 1) + ' / ' + WIZ_STEPS.length;
  $('wizMsg').innerHTML = 'Appuie sur : <b>' + esc(st[1]) + '</b>';
}
function wizClose(save) {
  if (save && wiz.map) { const p = getPad(wiz.pi); if (p) { padMaps[padKey(p)] = wiz.map; store.set(PADMAP_KEY, padMaps); } }
  wiz.on = false; $('padWiz').classList.add('hidden'); padStatusText(); for (const st of [pad, pad2]) st.prev = { ok: true, start: true, back: true, select: true };
}
function wizNext(bind) {
  const st = WIZ_STEPS[wiz.k];
  if (bind) wiz.map[st[0]] = [bind];
  blip(bind ? 990 : 520, 0.08, 0.08);
  wiz.k++; wiz.armed = false;
  if (wiz.k >= WIZ_STEPS.length) { $('wizMsg').innerHTML = '<b>Manette configurée !</b> Tu peux jouer.'; $('wizStep').textContent = '✓'; setTimeout(() => wizClose(true), 900); wiz.k = -2; return; }
  wizShow();
}
function wizPoll(dt) {
  if (wiz.k < 0) return;
  const p = getPad(wiz.pi); if (!p) return;
  const b0 = wiz.base, want = WIZ_STEPS[wiz.k][0];
  // on attend que tout soit relâché (position de repos) avant d'écouter le bouton suivant
  if (!wiz.armed) { const neutral = p.buttons.every((_, i) => bv(p, i) < 0.3 || (b0.b[i] || 0) > 0.3) && p.axes.every((v, i) => Math.abs(v - (b0.a[i] || 0)) < 0.25); if (neutral) wiz.armed = true; return; }
  const axisStep = want === 'steerAxis' || want === 'gasAxis';
  if (!axisStep) for (let i = 0; i < p.buttons.length; i++) if (bv(p, i) > 0.6 && (b0.b[i] || 0) < 0.3) return wizNext(['b', i]);
  for (let i = 0; i < p.axes.length; i++) {
    const v = p.axes[i], r = b0.a[i] || 0;
    if (Math.abs(r) > 1.02 || Math.abs(v) > 1.02) { if (Math.abs(v - r) > 0.2 && Math.abs(v) <= 1.02 && !axisStep) return wizNext(['v', i, +v.toFixed(3)]); continue; } // croix « chapeau »
    if (Math.abs(v - r) > 0.65) return wizNext(['a', i, v > r ? 1 : -1]);
  }
}
$('wizSkip').onclick = () => { if (wiz.k >= 0) wizNext(null); else wizClose(false); };
$('wizCancel').onclick = () => wizClose(false);
$('btnPadCfg').onclick = () => wizOpen(0);
$('btnPadCfg2').onclick = () => wizOpen(1);
$('btnPadReset').onclick = () => { padMaps = {}; store.set(PADMAP_KEY, padMaps); padStatusText(); popupMenu('Configuration des manettes remise par défaut'); };
function popupMenu(t) { const el = $('padStatus'); if (el) { el.textContent = t; setTimeout(padStatusText, 2500); } }

function pollPad(dt) {
  if (wiz.on) { wizPoll(dt || 1 / 60); return; }
  const ps = getPads();
  if (!ps.length) { if (pad.active) { pad.active = false; document.body.classList.remove('pad'); padStatusText(); navClear(); } return; }
  const e = padEdgesOf(ps[0], pad), e2 = ps[1] ? padEdgesOf(ps[1], pad2) : [];
  const anyOn = q => q.buttons.some((_, i) => bv(q, i) > 0.5) || q.axes.some((v, i) => Math.abs(v - (restOf(q)[i] || 0)) > 0.5 && Math.abs(v) <= 1.01);
  if (!pad.active) { if (!e.length && !e2.length && !anyOn(ps[0]) && !(ps[1] && anyOn(ps[1]))) return; pad.active = true; pad.name = (ps[0].id || '').replace(/\(.*?\)/g, '').trim().slice(0, 40); document.body.classList.add('pad'); padStatusText(); initAudio(); }
  const has = k => e.includes(k) || e2.includes(k);
  if (intro.on) { if (e.length || e2.length) introEnd(); return; }
  if (state === 'play' || state === 'countdown') {
    if (TAXI && TAXI.active && has('select') && state === 'play') TAXI.door(); // mode Taxi : Select = descendre / monter
    else if (has('start') || has('select')) pauseGame(); // Start : pause · Select : menu des options de la course
    else if (e.includes('reset') && state === 'play') { if (TAXI && TAXI.active) TAXI.reset(); else resetToTrack(player, true); }
    else if (TAXI && TAXI.active && has('tabR')) TAXI.horn();
    else if (e2.includes('reset') && state === 'play' && player2) resetToTrack(player2, true);
    else if (has('cam')) cycleCam();
    return;
  }
  if (state === 'menu' || state === 'pause' || state === 'results') {
    // le joueur 2 choisit sa voiture avec sa croix (mode 2 joueurs)
    if (state === 'menu' && mode() === 'duo' && e2.length) {
      if (e2.includes('navL') || e2.includes('navR')) { const i = CARS.findIndex(c => c.id === prof.car2); selectCar2(CARS[(i + (e2.includes('navR') ? 1 : CARS.length - 1)) % CARS.length].id); }
      if (e2.includes('start')) startGame();
      return;
    }
    if (!e.length && !e2.length) return;
    const root = navRoot(); if (!root) return;
    navResolve(root);
    if (has('navL')) navMove(-1, 0); if (has('navR')) navMove(1, 0); if (has('navU')) navMove(0, -1); if (has('navD')) navMove(0, 1);
    if (state === 'menu') {
      const tabs = ['play', 'garage', 'online', 'options'];
      if (has('tabL') || has('tabR')) { const i = tabs.indexOf(menuTab); const t = tabs[(i + (has('tabR') ? 1 : tabs.length - 1)) % tabs.length]; document.querySelector('.tab[data-tab="' + t + '"]').click(); navClear(); navResolve(root); }
      if (has('ok')) navOk();
      else if (has('start')) startGame();
      else if (has('select')) { document.querySelector('.tab[data-tab="' + (menuTab === 'options' ? 'play' : 'options') + '"]').click(); navClear(); navResolve(root); }
      else if (has('back') && menuTab !== 'play') { showTab('play'); navClear(); navResolve(root); }
    } else {
      if (has('select')) { const l = [...root.querySelectorAll('.btns .btn')].filter(b => b.offsetParent !== null); const i = l.indexOf(nav.el); navSet(l[(i + 1) % l.length]); blip(660, 0.04, 0.05); }
      if (has('start')) { if (state === 'pause') resumeGame(); else $('btnAgain').click(); } // Start : reprendre / rejouer
      else if (has('ok')) navOk();
      else if (has('back') && state === 'pause') resumeGame();
    }
  }
}
function nitroKeyName() { return pad.active ? 'O' : 'MAJ'; }
{ // bouton nitro à l'écran (souris / doigt)
  const el = $('nitroBtn');
  const on = e => { e.preventDefault(); touch.mnitro = true; initAudio(); }, off = () => { touch.mnitro = false; };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
function readInput(k) {
  k = k || 0;
  const kb = keys, duo = mode() === 'duo' && (state === 'play' || state === 'countdown' || state === 'finish');
  let thr = 0, brk = 0, steer = 0, hb = 0, nitro = 0;
  if (k === 0) {
    thr = (kb.KeyW || (!duo && kb.ArrowUp) || touch.gas || touch.autogas) ? 1 : 0;
    brk = (kb.KeyS || (!duo && kb.ArrowDown) || touch.brake) ? 1 : 0;
    steer = ((kb.KeyA || (!duo && kb.ArrowLeft) || touch.left) ? 1 : 0) - ((kb.KeyD || (!duo && kb.ArrowRight) || touch.right) ? 1 : 0);
    hb = (kb.Space || touch.hb) ? 1 : 0;
    nitro = (kb.ShiftLeft || (!duo && kb.ShiftRight) || touch.nitro || touch.mnitro) ? 1 : 0; // un seul bouton nitro : Maj (ou le bouton à l'écran)
  } else { // joueur 2 au clavier : flèches, Entrée = drift, Maj droite / Ctrl droit = nitro
    thr = kb.ArrowUp ? 1 : 0; brk = kb.ArrowDown ? 1 : 0; steer = (kb.ArrowLeft ? 1 : 0) - (kb.ArrowRight ? 1 : 0);
    hb = (kb.Enter || kb.NumpadEnter || kb.Numpad0) ? 1 : 0; nitro = (kb.ShiftRight || kb.ControlRight) ? 1 : 0;
  }
  const p = (k === 0 ? pad.active : true) ? getPad(k) : null;
  if (p) {
    const a = padActs(p);
    if (a.stickX) steer = -a.stickX;
    if (a.left > 0.5) steer = 1; if (a.right > 0.5) steer = -1;
    thr = Math.max(thr, a.ok, a.gas, a.up, a.stickF);
    brk = Math.max(brk, a.rev, a.down, a.stickB);
    if (a.drift > 0.5) hb = 1;
    if (a.nitro > 0.5) nitro = 1;
  }
  return { thr, brk, steer: clamp(steer, -1, 1), hb, nitro };
}

/* ======================= Physique ======================= */
let carSeq = 0;
function newCar(o) {
  return Object.assign({
    id: ++carSeq, name: 'Pilote', color: 0xc8102e, isPlayer: false, isAI: false, spec: makeSpec('race', { engine: 0, tires: 0, nitro: 0 }),
    x: 0, z: 0, h: 0, vx: 0, vz: 0, w: 0, steer: 0, idx: 0, lat: 0, off: false, kick: 0, onBr: null, edge: 9, nearEdge: false, carId: 'audi', drifting: false, slip: 0, speed: 0, vF: 0,
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
  dynStep(c, inp, dt);
  return trackStep(c);
}
function dynStep(c, inp, dt) { // dynamique du véhicule (sans le circuit) : réutilisée par le mode Taxi
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
  if (c.kick > 0) c.kick = Math.max(0, c.kick - dt);
  const vmax = sp.maxSpeed * (nitroOn ? 1.22 : 1) * c.boost * (c.kick > 0 ? 1.1 : 1);
  let acc = 0;
  if (inp.thr > 0) {
    if (vF < -1) acc += 22 * inp.thr;
    else acc += sp.power * c.boost * inp.thr * Math.max(0, 1 - Math.max(vF, 0) / vmax) * (off ? Math.min(1, 0.55 * (sp.offGrip || 1)) : 1) * (c.drifting ? 0.8 : 1);
  }
  if (nitroOn) acc += sp.nitroPower * Math.max(0, 1 - Math.max(vF, 0) / vmax);
  if (c.kick > 0 && vF > 0) acc += 14 * Math.max(0, 1 - vF / vmax);
  if (inp.brk > 0) { if (vF > 1) acc -= 28 * inp.brk; else if (vF > -11) acc -= sp.power * 0.55 * inp.brk; }
  vF += acc * dt;
  if (inp.hb) { const d = Math.min(Math.abs(vF), 7 * dt); vF -= Math.sign(vF) * d; }
  vF -= (vF * (off ? 1.1 / (sp.offGrip || 1) : 0.06) + vF * Math.abs(vF) * 0.0011) * dt;
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
  c.vF = vF; c.slip = slip; c.speed = Math.hypot(c.vx, c.vz);
}
function trackStep(c) {
  const nn = nearest(c.x, c.z, c.idx < 0 ? -1 : c.idx);
  const nb = nearestAnyBr(c.x, c.z);
  const prev = c.idx; c.idx = nn.i; c.lat = nn.lat; c.onBr = null;
  const aLat = Math.abs(nn.lat);
  if (nb && !c.isAI && nb.k >= nb.br.k0 && nb.k <= nb.br.k1 && nb.d < aLat) { c.onBr = nb; c.idx = nb.br.mapIdx(nb.k); c.lat = nb.lat; }
  c.off = aLat > HALF + CURB_W + 0.6 && !(nb && nb.d < BHALF + CURB_W + 0.6);
  const lim = WI[nn.i] - 1.3, limB = BW - 1.3;
  c.y = c.onBr ? 0 : elevAt(nn.i, nn.lat);
  const exM = aLat - lim, exB = nb ? nb.d - limB : Infinity;
  c.edge = Math.max(-exM, -exB);
  c.nearEdge = nb && nb.d < aLat ? nb.d > BHALF - 2.5 : aLat > HALF - 2.5;
  if (exM > 0 && exB > 0) {
    let nx, nz, ex;
    if (exM <= exB) { const sg = Math.sign(nn.lat); nx = NX[nn.i] * sg; nz = NZ[nn.i] * sg; ex = exM; }
    else { nx = (c.x - nb.br.X[nb.k]) / (nb.d || 1); nz = (c.z - nb.br.Z[nb.k]) / (nb.d || 1); ex = exB; }
    c.x -= nx * ex; c.z -= nz * ex;
    const vn = c.vx * nx + c.vz * nz;
    if (vn > 0) {
      c.vx -= nx * vn * 1.35; c.vz -= nz * vn * 1.35;
      const keep = vn > 6 ? 0.7 : 0.9; c.vx *= keep; c.vz *= keep; c.w *= 0.5;
      if (vn > 3.5) { c.crash = Math.max(c.crash, vn); c.hitP = [c.x + nx * 1.0, c.z + nz * 1.0, nx, nz]; }
    }
  }
  c.speed = Math.hypot(c.vx, c.vz);
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
      if (vn < 0) { const j = -1.3 * vn / 2; a.vx -= dx * j; a.vz -= dz * j; b.vx += dx * j; b.vz += dz * j; b.w += Math.sign(dx * Math.cos(b.h) - dz * Math.sin(b.h)) * Math.sign(ob) * j * 0.05; }
    }
    if (vn < 0) { a.w -= Math.sign(dx * Math.cos(a.h) - dz * Math.sin(a.h)) * Math.sign(oa) * (-vn) * 0.05; if (-vn > 4) { a.crash = Math.max(a.crash, -vn * 0.8); a.hitP = [(ax + bx) / 2, (az + bz) / 2, dx, dz]; if (!bStatic) { b.crash = Math.max(b.crash, -vn * 0.8); b.hitP = [(ax + bx) / 2, (az + bz) / 2, -dx, -dz]; } } }
  }
}

/* ======================= IA ======================= */
function aiInput(c, cars) {
  const ai = c.ai, sp = c.spec, speed = c.speed;
  const la = idxWrap(c.idx + Math.round((9 + speed * 0.55) / SEG));
  let kAvg = 0; for (let d = 10; d <= 70; d += 10) kAvg += K[idxWrap(c.idx + Math.round(d / SEG))]; kAvg /= 7;
  const inside = clamp(kAvg * 900, -(HALF - 3), HALF - 3);
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
  const lane = clamp(inside + ai.lane * (1 - Math.min(1, Math.abs(kAvg) * 140)) + ai.avoid, -(HALF - 2.5), HALF - 2.5);
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
  player.name = prof.name; player.carId = prof.car;
  player.spec = makeSpec(mode(), prof.upg, prof.car);
  if (player.model && player.model.carId !== prof.car) { scene.remove(player.model.root); player.model = null; }
  if (!player.model) { player.model = buildCar(prof.car, 'hi', PAINTS[prof.paint], RIMS[prof.rim].c); scene.add(player.model.root); attachHeadlights(player.model); }
  if (!cars.includes(player)) cars.unshift(player);
  setCarPaint(player.model, PAINTS[prof.paint]);
  for (const o of player.model.rimMeshes) o.material = rimMat(RIMS[prof.rim].c);
  player.color = carDef(prof.car).paint ? PAINTS[prof.paint] : carDef(prof.car).color;
}
// choix d'une voiture au garage (le modèle détaillé est chargé à la demande)
function selectCar(id) {
  prof.car = id; store.set('car', id);
  const k = carKey(id, 'hi');
  if (ASSETS[k] === undefined) { $('carTitle').textContent = carDef(id).name + ' · chargement…'; loadAsset(k, () => { if (prof.car === id) { if (player && player.model) { scene.remove(player.model.root); player.model = null; } ensurePlayer(); renderGarage(); } }); }
  ensurePlayer(); renderGarage();
}
function clearAI() { for (const c of cars) if (!c.isPlayer && c.model) scene.remove(c.model.root); cars = player ? [player] : []; player2 = null; }
function resetPlayerRun(c) { Object.assign(c, { lap: 0, cp: true, lapStart: 0, lapTimes: [], bestLap: Infinity, finished: false, finishTime: 0, nitro: 0.35, crash: 0, boost: 1, stuck: 0, frozen: true, prog: 0 }); }

function startGame() {
  goLandscape(); armBack();
  if (mode() === 'taxi' && TAXI) { initAudio(); saveProf(); TAXI.start(); return; }
  if (TAXI && TAXI.active) TAXI.exit();
  initAudio(); saveProf(); ensurePlayer(); repairModel(player.model); crashFx.clear(); clearAI();
  if (ghostCar) { scene.remove(ghostCar.model.root); ghostCar = null; }
  clearSkids(); clearSmoke();
  const m = mode();
  Object.assign(game, { time: 0, raceT: 0, score: 0, timeLeft: 90, drifts: 0, bestCombo: 0, maxAngle: 0, countdown: 3.2, lastCount: -1, laps: prof.laps, earned: 0, finishWait: 0, wrongT: 0, stuck: 0, lightsT: 0, ghostRec: [], newBest: false, nitroTold: false, bottles: 0, flashT: 0, street: null, mi: undefined });
  for (const b of BOTTLES) b.t = 0;
  game.best = store.get('best_' + m, 0);
  Object.assign(combo, { active: false, pts: 0, time: 0, grace: 0, mult: 1 });
  resetPlayerRun(player);
  if (raceLike(m)) {
    const d = DIFF[prof.diff], duo = m === 'duo';
    const slots = duo && !prof.duoAI ? [2, 3] : [0, 1, 2, 3, 4, 5]; const pSlot = duo ? 2 : 3;
    const ordered = pickDrivers(5);
    const aiCars = CARS.map(c => c.id).filter(id => id !== prof.car && !(duo && id === prof.car2)).sort(() => Math.random() - 0.5);
    while (aiCars.length < 5) aiCars.push(CARS[aiCars.length % CARS.length].id);
    if (duo) makePlayer2();
    let ai = 0;
    for (const k of slots) {
      const s = gridSlot(k);
      if (k === pSlot) { placeCar(player, s.i, 0, s.h); player.x = s.x; player.z = s.z; continue; }
      if (duo && k === 3) { placeCar(player2, s.i, 0, s.h); player2.x = s.x; player2.z = s.z; continue; }
      const dr = ordered[ai++];
      const cid = aiCars[ai - 1], cd = carDef(cid);
      const c = newCar({ isAI: true, name: dr.name, color: cd.paint ? dr.c : cd.color, carId: cid, spec: makeSpec('race', { engine: prof.diff, tires: prof.diff, nitro: 1 }) });
      c.spec.power *= d.power; c.spec.latMax = d.aLat;
      const talent = 1 - ai * 0.018 + (Math.random() - 0.5) * 0.02;
      c.spec.power *= 0.97 + talent * 0.03;
      c.ai = { lane: (Math.random() - 0.5) * 14, avoid: 0, aLat: d.aLat * talent, brake: d.brake };
      resetPlayerRun(c); placeCar(c, s.i, 0, s.h); c.x = s.x; c.z = s.z;
      c.model = buildCar(cid, 'lo', dr.c, RIMS[(ai + 1) % RIMS.length].c); scene.add(c.model.root);
      cars.push(c);
    }
  } else if (m === 'online') {
    placeCar(player, idxWrap(-Math.round(30 / SEG) - Math.floor(Math.random() * 40)), (Math.random() - 0.5) * 8);
  } else {
    placeCar(player, idxWrap(-Math.round(12 / SEG)), 0);
  }
  if (m === 'time') {
    const gs = store.get('ghost3' + TKS, null);
    game.ghost = gs && gs.p && gs.p.length > 10 ? gs : null;
    game.bestLapT = game.ghost ? game.ghost.t : Infinity;
    buildGhostIndex();
    ghostCar = { model: buildCar(prof.car, 'lo', 0x7dd3fc, 0xffffff, true) }; ghostCar.model.root.visible = false; scene.add(ghostCar.model.root);
  }
  camState.init = false;
  showScreen(null);
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('hudTimer').classList.toggle('hidden', m !== 'chrono');
  $('hudScore').classList.toggle('hidden', raceLike(m) || m === 'time');
  $('hudPos').classList.toggle('hidden', m !== 'race');
  $('standings').classList.toggle('hidden', m !== 'race');
  document.body.classList.toggle('duo', m === 'duo'); duo.msg = [null, null]; game.mi2 = undefined; game.duoWait = 0;
  $('onlineBar').classList.toggle('hidden', m !== 'online');
  $('popups').innerHTML = ''; $('delta').textContent = '';
  if (m === 'online') { net.active = true; net.rid = null; net.rat = 0; net.raceState = 'free'; player.frozen = false; state = 'play'; $('countdown').classList.add('hidden'); $('lights').classList.add('hidden'); popup('SESSION EN LIGNE', 'Roule librement, lance une course quand tu veux', false, 'blue'); }
  else if (raceLike(m)) { state = 'countdown'; game.lightsT = 0; game.goAt = 3.4 + Math.random() * 0.8; $('lights').classList.remove('hidden'); $('lights').classList.remove('go'); $('countdown').classList.add('hidden'); }
  else { state = 'countdown'; $('countdown').classList.remove('hidden'); $('lights').classList.add('hidden'); }
  updateHud();
}
function showScreen(id) {
  for (const s of ['menu', 'pause', 'results']) $(s).classList.toggle('hidden', s !== id);
  document.querySelectorAll('.padsel').forEach(b => b.classList.remove('padsel')); nav.el = null; nav.ref = null;
  if (pad.active && id) setTimeout(() => { const r = navRoot(); if (r) navResolve(r); }, 0);
}
function pauseGame() {
  if (state !== 'play' && state !== 'countdown') return;
  if (mode() === 'online') { // pas de vraie pause en ligne
    game.pausedFrom = state; state = 'pause'; showScreen('pause'); $('btnRestart').classList.add('hidden'); return;
  }
  game.pausedFrom = state; state = 'pause'; pauseOptsText(); showScreen('pause'); $('btnRestart').classList.remove('hidden'); updateAudio(null, { thr: 0 }, 0, false);
  if (TAXI && TAXI.active) TAXI.pause();
}
function resumeGame() { showScreen(null); state = game.pausedFrom || 'play'; clock.getDelta(); }
function toMenu() {
  if (TAXI && TAXI.active) TAXI.exit();
  if (mode() === 'online') leaveOnline();
  state = 'menu'; showScreen('menu'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); document.body.classList.remove('duo');
  updateAudio(null, { thr: 0 }, 0, false); clearAI();
  if (ghostCar) { scene.remove(ghostCar.model.root); ghostCar = null; }
  ensurePlayer(); placeCar(player, idxWrap(-Math.round(12 / SEG)), 0); player.frozen = true;
  renderMenu();
}
/* ======================= Mode 2 joueurs (écran partagé, deux manettes) ======================= */
let player2 = null;
const duo = { msg: [null, null], cv: null, ctx: null };
const camera2 = new THREE.PerspectiveCamera(60, 1, 0.5, camera.far);
const camState2 = { yaw: 0, init: false, pos: new THREE.Vector3() };
function hudMsg(k, text, sub, bad, cls) { // messages : dans la moitié d'écran du joueur en mode 2 joueurs
  if (mode() === 'duo') { duo.msg[k] = { text, sub: sub || '', t: 2.4, gold: cls === 'gold' }; return; }
  if (k === 0) popup(text, sub, bad, cls);
}
function p2Paint() { const c = carDef(prof.car2); return c.paint ? PAINTS[prof.paint === 1 ? 6 : 1] : c.color; }
function makePlayer2() {
  const cid = prof.car2, cd = carDef(cid), hi = ASSETS[carKey(cid, 'hi')];
  player2 = newCar({ isP2: true, name: 'Joueur 2', carId: cid, color: p2Paint(), spec: makeSpec('duo', prof.upg, cid) });
  player2.model = buildCar(cid, hi ? 'hi' : 'lo', p2Paint(), RIMS[prof.rim].c); scene.add(player2.model.root);
  resetPlayerRun(player2); cars.push(player2); camState2.init = false;
}
function selectCar2(id) {
  prof.car2 = id; store.set('car2', id); blip(880, 0.05, 0.06);
  const k = carKey(id, 'hi'); if (ASSETS[k] === undefined) loadAsset(k, () => {});
  renderDuo();
}
function renderDuo() {
  const box = $('duoOpts'); if (!box) return;
  box.classList.toggle('hidden', mode() !== 'duo');
  if (mode() !== 'duo') return;
  const l = $('p2cars'); l.innerHTML = '';
  CARS.forEach(cd => { const b = document.createElement('button'); b.className = 'p2car' + (cd.id === prof.car2 ? ' sel' : ''); b.innerHTML = '<img src="icons/cars/' + cd.id + '.jpg" alt=""><span>' + esc(cd.name) + '</span>'; b.onclick = () => selectCar2(cd.id); l.appendChild(b); });
  setSeg('segDuoAI', prof.duoAI);
  const n = getPads().length; $('duoPads').textContent = n >= 2 ? '🎮🎮 Deux manettes détectées : manette 1 = Joueur 1, manette 2 = Joueur 2.' : n === 1 ? '🎮 Une seule manette : le Joueur 2 peut jouer au clavier (flèches, Entrée = drift, Ctrl droit = nitro), ou branche une 2e manette.' : 'Branche deux manettes (ou Joueur 1 : Z Q S D · Joueur 2 : flèches).';
}
function duoLogic(dt, prev) {
  const c = player2; if (!c) return;
  const lp = trackLaps(c, prev);
  if (lp && lp.crossed && !c.finished) {
    if (c.lap > game.laps) {
      c.finished = true; c.finishTime = game.raceT; const pos = standings().indexOf(c) + 1;
      hudMsg(1, pos === 1 ? 'VICTOIRE !' : 'ARRIVÉE · ' + pos + 'e', fmtTime(c.finishTime), false, 'gold');
      if (player.finished) { state = 'finish'; game.finishWait = 3.5; } else game.duoWait = 60;
    } else hudMsg(1, 'MANCHE ' + ((c.lap - 1) * 3 + 1) + ' / ' + game.laps * 3, MANCHES[0].name.toUpperCase() + (lp.t ? ' · TOUR ' + fmtTime(lp.t) : ''), false, 'blue');
  }
  if (c.lap >= 1 && !c.finished) { const mi = mancheAt(c.idx); if (game.mi2 !== undefined && mi === game.mi2 + 1) hudMsg(1, 'MANCHE ' + ((c.lap - 1) * 3 + mi + 1) + ' / ' + game.laps * 3, MANCHES[mi].name.toUpperCase()); game.mi2 = mi; }
  c.nitro = Math.min(1, c.nitro + dt * 0.018 * c.spec.nitroGain);
  if (c.drifting && Math.abs(c.slip) > 0.17 && c.speed > 8) c.nitro = Math.min(1, c.nitro + dt * 0.08 * c.spec.nitroGain);
  if (c.crash > 0) { rumble(Math.min(1, c.crash / 12), 220, 1); c.crash = 0; }
  if (game.duoWait > 0) { game.duoWait -= dt; if (game.duoWait <= 0 && state === 'play') { state = 'finish'; game.finishWait = 1; } }
}
function duoHud() {
  if (!duo.cv) { duo.cv = $('duoHud'); duo.ctx = duo.cv.getContext('2d'); }
  const cv = duo.cv, W = window.innerWidth, H = window.innerHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = duo.ctx; g.clearRect(0, 0, W, H);
  const order = standings(), hh = H / 2, k = Math.min(1, W / 1100) * Math.min(1, hh / 330) + 0.15;
  [player, player2].forEach((c, n) => {
    if (!c) return;
    const y0 = n * hh, f = s => Math.round(s * k) + 'px "Russo One", Arial Black, sans-serif';
    const card = (x, y, w, h) => { g.fillStyle = 'rgba(10,12,20,0.62)'; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 10 * k) : g.rect(x, y, w, h); g.fill(); };
    // nom + voiture
    card(12, y0 + 12, 300 * k, 62 * k); g.fillStyle = hexCss(c.color); g.fillRect(12, y0 + 12, 8 * k, 62 * k);
    g.fillStyle = '#fff'; g.font = f(22); g.textBaseline = 'top'; g.fillText((n ? 'JOUEUR 2' : 'JOUEUR 1'), 30 * k, y0 + 20 * k);
    g.fillStyle = '#cbd5e1'; g.font = Math.round(14 * k) + 'px Arial, sans-serif'; g.fillText(carDef(c.carId).name, 30 * k, y0 + 50 * k);
    // position + manche
    const pos = order.indexOf(c) + 1, mi = c.lap >= 1 ? mancheAt(c.idx) : 0, man = Math.min((Math.min(Math.max(c.lap, 1), game.laps) - 1) * 3 + mi + 1, game.laps * 3);
    card(W - 230 * k - 12, y0 + 12, 230 * k, 62 * k); g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = f(30); g.fillText(pos + (pos === 1 ? 'er' : 'e') + ' / ' + order.length, W - 24, y0 + 18 * k);
    g.font = Math.round(14 * k) + 'px Arial, sans-serif'; g.fillStyle = '#ffd166'; g.fillText('MANCHE ' + man + ' / ' + game.laps * 3 + ' · ' + fmtTime(c.finished ? c.finishTime : Math.max(0.0001, game.raceT)), W - 24, y0 + 54 * k);
    // vitesse + nitro
    card(W - 210 * k - 12, y0 + hh - 92 * k - 12, 210 * k, 92 * k); g.fillStyle = '#fff'; g.font = f(44); g.fillText(Math.round(c.speed * 3.6), W - 80 * k, y0 + hh - 94 * k);
    g.font = Math.round(14 * k) + 'px Arial, sans-serif'; g.fillStyle = '#94a3b8'; g.fillText('KM/H', W - 26, y0 + hh - 76 * k); g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = f(26); g.fillText(c.vF < -0.5 ? 'R' : String(c.gear || 1), W - 200 * k, y0 + hh - 92 * k);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(W - 200 * k, y0 + hh - 38 * k, 186 * k, 10 * k); g.fillStyle = c.nitroOn ? '#fbbf24' : '#38bdf8'; g.fillRect(W - 200 * k, y0 + hh - 38 * k, 186 * k * c.nitro, 10 * k);
    g.fillStyle = '#a5f3fc'; g.font = Math.round(12 * k) + 'px Arial, sans-serif'; g.fillText(c.nitro > 0.12 ? 'NITRO PRÊT' : 'NITRO', W - 200 * k, y0 + hh - 24 * k);
    // mini-carte
    const ms = Math.round(150 * k), mx = 12, my = y0 + hh - ms - 12, win = 1000;
    g.save(); g.beginPath(); g.rect(mx, my, ms, ms); g.clip(); g.fillStyle = 'rgba(10,12,20,0.6)'; g.fillRect(mx, my, ms, ms);
    g.drawImage(mapBg, (c.x - win / 2 - mapBg.minX) * MAP_PX, (c.z - win / 2 - mapBg.minZ) * MAP_PX, win * MAP_PX, win * MAP_PX, mx, my, ms, ms);
    for (const o of cars) { const ox = mx + (o.x - c.x + win / 2) / win * ms, oz = my + (o.z - c.z + win / 2) / win * ms; g.fillStyle = hexCss(o.color); g.beginPath(); g.arc(ox, oz, o === c ? 6 : 4.5, 0, 6.29); g.fill(); g.strokeStyle = o === c ? '#fff' : '#000'; g.lineWidth = 2; g.stroke(); }
    g.restore();
    // messages (manches, arrivée)
    const msg = duo.msg[n];
    if (msg && msg.t > 0) {
      g.textAlign = 'center'; g.font = f(38); g.fillStyle = msg.gold ? '#ffd166' : '#ffffff'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 6 * k;
      g.strokeText(msg.text, W / 2, y0 + hh * 0.28); g.fillText(msg.text, W / 2, y0 + hh * 0.28);
      if (msg.sub) { g.font = Math.round(18 * k) + 'px Arial, sans-serif'; g.strokeText(msg.sub, W / 2, y0 + hh * 0.28 + 46 * k); g.fillText(msg.sub, W / 2, y0 + hh * 0.28 + 46 * k); }
    }
    g.textAlign = 'left';
  });
  g.fillStyle = '#0b0d14'; g.fillRect(0, hh - 2, W, 4);
}
function renderDuo2() { // deux vues : Joueur 1 en haut, Joueur 2 en bas
  const W = window.innerWidth, H = window.innerHeight, hh = Math.floor(H / 2);
  renderer.setScissorTest(true);
  [[camera, player, H - hh], [camera2, player2, 0]].forEach(([cam, c, y]) => {
    if (!c) return;
    if (Math.abs(cam.aspect - W / hh) > 0.001) { cam.aspect = W / hh; cam.updateProjectionMatrix(); }
    renderer.setViewport(0, y, W, hh); renderer.setScissor(0, y, W, hh);
    sky.position.set(cam.position.x, 0, cam.position.z);
    sun.position.set(c.x + SUN_OFF.x, SUN_OFF.y, c.z + SUN_OFF.z); sun.target.position.set(c.x, 0, c.z); sun.target.updateMatrixWorld();
    renderer.render(scene, cam);
  });
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
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
  const ob = c.onBr;
  placeCar(c, c.idx, 0);
  if (ob) { const b = ob.br, k = ob.k; c.x = b.X[k]; c.z = b.Z[k]; c.h = Math.atan2(b.TX[k], b.TZ[k]); }
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
    if (raceLike(m) || (m === 'online' && net.raceState === 'race')) {
      if (pc.lap <= game.laps) hudMsg(0, 'MANCHE ' + ((pc.lap - 1) * 3 + 1) + ' / ' + game.laps * 3, MANCHES[0].name.toUpperCase() + (lp.t ? ' · TOUR ' + fmtTime(lp.t) : ''), false, pc.lap === game.laps && pc.lap > 1 ? 'gold' : 'blue');
      if (pc.lap > game.laps && !pc.finished) { pc.finished = true; pc.finishTime = game.raceT; onPlayerFinish(); }
    } else if (lp.t) {
      const best = store.get('lap_best3' + TKS, Infinity) || Infinity;
      const isBest = lp.t < best;
      if (isBest) store.set('lap_best3' + TKS, lp.t);
      if (m === 'time') {
        const cr = addCredits(150 + (lp.t < game.bestLapT ? 600 : 0)); game.earned += cr;
        if (lp.t < game.bestLapT) {
          game.bestLapT = lp.t; game.ghost = { t: lp.t, p: game.ghostRec.slice() }; store.set('ghost3' + TKS, game.ghost); buildGhostIndex();
          popup('NOUVEAU RECORD · ' + fmtTime(lp.t), '+' + cr + ' crédits', false, 'gold');
        } else popup('TOUR ' + fmtTime(lp.t), '+' + cr + ' crédits');
      } else popup('TOUR ' + fmtTime(lp.t), isBest ? 'MEILLEUR TOUR !' : '');
    }
    if (m === 'time') { game.ghostRec = []; game.ghostT0 = game.raceT; }
  }
  // manches : chaque quartier traversé est annoncé
  if (pc.lap >= 1 && !pc.finished) {
    const mi = mancheAt(pc.idx);
    if (game.mi !== undefined && mi === game.mi + 1) {
      const racingM = raceLike(m) || (m === 'online' && net.raceState === 'race');
      const last = racingM && pc.lap === game.laps && mi === 2;
      hudMsg(0, 'MANCHE ' + (racingM ? ((pc.lap - 1) * 3 + mi + 1) + ' / ' + game.laps * 3 : (mi + 1) + ' / 3'), MANCHES[mi].name.toUpperCase() + (last ? ' · DERNIÈRE MANCHE !' : ''), false, last ? 'gold' : 'blue');
    }
    game.mi = mi;
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
    const edge = pc.nearEdge ? 1.25 : 1;
    combo.pts += dt * pc.speed * Math.min(angle, 70) * 0.22 * combo.mult * edge;
    game.maxAngle = Math.max(game.maxAngle, Math.min(angle, 120));
    pc.nitro = Math.min(1, pc.nitro + dt * 0.11 * pc.spec.nitroGain * Math.min(angle, 50) / 30);
  } else if (combo.active) { combo.grace -= dt; if (combo.grace <= 0) bankCombo(); }
  if (raceLike(m) || m === 'time') pc.nitro = Math.min(1, pc.nitro + dt * 0.018 * pc.spec.nitroGain);
  if (combo.active && pc.off) loseCombo('Hors piste');
  if (pc.crash > 0) { carHit(pc, pc.crash); loseCombo('Choc'); camShake = Math.min(1, pc.crash / 12); crashSound(pc.crash / 14); rumble(Math.min(1, pc.crash / 12), 220); pc.crash = 0; }
  if (pc.nitroOn && !game.nitroWas) rumble(0.25, 120); game.nitroWas = pc.nitroOn;
  if (Math.abs(pc.slip) > 2.3 && pc.speed > 3 && combo.active) loseCombo('Tête-à-queue');
  // mauvais sens / bloqué
  const dotT = pc.onBr ? Math.sin(pc.h) * pc.onBr.br.TX[pc.onBr.k] + Math.cos(pc.h) * pc.onBr.br.TZ[pc.onBr.k] : Math.sin(pc.h) * TX[pc.idx] + Math.cos(pc.h) * TZ[pc.idx];
  game.wrongT = (dotT < -0.35 && pc.speed > 4) ? game.wrongT + dt : 0;
  if (pc.speed < 2.5 && (pc.off || pc.edge < 0.9)) game.stuck += dt; else game.stuck = Math.max(0, game.stuck - dt);
  if (game.stuck > 3) { game.stuck = -2; popup('BLOQUÉ ?', pad.active ? 'Appuie sur L1 pour te replacer' : isTouch ? 'Touche ↺ en haut pour te replacer' : 'Appuie sur R pour te replacer'); }
  if (pc.nitro > 0.3 && !pc.nitroOn && !game.nitroTold && game.raceT > 2) { game.nitroTold = true; popup('🔥 NITRO PRÊT', (isTouch && !pad.active ? 'Bouton NITRO bleu' : 'Appuie sur ' + nitroKeyName()) + ' · ramasse les bouteilles bleues', false, 'blue'); }
  if (m === 'chrono') { game.timeLeft -= dt; if (game.timeLeft <= 0) { game.timeLeft = 0; endSession(); } }
}
// ramassage des bouteilles de nitro (joueur et IA)
function bottleLogic(dt) {
  for (const b of BOTTLES) {
    if (b.t > 0) { b.t -= dt; continue; }
    for (const c of cars) {
      if (c.frozen) continue;
      const dx = c.x - b.x, dz = c.z - b.z;
      if (dx * dx + dz * dz > 7.3) continue;
      b.t = 9;
      c.nitro = Math.min(1, c.nitro + 0.4); c.kick = 1.3;
      if (c.isPlayer) {
        popup('+ NITRO', 'Boost de vitesse !', false, 'blue'); blip(1320, 0.12, 0.12); setTimeout(() => blip(1760, 0.16, 0.1), 90);
        rumble(0.45, 160); try { if (navigator.vibrate) navigator.vibrate(35); } catch (e) {}
        game.bottles = (game.bottles || 0) + 1; game.flashT = 0.35;
      }
      break;
    }
  }
}
function aiLogic(dt) {
  if (!raceLike(mode())) return;
  const pp = Math.max(raceProgress(player), player2 ? raceProgress(player2) : -Infinity);
  for (const c of cars) {
    if (!c.isAI) continue;
    const ahead = (raceProgress(c) - pp) * SEG;
    c.boost = player.finished && (!player2 || player2.finished) ? 1 : clamp(1 - ahead / 2500, 0.93, 1.07);
    if (c.crash) { if (c.crash > 6) carHit(c, c.crash); c.crash = 0; }
    c.nitro = Math.min(1, c.nitro + dt * 0.03);
    if (c.speed < 1.5 && game.raceT > 5) c.stuck += dt; else c.stuck = 0;
    if (c.stuck > 2.5) { resetToTrack(c); c.stuck = 0; }
  }
}
function onPlayerFinish() {
  const order = standings();
  const pos = order.indexOf(player) + 1;
  game.finishPos = pos;
  hudMsg(0, pos === 1 ? 'VICTOIRE !' : 'ARRIVÉE · ' + pos + (pos === 1 ? 'er' : 'e'), fmtTime(player.finishTime), false, 'gold');
  if (player2 && !player2.finished) { game.duoWait = 60; return; }
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
  if (raceLike(m)) {
    const order = standings();
    const pos = order.indexOf(player) + 1, pos2 = player2 ? order.indexOf(player2) + 1 : 0;
    const pay = [2000, 1400, 1000, 700, 500, 400][pos - 1] * (1 + 0.25 * prof.diff);
    game.earned += addCredits(pay);
    title = 'Course · ' + ['Facile', 'Normal', 'Pro'][prof.diff] + ' · ' + game.laps * 3 + ' manches';
    big = m === 'duo' ? 'J1 ' + (pos === 1 ? '1er' : pos + 'e') + ' · J2 ' + (pos2 === 1 ? '1er' : pos2 + 'e') : (pos === 1 ? '🏆 1er' : pos + 'e');
    if (m === 'duo') title = '2 joueurs · ' + (pos < pos2 ? 'Joueur 1 gagne !' : 'Joueur 2 gagne !') + ' · ' + game.laps * 3 + ' manches';
    html = '<table class="resTable">' + order.map((c, k) => {
      const t = c.finished ? fmtTime(c.finishTime) : 'en course';
      return '<tr class="' + (c.isPlayer || c.isP2 ? 'me' : '') + '"><td>' + (k + 1) + '</td><td>' + esc(c.isP2 ? 'Joueur 2' : c.isPlayer && m === 'duo' ? 'Joueur 1 · ' + c.name : c.name) + '</td><td>' + (isFinite(c.bestLap) ? fmtTime(c.bestLap) : '--') + '</td><td>' + t + '</td></tr>';
    }).join('') + '</table>';
    const bestPos = store.get('best_race_pos', 99);
    if (pos < bestPos && m === 'race') store.set('best_race_pos', pos);
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
  { const gx = lerp(A[1], B[1], f), gz = lerp(A[2], B[2], f), q = nearest(gx, gz, ghostCar.idx === undefined ? -1 : ghostCar.idx); ghostCar.idx = q.i; ghostCar.model.root.position.set(gx, elevAt(q.i, q.lat), gz); }
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
function onlinePeers() { return (net.peers || []).filter(p => !p.sameTab && p.kind === 'viewer' && p.presence && p.presence.on === 1 && (p.presence.tk || 0) === TRACK); }
function peerName(p) { const n = p.presence && typeof p.presence.nm === 'string' ? p.presence.nm : ''; return n.slice(0, 16) || 'Pilote'; }
function peerColor(p) { const c = p.presence && p.presence.pc; return typeof c === 'number' && c >= 0 && c <= 0xffffff ? c : 0x999999; }
function sendPresence(force) {
  if (!net.room) return;
  const now = performance.now();
  if (!force && now - net.lastSend < 90) return;
  net.lastSend = now;
  const pc = player;
  const data = net.active && pc ? {
    on: 1, nm: prof.name, pc: PAINTS[prof.paint], cr: prof.car, tk: TRACK,
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
    const rc = typeof pr.cr === 'string' && CARS.some(c => c.id === pr.cr) ? pr.cr : 'audi';
    if (r && r.carId !== rc) { scene.remove(r.model.root); r.model = buildCar(rc, 'lo', peerColor(p), RIMS[0].c); r.carId = rc; scene.add(r.model.root); }
    if (!r) {
      r = { carId: rc, model: buildCar(rc, 'lo', peerColor(p), RIMS[0].c), x: pr.x, z: pr.z, h: pr.h || 0, last: null, t: 0, vx: 0, vz: 0, speed: 0, wheelRot: 0 };
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
    { const q = nearest(r.x, r.z, r.idx === undefined ? -1 : r.idx); r.idx = q.i; r.model.root.position.set(r.x, elevAt(q.i, q.lat), r.z); } r.model.root.rotation.y = r.h;
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
  game.laps = 1; game.raceT = 0; game.onlineShown = false; game.lastCount = -1;
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
// carte : toute la ville pré-dessinée, on affiche une fenêtre de ~1,3 km centrée sur le joueur
const MAP_PX = 0.55, MAP_WIN = 1300, MAP_PAD = 160;
const mapBg = document.createElement('canvas');
let mapT, mapView = { x0: 0, z0: 0, k: 320 / MAP_WIN };
function drawMapBg(cityFn) {
  const minX = BBOX[0] - MAP_PAD, minZ = BBOX[2] - MAP_PAD;
  mapBg.width = Math.ceil((BBOX[1] - BBOX[0] + MAP_PAD * 2) * MAP_PX); mapBg.height = Math.ceil((BBOX[3] - BBOX[2] + MAP_PAD * 2) * MAP_PX);
  const T = (x, z) => [(x - minX) * MAP_PX, (z - minZ) * MAP_PX];
  mapBg.T = T; mapBg.minX = minX; mapBg.minZ = minZ;
  const c = mapBg.getContext('2d'); c.lineJoin = c.lineCap = 'round';
  c.fillStyle = 'rgba(31,95,122,0.55)'; c.fillRect(0, 0, Math.max(0, (OCEAN_X + 30 - minX) * MAP_PX), mapBg.height);
  if (cityFn) { c.save(); c.globalAlpha = 0.55; try { cityFn(c, minX, minZ, MAP_PX, mapBg.width, mapBg.height); } catch (e) { console.error('map', e); } c.restore(); c.lineJoin = c.lineCap = 'round'; }
  c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 7;
  for (const d of DECO_ROADS) { const [a, b] = T(d[0], d[1]), [e, f] = T(d[2], d[3]); c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke(); }
  const path = () => { c.beginPath(); for (let i = 0; i <= N; i += 3) { const [a, b] = T(PX[i % N], PZ[i % N]); i ? c.lineTo(a, b) : c.moveTo(a, b); } c.closePath(); };
  const bpath = br => { c.beginPath(); for (let k = 0; k < br.M; k += 3) { const [a, b] = T(br.X[k], br.Z[k]); k ? c.lineTo(a, b) : c.moveTo(a, b); } };
  for (const br of BR) { bpath(br); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = RT ? 9 : 16; c.stroke(); }
  path(); c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = RT ? 17 : 26; c.stroke();
  for (const br of BR) { bpath(br); c.strokeStyle = '#f59e0b'; c.lineWidth = RT ? 5 : 8; c.setLineDash(RT ? [9, 6] : [14, 9]); c.stroke(); c.setLineDash([]); }
  // chaque manche a sa couleur
  const MC = ['#e8e8e8', '#ffd27a', '#9fe3c5'];
  for (let mI = 0; mI < 3; mI++) { const a0 = MANCHES[mI].from, a1 = mI < 2 ? MANCHES[mI + 1].from : N; c.beginPath(); for (let i = a0; i <= a1; i += 3) { const [a, b] = T(PX[i % N], PZ[i % N]); i === a0 ? c.moveTo(a, b) : c.lineTo(a, b); } c.strokeStyle = MC[mI]; c.lineWidth = RT ? 8 : 13; c.stroke(); }
  for (const rb of ROUNDABOUTS) { const [a, b] = T(rb.x, rb.z); c.fillStyle = '#7fbf5a'; c.beginPath(); c.arc(a, b, (rb.R - WALL) * MAP_PX, 0, 6.29); c.fill(); }
  for (const b of BOTTLES) { const [a, bb] = T(b.x, b.z); c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(a, bb, 5, 0, 6.29); c.fill(); }
  c.font = '700 22px Arial, sans-serif'; c.textAlign = 'center';
  for (const mI of [1, 2]) { const i = MANCHES[mI].from, [a, b] = T(PX[i], PZ[i]); c.fillStyle = '#ff3d5a'; c.fillRect(a - 6, b - 6, 12, 12); c.fillStyle = '#fff'; c.fillText(String(mI + 1), a, b - 12); }
  const [sx, sz] = T(PX[0], PZ[0]); c.fillStyle = '#ff3d5a'; c.fillRect(sx - 9, sz - 9, 18, 18);
  mapT = (x, z) => [(x - mapView.x0) * mapView.k, (z - mapView.z0) * mapView.k];
}
drawMapBg(null);
const hexCss = h => '#' + (h >>> 0).toString(16).padStart(6, '0');
function drawMap() {
  mapCtx.clearRect(0, 0, 320, 320);
  mapView.x0 = player.x - MAP_WIN / 2; mapView.z0 = player.z - MAP_WIN / 2;
  const s0 = (mapView.x0 - mapBg.minX) * MAP_PX, t0 = (mapView.z0 - mapBg.minZ) * MAP_PX, sw = MAP_WIN * MAP_PX;
  mapCtx.drawImage(mapBg, s0, t0, sw, sw, 0, 0, 320, 320);
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
  const nb = $('nitroBtn'), ready = pc.nitro > 0.12;
  nb.classList.toggle('ready', ready && !pc.nitroOn); nb.classList.toggle('on', pc.nitroOn); nb.classList.toggle('empty', !ready);
  nb.style.setProperty('--n', pc.nitro.toFixed(3));
  const kn = nitroKeyName(); if (game.nkLabel !== kn) { game.nkLabel = kn; $('nitroKey').textContent = kn; }
  const tn = $('tNitro'); tn.style.setProperty('--n', pc.nitro.toFixed(3)); tn.classList.toggle('ready', ready && !pc.nitroOn);
  if (game.flashT > 0) game.flashT -= 1 / 20;
  $('speedFx').style.opacity = pc.nitroOn || game.flashT > 0 ? 1 : 0;
  $('score').textContent = fmtInt(game.score);
  $('scoreSub').textContent = m === 'online' ? 'Session en ligne' : 'Record : ' + fmtInt(Math.max(game.best, m === 'drift' ? game.score : 0));
  const racing = raceLike(m) || (m === 'online' && net.raceState !== 'free');
  { const mi = pc.lap >= 1 ? mancheAt(pc.idx) : 0, lapC = Math.max(pc.lap, 1); $('lapN').textContent = racing ? Math.min((Math.min(lapC, game.laps) - 1) * 3 + mi + 1, game.laps * 3) + ' / ' + game.laps * 3 : (mi + 1) + ' / 3'; }
  $('lapTime').textContent = fmtTime(state === 'countdown' || pc.frozen ? 0.0001 : (racing ? game.raceT : game.raceT - pc.lapStart)).replace('--', '0:00.00');
  const bl = m === 'time' ? game.bestLapT : (racing ? pc.bestLap : store.get('lap_best3' + TKS, Infinity));
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
  const st = pc.onBr ? pc.onBr.br : streetAt(pc.idx);
  if (st !== game.street) {
    game.street = st; const el = $('street');
    el.innerHTML = '📍 ' + esc(st.name.toUpperCase()) + (pc.onBr ? ' · RACCOURCI' : '') + '<small>' + esc(st.ar) + '</small>';
    $('mapName').textContent = st.name;
    el.classList.add('show'); clearTimeout(game.streetTO); game.streetTO = setTimeout(() => el.classList.remove('show'), 2600);
  }
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
function updateCamera(dt, pc, cam, cs) {
  pc = pc || player; cam = cam || camera; cs = cs || camState;
  const c = CAMS[prof.cam], dw = mode() === 'duo' ? 0.72 : 1;
  if (!cs.init) { cs.yaw = pc.h; cs.init = true; cs.pos.set(pc.x - Math.sin(pc.h) * c.d, c.h, pc.z - Math.cos(pc.h) * c.d); }
  let target = pc.h;
  if (pc.speed > 3 && pc.vF > 0) { const vel = Math.atan2(pc.vx, pc.vz); target = pc.h + wrapAng(vel - pc.h) * 0.55; }
  cs.yaw += wrapAng(target - cs.yaw) * (1 - Math.exp(-dt * (prof.cam === 2 ? 2 : 4.5)));
  const d = c.d + (pc.nitroOn ? 1.2 : 0);
  cs.y = (cs.y || 0) + ((pc.y || 0) - (cs.y || 0)) * Math.min(1, dt * 6);
  const want = new THREE.Vector3(pc.x - Math.sin(cs.yaw) * d, c.h + cs.y, pc.z - Math.cos(cs.yaw) * d);
  cs.pos.lerp(want, cs.pos.distanceTo(want) > 40 ? 1 : 1 - Math.exp(-dt * 9));
  cam.position.copy(cs.pos);
  if (camShake > 0 && cam === camera) { cam.position.x += Math.sin(menuTime * 47) * camShake * 0.35; cam.position.y += Math.sin(menuTime * 41 + 2) * camShake * 0.22; camShake = Math.max(0, camShake - dt * 3.5); }
  if (pc.nitroOn) { cam.position.x += Math.sin(menuTime * 31) * 0.025; cam.position.y += Math.sin(menuTime * 23 + 1) * 0.02; }
  cam.lookAt(pc.x + Math.sin(pc.h) * 2, c.look + cs.y, pc.z + Math.cos(pc.h) * 2);
  const fov = dw * c.fov + dw * clamp(pc.speed / 55, 0, 1) * 10 + (pc.nitroOn ? 8 : 0);
  if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = lerp(cam.fov, fov, Math.min(1, dt * 3)); cam.updateProjectionMatrix(); }
}
let orbitAng = 0.6;
function orbitCamera(dt, r, hgt, speed) {
  orbitAng += dt * speed;
  const pc = player;
  camera.position.set(pc.x + Math.sin(orbitAng + pc.h) * r, hgt + (pc.y || 0), pc.z + Math.cos(orbitAng + pc.h) * r);
  camera.lookAt(pc.x, 0.9 + (pc.y || 0), pc.z);
  if (Math.abs(camera.fov - 42) > 0.1) { camera.fov = 42; camera.updateProjectionMatrix(); }
}

/* ======================= Visuels des voitures ======================= */
let smokeAcc = 0;
function updateCarVisual(c, inp, dt, near) {
  const m = c.model; if (!m) return;
  const ey = c.y || 0; m.root.position.set(c.x, 0.05 + ey, c.z);
  if (ey > 0.01 || m.root.rotation.x) { const i = c.idx, sl = (EL[idxWrap(i + 2)] - EL[idxWrap(i - 2)]) / (4 * SEG), al = Math.sin(c.h) * TX[i] + Math.cos(c.h) * TZ[i]; m.root.rotation.set(-Math.atan(sl * al), c.h, 0, 'YXZ'); }
  else m.root.rotation.y = c.h;
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
    while (c.smokeAcc > 1) { c.smokeAcc -= 1; const s = Math.random() < 0.5 ? 1 : -1; spawnSmoke(c.x + sx * 0.85 * s - fx * 1.9, c.z + sz * 0.85 * s - fz * 1.9, c.vx, c.vz, Math.max(intensity, burnout * 0.8), c.off, c.y); }
  } else if (c.off && c.speed > 8 && state === 'play') {
    c.smokeAcc = (c.smokeAcc || 0) + dt * 12; while (c.smokeAcc > 1) { c.smokeAcc -= 1; spawnSmoke(c.x - fx * 2, c.z - fz * 2, c.vx, c.vz, 0.5, true, c.y); }
  }
  if (c.isPlayer || c.isP2) {
    const sp = Math.abs(c.vF), top = c.spec.maxSpeed * 1.15; let g = 1;
    while (g < 6 && sp > GEAR_TOP[g] * top * 0.96) g++;
    if (g > c.gear && inp.thr) c.shifted = true;
    c.gear = g;
    let rpm = Math.max(0.12 + (inp.thr && sp < 4 ? 0.3 : 0), sp / (GEAR_TOP[g] * top));
    if (c.drifting && inp.thr) rpm = Math.min(1, rpm + 0.18);
    if (burnout || (c.frozen && inp.thr)) rpm = 0.88 + Math.sin(menuTime * 9) * 0.04;
    rpm = Math.min(rpm, 1.0);
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
  MODE_ORDER.map(i => [MODES[i], i]).forEach(([m, i]) => {
    if (!m || (m.id === 'taxi' && !TAXI)) return;
    if (m.id === 'duo' && isTouch && !pad.active) return; // 2 joueurs : PC avec manettes
    const d = document.createElement('div'); d.className = 'opt' + (i === prof.mode ? ' sel' : '');
    let rec = '';
    if (m.id === 'drift') rec = 'Record : ' + fmtInt(store.get('best_drift', 0));
    if (m.id === 'chrono') rec = 'Record : ' + fmtInt(store.get('best_chrono', 0));
    if (m.id === 'time') { const g = store.get('ghost3' + TKS, null); rec = 'Meilleur tour : ' + (g ? fmtTime(g.t) : '--'); }
    if (m.id === 'race') { const b = store.get('best_race_pos', 0); rec = b ? 'Meilleure place : ' + b + (b === 1 ? 'er' : 'e') : ''; }
    if (m.id === 'taxi') { const b = store.get('best_taxi', 0); rec = b ? 'Meilleur service : ' + fmtInt(b) + ' MRU' : ''; }
    if (m.id === 'online') rec = net.status === 'ok' ? '🟢 ' + ((net.peers || []).filter(p => p.kind === 'viewer').length) + ' en ligne' : '';
    d.innerHTML = (m.badge ? '<div class="badge">' + m.badge + '</div>' : '') + '<div class="ic">' + m.ic + '</div><div class="nm disp">' + m.name + '</div><div class="ds">' + m.desc + '</div>' + (rec ? '<div class="ds" style="opacity:.9;margin-top:6px;color:#ffd166">' + rec + '</div>' : '');
    d.onclick = () => { prof.mode = i; store.set('mode', i); renderMenu(); };
    ml.appendChild(d);
  });
  $('raceOpts').classList.toggle('hidden', !raceLike(mode())); renderDuo();
  if (TAXI) TAXI.renderOpts(mode() === 'taxi');
  setSeg('segDiff', prof.diff); setSeg('segLaps', prof.laps);
  { const to = $('trackOpt'); if (to) { to.classList.toggle('hidden', !window.DZ_CIRCUIT || mode() === 'taxi'); setSeg('segTrack', TRACK); } }
  $('modeTip').textContent = { race: 'Astuce : freine avant les virages serrés, garde le nitro pour les lignes droites.', drift: 'Astuce : frein à main pour lancer la glisse, puis contre-braque en gardant les gaz.', chrono: 'Astuce : les longs drifts près du bord rapportent plus.', time: 'Astuce : le fantôme bleu rejoue ton meilleur tour.', taxi: 'Astuce : arrête-toi dans le cercle vert, le client monte. Klaxon : H, R1 ou 📯. Poursuivi ? F pour descendre et voler une autre voiture.', online: 'Astuce : partage le jeu à tes amis pour rouler ensemble.' }[mode()] || '';
  $('btnPlay').textContent = mode() === 'online' ? 'REJOINDRE ▶' : 'JOUER ▶';
  renderGarage(); renderOptions(); renderNet();
  $('nameInput').value = prof.name;
}
function setSeg(id, v) { $(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === +v)); }
function renderGarage() {
  const cl = $('carList'); cl.innerHTML = '';
  CARS.forEach(cd => {
    const st = makeSpec('race', prof.upg, cd.id), score = clamp((st.maxSpeed / 66 + st.power / 23 + st.latMax / 17) / 3, 0, 1);
    const d = document.createElement('div'); d.className = 'carCard' + (cd.id === prof.car ? ' sel' : ''); d.style.setProperty('--p', score.toFixed(2));
    d.innerHTML = '<img src="icons/cars/' + cd.id + '.jpg" alt=""><b>' + esc(cd.name) + '</b><span>' + esc(cd.tag) + '</span><i></i>';
    d.onclick = () => { if (prof.car !== cd.id) { selectCar(cd.id); blip(880, 0.06, 0.06); } };
    cl.appendChild(d);
  });
  const cdef = carDef(prof.car);
  $('carTitle').textContent = cdef.name + ' · ta voiture';
  $('paintBox').classList.toggle('hidden', !cdef.paint);
  $('carNote').textContent = (cdef.paint ? '' : 'Ce modèle garde sa peinture d’origine. ') + (cdef.credit ? 'Crédit : ' + cdef.credit : '');
  const s = makeSpec('race', prof.upg, prof.car);
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
function renderOptions() { setSeg('segQual', prof.qual); setSeg('segNight', prof.night ? 1 : 0); setSeg('segSound', prof.muted ? 0 : 1); setSeg('segCam', prof.cam); setSeg('segClean', prof.cleanHud ? 1 : 0); setSeg('segFs', prof.fsLand ? 1 : 0); renderMusic(); padStatusText(); }
function showTab(t) {
  menuTab = t;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('sel', b.dataset.tab === t));
  document.querySelectorAll('.pane').forEach(p => p.classList.toggle('hidden', p.id !== 'pane-' + t));
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { showTab(b.dataset.tab); if (b.dataset.tab === 'online') { prof.mode = 4; store.set('mode', 4); renderMenu(); showTab('online'); } });
$('segDiff').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.diff = +v; store.set('diff', prof.diff); setSeg('segDiff', v); };
$('segDuoAI').onclick = e => { const v = e.target.closest('button'); if (!v) return; prof.duoAI = +v.dataset.v; store.set('duoAI', prof.duoAI); setSeg('segDuoAI', prof.duoAI); };
if ($('segTrack')) $('segTrack').onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = +b.dataset.v; if (v === TRACK) return; store.set('track', v); setSeg('segTrack', v); $('loading').classList.remove('hidden'); $('loadTxt').textContent = v ? 'DIRECTION LA VRAIE NOUAKCHOTT…' : 'RETOUR AU CIRCUIT CLASSIQUE…'; setTimeout(() => location.reload(), 120); };
$('segLaps').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.laps = +v; store.set('laps2', prof.laps); setSeg('segLaps', v); };
$('segNight').onclick = e => { const b = e.target.closest('button'); if (!b) return; prof.night = b.dataset.v === '1'; store.set('night', prof.night); setSeg('segNight', prof.night ? 1 : 0); applyAmbience(); };
$('segQual').onclick = e => { const v = e.target.dataset.v; if (v === undefined || +v === prof.qual) return; prof.qual = +v; store.set('qual3', prof.qual); renderOptions(); { const qn = $('qualNote'); if (qn) qn.textContent = 'Redémarrage pour appliquer…'; } setTimeout(() => location.reload(), 600); };
$('segSound').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; initAudio(); setMuted(v === '0'); };
$('segCam').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.cam = +v; store.set('cam', prof.cam); renderOptions(); };
$('segClean').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; setClean(v === '1', false); };
$('segFs').onclick = e => { const v = e.target.dataset.v; if (v === undefined) return; prof.fsLand = v === '1'; store.set('fsLand', prof.fsLand); renderOptions(); };
/* --- écran de jeu : vue dégagée, plein écran paysage (téléphone), bouton retour d'Android --- */
function setClean(on, pop) { prof.cleanHud = !!on; store.set('cleanHud', prof.cleanHud); document.body.classList.toggle('cleanHud', prof.cleanHud); renderOptions(); if (pop && (state === 'play' || state === 'countdown')) popup(prof.cleanHud ? 'VUE DÉGAGÉE' : 'INTERFACE COMPLÈTE', prof.cleanHud ? '👁 pour réafficher les compteurs' : '', false, 'blue'); }
document.body.classList.toggle('cleanHud', prof.cleanHud);
$('mEye').onclick = () => setClean(!prof.cleanHud, true);
$('mPause').onclick = () => pauseGame();
$('mReset').onclick = () => { if (state !== 'play') return; if (TAXI && TAXI.active) TAXI.reset(); else if (player) resetToTrack(player, true); };
function goLandscape() { // téléphone : plein écran + écran couché (l'appel doit venir d'un toucher)
  if (!isTouch || !prof.fsLand) return;
  const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
  try { const d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).then(lock, lock); else lock(); } catch (e) {}
}
let rotOk = false;
$('rotGo').onclick = () => { rotOk = true; $('rotHint').classList.add('hidden'); };
function inPlayUi() { // classe « en jeu » + conseil d'écran couché
  const ip = state === 'play' || state === 'countdown';
  if (ip !== document.body.classList.contains('inplay')) document.body.classList.toggle('inplay', ip);
  const rh = $('rotHint'), want = isTouch && ip && !rotOk && innerHeight > innerWidth * 1.15;
  if (rh && want === rh.classList.contains('hidden')) rh.classList.toggle('hidden', !want);
}
// bouton « retour » du téléphone pendant une partie : pause (au lieu de quitter le jeu), puis menu principal
function armBack() { try { if (!history.state || !history.state.dz) history.pushState({ dz: 1 }, ''); } catch (e) {} }
window.addEventListener('popstate', () => {
  if (state === 'play' || state === 'countdown') { pauseGame(); armBack(); }
  else if (state === 'pause') toMenu();
  else if (state === 'results') toMenu();
});
$('nameInput').addEventListener('input', e => { const v = [...e.target.value].filter(ch => { const c = ch.codePointAt(0); return c >= 32 && !(c >= 0x7f && c <= 0x9f) && !(c >= 0x200b && c <= 0x200f) && !(c >= 0x2028 && c <= 0x202e) && !(c >= 0x2060 && c <= 0x206f) && c !== 0xfeff && !(c >= 0xe000 && c <= 0xf8ff); }).join('').slice(0, 16); prof.name = v.trim() || 'Pilote'; store.set('name', prof.name); $('chipName').textContent = '👤 ' + prof.name; if (player) player.name = prof.name; sendPresence(true); });
$('btnPlay').onclick = startGame;
$('btnResume').onclick = resumeGame;
const CAM_NAMES = ['Proche', 'Loin', 'Drone'];
function pauseOptsText() { $('btnPCam').textContent = '🎥 Caméra : ' + CAM_NAMES[prof.cam]; $('btnPSound').textContent = prof.muted ? '🔇 Son : coupé' : '🔊 Son : activé'; $('btnPClean').textContent = prof.cleanHud ? '👁 Interface complète' : '👁 Vue dégagée'; }
$('btnPClean').onclick = () => { setClean(!prof.cleanHud, false); pauseOptsText(); };
$('btnPCam').onclick = () => { cycleCam(); pauseOptsText(); };
$('btnPSound').onclick = () => { initAudio(); setMuted(!prof.muted); pauseOptsText(); };
$('btnPReset').onclick = () => { resumeGame(); if (TAXI && TAXI.active) TAXI.reset(); else resetToTrack(player, true); };
$('btnRestart').onclick = startGame;
$('btnMenu').onclick = toMenu;
$('btnAgain').onclick = () => {
  if (mode() === 'online') { showScreen(null); $('hud').classList.remove('hidden'); state = 'play'; net.raceState = 'free'; net.rid = null; net.rat = 0; player.frozen = false; resetPlayerRun(player); player.frozen = false; game.score = 0; $('touch').classList.toggle('hidden', !isTouch); $('hudPos').classList.add('hidden'); sendPresence(true); return; }
  startGame();
};
$('btnMenu2').onclick = toMenu;
$('btnPause').onclick = pauseGame;
$('btnCam').onclick = cycleCam;
$('btnReset').onclick = () => { if (state === 'play' && TAXI && TAXI.active) TAXI.reset(); else if (state === 'play' && player) resetToTrack(player, true); };
$('btnMute').onclick = () => { initAudio(); setMuted(!prof.muted); };
$('musicVol').addEventListener('input', e => { music.vol = (+e.target.value || 0) / 100; store.set('musicVol', Math.round(music.vol * 100)); });
$('btnNext').onclick = () => { initAudio(); nextTrack(); };
{ const b2 = $('btnNext2'); if (b2) b2.onclick = () => { initAudio(); nextTrack(); }; }
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
let dtS = 1 / 60, frameN = 0;
function frame() {
  requestAnimationFrame(frame);
  // pas de temps réel (pas de ralenti si le téléphone rame) et lissé contre les à-coups
  const raw = Math.min(clock.getDelta(), 0.1);
  dtS += (raw - dtS) * (Math.abs(raw - dtS) > 0.03 ? 0.6 : 0.25);
  const dt = clamp(dtS, 0.004, 0.1);
  menuTime += dt;
  if (TAXI && TAXI.active) { pollPad(dt); updateMusic(dt); inPlayUi(); TAXI.frame(dt); perfAdapt(raw, state === 'play' || state === 'countdown'); renderer.render(scene, camera); return; }
  if ((frameN = (frameN + 1) % 4) === 0) updateDistCull();
  if (RT && TAXI && TAXI.race && TAXI.race.on) TAXI.race.tick(camera.position, player2 ? camera2.position : null, 1);
  pollPad(dt); updateMusic(dt); inPlayUi();
  let inp = NO_INPUT;
  if (!player) { renderer.render(scene, camera); return; }
  const m = mode();
  const inputs = new Map();
  if (state === 'play' || state === 'finish') {
    inp = state === 'finish' || (m === 'duo' && player.finished) ? AUTO(player) : readInput(0);
    if (player.frozen) inp = { thr: inp.thr, brk: 0, steer: 0, hb: 0, nitro: 0 };
    inputs.set(player, inp);
    if (player2) { let i2 = state === 'finish' || player2.finished ? AUTO(player2) : readInput(1); if (player2.frozen) i2 = { thr: i2.thr, brk: 0, steer: 0, hb: 0, nitro: 0 }; inputs.set(player2, i2); }
    for (const c of cars) if (c.isAI) inputs.set(c, c.finished ? Object.assign(aiInput(c, cars), { thr: 0.5, nitro: 0 }) : aiInput(c, cars));
    const SUB = Math.max(3, Math.ceil(dt / 0.0105)); let prevP = player.idx;
    const prevs = new Map(cars.map(c => [c, c.idx]));
    for (let s = 0; s < SUB; s++) {
      for (const c of cars) { if (c.frozen) continue; physicsStep(c, inputs.get(c) || NO_INPUT, dt / SUB); }
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collidePair(cars[i], cars[j], false);
    for (const c of cars) if (c.isAI) { const lp = trackLaps(c, prevs.get(c)); if (lp && lp.crossed && c.lap > game.laps && !c.finished) { c.finished = true; c.finishTime = game.raceT; } }
    prevP = prevs.get(player);
    if (state === 'play') { gameLogic(dt, prevP); bottleLogic(dt); if (player2) duoLogic(dt, prevs.get(player2)); } else { game.raceT += dt; trackLaps(player, prevP); if (player2) trackLaps(player2, prevs.get(player2)); }
    aiLogic(dt);
    if (state === 'finish') { game.finishWait -= dt; if (game.finishWait <= 0) endSession(); }
  } else if (state === 'countdown') {
    const ri = readInput(0); inp = { thr: ri.thr, brk: 0, steer: 0, hb: 0, nitro: 0 };
    if (player2) { const r2 = readInput(1); inputs.set(player2, { thr: r2.thr, brk: 0, steer: 0, hb: 0, nitro: 0 }); }
    if (raceLike(m)) {
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
      const near = c.isPlayer || c.isP2 || Math.hypot(c.x - camPos.x, c.z - camPos.z) < 90 || (player2 && Math.hypot(c.x - camera2.position.x, c.z - camera2.position.z) < 90);
      updateCarVisual(c, c.isPlayer ? inp : (inputs.get(c) || NO_INPUT), dt, near && state !== 'menu');
    }
    updateGhost();
    bottleFx(menuTime); flagTime.value = menuTime;
    updateSmoke(dt); crashFx.update(dt);
    if (skidDirty) { skidGeo.attributes.position.needsUpdate = true; skidDirty = false; }
    updateFans(dt, menuTime);
    if (state === 'intro') introUpdate(dt);
    else if (state === 'menu') orbitCamera(dt, 9.5, 2.4, 0.18);
    else if (state === 'results') orbitCamera(dt, 11, 3.2, 0.25);
    else if (state !== 'pause') { updateCamera(dt); if (player2) updateCamera(dt, player2, camera2, camState2); }
    if (TEST && window.__cam) { camera.position.set(...window.__cam.p); camera.lookAt(...window.__cam.t); if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); } }
    sun.position.set(player.x + SUN_OFF.x, SUN_OFF.y, player.z + SUN_OFF.z);
    sun.target.position.set(player.x, 0, player.z);
    sky.position.set(camera.position.x, 0, camera.position.z);
    const act = state === 'play' || state === 'countdown' || state === 'finish';
    updateAudio(player, inp, Math.max(player.screech || 0, player2 ? player2.screech || 0 : 0), act);
    updateAudio2(player2, inputs.get(player2) || NO_INPUT, act);
    if (act) { hudAcc += dt; if (hudAcc > 1 / 20) { hudAcc = 0; if (player2) { for (const q of duo.msg) if (q) q.t -= 1 / 20; duoHud(); } else { updateHud(); updateTags(); } } }
  }
  perfAdapt(raw, state === 'play' || state === 'countdown' || state === 'finish');
  if (player2 && (state === 'play' || state === 'countdown' || state === 'finish' || state === 'pause')) renderDuo2();
  else { if (camera.aspect !== window.innerWidth / window.innerHeight) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); } renderer.render(scene, camera); }
}
function perfAdapt(raw, playing) { // résolution adaptative : garde le jeu fluide sur les téléphones (sans va-et-vient)
  perf.t += raw; perf.n++;
  if (perf.t > 2) {
    const fps = perf.n / perf.t; perf.t = 0; perf.n = 0; perf.fps = fps;
    if (playing) {
      perf.lock = Math.max(0, (perf.lock || 0) - 2);
      let pr = pixelRatio;
      if (fps < 44 && pr > PR_MIN + 0.01) { pr = Math.max(PR_MIN, pr - 0.2); perf.lock = 10; perf.good = 0; }
      else if (fps < 33 && pr <= PR_MIN + 0.01 && shadowsOn && LITE) { shadowsOn = false; applyQuality(); perf.lock = 10; }
      else if (fps > 58) { perf.good = (perf.good || 0) + 1; if (perf.good >= 3 && !perf.lock && pr < PR_MAX) { pr = Math.min(PR_MAX, pr + 0.1); perf.good = 0; perf.lock = 6; } }
      else perf.good = 0;
      if (pr !== pixelRatio) { pixelRatio = pr; renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight); }
    }
  }
}
const perf = { t: 0, n: 0, fps: 60 };
let hudAcc = 0;

/* ======================= Générique (caméra de cinéma + titres) ======================= */
const intro = { on: false, shots: [], k: -1, t: 0, done: null, look: new THREE.Vector3() };
function introSet(id, html) { const e = $(id); if (!e) return; e.classList.remove('show'); void e.offsetWidth; e.innerHTML = html || ''; if (html) e.classList.add('show'); }
function introPlay(shots, done) {
  Object.assign(intro, { shots, k: -1, t: 0, done, on: true });
  const el = $('intro'); el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on'));
  introSet('introTitle', ''); introSet('introSub', ''); introSet('introCap', ''); introSet('introCredit', '');
  introNext();
}
function introNext() {
  intro.k++; intro.t = 0; const s = intro.shots[intro.k]; if (!s) { introEnd(); return; }
  if (s.title !== undefined) { const te = $('introTitle'); if (te) te.style.fontSize = 'clamp(30px,' + Math.min(10, 108 / Math.max(1, s.title.length)).toFixed(2) + 'vw,124px)'; introSet('introTitle', esc(s.title)); introSet('introSub', esc(s.sub || '')); }
  introSet('introCap', s.cap ? '<i>📍</i><span><b>' + esc(s.cap) + '</b>' + (s.capSub ? '<small>' + esc(s.capSub) + '</small>' : '') + '</span>' : '');
  if (s.credit !== undefined) introSet('introCredit', s.credit);
  if (s.fov && camera.fov !== s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
}
function introUpdate(dt) {
  if (!intro.on) return; const s = intro.shots[intro.k]; if (!s) return;
  intro.t += dt; const u = clamp(intro.t / s.dur, 0, 1), e = 0.5 - 0.5 * Math.cos(Math.PI * u);
  camera.position.lerpVectors(s.p0, s.p1, e); intro.look.lerpVectors(s.t0, s.t1, e); camera.lookAt(intro.look);
  if (camera.aspect !== window.innerWidth / window.innerHeight) { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
  if (intro.t >= s.dur) introNext();
}
function introEnd() {
  if (!intro.on) return; intro.on = false;
  const el = $('intro'); el.classList.remove('on'); setTimeout(() => { if (!intro.on) el.classList.add('hidden'); }, 650);
  const d = intro.done; intro.done = null; if (d) d();
}
{ const el = $('intro'); if (el) { el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); introEnd(); }); } }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function mainIntroShots() {
  const cx = (BBOX[0] + BBOX[1]) / 2, cz = (BBOX[2] + BBOX[3]) / 2, shots = [];
  const artists = [...new Set((music.list || []).map(t => (t.artist || '').split(/ ft\.| feat\.|,/)[0].trim()).filter(Boolean))].slice(0, 5);
  const credits = ['Musique : ' + (artists.length ? artists.join(' · ') : 'artistes de Mauritanie'), 'Voitures, ville et personnages modélisés pour le jeu', 'Nouveau : le mode Taxi Nouakchott'];
  if (RT) {
    const i0 = idxWrap(-Math.round(520 / SEG)), i1 = idxWrap(-Math.round(90 / SEG));
    shots.push({ dur: 5.5, p0: V3(PX[i0] - TX[i0] * 160 + NX[i0] * 70, 75, PZ[i0] - TZ[i0] * 160 + NZ[i0] * 70), p1: V3(PX[i0] + NX[i0] * 26, 34, PZ[i0] + NZ[i0] * 26), t0: V3(PX[i1], 0, PZ[i1]), t1: V3(PX[0], 2, PZ[0]), fov: 55, title: 'DRIFT ZONE', sub: 'Nouakchott réelle · Mauritanie', credit: '' });
    const pref = ['bmd', 'snim', 'mosquee', 'marche', 'afarco', 'sheraton', 'musee', 'palais', 'nkc', 'iman', 'fasq', 'mauricenter'], rank = l => { const r = pref.indexOf(l.id); return r < 0 ? 99 : r; };
    const lmR = TAXI && TAXI.race && TAXI.race.on ? TAXI.race.landmarks().filter(l => nearest(l.x, l.z, -1).d < 380).sort((a, b) => rank(a) - rank(b)).slice(0, 3) : [];
    lmR.forEach((l, k) => { const a = l.face + 0.55, b = l.face + 0.2, R = 48; shots.push({ dur: 3.6, p0: V3(l.x + Math.sin(a) * R, 19, l.z + Math.cos(a) * R), p1: V3(l.x + Math.sin(b) * (R - 9), 13, l.z + Math.cos(b) * (R - 9)), t0: V3(l.x, 14, l.z), t1: V3(l.x, 11, l.z), cap: l.name, capSub: l.ar || 'Nouakchott', title: k === 0 ? '' : undefined, credit: credits[k] }); });
  } else
  shots.push({ dur: 5.5, p0: V3(OCEAN_X - 140, 50, cz + 300), p1: V3(OCEAN_X + 40, 105, cz + 60), t0: V3(cx, 8, cz), t1: V3(cx, 0, cz - 60), fov: 50, title: 'DRIFT ZONE', sub: 'Nouakchott · Mauritanie', credit: '' });
  const pref = ['SNIM', 'FASQ HÔTEL', 'Grande Mosquée', 'MARCHÉ CAPITALE', 'MAURICENTER', 'SHERATON NOUAKCHOTT', 'HÔTEL NOUAKCHOTT'];
  const lms = RT ? [] : pref.map(n => LM_PLACED.find(l => l.name === n)).filter(Boolean).concat(LM_PLACED).filter((l, k, a) => a.indexOf(l) === k).slice(0, 3);
  lms.forEach((l, k) => { const a = l.rot + 0.95, b = l.rot + 0.35, R = (l.r || 30) + 34; shots.push({ dur: 3.6, p0: V3(l.x + Math.sin(a) * R, 11, l.z + Math.cos(a) * R), p1: V3(l.x + Math.sin(b) * (R - 8), 7, l.z + Math.cos(b) * (R - 8)), t0: V3(l.x, 17, l.z), t1: V3(l.x, 13, l.z), cap: l.name === l.name.toUpperCase() ? l.name.split(' ').map(w => w.length <= 4 ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(' ') : l.name, capSub: 'Nouakchott', title: k === 0 ? '' : undefined, credit: credits[k] }); });
  const i0 = idxWrap(-Math.round(150 / SEG)), i1 = idxWrap(-Math.round(30 / SEG));
  shots.push({ dur: 4, p0: V3(PX[i0] + NX[i0] * 8, 7, PZ[i0] + NZ[i0] * 8), p1: V3(player.x + Math.sin(0.6 + player.h) * 9.5, 2.4, player.z + Math.cos(0.6 + player.h) * 9.5), t0: V3(PX[i1], 1, PZ[i1]), t1: V3(player.x, 0.9, player.z), title: 'PRÊT ?', sub: 'Course · Drift · Taxi Nouakchott', credit: '' });
  return shots;
}

/* ======================= Interface pour le mode Taxi (taxi.js) ======================= */
function taxiApi() {
  return {
    THREE, $, clamp, lerp, wrapAng, fmtInt, esc, isTouch, LOW, LITE, HIQ, TEST, EXT, prof, store, saveProf, addCredits,
    scene, camera, renderer, sun, SUN_OFF, hemi, sky, canvasTex, instanceLib, buildSigns, PALETTE_WALL, DSCALE, MRT_SIGNS, noise, surf, addInstanced, PALM, glbLM, LANDMARKS, textTex, signMesh, prim, poleMat, mergeGroup, nightReg, glowSpriteTex, NIGHT_MATS,
    ASSETS, loadAsset, newCar, makeSpec, dynStep, collidePair, readInput, getPad, padActs, pad, keys, touch, initAudio, audio, updateAudio, blip, crashSound, GEAR_TOP,
    spawnSmoke, addSkid, clearSkids, clearSmoke, fx(dt) { updateSmoke(dt); crashFx.update(dt); if (skidDirty) { skidGeo.attributes.position.needsUpdate = true; skidDirty = false; } },
    updateCamera, camState, CAMS, attachHeadlights, headSpot, beam, popup, buildCar, dentModel, repairModel, crashFx, shake(v) { camShake = Math.max(camShake, v); }, introPlay, introUpdate, get introOn() { return intro.on; }, music, showScreen, renderMenu, hexCss, menuTime: () => menuTime, perf,
    get state() { return state; }, set state(v) { state = v; }, game, clock,
    hideDrift() { const keep = new Set([hemi, sun, sun.target, sky, stars, smokePts, skidMesh, headHolder]); const was = []; for (const o of scene.children) if (!keep.has(o) && o.visible) { was.push(o); o.visible = false; } if (player && player.model) player.model.root.visible = false; return was; },
    showDrift(was) { for (const o of was) o.visible = true; if (player && player.model) { player.model.root.visible = true; attachHeadlights(player.model); } updateDistCull(); },
  };
}

/* ======================= Démarrage ======================= */
const TIPS = ['CHARGEMENT DE NOUAKCHOTT…', 'CONSTRUCTION DE LA TOUR SNIM…', 'PRÉPARATION DES VOITURES…', 'BOUTEILLES DE NITRO SUR LA ROUTE…', 'INSTALLATION DES SUPPORTERS…'];
let tipI = 0; const tipTimer = setInterval(() => { $('loadTxt').textContent = TIPS[++tipI % TIPS.length]; }, 1400);
initNet();
loadAll(() => {
  clearInterval(tipTimer);
  try { buildCity(); } catch (e) { console.error('city', e && e.stack || e); }
  try { buildFans(); } catch (e) { console.error('fans', e); }
  try { buildNightLights(); } catch (e) { console.error('night', e && e.stack || e); }
  ensurePlayer(); placeCar(player, idxWrap(-Math.round(12 / SEG)), 0); player.frozen = true;
  try { if (window.DZTaxi) TAXI = window.DZTaxi(taxiApi()); } catch (e) { console.error('taxi', e && e.stack || e); TAXI = null; }
  if (!TAXI && mode() === 'taxi') prof.mode = 0;
  const startUi = () => {
    $('loading').classList.add('hidden');
    const toMenuNow = () => { state = 'menu'; showScreen('menu'); renderMenu(); orbitAng = 0.6; camera.fov = 42; camera.updateProjectionMatrix(); };
    if (!TEST || /[?&]intro/.test(location.search)) { state = 'intro'; showScreen(null); introPlay(mainIntroShots(), toMenuNow); } else toMenuNow();
  };
  if (RT && TAXI && TAXI.race) { // circuit dans la vraie Nouakchott : rues, bâtiments et monuments réels autour de la piste
    $('loadTxt').textContent = 'NOUAKCHOTT SE DESSINE : RUES ET BÂTIMENTS…';
    const bar = $('loadBar').firstElementChild; bar.style.width = '90%';
    let mask = null; try { mask = raceMask(); } catch (e) { console.error('mask', e); }
    if (mask) TAXI.race.prepare({ mask, hide: [ground, ocean, beach], prog: f => { bar.style.width = (90 + f * 8).toFixed(0) + '%'; } }, ok => {
      if (ok) { try { drawMapBg(TAXI.race.drawMap); } catch (e) { console.error('map', e); } TAXI.race.tick(new THREE.Vector3(PX[0], 0, PZ[0]), null, 9999); }
      startUi();
    }); else startUi();
  } else startUi();
  if (!TEST) initAudio(); // si le navigateur l'autorise (appli installée, lanceur du PC), la musique démarre tout de suite ; sinon au premier clic / à la première touche
  if (TEST) window.__dz = { THREE, music, initAudio, intro, introUpdate, get TAXI() { return TAXI; }, get player2() { return player2; }, wiz, readInput, pollPad, buildCar, CARS, loadAsset, updateDistCull, TAG, EL, MANCHES, audio, ASSETS, carKey, LM_PLACED, showScreen, BR, BOTTLES, nearestBr, applyAmbience, selectCar, placeCar, get bottleCount() { return game.bottles || 0; }, perf, get pixelRatio() { return pixelRatio; }, LOW, scene, renderer, camera, get player() { return player; }, get cars() { return cars; }, game, combo, keys, net, prof, get state() { return state; }, startGame, netUpdate, onlinePeers, physicsStep, aiInput, __setPlay() { state = 'play'; $('lights').classList.add('hidden'); }, standings, K, N, SEG, track: i => [PX[i], PZ[i]], endSession, toMenu,
    simulate(sec, ctl) { const dt = 1 / 60, out = []; for (let t = 0; t < sec; t += dt) { const ins = new Map(); ins.set(player, ctl ? ctl(player, t) : AUTO(player)); if (player2) ins.set(player2, AUTO(player2)); for (const c of cars) if (c.isAI) ins.set(c, aiInput(c, cars)); const prevs = new Map(cars.map(c => [c, c.idx])); for (let s = 0; s < 3; s++) for (const c of cars) if (!c.frozen) physicsStep(c, ins.get(c) || NO_INPUT, dt / 3); for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collidePair(cars[i], cars[j], false); for (const c of cars) if (c.isAI) { const lp = trackLaps(c, prevs.get(c)); if (lp && lp.crossed && c.lap > game.laps && !c.finished) { c.finished = true; c.finishTime = game.raceT; } } if (state === 'play') { gameLogic(dt, prevs.get(player)); bottleLogic(dt); if (player2) duoLogic(dt, prevs.get(player2)); } else { game.raceT += dt; trackLaps(player, prevs.get(player)); } aiLogic(dt); if (state === 'finish') { game.finishWait -= dt; if (game.finishWait <= 0) endSession(); } if (state === 'results') break; } return out; } };
});
frame();
})();
