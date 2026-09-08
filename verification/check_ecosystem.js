/* 9 つのリポジトリをまたいで、散文が名乗る数と実際の数を突き合わせる。
 *
 *     node verification/check_ecosystem.js
 *
 * 各リポジトリの検査は、自分の中しか見ていない。だから
 * 「errata-check が 63 項目になったのに、サイトが 60 のまま」が起きる。
 * ここはその隙間だけを見る。宣言は verification/ecosystem.json にある。
 *
 * 兄弟ディレクトリに並んでいることを前提にする。ECOSYSTEM_ROOT で変えられる。
 * 一つでも足りなければ終了コードは 1。
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.ECOSYSTEM_ROOT || path.resolve(__dirname, '..', '..');
const DECL = JSON.parse(fs.readFileSync(path.join(__dirname, 'ecosystem.json'), 'utf8'));

let passed = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) { passed++; console.log('  通  ' + label + (detail ? '  ' + detail : '')); }
  else { failures.push(label); console.log('  落  ' + label + (detail ? '  ' + detail : '')); }
}

function read(repo, rel) {
  const p = path.join(ROOT, repo, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

/* ---------- 共通の決めごとが一字一句同じか ---------- */

console.log('\n1. CLAUDE.md の共通部分が、全部のリポジトリで同じか');

const C = DECL['共通の決めごと'];
const blocks = {};
for (const repo of C.repos) {
  const text = read(repo, C.file);
  if (text === null) { blocks[repo] = null; continue; }
  const i = text.indexOf(C.begin);
  const j = text.indexOf(C.end);
  blocks[repo] = (i < 0 || j < 0) ? null : text.slice(i, j + C.end.length);
}
const base = blocks[C.repos[0]];
check(C.file + ' が全部にあり、共通の区間が取れる',
  Object.values(blocks).every((b) => b !== null),
  C.repos.filter((r) => blocks[r] === null).join(', ') || '');
if (base !== null) {
  const diff = C.repos.filter((r) => blocks[r] !== null && blocks[r] !== base);
  check('共通の区間が一字一句同じ', diff.length === 0,
    diff.length ? ('ずれている: ' + diff.join(', ')) : (base.length + ' 文字'));
}

/* ---------- 名乗る数が実際と合うか ---------- */

console.log('\n2. 散文が名乗る数が、実際に走らせた数と合うか');

function actual(spec, label) {
  if (spec.cmd) {
    let out;
    try {
      out = execFileSync(spec.cmd[0], spec.cmd.slice(1),
        { cwd: path.join(ROOT, spec.repo), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      throw new Error('走らせられなかった: ' + spec.repo + ' ' + spec.cmd.join(' '));
    }
    /* 出力の途中にも数は出る（見本を走らせた分など）。
     * 名乗りの元にするのは、最後に出た数 —— そのコマンド自身の合計である。 */
    const ms = [...out.matchAll(new RegExp(spec.regex, 'g'))];
    if (!ms.length) throw new Error('出力から数を取れなかった: ' + spec.repo);
    return parseInt(ms[ms.length - 1][1], 10);
  }
  const text = read(spec.repo, spec.file);
  if (text === null) throw new Error('無い: ' + spec.repo + '/' + spec.file);
  if (spec['数える']) {
    return (text.match(new RegExp(spec['数える'], 'gm')) || []).length;
  }
  const m = new RegExp(spec.regex).exec(text);
  if (!m) throw new Error('見つからない: ' + spec.repo + '/' + spec.file);
  return parseInt(m[1], 10);
}

const truth = {};

for (const item of DECL['数']) {
  let n;
  try { n = actual(item['実際'], item['名前']); }
  catch (e) { check(item['名前'] + '  実際の数が取れる', false, e.message); continue; }
  truth[item['名前']] = n;
  check(item['名前'] + '  実際の数が取れる', true, '実際 ' + n);

  for (const c of item['名乗り']) {
    const text = read(c.repo, c.file);
    const where = c.repo + '/' + c.file;
    if (text === null) { check('  ' + where, false, 'ファイルが無い'); continue; }
    const ms = [...text.matchAll(new RegExp(c.regex, 'g'))];
    if (!ms.length) { check('  ' + where, false, '名乗っている箇所が見つからない  /' + c.regex + '/'); continue; }
    const bad = ms.filter((m) => parseInt(m[1], 10) !== n);
    check('  ' + where, bad.length === 0,
      bad.length ? ('名乗り ' + bad.map((m) => m[1]).join(', ') + ' / 実際 ' + n)
                 : (ms.length + ' 箇所'));
  }
}

/* ---------- 足し算で名乗っている数 ---------- */

console.log('\n3. 足し算で名乗っている数');

for (const item of DECL['和']) {
  const parts = item['足すもの'].map((k) => truth[k]);
  if (parts.some((v) => v === undefined)) {
    check(item['名前'], false, '足す元の数が取れていない');
    continue;
  }
  const n = parts.reduce((a, b) => a + b, 0);
  for (const c of item['名乗り']) {
    const text = read(c.repo, c.file);
    const where = c.repo + '/' + c.file;
    if (text === null) { check(where, false, 'ファイルが無い'); continue; }
    const ms = [...text.matchAll(new RegExp(c.regex, 'g'))];
    if (!ms.length) { check(where, false, '名乗っている箇所が見つからない'); continue; }
    const bad = ms.filter((m) => parseInt(m[1], 10) !== n);
    check(where, bad.length === 0,
      bad.length ? ('名乗り ' + bad.map((m) => m[1]).join(', ') + ' / 実際 ' + parts.join(' + ') + ' = ' + n)
                 : (parts.join(' + ') + ' = ' + n));
  }
}

/* ---------- 写した道具の版と、書いてある DOI ---------- */

console.log('\n4. 写した errata_check.py の版と、そのリポジトリが書いている DOI');

for (const item of DECL['写した版と DOI']) {
  const src = read(item.repo, 'verification/errata_check.py');
  if (src === null) { check(item.repo, false, '写したものが無い'); continue; }
  const m = /__version__\s*=\s*"([^"]+)"/.exec(src);
  check(item.repo + '  写した版が宣言どおり', m !== null && m[1] === item['版'],
    m ? ('写し ' + m[1] + ' / 宣言 ' + item['版']) : '版が読めない');

  const others = DECL['写した版と DOI']
    .map((x) => x.doi).filter((d, i, a) => a.indexOf(d) === i && d !== item.doi);
  const files = ['ERRATA.md', 'verification/audit.toml', 'verification/check_errata.py'];
  const wrong = [];
  let found = 0;
  for (const f of files) {
    const text = read(item.repo, f);
    if (text === null) continue;
    if (text.indexOf(item.doi) >= 0) found++;
    for (const d of others) if (text.indexOf(d) >= 0) wrong.push(f + ' に ' + d);
  }
  check(item.repo + '  版に対応した DOI だけが書いてある',
    found > 0 && wrong.length === 0,
    wrong.length ? wrong.join(', ') : (found + ' ファイルに ' + item.doi));
}

