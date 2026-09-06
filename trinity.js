/* trinity.js — 作用素 x ← DQx + (I−D)p を、ページの中だけで回す。
 *
 * 依存パッケージなし。外部へのリクエストは一切ない。
 * Node から読むと配線せず、数値の関数だけを出す（verification/check_trinity.js 用）。
 *
 * 数値の中身は三つ。
 *   固有値      Householder で上 Hessenberg にしてから、複素演算のシフト付き QR
 *   特異値      AᵀA の固有値の平方根。対称なので Jacobi 回転
 *   連立一次    部分ピボット付き Gauss 消去
 * いずれも NumPy と突き合わせて検査してある（verification/trinity_fixtures.json）。
 */
(function () {
  'use strict';

  /* ================================================================ 複素数
   * [実部, 虚部] の 2 要素配列で持つ。固有値は実行列でも複素になるため。 */
  function cadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function csub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function cconj(a) { return [a[0], -a[1]]; }
  function cabs(a) { return Math.hypot(a[0], a[1]); }
  function cdivr(a, s) { return [a[0] / s, a[1] / s]; }
  function csqrt(z) {
    var r = cabs(z);
    if (r === 0) return [0, 0];
    var re = Math.sqrt((r + z[0]) / 2);
    var im = Math.sqrt((r - z[0]) / 2);
    return [re, z[1] < 0 ? -im : im];
  }

  /* ================================================================ 行列 */
  function zeros(n, m) {
    var A = [], i, j;
    for (i = 0; i < n; i++) { A.push([]); for (j = 0; j < m; j++) A[i].push(0); }
    return A;
  }
  function identity(n) { var I = zeros(n, n), i; for (i = 0; i < n; i++) I[i][i] = 1; return I; }
  function copy(A) { return A.map(function (r) { return r.slice(); }); }
  function transpose(A) {
    var n = A.length, m = A[0].length, T = zeros(m, n), i, j;
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) T[j][i] = A[i][j];
    return T;
  }
  function matmul(A, B) {
    var n = A.length, k = B.length, m = B[0].length, C = zeros(n, m), i, j, t, s;
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
      s = 0; for (t = 0; t < k; t++) s += A[i][t] * B[t][j];
      C[i][j] = s;
    }
    return C;
  }
  function matvec(A, x) {
    return A.map(function (row) {
      var s = 0, j;
      for (j = 0; j < x.length; j++) s += row[j] * x[j];
      return s;
    });
  }
  function vsub(a, b) { return a.map(function (v, i) { return v - b[i]; }); }
  function vnorm(a) { return Math.sqrt(a.reduce(function (s, v) { return s + v * v; }, 0)); }

  /* 巡回置換行列 σ。(σx)ᵢ = x₍ᵢ₋₁ mod n₎ —— 論文の σ。 */
  function cyclicShift(n) {
    var Q = zeros(n, n), i;
    for (i = 0; i < n; i++) Q[i][(i - 1 + n) % n] = 1;
    return Q;
  }

  /* ============================================== 実対称行列の固有値（Jacobi） */
  function eigSym(S0) {
    var S = copy(S0), n = S.length, sweep, p, q, i;
    for (sweep = 0; sweep < 100; sweep++) {
      var off = 0;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) off += S[p][q] * S[p][q];
      if (off <= 1e-30) break;
      for (p = 0; p < n; p++) for (q = p + 1; q < n; q++) {
        if (Math.abs(S[p][q]) < 1e-300) continue;
        var th = (S[q][q] - S[p][p]) / (2 * S[p][q]);
        var t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        var c = 1 / Math.sqrt(t * t + 1), s = t * c, u, w;
        for (i = 0; i < n; i++) {
          u = S[i][p]; w = S[i][q];
          S[i][p] = c * u - s * w; S[i][q] = s * u + c * w;
        }
        for (i = 0; i < n; i++) {
          u = S[p][i]; w = S[q][i];
          S[p][i] = c * u - s * w; S[q][i] = s * u + c * w;
        }
      }
    }
    var out = [];
    for (i = 0; i < n; i++) out.push(S[i][i]);
    return out.sort(function (a, b) { return b - a; });
  }

  function singularValues(A) {
    return eigSym(matmul(transpose(A), A)).map(function (x) { return Math.sqrt(Math.max(0, x)); });
  }
  /* 作用素ノルム ‖A‖₂ —— 最大特異値。論文が縮小定数として挙げているもの。 */
  function spectralNorm(A) { return singularValues(A)[0]; }

  /* ================================================ 上 Hessenberg 化（Householder） */
  function hessenberg(A0) {
    var H = copy(A0), n = H.length, k, i, j, s;
    for (k = 0; k < n - 2; k++) {
      var alpha = 0;
      for (i = k + 1; i < n; i++) alpha += H[i][k] * H[i][k];
      alpha = Math.sqrt(alpha);
      if (alpha < 1e-300) continue;
      if (H[k + 1][k] > 0) alpha = -alpha;
      var v = [], vn = 0;
      for (i = k + 1; i < n; i++) v.push(H[i][k]);
      v[0] -= alpha;
      for (i = 0; i < v.length; i++) vn += v[i] * v[i];
      if (vn < 1e-300) continue;
      for (j = 0; j < n; j++) {                       /* 左から (I − 2vvᵀ/vᵀv) */
        s = 0;
        for (i = 0; i < v.length; i++) s += v[i] * H[k + 1 + i][j];
        s = 2 * s / vn;
        for (i = 0; i < v.length; i++) H[k + 1 + i][j] -= s * v[i];
      }
      for (j = 0; j < n; j++) {                       /* 右から同じもの */
        s = 0;
        for (i = 0; i < v.length; i++) s += H[j][k + 1 + i] * v[i];
        s = 2 * s / vn;
        for (i = 0; i < v.length; i++) H[j][k + 1 + i] -= s * v[i];
      }
    }
    return H;
  }

  /* ========================================== 一般の実行列の固有値（複素シフト QR）
   * 実シフトだと複素固有値の対で止まるので、複素数のまま Wilkinson シフトを打つ。 */
  function eigenvalues(A0) {
    var n = A0.length, i, j, k;
    if (n === 1) return [[A0[0][0], 0]];
    var R = hessenberg(A0), H = [];
    for (i = 0; i < n; i++) { H.push([]); for (j = 0; j < n; j++) H[i].push([R[i][j], 0]); }

    var eigs = [], hi = n - 1, iter = 0, EPS = 2.220446049250313e-16;
    function negligible(m) {
      return cabs(H[m][m - 1]) <= 8 * EPS * (cabs(H[m - 1][m - 1]) + cabs(H[m][m]) + 1e-300);
    }

    while (hi >= 0) {
      if (hi === 0) { eigs.push(H[0][0]); break; }
      if (negligible(hi)) { eigs.push(H[hi][hi]); hi--; iter = 0; continue; }
      var lo = hi;
      while (lo > 0 && !negligible(lo)) lo--;
      if (lo === hi) { eigs.push(H[hi][hi]); hi--; iter = 0; continue; }
      if (++iter > 200) { eigs.push(H[hi][hi]); hi--; iter = 0; continue; }

      /* 末尾 2×2 の固有値のうち H[hi][hi] に近い方をシフトにする */
      var a = H[hi - 1][hi - 1], b = H[hi - 1][hi], c = H[hi][hi - 1], d = H[hi][hi];
      var tr = cadd(a, d), det = csub(cmul(a, d), cmul(b, c));
      var disc = csqrt(csub(cmul(tr, tr), [4 * det[0], 4 * det[1]]));
      var l1 = cdivr(cadd(tr, disc), 2), l2 = cdivr(csub(tr, disc), 2);
      var mu = cabs(csub(l1, d)) <= cabs(csub(l2, d)) ? l1 : l2;
      if (iter % 13 === 0) mu = cadd(d, [cabs(H[hi][hi - 1]), 0]);   /* 例外シフト */

      for (i = lo; i <= hi; i++) H[i][i] = csub(H[i][i], mu);

      var cs = [], sn = [], u, w;
      for (k = lo; k < hi; k++) {                     /* Givens で R にする */
        var x = H[k][k], y = H[k + 1][k];
        var ax = cabs(x), ay = cabs(y), cc, ss;
        if (ay < 1e-300) { cc = 1; ss = [0, 0]; }
        else if (ax < 1e-300) { cc = 0; ss = [1, 0]; }
        else {
          var r = Math.hypot(ax, ay);
          cc = ax / r;
          ss = cdivr(cmul(cdivr(x, ax), cconj(y)), r);
        }
        cs.push(cc); sn.push(ss);
        for (j = k; j <= hi; j++) {
          u = H[k][j]; w = H[k + 1][j];
          H[k][j] = cadd([cc * u[0], cc * u[1]], cmul(ss, w));
          H[k + 1][j] = cadd(cmul([-ss[0], ss[1]], u), [cc * w[0], cc * w[1]]);
        }
      }
      for (k = lo; k < hi; k++) {                     /* 右から Qᴴ を掛けて RQ に戻す */
        var c2 = cs[k - lo], s2 = sn[k - lo], top = Math.min(k + 2, hi);
        for (i = lo; i <= top; i++) {
          u = H[i][k]; w = H[i][k + 1];
          H[i][k] = cadd([c2 * u[0], c2 * u[1]], cmul(w, cconj(s2)));
          H[i][k + 1] = cadd(cmul([-s2[0], -s2[1]], u), [c2 * w[0], c2 * w[1]]);
        }
      }
      for (i = lo; i <= hi; i++) H[i][i] = cadd(H[i][i], mu);
    }
    return eigs;
  }

  /* スペクトル半径 ρ(A) —— 収束するかどうかを決めているもの。 */
  function spectralRadius(A) {
    return eigenvalues(A).reduce(function (m, z) { return Math.max(m, cabs(z)); }, 0);
  }

  /* ======================================= 連立一次（部分ピボット付き Gauss 消去） */
  function solve(M0, b0) {
    var M = copy(M0), b = b0.slice(), n = M.length, i, j, k;
    for (k = 0; k < n; k++) {
      var piv = k;
      for (i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[piv][k])) piv = i;
      if (Math.abs(M[piv][k]) < 1e-13) return null;
      if (piv !== k) {
        var t = M[k]; M[k] = M[piv]; M[piv] = t;
        var tb = b[k]; b[k] = b[piv]; b[piv] = tb;
      }
      for (i = k + 1; i < n; i++) {
        var f = M[i][k] / M[k][k];
        if (f === 0) continue;
        for (j = k; j < n; j++) M[i][j] -= f * M[k][j];
        b[i] -= f * b[k];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  /* ================================================================ 作用素 */
  function analyze(spec) {
    var n = spec.n, Q = spec.Q, a = spec.a, p = spec.p, i, j;
    var A = zeros(n, n), b = new Array(n);
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) A[i][j] = a[i] * Q[i][j];
      b[i] = (1 - a[i]) * p[i];
    }
    var rho = spectralRadius(A);
    var norm = spectralNorm(A);

    /* 正規行列かどうか。正規なら ρ = ‖A‖₂ になり、区別が現れない。 */
    var AtA = matmul(transpose(A), A), AAt = matmul(A, transpose(A)), dev = 0, scale = 0;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      dev = Math.max(dev, Math.abs(AtA[i][j] - AAt[i][j]));
      scale = Math.max(scale, Math.abs(AtA[i][j]));
    }
    var isNormal = dev <= 1e-9 * Math.max(1, scale);

    var converges = rho < 1 - 1e-12;
    var fixedPoint = null;
    if (converges) {
      var M = zeros(n, n);
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) M[i][j] = (i === j ? 1 : 0) - A[i][j];
      fixedPoint = solve(M, b);
    }

    /* 過渡的増幅 maxₖ‖Aᵏ‖₂。ρ<1 でも 1 を超えることがある —— そこが要点。 */
    var P = identity(n), peak = 1, peakAt = 0, kk;
    for (kk = 1; kk <= 120; kk++) {
      P = matmul(A, P);
      var s = spectralNorm(P);
      if (s > peak) { peak = s; peakAt = kk; }
      if (s < 1e-14 && kk > 4) break;
    }

    return {
      n: n, A: A, b: b,
      rho: rho, norm: norm, isNormal: isNormal,
      converges: converges, monotone: norm < 1 - 1e-12,
      fixedPoint: fixedPoint,
      transientGrowth: peak, transientAt: peakAt,
      eigenvalues: eigenvalues(A)
    };
  }

  /* 反復。x* が取れるときは誤差も返す。 */
  function iterate(res, x0, steps) {
    var x = x0.slice(), rows = [], k;
    for (k = 0; k <= steps; k++) {
      rows.push({
        k: k, x: x.slice(),
        err: res.fixedPoint ? vnorm(vsub(x, res.fixedPoint)) : null
      });
      x = matvec(res.A, x).map(function (v, i) { return v + res.b[i]; });
      if (!isFinite(x[0])) break;
    }
    return rows;
  }

  /* ================================================================ 見本 */
  var PRESETS = {
    s1: {
      label: 'Series I', n: 3, Q: cyclicShift(3), a: [0.6, 0.6, 0.6], p: [1, 0, 0],
      x0: [0, 0, 0],
      note: '論文 Series I の設定。Q は巡回置換、a は一様。x* = (0.510204, 0.306122, 0.183673)。'
    },
    s2: {
      label: 'Series II', n: 3, Q: cyclicShift(3), a: [0.5, 0.7, 0.3], p: [1, 0, 0.5],
      x0: [0.9, 0.1, 0.4],
      note: '論文 Series II の設定。a が成分ごとに違う。ここで既に ρ と ‖A‖₂ が離れている。'
    },
    counter: {
      label: '反例', n: 2, Q: [[1, 40], [0, 1]], a: [0.5, 0.5], p: [1, 0],
      x0: [5, -3],
      note: '論文の条件 ‖A‖₂ < 1 を満たさない。それでも ρ < 1 なので収束する。誤差はいったん増える。'
    },
    boundary: {
      label: '境界', n: 2, Q: [[1, 30], [0, 1]], a: [1, 1], p: [1, 0],
      x0: [1, 1],
      note: 'ρ = 1 ちょうど。a を 0.99 にすると収束し、1.01 にすると発散する。‖A‖₂ はどちら側でも 1 を超えたままで、判定に使えない。'
    },
    singular: {
      label: '特異な Q', n: 3, Q: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], a: [0.3, 0.3, 0.3], p: [1, 0, 0],
      x0: [1, 1, 1],
      note: 'Q は階数 1 で、逆行列を持たない。等長でも置換でもない。それでも ρ < 1 なら収束する。'
    }
  };

  /* ================================================================ 配線 */
  var HAS_DOM = typeof document !== 'undefined' && !!document.getElementById;
  if (!HAS_DOM) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        eigenvalues: eigenvalues, spectralRadius: spectralRadius,
        spectralNorm: spectralNorm, singularValues: singularValues,
        eigSym: eigSym, hessenberg: hessenberg, solve: solve,
        matmul: matmul, matvec: matvec, transpose: transpose,
        identity: identity, zeros: zeros, cyclicShift: cyclicShift,
        analyze: analyze, iterate: iterate, PRESETS: PRESETS
      };
    }
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var grid = $('grid'), out = $('out'), sizeSel = $('size');
  if (!grid) return;

  var state = null;

  function cell(cls, value, label) {
    var el = document.createElement('input');
    el.type = 'text';
    el.inputMode = 'decimal';
    el.className = cls;
    el.value = String(value);
    el.setAttribute('aria-label', label);
    el.spellcheck = false;
    el.addEventListener('input', run);
    return el;
  }

  function num(el) {
    var v = parseFloat(el.value);
    return isFinite(v) ? v : 0;
  }

  /* 入力欄を組み直す。Q（n×n）と a・p・x₀（各 n）。 */
  function build(spec) {
    grid.textContent = '';
    var n = spec.n, i, j;

    var qWrap = document.createElement('div');
    qWrap.className = 'mblock';
    var qh = document.createElement('div');
    qh.className = 'mlabel';
    qh.textContent = 'Q  （n × n）';
    qWrap.appendChild(qh);
    var qg = document.createElement('div');
    qg.className = 'mgrid cols-' + n;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      qg.appendChild(cell('mcell q', spec.Q[i][j], 'Q ' + (i + 1) + ' 行 ' + (j + 1) + ' 列'));
    }
    qWrap.appendChild(qg);
    grid.appendChild(qWrap);

    var vecs = [
      ['a', 'a  （混合係数）', spec.a, 'a'],
      ['p', 'p  （錨）', spec.p, 'p'],
      ['x0', 'x₀  （初期値）', spec.x0, 'x₀']
    ];
    vecs.forEach(function (v) {
      var w = document.createElement('div');
      w.className = 'mblock';
      var h = document.createElement('div');
      h.className = 'mlabel';
      h.textContent = v[1];
      w.appendChild(h);
      var g = document.createElement('div');
      g.className = 'mgrid cols-' + n;
      for (i = 0; i < n; i++) {
        g.appendChild(cell('mcell ' + v[0], v[2][i], v[3] + ' ' + (i + 1) + ' 番目'));
      }
      w.appendChild(g);
      grid.appendChild(w);
    });
  }

  function read() {
    var n = parseInt(sizeSel.value, 10);
    var qs = grid.querySelectorAll('.q'), i, j;
    var Q = zeros(n, n);
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) Q[i][j] = num(qs[i * n + j]);
    var pull = function (cls) {
      return Array.prototype.map.call(grid.querySelectorAll('.' + cls), num);
    };
    return { n: n, Q: Q, a: pull('a'), p: pull('p'), x0: pull('x0') };
  }

  function fmt(v, d) {
    if (!isFinite(v)) return '∞';
    if (v !== 0 && (Math.abs(v) < 1e-4 || Math.abs(v) >= 1e6)) return v.toExponential(2);
    return v.toFixed(d === undefined ? 6 : d);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* 誤差 ‖xₖ − x*‖ の推移。対数目盛の折れ線。style 属性は置かない（CSP）。 */
  function plot(rows) {
    var NS = 'http://www.w3.org/2000/svg';
    var pts = rows.filter(function (r) { return r.err !== null && isFinite(r.err); });
    if (pts.length < 2) return null;
    var W = 640, H = 190, L = 46, R = 10, T = 14, B = 26;
    var logs = pts.map(function (r) { return Math.log10(Math.max(r.err, 1e-18)); });
    var lo = Math.min.apply(null, logs), hix = Math.max.apply(null, logs);
    if (hix - lo < 1) { lo -= 0.5; hix += 0.5; }
    var X = function (i) { return L + i * (W - L - R) / (pts.length - 1); };
    var Y = function (v) { return T + (hix - v) * (H - T - B) / (hix - lo); };

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'plot');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '誤差の推移。縦は対数目盛。');

    var g0 = Math.ceil(lo), g1 = Math.floor(hix), g;
    for (g = g0; g <= g1; g++) {
      if (g1 - g0 > 8 && g % 2 !== 0) continue;
      var ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', L); ln.setAttribute('x2', W - R);
      ln.setAttribute('y1', Y(g).toFixed(1)); ln.setAttribute('y2', Y(g).toFixed(1));
      ln.setAttribute('class', 'gl');
      svg.appendChild(ln);
      var tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', L - 6); tx.setAttribute('y', (Y(g) + 3.5).toFixed(1));
      tx.setAttribute('class', 'gt');
      tx.textContent = '1e' + g;
      svg.appendChild(tx);
    }

    /* 初期誤差の水準。ここを上に超えていれば「増えてから減った」。 */
    var base = document.createElementNS(NS, 'line');
    base.setAttribute('x1', L); base.setAttribute('x2', W - R);
    base.setAttribute('y1', Y(logs[0]).toFixed(1)); base.setAttribute('y2', Y(logs[0]).toFixed(1));
    base.setAttribute('class', 'baseline');
    svg.appendChild(base);

    var d = logs.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'curve');
    svg.appendChild(path);

    /* 誤差が初期値を超えた最高点に印を打つ。ここが「増えてから減る」の証拠。 */
    var mi = 0, k2;
    for (k2 = 1; k2 < logs.length; k2++) if (logs[k2] > logs[mi]) mi = k2;
    if (logs[mi] > logs[0] + 1e-12) {
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', X(mi).toFixed(1));
      dot.setAttribute('cy', Y(logs[mi]).toFixed(1));
      dot.setAttribute('r', '3.5');
      dot.setAttribute('class', 'peak');
      svg.appendChild(dot);
      var pl2 = document.createElementNS(NS, 'text');
      pl2.setAttribute('x', (X(mi) + 8).toFixed(1));
      pl2.setAttribute('y', (Y(logs[mi]) + 4).toFixed(1));
      pl2.setAttribute('class', 'pt');
      pl2.textContent = '第 ' + mi + ' 段　初期値の '
        + (Math.pow(10, logs[mi] - logs[0])).toFixed(1) + ' 倍';
      svg.appendChild(pl2);
    }

    var lbl = document.createElementNS(NS, 'text');
    lbl.setAttribute('x', L); lbl.setAttribute('y', H - 8);
    lbl.setAttribute('class', 'gt');
    lbl.textContent = '第 0 段 → 第 ' + (pts.length - 1) + ' 段　　—— 破線は初期誤差の水準';
    svg.appendChild(lbl);
    return svg;
  }

  function verdict(okFlag, head, body) {
    var d = el('div', 'verdict ' + (okFlag ? 'yes' : 'no'));
    d.appendChild(el('span', 'vmark', okFlag ? '✓' : '×'));
    var t = el('div', 'vtext');
    t.appendChild(el('div', 'vhead', head));
    t.appendChild(el('div', 'vbody', body));
    d.appendChild(t);
    return d;
  }

  function run() {
    var spec;
    try { spec = read(); } catch (e) { return; }
    var res = analyze(spec);
    state = { spec: spec, res: res };
    out.textContent = '';

    var v1 = el('div', 'verdicts');
    v1.appendChild(verdict(res.converges,
      'ρ(A) = ' + fmt(res.rho) + (res.converges ? ' < 1' : ' ≥ 1'),
      res.converges
        ? 'どの初期値から始めても、ただ一つの不動点に収束する。'
        : '収束しない初期値がある。ρ(A) < 1 が収束の必要十分条件。'));
    v1.appendChild(verdict(res.monotone,
      '‖A‖₂ = ' + fmt(res.norm) + (res.monotone ? ' < 1' : ' ≥ 1'),
      res.monotone
        ? '誤差は初手から単調に減る。論文が置いているのはこの条件。'
        : '誤差が単調に減るとは限らない。論文の条件はここで破れている。'));
    out.appendChild(v1);

    var facts = el('div', 'facts');
    var add = function (k, v) {
      var r = el('div', 'fact');
      r.appendChild(el('dt', null, k));
      r.appendChild(el('dd', null, v));
      facts.appendChild(r);
    };
    add('正規行列', res.isNormal ? 'はい —— このとき ρ = ‖A‖₂ になり、区別が現れない' : 'いいえ');
    add('ρ と ‖A‖₂ の差', fmt(res.norm - res.rho));
    add('過渡的増幅 maxₖ‖Aᵏ‖₂', fmt(res.transientGrowth, 4) + '（第 ' + res.transientAt + ' 段）');
    add('固有値', res.eigenvalues.map(function (z) {
      return Math.abs(z[1]) < 1e-12
        ? fmt(z[0], 4)
        : fmt(z[0], 4) + (z[1] >= 0 ? ' + ' : ' − ') + fmt(Math.abs(z[1]), 4) + 'i';
    }).join('、  '));
    add('不動点 x*', res.fixedPoint
      ? '(' + res.fixedPoint.map(function (v) { return fmt(v); }).join(', ') + ')'
      : '存在しない、または一意でない（ρ ≥ 1）');
    out.appendChild(facts);

    var rows = iterate(res, spec.x0, 60);
    var pl = plot(rows);
    if (pl) {
      var pw = el('div', 'plotwrap');
      pw.appendChild(pl);
      out.appendChild(pw);

      var errs = rows.map(function (r) { return r.err; }).filter(function (e) { return e !== null && isFinite(e); });
      var mx = Math.max.apply(null, errs);
      if (errs[0] > 0 && mx > errs[0] * 1.000001) {
        var at = errs.indexOf(mx);
        out.appendChild(el('p', 'growth',
          '誤差は第 ' + at + ' 段で初期値の ' + (mx / errs[0]).toFixed(1) +
          ' 倍まで増えてから、減りに転じている。ρ < 1 でも ‖A‖₂ ≥ 1 だと、こうなる。'));
      }
    }

    var tbl = el('table', 'steps');
    var thead = el('thead'), htr = el('tr');
    htr.appendChild(el('th', null, 'k'));
    for (var c = 0; c < spec.n; c++) htr.appendChild(el('th', null, 'x' + (c + 1)));
    htr.appendChild(el('th', null, '‖xₖ − x*‖'));
    thead.appendChild(htr); tbl.appendChild(thead);
    var tb = el('tbody');
    rows.slice(0, 13).forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', 'kcol', String(r.k)));
      r.x.forEach(function (v) { tr.appendChild(el('td', null, fmt(v))); });
      tr.appendChild(el('td', 'ecol', r.err === null ? '—' : (isFinite(r.err) ? r.err.toExponential(3) : '∞')));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    var tw = el('div', 'tablewrap');
    tw.appendChild(tbl);
    out.appendChild(tw);
  }

  function load(key) {
    var s = PRESETS[key];
    if (!s) return;
    sizeSel.value = String(s.n);
    build({ n: s.n, Q: s.Q, a: s.a, p: s.p, x0: s.x0 });
    var note = $('note');
    if (note) note.textContent = s.note;
    Array.prototype.forEach.call(document.querySelectorAll('.preset'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-preset') === key);
      b.setAttribute('aria-pressed', b.getAttribute('data-preset') === key ? 'true' : 'false');
    });
    run();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.preset'), function (b) {
    b.addEventListener('click', function () { load(b.getAttribute('data-preset')); });
  });

  /* n を変えたら、巡回置換と一様な a で組み直す（論文の既定の形）。 */
  sizeSel.addEventListener('change', function () {
    var n = parseInt(sizeSel.value, 10), i;
    var a = [], p = [], x0 = [];
    for (i = 0; i < n; i++) { a.push(0.6); p.push(i === 0 ? 1 : 0); x0.push(0); }
    build({ n: n, Q: cyclicShift(n), a: a, p: p, x0: x0 });
    var note = $('note');
    if (note) note.textContent = 'n = ' + n + '、Q は巡回置換、a は一様に 0.6。論文の既定の形。';
    Array.prototype.forEach.call(document.querySelectorAll('.preset'), function (b) {
      b.classList.remove('on');
      b.setAttribute('aria-pressed', 'false');
    });
    run();
  });

  var rand = $('rand');
  if (rand) rand.addEventListener('click', function () {
    /* 直交でも置換でもない Q を入れる。それでも ρ < 1 なら収束する。 */
    var n = parseInt(sizeSel.value, 10), i, j;
    var Q = zeros(n, n), a = [], p = [], x0 = [];
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) Q[i][j] = Math.round((Math.random() * 2 - 1) * 100) / 100;
      a.push(0.6); p.push(Math.round(Math.random() * 100) / 100); x0.push(0);
    }
    build({ n: n, Q: Q, a: a, p: p, x0: x0 });
    var note = $('note');
    if (note) note.textContent = 'Q を無作為に取り替えた。直交でも置換でもない。収束するかどうかは ρ(A) だけで決まる。';
    Array.prototype.forEach.call(document.querySelectorAll('.preset'), function (b) {
      b.classList.remove('on');
      b.setAttribute('aria-pressed', 'false');
    });
    run();
  });

  load('s1');
})();
