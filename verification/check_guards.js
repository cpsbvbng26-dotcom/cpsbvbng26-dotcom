/* 検査そのものを検査する。
 *
 *   node verification/check_guards.js
 *
 * **検査の道具は、通ることでは信用できない。**何も見ていなくても全部通る
 * からである。そこで、通る状態を一つずつ壊し、**壊したところがちょうど
 * 落ちること**を確かめる。落ちなければ、その検査は何も見ていない。
 *
 * errata-check の tests/check_tool.py と同じ考え方である。あちらは Python の
 * 道具に当てている。こちらは JS の検査（サイト・配色・作用素）に当てる。
 * 約 500 項目が「通っている」という理由だけで信用されていた。
 *
 * やり方。リポジトリを一度だけ複製し、場合ごとに一つのファイルを書き換え、
 * 検査を走らせ、書き戻す。**本物のリポジトリには触らない。**
 *
 * 落とし穴が一つある。**<style> の中を書き換えると、CSP のハッシュが合わなくなり、
 * ブラウザは配色ごと丸ごと捨てる。**壊したつもりが、全部が既定の見た目に戻って
 * 通ってしまう。ここで壊す先は字面を読む検査に限ってあるので当たらないが、
 * ブラウザを起こす検査を壊すときは update_csp.js を挟むこと。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

let pass = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { console.log('  OK   ' + label + (detail ? '  ' + detail : '')); pass++; return; }
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  failures.push(label);
}
function section(n) { console.log('\n' + n); }

/* ---------- 複製 ---------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'guards-'));
const COPY = path.join(TMP, 'site');
execFileSync('cp', ['-a', ROOT, COPY]);

function run(script) {
  const r = spawnSync('node', [path.join(COPY, 'verification', script)],
                      { cwd: COPY, encoding: 'utf8' });
  const bad = (r.stdout || '').split('\n')
    .filter((l) => l.trim().startsWith('FAIL'))
    .map((l) => l.trim().slice(4).trim());
  return { code: r.status, bad };
}

/* 一箇所だけ書き換えて走らせ、書き戻す。 */
function broken(file, mutate, script) {
  const p = path.join(COPY, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = mutate(before);
  if (after === before) return { code: -1, bad: ['書き換えが効いていない: ' + file] };
  fs.writeFileSync(p, after);
  try {
    return run(script);
  } finally {
    fs.writeFileSync(p, before);
  }
}

const swap = (from, to) => (s) => s.split(from).join(to);

/* ---------- 壊す前に、通ることを確かめる ---------- */
section('0. 壊す前');

['check_site.js', 'check_contrast.js', 'check_trinity.js'].forEach((s) => {
  const r = run(s);
  ok('複製した状態で ' + s + ' が通る', r.code === 0, r.bad.slice(0, 2).join(' / '));
});

/* ---------- 壊す ---------- */
section('1. 壊した箇所がちょうど落ちるか');

const CASES = [
  ['sitemap の lastmod を古くすると落ちる', 'sitemap.xml',
   (s) => s.replace(/<lastmod>2026-09-\d\d<\/lastmod>/, '<lastmod>2020-01-01</lastmod>'),
   'check_site.js', 'lastmod が git の記録より古くない'],

  ['CSP のハッシュを一つ変えると落ちる', 'index.html',
   (s) => s.replace(/'sha256-([A-Za-z0-9+/=]{10})/, "'sha256-AAAAAAAAAA"),
   'check_site.js', 'CSP'],

  ['核の頁に、置かないと決めた語を入れると落ちる', 'index.html',
   swap('</h1>', '</h1><p>コンサルタント</p>'),
   'check_site.js', '本文の核に置かないと決めたもの'],

  ['JS 無しで本文を隠すと落ちる', 'index.html',
   swap('.js .reveal { opacity: 0;', '.reveal { opacity: 0;'),
   'check_site.js', 'JS 無しで本文を隠していない'],

  ['暗い側の二つの指定を食い違わせると落ちる', 'index.html',
   (s) => s.replace('--bg: #121214;', '--bg: #121215;'),
   'check_site.js', '暗い側の二つの指定が一字一句同じ'],

  ['トップから三篇の結論を消すと落ちる', 'index.html',
   swap('枠組みは残らなかった', '（削除）'),
   'check_site.js', '枠組みは残らなかった'],

  ['配っている頁へのリンクを壊すと落ちる', 'index.html',
   swap('href="./cv.html"', 'href="./cv-none.html"'),
   'check_site.js', 'リンク'],

  ['本文の色を薄くすると配色が落ちる', 'index.html',
   (s) => s.replace('--muted: #63636b;', '--muted: #c9c9cf;'),
   'check_contrast.js', ''],

  ['作用素の照合用の数値をずらすと落ちる', 'verification/trinity_fixtures.json',
   (s) => s.replace('0.5025', '0.5026'),
   'check_trinity.js', ''],

  /* 以下の三つは、Tab で辿ったときに出た不備に当てている。
   * check_keyboard.js はブラウザを起こすので、ここでは字面を見る側だけを壊す。 */

  ['焦点の入った塊をすぐ出す指定を消すと落ちる', 'index.html',
   swap('.js .reveal:focus-within { opacity: 1; transform: none; transition: none; }', ''),
   'check_site.js', '焦点の入った塊をすぐ出す'],

  ['焦点の枠を消すと落ちる', 'trinity.html',
   swap('.mcell:focus-visible { border-color: var(--accent); }',
        '.mcell:focus { outline: none; border-color: var(--accent); }'),
   'check_site.js', '焦点の枠を消している頁が無い'],

  ['見出しの階層を飛ばすと落ちる', 'research.html',
   swap('<h2 class="serif">リンク</h2>', '<h4 class="serif">リンク</h4>'),
   'check_site.js', '見出しが階層を飛ばさない'],

  ['外部の点検に第三者の氏名を戻すと落ちる', 'docs/external-evaluations.md',
   swap('〔氏名を伏せた一名〕', '小島勤'),
   'check_site.js', '第三者の氏名を伏せてある'],

  ['英語の科目名から断りを消すと落ちる', 'index.en.html',
   swap("unofficial translations, not the university's own", 'official titles'),
   'check_site.js', '科目名は公式名ではないと断っている'],

  ['英語の README から断りを消すと落ちる', 'README.en.md',
   swap("unofficial translations, not the university's own", 'official titles'),
   'check_site.js', 'README が、科目名は公式名ではないと断っている'],

  ['英語の学部名から出所の断りを消すと落ちる', 'index.en.html',
   swap('are reported to use', 'use'),
   'check_site.js', '学部名の出所を断っている'],

  /* **Claude と名指ししたまま、特定できない断りだけを消す。**
   * 三篇まで Claude が書いたように読める形になる。 */
  ['道具の名前だけ残して断りを消すと落ちる', 'index.html',
   swap('<b>ただし、哲学三篇に何を使ったかは特定できない</b>', '<b>三篇も同じである</b>'),
   'check_site.js', '三篇の道具は特定できないと、同じ段に書いてある'],

  /* **PhilArchive の到達点を、上への指しに戻す。**片方の門だけ空欄になる。 */
  ['PhilArchive の到達点を上への指しに戻すと落ちる', 'index.html',
   swap('<b>PhilArchive では、三篇のうち二篇が、学術哲学の領域にあり、専門職の水準（<code>professional quality</code>）を満たすものとして扱われた。</b>',
        '明文の水準は上のとおりである。'),
   'check_site.js', 'PhilArchive の到達点が書いてある'],

  ['根幹の一段から限界を外すと落ちる', 'index.html',
   swap('通ったのは受け付けの門であって査読ではなく', '査読を受けており'),
   'check_site.js', '自己紹介に導けないものが書いてある'],

  /* **到達点だけを残して基準を消す。**何を通したのか分からないまま、通ったことだけが残る。 */
  ['自己紹介から通過基準を消すと落ちる', 'index.html',
   swap('<b>通した基準は、明文で次のとおりである。</b>', ''),
   'check_site.js', '自己紹介に通過基準が具体に書いてある'],

  /* **到達点を二篇から三篇に広げる。**門が下りていない一篇を含めてしまう。 */
  ['到達点を三篇に広げると落ちる', 'index.html',
   swap('二篇について、公開前に人が見て、落とさなかった',
        '三篇について、公開前に人が見て、落とさなかった'),
   'check_site.js', '到達点を三篇に広げていない'],

  /* **片方の門だけを細かく書く。**厳しいほうだけを見せる形になる。 */
  ['PhilArchive の基準を省くと落ちる', 'index.html',
   swap('<code>cross-disciplinary and of clear interest to philosophers</code>', '学際的なもの'),
   'check_site.js', 'PhilArchive の基準を省略していない'],

  /* **頁にだけ出して README に出さない。**実際に一度そうなった。 */
  ['GitHub のプロフィールから根幹を落とすと落ちる', 'README.md',
   swap('ここにあるものの根幹は、独学と、言語モデルを使って進めたことである', '独学である'),
   'check_site.js', 'GitHub のプロフィールに根幹の一段がある'],

  /* **単位の断りを消す。**すぐ下に単位の表が並ぶので、授業の成果まで独学に読まれる。 */
  ['大学の単位の断りを消すと落ちる', 'index.html',
   swap('<b>ただし、大学の単位は独学ではない。</b>', ''),
   'check_site.js', '大学の単位が独学ではないと書いてある']
];

CASES.forEach(([label, file, mutate, script, expect]) => {
  const r = broken(file, mutate, script);
  const hit = expect ? r.bad.some((b) => b.indexOf(expect) >= 0) : r.bad.length > 0;
  ok(label, r.code === 1 && hit,
     r.bad.length ? ('落ちた: ' + r.bad.slice(0, 2).join(' / ')) : '何も落ちなかった');
});

/* ---------- 数を名乗る ---------- */
section('2. 壊す先の数');

{
  const self = fs.readFileSync(path.join(ROOT, 'verification', 'check_guards.js'), 'utf8');
  const declared = /壊す先は (\d+) 通り/.exec(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'));
  ok('README が名乗る壊す先の数が実際と合う',
     declared !== null && Number(declared[1]) === CASES.length,
     declared ? ('名乗り ' + declared[1] + ' / 実際 ' + CASES.length) : '名乗っていない');
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n' + '-'.repeat(58));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
