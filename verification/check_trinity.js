/* trinity.js の数値を、ブラウザを起こさずに検査する。
 *
 *   node verification/check_trinity.js
 *
 * 依存パッケージなし。二段構えで確かめる。
 *
 *   1. 記録した NumPy の値との突き合わせ（trinity_fixtures.json）
 *      固有値と特異値は、自分で書いた実装が正しいかどうかを自分では判定できない。
 *      外の実装が出した値を記録しておき、それと合うかどうかで見る。
 *   2. 手で確かめられる性質
 *      論文の数値、解析的に分かる固有値、Ax = b の残差、不動点の定義そのもの。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const T = require(path.resolve(__dirname, '..', 'trinity.js'));

let pass = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { pass++; return; }
  failures.push(label + (detail ? '\n      ' + detail : ''));
}
function near(label, got, want, tol) {
  const t = tol === undefined ? 1e-9 : tol;
  const d = Math.abs(got - want) / Math.max(1, Math.abs(want));
  ok(label, d <= t, '期待 ' + want + ' / 実際 ' + got + '（相対差 ' + d.toExponential(2) + '）');
}
function section(name) { console.log('\n' + name); }

/* ------------------------------------------------ 1. NumPy との突き合わせ */
section('1. NumPy が出した値との突き合わせ');

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'trinity_fixtures.json'), 'utf8'));
const byKind = {};
let worstRho = 0, worstNorm = 0;

fx.cases.forEach((c) => {
  const A = [];
  for (let i = 0; i < c.n; i++) A.push(c.A.slice(i * c.n, (i + 1) * c.n));
  const rho = T.spectralRadius(A);
  const nrm = T.spectralNorm(A);
  const er = Math.abs(rho - c.rho) / Math.max(1, c.rho);
  const en = Math.abs(nrm - c.norm) / Math.max(1, c.norm);
  worstRho = Math.max(worstRho, er);
  worstNorm = Math.max(worstNorm, en);
  const b = byKind[c.kind] || (byKind[c.kind] = { n: 0, bad: 0 });
  b.n++;
  if (er > 1e-9 || en > 1e-9) b.bad++;
});

Object.keys(byKind).sort().forEach((k) => {
  const b = byKind[k];
  ok('ρ と ‖A‖₂ が NumPy と一致する — ' + k + '（' + b.n + ' 件）', b.bad === 0,
     b.bad + ' 件が 1e-9 を超えて食い違った');
});
ok('ρ の最大相対差が 1e-9 未満', worstRho < 1e-9, worstRho.toExponential(3));
ok('‖A‖₂ の最大相対差が 1e-9 未満', worstNorm < 1e-9, worstNorm.toExponential(3));
console.log('  ' + fx.cases.length + ' 件を ' + fx.generated_by + ' の値と照合。'
  + '最大相対差 ρ ' + worstRho.toExponential(2) + '  ‖A‖₂ ' + worstNorm.toExponential(2));

/* --------------------------------------------- 2. 手で確かめられる固有値 */
section('2. 解析的に分かる値');

near('単位行列の ρ は 1', T.spectralRadius(T.identity(5)), 1);
near('零行列の ρ は 0', T.spectralRadius(T.zeros(4, 4)), 0);
near('回転行列 [[0,1],[-1,0]] の ρ は 1（固有値は ±i）',
     T.spectralRadius([[0, 1], [-1, 0]]), 1);
near('対角行列の ρ は成分の絶対値の最大',
     T.spectralRadius([[-3, 0, 0], [0, 2, 0], [0, 0, 0.5]]), 3);
near('三角行列の ρ は対角の絶対値の最大（非対角は効かない）',
     T.spectralRadius([[0.5, 1000], [0, 0.25]]), 0.5);
near('巡回置換 × c の ρ は c', T.spectralRadius([
  [0, 0, 0.7], [0.7, 0, 0], [0, 0.7, 0]]), 0.7);

/* 固有値が複素の対になることを、実際に取り出して見る。 */
const rot = T.eigenvalues([[0, 1], [-1, 0]]);
ok('回転行列の固有値は純虚数の対',
   rot.length === 2 &&
   rot.every((z) => Math.abs(z[0]) < 1e-12 && Math.abs(Math.abs(z[1]) - 1) < 1e-12) &&
   Math.abs(rot[0][1] + rot[1][1]) < 1e-12,
   JSON.stringify(rot));

