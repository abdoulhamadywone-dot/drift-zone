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
  function district(bi, bj) {
    if (bj <= 2 && bi <= 3) return 'tz';
    if (bj <= 1 && bi >= 5) return 'ksar';
    if (bi >= 6 && bj <= 4) return 'smar';
    if (bj >= 5) return bi <= 2 ? 'mina' : bi <= 4 ? 'sebkha' : 'arafat';
    return 'cap';
  }
  const placeName = (x, z) => {
    const bi = clamp(Math.floor((x - X0) / P), 0, NI - 2), bj = clamp(Math.floor((z - Z0) / P), 0, NJ - 2);
    const fi = Math.round((x - X0) / P), fj = Math.round((z - Z0) / P);
    const onNS = Math.abs(x - nx(clamp(fi, 0, NI - 1))) < HW + 2, onEW = Math.abs(z - nz(clamp(fj, 0, NJ - 1))) < HW + 2;
    const street = onNS && !onEW ? AV_NS[clamp(fi, 0, NI - 1)] : onEW && !onNS ? AV_EW[clamp(fj, 0, NJ - 1)] : onNS && onEW ? (CARREF[fi + ',' + fj] || 'Carrefour') : '';
    return { street, district: DISTRICT_N[district(bi, bj)] };
  };
  const CARREF = { '5,3': 'Carrefour BMD', '6,5': 'Carrefour Madrid', '7,6': 'Carrefour Bamako', '7,2': 'Carrefour Cité Smar', '4,4': 'Carrefour Capitale', '2,2': 'Carrefour Tevragh Zeina', '8,5': 'Sortie PK10' };

  // lieux connus : monuments (îlot + façade) et carrefours ; face 0 E, 1 S, 2 O, 3 N
  const PLACES = [
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
  const CELL = 24, grid = new Map();
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
  const used = new Set(), STOPS = [], PROPS = { lamp: [], slamp: [], palm: [], tree: [], bench: [], bin: [], skip: [], rock: [], khaima: [], shelter: [] }, LAMP_HEADS = [];
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
      A.signMesh(sg, A.textTex([{ t: CARREF[k].toUpperCase(), y: 0.5, size: 120 }], { bg: '#0b6b3a', fg: '#ffffff', border: '#ffffff', w: 1024, h: 200 }), 5, 1, 0, 5, 0.12, 0.9);
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
    for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 14); w.rotateZ(Math.PI / 2); add(w, s * 0.85, 0.5, -0.9); add(new THREE.BoxGeometry(0.06, 0.06, 1.6), s * 0.45, 0.85, 0.55); }
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
        if (toStop > -0.5) {
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
      if (c.v < 0.2 && !stopByLight && c.blocker && (c.blocker.kind || c.blocker.parked) && c.piece === 'edge' && c.stuck > 2.5 && !c.cart && c.s < c.len - 18) { c.lane = 1 - c.lane; const s0 = c.s; edgePath(c); c.s = s0; chooseNext(c); c.stuck = 0; honk(c.x, c.z, 0.7); } // contourner
      if (c.v < 0.2 && !stopByLight && c.blocker) { c.stuck += dt; if ((c.blocker === taxi || c.blocker.kind) && c.honkT <= 0 && c.stuck > 1.8) { honk(c.x, c.z, 1); c.honkT = 2.5 + R() * 2; } if (c.stuck > 6 && (c.blocker !== taxi || taxi.parked)) { c.ghost = 2.5; c.stuck = 0; } } else c.stuck = 0;
      c.s += c.v * dt;
      if (c.s >= c.len) {
        const over = c.s - c.len;
        if (c.piece === 'edge') { turnPath(c); c.s = over; c.wait = 0; }
        else { c.i = c.bi; c.j = c.bj; c.d = c.nd; c.lane = c.nl; edgePath(c); chooseNext(c); c.s = over; }
      }
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
  const ANI = { wk_goat: { spd: 0.7, hl: 0.55, hw: 0.25, stride: 1.05, tint: [0xf4f1ea, 0x2b2622, 0x8a5a33, 0xd9cbb2] }, wk_donkey: { spd: 0.85, hl: 1.0, hw: 0.32, stride: 1.6 }, wk_dog: { spd: 1.1, hl: 0.45, hw: 0.2, stride: 0.95, tint: [0xd8c3a0, 0x3a2e24, 0xf0f0f0] }, wk_chicken: { spd: 0.5, hl: 0.18, hw: 0.12, stride: 0.34 }, wk_cat: { spd: 0.65, hl: 0.25, hw: 0.1, stride: 0.55 } };
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
    const capH = Math.ceil((PED_N + CLIENT_N) / HUMANS.length) + 6; // + le chauffeur à pied et les conducteurs qui s'enfuient
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
        const fx = Math.sin(L.h), fz = Math.cos(L.h), tx = L.x - fx * (0.9 * p.hk) + fz * p.side, tz = L.z - fz * (0.9 * p.hk) - fx * p.side;
        const dx = tx - p.x, dz = tz - p.z, dd = Math.hypot(dx, dz);
        if (dd > 25) { p.x = tx; p.z = tz; } else if (dd > 0.08) { const st = Math.min(dd, (L.curV + 0.6 + dd * 0.8) * dt); p.x += dx / dd * st; p.z += dz / dd * st; v = st / dt; p.h = p.h + wrapAng(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 5); }
        p.road = L.road; p.curV = v; p.ph += v * dt / p.M.stride; p.idle += ((v > 0.15 ? 0 : 1) - p.idle) * Math.min(1, dt * 6); p.st = L.st === 'cross' || L.st === 'flee' ? 'cross' : 'walk';
        continue;
      }
      if (p.st === 'walk') {
        const pausing = p.kind === 'animal' && Math.sin(p.t2 = (p.t2 || R() * 50) + dt * 0.21) > 0.55;
        const sp = p.spd * (p.run > 0 ? 2.4 : 1) * (pausing ? 0 : 1); v = sp;
        const before = Math.floor(p.p / (2 * HS));
        p.p += p.dir * sp * dt;
        const after = Math.floor(p.p / (2 * HS));
        const q = loopPos(p.bi, p.bj, p.p, p.lat); p.x = q[0]; p.z = q[1]; p.h = Math.atan2(...dirOfSide(q[2], p.dir));
        if (before !== after) { // coin atteint
          const corner = ((p.dir > 0 ? after : before) % 4 + 4) % 4;
          if (p.kind === 'ped' && R() < 0.42) startCross(p, corner, R() < 0.5);
        } else if (R() < dt * (p.kind === 'animal' ? 0.03 : 0.0045) && Math.abs(((p.p % (2 * HS)) + 2 * HS) % (2 * HS) - HS) < HS - 14) startJay(p);
      } else if (p.st === 'cwait') {
        const L = light(p.ni, p.nj, p.axis); p.wait += dt; p.h = Math.atan2(p.cx1 - p.cx0, p.cz1 - p.cz0);
        if ((L.s === 'R' && L.toG > 8) || p.wait > 40) { p.st = 'cross'; p.t = 0; p.jay = false; p.spd2 = p.spd * 1.1; }
      } else if (p.st === 'cross' || p.st === 'flee') {
        const L = Math.hypot(p.cx1 - p.cx0, p.cz1 - p.cz0) || 1;
        if (p.st === 'cross' && p.pauseAt < 1 && p.t > p.pauseAt && p.pauseT === 0) p.pauseT = 4 + R() * 9; // l'animal se plante sur la route
        if (p.pauseT > 0 && p.st === 'cross') { p.pauseT -= dt; if (p.pauseT <= 0) { p.pauseT = -1; } }
        else { v = p.st === 'flee' ? (p.kind === 'animal' ? 2.6 : 4.2) : p.spd2 * (p.run > 0 ? 2 : 1); p.t += v * dt / L; }
        const t = clamp(p.t, 0, 1); p.x = p.cx0 + (p.cx1 - p.cx0) * t; p.z = p.cz0 + (p.cz1 - p.cz0) * t; p.h = Math.atan2(p.cx1 - p.cx0, p.cz1 - p.cz0);
        p.road = t > 0.12 && t < 0.88;
        if (p.t >= 1) { p.st = 'walk'; p.road = false; p.bi = p.nbi; p.bj = p.nbj; p.p = p.np; p.lat = p.kind === 'animal' ? 1 + R() * 0.6 : (R() - 0.5) * 2.2; p.dir = R() < 0.5 ? 1 : -1; }
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
    if (D) for (const c of cars) if (c.cart && Math.abs(c.x - cp.x) + Math.abs(c.z - cp.z) < far) { c.wph = (c.wph || 0) + c.v * dt / D.stride; _q.setFromAxisAngle(_Y, c.h); drawPed(D, c.x + Math.sin(c.h) * 1.85, 0.02, c.z + Math.cos(c.h) * 1.85, _q, c.wph, c.v > 0.2 ? 0 : 1, NO_TINT); }
    for (const k in WM) { const M = WM[k]; M.im.count = M.n; M.im.visible = M.n > 0; M.im.instanceMatrix.needsUpdate = true; M.iAnim.needsUpdate = true; M.iTint.needsUpdate = true; }
  }

  /* ======================= Le taxi du joueur ======================= */
  const DRIVERS = [
    { id: 'moulaye', name: 'Moulaye', build: 'audi', paint: 0xffc21a, sign: true, char: 'ch_moulaye', foot: 'wk_ped0', perk: 'Rapide · moteur nerveux', color: '#ffd60a', st: { power: 1.08, max: 1.07 } },
    { id: 'ba', name: 'Taximan Ba', car: 'tx_mondeo_taxi', char: 'ch_ba', foot: 'wk_ba', perk: 'Vétéran · clients patients (+25 % de temps)', color: '#ff9f1c', st: { time: 1.25 } },
    { id: 'sidi', name: 'Sidi', car: 'tx_mondeo_civil', tint: 0x1f9a52, sign: true, char: 'ped_9', foot: 'wk_ped9', perk: 'Maniable · tient la route', color: '#2f9e5b', st: { grip: 1.1, steer: 1.08 } },
    { id: 'mamadou', name: 'Mamadou', car: 'tx_mondeo_civil', tint: 0x2a62d8, sign: true, char: 'ped_1', foot: 'wk_ped1', perk: 'Connaît la ville · courses +15 %', color: '#2d6cdf', st: { fare: 1.15 } },
  ];
  T.driver = clamp(store.get('taxiDriver', 0), 0, DRIVERS.length - 1);
  T.shift = clamp(store.get('taxiShift', 1), 0, 2); // 4 / 6 / 8 minutes
  T.traffic = clamp(store.get('taxiTraffic', 1), 0, 2);
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
    if (inBlocks(bi, bj)) { const [bx, bz] = blockC(bi, bj); onWalk = Math.abs(c.x - bx) < BLK / 2 && Math.abs(c.z - bz) < BLK / 2; }
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
      const far = PLACES.filter(pl => pl.mx !== undefined && manhattan(pl.mx, pl.mz, s.mx, s.mz) > 260);
      p.dest = pick(far.length ? far : PLACES.filter(pl => pl.mx !== undefined));
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
        job.dist = manhattan(taxi.x, taxi.z, job.dest.zx, job.dest.zz);
        const dr = DRIVERS[T.driver];
        job.timer = Math.round((job.dist / 8.6 + 22) * (dr.st.time || 1)); job.t = job.timer;
        job.fare = Math.round((90 + job.dist * 0.42) * (dr.st.fare || 1) / 10) * 10;
        A.popup(p.name.toUpperCase() + ' MONTE', '→ ' + job.dest.name + ' · ' + fmtInt(job.fare) + ' MRU', false, 'gold');
        say(pick(['Salam alaykoum ! ', 'Bonjour chauffeur ! ', 'Assalamou alaykoum… ']) + 'Emmène-moi à ' + job.dest.name + ', s’il te plaît.');
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
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const x = nx(i), z = nz(j), d = Math.hypot(x - me.x, z - me.z); if (d < 45) continue; const ahead = (x - me.x) * fx + (z - me.z) * fz, sc = Math.abs(d - 105) + ahead * 0.25 + R() * 20; if (!best || sc < best.a) best = { x, z, a: sc }; } // de préférence derrière, à ~100 m, hors de vue
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
    for (let k = 0; k < 60; k++) { const i = Math.floor(R() * NI), j = Math.floor(R() * NJ), x = nx(i), z = nz(j), d = Math.hypot(x - p.x, z - p.z); if (d > 170 && d < 320 && (!best || Math.abs(d - 220) < Math.abs(best.d - 220))) best = { x, z, d }; }
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
      if (amb.t <= 0) { p.down = false; p.on = false; p.respawn = 30; p.road = false; const far = [[nx(0), nz(0)], [nx(NI - 1), nz(0)], [nx(0), nz(NJ - 1)], [nx(NI - 1), nz(NJ - 1)]].sort((a, b) => Math.hypot(b[0] - c.x, b[1] - c.z) - Math.hypot(a[0] - c.x, a[1] - c.z)); amb.leaveTo = far[1]; amb.st = 'leave'; amb.route = null; amb.rt = 0; }
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
  function lineBlocked(ax, az, bx, bz) { // un immeuble entre le policier et toi ?
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5);
    for (let k = 1; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; for (const o of nearCols(x, z, _cols)) if (o.box && x > o.box[0] && x < o.box[2] && z > o.box[1] && z < o.box[3] && (o.h === undefined || o.h > 1.2)) return true; }
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
    for (const pl of PLACES) if (pl.b) { const [x, z] = blockC(pl.b[0], pl.b[1]); c.fillText(pl.name.replace('Hôtel ', ''), mx(x), mz(z) + 4); }
    mapBg.mx = mx; mapBg.mz = mz;
  }
  function drawMap() {
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
    const pn = placeName(me.x, me.z), st = $('txStreet'); const label = pn.street ? pn.street + ' · ' + pn.district : pn.district; if (st.textContent !== label) st.textContent = label;
    $('mapName').textContent = pn.district;
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
  function nextAim(x, z, tx, tz) { // GPS : itinéraire en L par les rues (on tourne dans la rue de la cible)
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
    const t = A.menuTime(); let k = 0;
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
    const rnd = seeded(20261118);
    buildRoads(); buildBlocks(); buildBuildings(rnd);
    A.instanceLib(inst, { parent: root, cull: CULL, cell: 400, maxD: (det, small) => det ? (LITE ? 340 : 560) : small ? 300 : (LITE ? 620 : 980) });
    buildSignsAndNames(); buildProps(); buildLights();
    buildVehicleTypes();
    const counts = {}; for (const k in VT) counts[k] = k === 'police' ? 3 : k === 'cart' ? 5 : Math.max(4, Math.ceil(VT[k].w * 6));
    buildVehicleMeshes(counts);
    buildPedMeshes(); buildPoliceModels(); buildAmbulanceModel(); buildShotFx(); buildMarkers(); buildMapBg(); buildHud();
    root.traverse(o => { if (o.isMesh && o.material && o.material.map) texFix(o.material); });
    T.ready = true;
  }
  function cullUpdate() { const p = A.camera.position; for (const d of CULL) d.m.visible = p.distanceTo(d.c) - d.r < d.d; }

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
        $('loading').classList.add('hidden'); begin();
      }), f => { prog.taxi = f; bar(); });
      return;
    }
    begin();
  };
  function begin() {
    if (!T.active) { driftWas = A.hideDrift(); A.scene.add(root); root.visible = true; T.active = true; fogWas = [A.scene.fog.near, A.scene.fog.far]; }
    A.scene.fog.near = LITE ? 70 : 110; A.scene.fog.far = LITE ? 560 : 900;
    document.body.classList.add('taxi');
    A.clearSkids(); A.clearSmoke();
    makeTaxi(); const sp = spawnSpot(); placeTaxi(sp.x, sp.z, sp.h);
    lightT = 0; populateTraffic(); populatePeds();
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
      A.state = 'play'; A.camState.init = false;
      $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !isTouch);
      A.popup('SERVICE COMMENCÉ', dr.name + ' · ' + fmtClock(T.timeLeft) + ' pour gagner un max d’ouguiyas', false, 'gold');
      say(dr.id === 'ba' ? 'Bismillah… Allez, au travail. Les clients attendent aux arrêts verts.' : dr.id === 'moulaye' ? 'Moulaye est dans la place ! Direction les arrêts verts.' : 'C’est parti ! Les clients attendent aux arrêts verts.');
      updateHud();
    };
    rebuildDyn(); cullUpdate();
    if (A.introPlay && !(TEST && !/[?&]intro/.test(location.search))) { A.state = 'intro'; A.introPlay(taxiIntroShots(!T.introSeen), go); T.introSeen = true; }
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
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) { const el = $('txSay'); if (el) el.classList.remove('show'); } }
      if (foot.on) { updateFootCam(dt); A.updateAudio(taxi, NO_INP, 0, false); }
      else { updateTaxiVisual(inp, dt); A.updateCamera(dt, taxi); A.updateAudio(taxi, inp, taxi.screech || 0, true); }
      updateSiren();
      hudAcc += dt; if (hudAcc > 1 / 15) { hudAcc = 0; updateHud(); }
      if (T.timeLeft <= 0) { if (job.st === 'ride' && T.timeLeft > -75) { if (!T.overtime) { T.overtime = true; A.popup('FIN DU SERVICE', 'termine ta dernière course !', false, 'gold'); } } else { T.endAt = T.endAt == null ? 2.2 : T.endAt - dt; if (T.endAt <= 0) endShift(); } }
      T.lastInp = inp;
    } else if (st === 'intro') { // générique : la ville vit pendant que la caméra survole
      lightT += dt; rebuildDyn(); updateCars(dt); updatePeds(dt); A.introUpdate(dt); updateTaxiVisual({ thr: 0, brk: 0, steer: 0, hb: 0, nitro: 0 }, dt);
    } else if (st === 'results') {
      orbit += dt * 0.25; const r = 11; A.camera.position.set(taxi.x + Math.sin(orbit + taxi.h) * r, 3.4, taxi.z + Math.cos(orbit + taxi.h) * r); A.camera.lookAt(taxi.x, 1, taxi.z);
      updateCars(dt * 0.5); updatePeds(dt);
    }
    if (st !== 'pause') { if (Math.floor(lightT * 5) !== lastLightUpd) { lastLightUpd = Math.floor(lightT * 5); updateLights(); } }
    drawCars(); drawPeds(dt); updateMarkers(dt);
    if ((T.fc = (T.fc || 0) + 1) % 4 === 0) cullUpdate();
    A.sun.position.set(me.x + A.SUN_OFF.x, A.SUN_OFF.y, me.z + A.SUN_OFF.z); A.sun.target.position.set(me.x, 0, me.z);
    A.sky.position.set(A.camera.position.x, 0, A.camera.position.z);
    if (lampGlow) lampGlow.visible = !!prof.night;
    A.fx(dt);
    if (TEST && window.__tcam) { const c = window.__tcam; A.camera.position.set(c.p[0], c.p[1], c.p[2]); A.camera.lookAt(c.t[0], c.t[1], c.t[2]); if (c.fov && A.camera.fov !== c.fov) { A.camera.fov = c.fov; A.camera.updateProjectionMatrix(); } }
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
        p.road = !onSidewalk(p.x, p.z); if (p.st === 'cross' || p.st === 'flee' || p.st === 'cwait') p.st = 'walk';
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
      '<div><div class="lbl" style="margin-bottom:6px">Circulation</div><div class="seg" id="segTraffic"><button data-v="0">Calme</button><button data-v="1">Normale</button><button data-v="2">Dense</button></div></div></div>' +
      '<div class="note" style="margin-top:8px">Arrête-toi dans un cercle <b style="color:#4ade80">vert</b> pour prendre un client, dépose-le au cercle <b style="color:#facc15">jaune</b>. Feux rouges, piétons et police : attention aux amendes !</div>';
    const after = $('duoOpts') || $('raceOpts');
    after.parentNode.insertBefore(box, after.nextSibling);
    $('segShift').onclick = e => { const b = e.target.closest('button'); if (!b) return; T.shift = +b.dataset.v; store.set('taxiShift', T.shift); renderOpts(true); };
    $('segTraffic').onclick = e => { const b = e.target.closest('button'); if (!b) return; T.traffic = +b.dataset.v; store.set('taxiTraffic', T.traffic); renderOpts(true); };
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
    for (const [id, v] of [['segShift', T.shift], ['segTraffic', T.traffic]]) $(id).querySelectorAll('button').forEach(b => b.classList.toggle('sel', +b.dataset.v === v));
  }
  T.renderOpts = renderOpts;
  T.DRIVERS = DRIVERS;
  if (TEST) T.dbg = { get SFX() { return SFX; }, foot, parked, get homeTaxi() { return homeTaxi; }, get me() { return me; }, get chaseT() { return chaseT; }, set wanted(v) { wanted = v; }, amb, spawnCop, offence, nearestPolice, get WM() { return WM; }, dispatchAmbulance, get taxiModel() { return taxiModel; }, VAT_OK, get taxi() { return taxi; }, get cars() { return cars; }, get peds() { return peds; }, job, stats, STOPS, PLACES, get money() { return money; }, light, get chasers() { return chasers; }, get wanted() { return wanted; }, CULL, root, placeTaxi, spawnClients, startChase, VT, get lightT() { return lightT; }, set lightT(v) { lightT = v; }, nx, nz, HW, LANE, HEAD, EL, P };
  return T;
};
