/* サイトの構造を検査する。
 *
 *   node verification/check_site.js
 *
 * 依存パッケージなし。ブラウザも起こさない。HTML を文字列として見て、
 * **破綻したときに黙って壊れるもの**だけを確かめる。
 *
 * 見た目は対象外。ここで拾うのは、直したつもりで直っていない類の食い違いである。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
/* 配っているページの一覧は verification/pages.json が唯一の出所である。
 * 三箇所にベタ書きしていたのをやめた。ページを足したら pages.json だけ直す。 */
const PAGES = require('./pages.json').pages.map((p) => p.file);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let pass = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { console.log('  OK   ' + label); pass++; return; }
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  failures.push(label + (detail ? ' — ' + detail : ''));
}
function section(n) { console.log('\n' + n); }

/* ------------------------------------------------------ 1. 内部リンク */
section('1. 内部リンク');

const missing = [];
/* 相対リンクは、そのページが置かれている場所から解決する。ROOT から見ると
 * notes/ の中の ./../trinity.html を見失う。 */
PAGES.forEach((page) => {
  const html = read(page);
  const dir = path.dirname(path.join(ROOT, page));
  const hrefs = [...html.matchAll(/(?:href|src)="(\.\/[^"#?]+)/g)].map((m) => m[1]);
  [...new Set(hrefs)].forEach((h) => {
    if (!fs.existsSync(path.resolve(dir, h))) missing.push(page + ' → ' + h);
  });
});
ok('すべての内部リンク先のファイルが存在する', missing.length === 0, missing.join(', '));

/* -------------------------------- 2. 読み込み時の外部リクエストが無いこと */
section('2. 読み込み時の外部リクエスト');

// 自動で取りに行くもの（script src / stylesheet / img / iframe）だけを見る。
// <a href="https://…"> は押したときだけなので対象外。
const external = [];
PAGES.forEach((page) => {
  const html = read(page);
  const pat = [
    /<script[^>]+src="(https?:)?\/\/[^"]+"/g,
    /<link[^>]+rel="stylesheet"[^>]+href="(https?:)?\/\/[^"]+"/g,
    /<img[^>]+src="(https?:)?\/\/[^"]+"/g,
    /<iframe[^>]+src="(https?:)?\/\/[^"]+"/g,
    /@import\s+url\(["']?https?:/g
  ];
  pat.forEach((re) => {
    const m = html.match(re);
    if (m) external.push(page + ': ' + m[0].slice(0, 70));
  });
});
ok('自動で外部を取りに行く要素が無い', external.length === 0, external.join(' | '));

/* ------------------------------------------------------- 3. 構造化データ */
section('3. 構造化データ');

['index.html', 'index.en.html'].forEach((page) => {
  const html = read(page);
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) { ok(page + ' に JSON-LD がある', false); return; }
  let g = null;
  try { g = JSON.parse(m[1]); } catch (e) {
    ok(page + ' の JSON-LD が解釈できる', false, e.message);
    return;
  }
  ok(page + ' の JSON-LD が解釈できる', true);
  const nodes = g['@graph'] || [];
  ok(page + ' の @graph が空でない', nodes.length > 0, nodes.length + ' 件');

  // hasPart が指す @id が、同じ @graph の中の identifier / url と対応すること
  const ids = new Set();
  nodes.forEach((n) => {
    [n['@id'], n.identifier, n.url].forEach((v) => { if (typeof v === 'string') ids.add(v); });
  });
  const dangling = [];
  nodes.forEach((n) => {
    (n.hasPart || []).forEach((p) => {
      if (p['@id'] && !ids.has(p['@id'])) dangling.push(n.name + ' → ' + p['@id']);
    });
  });
  ok(page + ' の hasPart が @graph 内の資料を指している', dangling.length === 0, dangling.join(', '));
});

/* ------------------------------------------ 4. 論文カードと解析リンクの一致 */
section('4. 論文カードと「まとめて解析」リンク');

// ここが黙ってずれる。論文を足したのにリンクを直し忘れる、が起きる。
['index.html', 'index.en.html'].forEach((page) => {
  const html = read(page);
  const sec = html.slice(html.indexOf('id="papers"'), html.indexOf('</section>', html.indexOf('id="papers"')));

  const cardDois = [...sec.matchAll(/class="doi">DOI (10\.[^\s<]+)</g)].map((m) => m[1]);
  ok(page + ' の論文カードに DOI が載っている', cardDois.length > 0,
     cardDois.length + ' 件');
});

/* ----------------------------------------------- 5. 日本語版と英語版の対応 */
section('5. 日本語版と英語版');

const ja = read('index.html');
const en = read('index.en.html');
const countCards = (h, id) => {
  const sec = h.slice(h.indexOf('id="' + id + '"'), h.indexOf('</section>', h.indexOf('id="' + id + '"')));
  return (sec.match(/class="cert reveal"/g) || []).length;
};
['credentials', 'papers', 'works'].forEach((id) => {
  ok(id + ' のカード数が両言語で一致する', countCards(ja, id) === countCards(en, id),
     'ja ' + countCards(ja, id) + ' / en ' + countCards(en, id));
});

/* --------------------------------------- 5b. 日本語 README と英語 README */
section('5b. 日本語 README と英語 README');

// 論文を足したときに片方だけ直す、が起きる。DOI の集合で突き合わせる。
// 節の終わりは、行頭から行末までが '---' の水平線。表の区切り（| --- |）と
// 取り違えると、節がほぼ空になって検査が素通りする。実際に一度そうなった。
const sectionOf = (md, heading) => {
  const i = md.indexOf(heading);
  if (i < 0) return '';
  const m = /\n---\n/.exec(md.slice(i));
  return md.slice(i, m ? i + m.index : md.length);
};
const doisIn = (md, heading) =>
  [...sectionOf(md, heading).matchAll(/\[(10\.\d{4,9}\/[^\]]+)\]\(https:\/\/doi\.org\//g)]
    .map((m) => m[1]);
const rowsIn = (md, heading) => (sectionOf(md, heading).match(/^\| \[/gm) || []).length;

if (fs.existsSync(path.join(ROOT, 'README.en.md'))) {
  const jaMd = read('README.md');
  const enMd = read('README.en.md');

  const jaDois = [...new Set(doisIn(jaMd, '✴︎Papers✴︎'))];
  const enDois = [...new Set(doisIn(enMd, '✴︎Papers✴︎'))];
  ok('両 README の論文 DOI が一致する',
     JSON.stringify(jaDois.slice().sort()) === JSON.stringify(enDois.slice().sort()),
     'ja ' + jaDois.length + ' / en ' + enDois.length);

  ok('両 README の制作物の行数が一致する',
     rowsIn(jaMd, '✴︎Works✴︎') === rowsIn(enMd, '✴︎Works✴︎'),
     'ja ' + rowsIn(jaMd, '✴︎Works✴︎') + ' / en ' + rowsIn(enMd, '✴︎Works✴︎'));

  ok('両 README が互いにリンクしている',
     /README\.en\.md/.test(jaMd) && /\(README\.md\)/.test(enMd));
} else {
  ok('README.en.md がある', false);
}

/* ---------------------------------------------------------- 6. sitemap */
section('6. sitemap');

const sm = read('sitemap.xml');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const BASE = 'https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/';
const badLocs = locs.filter((l) => {
  if (!l.startsWith(BASE)) return true;
  const rel = l.slice(BASE.length);
  return rel !== '' && !fs.existsSync(path.join(ROOT, rel));
});
ok('sitemap の URL がすべて実在する', badLocs.length === 0, badLocs.join(', '));

const inSitemap = new Set(locs.map((l) => l.slice(BASE.length) || 'index.html'));
const shouldList = PAGES.filter((p) => p !== '404.html');
const notListed = shouldList.filter((p) => !inSitemap.has(p));
ok('公開ページがすべて sitemap にある', notListed.length === 0, notListed.join(', '));

/* lastmod は手で書くと必ず古くなる。実際に 2 ページぶん古かった。
 * verification/update_sitemap.js が git から入れ直すので、その結果と突き合わせる。 */
(() => {
  const entries = [...sm.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const loc = /<loc>([^<]+)<\/loc>/.exec(m[1]);
    const mod = /<lastmod>([^<]+)<\/lastmod>/.exec(m[1]);
    return { loc: loc && loc[1], mod: mod && mod[1] };
  });
  ok('sitemap のすべての URL に lastmod がある',
     entries.every((e) => e.mod), entries.filter((e) => !e.mod).map((e) => e.loc).join(', '));

  const badFormat = entries.filter((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.mod || ''));
  ok('lastmod が YYYY-MM-DD の形をしている', badFormat.length === 0,
     badFormat.map((e) => e.loc + ' → ' + e.mod).join(', '));

  const today = new Date().toISOString().slice(0, 10);
  const future = entries.filter((e) => e.mod > today);
  ok('lastmod が未来の日付になっていない', future.length === 0,
     future.map((e) => e.loc + ' → ' + e.mod).join(', '));

  /* git が最後にそのファイルを触った日より古い lastmod は、書き換えを忘れた印。 */
  const cp = require('child_process');
  const gitDate = (file) => {
    try {
      return cp.execFileSync('git', ['log', '-1', '--format=%cs', '--', file],
                             { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch (e) { return ''; }
  };
  const stale = [];
  let unknown = 0;
  entries.forEach((e) => {
    const rel = e.loc.slice(BASE.length) || 'index.html';
    const d = gitDate(rel);
    if (!d) { unknown++; return; }
    if (e.mod < d) stale.push(rel + '  sitemap ' + e.mod + ' / git ' + d);
  });
  ok('lastmod が git の記録より古くない', stale.length === 0, stale.join(' | '));
  /* **浅い複製では、この二件は当てにならない。**深さ 1 の複製では、HEAD が
   * 触ったファイルだけが HEAD の日付を返し、残りは空を返す。前者は「sitemap が
   * 古い」に化け、後者だけが unknown に数えられる。**化けたほうは理由を名乗らない。**
   * 2026年9月12日、横断の仕事がこれで落ちた —— 深さ 1 で、押した日が
   * sitemap の日付の翌日だったためである。浅いかどうかを先に見る。 */
  let shallow = false;
  try {
    shallow = cp.execFileSync('git', ['rev-parse', '--is-shallow-repository'],
                              { cwd: ROOT, encoding: 'utf8' }).trim() === 'true';
  } catch (e) { shallow = false; }
  ok('すべてのページの履歴が読めている（浅いクローンではない）',
     unknown === 0 && !shallow,
     shallow ? '浅い複製である。fetch-depth: 0 が要る'
             : (unknown + ' ページの日付が取れませんでした。fetch-depth: 0 が要ります'));
})();

/* --------------------------------------------- 6c. 言語版の相互参照 */
section('6c. hreflang');

/* 日本語版と英語版がある組は、両方から両方を指す。片方だけだと、検索側は
 * 対応を認めない。相互になっているかまで見る。 */
[['index.html', 'index.en.html', ''],
 ['notes/index.html', 'notes/index.en.html', 'notes/']].forEach(([jaPage, enPage, dir]) => {
  const jaUrl = BASE + (dir ? dir + 'index.html' : '');
  const enUrl = BASE + dir + 'index.en.html';
  [jaPage, enPage].forEach((page) => {
    const h = read(page);
    const alts = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)]
      .reduce((acc, m) => (acc[m[1]] = m[2], acc), {});
    ok(page + ' が ja と en の両方を指している',
       alts.ja === jaUrl && alts.en === enUrl,
       'ja ' + alts.ja + ' / en ' + alts.en);
    ok(page + ' に x-default がある', alts['x-default'] === jaUrl, alts['x-default']);
  });
});

/* ------------------------------------------------- 6b. 正の URL がひとつ */
section('6b. 正の URL');

// このサイトの正は GitHub Pages。別の配信先（Vercel など）を指す URL が混ざると、
// 検索エンジンにも読者にも二つの版があるように見える。canonical と og:url が
// 食い違えば、どちらが正か機械にも分からなくなる。
const CANON = 'https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/';

const strayHosts = [];
['README.md', 'README.en.md', 'sitemap.xml'].concat(PAGES).forEach((f) => {
  if (!fs.existsSync(path.join(ROOT, f))) return;
  [...read(f).matchAll(/https:\/\/([a-z0-9.-]*cpsbvbng26-dotcom[a-z0-9.-]*)\//g)].forEach((m) => {
    if (m[1] !== 'cpsbvbng26-dotcom.github.io') strayHosts.push(f + ': ' + m[1]);
  });
});
ok('別の配信先を指す URL が無い', strayHosts.length === 0,
   [...new Set(strayHosts)].join(', '));

const canonMismatch = [];
PAGES.forEach((page) => {
  const html = read(page);
  const c = /<link rel="canonical" href="([^"]+)"/.exec(html);
  const o = /<meta property="og:url" content="([^"]+)"/.exec(html);
  if (c && c[1].indexOf(CANON) !== 0) canonMismatch.push(page + ' canonical: ' + c[1]);
  if (o && o[1].indexOf(CANON) !== 0) canonMismatch.push(page + ' og:url: ' + o[1]);
  if (c && o && c[1] !== o[1]) canonMismatch.push(page + ' canonical ≠ og:url');
});
ok('canonical と og:url が正の URL で揃っている', canonMismatch.length === 0,
   canonMismatch.join(', '));

/* ------------------------------------------------------ 6c. CSP */
section('6c. Content-Security-Policy');

// 「外部リクエストを出さない」を、書いてあるだけでなくブラウザに強制させる。
// インラインの <style> <script> はハッシュで許しているので、中身を書き換えたら
// ハッシュも入れ直さないと、ブラウザがそのスクリプトの実行を拒む。ここで落とす。
const cspLib = require('./csp.js');
const cspErrors = [];
const cspWeak = [];
PAGES.forEach((page) => {
  const html = read(page);
  const now = cspLib.current(html);
  if (!now) { cspErrors.push(page + ': CSP が無い'); return; }
  const want = cspLib.build(html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, ''));
  if (now !== want) cspErrors.push(page + ': 中身と食い違う（update_csp.js を実行してください）');
  if (now.indexOf("default-src 'none'") !== 0) cspWeak.push(page + ": default-src が 'none' でない");
  if (/unsafe-inline|unsafe-eval|unsafe-hashes/.test(now)) cspWeak.push(page + ': unsafe-* が入っている');
  if (/\*/.test(now)) cspWeak.push(page + ': ワイルドカードが入っている');
});
ok('すべてのページに CSP がある', !cspErrors.some((e) => /CSP が無い/.test(e)),
   cspErrors.filter((e) => /CSP が無い/.test(e)).join(', '));
ok('CSP がページの中身と一致する', cspErrors.filter((e) => /食い違う/.test(e)).length === 0,
   cspErrors.filter((e) => /食い違う/.test(e)).join(', '));
