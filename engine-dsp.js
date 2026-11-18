// Moteur sonore v3 : synthèse par « ordres moteur » (harmoniques de l'arbre à cames)
// + enveloppe d'échappement par voiture, grain de combustion, turbo, compresseur, pétarades.
// Aucun résonateur qui « bourdonne », aucun sifflement pur : le son reste rond et propre.
// Ce code tourne dans un AudioWorklet (ou un ScriptProcessor en secours) et sous Node pour les tests.
class EngineDSP {
  constructor(sr) {
    this.sr = sr; this.K = 48;
    this.th = 0; this.rpm = 900; this.rpmT = 900; this.load = 0; this.loadT = 0; this.vol = 0; this.volT = 0;
    this.a = new Float64Array(this.K + 1); this.aT = new Float64Array(this.K + 1); this.da = new Float64Array(this.K + 1);
    this.M = 28; this.b = new Float64Array(this.M + 1); this.bT = new Float64Array(this.M + 1); this.db = new Float64Array(this.M + 1); this.m0 = 99; this.mmax = 0;
    this.am = new Float64Array(this.K + 1); this.cp = new Float64Array(this.K + 1); this.sp = new Float64Array(this.K + 1);
    this.seed = 22222; this.boost = 0; this.bov = 0; this.bovCool = 0; this.prevLoad = 0; this.cut = 0;
    this.lift = 9; this.bovT = 0; this.pop = 0; this.popP = 0; this.popPending = 0; this.t = 0;
    this.gLP = 0; this.gLP0 = 0; this.nLP = 0; this.oLP = 0; this.dc = 0; this.dcx = 0; this.whP = 0; this.scP = 0; this.flP = 0;
    this.wh = this.bq(); this.bovF = this.bq(); this.kmax = 1; this.sub = 0; this.lvl = 0;
    this.setProfile('v8tt');
  }
  bq() { return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 }; }
  setBP(f, freq, q) { const w = 2 * Math.PI * Math.min(freq, this.sr * 0.45) / this.sr, s = Math.sin(w), c = Math.cos(w), al = s / (2 * q), a0 = 1 + al; f.b0 = al / a0; f.b1 = 0; f.b2 = -al / a0; f.a1 = -2 * c / a0; f.a2 = (1 - al) / a0; }
  run(f, x) { const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2; f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y; return y; }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  setProfile(id) {
    const P = EngineDSP.PROFILES[id] || EngineDSP.PROFILES.v8tt; this.P = P; this.id = id;
    // poids de chaque ordre (harmonique de la fréquence d'arbre à cames)
    this.W = new Float64Array(this.K + 1);
    for (let k = 1; k <= this.K; k++) this.W[k] = P.base * Math.pow(0.96, k);
    for (const [k, w] of P.orders) if (k <= this.K) this.W[k] += w;
    // phases fixes : les ordres d'allumage restent alignés (impulsions), le reste est décorrélé
    let s = 777 + id.length * 131; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 1; k <= this.K; k++) { const ph = (k % P.nf === 0) ? 0 : r() * 6.2832; this.cp[k] = Math.cos(ph); this.sp[k] = Math.sin(ph); this.am[k] = 0; }
    this.setBP(this.bovF, P.bovF || 1700, 1.1);
  }
  msg(d) {
    if (d.profile && d.profile !== this.id) { this.setProfile(d.profile); this.vol = 0; }
    if (d.rpm !== undefined) this.rpmT = d.rpm;
    if (d.load !== undefined) this.loadT = d.load;
    if (d.vol !== undefined) this.volT = d.vol;
    if (d.lite !== undefined) this.Kq = d.lite ? 32 : this.K;
    if (d.shift) { this.cut = 0.075; if (this.P.pops > 0.2 && this.rnd() < 0.6) this.popPending = 1; }
  }
  // enveloppe spectrale de l'échappement (formants larges en octaves) + coupure qui s'ouvre avec la charge
  H(f, fcut) {
    const P = this.P; let h = P.floor;
    for (const [F, g, w] of P.form) { const x = Math.log2(f / F) / w; h += g * Math.exp(-0.5 * x * x); }
    const q = f / fcut; h /= 1 + q * q * q * q;
    if (f < 45) h *= (f / 45) * (f / 45);
    return h;
  }
  block(n) {
    const P = this.P, K = this.Kq || this.K, dt = n / this.sr;
    // lissage des commandes
    this.rpm += (this.rpmT - this.rpm) * (1 - Math.exp(-dt / 0.045));
    let lt = this.loadT; if (this.cut > 0) { this.cut -= dt; lt = 0; }
    this.load += (lt - this.load) * (1 - Math.exp(-dt / (lt > this.load ? 0.03 : 0.07)));
    this.vol += (this.volT - this.vol) * (1 - Math.exp(-dt / 0.06));
    const rn = Math.min(1.1, this.rpm / P.red), L = this.load;
    // lever de pied : fenêtre de « glouglou » et de pétarades
    if (L < 0.25 && this.prevLoad >= 0.25) this.lift = 0; else this.lift += dt;
    if (this.loadT > 0.5) this.lift = 9;
    const overrun = this.lift < P.popWin && rn > 0.42 ? 1 - this.lift / P.popWin : 0;
    // turbo : montée en pression lente, soupape de décharge quand on lâche l'accélérateur
    const bt = P.turbo ? Math.max(0, Math.min(1, (rn - 0.22) * 1.7)) * L : 0;
    this.boost += (bt - this.boost) * (1 - Math.exp(-dt / (bt > this.boost ? 0.55 : 0.2)));
    this.bovCool -= dt;
    if (P.bov && this.prevLoad > 0.55 && L < 0.35 && this.boost > 0.35 && this.bovCool <= 0) { this.bov = Math.min(1, this.boost * 1.3); this.bovT = 0; this.bovCool = 1.1; }
    this.prevLoad = L;
    // amplitudes cibles des ordres
    const fc = this.rpm / 120, fcut = P.cut0 + P.cutL * L + P.cutR * rn;
    const amD = P.am * (1 + 0.8 * overrun + 0.6 * (1 - L) * (1 - rn));
    let e2 = 0, km = 1;
    for (let k = 1; k <= K; k++) {
      const f = k * fc;
      if (f > 7000 || f > this.sr * 0.42) { this.aT[k] = 0; if (this.a[k] > 1e-7) km = k; continue; }
      this.am[k] += ((this.rnd() * 2 - 1) - this.am[k]) * 0.18;
      const v = this.W[k] * this.H(f, fcut) * Math.max(0, 1 + amD * this.am[k] * (k <= P.nf ? 1.3 : 0.8));
      this.aT[k] = v; e2 += v * v; km = k;
    }
    // niveau : sonie qui suit la charge et le régime, normalisée (même volume perçu pour toutes les voitures)
    const lvl = (P.idleLvl + (1 - P.idleLvl) * L) * (0.72 + 0.28 * rn) * (1 - 0.25 * overrun);
    // au-delà de l'ordre K : seules les harmoniques de la fréquence d'allumage (le « claquement » des impulsions)
    const nf = P.nf, m0 = Math.floor(K / nf) + 1; let mm = 0;
    if (m0 !== this.m0) { this.b.fill(0); this.m0 = m0; }
    for (let m = m0; m <= this.M; m++) {
      const f = m * nf * fc;
      if (f > 7000 || f > this.sr * 0.42) { this.bT[m] = 0; if (this.b[m] > 1e-7) mm = m; continue; }
      const v = P.tail * Math.pow(0.9, m - 1) * this.H(f, fcut); this.bT[m] = v; e2 += v * v; mm = m;
    }
    this.mmax = mm;
    const sc = e2 > 0 ? lvl * 0.3 / Math.sqrt(e2 * 0.5) : 0;
    for (let k = 1; k <= K; k++) { this.aT[k] *= sc; this.da[k] = (this.aT[k] - this.a[k]) / n; }
    for (let m = m0; m <= this.M; m++) { this.bT[m] *= sc; this.db[m] = (this.bT[m] - this.b[m]) / n; }
    this.kmax = km;
    this.blk = { w: 2 * Math.PI * fc / this.sr, L, rn, overrun, gc: Math.min(0.92, Math.exp(-2 * Math.PI * (P.gritF * (0.6 + 0.6 * L)) / this.sr)), lvl };
    this.setBP(this.wh, 1100 + this.boost * 1900, 0.8);
    // pétarades : rares, sourdes (« bop »), jamais des clics
    if (this.popPending || (overrun > 0 && this.pop < 0.05 && this.rnd() < P.pops * 0.05 * overrun)) {
      this.popPending = 0; this.pop = (0.35 + 0.65 * this.rnd()) * P.popAmp; this.popP = 0;
    }
  }
  fill(out, n) {
    const P = this.P, sr = this.sr, BS = 64;
    for (let i0 = 0; i0 < n; i0 += BS) {
      const m = Math.min(BS, n - i0); this.block(m);
      const { w, L, overrun, gc } = this.blk, a = this.a, da = this.da, cp = this.cp, spp = this.sp, km = this.kmax, nf = P.nf;
      for (let i = i0; i < i0 + m; i++) {
        this.th += w; if (this.th > 6.283185307179586) this.th -= 6.283185307179586;
        const c1 = Math.cos(this.th), s1 = Math.sin(this.th);
        // somme des ordres par récurrence de Tchebychev (2 trig par échantillon seulement)
        let ck2 = 1, sk2 = 0, ck1 = c1, sk1 = s1, cnf = 1, snf = 0;
        a[1] += da[1]; let s = a[1] * (s1 * cp[1] + c1 * spp[1]);
        const c2 = 2 * c1;
        for (let k = 2; k <= km; k++) {
          const ck = c2 * ck1 - ck2, sk = c2 * sk1 - sk2;
          a[k] += da[k]; s += a[k] * (sk * cp[k] + ck * spp[k]);
          if (k === nf) { cnf = ck; snf = sk; }
          ck2 = ck1; ck1 = ck; sk2 = sk1; sk1 = sk;
        }
        if (this.mmax >= this.m0 && km >= nf) {
          const b = this.b, db = this.db, d2 = 2 * cnf; let cm2 = 1, sm2 = 0, cm1 = cnf, sm1 = snf;
          for (let mq = 2; mq <= this.mmax; mq++) {
            const cm = d2 * cm1 - cm2, sm = d2 * sm1 - sm2;
            if (mq >= this.m0) { b[mq] += db[mq]; s += b[mq] * sm; }
            cm2 = cm1; cm1 = cm; sm2 = sm1; sm1 = sm;
          }
        }
        // grain de combustion : bruit filtré qui ne passe qu'au moment des explosions
        const pe = 0.5 + 0.5 * cnf, env = pe * pe * pe * pe;
        this.gLP0 = gc * this.gLP0 + (1 - gc) * (this.rnd() * 2 - 1); this.gLP = gc * this.gLP + (1 - gc) * this.gLP0;
        s += this.gLP * env * P.grit * 1.6 * this.blk.lvl * (0.5 + L + 0.8 * overrun);
        // turbo : souffle d'air (pas de sifflet strident)
        if (P.turbo && this.boost > 0.01) {
          s += this.run(this.wh, this.rnd() * 2 - 1) * this.boost * 0.05 * P.turbo;
          this.whP += (2600 + this.boost * 3000) / sr; if (this.whP > 1) this.whP -= 1;
          s += Math.sin(this.whP * 6.2832) * this.boost * 0.0035 * P.turbo;
        }
        // compresseur volumétrique (Hellcat) : chant discret qui suit le régime
        if (P.sc) {
          this.scP += this.rpm / 60 * P.scRatio / sr; if (this.scP > 1) this.scP -= 1;
          const x = this.scP * 6.2832; s += (Math.sin(x) + 0.25 * Math.sin(2 * x)) * this.blk.rn * (0.2 + 0.8 * L) * 0.022 * P.sc;
        }
        // soupape de décharge « pschhh » (et flutter « tu-tu-tu » pour la S15)
        if (this.bov > 0.002) {
          this.bovT += 1 / sr; let e = this.bov * Math.min(1, this.bovT / 0.008) * Math.exp(-this.bovT / 0.17);
          if (P.flutter) { this.flP += 21 / sr; e *= 0.5 + 0.5 * Math.cos(this.flP * 6.2832); }
          s += this.run(this.bovF, this.rnd() * 2 - 1) * e * 0.16 * P.bov;
          if (this.bovT > 0.9) this.bov = 0;
        }
        // pétarade : coup sourd + souffle étouffé
        if (this.pop > 0.003) {
          this.popP += 1 / sr; const e = this.pop * Math.min(1, this.popP / 0.0025) * Math.exp(-this.popP / 0.028);
          this.nLP += ((this.rnd() * 2 - 1) - this.nLP) * 0.12;
          s += (this.nLP * 0.9 + Math.sin(this.popP * 2 * Math.PI * 95) * 0.6) * e * 0.35;
          if (this.popP > 0.2) this.pop = 0;
        }
        // saturation très douce, coupe-bas, adoucissement final
        const x = s * P.drive; s = x * (27 + x * x) / (27 + 9 * x * x); if (s > 1) s = 1; else if (s < -1) s = -1;
        const y = s - this.dcx + 0.996 * this.dc; this.dcx = s; this.dc = y;
        this.oLP += (y - this.oLP) * 0.55;
        out[i] = this.oLP * this.vol * P.gain;
      }
    }
  }
}
EngineDSP.PROFILES = (() => {
  const base = { tail: 0.4, floor: 0.04, am: 0.2, grit: 0.05, gritF: 1800, idleLvl: 0.42, drive: 1.15, popWin: 1.3, pops: 0, popAmp: 0.6, turbo: 0, bov: 0, sc: 0, gain: 1 };
  const P = o => Object.assign({}, base, o);
  return {
    // Audi RS Q8 : V8 4.0 biturbo, grondement feutré et luxueux, souffle des turbos
    v8tt: P({ nf: 8, idle: 750, red: 6800, base: 0.08, orders: [[8, 1], [4, 0.5], [12, 0.32], [16, 0.42], [2, 0.12], [24, 0.18], [20, 0.12]],
      form: [[150, 1, 0.95], [520, 0.75, 0.7], [1400, 0.22, 0.6]], cut0: 700, cutL: 1700, cutR: 1500, am: 0.2, grit: 0.045, turbo: 0.7, bov: 0.35, pops: 0.25, popAmp: 0.5, gain: 1 }),
    // Nissan Silvia S15 : 4 cylindres 2.0 turbo, rageur et rauque, soupape « pschhh tu-tu-tu »
    i4t: P({ nf: 4, idle: 900, red: 8000, base: 0.07, orders: [[4, 1], [8, 0.7], [12, 0.42], [16, 0.26], [2, 0.2], [20, 0.15], [6, 0.12]],
      form: [[190, 0.8, 0.8], [660, 1, 0.6], [1650, 0.5, 0.5]], cut0: 1000, cutL: 2600, cutR: 2200, am: 0.18, grit: 0.08, gritF: 2600, turbo: 1, bov: 1, flutter: 1, bovF: 1900, pops: 0.45, popAmp: 0.65, gain: 0.95 }),
    // Dodge Challenger Hellcat : V8 6.2 Hemi à compresseur, gros « glouglou » américain irrégulier
    v8sc: P({ nf: 8, idle: 700, red: 6200, base: 0.1, orders: [[8, 1], [4, 0.9], [2, 0.36], [6, 0.3], [12, 0.36], [16, 0.3], [1, 0.18], [10, 0.15], [3, 0.12]],
      form: [[115, 1, 1.0], [400, 0.8, 0.7], [1100, 0.3, 0.6]], cut0: 600, cutL: 2000, cutR: 1400, am: 0.32, grit: 0.06, sc: 1, scRatio: 7.2, pops: 0.5, popAmp: 0.75, idleLvl: 0.48, gain: 1.05 }),
    // Dodge Viper SRT-10 : V10 8.4 à allumage irrégulier, timbre rauque unique
    v10: P({ nf: 10, idle: 800, red: 6200, base: 0.12, orders: [[10, 1], [5, 0.85], [15, 0.5], [20, 0.45], [1, 0.22], [3, 0.18], [7, 0.18], [30, 0.15]],
      form: [[135, 0.9, 0.9], [720, 0.95, 0.5], [1800, 0.35, 0.5]], cut0: 800, cutL: 2300, cutR: 1800, am: 0.25, grit: 0.075, gritF: 2200, pops: 0.35, popAmp: 0.6, gain: 1 }),
    // Supercar 458 : V8 à vilebrequin plat, monte haut et crie jusqu'à 9000 tr/min
    v8fp: P({ nf: 8, idle: 1000, red: 9000, base: 0.05, orders: [[8, 1], [16, 0.85], [24, 0.45], [32, 0.3], [4, 0.12], [40, 0.15]],
      form: [[300, 0.6, 0.9], [1100, 1, 0.6], [2600, 0.55, 0.5]], cut0: 1500, cutL: 3500, cutR: 4000, am: 0.12, grit: 0.05, gritF: 3400, pops: 0.3, popAmp: 0.55, gain: 0.9 }),
    // Specter GT3 : son de W16 quadri-turbo façon Bugatti — profond, plein, très lisse, gros souffle
    w16: P({ nf: 16, idle: 850, red: 6700, base: 0.05, orders: [[16, 1], [8, 0.55], [32, 0.5], [4, 0.25], [24, 0.3], [12, 0.2], [48, 0.2]],
      form: [[120, 1, 1.0], [420, 0.75, 0.8], [1000, 0.35, 0.7]], cut0: 700, cutL: 1700, cutR: 1500, am: 0.1, grit: 0.035, turbo: 1, bov: 0.6, bovF: 1500, pops: 0.12, popAmp: 0.4, idleLvl: 0.45, gain: 1.05 }),
  };
})();
if (typeof registerProcessor === 'function') {
  registerProcessor('dz-engine', class extends AudioWorkletProcessor {
    constructor() { super(); this.d = new EngineDSP(sampleRate); this.port.onmessage = e => this.d.msg(e.data); }
    process(inputs, outputs) { const o = outputs[0][0]; if (o) this.d.fill(o, o.length); return true; }
  });
}
if (typeof module !== 'undefined') module.exports = EngineDSP;