/* 固有値の和はトレース、積は行列式。実装と独立に確かめられる。 */
(function () {
  const A = [[1, 2, 3], [4, 5, 6], [7, 8, 10]];
  const ev = T.eigenvalues(A);
  const sum = ev.reduce((s, z) => s + z[0], 0);
  near('固有値の和がトレースに等しい', sum, 1 + 5 + 10, 1e-10);
  let re = 1, im = 0;
  ev.forEach((z) => { const r = re * z[0] - im * z[1]; im = re * z[1] + im * z[0]; re = r; });
  near('固有値の積が行列式に等しい', re, -3, 1e-9);
  ok('固有値の積の虚部が 0', Math.abs(im) < 1e-9, String(im));
})();

near('‖A‖₂ は対称行列では固有値の絶対値の最大に一致する',
     T.spectralNorm([[2, 1], [1, 2]]), 3);
near('直交行列の ‖A‖₂ は 1', T.spectralNorm([[0, 1], [1, 0]]), 1);

/* ρ ≤ ‖A‖₂ は常に成り立つ。乱数で当たってみる（種は固定）。 */
(function () {
  let seed = 20260906;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1; };
  let bad = 0, gap = 0;
  for (let t = 0; t < 400; t++) {
    const n = 2 + (t % 6);
    const A = [];
    for (let i = 0; i < n; i++) { A.push([]); for (let j = 0; j < n; j++) A[i].push(rnd() * 10); }
    const r = T.spectralRadius(A), s = T.spectralNorm(A);
    if (r > s * (1 + 1e-9)) bad++;
    gap = Math.max(gap, s - r);
  }
  ok('ρ(A) ≤ ‖A‖₂ が 400 個すべてで成り立つ', bad === 0, bad + ' 件で破れた');
  ok('その 400 個には ρ < ‖A‖₂ の例が実際に含まれる', gap > 1e-6, '差の最大 ' + gap);
})();

/* ------------------------------------------------------- 3. 連立一次方程式 */
section('3. 連立一次方程式');

(function () {
  const M = [[4, -2, 1], [-2, 4, -2], [1, -2, 4]];
  const b = [11, -16, 17];
  const x = T.solve(M, b);
  const r = T.matvec(M, x).map((v, i) => v - b[i]);
  ok('解の残差 ‖Mx − b‖∞ が 1e-12 未満',
     Math.max.apply(null, r.map(Math.abs)) < 1e-12, JSON.stringify(r));
  ok('特異な行列では解を返さない', T.solve([[1, 2], [2, 4]], [1, 2]) === null);

  /* 先頭のピボットが 0 の系。部分ピボットを外すと、ここで 0 除算になる。 */
  const z = T.solve([[0, 1], [1, 0]], [1, 2]);
  ok('先頭のピボットが 0 でも解ける',
     z !== null && Math.abs(z[0] - 2) < 1e-14 && Math.abs(z[1] - 1) < 1e-14,
     JSON.stringify(z));

  /* ピボットが極端に小さい系。選び直さないと桁が落ちる。 */
  const t = T.solve([[1e-14, 1], [1, 1]], [1, 2]);
  ok('ピボットが 1e-14 でも桁が落ちない',
     t !== null && Math.abs(t[0] - 1) < 1e-6 && Math.abs(t[1] - 1) < 1e-6,
     JSON.stringify(t));
})();

/* --------------------------------------------------------- 4. 論文の数値 */
section('4. 論文の数値');

(function () {
  const r1 = T.analyze(T.PRESETS.s1);
  const want1 = [0.510204, 0.306122, 0.183673];
  ok('Series I の不動点が論文と一致する',
     r1.fixedPoint.every((v, i) => Math.abs(v - want1[i]) < 5e-7),
     JSON.stringify(r1.fixedPoint.map((v) => +v.toFixed(6))));
  near('Series I の ρ は 0.6', r1.rho, 0.6);
  ok('Series I は正規行列（ρ = ‖A‖₂）',
     r1.isNormal && Math.abs(r1.rho - r1.norm) < 1e-12);

  const r2 = T.analyze(T.PRESETS.s2);
  const want2 = [0.754190, 0.527933, 0.508380];
  ok('Series II の不動点が論文と一致する',
     r2.fixedPoint.every((v, i) => Math.abs(v - want2[i]) < 5e-7),
     JSON.stringify(r2.fixedPoint.map((v) => +v.toFixed(6))));
  near('Series II の ρ は 0.471769', r2.rho, 0.471769, 1e-6);
  near('Series II の ‖A‖₂ は 0.7', r2.norm, 0.7);
  ok('Series II では既に ρ < ‖A‖₂ に離れている', r2.norm - r2.rho > 0.2);
  ok('Series II は正規行列ではない', !r2.isNormal);
})();

/* ------------------------------------------- 5. 不動点の定義そのもので確かめる */
section('5. 不動点と収束');

