// Moteur sonore : chaque cylindre « explose » dans un échappement résonant (pas d'oscillateur buzzy)
// Ce code tourne dans un AudioWorklet (ou un ScriptProcessor en secours).
class EngineDSP {
  constructor(sr) {
    this.sr = sr; this.ph = 0; this.next = 0; this.rpm = 900; this.rpmT = 900; this.load = 0; this.loadT = 0; this.vol = 0; this.volT = 0;
    this.boost = 0; this.bov = 0; this.cut = 0; this.seed = 12345; this.t = 0; this.whP = 0; this.scP = 0; this.subP = 0;
    this.bank = [0, 1].map(() => ({ pos: 1e9, len: 1, amp: 0, r1: this.bq(), r2: this.bq(), lp: 0 }));
    this.muf = [this.bq(), this.bq()]; this.dc = 0; this.dcx = 0; this.rasp = this.bq(); this.bovF = this.bq(); this.pop = 0;
    this.setProfile('v8tt');
  }
  bq() { return { b0: 0, b1: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 }; }
  setBP(f, freq, q) { const w = 2 * Math.PI * Math.min(freq, this.sr * 0.45) / this.sr, s = Math.sin(w), c = Math.cos(w), al = s / (2 * q), a0 = 1 + al; f.b0 = al / a0; f.b1 = 0; f.b2 = -al / a0; f.a1 = -2 * c / a0; f.a2 = (1 - al) / a0; }
  setLP(f, freq, q) { const w = 2 * Math.PI * Math.min(freq, this.sr * 0.45) / this.sr, s = Math.sin(w), c = Math.cos(w), al = s / (2 * q), a0 = 1 + al; f.b0 = (1 - c) / 2 / a0; f.b1 = (1 - c) / a0; f.b2 = (1 - c) / 2 / a0; f.a1 = -2 * c / a0; f.a2 = (1 - al) / a0; }
  run(f, x) { const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2; f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y; return y; }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  setProfile(id) {
    const P = EngineDSP.PROFILES[id] || EngineDSP.PROFILES.v8tt; this.P = P; this.id = id;
    this.ang = P.ang; this.banks = P.banks; this.next = 0; this.ph = 0;
    for (let b = 0; b < 2; b++) { this.setBP(this.bank[b].r1, P.f1 * (b ? 1.06 : 1), P.q1); this.setBP(this.bank[b].r2, P.f2 * (b ? 0.95 : 1), P.q2); }
    this.setBP(this.rasp, P.raspF || 2600, 1.2); this.setBP(this.bovF, 2300, 1.6);
  }
  msg(d) {
    if (d.profile && d.profile !== this.id) this.setProfile(d.profile);
    if (d.rpm !== undefined) this.rpmT = d.rpm;
    if (d.load !== undefined) { if (this.loadT > 0.5 && d.load < 0.3 && this.boost > 0.45 && this.P.turbo) this.bov = 1; this.loadT = d.load; }
    if (d.vol !== undefined) this.volT = d.vol;
    if (d.shift) { this.cut = 0.09; if (this.P.crackle) this.pop = 3; }
  }
  fill(out, n) {
    const P = this.P, sr = this.sr, ang = this.ang, banks = this.banks, nc = ang.length;
    // filtres d'échappement : plus ouverts à haut régime et sous charge
    const mfc = P.mufBase + P.mufLoad * this.load + P.mufRpm * (this.rpm / P.red);
    this.setLP(this.muf[0], mfc, 0.8); this.setLP(this.muf[1], mfc * 1.5, 0.65);
    for (let i = 0; i < n; i++) {
      this.rpm += (this.rpmT - this.rpm) * 0.0009;
      let lt = this.loadT; if (this.cut > 0) { this.cut -= 1 / sr; lt = 0; }
      this.load += (lt - this.load) * 0.0025;
      this.vol += (this.volT - this.vol) * 0.002;
      this.boost += ((P.turbo ? Math.max(0, (this.rpm / P.red - 0.25)) * this.load * 1.4 : 0) - this.boost) * (this.boost < 0.01 ? 0.0004 : 0.00012);
      const degPerS = this.rpm * 6; // 360° × rpm / 60
      const prev = this.ph; this.ph += degPerS / sr;
      if (this.ph >= 720) this.ph -= 720;
      // explosions des cylindres
      for (let g = 0; g < 2; g++) {
        const a = ang[this.next];
        const crossed = prev <= this.ph ? (a > prev && a <= this.ph) : (a > prev || a <= this.ph);
        if (!crossed) break;
        const bk = this.bank[banks[this.next] & 1];
        const interval = 720 / nc * (P.banksN || 2) / degPerS; // secondes entre deux tirs d'un même banc
        bk.len = Math.max(0.0006, Math.min(0.006, interval * P.pw)) * sr; bk.pos = 0;
        let amp = (P.idleAmp + (1 - P.idleAmp) * this.load) * (1 + P.jit * (this.rnd() - 0.5) * 2);
        if (this.load < 0.15 && this.rpm > P.red * 0.45 && this.rnd() < P.crackle * 0.25) amp *= 2.6 + this.rnd() * 2; // pétarades au lever de pied
        if (this.pop > 0) { amp *= 2.4; this.pop--; }
        bk.amp = amp;
        this.next = (this.next + 1) % nc;
      }
      let s = 0;
      for (let b = 0; b < 2; b++) {
        const bk = this.bank[b];
        let e = 0;
        if (bk.pos < bk.len) { const x = bk.pos / bk.len; e = Math.sin(Math.PI * x) * (1 - x * 0.4) * bk.amp; e *= 1 + P.rough * (this.rnd() - 0.5); bk.pos++; }
        bk.lp += (e - bk.lp) * 0.35;
        s += bk.lp * P.g0 + this.run(bk.r1, e) * P.g1 + this.run(bk.r2, e) * P.g2;
      }
      { const s1 = this.run(this.muf[0], s); s = s1 * 0.3 + this.run(this.muf[1], s1) * 0.7; }
      // admission / mécanique : souffle modulé par les explosions
      const env = this.bank[0].pos < this.bank[0].len || this.bank[1].pos < this.bank[1].len ? 1 : 0.35;
      s += this.run(this.rasp, this.rnd() * 2 - 1) * P.rasp * (0.3 + this.load) * env * (this.rpm / P.red);
      // sous-grave (W16 / V8) : poids du moteur
      if (P.sub) { this.subP += this.rpm / 60 * (nc / 2) * 0.5 / sr; if (this.subP > 1) this.subP -= 1; s += Math.sin(this.subP * 6.2832) * P.sub * (0.4 + 0.6 * this.load); }
      // turbo qui siffle, compresseur qui hurle, soupape de décharge
      if (P.turbo) { this.whP += (1100 + this.boost * 2900) / sr; if (this.whP > 1) this.whP -= 1; s += Math.sin(this.whP * 6.2832) * this.boost * 0.022 * P.turbo; }
      if (P.sc) { this.scP += this.rpm / 60 * 9.5 / sr; if (this.scP > 1) this.scP -= 1; s += Math.sin(this.scP * 6.2832) * (this.rpm / P.red) * (0.25 + 0.75 * this.load) * 0.035 * P.sc; }
      if (this.bov > 0.001) { s += this.run(this.bovF, this.rnd() * 2 - 1) * this.bov * 0.55; this.bov *= 0.99985; if (this.bov < 0.02) this.bov = 0; }
      // saturation douce + coupe-bas
      s = Math.tanh(s * P.drive) / Math.tanh(P.drive);
      const y = s - this.dcx + 0.995 * this.dc; this.dcx = s; this.dc = y;
      out[i] = y * this.vol * P.gain;
    }
  }
}
EngineDSP.PROFILES = (() => {
  const even = (n, step) => Array.from({ length: n }, (_, k) => k * step);
  const cum = arr => { let a = 0; return arr.map(v => { const r = a; a += v; return r; }); };
  return {
    // Audi RS Q8 : V8 biturbo, grondement feutré
    v8tt: { ang: even(8, 90), banks: [0, 1, 0, 0, 1, 0, 1, 1], idle: 750, red: 6800, f1: 92, f2: 410, q1: 5, q2: 3, g0: 0.5, g1: 1.6, g2: 0.7, mufBase: 380, mufLoad: 1300, mufRpm: 1300, drive: 1.7, pw: 0.5, jit: 0.12, rough: 0.15, idleAmp: 0.35, crackle: 0.15, turbo: 0.6, rasp: 0.02, sub: 0.08, gain: 0.9 },
    // Nissan Silvia S15 : 4 cylindres turbo, rageur, sifflement + soupape
    i4t: { ang: even(4, 180), banks: [0, 0, 0, 0], banksN: 1, idle: 900, red: 8200, f1: 125, f2: 690, q1: 4, q2: 3, g0: 0.6, g1: 1.3, g2: 1.0, mufBase: 900, mufLoad: 2600, mufRpm: 2400, drive: 2.2, pw: 0.42, jit: 0.1, rough: 0.3, idleAmp: 0.3, crackle: 0.3, turbo: 1, rasp: 0.035, raspF: 3200, gain: 0.85 },
    // Dodge Hellcat : V8 à vilebrequin croisé, gros glouglou + compresseur
    v8sc: { ang: even(8, 90), banks: [0, 1, 0, 0, 1, 0, 1, 1], idle: 700, red: 6500, f1: 80, f2: 360, q1: 6, q2: 3, g0: 0.6, g1: 1.9, g2: 0.8, mufBase: 520, mufLoad: 1900, mufRpm: 1600, drive: 2.4, pw: 0.52, jit: 0.2, rough: 0.22, idleAmp: 0.4, crackle: 0.4, sc: 1, rasp: 0.02, sub: 0.1, gain: 0.95 },
    // Dodge Viper : V10 à allumage irrégulier
    v10: { ang: cum([54, 90, 54, 90, 54, 90, 54, 90, 54, 90]), banks: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1], idle: 850, red: 6200, f1: 88, f2: 470, q1: 5, q2: 3, g0: 0.55, g1: 1.7, g2: 0.8, mufBase: 600, mufLoad: 2100, mufRpm: 1900, drive: 2.1, pw: 0.48, jit: 0.14, rough: 0.2, idleAmp: 0.35, crackle: 0.3, rasp: 0.025, sub: 0.06, gain: 0.9 },
    // Supercar 458 : V8 à vilebrequin plat, cri aigu jusqu'à 9000 tr/min
    v8fp: { ang: even(8, 90), banks: [0, 1, 0, 1, 0, 1, 0, 1], idle: 1000, red: 9000, f1: 145, f2: 860, q1: 4, q2: 3.5, g0: 0.45, g1: 1.2, g2: 1.3, mufBase: 1200, mufLoad: 3600, mufRpm: 3400, drive: 1.9, pw: 0.4, jit: 0.07, rough: 0.12, idleAmp: 0.3, crackle: 0.22, rasp: 0.03, raspF: 3800, gain: 0.85 },
    // Specter GT3 : son de W16 quadri-turbo façon Bugatti — profond, plein, très lisse
    w16: { ang: even(16, 45), banks: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], banksN: 2, idle: 900, red: 6800, f1: 68, f2: 290, q1: 6, q2: 3, g0: 0.5, g1: 1.8, g2: 0.6, mufBase: 420, mufLoad: 1500, mufRpm: 1500, drive: 1.5, pw: 0.5, jit: 0.05, rough: 0.1, idleAmp: 0.32, crackle: 0.12, turbo: 1.3, rasp: 0.015, sub: 0.18, gain: 0.95 },
  };
})();
if (typeof registerProcessor === 'function') {
  registerProcessor('dz-engine', class extends AudioWorkletProcessor {
    constructor() { super(); this.d = new EngineDSP(sampleRate); this.port.onmessage = e => this.d.msg(e.data); }
    process(inputs, outputs) { const o = outputs[0][0]; if (o) this.d.fill(o, o.length); return true; }
  });
}
if (typeof module !== 'undefined') module.exports = EngineDSP;