/* DOI の一覧（docs/doi-index.md）と、実際にリポジトリに出てくる番号を突き合わせる。
 * 片方にしか無い番号があれば落ちる。Zenodo に到達できない環境なので、
 * **番号が実在するかは確かめない。**確かめるのは、一覧と実物がずれていないことだけ。 */

console.log('\n5. DOI の一覧と、実際に出てくる番号');

{
  const DOI = /10\.5281\/zenodo\.\d+/g;
  const SKIP = new Set(['.git', 'node_modules', 'site', 'dist', 'pdf', 'venv',
                        '__pycache__', 'assets', 'data']);
  const EXT = ['.md', '.html', '.cff', '.json', '.js', '.py', '.yml', '.toml'];

  function scan(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scan(full, out); continue; }
      if (!EXT.includes(path.extname(e.name))) continue;
      for (const d of fs.readFileSync(full, 'utf8').match(DOI) || []) out.add(d);
    }
  }

  const INDEX = path.join('docs', 'doi-index.md');
  const index = read('cpsbvbng26-dotcom', INDEX);
  const listed = new Set(index === null ? [] : index.match(DOI) || []);

  const found = new Set();
  const seen = [];
  for (const repo of C.repos) {
    const dir = path.join(ROOT, repo);
    if (!fs.existsSync(dir)) continue;
    seen.push(repo);
    scan(dir, found);
  }
  found.delete('');

  const missing = [...found].filter((d) => !listed.has(d)).sort();
  const orphan = [...listed].filter((d) => !found.has(d)).sort();

  check('DOI の一覧がある', index !== null, INDEX);
  check('出てくる番号が、すべて一覧に載っている', index !== null && missing.length === 0,
    missing.length ? ('一覧に無い: ' + missing.join(', '))
                   : (seen.length + ' リポジトリに ' + found.size + ' 種'));
  check('一覧の番号が、すべてどこかに出てくる', index !== null && orphan.length === 0,
    orphan.length ? ('どこにも無い: ' + orphan.join(', ')) : ('一覧 ' + listed.size + ' 種'));
}

/* 外部からの評価の記録。件数を機械で数える。
 * ここを手で書けるようにしておくと、都合の悪い評価だけ落とせてしまう。 */

console.log('\n6. 外部からの評価');