(function () {
  Object.keys(T.PRESETS).forEach((key) => {
    const s = T.PRESETS[key];
    const r = T.analyze(s);
    if (!r.fixedPoint) {
      ok('「' + s.label + '」は ρ ≥ 1 なので不動点を返さない', r.rho >= 1 - 1e-12,
         'ρ = ' + r.rho);
      return;
    }
    /* x* が本当に動かない点かどうかは、一度作用させれば分かる。 */
    const y = T.matvec(r.A, r.fixedPoint).map((v, i) => v + r.b[i]);
    const d = Math.max.apply(null, y.map((v, i) => Math.abs(v - r.fixedPoint[i])));
    ok('「' + s.label + '」の x* は作用させても動かない', d < 1e-10, '差 ' + d);
  });
})();

(function () {
  /* 反例 —— 論文の条件を破るが収束する。誤差はいったん増える。 */
  const s = T.PRESETS.counter, r = T.analyze(s);
  near('反例の ρ は 0.5', r.rho, 0.5);
  ok('反例は論文の条件 ‖A‖₂ < 1 を破る', r.norm > 20, String(r.norm));
  ok('反例は収束すると判定される', r.converges);
  ok('反例は単調減衰しないと判定される', !r.monotone);

  const rows = T.iterate(r, s.x0, 200);
  const errs = rows.map((x) => x.err);
  ok('反例の誤差は初期値より大きくなる時点がある',
     Math.max.apply(null, errs) > errs[0] * 10,
     '初期 ' + errs[0].toFixed(3) + ' / 最大 ' + Math.max.apply(null, errs).toFixed(3));
  ok('それでも最後は 1e-6 未満まで落ちる', errs[errs.length - 1] < 1e-6,
     String(errs[errs.length - 1]));
  ok('過渡的増幅 maxₖ‖Aᵏ‖₂ が 1 を超える', r.transientGrowth > 1,
     String(r.transientGrowth));
})();

(function () {
  /* 境界。a を 1 の前後で動かすと判定が切り替わる。‖A‖₂ はどちら側でも 1 超。 */
  const mk = (a) => T.analyze({ n: 2, Q: [[1, 30], [0, 1]], a: [a, a], p: [1, 0] });
  const lo = mk(0.99), mid = mk(1.0), hi = mk(1.01);
  ok('a = 0.99 では収束すると判定する', lo.converges, 'ρ = ' + lo.rho);
  ok('a = 1.01 では収束しないと判定する', !hi.converges, 'ρ = ' + hi.rho);
  ok('a = 1.00 は境界（ρ = 1）', Math.abs(mid.rho - 1) < 1e-12, 'ρ = ' + mid.rho);
  ok('‖A‖₂ は三つとも 1 を超えていて、判定には使えない',
     lo.norm > 1 && mid.norm > 1 && hi.norm > 1,
     [lo.norm, mid.norm, hi.norm].join(', '));
})();

(function () {
  /* 等長でも置換でもない Q。必要なのは ρ < 1 だけ。 */
  const r = T.analyze(T.PRESETS.singular);
  ok('階数 1 の Q でも収束すると判定する', r.converges, 'ρ = ' + r.rho);
  ok('その Q は逆行列を持たない（solve が null を返す）',
     T.solve([[1, 1, 1], [1, 1, 1], [1, 1, 1]], [1, 0, 0]) === null);
})();

/* ------------------------------------------------------------ 6. 壊れ方 */
section('6. 壊れ方');

ok('大きさ 1 の行列も扱える',
   Math.abs(T.spectralRadius([[0.42]]) - 0.42) < 1e-15);
ok('巡回置換は各行各列にちょうど一つ 1 が立つ',
   (function () {
     const Q = T.cyclicShift(5);
     return Q.every((r) => r.filter((v) => v === 1).length === 1) &&
       T.transpose(Q).every((r) => r.filter((v) => v === 1).length === 1);
   })());
ok('a = 0 なら A は零行列で、x* は p そのもの',
   (function () {
     const r = T.analyze({ n: 3, Q: T.cyclicShift(3), a: [0, 0, 0], p: [1, 2, 3] });
     return r.rho === 0 && r.fixedPoint.every((v, i) => Math.abs(v - [1, 2, 3][i]) < 1e-14);
   })());

section('7. 縮小になる距離の証書');

/* trinity-operator の certificate.py（NumPy）が出した値と突き合わせる。
   κ も P も、自分で書いた実装が正しいかを自分では判定できない。 */
