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
      if (vn < 0) { c.vx -= dx * vn * 1.3; c.vz -= dz * vn * 1.3; c.vx *= 0.85; c.vz *= 0.85; c.w *= 0.6; hit = Math.max(hit, -vn); }
    }
    return hit;
  }
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
    if (vn < 0) { c.vx -= wx * vn * 1.25; c.vz -= wz * vn * 1.25; c.w += (Math.random() - 0.5) * 0.3; return -vn; }
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
      if (!o.isMesh) return;
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
  const VT = {
    civil: { node: 'tx_mondeo_civil', tint: [0xf2f2f2, 0xc9ced6, 0x22252b, 0x8a1c1c, 0x1f3f7a, 0xd9c7a6, 0x6b7076, 0x2d6a4f], w: 6 },
    taxi2: { node: 'tx_mondeo_taxi', w: 2 }, e7: { node: 'tx_e7', w: 2 },
    police: { node: 'tx_mondeo_police', w: 0, police: true },
    amb: { node: 'tx_ambulance', w: 0.5, vmax: 13 },
    box: { node: 'tx_truck_box', w: 0.8, vmax: 10.5 }, cist: { node: 'tx_truck_cistern', w: 0.7, vmax: 10 }, flat: { node: 'tx_truck_flat', w: 0.7, vmax: 10.5 },
    car1: { city: 'V_Car1', s: 0.72, w: 1.2 }, car2: { city: 'V_Car2', s: 0.72, w: 1.2 }, car3: { city: 'V_Car3', s: 0.72, w: 1 },
    suv1: { city: 'V_SUV1', s: 0.78, w: 1 }, suv2: { city: 'V_SUV2', s: 0.78, w: 1 }, pick1: { city: 'V_PickupTruck1', s: 0.78, w: 1.2 }, pick2: { city: 'V_PickupTruck2', s: 0.78, w: 0.8 },
    bus: { city: 'V_Bus1', s: 0.85, w: 0.7, vmax: 10.5 }, bus2: { city: 'V_Bus2', s: 0.85, w: 0.4, vmax: 10.5 },
    cart: { cart: true, w: 0, vmax: 3.6 },
  };
  function buildVehicleTypes() {
    for (const k in VT) {
      const t = VT[k]; let parts = null;
      if (t.node) { const src = lib.getObjectByName(t.node); if (src) parts = bake(src); }
      else if (t.city) { const src = A.ASSETS.city && A.ASSETS.city.getObjectByName(t.city); if (src) parts = bake(src, new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(t.s, t.s, t.s))); }
      else if (t.cart) parts = cartParts();
      if (!parts) { delete VT[k]; continue; }
      const bb = new THREE.Box3(); for (const p of parts) bb.union(p.geo.boundingBox);
      t.hl = Math.max(-bb.min.z, bb.max.z); t.hw = Math.max(-bb.min.x, bb.max.x) * 0.92; t.ht = bb.max.y; t.parts = parts;
    }
  }
  function cartParts() { // charrette tirée par un cheval (très nouakchottois)
    const horse = lib.getObjectByName('an_horse'); if (!horse) return null;
    const hp = bake(horse, new THREE.Matrix4().makeTranslation(0, 0, 1.6).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(new THREE.Matrix4().makeScale(0.85, 0.85, 0.85)));
    const wood = A.surf({ color: 0x8a5a2b, roughness: 0.9 }), gs = [];
    const add = (g, x, y, z) => { g = g.toNonIndexed(); g.translate(x, y, z); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); gs.push(g); };
    add(new THREE.BoxGeometry(1.5, 0.12, 2.0), 0, 0.85, -0.9); add(new THREE.BoxGeometry(1.5, 0.35, 0.08), 0, 1.05, -1.9); add(new THREE.BoxGeometry(0.08, 0.35, 2.0), 0.72, 1.05, -0.9); add(new THREE.BoxGeometry(0.08, 0.35, 2.0), -0.72, 1.05, -0.9);
    for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12); w.rotateZ(Math.PI / 2); add(w, s * 0.85, 0.5, -0.9); add(new THREE.BoxGeometry(0.06, 0.06, 1.6), s * 0.5, 0.85, 0.5); }
    return hp.concat([{ geo: mergeGeos(gs), mat: wood }]);
  }
  const VIM = {}; // InstancedMesh par type
  function buildVehicleMeshes(counts) {
    for (const k in VT) {
      const t = VT[k], n = counts[k] || 0; if (!n || !t.parts) continue;
      t.ims = t.parts.map(p => { const m = new THREE.InstancedMesh(p.geo, texFix(lowMat(p.mat)), n); m.frustumCulled = false; m.castShadow = !LITE; m.receiveShadow = false; for (let q = 0; q < n; q++) m.setMatrixAt(q, ZERO); if (t.tint) { for (let q = 0; q < n; q++) m.setColorAt(q, lin(t.tint[q % t.tint.length])); } root.add(m); return m; });
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
    const c = { type, t, slot: t.free.pop(), col: t.tint ? lin(pick(t.tint)) : null, i, j, d, lane, s: s || 0, v: 6, vmax: (t.vmax || 12.5) + R() * 2, hl: t.hl, hw: t.hw, x: 0, z: 0, h: HEAD(d), vx: 0, vz: 0, police: !!t.police, cart: !!t.cart, bump: 0, honkT: 0, stuck: 0, ghost: 0, id: cars.length, gap: 99, wait: 0 };
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
    for (const pc of chasers) dynAdd(pc.car);
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
      if (c.v < 0.2 && !stopByLight && c.blocker) { c.stuck += dt; if (c.blocker === taxi && c.honkT <= 0 && c.stuck > 1.8) { honk(c.x, c.z, 1); c.honkT = 2.5 + R() * 2; } if (c.stuck > 6 && c.blocker !== taxi) { c.ghost = 2.5; c.stuck = 0; } } else c.stuck = 0;
      c.s += c.v * dt;
      if (c.s >= c.len) {
        const over = c.s - c.len;
        if (c.piece === 'edge') { turnPath(c); c.s = over; c.wait = 0; }
        else { c.i = c.bi; c.j = c.bj; c.d = c.nd; c.lane = c.nl; edgePath(c); chooseNext(c); c.s = over; }
      }
      const p = pathAt(c, c.s), ph = c.h; c.x = p[0]; c.z = p[1]; c.h = ph + wrapAng(p[2] - ph) * Math.min(1, dt * 10);
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
      for (const m of t.ims) { m.setMatrixAt(q, _m); if (t.tint) m.setColorAt(q, c.col); }
    }
    for (const k in VT) { const t = VT[k]; if (!t.ims) continue; for (const m of t.ims) { m.count = t.n; m.visible = t.n > 0; m.instanceMatrix.needsUpdate = true; if (t.tint && m.instanceColor) m.instanceColor.needsUpdate = true; } }
  }
  function populateTraffic() {
    for (const c of cars) freeCar(c); cars = [];
    const n = LOW ? 18 : LITE ? 30 : 44, types = [];
    for (const k in VT) if (VT[k].ims && !VT[k].police && !VT[k].cart) for (let q = 0; q < Math.round(VT[k].w * 4); q++) types.push(k);
    const tries = { v: 0 };
    const occ = (i, j, d, lane, s) => cars.some(o => o.i === i && o.j === j && o.d === d && o.lane === lane && Math.abs(o.s - s) < 12);
    const place = (type, laneOnly) => { for (let k = 0; k < 40; k++) { const i = Math.floor(R() * NI), j = Math.floor(R() * NJ), d = Math.floor(R() * 4); if (!inGrid(i + DIRS[d][0], j + DIRS[d][1])) continue; const lane = laneOnly !== undefined ? laneOnly : R() < 0.5 ? 0 : 1, s = 4 + R() * (EL - 30); if (occ(i, j, d, lane, s)) continue; if (taxi && Math.hypot(nx(i) - taxi.x, nz(j) - taxi.z) < 30) continue; return spawnCar(type, i, j, d, lane, s); } return null; };
    for (let k = 0; k < (LOW ? 2 : 3); k++) place('police');
    for (let k = 0; k < (LOW ? 1 : 2); k++) place('cart', 1);
    const dense = [0.6, 1, 1.4][T.traffic];
    for (let k = 0; k < Math.round(n * dense); k++) place(pick(types));
  }

  /* ======================= Piétons, clients, animaux ======================= */
  let peds = [], PIM = [], AIM = [];
  const PED_N = LOW ? 34 : LITE ? 60 : 90, CLIENT_N = 8, ANIM = ['an_dog', 'an_chicken', 'an_kitty', 'an_dog'];
  function buildPedMeshes() {
    PIM = []; AIM = [];
    for (let k = 0; k < 10; k++) { const src = lib.getObjectByName('ped_' + k); if (!src) continue; const parts = bake(src); PIM.push(parts.map(p => { const m = new THREE.InstancedMesh(p.geo, texFix(lowMat(p.mat)), Math.ceil((PED_N + CLIENT_N) / 10) + 6); m.frustumCulled = false; m.castShadow = HIQ; root.add(m); m.count = 0; return m; })); }
    for (const a of ['an_dog', 'an_chicken', 'an_kitty']) { const src = lib.getObjectByName(a); if (!src) continue; const parts = bake(src); AIM.push(parts.map(p => { const m = new THREE.InstancedMesh(p.geo, texFix(lowMat(p.mat)), 8); m.frustumCulled = false; root.add(m); m.count = 0; return m; })); }
  }
  const loopPos = (bi, bj, p, lat) => { // position sur le trottoir (tour de l'îlot)
    const [cx, cz] = blockC(bi, bj), L = 2 * HS, per = 4 * L; p = ((p % per) + per) % per;
    const k = Math.floor(p / L), t = p - k * L - HS, h = HS + lat;
    if (k === 0) return [cx + t, cz - h, 0]; if (k === 1) return [cx + h, cz + t, 1]; if (k === 2) return [cx - t, cz + h, 2]; return [cx - h, cz - t, 3];
  };
  const CORNER = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; // NO, NE, SE, SO
  function newPed(kind, mi) {
    const group = kind === 'animal' ? AIM : PIM; if (!group.length) return null;
    const g = mi === undefined ? Math.floor(R() * group.length) : mi % group.length, ims = group[g];
    ims.cap = (ims.cap || 0); if (ims.cap >= ims[0].instanceMatrix.count) return null; const slot = ims.cap++;
    const p = { kind, ims, slot, on: true, st: 'walk', bi: 0, bj: 0, p: 0, dir: R() < 0.5 ? 1 : -1, lat: (R() - 0.5) * 2.2, spd: kind === 'animal' ? 0.5 + R() * 0.7 : 1.05 + R() * 0.45, x: 0, z: 0, h: 0, ph: R() * 6.3, t: 0, road: false, hw: 0.35, hl: 0.35, fall: 0, wait: 0 };
    peds.push(p); return p;
  }
  function placeWalker(p) {
    for (let k = 0; k < 30; k++) { p.bi = Math.floor(R() * (NI - 1)); p.bj = Math.floor(R() * (NJ - 1)); if (!taxi || Math.hypot(blockC(p.bi, p.bj)[0] - taxi.x, blockC(p.bi, p.bj)[1] - taxi.z) > 40) break; }
    p.p = R() * 8 * HS; p.st = 'walk'; p.road = false; p.fall = 0;
    const q = loopPos(p.bi, p.bj, p.p, p.lat); p.x = q[0]; p.z = q[1];
  }
  function populatePeds() {
    for (const g of PIM.concat(AIM)) g.cap = 0;
    peds = [];
    for (let k = 0; k < PED_N; k++) { const p = newPed('ped', k); if (p) placeWalker(p); }
    for (let k = 0; k < (LOW ? 4 : 9); k++) { const p = newPed('animal', k); if (p) { placeWalker(p); p.lat = 1 + R() * 0.6; } }
    for (let k = 0; k < CLIENT_N; k++) { const p = newPed('ped', k * 3 + 1); if (p) { p.on = false; p.st = 'off'; p.client = true; } }
  }
  function startCross(p, fromCorner, alongX) { // traverser au passage piéton depuis le coin de l'îlot
    const [sx, sz] = CORNER[fromCorner], [cx, cz] = blockC(p.bi, p.bj);
    const ax = cx + sx * (HS + 0.3), az = cz + sz * (HS + 0.3);
    let nbi = p.bi, nbj = p.bj, tc;
    if (alongX) { nbi += sx; tc = [1, 0, 3, 2][fromCorner]; } else { nbj += sz; tc = [3, 2, 1, 0][fromCorner]; }
    if (!inBlocks(nbi, nbj)) return false;
    const [ncx, ncz] = blockC(nbi, nbj), [tx, tz] = CORNER[tc];
    p.cx0 = ax; p.cz0 = az; p.cx1 = ncx + tx * (HS + 0.3); p.cz1 = ncz + tz * (HS + 0.3);
    // nœud et axe du feu qui protège ce passage
    p.ni = Math.round((ax + (p.cx1 - ax) / 2 - X0) / P); p.nj = Math.round((az + (p.cz1 - az) / 2 - Z0) / P);
    p.ni = clamp(Math.round(((ax + p.cx1) / 2 - X0) / P), 0, NI - 1); p.nj = clamp(Math.round(((az + p.cz1) / 2 - Z0) / P), 0, NJ - 1);
    p.axis = alongX ? 1 : 0; // traverser la route N-S (le long de x) = couper l'axe N-S
    p.nbi = nbi; p.nbj = nbj; p.np = tc * 2 * HS; p.st = 'cwait'; p.wait = 0; p.x = ax; p.z = az;
    return true;
  }
  function startJay(p) { // traverser n'importe où, sans regarder
    const q = loopPos(p.bi, p.bj, p.p, p.lat), side = q[2], [fx, fz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
    const nbi = p.bi + fx, nbj = p.bj + fz; if (!inBlocks(nbi, nbj)) return false;
    p.cx0 = q[0]; p.cz0 = q[1]; p.cx1 = q[0] + fx * (RW + 4.4 + 2 * p.lat * 0); p.cz1 = q[1] + fz * (RW + 4.4);
    p.nbi = nbi; p.nbj = nbj;
    const [ncx, ncz] = blockC(nbi, nbj); // position sur la boucle de l'îlot d'en face
    const opp = (side + 2) % 4, along = opp === 0 ? p.cx1 - ncx : opp === 1 ? p.cz1 - ncz : opp === 2 ? -(p.cx1 - ncx) : -(p.cz1 - ncz);
    p.np = opp * 2 * HS + along + HS; p.st = 'cross'; p.t = 0; p.jay = true; p.spd2 = 1.8 + R() * 0.8;
    return true;
  }
  function updatePeds(dt) {
    for (const p of peds) {
      if (!p.on) continue;
      p.ph += dt * (p.kind === 'animal' ? 7 : 6.2) * (p.run ? 1.8 : 1);
      if (p.fall > 0) { p.fall -= dt; if (p.fall <= 0 && p.st !== 'ride') { p.road = false; if (p.st === 'walk' || p.st === 'cross' || p.st === 'flee') { p.st = 'walk'; placeWalker(p); } } continue; }
      if (p.run > 0) p.run -= dt;
      if (p.st === 'walk') {
        const sp = p.spd * (p.run > 0 ? 2.4 : 1) * (p.kind === 'animal' && Math.sin(p.ph * 0.07) > 0.6 ? 0 : 1);
        const before = Math.floor(p.p / (2 * HS));
        p.p += p.dir * sp * dt;
        const after = Math.floor(p.p / (2 * HS));
        const q = loopPos(p.bi, p.bj, p.p, p.lat); p.x = q[0]; p.z = q[1]; p.h = Math.atan2(...dirOfSide(q[2], p.dir));
        if (before !== after) { // coin atteint
          const corner = ((p.dir > 0 ? after : before) % 4 + 4) % 4;
          if (p.kind === 'ped' && R() < 0.42) startCross(p, corner, R() < 0.5);
        } else if (R() < dt * (p.kind === 'animal' ? 0.012 : 0.0045) && Math.abs(((p.p % (2 * HS)) + 2 * HS) % (2 * HS) - HS) < HS - 14) startJay(p);
      } else if (p.st === 'cwait') {
        const L = light(p.ni, p.nj, p.axis); p.wait += dt; p.h = Math.atan2(p.cx1 - p.cx0, p.cz1 - p.cz0);
        if ((L.s === 'R' && L.toG > 8) || p.wait > 40) { p.st = 'cross'; p.t = 0; p.jay = false; p.spd2 = p.spd * 1.1; }
      } else if (p.st === 'cross' || p.st === 'flee') {
        const L = Math.hypot(p.cx1 - p.cx0, p.cz1 - p.cz0) || 1;
        p.t += (p.st === 'flee' ? 4.2 : p.spd2 * (p.run > 0 ? 2 : 1)) * dt / L;
        const t = clamp(p.t, 0, 1); p.x = p.cx0 + (p.cx1 - p.cx0) * t; p.z = p.cz0 + (p.cz1 - p.cz0) * t; p.h = Math.atan2(p.cx1 - p.cx0, p.cz1 - p.cz0);
        p.road = t > 0.12 && t < 0.88;
        if (p.t >= 1) { p.st = 'walk'; p.road = false; p.bi = p.nbi; p.bj = p.nbj; p.p = p.np; p.lat = (R() - 0.5) * 2.2; p.dir = R() < 0.5 ? 1 : -1; }
      } else if (p.st === 'wait') { // client à l'arrêt
        p.h = p.face + Math.sin(p.ph * 0.15) * 0.3;
      } else if (p.st === 'board' || p.st === 'alight') {
        const tx = p.st === 'board' ? taxi.x - Math.cos(taxi.h) * 1.3 : p.cx1, tz = p.st === 'board' ? taxi.z + Math.sin(taxi.h) * 1.3 : p.cz1;
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { const s = Math.min(d, 2.3 * dt); p.x += dx / d * s; p.z += dz / d * s; p.h = Math.atan2(dx, dz); }
        p.t += dt;
        if (p.st === 'alight' && (d < 0.3 || p.t > 4)) { p.st = 'walk'; p.client = true; releaseClient(p); }
      }
    }
  }
  const dirOfSide = (side, dir) => { const v = [[1, 0], [0, 1], [-1, 0], [0, -1]][side]; return [v[0] * dir, v[1] * dir]; };
  function drawPeds() {
    const cp = A.camera.position, far = LITE ? 140 : 200;
    for (const g of PIM.concat(AIM)) g.n = 0;
    for (const p of peds) {
      const vis = p.on && p.st !== 'ride' && p.st !== 'off' && Math.abs(p.x - cp.x) + Math.abs(p.z - cp.z) < far;
      if (!vis) continue;
      const y0 = (p.road ? 0.02 : 0.15);
      if (p.fall > 0) { _q.setFromEuler(_e.set(-Math.PI / 2 * Math.min(1, (3.2 - p.fall) * 4), p.h + Math.PI, 0, 'YXZ')); _v.set(p.x, y0 + 0.2, p.z); }
      else {
        const moving = p.st === 'walk' || p.st === 'cross' || p.st === 'flee' || p.st === 'board' || p.st === 'alight';
        const bob = moving ? Math.abs(Math.sin(p.ph)) * (p.kind === 'animal' ? 0.05 : 0.045) : (p.st === 'wait' && p.wave ? Math.abs(Math.sin(p.ph * 2)) * 0.12 : 0);
        _q.setFromAxisAngle(_Y, p.h + Math.PI + (moving ? Math.sin(p.ph) * 0.05 : 0)); _v.set(p.x, y0 + bob, p.z);
      }
      _m.compose(_v, _q, _s.set(1, 1, 1)); const q = p.ims.n++; for (const m of p.ims) m.setMatrixAt(q, _m);
    }
    for (const g of PIM.concat(AIM)) for (const m of g) { m.count = g.n; m.visible = g.n > 0; m.instanceMatrix.needsUpdate = true; }
  }
  const _e = new THREE.Euler();

  /* ======================= Le taxi du joueur ======================= */
  const DRIVERS = [
    { id: 'moulaye', name: 'Moulaye', car: 'tx_e7', char: 'ch_moulaye', perk: 'Rapide · moteur nerveux', color: '#ffd60a', st: { power: 1.08, max: 1.07 } },
    { id: 'ba', name: 'Taximan Ba', car: 'tx_mondeo_taxi', char: 'ch_ba', perk: 'Vétéran · clients patients (+25 % de temps)', color: '#ff9f1c', st: { time: 1.25 } },
    { id: 'sidi', name: 'Sidi', car: 'tx_mondeo_civil', tint: 0x1f9a52, char: 'ped_9', perk: 'Maniable · tient la route', color: '#2f9e5b', st: { grip: 1.1, steer: 1.08 } },
    { id: 'mamadou', name: 'Mamadou', car: 'tx_mondeo_civil', tint: 0x2a62d8, char: 'ped_1', perk: 'Connaît la ville · courses +15 %', color: '#2d6cdf', st: { fare: 1.15 } },
  ];
  T.driver = clamp(store.get('taxiDriver', 0), 0, DRIVERS.length - 1);
  T.shift = clamp(store.get('taxiShift', 1), 0, 2); // 4 / 6 / 8 minutes
  T.traffic = clamp(store.get('taxiTraffic', 1), 0, 2);
  const SHIFT_S = [240, 360, 480];
  let taxi = null, taxiModel = null;
  function buildTaxiModel(dr) {
    const src = lib.getObjectByName(dr.car); if (!src) return null;
    const g = new THREE.Group(), body = src.clone(true); body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
    const wheels = [];
    body.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = false;
      o.material = texFix(lowMat(o.material));
      if (dr.tint) { o.material = o.material.clone(); o.material.color = lin(dr.tint); }
    });
    body.updateMatrixWorld(true);
    body.traverse(o => { if (/^Wheel_/.test(o.name)) { const k = o.name.slice(6, 8); wheels.push({ o, front: k[0] === 'F' }); o.rotation.order = 'YXZ'; } });
    g.add(body);
    const box = new THREE.Box3().setFromObject(body);
    // conducteur (assis : on l'enfonce dans le siège)
    const ch = lib.getObjectByName(dr.char);
    if (ch) {
      const d = ch.clone(true); d.traverse(o => { if (o.isMesh) { o.castShadow = false; o.material = lowMat(o.material); } });
      const s = 0.93; d.scale.setScalar(s); d.position.set(0.42, box.max.y - 0.1 - 1.78 * s, 0.05);
      if (/^ped_/.test(dr.char)) d.rotation.y = Math.PI; // les passants regardent vers -z
      g.add(d);
    }
    if (dr.tint) { // enseigne TAXI sur le toit
      const tx = A.textTex([{ t: 'TAXI', y: 0.55, size: 150 }], { bg: '#ffd60a', fg: '#111111', w: 512, h: 160 });
      const sm = new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.35, roughness: 0.5 });
      const sg = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.34), sm); sg.position.set(0, box.max.y + 0.1, -0.15); g.add(sg); A.nightReg(sm, 0.35, 1.6);
    }
    return { root: g, body, wheels, box };
  }
  function makeTaxi() {
    const dr = DRIVERS[T.driver];
    if (taxiModel) root.remove(taxiModel.root);
    taxiModel = buildTaxiModel(dr); if (taxiModel) root.add(taxiModel.root);
    const spec = A.makeSpec('race', { engine: 0, tires: 0, nitro: 0 }, 'audi');
    Object.assign(spec, { power: 10.5 * (dr.st.power || 1), maxSpeed: 30 * (dr.st.max || 1), grip: 8.2 * (dr.st.grip || 1), driftGrip: 1.9, steer: 2.3 * (dr.st.steer || 1), latMax: 13.5 * (dr.st.grip || 1), offGrip: 1, nitroDrain: 0.28, nitroPower: 6.5 });
    taxi = A.newCar({ isPlayer: true, name: dr.name, carId: 's15', spec, hl: 2.35, hw: 0.95, nitro: 0.6 });
    taxi.model = null; taxi.y = 0;
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
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = DYN.get((cx + a) * 4096 + cz + b); if (!l) continue; for (const o of l) { if (o === c || o.hl === undefined || o.kind) continue; let h2 = 0; for (const of of [1.4, -1.4]) h2 = Math.max(h2, circleOBB(c, fx * of, fz * of, 1.0, o)); if (h2 > 0.5) { o.bump = Math.max(o.bump || 0, 2.5 + Math.min(2, h2 * 0.3)); if (o.chaser) continue; if (o.police) policeBumped(h2); hit = Math.max(hit, h2); } } }
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
  function updateTaxiVisual(inp, dt) {
    const m = taxiModel; if (!m) return;
    m.root.position.set(taxi.x, 0.03 + taxi.y, taxi.z); m.root.rotation.y = taxi.h;
    const roll = clamp(-taxi.w * taxi.speed * 0.004, -0.06, 0.06), pitch = clamp((inp.brk ? 0.02 : 0) - (inp.thr && taxi.speed < 20 ? 0.012 : 0), -0.035, 0.035);
    m.body.rotation.z = lerp(m.body.rotation.z, roll, Math.min(1, dt * 6)); m.body.rotation.x = lerp(m.body.rotation.x, pitch, Math.min(1, dt * 6));
    taxi.wheelRot = (taxi.wheelRot || 0) + taxi.vF / 0.36 * dt;
    for (const w of m.wheels) { w.o.rotation.x = taxi.wheelRot; if (w.front) w.o.rotation.y = lerp(w.o.rotation.y, taxi.steer * 0.5, Math.min(1, dt * 10)); }
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
  }

  /* ======================= Clients et courses ======================= */
  const NAMES_F = ['Fatimetou', 'Mariem', 'Aïchetou', 'Khadijetou', 'Oumou', 'Salka', 'Vatimetou', 'Zeinabou', 'Aminata', 'Mounina', 'Lalla', 'Coumba'];
  const NAMES_M = ['Mohamed Lemine', 'Sidi Mohamed', 'Cheikh', 'Brahim', 'Ahmedou', 'Yacoub', 'Moussa', 'El Hacen', 'Abdallahi', 'Samba', 'Oumar', 'Isselmou'];
  const job = { st: 'free', client: null, dest: null, t: 0, timer: 0, fare: 0, stars: 5, board: 0, dist: 0 };
  const stats = { courses: 0, fares: 0, tips: 0, fines: 0, peds: 0, reds: 0, crashes: 0, starSum: 0, arrests: 0 };
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
  function nearestPolice(maxD) { let best = null, bd = maxD; for (const c of cars) if (c.police && !c.chase) { const d = Math.hypot(c.x - taxi.x, c.z - taxi.z); if (d < bd) { bd = d; best = c; } } for (const pc of chasers) { const d = Math.hypot(pc.car.x - taxi.x, pc.car.z - taxi.z); if (d < bd) { bd = d; best = pc.src; } } return best; }
  function offence(kind, fine, w, pd) { // pd : distance à laquelle la police voit l'infraction
    const cop = nearestPolice(pd || 110);
    const label = { red: 'FEU ROUGE GRILLÉ', speed: 'EXCÈS DE VITESSE', ped: 'PIÉTON RENVERSÉ', crash: 'ACCROCHAGE', cop: 'VOITURE DE POLICE PERCUTÉE' }[kind];
    if (cop) {
      money -= fine; stats.fines += fine; wanted = Math.min(3, wanted + w); wantedT = 0;
      A.popup('🚨 ' + label, 'Amende : -' + fmtInt(fine) + ' MRU · la police te suit !', true);
      startChase(cop);
      return true;
    }
    A.popup(label, kind === 'red' ? 'Heureusement, pas de police…' : '', true);
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
    // la voiture reprend une voie du réseau la plus proche
    let best = null, bd = 1e9;
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) for (let d = 0; d < 4; d++) { if (!inGrid(i + DIRS[d][0], j + DIRS[d][1])) continue; const mx = nx(i) + DIRS[d][0] * P / 2, mz = nz(j) + DIRS[d][1] * P / 2, dd = Math.hypot(mx - pc.car.x, mz - pc.car.z) + (taxi ? -Math.min(250, Math.hypot(mx - taxi.x, mz - taxi.z)) : 0); if (dd < bd) { bd = dd; best = [i, j, d]; } }
    c.i = best[0]; c.j = best[1]; c.d = best[2]; c.lane = 1; c.s = 10; c.v = 4; edgePath(c); chooseNext(c);
    chasers.splice(chasers.indexOf(pc), 1);
    if (!chasers.length) sirenOn(false);
  }
  function policeBumped(v) { if (v > 2.5 && !T.bumpCd) { T.bumpCd = 3; offence('cop', 250, 1, 200); } }
  function chaseInput(pc, dt) { // pilote de la police : itinéraire par les carrefours, puis droit sur le taxi
    const c = pc.car, dx = taxi.x - c.x, dz = taxi.z - c.z, dist = Math.hypot(dx, dz);
    let tx = taxi.x + taxi.vx * 0.5, tz = taxi.z + taxi.vz * 0.5;
    pc.rt -= dt;
    if (dist > 45) {
      if (pc.rt <= 0 || !pc.route || !pc.route.length) { pc.route = gridRoute(c.x, c.z, taxi.x, taxi.z); pc.rt = 1.2; }
      while (pc.route.length && Math.hypot(pc.route[0][0] - c.x, pc.route[0][1] - c.z) < 9) pc.route.shift();
      if (pc.route.length) { tx = pc.route[0][0]; tz = pc.route[0][1]; }
    }
    const want = Math.atan2(tx - c.x, tz - c.z), err = wrapAng(want - c.h);
    const steer = clamp(err * 2.2, -1, 1), sharp = Math.abs(err) > 0.7;
    const fast = c.speed > (sharp ? 9 : 30);
    return { thr: fast ? 0 : 1, brk: fast && c.vF > 3 ? 0.7 : 0, steer, hb: 0, nitro: 0 };
  }
  function gridRoute(ax, az, bx, bz) { // L-trajet par les nœuds (BFS inutile sur une grille sans obstacle)
    const ai = clamp(Math.round((ax - X0) / P), 0, NI - 1), aj = clamp(Math.round((az - Z0) / P), 0, NJ - 1), bi = clamp(Math.round((bx - X0) / P), 0, NI - 1), bj = clamp(Math.round((bz - Z0) / P), 0, NJ - 1);
    const r = [[nx(ai), nz(aj)]]; let i = ai, j = aj;
    const horiz = Math.abs(az - nz(aj)) < HW + 2; // déjà sur une rue E-O
    const stepI = () => { while (i !== bi) { i += Math.sign(bi - i); r.push([nx(i), nz(j)]); } }, stepJ = () => { while (j !== bj) { j += Math.sign(bj - j); r.push([nx(i), nz(j)]); } };
    if (horiz) { stepI(); stepJ(); } else { stepJ(); stepI(); }
    r.push([bx, bz]); return r;
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
      const d = Math.hypot(taxi.x - c.x, taxi.z - c.z);
      pc.pm.g.position.set(c.x, 0.03, c.z); pc.pm.g.rotation.y = c.h;
      const fl = Math.sin(A.menuTime() * 14) > 0; pc.pm.red.material.opacity = fl ? 1 : 0.15; pc.pm.blue.material.opacity = fl ? 0.15 : 1;
      if (d < 7.5 && taxi.speed < 3) { caughtT += dt; if (caughtT > 1.4) { arrested(); return; } }
      if (d > 170) pc.lost += dt; else pc.lost = Math.max(0, pc.lost - dt * 0.5);
      if (pc.lost > 9) { endChase(pc); if (!chasers.length) { A.popup('POLICE SEMÉE !', 'Tu t’en sors… cette fois', false, 'blue'); wanted = 0; } }
    }
    if (!chasers.length) caughtT = 0;
    if (wanted && !chasers.length) { wantedT += dt; if (wantedT > 25) wanted = 0; }
  }
  function arrested() {
    const fine = 300 * Math.max(1, wanted);
    money -= fine; stats.fines += fine; stats.arrests++;
    A.popup('ARRÊTÉ PAR LA POLICE', 'Amende : -' + fmtInt(fine) + ' MRU · papiers vérifiés (-15 s)', true);
    T.timeLeft -= 15;
    if (job.st === 'ride' || job.st === 'board') { const p = job.client; say('Je descends ici, je ne veux pas d’ennuis !'); releaseClient(p); job.st = 'free'; job.client = null; job.dest = null; spawnClients(true); }
    for (const pc of chasers.slice()) endChase(pc);
    wanted = 0; caughtT = 0;
  }

  /* ======================= Sons : klaxon, sirène ======================= */
  const snd = {};
  function honk(x, z, vol) { // klaxon (joueur ou IA) atténué avec la distance
    const au = A.audio; if (!au.ctx || prof.muted) return;
    const d = taxi ? Math.hypot(x - taxi.x, z - taxi.z) : 0, g0 = (vol || 1) * 0.16 * clamp(1 - d / 140, 0, 1); if (g0 < 0.005) return;
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
  function updateSiren() {
    if (!snd.siren || !A.audio.ctx) return;
    let d = 1e9; for (const pc of chasers) d = Math.min(d, Math.hypot(pc.car.x - taxi.x, pc.car.z - taxi.z));
    const v = chasers.length && T.active && A.state === 'play' && !prof.muted ? 0.07 * clamp(1 - d / 320, 0.1, 1) : 0;
    snd.siren.g.gain.setTargetAtTime(v, A.audio.ctx.currentTime, 0.15);
  }
  T.horn = () => {
    if (!taxi || A.state !== 'play') return;
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
      '<div id="txSay" class="panel"></div><div id="txStreet"></div>';
    $('hud').appendChild(hudEl);
    const t = $('touch'); if (t && !$('tHorn')) { const b = document.createElement('div'); b.className = 'tbtn'; b.id = 'tHorn'; b.textContent = '📯'; t.appendChild(b); b.addEventListener('pointerdown', e => { e.preventDefault(); A.initAudio(); T.horn(); b.classList.add('on'); }); const off = () => b.classList.remove('on'); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off); }
    const hint = $('hint'); if (hint && !hint.querySelector('.kbT')) { const sp = document.createElement('span'); sp.className = 'kbT'; sp.innerHTML = '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> conduire · <kbd>Espace</kbd> frein à main · <kbd>H</kbd> klaxon · <kbd>Maj</kbd> turbo · <kbd>R</kbd> replacer · <kbd>C</kbd> caméra'; hint.appendChild(sp); }
    const tb = $('topBtns'); if (tb && !$('btnHorn')) { const b = document.createElement('button'); b.className = 'iconBtn'; b.id = 'btnHorn'; b.title = 'Klaxon (H)'; b.textContent = '📯'; b.onclick = () => T.horn(); tb.insertBefore(b, tb.firstChild); }
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
    const px = mapBg.mx(taxi.x), pz = mapBg.mz(taxi.z);
    c.save(); c.fillStyle = '#c9a877'; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-px, -pz);
    c.drawImage(mapBg, 0, 0);
    const dot = (x, z, r, col, stroke) => { c.beginPath(); c.arc(mapBg.mx(x), mapBg.mz(z), r / k, 0, 6.3); c.fillStyle = col; c.fill(); if (stroke) { c.lineWidth = 2 / k; c.strokeStyle = stroke; c.stroke(); } };
    if (job.st === 'free' || job.st === 'board') for (const s of STOPS) if (s.client) dot(s.zx, s.zz, 7, '#22c55e', '#fff');
    if (job.dest) { const t = A.menuTime(); dot(job.dest.zx, job.dest.zz, 9 + Math.sin(t * 6) * 2, '#ffd60a', '#111'); }
    for (const q of cars) if (q.police && !q.chase) dot(q.x, q.z, 4, '#3b82f6');
    for (const pc of chasers) dot(pc.car.x, pc.car.z, 6, Math.sin(A.menuTime() * 12) > 0 ? '#ef4444' : '#3b82f6', '#fff');
    c.restore();
    // flèche du joueur (au centre)
    c.save(); c.translate(W / 2, H / 2); c.rotate(Math.PI - taxi.h); c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fillStyle = '#ffd60a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); c.restore();
    // cible hors carte : flèche au bord
    const tgt = targetPoint();
    if (tgt) {
      const dx = (mapBg.mx(tgt[0]) - px) * k, dz = (mapBg.mz(tgt[1]) - pz) * k;
      if (Math.abs(dx) > W / 2 - 10 || Math.abs(dz) > H / 2 - 10) { const a = Math.atan2(dz, dx), r = W / 2 - 14; c.save(); c.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); c.rotate(a); c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, 7); c.lineTo(-6, -7); c.closePath(); c.fillStyle = job.dest ? '#ffd60a' : '#22c55e'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke(); c.restore(); }
    }
  }
  function targetPoint() {
    if (job.dest) return [job.dest.zx, job.dest.zz];
    if (job.st === 'board' && job.client) return [job.client.stop.zx, job.client.stop.zz];
    let best = null, bd = 1e9; for (const s of STOPS) if (s.client) { const d = Math.hypot(s.zx - taxi.x, s.zz - taxi.z); if (d < bd) { bd = d; best = [s.zx, s.zz]; } }
    return best;
  }
  const fmtClock = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function updateHud() {
    $('txCash').textContent = fmtInt(money) + ' MRU';
    $('txSub').textContent = stats.courses + (stats.courses > 1 ? ' courses' : ' course') + (stats.fines ? ' · amendes ' + fmtInt(stats.fines) : '');
    const ck = $('txClock'); ck.textContent = fmtClock(T.timeLeft); ck.classList.toggle('warn', T.timeLeft < 30);
    const tgt = targetPoint(), dist = tgt ? Math.round(manhattan(taxi.x, taxi.z, tgt[0], tgt[1]) / 10) * 10 : 0;
    if (job.st === 'free') { $('txJobT').textContent = 'Cherche un client'; $('txJobV').textContent = '🟢 Arrêt le plus proche'; $('txJobS').textContent = tgt ? dist + ' m · arrête-toi dans le cercle vert' : ''; }
    else if (job.st === 'board') { $('txJobT').textContent = job.client.name; $('txJobV').textContent = 'Le client monte…'; $('txJobS').textContent = 'reste arrêté'; }
    else if (job.st === 'ride') { $('txJobT').textContent = job.client.name + ' · ' + fmtInt(job.fare) + ' MRU'; $('txJobV').textContent = '🟡 ' + job.dest.name; $('txJobS').innerHTML = dist + ' m · <b class="' + (job.t < 10 ? 'late' : '') + '">⏱ ' + fmtClock(job.t) + '</b> · <span class="stars">' + stars(job.stars) + '</span>'; }
    const wv = $('txWanted'); wv.classList.toggle('hidden', !wanted && !chasers.length); $('txStars').textContent = '★'.repeat(Math.max(1, wanted)) + (chasers.length ? ' POURSUITE' : '');
    wv.classList.toggle('chase', chasers.length > 0);
    $('speed').textContent = Math.round(taxi.speed * 3.6); $('gear').textContent = taxi.vF < -0.5 ? 'R' : taxi.gear;
    const rb = $('rpmBar'); if (rb) rb.style.width = (clamp(taxi.rpm, 0, 1) * 100).toFixed(0) + '%';
    const nb = $('nitroBtn'); if (nb) { nb.style.setProperty('--n', clamp(taxi.nitro, 0, 1).toFixed(3)); nb.classList.toggle('on', taxi.nitroOn); nb.classList.toggle('ready', taxi.nitro > 0.5 && !taxi.nitroOn); nb.classList.toggle('empty', taxi.nitro < 0.05); }
    const tn = $('tNitro'); if (tn) tn.style.setProperty('--n', clamp(taxi.nitro, 0, 1).toFixed(3));
    const pn = placeName(taxi.x, taxi.z), st = $('txStreet'); const label = pn.street ? pn.street + ' · ' + pn.district : pn.district; if (st.textContent !== label) st.textContent = label;
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
      arrow.position.set(taxi.x, (taxiModel ? taxiModel.box.max.y : 1.5) + 1.9 + Math.sin(t * 3) * 0.12, taxi.z);
      // trajet par les rues : viser le carrefour suivant si la cible n'est pas sur la même rue
      const [ax, az] = nextAim(taxi.x, taxi.z, tgt[0], tgt[1]);
      const want = Math.atan2(ax - taxi.x, az - taxi.z); arrow.rotation.y = lerp(arrow.rotation.y, arrow.rotation.y + wrapAng(want - arrow.rotation.y), Math.min(1, dt * 6));
      arrow.mat.color.setHex(job.dest ? 0xffd000 : 0x22ff66);
    }
  }

  /* ======================= Construction complète ======================= */
  function build() {
    lib = A.ASSETS.taxi;
    if (!lib) throw new Error('taxi.glb manquant');
    lib.updateMatrixWorld(true);
    const rnd = seeded(20261118);
    buildRoads(); buildBlocks(); buildBuildings(rnd);
    A.instanceLib(inst, { parent: root, cull: CULL, cell: 400, maxD: (det, small) => det ? (LITE ? 340 : 560) : small ? 300 : (LITE ? 620 : 980) });
    buildSignsAndNames(); buildProps(); buildLights();
    buildVehicleTypes();
    const counts = {}; for (const k in VT) counts[k] = k === 'police' ? 3 : k === 'cart' ? 2 : 12;
    buildVehicleMeshes(counts);
    buildPedMeshes(); buildPoliceModels(); buildMarkers(); buildMapBg(); buildHud();
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
      A.loadAsset('taxi', g => {
        T.loading = false;
        if (!g) { $('loading').classList.add('hidden'); A.state = 'menu'; A.showScreen('menu'); A.popup('Impossible de charger la ville des taxis', 'vérifie ta connexion', true); return; }
        try { build(); } catch (e) { console.error('taxi build', e && e.stack || e); $('loading').classList.add('hidden'); A.state = 'menu'; A.showScreen('menu'); return; }
        $('loading').classList.add('hidden'); begin();
      }, f => { $('loadBar').firstElementChild.style.width = (f * 100).toFixed(0) + '%'; });
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
    $('hud').classList.remove('hidden'); $('touch').classList.toggle('hidden', !isTouch);
    for (const id of ['countdown', 'lights', 'wrong']) { const e = $(id); if (e) e.classList.add('hidden'); }
    $('popups').innerHTML = '';
    const dr = DRIVERS[T.driver];
    A.popup('SERVICE COMMENCÉ', dr.name + ' · ' + fmtClock(T.timeLeft) + ' pour gagner un max d’ouguiyas', false, 'gold');
    say(dr.id === 'ba' ? 'Bismillah… Allez, au travail. Les clients attendent aux arrêts verts.' : dr.id === 'moulaye' ? 'Moulaye est dans la place ! Direction les arrêts verts.' : 'C’est parti ! Les clients attendent aux arrêts verts.');
    A.state = 'play';
    rebuildDyn(); updateHud(); cullUpdate();
    if (A.applyAmbience) { /* l'ambiance jour/nuit globale reste celle du menu */ }
  }
  T.exit = () => {
    if (!T.active) return;
    T.active = false; root.visible = false; A.scene.remove(root);
    if (driftWas) A.showDrift(driftWas); driftWas = null;
    if (fogWas) { A.scene.fog.near = fogWas[0]; A.scene.fog.far = fogWas[1]; }
    document.body.classList.remove('taxi'); sirenOn(false);
    for (const pc of chasers.slice()) endChase(pc);
  };
  T.pause = () => { sirenOn(false); A.updateAudio(null, { thr: 0 }, 0, false); };
  T.reset = () => { if (!taxi || A.state !== 'play') return; resetTaxi(); A.popup('TAXI REPLACÉ', '', false, 'blue'); };
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
      '<div class="note" style="margin-top:10px;opacity:.85">🚦 Feux grillés : ' + stats.reds + ' · 🚶 Piétons heurtés : ' + stats.peds + ' · 🚓 Arrestations : ' + stats.arrests + '<br>Meilleur service : ' + fmtInt(Math.max(best, net)) + ' MRU</div>';
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
      if (inp.nitro && taxi.nitro < 0.02) inp.nitro = 0;
      rebuildDyn();
      const SUB = Math.max(2, Math.ceil(dt / 0.011)); let hit = 0;
      for (let s = 0; s < SUB; s++) hit = Math.max(hit, taxiStep(inp, dt / SUB));
      taxi.nitro = Math.min(1, taxi.nitro + dt * 0.01);
      if (hit > 6.5) { stats.crashes++; A.crashSound(hit / 20); loseStar(1, pick(['Doucement ! Tu veux nous tuer ?', 'Aïe ! Fais attention !', 'Wallahi, conduis mieux que ça !'])); if (hit > 9) offence('crash', 150, 1, 60); }
      else if (hit > 3) A.crashSound(hit / 30);
      updateCars(dt); updatePeds(dt); hitPeds(); updatePolice(dt);
      checkRedLight(); jobLogic(dt);
      if (R() < dt * 0.5) spawnClients();
      if (sayT > 0) { sayT -= dt; if (sayT <= 0) { const el = $('txSay'); if (el) el.classList.remove('show'); } }
      updateTaxiVisual(inp, dt);
      A.updateCamera(dt, taxi);
      A.updateAudio(taxi, inp, taxi.screech || 0, true); updateSiren();
      hudAcc += dt; if (hudAcc > 1 / 15) { hudAcc = 0; updateHud(); }
      if (T.timeLeft <= 0) { if (job.st === 'ride' && T.timeLeft > -75) { if (!T.overtime) { T.overtime = true; A.popup('FIN DU SERVICE', 'termine ta dernière course !', false, 'gold'); } } else { T.endAt = T.endAt == null ? 2.2 : T.endAt - dt; if (T.endAt <= 0) endShift(); } }
      T.lastInp = inp;
    } else if (st === 'results') {
      orbit += dt * 0.25; const r = 11; A.camera.position.set(taxi.x + Math.sin(orbit + taxi.h) * r, 3.4, taxi.z + Math.cos(orbit + taxi.h) * r); A.camera.lookAt(taxi.x, 1, taxi.z);
      updateCars(dt * 0.5); updatePeds(dt);
    }
    if (st !== 'pause') { if (Math.floor(lightT * 5) !== lastLightUpd) { lastLightUpd = Math.floor(lightT * 5); updateLights(); } }
    drawCars(); drawPeds(); updateMarkers(dt);
    if ((T.fc = (T.fc || 0) + 1) % 4 === 0) cullUpdate();
    A.sun.position.set(taxi.x + A.SUN_OFF.x, A.SUN_OFF.y, taxi.z + A.SUN_OFF.z); A.sun.target.position.set(taxi.x, 0, taxi.z);
    A.sky.position.set(A.camera.position.x, 0, A.camera.position.z);
    if (lampGlow) lampGlow.visible = !!prof.night;
    A.fx(dt);
    if (TEST && window.__tcam) { const c = window.__tcam; A.camera.position.set(c.p[0], c.p[1], c.p[2]); A.camera.lookAt(c.t[0], c.t[1], c.t[2]); if (c.fov && A.camera.fov !== c.fov) { A.camera.fov = c.fov; A.camera.updateProjectionMatrix(); } }
    if (A.camera.aspect !== window.innerWidth / window.innerHeight) { A.camera.aspect = window.innerWidth / window.innerHeight; A.camera.updateProjectionMatrix(); }
  };
  function hitPeds() { // le taxi renverse un piéton / un animal
    if (taxi.speed < 1.5) return;
    const fx = Math.sin(taxi.h), fz = Math.cos(taxi.h);
    for (const p of peds) {
      if (!p.on || p.fall > 0 || p.st === 'ride' || p.st === 'off' || p.st === 'board') continue;
      if (Math.abs(p.x - taxi.x) > 4 || Math.abs(p.z - taxi.z) > 4) continue;
      const rx = p.x - taxi.x, rz = p.z - taxi.z, f = rx * fx + rz * fz, l = Math.abs(rx * fz - rz * fx);
      if (Math.abs(f) < 2.5 && l < 1.25) {
        p.fall = 3.2; p.road = true; p.x += fx * 1.2 + taxi.vx * 0.05; p.z += fz * 1.2 + taxi.vz * 0.05;
        A.crashSound(0.35); taxi.vx *= 0.8; taxi.vz *= 0.8;
        if (p.kind === 'animal') { A.popup('ATTENTION AUX ANIMAUX !', '', true); loseStar(0.5); }
        else { stats.peds++; loseStar(2, 'Tu as renversé quelqu’un ! Mon Dieu…'); offence('ped', 400, 2, 140); if (p.st === 'wait' && p.stop) { p.stop.client = null; releaseClient(p); } }
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
  if (TEST) T.dbg = { get taxi() { return taxi; }, get cars() { return cars; }, get peds() { return peds; }, job, stats, STOPS, PLACES, get money() { return money; }, light, get chasers() { return chasers; }, get wanted() { return wanted; }, CULL, root, placeTaxi, spawnClients, startChase, VT, get lightT() { return lightT; }, set lightT(v) { lightT = v; }, nx, nz, HW, LANE, HEAD, EL, P };
  return T;
};
