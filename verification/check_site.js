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
const PUBLIC_FACES = ENTRIES.concat(['research.html', 'trinity.html',
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
     && ja.indexOf('理由は示されておらず') >= 0);
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
  ok('通っていない二篇を、通ったように書いていない',
     ja.indexOf('Series I と Series III は、まだ出していない') >= 0
     && en.indexOf('Series I and Series III have not been submitted') >= 0);
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
    'Serie I und Serie III sind nicht eingereicht'],
   ['index.fr.html', 'Trinity-Infinity série II a été rattachée par la rédaction de SSRN au discours savant de son domaine',
    'Les séries I et III n’ont pas été soumises'],
   ['index.it.html', 'Trinity-Infinity serie II è stata ricondotta dalla redazione di SSRN al discorso scientifico del proprio ambito',
    'Le serie I e III non sono state inviate']].forEach(([f, passed, notyet]) => {
    const h = read(f);
    ok(f + ' に数学の側の通過が書いてある', h.indexOf(passed) >= 0 && h.indexOf('10.2139/ssrn.7446961') >= 0);
    ok(f + ' が出していない二篇を明記している', h.indexOf(notyet) >= 0);
  });
  /* **片方の門だけを細かく書かない。** */
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
    const checks = /push のたびに (\d+) 項目の検査を通す/.exec(rm);
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
 */
section('10.6 三篇の結論');

[['index.html', ['枠組みは残らなかった', '学部 2〜3 年の演習問題の水準',
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

/* ---------------------------------- 12. 構造化データとページの一致
 *
 * JSON-LD は機械にしか見えない。ページに出していないものを、そこだけで
 * 主張できてしまう。修了証のバッジを本文から外したとき、hasCredential 7 件が
 * トップに残っていた。見えないところに残すのは、外したことにならない。
 */
section('12. 構造化データとページの一致');

const LD_PAGES = ['index.html', 'index.en.html', 'notes/index.html', 'notes/index.en.html',
  'cv.html', 'research.html', 'trinity.html'];

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
    counts['キーボードで辿れるか'] = PAGES.length * (7 + widths) + 2;
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