const cfx = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'certificate_fixtures.json'), 'utf8'));
let worstKappa = 0, worstAmp = 0, worstP = 0, badResid = 0, badAch = 0, badMono = 0;

cfx.cases.forEach((c) => {
  const A = [];
  for (let i = 0; i < c.n; i++) A.push(c.A.slice(i * c.n, (i + 1) * c.n));
  const cert = T.certificate(A, c.gamma);
  if (!cert) { badResid++; return; }

  worstKappa = Math.max(worstKappa,
    Math.abs(cert.kappa - c.kappa) / Math.max(1, Math.abs(c.kappa)));
  worstAmp = Math.max(worstAmp,
    Math.abs(cert.amplification - c.amplification) / Math.max(1, c.amplification));
  for (let i = 0; i < c.n; i++) for (let j = 0; j < c.n; j++) {
    worstP = Math.max(worstP,
      Math.abs(cert.P[i][j] - c.P[i * c.n + j]) / Math.max(1, Math.abs(c.P[i * c.n + j])));
  }

  /* κ は上界ではなく ‖A‖_P そのもの。定義から取り直して一致するか。 */
  const ach = T.certAchieved(cert);
  if (ach === null || Math.abs(ach - cert.kappa) > 1e-8 * Math.max(1, cert.kappa)) badAch++;

  /* P が方程式の解になっているか（P の大きさで割った相対残差）。 */
  let pmax = 0;
  for (let i = 0; i < c.n; i++) for (let j = 0; j < c.n; j++) pmax = Math.max(pmax, Math.abs(cert.P[i][j]));
  if (cert.residual / Math.max(1, pmax) > 1e-10) badResid++;

  /* ρ ≤ κ < γ < 1。これが崩れたら証書の意味がない。 */
  if (!(cert.rho <= cert.kappa + 1e-12 && cert.kappa < cert.gamma && cert.gamma < 1)) badMono++;
});

ok('κ が NumPy と一致する（' + cfx.cases.length + ' 件）', worstKappa < 1e-9,
   '最大相対差 ' + worstKappa.toExponential(3));
ok('係数 √(λmax/λmin) が NumPy と一致する', worstAmp < 1e-7,
   '最大相対差 ' + worstAmp.toExponential(3));
ok('P そのものが NumPy と一致する', worstP < 1e-8,
   '最大相対差 ' + worstP.toExponential(3));
ok('P が方程式 P − BᵀPB = I を満たす', badResid === 0, badResid + ' 件で残差が大きい');
ok('κ が ‖A‖_P と一致する（上界ではない）', badAch === 0, badAch + ' 件で食い違った');
ok('どの例でも ρ ≤ κ < γ < 1', badMono === 0, badMono + ' 件で崩れた');

/* --- 手で確かめられる性質 --- */

/* 正規行列では ρ = ‖A‖₂ で、P はスカラ倍の単位行列になる。係数は 1。 */
(function () {
  const A = [];
  const Q = T.cyclicShift(3);
  for (let i = 0; i < 3; i++) A.push(Q[i].map((v) => 0.6 * v));
  const c = T.certificate(A, 0.8);
  near('正規行列では κ = ρ', c.kappa, 0.6, 1e-12);
  ok('正規行列では係数が 1', Math.abs(c.amplification - 1) < 1e-9,
     '係数 ' + c.amplification);
})();

/* ‖Ax‖_P ≤ κ‖x‖_P を、乱数ではなく決め打ちの向きで当たる。 */
(function () {
  const A = [[0.5, 20], [0, 0.5]];
  const c = T.certificate(A, 0.75);
  let worst = 0;
  for (let d = 0; d < 720; d++) {
    const th = d * Math.PI / 360;
    const x = [Math.cos(th), Math.sin(th)];
    const r = T.certNorm(c, T.matvec(A, x)) / T.certNorm(c, x);
    worst = Math.max(worst, r);
  }
  ok('720 方向すべてで ‖Ax‖_P ≤ κ‖x‖_P', worst <= c.kappa + 1e-9,
     '最悪比 ' + worst + ' / κ = ' + c.kappa);
  ok('その最悪比が κ に達する（κ は達成値）', Math.abs(worst - c.kappa) < 1e-4,
     '最悪比 ' + worst + ' / κ = ' + c.kappa);
})();