ok('CSP が緩められていない', cspWeak.length === 0, cspWeak.join(', '));

// 外部へ通信するページはもう無い。connect-src はどのページでも 'none' であること。
ok("すべてのページの connect-src が 'none'",
   PAGES.every((p) => /connect-src 'none'/.test(read(p))),
   PAGES.filter((p) => !/connect-src 'none'/.test(read(p))).join(', '));
ok('CSP の許可ホストの一覧が空である', cspLib.CONNECT.length === 0,
   cspLib.CONNECT.join(', '));

/* ------------------------------------------------------------- 7. ナビ */
section('7. ナビ');

PAGES.filter((p) => p !== '404.html').forEach((page) => {
  const html = read(page);
  ok(page + ' のナビから作用素のページへ行ける',
     /href="\.\/(?:\.\.\/)?trinity\.html"/.test(html));
  ok(page + ' に消したページへのリンクが残っていない',
     !/doi\.html/.test(html));
});

/* ------------------------------------------------------ 8. trinity.js */
section('8. trinity.js');

const tjs = read('trinity.js');
ok('trinity.js が読み込まれている',
   /<script src="\.\/trinity\.js"><\/script>/.test(read('trinity.html')));
/* このページは端末の中だけで完結する。通信の手立てがコードに無いことを確かめる。 */
ok('trinity.js は通信しない',
   !/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource|import\s*\(/.test(tjs),
   (tjs.match(/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource/g) || []).join(', '));
ok('trinity.html の CSP は connect-src を閉じている',
   /connect-src 'none'/.test(read('trinity.html')));
/* CSP の style-src はハッシュだけなので、style 属性を置くと描画が壊れる。 */
ok('trinity.js が style 属性や el.style を触っていない',
   !/\.style\.|setAttribute\(\s*'style'/.test(tjs));
ok('trinity.html にインラインの style 属性が無い',
   !/\sstyle="/.test(read('trinity.html')));

/* 本文が名乗っている検査の規模と精度が、実際の記録と合っているか。
 * 文章のほうだけ古くなるのを防ぐ。 */
(() => {
  const prose = read('trinity.html');
  const fx = JSON.parse(read('verification/trinity_fixtures.json'));
  const m = prose.match(/大きさ 1 から 8 までの行列 ([0-9,]+) 個/);
  ok('本文の照合件数が fixtures の件数と一致する',
     !!m && Number(m[1].replace(/,/g, '')) === fx.cases.length,
     '本文 ' + (m ? m[1] : 'なし') + ' / 実際 ' + fx.cases.length);

  const T = require(path.resolve(ROOT, 'trinity.js'));
  let wr = 0, wn = 0;
  fx.cases.forEach((c) => {
    const A = [];
    for (let i = 0; i < c.n; i++) A.push(c.A.slice(i * c.n, (i + 1) * c.n));
    wr = Math.max(wr, Math.abs(T.spectralRadius(A) - c.rho) / Math.max(1, c.rho));
    wn = Math.max(wn, Math.abs(T.spectralNorm(A) - c.norm) / Math.max(1, c.norm));
  });
  const claimed = prose.match(/相対誤差は ([0-9.]+)×10⁻¹⁵ と ([0-9.]+)×10⁻¹⁵ を超えませんでした/);
  ok('本文が名乗っている精度を、実際に超えていない',
     !!claimed && wr <= Number(claimed[1]) * 1e-15 && wn <= Number(claimed[2]) * 1e-15,
     claimed
       ? '本文 ' + claimed[1] + 'e-15 / ' + claimed[2] + 'e-15　実際 '
         + wr.toExponential(2) + ' / ' + wn.toExponential(2)
       : '本文に精度の記載が見つからない');
  /* 証書のほうの主張も、同じやり方で当たる。 */
  const cfx = JSON.parse(read('verification/certificate_fixtures.json'));
  const cm = prose.match(/証書 ([0-9,]+) 件/);
  ok('本文の証書の件数が fixtures の件数と一致する',
     !!cm && Number(cm[1].replace(/,/g, '')) === cfx.cases.length,
     '本文 ' + (cm ? cm[1] : 'なし') + ' / 実際 ' + cfx.cases.length);

  let wk = 0, wp = 0;
  cfx.cases.forEach((c) => {
    const A = [];
    for (let i = 0; i < c.n; i++) A.push(c.A.slice(i * c.n, (i + 1) * c.n));
    const ct = T.certificate(A, c.gamma);
    if (!ct) { wk = Infinity; return; }
    wk = Math.max(wk, Math.abs(ct.kappa - c.kappa) / Math.max(1, Math.abs(c.kappa)));
    wp = Math.max(wp, Math.abs(ct.amplification - c.amplification) / Math.max(1, c.amplification));
    for (let i = 0; i < c.n; i++) for (let j = 0; j < c.n; j++) {
      wp = Math.max(wp, Math.abs(ct.P[i][j] - c.P[i * c.n + j]) /
        Math.max(1, Math.abs(c.P[i * c.n + j])));
    }
  });
  const cc = prose.match(/κ の相対差は ([0-9.]+)×10⁻¹⁶、係数と P そのものは ([0-9.]+)×10⁻¹⁰ を超えませんでした/);
  ok('本文が名乗っている証書の精度を、実際に超えていない',
     !!cc && wk <= Number(cc[1]) * 1e-16 && wp <= Number(cc[2]) * 1e-10,
     '本文 ' + (cc ? cc[1] + '×10⁻¹⁶ / ' + cc[2] + '×10⁻¹⁰' : 'なし') +
     ' / 実際 ' + wk.toExponential(2) + ' / ' + wp.toExponential(2));

  /* トップが名乗る「この場で NN」は、check_trinity.js が実際に通す件数である。
   * 検査を足したのに文章だけ古い、という壊れ方をここで止める。 */
  const out = require('child_process')
    .execSync('node ' + JSON.stringify(path.join(__dirname, 'check_trinity.js')),
              { encoding: 'utf8' });
    const lines = out.trim().split('\n');
  const n = Number((lines[lines.length - 1].match(/^(\d+) 件/) || [])[1]);
  /* 日本語版と英語版で言い方が違うので、ページごとに拾う。 */
  [['index.html', /この場で (\d+)/],
   ['index.en.html', /(\d+) checks in this page/]].forEach(([page, pat]) => {
    const m2 = read(page).match(pat);
    ok(page + ' が名乗る件数が check_trinity.js の件数と一致する',
       !!m2 && Number(m2[1]) === n,
       '本文 ' + (m2 ? m2[1] : 'なし') + ' / 実際 ' + n);
  });

})();

PAGES.filter((p) => p !== '404.html').forEach((page) => {
  ok(page + ' のナビから作用素ページへ行ける', /href="\.\/(?:\.\.\/)?trinity\.html"/.test(read(page)));
});

/* -------------------------------------------------- 10. 入口としての約束
 *
 * この公開リポジトリが守ると決めたことを、覚えていることではなく検査にする。
 * 文面はいずれ書き換わる。約束のほうを固定する。
 */
section('10. 入口としての約束');

const ENTRIES = ['index.html', 'index.en.html'];

/* 未査読であることを隠さない。<section class="wrap hero"> の中に置いてあること。
 * ここを '<hr class="rule">' で切ると head と JSON-LD まで入ってしまい、
 * 本文から消しても検査が素通りする。実際に一度そうなった。 */
const heroOf = (html) => {
  const i = html.indexOf('<section class="wrap hero">');
  if (i < 0) return '';
  const j = html.indexOf('</section>', i);
  return html.slice(i, j < 0 ? html.length : j);
};
ENTRIES.forEach((page) => {
  const hero = heroOf(read(page));
  ok(page + ' のヒーローに <section class="wrap hero"> がある', hero.length > 0);
  ok(page + ' のヒーローで査読前であることを明示している',
     /(査読を受けていない|査読前)/.test(hero) || /not been peer reviewed/i.test(hero),
     hero.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90));
});

/* 30 秒で何の場所か分かること。
 * 修了証・学習領域・外部プロフィールは、入口に節として存在しないこと
 * （notes/ に移してある。アンカーだけは <span id> で生かしてある）。 */
ENTRIES.forEach((page) => {
  const html = read(page);
  const at = (id) => html.indexOf('<section id="' + id + '"');
  ['credentials', 'areas', 'links'].forEach((id) => {
    ok(page + ' の入口に「' + id + '」の節が無い', at(id) < 0, String(at(id)));
  });
  ok(page + ' の入口が論文と制作物と主張を持っている',
     at('papers') > 0 && at('works') > 0 && at('claim') > 0);
  ok(page + ' で主張が論文より前にある', at('claim') < at('papers'));
  /* 移した先へ辿れること。消したのではないことが、入口から分かること。 */
  ok(page + ' の入口からノートへ辿れる', /href="\.\/notes\/index(\.en)?\.html/.test(html));
  ['credentials', 'areas', 'links'].forEach((id) => {
    ok(page + ' が旧アンカー #' + id + ' を残している',
       new RegExp('id="' + id + '"').test(html));
  });
});

/* 核だけがトップから見えること。核でない論文・リポジトリが入口に無いこと。 */
const NOT_CORE = ['zenodo.22058254', 'zenodo.22057583', 'zenodo.22064241', 'zenodo.22055709',
                  'researcher-profile', 'justice-and-algorithms',
                  'autonomy-and-self-cultivation', 'naval-gazette-notes'];
ENTRIES.forEach((page) => {
  const html = read(page);
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const cards = main.slice(main.indexOf('<section id="papers"'), main.indexOf('<section id="notes"'));
  const leaked = NOT_CORE.filter((k) => cards.indexOf(k) >= 0);
  ok(page + ' の核の節に、核でないものが混ざっていない', leaked.length === 0, leaked.join(', '));
});

/* 資格・バッジは /cv にある。入口にも notes にも無いこと。 */
ok('cv.html に修了証 7 件がある',
   (read('cv.html').match(/openbadge-global|courses\.edx\.org\/certificates/g) || []).length >= 7);
ok('cv.html から核へ戻れる', /href="\.\/index\.html"/.test(read('cv.html')));
ENTRIES.concat(['notes/index.html', 'notes/index.en.html']).forEach((f) => {
  ok(f + ' に修了証のバッジが無い',
     !/openbadge-global|courses\.edx\.org\/certificates/.test(read(f)));
});

/* 移したものが notes に全部あること。消していないことを、数で確かめる。 */
[['notes/index.html', 'ja'], ['notes/index.en.html', 'en']].forEach(([f]) => {
  const html = read(f);
  const absent = NOT_CORE.filter((k) => html.indexOf(k) < 0);
  ok(f + ' に、核から外したものが全部ある', absent.length === 0, absent.join(', '));
  ok(f + ' から核へ戻れる', /href="\.\/\.\.\/index(\.en)?\.html/.test(html));
});

/* 一つの主張に反論できること —— 主張・証拠・反証の手順・撤回、の四つが揃っていること。 */
ENTRIES.forEach((page) => {
  const html = read(page);
  ok(page + ' に主張の欄がある', /class="claim[ "]/.test(html));
  ok(page + ' に反証の手順が書いてある',
     /(どうすれば覆るか|What would refute it)/.test(html));
  ok(page + ' に撤回の所在が書いてある', /ERRATA\.md/.test(html));
  ok(page + ' の主張が作用素のページに繋がっている',
     /class="claim[ "][\s\S]*?trinity\.html/.test(html));
});

/* 撤回した内容を消さない。ERRATA への導線が README 両方にあること。 */
['README.md', 'README.en.md'].forEach((f) => {
  ok(f + ' が ERRATA を指している', /ERRATA\.md/.test(read(f)));
  ok(f + ' が撤回した初版の DOI に触れている', /10\.5281\/zenodo\.17173703/.test(read(f)));
});

/* 本文の核に置かないと決めたもの。出てきたら落とす。
 * 「配信」は配信先（デプロイ先）の意味で使っているので、その用法だけ除く。 */
const OFF_TOPIC = [
  ['シーランド|[Ss]ealand|公国|[Pp]rincipality', 'シーランド称号'],
  ['ライブ配信|生放送|ツイキャス|[Tt]witcast|[Tt]witch\\.tv|ニコ生', 'ライブ配信活動'],
  /* 「家系」そのものは 2026-09-11 に決めごとから外した（登録簿 SC-017）。
   * **外していないのは、家柄・末裔・血統という語のほうである。**記録が残っているか
   * どうかを書くことと、血筋を誇ることは別で、後者の語は核にも先祖の頁にも置かない。 */
  ['家柄|末裔|血統|[Bb]loodline', '血筋を誇る語'],
  ['コンサルタント|[Cc]onsultant', 'コンサルタント肩書き']
];
/* **流派を名乗った瞬間に、決めごと 6 に触れる。**独我流の頁は「流派ではなく問いの名である」
 * と書いているが、**書くだけでは守られない。**位と権威を示す語を機械で締め出す。
 * **数も頁が名乗っているので、こちらの一覧の長さと突き合わせる**（決めごと 5）。 */
{
  const F = path.join('notes', 'solitary-school.html');
  const S = read(F);
  const 権威 = ['宗家', '流祖', '師範', '創始者', '免許皆伝', '段位'];
  const 漢 = '〇一二三四五六七八九十'.split('');
  const 出た = 権威.filter((w) => S.indexOf(w) >= 0);
  ok('独我流の頁が、位と権威の語を使っていない', 出た.length === 0,
     出た.length ? 出た.join(' / ') : (権威.length + ' 語とも無い'));
  ok('頁が名乗る語数が、締め出している語数と合う',
     S.indexOf('検査が<b>' + 漢[権威.length] + 'つ</b>見ており') >= 0,
     '実際 ' + 権威.length + ' 語');
  /* **流派ではないと言い切る一行が、消えたら落ちる。**ここが消えると、
   * 残るのは名前だけになり、頁の性格が変わる。 */
  ok('独我流が、流派ではないと頭で言っている',
     S.indexOf('これは流派ではない。') >= 0
     && S.indexOf('<b>名付けたのは、体系ではなく一つの構造である。</b>') >= 0);
  /* **三つ組が、この頁の芯である。**稽古は相手の意思・情報・時間を与えた状態であり、
   * 与えなければ稽古にならず、与えれば実際の条件ではなくなる。
   * **一つでも欠けると、残りは「一人だから試せない」という平凡な話に戻る。**
   * 数も頁が名乗っているので、こちらの一覧の長さと突き合わせる（決めごと 5）。 */
  const 三つ = ['裏切り', '騙し討ち', '不意打ち'];
  const 漢数 = '〇一二三四五六七八九十'.split('');
  const 欠け = 三つ.filter((w) => S.indexOf('<th>' + w + '</th>') < 0);
  ok('稽古が排除する' + 漢数[三つ.length] + 'つが、表として立っている',
     欠け.length === 0
     && S.indexOf('<h2>稽古が排除している' + 漢数[三つ.length] + 'つ</h2>') >= 0
     && S.indexOf('<b>' + 漢数[三つ.length] + 'つは別々の欠点ではない。同じ一つのことの、'
                  + 漢数[三つ.length] + 'つの面である。</b>') >= 0,
     欠け.length ? ('立っていない: ' + 欠け.join(' / ')) : 三つ.join('・'));
  /* **結論がこちらに不利な向きを保っていること。**「一人でも仕上がる」を
   * 支える形に書き換わったら落ちる。**そこが反転すると、頁が宣伝になる。** */
  ok('三つ組の結論が、こちらに不利な向きのままである',
     S.indexOf('正当性を示せない理由は「一人だから」ではない。</b>道場でも示せない。') >= 0
     && S.indexOf('<b>支えているのは、「一人でも道場でも、同じ穴が開いている」のほうである。</b>') >= 0);
  /* **他人の来歴を、自分の名乗りの支えに使わない。**先行例を挙げれば、
   * その人の段や設立年がこちらの側の裏付けに見える。**具体例は挙げない、
   * と決めた。**決めただけでは守られないので、人名と団体名を締め出す。 */
  const 借り = ['藤平', '心身統一合氣道会', '氣の研究会', '植芝']
    .filter((w) => S.indexOf(w) >= 0);
  ok('他人の来歴を、名乗りの支えに使っていない', 借り.length === 0
     && S.indexOf('<b>具体例はここに挙げない。</b>') >= 0
     && S.indexOf('<b>こちらは段を一つも持たない。</b>') >= 0,
     借り.length ? 借り.join(' / ') : '支えを外したまま置いてある');
  /* **経験は等級ではない。**年数が段に読み替えられないよう、断りを機械で押さえる。 */
  ok('年数が審査を経ていないと書いてある',
     S.indexOf('<b>段は一つも無い。</b>') >= 0
     && S.indexOf('<b>7 年は、審査を経た数ではない。</b>') >= 0);
  /* **改訂される頁は、いつの版かを自分で名乗る。**印字した日付は放っておくと古くなる。 */
  {
    const m = /最終更新 (\d{4}-\d{2}-\d{2})/.exec(S);
    let gitDate = '';
    try {
      gitDate = require('child_process')
        .execFileSync('git', ['log', '-1', '--format=%as', '--', F],
                      { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch (e) { gitDate = ''; }
    ok('独我流の頁が名乗る最終更新が、git の記録と合う',
       m !== null && gitDate !== '' && m[1] === gitDate,
       m ? ('印字 ' + m[1] + ' / git ' + (gitDate || '取れない')) : '名乗っていません');
  }
}

/* **配っている頁も公の面である。**リンクの説明文は cv.html にしか無いので、
 * ここを外すと、肩書きの語が cv.html にだけ残せてしまう。 */
const PUBLIC_FACES = ENTRIES.concat(['trinity.html', 'cv.html',
                                     'README.md', 'README.en.md']);
const offenders = [];
PUBLIC_FACES.forEach((f) => {
  const text = read(f);
  OFF_TOPIC.forEach(([re, label]) => {
    const m = text.match(new RegExp(re, 'g'));
    if (m) offenders.push(f + ': ' + label + '（' + [...new Set(m)].join(' ') + '）');
  });
});
ok('本文の核に置かないと決めたものが出ていない', offenders.length === 0, offenders.join(' / '));

/* **独立での受注は、四つの場に出している。**説明文が一つだけずれると、
 * そこだけ別の売り方に見える。四つとも同じ一語で揃っていることを見る。
 * **肩書きでは書かない**（決めごと 10）。上の禁止語がそちらを押さえている。 */
{
  const 受注 = [['ランサーズ', 'lancers.jp'], ['ココナラ', 'coconala.com'],
                ['クラウドワークス', 'crowdworks.jp'], ['LinkedIn', 'linkedin.com']];
  const cv = read('cv.html');
  const ずれ = 受注.filter(([name, host]) => !new RegExp(
    '<a class="link" href="https://[^"]*' + host.replace('.', '\\.')
    + '[^"]*"[^>]*>' + name + ' <span>独立での案件募集</span></a>').test(cv));
  ok('配っている頁で、四つの受注先が同じ説明文で揃っている',
     ずれ.length === 0, ずれ.map((x) => x[0]).join(', '));

  const md = read('README.md');
  const 抜け = 受注.filter(([, host]) => !new RegExp(
    '— \\[独立での案件募集\\]\\(https://[^)]*' + host.replace('.', '\\.')).test(md));
  ok('README でも、四つの受注先が同じ説明文で揃っている',
     抜け.length === 0, 抜け.map((x) => x[0]).join(', '));
}

/* ------------------------------------------------- 10.5 修得した科目の合計
 *
 * 同じ科目が三箇所にある —— cv.html の節、トップの学歴、README の表。
 * **README は手で書かない。**トップの頁から組み直したものと一致すること。
 * 単位は 124 単位まで増える予定で、手で写せばいつか必ず写し忘れる。
 */
section('10.5 修得した科目の合計');

{
  const cv = read('cv.html');
  const i2 = cv.indexOf('id="courses"');
  const sec = i2 < 0 ? '' : cv.slice(i2, cv.indexOf('</section>', i2));
  ok('cv.html に修得した科目の節がある', sec.length > 0);

  const groups = sec.split('<div class="group">').slice(1);
  ok('修得した科目の群が二つある', groups.length === 2, String(groups.length));

  const sums = groups.map((g) => {
    const rows = [...g.matchAll(/<li data-category="([^"]*)" data-credits="(\d+)"/g)];
    const byCat = {};
    let credits = 0;
    rows.forEach((m) => {
      credits += Number(m[2]);
      byCat[m[1]] = (byCat[m[1]] || 0) + Number(m[2]);
    });
    const printed = /<p class="courses-total">([^<]*)<\/p>/.exec(g);
    return { n: rows.length, credits, byCat, printed: printed ? printed[1] : '' };
  });

  sums.forEach((s2, k) => {
    ok('cv.html の群 ' + (k + 1) + ' が印字した合計と行が合う',
       s2.printed.indexOf(s2.n + ' 科目 ' + s2.credits + ' 単位') === 0,
       s2.printed);
    if (Object.keys(s2.byCat).length < 2) return;
    Object.keys(s2.byCat).forEach((c) => {
      ok('cv.html の群 ' + (k + 1) + ' の内訳「' + c + '」が行と合う',
         s2.printed.indexOf(c + ' ' + s2.byCat[c]) >= 0, c + ' ' + s2.byCat[c]);
    });
  });

  /* トップの学歴にも同じ科目が並ぶ。cv.html と数が合うこと。 */
  const z = sums[1] || { n: 0, credits: 0 };
  ['index.html', 'index.en.html'].forEach((page) => {
    const lists = [...read(page).matchAll(/<ul class="path-courses">([\s\S]*?)<\/ul>/g)];
    ok(page + ' の学歴に科目の一覧がある', lists.length === 2, String(lists.length));
    const last = lists.length ? lists[lists.length - 1][1] : '';
    const cells = [...last.matchAll(/data-credits="(\d+)"/g)];
    const sum = cells.reduce((n, m) => n + Number(m[1]), 0);
    ok(page + ' の学歴の科目数と単位数が cv.html と合う',
       cells.length === z.n && sum === z.credits,
       cells.length + ' 科目 ' + sum + ' 単位');
  });

  /* **縄張りの語が、二つの文書で衝突していないこと。**
   *
   * 城の縄張り図は README が持っている。canonical-sources.md は README が
   * 言うところの `城絵図` で、**同じ語を別のものに当ててはいけない。**
   *
   * **2026年9月17日に当てた。**外のプロフィール頁を `本丸` と呼び、
   * `天守`・`石垣`・`大手門` も README と別のものに割り当てた。
   * README では `本丸` は trinity-infinity、`石垣` は self-correction である。
   * **散文どうしの食い違いは、数の検査では出ない。**ここで見る。 */
  {
    const cs = read('docs/canonical-sources.md');
    const rd = read('README.md');

    /* README の縄張りの表から、部位と中身の対応を取る。 */
    const k = rd.indexOf('| 城の部位 | 相当するもの | なぜ |');
    /* **縄張りの表だけを取る。**行頭が | でなくなったところで切る。
     * 節の末尾まで読むと、あとから足した別の表まで数える。実際に数えた。 */
    const 表を = (head) => {
      const i0 = rd.indexOf(head);
      if (i0 < 0) return [];
      const rows = [];
      for (const l of rd.slice(i0).split('\n').slice(2)) {
        if (l.indexOf('|') !== 0) break;
        if (/^ *\| *-/.test(l)) continue;
        rows.push(l);
      }
      return rows;
    };
    const 縄 = 表を('| 城の部位 | 相当するもの | なぜ |')
      .map((l) => l.split('|')[1].trim()).filter(Boolean);
    ok('README に城の縄張りの表がある（' + 縄.length + ' 部位）', 縄.length >= 6,
       String(縄.length));

    /* **城絵図が縄張りを指していること。** */
    ok('canonical-sources.md が、縄張りは README にあると書いてある',
       cs.indexOf('## 縄張りは README にある') >= 0);
    ok('食い違えば絵図のほうが誤りだと書いてある',
       cs.indexOf('絵図が縄張りと食い違えば、絵図のほうが誤りです。') >= 0);

    /* **同じ語が、両方の文書で同じものを指していること。**
     *
     * 衝突を禁じるのではない。`本丸` は両方に出てよい。**同じ六つを指していれば
     * 矛盾しない。**指すものがずれたときだけ落とす。 */
    const 六 = ['researchmap', 'CV HAL', 'PhilPeople', 'SSRN',
                'Google Scholar', 'Kudos'];
    const 本丸表 = 表を('| 特性 | 本丸 | 運営母体 | 性格 |');
    ok('README に本丸の表がある（' + 本丸表.length + ' 行）',
       本丸表.length === 六.length, String(本丸表.length));
    六.forEach((n) => {
      ok('README の本丸に ' + n + ' がある', 本丸表.some((l) => l.indexOf(n) >= 0));
    });
    ok('本丸が城の外にあると書いてある',
       rd.indexOf('### 本丸は六つ、城の外にある') >= 0);
    ok('本丸が正本でないと、README にも書いてある',
       rd.indexOf('**六つとも写しです**。') >= 0
       && rd.indexOf('Zenodo と ORCID に合わせて六つの側を直します') >= 0);
    ['JST', 'CCSD', 'PhilPapers Foundation', 'Elsevier', 'Google',
     'Kudos Innovations Ltd'].forEach((o) => {
      ok('README の本丸に運営母体 ' + o + ' がある',
         本丸表.some((l) => l.indexOf(o) >= 0));
    });

    /* **縄張りが十を網羅していること。**
     *
     * 望楼が見ているのは十である。**縄張りの表が九しか当てていなければ、
     * 一つが図に無いまま残る。**実際に残った —— solitary-school である。
     * 数だけ合っていても、当てていないものは見つからない。 */
    {
      const eco = JSON.parse(read('verification/ecosystem.json'));
      const repos = eco['共通の決めごと'].repos;
      const k2 = rd.indexOf('### 城内（GitHub）');
      const k3 = rd.indexOf('### 城の設備');
      const 城内 = (k2 >= 0 && k3 > k2) ? rd.slice(k2, k3) : '';
      const 抜け = repos.filter((r) => 城内.indexOf('`' + r + '`') < 0);
      ok('城内の縄張りが、ecosystem.json の ' + repos.length + ' を網羅している',
         抜け.length === 0, 抜け.join(' '));
    }

    /* **墨付の有無。**城内の各行が、自分の DOI を持つかどうかを述べている。
     * **数は散文にも書いた。**表から数えて突き合わせる。 */
    {
      const k2 = rd.indexOf('### 城内（GitHub）');
      const k3 = rd.indexOf('### 城の設備');
      const 行 = 表を('| 城の部位 | 相当するもの | なぜ |');
      ok('城内のすべての行が、墨付の有無を述べている',
         行.length > 0 && 行.every((l) => l.indexOf('墨付') >= 0),
         行.filter((l) => l.indexOf('墨付') < 0).length + ' 行が述べていない');

      /* **墨付ありの数。**DOI が書かれている行を数える。 */
      /* **太字に依らせない。**書き方 5 で文をまたぐ太字を外したとき、
       * `**墨付あり**` の形が崩れて数が一つ減った。**数えるのは語と DOI だけでよい。** */
      const 有 = (rd.slice(k2, k3).match(/墨付あり\*{0,2}\s*`10\.5281\//g) || []).length;
      const 漢 = ['零','一','二','三','四','五','六','七','八','九','十'];
      ok('墨付を持つ曲輪の数が、表と散文で合う（' + 有 + ' つ）',
         rd.indexOf('リポジトリ自身の DOI を持つのは' + 漢[有] + 'つ') >= 0,
         '表は ' + 有 + ' 件');
      /* **凍結された版。**墨付と同じく、各行が持つか持たないかを述べている。 */
      ok('城内のすべての行が、凍結の有無を述べている',
         行.length > 0 && 行.every((l) => l.indexOf('凍結') >= 0),
         行.filter((l) => l.indexOf('凍結') < 0).length + ' 行が述べていない');
      const 凍無 = 行.filter((l) => l.indexOf('凍結なし') >= 0).length;
      ok('凍結を持たない曲輪の数が、表と散文で合う（' + 凍無 + ' つ）',
         rd.indexOf('| 凍結された版（タグ）を持たない | **' + 漢[凍無] + 'つ** |') >= 0,
         '表は ' + 凍無 + ' 行');
      /* **両方を欠くもの。**墨付も凍結も無い曲輪が、いちばん薄い。 */
      /* **行ではなく、リポジトリを数える。**三の丸は二つ持っているので、
       * 行で数えると一つ足りない。実際に足りなかった。 */
      const 両 = (行.join('\n').match(/墨付なし・凍結なし/g) || []).length;
      ok('墨付も凍結も欠く曲輪の数が、表と散文で合う（' + 両 + ' つ）',
         rd.indexOf('| **両方を欠く** | **' + 漢[両] + 'つ** |') >= 0,
         '表は ' + 両 + ' 行');
      ok('中枢の四つが両方を欠くと書いてある',
         rd.indexOf('**天守閣・詰丸・石垣・出丸が、四つとも両方を欠いています**。') >= 0);

      ok('墨付を持たない曲輪の数も書いてある',
         rd.indexOf('**墨付を持たない曲輪が' + 漢[10 - 有] + 'つあります**。') >= 0,
         String(10 - 有));
    }

    /* **城内の部位名を、城外で使い回さない。**同じ図の中で二度使えば、
     * どちらを指しているか決まらない。 */
    {
      const k4 = rd.indexOf('### 城外（自分の領地ではない）');
      const 城外 = k4 >= 0 ? rd.slice(k4, k4 + 4000) : '';
      const k2 = rd.indexOf('### 城内（GitHub）');
      const k3 = rd.indexOf('### 城の設備');
      const 内の部位 = 縄.filter((x) => x && x !== '城の部位');
      const 重複 = 内の部位.filter((r) => 城外.indexOf('| ' + r + ' |') >= 0);
      ok('城内の部位名を、城外で使い回していない', 重複.length === 0,
         重複.join('・'));
    }

    /* **本丸に数えない置き場。**人の面が立っていないものは外す。 */
    ok('README の城外に、置き場の行がある',
       rd.indexOf('| 置き場（本丸ではない） |') >= 0);
    ok('本丸が着地点であると、README にも書いてある',
       rd.indexOf('人を探しに来た者が着いて、そこで止まる') >= 0);
  }

  /* **本丸の数。**「三つある」と散文が名乗る。**表の行と突き合わせる。**
   *
   * 本丸と正本は別のものである。混ぜれば、どちらの規則も効かなくなる。
   * ここが見るのは五つ —— 名乗った数と行の数が合うこと、三つの名が並ぶこと、
   * Zenodo が本丸に入っていないこと（プロフィールの頁が無い）、国の機関でない
   * ものの数が散文と合うこと、そして本丸が正本に勝たないと書いてあること。 */
  {
    const cs = read('docs/canonical-sources.md');
    const i = cs.indexOf('## 本丸は');
    const j = cs.indexOf('とも写しである');
    const 節 = (i >= 0 && j > i) ? cs.slice(i, j) : '';
    ok('canonical-sources.md に本丸の節がある', 節.length > 0);

    /* 特性ごとの表だけを取る。行の頭が ** で始まるものだけが本丸である。 */
    const k = 節.indexOf('| 特性 | 本丸 | 運営 | 性格 |');
    const 表 = k >= 0 ? 節.slice(k).split('\n').filter((l) => /^\| \*\*/.test(l)) : [];
    const 漢 = (n) => ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n] || '?';
    ok('本丸の数が、散文と表で合う（' + 表.length + ' つ）',
       節.indexOf('## 本丸は' + 漢(表.length) + 'つある') >= 0, '表は ' + 表.length + ' 行');

    ['researchmap', 'HAL', 'PhilPeople', 'SSRN', 'Google Scholar', 'Kudos']
      .forEach((n) => {
      ok('本丸の表に ' + n + ' がある', 表.some((l) => l.indexOf(n) >= 0));
    });

    /* **面と置き場を分ける。**本丸は面のほうである。
     * HAL と CV HAL を取り違えると、置き場が本丸の顔になる。 */
    ok('欧州の本丸が CV HAL であると書いてある',
       節.indexOf('**欧州の本丸は CV HAL であって、HAL そのものではない**') >= 0);
    ok('CV HAL の行き先が、紙面に出ているものと同じである',
       節.indexOf('cv.hal.science/nemoto-takuya') >= 0
       && read('index.html').indexOf('cv.hal.science/nemoto-takuya') >= 0);
    ok('面と置き場を分ける表がある',
       節.indexOf('| 本丸（面） | その下の置き場 |') >= 0);
    /* **面と置き場が一つの本丸。**名前を検査に書き込まない。
     * 散文が並べた名前が、本丸の表にあることだけを見る。 */
    {
      /* **太字に依らせない**（書き方 5）。名前は散文から取る。 */
      const m = /\*{0,2}([^*\n]+?)は、面と置き場が同じ一つです。/.exec(節);
      ok('面と置き場が一つである本丸を、名指ししてある', m !== null);
      const 一 = m ? m[1].split(/ と /).map((x) => x.trim()) : [];
      ok('面と置き場が一つの本丸が、本丸の表にある',
         一.length > 0 && 一.every((n) => 表.some((l) => l.indexOf(n) >= 0)),
         一.join('・'));
    }

    /* **計測の出所を混ぜない。**同じ画面に並んでいても、数え手が違う。 */
    ok('Kudos の欄に、他所から引いた数が混ざることを書いてある',
       節.indexOf('**Kudos の欄には、他所の数も混ざる**。') >= 0
       && 節.indexOf('引いてきたものである') >= 0);

    /* **観察を規則に格上げしない。** */
    ok('営利と計測の重なりを、規則だと書いていない',
       節.indexOf('**これは規則ではありません**。') >= 0);

    /* **Zenodo を本丸に入れない。**プロフィールの頁が無い。 */
    ok('本丸の表に Zenodo が入っていない', !表.some((l) => l.indexOf('Zenodo') >= 0));
    ok('Zenodo が本丸でない理由が書いてある',
       節.indexOf('**Zenodo は本丸ではありません**。') >= 0
       && 節.indexOf('プロフィールの頁を持たない') >= 0);

    /* 国の機関でないものの数。**もう一つの文書が「一つ」と名乗る。** */
    const 非国 = 表.filter((l) => l.indexOf('国の機関ではない') >= 0).length;
    ok('国の機関でない本丸の数が、散文と表で合う（' + 非国 + ' つ）',
       read('docs/external-evaluations.md')
         .indexOf(漢(表.length) + 'つのうち' + 漢(非国)
                  + 'つは国の機関ではありません') >= 0, String(非国));

    /* **本丸は正本に勝たない。**この二行が落ちたら、規則そのものが消える。 */
    ok('本丸が正本に勝たないと書いてある',
       cs.indexOf('本丸だからといって、正本に勝つことはありません') >= 0);
    ok('食い違いを正本に合わせる向きが書いてある',
       cs.indexOf('Zenodo と ORCID に合わせて' + 漢(表.length)
                  + 'つの側を直します。逆はしません') >= 0);

    /* **営利が本丸に入った。**数を散文と突き合わせる。
     * そして同じ会社が計測も持っている。**そこを書き落とせない。** */
    const 営利 = 表.filter((l) => l.indexOf('営利企業') >= 0).length;
    ok('営利企業が持つ本丸の数が、散文と表で合う（' + 営利 + ' つ）',
       節.indexOf('**' + 漢(表.length) + 'つのうち' + 漢(営利)
                  + 'つは営利企業が持っています**。') >= 0, String(営利));
    /* **本丸と計測が同じ手にある例の数。**表から数えて散文と突き合わせる。 */
    {
      /* **表の続きだけを取る。**行頭が | でなくなったところで切る。
       * 節の末尾まで読むと、あとから足した別の表まで数えてしまう。
       * 実際に一度そうなった —— CV HAL の表を足した日である。 */
      const i2 = 節.indexOf('| 本丸 | 同じ手が持つ計測 |');
      let 同 = 0;
      if (i2 >= 0) {
        const 続き = 節.slice(i2).split('\n').slice(1);
        for (const l of 続き) {
          if (l.indexOf('|') !== 0) break;
          if (/^\| *-/.test(l)) continue;
          同++;
        }
      }
      ok('本丸と計測が同じ手にある例の数が、散文と表で合う（' + 同 + ' 例）',
         節.indexOf('**本丸と計測が同じ手にあります**。' + 漢(同) + '例あります。') >= 0,
         '表は ' + 同 + ' 行');
      ok('営利の本丸の数と、同じ手が計測を持つ数が揃っている', 同 === 営利,
         営利 + ' / ' + 同);
    }
  }

  /* **運営母体の表。**散文が「JST が三つ」「Elsevier が二つ」と名乗る。
   *
   * 数えているのは格ではなく、**同じ手に幾つあるか**である。置き場と計測が
   * 同じ会社なら、独立した二つの目に見えて一つである。**そこがずれると、
   * 独立していない二つを独立と読むことになる。** */
  {
    const cs = read('docs/canonical-sources.md');
    const i = cs.indexOf('### 使っている場の運営母体');
    const j = cs.indexOf('### 本丸ではないもの');
    const 節 = (i >= 0 && j > i) ? cs.slice(i, j) : '';
    ok('canonical-sources.md に運営母体の節がある', 節.length > 0);

    const k = 節.indexOf('| 場 | 運営 |');
    const 行 = k >= 0
      ? 節.slice(k, 節.indexOf('### 同じ手に二つ以上あるもの'))
          .split('\n').filter((l) => /^\| \*\*/.test(l))
      : [];
    ok('運営母体の表に行がある（' + 行.length + ' 行）', 行.length >= 10, String(行.length));

    /* **同じ手に幾つあるか。**表から数えて、散文と突き合わせる。 */
    const 漢 = (n) => ['零','一','二','三','四','五','六','七','八','九','十'][n] || '?';
    ['JST', 'Elsevier', 'PhilPapers Foundation'].forEach((手) => {
      const n = 行.filter((l) => l.indexOf(手) >= 0).length;
      ok(手 + ' が持つ場の数が、散文と表で合う（' + n + ' つ）',
         節.indexOf('**' + 手 + ' が' + 漢(n) + 'つ持っています**。') >= 0,
         '表は ' + n + ' 行');
    });

    /* **Jxiv は表に無い。**候補であって、まだ使っていない。
     * 表の数と散文の数を等号で縛ったので、候補の分は別の一文で持たせる。 */
    ok('Jxiv が候補として、表の外に置かれていると書いてある',
       節.indexOf('候補に挙げた Jxiv を入れると三つになります。') >= 0
       && !行.some((l) => l.indexOf('Jxiv') >= 0));

    /* **等級を一つに揃えてある。**どれか一行だけ格上げすれば落ちる。 */
    ok('運営母体の表の等級が、検索で確認（原典未読）だと書いてある',
       節.indexOf('**この表は全部 `検索で確認（原典未読）` です**。') >= 0);

    /* **調べていないものを、調べたことの欄に入れない。**
     *
     * 見る名前を検査に書き込まない。**散文が並べた名前を読んで、それが表に
     * 無いことを見る。**書き込めば、表に足した日に検査のほうが古くなる。
     * 実際に一度そうなった —— Google Scholar を本丸に加えた日である。 */
    {
      const m = /\*\*([^*]+?)は、まだこの表に入れていません\*\*。/.exec(節);
      ok('まだ入れていない場を並べてある', m !== null);
      const 未 = m ? m[1].replace(/\n/g, '').split('・').map((x) => x.trim()) : [];
      ok('まだ入れていない場が一つ以上ある', 未.length > 0, String(未.length));
      未.forEach((n) => {
        ok(n + ' を運営母体の表に入れていない', !行.some((l) => l.indexOf(n) >= 0));
      });
      /* **表にあるものを、入れていない側に並べない。**両方に書けば矛盾する。 */
      ok('表にある場が、入れていない側に並んでいない',
         !未.some((n) => 行.some((l) => l.indexOf(n) >= 0)), 未.join('・'));
    }

    /* **所属と、締め出しの理由を結ばない。** */
    ok('Figshare の所属を、締め出しの理由と結んでいない',
       節.indexOf('それが締め出しの理由だとは書きません') >= 0);

    /* **この表に善し悪しを書かない。**運営母体は誰が動かしているかだけである。
     * 会員資格や第三者の一覧は、出典ごとに分ける欄が別にある。 */
    ok('運営母体の表が、善し悪しを書かないと断ってある',
       節.indexOf('**この表は誰が動かしているかだけを書きます**。') >= 0
       && 節.indexOf('善し悪しを書きません') >= 0);

    /* **運営は入れ替わる。**買収で移った先があることを書いてある。
     * 書いた日のものだと断っていなければ、古い表が現在の顔で残る。 */
    ok('運営が買収で変わった先を書いてある',
       節.indexOf('DEV Community は 2026年2月18日に Major League Hacking へ移りました')
       >= 0);
    ok('運営母体の表が、書いた日のものだと断ってある',
       節.indexOf('運営母体の表は、書いた日のものです。') >= 0);

    /* **正本の一つと、配信先の正が同じ手にある。**そこを書き落とせない。 */
    ok('GitHub と GitHub Pages が同じ手にあることを書いてある',
       節.indexOf('**Microsoft が二つに関わる**。') >= 0
       && 節.indexOf('正本の一つと、配信先の正が同じ手にある') >= 0);
  }

  /* **評語。**利用者から受け取った一文字をそのまま出す。
   *
   * 換算しない。GPA も優良可も書かない。ZEN大学が印字したのは A・B・C・D・P で
   * あって、その序列を別の尺度に移せば、移した先はもう発行元の言ったことではない。
   * ここが見るのは三つである —— 全部の科目に付いていること、知らない評語が
   * 混ざっていないこと、頁と README で同じ並びであること。 */
  {
    const GRADES = ['A', 'B', 'C', 'D', 'P'];
    const 並び = (html) =>
      [...html.matchAll(/<ul class="path-courses">([\s\S]*?)<\/ul>/g)]
        .map((m) => [...m[1].matchAll(/data-grade="([^"]*)"/g)].map((g) => g[1]));

    const 基準 = 並び(read('index.html'));
    ok('index.html の学歴に評語の欄がある', 基準.length === 2, String(基準.length));
    const zen = 基準[基準.length - 1] || [];

    ok('ZEN大学の科目が全部、評語を持つ（' + zen.length + ' 科目）',
       zen.length === z.n && zen.every(Boolean),
       zen.length + ' / ' + z.n);
    ok('知らない評語が混ざっていない',
       zen.every((g) => GRADES.indexOf(g) >= 0), zen.join(' '));

    /* 短大の分は受け取っていない。**空で出す。**推測で埋めない。 */
    ok('短大の科目に評語を作っていない',
       (基準[0] || []).every((g) => g === ''), (基準[0] || []).join('|'));

    ok('index.en.html の評語が index.html と同じ並びである',
       JSON.stringify(並び(read('index.en.html'))) === JSON.stringify(基準));

    /* cv.html は別の刷り方をする。地の文の札で数える。 */
    const 札 = (cv.match(/評価 ([ABCDP])/g) || []).map((x) => x.slice(3));
    ok('cv.html の評語が学歴と同じ並びである',
       JSON.stringify(札) === JSON.stringify(zen), 札.join(' '));

    /* **換算した数を書いていない。**書けば、発行元が言っていないことになる。 */
    ['index.html', 'index.en.html', 'cv.html', 'README.md', 'README.en.md']
      .forEach((f) => {
        ok(f + ' に GPA を書いていない', !/GPA|ＧＰＡ|成績平均/.test(read(f)));
      });
  }

  /* 「何年何月何日現在」。逐次更新の目安なので、**四つの頁で同じ日でなければ
   * 意味が無い。**先の日付も認めない。 */
  const asOf = /<p class="as-of">(\d{4})年(\d{1,2})月(\d{1,2})日現在<\/p>/.exec(cv);
  ok('cv.html に「何年何月何日現在」がある', asOf !== null);
  if (asOf) {
    const [, y, mo, d] = asOf;
    const ja = `${y}年${mo}月${d}日現在`;
    const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                 'August', 'September', 'October', 'November', 'December'];
    const en2 = `as of ${Number(d)} ${MON[Number(mo) - 1]} ${y}`;
    ok('index.html が同じ日を名乗る', read('index.html').indexOf(ja) >= 0, ja);
    ok('index.en.html が同じ日を名乗る', read('index.en.html').indexOf(en2) >= 0, en2);
    const stamp = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    ok('その日が先の日付でない', stamp.getTime() <= Date.now() + 86400000, ja);
  }

  /* README は生成物である。組み直したものと一字一句合うこと。 */
  const rc = require('./readme_courses');
  rc.PAIRS.forEach(([readme, page, lang]) => {
    const r = rc.apply(readme, page, lang);
    ok(readme + ' の学歴と科目が、トップから組み直したものと一致する',
       r.before === r.after,
       'node verification/update_readme_courses.js');
  });
}

/* ------------------------------------------------- 10.53 JS が無くても読めるか
 *
 * **本文の既定は「見える」でなければならない。**以前は .reveal に opacity:0 を
 * 直接当てており、JS が動かない環境では 31 要素すべてが出なかった。CSP の
 * ハッシュが一つずれるだけで白紙になる作りだった。
 * 暗い側も同じで、data-theme が立つのは JS のときだけだった。
 */
section('10.53 JS が無くても読めるか');

{
  /* **数え上げは pages.json からにする。**ここには 8 ページをベタ書きしていた。
   * 論文の 14 ページと先祖の頁がその外にあり、同じ opacity:0 が半年残った。
   * 直したのはトップだけで、検査もトップだけを見ていたからである。 */
  const bareOpacity = (h) => h.split('}').some((chunk) => {
    const i = chunk.lastIndexOf('{');
    if (i < 0) return false;
    const sel = chunk.slice(0, i).split(/[\n;]/).pop().trim();
    return /(^|,)\s*\.reveal\s*$/.test(sel) && /opacity:\s*0/.test(chunk.slice(i));
  });
  const revealPages = PAGES.filter((p) => /\.reveal\b/.test(read(p)));
  ok('登場演出を使う頁が pages.json の大半である', revealPages.length >= 20,
     revealPages.length + ' / ' + PAGES.length);
  revealPages.forEach((p) => {
    const h = read(p);
    ok(p + ' が JS 無しで本文を隠していない', !bareOpacity(h));
    ok(p + ' が js の目印を head で立てている',
       h.indexOf('document.documentElement.className+=" js";') >= 0);
  });
  const h = read('index.html');
  ok('暗い側が OS の設定だけでも出る',
     h.indexOf('@media (prefers-color-scheme: dark)') >= 0
     && h.indexOf(':root:not([data-theme="light"])') >= 0);
  /* 暗い側の指定は二か所にある。**食い違ったら、片方だけ直した証拠である。** */
  const grab = (re) => { const m = re.exec(h); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
  const a1 = grab(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  const a2 = grab(/:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);
  ok('暗い側の二つの指定が一字一句同じ', a1 !== null && a1 === a2,
     a1 === a2 ? (a1 || '').slice(0, 40) + '…' : '食い違っている');
}

/* ------------------------------------------------- 10.57 arXiv の著者識別子
 *
 * ORCID を結び付けると出る頁であって、arXiv に載ったことを意味しない。
 * **頁の存在を掲載と読み違えられると、いちばん重い誤解になる。**
 * だから、この URL を載せた頁には必ず「論文は無い」と添える。
 */
section('10.57 arXiv の著者識別子');

{
  const NO = ['arXiv に出した論文は無い', '並ぶ論文は無い',
               'There are no papers to list'];
  const carriers = PAGES.filter((p) => (read(p) || '').indexOf('arxiv.org/a/') >= 0);
  ok('著者識別子を載せている頁がある', carriers.length > 0, carriers.join(', '));
  carriers.forEach((p) => {
    const t = read(p);
    ok(p + ' が「論文は無い」と添えている', NO.some((w) => t.indexOf(w) >= 0));
  });
}

/* ------------------------------------------------- 10.59 自己紹介が名乗っていること
 *
 * **割愛の頁と先祖の頁を消したとき、節ごと落として、無関係な検査まで一緒に消した。**
 * ここにあるのは、その頁を読まない検査だけである —— トップ、英語のトップ、
 * GitHub のプロフィール、そして外部の点検の引用。
 */
section('10.59 自己紹介が名乗っていること');

{
  const ja = read('index.html'), en = read('index.en.html');
  const rj = read('README.md'), re_ = read('README.en.md');

  /* **訳を公式名のように出さない。**英語の科目名はこちらで訳したものである。 */
  const CAVEAT = 'unofficial translations, not the university';
  const OFFICIAL = 'official English titles have not been checked';
  ok('英語のトップが、科目名は公式名ではないと断っている',
     en.indexOf(CAVEAT) >= 0 && en.indexOf(OFFICIAL) >= 0);
  ok('英語の README が、科目名は公式名ではないと断っている',
     re_.indexOf(CAVEAT) >= 0 && re_.indexOf(OFFICIAL) >= 0);

  /* 学部名は英語にしたが、頁そのものは開けていない。**出所の断りごと留める。** */
  ok('英語の学部名を英語で出している',
     en.indexOf('ZEN University, Faculty of Social Informatics') >= 0
     && re_.indexOf('ZEN University, Faculty of Social Informatics') >= 0);
  ok('学部名の出所を断っている',
     /the form the university's English pages\s+are reported to use/.test(en));
  ok('英語の頁に学科の段を作っていない', en.indexOf('Department of') < 0);
  ok('日本語の頁は日本語のまま出ている',
     ja.indexOf('知能情報社会学部 知能情報社会学科') >= 0
     && rj.indexOf('知能情報社会学部 知能情報社会学科') >= 0);

  /* **根幹の一段は、自己紹介の中に置く。**通過基準・到達点・導けないものが揃っていること。 */
  ok('根幹の一段が自己紹介にある',
     ja.indexOf('ここにあるものの根幹は、独学と、言語モデルを使って進めたことである') >= 0
     && /What is here rests on self-study and on working with language models/.test(en));
  ok('大学の単位が独学ではないと書いてある',
     ja.indexOf('ただし、大学の単位は独学ではない') >= 0
     && ja.indexOf('授業を受け、課題を出し、評価を受けて得たものである') >= 0
     && ja.indexOf('独学と言語モデルの話は、その外にある') >= 0);
  ok('英語版も大学の単位が独学ではないと書いてある',
     /The university credits, though, are not\s+self-study/.test(en));
  ok('GitHub のプロフィールにも単位の断りがある',
     rj.indexOf('ただし、大学の単位は独学ではない') >= 0
     && /The university credits, though, are not\s+self-study/.test(re_));
  ok('自己紹介に通過基準が具体に書いてある',
     ja.indexOf('通した基準は、明文で次のとおりである') >= 0
     && ja.indexOf('part of the world-wide scholarly discourse') >= 0
     && ja.indexOf('professional quality') >= 0
     && ja.indexOf('参考文献の無い非学術的なものでないこと') >= 0);
  /* **到達点は、門ごとに書く。**SSRN だけ書いて PhilArchive を「上のとおり」で
   * 済ませていた。**片方が空欄なら、到達点を書いたことにならない。** */
  ok('自己紹介に SSRN の到達点が書いてある',
     ja.indexOf('そこから導ける到達点は、はっきりしている') >= 0
     && ja.indexOf('その分野の学術的言説の一部として扱われた') >= 0);
  ok('自己紹介に PhilArchive の到達点が書いてある',
     ja.indexOf('学術哲学の領域にあり、専門職の水準') >= 0
     && ja.indexOf('却下権は留保されているが、その二篇には行使されなかった') >= 0);
  ok('英語版も門ごとに到達点が書いてある',
     en.indexOf('belong to the scholarly discourse') >= 0
     && en.indexOf('taken to lie within academic philosophy and to be') >= 0
     && en.indexOf('it was not exercised') >= 0);
  ok('自己紹介に導けないものが書いてある',
     ja.indexOf('そこから導けないものも、はっきりしている') >= 0
     && ja.indexOf('論証が正しいことは、どちらの門も見ていない') >= 0
     && ja.indexOf('通ったのは受け付けの門であって査読ではなく') >= 0);
  ok('英語版も三つが揃っている',
     en.indexOf("The bar that was cleared, in the venues' own wording") >= 0
     && en.indexOf('What follows from that is definite') >= 0
     && en.indexOf('What does not follow is equally definite') >= 0
     && en.indexOf('not peer review') >= 0);
  /* **SSRN で確かめられたのは二篇である。** */
  ok('到達点を三篇に広げていない',
     ja.indexOf('二篇について、公開前に人が見て、落とさなかった') >= 0
     && en.indexOf('For two papers, a person looked before publication') >= 0);
  /* **落ちた一篇を書かないと、門が何も落とさないように見える。**
   * 通った二篇だけを並べるのは、誤りではないが、厚く見せる方向にだけ欠ける。
   * 落とす門であることは、落とされた側にしか示せない（SC-035）。 */
  ok('落とされた一篇が書いてある',
     ja.indexOf('そして、三篇目は落とされた') >= 0
     && ja.indexOf('SSRN に出して弾かれている') >= 0
     && ja.indexOf('10.5281/zenodo.22064241') >= 0);
  ok('落とされたことから導けないものも書いてある',
     ja.indexOf('論証が誤っていると判定されたわけではない') >= 0
     && ja.indexOf('断片主義については理由が示されていない') >= 0
     && ja.indexOf('要件と範囲のどちらなのかは示されていない') >= 0);
  ok('英語版も落とされた一篇を書いている',
     en.indexOf('The third was turned away') >= 0
     && en.indexOf('was submitted to SSRN and rejected') >= 0
     && en.indexOf('not that the argument was found wanting') >= 0);
  [['index.de.html', 'Der dritte wurde abgewiesen'],
   ['index.fr.html', 'Le troisième a été écarté'],
   ['index.it.html', 'Il terzo è stato respinto']].forEach(([f, turned]) => {
    const h = read(f);
    ok(f + ' が落とされた一篇を書いている',
       h.indexOf(turned) >= 0 && h.indexOf('10.5281/zenodo.22064241') >= 0);
  });

  /* **「その分野」で済ませない。**どの網のどの区分に置いたかで、
   * 「その分野の学術的言説」が指すものが決まる。名前を書かないと、
   * 通った門の範囲が読み手に決められない。 */
  ok('置いた分野の名前が書いてある',
     ja.indexOf('Continental Philosophy') >= 0
     && ja.indexOf('Numerical Analysis') >= 0
     && ja.indexOf('Philosophy Research Network') >= 0
     && ja.indexOf('Mathematics Research Network') >= 0);
  /* **日本語の頁には訳を添える。**場の言葉は残す —— <code> の中は原文のままで、
   * 翻訳除けが掛かっている。訳だけにすると場の言葉が消え、原文だけにすると
   * 日本語で読む者に区分が渡らない。**両方置く。** */
  ok('日本語の頁に区分の訳が添えてある',
     ja.indexOf('哲学研究網') >= 0 && ja.indexOf('大陸哲学') >= 0
     && ja.indexOf('数学研究網') >= 0 && ja.indexOf('数値解析') >= 0);
  /* **eJournal に載っているのは二篇である。**三篇目は同じ区分に出して弾かれた。
   * 「哲学三篇は大陸哲学」と書くと、載っていない一篇まで載っているように読める。
   * 一度そう書いて公開した（SC-036）。**「三篇」でこの区分を語らせない。** */
  ok('eJournal に載っているのが二篇だと書いてある',
     ja.indexOf('通った哲学二篇') >= 0
     && ja.indexOf('弾かれた一篇も同じ大陸哲学に出している') >= 0
     && ja.indexOf('どの eJournal にも載っていない') >= 0);
  ok('哲学三篇がその区分に載っていると書いていない',
     /哲学三篇[^。]{0,40}大陸哲学/.test(ja) === false
     && /three philosophy papers[^.]{0,60}Continental Philosophy/.test(en) === false);
  ok('英語版も二篇だと書いている',
     en.indexOf('the two philosophy papers that were accepted') >= 0
     && en.indexOf('it sits in no eJournal at all') >= 0);
  [['index.de.html', 'die zwei angenommenen philosophischen Aufsätze', 'steht in keinem eJournal'],
   ['index.fr.html', 'les deux articles de philosophie acceptés', 'ne figure dans aucun eJournal'],
   ['index.it.html', 'i due saggi di filosofia accettati', 'non compare in alcun eJournal']]
    .forEach(([f, two, none]) => {
      const h = read(f);
      ok(f + ' も二篇だと書いている', h.indexOf(two) >= 0 && h.indexOf(none) >= 0);
    });
  ok('英語版も分野の名前を書いている',
     en.indexOf('Continental Philosophy') >= 0
     && en.indexOf('Numerical Analysis') >= 0
     && en.indexOf('Philosophy Research Network') >= 0
     && en.indexOf('Mathematics Research Network') >= 0);
  ['index.de.html', 'index.fr.html', 'index.it.html'].forEach((f) => {
    const h = read(f);
    ok(f + ' も分野の名前を書いている',
       h.indexOf('Continental Philosophy') >= 0 && h.indexOf('Numerical Analysis') >= 0
       && h.indexOf('Philosophy Research Network') >= 0
       && h.indexOf('Mathematics Research Network') >= 0);
  });

  /* **数学の側でも同じ門を通した。**通したのは Series II だけである。
   * **系列ぜんぶが通ったと読める書き方をしない。**出していない二篇も明記する。 */
  /* **場の言葉のまま置いた引用が、翻訳に食われないこと。**
   * ブラウザの翻訳は、<code> の中身も周りの日本語も書き換える。基準の原文が
   * 別の語に化け、引用の位置まで動く。translate="no" と notranslate を付けて
   * 除ける。**付け忘れれば、引用であることが読み手の画面から消える。** */
  ['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html'].forEach((f) => {
    const h = read(f);
    const bare = (h.match(/<code(?![^>]*translate="no")/g) || []).length;
    ok(f + ' の引用が翻訳除けを持っている', bare === 0,
       bare ? (bare + ' 箇所が素の <code>') : ((h.match(/<code /g) || []).length + ' 箇所'));
  });

  /* **「同じ門」で済ませない。**何を通したのかを、哲学の側と同じ言葉で書く。
   * 指しで済ませると、読む側は上に戻らないかぎり中身に辿り着けない。 */
  ok('自己紹介に Trinity-Infinity の SSRN 通過が書いてある',
     ja.indexOf('数学の側でも同じことが起きている') >= 0
     && ja.indexOf('Trinity-Infinity Series II が、SSRN の編集スタッフの判断で、その分野の学術的言説の一部として扱われた') >= 0
     && ja.indexOf('一篇について、公開前に人が見て、落とさなかった') >= 0
     && ja.indexOf('10.2139/ssrn.7446961') >= 0);
  /* **2026-09-18 に結果が出た。**「まだ出していない」は偽になった。
   * 当てる先を、結果そのものへ移す。**通ったように書いていないことだけでは足りない。**
   * 落ちたことと、範囲外では説明が付かないことを、両方見る。 */
  ok('落とされた二篇を、落とされたと書いてある',
     ja.indexOf('Series I の改訂版と Series III は、出して落とされた') >= 0
     && ja.indexOf('まだ出していません') < 0
     && en.indexOf('Series I (revised) and Series III were submitted and turned away') >= 0
     && en.indexOf('have not been submitted') < 0);
  ok('範囲外では説明が付かないと書いてある',
     ja.indexOf('数学が範囲外だということにはならない') >= 0
     && ja.indexOf('この門は同じ系列の中でも選り分ける') >= 0
     && en.indexOf('mathematics being out of scope cannot be the explanation') >= 0
     && en.indexOf('this gate sorts within a single series') >= 0);
  /* **落ちた投稿の受付番号を、どの頁にも出さない**（決めごと 1）。DOI ではない。 */
  ['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html']
    .forEach((f) => {
      const h = read(f);
      const 受付 = ['7446959', '7446979'].filter((n) => h.indexOf(n) >= 0);
      ok(f + ' に落ちた投稿の受付番号が出ていない', 受付.length === 0,
         受付.length ? ('出ている: ' + 受付.join(', ')) : '無し');
    });
  ok('英語版も数学の側の通過を書いている',
     en.indexOf('Trinity-Infinity Series II was judged by SSRN’s editorial staff to belong to the scholarly discourse of its field') >= 0
     && en.indexOf('For one paper, a person looked before publication and did not turn it away') >= 0
     && en.indexOf('10.2139/ssrn.7446961') >= 0);
  /* **道具を特定できないのは哲学三篇だけである。**Trinity-Infinity の側は特定できる。
   * 特定できる側まで「分からない」に混ぜると、開示が薄まる。 */
  ok('Trinity-Infinity の道具は特定できると書いてある',
     ja.indexOf('Trinity-Infinity の側は特定できる') >= 0
     && ja.indexOf('ChatGPT / OpenAI') >= 0
     && ja.indexOf('Claude Code（Anthropic）') >= 0
     && ja.indexOf('道具の名前を一つに絞れないのは、哲学三篇だけである') >= 0);
  /* 三言語も同じことを書く。**訳だけ古い到達点のまま残さない。** */
  [['index.de.html', 'Trinity-Infinity Serie II wurde von der Redaktion von SSRN dem wissenschaftlichen Diskurs ihres Fachs zugerechnet',
    'Serie I (überarbeitet) und Serie III wurden eingereicht und abgewiesen',
    'Serie I und Serie III sind nicht eingereicht'],
   ['index.fr.html', 'Trinity-Infinity série II a été rattachée par la rédaction de SSRN au discours savant de son domaine',
    'La série I (révisée) et la série III ont été soumises et écartées',
    'Les séries I et III n’ont pas été soumises'],
   ['index.it.html', 'Trinity-Infinity serie II è stata ricondotta dalla redazione di SSRN al discorso scientifico del proprio ambito',
    'La serie I (rivista) e la serie III sono state inviate e respinte',
    'Le serie I e III non sono state inviate']].forEach(([f, passed, turned, stale]) => {
    const h = read(f);
    ok(f + ' に数学の側の通過が書いてある', h.indexOf(passed) >= 0 && h.indexOf('10.2139/ssrn.7446961') >= 0);
    ok(f + ' が落とされた二篇を明記している',
       h.indexOf(turned) >= 0 && h.indexOf(stale) < 0);
  });
  /* **片方の門だけを細かく書かない。** */
  /* **死後に残るものの三つ。**石・紙・デジタルである。
   * **数えられる形で置く**（決めごと 5）。一つ落ちれば落ちる。 */
  {
    const 残る先 = [
      ['index.html', ['石は、墓石と諡名', '紙は、博士（学術）', 'デジタルは、ORCID と DOI']],
      ['index.en.html', ['Stone is the gravestone', 'Paper is the doctorate', 'The network is ORCID and DOI']],
      ['index.de.html', ['Stein heißt Grabstein', 'Papier heißt der Doktorgrad', 'Das Netz heißt ORCID und DOI']],
      ['index.fr.html', ['La pierre, c\'est la stèle', 'Le papier, c\'est le doctorat', 'Le réseau, c\'est ORCID et DOI']],
      ['index.it.html', ['La pietra è la stele', 'La carta è il dottorato', 'La rete è ORCID e DOI']]
    ];
    const 欠け = [];
    残る先.forEach(([f, xs]) => {
      const h = read(f);
      const 出た = xs.filter((x) => h.indexOf(x) >= 0);
      if (出た.length !== 3) 欠け.push(f + ' は ' + 出た.length);
    });
    ok('死後に残る先が、五言語とも三つある', 欠け.length === 0,
       欠け.length ? 欠け.join(' / ') : (残る先.length + ' 言語 × 3'));
  }

  /* **学位はまだ無い。**決めごと 6 に触る一行である。
   * 「取得する計画」から「取得した」へ黙って動くと、自称の肩書きになる。 */
  {
    const 未取得 = [['index.html', 'まだ持っていない'], ['index.en.html', 'It is not held.'],
                    ['index.de.html', 'Er ist nicht erworben.'],
                    ['index.fr.html', 'Il n\'est pas détenu.'],
                    ['index.it.html', 'Non è posseduto.']];
    const 欠け = 未取得.filter(([f, x]) => read(f).indexOf(x) < 0).map(([f]) => f);
    ok('博士をまだ持っていないと、五言語とも書いてある', 欠け.length === 0,
       欠け.length ? 欠け.join(' / ') : (未取得.length + ' 言語とも'));
  }

  /* **確かめていないものに、確かめていないと書く**（決めごと 1）。
   * 神道の形式も ORCID の FAQ も、作業環境から原典に当たれない。
   * **断りが消えると、受け取った説明が確かめた事実に見える。** */
  {
    const 断り = [
      ['index.html', '神道の形式については、原典に当たっていない', 'この説明は原典に当たっていない', 'いまは誰にも委ねていない'],
      ['index.en.html', 'The Shinto forms have not been checked against sources',
       'That statement has not been checked against the source', 'Nothing is delegated to anyone at present'],
      ['index.de.html', 'Die Shintō-Formen sind hier nicht an Quellen geprüft',
       'Diese Auskunft ist nicht an der Quelle geprüft', 'Derzeit ist nichts übertragen'],
      ['index.fr.html', 'Les formes shintō ne sont pas vérifiées aux sources',
       'Cette indication n\'est pas vérifiée à la source', 'Rien n\'est délégué pour le moment'],
      ['index.it.html', 'Le forme shintō qui non sono verificate sulle fonti',
       'Questa spiegazione non è verificata sulla fonte', 'Al momento non è delegato nulla']
    ];
    const 欠神 = [], 欠O = [], 欠委 = [];
    断り.forEach(([f, s, o, d]) => {
      const h = read(f);
      if (h.indexOf(s) < 0) 欠神.push(f);
      if (h.indexOf(o) < 0) 欠O.push(f);
      if (h.indexOf(d) < 0) 欠委.push(f);
    });
    ok('神道の形式を確かめていないと、五言語とも断ってある', 欠神.length === 0,
       欠神.length ? 欠神.join(' / ') : (断り.length + ' 言語とも'));
    ok('ORCID の説明を確かめていないと、五言語とも断ってある', 欠O.length === 0,
       欠O.length ? 欠O.join(' / ') : (断り.length + ' 言語とも'));
    ok('ORCID をいま誰にも委ねていないと、五言語とも書いてある', 欠委.length === 0,
       欠委.length ? 欠委.join(' / ') : (断り.length + ' 言語とも'));
  }

  /* **存命の人物は「両親」という語までにする**（決めごと 10）。
   * 親がいることは当たり前なので、続柄の一語までは通す。
   * **一人を指す語と、その人の名・職・計画は書かない。**
   * 祖父・曾祖父・祖母は故人であり、この限りではないので外す。
   * 「運営母体」のような複合語は、助詞が続かないので当たらない。
   *
   * 一度ここを越えていた —— 英語版だけが父の事業の計画を書いていた。
   * 日本語は「事業を承継すること」だけである。**訳のほうが広かった。** */
  {
    const 越え = /(?<![祖曾伯叔義])(父|母)(が|の|は|を|も|に|と|へ)|父親|母親|my (father|mother)|mein Vater|meine Mutter|mon père|ma mère|mio padre|mia madre/;
    const 出た = [];
    ['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html',
     'README.md', 'README.en.md', 'cv.html'].forEach((f) => {
      const m = 越え.exec(read(f));
      if (m) 出た.push(f + ' に「' + m[0] + '」');
    });
    ok('存命の人物が、続柄の一語を超えて出ていない', 出た.length === 0,
       出た.length ? 出た.join(' / ') : '8 面とも無し');
  }

  /* **顔写真。**貼るものは五言語とも同じ一枚である。
   * 見るのは四つ —— ファイルがあること、五面とも同じものを指していること、
   * alt が空でないこと、そして **APPn が残っていないこと**。
   *
   * **Exif は消してから貼る**（決めごと 9）。機種・撮影時刻・ときに位置が入る。
   * 落としたのは APP0 と APP1 で、画像そのものは触っていない。
   * **差し替えるときに素のまま貼ると、ここで落ちる。** */
  {
    const jpg = path.join(ROOT, 'portrait.jpg');
    const ある = fs.existsSync(jpg);
    ok('顔写真のファイルがある', ある, ある ? (fs.statSync(jpg).size + ' bytes') : 'portrait.jpg が無い');
    if (ある) {
      const b = fs.readFileSync(jpg);
      /* APPn（0xFFE0〜0xFFEF）と COM（0xFFFE）を数える。SOS から先は画像である。 */
      const 残り = [];
      let i = 2;
      let w = 0, h = 0;
      while (i < b.length - 1) {
        if (b[i] !== 0xFF) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xD8 || m === 0xD9 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
        if (m === 0xDA) break;
        const ln = b.readUInt16BE(i + 2);
        if ((m >= 0xE0 && m <= 0xEF) || m === 0xFE) 残り.push('0xFF' + m.toString(16).toUpperCase());
        if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].indexOf(m) >= 0) {
          h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7);
        }
        i += 2 + ln;
      }
      ok('顔写真に APPn が残っていない', 残り.length === 0,
         残り.length ? ('残っている: ' + 残り.join(', ')) : '落としてある');

      /* **寸法は属性で書く。**書かないと読み込みのたびに本文が跳ねる。
       * **実ファイルと食い違えば、跳ねる幅がそのままずれる。** */
      const 面 = ['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html'];
      const 寸法ずれ = [], alt無し = [], 指し先ずれ = [];
      面.forEach((f) => {
        const m = /<img class="profile-photo" src="([^"]*)" alt="([^"]*)" width="(\d+)" height="(\d+)"/.exec(read(f));
        if (!m) { 指し先ずれ.push(f + ' に写真が無い'); return; }
        if (m[1] !== './portrait.jpg') 指し先ずれ.push(f + ' が ' + m[1]);
        if (!m[2].trim()) alt無し.push(f);
        if (Number(m[3]) !== w || Number(m[4]) !== h) 寸法ずれ.push(f + ' が ' + m[3] + 'x' + m[4]);
      });
      ok('五言語とも同じ一枚を指している', 指し先ずれ.length === 0,
         指し先ずれ.length ? 指し先ずれ.join(' / ') : (面.length + ' 面とも ./portrait.jpg'));
      ok('顔写真の alt が空でなく、寸法が実ファイルと合う',
         alt無し.length === 0 && 寸法ずれ.length === 0,
         (alt無し.length ? ('alt が空: ' + alt無し.join(' / ') + ' ') : '')
         + (寸法ずれ.length ? ('寸法: ' + 寸法ずれ.join(' / ')) : ('実ファイル ' + w + 'x' + h)));
    }
  }

  ok('PhilArchive の基準を省略していない',
     ['works of all types (articles, books, dissertations)',
      'cross-disciplinary and of clear interest to philosophers',
      'All books and papers submitted should be of professional quality',
      'reject any submissions',
      '事前ではなく事後に効く'].every((x) => ja.indexOf(x) >= 0));
  ok('GitHub のプロフィールに根幹の一段がある',
     rj.indexOf('ここにあるものの根幹は、独学と、言語モデルを使って進めたことである') >= 0
     && re_.indexOf('What is here rests on self-study and on working with language models') >= 0);
  ok('GitHub のプロフィールに通過基準と到達点がある',
     rj.indexOf('part of the world-wide scholarly discourse') >= 0
     && rj.indexOf('そこから導ける到達点は、はっきりしている') >= 0
     && rj.indexOf('そこから導けないものも、はっきりしている') >= 0);

  /* **道具の名前を一つに絞れるのは、こちら側だけである。**
   * サイト・検査・記録は Claude（Anthropic）で作っており、git の履歴が証拠になる。
   * 哲学三篇に何を使ったかは特定できない（三篇の正誤表 E5）。
   * **名前だけが残って、その断りが消える形を止める。** */
  ok('この場所が Claude を使っていると書いてある',
     ja.indexOf('この場所そのものは、Anthropic の Claude を使って作っている') >= 0
     && ja.indexOf('Co-Authored-By: Claude Opus 5') >= 0);
  ok('三篇の道具は特定できないと、同じ段に書いてある',
     ja.indexOf('哲学三篇に何を使ったかは特定できない') >= 0
     && ja.indexOf('道具の名前を一つに絞れないのは、哲学三篇だけである') >= 0);
  ok('英語版も同じ二つを書いてある',
     en.indexOf('This site itself is built with Claude, by Anthropic') >= 0
     && en.indexOf('cannot be identified') >= 0
     && en.indexOf('The three philosophy papers are the only ones where the tool cannot be pinned to a single name') >= 0
     && en.indexOf('On the Trinity-Infinity side it can be identified') >= 0);
  ok('GitHub のプロフィールにも同じ二つがある',
     rj.indexOf('この場所そのものは、Anthropic の Claude を使って作っている') >= 0
     && rj.indexOf('哲学三篇に何を使ったかは特定できない') >= 0);

  /* 外部の点検の引用に、第三者の氏名が残っていないこと。 */
  const ev = read('docs/external-evaluations.md');
  ok('外部の点検の引用で、第三者の氏名を伏せてある',
     ev.indexOf('〔氏名を伏せた一名〕') >= 0 && ev.indexOf('小島') < 0);

  /* **タグが文字のまま出ていないこと。**build.js が esc() を掛ける欄に
   * 記法を書くと、<b> や <a href=…> がそのまま紙面に出る。実際に出ていた。
   * 見出しの下の一文が壊れ、登録簿へのリンクも死んでいた。 */
  ['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html']
    .forEach((f) => {
      const h = read(f);
      ok(f + ' に記法が文字のまま出ていない',
         h.indexOf('&lt;b&gt;') < 0 && h.indexOf('&lt;a href') < 0
         && h.indexOf('&lt;/b&gt;') < 0);
    });

  /* **下書き。**まだ公開していないものが、公開したものの顔をしないこと。
   *
   * ここに書いた外の数は、どれも原典を読んでいない。**当たったことにして
   * 進まないように、等級の一行を消せなくする。** */
  {
    const d = read('drafts/undisclosable-disclosure.md');
    ok('下書きが、下書きだと名乗っている',
       d.indexOf('**下書き**。まだ公開していません。') >= 0);
    ok('下書きの外の数が、原典未読だと書いてある',
       d.indexOf('いずれも原典を読んでいない') >= 0
       && d.indexOf('検索で確認（原典未読）') >= 0);
    ok('出す前に原典に当たると書いてある',
       d.indexOf('出すときは原典に当たります。') >= 0);

    /* **事例が一件しかないことを、隠さない。** */
    ok('事例が一件であることを書いてある',
       d.indexOf('**事例が一件しかありません**。') >= 0);

    /* **名指しで非難しない。**法的な線であり、記録の線でもある。 */
    ok('名指しで開示を怠ったと書かないと断ってある',
       d.indexOf('「開示を怠った」と書くことはしません') >= 0);

    /* **この文書自身への跳ね返りを書いてある。** */
    ok('下書き自身の AI 利用を開示してある',
       d.indexOf('この下書きは Claude Code（Anthropic）を使って書いています') >= 0);
  }

  /* **OLH の哲学の誌。**散文が「三つある」と名乗る。**表の行と突き合わせる。**
   *
   * ここは誤りを取り消した節である。「哲学の出し先が無い」と書いていた。
   * **取り消しの一行が消えたら落とす** —— 誤りを消したことになる。 */
  {
    const sd = read('docs/submission-disclosure.md');
    const i = sd.indexOf('### Open Library of Humanities');
    const j = sd.indexOf('### 旗艦誌には出せない');
    const 節 = (i >= 0 && j > i) ? sd.slice(i, j) : '';
    ok('submission-disclosure.md に OLH の節がある', 節.length > 0);

    const k = 節.indexOf('| 誌 | 由来 | 等級 |');
    const 行 = k >= 0
      ? 節.slice(k).split('\n').slice(2)
          .filter((l) => l.indexOf('| ') === 0 && !/^\| *-/.test(l))
      : [];
    const 漢OLH = ['零', '一', '二', '三', '四', '五'][行.length] || '?';
    ok('OLH の哲学の誌の数が、散文と表で合う（' + 行.length + ' 誌）',
       節.indexOf('哲学の誌が' + 漢OLH + 'つある') >= 0,
       '表は ' + 行.length + ' 行');
    ['Political Philosophy', 'Free & Equal', 'Philosophical Logic']
      .forEach((n) => {
        ok('OLH の表に ' + n + ' がある', 行.some((l) => l.indexOf(n) >= 0));
      });

    /* **誤りを取り消した一行を消さない。** */
    ok('哲学の出し先が無いと書いたことを、取り消してある',
       節.indexOf('**「Janeway と OLH に哲学の出し先が無い」は誤りでした**') >= 0);

    /* **旗艦誌に出せないことを書いてある。** */
    ok('旗艦誌が一般投稿を受け付けないと書いてある',
       sd.indexOf('no longer accepts general submissions') >= 0
       && sd.indexOf('### 旗艦誌には出せない') >= 0);

    /* **格の数字が三誌に無いこと。**旧誌の数字を新誌に移さない。 */
    ok('三誌の格の数字が無いと書いてある',
       sd.indexOf('### 格の数字は、三誌のいずれにも無い') >= 0);
    ok('旧誌の数字を新誌の格に使わないと書いてある',
       sd.indexOf('**旧誌の数字を新誌の格として使いません**') >= 0);

    /* **条件 4 と決めごと 14 が噛み合わないことを、書いたまま残す。** */
    ok('条件 4 と決めごと 14 の噛み合わなさを書いてある',
       sd.indexOf('### 条件 4 が、決めごと 14 と噛み合わない') >= 0
       && sd.indexOf('「数字を見る」から「数字があるかを見る」に読み替える') >= 0);

    /* **②が未確認のまま止めてあること。**満たしたことにしない。 */
    ok('Free & Equal の条件②が未確認だと書いてある',
       sd.indexOf('**②で止まっています**') >= 0
       && sd.indexOf('**「たぶん通る」で押しません**') >= 0);
  }

  /* **出す先の条件の数を、実際に並んでいる数と突き合わせる。**
   * 条件は落ちるたびに増える。散文の数を直し忘れると、少なく名乗ることになる。 */
  {
    const sd = read('docs/submission-disclosure.md');
    const i = sd.indexOf('## 出す先の条件');
    const j = sd.indexOf('### いま分かっている候補');
    const 節 = (i >= 0 && j > i) ? sd.slice(i, j) : '';
    /* **太字に依らせない**（書き方 5）。箇条の頭だけを数える。 */
    const n = (節.match(/^\d+\. /gm) || []).length;
    const 漢 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n] || '?';
    ok('出す先の条件の数が、散文と実際で合う（' + n + ' つ）',
       節.indexOf(漢 + 'つ全部を満たす場にだけ出します。') >= 0);
  }

  /* MERLOT の番号は、表の欄と URL の二か所に出る。**片方だけ直すとずれる。** */
  const 番 = /viewMaterial\.htm\?id=(\d+)/.exec(ev);
  ok('MERLOT の番号が、表と URL で同じである',
     番 !== null && ev.indexOf('番号は `' + 番[1] + '`') >= 0);
  ok('MERLOT の頁を確かめていないと書いてある',
     ev.indexOf('**この頁は確かめていません**。') >= 0
     && ev.indexOf('MERLOT に DOI は付きません') >= 0);
}

/* ------------------------------------------------- 10.62 訳した頁が、訳だと名乗っているか
 *
 * **ドイツ語・フランス語・イタリア語の頁は、言語モデルで訳したものである。**
 * 日本語と英語より短く、そこで新たに確かめたものは一つも無い。
 * **訳であることが消えれば、原文と同じ重さで読まれる。**
 */
section('10.62 訳した頁が、訳だと名乗っているか');

{
  const TR = [
    ['index.de.html', 'de', 'Diese Seite ist eine Übersetzung, angefertigt mit einem Sprachmodell',
     'Maßgeblich sind die japanische und die englische Seite'],
    ['index.fr.html', 'fr', 'Cette page est une traduction, réalisée avec un modèle de langue',
     'Ce sont les pages japonaise et anglaise'],
    ['index.it.html', 'it', 'Questa pagina è una traduzione, realizzata con un modello linguistico',
     'Fanno fede le pagine giapponese e inglese'],
  ];
  TR.forEach(([f, lang, made, source]) => {
    const h = read(f);
    ok(f + ' の lang が ' + lang, new RegExp('<html lang="' + lang + '"').test(h));
    ok(f + ' が言語モデルで訳したと書いている', h.indexOf(made) >= 0);
    ok(f + ' が日本語と英語を正としている', h.indexOf(source) >= 0);
    /* **数は、日本語の README が名乗っているものと同じでなければならない。** */
    const rm = read('README.md');
    const checks = /push のたびに (\d+) 項目の検査を通します/.exec(rm);
    const reg = /「登録簿 (\d+) 件」/.exec(rm);
    ok(f + ' の検査の数が README と合う',
       checks !== null && h.indexOf('>' + checks[1] + ' ') >= 0,
       checks ? checks[1] : '名乗りが無い');
    ok(f + ' の登録簿の数が README と合う',
       reg !== null && h.indexOf('>' + reg[1] + ' ') >= 0,
       reg ? reg[1] : '名乗りが無い');
  });
  /* 三言語の側も、名前と断りを対で持つこと。**片方だけを訳さない。** */
  [['index.de.html', 'mit Claude von Anthropic gebaut', 'lässt sich dagegen nicht bestimmen',
    'als der akademischen Philosophie zugehörig und als von'],
   ['index.fr.html', 'construite avec Claude, d’Anthropic', 'ne peuvent être identifiés',
    'tenus pour relevant de la philosophie'],
   ['index.it.html', 'costruita con Claude, di Anthropic', 'non è invece determinabile',
    'considerati appartenenti alla filosofia']].forEach(([f, named, caveat, reached]) => {
    const h = read(f);
    ok(f + ' が Claude を名指ししている', h.indexOf(named) >= 0);
    ok(f + ' が三篇の道具は特定できないと添えている', h.indexOf(caveat) >= 0);
    /* **PhilArchive の到達点を、上への指しで済ませない。** */
    ok(f + ' に PhilArchive の到達点が書いてある',
       h.indexOf(reached) >= 0 && h.indexOf('professional quality') >= 0);
  });

  /* **訳した頁は、短くてよい。だが載せる所在を削ってよいことにはならない。**
   * 日本語の頁が並べている DOI と PhilArchive の記号を、三言語も同じだけ並べる。
   * 片方にだけ番号が増えると、訳がいつの間にか古い一覧になる。 */
  {
    const ja = read('index.html');
    const ID = /10\.5281\/zenodo\.\d+|10\.2139\/ssrn\.\d+|philarchive\.org\/rec\/[A-Z]+/g;
    const want = [...new Set(ja.match(ID) || [])].sort();
    ok('日本語の頁から所在が取れる', want.length > 0, want.length + ' 種');
    ['index.de.html', 'index.fr.html', 'index.it.html'].forEach((f) => {
      const got = new Set(read(f).match(ID) || []);
      const missing = want.filter((d) => !got.has(d));
      ok(f + ' が日本語と同じ所在を並べている', missing.length === 0,
         missing.length ? ('足りない: ' + missing.join(', ')) : (want.length + ' 種すべて'));
    });
  }

  /* 日本語と英語から、三つへ辿れること。**辿れない頁は無いのと同じである。** */
  ['index.html', 'index.en.html'].forEach((f) => {
    const h = read(f);
    ok(f + ' から三つの言語へ辿れる',
       ['./index.de.html', './index.fr.html', './index.it.html'].every((u) => h.indexOf(u) >= 0));
  });
}

/* ------------------------------------------------- 10.58 キーボードで辿れるか
 *
 * **見えないものに焦点を当てない。**Chromium で 14 ページを Tab で辿ったところ、
 * トップだけで 40 個の a が opacity 0 のまま焦点を受けていた。登場演出が
 * スクロールに合わせて出る作りで、Tab はスクロールより先に進むからである。
 * 枠は出ているのに、枠の中に何も見えない状態だった。
 *
 * 作用素の頁では逆に、入力欄の枠を outline:none で消して境界線の色だけに
 * していた。変わるのは 1px 分で、焦点の在りかが読めない。
 *
 * ここは HTML を文字列として見る。ブラウザを起こす測定は別に置いてある
 * （verification/check_keyboard.js）。こちらは毎回走る側で、**直した形が
 * 消えていないこと**だけを確かめる。
 */
section('10.58 キーボードで辿れるか');

{
  const revealPages = PAGES.filter((p) => /\.js \.reveal/.test(read(p)));
  revealPages.forEach((p) => {
    const h = read(p);
    ok(p + ' が焦点の入った塊をすぐ出す',
       /\.js \.reveal:focus-within\s*\{[^}]*opacity:\s*1/.test(h));
  });

  /* 焦点の枠。入力欄を選択子から落とすと、既定の枠も消える組み合わせがある。 */
  PAGES.forEach((p) => {
    const h = read(p);
    if (h.indexOf(':focus-visible') < 0) return;
    ok(p + ' の焦点の枠が入力欄にも掛かる',
       /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/.test(h));
  });

  /* **焦点の枠を消した指定が、どこにもないこと。** */
  const killed = PAGES.filter((p) => /:focus[^{]*\{[^}]*outline:\s*none/.test(read(p)));
  ok('焦点の枠を消している頁が無い', killed.length === 0, killed.join(', '));

  /* 見出しの階層。h1 は一つ、飛ばさない。 */
  PAGES.forEach((p) => {
    const h = read(p);
    const levels = [...h.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    ok(p + ' の h1 がちょうど一つ',
       levels.filter((l) => l === 1).length === 1,
       String(levels.filter((l) => l === 1).length));
    let prev = 0;
    const skips = [];
    levels.forEach((l) => { if (prev && l > prev + 1) skips.push('h' + prev + '→h' + l); prev = l; });
    ok(p + ' の見出しが階層を飛ばさない', skips.length === 0, skips.join(', '));
  });

  /* 地標。本文の塊が一つあること。 */
  PAGES.forEach((p) => {
    const n = (read(p).match(/<main[\s>]/g) || []).length;
    ok(p + ' に main が一つ', n === 1, String(n));
  });

  /* 飛ばす導線の行き先。**外れていても見た目には出ない。** */
  PAGES.forEach((p) => {
    const h = read(p);
    const m = /class="skip-link"[^>]*href="#([^"]+)"/.exec(h)
           || /href="#([^"]+)"[^>]*class="skip-link"/.exec(h);
    if (!m) return;
    ok(p + ' の飛ばす導線に行き先がある', h.indexOf('id="' + m[1] + '"') >= 0, '#' + m[1]);
  });

  /* id の重複。同じ id が二つあると、# の行き先が先着に固定される。 */
  const dup = [];
  PAGES.forEach((p) => {
    const ids = [...read(p).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const d = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
    if (d.length) dup.push(p + ': ' + d.join(' '));
  });
  ok('id の重複が無い', dup.length === 0, dup.join(' / '));
}

/* ------------------------------------------------- 10.6 三篇の結論
 *
 * **枠組みは残らなかった、が Trinity-Infinity の根幹である。**
 * 下のほうに置けば読み手が辿り着かない。トップの主張の欄に出ていること。
 * **水準の分類も、そこで言い切っていること。**
 * 言い方は 2026-09-15 に変えた。分類はそのまま残し、
 * 自分を断罪する側の一文を、次につながる一文に替えた。
 * **述べている事実は同じである。**
 */
section('10.6 三篇の結論');

[['index.html', ['枠組みは残らなかった', '学部 2〜3 年の演習問題',
                 '大学院の線形システム論と行列解析',
                 '道具の水準と、直された中身の水準は別']],
 ['index.en.html', ['The framework did not survive',
                    'second- or third-year undergraduate exercise',
                    'graduate linear systems and matrix analysis',
                    'two different things']]].forEach(([page, words]) => {
  const html = read(page);
  words.forEach((w) => ok(page + ' が「' + w + '」を出している', html.indexOf(w) >= 0));
});

/* ------------------------------------------------- 11. 30 秒で読める入口
 *
 * README の先頭は、外から来た人が 30 秒で読み切れる入口である。
 * 必須の 5 つが揃っていること、置かないと決めたものが入口に無いことを見る。
 */
section('11. 30 秒で読める入口');

const ENTRY_END = /\n---\n/;
const entryOf = (md) => {
  const i = md.search(/\n## (30 秒で|In 30 seconds)\n/);
  if (i < 0) return '';
  const rest = md.slice(i + 1);
  /* 入口は「一覧が続く」の一文で終わる。そこまでを入口とみなす。 */
  const j = rest.search(/\n---\n\n+✴︎/);
  return j < 0 ? rest : rest.slice(0, j);
};

[['README.md', 'ja'], ['README.en.md', 'en']].forEach(([f, lang]) => {
  const md = read(f);
  const entry = entryOf(md);
  ok(f + ' に 30 秒の入口がある', entry.length > 0);

  /* 入口が README の先頭側にあること。下にあっては入口ではない。 */
  ok(f + ' の入口が一覧より前にある',
     entry.length > 0 && md.indexOf(entry) < md.indexOf('✴︎Papers✴︎'));

  ok(f + ' の入口に「この人は誰か」がある',
     lang === 'ja' ? /学びながら|学んで/.test(entry) : /studying/i.test(entry));

  ok(f + ' の入口にいまの主張がある',
     /ρ\(DQ\)/.test(entry) && /‖DQ‖₂/.test(entry));

  ok(f + ' の入口に反証の手順がある',
     lang === 'ja' ? /覆すには/.test(entry) : /To refute it/i.test(entry));

  /* 証明できたこと / 類推 / 撤回 の三つが揃っていること。一つでも欠けたら落とす。 */
  /* 見出しに語があるだけでは通さない。表の行として立っていることを見る。
   * 見出しだけを見ていると、中身を消しても素通りする。実際に一度そうなった。 */
  const triple = lang === 'ja'
    ? ['証明できたこと', '類推に過ぎないこと', '撤回したこと']
    : ['Proven', 'Only an analogy', 'Withdrawn'];
  triple.forEach((w) => {
    ok(f + ' の入口に「' + w + '」の行がある',
       new RegExp('^\\| \\*\\*' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\*\\* \\|', 'm').test(entry));
  });

  /* 次に読むファイルは 3 つだけ。増やしたら落とす。 */
  const numbered = (entry.match(/^\d\. \*\*\[/gm) || []).length;
  ok(f + ' の入口が次に読むファイルを 3 つだけ挙げている', numbered === 3, String(numbered));

  ok(f + ' の入口で未査読を明示している',
     lang === 'ja' ? /査読を受けていません|査読を受けていない/.test(entry)
                   : /not been peer reviewed|has been peer reviewed/i.test(entry));

  /* 入口に置かないと決めたもの。資格の羅列と、複数ブランドの並列。 */
  ok(f + ' の入口に資格の羅列が無い',
     !/openbadge-global|courses\.edx\.org\/certificates/.test(entry));
  const brands = ['researchmap', 'philpeople', 'hal.science', 'acadmc', 'jglobal',
                  'linkedin', 'medium.com', 'scholar.google', 'ssrn'];
  const found = brands.filter((b) => entry.toLowerCase().indexOf(b) >= 0);
  ok(f + ' の入口に複数ブランドの並列が無い', found.length === 0, found.join(', '));
});

/* 資格と外部プロフィールは消していない。折りたたんで下に置いてある。 */
['README.md', 'README.en.md'].forEach((f) => {
  const md = read(f);
  ok(f + ' が修了証 7 件を残している',
     (md.match(/openbadge-global|courses\.edx\.org\/certificates/g) || []).length >= 7);
  ok(f + ' が修了証と外部プロフィールを折りたたんでいる',
     (md.match(/<details>/g) || []).length >= 2);
});

/* 外部プロフィールの一覧は 4 か所にある。README 二つ、cv.html、そして
 * index の JSON-LD である。源は researcher-profile の cv.json と site*.json で、
 * README だけが手で並べてある。片方にだけ足すと、そこで割れる。
 * 数を数えるのではなく、並びそのものを突き合わせる。 */
const 外部プロフィール = (f) => {
  const md = read(f);
  const block = (md.match(/✴︎Links✴︎[\s\S]*?<\/details>/) || [''])[0];
  return (block.match(/\]\((https?:\/\/[^)]+)\)/g) || [])
    .map((m) => m.slice(2, -1))
    .filter((u) => u.indexOf('cpsbvbng26-dotcom.github.io') < 0);
};

const 和 = 外部プロフィール('README.md');
const 英 = 外部プロフィール('README.en.md');
ok('README.md と README.en.md が外部プロフィールを同じ順で並べている',
   和.length > 0 && 和.join('\n') === 英.join('\n'),
   和.length + ' / ' + 英.length);

/* cv.html は生成物である。README に書いた行き先が、そこに出ていないなら、
 * 手で足した側が源に戻っていない。 */
const cvHtml = read('cv.html');
[['README.md', 和], ['README.en.md', 英]].forEach(([f, us]) => {
  const 欠け = us.filter((u) => cvHtml.indexOf(u.replace(/&/g, '&amp;')) < 0);
  ok(f + ' の外部プロフィールが cv.html にも出ている', 欠け.length === 0, 欠け.join(', '));
});

/* JSON-LD の sameAs は、日本語と英語で別の設定から出る。片方だけ直せば割れる。 */
const 人物のsameAs = (f) => {
  const m = read(f).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const 出 = [];
  (function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      if (Array.isArray(o.sameAs)) 出.push(o.sameAs.join('\n'));
      Object.keys(o).forEach((k) => walk(o[k]));
    }
  }(JSON.parse(m[1])));
  return 出;
};
const sa和 = 人物のsameAs('index.html');
const sa英 = 人物のsameAs('index.en.html');
ok('index.html と index.en.html の sameAs が一致する',
   sa和.length > 0 && sa和.join('\u0000') === sa英.join('\u0000'),
   sa和.length + ' / ' + sa英.length);

/* ---------------------------------- 12. 構造化データとページの一致
 *
 * JSON-LD は機械にしか見えない。ページに出していないものを、そこだけで
 * 主張できてしまう。修了証のバッジを本文から外したとき、hasCredential 7 件が
 * トップに残っていた。見えないところに残すのは、外したことにならない。
 */
section('12. 構造化データとページの一致');

const LD_PAGES = ['index.html', 'index.en.html', 'notes/index.html', 'notes/index.en.html',
  'cv.html', 'trinity.html'];

function graphOf(html) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1])['@graph'] || []; } catch (e) { return null; }
}

LD_PAGES.forEach((page) => {
  const html = read(page);
  const graph = graphOf(html);
  if (!graph) { ok(page + ' の JSON-LD が読める', false); return; }
  const body = html.slice(html.indexOf('<main'), html.indexOf('</main>'));

  /* @graph が語っている資料は、そのページの本文にも出ていること。
   *
   * 見るのはノード単位である。sameAs は同じ資料の別の識別子（Zenodo と SSRN の
   * ような）で、本文がそのうち一つを載せていれば、その資料は出ている。
   * DOI 単位で見ると、載せない側の識別子まで落とすことになる。 */
  const nodeDois = (n) => [n.identifier, n.url]
    .concat(n.sameAs ? [].concat(n.sameAs) : [])
    .filter((x) => typeof x === 'string' && x.indexOf('doi.org/') >= 0)
    .map((u) => u.replace(/^https?:\/\/doi\.org\//, ''));
  const orphan = graph
    .filter((n) => nodeDois(n).length)
    .filter((n) => !nodeDois(n).some((d) => body.indexOf(d) >= 0))
    .map((n) => n.name || n['@type']);
  ok(page + ' の JSON-LD が、本文に無い資料を主張していない',
     orphan.length === 0, orphan.join(', '));

  /* 修了証は cv.html にだけある。他のページの JSON-LD が持っていないこと。 */
  const hasCred = graph.some((n) => n.hasCredential);
  if (page === 'cv.html') {
    ok('cv.html の JSON-LD が修了証を持っている', hasCred);
  } else {
    ok(page + ' の JSON-LD が修了証を持っていない', !hasCred);
  }
});

/* 核から外した資料は、notes の JSON-LD が引き継いでいること。
 * 移したつもりで、どちらからも消えているのが一番まずい。 */
(() => {
  const moved = ['10.5281/zenodo.22058254', '10.5281/zenodo.22057583',
                 '10.5281/zenodo.22064241', '10.5281/zenodo.22055709'];
  const g = graphOf(read('notes/index.html')) || [];
  const text = JSON.stringify(g);
  const lost = moved.filter((d) => text.indexOf(d) < 0);
  ok('核から外した論文を notes の JSON-LD が引き継いでいる', lost.length === 0, lost.join(', '));
  const core = graphOf(read('index.html')) || [];
  const leaked = moved.filter((d) => JSON.stringify(core).indexOf(d) >= 0);
  ok('核の JSON-LD に、外した論文が残っていない', leaked.length === 0, leaked.join(', '));
})();

/* 著者の @id は、どのページでも同じものを指していること。 */
(() => {
  const ids = LD_PAGES.map((p) => {
    const g = graphOf(read(p)) || [];
    const person = g.find((n) => n['@type'] === 'Person');
    return person ? person['@id'] : null;
  });
  ok('どのページの Person も同じ @id を指している',
     ids.every((i) => i && i === ids[0]), ids.join(' / '));
})();

/* -------------------------------------- 13. 第三者の標章と、引用情報
 *
 * ロゴをバッジから外したとき、SVG のファイルだけが木に残っていた。
 * どこからも参照されていないので、目でも検査でも見つからなかった。
 * 参照が無いことは、置いてよい理由にならない。
 */
section('13. 第三者の標章と引用情報');

(() => {
  const marks = fs.readdirSync(ROOT)
    .filter((f) => /\.(svg|png|ico|webp)$/i.test(f))
    .filter((f) => f !== 'favicon.svg' && f !== 'og.png');
  const orphans = marks.filter((f) => {
    const used = ['README.md', 'README.en.md', 'sitemap.xml']
      .concat(PAGES)
      .some((p) => fs.existsSync(path.join(ROOT, p)) && read(p).indexOf(f) >= 0);
    return !used;
  });
  ok('どこからも参照されていない画像が残っていない', orphans.length === 0, orphans.join(', '));
})();

/* 第三者の名を冠したファイルは、そもそも置かない。 */
(() => {
  /* 画像だけを見る。.github（設定）や Search Console の確認用 HTML は別物である。 */
  const named = fs.readdirSync(ROOT)
    .filter((f) => /\.(svg|png|ico|webp|jpg|jpeg|gif)$/i.test(f))
    .filter((f) => /(grok|openai|anthropic|claude|github|google|twitter|x-mark|logo)/i.test(f));
  ok('第三者の名を冠した画像ファイルが無い', named.length === 0, named.join(', '));
})();

/* 引用情報。書いてある DOI が、README の論文表と食い違わないこと。 */
(() => {
  const cff = read('CITATION.cff');
  ok('CITATION.cff がある', cff.length > 0);
  ok('CITATION.cff が査読前であることを述べている', /査読を受けていません/.test(cff));
  ok('CITATION.cff に ORCID がある', /0009-0000-1406-0547/.test(cff));
  const cffDois = [...new Set([...cff.matchAll(/10\.\d{4,9}\/[A-Za-z0-9._-]+/g)].map((m) => m[0]))];
  const readmeDois = new Set([...read('README.md').matchAll(/10\.\d{4,9}\/[A-Za-z0-9._-]+/g)].map((m) => m[0]));
  const unknown = cffDois.filter((d) => !readmeDois.has(d));
  ok('CITATION.cff の DOI が README にもある', unknown.length === 0, unknown.join(', '));
})();

/* ------------------------------------------------- 10.60 CI の仕事の名前が名乗っている数
 *
 * **仕事の名前は、いちばん見られていない散文である。**GitHub の画面に毎回出るのに、
 * 中身を直すときに開く場所ではない。実際、「サイトの構造 210 項目」と名乗ったまま
 * 検査は 527 項目になっていた。**倍以上ずれていて、誰も気づかない。**
 * 決めごと 5 —— 散文に数を書いたら、その数を機械で確かめられるようにする。
 */
section('10.60 CI の仕事の名前が名乗っている数');

{
  const yml = read('.github/workflows/verify.yml');
  const run = (script) => {
    const r = require('child_process').spawnSync(
      'node', [path.join(ROOT, 'verification', script)], { cwd: ROOT, encoding: 'utf8' });
    const m = /(\d+) 件すべて通りました。/.exec(r.stdout || '');
    return m ? Number(m[1]) : null;
  };
  /* check_site.js 自身は呼ばない —— 呼べば自分を無限に呼ぶ。
   * いまの pass に、この節で足す分を加えたものが総数になる。 */
  const SELF_REMAINING = 1;   /* 最後の ok() の中で数えるので、残りは自分だけ */
  const counts = {
    '配色': run('check_contrast.js'),
    'サイトの構造': null,      /* 下で自分の数から出す */
    '作用素': run('check_trinity.js'),
    'キーボードで辿れるか': null,  /* ブラウザが要るので走らせない。頁数 × 7 + 2 で出す */
  };
  /* 1 頁あたり 7 件と、幅ごとに 1 件。幅の数は check_keyboard.js から読む。
   * **ここに数を書くと、幅を足したときにここだけ古くなる。** */
  {
    const kb = read('verification/check_keyboard.js');
    const m = /const WIDTHS = \[([^\]]*)\]/.exec(kb);
    const widths = m ? m[1].split(',').filter((x) => x.trim()).length : 0;
    ok('check_keyboard.js から測る幅の数を読める', widths > 0, String(widths));
    counts['キーボードで辿れるか'] = PAGES.length * (8 + widths) + 2;
  }

  ok('配色の名乗りが実際と合う',
     new RegExp('配色 ' + counts['配色'] + ' 項目').test(yml),
     '実際 ' + counts['配色']);
  ok('作用素の名乗りが実際と合う',
     new RegExp('作用素 ' + counts['作用素'] + ' 項目').test(yml),
     '実際 ' + counts['作用素']);
  ok('キーボードの名乗りが実際と合う',
     new RegExp('キーボードで辿れるか ' + counts['キーボードで辿れるか'] + ' 項目').test(yml),
     '実際 ' + counts['キーボードで辿れるか']);
  {
    const m = /サイトの構造 (\d+) 項目/.exec(yml);
    const total = pass + SELF_REMAINING;
    ok('サイトの構造の名乗りが実際と合う',
       m !== null && Number(m[1]) === total,
       (m ? '名乗り ' + m[1] : '名乗りが無い') + ' / 実際 ' + total);
  }
}

/* ------------------------------------------------------------- 結果 */
console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