{
  const F = path.join('docs', 'external-evaluations.md');
  const text = read('cpsbvbng26-dotcom', F);
  check('外部からの評価の記録がある', text !== null, F);

  if (text !== null) {
    const sec = text.slice(text.indexOf('## 受けた評価'), text.indexOf('## 出した先'));
    /* 区切り行（| --- | --- |）の次から、| で始まる行が続くあいだが本体である。
     * 見出し行を数えないために、位置で切る。列名で切ると、列名を変えたときに
     * 静かに数え方が変わる —— 実際に一度そうなった。 */
    const lines = sec.split('\n');
    const sep = lines.findIndex((l) => /^\|\s*---/.test(l));
    let rows = 0;
    for (let i = sep + 1; sep >= 0 && i < lines.length; i++) {
      if (!/^\|/.test(lines[i])) break;
      rows++;
    }
    const m = /\*\*いま (\d+) 件。\*\*/.exec(text);
    check('名乗る件数が、表の行数と一致する', m !== null && parseInt(m[1], 10) === rows,
      m ? ('名乗り ' + m[1] + ' / 行 ' + rows) : '「いま NN 件。」が無い');
    check('査読と呼ばないことが書いてある', text.indexOf('査読と呼ばない') >= 0);
    check('丸写ししないことが書いてある', text.indexOf('丸写ししない') >= 0);
    check('褒めた箇所だけ載せないことが書いてある',
      text.indexOf('褒めた箇所だけ載せない') >= 0);
    check('出典が消えるものを証言として扱うと書いてある',
      text.indexOf('出典が消えるものは、証言として扱う') >= 0);
    check('日付を手で書かないと書いてある',
      text.indexOf('日付を手で書かない') >= 0);

    /* 査読の型。改変すると別の手順になるので、三つ揃っていることと
     * 目を塞ぐ決めごとが消えていないことを当たる。 */
    const P = path.join('docs', 'review-prompt.md');
    const prompt = read('cpsbvbng26-dotcom', P);
    check('査読の型がある', prompt !== null, P);
    if (prompt !== null) {
      const kinds = ['## 型 A', '## 型 B', '## 型 C'].filter((k) => prompt.indexOf(k) < 0);
      check('型が三つ揃っている', kinds.length === 0, kinds.join(', ') || '3 つ');
      check('正誤表を渡さないと書いてある', prompt.indexOf('紙面だけを渡す') >= 0);
    }

    /* PlumX は計測であって評価ではない。「受けた評価」に混ぜない。
     * そして数値を転記しない —— 動くし、この環境から確かめられない。 */
    const plum = text.slice(text.indexOf('## 計測されているもの'),
                            text.indexOf('### 経路が二つある'));
    check('PlumX が評価ではないと書いてある',
      text.indexOf('計測であって評価ではない') >= 0);
    check('PlumX の数を書き写さないと書いてある',
      text.indexOf('この記録に転記しない') >= 0);
    const pairs = [['7358818', '10.2139/ssrn.7358818'],
                   ['7358779', '10.2139/ssrn.7358779']];
    const wrong = pairs.filter(([id, doi]) => {
      const row = plum.split('\n').find((l) => l.indexOf('ssrn_id=' + id) >= 0);
      return !row || row.indexOf(doi) < 0;
    }).map(([id]) => id);
    check('PlumX の宛先が、対応する SSRN の DOI と同じ行にある',
      wrong.length === 0, wrong.length ? ('ずれ: ' + wrong.join(', ')) : pairs.length + ' 件');
    const digits = /PlumX[^\n]*?[:：]\s*\d|閲覧\s*\d|ビュー\s*\d|保存\s*\d|言及\s*\d/;
    check('PlumX の数値が転記されていない', !digits.test(plum));
  }
}

/* この検査自身が名乗る件数も、実際と合わせる。
 * 実際に一度ずれている —— 中身を足したのに 62 のまま残っていた。
 * 自分を走らせるわけにはいかないので、ここまでの件数に自分の一件を足して数える。 */

console.log('\n7. この検査が名乗る件数');

{
  const total = passed + failures.length + 1;
  const claims = [
    ['README.md', /9 リポジトリ横断 (\d+) 項目/],
    ['.github/workflows/ecosystem.yml', /9 リポジトリ横断 (\d+) 項目/],
    ['.claude/commands/check.md', /横断のずれ（(\d+) 項目）/],
    ['.claude/commands/開始.md', /check_ecosystem\.js`（(\d+) 項目）/]
  ];
  const wrong = [];
  for (const [f, re] of claims) {
    const text = read('cpsbvbng26-dotcom', f);
    if (text === null) { wrong.push(f + ' が無い'); continue; }
    const m = re.exec(text);
    if (!m) { wrong.push(f + ' に名乗りが無い'); continue; }
    if (parseInt(m[1], 10) !== total) wrong.push(f + ' が ' + m[1]);
  }
  check('この検査が名乗る件数が実際と合う', wrong.length === 0,
    wrong.length ? ('実際 ' + total + ' / ' + wrong.join(', ')) : ('実際 ' + total + ' / 名乗り ' + claims.length + ' 箇所すべて一致'));
}

/* ---------- ここまで ---------- */

console.log('\n' + '-'.repeat(58));
if (failures.length) {
  console.log(passed + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  failures.forEach((f) => console.log('  - ' + f.trim()));
  process.exit(1);
}
console.log(passed + ' 件すべて通りました。');