/* ‖·‖_P がノルムであること。三角不等式と斉次性。 */
(function () {
  const c = T.certificate([[0.5, 20], [0, 0.5]], 0.75);
  let triOk = true, homOk = true;
  for (let d = 0; d < 200; d++) {
    const a = d * 0.031, b = d * 0.077;
    const x = [Math.cos(a) * (1 + d % 5), Math.sin(a) * 2];
    const y = [Math.cos(b), Math.sin(b) * (1 + d % 3)];
    const sum = [x[0] + y[0], x[1] + y[1]];
    if (T.certNorm(c, sum) > T.certNorm(c, x) + T.certNorm(c, y) + 1e-9) triOk = false;
    const k = -3.5 + d * 0.037;
    const kx = [k * x[0], k * x[1]];
    if (Math.abs(T.certNorm(c, kx) - Math.abs(k) * T.certNorm(c, x)) > 1e-9) homOk = false;
  }
  ok('三角不等式 ‖x+y‖_P ≤ ‖x‖_P + ‖y‖_P', triOk);
  ok('斉次性 ‖cx‖_P = |c|‖x‖_P', homOk);
  ok('‖0‖_P = 0', T.certNorm(c, [0, 0]) === 0);
})();

/* 保証した上界が、実際の反復を覆うか。 */
(function () {
  const spec = T.PRESETS.counter;
  const res = T.analyze(spec);
  const c = T.certificate(res.A, 0.75);
  const rows = T.iterate(res, spec.x0, 60);
  const e0 = rows[0].err;
  let broke = 0;
  rows.forEach((r, k) => {
    if (r.err === null || !isFinite(r.err)) return;
    if (r.err > T.certBound(c, k, e0) * (1 + 1e-9)) broke++;
  });
  ok('反例で全 ' + rows.length + ' 段が上界の内側', broke === 0, broke + ' 段で破れた');
  ok('第 1 段では誤差が初期値より大きい（増えてよい）', rows[1].err > rows[0].err);
})();

/* 作れないものは作らない。 */
ok('ρ = 1 では証書を出さない', T.certificate(T.cyclicShift(3)) === null);
ok('ρ > 1 では証書を出さない', T.certificate([[1.5, 0], [0, 0.3]]) === null);
ok('ρ = 1 の非正規行列でも出さない', T.certificate([[1, 5], [0, 1]]) === null);
ok('γ ≤ ρ を断る', T.certificate([[0.5, 20], [0, 0.5]], 0.4) === null);
ok('γ ≥ 1 を断る', T.certificate([[0.5, 20], [0, 0.5]], 1.0) === null);
ok('コレスキー分解は正定値でない行列に null を返す',
   T.cholesky([[1, 2], [2, 1]]) === null);
ok('コレスキー分解が P = LLᵀ を再現する',
   (function () {
     const P = [[4, 2], [2, 3]];
     const L = T.cholesky(P);
     const R = T.matmul(L, T.transpose(L));
     return Math.abs(R[0][0] - 4) < 1e-12 && Math.abs(R[1][0] - 2) < 1e-12 &&
       Math.abs(R[1][1] - 3) < 1e-12;
   })());
ok('クロネッカー積が NumPy の np.kron と一致する',
   (function () {
     /* np.kron([[1,2],[3,4]], [[0,5],[6,7]]) の全成分。 */
     const want = [[0, 5, 0, 10], [6, 7, 12, 14], [0, 15, 0, 20], [18, 21, 24, 28]];
     const K = T.kron([[1, 2], [3, 4]], [[0, 5], [6, 7]]);
     if (K.length !== 4) return false;
     for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
       if (K[i][j] !== want[i][j]) return false;
     }
     return true;
   })());

/* γ を振ったときの釣り合い。 */
(function () {
  const A = [[0.5, 20], [0, 0.5]];
  const gs = [0.55, 0.6, 0.75, 0.9, 0.99];
  const cs = gs.map((g) => T.certificate(A, g));
  let kUp = true, aDown = true;
  for (let i = 0; i + 1 < cs.length; i++) {
    if (!(cs[i].kappa < cs[i + 1].kappa)) kUp = false;
    if (!(cs[i].amplification > cs[i + 1].amplification)) aDown = false;
  }
  ok('γ が大きいほど κ も大きい（この例）', kUp);
  ok('γ が大きいほど係数は小さい（この例）', aDown);
  ok('どの γ でも κ < γ < 1', cs.every((c) => c.kappa < c.gamma && c.gamma < 1));
  const nearRho = T.certificate(A, 0.51);
  ok('γ を ρ に寄せると κ も ρ に寄る（Ostrowski）', nearRho.kappa <= 0.51,
     'κ = ' + nearRho.kappa);
})();

/* --------------------------------------------------------------- 結果 */
console.log('\n' + '-'.repeat(58));
if (failures.length === 0) {
  console.log(pass + ' 件すべて通りました。');
} else {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。\n');
  failures.forEach((f) => console.log('  FAIL ' + f));
  process.exitCode = 1;
}
