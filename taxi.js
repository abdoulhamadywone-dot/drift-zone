/* Drift Zone · Mode « Taxi Nouakchott »
   Une ville en damier aux noms de Nouakchott : feux tricolores, trafic, piétons, police, clients aux arrêts.
   Chargé avant game.js ; game.js appelle window.DZTaxi(api) une fois le jeu prêt. */
'use strict';
window.DZTaxi = function (A) {
  const { THREE, $, clamp, lerp, wrapAng, fmtInt, esc, isTouch, LOW, LITE, HIQ, TEST, prof, store } = A;
  void HIQ;
  const T = { active: false, ready: false, loading: false };
  const R = Math.random;
  const pick = (a, r) => a[Math.floor((r || R)() * a.length)];
  const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const lin = h => new THREE.Color(h).convertSRGBToLinear();

  /* ======================= Grille de la ville ======================= */
  const NI = 9, NJ = 8, P = 96, RW = 16, HW = 8, SW = 4, BLK = P - RW, HS = BLK / 2 - 2; // HS : axe du trottoir
  const X0 = -(NI - 1) / 2 * P, Z0 = -(NJ - 1) / 2 * P, X1 = -X0, Z1 = -Z0;
  const nx = i => X0 + i * P, nz = j => Z0 + j * P;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E, S (z+), O, N
  const HEAD = d => Math.atan2(DIRS[d][0], DIRS[d][1]);
  const RIGHT = DIRS.map(([dx, dz]) => [-dz, dx]); // droite du conducteur (on roule à droite)
  const LANE = [1.9, 5.35]; // voie intérieure / extérieure (côté trottoir)
  const EL = P - 2 * HW; // longueur d'un tronçon entre deux carrefours
  const STOP_GAP = 5.8; // ligne d'arrêt : distance avant le carrefour
  const inGrid = (i, j) => i >= 0 && i < NI && j >= 0 && j < NJ;
  const inBlocks = (bi, bj) => bi >= 0 && bi < NI - 1 && bj >= 0 && bj < NJ - 1;
  const blockC = (bi, bj) => [(nx(bi) + nx(bi + 1)) / 2, (nz(bj) + nz(bj + 1)) / 2];
  const AV_NS = ['Route de la Plage', 'Rue des Pêcheurs', 'Av. Moktar Ould Daddah', 'Av. de l’Indépendance', 'Av. Charles de Gaulle', 'Av. Kennedy', 'Av. du Roi Fayçal', 'Rue de la Mosquée Marocaine', 'Route de l’Espoir'];
  const AV_EW = ['Route de Nouadhibou', 'Av. El Quds', 'Rue de Tevragh Zeina', 'Av. Gamal Abdel Nasser', 'Av. de la Résistance', 'Rue du Ksar', 'Av. de la Sebkha', 'Route de Rosso'];
  const DISTRICT_N = { tz: 'Tevragh Zeina', cap: 'Capitale', ksar: 'Ksar', smar: 'Cité Smar', sebkha: 'Sebkha', mina: 'El Mina', arafat: 'Arafat' };
  // géographie réelle (data/geo.js : El Minassa + OpenStreetMap) ; repli sur l'ancien découpage si absente
  const GEO = window.DZ_GEO || null;
  function district(bi, bj) { // style des immeubles de l'îlot
    if (GEO) return GEO.style[clamp(bj, 0, NJ - 2)][clamp(bi, 0, NI - 2)];
    if (bj <= 2 && bi <= 3) return 'tz';
    if (bj <= 1 && bi >= 5) return 'ksar';
    if (bi >= 6 && bj <= 4) return 'smar';
    if (bj >= 5) return bi <= 2 ? 'mina' : bi <= 4 ? 'sebkha' : 'arafat';
    return 'cap';
  }
  const quartier = (bi, bj) => GEO ? GEO.quart[clamp(bj, 0, NJ - 2)][clamp(bi, 0, NI - 2)] : DISTRICT_N[district(bi, bj)];
  const segName = (segs, t) => { if (segs) for (const s of segs) if (t >= s[0] - 0.03 && t <= s[1] + 0.03) return s[2]; return ''; };
  const nsName = (i, z) => GEO ? segName(GEO.ns[i], clamp((z - Z0) / P, 0, NJ - 1)) : AV_NS[i];
  const ewName = (j, x) => GEO ? segName(GEO.ew[j], clamp((x - X0) / P, 0, NI - 1)) : AV_EW[j];
  const placeName = (x, z) => {
    if (REAL) return rPlaceName(x, z);
    const bi = clamp(Math.floor((x - X0) / P), 0, NI - 2), bj = clamp(Math.floor((z - Z0) / P), 0, NJ - 2);
    const fi = clamp(Math.round((x - X0) / P), 0, NI - 1), fj = clamp(Math.round((z - Z0) / P), 0, NJ - 1);
    const onNS = Math.abs(x - nx(fi)) < HW + 2, onEW = Math.abs(z - nz(fj)) < HW + 2;
    const street = onNS && !onEW ? nsName(fi, z) : onEW && !onNS ? ewName(fj, x) : onNS && onEW ? (CARREF[fi + ',' + fj] || [nsName(fi, z), ewName(fj, x)].filter(Boolean).join(' × ') || 'Carrefour') : '';
    const q = quartier(bi, bj);
    return { street, district: q, moug: GEO ? GEO.moug[q] || '' : '' };
  };
  const CARREF = GEO ? GEO.carref : { '5,3': 'Carrefour BMD', '6,5': 'Carrefour Madrid', '7,6': 'Carrefour Bamako', '7,2': 'Carrefour Cité Smar', '4,4': 'Carrefour Capitale', '2,2': 'Carrefour Tevragh Zeina', '8,5': 'Sortie PK10' };

  // lieux connus : monuments (îlot + façade) et carrefours ; face 0 E, 1 S, 2 O, 3 N
  const GPLACES = [
    { id: 'snim', name: 'Tour SNIM', ar: 'برج سنيم', lm: 'lm_snim', b: [4, 2], face: 1 },
    { id: 'afarco', name: 'Immeuble AFARCO', ar: 'عمارة أفاركو', lm: 'lm_afarco', b: [5, 2], face: 1 },
    { id: 'bmd', name: 'Banque BMD', ar: 'البنك الموريتاني للتنمية', lm: 'lm_bmd', b: [4, 3], face: 3 },
    { id: 'marche', name: 'Marché Capitale', ar: 'سوق العاصمة', lm: 'lm_marche', b: [5, 3], face: 3 },
    { id: 'mosquee', name: 'Grande Mosquée', ar: 'المسجد الكبير', proc: 'mosqueSaudi', w: 48, d: 44, b: [3, 3], face: 0 },
    { id: 'fasq', name: 'Hôtel Fasq', ar: 'فندق فاسك', lm: 'lm_fasq', b: [1, 1], face: 1 },
    { id: 'iman', name: 'Hôtel Iman', ar: 'فندق إيمان', lm: 'lm_iman', b: [2, 0], face: 1 },
    { id: 'tasiast', name: 'Hôtel Tasiast', ar: 'فندق تازيازت', lm: 'lm_tasiast', b: [0, 2], face: 0 },
    { id: 'sheraton', name: 'Sheraton', ar: 'شيراتون', lm: 'lm_sheraton', b: [3, 1], face: 3 },
    { id: 'nkc', name: 'Hôtel Nouakchott', ar: 'فندق نواكشوط', lm: 'lm_nkc', b: [1, 3], face: 2 },
    { id: 'palais', name: 'Palais des Congrès', ar: 'قصر المؤتمرات', lm: 'lm_palais', b: [2, 4], face: 1 },
    { id: 'musee', name: 'Musée National', ar: 'المتحف الوطني', proc: 'museum', w: 40, d: 26, b: [3, 4], face: 1 },
    { id: 'mauricenter', name: 'Mauricenter', ar: 'موريسنتر', lm: 'lm_mauricenter', b: [6, 3], face: 2 },
    { id: 'stade', name: 'Stade Olympique', ar: 'الملعب الأولمبي', lib: 'B_Stadium', b: [6, 0], face: 1 },
    { id: 'station', name: 'Gare routière', ar: 'محطة النقل', lib: 'mrt_station', b: [7, 4], face: 2 },
    { id: 'plage', name: 'Plage des Pêcheurs', ar: 'شاطئ الصيادين', beach: true, j: 4 },
    { id: 'pk10', name: 'PK10 · Route de l’Espoir', ar: 'الكلم 10', node: [8, 5], dir: 0 },
    { id: 'madrid', name: 'Carrefour Madrid', ar: 'ملتقى مدريد', node: [6, 5], dir: 1 },
    { id: 'bamako', name: 'Carrefour Bamako', ar: 'ملتقى باماكو', node: [7, 6], dir: 2 },
    { id: 'smar', name: 'Cité Smar', ar: 'حي سمار', node: [7, 2], dir: 3 },
    { id: 'bmdx', name: 'Carrefour BMD', ar: 'ملتقى البنك', node: [5, 3], dir: 0 },
  ];
  let PLACES = GPLACES;
  if (GEO) { // monuments à leur vraie place, carrefours réels et lieux de la ville (OSM / El Minassa)
    for (const pl of PLACES) { const g = GEO.lm[pl.id]; if (g) { pl.b = [g[0], g[1]]; pl.face = g[2]; } }
    const pg = PLACES.find(p => p.id === 'plage'); if (pg) { pg.j = clamp(Math.floor(GEO.beachJ), 0, NJ - 2); pg.name = 'Plage des Pêcheurs · Port de pêche'; }
    for (let k = PLACES.length - 1; k >= 0; k--) if (PLACES[k].node && PLACES[k].id !== 'pk10') PLACES.splice(k, 1);
    let n = 0;
    for (const key in GEO.carref) {
      if (key === '8,5') continue;
      const [i, j] = key.split(',').map(Number); let dir = n++ % 4;
      for (let t = 0; t < 4 && !inGrid(i + DIRS[dir][0], j + DIRS[dir][1]); t++) dir = (dir + 1) % 4;
      PLACES.push({ id: 'car' + key, name: GEO.carref[key], ar: GEO.carAr[key] || '', node: [i, j], dir, cat: 'carrefour' });
    }
    GEO.dest.forEach((d, k) => PLACES.push({ id: 'poi' + k, name: d[0], ar: d[1], cat: d[2], pb: [d[3], d[4]], face: d[5], f: d[6] }));
  }
  // un point le long d'une rue : nœud a (i,j), direction d, côté sd (+1 = à droite de d), distance t depuis le carrefour
  function streetPoint(i, j, d, sd, t) {
    const [dx, dz] = DIRS[d], [rx, rz] = RIGHT[d];
    const bx = nx(i) + dx * t, bz = nz(j) + dz * t;
    return {
      mx: bx + rx * sd * (HW + 2.2), mz: bz + rz * sd * (HW + 2.2), // repère sur le trottoir
      zx: bx + rx * sd * LANE[1], zz: bz + rz * sd * LANE[1], // zone d'arrêt (voie côté trottoir)
      look: Math.atan2(-rx * sd, -rz * sd), // regard du piéton vers la route
    };
  }
  function faceSpot(bi, bj, face) { // milieu de la rue devant la façade d'un îlot
    if (face === 0) return [bi + 1, bj, 1, 1];
    if (face === 2) return [bi, bj, 1, -1];
    if (face === 1) return [bi, bj + 1, 0, -1];
    return [bi, bj, 0, 1];
  }
  for (const pl of PLACES) {
    let sp;
    if (pl.b) { const [i, j, d, sd] = faceSpot(pl.b[0], pl.b[1], pl.face); sp = streetPoint(i, j, d, sd, P / 2); }
    else if (pl.pb) { const [i, j, d, sd] = faceSpot(pl.pb[0], pl.pb[1], pl.face); sp = streetPoint(i, j, d, sd, clamp(pl.f * P, HW + 12, P - HW - 12)); }
    else if (pl.node) { const [i, j] = pl.node, d = pl.dir; const [ri] = [0]; sp = streetPoint(i, j, d, inGrid(i + DIRS[d][0], j + DIRS[d][1]) ? 1 : -1, inGrid(i + DIRS[d][0], j + DIRS[d][1]) ? 24 : -24); }
    else if (pl.beach) sp = { mx: X0 - HW - 4, mz: nz(pl.j) + 30, zx: X0 - LANE[1], zz: nz(pl.j) + 30, look: Math.PI / 2 };
    Object.assign(pl, sp);
  }

  /* ======================= Feux tricolores ======================= */
  const CYC = 34, G_T = 13, Y_T = 3; // vert 13 s · orange 3 s · rouge intégral 1 s, puis l'autre axe
  const OFS = new Float32Array(NI * NJ);
  { const r = seeded(4242); for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) OFS[i * NJ + j] = ((i * 7 + j * 11) % CYC) + r() * 3; }
  let lightT = 0;
  function light(i, j, axis) { // 'G' 'Y' 'R' et temps restant avant le prochain vert (pour les piétons)
    let ph = (lightT + OFS[i * NJ + j]) % CYC; if (axis) ph = (ph + CYC / 2) % CYC;
    if (ph < G_T) return { s: 'G', toG: 0, left: G_T - ph };
    if (ph < G_T + Y_T) return { s: 'Y', toG: CYC - ph, left: G_T + Y_T - ph };
    return { s: 'R', toG: CYC - ph, left: CYC - ph };
  }

  /* ======================= Monde statique : collisions ======================= */
  const CELL = 24, colMaps = { grid: new Map(), real: new Map() }; let grid = colMaps.grid;
  const gkey = (cx, cz) => cx * 4096 + cz;
  function addCol(c) { // c : { box: [x0, z0, x1, z1] } ou { x, z, r }
    const b = c.box || [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
    for (let cx = Math.floor(b[0] / CELL); cx <= Math.floor(b[2] / CELL); cx++) for (let cz = Math.floor(b[1] / CELL); cz <= Math.floor(b[3] / CELL); cz++) {
      const k = gkey(cx, cz); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(c);
    }
  }
  const nearCols = (x, z, out) => { out.length = 0; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(gkey(cx + a, cz + b)); if (l) for (const c of l) if (!out.includes(c)) out.push(c); } return out; };
  const _cols = [];
  // pousse un cercle hors des obstacles ; renvoie la vitesse d'impact
  function collideCircle(c, ox, oz, r) {
    const px = c.x + ox, pz = c.z + oz; let hit = 0;
    for (const o of nearCols(px, pz, _cols)) {
      let qx, qz;
      if (o.poly) { // emprise exacte d'un bâtiment (carte réelle)
        const P_ = o.poly, n = P_.length / 2; let bd = 1e9, inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const ax = P_[2 * j], az = P_[2 * j + 1], bx = P_[2 * i], bz = P_[2 * i + 1];
          if ((bz > pz) !== (az > pz) && px < (ax - bx) * (pz - bz) / (az - bz) + bx) inside = !inside;
          const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1, t = clamp(((px - ax) * ex + (pz - az) * ez) / l2, 0, 1), cx = ax + ex * t, cz = az + ez * t, dd = Math.hypot(px - cx, pz - cz);
          if (dd < bd) { bd = dd; qx = cx; qz = cz; }
        }
        let dx, dz, d;
        if (inside) { d = bd || 1e-3; dx = (qx - px) / d; dz = (qz - pz) / d; d = -d; } else { if (bd >= r) continue; d = bd || 1e-3; dx = (px - qx) / d; dz = (pz - qz) / d; }
        const pen = r - d; c.x += dx * pen; c.z += dz * pen;
        const vn = c.vx * dx + c.vz * dz;
        if (vn < 0) { c.vx -= dx * vn * 1.3; c.vz -= dz * vn * 1.3; c.vx *= 0.85; c.vz *= 0.85; c.w *= 0.6; hit = Math.max(hit, -vn); if (c === taxi && -vn > lastHit.v) Object.assign(lastHit, { v: -vn, x: qx, z: qz, nx: dx, nz: dz, o: null }); }
        continue;
      }
      if (o.box) { qx = clamp(px, o.box[0], o.box[2]); qz = clamp(pz, o.box[1], o.box[3]); }
      else { const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz) || 1e-3; qx = o.x + dx / d * o.r; qz = o.z + dz / d * o.r; if (d > o.r + r) continue; }
      let dx = px - qx, dz = pz - qz; let d = Math.hypot(dx, dz);
      const inside = o.box && px > o.box[0] && px < o.box[2] && pz > o.box[1] && pz < o.box[3];
      if (inside) { // centre dans la boîte : sortie par le côté le plus proche
        const e = [px - o.box[0], o.box[2] - px, pz - o.box[1], o.box[3] - pz], k = e.indexOf(Math.min(...e));
        dx = [-1, 1, 0, 0][k]; dz = [0, 0, -1, 1][k]; d = -e[k];
      } else if (d >= r || d < 1e-5) continue; else { dx /= d; dz /= d; }
      const pen = r - d; c.x += dx * pen; c.z += dz * pen;
      const vn = c.vx * dx + c.vz * dz;
      if (vn < 0) { c.vx -= dx * vn * 1.3; c.vz -= dz * vn * 1.3; c.vx *= 0.85; c.vz *= 0.85; c.w *= 0.6; hit = Math.max(hit, -vn); if (c === taxi && -vn > lastHit.v) Object.assign(lastHit, { v: -vn, x: qx, z: qz, nx: dx, nz: dz, o: null }); }
    }
    return hit;
  }
  const lastHit = { v: 0, x: 0, z: 0, nx: 0, nz: 0, o: null, lz: 0 };
  // cercle contre une boîte orientée (véhicules IA)
  function circleOBB(c, ox, oz, r, b) {
    const px = c.x + ox - b.x, pz = c.z + oz - b.z, ca = Math.cos(b.h), sa = Math.sin(b.h);
    const lx = px * ca - pz * sa, lz = px * sa + pz * ca; // repère local : z = avant du véhicule
    const qx = clamp(lx, -b.hw, b.hw), qz = clamp(lz, -b.hl, b.hl);
    let dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);
    if (d >= r) return 0;
    if (d < 1e-4) { const e = [b.hw - lx, lx + b.hw, b.hl - lz, lz + b.hl], k = e.indexOf(Math.min(...e)); dx = [1, -1, 0, 0][k]; dz = [0, 0, 1, -1][k]; d = -e[k]; } else { dx /= d; dz /= d; }
    const wx = dx * ca + dz * sa, wz = -dx * sa + dz * ca, pen = r - d; // retour au repère monde
    c.x += wx * pen; c.z += wz * pen;
    const vn = (c.vx - (b.vx || 0)) * wx + (c.vz - (b.vz || 0)) * wz;
    if (vn < 0) { c.vx -= wx * vn * 1.25; c.vz -= wz * vn * 1.25; c.w += (Math.random() - 0.5) * 0.3; if (c === taxi && -vn > lastHit.v) Object.assign(lastHit, { v: -vn, x: b.x + qx * ca + qz * sa, z: b.z - qx * sa + qz * ca, nx: wx, nz: wz, o: b, lz: qz }); return -vn; }
    return 0;
  }

  /* ======================= Construction de la ville ======================= */
  const root = new THREE.Group(); root.name = 'taxiCity'; root.visible = false;
  const CULL = [];
  let lib = null; // taxi.glb
  const sizes = {};
  function libSize(key) {
    if (sizes[key]) return sizes[key];
    const src = (A.ASSETS.mrt && A.ASSETS.mrt.getObjectByName(key)) || (A.ASSETS.city && A.ASSETS.city.getObjectByName(key)) || (lib && lib.getObjectByName(key));
    if (!src) return null;
    src.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), b = new THREE.Box3();
    src.traverse(o => { if (o.isMesh) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); b.union(bb); } });
    return (sizes[key] = { w: b.max.x - b.min.x, d: b.max.z - b.min.z, h: b.max.y - b.min.y, cx: (b.max.x + b.min.x) / 2, cz: (b.max.z + b.min.z) / 2 });
  }
  // géométrie fusionnée d'un objet (par matériau), avec une matrice en plus
  function bake(src, extra) { // attributs lus un par un : fonctionne aussi avec les tampons entrelacés (gltf-transform)
    src.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), buckets = new Map(), nm = new THREE.Matrix3(), w = new THREE.Vector3();
    src.traverse(o => {
      if (!o.isMesh || !o.visible || o.geometry.type === 'PlaneGeometry' || o.geometry.type === 'ConeGeometry') return;
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); if (extra) m.premultiply(extra);
      nm.getNormalMatrix(m);
      const geo = o.geometry, P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, I = geo.index, n = I ? I.count : P.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        const i = I ? I.getX(k) : k;
        w.fromBufferAttribute(P, i).applyMatrix4(m); pos[k * 3] = w.x; pos[k * 3 + 1] = w.y; pos[k * 3 + 2] = w.z;
        if (N) { w.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[k * 3] = w.x; nor[k * 3 + 1] = w.y; nor[k * 3 + 2] = w.z; }
        if (U) { uv[k * 2] = U.getX(i); uv[k * 2 + 1] = U.getY(i); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (N) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); else g.computeVertexNormals();
      const k = o.material; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(g);
    });
    const out = [];
    for (const [mat, gs] of buckets) out.push({ geo: mergeGeos(gs), mat });
    return out;
  }
  function mergeGeos(gs) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const g of gs) { pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (!gs[0].attributes.normal) g.computeVertexNormals();
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
  const texFix = m => { if (m && m.map && !m.userData.txFix) { m.userData.txFix = true; m.map.anisotropy = Math.min(LOW ? 2 : 8, A.renderer.capabilities.getMaxAnisotropy()); m.map.minFilter = THREE.LinearMipmapLinearFilter; m.map.needsUpdate = true; } return m; };
  const lowMat = m => { if (!LOW || !m || m.isMeshLambertMaterial || m.isMeshBasicMaterial) return m; return new THREE.MeshLambertMaterial({ map: m.map, color: m.color, emissive: m.emissive, emissiveMap: m.emissiveMap }); };

  // textures de la chaussée (atlas : marquages / passage piéton / carrefour)
  function roadTex() {
    return A.canvasTex(256, 1024, (c, w, h) => {
      A.noise(c, w, h, '#3b3d40', 0.13, 26000);
      const yA = h * 0.5, yB = h * 0.8125; // A : 0..yA (16 m) · B : yA..yB (6 m) · C : reste
      const mA = m => yA * m / 16, ux = m => w * (0.5 + m / 16);
      c.fillStyle = '#e8e8e2';
      for (const s of [-1, 1]) c.fillRect(ux(s * 7.3) - 2, 0, 4, yA); // lignes de rive
      for (const s of [-1, 1]) for (let k = 0; k < 16; k += 6) c.fillRect(ux(s * 3.6) - 2, mA(k + 1), 4, mA(3)); // pointillés
      c.fillStyle = '#e8c547'; for (const s of [-1, 1]) c.fillRect(ux(s * 0.16) - 2, 0, 4, yA); // double ligne centrale
      // zone B (6 m, y croissant = vers le carrefour) : bord du carrefour en haut (y = yA)
      const mB = m => yA + (yB - yA) * (1 - m / 6); // m mètres depuis le bord du carrefour
      c.fillStyle = '#e8c547'; for (const s of [-1, 1]) c.fillRect(ux(s * 0.16) - 2, mB(6), 4, mB(4.6) - mB(6));
      c.fillStyle = '#efefe8';
      for (let m = -7; m < 7.2; m += 1.25) c.fillRect(ux(m), mB(4.3), (w / 16) * 0.62, mB(0.3) - mB(4.3)); // zébras
      c.fillRect(ux(0.25), mB(5.5), ux(7.4) - ux(0.25), mB(5.0) - mB(5.5)); // ligne d'arrêt (moitié droite)
      for (const s of [-1, 1]) c.fillRect(ux(s * 7.3) - 2, mB(6), 4, mB(4.4) - mB(6));
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 8; k++) { c.beginPath(); c.ellipse(Math.random() * w, yB + Math.random() * (h - yB), 30, 12, Math.random() * 3, 0, 6.3); c.fill(); }
    }, false);
  }
  function buildRoads() {
    const pos = [], uv = [], idx = [];
    const V = { A0: 1, A1: 0.5, B0: 0.5, B1: 0.1875, C0: 0.17, C1: 0.02 }; // v (texture retournée : 1 = haut du canvas)
    const quad = (cx, cz, ax, az, hl, hw, v0, v1, u0, u1) => { // ax,az : direction « longueur » ; la largeur suit la droite de (ax,az)
      const rx = -az, rz = ax, b = pos.length / 3;
      pos.push(cx - ax * hl - rx * hw, 0.02, cz - az * hl - rz * hw, cx - ax * hl + rx * hw, 0.02, cz - az * hl + rz * hw, cx + ax * hl + rx * hw, 0.02, cz + az * hl + rz * hw, cx + ax * hl - rx * hw, 0.02, cz + az * hl - rz * hw);
      uv.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) {
      quad(nx(i), nz(j), 1, 0, HW, HW, V.C0, V.C1, 0, 1);
      for (const d of [0, 1]) {
        const [dx, dz] = DIRS[d], i2 = i + dx, j2 = j + dz; if (!inGrid(i2, j2)) continue;
        const sx = nx(i) + dx * HW, sz = nz(j) + dz * HW;
        for (let k = 0; k < 4; k++) { const t0 = 6 + k * (EL - 12) / 4, t1 = t0 + (EL - 12) / 4; quad(sx + dx * (t0 + t1) / 2, sz + dz * (t0 + t1) / 2, dx, dz, (t1 - t0) / 2, HW, V.A0, V.A1, 0, 1); }
        quad(sx + dx * (EL - 3), sz + dz * (EL - 3), dx, dz, 3, HW, V.B0, V.B1, 0, 1); // vers le carrefour suivant
        quad(sx + dx * 3, sz + dz * 3, -dx, -dz, 3, HW, V.B0, V.B1, 0, 1); // vers ce carrefour
      }
    }
    // route de la plage et sortie PK10 (prolongements hors damier)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    const tex = roadTex(); tex.anisotropy = Math.min(LOW ? 2 : 8, A.renderer.capabilities.getMaxAnisotropy());
    const m = new THREE.Mesh(g, A.surf({ map: tex, roughness: 0.88, envMapIntensity: 0.35 })); m.receiveShadow = !LOW; root.add(m);
  }
  function buildBlocks() { // îlots surélevés : trottoirs + bordures
    const tileTex = A.canvasTex(256, 256, (c, w, h) => { A.noise(c, w, h, '#cdbfa6', 0.1, 9000); c.strokeStyle = 'rgba(80,70,55,0.35)'; c.lineWidth = 2; for (let k = 0; k <= w; k += 64) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(w, k); c.stroke(); } }, true);
    const sandTex = A.canvasTex(256, 256, (c, w, h) => { A.noise(c, w, h, '#d9b98a', 0.16, 14000); }, true);
    const curbTex = A.canvasTex(64, 64, (c, w, h) => { A.noise(c, w, h, '#e7e2d8', 0.08, 800); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, h - 6, w, 6); }, true);
    const top = [], tuv = [], ti = [], side = [], suv = [], si = [], yard = [], yuv = [], yi = [];
    const H = 0.15;
    const box = (x0, z0, x1, z1, P_, U, I, sc) => { const b = P_.length / 3; P_.push(x0, H, z0, x1, H, z0, x1, H, z1, x0, H, z1); U.push(x0 / sc, z0 / sc, x1 / sc, z0 / sc, x1 / sc, z1 / sc, x0 / sc, z1 / sc); I.push(b, b + 2, b + 1, b, b + 3, b + 2); };
    for (let bi = 0; bi < NI - 1; bi++) for (let bj = 0; bj < NJ - 1; bj++) {
      const [cx, cz] = blockC(bi, bj), h = BLK / 2, ih = h - SW;
      // trottoir : 4 bandes ; cœur d'îlot en sable damé
      box(cx - h, cz - h, cx + h, cz - ih, top, tuv, ti, 4); box(cx - h, cz + ih, cx + h, cz + h, top, tuv, ti, 4);
      box(cx - h, cz - ih, cx - ih, cz + ih, top, tuv, ti, 4); box(cx + ih, cz - ih, cx + h, cz + ih, top, tuv, ti, 4);
      box(cx - ih, cz - ih, cx + ih, cz + ih, yard, yuv, yi, 9);
      const c4 = [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
      for (let k = 0; k < 4; k++) { const [ax, az] = c4[k], [bx, bz] = c4[(k + 1) % 4], b = side.length / 3, L = Math.hypot(bx - ax, bz - az); side.push(ax, 0, az, bx, 0, bz, bx, H, bz, ax, H, az); suv.push(0, 0, L / 2, 0, L / 2, 1, 0, 1); si.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    }
    const mk = (P_, U, I, map, dbl) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P_, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere(); const m = new THREE.Mesh(g, A.surf({ map, roughness: 0.95, envMapIntensity: 0.25, side: dbl ? THREE.DoubleSide : THREE.FrontSide })); m.receiveShadow = !LOW; root.add(m); return m; };
    mk(top, tuv, ti, tileTex); mk(yard, yuv, yi, sandTex); mk(side, suv, si, curbTex, true);
    // sol de sable, océan, plage
    const gt = A.canvasTex(512, 512, (c, w, h) => { A.noise(c, w, h, '#d7b98c', 0.2, 22000); c.fillStyle = 'rgba(160,120,70,0.18)'; for (let k = 0; k < 40; k++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 60, 10 + Math.random() * 20, Math.random() * 3, 0, 6.3); c.fill(); } }, true);
    gt.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), A.surf({ map: gt, roughness: 1, envMapIntensity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; ground.receiveShadow = !LOW; root.add(ground);
    const ot = A.canvasTex(256, 256, (c, w, h) => { A.noise(c, w, h, '#1f6382', 0.12, 9000); c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; for (let k = 0; k < 40; k++) { const y = Math.random() * h, x = Math.random() * w; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 12, y - 4, x + 26, y); c.stroke(); } }, true);
    ot.repeat.set(20, 40);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 4000), A.surf({ map: ot, roughness: 0.2, metalness: 0.2, envMapIntensity: 1.1 })); ocean.rotation.x = -Math.PI / 2; ocean.position.set(X0 - 90 - 800, 0.01, 0); root.add(ocean);
    const bt = A.canvasTex(64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f2f6f8'); g.addColorStop(0.2, '#bfd9dc'); g.addColorStop(0.4, '#c9a978'); g.addColorStop(1, '#e3c793'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, false);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(80, 4000), A.surf({ map: bt, roughness: 1 })); beach.rotation.x = -Math.PI / 2; beach.position.set(X0 - 90 + 40 - 40 + 0, 0.0, 0); beach.position.x = X0 - HW - 50; root.add(beach);
    // limites du monde (sable / mer)
    addCol({ box: [X0 - 300, Z0 - 400, X0 - HW - 34, Z1 + 400] });
    addCol({ box: [X1 + HW + 60, Z0 - 400, X1 + 400, Z1 + 400] });
    addCol({ box: [X0 - 400, Z0 - 400, X1 + 400, Z0 - HW - 60] });
    addCol({ box: [X0 - 400, Z1 + HW + 60, X1 + 400, Z1 + 400] });
  }
  const inst = {}; // bâtiments instanciés (bibliothèques mrt / city)
  const put = (key, x, z, rot, sc, y) => { (inst[key] = inst[key] || []).push([x, y === undefined ? 0.15 : y, z, rot, sc || 1]); };
  function placeLib(key, x, z, face, sc, colPad) { // origine de l'objet décalée pour que sa boîte soit centrée en (x, z)
    const s = libSize(key); if (!s) return null;
    const rot = HEAD(face), ca = Math.cos(rot), sa = Math.sin(rot);
    const ox = (s.cx * ca + s.cz * sa) * sc, oz = (-s.cx * sa + s.cz * ca) * sc;
    put(key, x - ox, z - oz, rot, sc);
    const w = (face % 2 ? s.w : s.d) * sc, d = (face % 2 ? s.d : s.w) * sc, p = colPad || 0;
    addCol({ box: [x - w / 2 + p, z - d / 2 + p, x + w / 2 - p, z + d / 2 - p] });
    return s;
  }
  const POOLS = {
    tz: ['mrt_villaA', 'mrt_villaB', 'mrt_villaA', 'mrt_immA', 'mrt_immB', 'B_House01', 'B_House02', 'B_Residential'],
    cap: ['mrt_shop1A', 'mrt_shop1B', 'mrt_shop2A', 'mrt_shop2B', 'mrt_immA', 'mrt_immB', 'mrt_tower', 'mrt_kioskA', 'B_SuperMarket', 'B_DrugStore'],
    ksar: ['mrt_villaA', 'mrt_villaB', 'mrt_shop2A', 'mrt_shop2B', 'mrt_kioskB', 'B_House03', 'B_House04', 'mrt_immB'],
    smar: ['mrt_shop1A', 'mrt_shop2B', 'mrt_immA', 'mrt_villaB', 'mrt_kioskA', 'B_House01', 'B_GasStation', 'mrt_market'],
    sebkha: ['mrt_shop1A', 'mrt_shop1B', 'mrt_kioskA', 'mrt_kioskB', 'B_House01', 'B_House03', 'mrt_villaB', 'mrt_market'],
    mina: ['mrt_kioskA', 'mrt_kioskB', 'B_House02', 'B_House04', 'mrt_villaB', 'mrt_shop1B', 'mrt_market'],
    arafat: ['mrt_shop1A', 'mrt_kioskB', 'B_House03', 'B_House04', 'mrt_villaA', 'mrt_shop2A', 'mrt_market'],
  };
  const LM_DIMS = { lm_snim: [44, 34], lm_afarco: [42, 15], lm_bmd: [32, 24], lm_fasq: [44, 26], lm_mauricenter: [50, 30], lm_nkc: [56, 16], lm_iman: [30, 32], lm_tasiast: [42, 22], lm_sheraton: [52, 36], lm_palais: [86, 60], lm_marche: [64, 36] };
  const used = new Set(), GSTOPS = [], PROPS = { lamp: [], slamp: [], palm: [], tree: [], bench: [], bin: [], skip: [], rock: [], khaima: [], shelter: [] }, LAMP_HEADS = [];
  let STOPS = GSTOPS;
  function buildBuildings(rnd) {
    const occupied = new Set();
    // 1) monuments
    for (const pl of PLACES) {
      if (!pl.b) continue;
      const [bi, bj] = pl.b, [cx, cz] = blockC(bi, bj), [fx, fz] = DIRS[pl.face]; occupied.add(bi + ',' + bj);
      used.add(bi + ',' + bj + ',' + pl.face);
      let w = 40, d = 30, g = null, sc = 1;
      if (pl.lm) { const lm = A.glbLM(pl.lm); if (lm) { g = lm.g; [w, d] = LM_DIMS[pl.lm]; } else { const h = A.LANDMARKS.hotel(pl.name.toUpperCase(), pl.ar, { w: 34, h: pl.id === 'snim' ? 40 : 18, d: 22, wall: '#f1e7d6', balcony: '#a9927a', signBg: '#0b3d2e', signFg: '#ffd27a' }); g = h.g; w = 34; d = 22; } }
      else if (pl.proc) { const lm = A.LANDMARKS[pl.proc](); g = lm.g; w = pl.w; d = pl.d; }
      if (pl.lib) { const s = libSize(pl.lib); if (s) { const ww = pl.face % 2 ? s.w : s.d; sc = Math.min(1.25, 66 / Math.max(s.w, s.d)); const dd = (pl.face % 2 ? s.d : s.w) * sc; placeLib(pl.lib, cx + fx * (BLK / 2 - SW - 2 - dd / 2), cz + fz * (BLK / 2 - SW - 2 - dd / 2), pl.face, sc); } continue; }
      if (!g) continue;
      sc = Math.min(1, 70 / w, 70 / d);
      const off = BLK / 2 - SW - 2 - d * sc / 2, x = cx + fx * off, z = cz + fz * off;
      g.position.set(x, 0.15, z); g.rotation.y = HEAD(pl.face); g.scale.setScalar(sc);
      root.add(g); A.mergeGroup(g);
      const ww = (pl.face % 2 ? w : d) * sc, dd = (pl.face % 2 ? d : w) * sc;
      addCol({ box: [x - ww / 2 + 1, z - dd / 2 + 1, x + ww / 2 - 1, z + dd / 2 - 1] });
      pl.g = g;
    }
    // 2) îlots ordinaires : bâtiments en façade sur les quatre rues
    for (let bi = 0; bi < NI - 1; bi++) for (let bj = 0; bj < NJ - 1; bj++) {
      const key = bi + ',' + bj, [cx, cz] = blockC(bi, bj), pool = POOLS[district(bi, bj)].filter(k => libSize(k));
      if (!pool.length) continue;
      const lmPl = PLACES.find(p => p.b && p.b[0] === bi && p.b[1] === bj);
      const ih = BLK / 2 - SW; // demi-côté constructible (36)
      for (const face of [3, 1, 0, 2]) {
        if (lmPl && (face === lmPl.face || (face + 2) % 4 === lmPl.face || lmPl.id === 'palais' || lmPl.id === 'stade' || lmPl.id === 'marche' || lmPl.id === 'mosquee')) continue;
        const [fx, fz] = DIRS[face], ax = -fz, az = fx; // ax,az : le long de la façade
        const span = face % 2 ? ih : ih - 17; // les côtés E/O laissent les angles aux côtés N/S
        let p = -span + 1 + rnd() * 2;
        while (p < span - 6) {
          const k = pick(pool, rnd), s = libSize(k); let sc = 1; let w = s.w, d = s.d;
          if (d > 17) { sc = 17 / d; w *= sc; d *= sc; }
          if (p + w > span) { p += 3; continue; }
          const along = p + w / 2, off = ih - 1.2 - d / 2;
          const x = cx + fx * off + ax * along, z = cz + fz * off + az * along;
          placeLib(k, x, z, face, sc, 0.4);
          p += w + 1.5 + rnd() * 4;
        }
      }
      // cœur d'îlot : quelques arbres / khaïmas
      const nTree = lmPl ? 0 : LOW ? Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < nTree; k++) { const x = cx + (rnd() - 0.5) * 22, z = cz + (rnd() - 0.5) * 22; if (rnd() < 0.5) PROPS.palm.push([x, 0.15, z, rnd() * 6.3, 0.8 + rnd() * 0.4]); else PROPS.tree.push([x, 0.15, z, rnd() * 6.3, 0.8 + rnd() * 0.5]); addCol({ x, z, r: 0.7 }); }
      if (!lmPl && (district(bi, bj) === 'mina' || district(bi, bj) === 'arafat') && rnd() < 0.5) { const x = cx + (rnd() - 0.5) * 16, z = cz + (rnd() - 0.5) * 16; put(rnd() < 0.5 ? 'mrt_khaimaA' : 'mrt_khaimaB', x, z, rnd() * 6.3, 0.8); addCol({ x, z, r: 4 }); }
    }
    // 3) arrêts de taxi (abris) sur des façades libres
    const cand = [];
    for (let bi = 0; bi < NI - 1; bi++) for (let bj = 0; bj < NJ - 1; bj++) for (let face = 0; face < 4; face++) if (!used.has(bi + ',' + bj + ',' + face)) cand.push([bi, bj, face]);
    cand.sort(() => rnd() - 0.5);
    const nStops = 30;
    for (const [bi, bj, face] of cand) {
      if (STOPS.length >= nStops) break;
      if (STOPS.some(s => Math.abs(s.bi - bi) + Math.abs(s.bj - bj) < 2)) continue;
      const [i, j, d, sd] = faceSpot(bi, bj, face), t = P / 2 + (rnd() < 0.5 ? -14 : 14);
      const sp = streetPoint(i, j, d, sd, t);
      STOPS.push(Object.assign({ bi, bj, face, client: null, cool: 0, id: STOPS.length }, sp));
      used.add(bi + ',' + bj + ',' + face);
    }
    // 4) mobilier : lampadaires, palmiers le long des avenues, bancs, bennes
    for (let bi = 0; bi < NI - 1; bi++) for (let bj = 0; bj < NJ - 1; bj++) {
      const [cx, cz] = blockC(bi, bj);
      for (let face = 0; face < 4; face++) {
        const [fx, fz] = DIRS[face], ax = -fz, az = fx, off = BLK / 2 - 0.8;
        for (let a = -30; a <= 30; a += 15) {
          const x = cx + fx * off + ax * a, z = cz + fz * off + az * a;
          if (STOPS.some(s => Math.hypot(s.mx - x, s.mz - z) < 7) || PLACES.some(p => p.mx !== undefined && Math.hypot(p.mx - x, p.mz - z) < 7)) continue;
          const k = Math.round(a / 15);
          if (k % 2 === 0 && (!LOW || k === 0)) { const avenue = (face % 2 === 1 && (bj + (face === 1 ? 1 : 0)) === 3) || (face % 2 === 0 && (bi + (face === 0 ? 1 : 0)) === 4); (avenue ? PROPS.lamp : PROPS.slamp).push([x, 0.15, z, HEAD(face) + (avenue ? Math.PI / 2 : Math.PI), 1]); addCol({ x, z, r: 0.35 }); LAMP_HEADS.push(avenue ? [x, 5.2, z] : [x - fx * 1.1, 6.1, z - fz * 1.1]); }
          else if (rnd() < (LOW ? 0.45 : 0.85)) { PROPS.palm.push([x - fx * 0.8, 0.15, z - fz * 0.8, rnd() * 6.3, 0.62 + rnd() * 0.2]); addCol({ x: x - fx * 0.8, z: z - fz * 0.8, r: 0.45 }); }
        }
        if (rnd() < 0.12) { const a = (rnd() - 0.5) * 40, x = cx + fx * (BLK / 2 - 2.6) + ax * a, z = cz + fz * (BLK / 2 - 2.6) + az * a; if (!STOPS.some(s => Math.hypot(s.mx - x, s.mz - z) < 9)) { PROPS.skip.push([x, 0.15, z, HEAD(face) + Math.PI / 2, 1]); addCol({ box: [x - 1.9, z - 1.9, x + 1.9, z + 1.9] }); } }
      }
    }
    for (const s of STOPS) { // abri de bus + banc
      const fx = -Math.sin(s.look), fz = -Math.cos(s.look); // vers le fond du trottoir
      PROPS.shelter.push([s.mx + fx * 1.2, 0.15, s.mz + fz * 1.2, s.look, 0.8]);
      addCol({ x: s.mx + fx * 1.6, z: s.mz + fz * 1.6, r: 1.2 });
    }
    // bord de mer et désert : rochers, khaïmas, palmiers
    for (let k = 0; k < 40; k++) { const z = Z0 - 60 + rnd() * (Z1 - Z0 + 120); PROPS.rock.push([X0 - HW - 26 - rnd() * 6, 0, z, rnd() * 6.3, 0.8 + rnd() * 1.4]); }
    for (let k = 0; k < (LOW ? 8 : 18); k++) { const x = X0 + rnd() * (X1 - X0), side = rnd() < 0.5 ? -1 : 1, z = side < 0 ? Z0 - HW - 14 - rnd() * 30 : Z1 + HW + 14 + rnd() * 30; put(rnd() < 0.5 ? 'mrt_khaimaA' : 'mrt_khaimaB', x, z, rnd() * 6.3, 1, 0); addCol({ x, z, r: 5 }); }
    for (let k = 0; k < (LOW ? 20 : 60); k++) { const x = X1 + HW + 8 + rnd() * 40, z = Z0 + rnd() * (Z1 - Z0); PROPS.palm.push([x, 0, z, rnd() * 6.3, 0.8 + rnd() * 0.4]); }
  }
  function buildProps() {
    const mats4 = list => list.map(([x, y, z, r, s]) => new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromAxisAngle(_Y, r), _s.set(s, s, s)).clone());
    const opt = (o) => Object.assign({ parent: root, cull: CULL, cell: 440 }, o);
    const LAMP_M = [A.surf({ color: 0xeeeeea, roughness: 0.45, metalness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0.6 })]; A.nightReg(LAMP_M[1], 0.25, 2.2, 0xffd9a0);
    const fromLib = (name, list, o) => { if (!list.length) return; const src = lib.getObjectByName(name) || (A.ASSETS.city && A.ASSETS.city.getObjectByName(name)); if (!src) return; for (const b of bake(src)) A.addInstanced(b.geo, name === 'pr_lamp' ? LAMP_M[b.mat.emissive && b.mat.emissive.r > 0.5 ? 1 : 0] : texFix(lowMat(b.mat)), list.map(([x, y, z, r, s]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_Y, r), new THREE.Vector3(s, s, s))), null, opt(o)); };
    fromLib('pr_lamp', PROPS.lamp, { cast: !LITE, maxD: LITE ? 300 : 460, name: 'lamp' });
    fromLib('P_StreetLight', PROPS.slamp, { cast: !LITE, maxD: LITE ? 300 : 460, name: 'slamp' });
    fromLib('pr_tree', PROPS.tree, { cast: !LITE, maxD: LITE ? 320 : 520, name: 'tree' });
    fromLib('pr_skip', PROPS.skip, { cast: !LITE, maxD: 260, name: 'skip' });
    fromLib('pr_rock', PROPS.rock, { maxD: 420, name: 'rock' });
    fromLib('P_BusStop', PROPS.shelter, { cast: !LITE, maxD: 420, name: 'shelter' });
    const pm = mats4(PROPS.palm);
    A.addInstanced(A.PALM.trunk, A.PALM.trunkMat, pm, null, opt({ cast: !LITE, maxD: LITE ? 380 : 600, name: 'palmT' }));
    A.addInstanced(A.PALM.crown, A.PALM.crownMat, pm, pm.map(() => new THREE.Color().setHSL(0.27 + R() * 0.06, 0.45 + R() * 0.2, 0.62 + R() * 0.2)), opt({ cast: !LITE, maxD: LITE ? 420 : 650, name: 'palmC' }));
    // lueurs des lampadaires (nuit)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(LAMP_HEADS.flat(), 3));
    lampGlow = new THREE.Points(g, new THREE.PointsMaterial({ map: A.glowSpriteTex, color: 0xffd29a, size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    lampGlow.frustumCulled = false; root.add(lampGlow);
  }
  let lampGlow = null;
  /* --- feux : poteaux, boîtiers, lampes (une instance par lampe, couleur mise à jour) --- */
  const HEADS = []; let lampIM = null;
  const LCOL = { R: [lin(0xff2a1a), lin(0x2a0805)], Y: [lin(0xffb000), lin(0x2a1d02)], G: [lin(0x18ff6a), lin(0x032a10)] };
  function buildLights() {
    const poles = [], boxes = [], lamps = [];
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIRS[d]; if (!inGrid(i - dx, j - dz)) continue; // pas d'arrivée de ce côté
      const [rx, rz] = RIGHT[d];
      const px = nx(i) + dx * (HW + 1.1) + rx * (HW + 1.1), pz = nz(j) + dz * (HW + 1.1) + rz * (HW + 1.1); // coin opposé à droite
      const rot = HEAD(d) + Math.PI; // le boîtier regarde les voitures qui arrivent
      poles.push(new THREE.Matrix4().compose(_v.set(px, 0, pz), _q.setFromAxisAngle(_Y, rot), _s.set(1, 1, 1)).clone());
      const hx = px - rx * 1.6, hz = pz - rz * 1.6; // bras vers la chaussée
      boxes.push(new THREE.Matrix4().compose(_v.set(hx, 4.35, hz), _q.setFromAxisAngle(_Y, rot), _s.set(1, 1, 1)).clone());
      const h = { i, j, axis: d % 2, k: lamps.length / 3 * 0 + HEADS.length, x: px, z: pz };
      for (let L = 0; L < 3; L++) lamps.push(new THREE.Matrix4().compose(_v.set(hx - dx * 0.17, 4.75 - L * 0.4, hz - dz * 0.17), _q.setFromAxisAngle(_Y, rot), _s.set(1, 1, 1)).clone());
      HEADS.push(h); addCol({ x: px, z: pz, r: 0.3 });
    }
    const poleG = new THREE.CylinderGeometry(0.09, 0.11, 5, 6); poleG.translate(0, 2.5, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.7); arm.rotateY(Math.PI / 2); arm.translate(-0.85, 4.9, 0); // bras vers la chaussée (-x local = gauche du boîtier)
    const poleM = A.surf({ color: 0x2b2f33, roughness: 0.6, metalness: 0.4 });
    const pg = mergeGeos([poleG.toNonIndexed(), (() => { const a = arm.toNonIndexed(); a.translate(0, 0, 0); return a; })()].map(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }));
    // le bras doit pointer vers la chaussée : -droite = +x local après rotation (rot = HEAD(d)+π)
    pg.translate(0, 0, 0);
    A.addInstanced(pg, poleM, poles, null, { parent: root, cull: CULL, cell: 440, cast: !LITE, maxD: 420, name: 'tlPole' });
    const bx = new THREE.BoxGeometry(0.42, 1.3, 0.3);
    A.addInstanced(bx, A.surf({ color: 0x15171a, roughness: 0.7 }), boxes, null, { parent: root, cull: CULL, cell: 440, cast: !LITE, maxD: 420, name: 'tlBox' });
    const lg = new THREE.CircleGeometry(0.15, 12); // disque face à l'avant (+z local)
    lampIM = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ toneMapped: false }), lamps.length);
    lamps.forEach((m, k) => { lampIM.setMatrixAt(k, m); lampIM.setColorAt(k, LCOL.R[1]); });
    lampIM.frustumCulled = false; root.add(lampIM);
  }
  // corrige le bras des poteaux : il part vers l'intérieur du carrefour (côté gauche du boîtier)
  let lastLightUpd = -1;
  function updateLights() {
    if (REAL) return rUpdateLights();
    if (!lampIM) return;
    for (let h = 0; h < HEADS.length; h++) {
      const H = HEADS[h], s = light(H.i, H.j, H.axis).s;
      lampIM.setColorAt(h * 3, s === 'R' ? LCOL.R[0] : LCOL.R[1]);
      lampIM.setColorAt(h * 3 + 1, s === 'Y' ? LCOL.Y[0] : LCOL.Y[1]);
      lampIM.setColorAt(h * 3 + 2, s === 'G' ? LCOL.G[0] : LCOL.G[1]);
    }
    lampIM.instanceColor.needsUpdate = true;
  }
  function buildSignsAndNames() { // panneaux de rues aux carrefours importants + enseignes des boutiques
    const g = new THREE.Group();
    for (const k in CARREF) {
      const [i, j] = k.split(',').map(Number), x = nx(i) - HW - 2.4, z = nz(j) - HW - 2.4;
      const sg = new THREE.Group(); sg.position.set(x, 0, z); sg.rotation.y = Math.PI / 4;
      A.prim(sg, new THREE.CylinderGeometry(0.1, 0.1, 5.6, 8), A.poleMat, 0, 2.8, 0);
      const arT = GEO && GEO.carAr[k]; // panneaux bilingues comme en ville
      if (arT) A.signMesh(sg, A.textTex([{ t: CARREF[k].toUpperCase(), y: 0.32, size: 92 }, { t: arT, y: 0.74, size: 84, font: '700 SZpx Arial, Tahoma, sans-serif' }], { bg: '#0b6b3a', fg: '#ffffff', border: '#ffffff', w: 768, h: 230 }), 5, 1.5, 0, 4.9, 0.12, 0.9);
      else A.signMesh(sg, A.textTex([{ t: CARREF[k].toUpperCase(), y: 0.5, size: 120 }], { bg: '#0b6b3a', fg: '#ffffff', border: '#ffffff', w: 1024, h: 200 }), 5, 1, 0, 5, 0.12, 0.9);
      g.add(sg); addCol({ x, z, r: 0.3 });
    }
    root.add(g); A.mergeGroup(g);
    A.buildSigns(inst, seeded(99), root);
  }

  /* ======================= Véhicules ======================= */
  const CAR_TINTS = [0xf2f2f2, 0xc9ced6, 0x22252b, 0x8a1c1c, 0x1f3f7a, 0xd9c7a6, 0x6b7076, 0x2d6a4f, 0xb9a27c, 0x7a2e2e];
  const VT = { // uniquement des modèles détaillés
    civil: { node: 'tx_mondeo_civil', tint: CAR_TINTS, w: 5 },
    suv: { build: 'audi', tint: CAR_TINTS, w: 4 },
    taxi2: { node: 'tx_mondeo_taxi', w: 3.2 },
    police: { node: 'tx_mondeo_police', w: 0, police: true },
    amb: { node: 'tx_ambulance', w: 0.4, vmax: 13 },
    box: { node: 'tx_truck_box', w: 1.3, vmax: 10.5 }, cist: { node: 'tx_truck_cistern', w: 1.1, vmax: 10 }, flat: { node: 'tx_truck_flat', w: 1.3, vmax: 10.5 },
    cart: { cart: true, w: 0, vmax: 3.6 },
  };
  function buildVehicleTypes() {
    for (const k in VT) {
      const t = VT[k]; let parts = null;
      if (t.node) { const src = lib.getObjectByName(t.node); if (src) parts = bake(src); }
      else if (t.build && A.buildCar) { const mdl = A.buildCar(t.build, 'lo', 0xffffff, 0xd8dde3, false, true); parts = bake(mdl.root); t.tintMat = mdl.paint; }
      else if (t.cart) parts = cartParts();
      if (!parts) { delete VT[k]; continue; }
      const bb = new THREE.Box3(); for (const p of parts) bb.union(p.geo.boundingBox);
      t.hl = Math.max(-bb.min.z, bb.max.z); t.hw = Math.max(-bb.min.x, bb.max.x) * 0.92; t.ht = bb.max.y; t.parts = parts;
      if (t.cart) t.hl = 2.75; // l'âne marche devant la charrette
    }
  }
  function cartParts() { // charrette (l'âne qui la tire est un animal animé, dessiné à part)
    const wood = A.surf({ color: 0x8a5a2b, roughness: 0.9 }), gs = [];
    const add = (g, x, y, z) => { g = g.toNonIndexed(); g.translate(x, y, z); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); gs.push(g); };
    add(new THREE.BoxGeometry(1.5, 0.12, 2.0), 0, 0.85, -0.9); add(new THREE.BoxGeometry(1.5, 0.35, 0.08), 0, 1.05, -1.9); add(new THREE.BoxGeometry(0.08, 0.35, 2.0), 0.72, 1.05, -0.9); add(new THREE.BoxGeometry(0.08, 0.35, 2.0), -0.72, 1.05, -0.9);
    add(new THREE.BoxGeometry(1.2, 0.5, 0.9), 0, 1.15, -1.2); // chargement : sacs, bidons
    for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16); w.rotateZ(Math.PI / 2); add(w, s * 0.85, 0.5, -0.9); const hb = new THREE.CylinderGeometry(0.11, 0.11, 0.2, 10); hb.rotateZ(Math.PI / 2); add(hb, s * 0.85, 0.5, -0.9); add(new THREE.BoxGeometry(0.07, 0.07, 2.5), s * 0.42, 0.92, 1.2); } // brancards jusqu'aux flancs de l'âne
    add(new THREE.BoxGeometry(1.3, 0.1, 0.3), 0, 1.12, 0.0); // siège du charretier
    return [{ geo: mergeGeos(gs), mat: wood }];
  }
  const VIM = {}; // InstancedMesh par type
  function buildVehicleMeshes(counts) {
    for (const k in VT) {
      const t = VT[k], n = counts[k] || 0; if (!n || !t.parts) continue;
      t.ims = t.parts.map(p => { const m = new THREE.InstancedMesh(p.geo, texFix(lowMat(p.mat)), n); m.frustumCulled = false; m.castShadow = !LITE; m.receiveShadow = false; for (let q = 0; q < n; q++) m.setMatrixAt(q, ZERO); if (t.tint && (!t.tintMat || p.mat === t.tintMat)) { m.userData.tinted = true; for (let q = 0; q < n; q++) m.setColorAt(q, lin(t.tint[q % t.tint.length])); } root.add(m); return m; });
      t.free = [...Array(n).keys()];
    }
  }
  function disposeVehicleMeshes() { for (const k in VT) { const t = VT[k]; if (t.ims) for (const m of t.ims) { root.remove(m); m.dispose(); } t.ims = null; } }

  /* ======================= Trafic (IA sur le réseau de voies) ======================= */
  let cars = [];
  function bezierPts(x0, z0, x1, z1, x2, z2, n) { const pts = []; for (let k = 0; k <= n; k++) { const t = k / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; pts.push(a * x0 + b * x1 + c * x2, a * z0 + b * z1 + c * z2); } return pts; }
  function setPath(c, pts) { c.pts = pts; c.cum = [0]; for (let k = 2; k < pts.length; k += 2) c.cum.push(c.cum[c.cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1])); c.len = c.cum[c.cum.length - 1]; }
  function pathAt(c, s) {
    const cum = c.cum, pts = c.pts; let k = 1; while (k < cum.length - 1 && cum[k] < s) k++;
    const t = clamp((s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1), 0, 1), ax = pts[(k - 1) * 2], az = pts[(k - 1) * 2 + 1], bx = pts[k * 2], bz = pts[k * 2 + 1];
    return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az)];
  }
  function edgePath(c) { // tronçon (i,j) → voisin dans la direction d, voie l
    const [dx, dz] = DIRS[c.d], [rx, rz] = RIGHT[c.d], o = LANE[c.lane];
    const ax = nx(c.i) + dx * HW + rx * o, az = nz(c.j) + dz * HW + rz * o;
    setPath(c, [ax, az, ax + dx * EL, az + dz * EL]); c.piece = 'edge';
  }
  function chooseNext(c) { // au bout du tronçon : tout droit, à droite (voie extérieure) ou à gauche (voie intérieure)
    const bi = c.i + DIRS[c.d][0], bj = c.j + DIRS[c.d][1], opts = [];
    const ok = d2 => inGrid(bi + DIRS[d2][0], bj + DIRS[d2][1]);
    const st = c.d, rt = (c.d + 1) % 4, lt = (c.d + 3) % 4;
    if (ok(st)) opts.push([st, c.lane], [st, c.lane]);
    if (c.lane === 1 && ok(rt)) opts.push([rt, 1]);
    if (c.lane === 0 && ok(lt) && !c.cart) opts.push([lt, 0]);
    if (!opts.length) { if (ok(rt)) opts.push([rt, 1]); else if (ok(lt)) opts.push([lt, 0]); else opts.push([(c.d + 2) % 4, 1]); }
    const [d2, l2] = pick(opts); c.nd = d2; c.nl = l2; c.turn = d2 === st ? 0 : d2 === rt ? 1 : d2 === lt ? -1 : 2;
  }
  function turnPath(c) {
    const bi = c.i + DIRS[c.d][0], bj = c.j + DIRS[c.d][1], bx = nx(bi), bz = nz(bj);
    const [dx, dz] = DIRS[c.d], [rx, rz] = RIGHT[c.d], o = LANE[c.lane];
    const [ex, ez] = DIRS[c.nd], [sx, sz] = RIGHT[c.nd], o2 = LANE[c.nl];
    const p0x = bx - dx * HW + rx * o, p0z = bz - dz * HW + rz * o, p2x = bx + ex * HW + sx * o2, p2z = bz + ez * HW + sz * o2;
    let p1x, p1z;
    if (c.turn === 0) { p1x = (p0x + p2x) / 2; p1z = (p0z + p2z) / 2; }
    else if (c.turn === 2) { p1x = bx + dx * 4; p1z = bz + dz * 4; }
    else { const t = (p2x - p0x) * dx + (p2z - p0z) * dz; p1x = p0x + dx * t; p1z = p0z + dz * t; }
    setPath(c, bezierPts(p0x, p0z, p1x, p1z, p2x, p2z, c.turn === 0 ? 1 : 8)); c.piece = 'turn'; c.bi = bi; c.bj = bj;
  }
  function spawnCar(type, i, j, d, lane, s) {
    const t = VT[type]; if (!t || !t.free || !t.free.length) return null;
    const hex = t.tint ? pick(t.tint) : null, c = { type, t, slot: t.free.pop(), hex, col: hex !== null ? lin(hex) : null, i, j, d, lane, s: s || 0, v: 6, vmax: (t.vmax || 12.5) + R() * 2, hl: t.hl, hw: t.hw, x: 0, z: 0, h: HEAD(d), vx: 0, vz: 0, police: !!t.police, cart: !!t.cart, bump: 0, honkT: 0, stuck: 0, ghost: 0, id: cars.length, gap: 99, wait: 0 };
    if (c.cart) c.lane = 1;
    edgePath(c); chooseNext(c); const p = pathAt(c, c.s); c.x = p[0]; c.z = p[1]; c.h = p[2];
    if (taxi && Math.hypot(c.x - taxi.x, c.z - taxi.z) < 28) { t.free.push(c.slot); return null; }
    cars.push(c); return c;
  }
  function freeCar(c) { c.t.free.push(c.slot); }
  // grille spatiale des objets mobiles (voitures, piétons sur la chaussée, joueur)
  const DYN = new Map(), DCELL = 20;
  const dkey = (x, z) => Math.floor(x / DCELL) * 4096 + Math.floor(z / DCELL);
  function dynAdd(o) { const k = dkey(o.x, o.z); let l = DYN.get(k); if (!l) { l = []; DYN.set(k, l); } l.push(o); }
  function rebuildDyn() {
    for (const l of DYN.values()) l.length = 0;
    for (const c of cars) if (!c.chase) dynAdd(c);
    for (const p of peds) if (p.on && (p.road || p.st === 'board' || p.st === 'alight')) dynAdd(p);
    if (taxi) dynAdd(taxi);
    for (const v of parked) dynAdd(v.car);
    if (foot.on) dynAdd(foot);
    for (const pc of chasers) dynAdd(pc.car);
    if (amb.car) dynAdd(amb.car);
  }
  function obstacleGap(c, fx, fz) { // distance libre devant une voiture IA
    let best = 99; const cx = Math.floor(c.x / DCELL), cz = Math.floor(c.z / DCELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = DYN.get((cx + a) * 4096 + cz + b); if (!l) continue;
      for (const o of l) {
        if (o === c) continue;
        const rx = o.x - c.x, rz = o.z - c.z, f = rx * fx + rz * fz; if (f <= 0 || f > 32) continue;
        const lat = Math.abs(rx * fz - rz * fx), ow = o.hw !== undefined ? o.hw : 0.45, ol = o.hl !== undefined ? o.hl : 0.4;
        if (lat > c.hw + ow + 0.35) continue;
        if (c.ghost > 0 && o.hl !== undefined && o !== taxi) continue;
        const g = f - c.hl - ol; if (g < best) { best = g; c.blocker = o; }
      }
    }
    return best;
  }
  function oncomingBusy(c) { // tourne-à-gauche : céder le passage aux voitures d'en face
    const bi = c.i + DIRS[c.d][0], bj = c.j + DIRS[c.d][1], od = (c.d + 2) % 4;
    for (const o of cars) {
      if (o === c || o.chase) continue;
      if (o.piece === 'edge' && o.d === od && o.i + DIRS[od][0] === bi && o.j + DIRS[od][1] === bj && o.s > o.len - 30 && o.turn !== -1) return true;
      if (o.piece === 'turn' && o.bi === bi && o.bj === bj && o.d === od && o.turn === 0) return true;
    }
    return false;
  }
  function updateCars(dt) {
    for (const c of cars) {
      if (c.chase) continue;
      if (c.bump > 0) { c.bump -= dt; c.v = Math.max(0, c.v - 12 * dt); if (c.honkT <= 0 && c.bump > 1.2) { honk(c.x, c.z, 0.8); c.honkT = 3; } }
      c.honkT -= dt; if (c.ghost > 0) c.ghost -= dt;
      const fx = Math.sin(c.h), fz = Math.cos(c.h);
      c.blocker = null;
      let gap = obstacleGap(c, fx, fz), limit = c.vmax, stopByLight = false;
      if (c.piece === 'edge') {
        const stopS = c.len - STOP_GAP - c.hl, toStop = stopS - c.s;
        if (REAL) { // carte réelle : feux OSM, priorité aux grands axes
          const toS = c.len - c.hl - 1 - c.s; limit = Math.min(c.vlim, c.vmax * c.vlim / 12);
          if (toS > -0.5 && toS < 70) {
            let must = false;
            if (RD.sig[c.endN]) { const L = rLight(c.endN, c.axis); must = L.s === 'R' || (L.s === 'Y' && toS > c.v * c.v / 7 + 1); }
            else if (c.yield && toS < 14 && lightT - RD.busy[c.endN] < 0.5) { c.wait += dt; must = c.wait < 9; }
            if (must) { gap = Math.min(gap, toS); stopByLight = true; }
          }
        } else if (toStop > -0.5) {
          const L = light(c.i + DIRS[c.d][0], c.j + DIRS[c.d][1], c.d % 2);
          let mustStop = L.s === 'R' || (L.s === 'Y' && toStop > c.v * c.v / 7 + 1);
          if (!mustStop && c.turn === -1 && L.s === 'G' && toStop < 12 && oncomingBusy(c)) { c.wait += dt; mustStop = c.wait < 7; }
          if (mustStop) { gap = Math.min(gap, toStop); stopByLight = true; }
        }
        if (c.turn !== 0) limit = Math.min(limit, 6 + Math.max(0, c.len - c.s - 10) * 0.35);
      } else if (c.turn) limit = Math.min(limit, c.turn === 1 ? 5.2 : 6.8);
      if (c.police && policeAlert && !c.chase) limit *= 1.2;
      let want = gap < 1.2 ? 0 : Math.min(limit, Math.sqrt(Math.max(0, 2 * 4.2 * (gap - 1.2))));
      if (c.bump > 0) want = 0;
      c.v += clamp(want - c.v, -9 * dt, 2.6 * dt); if (c.v < 0) c.v = 0;
      // embouteillage : klaxon, et on finit par passer
      if (c.v < 0.2 && !stopByLight && c.blocker && (c.blocker.kind || c.blocker.parked) && c.piece === 'edge' && c.stuck > 2.5 && !c.cart && c.s < c.len - 18) { if (REAL) rLaneSwap(c); else { c.lane = 1 - c.lane; const s0 = c.s; edgePath(c); c.s = s0; chooseNext(c); } c.stuck = 0; honk(c.x, c.z, 0.7); } // contourner
      if (c.v < 0.2 && !stopByLight && c.blocker) { c.stuck += dt; if ((c.blocker === taxi || c.blocker.kind) && c.honkT <= 0 && c.stuck > 1.8) { honk(c.x, c.z, 1); c.honkT = 2.5 + R() * 2; } if (c.stuck > 6 && (c.blocker !== taxi || taxi.parked)) { c.ghost = 2.5; c.stuck = 0; } } else c.stuck = 0;
      c.s += c.v * dt;
      if (c.s >= c.len) {
        const over = c.s - c.len;
        if (c.piece === 'edge') { if (REAL) rTurnPath(c); else turnPath(c); c.s = over; c.wait = 0; }
        else if (REAL) { rEnterNext(c); c.s = over; }
        else { c.i = c.bi; c.j = c.bj; c.d = c.nd; c.lane = c.nl; edgePath(c); chooseNext(c); c.s = over; }
      }
      if (REAL && c.piece === 'turn') RD.busy[c.tn] = lightT;
      if (c.pvx || c.pvz || c.spin) { c.ox = (c.ox || 0) + c.pvx * dt; c.oz = (c.oz || 0) + c.pvz * dt; c.oh = (c.oh || 0) + c.spin * dt; const k = Math.exp(-dt * 2.4); c.pvx *= k; c.pvz *= k; c.spin *= Math.exp(-dt * 2); if (Math.abs(c.pvx) + Math.abs(c.pvz) + Math.abs(c.spin) < 0.03) c.pvx = c.pvz = c.spin = 0; }
      if (c.bump <= 0 && (c.ox || c.oz || c.oh)) { const k = Math.exp(-dt * 1.1); c.ox *= k; c.oz *= k; c.oh *= k; if (Math.abs(c.ox) + Math.abs(c.oz) + Math.abs(c.oh) < 0.02) c.ox = c.oz = c.oh = 0; }
      if (c.smoke > 0) { c.smoke -= dt; c.smA = (c.smA || 0) + dt * 6; if (c.smA > 1) { c.smA = 0; A.spawnSmoke(c.x + Math.sin(c.h) * c.hl * 0.7, c.z + Math.cos(c.h) * c.hl * 0.7, 0, 0, 0.35, true, 0.9); } }
      const p = pathAt(c, c.s), ph = c.h; c.x = p[0] + (c.ox || 0); c.z = p[1] + (c.oz || 0); c.h = ph + wrapAng(p[2] + (c.oh || 0) - ph) * Math.min(1, dt * 10);
      c.vx = Math.sin(c.h) * c.v; c.vz = Math.cos(c.h) * c.v;
    }
  }
  function drawCars() {
    const cp = A.camera.position, far = LITE ? 300 : 480;
    for (const k in VT) VT[k].n = 0;
    for (const c of cars) {
      const t = c.t; if (!t.ims || c.chase) continue;
      if (Math.abs(c.x - cp.x) + Math.abs(c.z - cp.z) > far) continue;
      _m.compose(_v.set(c.x, c.y || 0, c.z), _q.setFromAxisAngle(_Y, c.h), _s.set(1, 1, 1));
      const q = t.n++;
      for (const m of t.ims) { m.setMatrixAt(q, _m); if (m.userData.tinted) m.setColorAt(q, c.col); }
    }
    for (const k in VT) { const t = VT[k]; if (!t.ims) continue; for (const m of t.ims) { m.count = t.n; m.visible = t.n > 0; m.instanceMatrix.needsUpdate = true; if (t.tint && m.instanceColor) m.instanceColor.needsUpdate = true; } }
  }
  function populateTraffic() {
    for (const c of cars) freeCar(c); cars = [];
    const n = LOW ? 22 : LITE ? 38 : 54, types = [];
    for (const k in VT) if (VT[k].ims && !VT[k].police && !VT[k].cart) for (let q = 0; q < Math.round(VT[k].w * 4); q++) types.push(k);
    const tries = { v: 0 };
    const occ = (i, j, d, lane, s) => cars.some(o => o.i === i && o.j === j && o.d === d && o.lane === lane && Math.abs(o.s - s) < 12);
    const place = (type, laneOnly) => { for (let k = 0; k < 40; k++) { const i = Math.floor(R() * NI), j = Math.floor(R() * NJ), d = Math.floor(R() * 4); if (!inGrid(i + DIRS[d][0], j + DIRS[d][1])) continue; const lane = laneOnly !== undefined ? laneOnly : R() < 0.5 ? 0 : 1, s = 4 + R() * (EL - 30); if (occ(i, j, d, lane, s)) continue; if (taxi && Math.hypot(nx(i) - taxi.x, nz(j) - taxi.z) < 30) continue; return spawnCar(type, i, j, d, lane, s); } return null; };
    for (let k = 0; k < (LOW ? 2 : 3); k++) place('police');
    for (let k = 0; k < (LOW ? 2 : 4); k++) place('cart', 1);
    const dense = [0.65, 1, 1.35][T.traffic];
    for (let k = 0; k < Math.round(n * dense); k++) place(pick(types));
  }

  /* ======================= Piétons, clients, animaux : vrais cycles de marche (animés sur le GPU) ======================= */
  let peds = [], WM = {}, walkLib = null;
  const PED_N = LOW ? 34 : LITE ? 64 : 96, CLIENT_N = 8;
  const HUMANS = ['wk_ped0', 'wk_ped1', 'wk_ped2', 'wk_ped3', 'wk_ped4', 'wk_ped5', 'wk_ped6', 'wk_ped7', 'wk_ped8', 'wk_ped9', 'wk_ba', 'wk_survie'];
  const ANI = { wk_goat: { spd: 0.7, hl: 0.55, hw: 0.25, stride: 1.05, tint: [0xf4f1ea, 0x2b2622, 0x8a5a33, 0xd9cbb2] }, wk_donkey: { spd: 0.8, hl: 0.9, hw: 0.3, stride: 1.55 }, wk_dog: { spd: 1.1, hl: 0.45, hw: 0.2, stride: 0.95, tint: [0xd8c3a0, 0x3a2e24, 0xf0f0f0] }, wk_chicken: { spd: 0.5, hl: 0.18, hw: 0.12, stride: 0.34 }, wk_cat: { spd: 0.65, hl: 0.25, hw: 0.1, stride: 0.55 } };
  const TINTS = [0xc0392b, 0x1f6fb2, 0x2e8b57, 0xf2c14e, 0x8e44ad, 0xf2f2f2, 0x1b1b1b, 0x16a085, 0xd35400, 0x34495e, 0x7f8c8d, 0xe84393];
  const VAT_OK = A.renderer.capabilities.isWebGL2 || !!A.renderer.extensions.get('OES_texture_float');
  const VAT_V = 'uniform sampler2D vatTex; uniform vec3 vatInfo; uniform float walkN;\nattribute float vid; attribute vec2 iAnim; attribute vec4 iTint; varying vec4 vTint;\nvec3 vatAt(float f) { float i = f * vatInfo.y * vatInfo.x + vid; float y = floor(i / vatInfo.x); float x = i - y * vatInfo.x; return texture2D(vatTex, vec2((x + 0.5) / vatInfo.x, (y + 0.5) / vatInfo.z)).xyz; }\n';
  const VAT_B = '#include <begin_vertex>\nvTint = iTint;\n' + (VAT_OK ? 'float ph = fract(iAnim.x) * walkN; float f0 = floor(ph); float f1 = mod(f0 + 1.0, walkN);\ntransformed = mix(vatAt(f0), vatAt(f1), ph - f0);\ntransformed = mix(transformed, vatAt(walkN), clamp(iAnim.y, 0.0, 1.0));\n' : '');
  const VAT_F = '#include <map_fragment>\n{ vec3 c = diffuseColor.rgb; float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)); float sat = (mx - mn) / (mx + 1e-4);\nfloat skin = step(c.b, c.g) * step(c.g, c.r) * smoothstep(0.12, 0.22, sat) * (1.0 - smoothstep(0.72, 0.85, sat)) * step(0.05, c.r - c.b);\nfloat lum = dot(c, vec3(0.3, 0.55, 0.15)); float cl = (1.0 - skin) * smoothstep(0.03, 0.1, lum);\ndiffuseColor.rgb = mix(c, lum * vTint.rgb * 2.1, cl * vTint.a); }\n';
  function vatModel(name, cap) {
    const src = walkLib && walkLib.getObjectByName(name); if (!src) return null;
    let mesh = null; src.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
    src.updateMatrixWorld(true);
    const mm = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(src.matrixWorld).invert(), mesh.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(mm);
    const g0 = mesh.geometry, P = g0.attributes.position, N = g0.attributes.normal, U = g0.attributes.uv, MT = g0.morphAttributes.position || [];
    const nV = P.count, F = Math.max(1, MT.length), rel = g0.morphTargetsRelative !== false;
    const W = Math.min(nV, 1024), rows = Math.ceil(nV / W), H = rows * F, data = new Float32Array(W * H * 4), w = new THREE.Vector3(), d = new THREE.Vector3();
    const getV = (A_, i) => A_.normalized ? w.set(A_.getX(i) / 32767, A_.getY(i) / 32767, A_.getZ(i) / 32767) : w.fromBufferAttribute(A_, i);
    for (let f = 0; f < F; f++) for (let v = 0; v < nV; v++) {
      w.fromBufferAttribute(P, v);
      if (MT[f]) { d.fromBufferAttribute(MT[f], v); if (rel) w.add(d); else w.copy(d); }
      w.applyMatrix4(mm); const o = (f * rows * W + v) * 4; data[o] = w.x; data[o + 1] = w.y; data[o + 2] = w.z; data[o + 3] = 1;
    }
    void getV;
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    const g = new THREE.BufferGeometry(), pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), vid = new Float32Array(nV), idle = F - 1;
    for (let v = 0; v < nV; v++) {
      const o = (idle * rows * W + v) * 4; pos[v * 3] = data[o]; pos[v * 3 + 1] = data[o + 1]; pos[v * 3 + 2] = data[o + 2];
      if (N) { w.fromBufferAttribute(N, v).applyMatrix3(nm).normalize(); nor[v * 3] = w.x; nor[v * 3 + 1] = w.y; nor[v * 3 + 2] = w.z; }
      if (U) { uv[v * 2] = U.getX(v); uv[v * 2 + 1] = U.getY(v); } vid[v] = v;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('vid', new THREE.BufferAttribute(vid, 1));
    if (g0.index) g.setIndex(g0.index); if (!N) g.computeVertexNormals(); g.computeBoundingSphere();
    const iAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2), iTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    iAnim.setUsage(THREE.DynamicDrawUsage); iTint.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iAnim', iAnim); g.setAttribute('iTint', iTint);
    const mat = texFix(LOW ? lowMat(mesh.material) : mesh.material.clone());
    if (!LOW) { mat.roughness = 0.85; mat.metalness = 0; mat.envMapIntensity = 0.35; }
    mat.morphTargets = false; mat.morphNormals = false; mat.skinning = false; mat.vertexColors = false; // la VAT remplace les morphs (sinon trop d'attributs)
    mat.onBeforeCompile = sh => {
      sh.uniforms.vatTex = { value: tex }; sh.uniforms.vatInfo = { value: new THREE.Vector3(W, rows, H) }; sh.uniforms.walkN = { value: F - 1 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VAT_V).replace('#include <begin_vertex>', VAT_B);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vTint;').replace('#include <map_fragment>', VAT_F);
    };
    mat.customProgramCacheKey = () => 'dzvat' + (VAT_OK ? 1 : 0);
    const im = new THREE.InstancedMesh(g, mat, cap); im.frustumCulled = false; im.castShadow = false; im.count = 0; root.add(im);
    return { im, iAnim, iTint, name, F, n: 0, cap, used: 0, stride: (ANI[name] && ANI[name].stride) || 1.35 };
  }
  function buildPedMeshes() {
    WM = {};
    const capH = Math.ceil((PED_N + CLIENT_N) / HUMANS.length) + 6 + (LOW ? 8 : LITE ? 16 : 26); // + le chauffeur à pied, les conducteurs qui s'enfuient et les marchands des étals
    for (const n of HUMANS) { const m = vatModel(n, capH); if (m) WM[n] = m; }
    const capA = { wk_goat: LOW ? 10 : 24, wk_donkey: 14, wk_dog: 8, wk_chicken: 12, wk_cat: 5 };
    for (const n in ANI) { const m = vatModel(n, capA[n]); if (m) WM[n] = m; }
  }
  const loopPos = (bi, bj, p, lat) => { // position sur le trottoir (tour de l'îlot)
    const [cx, cz] = blockC(bi, bj), L = 2 * HS, per = 4 * L; p = ((p % per) + per) % per;
    const k = Math.floor(p / L), t = p - k * L - HS, h = HS + lat;
    if (k === 0) return [cx + t, cz - h, 0]; if (k === 1) return [cx + h, cz + t, 1]; if (k === 2) return [cx - t, cz + h, 2]; return [cx - h, cz - t, 3];
  };
  const CORNER = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; // NO, NE, SE, SO
  const tintOf = (hex, a) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b, a]; };
  function newPed(kind, model) {
    const M = WM[model]; if (!M || M.used >= M.cap) return null; M.used++;
    const an = ANI[model];
    const p = { kind, M, on: true, st: 'walk', bi: 0, bj: 0, p: 0, dir: R() < 0.5 ? 1 : -1, lat: (R() - 0.5) * 2.2, spd: an ? an.spd * (0.85 + R() * 0.3) : 1.05 + R() * 0.45, x: 0, z: 0, h: 0, ph: R(), t: 0, road: false, hw: an ? an.hw : 0.35, hl: an ? an.hl : 0.35, fall: 0, wait: 0, idle: 0, curV: 0,
      tint: an ? (an.tint ? tintOf(pick(an.tint), 0.85) : [1, 1, 1, 0]) : (R() < 0.6 ? tintOf(pick(TINTS), 0.78) : [1, 1, 1, 0]) };
    peds.push(p); return p;
  }
  function placeWalker(p, near) {
    p.overRoad = undefined;
    if (REAL) return rPlaceWalker(p, near);
    for (let k = 0; k < 30; k++) { p.bi = Math.floor(R() * (NI - 1)); p.bj = Math.floor(R() * (NJ - 1)); const [bx, bz] = blockC(p.bi, p.bj); if (!taxi || (Math.hypot(bx - taxi.x, bz - taxi.z) > 40 && (!near || Math.hypot(bx - taxi.x, bz - taxi.z) < 300))) break; }
    p.p = R() * 8 * HS; p.st = 'walk'; p.road = false; p.fall = 0; p.down = false; p.leader = null;
    const q = loopPos(p.bi, p.bj, p.p, p.lat); p.x = q[0]; p.z = q[1];
  }
  function populatePeds() {
    for (const k in WM) WM[k].used = 0;
    peds = [];
    for (let k = 0; k < PED_N; k++) { const p = newPed('ped', HUMANS[k % HUMANS.length]); if (p) placeWalker(p); }
    // troupeaux de chèvres, ânes, chiens, poules, chats : sur les trottoirs… et sur le goudron
    const herds = LOW ? 2 : 4;
    for (let h = 0; h < herds; h++) { const lead = newPed('animal', 'wk_goat'); if (!lead) break; placeWalker(lead); lead.lat = 1.2; const n = 2 + Math.floor(R() * 3); for (let k = 1; k <= n; k++) { const g = newPed('animal', 'wk_goat'); if (!g) break; g.leader = lead; g.hk = k; g.side = (k % 2 ? 1 : -1) * (0.4 + R() * 0.5); g.st = 'walk'; } }
    for (let k = 0; k < (LOW ? 2 : 4); k++) { const p = newPed('animal', 'wk_donkey'); if (p) { placeWalker(p); p.lat = 1.3; } }
    for (let k = 0; k < (LOW ? 2 : 5); k++) { const p = newPed('animal', 'wk_dog'); if (p) { placeWalker(p); p.lat = 1 + R(); } }
    for (let gq = 0; gq < (LOW ? 1 : 2); gq++) { const lead = newPed('animal', 'wk_chicken'); if (!lead) break; placeWalker(lead); lead.lat = 1.4; for (let k = 1; k <= 3; k++) { const c = newPed('animal', 'wk_chicken'); if (!c) break; c.leader = lead; c.hk = k * 0.45; c.side = (R() - 0.5) * 1.2; } }
    for (let k = 0; k < (LOW ? 1 : 3); k++) { const p = newPed('animal', 'wk_cat'); if (p) { placeWalker(p); p.lat = 1.6; } }
    for (let k = 0; k < CLIENT_N; k++) { const p = newPed('ped', HUMANS[(k * 5 + 2) % HUMANS.length]); if (p) { p.on = false; p.st = 'off'; p.client = true; } }
  }
  function startCross(p, fromCorner, alongX) { // traverser au passage piéton depuis le coin de l'îlot
    const [sx, sz] = CORNER[fromCorner], [cx, cz] = blockC(p.bi, p.bj);
    const ax = cx + sx * (HS + 0.3), az = cz + sz * (HS + 0.3);
    let nbi = p.bi, nbj = p.bj, tc;
    if (alongX) { nbi += sx; tc = [1, 0, 3, 2][fromCorner]; } else { nbj += sz; tc = [3, 2, 1, 0][fromCorner]; }
    if (!inBlocks(nbi, nbj)) return false;
    const [ncx, ncz] = blockC(nbi, nbj), [tx, tz] = CORNER[tc];
    p.cx0 = ax; p.cz0 = az; p.cx1 = ncx + tx * (HS + 0.3); p.cz1 = ncz + tz * (HS + 0.3);
    p.ni = clamp(Math.round(((ax + p.cx1) / 2 - X0) / P), 0, NI - 1); p.nj = clamp(Math.round(((az + p.cz1) / 2 - Z0) / P), 0, NJ - 1);
    p.axis = alongX ? 1 : 0; // traverser la route N-S (le long de x) = couper l'axe N-S
    p.nbi = nbi; p.nbj = nbj; p.np = tc * 2 * HS; p.st = 'cwait'; p.wait = 0; p.x = ax; p.z = az;
    return true;
  }
  function startJay(p) { // traverser n'importe où, sans regarder (les animaux s'arrêtent parfois au milieu)
    const q = loopPos(p.bi, p.bj, p.p, p.lat), side = q[2], [fx, fz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
    const nbi = p.bi + fx, nbj = p.bj + fz; if (!inBlocks(nbi, nbj)) return false;
    p.cx0 = q[0]; p.cz0 = q[1]; p.cx1 = q[0] + fx * (RW + 4.4); p.cz1 = q[1] + fz * (RW + 4.4);
    p.nbi = nbi; p.nbj = nbj;
    const [ncx, ncz] = blockC(nbi, nbj);
    const opp = (side + 2) % 4, along = opp === 0 ? p.cx1 - ncx : opp === 1 ? p.cz1 - ncz : opp === 2 ? -(p.cx1 - ncx) : -(p.cz1 - ncz);
    p.np = opp * 2 * HS + along + HS; p.st = 'cross'; p.t = 0; p.jay = true; p.spd2 = p.kind === 'animal' ? p.spd * 1.1 : 1.8 + R() * 0.8;
    p.pauseAt = p.kind === 'animal' && R() < 0.75 ? 0.25 + R() * 0.5 : 2; p.pauseT = 0;
    return true;
  }
  function updatePeds(dt) {
    for (const p of peds) {
      if (!p.on) { if (p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) { p.on = true; p.down = false; if (p.client) { p.on = false; p.st = 'off'; } else placeWalker(p); } } continue; }
      let v = 0;
      if (p.down) { // blessé : il reste au sol jusqu'à l'ambulance (un animal finit par se relever)
        p.downT = (p.downT || 0) + dt; p.idle = 1;
        if (p.kind === 'animal' && p.downT > 14) { p.down = false; p.fall = 0; p.road = false; placeWalker(p); }
        continue;
      }
      if (p.fall > 0) { p.fall -= dt; continue; }
      if (p.run > 0) p.run -= dt;
      if (p.leader) { // troupeau : on suit le chef
        const L = p.leader;
        if (!L.on || L.down) { p.leader = null; placeWalker(p); continue; }
        const fx = Math.sin(L.h), fz = Math.cos(L.h); let tx = L.x - fx * (0.9 * p.hk) + fz * p.side, tz = L.z - fz * (0.9 * p.hk) - fx * p.side;
        if (REAL && L.st === 'walk' && (p.chk = (p.chk || 0) + 1) % 8 === 0 && rAsphalt(tx, tz, -1, 0.2)) p.side = -p.side; // la bête de côté passerait sur le goudron : l'autre côté du chef
        const dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz);
        if (dd > 25) { p.x = tx; p.z = tz; } else if (dd > 0.08) { const st = Math.min(dd, (L.curV + 0.6 + dd * 0.8) * dt); p.x += dx / dd * st; p.z += dz / dd * st; v = st / dt; p.h = p.h + wrapAng(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 5); }
        p.road = L.road; p.curV = v; p.ph += v * dt / p.M.stride; p.idle += ((v > 0.15 ? 0 : 1) - p.idle) * Math.min(1, dt * 6); p.st = L.st === 'cross' || L.st === 'flee' ? 'cross' : 'walk';
        continue;
      }
      if (p.st === 'walk') {
        const pausing = p.kind === 'animal' && Math.sin(p.t2 = (p.t2 || R() * 50) + dt * 0.21) > 0.55;
        const sp = p.spd * (p.run > 0 ? 2.4 : 1) * (pausing ? 0 : 1); v = sp;
        if (REAL) rWalk(p, dt, sp); else {
        const before = Math.floor(p.p / (2 * HS));
        p.p += p.dir * sp * dt;
        const after = Math.floor(p.p / (2 * HS));
        const q = loopPos(p.bi, p.bj, p.p, p.lat); p.x = q[0]; p.z = q[1]; p.h = Math.atan2(...dirOfSide(q[2], p.dir));
        if (before !== after) { // coin atteint
          const corner = ((p.dir > 0 ? after : before) % 4 + 4) % 4;
          if (p.kind === 'ped' && R() < 0.42) startCross(p, corner, R() < 0.5);
        } else if (R() < dt * (p.kind === 'animal' ? 0.03 : 0.0045) && Math.abs(((p.p % (2 * HS)) + 2 * HS) % (2 * HS) - HS) < HS - 14) startJay(p);
        }
      } else if (p.st === 'cwait') {
        const L = light(p.ni, p.nj, p.axis); p.wait += dt; p.h = Math.atan2(p.cx1 - p.cx0, p.cz1 - p.cz0);
        if ((L.s === 'R' && L.toG > 8) || p.wait > 40) { p.st = 'cross'; p.t = 0; p.jay = false; p.spd2 = p.spd * 1.1; }
      } else if (p.st === 'cross' || p.st === 'flee') {
        const L = Math.hypot(p.cx1 - p.cx0, p.cz1 - p.cz0) || 1;
        if (p.st === 'cross' && p.pauseAt < 1 && p.t > p.pauseAt && p.pauseT === 0) p.pauseT = 4 + R() * 9; // l'animal se plante sur la route
        if (p.pauseT > 0 && p.st === 'cross') { p.pauseT -= dt; if (p.pauseT <= 0) { p.pauseT = -1; } }
        else { v = p.st === 'flee' ? (p.kind === 'animal' ? 2.6 : 4.2) : p.spd2 * (p.run > 0 ? 2 : 1); p.t += v * dt / L; }
        const t = clamp(p.t, 0, 1); p.x = p.cx0 + (p.cx1 - p.cx0) * t; p.z = p.cz0 + (p.cz1 - p.cz0) * t; p.h = Math.atan2(p.cx1 - p.cx0, p.cz1 - p.cz0);
        p.road = p.overRoad !== false && t > 0.12 && t < 0.88;
        if (p.t >= 1 && REAL) rAfterCross(p);
        else if (p.t >= 1) { p.st = 'walk'; p.road = false; p.bi = p.nbi; p.bj = p.nbj; p.p = p.np; p.lat = p.kind === 'animal' ? 1 + R() * 0.6 : (R() - 0.5) * 2.2; p.dir = R() < 0.5 ? 1 : -1; }
      } else if (p.st === 'wait') { // client à l'arrêt
        p.h = p.face + Math.sin(p.t2 = (p.t2 || 0) + dt * 0.9) * 0.3;
      } else if (p.st === 'board' || p.st === 'alight') {
        const tx = p.st === 'board' ? taxi.x - Math.cos(taxi.h) * 1.3 : p.cx1, tz = p.st === 'board' ? taxi.z + Math.sin(taxi.h) * 1.3 : p.cz1;
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { const st = Math.min(d, 1.4 * dt); p.x += dx / d * st; p.z += dz / d * st; p.h = Math.atan2(dx, dz); v = 1.4; }
        p.t += dt;
        if (p.st === 'alight' && (d < 0.3 || p.t > 5)) { p.st = 'walk'; p.client = true; releaseClient(p); }
      }
      p.curV = v; p.ph += v * dt / p.M.stride; p.idle += ((v > 0.15 ? 0 : 1) - p.idle) * Math.min(1, dt * 6);
    }
  }
  const dirOfSide = (side, dir) => { const v = [[1, 0], [0, 1], [-1, 0], [0, -1]][side]; return [v[0] * dir, v[1] * dir]; };
  const _e = new THREE.Euler();
  function drawPed(M, x, y, z, q, ph, idle, tint) {
    if (M.n >= M.cap) return; const k = M.n++;
    _m.compose(_v.set(x, y, z), q, _s.set(1, 1, 1)); M.im.setMatrixAt(k, _m); M.iAnim.setXY(k, ph, idle); M.iTint.setXYZW(k, tint[0], tint[1], tint[2], tint[3]);
  }
  const NO_TINT = [1, 1, 1, 0];
  function drawPeds(dt) {
    const cp = (TEST && window.__tcam) ? { x: window.__tcam.p[0], z: window.__tcam.p[2] } : A.camera.position, far = LITE ? 150 : 210;
    for (const k in WM) WM[k].n = 0;
    for (const p of peds) {
      if (!p.on || p.st === 'ride' || p.st === 'off' || Math.abs(p.x - cp.x) + Math.abs(p.z - cp.z) > far) continue;
      const y0 = p.road ? 0.02 : 0.15;
      if (p.down || p.fall > 0) { const k = p.down ? 1 : Math.min(1, (1.2 - p.fall) * 4); if (p.kind === 'animal') _q.setFromEuler(_e.set(0, p.h, Math.PI / 2 * k, 'YXZ')); else _q.setFromEuler(_e.set(-Math.PI / 2 * k, p.h, 0, 'YXZ')); drawPed(p.M, p.x, y0 + 0.12 * k, p.z, _q, p.ph, 1, p.tint); }
      else { _q.setFromAxisAngle(_Y, p.h); drawPed(p.M, p.x, y0, p.z, _q, p.ph, p.idle, p.tint); }
    }
    drawFoot();
    // ânes attelés aux charrettes
    const D = WM.wk_donkey;
    if (D) for (const c of cars) if (c.cart && Math.abs(c.x - cp.x) + Math.abs(c.z - cp.z) < far) {
      if (c.drv === undefined) { const n = ['wk_ped0', 'wk_ped1', 'wk_ped2', 'wk_ped3', 'wk_ped7', 'wk_ped8', 'wk_ba'].filter(k => WM[k]); c.drv = n.length ? WM[n[c.slot % n.length]] : null; c.drvT = R() < 0.6 ? tintOf(pick(TINTS), 0.78) : NO_TINT; }
      if (c.drv) { _q.setFromAxisAngle(_Y, c.h); drawPed(c.drv, c.x - Math.sin(c.h) * 0.25, 0.92, c.z - Math.cos(c.h) * 0.25, _q, 0, 1, c.drvT); } // le charretier, debout à l'avant
      c.wph = (c.wph || 0) + c.v * dt / D.stride; _q.setFromAxisAngle(_Y, c.h); drawPed(D, c.x + Math.sin(c.h) * 1.85, 0.02, c.z + Math.cos(c.h) * 1.85, _q, c.wph, c.v > 0.2 ? 0 : 1, NO_TINT); }
    // marchands et clients des étals (immobiles)
    if (REAL && !RM && VEND.list.length) {
      const vr = LITE ? 90 : 130, gx = Math.floor(cp.x / 64), gz = Math.floor(cp.z / 64), rr = Math.ceil(vr / 64);
      for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) {
        const l = VEND.grid.get((gx + a) + ',' + (gz + b)); if (!l) continue;
        for (const i of l) { const v = VEND.list[i], M = WM[v.m]; if (!M || Math.abs(v.x - cp.x) + Math.abs(v.z - cp.z) > vr * 1.3) continue; _q.setFromAxisAngle(_Y, v.h); drawPed(M, v.x, v.y, v.z, _q, 0, 1, v.t); }
      }
    }
    for (const k in WM) { const M = WM[k]; M.im.count = M.n; M.im.visible = M.n > 0; M.im.instanceMatrix.needsUpdate = true; M.iAnim.needsUpdate = true; M.iTint.needsUpdate = true; }
  }

  /* ======================= Le taxi du joueur ======================= */
  const DRIVERS = [
    { id: 'moulaye', name: 'Moulaye', build: 'audi', paint: 0xffc21a, sign: true, char: 'ch_moulaye', foot: 'wk_ped8', perk: 'Rapide · moteur nerveux', color: '#ffd60a', st: { power: 1.08, max: 1.07 } },
    { id: 'ba', name: 'Taximan Ba', car: 'tx_mondeo_taxi', char: 'ch_ba', foot: 'wk_ba', perk: 'Vétéran · clients patients (+25 % de temps)', color: '#ff9f1c', st: { time: 1.25 } },
    { id: 'sidi', name: 'Sidi', car: 'tx_mondeo_civil', tint: 0x1f9a52, sign: true, char: 'ped_9', foot: 'wk_ped9', perk: 'Maniable · tient la route', color: '#2f9e5b', st: { grip: 1.1, steer: 1.08 } },
    { id: 'mamadou', name: 'Mamadou', car: 'tx_mondeo_civil', tint: 0x2a62d8, sign: true, char: 'ped_1', foot: 'wk_ped1', perk: 'Connaît la ville · courses +15 %', color: '#2d6cdf', st: { fare: 1.15 } },
  ];
  T.driver = clamp(store.get('taxiDriver', 0), 0, DRIVERS.length - 1);
  T.shift = clamp(store.get('taxiShift', 1), 0, 2); // 4 / 6 / 8 minutes
  T.traffic = clamp(store.get('taxiTraffic', 1), 0, 2);
  T.map = clamp(store.get('taxiMap', 1), 0, 1); // 1 : Nouakchott réelle (OSM) · 0 : ville classique en damier
  const SHIFT_S = [240, 360, 480];
  let taxi = null, taxiModel = null, homeTaxi = null, homeModel = null, me = null; // taxi : le véhicule conduit (ou quitté) · me : ce que suivent la police et la caméra
  function buildVehModel(o) { // o : { car (nœud de taxi.glb) | build (voiture du garage), tint | paint, char, sign }
    const g = new THREE.Group(); let body, wheels = [];
    if (o.build && A.buildCar) {
      const m = A.buildCar(o.build, 'lo', o.paint || 0xffffff, 0xc9ced6, false, true);
      body = m.body; g.add(m.root); m.root.position.set(0, 0, 0); g.userData.box = m.box;
      for (const w of m.wheels) wheels.push({ o: w.spin, st: w.pivot, front: w.front });
      for (const f of m.flames || []) f.visible = false;
      m.root.traverse(q => { if (q.isMesh) { q.castShadow = true; q.receiveShadow = false; } });
    } else {
      const src = lib.getObjectByName(o.car); if (!src) return null;
      body = src.clone(true); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
      body.traverse(q => {
        if (!q.isMesh) return;
        q.castShadow = true; q.receiveShadow = false;
        q.material = texFix(lowMat(q.material));
        if (o.tint !== undefined) { q.material = q.material.clone(); q.material.color = o.tint.isColor ? o.tint.clone() : lin(o.tint); }
      });
      body.updateMatrixWorld(true);
      body.traverse(q => { if (/^Wheel_/.test(q.name)) { const k = q.name.slice(6, 8); wheels.push({ o: q, front: k[0] === 'F' }); q.rotation.order = 'YXZ'; } });
      g.add(body);
    }
    g.updateMatrixWorld(true);
    const box = g.userData.box ? g.userData.box.clone() : new THREE.Box3().setFromObject(g); // (sans l'ombre portée)
    let driver = null;
    const ch = o.char && lib.getObjectByName(o.char);
    if (ch) { // conducteur (assis : on l'enfonce dans le siège)
      driver = ch.clone(true); driver.traverse(q => { if (q.isMesh) { q.castShadow = false; q.material = lowMat(q.material); } });
      const s = 0.93; driver.scale.setScalar(s); driver.position.set(0.42, box.max.y - 0.1 - 1.78 * s, 0.05);
      if (/^ped_/.test(o.char)) driver.rotation.y = Math.PI; // les passants regardent vers -z
      driver.visible = o.driverOn !== false; g.add(driver);
    }
    if (o.sign) { // enseigne TAXI sur le toit
      const tx = A.textTex([{ t: 'TAXI', y: 0.55, size: 150 }], { bg: '#ffd60a', fg: '#111111', w: 512, h: 160 });
      const sm = new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.35, roughness: 0.5 });
      const sg = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.34), sm); sg.position.set(0, box.max.y + 0.1, -0.15); g.add(sg); A.nightReg(sm, 0.35, 1.6);
    }
    return { root: g, body, wheels, box, driver };
  }
  const buildTaxiModel = dr => buildVehModel(dr);
  function makeTaxi() {
    const dr = DRIVERS[T.driver];
    clearParked(); if (taxiModel) root.remove(taxiModel.root); if (homeModel && homeModel !== taxiModel) root.remove(homeModel.root);
    taxiModel = buildTaxiModel(dr); if (taxiModel) root.add(taxiModel.root);
    const spec = A.makeSpec('race', { engine: 0, tires: 0, nitro: 0 }, 'audi');
    Object.assign(spec, { power: 10.5 * (dr.st.power || 1), maxSpeed: 30 * (dr.st.max || 1), grip: 8.2 * (dr.st.grip || 1), driftGrip: 1.9, steer: 2.3 * (dr.st.steer || 1), latMax: 13.5 * (dr.st.grip || 1), offGrip: 1, nitroDrain: 0.28, nitroPower: 6.5 });
    const bx = taxiModel ? taxiModel.box : null, hl = bx ? Math.max(-bx.min.z, bx.max.z) * 0.95 : 2.35, hw = bx ? Math.max(-bx.min.x, bx.max.x) * 0.92 : 0.95;
    taxi = A.newCar({ isPlayer: true, name: dr.name, carId: dr.build || 's15', spec, hl, hw, nitro: 0.6 });
    taxi.model = null; taxi.y = 0; taxi.hp = 100; taxi.isTaxi = true;
    homeTaxi = taxi; homeModel = taxiModel; me = taxi; resetFoot();
    if (taxiModel && A.attachHeadlights) A.attachHeadlights(taxiModel);
  }
  const spawnSpot = () => ({ x: nx(4) + HW + 30, z: nz(4) + LANE[1], h: HEAD(0) });
  function placeTaxi(x, z, h) { Object.assign(taxi, { x, z, h, vx: 0, vz: 0, w: 0, steer: 0, speed: 0, vF: 0, slip: 0, drifting: false, nitroOn: false }); taxi.skidLast[0] = taxi.skidLast[1] = null; A.camState.init = false; }
  function resetTaxi() { // remettre le taxi sur la chaussée la plus proche, dans le bon sens
    if (REAL) return rResetTaxi();
    const fi = clamp(Math.round((taxi.x - X0) / P), 0, NI - 1), fj = clamp(Math.round((taxi.z - Z0) / P), 0, NJ - 1);
    const dxN = taxi.x - nx(fi), dzN = taxi.z - nz(fj);
    let x, z, h;
    if (Math.abs(dxN) < Math.abs(dzN)) { const d = Math.cos(taxi.h) >= 0 ? 1 : 3, [rx] = RIGHT[d]; x = nx(fi) + rx * LANE[1]; z = clamp(taxi.z, Z0 + HW + 4, Z1 - HW - 4); h = HEAD(d); }
    else { const d = Math.sin(taxi.h) >= 0 ? 0 : 2, [, rz] = RIGHT[d]; z = nz(fj) + rz * LANE[1]; x = clamp(taxi.x, X0 + HW + 4, X1 - HW - 4); h = HEAD(d); }
    placeTaxi(x, z, h);
  }
  const _cols2 = [];
  function taxiStep(inp, dt) {
    const c = taxi;
    A.dynStep(c, inp, dt);
    let hit = 0;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    for (const o of [1.4, -1.4]) hit = Math.max(hit, collideCircle(c, fx * o, fz * o, 1.0));
    // véhicules IA (boîtes orientées)
    const cx = Math.floor(c.x / DCELL), cz = Math.floor(c.z / DCELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = DYN.get((cx + a) * 4096 + cz + b); if (!l) continue; for (const o of l) { if (o === c || o.hl === undefined || o.kind) continue; let h2 = 0; for (const of of [1.4, -1.4]) h2 = Math.max(h2, circleOBB(c, fx * of, fz * of, 1.0, o)); if (h2 > 0.5) { o.bump = Math.max(o.bump || 0, 2.5 + Math.min(2, h2 * 0.3)); if (h2 > 2.5 && o.t) { /* la voiture percutée glisse et part en tête-à-queue */ const k = Math.min(1, h2 / 12); o.pvx = (o.pvx || 0) + c.vx * 0.45 * k; o.pvz = (o.pvz || 0) + c.vz * 0.45 * k; o.spin = (o.spin || 0) + (lastHit.lz > 0 ? 1 : -1) * Math.sign(c.vx * Math.cos(o.h) - c.vz * Math.sin(o.h) || 1) * h2 * 0.12; if (h2 > 6) o.smoke = 8; } if (o.chaser) continue; if (o.police) policeBumped(h2); hit = Math.max(hit, h2); } } }
    c.speed = Math.hypot(c.vx, c.vz);
    // trottoirs : léger dénivelé
    const bi = Math.floor((c.x - X0) / P), bj = Math.floor((c.z - Z0) / P);
    let onWalk = false;
    if (!REAL && inBlocks(bi, bj)) { const [bx, bz] = blockC(bi, bj); onWalk = Math.abs(c.x - bx) < BLK / 2 && Math.abs(c.z - bz) < BLK / 2; }
    c.y += ((onWalk ? 0.15 : 0) - c.y) * Math.min(1, dt * 12);
    if (onWalk && !c.wasWalk && c.speed > 4) { A.camState && (c.crash = Math.max(c.crash, 1)); }
    c.wasWalk = onWalk;
    if (hit > 0) c.crash = Math.max(c.crash || 0, hit);
    return hit;
  }
  function crashEffects() { // carrosserie du taxi cabossée, éclats, secousse de la caméra
    const h = lastHit; if (h.v < 3.5 || !taxiModel) { h.v = 0; return; }
    A.dentModel(taxiModel, h.x, 0.6, h.z, h.nx, h.nz, h.v);
    A.crashFx(h.x, 0.6, h.z, h.nx, h.nz, h.v, h.o && h.o.col ? h.o.col.getHex() : undefined);
    A.shake(Math.min(1.3, h.v / 9));
    if (h.v > 7) A.blip(90, 0.18, 0.12);
    h.v = 0;
  }
  function updateTaxiVisual(inp, dt) {
    const m = taxiModel; if (!m) return;
    m.root.position.set(taxi.x, 0.03 + taxi.y, taxi.z); m.root.rotation.y = taxi.h;
    const roll = clamp(-taxi.w * taxi.speed * 0.004, -0.06, 0.06), pitch = clamp((inp.brk ? 0.02 : 0) - (inp.thr && taxi.speed < 20 ? 0.012 : 0), -0.035, 0.035);
    m.body.rotation.z = lerp(m.body.rotation.z, roll, Math.min(1, dt * 6)); m.body.rotation.x = lerp(m.body.rotation.x, pitch, Math.min(1, dt * 6));
    taxi.wheelRot = (taxi.wheelRot || 0) + taxi.vF / 0.36 * dt;
    for (const w of m.wheels) { w.o.rotation.x = taxi.wheelRot; if (w.front) { const so = w.st || w.o; so.rotation.y = lerp(so.rotation.y, taxi.steer * 0.5, Math.min(1, dt * 10)); } }
    // régime moteur (son) : boîte automatique
    const sp = Math.abs(taxi.vF), top = taxi.spec.maxSpeed * 1.15; let g = 1;
    while (g < 6 && sp > A.GEAR_TOP[g] * top * 0.96) g++;
    if (g > taxi.gear && inp.thr) taxi.shifted = true; taxi.gear = g;
    let rpm = Math.max(0.12 + (inp.thr && sp < 4 ? 0.25 : 0), sp / (A.GEAR_TOP[g] * top));
    taxi.rpm = lerp(taxi.rpm, Math.min(1, rpm), Math.min(1, dt * 8));
    // traces et fumée
    const intensity = clamp((Math.abs(taxi.slip) - 0.14) * 2.2, 0, 1) * clamp(taxi.speed / 12, 0, 1);
    const sliding = (taxi.drifting && intensity > 0.05) || (inp.hb && taxi.speed > 6);
    const fx = Math.sin(taxi.h), fz = Math.cos(taxi.h), sx = Math.cos(taxi.h), sz = -Math.sin(taxi.h);
    for (let w = 0; w < 2; w++) { const s = w ? -1 : 1, wx = taxi.x + sx * 0.8 * s - fx * 1.45, wz = taxi.z + sz * 0.8 * s - fz * 1.45; if (sliding) A.addSkid(taxi, w, wx, wz, sx, sz); else taxi.skidLast[w] = null; }
    if (sliding) { taxi.smokeAcc = (taxi.smokeAcc || 0) + dt * (12 + 30 * intensity); while (taxi.smokeAcc > 1) { taxi.smokeAcc -= 1; const s = R() < 0.5 ? 1 : -1; A.spawnSmoke(taxi.x + sx * 0.8 * s - fx * 1.8, taxi.z + sz * 0.8 * s - fz * 1.8, taxi.vx, taxi.vz, intensity, false, taxi.y); } }
    taxi.screech = intensity;
    if (m.damage > 0.4 || taxi.dead) { taxi.dmgSm = (taxi.dmgSm || 0) + dt * (4 + m.damage * 10); while (taxi.dmgSm > 1) { taxi.dmgSm -= 1; A.spawnSmoke(taxi.x + fx * (taxi.hl - 0.4), taxi.z + fz * (taxi.hl - 0.4), taxi.vx * 0.6, taxi.vz * 0.6, taxi.dead ? 0.9 : 0.25 + (m.damage || 0) * 0.4, true, taxi.y + 0.9); } }
  }

  /* ======================= Clients et courses ======================= */
  const NAMES_F = ['Fatimetou', 'Mariem', 'Aïchetou', 'Khadijetou', 'Oumou', 'Salka', 'Vatimetou', 'Zeinabou', 'Aminata', 'Mounina', 'Lalla', 'Coumba'];
  const NAMES_M = ['Mohamed Lemine', 'Sidi Mohamed', 'Cheikh', 'Brahim', 'Ahmedou', 'Yacoub', 'Moussa', 'El Hacen', 'Abdallahi', 'Samba', 'Oumar', 'Isselmou'];
  const job = { st: 'free', client: null, dest: null, t: 0, timer: 0, fare: 0, stars: 5, board: 0, dist: 0 };
  const stats = { courses: 0, fares: 0, tips: 0, fines: 0, peds: 0, reds: 0, crashes: 0, starSum: 0, arrests: 0, thefts: 0, hits: 0 };
  let money = 0;
  // phrase du client selon le lieu (et la ville de départ pour les gares routières)
  const CITY_OF = { 'Garage Rosso': 'Rosso', 'Garage de Kiffa': 'Kiffa', 'Garage de Tidjikja': 'Tidjikja', "Garage d'Atar": 'Atar' };
  const BIG_CITIES = ['Nouadhibou', 'Rosso', 'Kiffa', 'Atar', 'Kaédi', 'Aleg', 'Boutilimit', 'Néma', 'Zouérate', 'Sélibabi', 'Aïoun El Atrouss', 'Boghé', 'Akjoujt', 'Tidjikja', 'Chinguetti'];
  const ART = [[/^Le /, 'au '], [/^(Hôpital|Hôtel|Université|Institut|École|Ecole|Assemblée|Immeuble|ISCAE|Atlantic|Ilot|Auberge|Épicerie|Epicerie)/, 'à l’'],
    [/^(Place|Banque|Mosquée|Maternité|Clinique|Mairie|Grande|Galerie|Cour |Caisse|Direction|Primature|Sûreté|Communauté|Wilaya|Police|Zone|Gare|Plage|Route|Tour|Polyclinique|Centrale|BCI|Pharmacie|Station|Boulangerie|Boutique|Quincaillerie|Pâtisserie|Agence|Société)/, 'à la '],
    [/^(Marché|Centre|Palais|Ministère|Stade|Port|Garage|Carrefour|Sénat|Château|Parc|Lycée|Musée|Commissariat|Conseil|Tribunal|Supermarché|Ksar|Big|Mall |Sheraton|Mauricenter|PK|Restaurant|Garage|Complexe|Lycée|Collège|Dispensaire|Cabinet|Salon)/, 'au ']];
  const aLieu = n => { for (const [re, a] of ART) if (re.test(n)) return a + (/^Le /.test(n) ? n.slice(3) : n); return 'à ' + n; };
  function tripLine(d) {
    const to = 'Emmène-moi ' + aLieu(d.name);
    if (d.id === 'station' || d.cat === 'gare') {
      const c = CITY_OF[d.name] || pick(GEO ? BIG_CITIES.filter(n => GEO.villes.some(v => v[0] === n)) : BIG_CITIES);
      return d.name === "Garage d'autobus" ? to + ', je prends le bus.' : 'Je pars à ' + c + ' ce soir. ' + to + ', vite !';
    }
    const L = {
      sante: [to + ', mon frère est malade.', to + ', j’ai rendez-vous chez le médecin.', 'Vite, ' + d.name + ', s’il te plaît !'],
      marche: [to + ', je dois faire les courses.', 'On va ' + aLieu(d.name) + ', il paraît que les prix ont baissé.', to + ', ma tante y a sa boutique.'],
      mosquee: [to + ' avant la prière.', to + ', on m’attend pour la prière.'],
      hotel: [to + ', j’ai une réunion là-bas.', to + ', j’arrive de l’aéroport, je suis fatigué.'],
      etat: [to + ', j’ai un dossier à déposer.', to + ', mon rendez-vous est dans dix minutes !', to + ', je travaille là-bas.'],
      police: [to + ', je viens chercher un papier.', to + ', on m’a volé mon téléphone…'],
      banque: [to + ', je dois retirer de l’argent.', to + ', avant la fermeture !'],
      etudes: [to + ', j’ai cours ce matin.', to + ', j’ai un examen !', to + ', je suis en retard pour les inscriptions.'],
      loisir: [to + ', on se retrouve là-bas entre amis.', to + ', il y a du monde aujourd’hui.'],
      commerce: [to + ', je dois acheter un cadeau.', to + ', j’ai des achats à faire.'],
      port: [to + ', je veux du poisson frais !', to + ', les pirogues rentrent bientôt.'],
      quartier: [to + ', c’est chez moi.', 'Je rentre à la maison : ' + d.name + '.'],
      carrefour: [to + ', je te guiderai après.', to + ', c’est tout près de chez moi.'],
      carburant: [to + ', je travaille à la station.', to + ', mon cousin y vend des cartes de recharge.'],
      resto: [to + ', j’ai faim !', to + ', on m’attend pour le déjeuner.', to + ', c’est le meilleur thiéboudiène du quartier.'],
    }[d.cat];
    return (L ? pick(L) : to + ', s’il te plaît.');
  }
  function manhattan(ax, az, bx, bz) { return Math.abs(ax - bx) + Math.abs(az - bz); }
  function spawnClients(force) {
    const waiting = STOPS.filter(s => s.client).length, want = 5;
    if (waiting >= want && !force) return;
    const free = STOPS.filter(s => !s.client && s.cool <= 0 && (!taxi || Math.hypot(s.mx - taxi.x, s.mz - taxi.z) > 70));
    free.sort((a, b) => (taxi ? Math.hypot(a.mx - taxi.x, a.mz - taxi.z) - Math.hypot(b.mx - taxi.x, b.mz - taxi.z) : 0) + (R() - 0.5) * 300);
    for (const s of free) {
      if (STOPS.filter(q => q.client).length >= want) break;
      const p = peds.find(q => q.client && q.st === 'off'); if (!p) break;
      p.on = true; p.st = 'wait'; p.x = s.mx; p.z = s.mz; p.face = s.look; p.road = false; p.fall = 0;
      const fem = R() < 0.5; p.name = pick(fem ? NAMES_F : NAMES_M); p.stop = s; s.client = p; p.wave = false;
      // destination : un lieu connu assez loin
      const far = PLACES.filter(pl => pl.mx !== undefined && (REAL ? (d => d > 450 && d < 2600)(Math.hypot(pl.mx - s.mx, pl.mz - s.mz)) : manhattan(pl.mx, pl.mz, s.mx, s.mz) > 260));
      // un tiers des courses vers les monuments et carrefours, le reste vers les lieux de la ville
      const big = far.filter(pl => !pl.pb), poi = far.filter(pl => pl.pb);
      p.dest = pick(poi.length && (!big.length || R() > 0.35) ? poi : big.length ? big : PLACES.filter(pl => pl.mx !== undefined));
      p.trip = tripLine(p.dest);
    }
  }
  function releaseClient(p) { p.on = false; p.st = 'off'; }
  function jobLogic(dt) {
    for (const s of STOPS) if (s.cool > 0) s.cool -= dt;
    if (job.st === 'free') {
      // arrivée sur un arrêt avec client
      for (const s of STOPS) {
        const p = s.client; if (!p || p.st !== 'wait') continue;
        const d = Math.hypot(taxi.x - s.zx, taxi.z - s.zz); p.wave = d < 35;
        if (d < 8.5 && taxi.speed < 1.6) { job.st = 'board'; job.client = p; job.board = 0; p.st = 'board'; p.t = 0; s.client = null; s.cool = 25; A.blip(990, 0.08, 0.06); break; }
      }
    } else if (job.st === 'board') {
      const p = job.client; job.board += dt;
      const dd = Math.hypot(p.x - taxi.x, p.z - taxi.z);
      if (Math.hypot(taxi.x - p.stop.zx, taxi.z - p.stop.zz) > 16) { // le taxi est reparti sans lui
        p.st = 'wait'; p.x = p.stop.mx; p.z = p.stop.mz; p.stop.client = p; job.st = 'free'; job.client = null; A.popup('LE CLIENT T’ATTENDAIT…', 'reviens le chercher', true); return;
      }
      if (dd < 1.6 || job.board > 4) {
        p.st = 'ride'; job.st = 'ride'; job.dest = p.dest; job.stars = 5;
        job.dist = REAL ? rRoutePts(taxi.x, taxi.z, job.dest.zx, job.dest.zz, taxi.h, true).len : manhattan(taxi.x, taxi.z, job.dest.zx, job.dest.zz);
        const dr = DRIVERS[T.driver];
        job.timer = Math.round((job.dist / 8.6 + 22) * (dr.st.time || 1)); job.t = job.timer;
        job.fare = Math.round((90 + job.dist * 0.42) * (dr.st.fare || 1) / 10) * 10;
        A.popup(p.name.toUpperCase() + ' MONTE', '→ ' + job.dest.name + ' · ' + fmtInt(job.fare) + ' MRU', false, 'gold');
        say(pick(['Salam alaykoum ! ', 'Bonjour chauffeur ! ', 'Assalamou alaykoum… ']) + (p.trip || 'Emmène-moi à ' + job.dest.name + ', s’il te plaît.'));
      }
    } else if (job.st === 'ride') {
      job.t -= dt;
      if (job.t < 0 && !job.late) { job.late = true; say('On est en retard ! Je ne vais pas tout payer…'); }
      const d = Math.hypot(taxi.x - job.dest.zx, taxi.z - job.dest.zz);
      if (d < 9 && taxi.speed < 1.6) {
        const p = job.client, late = job.t < 0;
        const base = late ? Math.round(job.fare * 0.6 / 10) * 10 : job.fare;
        const tip = late ? 0 : Math.round(job.fare * 0.35 * Math.max(0, job.stars - 2) / 3 * clamp(job.t / job.timer * 1.6, 0.2, 1) / 10) * 10;
        money += base + tip; stats.courses++; stats.fares += base; stats.tips += tip; stats.starSum += job.stars;
        A.popup('+' + fmtInt(base + tip) + ' MRU', (tip ? 'dont ' + fmtInt(tip) + ' de pourboire · ' : '') + stars(job.stars), false, 'gold');
        A.blip(1320, 0.12, 0.08); setTimeout(() => A.blip(1760, 0.16, 0.08), 110);
        p.st = 'alight'; p.t = 0; p.x = taxi.x - Math.cos(taxi.h) * 1.3; p.z = taxi.z + Math.sin(taxi.h) * 1.3; p.cx1 = job.dest.mx; p.cz1 = job.dest.mz; p.on = true;
        job.st = 'free'; job.client = null; job.dest = null; job.late = false;
        taxi.nitro = Math.min(1, taxi.nitro + 0.3);
        spawnClients(true);
      }
    }
  }
  const stars = n => '★'.repeat(Math.max(0, Math.round(n))) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));
  function loseStar(n, why) {
    if (job.st !== 'ride') return;
    const dr = DRIVERS[T.driver];
    job.stars = Math.max(0, job.stars - n * (dr.id === 'ba' ? 0.6 : 1));
    if (why) say(why);
  }
  let sayT = 0;
  function say(t) { const el = $('txSay'); if (!el) return; el.textContent = '💬 ' + t; el.classList.add('show'); sayT = 4.5; }

  /* ======================= Infractions et police ======================= */
  let wanted = 0, wantedT = 0, policeAlert = 0, lastNode = null, caughtT = 0;
  const chasers = []; // voitures de police en poursuite (physique libre)
  let policeModels = [];
  function buildPoliceModels() {
    const src = lib.getObjectByName('tx_mondeo_police'); if (!src) return;
    for (let k = 0; k < 2; k++) {
      const g = new THREE.Group(), b = src.clone(true); b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.traverse(o => { if (o.isMesh) { o.castShadow = !LITE; o.material = texFix(lowMat(o.material)); } }); g.add(b);
      const box = new THREE.Box3().setFromObject(b);
      const red = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.glowSpriteTex, color: 0xff2020, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const blue = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.glowSpriteTex, color: 0x2060ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      red.position.set(0.35, box.max.y + 0.1, 0); blue.position.set(-0.35, box.max.y + 0.1, 0); red.scale.setScalar(1.6); blue.scale.setScalar(1.6); g.add(red, blue);
      g.visible = false; root.add(g); policeModels.push({ g, red, blue, used: false });
    }
  }
  function nearestPolice(maxD) { let best = null, bd = maxD; for (const c of cars) if (c.police && !c.chase) { const d = Math.hypot(c.x - me.x, c.z - me.z); if (d < bd) { bd = d; best = c; } } for (const pc of chasers) { const d = Math.hypot(pc.car.x - me.x, pc.car.z - me.z); if (d < bd) { bd = d; best = pc.src; } } return best; }
  function spawnCop() { // renfort : une voiture de police arrive d'un carrefour voisin, hors de vue
    let best = null;
    const fx = Math.sin(me.h), fz = Math.cos(me.h);
    if (REAL) { const q = rNodeRing(me.x - fx * 60, me.z - fz * 60, 60, 190, 90); if (q) best = { x: q.x, z: q.z, a: 0 }; }
    else for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const x = nx(i), z = nz(j), d = Math.hypot(x - me.x, z - me.z); if (d < 45) continue; const ahead = (x - me.x) * fx + (z - me.z) * fz, sc = Math.abs(d - 105) + ahead * 0.25 + R() * 20; if (!best || sc < best.a) best = { x, z, a: sc }; } // de préférence derrière, à ~100 m, hors de vue
    if (!best) return null;
    const t = VT.police || { hl: 2.35, hw: 0.95 };
    return { x: best.x, z: best.z, h: Math.atan2(me.x - best.x, me.z - best.z), vx: 0, vz: 0, hl: t.hl, hw: t.hw, police: true, synthetic: true };
  }
  function offence(kind, fine, w, pd, force) { // pd : distance à laquelle la police voit l'infraction ; force : on appelle la police
    let cop = nearestPolice(pd || 110);
    if (!cop && force) cop = (chasers[0] && chasers[0].src) || spawnCop();
    const label = { red: 'FEU ROUGE GRILLÉ', speed: 'EXCÈS DE VITESSE', ped: 'PIÉTON RENVERSÉ', crash: 'ACCROCHAGE', cop: 'VOITURE DE POLICE PERCUTÉE', vol: 'VOITURE VOLÉE' }[kind];
    if (cop) {
      money -= fine; stats.fines += fine; wanted = Math.min(3, wanted + w); wantedT = 0;
      A.popup('🚨 ' + label, 'Amende : -' + fmtInt(fine) + ' MRU · la police te suit !', true);
      startChase(cop);
      return true;
    }
    A.popup(label, kind === 'red' ? 'Heureusement, pas de police…' : '', true);
    void force;
    return false;
  }
  function checkRedLight() {
    if (REAL) return rCheckRedLight();
    const fi = Math.round((taxi.x - X0) / P), fj = Math.round((taxi.z - Z0) / P);
    if (!inGrid(fi, fj)) { lastNode = null; return; }
    const dx = taxi.x - nx(fi), dz = taxi.z - nz(fj), inside = Math.abs(dx) < HW && Math.abs(dz) < HW;
    const key = fi + ',' + fj;
    if (inside && lastNode && lastNode.key === key && !lastNode.inside && taxi.speed > 3.5) {
      const axis = lastNode.axis, L = light(fi, fj, axis);
      // en arrivant dans le carrefour par la voie de droite et au rouge
      if (L.s === 'R' && L.left < CYC / 2 - 1.5) { stats.reds++; loseStar(0.6, 'Hé ! C’était rouge !'); offence('red', 200, 1, 120); }
    }
    lastNode = { key, inside, axis: Math.abs(dx) > Math.abs(dz) ? 0 : 1 };
  }
  function startChase(cop) {
    if (chasers.length >= 2 || !cop || cop.chase) { policeAlert = 6; return; }
    const pm = policeModels.find(m => !m.used); if (!pm) return;
    pm.used = true; pm.g.visible = true; cop.chase = true;
    const spec = A.makeSpec('race', { engine: 0, tires: 0, nitro: 0 }, 'audi');
    Object.assign(spec, { power: 11.5, maxSpeed: 33, grip: 8.6, latMax: 14.5, steer: 2.4, driftGrip: 2.2 });
    const car = A.newCar({ isAI: true, spec, x: cop.x, z: cop.z, h: cop.h, vx: cop.vx, vz: cop.vz, nitro: 0, hl: cop.hl, hw: cop.hw, police: true, chaser: true, bump: 0 });
    chasers.push({ car, src: cop, pm, box: { hl: cop.hl, hw: cop.hw }, lost: 0, route: null, rt: 0 });
    sirenOn(true);
  }
  function endChase(pc) {
    const c = pc.src; c.chase = false; pc.pm.used = false; pc.pm.g.visible = false;
    if (c.synthetic) { chasers.splice(chasers.indexOf(pc), 1); if (!chasers.length) sirenOn(false); return; }
    // la voiture reprend une voie du réseau la plus proche
    if (REAL) { c.h = pc.car.h; if (!rPlaceOnRoad(c, pc.car.x, pc.car.z)) { const k = cars.indexOf(c); if (k >= 0) { freeCar(c); cars.splice(k, 1); } } chasers.splice(chasers.indexOf(pc), 1); if (!chasers.length) sirenOn(false); return; }
    let best = null, bd = 1e9;
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) for (let d = 0; d < 4; d++) { if (!inGrid(i + DIRS[d][0], j + DIRS[d][1])) continue; const mx = nx(i) + DIRS[d][0] * P / 2, mz = nz(j) + DIRS[d][1] * P / 2, dd = Math.hypot(mx - pc.car.x, mz - pc.car.z) + (me ? -Math.min(250, Math.hypot(mx - me.x, mz - me.z)) : 0); if (dd < bd) { bd = dd; best = [i, j, d]; } }
    c.i = best[0]; c.j = best[1]; c.d = best[2]; c.lane = 1; c.s = 10; c.v = 4; edgePath(c); chooseNext(c);
    chasers.splice(chasers.indexOf(pc), 1);
    if (!chasers.length) sirenOn(false);
  }
  /* --- ambulance : vient chercher les blessés --- */
  const amb = { st: 'off', car: null, mdl: null, target: null, t: 0, queue: [], route: null, rt: 0, leaveTo: null };
  function buildAmbulanceModel() {
    const src = lib.getObjectByName('tx_ambulance'); if (!src) return;
    const g = new THREE.Group(), b = src.clone(true); b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.traverse(o => { if (o.isMesh) { o.castShadow = !LITE; o.material = texFix(lowMat(o.material)); } }); g.add(b);
    const box = new THREE.Box3().setFromObject(b), mk = col => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.glowSpriteTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(1.5); g.add(sp); return sp; };
    const l1 = mk(0xff2020), l2 = mk(0xffffff); l1.position.set(0.7, box.max.y + 0.05, box.max.z - 0.6); l2.position.set(-0.7, box.max.y + 0.05, box.max.z - 0.6);
    g.visible = false; root.add(g); amb.mdl = { g, l1, l2, hl: box.max.z, hw: (box.max.x - box.min.x) / 2 };
  }
  function dispatchAmbulance(p) {
    if (!amb.mdl) return;
    if (amb.st !== 'off') { if (amb.target !== p && !amb.queue.includes(p)) amb.queue.push(p); return; }
    let best = null;
    if (REAL) { const q = rNodeRing(p.x, p.z, 170, 330, 230); best = q ? { x: q.x, z: q.z } : { x: p.x + 200, z: p.z }; }
    else for (let k = 0; k < 60; k++) { const i = Math.floor(R() * NI), j = Math.floor(R() * NJ), x = nx(i), z = nz(j), d = Math.hypot(x - p.x, z - p.z); if (d > 170 && d < 320 && (!best || Math.abs(d - 220) < Math.abs(best.d - 220))) best = { x, z, d }; }
    if (!best) best = { x: nx(0), z: nz(0) };
    const spec = A.makeSpec('race', { engine: 0, tires: 0, nitro: 0 }, 'audi');
    Object.assign(spec, { power: 9, maxSpeed: 24, grip: 8.2, latMax: 13, steer: 2.3, driftGrip: 2.4 });
    amb.car = A.newCar({ isAI: true, spec, x: best.x, z: best.z, h: Math.atan2(p.x - best.x, p.z - best.z), hl: amb.mdl.hl, hw: amb.mdl.hw * 0.95, chaser: true, ambulance: true, bump: 0 });
    Object.assign(amb, { st: 'go', target: p, t: 0, route: null, rt: 0 });
    amb.mdl.g.visible = true; sirenAmb(true);
    A.popup('🚑 L’AMBULANCE ARRIVE', 'un blessé à ' + (placeName(p.x, p.z).street || placeName(p.x, p.z).district), true);
  }
  function unstick(c, dt) { // coincé contre un mur : marche arrière quelques instants
    if (c.revT > 0) { c.revT -= dt; return true; }
    c.stuckT = c.speed < 0.8 ? (c.stuckT || 0) + dt : 0;
    if (c.stuckT > 1.6) { c.stuckT = 0; c.revT = 1.3; return true; }
    return false;
  }
  function driveTo(c, tx, tz, maxV, dt, route) { // conduite simple : itinéraire par les carrefours puis droit sur la cible
    let ax = tx, az = tz;
    if (route && route.length) { while (route.length > 1 && Math.hypot(route[0][0] - c.x, route[0][1] - c.z) < 9) route.shift(); ax = route[0][0]; az = route[0][1]; }
    const want = Math.atan2(ax - c.x, az - c.z), err = wrapAng(want - c.h), steer = clamp(err * 2.2, -1, 1);
    if (unstick(c, dt)) return { thr: 0, brk: 1, steer: -steer, hb: 0, nitro: 0 };
    const lim = Math.abs(err) > 0.7 ? Math.min(maxV, 8) : maxV, fast = c.speed > lim;
    return { thr: fast ? 0 : 1, brk: fast && c.vF > 2 ? 0.8 : 0, steer, hb: 0, nitro: 0 };
  }
  function updateAmbulance(dt) {
    if (amb.st === 'off') return;
    const c = amb.car, p = amb.target, M = amb.mdl;
    amb.rt -= dt;
    let tx, tz, maxV = 22;
    if (amb.st === 'go' || amb.st === 'load') { tx = p.x; tz = p.z; const d = Math.hypot(tx - c.x, tz - c.z); maxV = d < 45 ? 4 + d * 0.32 : 22; }
    else { tx = amb.leaveTo[0]; tz = amb.leaveTo[1]; }
    if (amb.rt <= 0 && amb.st !== 'load') { amb.route = gridRoute(c.x, c.z, tx, tz); amb.rt = 1.5; }
    if (amb.st === 'load') { c.vx *= Math.exp(-dt * 4); c.vz *= Math.exp(-dt * 4); }
    else { const inp = driveTo(c, tx, tz, maxV, dt, amb.route); for (let s2 = 0; s2 < 3; s2++) { A.dynStep(c, inp, dt / 3); const fx = Math.sin(c.h), fz = Math.cos(c.h); for (const o of [1.6, -1.6]) collideCircle(c, fx * o, fz * o, 1.1); } }
    c.speed = Math.hypot(c.vx, c.vz);
    M.g.position.set(c.x, 0.03, c.z); M.g.rotation.y = c.h;
    const fl = Math.sin(A.menuTime() * 11) > 0; M.l1.material.opacity = fl ? 1 : 0.15; M.l2.material.opacity = fl ? 0.15 : 1;
    if (amb.st === 'go') {
      if (!p.down && !p.on) { amb.st = 'leave'; }
      else if (Math.hypot(p.x - c.x, p.z - c.z) < 8.5) { amb.st = 'load'; amb.t = 5; A.popup('🚑 LES SECOURS SONT LÀ', 'le blessé est emmené à l’hôpital', false, 'blue'); }
    } else if (amb.st === 'load') {
      amb.t -= dt;
      if (amb.t <= 0) { p.down = false; p.on = false; p.respawn = 30; p.road = false; const far = [[nx(0), nz(0)], [nx(NI - 1), nz(0)], [nx(0), nz(NJ - 1)], [nx(NI - 1), nz(NJ - 1)]].sort((a, b) => Math.hypot(b[0] - c.x, b[1] - c.z) - Math.hypot(a[0] - c.x, a[1] - c.z)); amb.leaveTo = far[1]; if (REAL) { const q = rNodeRing(c.x, c.z, 380, 650, 500); amb.leaveTo = q ? [q.x, q.z] : [c.x + 500, c.z]; } amb.st = 'leave'; amb.route = null; amb.rt = 0; }
    } else if (amb.st === 'leave') {
      const nxt = amb.queue.find(q => q.down && q.on);
      if (nxt) { amb.queue = amb.queue.filter(q => q !== nxt); Object.assign(amb, { st: 'go', target: nxt, route: null, rt: 0 }); }
      else if (Math.hypot(amb.leaveTo[0] - c.x, amb.leaveTo[1] - c.z) < 12 || Math.hypot(me.x - c.x, me.z - c.z) > 300) { amb.st = 'off'; M.g.visible = false; amb.car = null; sirenAmb(false); }
    }
  }
  function policeBumped(v) { if (v > 2.5 && !T.bumpCd) { T.bumpCd = 3; offence('cop', 250, 1, 200); } }
  function chaseInput(pc, dt) { // pilote de la police : itinéraire par les carrefours, puis droit sur le taxi
    const c = pc.car, dx = me.x - c.x, dz = me.z - c.z, dist = Math.hypot(dx, dz);
    let tx = me.x + me.vx * 0.5, tz = me.z + me.vz * 0.5;
    pc.rt -= dt;
    if (dist > 45) {
      if (pc.rt <= 0 || !pc.route || !pc.route.length) { pc.route = gridRoute(c.x, c.z, me.x, me.z); pc.rt = 1.2; }
      while (pc.route.length && Math.hypot(pc.route[0][0] - c.x, pc.route[0][1] - c.z) < 9) pc.route.shift();
      if (pc.route.length) { tx = pc.route[0][0]; tz = pc.route[0][1]; }
    }
    const want = Math.atan2(tx - c.x, tz - c.z), err = wrapAng(want - c.h);
    const steer = clamp(err * 2.2, -1, 1), sharp = Math.abs(err) > 0.7;
    if (foot.on && dist < 11) return { thr: 0, brk: 1, steer, hb: 0, nitro: 0 }; // à pied : la voiture s'arrête à côté de toi
    if (dist > 9 && unstick(c, dt)) return { thr: 0, brk: 1, steer: -steer, hb: 0, nitro: 0 };
    const fast = c.speed > (sharp ? 9 : 30);
    return { thr: fast ? 0 : 1, brk: fast && c.vF > 3 ? 0.7 : 0, steer, hb: 0, nitro: 0 };
  }
  function gridRoute(ax, az, bx, bz) { // L-trajet par les nœuds (BFS inutile sur une grille sans obstacle)
    if (REAL) return rRoute(ax, az, bx, bz);
    const ai = clamp(Math.round((ax - X0) / P), 0, NI - 1), aj = clamp(Math.round((az - Z0) / P), 0, NJ - 1), bi = clamp(Math.round((bx - X0) / P), 0, NI - 1), bj = clamp(Math.round((bz - Z0) / P), 0, NJ - 1);
    const r = [[nx(ai), nz(aj)]]; let i = ai, j = aj;
    const horiz = Math.abs(az - nz(aj)) < HW + 2; // déjà sur une rue E-O
    const stepI = () => { while (i !== bi) { i += Math.sign(bi - i); r.push([nx(i), nz(j)]); } }, stepJ = () => { while (j !== bj) { j += Math.sign(bj - j); r.push([nx(i), nz(j)]); } };
    if (horiz) { stepI(); stepJ(); } else { stepJ(); stepI(); }
    r.push([bx, bz]);
    if (r.length >= 2) { const x0 = r[0][0], z0 = r[0][1], ux = Math.sign(r[1][0] - x0), uz = Math.sign(r[1][1] - z0); if ((ax - x0) * ux + (az - z0) * uz > 0 && Math.abs((ax - x0) * uz - (az - z0) * ux) < HW + 3) r.shift(); } // déjà engagé vers le nœud suivant : ne pas faire demi-tour
    return r;
  }
  function updatePolice(dt) {
    if (T.bumpCd) T.bumpCd = Math.max(0, T.bumpCd - dt);
    if (policeAlert > 0) policeAlert -= dt;
    // excès de vitesse sous les yeux de la police
    if (taxi.speed * 3.6 > 78 && nearestPolice(55) && !T.speedCd) { T.speedCd = 10; stats.speed = (stats.speed || 0) + 1; offence('speed', 150, 1, 55); }
    if (T.speedCd) T.speedCd = Math.max(0, T.speedCd - dt);
    for (const pc of chasers.slice()) {
      const c = pc.car, inp = chaseInput(pc, dt);
      const sub = 3; for (let s = 0; s < sub; s++) { A.dynStep(c, inp, dt / sub); const fx = Math.sin(c.h), fz = Math.cos(c.h); for (const o of [1.4, -1.4]) collideCircle(c, fx * o, fz * o, 1.0); }
      const fx = Math.sin(c.h), fz = Math.cos(c.h);
      for (const o of [1.4, -1.4]) for (const q of cars) if (!q.chase && Math.abs(q.x - c.x) < 9 && Math.abs(q.z - c.z) < 9) { if (circleOBB(c, fx * o, fz * o, 1.0, q) > 1) q.bump = Math.max(q.bump, 2); }
      c.speed = Math.hypot(c.vx, c.vz);
      pc.src.x = c.x; pc.src.z = c.z; pc.src.h = c.h;
      const d = Math.hypot(me.x - c.x, me.z - c.z);
      pc.pm.g.position.set(c.x, 0.03, c.z); pc.pm.g.rotation.y = c.h;
      const fl = Math.sin(A.menuTime() * 14) > 0; pc.pm.red.material.opacity = fl ? 1 : 0.15; pc.pm.blue.material.opacity = fl ? 0.15 : 1;
      if (foot.on ? (d < 14 && (me.speed < 2.6 || foot.down > 0)) : (d < 7.5 && taxi.speed < 3)) { caughtT += dt; if (caughtT > (foot.on ? 1.8 : 1.4)) { arrested(); return; } } else caughtT = Math.max(0, caughtT - dt * 0.5);
      if (policeFire(pc, d, dt)) return;
      if (d > 170) pc.lost += dt; else pc.lost = Math.max(0, pc.lost - dt * 0.5);
      if (pc.lost > 9) { endChase(pc); if (!chasers.length) { A.popup('POLICE SEMÉE !', 'Tu t’en sors… cette fois', false, 'blue'); wanted = 0; } }
    }
    if (!chasers.length) { caughtT = 0; chaseT = 0; } else chaseT += dt;
    if (wanted && !chasers.length) { wantedT += dt; if (wantedT > 25) wanted = 0; }
  }
  function arrested(shot) {
    const fine = 300 * Math.max(1, wanted) + (shot ? 300 : 0);
    money -= fine; stats.fines += fine; stats.arrests++;
    if (shot) A.popup('TOUCHÉ, PUIS ARRÊTÉ', 'Soins + amende : -' + fmtInt(fine) + ' MRU (-25 s)', true);
    else A.popup('ARRÊTÉ PAR LA POLICE', 'Amende : -' + fmtInt(fine) + ' MRU · papiers vérifiés (-15 s)', true);
    T.timeLeft -= shot ? 25 : 15;
    backHome(); // la police te ramène à ton taxi
    if (job.st === 'ride' || job.st === 'board') { const p = job.client; say('Je descends ici, je ne veux pas d’ennuis !'); releaseClient(p); job.st = 'free'; job.client = null; job.dest = null; spawnClients(true); }
    for (const pc of chasers.slice()) endChase(pc);
    wanted = 0; caughtT = 0;
  }

  /* ======================= À pied : descendre, courir, emprunter une autre voiture ======================= */
  const foot = { on: false, x: 0, z: 0, h: 0, vx: 0, vz: 0, w: 0, v: 0, speed: 0, ph: 0, idle: 1, hp: 100, down: 0, hl: 0.32, hw: 0.32, kind: 'me', M: null };
  const parked = []; // véhicules laissés par le joueur (sauf `taxi`, le dernier conduit) : { car, model }
  const footCam = { init: false, yaw: 0, pos: new THREE.Vector3() };
  const NO_INP = { thr: 0, brk: 0, steer: 0, hb: 0, nitro: 0 };
  let hurtT = 0, chaseT = 0, shootWarned = false;
  function resetFoot() { foot.on = false; foot.hp = 100; foot.down = 0; hurtT = 0; chaseT = 0; shootWarned = false; }
  function clearParked() { for (const v of parked) root.remove(v.model.root); parked.length = 0; }
  const obbDist = (px, pz, o) => { const dx = px - o.x, dz = pz - o.z, ca = Math.cos(o.h), sa = Math.sin(o.h), lx = dx * ca - dz * sa, lz = dx * sa + dz * ca; return Math.hypot(Math.max(0, Math.abs(lx) - o.hw), Math.max(0, Math.abs(lz) - o.hl)); };
  T.door = () => { // F / E · Select (manette) · bouton 🚪
    if (!T.active || A.state !== 'play' || !taxi) return;
    if (foot.on) enterNearest(); else exitVehicle();
  };
  function exitVehicle() {
    if (taxi.speed > 7) { A.popup('RALENTIS D’ABORD', 'impossible de sauter à cette vitesse', true); return; }
    const sx = Math.cos(taxi.h), sz = -Math.sin(taxi.h), o = taxi.hw + 0.75; // portière du conducteur (côté +x du véhicule)
    Object.assign(foot, { on: true, x: taxi.x + sx * o, z: taxi.z + sz * o, h: taxi.h, vx: 0, vz: 0, v: 0, speed: 0, ph: 0, idle: 1, down: 0 });
    const x0 = foot.x, z0 = foot.z; collideCircle(foot, 0, 0, 0.36);
    if (Math.hypot(foot.x - x0, foot.z - z0) > 0.25) { foot.x = taxi.x - sx * o; foot.z = taxi.z - sz * o; } // un mur : on sort de l'autre côté
    taxi.vx = taxi.vz = 0; taxi.speed = taxi.vF = 0; taxi.w = 0; taxi.nitroOn = false; taxi.parked = true; taxi.skidLast[0] = taxi.skidLast[1] = null;
    if (taxiModel && taxiModel.driver) taxiModel.driver.visible = false;
    foot.M = WM[DRIVERS[T.driver].foot] || WM.wk_ped0 || null;
    me = foot; footCam.init = false;
    if (job.st === 'ride' || job.st === 'board') { // le client descend lui aussi
      const p = job.client;
      if (p) { const px = taxi.x - sx * (taxi.hw + 0.6), pz = taxi.z - sz * (taxi.hw + 0.6); Object.assign(p, { st: 'alight', t: 0, x: px, z: pz, cx1: px - sx * 5, cz1: pz - sz * 5, on: true }); }
      say(job.st === 'ride' ? 'Tu me laisses là ?! Je descends, je ne paie pas !' : 'Bon… je vais attendre un autre taxi.');
      job.st = 'free'; job.client = null; job.dest = null; job.late = false; spawnClients(true);
    }
    A.blip(420, 0.08, 0.05);
    A.popup('🚶 À PIED', 'F / Select : monter dans une voiture · Maj : courir', false, 'blue');
  }
  function enterNearest() {
    if (foot.down > 0) return;
    let best = null, bd = 2.2;
    const cand = (o, kind) => { const d = obbDist(foot.x, foot.z, o); if (d < bd) { bd = d; best = { o, kind }; } };
    cand(taxi, 'last');
    for (const v of parked) cand(v.car, 'parked');
    for (const c of cars) if (!c.chase && !c.police && !c.cart && c.type !== 'amb' && Math.abs(c.x - foot.x) < 9 && Math.abs(c.z - foot.z) < 9) cand(c, 'traffic');
    if (!best) { A.popup('AUCUNE VOITURE À PORTÉE', 'approche-toi d’une portière', true); return; }
    if (best.kind === 'traffic' && best.o.v > 3.2) { A.popup('ELLE ROULE ENCORE', 'mets-toi devant pour l’arrêter', true); return; }
    const from = { x: foot.x, z: foot.z };
    if (best.kind !== 'last') { parked.push({ car: taxi, model: taxiModel }); taxi.parked = true; }
    if (best.kind === 'parked') { const i = parked.findIndex(v => v.car === best.o); const v = parked.splice(i, 1)[0]; taxi = v.car; taxiModel = v.model; }
    else if (best.kind === 'traffic') { const v = stealCar(best.o); taxi = v.car; taxiModel = v.model; }
    while (parked.filter(v => v.car !== homeTaxi).length > 4) { const i = parked.findIndex(v => v.car !== homeTaxi); root.remove(parked[i].model.root); parked.splice(i, 1); } // pas trop de voitures abandonnées
    taxi.parked = false; foot.on = false; me = taxi; A.camState.init = false;
    if (taxiModel.driver) taxiModel.driver.visible = true;
    if (A.attachHeadlights) A.attachHeadlights(taxiModel);
    A.blip(700, 0.07, 0.05);
    // changer de voiture loin des yeux de la police : elle perd ta trace
    let seen = false; for (const pc of chasers) if (Math.hypot(pc.car.x - from.x, pc.car.z - from.z) < 55) seen = true;
    if (best.kind !== 'last' && chasers.length && !seen) { for (const pc of chasers.slice()) endChase(pc); wanted = Math.max(0, wanted - 1); A.popup('ILS ONT PERDU TA TRACE', 'la police cherche encore l’autre voiture', false, 'blue'); }
    if (best.kind === 'traffic') { stats.thefts++; if (!offence('vol', 300, 1, 70)) A.popup('🔑 VOITURE EMPRUNTÉE', taxi.vname + ' · ton taxi t’attend (point jaune sur la carte)', false, 'gold'); }
    else if (taxi === homeTaxi) A.popup('🚕 DE RETOUR DANS TON TAXI', 'les clients t’attendent', false, 'gold');
  }
  const VNAME = { civil: 'Ford Mondeo', suv: 'Audi RS Q8', taxi2: 'Taxi Mondeo', box: 'Camion', cist: 'Camion-citerne', flat: 'Camion plateau' };
  function stealCar(c) {
    const t = c.t, i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1); freeCar(c);
    const dr = DRIVERS[T.driver], truck = /^(box|cist|flat)$/.test(c.type);
    const mdl = buildVehModel(t.build ? { build: t.build, paint: c.hex || 0xffffff, char: dr.char } : { car: t.node, tint: t.tint ? c.col : undefined, char: truck ? null : dr.char }); // (camions : la cabine cache le chauffeur)
    root.add(mdl.root);
    const spec = A.makeSpec('race', { engine: 0, tires: 0, nitro: 0 }, 'audi');
    Object.assign(spec, truck ? { power: 6.6, maxSpeed: 20, grip: 6.8, driftGrip: 2.2, steer: 1.8, latMax: 9.5, offGrip: 1, nitroDrain: 0.3, nitroPower: 4 }
      : c.type === 'suv' ? { power: 11.8, maxSpeed: 33, grip: 8.6, driftGrip: 1.9, steer: 2.3, latMax: 14, offGrip: 1, nitroDrain: 0.28, nitroPower: 6.5 }
      : { power: 9.6, maxSpeed: 28, grip: 8.0, driftGrip: 1.9, steer: 2.3, latMax: 13, offGrip: 1, nitroDrain: 0.28, nitroPower: 6 });
    const car = A.newCar({ isPlayer: true, name: 'Voiture empruntée', carId: truck ? 'hellcat' : c.type === 'suv' ? 'audi' : 's15', spec, hl: t.hl, hw: t.hw, nitro: 0.25 });
    Object.assign(car, { x: c.x, z: c.z, h: c.h, vx: 0, vz: 0, w: 0, y: 0, model: null, hp: truck ? 170 : 100, hpMax: truck ? 170 : 100, vname: VNAME[c.type] || 'Voiture' });
    // le conducteur s'enfuit en courant
    const sx = Math.cos(c.h), sz = -Math.sin(c.h), names = HUMANS.filter(n => WM[n] && WM[n].used < WM[n].cap);
    if (names.length) { const p = newPed('ped', pick(names)); if (p) { const px = c.x + sx * (c.hw + 0.9), pz = c.z + sz * (c.hw + 0.9); Object.assign(p, { st: 'alight', t: 0, x: px, z: pz, cx1: px + sx * 7, cz1: pz + sz * 7, on: true, road: true }); } }
    say(pick(['Hé ! Ma voiture !!', 'Au voleur ! Au voleur !', 'Wallahi, rends-moi ma voiture !']));
    return { car, model: mdl };
  }
  function backHome() { // retour au taxi (après une arrestation)
    if (taxi !== homeTaxi) { if (!parked.some(v => v.car === taxi)) parked.push({ car: taxi, model: taxiModel }); taxi.parked = true; const i = parked.findIndex(v => v.car === homeTaxi); if (i >= 0) parked.splice(i, 1); taxi = homeTaxi; taxiModel = homeModel; }
    foot.on = false; foot.hp = 100; foot.down = 0; me = taxi; taxi.parked = false; taxi.dead = false; taxi.hp = taxi.hpMax || 100;
    if (taxiModel && taxiModel.driver) taxiModel.driver.visible = true;
    if (A.attachHeadlights && taxiModel) A.attachHeadlights(taxiModel);
    A.camState.init = false; chaseT = 0;
  }
  function footStep(inp, dt) {
    const f = foot;
    if (f.down > 0) { f.down -= dt; f.v = 0; f.vx *= Math.exp(-dt * 5); f.vz *= Math.exp(-dt * 5); }
    else {
      const run = inp.nitro || inp.hb, fwd = (inp.thr || 0) - (inp.brk || 0);
      f.h += (inp.steer || 0) * dt * (run ? 2.2 : 2.8);
      const want = fwd > 0.05 ? fwd * (run ? 5.8 : 2.1) : fwd < -0.05 ? -1.3 : 0;
      f.v += (want - f.v) * Math.min(1, dt * 7);
      f.vx = Math.sin(f.h) * f.v; f.vz = Math.cos(f.h) * f.v;
    }
    f.x += f.vx * dt; f.z += f.vz * dt;
    collideCircle(f, 0, 0, 0.34);
    const cx = Math.floor(f.x / DCELL), cz = Math.floor(f.z / DCELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = DYN.get((cx + a) * 4096 + cz + b); if (!l) continue; for (const o of l) {
      if (o === f || o.hl === undefined || o.kind) continue;
      const before = obbDist(f.x, f.z, o); if (before > 0.36) continue;
      const vs = Math.abs(o.speed !== undefined ? o.speed : o.v || 0);
      circleOBB(f, 0, 0, 0.36, o);
      if (vs > 4.5 && f.down <= 0) knockDown(o, vs);
    } }
    f.speed = Math.hypot(f.vx, f.vz);
    if (f.M) { f.ph += Math.abs(f.v) * dt / f.M.stride; f.idle += ((Math.abs(f.v) > 0.15 && f.down <= 0 ? 0 : 1) - f.idle) * Math.min(1, dt * 6); }
  }
  function knockDown(o, vs) { // renversé par une voiture
    foot.down = 2.4; const k = Math.min(9, vs * 0.6), dx = foot.x - o.x, dz = foot.z - o.z, d = Math.hypot(dx, dz) || 1;
    foot.vx = dx / d * k; foot.vz = dz / d * k; foot.v = 0;
    hurt(10 + vs * 2.2); A.crashSound(0.35); A.shake(0.6);
    if (o.chaser && foot.hp > 0) { arrested(); A.popup('PLAQUÉ PAR LA POLICE', 'fin de la cavale', true); }
  }
  function hurt(dmg) {
    if (!foot.on) return;
    foot.hp -= dmg; hurtT = 0.45; A.shake(0.25); stats.hits++;
    if (foot.hp <= 0) { foot.hp = 0; arrested(true); }
  }
  function updateFootCam(dt) {
    const f = foot, cam = A.camera;
    if (!footCam.init) { footCam.yaw = f.h; footCam.pos.set(f.x - Math.sin(f.h) * 4.6, 2.3, f.z - Math.cos(f.h) * 4.6); footCam.init = true; }
    footCam.yaw += wrapAng(f.h - footCam.yaw) * (1 - Math.exp(-dt * 4.5));
    const y0 = onSidewalk(f.x, f.z) ? 0.15 : 0, d = f.down > 0 ? 5.5 : 4.6;
    _v.set(f.x - Math.sin(footCam.yaw) * d, 2.25 + y0 + (f.down > 0 ? 1.2 : 0), f.z - Math.cos(footCam.yaw) * d);
    footCam.pos.lerp(_v, footCam.pos.distanceTo(_v) > 30 ? 1 : 1 - Math.exp(-dt * 8));
    cam.position.copy(footCam.pos);
    A.camShakeApply && A.camShakeApply(cam);
    cam.lookAt(f.x + Math.sin(f.h) * 1.6, 1.25 + y0, f.z + Math.cos(f.h) * 1.6);
    if (Math.abs(cam.fov - 58) > 0.1) { cam.fov = lerp(cam.fov, 58, Math.min(1, dt * 4)); cam.updateProjectionMatrix(); }
  }
  function drawFoot() {
    if (!foot.on || !foot.M) return;
    const y0 = onSidewalk(foot.x, foot.z) ? 0.15 : 0.02;
    if (foot.down > 0) { const k = Math.min(1, (2.4 - foot.down) * 5); _q.setFromEuler(_e.set(-Math.PI / 2 * k, foot.h, 0, 'YXZ')); drawPed(foot.M, foot.x, y0 + 0.12 * k, foot.z, _q, foot.ph, 1, NO_TINT); }
    else { _q.setFromAxisAngle(_Y, foot.h); drawPed(foot.M, foot.x, y0, foot.z, _q, foot.ph, foot.idle, NO_TINT); }
  }

  /* ======================= Tirs de la police ======================= */
  let SFX = null;
  function buildShotFx() { // traçantes (fines baguettes lumineuses) + éclairs de canon
    const N = 10, mat = new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0, 0.5);
    const tr = []; for (let k = 0; k < N; k++) { const m = new THREE.Mesh(geo, mat); m.visible = false; m.frustumCulled = false; root.add(m); tr.push({ m, t: 0 }); }
    const flashes = [];
    for (let k = 0; k < 4; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: A.glowSpriteTex, color: 0xffc46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.visible = false; sp.scale.setScalar(2.8); root.add(sp); flashes.push({ sp, t: 0 }); }
    SFX = { tr, k: 0, flashes, fk: 0, shots: 0 };
  }
  function shotFx(ox, oy, oz, tx, ty, tz) {
    if (!SFX) return;
    const t = SFX.tr[SFX.k = (SFX.k + 1) % SFX.tr.length], L = Math.hypot(tx - ox, ty - oy, tz - oz) || 1;
    t.o = [ox, oy, oz]; t.d = [(tx - ox) / L, (ty - oy) / L, (tz - oz) / L]; t.L = L; t.sl = Math.min(7, L * 0.6); t.life = t.t = 0.1;
    t.m.position.set(ox, oy, oz); t.m.lookAt(tx, ty, tz); t.m.scale.set(0.075, 0.075, t.sl); t.m.visible = true; // une balle lumineuse qui file vers la cible
    const fl = SFX.flashes[SFX.fk = (SFX.fk + 1) % SFX.flashes.length]; fl.sp.position.set(ox, oy, oz); fl.sp.visible = true; fl.t = 0.07;
    SFX.shots++;
  }
  function updateShotFx(dt) {
    if (!SFX || (TEST && T.freezeFx)) return;
    for (const t of SFX.tr) if (t.t > 0) { t.t -= dt; if (t.t <= 0) { t.m.visible = false; continue; } const k = (1 - t.t / t.life) * Math.max(0, t.L - t.sl); t.m.position.set(t.o[0] + t.d[0] * k, t.o[1] + t.d[1] * k, t.o[2] + t.d[2] * k); }
    for (const f of SFX.flashes) if (f.t > 0) { f.t -= dt; if (f.t <= 0) f.sp.visible = false; }
    if (hurtT > 0) hurtT -= dt;
    const el = $('txHurt'); if (el) { const o = clamp(hurtT / 0.45, 0, 1) * 0.85 + (foot.on && foot.hp < 35 ? 0.25 + 0.1 * Math.sin(A.menuTime() * 6) : 0); if (Math.abs((+el.dataset.o || 0) - o) > 0.02) { el.dataset.o = o; el.style.opacity = o.toFixed(2); } }
  }
  function bang(x, z) { // détonation : bruit blanc filtré, atténué avec la distance
    const ac = A.audio && A.audio.ctx; if (!ac || prof.muted) return;
    const d = me ? Math.hypot(x - me.x, z - me.z) : 0, g0 = 0.5 * clamp(1 - d / 160, 0, 1); if (g0 < 0.01) return;
    if (!snd.noise) { const n = ac.sampleRate * 0.25, b = ac.createBuffer(1, n, ac.sampleRate), c = b.getChannelData(0); for (let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2); snd.noise = b; }
    const t = ac.currentTime, src = ac.createBufferSource(); src.buffer = snd.noise;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400 + Math.random() * 1200;
    const g = ac.createGain(); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(f); f.connect(g); g.connect(A.audio.master || ac.destination); src.start(t); src.stop(t + 0.25);
  }
  function ptInPoly(P_, x, z) { let ins = false; const n = P_.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const ax = P_[2 * j], az = P_[2 * j + 1], bx = P_[2 * i], bz = P_[2 * i + 1]; if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) ins = !ins; } return ins; }
  function lineBlocked(ax, az, bx, bz) { // un immeuble entre le policier et toi ?
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5);
    for (let k = 1; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; for (const o of nearCols(x, z, _cols)) if (o.box && x > o.box[0] && x < o.box[2] && z > o.box[1] && z < o.box[3] && (o.h === undefined || o.h > 1.2) && (!o.poly || ptInPoly(o.poly, x, z))) return true; }
    return false;
  }
  function policeFire(pc, d, dt) { // retourne true si l'arrestation a eu lieu
    const armed = wanted >= 2 || chaseT > 12;
    if (!armed || d > 42) { pc.fire = Math.max(pc.fire || 0, 0.6); return false; }
    pc.fire = (pc.fire === undefined ? 0.9 : pc.fire) - dt;
    if (pc.fire > 0) return false;
    pc.fire = 0.45 + R() * 0.85;
    const c = pc.car, sx = Math.cos(c.h), sz = -Math.sin(c.h), side = ((me.x - c.x) * sx + (me.z - c.z) * sz) >= 0 ? 1 : -1;
    const ox = c.x + sx * side * 1.25 + Math.sin(c.h) * 0.3, oz = c.z + sz * side * 1.25 + Math.cos(c.h) * 0.3, oy = 1.4; // le policier tire par la vitre
    if (lineBlocked(ox, oz, me.x, me.z)) return false;
    if (!shootWarned) { shootWarned = true; A.popup('🔫 LA POLICE TIRE !', foot.on ? 'cours, cache-toi, vole une voiture !' : 'sème-les ou abandonne la voiture', true); }
    const hitP = clamp(0.62 - d / 70 - me.speed / 40 + (foot.on ? 0.12 : 0), 0.06, 0.72), hit = R() < hitP;
    let ix, iy, iz;
    if (hit) { ix = me.x + (R() - 0.5) * 0.6; iz = me.z + (R() - 0.5) * 0.6; iy = foot.on ? 1.1 : 0.9; }
    else { const a = R() * 6.28, r = 1.2 + R() * 2.5; ix = me.x + Math.cos(a) * r; iz = me.z + Math.sin(a) * r; iy = 0.05 + R() * 1.4; }
    shotFx(ox, oy, oz, ix, iy, iz); bang(ox, oz);
    const nx_ = ox - ix, nz_ = oz - iz, nl = Math.hypot(nx_, nz_) || 1;
    if (hit && foot.on) { hurt(13 + R() * 9); return !foot.on || foot.hp <= 0; }
    if (hit) { // impact sur la carrosserie : étincelles, petite bosse, le moteur finit par lâcher
      A.crashFx(ix, iy, iz, nx_ / nl, nz_ / nl, 4.2); if (taxiModel) A.dentModel(taxiModel, ix, iy, iz, -nx_ / nl, -nz_ / nl, 4.8);
      taxi.hp = (taxi.hp === undefined ? 100 : taxi.hp) - (7 + R() * 5); A.shake(0.2); stats.hits++;
      if (taxi.hp <= 0 && !taxi.dead) { taxi.hp = 0; taxi.dead = true; A.popup('💥 MOTEUR TOUCHÉ', 'la voiture est fichue : descends (F) et trouve-en une autre !', true); }
    } else A.crashFx(ix, Math.max(0.05, iy), iz, nx_ / nl, nz_ / nl, 3.6);
    return false;
  }

  /* ======================= Sons : klaxon, sirène ======================= */
  const snd = {};
  function honk(x, z, vol) { // klaxon (joueur ou IA) atténué avec la distance
    const au = A.audio; if (!au.ctx || prof.muted) return;
    const d = me ? Math.hypot(x - me.x, z - me.z) : 0, g0 = (vol || 1) * 0.16 * clamp(1 - d / 140, 0, 1); if (g0 < 0.005) return;
    try {
      const ctx = au.ctx, t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0, t + 0.02);
      const dur = x === taxi.x ? 0.5 : 0.28 + Math.random() * 0.3; g.gain.setValueAtTime(g0, t + dur); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.08);
      const base = x === taxi.x ? 392 : 330 + Math.random() * 160;
      for (const m of [1, 1.26]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base * m; o.connect(f); o.start(t); o.stop(t + dur + 0.1); }
      f.connect(g); g.connect(au.master);
    } catch (e) {}
  }
  function sirenOn(on) {
    const au = A.audio; if (!au.ctx) return;
    if (on && !snd.siren) {
      try { const ctx = au.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'square'; o.frequency.value = 900; f.type = 'lowpass'; f.frequency.value = 2600; g.gain.value = 0; lfo.type = 'sine'; lfo.frequency.value = 0.65; lg.gain.value = 330; lfo.connect(lg); lg.connect(o.frequency); o.connect(f); f.connect(g); g.connect(au.master); o.start(); lfo.start(); snd.siren = { o, g, lfo }; } catch (e) {}
    }
    if (snd.siren && !on) snd.siren.g.gain.setTargetAtTime(0, au.ctx.currentTime, 0.1);
  }
  function sirenAmb(on) {
    const au = A.audio; if (!au.ctx) return;
    if (on && !snd.amb) {
      try { const ctx = au.ctx, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'square'; o.frequency.value = 860; f.type = 'lowpass'; f.frequency.value = 2400; g.gain.value = 0; lfo.type = 'square'; lfo.frequency.value = 0.9; lg.gain.value = 95; lfo.connect(lg); lg.connect(o.frequency); o.connect(f); f.connect(g); g.connect(au.master); o.start(); lfo.start(); snd.amb = { o, g }; } catch (e) {}
    }
    if (snd.amb && !on) snd.amb.g.gain.setTargetAtTime(0, au.ctx.currentTime, 0.1);
  }
  function updateSiren() {
    if (snd.amb && A.audio.ctx) { const d = amb.car ? Math.hypot(amb.car.x - me.x, amb.car.z - me.z) : 1e9; snd.amb.g.gain.setTargetAtTime(amb.st !== 'off' && T.active && A.state === 'play' && !prof.muted ? 0.05 * clamp(1 - d / 300, 0.05, 1) : 0, A.audio.ctx.currentTime, 0.15); }
    if (!snd.siren || !A.audio.ctx) return;
    let d = 1e9; for (const pc of chasers) d = Math.min(d, Math.hypot(pc.car.x - me.x, pc.car.z - me.z));
    const v = chasers.length && T.active && A.state === 'play' && !prof.muted ? 0.07 * clamp(1 - d / 320, 0.1, 1) : 0;
    snd.siren.g.gain.setTargetAtTime(v, A.audio.ctx.currentTime, 0.15);
  }
  T.horn = () => {
    if (!taxi || A.state !== 'play' || foot.on) return;
    if (T.hornCd > 0) return; T.hornCd = 0.45;
    A.initAudio(); honk(taxi.x, taxi.z, 1.2);
    const fx = Math.sin(taxi.h), fz = Math.cos(taxi.h);
    for (const p of peds) {
      if (!p.on) continue;
      const rx = p.x - taxi.x, rz = p.z - taxi.z, f = rx * fx + rz * fz, d = Math.hypot(rx, rz);
      if (d > 30 || f < -3) continue;
      if (p.road && p.st === 'cross') { // le piéton file vers le trottoir le plus proche
        const t = clamp(p.t, 0, 1), back = t < 0.5, tx = back ? p.cx0 : p.cx1, tz = back ? p.cz0 : p.cz1;
        if (back) { p.nbi = p.bi; p.nbj = p.bj; p.np = p.p; }
        p.cx0 = p.x; p.cz0 = p.z; p.cx1 = tx; p.cz1 = tz; p.t = 0; p.st = 'flee';
      }
      else if (p.st === 'walk') p.run = 1.6;
      else if (p.st === 'wait') p.wave = true;
    }
  };
  /* ======================= Nouakchott réelle (rues et bâtiments d'OpenStreetMap) ======================= */
  // Carte à l'échelle 1 : x vers l'est, z vers le sud, en mètres (origine 18.088 N, 15.993 O). Données : data/nkc_real.js
  let REAL = false, RD = null, rReady = false, gridStatic = [], rLampIM = null, rLampGlow = null;
  let rBase = false, rStaticT = null, rStaticR = null, RM = null, rRaceGlow = null, rTgt = null; // RM : emprise du circuit de course (bâtiments retirés)
  const RCULL_R = [];
  const rAdd = c => { if (!rTgt || !rTgt.race) addCol(c); };
  const realG = new THREE.Group(); realG.name = 'realCity'; realG.visible = false;
  const RCULL = [], RSTOPS = [], RPLACES = [], RHEADS = [];
  const RW_W = [16, 14, 12, 10, 7, 5, 4], RW_V = [16, 14.5, 13, 11.5, 8.6, 6, 4.5], R_CELL = 64;
  const rKey = (cx, cz) => (cx + 2048) * 4096 + (cz + 2048);
  function rDec(s, Tp) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Tp(u.buffer); }
  function rLoadData(cb) { // chargé seulement quand on choisit la carte réelle
    if (window.DZ_REAL) return cb(true);
    const s = document.createElement('script'); s.src = 'data/nkc_real.js'; s.onload = () => cb(!!window.DZ_REAL); s.onerror = () => cb(false); document.head.appendChild(s);
  }
  function rDecode(D) {
    const nd = rDec(D.nodes, Int16Array), NN = nd.length / 2, NX = new Float32Array(NN), NZ = new Float32Array(NN);
    const QN = D.v >= 2 ? 0.5 : 0.25; // pas de quantification des nœuds et des routes
    for (let i = 0; i < NN; i++) { NX[i] = nd[2 * i] * QN; NZ[i] = nd[2 * i + 1] * QN; }
    const ea = rDec(D.ea, Uint16Array), ec = rDec(D.ec, Uint8Array), en = rDec(D.en, Uint16Array), ecnt = rDec(D.ecnt, Uint16Array), ep = rDec(D.ep, Int16Array);
    const E = [], inc = Array.from({ length: NN }, () => []);
    let po = 0;
    for (let k = 0; k < ec.length; k++) {
      const a = ea[2 * k], b = ea[2 * k + 1], cnt = ecnt[k], pts = new Float32Array((cnt + 2) * 2);
      pts[0] = NX[a]; pts[1] = NZ[a];
      for (let i = 0; i < cnt; i++) { pts[2 + 2 * i] = ep[(po + i) * 2] * QN; pts[3 + 2 * i] = ep[(po + i) * 2 + 1] * QN; }
      po += cnt; pts[2 * cnt + 2] = NX[b]; pts[2 * cnt + 3] = NZ[b];
      const cum = new Float32Array(cnt + 2); for (let i = 1; i < cnt + 2; i++) cum[i] = cum[i - 1] + Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
      const cl = ec[k] & 7, link = !!(ec[k] & 8), pv = (ec[k] >> 4) & 3, ow = !!(ec[k] & 64);
      const w = RW_W[cl] * (link ? 0.7 : 1) * (ow && cl <= 3 && !link ? 0.62 : 1);
      let pv2 = pv;
      if (pv === 2) { // revêtement inconnu : goudron dans les quartiers bitumés (Tevragh Zeina, Capitale, Ksar), sable ailleurs
        const mx = (NX[a] + NX[b]) / 2, mz = (NZ[a] + NZ[b]) / 2; let q = null, bd = 1e9; for (const Q of D.quart) { const dd = Math.hypot(Q[1] - mx, Q[2] - mz); if (dd < bd) { bd = dd; q = Q; } }
        pv2 = q && (q[3] === 'Tevragh Zeina' || q[3] === 'Ksar') && !/Socogim PS|Centrale/.test(q[0]) ? 1 : 0;
      }
      E.push({ k, a, b, cl, link, pv: pv2, ow, name: D.names[en[k]] || '', ar: D.ar[en[k]] || '', pts, cum, L: cum[cnt + 1], w });
      inc[a].push(k); inc[b].push(k);
    }
    // rayon de chaque carrefour (où les voies s'arrêtent), feux, noms
    const rn = new Float32Array(NN), sig = new Uint8Array(NN), ofs = new Float32Array(NN), axis = new Float32Array(NN), busy = new Float32Array(NN).fill(-99), carN = new Array(NN);
    for (let n = 0; n < NN; n++) { const l = inc[n]; if (l.length >= 3) { let m = 0; for (const k of l) m = Math.max(m, E[k].w / 2); rn[n] = m + 1.2; } }
    for (const n of D.sig) {
      sig[n] = 1; ofs[n] = (n * 7.31) % CYC;
      let best = null; for (const k of inc[n]) if (!best || E[k].cl < best.cl) best = E[k];
      const t = rTan(best, best.a === n ? 0 : best.L); axis[n] = Math.atan2(t[0], t[1]);
    }
    for (const [n, nm, ar] of D.carn) carN[n] = [nm, ar];
    // index spatial : arêtes et nœuds par cellule
    const idx = new Map(), nidx = new Map();
    for (const e of E) {
      const P_ = e.pts, seen = new Set();
      for (let i = 0; i < P_.length / 2 - 1; i++) {
        const x0 = Math.min(P_[2 * i], P_[2 * i + 2]) - e.w, x1 = Math.max(P_[2 * i], P_[2 * i + 2]) + e.w, z0 = Math.min(P_[2 * i + 1], P_[2 * i + 3]) - e.w, z1 = Math.max(P_[2 * i + 1], P_[2 * i + 3]) + e.w;
        for (let cx = Math.floor(x0 / R_CELL); cx <= Math.floor(x1 / R_CELL); cx++) for (let cz = Math.floor(z0 / R_CELL); cz <= Math.floor(z1 / R_CELL); cz++) { const kk = rKey(cx, cz); if (seen.has(kk)) continue; seen.add(kk); let l = idx.get(kk); if (!l) idx.set(kk, l = []); l.push(e.k); }
      }
    }
    for (let n = 0; n < NN; n++) { const kk = rKey(Math.floor(NX[n] / R_CELL), Math.floor(NZ[n] / R_CELL)); let l = nidx.get(kk); if (!l) nidx.set(kk, l = []); l.push(n); }
    // bâtiments
    const bn = rDec(D.bn, Uint8Array), bh = rDec(D.bh, Uint8Array), bt = rDec(D.bt, Uint8Array), boff = new Uint32Array(bn.length + 1);
    for (let i = 0; i < bn.length; i++) boff[i + 1] = boff[i] + bn[i];
    const pts = (raw, n, off) => { // coordonnées en mètres (v2 : 1er point à 0,5 m puis écarts à 0,25 m)
      const out = new Float32Array(raw.length);
      if (D.v < 2) { for (let i = 0; i < raw.length; i++) out[i] = raw[i] * 0.25; return out; }
      for (let i = 0; i < n.length; i++) { let o = off[i] * 2, x = raw[o] * 0.5, z = raw[o + 1] * 0.5; out[o] = x; out[o + 1] = z; for (let k = 1; k < n[i]; k++) { o += 2; x += raw[o] * 0.25; z += raw[o + 1] * 0.25; out[o] = x; out[o + 1] = z; } }
      return out;
    };
    const bp = pts(rDec(D.bp, Int16Array), bn, boff);
    const wn = D.wn ? rDec(D.wn, Uint8Array) : new Uint8Array(0), woff = new Uint32Array(wn.length + 1);
    for (let i = 0; i < wn.length; i++) woff[i + 1] = woff[i] + wn[i];
    const wp = D.wp ? pts(rDec(D.wp, Int16Array), wn, woff) : new Float32Array(0);
    return { NN, NX, NZ, E, inc, rn, sig, ofs, axis, busy, carN, idx, nidx, bld: { n: bn, h: bh, t: bt, p: bp, off: boff }, walls: { n: wn, p: wp, off: woff }, box: D.box, coast: D.coast, lm: D.lm, dest: D.dest, stops: D.stops, quart: D.quart };
  }
  // point et tangente sur une arête (s depuis a)
  function rAt(e, s) {
    const c = e.cum, p = e.pts; s = clamp(s, 0, e.L); let i = 1; while (i < c.length - 1 && c[i] < s) i++;
    const t = (s - c[i - 1]) / ((c[i] - c[i - 1]) || 1), ax = p[2 * i - 2], az = p[2 * i - 1], bx = p[2 * i], bz = p[2 * i + 1], L = Math.hypot(bx - ax, bz - az) || 1;
    return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / L, (bz - az) / L];
  }
  function rTan(e, s) { const q = rAt(e, s); return [q[2], q[3]]; }
  // voies : décalages à droite du sens de marche
  function rLanes(e) { if (e.ow) return e.w >= 8 ? [-e.w * 0.22, e.w * 0.22] : [0]; return e.w >= 12 ? [e.w * 0.14, e.w * 0.36] : [e.w * 0.25]; }
  function rTrim(e) { // portion utilisable d'une arête (hors carrefours)
    let s0 = RD.rn[e.a], s1 = e.L - RD.rn[e.b];
    if (s1 - s0 < 3) { s0 = e.L * 0.35; s1 = e.L * 0.65; }
    return [s0, s1];
  }
  function rLanePts(e, dir, o, s0, s1) { // polyligne de la voie (sens dir), décalée de o à droite, entre s0 et s1 (abscisses sur a->b)
    const out = [], c = e.cum, P_ = e.pts, n = c.length;
    const push = s => { const q = rAt(e, s); const tx = q[2] * dir, tz = q[3] * dir; out.push(q[0] - tz * o, q[1] + tx * o); };
    if (dir > 0) { push(s0); for (let i = 1; i < n - 1; i++) if (c[i] > s0 + 0.5 && c[i] < s1 - 0.5) { const tx0 = P_[2 * i] - P_[2 * i - 2], tz0 = P_[2 * i + 1] - P_[2 * i - 1], tx1 = P_[2 * i + 2] - P_[2 * i], tz1 = P_[2 * i + 3] - P_[2 * i + 1], l0 = Math.hypot(tx0, tz0) || 1, l1 = Math.hypot(tx1, tz1) || 1; let mx = tx0 / l0 + tx1 / l1, mz = tz0 / l0 + tz1 / l1; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const k = 1 / Math.max(0.5, mx * tx1 / l1 + mz * tz1 / l1); out.push(P_[2 * i] - mz * o * k, P_[2 * i + 1] + mx * o * k); } push(s1); }
    else { push(s1); for (let i = n - 2; i >= 1; i--) if (c[i] > s0 + 0.5 && c[i] < s1 - 0.5) { const tx0 = P_[2 * i] - P_[2 * i + 2], tz0 = P_[2 * i + 1] - P_[2 * i + 3], tx1 = P_[2 * i - 2] - P_[2 * i], tz1 = P_[2 * i - 1] - P_[2 * i + 1], l0 = Math.hypot(tx0, tz0) || 1, l1 = Math.hypot(tx1, tz1) || 1; let mx = tx0 / l0 + tx1 / l1, mz = tz0 / l0 + tz1 / l1; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const k = 1 / Math.max(0.5, mx * tx1 / l1 + mz * tz1 / l1); out.push(P_[2 * i] - mz * o * k, P_[2 * i + 1] + mx * o * k); } push(s0); }
    return out;
  }
  function rEdgesNear(x, z, r, out) { out.length = 0; const s = new Set(); for (let cx = Math.floor((x - r) / R_CELL); cx <= Math.floor((x + r) / R_CELL); cx++) for (let cz = Math.floor((z - r) / R_CELL); cz <= Math.floor((z + r) / R_CELL); cz++) { const l = RD.idx.get(rKey(cx, cz)); if (l) for (const k of l) if (!s.has(k)) { s.add(k); out.push(k); } } return out; }
  const _re = [];
  function rNearest(x, z, maxD, maxCl) { // arête la plus proche : { e, s, d, side, px, pz, tx, tz }
    let best = null; maxCl = maxCl === undefined ? 5 : maxCl;
    for (const k of rEdgesNear(x, z, maxD, _re)) {
      const e = RD.E[k]; if (e.cl > maxCl) continue; const P_ = e.pts;
      for (let i = 0; i < P_.length / 2 - 1; i++) {
        const ax = P_[2 * i], az = P_[2 * i + 1], dx = P_[2 * i + 2] - ax, dz = P_[2 * i + 3] - az, l2 = dx * dx + dz * dz || 1;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz) - e.w / 2;
        if (d < maxD && (!best || d < best.d)) { const l = Math.sqrt(l2); best = { e, s: e.cum[i] + t * l, d, px, pz, tx: dx / l, tz: dz / l, side: (x - px) * (-dz / l) + (z - pz) * (dx / l) >= 0 ? 1 : -1 }; }
      }
    }
    return best;
  }
  const rOnRoad = (x, z) => { const q = rNearest(x, z, 2); return !!q && q.d < 0.3; };
  function rNodesNear(x, z, r) { const out = []; for (let cx = Math.floor((x - r) / R_CELL); cx <= Math.floor((x + r) / R_CELL); cx++) for (let cz = Math.floor((z - r) / R_CELL); cz <= Math.floor((z + r) / R_CELL); cz++) { const l = RD.nidx.get(rKey(cx, cz)); if (l) for (const n of l) if (Math.hypot(RD.NX[n] - x, RD.NZ[n] - z) < r) out.push(n); } return out; }

  /* --- itinéraires (A*) : police, ambulance, GPS --- */
  function rAstar(n0, n1, oneway) {
    const N = RD.NN, g = rAstar.g || (rAstar.g = new Float32Array(N)), from = rAstar.f || (rAstar.f = new Int32Array(N)), fe = rAstar.fe || (rAstar.fe = new Int32Array(N)), mark = rAstar.m || (rAstar.m = new Uint32Array(N));
    const stamp = rAstar.s = (rAstar.s || 0) + 1, X = RD.NX, Z = RD.NZ, tx = X[n1], tz = Z[n1];
    const heap = [], push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    mark[n0] = stamp; g[n0] = 0; from[n0] = -1; fe[n0] = -1; push(n0, Math.hypot(X[n0] - tx, Z[n0] - tz));
    let it = 0;
    while (heap.length && it++ < 250000) {
      const [, n] = pop(); if (n === n1) break;
      for (const k of RD.inc[n]) {
        const e = RD.E[k]; if (e.cl >= 6) continue; if (oneway && e.ow && e.a !== n) continue;
        const m = e.a === n ? e.b : e.a, cost = g[n] + e.L * (e.cl >= 5 ? 1.6 : e.pv === 1 ? 1 : 1.15) + 4;
        if (mark[m] !== stamp || cost < g[m]) { mark[m] = stamp; g[m] = cost; from[m] = n; fe[m] = k; push(m, cost + Math.hypot(X[m] - tx, Z[m] - tz)); }
      }
    }
    if (mark[n1] !== stamp) return null;
    const path = []; let n = n1; while (n !== n0 && n >= 0) { path.push([n, fe[n]]); n = from[n]; } path.reverse();
    return { path, len: g[n1] };
  }
  function rEndNode(x, z, h, tx, tz) { // nœud de départ : bout de l'arête courante dans la direction voulue
    const q = rNearest(x, z, 60, 5); if (!q) return null;
    const e = q.e, fwd = Math.sin(h) * q.tx + Math.cos(h) * q.tz;
    const toA = Math.hypot(RD.NX[e.a] - tx, RD.NZ[e.a] - tz), toB = Math.hypot(RD.NX[e.b] - tx, RD.NZ[e.b] - tz);
    let n = (fwd >= 0 ? e.b : e.a); if (h === undefined) n = toA < toB ? e.a : e.b;
    return { n, q };
  }
  function rRoutePts(ax, az, bx, bz, h, oneway) { // liste de points [x,z] de a vers b par les rues
    const qa = rNearest(ax, az, 60, 5), qb = rNearest(bx, bz, 60, 5), direct = { pts: [[bx, bz]], len: Math.hypot(bx - ax, bz - az) };
    if (!qa || !qb) return direct;
    if (qa.e === qb.e) { // même rue : tout droit (demi-tour si la cible est derrière)
      const fwd = h === undefined ? 0 : Math.sin(h) * qa.tx + Math.cos(h) * qa.tz, ahead = (qb.s - qa.s) * (fwd >= 0 ? 1 : -1) >= -3;
      if (h === undefined || ahead || !oneway) return direct;
    }
    const ea = qa.e, eb = qb.e, X = RD.NX, Z = RD.NZ;
    const fwdA = h === undefined ? null : (Math.sin(h) * qa.tx + Math.cos(h) * qa.tz >= 0 ? ea.b : ea.a);
    const starts = fwdA !== null ? [fwdA] : ea.ow && oneway ? [ea.b] : [ea.a, ea.b];
    const ends = eb.ow && oneway ? [eb.a] : [eb.a, eb.b];
    let best = null;
    for (const n0 of starts) for (const n1 of ends) {
      const d0 = Math.abs((n0 === ea.a ? 0 : ea.L) - qa.s), d1 = Math.abs((n1 === eb.a ? 0 : eb.L) - qb.s);
      const r = n0 === n1 ? { path: [], len: 0 } : rAstar(n0, n1, oneway); if (!r) continue;
      const tot = r.len + d0 + d1; if (!best || tot < best.tot) best = { r, n0, n1, tot };
    }
    if (!best) return { pts: [[bx, bz]], len: direct.len * 1.3 };
    const pts = [[X[best.n0], Z[best.n0]]];
    for (const [n, k] of best.r.path) { const e = RD.E[k], P_ = e.pts, fw = e.b === n, m = P_.length / 2; if (fw) for (let i = 1; i < m - 1; i++) pts.push([P_[2 * i], P_[2 * i + 1]]); else for (let i = m - 2; i >= 1; i--) pts.push([P_[2 * i], P_[2 * i + 1]]); pts.push([X[n], Z[n]]); }
    pts.push([bx, bz]);
    return { pts, len: best.tot };
  }
  function rRoute(ax, az, bx, bz) { // pour la police et l'ambulance (sens uniques ignorés, gyrophare oblige)
    const c = Math.abs(ax - (taxi ? taxi.x : 0)) < 0.01 ? taxi : null; void c;
    return rRoutePts(ax, az, bx, bz, undefined, false).pts;
  }

  /* --- construction : sol, mer, routes, bâtiments, monuments, mobilier --- */
  function rBuildBase() {
    const D = window.DZ_REAL; RD = rDecode(D);
    const keepGrid = grid; grid = colMaps.real; // collisions de la carte réelle
    const [XA, ZA, XB, ZB] = RD.box;
    // sol de sable
    const gt = A.canvasTex(512, 512, (c, w, h) => { A.noise(c, w, h, '#d7b98c', 0.2, 22000); c.fillStyle = 'rgba(160,120,70,0.16)'; for (let k = 0; k < 40; k++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 40 + Math.random() * 60, 10 + Math.random() * 20, Math.random() * 3, 0, 6.3); c.fill(); } }, true);
    gt.repeat.set(180, 160); gt.anisotropy = 4;
    const GW = XB - XA + 3000, GH = ZB - ZA + 3000;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), A.surf({ map: gt, roughness: 1, envMapIntensity: 0.2 })); ground.rotation.x = -Math.PI / 2; ground.position.set((XA + XB) / 2 + 700, -0.02, (ZA + ZB) / 2); ground.receiveShadow = !LOW; realG.add(ground);
    // océan et plage, à l'ouest de la vraie ligne de côte
    const co = RD.coast.slice().sort((a, b) => a[1] - b[1]); co.unshift([co[0][0], ZA - 1600]); co.push([co[co.length - 1][0], ZB + 1600]);
    const op = [], oi = [], bp = [], bi_ = [], buv = [];
    co.forEach(([x, z], i) => { op.push(x - 4, 0.012, z, XA - 4000, 0.012, z); bp.push(x - 8, 0.01, z, x + 48, 0.004, z); buv.push(0, z / 30, 1, z / 30); if (i) { const b = (i - 1) * 2; oi.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); bi_.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } });
    const ot = A.canvasTex(256, 256, (c, w, h) => { A.noise(c, w, h, '#1f6382', 0.12, 9000); c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; for (let k = 0; k < 40; k++) { const y = Math.random() * h, x = Math.random() * w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 2); c.stroke(); } }, true); ot.repeat.set(0.02, 0.02);
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(op, 3)); og.setIndex(oi);
    const ouv = []; for (let i = 0; i < op.length; i += 3) ouv.push(op[i] / 40, op[i + 2] / 40); og.setAttribute('uv', new THREE.Float32BufferAttribute(ouv, 2)); og.computeVertexNormals();
    const oceanM = A.surf({ map: ot, roughness: 0.2, metalness: 0.2, envMapIntensity: 1.1, side: THREE.DoubleSide }); ot.repeat.set(1, 1);
    realG.add(new THREE.Mesh(og, oceanM));
    const btx = A.canvasTex(64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#f2f6f8'); g.addColorStop(0.12, '#bfd9dc'); g.addColorStop(0.3, '#d9bf8f'); g.addColorStop(1, '#e3c793'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, true);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2)); bg.setIndex(bi_); bg.computeVertexNormals();
    realG.add(new THREE.Mesh(bg, A.surf({ map: btx, roughness: 1, side: THREE.DoubleSide })));
    for (let i = 1; i < co.length; i++) { const [x0, z0] = co[i - 1], [x1, z1] = co[i]; addCol({ box: [Math.min(x0, x1) - 600, Math.min(z0, z1), Math.max(x0, x1) - 6, Math.max(z0, z1) + 1] }); }
    addCol({ box: [XA - 700, ZA - 900, XB + 900, ZA - 60] }); addCol({ box: [XA - 700, ZB + 60, XB + 900, ZB + 900] }); addCol({ box: [XB + 60, ZA - 900, XB + 900, ZB + 900] });
    rIndexChunks();
    grid = keepGrid;
    if (!realG.parent) root.add(realG);
    rBase = true;
  }
  function rBuild() { if (!rBase) rBuildBase(); if (!rStaticT) rStaticT = rBuildStatic(false); rReady = true; }
  function rBuildStatic(race) { // décor fixe : monuments, lampadaires, palmiers, panneaux (+ feux et arrêts pour le taxi)
    const g = new THREE.Group(); g.name = race ? 'realRaceDeco' : 'realTaxiDeco'; realG.add(g); g.visible = !race; g.userData.lms = [];
    const keepGrid = grid; grid = colMaps.real; rTgt = { g, cull: race ? RCULL_R : RCULL, race, lms: g.userData.lms }; rinst = {};
    rBuildLandmarks(); rBuildProps(); try { rBuildStreetLife(); } catch (e) { console.error('vie de rue', e && e.stack || e); } if (!race) { rBuildLights(); rBuildStops(); } rBuildSigns();
    rTgt = null; grid = keepGrid; return g;
  }
  function rBldMasked(i) { const Bd = RD.bld, n = Bd.n[i], o = Bd.off[i]; for (let k = 0; k < n; k++) { const k2 = (k + 1) % n, ax = Bd.p[2 * (o + k)], az = Bd.p[2 * (o + k) + 1], bx = Bd.p[2 * (o + k2)], bz = Bd.p[2 * (o + k2) + 1]; if (RM(ax, az) || RM((ax + bx) / 2, (az + bz) / 2)) return true; } return false; }
  function rChunkKey(x, z) { return Math.floor(x / 256) + ',' + Math.floor(z / 256); }
  function rAddChunkMesh(geo, mat, opt) {
    geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = !LOW; m.castShadow = !!(opt && opt.cast); if (opt && opt.order !== undefined) m.renderOrder = opt.order;
    realG.add(m); if (!opt || !opt.noCull) RCULL.push({ m, c: geo.boundingSphere.center.clone(), r: geo.boundingSphere.radius, d: (opt && opt.maxD) || (LITE ? 700 : 1300) }); return m;
  }
  /* --- façades de Nouakchott : atlas peint (portes, fenêtres à grilles, volets, boutiques, balcons, acrotères, portails) --- */
  const R_STY = [
    { walls: [0xd8c09a, 0xcdb08a, 0xe2cfae, 0xd6b994], frame: '#2f7d4f', door: '#2e6f47', shut: '#3b8a5a', glass: '#2b3a44' }, // 0 maison sable, menuiseries vertes
    { walls: [0xf1eee6, 0xe9e6de, 0xf4f0e6, 0xe6e2d8], frame: '#2a6db5', door: '#1f5fa8', shut: '#2f78c2', glass: '#24323d' }, // 1 maison blanche, menuiseries bleues
    { walls: [0xd2a35f, 0xc99a5a, 0xddb070, 0xcf9e64], frame: '#6b4426', door: '#5a3a22', shut: '#7a4f2c', glass: '#2c3238' }, // 2 maison ocre, bois
    { walls: [0xe6dcc8, 0xd8c7a6, 0xc9d3c0, 0xe7d9b8], frame: '#d9d9d9', door: '#8f969c', shut: '#9aa3aa', glass: '#2a3a46' }, // 3 commerces (rideaux métalliques, enseignes)
    { walls: [0xe8e0d0, 0xd9cfbd, 0xc8c0b0, 0xe2d4bd], frame: '#c8c8c8', door: '#3a4048', shut: '#bcc3c9', glass: '#3d5566' }, // 4 immeuble (balcons, climatiseurs)
    { walls: [0xf3ede2, 0xefe2cc, 0xf0d9c2, 0xf5efe6], frame: '#efe9dd', door: '#7a5230', shut: '#c9b38f', glass: '#2e4a5a' }, // 5 villa de Tevragh Zeina (arcs)
    { walls: [0xa9a49b, 0xb5afa4, 0x9f998f, 0xb9b2a6], frame: '#6b6b6b', door: '#5c6166', shut: '#777777', glass: '#1e2328' }, // 6 béton brut, en construction
    { walls: [0xe8c4b4, 0xcfdcc0, 0xe9dba4, 0xbcd2dd], frame: '#f2f2f2', door: '#2f7d4f', shut: '#f2f2f2', glass: '#28343c' }, // 7 maison pastel
  ];
  const R_GATE = ['#2e6f47', '#1f5fa8', '#c0392b', '#d4a017', '#2f7d4f', '#5c6166', '#1f8a8a', '#7a5230'];
  const R_SIGN = [['#f2c200', '#1b1b1b'], ['#0a8f3c', '#ffffff'], ['#c0392b', '#ffffff'], ['#1f5fa8', '#ffffff'], ['#ffffff', '#c0392b'], ['#ff7a00', '#ffffff']];
  function rAtlas() {
    const S = LOW ? 64 : 128, W = S * 8;
    return A.canvasTex(W, W, (c) => {
      c.clearRect(0, 0, W, W);
      let rs = 12345; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        const st = R_STY[row], x0 = col * S, y0 = row * S, kx = S / 3.6, ky = S / 3.2;
        const X = xm => x0 + xm * kx, Y = ym => y0 + S - ym * ky;
        const rect = (xa, ya, xb, yb, f) => { c.fillStyle = f; c.fillRect(X(xa), Y(yb), (xb - xa) * kx, (yb - ya) * ky); };
        c.save(); c.beginPath(); c.rect(x0, y0, S, S); c.clip();
        // salissures légères (sable, pluie rare)
        for (let k = 0; k < 3; k++) { const g = c.createRadialGradient(X(rnd() * 3.6), Y(rnd() * 3.2), 1, X(rnd() * 3.6), Y(rnd() * 3.2), S * 0.4); g.addColorStop(0, 'rgba(90,70,45,0.07)'); g.addColorStop(1, 'rgba(90,70,45,0)'); c.fillStyle = g; c.fillRect(x0, y0, S, S); }
        const glass = (xa, ya, xb, yb) => { const g = c.createLinearGradient(X(xa), Y(yb), X(xb), Y(ya)); g.addColorStop(0, '#5f7a8a'); g.addColorStop(0.45, st.glass); g.addColorStop(1, '#151b20'); c.fillStyle = g; c.fillRect(X(xa), Y(yb), (xb - xa) * kx, (yb - ya) * ky); };
        const window_ = (xc, w, yb, h, o) => {
          o = o || {};
          rect(xc - w / 2 - 0.1, yb - 0.12, xc + w / 2 + 0.1, yb, 'rgba(235,228,214,1)'); // appui
          rect(xc - w / 2 - 0.08, yb + h, xc + w / 2 + 0.08, yb + h + 0.1, 'rgba(200,190,172,1)'); // linteau
          if (o.arch) { c.fillStyle = st.frame; c.beginPath(); c.moveTo(X(xc - w / 2 - 0.06), Y(yb)); c.lineTo(X(xc - w / 2 - 0.06), Y(yb + h - w / 2)); c.arc(X(xc), Y(yb + h - w / 2), (w / 2 + 0.06) * kx, Math.PI, 0); c.lineTo(X(xc + w / 2 + 0.06), Y(yb)); c.fill(); c.save(); c.beginPath(); c.moveTo(X(xc - w / 2), Y(yb)); c.lineTo(X(xc - w / 2), Y(yb + h - w / 2)); c.arc(X(xc), Y(yb + h - w / 2), w / 2 * kx, Math.PI, 0); c.lineTo(X(xc + w / 2), Y(yb)); c.clip(); glass(xc - w / 2, yb, xc + w / 2, yb + h); c.restore(); }
          else { rect(xc - w / 2 - 0.06, yb, xc + w / 2 + 0.06, yb + h, st.frame); glass(xc - w / 2, yb + 0.05, xc + w / 2, yb + h - 0.05); }
          c.strokeStyle = st.frame; c.lineWidth = Math.max(1, kx * 0.05); c.beginPath(); c.moveTo(X(xc), Y(yb)); c.lineTo(X(xc), Y(yb + h)); c.stroke();
          if (o.grille) { c.strokeStyle = 'rgba(25,30,34,0.9)'; c.lineWidth = Math.max(1, kx * 0.035); for (let k = 1; k < 6; k++) { const xx = xc - w / 2 + w * k / 6; c.beginPath(); c.moveTo(X(xx), Y(yb)); c.lineTo(X(xx), Y(yb + h - (o.arch ? w / 2 : 0))); c.stroke(); } c.beginPath(); c.moveTo(X(xc - w / 2), Y(yb + h * 0.5)); c.lineTo(X(xc + w / 2), Y(yb + h * 0.5)); c.stroke(); }
          if (o.shutters) { for (const sd of [-1, 1]) { rect(sd < 0 ? xc - w / 2 - 0.42 : xc + w / 2, yb, sd < 0 ? xc - w / 2 : xc + w / 2 + 0.42, yb + h, st.shut); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let k = 1; k < 8; k++) { const yy = yb + h * k / 8; c.beginPath(); c.moveTo(X(sd < 0 ? xc - w / 2 - 0.42 : xc + w / 2), Y(yy)); c.lineTo(X(sd < 0 ? xc - w / 2 : xc + w / 2 + 0.42), Y(yy)); c.stroke(); } } }
          if (o.ac) { rect(xc + w / 2 - 0.75, yb - 0.75, xc + w / 2 - 0.05, yb - 0.2, '#e6e6e2'); c.fillStyle = '#9a9a96'; for (let k = 0; k < 4; k++) c.fillRect(X(xc + w / 2 - 0.7), Y(yb - 0.3 - k * 0.11), 0.6 * kx, Math.max(1, ky * 0.03)); }
          if (o.balcony) { rect(xc - w / 2 - 0.35, yb - 0.05, xc + w / 2 + 0.35, yb + 0.05, 'rgba(210,205,195,1)'); c.strokeStyle = o.balcony; c.lineWidth = Math.max(1, kx * 0.04); c.strokeRect(X(xc - w / 2 - 0.3), Y(yb + 1.0), (w + 0.6) * kx, 1.0 * ky); for (let k = 0; k <= 10; k++) { const xx = xc - w / 2 - 0.3 + (w + 0.6) * k / 10; c.beginPath(); c.moveTo(X(xx), Y(yb)); c.lineTo(X(xx), Y(yb + 1.0)); c.stroke(); } }
        };
        const door = (xc, w, h, col_, o) => {
          o = o || {};
          rect(xc - w / 2 - 0.1, 0, xc + w / 2 + 0.1, h + 0.12, 'rgba(205,196,180,1)');
          if (o.arch) { c.fillStyle = col_; c.beginPath(); c.moveTo(X(xc - w / 2), Y(0)); c.lineTo(X(xc - w / 2), Y(h - w / 2)); c.arc(X(xc), Y(h - w / 2), w / 2 * kx, Math.PI, 0); c.lineTo(X(xc + w / 2), Y(0)); c.fill(); }
          else rect(xc - w / 2, 0, xc + w / 2, h, col_);
          c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = Math.max(1, kx * 0.03);
          if (o.leaves) { c.beginPath(); c.moveTo(X(xc), Y(0)); c.lineTo(X(xc), Y(h)); c.stroke(); }
          for (const yy of [0.3, h * 0.5, h - 0.3]) { c.strokeRect(X(xc - w / 2 + 0.1), Y(yy + 0.5), (w - 0.2) * kx, 0.4 * ky); }
          rect(xc + w / 2 - 0.22, 1.0, xc + w / 2 - 0.12, 1.12, '#d8c27a'); // poignée
          rect(xc - w / 2 - 0.2, 0, xc + w / 2 + 0.2, 0.12, 'rgba(190,182,168,1)'); // marche
        };
        const sign = (xa, xb, ya, yb, k) => { const [bg, fg] = R_SIGN[k % R_SIGN.length]; rect(xa, ya, xb, yb, bg); c.strokeStyle = fg; c.lineWidth = Math.max(1, ky * 0.06); c.lineCap = 'round'; c.beginPath(); for (let q = 0; q < 6; q++) { const xx = xa + 0.25 + q * (xb - xa - 0.5) / 6; c.moveTo(X(xx), Y((ya + yb) / 2 + (rnd() - 0.5) * 0.1)); c.quadraticCurveTo(X(xx + 0.12), Y(yb - 0.06), X(xx + 0.3), Y((ya + yb) / 2)); } c.stroke(); };
        const shutter = (xa, xb, h, col_) => { rect(xa, 0, xb, h, col_); c.fillStyle = 'rgba(0,0,0,0.16)'; for (let yy = 0.08; yy < h; yy += 0.12) c.fillRect(X(xa), Y(yy), (xb - xa) * kx, Math.max(1, ky * 0.025)); rect(xa - 0.08, 0, xa, h + 0.1, 'rgba(120,120,120,1)'); rect(xb, 0, xb + 0.08, h + 0.1, 'rgba(120,120,120,1)'); };
        const shopOpen = (xa, xb, h) => { rect(xa, 0, xb, h, '#1d1a17'); const cols = ['#c0392b', '#f2c200', '#1f8a8a', '#e67e22', '#ecf0f1', '#27ae60', '#8e44ad']; for (let q = 0; q < 14; q++) { const xx = xa + 0.1 + rnd() * (xb - xa - 0.4), yy = 0.2 + rnd() * (h - 0.6); rect(xx, yy, xx + 0.2 + rnd() * 0.25, yy + 0.15 + rnd() * 0.3, cols[q % cols.length]); } rect(xa, h - 0.08, xb, h, '#6b6b6b'); };
        // ---- tuiles : 0 mur nu · 1 porte · 2 fenêtre rez · 3 variante rez · 4/5 fenêtres d'étage · 6 acrotère · 7 portail de clôture
        if (col === 1) { if (row === 3) { shopOpen(0.5, 3.1, 2.5); sign(0.3, 3.3, 2.55, 3.05, row + 1); } else if (row === 4) { rect(0.6, 0, 3.0, 2.7, '#3d5566'); glass(0.7, 0.05, 2.9, 2.6); door(1.8, 1.0, 2.3, 'rgba(60,85,100,0.6)'); } else door(1.8, row === 6 ? 1.1 : 1.15, 2.3, st.door, { arch: row === 5, leaves: row !== 6 }); }
        else if (col === 2) { if (row === 3) { shutter(0.4, 3.2, 2.5, ['#9aa3aa', '#5d7f99', '#4f8a64', '#a7a39a'][Math.floor(rnd() * 4)]); sign(0.3, 3.3, 2.55, 3.05, row + 3); } else if (row === 6) rect(1.3, 1.0, 2.3, 1.9, '#1e2328'); else window_(1.8, 1.2, 1.0, 1.3, { grille: true, arch: row === 5 }); }
        else if (col === 3) { if (row === 3 || row === 4) { shutter(0.4, 3.2, 2.6, ['#5d7f99', '#9aa3aa', '#8a6d4f'][Math.floor(rnd() * 3)]); if (row === 3) sign(0.3, 3.3, 2.65, 3.1, row + 5); } else if (row === 5 || row === 1) { rect(0.4, 0, 3.2, 2.5, R_GATE[row]); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let xx = 0.5; xx < 3.2; xx += 0.2) c.fillRect(X(xx), Y(2.4), Math.max(1, kx * 0.03), 2.3 * ky); } else window_(1.8, 0.9, 1.4, 0.9, { grille: true }); }
        else if (col === 4) { if (row === 4) window_(1.8, 1.8, 0.9, 1.5, { balcony: '#d9d9d9' }); else if (row === 6) rect(1.2, 1.0, 2.4, 2.1, '#1e2328'); else window_(1.8, row === 5 ? 1.1 : 1.15, 1.0, 1.35, { grille: row !== 3, arch: row === 5, ac: row === 3 }); }
        else if (col === 5) { if (row === 4) { window_(1.0, 0.8, 1.0, 1.3, {}); window_(2.6, 0.8, 1.0, 1.3, { ac: true }); } else if (row === 6) { rect(0.6, 2.8, 3.0, 3.2, '#8c877e'); c.strokeStyle = '#5a4a3a'; for (let xx = 0.5; xx < 3.4; xx += 0.35) { c.beginPath(); c.moveTo(X(xx), Y(2.8)); c.lineTo(X(xx + 0.05), Y(3.2)); c.stroke(); } } else window_(1.8, 1.0, 1.0, 1.3, { shutters: row !== 3, grille: row === 3, arch: row === 5, balcony: row === 5 ? '#efe9dd' : null }); }
        else if (col === 6) { rect(0, 0, 3.6, 0.32 * 0.8 * 3.2 / 0.8 * 0.1, 'rgba(0,0,0,0.18)'); rect(0, 3.2 * 0.84, 3.6, 3.2, 'rgba(232,226,214,1)'); rect(0, 3.2 * 0.8, 3.6, 3.2 * 0.84, 'rgba(0,0,0,0.12)'); if (row === 5 || row === 2) { c.fillStyle = 'rgba(0,0,0,0.1)'; for (let xx = 0; xx < 3.6; xx += 0.6) { c.beginPath(); c.moveTo(X(xx), Y(3.2 * 0.2)); c.lineTo(X(xx + 0.3), Y(3.2 * 0.62)); c.lineTo(X(xx + 0.6), Y(3.2 * 0.2)); c.fill(); } } }
        else if (col === 7) { const gc = R_GATE[(row * 3 + 1) % R_GATE.length]; rect(0.4, 0, 3.2, 2.15, gc); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(X(1.79), Y(2.15), Math.max(1, kx * 0.04), 2.15 * ky); for (let xx = 0.5; xx < 3.2; xx += 0.25) c.fillRect(X(xx), Y(1.2), Math.max(1, kx * 0.03), 1.0 * ky); rect(0.4, 2.0, 3.2, 2.15, 'rgba(0,0,0,0.2)'); for (let xx = 0.5; xx < 3.2; xx += 0.25) { c.fillStyle = gc; c.beginPath(); c.moveTo(X(xx - 0.06), Y(2.15)); c.lineTo(X(xx), Y(2.35)); c.lineTo(X(xx + 0.06), Y(2.15)); c.fill(); } rect(0, 2.3, 3.6, 2.45, 'rgba(225,218,204,1)'); }
        else { rect(0, 2.3, 3.6, 2.45, 'rgba(225,218,204,0.55)'); } // mur nu (chaperon des clôtures)
        c.restore();
      }
    }, false);
  }
  function rFacadeMat(atlas) {
    const m = LOW ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.3 });
    m.onBeforeCompile = sh => {
      sh.uniforms.uAtlas = { value: atlas };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aUv; attribute vec4 aB; varying vec2 vU; varying vec4 vB; varying vec3 vWp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvU = aUv; vB = aB; vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uAtlas; varying vec2 vU; varying vec4 vB; varying vec3 vWp;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' +
        '{ vec4 qb = floor(vB + 0.5); float kind = qb.w;\n' +
        '  if (kind < 0.5 || kind > 2.5) {\n' +
        '    float y = vU.y, H = qb.z * 0.25, st = qb.x, seed = qb.y / 255.0;\n' +
        '    float bay = floor(vU.x), fx = fract(vU.x), fl = floor(y / 3.2), fy = fract(y / 3.2);\n' +
        '    float h1 = fract(sin(mod(bay * 17.0 + fl * 131.0 + qb.y * 7.0, 977.0) * 0.731) * 4375.85);\n' +
        '    float col = 0.0;\n' +
        '    if (kind > 2.5) col = h1 < 0.2 ? 7.0 : 0.0;\n' +
        '    else if (H > 3.0 && y > H - 0.8) { col = 6.0; fy = (y - (H - 0.8)) / 0.8 * 0.25 + 0.75; }\n' +
        '    else if (fl < 0.5) col = h1 < 0.2 ? 1.0 : h1 < 0.62 ? 2.0 : 3.0;\n' +
        '    else col = h1 < 0.55 ? 4.0 : h1 < 0.92 ? 5.0 : 0.0;\n' +
        '    vec4 t = texture2D(uAtlas, vec2((col + 0.03 + fx * 0.94) / 8.0, (7.0 - st + 0.03 + fy * 0.94) / 8.0));\n' +
        '    float grime = mix(0.8, 1.0, smoothstep(0.0, 0.9, y)) * (0.95 + 0.05 * h1);\n' +
        '    diffuseColor.rgb = mix(diffuseColor.rgb * grime, pow(t.rgb, vec3(2.2)), t.a);\n' +
        '  } else if (kind < 1.5) {\n' +
        '    float n = fract(sin(dot(floor(vWp.xz * 0.5), vec2(12.9898, 78.233))) * 43758.5453);\n' +
        '    diffuseColor.rgb = mix(vec3(0.50, 0.47, 0.42), vec3(0.42, 0.39, 0.35), n * 0.6);\n' +
        '  } }');
    };
    m.customProgramCacheKey = () => 'dzfacade' + (LOW ? 1 : 0);
    return m;
  }
  /* --- découpage en morceaux de 256 m, construits autour du joueur et libérés quand il s'éloigne --- */
  const rCh = new Map(); let R_MAT = null;
  function rIndexChunks() {
    const get = (x, z) => { const k = rChunkKey(x, z); let c = rCh.get(k); if (!c) rCh.set(k, c = { k, cx: (Math.floor(x / 256) + 0.5) * 256, cz: (Math.floor(z / 256) + 0.5) * 256, bld: [], walls: [], pieces: [], nodes: [], meshes: [], cols: [], built: false }); return c; };
    const Bd = RD.bld; for (let i = 0; i < Bd.n.length; i++) { const o = Bd.off[i]; get(Bd.p[2 * o], Bd.p[2 * o + 1]).bld.push(i); }
    const Wd = RD.walls; for (let i = 0; i < Wd.n.length; i++) { const o = Wd.off[i]; get(Wd.p[2 * o], Wd.p[2 * o + 1]).walls.push(i); }
    for (const e of RD.E) for (let s = 0; s < e.L; s += 150) { const s1 = Math.min(e.L, s + 150), q = rAt(e, (s + s1) / 2); get(q[0], q[1]).pieces.push([e.k, s, s1]); }
    for (let n = 0; n < RD.NN; n++) get(RD.NX[n], RD.NZ[n]).nodes.push(n);
  }
  function rMats() {
    if (R_MAT) return R_MAT;
    const asT = A.canvasTex(256, 256, (c, w, h) => { A.noise(c, w, h, '#45474a', 0.14, 26000); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 10; k++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 30, 10, Math.random() * 3, 0, 6.3); c.fill(); } c.fillStyle = 'rgba(205,170,120,0.35)'; c.fillRect(0, 0, w, 6); }, true);
    const trT = A.canvasTex(256, 256, (c, w, h) => { A.noise(c, w, h, '#b0916a', 0.2, 20000); c.strokeStyle = 'rgba(85,64,40,0.35)'; c.lineWidth = 10; for (const x of [0.3, 0.7]) { c.beginPath(); c.moveTo(x * w, 0); c.lineTo(x * w, h); c.stroke(); } c.fillStyle = 'rgba(70,52,32,0.25)'; c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h); }, true);
    const swT = A.canvasTex(128, 128, (c, w, h) => { A.noise(c, w, h, '#cdbfa6', 0.1, 6000); c.strokeStyle = 'rgba(80,70,55,0.3)'; c.lineWidth = 2; for (let k = 0; k <= w; k += 32) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.stroke(); } }, true);
    const po = (m, f) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f * 2; return m; };
    const atlas = rAtlas(); atlas.anisotropy = Math.min(LOW ? 2 : 8, A.renderer.capabilities.getMaxAnisotropy());
    R_MAT = {
      asph: po(A.surf({ map: asT, roughness: 0.9, envMapIntensity: 0.3 }), -1), track: po(A.surf({ map: trT, roughness: 1, envMapIntensity: 0.2 }), -1),
      walk: po(A.surf({ map: swT, roughness: 0.95, envMapIntensity: 0.2 }), -1), disc: po(A.surf({ map: asT, roughness: 0.9, envMapIntensity: 0.3 }), -2),
      white: po(new THREE.MeshLambertMaterial({ color: 0xe8e8e2 }), -3), yellow: po(new THREE.MeshLambertMaterial({ color: 0xe8c547 }), -3),
      fac: rFacadeMat(atlas), tints: R_STY.map(s => s.walls.map(h => lin(h))),
    };
    // sable qui mange le bord du goudron (dégradé, avec des traînées)
    const sdT = A.canvasTex(64, 256, (c, w, h) => { for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const t = x / (w - 1), wob = 0.75 + 0.25 * Math.sin(y * 0.11) * Math.sin(y * 0.037 + 1.3), a = Math.max(0, Math.min(1, (1 - t / wob) * 1.25)) * (0.82 + Math.random() * 0.18); c.fillStyle = `rgba(${196 + Math.random() * 18 | 0},${168 + Math.random() * 14 | 0},${122 + Math.random() * 12 | 0},${a.toFixed(3)})`; c.fillRect(x, y, 2, 2); } }, true);
    sdT.wrapS = THREE.ClampToEdgeWrapping;
    R_MAT.sandL = R_MAT.sandR = po(A.surf({ map: sdT, transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.15 }), -2);
    // enseignes des boutiques et auvents (atlas 4 x 4)
    const SHOPS = [['ALIMENTATION', 'بقالة', '#1f6fb2'], ['BOUTIQUE', 'دكان', '#c0392b'], ['PHARMACIE', 'صيدلية', '#1e8449'], ['QUINCAILLERIE', 'أدوات', '#7f4f24'], ['TÉLÉPHONES', 'هواتف', '#e67e22'], ['BOULANGERIE', 'مخبزة', '#b9770e'], ['TAILLEUR', 'خياط', '#5b2c6f'],
      ['COIFFURE', 'حلاق', '#17202a'], ['RESTAURANT', 'مطعم', '#922b21'], ['CYBER CAFÉ', 'انترنت', '#1a5276'], ['TISSUS · MELHFA', 'ملاحف', '#a93226'], ['PRESSING', 'تصبين', '#117864'], ['CHANGE', 'صرافة', '#145a32'], ['MERCERIE', 'خرازة', '#6c3483']];
    const shT = A.canvasTex(1024, 512, (c) => {
      SHOPS.forEach(([t, ar, bg], i) => { const x = (i % 4) * 256, y = Math.floor(i / 4) * 128; c.fillStyle = bg; c.fillRect(x, y, 256, 128); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 5; c.strokeRect(x + 6, y + 6, 244, 116);
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 34px "Russo One", Arial, sans-serif'; let tw = c.measureText(t).width; c.save(); c.translate(x + 128, y + 44); c.scale(Math.min(1, 220 / tw), 1); c.fillText(t, 0, 0); c.restore();
        c.fillStyle = '#ffe9a8'; c.font = '700 40px Arial, sans-serif'; c.fillText(ar, x + 128, y + 92); });
      for (const [k, cs] of [[14, ['#c0392b', '#f4f1ea']], [15, ['#1f6fb2', '#f4f1ea']]]) { const x = (k % 4) * 256, y = Math.floor(k / 4) * 128; for (let i = 0; i < 8; i++) { c.fillStyle = cs[i % 2]; c.fillRect(x + i * 32, y, 32, 128); } }
    });
    R_MAT.shop = A.surf({ map: shT, emissiveMap: shT, roughness: 0.6, side: THREE.DoubleSide }); A.nightReg(R_MAT.shop, 0.05, 0.85);
    return R_MAT;
  }
  function rColAdd(ch, c) { if (RM) return; const g = colMaps.real, b = c.box; for (let cx = Math.floor(b[0] / CELL); cx <= Math.floor(b[2] / CELL); cx++) for (let cz = Math.floor(b[1] / CELL); cz <= Math.floor(b[3] / CELL); cz++) { const k = gkey(cx, cz); let l = g.get(k); if (!l) g.set(k, l = []); l.push(c); } ch.cols.push(c); }
  function rColFree(ch) { const g = colMaps.real; for (const c of ch.cols) { const b = c.box; for (let cx = Math.floor(b[0] / CELL); cx <= Math.floor(b[2] / CELL); cx++) for (let cz = Math.floor(b[1] / CELL); cz <= Math.floor(b[3] / CELL); cz++) { const l = g.get(gkey(cx, cz)); if (!l) continue; const i = l.indexOf(c); if (i >= 0) l.splice(i, 1); } } ch.cols.length = 0; }
  function rBuildChunk(ch) {
    const M = rMats(), B = {};
    const buf = mk => B[mk] || (B[mk] = { p: [], uv: [], i: [] });
    const ribbon = (e, s0, s1, offA, offB, y, mk, ustep) => {
      if (s1 - s0 < 0.2) return;
      const L = rLanePts(e, 1, 0, s0, s1), n = L.length / 2; if (n < 2) return;
      const b = buf(mk), base = b.p.length / 3; let acc = s0;
      for (let i = 0; i < n; i++) {
        const x = L[2 * i], z = L[2 * i + 1];
        let tx, tz; if (i === 0) { tx = L[2] - x; tz = L[3] - z; } else if (i === n - 1) { tx = x - L[2 * i - 2]; tz = z - L[2 * i - 1]; } else { const a1 = Math.hypot(x - L[2 * i - 2], z - L[2 * i - 1]) || 1, a2 = Math.hypot(L[2 * i + 2] - x, L[2 * i + 3] - z) || 1; tx = (x - L[2 * i - 2]) / a1 + (L[2 * i + 2] - x) / a2; tz = (z - L[2 * i - 1]) / a1 + (L[2 * i + 3] - z) / a2; }
        const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        let k = 1; if (i > 0 && i < n - 1) { const a2 = Math.hypot(L[2 * i + 2] - x, L[2 * i + 3] - z) || 1; k = 1 / Math.max(0.55, tx * (L[2 * i + 2] - x) / a2 + tz * (L[2 * i + 3] - z) / a2); }
        if (i > 0) acc += Math.hypot(x - L[2 * i - 2], z - L[2 * i - 1]);
        const rx = -tz * k, rz = tx * k;
        b.p.push(x + rx * offA, y, z + rz * offA, x + rx * offB, y, z + rz * offB);
        const u = acc / (ustep || 8); if (mk === 'track' || mk === 'sandL') b.uv.push(0, u, 1, u); else if (mk === 'sandR') b.uv.push(1, u, 0, u); else b.uv.push(offA / 8, u, offB / 8, u);
        if (i) { const q = base + (i - 1) * 2; b.i.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
      }
    };
    // routes : morceaux de 150 m (en course : rien dans l'emprise du circuit, la rue s'arrête à la glissière)
    const runs = (k, a, b2) => { if (!RM) return [[a, b2]]; const e = RD.E[k], out = [], n = Math.max(1, Math.ceil((b2 - a) / 2)); let s0 = null; for (let j = 0; j <= n; j++) { const ss = a + (b2 - a) * j / n, q = rAt(e, ss), m = RM(q[0], q[1]) === 2; if (!m && s0 === null) s0 = ss; if (m && s0 !== null) { if (ss - s0 > 0.5) out.push([s0, ss]); s0 = null; } } if (s0 !== null && b2 - s0 > 0.5) out.push([s0, b2]); return out; };
    for (const [k, a0, b0] of ch.pieces) for (const [a, b2] of runs(k, a0, b0)) {
      const e = RD.E[k];
      if (e.cl >= 6 && e.pv !== 1) { ribbon(e, a, b2, -e.w / 2, e.w / 2, 0.03, 'track', 6); continue; }
      const paved = e.pv === 1, hw = e.w / 2;
      ribbon(e, a, b2, -hw, hw, paved ? 0.06 : 0.03, paved ? 'asph' : 'track', paved ? 8 : 6);
      if (paved && e.cl <= 3 && !e.link) { ribbon(e, a, b2, hw, hw + 2.6, 0.05, 'walk', 4); ribbon(e, a, b2, -hw - 2.6, -hw, 0.05, 'walk', 4); }
      if (paved && !LOW) { const [t0, t1] = rTrim(e), s0 = Math.max(a, t0 - 1), s1 = Math.min(b2, t1 + 1), sw = e.cl <= 1 ? 0.6 : e.cl <= 3 ? 1.0 : 1.5; if (s1 - s0 > 1) { if (e.cl > 3 || e.link) ribbon(e, s0, s1, -hw, -hw + sw, 0.075, 'sandL', 7); ribbon(e, s0, s1, hw - sw, hw, 0.075, 'sandR', 7); if (e.cl <= 3 && !e.link) ribbon(e, s0, s1, -hw, -hw + sw * 0.7, 0.075, 'sandL', 7); } } // sable sur les bords
      if (paved && e.cl <= 4 && e.w >= 7) {
        const [t0, t1] = rTrim(e), s0 = Math.max(a, t0), s1 = Math.min(b2, t1); if (s1 - s0 < 1) continue;
        const dash = (o1, o2) => { for (let s = t0 + 1 + Math.ceil((s0 - t0 - 1) / 9) * 9; s < s1 - 3; s += 9) ribbon(e, s, s + 3, o1, o2, 0.1, 'white'); };
        if (!e.ow) { if (e.cl <= 3) { ribbon(e, s0, s1, -0.22, -0.1, 0.1, 'yellow'); ribbon(e, s0, s1, 0.1, 0.22, 0.1, 'yellow'); } else dash(-0.07, 0.07); }
        if (e.cl <= 3) { ribbon(e, s0, s1, -hw + 0.35, -hw + 0.5, 0.1, 'white'); ribbon(e, s0, s1, hw - 0.5, hw - 0.35, 0.1, 'white'); }
        if (rLanes(e).length > 1 && e.ow) dash(-0.07, 0.07);
        if (!e.ow && e.w >= 12) for (const sd of [-1, 1]) dash(sd * e.w * 0.25 - 0.07, sd * e.w * 0.25 + 0.07);
      }
    }
    for (const n of ch.nodes) {
      const l = RD.inc[n]; if (l.length < 2) continue; let paved = false, r = 0; for (const k of l) { const e = RD.E[k]; if (e.pv === 1) paved = true; r = Math.max(r, e.w / 2); }
      const x = RD.NX[n], z = RD.NZ[n];
      if (l.length === 2 && r < 4) { // virage entre deux rues étroites : un disque comble le coin (sinon la rue paraît coupée)
        const tg = k => { const e = RD.E[k], t = e.a === n ? rTan(e, Math.min(1, e.L / 2)) : rTan(e, Math.max(0, e.L - 1)); return e.a === n ? t : [-t[0], -t[1]]; };
        const t1 = tg(l[0]), t2 = tg(l[1]); if (t1[0] * t2[0] + t1[1] * t2[1] < -0.94) continue; // presque droit
      }
      if (RM && (RM(x, z) === 2 || [0, 1, 2, 3, 4, 5, 6, 7].some(k => RM(x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r) === 2))) continue;
      const b = buf(paved ? 'disc' : 'track'), base = b.p.length / 3, S = 14, y = paved ? 0.075 : 0.035;
      b.p.push(x, y, z); b.uv.push(x / 8, z / 8);
      for (let k = 0; k <= S; k++) { const ang = k / S * Math.PI * 2; b.p.push(x + Math.cos(ang) * r, y, z + Math.sin(ang) * r); b.uv.push((x + Math.cos(ang) * r) / 8, (z + Math.sin(ang) * r) / 8); if (k) b.i.push(base, base + k + 1, base + k); }
    }
    for (const mk in B) {
      const b = B[mk]; if (!b.i.length) continue;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      const nor = new Float32Array(b.p.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(b.p.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1));
      ch.meshes.push(rAddChunkMesh(g, M[mk], { noCull: true, order: mk === 'disc' ? 1 : mk === 'white' || mk === 'yellow' ? 2 : mk === 'sandL' || mk === 'sandR' ? 3 : 0 }));
    }
    // bâtiments : façades peintes, acrotère, toit-terrasse, citernes et cages d'escalier ; murs de clôture avec portails
    const P = [], N_ = [], C = [], U = [], Bv = [], I = [];
    let v = 0;
    const vert = (x, y, z, nx_, ny, nz, col, u, vv, b4) => { P.push(x, y, z); N_.push(nx_, ny, nz); C.push(col.r * 255, col.g * 255, col.b * 255); U.push(u, vv); Bv.push(b4[0], b4[1], b4[2], b4[3]); return v++; };
    const Bd = RD.bld, tmp = [];
    const box = (x, z, hx, hz, y0, y1, rot, col, b4) => { // petite boîte (cage d'escalier, citerne)
      const ca = Math.cos(rot), sa = Math.sin(rot), pts = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([a, b]) => [x + a * ca + b * sa, z - a * sa + b * ca]);
      for (let k = 0; k < 4; k++) { const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % 4], ex = bx - ax, ez = bz - az, l = Math.hypot(ex, ez) || 1, nx_ = ez / l, nz_ = -ex / l; const i0 = vert(ax, y0, az, nx_, 0, nz_, col, 0, 0, b4), i1 = vert(bx, y0, bz, nx_, 0, nz_, col, 0, 0, b4), i2 = vert(bx, y1, bz, nx_, 0, nz_, col, 0, 0, b4), i3 = vert(ax, y1, az, nx_, 0, nz_, col, 0, 0, b4); I.push(i0, i2, i1, i0, i3, i2); }
      const t0 = vert(pts[0][0], y1, pts[0][1], 0, 1, 0, col, 0, 0, b4), t1 = vert(pts[1][0], y1, pts[1][1], 0, 1, 0, col, 0, 0, b4), t2 = vert(pts[2][0], y1, pts[2][1], 0, 1, 0, col, 0, 0, b4), t3 = vert(pts[3][0], y1, pts[3][1], 0, 1, 0, col, 0, 0, b4); I.push(t0, t2, t1, t0, t3, t2);
    };
    const TANK = [lin(0x1b1d20), lin(0x2a5ea8), lin(0xe8e8e4), lin(0x1b1d20)];
    const SP = [], SN = [], SU = [], SI = []; // enseignes et auvents des boutiques
    const lmBoxes = ((RM ? rStaticR : rStaticT) || { userData: {} }).userData.boxes || [];
    const inLm = (px, pz) => lmBoxes.some(b => { const dx = px - b.x, dz = pz - b.z, u = dx * b.ca - dz * b.sa, v = dx * b.sa + dz * b.ca; return Math.abs(u) < b.hw && Math.abs(v) < b.hd; });
    for (const i of ch.bld) {
      if (RM && rBldMasked(i)) continue;
      if (lmBoxes.length) { const o = Bd.off[i]; let cx = 0, cz = 0; for (let k = 0; k < Bd.n[i]; k++) { cx += Bd.p[2 * (o + k)]; cz += Bd.p[2 * (o + k) + 1]; } if (inLm(cx / Bd.n[i], cz / Bd.n[i])) continue; }
      const o = Bd.off[i], H = Bd.h[i] * 0.25, code = Bd.t[i], st = code & 7, tv = (code >> 3) & 3, col = M.tints[st][tv], seed = (i * 2654435761 >>> 24) & 255;
      tmp.length = 0; for (let k = 0; k < Bd.n[i]; k++) { const px = Bd.p[2 * (o + k)], pz = Bd.p[2 * (o + k) + 1], lp = tmp[tmp.length - 1]; if (!lp || Math.abs(lp.x - px) > 0.05 || Math.abs(lp.y - pz) > 0.05) tmp.push(new THREE.Vector2(px, pz)); }
      while (tmp.length > 3 && Math.abs(tmp[0].x - tmp[tmp.length - 1].x) < 0.05 && Math.abs(tmp[0].y - tmp[tmp.length - 1].y) < 0.05) tmp.pop(); // anneau fermé : sommet en double
      const n = tmp.length; if (n < 3) continue;
      let area = 0; for (let k = 0; k < n; k++) { const a = tmp[k], b = tmp[(k + 1) % n]; area += a.x * b.y - b.x * a.y; } const ccw = area > 0; area = Math.abs(area) / 2;
      const b4 = [st, seed, Math.min(255, Math.round(H * 4)), 0], roofY = H > 3 ? H - 0.8 : H - 0.3;
      for (let k = 0; k < n; k++) { // murs : 4 sommets par mur, u en travées de ~3,6 m, v en mètres
        const a = tmp[k], b = tmp[(k + 1) % n], ex = b.x - a.x, ez = b.y - a.y, L = Math.hypot(ex, ez); if (L < 0.05) continue;
        const nx_ = (ccw ? ez : -ez) / L, nz_ = (ccw ? -ex : ex) / L, nb = Math.max(1, Math.round(L / 3.6));
        const i0 = vert(a.x, 0, a.y, nx_, 0, nz_, col, 0, 0, b4), i1 = vert(b.x, 0, b.y, nx_, 0, nz_, col, nb, 0, b4), i2 = vert(b.x, H, b.y, nx_, 0, nz_, col, nb, H, b4), i3 = vert(a.x, H, a.y, nx_, 0, nz_, col, 0, H, b4);
        if (ccw) I.push(i0, i3, i1, i1, i3, i2); else I.push(i0, i1, i3, i1, i2, i3);
        // enseigne de boutique (et parfois un auvent) sur les murs qui donnent sur une rue
        if (H >= 3.4 && L >= 4.2 && ((seed + k * 37) & 255) < 150) {
          const mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
          if ([5.5, 9.5, 13.5].some(dd => rAsphalt(mx + nx_ * dd, mz + nz_ * dd, -1, 3.2)) && !(RM && RM(mx + nx_ * 3, mz + nz_ * 3))) {
            const hh = (seed * 31 + k * 17) & 255, sw = Math.min(L - 0.8, 3.2 + (hh & 3)), rx = nz_, rz = -nx_, ox = mx + nx_ * 0.07, oz = mz + nz_ * 0.07, cell = hh % 14, cu = (cell % 4) / 4, cv = 1 - Math.floor(cell / 4) / 4;
            const sq = (pts, uvs, nn) => { const b0 = SP.length / 3; for (let q = 0; q < 4; q++) { SP.push(pts[q][0], pts[q][1], pts[q][2]); SN.push(nn[0], nn[1], nn[2]); SU.push(uvs[q][0], uvs[q][1]); } SI.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); };
            sq([[ox - rx * sw / 2, 2.75, oz - rz * sw / 2], [ox + rx * sw / 2, 2.75, oz + rz * sw / 2], [ox + rx * sw / 2, 3.6, oz + rz * sw / 2], [ox - rx * sw / 2, 3.6, oz - rz * sw / 2]], [[cu, cv - 0.25], [cu + 0.25, cv - 0.25], [cu + 0.25, cv], [cu, cv]], [nx_, 0, nz_]);
            if (hh & 64) { const st = (hh & 128) ? 14 : 15, su = (st % 4) / 4, sv = 1 - Math.floor(st / 4) / 4, aw = sw + 0.4, ax = mx + nx_ * 1.15, az = mz + nz_ * 1.15;
              sq([[ax - rx * aw / 2, 2.3, az - rz * aw / 2], [ax + rx * aw / 2, 2.3, az + rz * aw / 2], [ox + rx * aw / 2, 2.7, oz + rz * aw / 2], [ox - rx * aw / 2, 2.7, oz - rz * aw / 2]], [[su, sv - 0.25], [su + 0.25, sv - 0.25], [su + 0.25, sv], [su, sv]], [nx_ * 0.34, 0.94, nz_ * 0.34]); }
          }
        }
      }
      // toit
      let convex = true; for (let k = 0; k < n && convex; k++) { const a = tmp[k], b = tmp[(k + 1) % n], c2 = tmp[(k + 2) % n]; const cr = (b.x - a.x) * (c2.y - b.y) - (b.y - a.y) * (c2.x - b.x); if (cr * (ccw ? 1 : -1) < -1e-6) convex = false; }
      const tris = convex ? (() => { const t = []; for (let k = 1; k < n - 1; k++) t.push([0, k, k + 1]); return t; })() : THREE.ShapeUtils.triangulateShape(tmp.slice(), []);
      const rb = [st, seed, b4[2], 1], ri = tmp.map(p => vert(p.x, roofY, p.y, 0, 1, 0, col, 0, 0, rb));
      for (const [a, b, c2] of tris) { const up = (tmp[b].y - tmp[a].y) * (tmp[c2].x - tmp[a].x) - (tmp[b].x - tmp[a].x) * (tmp[c2].y - tmp[a].y) > 0; if (up) I.push(ri[a], ri[b], ri[c2]); else I.push(ri[a], ri[c2], ri[b]); }
      // sur le toit : cage d'escalier, citerne (pas sur les petites cabanes)
      if (area > 45 && H > 3) {
        let cx = 0, cz = 0; for (const p of tmp) { cx += p.x; cz += p.y; } cx /= n; cz /= n;
        const e0 = tmp[1].clone().sub(tmp[0]), rot = Math.atan2(e0.x, e0.y), h2 = (seed * 7) & 255;
        if (H > 6 && h2 < 110) box(cx + Math.sin(rot) * 1.2, cz + Math.cos(rot) * 1.2, 1.25, 1.4, roofY, roofY + 2.5, rot, col, [st, seed, 0, 2]);
        if (h2 > 70 && h2 < 200) { const tx = cx - Math.sin(rot) * 1.6 + Math.cos(rot) * 1.2, tz = cz - Math.cos(rot) * 1.6 - Math.sin(rot) * 1.2; box(tx, tz, 0.55, 0.55, roofY, roofY + 1.15, rot + 0.4, TANK[h2 & 3], [0, 0, 0, 2]); }
      }
      // collision : emprise exacte
      if (H > 1.5) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; const poly = new Float32Array(n * 2); for (let k = 0; k < n; k++) { const p = tmp[k]; poly[2 * k] = p.x; poly[2 * k + 1] = p.y; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.y); z1 = Math.max(z1, p.y); } rColAdd(ch, { poly, box: [x0, z0, x1, z1], h: H }); }
    }
    const Wd = RD.walls;
    for (const i of ch.walls) {
      const n = Wd.n[i], o = Wd.off[i], h = (i * 2654435761 >>> 20) & 4095, st = [0, 1, 2, 7, 0, 5, 1, 2][h & 7], col = M.tints[st][(h >> 3) & 3], b4 = [st, (h >> 5) & 255, 10, 3];
      let acc = 0;
      for (let k = 0; k < n - 1; k++) {
        const ax = Wd.p[2 * (o + k)], az = Wd.p[2 * (o + k) + 1], bx = Wd.p[2 * (o + k + 1)], bz = Wd.p[2 * (o + k + 1) + 1], ex = bx - ax, ez = bz - az, L = Math.hypot(ex, ez); if (L < 0.3) continue;
        if ((RM && (RM(ax, az) || RM(bx, bz) || RM((ax + bx) / 2, (az + bz) / 2))) || (lmBoxes.length && inLm((ax + bx) / 2, (az + bz) / 2))) { acc += L; continue; }
        const nx_ = -ez / L, nz_ = ex / L, u0 = acc / 3.6, u1 = (acc + L) / 3.6, Hh = 2.4; acc += L;
        for (const sd of [1, -1]) { const i0 = vert(ax, 0, az, nx_ * sd, 0, nz_ * sd, col, u0, 0, b4), i1 = vert(bx, 0, bz, nx_ * sd, 0, nz_ * sd, col, u1, 0, b4), i2 = vert(bx, Hh, bz, nx_ * sd, 0, nz_ * sd, col, u1, Hh, b4), i3 = vert(ax, Hh, az, nx_ * sd, 0, nz_ * sd, col, u0, Hh, b4); if (sd > 0) I.push(i0, i1, i2, i0, i2, i3); else I.push(i0, i2, i1, i0, i3, i2); }
        const t = 0.14, px = nx_ * t, pz = nz_ * t; rColAdd(ch, { poly: new Float32Array([ax - px, az - pz, bx - px, bz - pz, bx + px, bz + pz, ax + px, az + pz]), box: [Math.min(ax, bx) - t, Math.min(az, bz) - t, Math.max(ax, bx) + t, Math.max(az, bz) + t], h: 2.4 });
      }
    }
    if (SI.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(SP, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(SN, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(SU, 2)); g.setIndex(SI); ch.meshes.push(rAddChunkMesh(g, M.shop, { noCull: true })); }
    if (I.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N_, 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(C), 3, true)); g.setAttribute('aUv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aB', new THREE.BufferAttribute(new Uint8Array(Bv), 4, false));
      g.setIndex(v > 65000 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
      ch.meshes.push(rAddChunkMesh(g, M.fac, { noCull: true, cast: !LITE }));
    }
    ch.built = true;
  }
  function rPreload() { // générique : les lieux survolés sont construits d'avance
    const pts = [[1080, 20]]; const port = RPLACES.find(p => p.name === 'Port de pêche'); if (port) pts.push([port.rx, port.rz]);
    for (const id of ['snim', 'fasq', 'sheraton', 'palais', 'marche']) { const q = RPLACES.find(p => p.id === id); if (q) pts.push([q.rx, q.rz]); }
    for (const ch of rCh.values()) if (pts.some(([x, z]) => Math.hypot(ch.cx - x, ch.cz - z) < 420)) { ch.keep = true; if (!ch.built) rBuildChunk(ch); }
  }
  function rFreeChunk(ch) { for (const m of ch.meshes) { realG.remove(m); m.geometry.dispose(); } ch.meshes.length = 0; rColFree(ch); ch.built = false; }
  function rStream(x, z, budget, x2, z2) { // construit les morceaux proches, libère les lointains
    if (!RD) return 0;
    const RIN = RM ? (LOW ? 640 : LITE ? 880 : 1250) : (LOW ? 560 : LITE ? 720 : 1050), ROUT = RIN + 320; let made = 0;
    const want = [];
    for (const ch of rCh.values()) { let d = Math.hypot(ch.cx - x, ch.cz - z); if (x2 !== undefined) d = Math.min(d, Math.hypot(ch.cx - x2, ch.cz - z2)); if (ch.built) { if (d > ROUT && !ch.keep) rFreeChunk(ch); } else if (d < RIN) want.push([d, ch]); }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, ch] of want) { if (made >= budget) break; try { rBuildChunk(ch); } catch (e) { console.error('chunk ' + ch.k, e && e.message); ch.built = true; } made++; }
    return made;
  }
  const R_PROC = { snim: ['snimTower', 44, 29], fasq: ['fasqNkc', 56, 22], sheraton: ['sheratonNkc', 94, 60], nkc: ['nkcHotel', 32, 30], palais: ['palaisCongres', 58, 60], tasiast: ['tasiastNkc', 30, 50], netcom: ['netcomNkc', 26, 20], sunset: ['sunsetNkc', 26, 18] }; // refaits d'après photos (Tasiast, Netcom, Sunset : voisins du Fasq)
  const R_LM = { palais: 'lm_palais', marche: 'lm_marche', bmd: 'lm_bmd', snim: 'lm_snim', afarco: 'lm_afarco', sheraton: 'lm_sheraton', fasq: 'lm_fasq', mauricenter: 'lm_mauricenter', iman: 'lm_iman', nkc: 'lm_nkc' };
  let rinst = {};
  function rBuildLandmarks() {
    for (const [id, name, ar, x0_, z0_, face, ek, s, side] of RD.lm) {
      const rot = face; // la façade (+z local) regarde la rue
      let x = x0_, z = z0_;
      if (RM) { // course : le monument recule (côté arrière) jusqu'à sortir de l'emprise du circuit
        const [w0, d0] = R_PROC[id] && A.LANDMARKS[R_PROC[id][0]] ? [R_PROC[id][1], R_PROC[id][2]] : LM_DIMS[R_LM[id]] || (id === 'mosquee' ? [48, 44] : id === 'musee' ? [40, 26] : id === 'stade' ? [110, 80] : [30, 24]), ca = Math.cos(rot), sa = Math.sin(rot);
        const hit = (cx, cz) => [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([u, v]) => RM(cx + u * w0 / 2 * ca + v * d0 / 2 * sa, cz - u * w0 / 2 * sa + v * d0 / 2 * ca));
        let ok = false; for (let back = 0; back <= 36 && !ok; back += 3) { const cx = x0_ - Math.sin(rot) * back, cz = z0_ - Math.cos(rot) * back; if (!hit(cx, cz)) { x = cx; z = cz; ok = true; } }
        if (!ok) continue;
      }
      rTgt.lms.push({ id, name, ar, x, z, face });
      if (R_PROC[id]) (rTgt.g.userData.boxes = rTgt.g.userData.boxes || []).push({ x, z, ca: Math.cos(rot), sa: Math.sin(rot), hw: R_PROC[id][1] / 2 + 2, hd: R_PROC[id][2] / 2 + 2 });
      let g = null, w = 30, d = 24, sc = 1;
      if (R_PROC[id] && A.LANDMARKS[R_PROC[id][0]]) { const lm = A.LANDMARKS[R_PROC[id][0]](); g = lm.g; w = R_PROC[id][1]; d = R_PROC[id][2]; }
      else if (R_LM[id]) { const lm = A.glbLM(R_LM[id]); if (lm) { g = lm.g; [w, d] = LM_DIMS[R_LM[id]]; } }
      else if (id === 'mosquee') { const lm = A.LANDMARKS.mosqueSaudi(); g = lm.g; w = 48; d = 44; }
      else if (id === 'musee') { const lm = A.LANDMARKS.museum(); g = lm.g; w = 40; d = 26; }
      else if (id === 'stade' || id === 'station') {
        const key = id === 'stade' ? 'B_Stadium' : 'mrt_station', s3 = libSize(key);
        if (s3) { sc = id === 'stade' ? Math.min(1.6, 110 / Math.max(s3.w, s3.d)) : 1; const ca = Math.cos(rot), sa = Math.sin(rot), ox = (s3.cx * ca + s3.cz * sa) * sc, oz = (-s3.cx * sa + s3.cz * ca) * sc; (rinst[key] = rinst[key] || []).push([x - ox, 0.06, z - oz, rot, sc]); rOBB(x, z, rot, s3.w * sc / 2, s3.d * sc / 2, 12); }
      }
      if (g) { g.position.set(x, 0.05, z); g.rotation.y = rot; g.scale.setScalar(sc); rTgt.g.add(g); A.mergeGroup(g); rOBB(x, z, rot, w * sc / 2 - 0.5, d * sc / 2 - 0.5, 20); }
      void name; void ar; void ek; void s; void side;
    }
  }
  function rOBB(x, z, rot, hw, hd, h) { // boîte tournée -> polygone de collision
    const ca = Math.cos(rot), sa = Math.sin(rot), pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [x + u * ca + v * sa, z - u * sa + v * ca]);
    const poly = new Float32Array(pts.flat()); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [px, pz] of pts) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
    rAdd({ poly, box: [x0, z0, x1, z1], h });
  }
  function rBuildProps() {
    const lamps = [], palms = [], heads = [], rnd = seeded(77);
    for (const e of RD.E) {
      if (e.pv !== 1 || e.cl > 2 || e.link) continue;
      const [s0, s1] = rTrim(e), sides = e.ow ? [1] : [-1, 1];
      for (let s = s0 + 12; s < s1 - 8; s += 34) for (const sd of sides) {
        const q = rAt(e, s), rx = -q[3], rz = q[2], off = e.w / 2 + 1.4, x = q[0] + rx * sd * off, z = q[1] + rz * sd * off;
        if (RM && RM(x, z)) continue;
        lamps.push([x, 0.05, z, Math.atan2(-rx * sd, -rz * sd) + Math.PI / 2, 1]); rAdd({ x, z, r: 0.35 }); heads.push([x - rx * sd * 1.1, 6.1, z - rz * sd * 1.1]);
        if (rnd() < 0.7) { const x2 = q[0] + rx * sd * (off + 0.2) + q[2] * 15, z2 = q[1] + rz * sd * (off + 0.2) + q[3] * 15; if (RM && RM(x2, z2)) continue; palms.push([x2, 0.05, z2, rnd() * 6.3, 0.62 + rnd() * 0.25]); rAdd({ x: x2, z: z2, r: 0.45 }); }
      }
    }
    const opt = o => Object.assign({ parent: rTgt.g, cull: rTgt.cull, cell: 300 }, o);
    const fromLib = (name, list, o) => { if (!list.length) return; const src = lib.getObjectByName(name) || (A.ASSETS.city && A.ASSETS.city.getObjectByName(name)); if (!src) return; for (const b of bake(src)) A.addInstanced(b.geo, texFix(lowMat(b.mat)), list.map(([x, y, z, r, s]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_Y, r), new THREE.Vector3(s, s, s))), null, opt(o)); };
    fromLib('P_StreetLight', lamps, { cast: !LITE, maxD: LITE ? 280 : 440, name: 'rlamp' });
    const pm = palms.map(([x, y, z, r, s]) => new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromAxisAngle(_Y, r), _s.set(s, s, s)).clone());
    if (pm.length) { A.addInstanced(A.PALM.trunk, A.PALM.trunkMat, pm, null, opt({ cast: !LITE, maxD: LITE ? 360 : 580, name: 'rpalmT' })); A.addInstanced(A.PALM.crown, A.PALM.crownMat, pm, pm.map(() => new THREE.Color().setHSL(0.27 + R() * 0.06, 0.45 + R() * 0.2, 0.62 + R() * 0.2)), opt({ cast: !LITE, maxD: LITE ? 400 : 620, name: 'rpalmC' })); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(heads.flat(), 3));
    const glow = new THREE.Points(g, new THREE.PointsMaterial({ map: A.glowSpriteTex, color: 0xffd29a, size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.frustumCulled = false; glow.visible = false; rTgt.g.add(glow); if (rTgt.race) rRaceGlow = glow; else rLampGlow = glow;
    A.instanceLib(rinst, { parent: rTgt.g, cull: rTgt.cull, cell: 400, maxD: (det, small) => det ? (LITE ? 340 : 560) : small ? 300 : (LITE ? 620 : 980) });
  }
  /* ======================= Vie de rue : étals, charrettes à sandwichs, thé, food trucks, voitures garées ======================= */
  let SL = null; // géométries partagées (taxi + course)
  const VEND = { list: [], grid: new Map() }; // marchands et clients (personnages immobiles), dessinés près de la caméra
  function slGeos() {
    if (SL) return SL;
    const B = (w, h, d, x, y, z, ry) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
    const C = (r0, r1, h, seg, x, y, z, rz, rx) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg || 10); if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); g.translate(x, y, z); return g; };
    const col = parts => { // [[géo, couleur]] -> une géométrie fusionnée à couleurs de sommets
      const gs = [], cs = [];
      for (const [g0, hex] of parts) { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); gs.push(g); const c = new THREE.Color(hex); for (let i = 0; i < g.attributes.position.count; i++) cs.push(c.r, c.g, c.b); }
      const m = mergeGeos(gs); m.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); return m;
    };
    const wood = 0x8a6440, steel = 0xb4b9bd, dark = 0x232527;
    const legs = (w, d, h, c) => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [B(0.06, h, 0.06, a * (w / 2 - 0.05), h / 2, b * (d / 2 - 0.05)), c]);
    const FR = [0xe67e22, 0xc0392b, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xd35400, 0x7dbb3a];
    // étal de fruits et légumes (le devant, +z, regarde la rue)
    const fruit = [[B(1.8, 0.07, 0.9, 0, 0.84, 0), wood], ...legs(1.8, 0.9, 0.82, wood), [B(1.8, 0.45, 0.02, 0, 0.58, 0.45), 0x1f6fb2], [C(0.035, 0.035, 2.3, 6, 0, 1.15, -0.3), steel]];
    for (let i = 0; i < 6; i++) { const x = -0.6 + (i % 3) * 0.6, z = i < 3 ? 0.2 : -0.2; fruit.push([B(0.52, 0.14, 0.36, x, 0.95, z), 0x9c7a4f]); fruit.push([new THREE.SphereGeometry(0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.7, 0.8).translate(x, 1.02, z), FR[i % FR.length]]); }
    // étal de tissus / voiles / babouches
    const tissu = [[B(1.8, 0.07, 0.9, 0, 0.84, 0), wood], ...legs(1.8, 0.9, 0.82, wood), [C(0.035, 0.035, 2.3, 6, 0, 1.15, -0.3), steel], [B(1.9, 0.04, 0.04, 0, 1.9, -0.42), steel]];
    const TX = [0x1f6fb2, 0xd4af37, 0xc0392b, 0x16a085, 0x8e44ad, 0xf2f2f2, 0x2c3e50, 0xe84393];
    for (let i = 0; i < 6; i++) tissu.push([B(0.5, 0.12 + (i % 2) * 0.08, 0.34, -0.6 + (i % 3) * 0.6, 0.94 + (i % 2) * 0.04, i < 3 ? 0.2 : -0.2), TX[i]]);
    for (let i = 0; i < 5; i++) tissu.push([B(0.32, 1.0, 0.03, -0.72 + i * 0.36, 1.38, -0.42), TX[(i + 3) % TX.length]]); // voiles suspendus
    // charrette à sandwichs : caisson blanc, vitrine, roues, bonbonne de gaz
    const cart = [[B(1.5, 0.75, 0.8, 0, 0.78, 0), 0xf2f2f2], [B(1.52, 0.12, 0.82, 0, 0.98, 0), 0xc0392b], [B(1.3, 0.42, 0.6, 0, 1.37, -0.05), 0xa9d6e5], [B(1.34, 0.04, 0.64, 0, 1.6, -0.05), steel],
      [C(0.33, 0.33, 0.07, 12, 0.78, 0.33, 0, Math.PI / 2), dark], [C(0.33, 0.33, 0.07, 12, -0.78, 0.33, 0, Math.PI / 2), dark], [B(0.05, 0.05, 0.7, -0.5, 0.95, -0.7), steel], [B(0.05, 0.05, 0.7, 0.5, 0.95, -0.7), steel],
      [C(0.15, 0.15, 0.5, 10, -1.0, 0.25, 0.1), 0x2e86de], [C(0.03, 0.03, 1.0, 6, 0.65, 1.35, -0.25), steel], [B(0.5, 0.06, 0.3, -0.35, 1.06, 0.3), 0xd9b77e]];
    // vendeur de thé : natte, tabouret, brasero, théière, plateau, verres
    const the = [[B(1.6, 0.02, 1.1, 0, 0.01, 0.1), 0x9b2335], [B(0.38, 0.3, 0.38, -0.45, 0.15, -0.1), wood], [C(0.16, 0.2, 0.26, 10, 0.25, 0.13, -0.05), dark], [C(0.12, 0.12, 0.02, 10, 0.25, 0.27, -0.05), 0xe25822],
      [new THREE.SphereGeometry(0.11, 8, 6).translate(0.25, 0.38, -0.05), 0xc9cfd3], [C(0.28, 0.28, 0.03, 14, 0.25, 0.03, 0.42), 0xc9cfd3]];
    for (let i = 0; i < 5; i++) the.push([C(0.025, 0.02, 0.07, 6, 0.1 + i * 0.07, 0.08, 0.42), 0xf0e2a8]);
    // food truck (long. sur x, guichet côté +z = trottoir)
    const truckBody = col([[B(4.8, 2.25, 2.1, 0, 1.6, 0), 0xffffff]]);
    const truck = [[B(2.7, 1.0, 0.04, -0.5, 1.75, 1.06), 0x2b2b2b], [B(2.7, 0.06, 0.4, -0.5, 1.2, 1.24), steel], [B(2.9, 0.05, 1.0, -0.5, 2.48, 1.5, 0), 0xc0392b], [B(2.9, 0.05, 0.25, -0.5, 2.46, 2.0), 0xffffff],
      [B(0.05, 0.85, 1.8, 2.42, 2.0, 0), 0x1d2b33], [B(0.12, 0.14, 0.3, 2.42, 1.0, 0.7), 0xfff2c0], [B(0.12, 0.14, 0.3, 2.42, 1.0, -0.7), 0xfff2c0], [B(4.9, 0.3, 2.2, 0, 0.6, 0), 0x3a3d40],
      ...[[1.55, 1], [1.55, -1], [-1.55, 1], [-1.55, -1]].map(([x, z]) => [C(0.42, 0.42, 0.26, 12, x, 0.42, z * 1.0, 0, Math.PI / 2), dark]), [B(0.06, 2.2, 0.06, -1.95, 1.4, 2.0), steel], [B(0.06, 2.2, 0.06, 0.95, 1.4, 2.0), steel]];
    // chaises et tables en plastique devant les food trucks
    const chair = (x, z, r) => { const L = []; const g = [B(0.44, 0.05, 0.44, 0, 0.45, 0), B(0.44, 0.45, 0.05, 0, 0.7, -0.2), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => B(0.04, 0.45, 0.04, a * 0.19, 0.22, b * 0.19))]; for (const q of g) { q.rotateY(r); q.translate(x, 0, z); L.push([q, 0xf4f4f4]); } return L; };
    const terrasse = [[C(0.42, 0.42, 0.03, 14, 0, 0.72, 0), 0xf4f4f4], [C(0.03, 0.03, 0.72, 6, 0, 0.36, 0), 0xdddddd], ...chair(0.7, 0, -Math.PI / 2), ...chair(-0.7, 0, Math.PI / 2), ...chair(0, 0.7, Math.PI)];
    const canopy = new THREE.ConeGeometry(1.25, 0.42, 8, 1, true); canopy.translate(0, 2.42, -0.3);
    const vmat = A.surf({ vertexColors: true, roughness: 0.8 });
    const signs = [['SANDWICH', 'ساندويتش', '#c0392b'], ['CHAWARMA', 'شاورما', '#1d6f42'], ['FAST FOOD', 'وجبات سريعة', '#1f3c88'], ['JUS · GLACES', 'عصير', '#d35400']].map(([t, a, bg]) => {
      const tex = A.textTex([{ t, y: 0.36, size: 110 }, { t: a, y: 0.78, size: 80, font: '700 SZpx Arial, sans-serif' }], { bg, fg: '#fff', w: 768, h: 256 });
      const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, roughness: 0.5 }); A.nightReg(m, 0.15, 1.1); return m;
    });
    const signG = new THREE.BoxGeometry(3.0, 0.75, 0.12); signG.translate(-0.3, 3.15, 0.2);
    SL = { fruit: col(fruit), tissu: col(tissu), cart: col(cart), the: col(the), truck: col(truck), truckBody, terrasse: col(terrasse), canopy, signG, signs, vmat,
      cmat: A.surf({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide }), bmat: A.surf({ color: 0xffffff, roughness: 0.45, metalness: 0.15 }) };
    return SL;
  }
  function rInBld(x, z, r, noBox) { // le point (rayon r) touche-t-il un bâtiment OSM (ou un monument) ?
    const Bd = RD.bld, seen = new Set();
    for (const [ox, oz] of [[0, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const c = rCh.get(rChunkKey(x + ox, z + oz)); if (!c || seen.has(c)) continue; seen.add(c);
      for (const i of c.bld) {
        const n = Bd.n[i], o = Bd.off[i]; let inside = false, md = 1e9;
        const fx = Bd.p[2 * o], fz = Bd.p[2 * o + 1]; if (Math.abs(fx - x) > 120 || Math.abs(fz - z) > 120) continue;
        for (let k = 0, j = n - 1; k < n; j = k++) {
          const ax = Bd.p[2 * (o + j)], az = Bd.p[2 * (o + j) + 1], bx = Bd.p[2 * (o + k)], bz = Bd.p[2 * (o + k) + 1];
          if ((bz > z) !== (az > z) && x < (ax - bx) * (z - bz) / (az - bz) + bx) inside = !inside;
          const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1, t = clamp(((x - ax) * ex + (z - az) * ez) / l2, 0, 1), d = Math.hypot(x - ax - ex * t, z - az - ez * t); if (d < md) md = d;
        }
        if (inside || md < r) return true;
      }
    }
    const bx = !noBox && rTgt && rTgt.g.userData.boxes; // emprise des monuments
    if (bx) for (const b of bx) { const dx = x - b.x, dz = z - b.z, u = dx * b.ca - dz * b.sa, v = dx * b.sa + dz * b.ca; if (Math.abs(u) < b.hw + r && Math.abs(v) < b.hd + r) return true; }
    return false;
  }
  function rBuildStreetLife() {
    const G = slGeos(), rnd = seeded(31337), race = rTgt.race;
    const put = { fruit: [], tissu: [], cart: [], the: [], truck: [], terr: [], can: [], canC: [], body: [], bodyC: [], sign: [[], [], [], []] };
    const CAN = [0xc0392b, 0x1f6fb2, 0xf2c14e, 0x2e8b57, 0xf2f2f2, 0xe67e22, 0x8e44ad], BODY = [0xf2f2f2, 0xf1c40f, 0xe74c3c, 0x2e86de, 0x27ae60, 0xffffff, 0xff7f50];
    const M4 = (x, z, yaw, y, sc) => new THREE.Matrix4().compose(_v.set(x, y || 0.05, z), _q.setFromAxisAngle(_Y, yaw), _s.set(sc || 1, sc || 1, sc || 1)).clone();
    const vend = (x, z, yaw, y) => { if (!race) VEND.list.push({ x, z, h: yaw, y: y || 0.05, m: HUMANS[Math.floor(rnd() * HUMANS.length)], t: rnd() < 0.6 ? [...new THREE.Color(pick(TINTS, rnd)).toArray(), 0.78] : [1, 1, 1, 0] }); };
    const loc = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
    let nSpots = 0; const CAP = LOW ? 260 : LITE ? 700 : 1300;
    const spot = (x, z, yaw, kind, curb) => { // yaw : le devant (+z local) regarde les clients ; curb : sur le trottoir, sous les arcades
      const r = kind === 'truck' ? 2.6 : kind === 'the' ? 0.9 : curb ? 0.7 : 1.1;
      if ((RM && RM(x, z)) || rAsphalt(x, z, -1, curb ? 0.3 : 0.6) || rInBld(x, z, r, curb)) return false;
      if (kind === 'truck') {
        const [bx, bz] = loc(x, z, yaw, 0, -0.6), m = M4(bx, bz, yaw, 0.05); // le long du trottoir, guichet (+z du camion) vers les passants
        put.truck.push(m); put.body.push(m); put.bodyC.push(new THREE.Color(pick(BODY, rnd))); put.sign[Math.floor(rnd() * 4)].push(m);
        rOBB(bx, bz, yaw, 2.5, 1.1, 3);
        const [tx, tz] = loc(x, z, yaw, 1.2, 2.2); if (!rAsphalt(tx, tz, -1, 0.3) && !rInBld(tx, tz, 1)) { put.terr.push(M4(tx, tz, rnd() * 6.3)); vend(tx + 0.7, tz, -Math.PI / 2); }
        const [vx, vz] = loc(x, z, yaw, -0.5, -0.1); vend(vx, vz, yaw, 0.75); // le cuisinier, dans le camion
        const [cx, cz] = loc(x, z, yaw, -0.9 + rnd(), 1.0); vend(cx, cz, yaw + Math.PI);
      } else {
        const m = M4(x, z, yaw); put[kind].push(m);
        if (kind !== 'the') { put.can.push(kind === 'cart' ? M4(...loc(x, z, yaw, 0.65, 0), yaw, 0.05, 0.75) : m); put.canC.push(new THREE.Color(pick(CAN, rnd))); }
        rAdd({ x, z, r: kind === 'the' ? 0.5 : 0.8 });
        const [vx, vz] = loc(x, z, yaw, kind === 'the' ? -0.45 : 0, kind === 'the' ? -0.5 : -0.95); vend(vx, vz, yaw);
        if (rnd() < 0.55) { const [cx, cz] = loc(x, z, yaw, (rnd() - 0.5) * 1.4, kind === 'the' ? 1.0 : 1.25); vend(cx, cz, yaw + Math.PI + (rnd() - 0.5) * 0.6); }
        if (rnd() < 0.25) { const [cx, cz] = loc(x, z, yaw, (rnd() - 0.5) * 1.8, 1.6); vend(cx, cz, yaw + Math.PI + (rnd() - 0.5) * 0.8); }
      }
      nSpots++; return true;
    };
    const along = (e, sd, s0, s1, step, chooser) => { // le long du trottoir d'une rue
      for (let s = s0; s < s1; s += step) {
        const q = rAt(e, s), nx = -q[3] * sd, nz = q[2] * sd, kind = chooser(); if (!kind) continue;
        const off = e.w / 2 + 2.6 + (kind === 'truck' ? 1.7 : kind === 'the' ? 0.8 : 0.75);
        spot(q[0] + nx * off, q[1] + nz * off, Math.atan2(-nx, -nz), kind);
      }
    };
    const lm = id => RD.lm.find(l => l[0] === id);
    // 1. sous l'AFARCO : le trottoir nord de l'avenue Gamal Abdel Nasser est un marché
    const af = lm('afarco'), mc = lm('marche');
    const dense = (cx, cz, R, step, wantN, mode) => { // mode : 'curb' (sur le trottoir, sous les arcades), 'trucks' (food trucks alignés), sinon étals
      for (const k of rEdgesNear(cx, cz, R, [])) {
        const e = RD.E[k]; if (e.pv !== 1 || e.cl > 4 || e.link) continue;
        for (const sd of [1, -1]) {
          const qm = rAt(e, e.L / 2); if (wantN !== undefined && Math.sign(q2n(qm, sd)) !== wantN) continue; // côté voulu (nord : n.z < 0)
          const [t0, t1] = rTrim(e);
          for (let s = t0 + 5, i = 0; s < t1 - 5; s += step, i++) {
            const q = rAt(e, s); if (Math.hypot(q[0] - cx, q[1] - cz) > R) continue;
            const nx = -q[3] * sd, nz = q[2] * sd, r = rnd();
            if (mode === 'curb') { const kind = r < 0.42 ? 'fruit' : r < 0.62 ? 'tissu' : r < 0.86 ? 'cart' : 'the', off = e.w / 2 + (kind === 'the' ? 1.6 : 1.15); spot(q[0] + nx * off, q[1] + nz * off, Math.atan2(nx, nz), kind, true); }
            else { const kind = mode === 'trucks' ? (i % 2 ? 'truck' : r < 0.5 ? 'cart' : 'the') : r < 0.45 ? 'fruit' : r < 0.65 ? 'tissu' : r < 0.85 ? 'cart' : 'the', off = e.w / 2 + 2.6 + (kind === 'truck' ? 1.7 : kind === 'the' ? 0.8 : 0.75); spot(q[0] + nx * off, q[1] + nz * off, Math.atan2(-nx, -nz), kind); }
          }
        }
      }
    };
    const q2n = (q, sd) => q[2] * sd; // composante z de la normale côté sd
    if (af) { dense(af[3], af[4], 110, 5.2, -1, 'curb'); dense(af[3], af[4] + 15, 90, 7.5, 1, 'trucks'); } // sous l'AFARCO, et en face (côté tour SNIM) les food trucks
    if (mc) dense(mc[3], mc[4], 150, 8, undefined, null);
    // 2. ailleurs : des marchands ambulants le long des grandes rues, surtout près des commerces
    const dn = new Map(), dk = (x, z) => Math.floor(x / 250) + ',' + Math.floor(z / 250);
    for (const d of RD.dest) dn.set(dk(d[3], d[4]), (dn.get(dk(d[3], d[4])) || 0) + 1);
    const dens = (x, z) => { let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) n += dn.get((Math.floor(x / 250) + a) + ',' + (Math.floor(z / 250) + b)) || 0; return n; };
    for (const e of RD.E) {
      if (nSpots >= CAP) break;
      if (e.pv !== 1 || e.cl > 3 || e.link || e.L < 40) continue;
      const [t0, t1] = rTrim(e);
      for (let s = t0 + 29; s < t1 - 12 && nSpots < CAP; s += 68) for (const sd of (e.ow ? [1] : [-1, 1])) {
        const q = rAt(e, s), p = Math.min(0.42, 0.02 + 0.025 * dens(q[0], q[1])); if (rnd() > p) continue;
        const r = rnd(), kind = r < 0.42 ? 'fruit' : r < 0.6 ? 'cart' : r < 0.76 ? 'the' : r < 0.9 ? 'tissu' : e.cl <= 2 ? 'truck' : 'cart';
        const nx = -q[3] * sd, nz = q[2] * sd, off = e.w / 2 + 2.6 + (kind === 'truck' ? 1.7 : kind === 'the' ? 0.8 : 0.75);
        spot(q[0] + nx * off, q[1] + nz * off, Math.atan2(-nx, -nz), kind);
      }
    }
    const opt = o => Object.assign({ parent: rTgt.g, cull: rTgt.cull, cell: 160, cast: !LITE, maxD: LITE ? 200 : 320 }, o);
    for (const k of ['fruit', 'tissu', 'cart', 'the']) if (put[k].length) A.addInstanced(G[k], G.vmat, put[k], null, opt({ name: 'sl_' + k }));
    if (put.can.length) A.addInstanced(G.canopy, G.cmat, put.can, put.canC, opt({ name: 'sl_can' }));
    if (put.truck.length) { A.addInstanced(G.truck, G.vmat, put.truck, null, opt({ name: 'sl_truck', maxD: LITE ? 260 : 420 })); A.addInstanced(G.truckBody, G.bmat, put.body, put.bodyC, opt({ name: 'sl_tbody', maxD: LITE ? 260 : 420 })); }
    put.sign.forEach((l, i) => { if (l.length) A.addInstanced(G.signG, G.signs[i], l, null, opt({ name: 'sl_sign' + i, cast: false, maxD: LITE ? 260 : 420 })); });
    if (put.terr.length) A.addInstanced(G.terrasse, G.vmat, put.terr, null, opt({ name: 'sl_terr', maxD: LITE ? 160 : 240 }));
    rParkedCars(); rGardens();
    if (!race) { VEND.grid.clear(); VEND.list.forEach((v, i) => { const k = Math.floor(v.x / 64) + ',' + Math.floor(v.z / 64); if (!VEND.grid.has(k)) VEND.grid.set(k, []); VEND.grid.get(k).push(i); }); }
    if (TEST) console.log('vie de rue', race ? 'course' : 'taxi', nSpots, 'stands', VEND.list.length, 'personnages');
  }
  function rGardens() { // jardins du Palais des Congrès (pelouses, palmiers, arbres) et palmiers autour de la tour SNIM
    const rnd = seeded(909), lm = id => RD.lm.find(l => l[0] === id), pal = lm('palais'), snim = lm('snim'), palms = [], lawns = [];
    const free = (x, z, r) => !(RM && RM(x, z)) && !rAsphalt(x, z, -1, 1.5) && !rInBld(x, z, r);
    if (pal) {
      const f = pal[5], fx = Math.sin(f), fz = Math.cos(f), rx = fz, rz = -fx; // devant du palais, vers le Fasq
      for (let i = 0; i < 70; i++) { const u = (rnd() - 0.5) * 150, v = 40 + rnd() * 120, x = pal[3] + fx * v + rx * u, z = pal[4] + fz * v + rz * u; if (free(x, z, 3)) palms.push([x, z, 0.7 + rnd() * 0.3]); }
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = pal[3] + Math.cos(a) * 46, z = pal[4] + Math.sin(a) * 46; if (free(x, z, 2)) palms.push([x, z, 0.85]); }
      for (const [v, u, w, d] of [[52, -30, 34, 22], [52, 30, 34, 22], [90, -45, 40, 26], [90, 45, 40, 26], [128, 0, 50, 20]]) { const x = pal[3] + fx * v + rx * u, z = pal[4] + fz * v + rz * u; if (!(RM && RM(x, z)) && !rAsphalt(x, z, -1, 3)) lawns.push([x, z, w, d, Math.atan2(fx, fz)]); }
    }
    if (snim) for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, x = snim[3] + Math.cos(a) * 30, z = snim[4] + Math.sin(a) * 22; if (free(x, z, 2)) palms.push([x, z, 0.8]); }
    if (palms.length) {
      const pm = palms.map(([x, z, sc]) => new THREE.Matrix4().compose(_v.set(x, 0.05, z), _q.setFromAxisAngle(_Y, rnd() * 6.3), _s.set(sc, sc, sc)).clone());
      const opt = o => Object.assign({ parent: rTgt.g, cull: rTgt.cull, cell: 300, cast: !LITE }, o);
      A.addInstanced(A.PALM.trunk, A.PALM.trunkMat, pm, null, opt({ maxD: LITE ? 360 : 580, name: 'gpalmT' }));
      A.addInstanced(A.PALM.crown, A.PALM.crownMat, pm, pm.map(() => new THREE.Color().setHSL(0.26 + rnd() * 0.07, 0.5 + rnd() * 0.2, 0.55 + rnd() * 0.2)), opt({ maxD: LITE ? 400 : 620, name: 'gpalmC' }));
      for (const [x, z] of palms) rAdd({ x, z, r: 0.35 });
    }
    if (lawns.length) {
      const gt = A.canvasTex(128, 128, (c, w, h) => { A.noise(c, w, h, '#6f9a3c', 0.22, 9000); c.fillStyle = 'rgba(200,170,110,0.18)'; for (let k = 0; k < 40; k++) c.fillRect(Math.random() * w, Math.random() * h, 6, 3); }, true);
      const gm = A.surf({ map: gt, roughness: 1, envMapIntensity: 0.1 }); gm.polygonOffset = true; gm.polygonOffsetFactor = -1; gm.polygonOffsetUnits = -2;
      const geos = lawns.map(([x, z, w, d, yaw]) => { const g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 6, uv.getY(i) * d / 6); g.rotateX(-Math.PI / 2); g.rotateY(yaw); g.translate(x, 0.04, z); return g.toNonIndexed(); });
      const m = new THREE.Mesh(mergeGeos(geos), gm); m.receiveShadow = !LOW; rTgt.g.add(m);
      const hedge = A.surf({ color: 0x3f6b2a, roughness: 0.9 }), hg = [];
      for (const [x, z, w, d, yaw] of lawns) { const c = Math.cos(yaw), sn = Math.sin(yaw); for (const [u, v, a2, b2] of [[0, d / 2, w, 0.6], [0, -d / 2, w, 0.6], [w / 2, 0, 0.6, d], [-w / 2, 0, 0.6, d]]) { const g = new THREE.BoxGeometry(a2, 0.7, b2); g.rotateY(yaw); g.translate(x + u * c + v * sn, 0.35, z - u * sn + v * c); hg.push(g.toNonIndexed()); } }
      const hm = new THREE.Mesh(mergeGeos(hg), hedge); hm.castShadow = !LITE; hm.receiveShadow = !LOW; rTgt.g.add(hm);
    }
  }
  function rParkedCars() { // parkings pleins autour de la tour SNIM, du Fasq et du Palais des Congrès
    const types = ['civil', 'civil', 'suv', 'taxi2', 'civil'].filter(k => VT[k] && VT[k].parts); if (!types.length) return;
    const rnd = seeded(4242), byType = {};
    const lm = id => RD.lm.find(l => l[0] === id), snim = lm('snim'), fasq = lm('fasq'), pal = lm('palais');
    const LOTS = []; // [cx, cz, angle de la rangée, nb par rangée, décalages des rangées]
    if (snim) { LOTS.push([snim[3] - 70, snim[4] + 12, 0.15, 16, [-17.5, -11.9, -2.8, 2.8, 11.9, 17.5]]); LOTS.push([snim[3] + 4, snim[4] - 22, 0.15, 9, [0]]); }
    if (fasq) LOTS.push([fasq[3] - 46, fasq[4] + 22, -0.29, 11, [-11.5, -5.8, 0, 5.8]]);
    if (pal) { LOTS.push([405, -2372, -0.29, 14, [-12, -6.3, 0, 6.3, 12]]); LOTS.push([625, -2420, -0.29, 12, [-6.3, 0, 6.3]]); LOTS.push([pal[3] + 70, pal[4] + 70, -0.29, 10, [-3, 3]]); }
    for (const [cx, cz, a, n, rows] of LOTS) {
      const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
      rows.forEach((ro, ri) => {
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.18) continue; // place libre
          const t = (i - (n - 1) / 2) * 2.9, x = cx + ux * t + vx * ro, z = cz + uz * t + vz * ro;
          if ((RM && RM(x, z)) || rAsphalt(x, z, -1, 1.2) || rInBld(x, z, 2.4)) continue;
          const yaw = Math.atan2(vx, vz) + (ri % 2 ? Math.PI : 0) + (rnd() - 0.5) * 0.08, k = pick(types, rnd), T = VT[k];
          (byType[k] = byType[k] || { m: [], c: [] }).m.push(new THREE.Matrix4().compose(_v.set(x, 0.06, z), _q.setFromAxisAngle(_Y, yaw), _s.set(1, 1, 1)).clone());
          byType[k].c.push(new THREE.Color(T.tint ? pick(T.tint, rnd) : 0xffffff));
          rOBB(x, z, yaw, T.hw, T.hl, 1.5);
        }
      });
    }
    // sol des parkings : dalle d'enrobé et marquage des places
    const slab = [], lines = [];
    for (const [cx, cz, a, n, rows] of LOTS) {
      if (RM && RM(cx, cz)) continue;
      const lo = Math.min(...rows) - 2.9, hi = Math.max(...rows) + 2.9, wu = n * 2.9 + 1.6, mid = (lo + hi) / 2, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
      const pg = new THREE.PlaneGeometry(wu, hi - lo); pg.rotateX(-Math.PI / 2); pg.rotateY(-a); pg.translate(cx + vx * mid, 0.045, cz + vz * mid); slab.push(pg.toNonIndexed());
      for (const ro of rows) for (let i = 0; i <= n; i++) { const t = (i - n / 2) * 2.9, l = new THREE.PlaneGeometry(0.12, 4.8); l.rotateX(-Math.PI / 2); l.rotateY(-a); l.translate(cx + ux * t + vx * ro, 0.055, cz + uz * t + vz * ro); lines.push(l.toNonIndexed()); }
    }
    if (slab.length) {
      const sm = A.surf({ color: 0x55575a, roughness: 0.95 }); sm.polygonOffset = true; sm.polygonOffsetFactor = -1; sm.polygonOffsetUnits = -2;
      const lm2 = A.surf({ color: 0xe9e9e4, roughness: 0.8 }); lm2.polygonOffset = true; lm2.polygonOffsetFactor = -2; lm2.polygonOffsetUnits = -4;
      for (const [geos, mat] of [[slab, sm], [lines, lm2]]) { const g = mergeGeos(geos), m = new THREE.Mesh(g, mat); m.receiveShadow = !LOW; rTgt.g.add(m); }
    }
    for (const k in byType) {
      const T = VT[k], L = byType[k];
      for (const p of T.parts) { const tinted = T.tint && (!T.tintMat || p.mat === T.tintMat); A.addInstanced(p.geo, texFix(lowMat(p.mat)), L.m, tinted ? L.c : null, { parent: rTgt.g, cull: rTgt.cull, cell: 160, cast: !LITE, maxD: LITE ? 240 : 380, name: 'park_' + k }); }
    }
  }
  function rBuildLights() { // feux tricolores réels : un poteau à droite de chaque arrivée
    const poles = [], boxes = [], lamps = [];
    for (let n = 0; n < RD.NN; n++) {
      if (!RD.sig[n]) continue;
      for (const k of RD.inc[n]) {
        const e = RD.E[k]; if (e.ow && e.b !== n) continue; // pas d'arrivée par ce côté
        const atEnd = e.b === n, s = atEnd ? Math.max(0, e.L - RD.rn[n] - 0.5) : Math.min(e.L, RD.rn[n] + 0.5), q = rAt(e, s);
        const tx = q[2] * (atEnd ? 1 : -1), tz = q[3] * (atEnd ? 1 : -1), rx = -tz, rz = tx, h = Math.atan2(tx, tz);
        const px = q[0] + rx * (e.w / 2 + 1.1), pz = q[1] + rz * (e.w / 2 + 1.1), rot = h + Math.PI;
        poles.push(new THREE.Matrix4().compose(_v.set(px, 0, pz), _q.setFromAxisAngle(_Y, rot), _s.set(1, 1, 1)).clone());
        const hx = px - rx * 1.6, hz = pz - rz * 1.6;
        boxes.push(new THREE.Matrix4().compose(_v.set(hx, 4.35, hz), _q.setFromAxisAngle(_Y, rot), _s.set(1, 1, 1)).clone());
        RHEADS.push({ n, axis: Math.abs(Math.cos(h - RD.axis[n])) > 0.7071 ? 0 : 1 });
        for (let L = 0; L < 3; L++) lamps.push(new THREE.Matrix4().compose(_v.set(hx - tx * 0.17, 4.75 - L * 0.4, hz - tz * 0.17), _q.setFromAxisAngle(_Y, rot), _s.set(1, 1, 1)).clone());
        rAdd({ x: px, z: pz, r: 0.3 });
      }
    }
    if (!poles.length) return;
    const poleG = new THREE.CylinderGeometry(0.09, 0.11, 5, 6); poleG.translate(0, 2.5, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.7); arm.rotateY(Math.PI / 2); arm.translate(-0.85, 4.9, 0);
    const pg = mergeGeos([poleG.toNonIndexed(), arm.toNonIndexed()].map(g => { if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }));
    A.addInstanced(pg, A.surf({ color: 0x2b2f33, roughness: 0.6, metalness: 0.4 }), poles, null, { parent: rTgt.g, cull: rTgt.cull, cell: 440, cast: !LITE, maxD: 420, name: 'rtlPole' });
    A.addInstanced(new THREE.BoxGeometry(0.42, 1.3, 0.3), A.surf({ color: 0x15171a, roughness: 0.7 }), boxes, null, { parent: rTgt.g, cull: rTgt.cull, cell: 440, cast: !LITE, maxD: 420, name: 'rtlBox' });
    rLampIM = new THREE.InstancedMesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshBasicMaterial({ toneMapped: false }), lamps.length);
    lamps.forEach((m, k) => { rLampIM.setMatrixAt(k, m); rLampIM.setColorAt(k, LCOL.R[1]); }); rLampIM.frustumCulled = false; rTgt.g.add(rLampIM);
  }
  const rLight = (n, axis) => { let ph = (lightT + RD.ofs[n]) % CYC; if (axis) ph = (ph + CYC / 2) % CYC; if (ph < G_T) return { s: 'G', toG: 0, left: G_T - ph }; if (ph < G_T + Y_T) return { s: 'Y', toG: CYC - ph, left: G_T + Y_T - ph }; return { s: 'R', toG: CYC - ph, left: CYC - ph }; };
  const rAxisOf = (n, h) => Math.abs(Math.cos(h - RD.axis[n])) > 0.7071 ? 0 : 1;
  function rUpdateLights() {
    if (!rLampIM) return;
    for (let h = 0; h < RHEADS.length; h++) { const H = RHEADS[h], s = rLight(H.n, H.axis).s; rLampIM.setColorAt(h * 3, s === 'R' ? LCOL.R[0] : LCOL.R[1]); rLampIM.setColorAt(h * 3 + 1, s === 'Y' ? LCOL.Y[0] : LCOL.Y[1]); rLampIM.setColorAt(h * 3 + 2, s === 'G' ? LCOL.G[0] : LCOL.G[1]); }
    rLampIM.instanceColor.needsUpdate = true;
  }
  function rBuildSigns() { // panneaux bilingues des carrefours nommés
    const g = new THREE.Group();
    for (let n = 0; n < RD.NN; n++) {
      const cn = RD.carN[n]; if (!cn) continue;
      let e = null; for (const k of RD.inc[n]) if (!e || RD.E[k].cl < e.cl) e = RD.E[k];
      const s = e.a === n ? Math.min(e.L, RD.rn[n] + 3) : Math.max(0, e.L - RD.rn[n] - 3), q = rAt(e, s), rx = -q[3], rz = q[2], x = q[0] + rx * (e.w / 2 + 2.2), z = q[1] + rz * (e.w / 2 + 2.2);
      if (RM && RM(x, z)) continue;
      const sg = new THREE.Group(); sg.position.set(x, 0, z); sg.rotation.y = Math.atan2(q[2], q[3]) + Math.PI / 2;
      A.prim(sg, new THREE.CylinderGeometry(0.1, 0.1, 5.6, 8), A.poleMat, 0, 2.8, 0);
      A.signMesh(sg, A.textTex([{ t: cn[0].toUpperCase(), y: 0.32, size: 92 }, { t: cn[1] || ' ', y: 0.74, size: 84, font: '700 SZpx Arial, Tahoma, sans-serif' }], { bg: '#0b6b3a', fg: '#ffffff', border: '#ffffff', w: 768, h: 230 }), 5, 1.5, 0, 4.9, 0.12, 0.9);
      g.add(sg); rAdd({ x, z, r: 0.3 });
    }
    rTgt.g.add(g); A.mergeGroup(g);
  }
  function rCurb(e, s, side, inLane) { // point sur le trottoir (m) et dans la voie de droite (z), côté side (+1 = droite de a->b)
    const q = rAt(e, s), rx = -q[3] * side, rz = q[2] * side, lane = e.ow ? e.w / 2 - 1.9 : Math.max(1.9, e.w / 2 - 1.9);
    return { mx: q[0] + rx * (e.w / 2 + 1.3), mz: q[1] + rz * (e.w / 2 + 1.3), zx: q[0] + rx * (inLane === false ? 0 : lane), zz: q[1] + rz * (inLane === false ? 0 : lane), look: Math.atan2(-rx, -rz), e: e.k, s, side };
  }
  function rBuildStops() {
    RSTOPS.length = 0; RPLACES.length = 0;
    const shel = [];
    for (const [k, s, side] of RD.stops) {
      const e = RD.E[k], sp = rCurb(e, s, side);
      RSTOPS.push(Object.assign({ client: null, cool: 0, id: RSTOPS.length }, sp));
      const fx = -Math.sin(sp.look), fz = -Math.cos(sp.look); shel.push([sp.mx + fx * 1.2, 0.05, sp.mz + fz * 1.2, sp.look, 0.8]); rAdd({ x: sp.mx + fx * 1.6, z: sp.mz + fz * 1.6, r: 1.2 });
    }
    const src = lib.getObjectByName('P_BusStop') || (A.ASSETS.city && A.ASSETS.city.getObjectByName('P_BusStop'));
    if (src && shel.length) for (const b of bake(src)) A.addInstanced(b.geo, texFix(lowMat(b.mat)), shel.map(([x, y, z, r, s]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_Y, r), new THREE.Vector3(s, s, s))), null, { parent: rTgt.g, cull: rTgt.cull, cell: 300, cast: !LITE, maxD: 420, name: 'rshelter' });
    for (const [id, name, ar, x, z, face, k, s, side] of RD.lm) RPLACES.push(Object.assign({ id, name, ar, rx: x, rz: z, lmFace: face }, rCurb(RD.E[k], s, side)));
    RD.dest.forEach(([name, ar, cat, x, z, k, s, side], i) => RPLACES.push(Object.assign({ id: 'rp' + i, name, ar, cat, pb: true, rx: x, rz: z }, rCurb(RD.E[k], s, side))));
    for (let n = 0; n < RD.NN; n++) { const cn = RD.carN[n]; if (!cn) continue; let e = null; for (const k of RD.inc[n]) if (!RD.E[k].ow && (!e || RD.E[k].cl < e.cl)) e = RD.E[k]; if (!e) continue; const s = e.a === n ? Math.min(e.L, RD.rn[n] + 14) : Math.max(0, e.L - RD.rn[n] - 14); RPLACES.push(Object.assign({ id: 'rc' + n, name: cn[0], ar: cn[1] || '', cat: 'carrefour', node: n }, rCurb(e, s, 1))); }
  }

  /* --- trafic sur les vraies rues --- */
  function rEdgePath(c) {
    const e = RD.E[c.e], [s0, s1] = rTrim(e), L = rLanes(e), o = L[clamp(c.lane, 0, L.length - 1)];
    setPath(c, rLanePts(e, c.dir, o, s0, s1)); c.piece = 'edge'; c.o = o;
    c.endN = c.dir > 0 ? e.b : e.a; c.vlim = RW_V[e.cl] * (e.pv === 1 ? 1 : 0.8) * (e.link ? 0.8 : 1);
    const l = RD.inc[c.endN]; c.yield = false;
    if (l.length >= 3 && !RD.sig[c.endN]) { let mx = 9; for (const k of l) if (k !== c.e) mx = Math.min(mx, RD.E[k].cl); c.yield = e.cl >= mx; }
    c.axis = RD.sig[c.endN] ? rAxisOf(c.endN, Math.atan2(c.pts[c.pts.length - 2] - c.pts[c.pts.length - 4], c.pts[c.pts.length - 1] - c.pts[c.pts.length - 3])) : 0;
  }
  function rChooseNext(c) {
    const e = RD.E[c.e], n = c.endN, hin = (() => { const p = c.pts, m = p.length; return Math.atan2(p[m - 2] - p[m - 4], p[m - 1] - p[m - 3]); })();
    const opts = []; let tot = 0;
    for (const k of RD.inc[n]) {
      if (k === c.e) continue; const f = RD.E[k]; if (f.cl >= 6 || (f.cl === 5 && !c.cart && R() > 0.25)) continue;
      if (f.ow && f.a !== n) continue;
      const dir = f.a === n ? 1 : -1, t = rTan(f, dir > 0 ? 0 : f.L), hout = Math.atan2(t[0] * dir, t[1] * dir), da = wrapAng(hout - hin);
      let w = [6, 5, 4, 3, 1.4, 0.4, 0][f.cl] * (Math.abs(da) < 0.6 ? 2.6 : 1) * (f.cl < e.cl ? 1.4 : 1); if (c.cart && f.cl <= 1) w *= 0.3;
      opts.push([k, dir, da, w]); tot += w;
    }
    if (!opts.length) { // impasse : demi-tour (ou sens interdit si vraiment coincé)
      if (!e.ow) { c.ne = c.e; c.ndir = -c.dir; c.turn = 2; c.nl = 0; return; }
      for (const k of RD.inc[n]) if (k !== c.e) { const f = RD.E[k]; opts.push([k, f.a === n ? 1 : -1, 0, 1]); tot += 1; }
      if (!opts.length) { c.ne = c.e; c.ndir = -c.dir; c.turn = 2; c.nl = 0; return; }
    }
    let r = R() * tot, pk = opts[0]; for (const o of opts) { r -= o[3]; if (r <= 0) { pk = o; break; } }
    c.ne = pk[0]; c.ndir = pk[1]; c.turn = Math.abs(pk[2]) < 0.6 ? 0 : pk[2] > 0 ? -1 : 1; // da > 0 : à gauche (x est, z sud, cap = atan2(x, z))
    const nL = rLanes(RD.E[c.ne]).length; c.nl = c.turn === 1 ? nL - 1 : c.turn === -1 ? 0 : Math.min(c.lane, nL - 1);
  }
  function rTurnPath(c) {
    const f = RD.E[c.ne], [s0, s1] = rTrim(f), L = rLanes(f), o2 = L[clamp(c.nl, 0, L.length - 1)];
    const nxt = rLanePts(f, c.ndir, o2, s0, s1), p = c.pts, m = p.length;
    const p0x = p[m - 2], p0z = p[m - 1], d0x = p0x - p[m - 4], d0z = p0z - p[m - 3], p2x = nxt[0], p2z = nxt[1], d2x = nxt[2] - p2x, d2z = nxt[3] - p2z;
    const l0 = Math.hypot(d0x, d0z) || 1, l2 = Math.hypot(d2x, d2z) || 1, ux = d0x / l0, uz = d0z / l0, vx = d2x / l2, vz = d2z / l2;
    let p1x, p1z; const den = ux * vz - uz * vx, gap = Math.hypot(p2x - p0x, p2z - p0z);
    if (c.turn === 2) { p1x = RD.NX[c.endN] + ux * 3; p1z = RD.NZ[c.endN] + uz * 3; }
    else if (Math.abs(den) < 0.15) { p1x = (p0x + p2x) / 2; p1z = (p0z + p2z) / 2; }
    else { const t = ((p2x - p0x) * vz - (p2z - p0z) * vx) / den; const tt = clamp(t, 0, gap * 1.2); p1x = p0x + ux * tt; p1z = p0z + uz * tt; }
    setPath(c, bezierPts(p0x, p0z, p1x, p1z, p2x, p2z, gap < 4 ? 2 : 8)); c.piece = 'turn'; c.tn = c.endN;
  }
  function rEnterNext(c) { c.e = c.ne; c.dir = c.ndir; c.lane = c.nl; rEdgePath(c); rChooseNext(c); }
  function rSpawnCar(type, e, dir, lane, s) {
    const t = VT[type]; if (!t || !t.free || !t.free.length) return null;
    const hex = t.tint ? pick(t.tint) : null, c = { type, t, slot: t.free.pop(), hex, col: hex !== null ? lin(hex) : null, e, dir, lane, s: s || 0, v: 6, vmax: (t.vmax || 12.5) + R() * 2, hl: t.hl, hw: t.hw, x: 0, z: 0, h: 0, vx: 0, vz: 0, police: !!t.police, cart: !!t.cart, bump: 0, honkT: 0, stuck: 0, ghost: 0, id: cars.length, gap: 99, wait: 0, i: 0, j: 0, d: 0 };
    rEdgePath(c); if (c.cart) c.lane = rLanes(RD.E[e]).length - 1, rEdgePath(c);
    c.s = Math.min(c.s, Math.max(0, c.len - 2)); rChooseNext(c); const p = pathAt(c, c.s); c.x = p[0]; c.z = p[1]; c.h = p[2];
    if (me && Math.hypot(c.x - me.x, c.z - me.z) < 28) { t.free.push(c.slot); return null; }
    if (cars.some(o => !o.chase && Math.hypot(o.x - c.x, o.z - c.z) < 9)) { t.free.push(c.slot); return null; }
    cars.push(c); return c;
  }
  function rRandomEdge(x, z, rMin, rMax, maxCl) { // une arête au hasard dans l'anneau autour de (x, z)
    for (let k = 0; k < 24; k++) {
      const a = R() * Math.PI * 2, r = rMin + R() * (rMax - rMin), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const l = RD.idx.get(rKey(Math.floor(px / R_CELL), Math.floor(pz / R_CELL))); if (!l || !l.length) continue;
      const e = RD.E[l[Math.floor(R() * l.length)]]; if (e.cl > maxCl || e.L < 14) continue; if (e.cl === 4 && R() > 0.45) continue;
      return e;
    }
    return null;
  }
  const R_TRAFFIC_R = LITE ? 300 : 420;
  function rPopulateTraffic() {
    for (const c of cars) freeCar(c); cars = [];
    rTrafficTick(true);
  }
  function rTrafficTick(all) {
    if (!me) return;
    const R_ = R_TRAFFIC_R;
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.chase) continue; if (Math.hypot(c.x - me.x, c.z - me.z) > R_ + 60) { freeCar(c); cars.splice(k, 1); } }
    const n = Math.round((LOW ? 22 : LITE ? 36 : 52) * [0.65, 1, 1.35][T.traffic]), types = [];
    for (const k in VT) if (VT[k].ims && !VT[k].police && !VT[k].cart) for (let q = 0; q < Math.round(VT[k].w * 4); q++) types.push(k);
    const fx = Math.sin(me.h), fz = Math.cos(me.h);
    let tries = all ? 400 : 6;
    while (tries-- > 0) {
      const pol = cars.filter(c => c.police && !c.chase).length, crt = cars.filter(c => c.cart).length, tot = cars.filter(c => !c.chase).length;
      const type = pol < (LOW ? 2 : 3) ? 'police' : crt < (LOW ? 2 : 4) ? 'cart' : tot < n ? pick(types) : null; if (!type) break;
      const e = rRandomEdge(me.x, me.z, all ? 30 : 180, R_, type === 'cart' ? 4 : 4); if (!e) continue;
      const dir = e.ow ? 1 : R() < 0.5 ? 1 : -1, nl = rLanes(e).length, s0 = 4 + R() * Math.max(1, e.L - 20);
      const q = rAt(e, s0); if (!all && ((q[0] - me.x) * fx + (q[1] - me.z) * fz) > 0 && Math.hypot(q[0] - me.x, q[1] - me.z) < 260) continue; // pas sous les yeux du joueur
      rSpawnCar(type, e.k, dir, Math.floor(R() * nl), 0);
      const c = cars[cars.length - 1]; if (c && c.e === e.k && c.s === 0) { c.s = Math.min(c.len - 2, Math.max(0, s0 - rTrim(e)[0])); const p = pathAt(c, c.s); c.x = p[0]; c.z = p[1]; c.h = p[2]; }
    }
  }
  function rLaneSwap(c) { const L = rLanes(RD.E[c.e]); if (L.length < 2) return false; const s0 = c.s; c.lane = 1 - c.lane; rEdgePath(c); c.s = Math.min(s0, c.len - 1); rChooseNext(c); return true; }
  function rPlaceOnRoad(c, x, z) { // remettre une voiture (fin de poursuite) sur la voie la plus proche
    const q = rNearest(x, z, 80, 4); if (!q) return false;
    const fwd = Math.sin(c.h || 0) * q.tx + Math.cos(c.h || 0) * q.tz;
    c.e = q.e.k; c.dir = q.e.ow ? 1 : fwd >= 0 ? 1 : -1; c.lane = 0; rEdgePath(c);
    const [s0, s1] = rTrim(q.e); c.s = clamp(c.dir > 0 ? q.s - s0 : s1 - q.s, 0, Math.max(0, c.len - 1)); c.v = 4; rChooseNext(c); return true;
  }

  /* --- piétons et animaux sur les trottoirs réels --- */
  function rSidewalk(p) { // position sur le trottoir : arête p.e, côté p.sd, abscisse p.s
    const e = RD.E[p.e], q = rAt(e, p.s), off = e.w / 2 + (e.cl <= 3 && e.pv === 1 ? 1.4 : 0.9) + p.lat * 0.4;
    return [q[0] - q[3] * p.sd * off, q[1] + q[2] * p.sd * off, Math.atan2(q[2] * p.dir, q[3] * p.dir)];
  }
  const _re2 = [];
  function rAsphalt(x, z, skip, m) { // ce point est-il sur la chaussée d'une autre rue ?
    for (const k of rEdgesNear(x, z, 14, _re2)) {
      if (k === skip) continue; const f = RD.E[k], P_ = f.pts, lim = f.w / 2 + (m || 0.4);
      for (let i = 0; i < P_.length / 2 - 1; i++) { const ax = P_[2 * i], az = P_[2 * i + 1], dx = P_[2 * i + 2] - ax, dz = P_[2 * i + 3] - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1); if (Math.hypot(x - ax - dx * t, z - az - dz * t) < lim) return true; }
    }
    return false;
  }
  function rSideOk(e, sd) { // trottoir praticable de ce côté (pas sur l'autre chaussée d'une avenue à deux sens, pas dans un carrefour)
    const key = sd > 0 ? 'okR' : 'okL'; if (e[key] !== undefined) return e[key];
    const [t0, t1] = rTrim(e), off = e.w / 2 + (e.cl <= 3 && e.pv === 1 ? 1.4 : 0.9) + 0.5; let ok = t1 - t0 > 2;
    for (const f of [0.1, 0.5, 0.9]) { if (!ok) break; const q = rAt(e, t0 + (t1 - t0) * f), x = q[0] - q[3] * sd * off, z = q[1] + q[2] * sd * off; if (rAsphalt(x, z, e.k)) ok = false; }
    e[key] = ok; return ok;
  }
  const rWalkable = e => e.cl <= 4 && e.L >= 10 && (rSideOk(e, 1) || rSideOk(e, -1));
  function rPlaceWalker(p, near) {
    const x0 = me ? me.x : 0, z0 = me ? me.z : 0;
    const animal = p.kind === 'animal';
    let e = null; for (let k = 0; k < 16 && !e; k++) { e = rRandomEdge(x0, z0, near ? 70 : 25, near ? 230 : 230, animal ? 6 : 4); if (e && (!rWalkable(e) || (animal && e.pv === 1 && e.cl <= 3 && k < 12))) e = null; } // les bêtes : plutôt les rues en sable
    if (!e) { e = RD.E[0]; for (const k of rEdgesNear(x0, z0, 300, _re2)) if (rWalkable(RD.E[k])) { e = RD.E[k]; break; } }
    const [t0, t1] = rTrim(e);
    p.e = e.k; p.sd = R() < 0.5 ? 1 : -1; if (!rSideOk(e, p.sd)) p.sd = -p.sd; p.dir = R() < 0.5 ? 1 : -1; p.s = t0 + R() * (t1 - t0); p.st = 'walk'; p.road = false; p.fall = 0; p.down = false; p.leader = null;
    p.lat = animal ? 3 + R() * 3 : (R() - 0.5) * 2.2;
    const q = rSidewalk(p); p.x = q[0]; p.z = q[1]; p.h = q[2];
  }
  function rWalk(p, dt, sp) {
    const e = RD.E[p.e]; p.s += p.dir * sp * dt;
    const [t0, t1] = rTrim(e);
    if (p.s < t0 || p.s > t1) { // coin de rue : on tourne dans une rue voisine (en traversant au carrefour) ou on fait demi-tour
      const n = p.s < t0 ? e.a : e.b, opts = RD.inc[n].filter(k => k !== p.e && rWalkable(RD.E[k]) && (p.kind !== 'animal' || RD.E[k].pv !== 1 || RD.E[k].cl > 3));
      const from = rSidewalk(Object.assign({}, p, { s: clamp(p.s, t0, t1) }));
      if (!opts.length) { p.s = clamp(p.s, t0, t1); p.dir = -p.dir; if (!rSideOk(e, p.sd)) p.sd = -p.sd; const q = rSidewalk(p); p.x = q[0]; p.z = q[1]; p.h = q[2]; return; }
      const k = pick(opts), f = RD.E[k], [u0, u1] = rTrim(f);
      p.e = k; p.dir = f.a === n ? 1 : -1; p.s = p.dir > 0 ? u0 + 0.3 : u1 - 0.3;
      const cand = [1, -1].filter(sd => rSideOk(f, sd)).map(sd => { p.sd = sd; const q = rSidewalk(p); return [sd, Math.hypot(q[0] - from[0], q[1] - from[1])]; }).sort((a, b) => a[1] - b[1]);
      if (cand.length) p.sd = (cand.length > 1 && p.kind === 'ped' && R() < 0.3 ? cand[1] : cand[0])[0]; // le plus souvent on tourne au coin sans traverser
      const to = rSidewalk(p);
      if (Math.hypot(to[0] - from[0], to[1] - from[1]) > 2.5) { p.overRoad = rAsphalt((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, -1, 0); p.cx0 = from[0]; p.cz0 = from[1]; p.cx1 = to[0]; p.cz1 = to[1]; p.st = 'cross'; p.t = 0; p.jay = false; p.spd2 = p.spd * 1.1; p.pauseAt = 2; p.pauseT = 0; p.rNext = { e: p.e, s: p.s, sd: p.sd, dir: p.dir }; return; }
    }
    const q = rSidewalk(p); p.x = q[0]; p.z = q[1]; p.h = q[2];
    if (R() < dt * (p.kind === 'animal' ? 0.004 : 0.003) && t1 - t0 > 24 && p.s > t0 + 8 && p.s < t1 - 8 && rSideOk(e, -p.sd) && (e.cl >= 3 || p.kind !== 'animal')) rStartJay(p);
  }
  function rStartJay(p) { // traverser la rue (jamais une avenue à deux chaussées : l'autre côté n'est pas un trottoir)
    const from = rSidewalk(p); p.rNext = { e: p.e, s: p.s, sd: -p.sd, dir: R() < 0.5 ? 1 : -1 };
    const to = rSidewalk(Object.assign({}, p, p.rNext));
    p.overRoad = true; p.cx0 = from[0]; p.cz0 = from[1]; p.cx1 = to[0]; p.cz1 = to[1]; p.st = 'cross'; p.t = 0; p.jay = true; p.spd2 = p.kind === 'animal' ? p.spd * 1.4 : 1.8 + R() * 0.8;
    p.pauseAt = 2; p.pauseT = 0; // personne ne reste planté au milieu de la route
    return true;
  }
  function rAfterCross(p) { p.overRoad = undefined; const nx_ = p.rNext; if (nx_) { p.e = nx_.e; p.s = nx_.s; p.sd = nx_.sd; p.dir = nx_.dir; } p.st = 'walk'; p.road = false; p.lat = p.kind === 'animal' ? 3 + R() * 3 : (R() - 0.5) * 2.2; }
  function rPedTick() { // les passants restent autour du joueur
    if (!me) return;
    for (const p of peds) { if (!p.on || p.client || p.down || p.leader || p.st !== 'walk') continue; if (Math.hypot(p.x - me.x, p.z - me.z) > 260) rPlaceWalker(p, true); }
  }

  /* --- noms des lieux, carrefours, quartiers --- */
  function rPlaceName(x, z) {
    let q = null, best = 1e9; for (const Q of RD.quart) { const d = Math.hypot(Q[1] - x, Q[2] - z); if (d < best) { best = d; q = Q; } }
    const out = { street: '', district: q ? q[0] : 'Nouakchott', moug: q ? q[3] : '', ar: q ? q[4] || '' : 'نواكشوط', mar: q ? q[5] || '' : '' };
    const nn = rNodesNear(x, z, 26); let node = -1, nd = 1e9;
    for (const n of nn) { const d = Math.hypot(RD.NX[n] - x, RD.NZ[n] - z); if (RD.inc[n].length >= 3 && d < RD.rn[n] + 3 && d < nd) { nd = d; node = n; } }
    if (node >= 0) { const cn = RD.carN[node]; if (cn) { out.street = cn[0]; return out; } const names = [...new Set(RD.inc[node].map(k => RD.E[k].name).filter(Boolean))]; if (names.length >= 2) { out.street = names[0] + ' × ' + names[1]; return out; } }
    const e = rNearest(x, z, 8, 6); if (e && e.d < 4) out.street = e.e.name;
    return out;
  }

  /* --- changement de carte --- */
  function setWorld(real) {
    REAL = !!real && rReady;
    grid = REAL ? colMaps.real : colMaps.grid;
    STOPS = REAL ? RSTOPS : GSTOPS; PLACES = REAL ? RPLACES : GPLACES;
    for (const o of gridStatic) o.visible = !REAL;
    realG.visible = REAL;
    if (REAL) for (const d of CULL) d.m.visible = false; else for (const d of RCULL) d.m.visible = false;
  }
  function rSpawnSpot() { // avenue Gamal Abdel Nasser, juste à l'est du Carrefour BMD, vers l'est
    const q = rNearest(1420, 24, 60, 1) || rNearest(1420, 24, 300, 4);
    const e = q.e, dir = e.ow ? 1 : (q.tx >= 0 ? 1 : -1), L = rLanes(e), o = L[L.length - 1], p = rAt(e, q.s), tx = p[2] * dir, tz = p[3] * dir;
    return { x: p[0] - tz * o, z: p[1] + tx * o, h: Math.atan2(tx, tz) };
  }
  function rResetTaxi() {
    const q = rNearest(taxi.x, taxi.z, 120, 5); if (!q) { const sp = rSpawnSpot(); placeTaxi(sp.x, sp.z, sp.h); return; }
    const e = q.e, fwd = Math.sin(taxi.h) * q.tx + Math.cos(taxi.h) * q.tz, dir = e.ow ? 1 : fwd >= 0 ? 1 : -1, L = rLanes(e), o = L[L.length - 1];
    const s = clamp(q.s, 2, e.L - 2), p = rAt(e, s), tx = p[2] * dir, tz = p[3] * dir; placeTaxi(p[0] - tz * o, p[1] + tx * o, Math.atan2(tx, tz));
  }
  let rLastSig = null;
  function rCheckRedLight() {
    let hitN = -1; for (const n of rNodesNear(taxi.x, taxi.z, 30)) if (RD.sig[n] && Math.hypot(RD.NX[n] - taxi.x, RD.NZ[n] - taxi.z) < RD.rn[n]) hitN = n;
    if (hitN >= 0 && rLastSig !== hitN && taxi.speed > 3.5) {
      const L = rLight(hitN, rAxisOf(hitN, Math.atan2(taxi.vx, taxi.vz)));
      if (L.s === 'R' && L.left < CYC / 2 - 1.5) { stats.reds++; loseStar(0.6, 'Hé ! C’était rouge !'); offence('red', 200, 1, 120); }
    }
    rLastSig = hitN;
  }
  function rNodeRing(x, z, rMin, rMax, pref) { // un nœud de carrefour à distance donnée (renforts, ambulance)
    let best = null;
    for (const n of rNodesNear(x, z, rMax)) { if (RD.inc[n].length < 2) continue; const d = Math.hypot(RD.NX[n] - x, RD.NZ[n] - z); if (d < rMin) continue; const sc = Math.abs(d - pref) + R() * 25; if (!best || sc < best.sc) best = { n, sc, x: RD.NX[n], z: RD.NZ[n] }; }
    return best;
  }
  // GPS : itinéraire par les vraies rues jusqu'à la cible
  const gps = { tx: null, tz: null, pts: null, t: 0, len: 0 };
  function rGpsAim(x, z, h, tx, tz, dt) {
    gps.t -= dt || 0;
    const off = gps.pts && gps.pts.length > 1 ? segDistPts(x, z, gps.pts) : 99;
    if (gps.tx !== tx || gps.tz !== tz || gps.t <= 0 || off > 25) { const r = rRoutePts(x, z, tx, tz, h, true); gps.pts = r.pts; gps.len = r.len; gps.tx = tx; gps.tz = tz; gps.t = 1.5; }
    const P_ = gps.pts; let bi = 0, bd = 1e9; for (let i = 0; i < Math.min(P_.length, 40); i++) { const d = Math.hypot(P_[i][0] - x, P_[i][1] - z); if (d < bd) { bd = d; bi = i; } }
    for (let i = bi; i < P_.length; i++) if (Math.hypot(P_[i][0] - x, P_[i][1] - z) > 18) return P_[i];
    return [tx, tz];
  }
  function segDistPts(x, z, P_) { let b = 1e9; for (let i = 0; i < Math.min(P_.length - 1, 40); i++) { const [ax, az] = P_[i], [bx, bz] = P_[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1); b = Math.min(b, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return b; }

  /* --- minicarte : tuiles dessinées à la demande --- */
  const rTiles = new Map(), R_TILE = 256, R_TK = 0.75;
  function rTile(tx, tz) {
    const key = tx + ',' + tz; let cv = rTiles.get(key); if (cv) { rTiles.delete(key); rTiles.set(key, cv); return cv; }
    const S = Math.round(R_TILE * R_TK); cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
    const x0 = tx * R_TILE, z0 = tz * R_TILE, m = v => v * R_TK;
    c.fillStyle = '#d8c39a'; c.fillRect(0, 0, S, S);
    // mer
    const co = RD.coast; if (x0 < (RD.coastMax || (RD.coastMax = Math.max(...co.map(p => p[0])))) + 50) { c.fillStyle = '#2a6f8f'; c.beginPath(); c.moveTo(-1, -1); for (const [x, z] of co) if (z > z0 - 300 && z < z0 + R_TILE + 300) c.lineTo(m(x - x0), m(z - z0)); c.lineTo(-1, S + 1); c.closePath(); c.fill(); }
    // bâtiments
    const Bd = RD.bld; c.fillStyle = '#a99376';
    const list = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ch = rCh.get((tx + a) + ',' + (tz + b)); if (ch) for (const i of ch.bld) list.push(i); }
    for (const i of list) { const o = Bd.off[i], bx = Bd.p[2 * o], bz = Bd.p[2 * o + 1]; if (bx < x0 - 60 || bx > x0 + R_TILE + 60 || bz < z0 - 60 || bz > z0 + R_TILE + 60) continue; c.beginPath(); for (let k = 0; k < Bd.n[i]; k++) { const px = m(Bd.p[2 * (o + k)] - x0), pz = m(Bd.p[2 * (o + k) + 1] - z0); if (k) c.lineTo(px, pz); else c.moveTo(px, pz); } c.fill(); }
    // rues
    const near = rEdgesNear(x0 + R_TILE / 2, z0 + R_TILE / 2, R_TILE * 0.75, []);
    near.sort((a, b) => RD.E[b].cl - RD.E[a].cl);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const k of near) { const e = RD.E[k]; c.strokeStyle = e.pv === 1 ? (e.cl <= 2 ? '#4a4e54' : '#5b6066') : '#c2a46f'; c.lineWidth = Math.max(2, e.w * R_TK * 1.1); c.beginPath(); for (let i = 0; i < e.pts.length / 2; i++) { const px = m(e.pts[2 * i] - x0), pz = m(e.pts[2 * i + 1] - z0); if (i) c.lineTo(px, pz); else c.moveTo(px, pz); } c.stroke(); }
    // noms
    c.font = 'bold 11px Rajdhani, Arial'; c.textAlign = 'center'; c.fillStyle = '#2b2620';
    for (const P_ of RPLACES) if (!P_.pb && P_.cat !== 'carrefour' && P_.rx > x0 && P_.rx < x0 + R_TILE && P_.rz > z0 && P_.rz < z0 + R_TILE) c.fillText(P_.name.replace('Hôtel ', ''), m(P_.rx - x0), m(P_.rz - z0));
    rTiles.set(key, cv); if (rTiles.size > 30) rTiles.delete(rTiles.keys().next().value);
    return cv;
  }
  function rDrawMap() {
    const cv = $('mapCv'); if (!cv) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height, k = W / MAP_W / R_TK;
    c.save(); c.fillStyle = '#d8c39a'; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2); c.scale(k, k);
    const span = MAP_W * 0.75, t0x = Math.floor((me.x - span) / R_TILE), t1x = Math.floor((me.x + span) / R_TILE), t0z = Math.floor((me.z - span) / R_TILE), t1z = Math.floor((me.z + span) / R_TILE);
    for (let tx = t0x; tx <= t1x; tx++) for (let tz = t0z; tz <= t1z; tz++) c.drawImage(rTile(tx, tz), (tx * R_TILE - me.x) * R_TK, (tz * R_TILE - me.z) * R_TK);
    const P = (x, z) => [(x - me.x) * R_TK, (z - me.z) * R_TK];
    // itinéraire GPS
    if (gps.pts && targetPoint()) { c.strokeStyle = job.dest ? 'rgba(255,214,10,0.9)' : 'rgba(34,197,94,0.9)'; c.lineWidth = 5 / k; c.lineJoin = 'round'; c.beginPath(); c.moveTo(...P(me.x, me.z)); for (const q of gps.pts) c.lineTo(...P(q[0], q[1])); c.stroke(); }
    const dot = (x, z, r, col, stroke) => { const [px, pz] = P(x, z); c.beginPath(); c.arc(px, pz, r / k, 0, 6.3); c.fillStyle = col; c.fill(); if (stroke) { c.lineWidth = 2 / k; c.strokeStyle = stroke; c.stroke(); } };
    if (job.st === 'free' || job.st === 'board') for (const s of STOPS) if (s.client) dot(s.zx, s.zz, 7, '#22c55e', '#fff');
    if (job.dest) { const t = A.menuTime(); dot(job.dest.zx, job.dest.zz, 9 + Math.sin(t * 6) * 2, '#ffd60a', '#111'); }
    for (const q of cars) if (q.police && !q.chase) dot(q.x, q.z, 4, '#3b82f6');
    if (taxi !== homeTaxi || foot.on) dot(homeTaxi.x, homeTaxi.z, 7, '#ffd60a', '#111');
    for (const pc of chasers) dot(pc.car.x, pc.car.z, 6, Math.sin(A.menuTime() * 12) > 0 ? '#ef4444' : '#3b82f6', '#fff');
    c.restore();
    c.save(); c.translate(W / 2, H / 2); c.rotate(Math.PI - me.h); c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fillStyle = '#ffd60a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); c.restore();
    const tgt = targetPoint();
    if (tgt) { const dx = (tgt[0] - me.x) * R_TK * k, dz = (tgt[1] - me.z) * R_TK * k; if (Math.abs(dx) > W / 2 - 10 || Math.abs(dz) > H / 2 - 10) { const a = Math.atan2(dz, dx), r = W / 2 - 14; c.save(); c.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); c.rotate(a); c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, 7); c.lineTo(-6, -7); c.closePath(); c.fillStyle = job.dest ? '#ffd60a' : '#22c55e'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke(); c.restore(); } }
  }
  const LM_CAM = { snim: [128, 46, 30, 1.25], fasq: [82, 28, 15], sheraton: [118, 34, 17], palais: [92, 28, 13], nkc: [72, 26, 14], mosquee: [78, 26, 14], marche: [62, 20, 10], bmd: [58, 20, 10] };
  function lmShot(id, x, z, face, k, cap, capSub, credit) { // la caméra tourne lentement devant la façade, côté rue
    const c = LM_CAM[id] || [70, 24, 12], sd = k % 2 ? 1 : -1, f0 = face + (c[3] || 0), a0 = f0 + 0.62 * sd, a1 = f0 + 0.18 * sd, V = (a, b, d) => new THREE.Vector3(a, b, d);
    return { dur: 3.8, p0: V(x + Math.sin(a0) * c[0], c[1], z + Math.cos(a0) * c[0]), p1: V(x + Math.sin(a1) * c[0] * 0.82, c[2] + 4, z + Math.cos(a1) * c[0] * 0.82), t0: V(x, c[2], z), t1: V(x, c[2] * 0.8, z), fov: 56, cap, capSub, credit: credit || '' };
  }
  T.lmShot = lmShot;
  function rIntroShots(full) {
    const V = (x, y, z) => new THREE.Vector3(x, y, z), shots = [], dr = DRIVERS[T.driver], h = taxi.h, fx = Math.sin(h), fz = Math.cos(h);
    if (full) {
      const port = RPLACES.find(p => p.name === 'Port de pêche') || { rx: -3486, rz: -1703 };
      shots.push({ dur: 4.2, p0: V(port.rx - 260, 38, port.rz + 160), p1: V(port.rx - 120, 26, port.rz + 60), t0: V(port.rx + 120, 0, port.rz - 40), t1: V(port.rx + 260, 4, port.rz - 60), fov: 55, title: 'TAXI NOUAKCHOTT', sub: 'La vraie ville · sur l’Atlantique', credit: '' });
      shots.push({ dur: 4.4, p0: V(900, 62, 60), p1: V(1260, 44, 40), t0: V(1500, 0, 20), t1: V(1720, 0, 10), fov: 56, title: '', sub: '', credit: 'Rues, carrefours et bâtiments : la vraie carte (OpenStreetMap, El Minassa)' });
      const credits = ['Taximen : Moulaye · Taximan Ba · Sidi · Mamadou', 'Feux rouges, piétons, animaux, police : prudence !', 'Clients aux arrêts verts · destinations en jaune'];
      ['snim', 'fasq', 'sheraton', 'palais', 'marche'].forEach((id, k) => { // bâtiments refaits d'après photos
        const q = RPLACES.find(p => p.id === id); if (!q) return;
        shots.push(lmShot(id, q.rx, q.rz, q.lmFace, k, q.name, q.ar, credits[k]));
      });
    }
    shots.push({ dur: full ? 4 : 3, p0: V(taxi.x - fx * 34 + fz * 12, 24, taxi.z - fz * 34 - fx * 12), p1: V(taxi.x - fx * 8.2, 2.9, taxi.z - fz * 8.2), t0: V(taxi.x, 0, taxi.z), t1: V(taxi.x + fx * 2, 1.2, taxi.z + fz * 2), fov: 60, title: dr.name.toUpperCase(), sub: 'prend son service · ' + fmtClock(T.timeLeft) });
    return shots;
  }

  /* ======================= HUD ======================= */
  let hudEl = null, mapBg = null, hudAcc = 0;
  function buildHud() {
    if ($('taxiHud')) { hudEl = $('taxiHud'); return; }
    hudEl = document.createElement('div'); hudEl.id = 'taxiHud';
    hudEl.innerHTML = '<div id="txMoney" class="panel"><div class="lbl">Recette du jour</div><div class="val disp" id="txCash">0 MRU</div><div class="sub" id="txSub">0 course</div></div>' +
      '<div id="txClock" class="panel disp">6:00</div>' +
      '<div id="txJob" class="panel"><div class="lbl" id="txJobT">Cherche un client</div><div class="val disp" id="txJobV">🟢 Arrêts en vert</div><div class="sub" id="txJobS"></div></div>' +
      '<div id="txWanted" class="panel hidden">🚨 <b id="txStars"></b></div>' +
      '<div id="txHp" class="panel hidden"><span id="txHpL">🚗</span><i><b id="txHpBar"></b></i></div><div id="txHurt"></div>' +
      '<div id="txSay" class="panel"></div><div id="txStreet"></div>';
    $('hud').appendChild(hudEl);
    const t = $('touch'); if (t && !$('tHorn')) { const b = document.createElement('div'); b.className = 'tbtn'; b.id = 'tHorn'; b.textContent = '📯'; t.appendChild(b); b.addEventListener('pointerdown', e => { e.preventDefault(); A.initAudio(); T.horn(); b.classList.add('on'); }); const off = () => b.classList.remove('on'); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); }
    const hint = $('hint'); if (hint && !hint.querySelector('.kbT')) { const sp = document.createElement('span'); sp.className = 'kbT'; sp.innerHTML = '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> conduire · <kbd>Espace</kbd> frein à main · <kbd>H</kbd> klaxon · <kbd>F</kbd> descendre / monter · <kbd>Maj</kbd> turbo (à pied : courir) · <kbd>R</kbd> replacer · <kbd>C</kbd> caméra'; hint.appendChild(sp); }
    const tb = $('topBtns'); if (tb && !$('btnHorn')) { const b = document.createElement('button'); b.className = 'iconBtn'; b.id = 'btnHorn'; b.title = 'Klaxon (H)'; b.textContent = '📯'; b.onclick = () => T.horn(); tb.insertBefore(b, tb.firstChild); }
    if (tb && !$('btnDoor')) { const b = document.createElement('button'); b.className = 'iconBtn'; b.id = 'btnDoor'; b.title = 'Descendre / monter (F)'; b.textContent = '🚪'; b.onclick = () => T.door(); tb.insertBefore(b, tb.firstChild); }
    if (t && !$('tDoor')) { const b = document.createElement('div'); b.className = 'tbtn'; b.id = 'tDoor'; b.textContent = '🚪'; t.appendChild(b); b.addEventListener('pointerdown', e => { e.preventDefault(); T.door(); }); }
  }
  const MAP_K = 0.6, MAP_W = 360; // px par mètre sur la carte pré-dessinée
  function buildMapBg() {
    const W = Math.ceil((X1 - X0 + 260) * MAP_K), H = Math.ceil((Z1 - Z0 + 200) * MAP_K);
    mapBg = document.createElement('canvas'); mapBg.width = W; mapBg.height = H; const c = mapBg.getContext('2d');
    const mx = x => (x - X0 + 160) * MAP_K, mz = z => (z - Z0 + 100) * MAP_K;
    c.fillStyle = '#c9a877'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2a6f8f'; c.fillRect(0, 0, mx(X0 - HW - 40), H);
    c.fillStyle = '#e8d6a8'; c.fillRect(mx(X0 - HW - 40), 0, 30 * MAP_K, H);
    c.fillStyle = '#d8ccb4'; for (let bi = 0; bi < NI - 1; bi++) for (let bj = 0; bj < NJ - 1; bj++) { const [x, z] = blockC(bi, bj); c.fillRect(mx(x - BLK / 2), mz(z - BLK / 2), BLK * MAP_K, BLK * MAP_K); }
    c.fillStyle = '#5b6066'; for (let i = 0; i < NI; i++) c.fillRect(mx(nx(i) - HW), mz(Z0 - HW), RW * MAP_K, (Z1 - Z0 + RW) * MAP_K); for (let j = 0; j < NJ; j++) c.fillRect(mx(X0 - HW), mz(nz(j) - HW), (X1 - X0 + RW) * MAP_K, RW * MAP_K);
    c.fillStyle = '#9c8f7a'; for (const pl of PLACES) if (pl.b) { const [x, z] = blockC(pl.b[0], pl.b[1]); c.fillRect(mx(x - 30), mz(z - 30), 60 * MAP_K, 60 * MAP_K); }
    c.font = 'bold 13px Rajdhani, Arial'; c.textAlign = 'center'; c.fillStyle = '#2b2620';
    const SHORT = { snim: 'SNIM', afarco: 'AFARCO', bmd: 'BMD', marche: 'Marché', mosquee: 'Mosquée', palais: 'Congrès', musee: 'Musée', mauricenter: 'Mauric.', stade: 'Stade', station: 'Gare', nkc: 'H. NKC' };
    for (const pl of PLACES) if (pl.b) { const [x, z] = blockC(pl.b[0], pl.b[1]); c.fillText(SHORT[pl.id] || pl.name.replace('Hôtel ', ''), mx(x), mz(z) + 4); }
    if (GEO) { // noms des quartiers (au centre de leurs îlots)
      const acc = {};
      for (let bj = 0; bj < NJ - 1; bj++) for (let bi = 0; bi < NI - 1; bi++) { const q = GEO.quart[bj][bi], [x, z] = blockC(bi, bj), a = acc[q] || (acc[q] = [0, 0, 0]); a[0] += x; a[1] += z; a[2]++; }
      c.font = 'italic 600 11px Rajdhani, Arial'; c.fillStyle = 'rgba(40,34,28,0.6)';
      const QS = { 'Zone des ambassades': 'Ambassades', 'Zone administrative': 'Zone admin.', 'Nouakchott Ouest': 'NKC Ouest', 'Ancien aéroport': 'Anc. aéroport', 'Arafat Secteur 1': 'Arafat S1', 'Quartier Carrefour': 'Carrefour', 'Centrale chinoise': 'Centrale ch.' };
      for (const q in acc) { const a = acc[q]; c.fillText(QS[q] || q, mx(a[0] / a[2]), mz(a[1] / a[2]) + 18); }
    }
    mapBg.mx = mx; mapBg.mz = mz;
  }
  function drawMap() {
    if (REAL) return rDrawMap();
    const cv = $('mapCv'); if (!cv || !mapBg) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height, k = W / MAP_W / MAP_K;
    const px = mapBg.mx(me.x), pz = mapBg.mz(me.z);
    c.save(); c.fillStyle = '#c9a877'; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-px, -pz);
    c.drawImage(mapBg, 0, 0);
    const dot = (x, z, r, col, stroke) => { c.beginPath(); c.arc(mapBg.mx(x), mapBg.mz(z), r / k, 0, 6.3); c.fillStyle = col; c.fill(); if (stroke) { c.lineWidth = 2 / k; c.strokeStyle = stroke; c.stroke(); } };
    if (job.st === 'free' || job.st === 'board') for (const s of STOPS) if (s.client) dot(s.zx, s.zz, 7, '#22c55e', '#fff');
    if (job.dest) { const t = A.menuTime(); dot(job.dest.zx, job.dest.zz, 9 + Math.sin(t * 6) * 2, '#ffd60a', '#111'); }
    for (const q of cars) if (q.police && !q.chase) dot(q.x, q.z, 4, '#3b82f6');
    if (taxi !== homeTaxi || foot.on) dot(homeTaxi.x, homeTaxi.z, 7, '#ffd60a', '#111'); // ton taxi garé
    for (const pc of chasers) dot(pc.car.x, pc.car.z, 6, Math.sin(A.menuTime() * 12) > 0 ? '#ef4444' : '#3b82f6', '#fff');
    c.restore();
    // flèche du joueur (au centre)
    c.save(); c.translate(W / 2, H / 2); c.rotate(Math.PI - me.h); c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fillStyle = '#ffd60a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); c.restore();
    // cible hors carte : flèche au bord
    const tgt = targetPoint();
    if (tgt) {
      const dx = (mapBg.mx(tgt[0]) - px) * k, dz = (mapBg.mz(tgt[1]) - pz) * k;
      if (Math.abs(dx) > W / 2 - 10 || Math.abs(dz) > H / 2 - 10) { const a = Math.atan2(dz, dx), r = W / 2 - 14; c.save(); c.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); c.rotate(a); c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, 7); c.lineTo(-6, -7); c.closePath(); c.fillStyle = job.dest ? '#ffd60a' : '#22c55e'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke(); c.restore(); }
    }
  }
  function targetPoint() {
    if (foot.on || taxi !== homeTaxi) return [homeTaxi.x, homeTaxi.z]; // retourne à ton taxi
    if (job.dest) return [job.dest.zx, job.dest.zz];
    if (job.st === 'board' && job.client) return [job.client.stop.zx, job.client.stop.zz];
    let best = null, bd = 1e9; for (const s of STOPS) if (s.client) { const d = Math.hypot(s.zx - me.x, s.zz - me.z); if (d < bd) { bd = d; best = [s.zx, s.zz]; } }
    return best;
  }
  const fmtClock = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function updateHud() {
    $('txCash').textContent = fmtInt(money) + ' MRU';
    $('txSub').textContent = stats.courses + (stats.courses > 1 ? ' courses' : ' course') + (stats.fines ? ' · amendes ' + fmtInt(stats.fines) : '');
    const ck = $('txClock'); ck.textContent = fmtClock(T.timeLeft); ck.classList.toggle('warn', T.timeLeft < 30);
    const tgt = targetPoint(), dist = tgt ? Math.round(manhattan(me.x, me.z, tgt[0], tgt[1]) / 10) * 10 : 0;
    if (foot.on || taxi !== homeTaxi) { $('txJobT').textContent = foot.on ? 'À pied' : 'Voiture empruntée'; $('txJobV').textContent = '🚕 Ton taxi'; $('txJobS').textContent = (foot.on && Math.hypot(homeTaxi.x - me.x, homeTaxi.z - me.z) < 6 ? 'F / Select : monter' : dist + ' m · F / Select pour descendre ou monter'); }
    else if (job.st === 'free') { $('txJobT').textContent = 'Cherche un client'; $('txJobV').textContent = '🟢 Arrêt le plus proche'; $('txJobS').textContent = tgt ? dist + ' m · arrête-toi dans le cercle vert' : ''; }
    else if (job.st === 'board') { $('txJobT').textContent = job.client.name; $('txJobV').textContent = 'Le client monte…'; $('txJobS').textContent = 'reste arrêté'; }
    else if (job.st === 'ride') { $('txJobT').textContent = job.client.name + ' · ' + fmtInt(job.fare) + ' MRU'; $('txJobV').textContent = '🟡 ' + job.dest.name; $('txJobS').innerHTML = dist + ' m · <b class="' + (job.t < 10 ? 'late' : '') + '">⏱ ' + fmtClock(job.t) + '</b> · <span class="stars">' + stars(job.stars) + '</span>'; }
    const wv = $('txWanted'); wv.classList.toggle('hidden', !wanted && !chasers.length); $('txStars').textContent = '★'.repeat(Math.max(1, wanted)) + (chasers.length ? ' POURSUITE' : '');
    wv.classList.toggle('chase', chasers.length > 0);
    $('speed').textContent = Math.round(me.speed * 3.6); $('gear').textContent = foot.on ? '🚶' : taxi.vF < -0.5 ? 'R' : taxi.gear;
    const hpv = foot.on ? foot.hp : 100 * (taxi.hp || 0) / (taxi.hpMax || 100), hpe = $('txHp'); if (hpe) { hpe.classList.toggle('hidden', !foot.on && !chasers.length && hpv >= 99.5); $('txHpL').textContent = foot.on ? '🧍' : '🚗'; const bar = $('txHpBar'); bar.style.width = clamp(hpv, 0, 100).toFixed(0) + '%'; bar.style.background = hpv > 55 ? '#4ade80' : hpv > 25 ? '#facc15' : '#ef4444'; }
    const rb = $('rpmBar'); if (rb) rb.style.width = (clamp(taxi.rpm, 0, 1) * 100).toFixed(0) + '%';
    const nb = $('nitroBtn'); if (nb) { nb.style.setProperty('--n', clamp(taxi.nitro, 0, 1).toFixed(3)); nb.classList.toggle('on', taxi.nitroOn); nb.classList.toggle('ready', taxi.nitro > 0.5 && !taxi.nitroOn); nb.classList.toggle('empty', taxi.nitro < 0.05); }
    const tn = $('tNitro'); if (tn) tn.style.setProperty('--n', clamp(taxi.nitro, 0, 1).toFixed(3));
    const pn = placeName(me.x, me.z), st = $('txStreet'); const label = pn.street ? pn.street + ' · ' + pn.district : pn.district + (pn.moug && pn.moug !== pn.district ? ' · ' + pn.moug : ''); if (st.textContent !== label) st.textContent = label;
    $('mapName').textContent = pn.district;
    if (A.quartierAt && (T.qT = (T.qT || 0) + 1) % 15 === 0) A.quartierAt(pn.district, pn.ar, pn.moug, pn.mar);
    drawMap();
  }

  /* ======================= Marqueurs 3D : arrêts, destination, flèche ======================= */
  let ringG = null, ringMats = null, beamG = null, arrow = null, markers = [];
  function buildMarkers() {
    const rt = A.canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(0.75, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const bt = A.canvasTex(32, 128, (c, w, h) => { const g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); const g2 = c.createLinearGradient(0, 0, w, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = g2; c.fillRect(0, 0, w, h); });
    ringG = new THREE.PlaneGeometry(1, 1); ringG.rotateX(-Math.PI / 2);
    beamG = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true); beamG.translate(0, 0.5, 0);
    const mk = col => ({ ring: new THREE.MeshBasicMaterial({ map: rt, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }), beam: new THREE.MeshBasicMaterial({ map: bt, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }) });
    ringMats = { green: mk(0x22ff66), yellow: mk(0xffd000) };
    for (let k = 0; k < 8; k++) { const r = new THREE.Mesh(ringG, ringMats.green.ring), b = new THREE.Mesh(beamG, ringMats.green.beam.clone()); r.visible = b.visible = false; root.add(r, b); markers.push({ r, b }); }
    // flèche GPS au-dessus du taxi
    const sh = new THREE.Shape(); sh.moveTo(0, 1.1); sh.lineTo(0.75, 0); sh.lineTo(0.28, 0); sh.lineTo(0.28, -0.9); sh.lineTo(-0.28, -0.9); sh.lineTo(-0.28, 0); sh.lineTo(-0.75, 0); sh.closePath();
    const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false }); ag.translate(0, 0, -0.11); ag.rotateX(Math.PI / 2); // pointe vers +z
    const ol = ag.clone(); ol.scale(1.22, 1.22, 1.22);
    arrow = new THREE.Group(); arrow.scale.setScalar(0.78); const tilt = new THREE.Group(); tilt.rotation.x = -0.55; arrow.add(tilt); // relevée vers la caméra
    arrow.mat = new THREE.MeshBasicMaterial({ color: 0x22ff66, toneMapped: false, depthTest: false, transparent: true, opacity: 0.95 });
    const a1 = new THREE.Mesh(ag, arrow.mat), a0 = new THREE.Mesh(ol, new THREE.MeshBasicMaterial({ color: 0x0a0a0a, depthTest: false, transparent: true, opacity: 0.55 }));
    a0.renderOrder = 10; a1.renderOrder = 11; a0.position.y = -0.02; tilt.add(a0, a1); root.add(arrow);
  }
  let gpsDt = 0;
  function nextAim(x, z, tx, tz) { // GPS : itinéraire en L par les rues (on tourne dans la rue de la cible)
    if (REAL) return rGpsAim(x, z, me.h, tx, tz, gpsDt);
    const fi = clamp(Math.round((x - X0) / P), 0, NI - 1), fj = clamp(Math.round((z - Z0) / P), 0, NJ - 1);
    const ti = clamp(Math.round((tx - X0) / P), 0, NI - 1), tj = clamp(Math.round((tz - Z0) / P), 0, NJ - 1);
    const onEW = Math.abs(z - nz(fj)) < HW + 3, onNS = Math.abs(x - nx(fi)) < HW + 3;
    const tEW = Math.abs(tz - nz(tj)) < HW + 4, tNS = Math.abs(tx - nx(ti)) < HW + 4; // la cible est sur une rue E-O / N-S
    if (onEW && tEW && tj === fj) return [tx, tz];
    if (onNS && tNS && ti === fi) return [tx, tz];
    if (onEW && !onNS) { const ci = tNS ? ti : clamp(Math.round((tx - X0) / P + (tx > x ? -0.5 : 0.5) * 0), 0, NI - 1); return [nx(ci === fi && Math.abs(x - nx(ci)) < 4 ? ci : ci), nz(fj)]; }
    if (onNS && !onEW) { const cj = tEW ? tj : clamp(Math.round((tz - Z0) / P), 0, NJ - 1); return [nx(fi), nz(cj)]; }
    // au carrefour : partir vers l'axe qui rapproche le plus
    if (onEW && onNS) { if (tEW && tj === fj) return [tx, tz]; if (tNS && ti === fi) return [tx, tz]; return Math.abs(tx - x) > Math.abs(tz - z) ? [nx(clamp(fi + Math.sign(tx - x), 0, NI - 1)), nz(fj)] : [nx(fi), nz(clamp(fj + Math.sign(tz - z), 0, NJ - 1))]; }
    return [tx, tz];
  }
  function updateMarkers(dt) {
    const t = A.menuTime(); let k = 0; gpsDt = dt;
    const show = (x, z, col, big) => { if (k >= markers.length) return; const m = markers[k++], s = (big ? 11 : 9) + Math.sin(t * 4) * 0.6; m.r.visible = m.b.visible = true; m.r.material = ringMats[col].ring; m.b.material.color.copy(ringMats[col].beam.color); m.b.material.opacity = clamp((Math.hypot(x - A.camera.position.x, z - A.camera.position.z) - 6) / 40, 0.08, 1); m.r.position.set(x, 0.12, z); m.r.scale.set(s, 1, s); m.b.position.set(x, 0, z); m.b.scale.set(big ? 2.6 : 2.0, big ? 60 : 38, big ? 2.6 : 2.0); };
    if (job.st === 'free' || job.st === 'board') for (const s of STOPS) if (s.client || (job.st === 'board' && job.client && job.client.stop === s)) show(s.zx, s.zz, 'green');
    if (job.dest) show(job.dest.zx, job.dest.zz, 'yellow', true);
    for (; k < markers.length; k++) markers[k].r.visible = markers[k].b.visible = false;
    const tgt = targetPoint();
    arrow.visible = !!tgt && A.state === 'play';
    if (tgt) {
      arrow.position.set(me.x, (foot.on ? 1.2 : taxiModel ? taxiModel.box.max.y : 1.5) + 1.9 + Math.sin(t * 3) * 0.12, me.z); arrow.scale.setScalar(foot.on ? 0.45 : 0.78);
      // trajet par les rues : viser le carrefour suivant si la cible n'est pas sur la même rue
      const [ax, az] = nextAim(me.x, me.z, tgt[0], tgt[1]);
      const want = Math.atan2(ax - me.x, az - me.z); arrow.rotation.y = lerp(arrow.rotation.y, arrow.rotation.y + wrapAng(want - arrow.rotation.y), Math.min(1, dt * 6));
      arrow.mat.color.setHex(job.dest ? 0xffd000 : 0x22ff66);
    }
  }

  /* ======================= Construction complète ======================= */
  function build() {
    lib = A.ASSETS.taxi; walkLib = A.ASSETS.walk || null;
    if (!lib) throw new Error('taxi.glb manquant');
    if (walkLib) walkLib.updateMatrixWorld(true);
    lib.updateMatrixWorld(true);
    const rnd = seeded(20261118), n0 = root.children.length;
    buildRoads(); buildBlocks(); buildBuildings(rnd);
    A.instanceLib(inst, { parent: root, cull: CULL, cell: 400, maxD: (det, small) => det ? (LITE ? 340 : 560) : small ? 300 : (LITE ? 620 : 980) });
    buildSignsAndNames(); buildProps(); buildLights();
    gridStatic = root.children.slice(n0); // la ville en damier (cachée sur la carte réelle)
    buildVehicleTypes();
    const counts = {}; for (const k in VT) counts[k] = k === 'police' ? 3 : k === 'cart' ? 5 : Math.max(4, Math.ceil(VT[k].w * 6));
    buildVehicleMeshes(counts);
    buildPedMeshes(); buildPoliceModels(); buildAmbulanceModel(); buildShotFx(); buildMarkers(); buildMapBg(); buildHud();
    root.traverse(o => { if (o.isMesh && o.material && o.material.map) texFix(o.material); });
    T.ready = true;
  }
  function cullUpdate() { const p = A.camera.position; for (const d of (REAL ? RCULL : CULL)) d.m.visible = p.distanceTo(d.c) - d.r < d.d; }

  /* ======================= Ville réelle pour les courses (Course, Drift, Chrono, 2 joueurs, en ligne) ======================= */
  // game.js trace le circuit sur les vraies avenues ; ici on pose autour la vraie ville (bâtiments, murs, rues, monuments),
  // sans ce qui tombe dans l'emprise du circuit (mask), avec les mêmes morceaux de 256 m chargés au fil de la course
  const RACE = T.race = { on: false, ready: false, want: false, hide: [], mask: null };
  RACE.prepare = (opt, cb) => {
    RACE.mask = opt.mask; RACE.hide = opt.hide || []; RACE.want = true;
    const fail = () => { if (cb) cb(false); };
    const go = () => rLoadData(ok => {
      if (!ok) return fail();
      setTimeout(() => {
        try {
          const t0 = performance.now();
          if (!lib) { lib = A.ASSETS.taxi; lib.updateMatrixWorld(true); }
          if (!rBase) rBuildBase();
          if (!rStaticR) { RM = RACE.mask; rStaticR = rBuildStatic(true); RM = null; }
          console.log('race city ms ' + Math.round(performance.now() - t0));
        } catch (e) { console.error('race city', e && e.stack || e); RM = null; return fail(); }
        RACE.ready = true; if (!T.active) RACE.attach(); if (cb) cb(true);
      }, 20);
    });
    if (A.ASSETS.taxi) go(); else A.loadAsset('taxi', g => { if (!g) return fail(); go(); }, opt.prog);
  };
  RACE.attach = () => {
    if (!RACE.ready || RACE.on) return;
    RACE.on = true; RM = RACE.mask;
    for (const ch of rCh.values()) if (ch.built) rFreeChunk(ch);
    A.scene.add(realG); realG.visible = true; realG.position.y = -0.15; // sous le ruban du circuit
    if (rStaticT) rStaticT.visible = false; rStaticR.visible = true;
    for (const o of RACE.hide) o.visible = false;
  };
  RACE.detach = () => {
    if (!RACE.on) return;
    RACE.on = false; RM = null;
    for (const ch of rCh.values()) if (ch.built) rFreeChunk(ch);
    root.add(realG); realG.position.y = 0;
    if (rStaticT) rStaticT.visible = true; if (rStaticR) rStaticR.visible = false;
    for (const o of RACE.hide) o.visible = true;
  };
  RACE.tick = (p1, p2, budget) => { // morceaux de ville autour des caméras + distance d'affichage du décor
    if (!RACE.on) return 0;
    const made = rStream(p1.x, p1.z, budget === undefined ? 1 : budget, p2 ? p2.x : undefined, p2 ? p2.z : undefined);
    for (const d of RCULL_R) { let dd = p1.distanceTo(d.c); if (p2) dd = Math.min(dd, p2.distanceTo(d.c)); d.m.visible = dd - d.r < d.d; }
    if (rRaceGlow) rRaceGlow.visible = !!prof.night;
    return made;
  };
  RACE.preload = (pts, r) => { if (!RACE.on) return; for (const ch of rCh.values()) if (pts.some(([x, z]) => Math.hypot(ch.cx - x, ch.cz - z) < (r || 300))) { ch.keep = true; if (!ch.built) { try { rBuildChunk(ch); } catch (e) { ch.built = true; } } } };
  RACE.release = () => { for (const ch of rCh.values()) ch.keep = false; };
  RACE.placeName = (x, z) => RD ? rPlaceName(x, z) : null;
  RACE.landmarks = () => rStaticR ? rStaticR.userData.lms : []; // monuments posés autour du circuit
  RACE.drawMap = (c, minX, minZ, k, W, H) => { // fond de la mini-carte des courses : vrais bâtiments et vraies rues
    if (!RD) return;
    const x1 = minX + W / k, z1 = minZ + H / k, Bd = RD.bld;
    c.fillStyle = '#a99376';
    for (const ch of rCh.values()) {
      if (ch.cx < minX - 140 || ch.cx > x1 + 140 || ch.cz < minZ - 140 || ch.cz > z1 + 140) continue;
      for (const i of ch.bld) { const o = Bd.off[i]; c.beginPath(); for (let q = 0; q < Bd.n[i]; q++) { const px = (Bd.p[2 * (o + q)] - minX) * k, pz = (Bd.p[2 * (o + q) + 1] - minZ) * k; if (q) c.lineTo(px, pz); else c.moveTo(px, pz); } c.fill(); }
    }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const list = RD.E.filter(e => { const p = e.pts; return !(p[0] < minX - 300 || p[0] > x1 + 300 || p[1] < minZ - 300 || p[1] > z1 + 300); }).sort((a, b) => b.cl - a.cl);
    for (const e of list) { c.strokeStyle = e.pv === 1 ? (e.cl <= 2 ? '#4a4e54' : '#5b6066') : '#c2a46f'; c.lineWidth = Math.max(1.5, e.w * k); c.beginPath(); for (let q = 0; q < e.pts.length / 2; q++) { const px = (e.pts[2 * q] - minX) * k, pz = (e.pts[2 * q + 1] - minZ) * k; if (q) c.lineTo(px, pz); else c.moveTo(px, pz); } c.stroke(); }
  };

  /* ======================= Cycle de jeu ======================= */
  let driftWas = null, fogWas = null;
  T.start = () => {
    if (T.loading) return;
    if (!T.ready) {
      T.loading = true; A.state = 'loading';
      $('loading').classList.remove('hidden'); $('loadTxt').textContent = 'LA VILLE DES TAXIS SE RÉVEILLE…'; $('loadBar').firstElementChild.style.width = '0%';
      A.showScreen(null);
      const prog = { taxi: 0, walk: 0 }, bar = () => { $('loadBar').firstElementChild.style.width = ((prog.taxi * 0.45 + prog.walk * 0.55) * 100).toFixed(0) + '%'; };
      A.loadAsset('walk', () => {}, f => { prog.walk = f; bar(); });
      A.loadAsset('taxi', g => A.loadAsset('walk', () => {
        T.loading = false;
        if (!g) { $('loading').classList.add('hidden'); A.state = 'menu'; A.showScreen('menu'); A.popup('Impossible de charger la ville des taxis', 'vérifie ta connexion', true); return; }
        try { build(); } catch (e) { console.error('taxi build', e && e.stack || e); $('loading').classList.add('hidden'); A.state = 'menu'; A.showScreen('menu'); return; }
        startWorld();
      }), f => { prog.taxi = f; bar(); });
      return;
    }
    startWorld();
  };
  function startWorld() { // carte réelle : données chargées et ville construite à la première partie
    const fail = () => { $('loading').classList.add('hidden'); A.state = 'menu'; A.showScreen('menu'); A.popup('Impossible de charger la carte de Nouakchott', 'vérifie ta connexion, ou choisis la ville classique', true); };
    if (T.map !== 1 || rReady) { $('loading').classList.add('hidden'); begin(); return; }
    T.loading = true; A.state = 'loading'; $('loading').classList.remove('hidden'); $('loadTxt').textContent = 'NOUAKCHOTT SE DESSINE : RUES ET BÂTIMENTS…'; $('loadBar').firstElementChild.style.width = '92%'; A.showScreen(null);
    rLoadData(ok => {
      if (!ok) { T.loading = false; fail(); return; }
      setTimeout(() => { // laisser l'écran de chargement s'afficher
        try { const t0 = performance.now(); rBuild(); console.log('real build ms ' + Math.round(performance.now() - t0)); } catch (e) { console.error('real build', e && e.stack || e); T.loading = false; fail(); return; }
        T.loading = false; $('loading').classList.add('hidden'); begin();
      }, 30);
    });
  }
  function begin() {
    if (RACE.on) RACE.detach();
    if (A.quartierReset) A.quartierReset(); // la ville réelle redevient celle du taxi (bâtiments du circuit remis, feux, arrêts)
    if (!T.active) { driftWas = A.hideDrift(); A.scene.add(root); root.visible = true; T.active = true; fogWas = [A.scene.fog.near, A.scene.fog.far]; }
    A.scene.fog.near = LITE ? 70 : 110; A.scene.fog.far = LITE ? 560 : 900;
    document.body.classList.add('taxi');
    A.clearSkids(); A.clearSmoke();
    setWorld(T.map === 1);
    makeTaxi(); const sp = REAL ? rSpawnSpot() : spawnSpot(); placeTaxi(sp.x, sp.z, sp.h); me = taxi;
    lightT = 0; if (REAL) rPopulateTraffic(); else populateTraffic(); populatePeds();
    if (REAL) { rLastSig = null; for (const ch of rCh.values()) ch.keep = false; rStream(taxi.x, taxi.z, 9999); if (A.introPlay && !(TEST && !/[?&]intro/.test(location.search)) && !T.introSeen) rPreload(); }
    for (const s of STOPS) { s.client = null; s.cool = 0; }
    Object.assign(job, { st: 'free', client: null, dest: null, t: 0, timer: 0, fare: 0, stars: 5, late: false });
    for (const k in stats) stats[k] = 0; money = 0; wanted = 0; caughtT = 0;
    for (const pc of chasers.slice()) endChase(pc);
    T.timeLeft = SHIFT_S[T.shift]; T.hornCd = 0; T.endAt = null; T.overtime = false;
    spawnClients(true);
    A.camState.init = false;
    A.showScreen(null);
    amb.st = 'off'; amb.car = null; amb.queue = []; if (amb.mdl) amb.mdl.g.visible = false; sirenAmb(false);
    A.crashFx.clear && A.crashFx.clear();
    for (const id of ['countdown', 'lights', 'wrong']) { const e = $(id); if (e) e.classList.add('hidden'); }
    $('popups').innerHTML = ''; $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
    const dr = DRIVERS[T.driver];
    const go = () => {
      A.state = 'play'; A.camState.init = false; if (REAL) for (const ch of rCh.values()) ch.keep = false;
      $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !isTouch);
      A.popup('SERVICE COMMENCÉ', dr.name + ' · ' + fmtClock(T.timeLeft) + ' pour gagner un max d’ouguiyas', false, 'gold');
      say(dr.id === 'ba' ? 'Bismillah… Allez, au travail. Les clients attendent aux arrêts verts.' : dr.id === 'moulaye' ? 'Moulaye est dans la place ! Direction les arrêts verts.' : 'C’est parti ! Les clients attendent aux arrêts verts.');
      updateHud();
    };
    rebuildDyn(); cullUpdate();
    if (A.introPlay && !(TEST && !/[?&]intro/.test(location.search))) { A.state = 'intro'; A.introPlay(REAL ? rIntroShots(!T.introSeen) : taxiIntroShots(!T.introSeen), go); T.introSeen = true; }
    else go();
    if (A.applyAmbience) { /* l'ambiance jour/nuit globale reste celle du menu */ }
  }
  function taxiIntroShots(full) { // générique : la ville vue du ciel, quelques lieux connus, puis le taxi
    const V = (x, y, z) => new THREE.Vector3(x, y, z), shots = [], dr = DRIVERS[T.driver], h = taxi.h, fx = Math.sin(h), fz = Math.cos(h);
    if (full) {
      shots.push({ dur: 5, p0: V(X0 - 190, 60, 140), p1: V(X0 - 60, 115, 20), t0: V(-40, 0, 0), t1: V(60, 0, -20), fov: 52, title: 'TAXI NOUAKCHOTT', sub: 'Une journée de taximan', credit: '' });
      const credits = ['Taximen : Moulaye · Taximan Ba · Sidi · Mamadou', 'Feux rouges, piétons, animaux, police : prudence !', 'Clients aux arrêts verts · destinations en jaune'];
      ['snim', 'marche', 'mosquee'].forEach((id, k) => {
        const q = PLACES.find(pl => pl.id === id); if (!q) return;
        // la caméra glisse le long de la rue devant la façade (jamais à l'intérieur d'un immeuble)
        const [bx, bz] = blockC(q.b[0], q.b[1]), [ffx, ffz] = DIRS[q.face], px = -ffz, pz = ffx, sd = k % 2 ? 1 : -1;
        const rx = bx + ffx * (P / 2 + HW * 0.55), rz = bz + ffz * (P / 2 + HW * 0.55), tx = bx + ffx * BLK * 0.22, tz = bz + ffz * BLK * 0.22;
        shots.push({ dur: 3.6, p0: V(rx + px * 46 * sd, 17, rz + pz * 46 * sd), p1: V(rx + px * 16 * sd, 6.5, rz + pz * 16 * sd), t0: V(tx - px * 8 * sd, 12, tz - pz * 8 * sd), t1: V(tx, 8, tz), fov: 58, cap: q.name, capSub: q.ar, title: k === 0 ? '' : undefined, credit: credits[k] });
      });
    }
    shots.push({ dur: full ? 4 : 3, p0: V(taxi.x - fx * 34 + fz * 12, 24, taxi.z - fz * 34 - fx * 12), p1: V(taxi.x - fx * 8.2, 2.9, taxi.z - fz * 8.2), t0: V(taxi.x, 0, taxi.z), t1: V(taxi.x + fx * 2, 1.2, taxi.z + fz * 2), fov: 60, title: dr.name.toUpperCase(), sub: 'prend son service · ' + fmtClock(T.timeLeft), credit: '', cap: '' });
    return shots;
  }
  T.exit = () => {
    if (!T.active) return;
    T.active = false; root.visible = false; A.scene.remove(root);
    if (driftWas) A.showDrift(driftWas); driftWas = null;
    if (RACE.want && RACE.ready) RACE.attach();
    if (fogWas) { A.scene.fog.near = fogWas[0]; A.scene.fog.far = fogWas[1]; }
    document.body.classList.remove('taxi'); sirenOn(false); sirenAmb(false); amb.st = 'off'; amb.car = null;
    for (const pc of chasers.slice()) endChase(pc);
  };
  T.pause = () => { sirenOn(false); sirenAmb(false); A.updateAudio(null, { thr: 0 }, 0, false); };
  T.reset = () => { if (!taxi || A.state !== 'play') return; if (foot.on) { if (foot.down <= 0) A.popup('À PIED', 'F / Select : monter dans une voiture', false, 'blue'); return; } resetTaxi(); A.popup(taxi === homeTaxi ? 'TAXI REPLACÉ' : 'VOITURE REPLACÉE', '', false, 'blue'); };
  function endShift() {
    A.state = 'results'; sirenOn(false); A.updateAudio(null, { thr: 0 }, 0, false);
    $('touch').classList.add('hidden'); $('hud').classList.add('hidden');
    const dr = DRIVERS[T.driver], net = Math.max(0, money), best = store.get('best_taxi', 0), isNew = net > best && net > 0;
    if (isNew) store.set('best_taxi', net);
    const earned = A.addCredits(net * 0.8);
    const avg = stats.courses ? stats.starSum / stats.courses : 0;
    $('resTitle').textContent = 'Service terminé · ' + dr.name + ' · ' + fmtClock(SHIFT_S[T.shift]);
    $('resBig').textContent = fmtInt(money) + ' MRU';
    $('resBody').innerHTML = '<div class="res"><div><span class="lbl">Courses</span><b>' + stats.courses + '</b></div><div><span class="lbl">Recettes + pourboires</span><b>' + fmtInt(stats.fares + stats.tips) + '</b></div><div><span class="lbl">Amendes</span><b>' + (stats.fines ? '-' + fmtInt(stats.fines) : '0') + '</b></div><div><span class="lbl">Note moyenne</span><b>' + (stats.courses ? stars(avg) : '--') + '</b></div></div>' +
      '<div class="note" style="margin-top:10px;opacity:.85">🚦 Feux grillés : ' + stats.reds + ' · 🚶 Piétons heurtés : ' + stats.peds + ' · 🚓 Arrestations : ' + stats.arrests + (stats.thefts ? ' · 🔑 Voitures empruntées : ' + stats.thefts : '') + '<br>Meilleur service : ' + fmtInt(Math.max(best, net)) + ' MRU</div>';
    $('resNew').classList.toggle('hidden', !isNew);
    $('resEarn').textContent = earned ? '+' + fmtInt(earned) + ' crédits' : '';
    $('btnAgain').textContent = 'Nouveau service';
    A.showScreen('results');
  }
  let orbit = 0;
  T.frame = dt => {
    if (!taxi) return;
    const st = A.state;
    if (st === 'play') {
      lightT += dt; T.timeLeft -= dt; if (T.hornCd > 0) T.hornCd -= dt;
      let inp = A.readInput(0);
      rebuildDyn();
      if (foot.on) { // à pied
        footStep(inp, dt); lastHit.v = 0;
        updateCars(dt); updatePeds(dt); updatePolice(dt); updateAmbulance(dt);
      } else {
        if (inp.nitro && taxi.nitro < 0.02) inp.nitro = 0;
        if (taxi.dead) inp = Object.assign({}, inp, { thr: 0, nitro: 0 }); // moteur touché par balle
        const SUB = Math.max(2, Math.ceil(dt / 0.011)); let hit = 0;
        lastHit.v = 0;
        for (let s = 0; s < SUB; s++) hit = Math.max(hit, taxiStep(inp, dt / SUB));
        crashEffects();
        taxi.nitro = Math.min(1, taxi.nitro + dt * 0.01);
        if (hit > 6.5) { stats.crashes++; A.crashSound(hit / 20); loseStar(1, pick(['Doucement ! Tu veux nous tuer ?', 'Aïe ! Fais attention !', 'Wallahi, conduis mieux que ça !'])); if (hit > 9) offence('crash', 150, 1, 60); }
        else if (hit > 3) A.crashSound(hit / 30);
        updateCars(dt); updatePeds(dt); hitPeds(); updatePolice(dt); updateAmbulance(dt);
        if (!foot.on) { checkRedLight(); if (taxi === homeTaxi) jobLogic(dt); }
      }
      updateShotFx(dt);
      if (R() < dt * 0.5) spawnClients();
      if (REAL && (T.rt = (T.rt || 0) + dt) > 0.5) { T.rt = 0; rTrafficTick(false); rPedTick(); rStream(me.x, me.z, 3); }
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) { const el = $('txSay'); if (el) el.classList.remove('show'); } }
      if (foot.on) { updateFootCam(dt); A.updateAudio(taxi, NO_INP, 0, false); }
      else { updateTaxiVisual(inp, dt); A.updateCamera(dt, taxi); A.updateAudio(taxi, inp, taxi.screech || 0, true); }
      updateSiren();
      hudAcc += dt; if (hudAcc > 1 / 15) { hudAcc = 0; updateHud(); }
      if (T.timeLeft <= 0) { if (job.st === 'ride' && T.timeLeft > -75) { if (!T.overtime) { T.overtime = true; A.popup('FIN DU SERVICE', 'termine ta dernière course !', false, 'gold'); } } else { T.endAt = T.endAt == null ? 2.2 : T.endAt - dt; if (T.endAt <= 0) endShift(); } }
      T.lastInp = inp;
    } else if (st === 'intro') { // générique : la ville vit pendant que la caméra survole
      lightT += dt; rebuildDyn(); updateCars(dt); updatePeds(dt); if (REAL && (T.rt = (T.rt || 0) + dt) > 0.5) { T.rt = 0; rTrafficTick(false); rPedTick(); } A.introUpdate(dt); updateTaxiVisual({ thr: 0, brk: 0, steer: 0, hb: 0, nitro: 0 }, dt);
    } else if (st === 'results') {
      orbit += dt * 0.25; const r = 11; A.camera.position.set(taxi.x + Math.sin(orbit + taxi.h) * r, 3.4, taxi.z + Math.cos(orbit + taxi.h) * r); A.camera.lookAt(taxi.x, 1, taxi.z);
      updateCars(dt * 0.5); updatePeds(dt);
    }
    if (st !== 'pause') { if (Math.floor(lightT * 5) !== lastLightUpd) { lastLightUpd = Math.floor(lightT * 5); updateLights(); } }
    drawCars(); drawPeds(dt); updateMarkers(dt);
    if ((T.fc = (T.fc || 0) + 1) % 4 === 0) cullUpdate();
    A.sun.position.set(me.x + A.SUN_OFF.x, A.SUN_OFF.y, me.z + A.SUN_OFF.z); A.sun.target.position.set(me.x, 0, me.z);
    if (lampGlow) lampGlow.visible = !!prof.night && !REAL; if (rLampGlow) rLampGlow.visible = !!prof.night && REAL;
    A.fx(dt);
    if (TEST && window.__tcam) { const c = window.__tcam; A.camera.position.set(c.p[0], c.p[1], c.p[2]); A.camera.lookAt(c.t[0], c.t[1], c.t[2]); if (c.fov && A.camera.fov !== c.fov) { A.camera.fov = c.fov; A.camera.updateProjectionMatrix(); } }
    A.sky.position.set(A.camera.position.x, 0, A.camera.position.z); // après la caméra de test : sinon le ciel est décentré
    if (A.camera.aspect !== window.innerWidth / window.innerHeight) { A.camera.aspect = window.innerWidth / window.innerHeight; A.camera.updateProjectionMatrix(); }
  };
  const onSidewalk = (x, z) => { const bi = Math.floor((x - X0) / P), bj = Math.floor((z - Z0) / P); if (!inBlocks(bi, bj)) return false; const [bx, bz] = blockC(bi, bj); return Math.abs(x - bx) < BLK / 2 && Math.abs(z - bz) < BLK / 2; };
  function hitPeds() { // le taxi renverse un piéton / un animal
    if (taxi.speed < 1.5) return;
    const fx = Math.sin(taxi.h), fz = Math.cos(taxi.h);
    for (const p of peds) {
      if (!p.on || p.down || p.fall > 0 || p.st === 'ride' || p.st === 'off' || p.st === 'board') continue;
      if (Math.abs(p.x - taxi.x) > 4 || Math.abs(p.z - taxi.z) > 4) continue;
      const rx = p.x - taxi.x, rz = p.z - taxi.z, f = rx * fx + rz * fz, l = Math.abs(rx * fz - rz * fx);
      if (Math.abs(f) < 2.5 && l < 1.25) {
        const push = Math.min(4, 0.6 + taxi.speed * 0.18);
        p.down = true; p.downT = 0; p.fall = 0; p.leader = null; p.x += fx * push; p.z += fz * push; p.h = taxi.h + (R() - 0.5) * 1.5;
        p.road = REAL ? rOnRoad(p.x, p.z) : !onSidewalk(p.x, p.z); if (p.st === 'cross' || p.st === 'flee' || p.st === 'cwait') p.st = 'walk';
        A.crashSound(0.4); taxi.vx *= 0.78; taxi.vz *= 0.78; A.shake(0.5);
        if (taxiModel && taxi.speed > 5) A.dentModel(taxiModel, taxi.x + fx * 2.2, 0.8, taxi.z + fz * 2.2, -fx, -fz, 4 + taxi.speed * 0.3);
        if (p.kind === 'animal') { A.popup('ATTENTION AUX ANIMAUX !', 'la bête est blessée', true); loseStar(0.5); }
        else {
          stats.peds++; loseStar(2, 'Tu as renversé quelqu’un ! Mon Dieu…');
          if (p.st === 'wait' && p.stop) { p.stop.client = null; p.client = false; }
          offence('ped', 400, 2, 160, true); // délit de fuite : la police est appelée, quoi qu'il arrive
          dispatchAmbulance(p);
        }
      }
    }
  }

  /* ======================= Menu : choix du taximan ======================= */
  function buildMenu() {
    if ($('taxiOpts')) return;
    const box = document.createElement('div'); box.id = 'taxiOpts'; box.className = 'hidden'; box.style.marginTop = '14px';
    box.innerHTML = '<div class="lbl" style="margin-bottom:6px">Ton taximan</div><div class="carGrid" id="txDrivers"></div>' +
      '<div class="row" style="gap:18px;margin-top:10px;flex-wrap:wrap"><div><div class="lbl" style="margin-bottom:6px">Durée du service</div><div class="seg" id="segShift"><button data-v="0">4 min</button><button data-v="1">6 min</button><button data-v="2">8 min</button></div></div>' +
      '<div><div class="lbl" style="margin-bottom:6px">Circulation</div><div class="seg" id="segTraffic"><button data-v="0">Calme</button><button data-v="1">Normale</button><button data-v="2">Dense</button></div></div>' +
      '<div><div class="lbl" style="margin-bottom:6px">Carte</div><div class="seg" id="segMap"><button data-v="1">Nouakchott réelle</button><button data-v="0">Ville classique</button></div></div></div>' +
      '<div class="note" style="margin-top:8px">Arrête-toi dans un cercle <b style="color:#4ade80">vert</b> pour prendre un client, dépose-le au cercle <b style="color:#facc15">jaune</b>. Feux rouges, piétons et police : attention aux amendes !</div>';
    const after = $('duoOpts') || $('raceOpts');
    after.parentNode.insertBefore(box, after.nextSibling);
    $('segShift').onclick = e => { const b = e.target.closest('button'); if (!b) return; T.shift = +b.dataset.v; store.set('taxiShift', T.shift); renderOpts(true); };
    $('segTraffic').onclick = e => { const b = e.target.closest('button'); if (!b) return; T.traffic = +b.dataset.v; store.set('taxiTraffic', T.traffic); renderOpts(true); };
    $('segMap').onclick = e => { const b = e.target.closest('button'); if (!b) return; T.map = +b.dataset.v; store.set('taxiMap', T.map); renderOpts(true); };
  }
  function renderOpts(show) {
    buildMenu();
    $('taxiOpts').classList.toggle('hidden', !show);
    if (!show) return;
    const l = $('txDrivers'); l.innerHTML = '';
    DRIVERS.forEach((d, k) => {
      const e = document.createElement('div'); e.className = 'carCard' + (k === T.driver ? ' sel' : ''); e.style.setProperty('--p', '1');
      e.innerHTML = '<img src="icons/taxi/' + d.id + '.jpg" alt="" onerror="this.style.visibility=\'hidden\'"><b>' + esc(d.name) + '</b><span>' + esc(d.perk) + '</span>';
      e.onclick = () => { T.driver = k; store.set('taxiDriver', k); A.blip(880, 0.06, 0.06); renderOpts(true); };
      l.appendChild(e);
    });
    for (const [id, v] of [['segShift', T.shift], ['segTraffic', T.traffic], ['segMap', T.map]]) $(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === v));
  }
  T.renderOpts = renderOpts;
  T.DRIVERS = DRIVERS;
  if (TEST) T.dbg = { VEND, rInBld, rCh, rBuildChunk, rFreeChunk, rLanePts, rAt, rTrim, get RM() { return RM; }, get REAL() { return REAL; }, get RD() { return RD; }, rNearest, rPlaceName, rRoutePts, RSTOPS, RPLACES, RCULL, realG, gps, get grid() { return grid; }, get mapBg() { return mapBg; }, placeName, get SFX() { return SFX; }, foot, parked, get homeTaxi() { return homeTaxi; }, get me() { return me; }, get chaseT() { return chaseT; }, set wanted(v) { wanted = v; }, amb, spawnCop, offence, nearestPolice, get WM() { return WM; }, dispatchAmbulance, get taxiModel() { return taxiModel; }, VAT_OK, get taxi() { return taxi; }, get cars() { return cars; }, get peds() { return peds; }, job, stats, STOPS, PLACES, get money() { return money; }, light, get chasers() { return chasers; }, get wanted() { return wanted; }, CULL, root, placeTaxi, spawnClients, startChase, VT, get lightT() { return lightT; }, set lightT(v) { lightT = v; }, nx, nz, HW, LANE, HEAD, EL, P };
  return T;
};
