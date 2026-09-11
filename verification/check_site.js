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
  ok('すべてのページの履歴が読めている（浅いクローンではない）', unknown === 0,
     unknown + ' ページの日付が取れませんでした。fetch-depth: 0 が要ります');
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
const PUBLIC_FACES = ENTRIES.concat(['research.html', 'trinity.html', 'lineage.html',
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

/* ------------------------------------------------- 10.55 割愛の頁の日付
 *
 * 外側の規則を要約した頁である。**規則は動く。**いつ時点かを出しておかないと、
 * 変わった日から「事実と違う記述を公開している」状態になる。
 */
section('10.55 割愛の頁の日付');

{
  const v = read('venues.html');
  const m = /<p class="as-of reveal">(\d{4})年(\d{1,2})月(\d{1,2})日現在<\/p>/.exec(v);
  ok('venues.html に「何年何月何日現在」がある', m !== null);
  if (m) {
    const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    ok('その日が先の日付でない', t.getTime() <= Date.now() + 86400000,
       m[1] + '年' + m[2] + '月' + m[3] + '日');
  }
  ok('規則が動くことを断っている', v.indexOf('<b>規則は動く。</b>') >= 0);
  ok('その日より後の変更が反映されていないと書いてある',
     v.indexOf('それより後の変更は反映されていない') >= 0);
  ok('どの場も下げないと先頭に書いてある',
     v.indexOf('<b>どの場も下げるつもりはない。</b>') >= 0);
  ok('どの場も勧めていないと書いてある', v.indexOf('どの場を勧めてもいない') >= 0);
  ok('規則の記述が未確認だと書いてある', v.indexOf('<b>規則の記述は未確認である。</b>') >= 0);
  ok('覆し方が書いてある', v.indexOf('一つ示せば、その行は覆る') >= 0);
  // **数学の区分だけ、日付が早い。**全区分の改定と混ぜると、この件では
  // 一か月半ずれた規則を書いていることになる。
  ok('数学の自動推薦の日付を、全区分の改定と分けている',
     v.indexOf('<b>2025年12月10日から、数学の区分では機関のメールだけでは下りない。</b>') >= 0
     && v.indexOf('<b>数学の区分では、それより早い 2025年12月10日から下りていない。</b>') >= 0);
  ok('推薦者の資格の範囲を書いている',
     v.indexOf('3 か月前から 5 年前までの間に出されたもの') >= 0);
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

/* ------------------------------------------------- 10.54 先祖の頁が、確度を守っているか
 *
 * **記録が残っているかを書く頁であって、血筋を誇る頁ではない。**根拠の強さを
 * 混ぜないこと、戸籍の写しを出さないこと、そして **公報から確定できないものを
 * 書かないこと**を保つ。GitHub の外に別の記述があると外部の点検が述べたので、
 * こちらが確度の低いほうへ寄らないことを機械で留める。
 */
section('10.54 先祖の頁が、確度を守っているか');

{
  const h = read('lineage.html');
  ok('先祖の頁がある', h !== null);
  if (h !== null) {
    ok('根拠を段階に分けている',
       h.indexOf('言えること') >= 0 && h.indexOf('文書') >= 0
       && h.indexOf('証言') >= 0 && h.indexOf('この頁は主張しない') >= 0);
    /* **同一性を主張しないこと。**名が一致することと同一人物であることは別で、
     * 突き合わせていない以上、繋いで書かない。ここが緩むと誤った血縁の公表になる。 */
    ok('同一性を主張しないと書いてある',
       h.indexOf('同一性を主張しないことが、この頁のいちばん重い断りである') >= 0
       && (h.match(/この頁は主張しない/g) || []).length >= 2);
    ok('戸籍の写しと本籍を出さないと書いてある',
       h.indexOf('戸籍・除籍の写し、その転写、本籍') >= 0
       && h.indexOf('公開するのは「確認した」という事実までにする') >= 0);
    ok('存命の人物を挙げていないと書いてある',
       h.indexOf('存命の人物は一人も挙げていない') >= 0);
    ok('原典の本文と図版を転載していないと書いてある',
       h.indexOf('本文も図版も頁数も転載していない') >= 0
       && h.indexOf('原典の本文・図版・頁数') >= 0);
    ok('原資料の画像を置かないと書いてある',
       h.indexOf('原資料の画像は置いていない') >= 0);
    ok('訂正と削除の申し出先がある',
       h.indexOf('訂正または削除の申し出を受け付ける') >= 0
       && h.indexOf('確かめたうえで直すか落とす') >= 0
       && h.indexOf('理由を述べる必要は無い') >= 0);
    ok('法的な判断を述べないと書いてある',
       h.indexOf('この頁は法的な判断を述べない') >= 0);
    /* **本籍は、それ自体が出してはならない欄である。**語として出るのは
     * 「出さない」と宣言する箇所だけでよい。 */
    ok('本籍を実際に書いていない',
       (h.match(/本籍/g) || []).length === 1);
    ok('著者の仕事の根拠にしないと書いてある',
       h.indexOf('この頁は、著者の仕事について何も言わない') >= 0);
    ok('同名異人の可能性を残している', h.indexOf('同名異人') >= 0);
  ok('祖父の証言が刊本に及んでいないと書いてある',
     h.indexOf('刊本 2 件を、祖父が挙げたのではない') >= 0
     && h.indexOf('二つを結びつけたのは、祖父の証言ではない') >= 0);
  ok('肩書きの形を著者によるものとして分けてある',
     h.indexOf('祖父から聞いたのは「議員であった」までである') >= 0);
    ok('別の媒体との差について断りがある',
       h.indexOf('別の媒体に、別の記述があること') >= 0
       && h.indexOf('その媒体は作業環境から開けない') >= 0);
    ok('確度の低いほうへ合わせないと書いてある',
       h.indexOf('確度の低いほうへ合わせることはしない') >= 0);
    /* **公報から確定できないものは、この頁に書かない。**史料ノート自身が
     * 最終階級・乗艦・配置を確定できないと述べている。
     * ただし断りの節は、それらの語を引いて説明する必要がある。**引くことと
     * 断定することは別なので、断りの節を外してから探す。** */
    const i0 = h.indexOf('id="elsewhere"');
    const i1 = i0 >= 0 ? h.indexOf('</section>', i0) : -1;
    const outside = (i0 >= 0 && i1 >= 0) ? h.slice(0, i0) + h.slice(i1) : h;
    ok('断りの節を切り出せる', i0 >= 0 && i1 > i0);
    const OVERCLAIM = ['少佐', '愛国丸', '機関長', '中佐', '大佐'];
    const found = OVERCLAIM.filter((w) => outside.indexOf(w) >= 0);
    ok('断りの節の外で、公報から確定できないものを断定していない',
       found.length === 0, found.join(' '));
  }
}

/* ------------------------------------------------- 10.56 出さないと書いた頁が、出すと決めた日に何を残したか
 *
 * **方針が変わったとき、いちばん都合がいいのは古い理由を消すことである。**
 * 消せば、はじめから出すつもりだったように読める。三つの理由はそのまま残し、
 * そのうち決定で変わらないものを名指しする。却下の見込みも、結果が出る前に置く。
 */
section('10.56 割愛の頁が、方針の変更を隠していないか');

{
  const v = read('venues.html');
  ok('出すことに決めたと書いてある',
     v.indexOf('<b>2026年9月9日、著者が出すことに決めた。</b>') >= 0);
  ok('出さなかった三つの理由を消していない',
     ['一つめ。推薦が要る', '二つめ。残った内容に新しい結果が無い',
      '三つめ。経緯を説明する機会が無い'].every((w) => v.indexOf(w) >= 0));
  ok('決定で変わらない理由を名指ししている',
     v.indexOf('<b>二つめには片付け方が無い。</b>') >= 0
     && v.indexOf('出すと決めたことと、新しい結果があることは別である') >= 0);
  ok('却下の見込みを結果より先に書いたと述べている',
     v.indexOf('<b>却下される見込みのほうを、結果が出る前に書いてある。</b>') >= 0);
  ok('通っても新規性の証明にならないと書いてある',
     v.indexOf('<b>通ったとしても、通ったことは新規性の証明にならない。</b>') >= 0);
  ok('合う場が無いまま出すと表に書いてある',
     v.indexOf('<b>合う場は無い。それでも arXiv に出す</b>') >= 0
     && v.indexOf('<b>合わないと分かったうえで出す。</b>') >= 0);
  ok('経緯の置き場を指している',
     v.indexOf('trinity-infinity/blob/main/ARXIV.md') >= 0);
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
  const v = read('venues.html');
  ok('抜け道ではないと書いてある', v.indexOf('抜け道ではない') >= 0);
  ok('頁の表示を確かめていないと書いてある',
     v.indexOf('作業環境から開けないので確かめていない') >= 0);
  const ve = read('venues.en.html');
  ok('英語版も抜け道ではないと書いてある',
     ve.indexOf('not a way around anything') >= 0);
  ok('英語版も頁の表示を確かめていないと書いてある',
     ve.indexOf('has not been confirmed, because it cannot be opened') >= 0);
}

/* ------------------------------------------------- 10.59 英語版が、日本語版と同じ確度で書いてあるか
 *
 * **訳したときに、いちばん先に落ちるのは断りである。**断りは本文より短く、
 * 論旨に効かないように見えるからである。先祖の頁の守りは、ほとんどが断りで
 * できている —— 同一性を主張しない、戸籍の写しを出さない、確定できないものを
 * 書かない、訂正の申し出を受ける。**英語版でそれが一つでも落ちれば、
 * 守りはそこから崩れる。**
 *
 * だから日本語版と同じ数だけ、英語版にも当てる。**片方だけ直すと落ちる。**
 */
section('10.59 英語版が、日本語版と同じ確度で書いてあるか');

{
  const e = read('lineage.en.html');
  ok('英語の先祖の頁がある', e !== null);
  ok('根拠を段階に分けている',
     e.indexOf('What can be said') >= 0 && e.indexOf('<b>Document</b>') >= 0
     && e.indexOf('Testimony') >= 0 && e.indexOf('This page does not assert it') >= 0);
  ok('同一性を主張しないと書いてある',
     e.indexOf('Declining to assert identity is the heaviest reservation on this page') >= 0
     && (e.match(/This page does not assert it/g) || []).length >= 2);
  ok('戸籍の写しと本籍を出さないと書いてある',
     e.indexOf('Copies or transcriptions of the family register, and the registered domicile') >= 0
     && e.indexOf('What is published stops at the fact that it was consulted') >= 0);
  ok('存命の人物を挙げていないと書いてある',
     e.indexOf('No living person is named at all') >= 0);
  ok('原典の本文と図版を転載していないと書いてある',
     e.indexOf('Neither text nor images nor page numbers are reproduced') >= 0);
  ok('原資料の画像を置かないと書いてある',
     e.indexOf('No image of the source document is posted') >= 0);
  ok('訂正と削除の申し出先がある',
     e.indexOf('Requests to correct or remove anything on this page are accepted') >= 0
     && e.indexOf('it is checked and then corrected or taken down') >= 0
     && e.indexOf('No reason need be given') >= 0);
  ok('法的な判断を述べないと書いてある',
     e.indexOf('This page states no legal conclusion') >= 0);
  ok('著者の仕事の根拠にしないと書いてある',
     e.indexOf("This page says nothing about the author's work") >= 0);
  ok('同名異人の可能性を残している', e.indexOf('The possibility of a namesake') >= 0);
  /* **伝聞の範囲を、伝聞そのものより広く書かない。**
   * 祖父から聞いたのは「議員であった」までである。刊本 2 件を挙げたのは祖父ではない。
   * 一度、刊本との結びつけまで祖父の伝聞として書いた。 */
  ok('祖父の証言が刊本に及んでいないと書いてある',
     e.indexOf('The two printed books were not cited by the grandfather') >= 0
     && e.indexOf("Joining the two is not the grandfather's testimony") >= 0);
  ok('肩書きの形を著者によるものとして分けてある',
     e.indexOf("What the grandfather said reached only as far as") >= 0);
  ok('別の媒体との差について断りがある',
     e.indexOf('A different account, in a different medium') >= 0
     && e.indexOf('That medium cannot be opened from the working environment') >= 0);
  ok('確度の低いほうへ合わせないと書いてある',
     e.indexOf('will not be brought down to the weaker grade') >= 0);
  /* **本籍は、それ自体が出してはならない欄である。**語として出てよいのは
   * 「出さない」と宣言する箇所だけである。日本語版（10.54）にはこの検査が
   * あったが、英語版には無かった。訳すときに落ちたのはこれ一つである。 */
  ok('本籍を実際に書いていない',
     (e.match(/domicile/g) || []).length === 1,
     String((e.match(/domicile/g) || []).length));

  /* この頁が指している外部の点検に、第三者の氏名が残っていないこと。
   * **引用であっても、公開しているのはこのリポジトリである。**
   * ここが留めるのは伏せ字が残っていることだけで、別の氏名が新たに
   * 入るのは捕まえられない。人名を機械で数え上げる方法が無いためである。 */
  const ev = read('docs/external-evaluations.md');
  ok('外部の点検の引用で、第三者の氏名を伏せてある',
     ev.indexOf('〔氏名を伏せた一名〕') >= 0 && ev.indexOf('小島') < 0);

  /* 断りの節の外で、公報から確定できないものを断定していないこと。
   * 日本語版と同じ切り出し方をする。 */
  const i0 = e.indexOf('id="elsewhere"');
  const i1 = i0 >= 0 ? e.indexOf('</section>', i0) : -1;
  const outside = (i0 >= 0 && i1 >= 0) ? e.slice(0, i0) + e.slice(i1) : e;
  ok('断りの節を切り出せる', i0 >= 0 && i1 > i0);
  const OVERCLAIM = ['Lieutenant Commander', 'Aikoku Maru', 'chief engineer',
                     'Commander', 'Captain'];
  const found = OVERCLAIM.filter((w) => outside.indexOf(w) >= 0);
  ok('断りの節の外で、公報から確定できないものを断定していない',
     found.length === 0, found.join(' '));

  /* 割愛の頁。方針の変更を隠していないことを、英語でも留める。 */
  const w = read('venues.en.html');
  ok('英語の割愛の頁がある', w !== null);
  ok('出すことに決めたと書いてある',
     w.indexOf('<b>On 9 September 2026 the author decided to post it.</b>') >= 0);
  ok('出さなかった三つの理由を消していない',
     ['First. An endorsement is required',
      'Second. What survives contains no new result',
      'Third. There is no occasion to explain how it came about']
       .every((x) => w.indexOf(x) >= 0));
  ok('決定で変わらない理由を名指ししている',
     w.indexOf('<b>The second has no way to deal with it.</b>') >= 0
     && w.indexOf('Deciding to post and having a new result are separate') >= 0);
  ok('却下の見込みを結果より先に書いたと述べている',
     w.indexOf('The expectation of rejection is written down before the outcome is known') >= 0);
  ok('通っても新規性の証明にならないと書いてある',
     w.indexOf('acceptance is not proof') >= 0);
  ok('どの場も査読ではないと書いてある',
     w.indexOf('<b>None of these is peer review.</b>') >= 0
     && w.indexOf('Nor does having a DOI mean anything was peer reviewed') >= 0);
  ok('規則の記述が未確認であると書いてある',
     w.indexOf('Every source below was taken from search results') >= 0
     && w.indexOf('The descriptions of the rules are unconfirmed') >= 0);
  ok('経緯の置き場を指している',
     w.indexOf('trinity-infinity/blob/main/ARXIV.md') >= 0);

  /* **基準を通ったことと、分野が受理したことは別である。**
   * PhilArchive は「専門職の水準」を明文にしているが、同じ運営者が 2017年に
   * 「査読はしない」と書いている。**片方だけを引けば、強くも弱くもできる。**
   * 両方が載っていること、三段の切り分けが残っていることを留める。 */
  const v2 = read('venues.html');
  ok('運営者が査読しないと書いていることを載せている',
     v2.indexOf('査読されない') >= 0
     && v2.indexOf('質と関連性の最小限の基準') >= 0);
  ok('英語版も運営者の言葉を載せている',
     w.indexOf('not peer reviewed') >= 0
     && w.indexOf('minimal standards of quality and relevance') >= 0);
  ok('三段を分けている',
     v2.indexOf('基準を通ったことは、分野が専門職の仕事として受理したことではない') >= 0
     && v2.indexOf('professional author') >= 0);
  ok('英語版も三段を分けている',
     w.indexOf('not the field accepting the work as professional work') >= 0
     && w.indexOf('professional author') >= 0);
  /* **確かめられなかったことを、確かめたことにしない。** */
  ok('投稿の引き金を断定していない',
     v2.indexOf('順序を断定しない') >= 0
     && w.indexOf('The order is not asserted here') >= 0);

  /* **到達の主張と、その限界は、離してはならない。**
   * 「独学と Claude だけで SSRN と PhilArchive を通った」は、そこで切ると
   * 分野が受理したように読める。**限界のほうが消えたら落ちる。** */
  ok('独学で通ったことを書いている',
     v2.indexOf('三篇は、独学で書いている') >= 0
     && v2.indexOf('三篇は <b>PhilArchive に載っている</b>') >= 0);

  /* **門があることと、何を見ているかは別である。**
   * SSRN が見るのは射程・体裁・最低限の学術性・研究公正であって、
   * 方法の当否でも内容の実質でもない。そこが消えると、
   * 「事前審査を通った」が中身を通ったように読める。 */
  ok('門がどこまで見ているかを書いてある',
     v2.indexOf('方法の当否も、内容の実質も見ない') >= 0
     && v2.indexOf('論証の当否は見ない') >= 0);
  ok('英語版も門がどこまで見ているかを書いてある',
     w.indexOf('Neither the soundness of the method nor the substance') >= 0
     && w.indexOf('Not whether the argument holds') >= 0);

  /* **一篇は審査を経ていない。**「門を通った」と書けるのは門が下りた場合だけである。
   * これは著者の証言であって紙面ではない。**その区別ごと留める。** */
  ok('審査を経ていない一篇があると書いてある',
     v2.indexOf('三篇のうち一篇は、審査を経ていない') >= 0
     && v2.indexOf('アカウントが公開されたのと同時に、そのまま出た') >= 0);
  ok('それが証言であると断っている',
     v2.indexOf('著者の証言である') >= 0
     && v2.indexOf('紙面では確かめられない') >= 0);
  ok('英語版も審査を経ていない一篇を書いている',
     w.indexOf('One of the three went through no screening at all') >= 0
     && w.indexOf("This is the author's testimony") >= 0);

  /* **言い換えると弱くも強くもなる。**明文はそのまま置く。
   * 要約だけになったら落ちる。 */
  ok('門の明文をそのまま置いている',
     v2.indexOf('SSRN does not peer review preprints') >= 0
     && v2.indexOf('minimal standards of quality and relevance') >= 0
     && v2.indexOf('All books and papers submitted should be of professional quality') >= 0);
  ok('英語版も門の明文をそのまま置いている',
     w.indexOf('SSRN does not peer review preprints') >= 0
     && w.indexOf('minimal standards of quality and relevance') >= 0);

  /* **一篇で門が下りなかった以上、残り二篇で下りたと決めてかかれない。**
   * 三篇まとめて「通った」に戻す壊し方を、ここで止める。 */
  /* **三篇は一様ではない。**同じ場に同じ著者が出したものでも、門が下りた二篇と、
   * 下りなかった一篇がある。**まとめて「通った」とも「通っていない」とも書かない。**
   * 一度まとめて「通った」と書き、次にまとめて「分かっていない」と書いた。両方とも誤りだった。 */
  ok('三篇が一様でないと書いてある',
     v2.indexOf('残る二篇は、PhilArchive の側でも門が下りている') >= 0
     && v2.indexOf('三篇が一様ではない') >= 0
     && v2.indexOf('まとめて「通った」とも、まとめて「通っていない」とも書かない') >= 0);
  ok('英語版も三篇が一様でないと書いてある',
     w.indexOf('a gate did come down on the PhilArchive side') >= 0
     && w.indexOf('The three are not uniform') >= 0);

  /* **到達点は、明文の段差ごと書く。**SSRN の方針は
   * `rigorous methodology and original findings` を掲げているが、手続きは
   * `does not peer review` である。**前者だけを引くと、方法が確かめられたように読める。**
   * 同じ運営者の言葉が二つあることを、対で留める。 */
  ok('SSRN の明文の水準を引いている',
     v2.indexOf('rigorous methodology and original findings') >= 0);
  ok('その水準が確かめられたのではないと書いてある',
     v2.indexOf('明文の中に段差がある') >= 0
     && v2.indexOf('二篇が通ったのは後者の手続きであって、前者が確かめられたのではない') >= 0);
  ok('英語版も段差を書いている',
     w.indexOf('rigorous methodology and original findings') >= 0
     && w.indexOf('There is a step inside the published wording') >= 0
     && w.indexOf('What the two\npapers passed is the procedure') >= 0);

  /* **どこまでを到達点と呼べるかの上限。**ここが消えると、表が資格の証明に見える。 */
  ok('到達点の上限を書いてある',
     v2.indexOf('到達点として言えるのは、上の表の「満たしたということ」の列までである') >= 0
     && /What can be claimed as attainment reaches exactly as far as/.test(w));

  /* 具体の除外基準。**「学術性」だけでは何も言っていないのと同じである。** */
  ok('通らないものを具体に名指ししている',
     v2.indexOf('articles with no references') >= 0
     && w.indexOf('articles with no references') >= 0);

  /* 三篇それぞれの識別子。**まとめて書くと、どれが何かが消える。** */
  ok('三篇それぞれの識別子を出している',
     ['NEMTNA', 'NEMMOI', 'NEMFSI', '10.2139/ssrn.7358779', '10.2139/ssrn.7358818']
       .every((x) => v2.indexOf(x) >= 0 && w.indexOf(x) >= 0));
  /* **道具は特定できない、と正誤表が書いている。**頁がそこに名前を一つだけ
   * 挙てれば、同じ生態系の正誤表（E5）と食い違う。一度そう書いて公開した。 */
  ok('使った道具を特定していないと書いてある',
     v2.indexOf('どの道具を使ったかは特定できない') >= 0
     && v2.indexOf('名前を一つだけ挙げることはしない') >= 0);
  ok('英語版も道具を特定していないと書いてある',
     w.indexOf('Which tools cannot be identified') >= 0
     && w.indexOf('No single name is given here') >= 0);
  {
    /* **道具の名前を一つだけ挙げた形が、どこにも無いこと。** */
    const SOLE = ['Claude だけ', 'Claude のみ', 'Claude alone', 'Claude only'];
    const hit = SOLE.filter((x) => v2.indexOf(x) >= 0 || w.indexOf(x) >= 0);
    ok('道具の名前を一つだけ挙げていない', hit.length === 0, hit.join(' '));
  }
  ok('独学で通ったことに限界が添えてある',
     v2.indexOf('門が下りた分についても、それは受け付けの門である') >= 0
     && v2.indexOf('独学で出せることと、分野が受理することは別である') >= 0);
  ok('英語版も独学で通ったことを書いている',
     w.indexOf('written by self-study') >= 0);
  ok('英語版も限界が添えてある',
     w.indexOf('Where a gate did come down, it is a gate on acceptance') >= 0
     && w.indexOf('Getting work out by self-study and') >= 0);
  /* 大学で哲学を履修していることと食い違わせない。**「独学のみ」とは書かない。** */
  ok('大学で履修していることと食い違わせていない',
     v2.indexOf('大学で哲学は履修しているが') >= 0
     && /Philosophy is taken at\s+university/.test(w));

  /* 日本語版と英語版で、節の数が同じであること。**片方だけ節を足すと落ちる。** */
  const count = (h) => (h.match(/<section id="/g) || []).length;
  ok('先祖の頁の節の数が日本語版と同じ',
     count(e) === count(read('lineage.html')),
     'en ' + count(e) + ' / ja ' + count(read('lineage.html')));
  ok('割愛の頁の節の数が日本語版と同じ',
     count(w) === count(read('venues.html')),
     'en ' + count(w) + ' / ja ' + count(read('venues.html')));

  /* 互いへの導線。**片方からしか行けないと、片方は読まれない。** */
  ok('日本語の先祖の頁から英語版へ行ける', read('lineage.html').indexOf('./lineage.en.html') >= 0);
  ok('英語の先祖の頁から日本語版へ行ける', e.indexOf('./lineage.html') >= 0);
  ok('日本語の割愛の頁から英語版へ行ける', read('venues.html').indexOf('./venues.en.html') >= 0);
  ok('英語の割愛の頁から日本語版へ行ける', w.indexOf('./venues.html') >= 0);
  ok('英語のトップから英語の先祖の頁へ行ける',
     read('index.en.html').indexOf('./lineage.en.html') >= 0);

  /* **訳を公式名のように出さない。**英語の科目名 11 件は、こちらで訳したもので
   * あって大学の英語表記ではない。公式のシラバスは作業環境から開けないので、
   * 突き合わせていない。断りが消えたら落ちる。頁と README の両方に当てる ——
   * **片方だけに出しても、もう片方を読んだ人は公式名だと思う。** */
  const CAVEAT = 'unofficial translations, not the university';
  const OFFICIAL = 'official English titles have not been checked';
  ok('英語のトップが、科目名は公式名ではないと断っている',
     read('index.en.html').indexOf(CAVEAT) >= 0
     && read('index.en.html').indexOf(OFFICIAL) >= 0);
  ok('英語の README が、科目名は公式名ではないと断っている',
     read('README.en.md').indexOf(CAVEAT) >= 0
     && read('README.en.md').indexOf(OFFICIAL) >= 0);

  /* 学部名は英語にした。**検索結果が一致して公式の英語頁に帰しているが、頁そのものは
   * 開けていない。**だから名前だけでなく、その出所の断りも一緒に留める。
   * 断りが消えて名前だけが残る形が、いちばん強く読める形である。 */
  ok('英語の学部名を英語で出している',
     read('index.en.html').indexOf('ZEN University, Faculty of Social Informatics') >= 0
     && read('README.en.md').indexOf('ZEN University, Faculty of Social Informatics') >= 0);
  ok('学部名の出所を断っている',
     read('index.en.html').indexOf("the form the university's English pages\nare reported to use") >= 0
     || /the form the university's English pages\s+are reported to use/.test(read('index.en.html')));
  ok('英語の頁に学科の段を作っていない',
     read('index.en.html').indexOf('Department of') < 0);
  /* 日本語の側は日本語のままであること。**片方だけ直すと食い違う。** */
  ok('日本語の頁は日本語のまま出ている',
     read('index.html').indexOf('知能情報社会学部 知能情報社会学科') >= 0
     && read('README.md').indexOf('知能情報社会学部 知能情報社会学科') >= 0);

  /* **根幹の一段は、自己紹介の中に置く。**下のほうに置けば読み手は辿り着かない。
   * そして、そこから限界への導線が切れていないこと —— 到達点だけが残る形にしない。 */
  ok('根幹の一段が自己紹介にある',
     read('index.html').indexOf('ここにあるものの根幹は、独学と、言語モデルを使って進めたことである') >= 0
     && /What is here rests on self-study and on working with language models/
          .test(read('index.en.html')));
  ok('根幹の一段から限界へ辿れる',
     read('index.html').indexOf('./venues.html') >= 0
     && read('index.html').indexOf('通ったのは受け付けの門であって査読ではなく') >= 0
     && read('index.en.html').indexOf('./venues.en.html') >= 0
     && read('index.en.html').indexOf('not peer review') >= 0);

  /* **通過基準・到達点・導けないもの、この三つは自己紹介の中で揃っている。**
   * 頁の外に送ると、到達点だけが読まれる。基準を書かずに到達点だけ書けば
   * 何を通したのか分からず、限界を書かなければ査読を通ったように読める。
   * 三つのうち一つでも消えたら落ちる。 */
  {
    const ja = read('index.html'), en = read('index.en.html');
    /* **大学の単位は独学ではない。**この段のすぐ下に単位の表が並ぶので、
     * 断らなければ、授業で得た単位まで独学の成果として読まれる。
     * 頁と README の両方に当てる —— README は表も同じ並びで出る。 */
    ok('大学の単位が独学ではないと書いてある',
       ja.indexOf('ただし、大学の単位は独学ではない') >= 0
       && ja.indexOf('授業を受け、課題を出し、評価を受けて得たものである') >= 0
       && ja.indexOf('独学と言語モデルの話は、その外にある') >= 0);
    ok('英語版も大学の単位が独学ではないと書いてある',
       en.indexOf('The university credits, though, are not\nself-study') >= 0
       || /The university credits, though, are not\s+self-study/.test(en));
    ok('GitHub のプロフィールにも単位の断りがある',
       read('README.md').indexOf('ただし、大学の単位は独学ではない') >= 0
       && /The university credits, though, are not\s+self-study/.test(read('README.en.md')));

    ok('自己紹介に通過基準が具体に書いてある',
       ja.indexOf('通した基準は、明文で次のとおりである') >= 0
       && ja.indexOf("part of the world-wide scholarly discourse") >= 0
       && ja.indexOf('professional quality') >= 0
       && ja.indexOf('参考文献の無い非学術的なものでないこと') >= 0);
    ok('自己紹介に到達点の質が書いてある',
       ja.indexOf('そこから導ける到達点は、はっきりしている') >= 0
       && ja.indexOf('その分野の学術的言説の一部として扱われた') >= 0);
    ok('自己紹介に導けないものが書いてある',
       ja.indexOf('そこから導けないものも、はっきりしている') >= 0
       && ja.indexOf('論証が正しいことは、どちらの門も見ていない') >= 0);
    ok('英語版も三つが揃っている',
       en.indexOf("The bar that was cleared, in the venues' own wording") >= 0
       && en.indexOf('What follows from that is definite') >= 0
       && en.indexOf('What does not follow is equally definite') >= 0
       && en.indexOf('articles with no references') >= 0);
    /* **SSRN で確かめられたのは二篇である。**三篇に広げると、門が下りていない一篇を含む。 */
    ok('到達点を三篇に広げていない',
       ja.indexOf('二篇について、公開前に人が見て、落とさなかった') >= 0
       && en.indexOf('For two papers, a person looked before publication') >= 0);

    /* **PhilArchive の側を省略しない。**SSRN だけ細かく書くと、
     * 厳しいほうの門だけを見せていることになる。同じ深さで並べる。 */
    ok('PhilArchive の基準を省略していない',
       ['works of all types (articles, books, dissertations)',
        'cross-disciplinary and of clear interest to philosophers',
        'All books and papers submitted should be of professional quality',
        'reject any submissions',
        '事前ではなく事後に効く'].every((x) => ja.indexOf(x) >= 0));
    ok('英語版も PhilArchive の基準を省略していない',
       ['works of all types (articles, books, dissertations)',
        'cross-disciplinary and of clear interest to philosophers',
        'All books and papers submitted should be of professional quality',
        'reject any submissions',
        'after the fact, not before'].every((x) => en.indexOf(x) >= 0));

    /* **GitHub のプロフィールは、頁とは別の入口である。**
     * 頁にだけ出て README に出ない状態が実際に起きた —— readme_courses.js が
     * profile-core を拾っていなかった。**写す仕組みごと留める。** */
    const rj = read('README.md'), re_ = read('README.en.md');
    ok('GitHub のプロフィールに根幹の一段がある',
       rj.indexOf('ここにあるものの根幹は、独学と、言語モデルを使って進めたことである') >= 0
       && re_.indexOf('What is here rests on self-study and on working with language models') >= 0);
    ok('GitHub のプロフィールに通過基準と到達点がある',
       rj.indexOf('part of the world-wide scholarly discourse') >= 0
       && rj.indexOf('All books and papers submitted should be of professional quality') >= 0
       && rj.indexOf('そこから導ける到達点は、はっきりしている') >= 0
       && rj.indexOf('そこから導けないものも、はっきりしている') >= 0);
  }
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
