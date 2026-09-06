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
const PAGES = ['index.html', 'index.en.html', 'research.html', 'doi.html', '404.html'];
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
PAGES.forEach((page) => {
  const html = read(page);
  const hrefs = [...html.matchAll(/(?:href|src)="\.\/([^"#?]+)/g)].map((m) => m[1]);
  [...new Set(hrefs)].forEach((h) => {
    if (!fs.existsSync(path.join(ROOT, h))) missing.push(page + ' → ' + h);
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
  const link = /href="\.\/doi\.html\?q=([^"]+)"/.exec(sec);

  if (!link) { ok(page + ' に「まとめて解析」リンクがある', false); return; }
  ok(page + ' に「まとめて解析」リンクがある', true);

  const linked = decodeURIComponent(link[1]).split(',').filter(Boolean);
  ok(page + ' のリンクが載せている DOI と一致する',
     JSON.stringify(linked) === JSON.stringify(cardDois),
     'カード ' + cardDois.length + ' 件 / リンク ' + linked.length + ' 件' +
     (cardDois.length === linked.length ? '（順序か中身が違う）' : ''));

  const label = />(\d+|[A-Za-z]+)\s*件の DOI|Analyse all (\w+) DOIs/.exec(sec);
  if (label && label[1] && /^\d+$/.test(label[1])) {
    ok(page + ' のリンクの件数表示が実際と合う', Number(label[1]) === cardDois.length,
       '表示 ' + label[1] + ' / 実際 ' + cardDois.length);
  }
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

  ok('英語 README に「独立研究者」の英訳が残っていない',
     !/Independent Researcher/i.test(enMd));
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

/* ------------------------------------------------------------- 7. ナビ */
section('7. ナビ');

PAGES.filter((p) => p !== '404.html').forEach((page) => {
  const html = read(page);
  ok(page + ' のナビから DOI ページへ行ける', /href="\.\/doi\.html"/.test(html));
});

/* ---------------------------------------------------------- 8. doi.js */
section('8. doi.js');

const js = read('doi.js');
ok('doi.js が読み込まれている', /<script src="\.\/doi\.js"><\/script>/.test(read('doi.html')));
ok('通信するのは既知の 4 ホストだけ',
   (() => {
     const hosts = [...js.matchAll(/fetch\(\s*'https:\/\/([^/']+)/g)].map((m) => m[1]);
     const allowed = ['api.crossref.org', 'api.datacite.org', 'api.openalex.org',
                      'api.semanticscholar.org', 'opencitations.net', 'pub.orcid.org'];
     return hosts.every((h) => allowed.indexOf(h) >= 0);
   })(),
   [...new Set([...js.matchAll(/fetch\(\s*'https:\/\/([^/']+)/g)].map((m) => m[1]))].join(', '));
ok('利用者のメールアドレスを送っていない', !/mailto=/.test(js) && !/@privaterelay/.test(js));

/* ------------------------------------------------------------- 結果 */
console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
