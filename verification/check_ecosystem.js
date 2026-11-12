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
/* 宣言のファイル。既定はこのリポジトリ群のもの。ECOSYSTEM_CONFIG で、ほかの人のリポジトリ群の
 * 宣言を渡せる。そのときは宣言で書ける三つ（共通の区間・名乗る数・足し算の数）だけを走らせる。
 * 4 から先は、このリポジトリ群に固有の検査である。 */
const CUSTOM = process.env.ECOSYSTEM_CONFIG || null;
const DECL = JSON.parse(fs.readFileSync(CUSTOM ? path.resolve(CUSTOM) : path.join(__dirname, 'ecosystem.json'), 'utf8'));

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

for (const item of DECL['数'] || []) {
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

for (const item of DECL['和'] || []) {
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
  /* **足すものの数も、散文が名乗る。**「凍結された三つの成果物」。並べているのは三つなのに
   * 「四つ」と書いたまま残っていた。足すものの数と、語で書いた数を突き合わせる。 */
  const 語 = { '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
              'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6 };
  for (const c of item['数の名乗り'] || []) {
    const text = read(c.repo, c.file);
    const where = c.repo + '/' + c.file + ' の足すものの数';
    if (text === null) { check(where, false, 'ファイルが無い'); continue; }
    const ms = [...text.matchAll(new RegExp(c.regex, 'g'))];
    if (!ms.length) { check(where, false, '名乗っている箇所が見つからない  /' + c.regex + '/'); continue; }
    const bad = ms.filter((m) => 語[m[1]] !== parts.length);
    check(where, bad.length === 0,
      bad.length ? ('名乗り ' + bad.map((m) => m[1]).join(', ') + ' / 実際 ' + parts.length)
                 : (ms[0][1] + ' = ' + parts.length));
  }
}

if (CUSTOM) {
  console.log('\n' + '-'.repeat(58));
  if (failures.length) {
    console.log(passed + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
    failures.forEach((f) => console.log('  - ' + f.trim()));
    process.exit(1);
  }
  console.log(passed + ' 件すべて通りました。');
  process.exit(0);
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
 * **番号が実在するかは確かめない。**確かめるのは、一覧と実物がずれていないことだけ。
 *
 * 475（百本ノック五）。**一覧の番号は一覧自身の中に必ず出てくる。**だから一覧の文書を走査に含めると、
 * 「一覧の番号が、すべてどこかに出てくる」は決して落ちない。一覧の文書は走査から外す。
 * 一覧とは表の行（| で始まる行）のことで、散文の中で触れた番号は一覧に数えない。 */

console.log('\n5. DOI の一覧と、実際に出てくる番号');

const DOI_INDEX = path.join('docs', 'doi-index.md');
function 一覧の番号(re) {
  const index = read('cpsbvbng26-dotcom', DOI_INDEX);
  if (index === null) return null;
  const rows = index.split('\n').filter((l) => l.indexOf('|') === 0).join('\n');
  return new Set((rows.match(re) || []).map((d) => d.toLowerCase()));
}
function 出てくる番号(re, repos) {
  const SKIP = new Set(['.git', 'node_modules', 'site', 'dist', 'pdf', 'venv',
                        '__pycache__', 'assets', 'data']);
  const EXT = ['.md', '.html', '.cff', '.json', '.js', '.py', '.yml', '.toml'];
  const found = new Set();
  const 自分 = path.join(ROOT, 'cpsbvbng26-dotcom', DOI_INDEX);
  const scan = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { scan(full); continue; }
      if (!EXT.includes(path.extname(e.name))) continue;
      if (full === 自分) continue;
      for (const d of fs.readFileSync(full, 'utf8').match(re) || []) found.add(d.toLowerCase());
    }
  };
  for (const repo of repos) {
    const dir = path.join(ROOT, repo);
    if (fs.existsSync(dir)) scan(dir);
  }
  return found;
}
function 一覧と突き合わせる(名, re, repos) {
  const listed = 一覧の番号(re);
  const found = 出てくる番号(re, repos);
  const missing = [...found].filter((d) => listed === null || !listed.has(d)).sort();
  const orphan = listed === null ? [] : [...listed].filter((d) => !found.has(d)).sort();
  check('出てくる' + 名 + 'の番号が、すべて一覧に載っている', listed !== null && missing.length === 0,
    missing.length ? ('一覧に無い: ' + missing.join(', ')) : (found.size + ' 種'));
  check('一覧の' + 名 + 'の番号が、すべて一覧の外のどこかに出てくる', listed !== null && orphan.length === 0,
    orphan.length ? ('どこにも無い: ' + orphan.join(', ')) : ('一覧 ' + (listed ? listed.size : 0) + ' 種'));
}
const 番号の種類 = [
  ['Zenodo ', /10\.5281\/zenodo\.\d+/g, C.repos],
  ['SSRN ', /10\.2139\/ssrn\.\d+/g, C.repos],
  ['Figshare ', /10\.6084\/m9\.figshare\.\d+/g, C.repos],
  /* 411。OSF のプロジェクトの DOI。Sophaxis の mq7za は Sophaxis のリポジトリに出てくるので、十の外の
   * sophaxis も走査に入れる。大文字と小文字を区別しない。 */
  ['OSF ', /10\.17605\/osf\.io\/[a-z0-9]+/gi, C.repos.concat(['sophaxis'])],
];

check('DOI の一覧がある', read('cpsbvbng26-dotcom', DOI_INDEX) !== null, DOI_INDEX);
for (const [名, re, repos] of 番号の種類) 一覧と突き合わせる(名, re, repos);
{
  /* 一覧が名乗る種類の数（「4 種の番号を見ます」）が、ここで見ている種類の数と合う。 */
  const m = /Zenodo・SSRN・Figshare・OSF の (\d+) 種の番号を見ます。/.exec(read('cpsbvbng26-dotcom', DOI_INDEX) || '');
  check('一覧が名乗る、突き合わせる番号の種類の数が実際と合う', m !== null && Number(m[1]) === 番号の種類.length,
    m ? ('名乗り ' + m[1] + ' / 実際 ' + 番号の種類.length) : '名乗りが無い');
}

/* **Zenodo の記録の中身も、十で揃える。**版を出すたびに、Zenodo は .zenodo.json を読んで記録を作る。
 * そこに言語モデル利用の開示が無ければ、決めごと 8 が記録の側で落ちる。2026-11-07 に、七つで欠けていた。
 * 著者は一人で ORCID iD つき、ライセンスは LICENSE と同じ、題は CITATION.cff と同じ名で始まる。 */

console.log('\n5b. Zenodo の記録の中身');

{
  const ずれ = [];
  for (const repo of C.repos) {
    const raw = read(repo, '.zenodo.json');
    if (raw === null) { ずれ.push(repo + ' に .zenodo.json が無い'); continue; }
    let z;
    try { z = JSON.parse(raw); } catch (e) { ずれ.push(repo + ' の .zenodo.json が読めない'); continue; }
    const cff = read(repo, 'CITATION.cff') || '';
    const t = /^title:\s*(?:"([^"]*)"|(.*))$/m.exec(cff) || [];
    const 名 = (x) => String(x || '').trim().split(/\s+/)[0];
    const lic = (read(repo, 'LICENSE') || '').slice(0, 40);
    const 期待 = lic.startsWith('MIT') ? 'mit' : lic.startsWith('Creative Commons Attribution 4.0') ? 'cc-by-4.0' : '?';
    if (!/Claude is not an author\./.test(z.notes || '')) ずれ.push(repo + ' の notes に開示が無い');
    if (!Array.isArray(z.creators) || z.creators.length !== 1 || z.creators[0].orcid !== '0009-0000-1406-0547') ずれ.push(repo + ' の著者');
    if (z.license !== 期待) ずれ.push(repo + ' のライセンス ' + z.license + ' / LICENSE ' + 期待);
    if (!名(z.title) || 名(z.title) !== 名(t[1] || t[2])) ずれ.push(repo + ' の題');
  }
  check('十とも、Zenodo の記録に開示があり、著者・ライセンス・題が引用情報と揃っている',
    ずれ.length === 0, ずれ.length ? ずれ.join(' / ') : C.repos.length + ' 件');
}

/* doi-index が「十のリポジトリのすべてが Zenodo の DOI を持った」と書いている。
 * 四つは「著者自身の Zenodo DOI」の表に、残りは R の表に、名前で載っていることを確かめる。
 * どれかの行が消えれば、文のほうが嘘になるので落ちる。 */
{
  const idx = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md')) || '';
  const own = idx.slice(idx.indexOf('## 著者自身の Zenodo DOI'), idx.indexOf('## 一括置換してはいけない二つ'));
  const rTab = idx.slice(idx.indexOf('## リポジトリの保存版の DOI'), idx.indexOf('## 別の所在にある同一本文'));
  const ownRows = own.split('\n').filter((l) => /^\| \d+ \| `10\.5281\/zenodo\.\d+`/.test(l));
  const rRows = rTab.split('\n').filter((l) => /^\| R\d+ \| `10\.5281\/zenodo\.\d+`/.test(l));
  const 四 = ['errata-check', 'justice-and-algorithms', 'researcher-profile', 'solitary-school'];
  const inOwn = 四.filter((r) => ownRows.some((l) => l.includes(r) || (r === 'justice-and-algorithms' && l.includes('正義論とアルゴリズム'))));
  const 残り = C.repos.filter((r) => !四.includes(r));
  const inR = 残り.filter((r) => rRows.some((l) => l.includes('| ' + r + ' ')));
  const W = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  check('十のリポジトリのすべてに Zenodo の DOI がある、と書いた文が表と合う',
    inOwn.length === 四.length && inR.length === 残り.length
    && idx.includes(W[C.repos.length] + 'のリポジトリのすべてが Zenodo の DOI を持ちました。')
    && idx.includes('残りの' + W[残り.length] + 'つの番号は、「リポジトリの保存版の DOI」の表にあります。'),
    '著者の表 ' + inOwn.length + '/' + 四.length + ' / R の表 ' + inR.length + '/' + 残り.length);
}

/* Zenodo のコミュニティ。所在が、Sophaxis・プロフィールの頁（二言語）・doi-index で同じであり、
 * どこでも「提携ではない」と添えてあること。提携と読める書き方はしない。 */
{
  const URL = 'https://zenodo.org/communities/sophaxis';
  const 所 = [
    ['sophaxis', 'README.md', 'it is not an affiliation with Zenodo'],
    ['cpsbvbng26-dotcom', path.join('notes', 'sophaxis.html'), 'Zenodo との提携ではありません。'],
    ['cpsbvbng26-dotcom', path.join('notes', 'sophaxis.en.html'), 'It is not an affiliation with Zenodo.'],
    ['cpsbvbng26-dotcom', path.join('docs', 'doi-index.md'), 'Zenodo との提携ではありません。'],
  ];
  const 欠け = 所.filter(([r, f, deny]) => { const t = read(r, f); return t === null || !t.includes(URL) || !t.includes(deny); }).map(([r, f]) => r + '/' + f);
  check('Zenodo のコミュニティの所在が四箇所で同じで、どこでも提携ではないと書いてある', 欠け.length === 0, 欠け.length ? 欠け.join(' / ') : 所.length + ' 箇所');
}

/* SSRN と Figshare の DOI は、上の 5 で Zenodo と同じ扱いで突き合わせている。 */

/* **落ちた理由の推定に数を書いた。だから数え直す。**
 * 参考文献の項目数と、版元の記載がある項目数を、紙面の書き起こしから数える。
 * 散文の表と一つでも違えば落ちる。**推定であることは変わらないが、
 * 推定の土台になっている数は動かせない。** */

{
  const F = path.join('docs', 'external-evaluations.md');
  const text = read('cpsbvbng26-dotcom', F);
  const PUB = /(University Press|Univ\. Press|Press|Verlag|Routledge|Penguin|de Gruyter|Simon & Schuster|Brothers|Books|Publishers?|Publishing|Oxford|Cambridge|Harvard|Chicago|Princeton)/;
  const PAPERS = [
    ['独身論（通った）', 'celibate-individual'],
    ['皇帝主義（通った）', 'imperial-selfhood'],
    ['断章論（落ちた）', 'fragmentarian-spiritual-individualism'],
  ];
  const wrong = [];
  for (const [label, slug] of PAPERS) {
    const md = read('autonomy-and-self-cultivation', path.join('papers', slug + '.md'));
    if (md === null) { wrong.push(slug + ' の書き起こしが無い'); continue; }
    const h = /\n#+ *(References|Bibliography|参考文献)[^\n]*\n/i.exec(md);
    if (!h) { wrong.push(slug + ' に参考文献の節が無い'); continue; }
    const lines = md.slice(h.index + h[0].length).split('\n')
      .map((l) => l.trim()).filter((l) => l && l[0] !== '#');
    const items = lines.length;
    const pub = lines.filter((l) => PUB.test(l)).length;
    const row = new RegExp('\\|\\s*' + label + '\\s*\\|\\s*(\\d+)\\s*\\|\\s*\\**(\\d+)\\**\\s*\\|').exec(text || '');
    if (!row) { wrong.push(label + ' の行が無い'); continue; }
    if (parseInt(row[1], 10) !== items) wrong.push(label + ' 項目 名乗り ' + row[1] + ' / 実際 ' + items);
    if (parseInt(row[2], 10) !== pub) wrong.push(label + ' 版元 名乗り ' + row[2] + ' / 実際 ' + pub);
  }
  check('落ちた理由の推定に書いた数が、紙面と合う', wrong.length === 0,
    wrong.length ? wrong.join(' / ') : PAPERS.length + ' 篇');
  check('推定であることを名乗っている',
    text !== null && text.indexOf('これは推定である') >= 0
    && text.indexOf('SSRN がそう判断したという証拠ではありません') >= 0);
}

/* **同じものを、片方は論文と呼び、片方は論文ではないと書いていた。**
 * doi-index.md は「史料ノートであり論文ではない」と書き、naval-gazette-notes の
 * README は見出しを「論文」とし、本文でも二十回そう呼んでいた。
 * 番号は突き合わせていたが、**何と呼んでいるかは突き合わせていなかった。**
 * 呼び方が割れたまま外の場に出すと、出した先と記録が食い違う。 */

{
  const F = path.join('docs', 'doi-index.md');
  const idx = read('cpsbvbng26-dotcom', F);
  check('一覧が海軍公報の一件を史料ノートと呼んでいる',
    idx !== null && idx.indexOf('史料ノートであり論文ではない') >= 0, F);

  const files = [['naval-gazette-notes', 'README.md'],
                 ['naval-gazette-notes', 'CITATION.cff']];
  const called = [];
  for (const [repo, f] of files) {
    const t = read(repo, f);
    if (t === null) { called.push(f + ' が無い'); continue; }
    if (t.indexOf('論文') >= 0) called.push(f);
  }
  check('海軍公報の側も論文と呼んでいない', called.length === 0,
    called.length ? ('論文と呼んでいる: ' + called.join(', ')) : (files.length + ' ファイル'));

  const cff = read('naval-gazette-notes', 'CITATION.cff');
  check('引用情報でも article と名乗っていない',
    cff !== null && cff.indexOf('- type: article') < 0,
    cff === null ? 'CITATION.cff が無い' : 'type: generic');
}

/* **自己分析の欄は、良い側に倒れやすい。**書く側しか気づけない誤りだからである。
 * そこで、置いた数はすべて他のファイルから数え直す。論文の数は papers.json、
 * Zenodo の番号は doi-index.md、登録簿は register.toml。
 * **等級を書ける欄ではないことも、文書自身に書かせる。** */

console.log('\n7. 研究者としての位置');

{
  const F = path.join('docs', 'self-assessment.md');
  const text = read('cpsbvbng26-dotcom', F);
  check('自己分析の文書がある', text !== null, F);

  if (text !== null) {
    /* 限界を先に名乗っていること。**塞がっている射程を黙って広げない。** */
    check('価値を語れないと先に書いてある',
      text.indexOf('ST-002') >= 0
      && text.indexOf('意義の水準では構造的に反証不可能') >= 0
      && text.indexOf('書けないことを埋めません') >= 0);
    check('自称の肩書きでないと書いてある',
      text.indexOf('自称の肩書きを書かない') >= 0
      && text.indexOf('これらは肩書きではない') >= 0 === false
      && text.indexOf('以下の位置づけは肩書きではありません') >= 0);
    check('根拠を三つに分けてある',
      ['`紙面`', '`証言`', '`未確認`'].every((x) => text.indexOf(x) >= 0));
    check('総合点を作らないと書いてある',
      text.indexOf('総合点は作りません') >= 0);
    check('比較の相手を先に定義してある',
      text.indexOf('比較の相手を先に定義します') >= 0);
    check('覆し方が書いてある',
      text.indexOf('## 覆し方') >= 0
      && text.indexOf('査読を通った論文を一篇示せば') >= 0);

    /* 数を他から数え直す。 */
    /* 公開した成果物は、papers.json の篇に doi-index.md の「Zenodo に無い本文」の行を足す。 */
    const papers = (() => {
      const raw = read('researcher-profile', 'papers.json');
      const idx = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md')) || '';
      if (raw === null) return null;
      const i = idx.indexOf('### Zenodo に無い本文');
      const 無い = i < 0 ? 0
        : (idx.slice(i, idx.indexOf('## 削除した所在')).match(/^\| (?!論文 \|)[^-|][^|]* \| (?:SSRN|Figshare) `/gm) || []).length;
      /* 論文の頁をまだ作っていない Zenodo の本文も足す。SSRN の数え直しには入れない（出していない）。 */
      const k = idx.indexOf('### 論文の頁をまだ作っていない本文');
      const 頁なし = k < 0 ? 0
        : (idx.slice(k, idx.indexOf('## 削除した所在')).match(/^\| (?!論文 \|)[^-|][^|]* \| `10\.5281\/zenodo\.\d+` \|/gm) || []).length;
      try { const j = JSON.parse(raw); return (Array.isArray(j) ? j : j.papers).length + 無い + 頁なし; }
      catch (e) { return null; }
    })();
    const zen = (() => {
      const raw = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md'));
      if (raw === null) return null;
      return (raw.match(/^\| \d+ \| `10\.5281\/zenodo\.\d+`/gm) || []).length;
    })();
    /* リポジトリの保存版の DOI（R の行）。成果物の 16 件とは別に数える。混ぜれば、論文の数が増えて見える。 */
    const repoZen = (() => {
      const raw = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md'));
      if (raw === null) return null;
      return (raw.match(/^\| R\d+ \| `10\.5281\/zenodo\.\d+`/gm) || []).length;
    })();
    const reg = (() => {
      const raw = read('self-correction', 'register.toml');
      if (raw === null) return null;
      return (raw.match(/^\[\[entry\]\]/gm) || []).length;
    })();

    /* **aiXiv.science の公式査読を経た論文。**言語モデルの審査で載ったものを、出した先の表から数え直す。
     * 「査読を通った論文」の欄とは混ぜない。混ぜれば、軽い門を重い枠で数えることになる。 */
    {
      const ev = read('cpsbvbng26-dotcom', path.join('docs', 'external-evaluations.md')) || '';
      const 実 = (ev.match(/^\| aiXiv\.science \|[^\n]*\| 審査を経て掲載された。/gm) || []).length;
      const m = /^\| aiXiv\.science の公式査読を経た論文 \|[^|]*\| \*\*(\d+) 篇\*\*/m.exec(text);
      /* README の導入も同じ数を名乗る。**査読の主体を書いた一文と一緒でなければ落とす。** */
      const 和 = /言語モデル五体による公式査読を経た論文が (\d+) 篇あります。学術誌・学会の査読ではありません。/
        .exec(read('cpsbvbng26-dotcom', 'README.md') || '');
      const 英 = /On aiXiv\.science, (\d+) papers? ha(?:s|ve) passed the platform's official review by a panel of five language models\. This is not peer review by a journal or a society\./
        .exec(read('cpsbvbng26-dotcom', 'README.en.md') || '');
      check('aiXiv.science の公式査読を経た論文の数が、出した先の表と合う',
        m !== null && parseInt(m[1], 10) === 実
        && 和 !== null && parseInt(和[1], 10) === 実
        && 英 !== null && parseInt(英[1], 10) === 実
        && /^\| 査読を通った論文 \| 学術誌・学会 \| \*\*0 篇\*\*/m.test(text),
        m ? ('名乗り ' + m[1] + '（README ' + (和 ? 和[1] : '無し') + ' / ' + (英 ? 英[1] : '無し') + '） / 実際 ' + 実) : '欄が無い');
    }

    const rows = [['公開した成果物', papers, '篇'],
                  ['Zenodo の DOI', zen, '件'],
                  ['リポジトリの保存版の DOI', repoZen, '件'],
                  ['登録簿', reg, '件']];
    const wrong = [];
    for (const [label, actual, unit] of rows) {
      if (actual === null) { wrong.push(label + ' を数えられない'); continue; }
      if (text.indexOf('**' + actual + ' ' + unit + '**') < 0) {
        wrong.push(label + ' 実際 ' + actual + unit + ' が書かれていない');
      }
    }
    /* **地の文の篇の数も、同じ数え直しと突き合わせる。**表だけ直して地の文が 9 篇のまま
     * 残っていた（2026-10-13 に表を 10 篇にしたとき、地の文を置いていった）。 */
    const 地の文 = /DOI の付いた成果物が (\d+) 篇あり/.exec(text);
    if (papers !== null && (地の文 === null || parseInt(地の文[1], 10) !== papers)) {
      wrong.push('地の文の「DOI の付いた成果物が ' + (地の文 ? 地の文[1] : '無し') + ' 篇」が実際 ' + papers + ' 篇と合わない');
    }
    check('置いた数が、他のファイルから数え直したものと合う', wrong.length === 0,
      wrong.length ? wrong.join(' / ') : rows.map((r) => r[1]).join(' / '));

    /* **現状評価は、日付とともにしか成り立たない。**日付を手で据え置くと、
     * 古い評価が現状評価の顔で残る。**git が持っている日付と突き合わせる。**
     * 中身を直して日付を直さなければ落ちる。 */
    const declared = (/(\d{4})年(\d{1,2})月(\d{1,2})日時点の現状評価/.exec(text) || null);
    const iso = (/`(\d{4}-\d{2}-\d{2})` 時点で確かめられたことだけ/.exec(text) || null);
    let gitDate = '';
    try {
      gitDate = require('child_process')
        .execFileSync('git', ['log', '-1', '--format=%cs', '--', F],
                      { cwd: path.join(ROOT, 'cpsbvbng26-dotcom'), encoding: 'utf8' }).trim();
    } catch (e) { gitDate = ''; }
    const shown = declared
      ? declared[1] + '-' + String(declared[2]).padStart(2, '0')
        + '-' + String(declared[3]).padStart(2, '0')
      : '';
    check('現状評価の日付を名乗っている', declared !== null && iso !== null,
      declared ? shown : '「NNNN年N月N日時点の現状評価」が無い');
    check('名乗った日付が、見出しと本文で揃っている',
      declared !== null && iso !== null && shown === iso[1],
      declared && iso ? (shown + ' / ' + iso[1]) : '取れない');
    check('名乗った日付が、git の記録と合う',
      gitDate !== '' && shown === gitDate,
      gitDate === '' ? '浅い複製では判定できない' : ('名乗り ' + shown + ' / git ' + gitDate));

    /* **貢献と到達を分けて書いた。分けた以上、片方だけ残せないようにする。**
     * 到達だけを残せば自慢になり、貢献 0 だけを残せば到達が消える。
     * **両方が同じ節にあること、そして「導けないもの」が付いていることを見る。** */
    /* **期待の文字列から `**` と句読点を外してある。**
     * 閉じない太字を直したとき（`**…である。**` → `**…である**。`）、
     * 位置に依存した期待が一斉に落ちた。**中身は一文字も変わっていない。**
     * 見るのは語の側だけにする。**緩めたのではなく、当たる先を中身へ移した。** */
    check('貢献 0 と到達を、分けて書いてある',
      text.indexOf('新しい結果としての貢献は 0 です') >= 0
      && text.indexOf('新しい数学はありません') >= 0
      && text.indexOf('だが「貢献」は一つの軸ではありません') >= 0
      && text.indexOf('数学を専門にしない者') >= 0);

    /* **「再発見も広義には貢献である」を認めた。認めた以上、どこまで認めたかを
     * 固定する。**当たっているのは経路の記録のほうで、再発見そのものではない。
     * この切り分けが落ちると、認めた範囲が静かに広がる。 */
    check('再発見そのものは数えられないと書いてある',
      text.indexOf('| **再発見そのもの** | **数えない** |') >= 0
      && text.indexOf('同じ定理に二度目に辿り着くこと自体は、分野の既知を一つも増やしません') >= 0
      && text.indexOf('増えているのは、辿り着き方の記録のほうです') >= 0);
    check('経路の記録の価値を、ここでは決めないと書いてある',
      text.indexOf('この経路の記録に価値があるかどうかは、ここでは決められない') >= 0
      && text.indexOf('存在することと、機械で検査されていることまでです') >= 0);
    check('経路の記録の強度の限りを書いてある',
      text.indexOf('事後に書き起こしたものであり、その時点で書かれたものではありません') >= 0
      && text.indexOf('そこを書かずに経路の記録を持ち出せば、実際より強く見えます') >= 0);

    /* **経路の数を ROUTE.md から数え直す（決めごと 5）。**
     * 段の数・種別の内訳・同時記録の行数は、どれも手で書けば静かにずれる。
     * 漢数字は ecosystem.json の宣言では拾えない。だからここで数える。 */
    const route = read('trinity-infinity', 'ROUTE.md');
    check('経路の記録そのものがある', route !== null, 'trinity-infinity/ROUTE.md');
    if (route !== null) {
      const 漢 = '〇一二三四五六七八九十'.split('');
      const cells = route.split('\n')
        .map((l) => /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(l))
        .filter((m) => m !== null)
        .map((m) => ({ n: parseInt(m[1], 10),
                       c: m[2].split('|').map((x) => x.replace(/[*`]/g, '').trim()) }))
        .filter((r) => r.c.length === 6)
        .map((r) => ({ n: r.n, 種別: r.c[2], 記録: r.c[4] }));
      const n = cells.length;
      const 種別 = {}, 記録 = {};
      for (const r of cells) {
        種別[r.種別] = (種別[r.種別] || 0) + 1;
        記録[r.記録] = (記録[r.記録] || 0) + 1;
      }

      /* **一箇所でも合っていれば通る、では足りない。**同じ数を二箇所に書いており、
       * 片方だけ直せば文書が自分と食い違う。**漢数字の名乗りは全部見る。** */
      const 名乗り全部 = (re, want) => {
        const ms = [...text.matchAll(new RegExp(re, 'g'))];
        return ms.length > 0
          && ms.every((m) => m.slice(1).filter((x) => x !== undefined)[0] === 漢[want]);
      };
      check('経路の段の数が、ROUTE.md から数え直したものと合う',
        n > 0 && n < 漢.length
        && 名乗り全部('([〇一二三四五六七八九十])段階', n)
        && 名乗り全部('([〇一二三四五六七八九十])行のうち', n),
        'ROUTE.md ' + n + ' 行');

      /* 内訳は両向きに見る。実際にある種別が全部書かれていることと、
       * 書かれている種別が全部実際にあることの、両方である。
       * 片方だけだと、無い種別を足しても、ある種別を落としても通ってしまう。 */
      const 内訳 = Object.keys(種別).sort().map((k) => k + ' ' + 種別[k]);
      const 欠け = 内訳.filter((x) => text.indexOf(x) < 0);
      check('経路の種別の内訳が、ROUTE.md から数え直したものと合う',
        欠け.length === 0,
        欠け.length ? ('書かれていない: ' + 欠け.join(' / ')) : 内訳.join('、'));
      const i0 = text.indexOf('**種別で数えると、こうなります**');
      const seg = i0 < 0 ? '' : text.slice(i0, text.indexOf('。', i0));
      const 名乗り = [...seg.matchAll(/([^\s、—]+) (\d+)/g)]
        .map((m) => m[1] + ' ' + m[2]).sort();
      check('内訳が、種別の欄だけを数えたものだと書いてある',
        text.indexOf('この数は種別の欄だけを数えたものです') >= 0
        && text.indexOf('欄をまたいで足していません') >= 0);
      check('内訳に、ROUTE.md に無い種別が混ざっていない',
        名乗り.length > 0 && 名乗り.join('／') === 内訳.join('／'),
        名乗り.length ? 名乗り.join('、') : '内訳の文が見つからない');

      const 再構成 = 記録['再構成'] || 0;
      const 同時 = 記録['同時'] || 0;
      check('再構成と同時記録の行数が、ROUTE.md から数え直したものと合う',
        再構成 > 0 && 同時 > 0 && 再構成 < 漢.length && 同時 < 漢.length
        && text.indexOf(漢[n] + '行のうち' + 漢[再構成] + '行は「再構成」です') >= 0
        && 名乗り全部('同時に記録したのは([〇一二三四五六七八九十])行'
                      + '|同時記録は([〇一二三四五六七八九十])行', 同時),
        '再構成 ' + 再構成 + ' / 同時 ' + 同時);
      const 同時行 = cells.filter((r) => r.記録 === '同時').map((r) => r.n);
      check('同時に記録した段の番号が、ROUTE.md と合う',
        同時行.length > 0 && text.indexOf('（経路の ' + 同時行.join('・') + '）') >= 0,
        同時行.join('・'));

      /* バナッハは再発見ではなく利用である。段の番号ごと突き合わせる。
       * 番号を手で書くと、経路に行が挿入されたときに黙ってずれる。 */
      const 段の番号 = (種 ) => cells.filter((r) => r.種別 === 種).map((r) => r.n);
      const 否定行 = 段の番号('発見の否定');
      check('「発見の否定」と書いた段の番号が、ROUTE.md と合う',
        否定行.length === 1
        && text.indexOf('経路の ' + 否定行[0] + ' は種別が「発見の否定」ですが') >= 0,
        否定行.join('・'));
      /* **「意味を持たない」と証明されたのは、三という数についてだけである。**
       * その射程を広げないために、指し先の段番号も ROUTE から引き当てる。 */
      check('「意味を持たない」の指し先が、ROUTE.md の段と合う',
        否定行.length === 1
        && text.indexOf('`trinity-infinity/ROUTE.md` の段階 ' + 否定行[0]) >= 0,
        否定行.join('・'));
      const 利用行 = cells.filter((r) => r.種別 === '利用').map((r) => r.n);
      check('「利用」と書いた段の番号が、ROUTE.md と合う',
        利用行.length === 1
        && text.indexOf('（経路の ' + 利用行[0]
                        + '、種別は「利用」であって再発見ではない）') >= 0,
        利用行.join('・'));
    }

    /* 他のファイルを理由として指したなら、その先に理由があること。
     * 宛先の無い参照は、札だけ立った空き地である。 */
    {
      const arxiv = read('trinity-infinity', 'ARXIV.md') || '';
      check('math.HO を外した理由を指した先に、その記述がある',
        text.indexOf('`math.HO` を第一希望から外した理由がこれである') >= 0
        && arxiv.indexOf('`math.HO`（History and Overview）') >= 0
        && arxiv.indexOf('第一希望から外した。') >= 0);
    }
    check('到達が貢献に読み替えられないようにしてある',
      text.indexOf('分野への貢献では一切ありません') >= 0
      && text.indexOf('一般の読者から見て珍しいことと、分野にとって新しいことは、別の話です') >= 0
      && text.indexOf('貢献 0 を薄めるためではありません') >= 0);
    check('コードが同梱されていないことを書いてある',
      text.indexOf('コードは論文に同梱されていません') >= 0
      && text.indexOf('E3') >= 0);

    /* **水準を書いたのは数学だけである。**黙っているのは低いからではなく、
     * 測れないからである。**その断りが無いと、読む側から区別が付かない。**
     * そして「無い」と書いた以上、本当に無いことを機械で当たる。 */
    check('水準を書いたのが数学だけだと書いてある',
      text.indexOf('## 水準を書いたのは、数学だけである') >= 0
      && text.indexOf('黙っているのは、低いからではありません。測れないからです。') >= 0
      && text.indexOf('機械で切り出せる「残った命題」がありません') >= 0);
    {
      /* **「水準の行が無い」は、無いことの主張である。**足されたら落ちる。 */
      const 語 = ['学部', '大学院', '演習', '水準'];
      const 出た = [];
      for (const repo of ['autonomy-and-self-cultivation', 'naval-gazette-notes']) {
        const rd = read(repo, 'README.md');
        if (rd === null) { 出た.push(repo + ' の README が無い'); continue; }
        for (const w of 語) if (rd.indexOf(w) >= 0) 出た.push(repo + ' に「' + w + '」');
      }
      check('哲学と史料ノートに、水準の行が実際に無い', 出た.length === 0,
        出た.length ? (出た.join(' / ') + ' —— 足したなら、水準の節を書き直す') : '2 つとも無い');
      /* 指した登録簿の項目に、宛先があること。 */
      const reg = read('self-correction', 'register.toml') || '';
      const 空 = ['PH-011', 'PH-010', 'EX-009']
        .filter((id) => text.indexOf('`' + id + '`') < 0
                     || reg.indexOf('id = "' + id + '"') < 0);
      check('材料として指した登録簿の項目に、宛先がある', 空.length === 0,
        空.length ? ('宛先が無い: ' + 空.join(', ')) : '3 件');
    }
    check('材料から水準へ飛ばないと書いてある',
      text.indexOf('だが、ここから「だから水準が低い」へは飛びません') >= 0
      && text.indexOf('材料は材料のまま置きます') >= 0);

    /* **新規性 0 は、意味 0 を含意しない。**分野が数えないことと、
     * 中身が無いことは別である。**混ぜると、片方を根拠にもう片方を言えてしまう。**
     * そして逆向きにも滑る —— 限定的な意味を「小さいが貢献」に読み替える道である。
     * **両方を塞ぐ。** */
    check('新規性 0 と意味 0 を、分けて書いてある',
      text.indexOf('## 新規性が 0 であることと、意味が無いことは違う') >= 0
      && text.indexOf('そこから「意味が無い」は出ない') >= 0
      && text.indexOf('分野が数えないことと、何の内容も無いことは、\n別のことです') >= 0);
    /* **射程はどちらにも滑る。**「意味を持たない」の範囲を作用素まで広げれば
     * 実際より低く、狭めれば高く読める。**証明されたのは三という数についてだけである。** */
    check('「意味を持たない」の範囲が、三という数に限られている',
      text.indexOf('記号 `Ⅲ` の側 —— 三という数についてだけです') >= 0
      && text.indexOf('作用素そのものでも、残った事実でもありません') >= 0
      && text.indexOf('その範囲を広げません。') >= 0);
    check('限定的な意味を、貢献に足し算しないと書いてある',
      text.indexOf('どちらも「小さいが貢献」ではありません') >= 0
      && text.indexOf('分野の既知は一つも増えていません') >= 0
      && text.indexOf('軸が違うものを、足し算にしません') >= 0);
    check('限定的な意味に、閉じている範囲が付いている',
      text.indexOf('| | 内容 | 閉じている範囲 |') >= 0
      && text.indexOf('**新規性はここにも無い**') >= 0
      && text.indexOf('この二つに値打ちがあるかどうかも、ここでは決められない') >= 0);

    /* 相乗平均の主張は、trinity-infinity の結論と同じものである。
     * 二箇所に書いた以上、片方だけ動かせないようにする。 */
    {
      const ti = read('trinity-infinity', 'README.md') || '';
      /* **語が一つ残っていれば通る、では足りない。**「相乗平均」は同じ節に
       * 二度出るので、一方だけ「最大値」に書き換えても素通りした。
       * **主張の一文ごと、両方の側で突き合わせる。** */
      const 両方 = [['`(DQ)ⁿ = (∏ᵢ aᵢ)·I`', '`(DQ)ⁿ = (∏ᵢ aᵢ)·I`']];
      const 片側 = [
        [text, '収束を決めているのは係数の**相乗平均**であって、三篇が書いた `maxᵢ aᵢ` ではありません'],
        [text, '**相乗平均は最大値以下であり、三篇の評価より真の値に近い**'],
        [ti, '相乗平均であって、最大値でも作用素ノルムでもありません']
      ];
      const 欠け = 両方.filter(([a, b]) => text.indexOf(a) < 0 || ti.indexOf(b) < 0)
        .map(([a]) => a)
        .concat(片側.filter(([src, x]) => src.indexOf(x) < 0).map(([, x]) => x));
      /* 「真であることに尽きる」は、新規性 0 の受け皿である。
       * **片方だけ動かせば、受け皿の無い 0 か、根拠の無い価値になる。** */
      const 尽きる = ['論文としての価値は、真であることに尽きる。ただし、いまは条件つきです',
                      'だが、貢献は主張しています',
                      'この四文は帰属の側で立ちません',
                      '下限と上限が一致しているとは、現在形では書けません'];
      const 片方 = 尽きる.filter((x) => text.indexOf(x) < 0);
      const ti欠 = 尽きる.filter((x) => ti.indexOf(x) < 0);
      check('「真であることに尽きる」が、記録と結論の両方にある',
        片方.length === 0 && ti欠.length === 0,
        (片方.length ? '自己分析に無い: ' + 片方.length + ' 件 ' : '')
        + (ti欠.length ? 'trinity-infinity に無い: ' + ti欠.length + ' 件' : '')
        || 尽きる.length + ' 件');
      check('相乗平均の主張が、trinity-infinity の結論と揃っている',
        欠け.length === 0,
        欠け.length ? ('欠けている: ' + 欠け.join(' / ')) : (両方.length + 片側.length) + ' 件');
    }

    /* **査読 0 篇は、この文書の土台である。**ここが動けば全部動く。 */
    check('査読を通った論文が 0 篇だと書いてある',
      text.indexOf('| 査読を通った論文 | 学術誌・学会 | **0 篇** |') >= 0
      && text.indexOf('低い段にいるのではなく、段に乗っていません') >= 0);
  }
}

/* **自己評価を外に書かせる仕様。**本人の側の文書は、良い側に倒れる誤りだけを
 * 見張ると宣言している。**片側だけを見る手当ては、反対側に倒れる。**
 * そこで同じ材料を外へ渡す仕様を置いた。**渡す文が結論を先に決めていないか、
 * そして上限まで書かせる指示が事実を超える許可になっていないかを、ここで見る。**
 * 数は散文から読まず、箇条の数を数え直す（決めごと 5）。 */

console.log('\n7.12 自己評価を外に書かせる仕様');

{
  const F = path.join('docs', 'self-assessment-prompt.md');
  const text = read('cpsbvbng26-dotcom', F);
  check('渡す文の仕様がある', text !== null, F);

  if (text !== null) {
    const 漢 = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

    /* 仕様の決めごとを数え直す。**散文の名乗りと合わなければ落ちる。** */
    const 節 = (/^## 決めごと$([\s\S]*?)^## /m.exec(text) || [null, ''])[1];
    /* **太字に依らせない。**書き方 5 で文の太字を外したとき、`^N. **` が
     * 一斉に当たらなくなった。**数えるのは箇条の頭だけでよい。** */
    const 実際 = (節.match(/^\d+\. /gm) || []).length;
    const 名乗り = (/決めごとは(.)つあります/.exec(text) || [null, ''])[1];
    check('仕様の決めごとの数が、名乗りと合う',
      実際 > 0 && 漢[名乗り] === 実際,
      '実際 ' + 実際 + ' / 名乗り ' + (漢[名乗り] || '取れない'));

    /* 渡す文そのもの。**貼って使うものなので、囲みの中を数える。** */
    const 囲み = (/```\n([\s\S]*?)\n```/.exec(text) || [null, ''])[1];
    /* **散文と囲みを分ける。**渡す文は仕様の語をそのまま含む。
     * 分けずに当てると、**仕様の散文を削っても囲みの写しが期待を満たして通る。**
     * 実際に通った。壊して確かめたのはここである。 */
    const 散文 = text.replace(/```[\s\S]*?```/g, '');
    check('渡す文が囲みに入っている', 囲み.length > 0);
    const 守り = (囲み.match(/^\d+\. /gm) || []).length;
    const 守り名乗り = (/守ってほしいことが(.)つある/.exec(囲み) || [null, ''])[1];
    check('渡す文の守りごとの数が、名乗りと合う',
      守り > 0 && 漢[守り名乗り] === 守り,
      '実際 ' + 守り + ' / 名乗り ' + (漢[守り名乗り] || '取れない'));

    /* **上限まで書かせる指示は、事実を超える許可ではない。**
     * この対が片方だけになると、仕様が捏造の指示に変わる。 */
    check('上限まで書かせると同時に、事実を超えないと書いてある',
      散文.indexOf('事実が許す上限まで書かせます') >= 0
      && 散文.indexOf('ただし事実を超えません') >= 0
      && 散文.indexOf('上限を決めるのは事実であって、語彙ではありません') >= 0);
    check('渡す文の側にも、その対が入っている',
      囲み.indexOf('事実が許す上限まで書く') >= 0
      &&囲み.indexOf('ただし事実を超えない') >= 0
      && 囲み.indexOf('事実を足さない') >= 0);

    /* **低い側へ倒す指示にもしない。**両側を塞いで初めて、事実のままになる。 */
    check('低い側にも倒さないと書いてある',
      散文.indexOf('低い側にも倒しません') >= 0
      && 散文.indexOf('ST-002') >= 0
      && 囲み.indexOf('ST-002 がその判定を塞いでいる') >= 0);

    /* **謙遜を形容詞でやらせない。**語尾で謙遜すると、範囲を書かずに済んでしまう。 */
    check('謙遜を順序で出すと書いてある',
      散文.indexOf('謙遜は語尾ではなく順序で出します') >= 0
      && ['ささやかな', '拙い'].every((w) => 散文.indexOf(w) >= 0)
      && 囲み.indexOf('範囲を書くことで謙遜する') >= 0);

    check('覆し方を添えさせると書いてある',
      散文.indexOf('覆し方を添えさせます') >= 0
      && 散文.indexOf('覆し方の無い行は、評価ではなく宣伝です') >= 0
      && 囲み.indexOf('それが覆る条件を添える') >= 0);

    /* **仕様を変えても動かないものを、仕様自身に書かせる。** */
    check('貢献 0 と ST-002 は動かないと書いてある',
      散文.indexOf('分野への貢献は 0 です') >= 0
      && 散文.indexOf('上限まで書かせても、ここは動きません') >= 0
      && 散文.indexOf('`ST-002` は塞がったままです') >= 0);
    check('自称の肩書きにしないと書いてある',
      散文.indexOf('自称の肩書きにしない') >= 0
      && 散文.indexOf('外が書いたものを、こちらの名乗りに移しません') >= 0);
    check('査読と呼ばないと書いてある',
      散文.indexOf('外の言語モデルが返した文は、査読ではありません') >= 0);
    check('本人の側の文書に混ぜないと書いてある',
      散文.indexOf('`self-assessment.md` は書き換えません') >= 0
      && 散文.indexOf('外が書いたものは外の欄に置きます') >= 0);

    /* **渡す文が挙げる材料が、実在すること。**
     * 死んだリンクは、証拠のふりをした穴である（外部評価の決めごと 7）。 */
    const 材料 = (囲み.match(/^- https:\/\/github\.com\/cpsbvbng26-dotcom\/([^/]+)\/blob\/main\/(.+)$/gm) || [])
      .map((l) => /cpsbvbng26-dotcom\/([^/]+)\/blob\/main\/(.+)$/.exec(l))
      .map((m) => [m[1], m[2]]);
    const 欠落 = 材料.filter(([r, f]) => read(r, f) === null).map(([r, f]) => r + '/' + f);
    check('渡す文が挙げる材料が、すべて実在する',
      材料.length === 4 && 欠落.length === 0,
      欠落.length ? ('無い: ' + 欠落.join(', ')) : (材料.length + ' 件'));

    /* **本人の側からも、この仕様へ辿れること。**
     * 片側だけを見張ると宣言した直後に、その偏りを書いていなければ意味が無い。 */
    const 自己 = read('cpsbvbng26-dotcom', path.join('docs', 'self-assessment.md')) || '';
    check('本人の側の文書が、片側だけの見張りの偏りを書いている',
      自己.indexOf('## 片側だけを見る手当ては、反対側に倒れる') >= 0
      && 自己.indexOf('(self-assessment-prompt.md)') >= 0
      && 自己.indexOf('返ってきた文は、この文書に混ぜません') >= 0
      && 自己.indexOf('貢献 0 と `ST-002` は、どちらの側からも動きません') >= 0);
  }
}

/* **掲載料を取らない誌の一覧。**見出しが名乗る数と、表の行数を突き合わせる
 * （決めごと 5）。**候補を一つ足して見出しを直し忘れると落ちる。**
 * 表を読むときは、`|` で始まらない行が来たところで止める。
 * 止めないと、次の表の行まで数えてしまう。**実際にそれで数がずれた。** */

console.log('\n7.13 掲載料を取らない誌の一覧');

{
  const F = path.join('docs', 'submission-disclosure.md');
  const text = read('cpsbvbng26-dotcom', F) || '';
  const 漢 = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

  check('掲載料を取らない誌を並べた節がある',
    text.indexOf('## 掲載料を取らない誌を、通りやすさの順に並べた') >= 0);

  /* 見出しの直後にある最初の表の、中身の行数を数える。 */
  function 行数(見出し) {
    const i = text.indexOf(見出し);
    if (i < 0) return null;
    const lines = text.slice(i).split('\n').slice(1);
    let n = 0, 始まった = false;
    for (const l of lines) {
      if (l.startsWith('|')) { 始まった = true; n++; continue; }
      if (始まった) break;
    }
    return n - 2 >= 0 ? n - 2 : null;  /* 見出し行と区切り行を引く */
  }

  const 表 = [
    ['### 学部生の誌 —— ', /学部生の誌 —— (.)つ/],
    ['### 射程が合う数学の誌 —— ', /射程が合う数学の誌 —— (.)つ/],
    ['### 一般のダイヤモンド哲学誌 —— ', /一般のダイヤモンド哲学誌 —— (.)つ/],
    ['### 出せないと分かったもの —— ', /出せないと分かったもの —— (.)つ/],
  ];
  for (const [見出し, 名乗り正規] of 表) {
    const 実際 = 行数(見出し);
    const m = 名乗り正規.exec(text);
    const 名乗り = m ? 漢[m[1]] : null;
    check('  ' + 見出し.replace('### ', '').replace(' —— ', '') + 'の数が、名乗りと合う',
      実際 !== null && 名乗り !== null && 実際 === 名乗り,
      '実際 ' + 実際 + ' / 名乗り ' + (名乗り === null ? '取れない' : 名乗り));
  }

  /* **同時に二誌へ出さない決めは、この文書に既にある。**
   * 新しい節がそれを引いていなければ、七篇を一斉に出す読み方が残る。 */
  check('二重投稿を禁じる決めを、新しい節が引いている',
    text.indexOf('同じ稿を二つの誌に同時に出しません') >= 0
    && text.indexOf('七篇を別々の誌に一篇ずつ出す形でだけ、全部を出せます') >= 0);

  /* **条件 4 を外したことを、外したと書く。**黙って外せば、条件が消える。 */
  check('格の数字を見ずに調べたと書いてある',
    text.indexOf('格の数字を見ないと決めて調べました') >= 0
    && text.indexOf('条件 1・2・3 は外していません') >= 0);

  /* **出す前にやること。**E8 と言語モデル利用の開示が抜けると、出した先で穴になる。 */
  check('出す前にやることに、E8 と言語モデル利用の開示が入っている',
    text.indexOf('`E8` の帰属を先に直します') >= 0
    && text.indexOf('言語モデル利用の開示を消さない') >= 0);

  /* **原典未読であることを、同じ節に書く。**確かめていないなら確かめていないと書く。 */
  check('原典を読んでいないと書いてある',
    text.indexOf('全部が検索で確認であり、原典を読んでいません') >= 0);

  /* **数学研究誌に出せない理由を、紙面の自己申告に繋いでおく。**
   * ここが切れると、射程を変えた理由が「落ちるから」に見える。 */
  check('数学研究誌に出せない理由が、紙面の貢献 0 に繋がっている',
    text.indexOf('どの数学研究誌にも出せません') >= 0
    && text.indexOf('紙面が自分で「新しい数学は無い」と') >= 0);

  /* 受け皿の無い一篇を、無いと書いてあること。**空きを黙って埋めない。** */
  check('史料ノートの受け皿が無いと書いてある',
    text.indexOf('史料ノートの受け皿が見つかっていません') >= 0);
}

/* **SSRN の通過と却下の数。**自己分析の欄が手で書いていた数が、実際とずれていた。
 * 史料ノートが通っているのに 3 通過と書いてあった。**そこで数え直す先を決める。**
 * 通過は `doi-index.md` の「別の所在」にある自分の SSRN DOI の数、
 * 出した数は `papers.json` の篇数、却下はその差である。
 * **第三者の SSRN DOI を数に入れない。**節が別なので、節を切って数える。 */

console.log('\n7.14 SSRN の通過と却下');

{
  const idx = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md')) || '';
  const 自分の節 = idx.slice(idx.indexOf('## 別の所在にある同一本文'),
                            idx.indexOf('## 第三者の SSRN DOI'));
  check('別の所在の節と、第三者の節が分かれている',
    自分の節.length > 0 && idx.indexOf('## 第三者の SSRN DOI') > 0);

  const 通過 = (自分の節.match(/SSRN `10\.2139\/ssrn\.\d+`/g) || []).length;
  /* **Zenodo に無い本文も、出した数に入れる。**papers.json に載るのは Zenodo に正本がある篇
   * だけである。SSRN にだけ出したものを落とすと、通過が出した数を追い越して却下が減る。 */
  const 無い = (() => {
    const i = 自分の節.indexOf('### Zenodo に無い本文');
    return i < 0 ? 0 : (自分の節.slice(i).match(/^\| (?!論文 \|)[^-|][^|]* \| SSRN `/gm) || []).length;
  })();
  const 篇 = (() => {
    const raw = read('researcher-profile', 'papers.json');
    if (raw === null) return null;
    try { const j = JSON.parse(raw); return (Array.isArray(j) ? j : j.papers).length + 無い; }
    catch (e) { return null; }
  })();
  const 却下 = (篇 === null) ? null : 篇 - 通過;

  const 自己 = read('cpsbvbng26-dotcom', path.join('docs', 'self-assessment.md')) || '';
  /* 2026-11-12（三度目の見落とし）。閾値の欄は「SSRN 編集スタッフ」と書いていた。取り寄せた SSRN の頁は、
   * 基準を満たすかを SSRN が決めるとだけ書き、誰が読むかを書かない。欄を場の文に移し、同じ厳しさで一字一句を求める。 */
  const m = /\| SSRN の受け付け \| SSRN（学術的な内容の基準を満たすかを SSRN が決めると書いている。プレプリントは査読しないと書いている） \| \*\*(\d+) 通過 \/ (\d+) 却下\*\* \|/.exec(自己);
  check('自己分析の SSRN の欄が、数え直したものと合う',
    m !== null && 却下 !== null
    && parseInt(m[1], 10) === 通過 && parseInt(m[2], 10) === 却下,
    m ? ('名乗り ' + m[1] + ' 通過 / ' + m[2] + ' 却下  実際 ' + 通過 + ' / ' + 却下)
      : '欄が読めない');

  /* 同じ数を、表の下の散文も名乗っている。**表だけ直して散文を据え置いた**（3 回通り、1 回落ち）。 */
  const 散 = /SSRN の受け付けの門を (\d+) 回通り、(\d+) 回落ちています/.exec(自己);
  check('自己分析の散文の SSRN の数が、数え直したものと合う',
    散 !== null && 却下 !== null
    && parseInt(散[1], 10) === 通過 && parseInt(散[2], 10) === 却下,
    散 ? ('名乗り ' + 散[1] + ' / ' + 散[2] + '  実際 ' + 通過 + ' / ' + 却下) : '散文が無い');

  /* **落ちたことを、落ちたと書いてあること。**待っている顔のまま残さない。 */
  const ev = read('cpsbvbng26-dotcom', path.join('docs', 'external-evaluations.md')) || '';
  check('Series I と III の行が、落とされたと書いてある',
    ev.indexOf('Series I 改訂版 | —（付かなかった） | **落とされた**') >= 0
    && ev.indexOf('Series III | —（付かなかった） | **落とされた**') >= 0
    && ev.indexOf('出した。受け付けの結果はまだ') < 0);

  /* **受け付けの結果を、評価の件数に混ぜない。**場の側がそう書いている。 */
  check('受け付けの結果を評価に数えないと書いてある',
    ev.indexOf('受けた評価の件数には入れません。') >= 0
    && ev.indexOf('does not reflect a judgement on the merits of your work') >= 0);

  /* **範囲外では説明が付かないこと。**同じ網に Series II が載っている。
   * ここが消えると、落ちた理由を分野のせいにできてしまう。 */
  check('範囲外では説明が付かないと書いてある',
    ev.indexOf('#### 範囲外では説明が付かない') >= 0
    && ev.indexOf('範囲が理由なら、Series II も落ちていなければなりません。') >= 0
    && ev.indexOf('この門は、同じ系列の中でも選り分けます。') >= 0);

  /* **分からないことを、分からないと書いてあること。**片側の不備で説明を作らない。 */
  check('何が違ったか分かっていないと書いてある',
    ev.indexOf('共通の不備でも、片方だけの不備でも説明が付きません。ここで止めます。') >= 0);

  /* **受付番号を DOI と読み違えさせない**（決めごと 1）。 */
  check('受付番号が DOI ではないと書いてある',
    ev.indexOf('**受付番号は DOI ではない**') >= 0
    && ev.indexOf('DataCite にも Crossref にもありません。') >= 0);
  const 受付 = ['7446959', '7446979'];
  const 誤用 = 受付.filter((n) => idx.indexOf(n) >= 0);
  check('受付番号が、番号の一覧に混ざっていない', 誤用.length === 0,
    誤用.length ? ('混ざっている: ' + 誤用.join(', ')) : 受付.length + ' 件');

  /* **入口の写しも、落ちたことを書いていること。**生成元は site.json である。 */
  const top = read('cpsbvbng26-dotcom', 'index.html') || '';
  const topEn = read('cpsbvbng26-dotcom', 'index.en.html') || '';
  check('入口の自己紹介が、落とされたことを書いている',
    top.indexOf('出して落とされました') >= 0
    && top.indexOf('まだ出していません') < 0
    && topEn.indexOf('were submitted and turned away') >= 0
    && topEn.indexOf('have not been submitted') < 0);
}

/* X に出した文の、事実の主張の等級。**投稿の本文は写さない。**
 * 写せば同じ文が二か所になり、片方だけ直したときに食い違う。
 * ここで見るのは、等級が三つに分かれていることと、評価を事実に混ぜていないことである。 */

console.log('\n7.15 X に書いたことの等級');

{
  const S = read('cpsbvbng26-dotcom', path.join('docs', 'submission-disclosure.md')) || '';
  check('X に書いたことの節がある', S.indexOf('## X に書いたこと —— 2026-09-18') >= 0);
  check('投稿の本文を写していないと書いてある',
    S.indexOf('投稿の本文はここに写しません') >= 0
    && S.indexOf('片方だけ直したときに食い違います') >= 0);
  check('等級が三つに分かれている',
    ['### 原典で確認した', '### 検索で確認した（原典未読）', '### 確かめていない']
      .every((h) => S.indexOf(h) >= 0));

  /* **原典で確認したと書いた行は、原典の名を持っていること。**
   * 等級だけ上げて出典を書かないのが、いちばん静かなずれになる。 */
  {
    const i = S.indexOf('### 原典で確認した');
    const j = S.indexOf('### 検索で確認した（原典未読）');
    const 節 = (i >= 0 && j > i) ? S.slice(i, j) : '';
    const 行 = 節.split('\n').filter((l) => l.startsWith('| ') && l.indexOf('---') < 0);
    const 見出し = 行.slice(0, 1);
    const 中身 = 行.slice(1);
    const 出典なし = 中身.filter((l) => !/spinout_faq\.md|endorsement\.md|同じ頁/.test(l));
    check('原典で確認した行が、すべて原典を名指している',
      見出し.length === 1 && 中身.length > 0 && 出典なし.length === 0,
      出典なし.length ? ('名指していない ' + 出典なし.length + ' 行') : (中身.length + ' 行'));
  }

  /* **確かめていないものを、確かめていないと書いてあること**（決めごと 1 と同じ扱い）。 */
  check('確かめていない数が、確かめていないと書いてある',
    S.indexOf('SSRN が 65 分野を超える') >= 0
    && S.indexOf('数の出どころに当たっていない') >= 0
    && S.indexOf('投稿の中で、数として確かめていないのはここだけです') >= 0);

  /* **評価を事実の欄に入れない。**投稿自身が「と私は思っています」と断っている。 */
  check('評価を事実に混ぜないと書いてある',
    S.indexOf('### 主張ではなく評価である部分') >= 0
    && S.indexOf('この記録は、その評価を事実の欄に入れません') >= 0
    && S.indexOf('相手の性質ではなく自分の側の規則です') >= 0);

  /* **条件 4 と決めごと 14 の積に空きがあること。**投稿の絞り方と同じだが、
   * 新しいダイヤモンド誌は構造的に格の数字を持てない。ここを落とすと絞り方が嘘になる。 */
  check('条件 4 と決めごと 14 の積に空きがあると書いてある',
    S.indexOf('新しいダイヤモンド誌は') >= 0
    && S.indexOf('構造的に格の数字を持てません') >= 0
    && S.indexOf('条件 4 は「数字があるかを見る」と読み替えてあります') >= 0);

  /* **原典を読んで足せたものを、足したと書いてあること。** */
  check('原典から足せたことを書いてある',
    S.indexOf('正式名称は arXiv, Inc. です') >= 0
    && S.indexOf('Simons Foundation と') >= 0);
}

/* **マージコミットの開示。**枝を PR に切り替えてから、マージの行に
 * `Co-Authored-By` が付いていなかった。API のマージに表題だけを渡していたためである。
 * **中身のコミットには付いているが、いちばん目に入る行から落ちていた**（決めごと 8）。
 * 公開済みの履歴は書き換えないので、規則の始まる日から先だけを見る。
 * **日付と、それより前の件数は、どちらも CLAUDE.md の散文から読む**（決めごと 5）。 */

console.log('\n7.16 マージコミットの開示');

{
  const cl = read('cpsbvbng26-dotcom', 'CLAUDE.md') || '';
  /* **固定するのは欠けた件数だけである。**総数は毎回増えるので、
   * 固定すると毎回落ちる。**一度そう書いて、次のマージで落ちた。** */
  const m = /\*\*開示の無いマージが、10 リポジトリ合わせて (\d+) 件ある。\*\*/.exec(cl);
  check('開示の無いマージの件数を名乗っている', m !== null,
    m ? (m[1] + ' 件') : '取れない');

  let 無し = 0, 総 = 0, 走った = 0;
  const 内訳 = [];
  for (const repo of DECL['共通の決めごと'].repos) {
    let out = '';
    try {
      out = require('child_process').execFileSync(
        'git', ['log', '--merges', '--format=%H\x1f%(trailers:key=Co-authored-by,valueonly)'],
        { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    } catch (e) { continue; }
    走った++;
    let n = 0;
    for (const line of out.split('\n')) {
      if (!line.trim()) continue;
      const 開示 = (line.split('\x1f')[1] || '').trim();
      if (!開示) n++;
      総++;
    }
    無し += n;
    if (n) 内訳.push(repo + ' ' + n);
  }
  check('10 リポジトリの git を読めた', 走った === DECL['共通の決めごと'].repos.length,
    走った + ' / ' + DECL['共通の決めごと'].repos.length);
  check('開示の無いマージの件数が、名乗りと増えも減りもしていない',
    m !== null && 無し === parseInt(m[1], 10),
    '実際 ' + 無し + ' / 名乗り ' + (m ? m[1] : '無し')
      + '  マージ全体 ' + 総 + ' 件  ' + 内訳.join(' / '));
  /* 477（百本ノック五）。PR の段階の検査を足した。マージのコミットはそこでは確かめられないので、
   * あとで数えるこの検査は外さない。docs/checks.md が同じ件数を名乗り、理由を書いていること。 */
  {
    const ck = read('cpsbvbng26-dotcom', path.join('docs', 'checks.md')) || '';
    const cm = /10 リポジトリ合わせて (\d+) 件あります。/.exec(ck);
    check('docs/checks.md が名乗る、開示の無いマージの件数が実際と合う', cm !== null && Number(cm[1]) === 無し,
      cm ? ('名乗り ' + cm[1] + ' / 実際 ' + 無し) : '名乗りが無い');
    check('マージのコミットは PR の段階で確かめられないと書き、あとで数える検査を残すと書いてある',
      ck.indexOf('マージのコミットの本文は、PR の段階では確かめられません。') >= 0
      && ck.indexOf('マージのあとの件数の検査は、そのまま残します。') >= 0
      && fs.existsSync(path.join(ROOT, 'cpsbvbng26-dotcom', '.github', 'workflows', 'pr-disclosure.yml')));
    let selfOk = false;
    try {
      const o = require('child_process').execFileSync('node', [path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'check_pr_disclosure.js'), '--self-test'], { encoding: 'utf8' });
      selfOk = /件すべて通りました。/.test(o);
    } catch (e) { selfOk = false; }
    check('PR の段階の開示の検査が、作り物の PR で落ちるべきものを落とす（--self-test）', selfOk);
  }
  check('総数を固定しないと書いてある',
    cl.indexOf('固定するのは、この欠けた件数だけである') >= 0
    && cl.indexOf('一度そう書いて、次のマージで落ちた') >= 0);

  /* **日付ではなく件数で固定する理由を、書いてあること。**
   * 境界の日のマージがどちらに入るかで揺れる。**実際に揺れた。** */
  check('日付ではなく件数で固定すると書いてある',
    cl.indexOf('**固定するのは日付ではなく、この件数である。**') >= 0
    && cl.indexOf('件数なら揺れない') >= 0);
  /* **公開済みの履歴を書き換えないこと。**過去を直したように読ませない。 */
  check('公開済みの履歴を書き換えないと書いてある',
    cl.indexOf('公開済みの枝の履歴は書き換えない') >= 0
    && cl.indexOf('**この 63 件はそのまま残ります**') >= 0);
  check('決めごと 8 に触ると書いてある',
    cl.indexOf('いちばん目に入る行から落ちていた') >= 0
    && cl.indexOf('決めごと 8 に触る。') >= 0);
  /* **取り違えを記録してあること。**総数と、開示の無い件数は別である。
   * `%(trailers:…)` の出力が空行を挟むので、素朴に行を数えると付いているものまで拾う。 */
  check('最初に数え間違えたことを書いてある',
    cl.indexOf('最初に数えたときは 71 と書いていた') >= 0
    && cl.indexOf('検査の側は空行を飛ばして数える') >= 0);
  check('マージに渡す二行が書いてある',
    cl.indexOf('Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>') >= 0
    && cl.indexOf('Claude-Session: <この作業の session の URL>') >= 0);
}

/* **予告。**登録簿は過去にしか効かない。結果が出たものを記録する装置は、
 * 結果を吸収できる。**ここだけ向きが逆で、失敗条件を先に書く。**
 * 見るのは、失敗条件と期限が全部の行にあること、件数が散文と合うこと、
 * そして **失敗条件を緩めない・結果を書き換えないと書いてあること**である。 */

console.log('\n7.17 予告 —— 結果が出る前に書いたもの');

{
  const F = path.join('docs', 'predictions.md');
  const P = read('cpsbvbng26-dotcom', F) || '';
  check('予告の文書がある', P.length > 0, F);

  /* 表の行を数える。**行頭が | でなくなったところで切る。** */
  const i = P.indexOf('| # | 予告 | 失敗条件 | 期限 | 結果 |');
  const rows = [];
  if (i >= 0) {
    for (const l of P.slice(i).split('\n').slice(2)) {
      if (l.indexOf('|') !== 0) break;
      rows.push(l);
    }
  }
  const 漢 = '〇一二三四五六七八九十'.split('');
  const m = /^(.)件あります。/m.exec(P);
  check('予告の件数が、表の行数と名乗りで合う',
    rows.length > 0 && m !== null && 漢.indexOf(m[1]) === rows.length,
    '表 ' + rows.length + ' 行 / 名乗り ' + (m ? m[1] : '無し'));

  /* **失敗条件と期限が、全部の行にあること。**どちらかが欠けた行は予告ではない。 */
  const 欠け = rows.filter((l) => {
    const c = l.split('|').map((x) => x.trim());
    return !(c[3] && c[3].indexOf('失敗') >= 0) || !c[4];
  });
  check('全部の行に失敗条件と期限がある', 欠け.length === 0,
    欠け.length ? (欠け.length + ' 行が欠けている') : (rows.length + ' 行'));

  /* **緩めないこと・書き換えないことを、文書自身に書かせる。**
   * ここが消えたら、予告は宣伝に戻る。 */
  check('失敗条件を緩めないと書いてある',
    P.indexOf('失敗条件を、あとから緩めません') >= 0
    && P.indexOf('緩めた時点で、この文書の意味が消えます') >= 0);
  check('失敗したものを消さないと書いてある',
    P.indexOf('失敗したものを消しません') >= 0
    && P.indexOf('`失敗` のまま残します') >= 0);
  check('当たっても手柄にしないと書いてある',
    P.indexOf('当たったことを手柄にしません') >= 0);

  /* **置いた理由が、反論 5 に繋がっていること。**繋がりが切れると、
   * ただの目標一覧になる。 */
  check('反論 5 に繋がっていると書いてある',
    P.indexOf('誠実さと免疫が同じ装置') >= 0
    && P.indexOf('結果が出たものを記録する\n装置は、結果を吸収できます') >= 0);

  /* **外部からの接触が 0 だと測って書いてあること。**
   * 装置の整備と、野戦の有無は別である。 */
  check('外部からの接触が 0 だと書いてある',
    P.indexOf('外部からの接触は、測ると 0 です。') >= 0
    && P.indexOf('star は\nすべて 1 件（著者自身）') >= 0);

  /* 反論の側。**この反論は、それ自体が同じ装置の動作であると書いてあること。** */
  const O = read('cpsbvbng26-dotcom', path.join('docs', 'objections.md')) || '';
  check('反論 5 があり、自分もその装置だと書いてある',
    O.indexOf('## 反論 5 —— 「誠実さと免疫が同じ装置になっている」') >= 0
    && O.indexOf('この節を書くこと自体が同じ装置の動作です') >= 0
    && O.indexOf('この反論は、それ自体を材料にされます') >= 0);
  check('反論 5 の崩し方が、予告を指している',
    O.indexOf('`docs/predictions.md` に、結果が出ていない予告と') >= 0
    && O.indexOf('免疫のほうが勝ったことになります') >= 0);
  /* **反論の数が、見出しの数と合うこと。** */
  const 反論数 = (O.match(/^## 反論 \d/gm) || []).length;
  const om = /(.)つとも、答えたのは反論の一部です/.exec(O);
  check('反論の数が、散文の名乗りと合う',
    反論数 > 0 && om !== null && 漢.indexOf(om[1]) === 反論数,
    '見出し ' + 反論数 + ' / 名乗り ' + (om ? om[1] : '無し'));
  /* README も反論の数を名乗っている。**三つと書いたまま五つに増えていた。** */
  const RJ = read('cpsbvbng26-dotcom', 'README.md') || '';
  const RE = read('cpsbvbng26-dotcom', 'README.en.md') || '';
  const rj = /反論は(.)つあります。五つは実際に受けた形のまま/.exec(RJ);
  const re = /There are (\w+)\. Five are kept in the words they were raised in/.exec(RE);
  const 英 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  check('README が名乗る反論の数が、見出しの数と合う（日英）',
    rj !== null && re !== null && 漢.indexOf(rj[1]) === 反論数 && 英.indexOf(re[1]) === 反論数,
    '見出し ' + 反論数 + ' / 日 ' + (rj ? rj[1] : '無し') + ' / 英 ' + (re ? re[1] : '無し'));

  /* **反論 6 は射程を紙面に預けている。**引用が紙面とずれれば、答えが宙に浮く。
   * 英文の引用を、凍結された紙面の翻刻と一字一句照合する。 */
  const IS = read('autonomy-and-self-cultivation', path.join('papers', 'imperial-selfhood.md')) || '';
  const 反論6 = (O.split('## 反論 6')[1] || '').split('## この文書の限界')[0];
  const 引用6 = [...反論6.matchAll(/`([A-Za-z][^`]*\s[^`]*)`/g)].map((m) => m[1]);
  const 無い6 = 引用6.filter((q) => IS.indexOf(q) < 0);
  check('反論 6 の英文の引用が、すべて紙面の翻刻にある',
    引用6.length >= 6 && 無い6.length === 0,
    '引用 ' + 引用6.length + (無い6.length ? ' / 翻刻に無い: ' + 無い6.join(' | ') : ''));
  check('反論 6 の崩し方が、紙面の残した但し書きを指している',
    反論6.indexOf('`the single most important open problem`') >= 0
    && 反論6.indexOf('この但し書きを記録から消せば、この答えは倒れます。') >= 0
    && O.indexOf('反論 6 の核にも答えていません。') >= 0);

  /* **自分で作った枠組みにも等級を付けること。**
   * 借りた枠組みだけ「解釈」と札を立て、自分のものを運用規則として書くのは非対称である。 */
  const Fr = read('cpsbvbng26-dotcom', path.join('docs', 'frames.md')) || '';
  check('城の比喩に、解釈という等級が付いている',
    Fr.indexOf('## この記録が自分で作った枠組み —— 城') >= 0
    && Fr.indexOf('| 解釈。検証不能 |') >= 0
    && Fr.indexOf('外から借りた枠組みには「解釈」と札を立て、自分の枠組みは運用規則として書いていました') >= 0);
  check('比喩の含意が検証されていないと書いてある',
    Fr.indexOf('検証されていないのは**含意**です') >= 0
    && Fr.indexOf('六つの本丸は他人が運営しています。') >= 0);
}

/* 外部からの評価の記録。件数を機械で数える。
 * ここを手で書けるようにしておくと、都合の悪い評価だけ落とせてしまう。 */

console.log('\n7.18 ですます調 —— 書き方 2 の行き渡り');

{
  /* **壊れた活用が残っていないこと。**く 五段の音便に「ました」を繋いだ形と、
   * 助詞を五段の語幹と見て活用させた形。漢字は正しいので目視では通り抜ける。
   *
   * **形は書き写さない。**check_text.js の表から読む。書き写せば、二つの並びが
   * 黙ってずれる。表を持っている check_text.js 自身は走査から外す。 */
  const CT0 = read('cpsbvbng26-dotcom', path.join('verification', 'check_text.js')) || '';
  const 壊れ = [...CT0.matchAll(/\{ re: \/([^/]+)\/, right: '[^']+', note: '(?:「[^」]+」＋|助詞|否定の「ない」)/g)]
    .map((m) => m[1]);
  const 出た = [];

  /* **対象の外を先に決める。**指示書・見本・逐語の翻刻・生成されたサイト・英語。
   * CLAUDE.md の「2 番が掛からないところ」と同じ並びである。 */
  const 外す = /(^|\/)(CLAUDE|CONTRIBUTING|SUBMIT)\.md$|(^|\/)(examples|tests|papers|site|node_modules|preprint|dist|fixtures|drafts)\//;
  const 散文 = [];
  const 全部 = [];
  const walk = (repo, rel) => {
    const abs = path.join(ROOT, repo, rel);
    let ents;
    try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (/^(\.git|node_modules|site|dist|__pycache__|fixtures)$/.test(e.name)) continue;
        walk(repo, r);
      } else if (/\.(md|toml)$/.test(e.name)) {
        全部.push([repo, r]);
        if (!外す.test(r) && !/\.en\.md$/.test(r)) 散文.push([repo, r]);
      }
    }
  };
  for (const repo of C.repos) walk(repo, '');

  for (const [repo, rel] of 全部) {
    if (repo === 'cpsbvbng26-dotcom' && rel === 'verification/check_text.js') continue;
    const text = read(repo, rel);
    if (text === null) continue;
    for (const w of 壊れ) if (text.indexOf(w) >= 0) 出た.push(repo + '/' + rel + ' の ' + w);
  }
  check('壊れた活用が、10 リポジトリのどこにも無い', 出た.length === 0,
    出た.length ? 出た.slice(0, 4).join(' / ') : (全部.length + ' ファイル / ' + 壊れ.length + ' 形'));

  /* **表に持っている形が五つであること。**推測で足せば、実際に混入した形という
   * 根拠が消える。 */
  const 対 = (CT0.match(/＋「ました」/g) || []).length;
  const 助 = (CT0.match(/note: '助詞「/g) || []).length;
  const CLm = read('cpsbvbng26-dotcom', 'CLAUDE.md') || '';
  const 名乗り = /`CONJUGATION` が\*\*(.)つ\*\*を止める/.exec(CLm);
  const 名乗り助 = /\*\*こちらは(.)つ\*\*を止める/.exec(CLm);
  const 漢 = '〇一二三四五六七八九十'.split('');
  /* 471（百本ノック五）。三つ目の壊れ方、否定の「ない」を「ありません」に替えた形。
   * CLAUDE.md の共通の区間は動かさないので、数は名乗らない。表に行があり、上の走査に入っていることだけを見る。 */
  const 否 = [...CT0.matchAll(/\{ re: \/([^/]+)\/, right: '[^']+', note: '否定の「ない」/g)].map((m) => m[1]);
  check('否定の「ない」を替えた壊れ方も、表から読んで 10 リポジトリを走査している',
    否.length > 0 && 否.every((w) => 壊れ.includes(w)), 否.join(', ') || '表に無い');
  check('止めている形の数が、CLAUDE.md の名乗りと合う',
    対 > 0 && 名乗り !== null && 漢.indexOf(名乗り[1]) === 対
    && 助 > 0 && 名乗り助 !== null && 漢.indexOf(名乗り助[1]) === 助,
    '音便 ' + 対 + ' 形（名乗り ' + (名乗り ? 名乗り[1] : '無し') + '） / 助詞 '
    + 助 + ' 形（名乗り ' + (名乗り助 ? 名乗り助[1] : '無し') + '）');

  /* **である調の繋ぎの語が、対象の散文に残っていないこと。**
   * 見ているのは繋ぎの語だけである —— である・ではない・でない・ていない。
   * **動詞の活用までは見ていない。**形態素解析が要るので、そこは検査の外にある。
   * 囲み・表・引用・見出し・生成された欄と、鉤括弧の中は外す。
   * **読点の前も外す。**ですます調でも、連体修飾と引用の中は終止形のままである。
   * 「論理が強制していない、いちばん高くつく割り当て」は正しい。 */
  const COP = /(である|ではない|でない|ていない|ではなかった|ていなかった)(。|$|[（(])/;
  const 残り = [];
  for (const [repo, rel] of 散文) {
    const text = read(repo, rel);
    if (text === null) continue;
    let infence = false, gen = false;
    text.split('\n').forEach((l, i) => {
      if (l.trim().indexOf('```') === 0) { infence = !infence; return; }
      if (infence) return;
      if (l.indexOf('ここから -->') >= 0) { gen = true; return; }
      if (l.indexOf('ここまで -->') >= 0) { gen = false; return; }
      if (gen) return;
      const s = l.replace(/^\s+/, '');
      if (s.indexOf('>') === 0 || s.indexOf('|') === 0 || s.indexOf('#') === 0) return;
      if (/^\s*(must_say|must_not_say|where)\s*=/.test(l)) return;
      const c = l.replace(/「[^」]*」/g, '＿').replace(/『[^』]*』/g, '＿')
                 .replace(/`[^`]*`/g, '＿').replace(/"[^"]*"/g, '＿');
      if (COP.test(c)) 残り.push(repo + '/' + rel + ':' + (i + 1));
    });
  }
  check('である調の繋ぎの語が、対象の散文に残っていない', 残り.length === 0,
    残り.length ? (残り.length + ' か所 —— ' + 残り.slice(0, 3).join(' / '))
                : (散文.length + ' ファイル'));

  /* **外したものを、表として書いてあること。**書いていなければ、次に触る側が
   * 掛かる範囲を印象で決める。 */
  const CL = read('cpsbvbng26-dotcom', 'CLAUDE.md') || '';
  const i2 = CL.indexOf('### 2 番が掛からないところ');
  const 行 = [];
  if (i2 >= 0) {
    for (const l of CL.slice(i2).split('\n')) {
      if (l.indexOf('|') === 0) 行.push(l);
      else if (行.length && l.indexOf('|') !== 0 && l.trim() !== '') break;
    }
  }
  check('外したものの表がある', 行.length >= 3, '表 ' + 行.length + ' 行（見出しと罫線を含む）');
  check('生成もとを直すと書いてある',
    CL.indexOf('生成物は、生成もとを直して作り直す') >= 0
    && CL.indexOf('生成された側を手で直すと、次の生成で戻る') >= 0);
  check('期待値を動かしたら壊して確かめると書いてある',
    CL.indexOf('これは検査を緩めることではない') >= 0
    && CL.indexOf('動かしたら壊して確かめる') >= 0);
  check('い形容詞を外したと書いてある', CL.indexOf('低いです') >= 0);
  check('2 番も数えられると書いてある', CL.indexOf('このうち 1・2・5・6 は、書いたあとに数えられる') >= 0);
}

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
    /* **強調の記法に依らせない。**閉じない太字を直したとき、
     * `**いま N 件。**` が `**…**。いま N 件。` に変わって外れた。
     * 見るのは数のほうである。 */
    const m = /いま (\d+) 件。/.exec(text);
    check('名乗る件数が、表の行数と一致する', m !== null && parseInt(m[1], 10) === rows,
      m ? ('名乗り ' + m[1] + ' / 行 ' + rows) : '「いま NN 件。」が無い');
    check('査読と呼ばないことが書いてある', text.indexOf('査読と呼びません') >= 0);
    check('丸写ししないことが書いてある', text.indexOf('丸写ししません') >= 0);
    check('褒めた箇所だけ載せないことが書いてある',
      text.indexOf('褒めた箇所だけ載せません') >= 0);
    check('出典が消えるものを証言として扱うと書いてある',
      text.indexOf('出典が消えるものは、証言として扱います') >= 0);
    check('日付を手で書かないと書いてある',
      text.indexOf('日付を手で書きません') >= 0);

    /* PlumX は計測であって評価ではない。「受けた評価」に混ぜない。
     * そして数値を転記しない —— 動くし、この環境から確かめられない。 */
    const plum = text.slice(text.indexOf('## 計測されているもの'),
                            text.indexOf('### 経路が二つある'));
    check('PlumX が評価ではないと書いてある',
      text.indexOf('計測であって評価ではありません') >= 0);
    check('PlumX の数を書き写さないと書いてある',
      text.indexOf('この記録に転記しません') >= 0);
    const pairs = [['7358818', '10.2139/ssrn.7358818'],
                   ['7358779', '10.2139/ssrn.7358779'],
                   ['7446961', '10.2139/ssrn.7446961']];
    const wrong = pairs.filter(([id, doi]) => {
      const row = plum.split('\n').find((l) => l.indexOf('ssrn_id=' + id) >= 0);
      return !row || row.indexOf(doi) < 0;
    }).map(([id]) => id);
    check('PlumX の宛先が、対応する SSRN の DOI と同じ行にある',
      wrong.length === 0, wrong.length ? ('ずれ: ' + wrong.join(', ')) : pairs.length + ' 件');
    const digits = /PlumX[^\n]*?[:：]\s*\d|閲覧\s*\d|ビュー\s*\d|保存\s*\d|言及\s*\d/;
    check('PlumX の数値が転記されていない', !digits.test(plum));
    /* **確かめていない行を、確かめた行と同じ顔で並べない。**
     * Series II の PlumX は宛先の形から組み立てただけで、頁は見ていない。 */
    check('確かめていない PlumX の行が、そう名乗っている',
      plum.indexOf('頁があるかは確かめていない') >= 0
      && plum.indexOf('宛先の形から組み立てた URL です') >= 0);

    /* autonomy の ERRATA の N7 は、この記録のいずれもニーチェに言及していないと
     * 述べている。述べたのなら、突き合わせられるようにする。
     * 記録に言及が増えたら、N7 の書き方を直すことになる。 */
    /* 使っている場の素性。名前だけ出して素性を伏せると、権威の借用になる。
     * 開発者、公表されている数、そして接地の材料が薄い側に当たることまで書く。 */
    check('使っている場の正式名称が書いてある',
      text.indexOf('正式名称は **Stanford Agentic Reviewer**') >= 0);
    check('使っている場の開発者が書いてある',
      text.indexOf('Yixing Jiang') >= 0 && text.indexOf('Andrew Ng') >= 0);
    check('公表されている数を確かめていないと書いてある',
      text.indexOf('原文に当たっていません') >= 0);
    check('接地の材料が薄い側に当たると書いてある',
      text.indexOf('接地の材料が薄い側に当たります') >= 0);

    /* 使っていることが、トップからも見えるか。記録の中だけに置くと、
     * 都合の悪い前提を奥にしまえてしまう。 */
    for (const page of ['index.html', 'index.en.html']) {
      const p = read('cpsbvbng26-dotcom', page) || '';
      check('トップが使っている場の名前を出している（' + page + '）',
        p.indexOf('Stanford Agentic Reviewer') >= 0);
      check('トップが接地の限界に触れている（' + page + '）',
        p.indexOf('arXiv') >= 0);
    }

    const errataN7 = read('autonomy-and-self-cultivation', 'ERRATA.md') || '';
    const 主張 = errataN7.indexOf('ニーチェに言及していない') >= 0;
    const 言及 = /ニーチェ|Nietzsche/.test(text);
    check('外部評価の記録にニーチェへの言及が無い（N7 の前提）',
      !主張 || !言及,
      主張 ? (言及 ? '記録に言及がある。N7 を直す' : '言及は無い')
           : 'N7 がその主張をしていない');
  }
}

/* **解釈の文書は、記録と混ぜない。**枠組みを当てても中身の価値は判定されない。
 * 当てはめが知見に化けないように、断りと覆し方を機械で押さえる。 */

console.log('\n7.6 外から当てられる枠組み（解釈）');

{
  const F = read('cpsbvbng26-dotcom', path.join('docs', 'frames.md'));
  check('枠組みの文書がある', F !== null, 'docs/frames.md');
  if (F !== null) {
    check('記録ではないと先に書いてある',
      F.indexOf('# 外から当てられる枠組み —— これは解釈である') >= 0
      && F.indexOf('この文書は、記録ではありません。') >= 0
      && F.indexOf('当てはめは、知見ではありません。') >= 0);
    check('等級を、書誌と当てはめで分けてある',
      F.indexOf('検索で確認。原典には当たっていない') >= 0
      && F.indexOf('解釈。検証不能') >= 0);
    /* 出典の数は表から数え直す。手で書けばずれる。 */
    const 漢 = '〇一二三四五六七八九十'.split('');
    const n = (F.match(/^\| \d+ \| /gm) || []).length;
    check('出典の数が、表から数え直したものと合う',
      n > 0 && n < 漢.length && F.indexOf('## 出典 —— ' + 漢[n] + 'つ') >= 0,
      n + ' 行');
    /* **枠組みを増やしても記録は上がらない。**そこが消えると宣伝に変わる。 */
    check('この当てはめが何も証明しないと書いてある',
      F.indexOf('## この当てはめが証明しないこと') >= 0
      && F.indexOf('何も証明しません。') >= 0
      && F.indexOf('枠組みを増やしても、記録は一段も上がりません。') >= 0);
    check('枠組みの文書にも覆し方がある',
      F.indexOf('## 覆し方') >= 0
      && F.indexOf('出典のいずれかが、書誌として誤っていることを示せば') >= 0);
  }
}

/* **方針は、行使して初めて意味を持つ。**決めごと 14 を自己紹介にも出す。
 * **そして、行使した事実を書くなら、相手を評価していないことも同じ場所に書く。**
 * 片方だけだと、勧誘してきた側への判定に読める。 */

console.log('\n7.8 出す先の決め');

{
  const D = DECL['出す先の決め'];
  const cl = read('cpsbvbng26-dotcom', 'CLAUDE.md') || '';
  check('決めごと 14 が、共通の決めごとに実在する',
    cl.indexOf('ダイヤモンド・オープンアクセスの場にしか出さない') >= 0
    && cl.indexOf('無償を謳う勧誘にも応じない') >= 0,
    '決めごと ' + D['決めごと']);
  for (const 場 of D['出す場所']) {
    const html = read('cpsbvbng26-dotcom', 場.file);
    const 無い = html === null ? ['頁が無い']
      : 場['必ず書いてあること'].filter((x) => html.indexOf(x) < 0);
    check('  ' + 場.file + ' が、方針と行使と非判定を書いている',
      無い.length === 0,
      無い.length ? 無い.join(' / ') : 場['必ず書いてあること'].length + ' 件');
  }
  /* **社名は、いちばん広い面には出さない。**記録の一節で足りる。 */
  const 出た = D['社名を出さない'].filter((f) => (read('cpsbvbng26-dotcom', f) || '')
    .indexOf('Eliva') >= 0);
  check('入口と自己紹介に、勧誘してきた社名を出していない', 出た.length === 0,
    出た.length ? ('出ている: ' + 出た.join(', ')) : D['社名を出さない'].length + ' 箇所');
}

/* **勧誘は通過の記録ではない。**だが、来たことは残す。
 * 落ちた記録を同じ欄に置いてあるのと同じ理由である。 */

console.log('\n7.7 受けた勧誘');

{
  const E = read('cpsbvbng26-dotcom', path.join('docs', 'external-evaluations.md')) || '';
  check('勧誘の記録があり、評価ではないと書いてある',
    E.indexOf('## 受けた勧誘 —— **これも評価ではない**') >= 0
    && E.indexOf('選別を一つも経ていません。') >= 0
    && E.indexOf('応じなかった記録も置きます。') >= 0);
  /* **個人の名は書かない**（決めごと 9）。会社と役だけで足りる。 */
  check('個人名を記録しないと書いてある',
    E.indexOf('**個人名は記録しない**') >= 0);
  /* **相手を評価していない。**決めたのは自分の側の規則である。 */
  check('相手についての判定ではないと書いてある',
    E.indexOf('これは相手についての判定ではありません**。') >= 0
    && E.indexOf('決めたのは自分の側の規則であって、相手の性質ではありません') >= 0
    && E.indexOf('返信していません。') >= 0);
  /* **登録の審査は、中身の審査ではない。**推薦でないことを書くなら、
   * **何の審査だったかも同じ場所に書く。**でないと、査読の隣に並んで読まれる。 */
  check('researchmap が推薦ではないと書いてある',
    E.indexOf('### 登録の審査 —— **中身の審査ではない**') >= 0
    && E.indexOf('researchmap の登録は、誰かの推薦で入ったものではありません。') >= 0
    && E.indexOf('HAL に登録したプレプリントを業績として出し、審査を通っています。') >= 0);
  check('登録の審査が、中身の審査ではないと書いてある',
    E.indexOf('**論文の中身ではない**。査読でもなければ、受け付けの門でもない。') >= 0
    && E.indexOf('通ったのは登録の資格であって、書いたものの質ではありません。') >= 0);
  check('登録の審査について、確かめられないことを書いてある',
    E.indexOf('**審査の記録は、こちらから見えません**。') >= 0
    && E.indexOf('検索でも、同姓同名の別人しか出てきません') >= 0
    && E.indexOf('| 根拠 | **証言** |') >= 0);
  {
    /* 正本の一覧の側にも同じ断りがあること。片方だけだと写しが古くなる。 */
    const C = read('cpsbvbng26-dotcom', path.join('docs', 'canonical-sources.md')) || '';
    check('正本の一覧も、推薦でないことを書いている',
      C.indexOf('**推薦ではなく、HAL に登録したプレプリントを業績として出して審査を通っています**') >= 0
      && C.indexOf('（証言。[external-evaluations.md](external-evaluations.md)）') >= 0);
    /* **散文に書いた篇数は、放っておくと古くなる。**実際、SSRN 版が三篇に
     * なったあとも「二篇だけ」と書いたまま残っていて、そのせいで
     * 「Trinity-Infinity の三本は、この経路では評価を受けられません」という
     * 誤りが残った。**表から数え直して突き合わせる。**決めごと 5 である。 */
    const 漢 = '〇一二三四五六七八九十'.split('');
    const n = (C.match(/SSRN `10\.2139\/ssrn\.\d+`/g) || []).length;
    const m = /SSRN 版があるのは(.)篇/.exec(C);
    check('SSRN 版の篇数が、表から数え直したものと合う',
      n > 0 && n < 漢.length && m !== null && m[1] === 漢[n],
      (m ? '名乗り ' + m[1] : '名乗りが無い') + ' 篇 / 表 ' + n + ' 篇');
    /* CORE に拾われた SSRN の篇も、散文に数を書いた。表の行から数え直し、どの DOI も DOI の索引にあることを確かめる。 */
    const rows = [...C.matchAll(/\| `(10\.2139\/ssrn\.\d+)` \| `https:\/\/core\.ac\.uk\/works\/\d+` \|/g)].map((x) => x[1]);
    const core = new Set(rows).size;
    const D = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md')) || '';
    const all = /SSRN に置いた(.)篇がすべて CORE に拾われています/.exec(C), more = /SSRN のほかの(.)篇も CORE で見つけました/.exec(C);
    check('CORE に拾われた篇数が表から数え直したものと合い、どの DOI も DOI の索引にある',
      core > 1 && core === rows.length && all !== null && all[1] === 漢[core] && more !== null && more[1] === 漢[core - 1] && rows.every((d) => D.indexOf(d) >= 0),
      '表 ' + core + ' 篇 / 名乗り ' + (all ? all[1] : '無い') + '・' + (more ? more[1] : '無い'));
  }

  /* **相手を調べたなら、調べた順序と等級を書く。**規則が先で調査が後である。
   * **そして、争われている一覧を確定した事実として使わない。** */
  check('調べたのが決めた後だと書いてある',
    E.indexOf('順序を先に書きます。決めたのが先で、調べたのは後です。') >= 0
    && E.indexOf('調べた結果がどうであれ、決定は変わりません') >= 0);
  check('国・言語・規模・水準が、等級つきで並べてある',
    ['| **国** |', '| **言語** |', '| **規模** |', '| **水準** |']
      .every((x) => E.indexOf(x) >= 0)
    && E.indexOf('**取れていない**。刊行点数も従業員数も') >= 0);
  /* 2026-11-12 の続き。**確かめられない第三者の評価を、名指しの相手について並べない。**
   * それまでは、会員の名簿・索引・第三者の一覧・体験談を、断りを付けて並べていた。
   * 断りを付けても、名指しの相手に並べた評判は判定として読まれる。外したことと、外した理由を固定する。 */
  const 水準 = (/### 水準 —— 第三者の評価は載せない\n([\s\S]*?)\n### /.exec(E) || ['', ''])[1];
  check('名指しの出版社について、会員の名簿・索引の記述を載せていない（相手の自称だけを残す）',
    水準.indexOf('**本人の公表**') >= 0 && !/COPE|OASPA|Scopus|Web of Science/.test(水準)
    && 水準.indexOf('団体の会員の名簿、索引への収録、第三者が作った一覧、利用者の体験談について、検索の結果に出た記述がありました。') >= 0);
  check('第三者の一覧と体験談を、名指しの相手について使っていない',
    !/Beall|vanity|否定的な体験談|肯定的な体験談/.test(E)
    && E.indexOf('第三者による評価は載せません。') >= 0 && E.indexOf('どれも原典を読めていません。') >= 0);
  check('判定しないと書き、判定しないと書いても判定として届くことを理由に挙げている',
    水準.indexOf('この記録は、出版社を判定しません。判定できる材料を持っていないからです。') >= 0
    && 水準.indexOf('確かめられない評判を名指しの相手について並べると、判定しないと書いても、読む側には判定として届きます。') >= 0);

  /* 引かれた題名が現行の紙面と一致することは、機械で当たれる。 */
  const cff = (read('autonomy-and-self-cultivation', 'CITATION.cff') || '')
    .replace(/\s+/g, ' ');
  const 題 = 'Manifesto of Imperial Selfhood: The Age of Personal Imperialism'
    + ' and Its Spiritual Existence';
  check('引かれた題名が、現行の紙面と一致する',
    E.indexOf('`' + 題 + '`') >= 0 && cff.indexOf(題) >= 0,
    cff.indexOf(題) >= 0 ? '一致' : 'CITATION.cff に無い');
  /* **勧誘の数は、放っておくと古くなる。**表の行数と差出人の数を数え直す（決めごと 5）。
   * 差出人は、「同上」で始まらない行の数である。**一通足して見出しを直し忘れると落ちる。** */
  {
    const 漢 = '〇一二三四五六七八九十'.split('');
    const i = E.indexOf('| いつ | 誰から | 何について |');
    const lines = i < 0 ? [] : E.slice(i).split('\n').slice(2);
    const rows = [];
    for (const l of lines) { if (!l.startsWith('|')) break; rows.push(l); }
    const 差出人 = rows.filter((l) => {
      const c = (l.split('|')[2] || '').replace(/[*\s]/g, '');
      return c.indexOf('同上') !== 0;
    }).length;
    const m = /表の行はいま(.)つあります。差出人は(.)つです/.exec(E);
    check('勧誘の行数と差出人の数が、名乗りと合う',
      m !== null && rows.length > 0
      && 漢.indexOf(m[1]) === rows.length && 漢.indexOf(m[2]) === 差出人,
      m ? ('名乗り ' + m[1] + ' 行 / ' + m[2] + ' 差出人  実際 '
           + rows.length + ' / ' + 差出人)
        : '名乗りが無い');
  }

  /* **四つ目は、費用に触れていない。**無償を謳っていないことと、
   * 取ることが分かっていることを、別に書く。**混ぜると規則の当て先がぼやける。** */
  check('四つ目の勧誘が、受理後に掲載料を取ると書いてある',
    E.indexOf('### 四つ目の勧誘 —— 受理後に掲載料を取る') >= 0
    && E.indexOf('**査読を通って受理されたあとに掲載料を取る**') >= 0
    && E.indexOf('費用に触れていません。') >= 0
    && E.indexOf('書かれていないだけです。') >= 0);
  check('免除と金額の不明が、回避の理由にならないと書いてある',
    E.indexOf('免除があることは、規則を回避する理由になりません。') >= 0
    && E.indexOf('金額が分からないことも、理由になりません。') >= 0);

  /* **同じ語が、こちらの探し物と向こうの売り物で一致した。**
   * ここを書かないと、今日の一覧と勧誘の区別が読む側に付かない。 */
  check('通りやすさの出どころの違いを書いてある',
    E.indexOf('`streamlined review process` を売りにしています') >= 0
    && E.indexOf('通ったのは選別ではありません。') >= 0
    && E.indexOf('どちらも、金では動きません。') >= 0);

  /* 決めごと 14 が根拠であること。相手の性質ではなく規則で決めている。 */
  check('決めごと 14 を根拠として引いている',
    E.indexOf('決めごとの 14 番が、この形をそのまま名指ししています。') >= 0
    && E.indexOf('**無償を謳う勧誘にも応じない**') >= 0);
}

/* **同じ語が三つの別のものに付いている場。**PhilArchive の投稿要件、PhilPapers の
 * 収録作品の区分、PhilPeople の人の区分である。混ざると、載っていることが
 * 審査を通ったことに化ける。**一度そう書いて直している**（SC-027）。
 * ここで見るのは、三つが範囲つきで分かれていることと、区分と審査を分ける一文である。 */

/* **出す先を決めただけでは、出したことにならない。**定期的な目標として一つの場を挙げるなら、
 * その場の明文と、いま届いていない分を同じところに書く。**将来の言明は、この場では
 * 根拠にならない**と場の側が明記している（<code>Aspirational statements…</code>）ので、
 * こちらもそれに合わせる。日付は git から取って突き合わせる。 */

console.log('\n7.10 定期的な目標（JOSS）');

{
  const J = DECL['定期的な目標'];
  const 面 = J['出す場所'];
  for (const 場 of 面) {
    const text = read('cpsbvbng26-dotcom', 場.file);
    const 無い = text === null ? ['頁が無い']
      : 場['必ず書いてあること'].filter((x) => text.indexOf(x) < 0);
    check('  ' + 場.file + ' が、場の名前と条件と届いていない分を書いている',
      無い.length === 0,
      無い.length ? 無い.join(' / ') : 場['必ず書いてあること'].length + ' 件');
  }

  /* **識別子は五つの面で同じでなければならない。**一つだけ直すと、そこが古くなる。 */
  for (const [名, 値] of Object.entries(J['どの面にも同じもの'])) {
    const 欠け = 面.map((x) => x.file)
      .filter((f) => (read('cpsbvbng26-dotcom', f) || '').indexOf(値) < 0);
    check('  ' + 名 + ' が、五つの面すべてで同じ', 欠け.length === 0,
      欠け.length ? 欠け.join(', ') : 値);
  }

  /* **四つの門は四つである。**一つ落としても散文は読めてしまう。 */
  const ja = read('cpsbvbng26-dotcom', 'index.html') || '';
  const 門 = ['<b>一つ目、公開の期間。</b>', '<b>二つ目、研究に使われている証拠。</b>',
              '<b>三つ目、開かれた開発の実践。</b>', '<b>四つ目、反復した開発。</b>'];
  const 立っている = 門.filter((x) => ja.indexOf(x) >= 0);
  check('査読の前の門が、四つとも立っている', 立っている.length === 4,
    立っている.length + ' / 4');

  /* **日付は git から取る。**散文に書いた二つが、実際の最初のコミットと合うか。 */
  const 最初 = (repo) => {
    try {
      return execFileSync('git', ['log', '--reverse', '--format=%as'],
        { cwd: path.join(ROOT, repo), encoding: 'utf8' }).split('\n')[0].trim();
    } catch (e) { return ''; }
  };
  const 全部 = C.repos.map(最初).filter(Boolean).sort();
  const 道具 = J['道具'].map(最初).filter(Boolean).sort();

  /* **頁に印字された日付そのものを読む。**宣言と git だけを突き合わせても、
   * 頁の数字を書き換えたら素通りする。**実際に一度そう組んで、直している。** */
  const 印字 = (text, re) => { const m = re.exec(text || ''); return m ? m[1] : ''; };
  const 面の日付 = [['index.html', /最も早い最初のコミットは <b>(\d{4}-\d{2}-\d{2})<\/b>/,
                                   /いちばん早いもので <b>(\d{4}-\d{2}-\d{2})<\/b>/],
                    ['index.en.html', /ten repositories is\s*<b>(\d{4}-\d{2}-\d{2})<\/b>/,
                                      /the earliest is <b>(\d{4}-\d{2}-\d{2})<\/b>/]];
  for (const [file, re九, re道] of 面の日付) {
    const text = read('cpsbvbng26-dotcom', file);
    const a = 印字(text, re九);
    const b = 印字(text, re道);
    check('  ' + file + ' の二つの日付が、git の最初のコミットと合う',
      a === 全部[0] && b === 道具[0] && a !== '' && b !== '',
      '印字 ' + (a || '取れない') + ' / ' + (b || '取れない')
      + '　git ' + 全部[0] + ' / ' + 道具[0]);
  }
  /* **出す一本の日付も頁に印字してある。**十の最も早い日とは別の数なので、別に見る。 */
  {
    const 初 = 最初('errata-check');
    const d = new Date(初 + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 6);
    d.setUTCDate(d.getUTCDate() + 1);
    const 短 = 初 ? d.toISOString().slice(0, 10) : '';
    const ja = 印字(read('cpsbvbng26-dotcom', 'index.html'),
      /errata-check は、最初のコミットが <b>(\d{4}-\d{2}-\d{2})<\/b>、最短が <b>\d{4}-\d{2}-\d{2}<\/b>/);
    const ja短 = 印字(read('cpsbvbng26-dotcom', 'index.html'),
      /errata-check は、最初のコミットが <b>\d{4}-\d{2}-\d{2}<\/b>、最短が <b>(\d{4}-\d{2}-\d{2})<\/b>/);
    const en = 印字(read('cpsbvbng26-dotcom', 'index.en.html'),
      /the first commit is <b>(\d{4}-\d{2}-\d{2})<\/b> and the earliest possible submission is <b>\d{4}-\d{2}-\d{2}<\/b>/);
    const en短 = 印字(read('cpsbvbng26-dotcom', 'index.en.html'),
      /the first commit is <b>\d{4}-\d{2}-\d{2}<\/b> and the earliest possible submission is <b>(\d{4}-\d{2}-\d{2})<\/b>/);
    check('出す一本の最初のコミットと最短が、頁と git で合う',
      初 !== '' && ja === 初 && en === 初 && ja短 === 短 && en短 === 短,
      '印字 ' + (ja || '取れない') + ' / ' + (ja短 || '取れない') + '（en ' + (en || '取れない')
      + ' / ' + (en短 || '取れない') + '）　git ' + (初 || '取れない') + ' / ' + 短);
  }
  /* **十の外は、git を引けない。**sophaxis と deposit-check は、横断の検査が取り寄せる十に入っていない。
   * 最初のコミットはそれぞれの側で見る。ここでは一本ずつ、六か月と一日の計算と、同じ日付が七つの面と
   * joss.md にあること、その節に届いていない門と、範囲を決めるのは場の側だと書いてあることを見る。 */
  for (const 外 of J['十の外']['一覧']) {
    const d = new Date(外['最初のコミット'] + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 6);
    d.setUTCDate(d.getUTCDate() + 1);
    const 短 = d.toISOString().slice(0, 10);
    const 欠け = 面.map((x) => x.file).filter((f) => {
      const t = read('cpsbvbng26-dotcom', f) || '';
      /* 頁では日付を太字で書く。足した日など、同じ日付が地の文に別の意味で出ても、取り違えない。 */
      const 日 = (x) => (/\.html$/.test(f) ? '<b>' + x + '</b>' : x);
      return t.indexOf(外['名前']) < 0 || t.indexOf(日(外['最初のコミット'])) < 0
        || (/^README|^index\.(?:en\.)?html$/.test(f) && t.indexOf(日(外['最短'])) < 0);
    });
    const md = read('cpsbvbng26-dotcom', path.join('docs', 'joss.md')) || '';
    const i = md.indexOf(外['節']);
    const j = i >= 0 ? md.indexOf('\n## ', i + 1) : -1;
    const 節 = i >= 0 ? md.slice(i, j > i ? j : md.length) : '';
    check(外['名前'] + ' の最短が、最初のコミットから六か月と一日で、面と joss.md に同じ日付がある',
      短 === 外['最短'] && 欠け.length === 0
      && 節.indexOf('- 門 1。最初のコミットは ' + 外['最初のコミット'] + ' です。最短は ' + 外['最短'] + ' です。') >= 0
      && md.indexOf('`' + 外['リポジトリ'] + '` は ' + 外['最短'] + ' です。') >= 0,
      '計算 ' + 短 + ' / 宣言 ' + 外['最短'] + (欠け.length ? ' / 欠け ' + 欠け.join(', ') : '') + (節 ? '' : ' / 節が無い'));
    const 無い文 = 外['必ずある文'].filter((x) => 節.indexOf(x) < 0);
    check(外['名前'] + ' の節に、届いていない門と、範囲を決めるのは場の側だと書いてある', 節 !== '' && 無い文.length === 0,
      無い文.join(' / '));
  }
  check('宣言した二つの日付も、git と合う',
    全部.length === C.repos.length && 全部[0] === J['十で最も早い']
    && 道具.length === J['道具'].length && 道具[0] === J['道具で最も早い'],
    '実際 ' + (全部[0] || '取れない') + ' / ' + (道具[0] || '取れない'));
}

/* **「全部出す」と書いたなら、全部の状態を数える。**十それぞれについて、
 * 最初のコミットと、公開されたタグと、門 1 に届く最短日を git から取り直す。
 * **ローカルのタグを数えると足りない。**一度そう数えて、三つを一つと書いている。 */

console.log('\n7.11 JOSS —— 十の状態');

{
  const F = path.join('docs', 'joss.md');
  const md = read('cpsbvbng26-dotcom', F) || '';
  const 行 = {};
  for (const line of md.split('\n')) {
    if (!line.startsWith('| ')) continue;
    const c = line.split('|').map((x) => x.trim());
    if (c.length !== 9) continue;
    if (!C.repos.includes(c[1])) continue;
    行[c[1]] = { タグ: c[4], 初: c[6], 最短: c[7] };
  }
  check('十が全部、表の行として立っている',
    Object.keys(行).length === C.repos.length,
    Object.keys(行).length + ' / ' + C.repos.length);

  const g = (repo, args) => {
    try {
      return execFileSync('git', args,
        { cwd: path.join(ROOT, repo), encoding: 'utf8' });
    } catch (e) { return null; }
  };
  /* 六か月を「超えて」である。丸六か月の翌日が最短になる。 */
  const 最短 = (iso) => {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + 6);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const ずれ = [];
  for (const repo of C.repos) {
    const r = 行[repo];
    if (!r) { ずれ.push(repo + ' の行が無い'); continue; }
    const out = g(repo, ['log', '--reverse', '--format=%as']);
    const 初 = out === null ? '' : out.split('\n')[0].trim();
    if (初 !== r.初) ずれ.push(repo + ' の最初のコミット ' + r.初 + ' / git ' + (初 || '取れない'));
    else if (最短(初) !== r.最短) ずれ.push(repo + ' の最短 ' + r.最短 + ' / 実際 ' + 最短(初));
  }
  check('表の最初のコミットと、門 1 に届く最短が、git と合う', ずれ.length === 0,
    ずれ.length ? ずれ.join(' / ') : C.repos.length + ' 件');

  /* **公開されたタグを数える。**ここが、手元のタグと食い違っていた箇所である。 */
  const タグずれ = [];
  for (const repo of C.repos) {
    const r = 行[repo];
    if (!r) continue;
    const out = g(repo, ['ls-remote', '--tags', 'origin']);
    if (out === null) { タグずれ.push(repo + ' のタグが取れない'); continue; }
    const n = out.split('\n').filter((l) => /refs\/tags\/[^^]*$/.test(l.trim())).length;
    const 名乗り = r.タグ === '**無い**' ? 0 : parseInt((/(\d+)/.exec(r.タグ) || [0, '-1'])[1], 10);
    if (n !== 名乗り) タグずれ.push(repo + ' 名乗り ' + 名乗り + ' / 実際 ' + n);
  }
  check('表の公開されたタグの数が、git ls-remote と合う', タグずれ.length === 0,
    タグずれ.length ? タグずれ.join(' / ') : C.repos.length + ' 件');

  /* **出す先と、出さない先は、同じ文書に置く。**片方だけだと、決めが半分に見える。
   * **そして「出さない」を「取り下げた」と読ませない。**登録簿の撤回とは別の話である。 */
  check('出す先が二つとも、同じ文書に並べてある',
    md.indexOf('## 論文の側も出す —— 開示できない部分を、できないまま書いて出す') >= 0
    && md.indexOf('| **道具（リポジトリ）** | **JOSS** |') >= 0
    && md.indexOf('| **論文（プレプリント）** | **ダイヤモンド・オープンアクセスの査読誌** |') >= 0);
  /* **決めを変えたなら、前の決めと変えた理由を同じ節に残す。**
   * 書き換えただけだと、最初からそう決めていたように読める。 */
  check('費用が理由ではないと書いてある',
    md.indexOf('**費用の問題ではありません**。決めごと 14 は、その六篇について障害になっていません。') >= 0
    && md.indexOf('不完全なのは開示ではなく、開示できる材料のほうです。') >= 0);
  check('前の決めと、変えた理由が同じ節にある',
    md.indexOf('**2026-09-15 に決めを変えました**。') >= 0
    && md.indexOf('前は「開示が書けないから出さない」でした。') >= 0);
  /* **撤回ではない。**棚から動かさないだけである。ここを落とすと、取り下げに読める。 */
  check('取り下げではないと書いてある',
    md.indexOf('**プレプリントは動かしません**。') >= 0
    && md.indexOf('**取り下げるのではありません**。査読誌に出すこととは別です。') >= 0);
  /* **申告と開示は別である。**丸を付けない欄があることを、同じ節に書く。 */
  check('丸を付けない欄があると書いてある',
    md.indexOf('「文章は実質的に著者自身のものである」という申告には、丸を付けません。') >= 0);
  /* **六篇の内訳が、実際の篇数と合う。**哲学三篇と Trinity-Infinity 三篇である。 */
  {
    const 数 = (repo) => ((read(repo, 'CITATION.cff') || '').match(/^\s+- type: article$/gm) || []).length;
    const 哲 = 数('autonomy-and-self-cultivation');
    const ti = 数('trinity-infinity');
    check('「六篇」が、哲学三篇と Trinity-Infinity 三篇の和と合う',
      哲 + ti === 6 && md.indexOf('**出すのは六篇です**。') >= 0,
      '哲学 ' + 哲 + ' / Trinity-Infinity ' + ti);
  }

  /* **出すのは一本である。**2026-09-26 までは「十全部」と書いていた。規定の範囲に
   * 照らして絞ったので、宣言の語が変わった。**届いていない門を書く条件はそのまま残す。** */
  check('出すのは三本だと書いてあり、前の三つの決めと、届いていない門も同じ文書にある',
    md.indexOf('**出すのは `errata-check`・`sophaxis`・`deposit-check` の三本です**。2026-11-02 に `deposit-check` を足しました。') >= 0
    && md.indexOf('それまでは「出すのは `errata-check` と `sophaxis` の二本です」と書いていました。') >= 0
    && md.indexOf('それまでは「出すのは `errata-check` 一本です」と書いていました。') >= 0
    && md.indexOf('それまでは「出すのは十全部です」と書いていました。') >= 0
    && md.indexOf('いちばん早いものでも、六か月を超えていません。') >= 0
    && md.indexOf('十とも、著者以外に使われた記録がありません。') >= 0
    && md.indexOf('**論文と史料ノートは、そもそも software ではありません**。') >= 0);

  /* **絞ったなら、外したものも一つずつ挙げる。**「一本」とだけ書くと、残りを
   * 黙って落としたように読める。絞った表が十を一度ずつ挙げ、**出す**が一行だけで、
   * それが散文の一本と同じであることを見る。 */
  {
    const i = md.indexOf('## 一本に絞った —— 2026-09-26');
    const j = md.indexOf('## 門は四つある');
    const 節 = (i >= 0 && j > i) ? md.slice(i, j) : '';
    const 行 = 節.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| ---')
      && !l.startsWith('| リポジトリ'))
      .map((l) => l.split('|').map((x) => x.trim()));
    const 名 = 行.map((c) => c[1]);
    const 出す = 行.filter((c) => c[2] === '**出す**').map((c) => c[1]);
    const 欠け = C.repos.filter((r) => 名.indexOf(r) < 0);
    const 重複 = 名.filter((r, k) => 名.indexOf(r) !== k);
    check('絞った表が十を一度ずつ挙げ、十から出すのは一つだけで、散文の三本の一本目と同じ',
      行.length === C.repos.length && 欠け.length === 0 && 重複.length === 0
      && 出す.length === 1 && 出す[0] === 'errata-check'
      && md.indexOf('**出すのは `' + [出す[0]].concat(DECL['定期的な目標']['十の外']['一覧'].map((x) => x['リポジトリ'])).join('`・`') + '` の三本です**。') >= 0,
      欠け.length ? '欠け ' + 欠け.join(', ') : (重複.length ? '重複 ' + 重複.join(', ')
        : '出す ' + (出す.join(', ') || '無し') + ' / ' + 行.length + ' 行'));
  }

  /* **software でないものの数を、表から数え直す。**
   * 散文に「この五つ」と書いた以上、表の種別と食い違えば落ちる。 */
  {
    const 非 = ['論文', '史料ノート', '覚書'];
    const 行 = md.split('\n').filter((l) => l.startsWith('| ') && l.split('|').length >= 9);
    const n = 行.filter((l) => 非.indexOf(l.split('|')[2].trim()) >= 0).length;
    const 漢 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
    check('software でないものの数が、表と散文で合う',
      md.indexOf('この' + 漢 + 'つは出しません。') >= 0,
      '表から数えて ' + n + ' 件');
  }
}

console.log('\n7.9 「専門職」という語の三つの範囲');

{
  const E = read('cpsbvbng26-dotcom', path.join('docs', 'external-evaluations.md')) || '';
  const A = read('cpsbvbng26-dotcom', path.join('docs', 'self-assessment.md')) || '';

  check('三つの語が、それぞれ何に付くかつきで並べてある',
    [['`professional quality`', '投稿される作品'],
     ['`professional status`', '収録された作品'],
     ['`pro`', '人']]
      .every(([語, 範囲]) => new RegExp('\\| ' + 語.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + ' \\| ' + 範囲 + ' \\|').test(E)));

  /* **区分に入っていることは、読まれたことではない。**ここを外すと SC-027 に戻る。 */
  check('既定の一覧に出ることと、門が下りたことを分けてある',
    E.indexOf('既定の一覧に出ることは、門が下りたことではありません。') >= 0
    && E.indexOf('**門は下りていない**（SC-027）') >= 0
    && E.indexOf('一覧に出すかどうかを決める区分と、誰かが読んだかどうかは、別の事柄です') >= 0);

  /* **人の側の条件は二つしか無い。**丸めて書くと、条件が増えたようにも減ったようにも読める。 */
  check('人の側の条件が、二つとも書いてある',
    E.indexOf('**人の側の条件は二つしか無い**。') >= 0
    && E.indexOf('PhilPapers が「最も人気のある」と挙げる') >= 0
    && E.indexOf('どちらも満たしていません。') >= 0);
  check('自己分析の学位の行も、同じ二つの条件で書いてある',
    /\| 学位 \|[^|]*\|[^|]*PhilPapers が「最も人気のある」と挙げる雑誌への掲載[^|]*\| \*\*検索で確認\*\*（原典未読） \|/.test(A));

  /* **丸めた言い方に戻していない。**「指定誌」では、どの一覧かが落ちる。 */
  const 丸めた = ['docs/self-assessment.md', 'docs/external-evaluations.md']
    .filter((x) => (read('cpsbvbng26-dotcom', x) || '').indexOf('指定誌') >= 0);
  check('条件を「指定誌」と丸めていない', 丸めた.length === 0, 丸めた.join(', '));

  /* **区分は、推した結果ではなく引いた結果である。**所属で一件出たことを、
   * 区分の証拠に読み替えない。SC-027 と SC-029 が、同じ読み替えの記録である。 */
  check('人の側の区分を、画面で引いた結果として書いてある',
    E.indexOf('人の側の区分は、あとから画面で確かめています。区分は non-pro です。') >= 0
    && E.indexOf('non-pro を**含める**設定にすると、所属（`ZEN大学`）で引いて出ます') >= 0
    && E.indexOf('**所属で出たことは、区分を覆しません**。分けているのは設定のほうです。') >= 0
    && E.indexOf('**根拠は著者の画面であって、こちらは見ていない**（**証言**）') >= 0);

  /* **明文を読んでいないことを、読んだように書かない。**三つとも検索から写している。 */
  check('原典を読んでいないと書いてある',
    E.indexOf('明文の三つも、検索の結果から写しています。原典の頁は読んでいません。') >= 0
    && E.indexOf('egress proxy が `connect_rejected` を返します') >= 0
    && E.indexOf('**だから、この節が言えるのは区分の存在までです**。') >= 0);
}

/* **再発見した相手が何者かを、入口と自己紹介にも出す。**
 * 「既知だった」だけでは、骨董か旗艦か分からない。そして格を書いたら、
 * **何を落とした特殊例かも同じ場所に書く。**片方だけだと、卑下か自慢に倒れる。 */

console.log('\n7.5 再発見した相手');

{
  const R = DECL['再発見の相手'];
  const ti = read('trinity-infinity', 'ERRATA.md') || '';
  check('正の側（ERRATA の E8）に、格と寸法の両方がある',
    ti.indexOf('### どの程度のモデルか') >= 0
    && ti.indexOf('### そして、何を落とした特殊例か') >= 0
    && ti.indexOf(R['名前']) >= 0);
  for (const 場 of R['出す場所']) {
    const html = read('cpsbvbng26-dotcom', 場.file);
    const 無い = html === null ? ['無い']
      : 場['必ず書いてあること'].filter((x) => html.indexOf(x) < 0);
    check('  ' + 場.file + ' が、相手の格と落とした分の両方を書いている',
      無い.length === 0,
      無い.length ? 無い.join(' / ') : 場['必ず書いてあること'].length + ' 件');
  }
}

/* 正誤表の項目への参照が、宛先を持っているか。
 * 無い項目を指しても、いまは誰も気づかない。**宛先の無い参照は、
 * 札だけ立った空き地である。**
 * 参照先が曖昧な id（E1 は三つのリポジトリにある）は、指す先を宣言で絞る。 */

console.log('\n7. 正誤表の項目への参照');

{
  const R = DECL['正誤表の項目への参照'];
  const ID = /(?<![A-Za-z0-9_%-])([EN]\d{1,2})(?![A-Za-z0-9_-])/g;

  /* 各リポジトリの ERRATA.md が定義している項目を集める。 */
  const defined = {};
  for (const repo of R['定義元']) {
    const text = read(repo, 'ERRATA.md');
    defined[repo] = new Set();
    if (text === null) continue;
    for (const m of text.matchAll(/^#{2,3} ([EN]\d{1,2}) —/gm)) defined[repo].add(m[1]);
  }
  R['定義元'].forEach((repo) => {
    check(repo + ' の ERRATA が項目を定義している', defined[repo].size > 0,
      defined[repo].size + ' 件');
  });

  const refs = R['参照'].slice();
  const pp = R['論文ページ'];
  for (const [slug, repo] of Object.entries(pp['対応'])) {
    for (const suffix of ['.html', '.en.html']) {
      refs.push({ repo: pp.repo, file: path.join('papers', slug + suffix), '指す先': [repo] });
    }
  }

  const dangling = [];
  let counted = 0;
  for (const r of refs) {
    const text = read(r.repo, r.file);
    if (text === null) { dangling.push(r.file + ' が無い'); continue; }
    const allowed = new Set();
    r['指す先'].forEach((repo) => (defined[repo] || new Set()).forEach((i) => allowed.add(i)));
    for (const m of text.matchAll(ID)) {
      counted++;
      if (!allowed.has(m[1])) dangling.push(r.file + ' の ' + m[1]);
    }
  }
  check('正誤表の項目への参照に、宛先の無いものが無い', dangling.length === 0,
    dangling.length ? dangling.slice(0, 8).join(', ') : refs.length + ' ファイルに ' + counted + ' 箇所');
}

/* 引用してはいけない DOI が、散文では必ず札とともに出ているか。
 * 無標で置くと、読者が現行の番号として引く。**落とし穴の蓋である。**
 * 宣言ファイルは対象外 —— 検査の入力であり、鍵の名前が文脈を持つ。 */

console.log('\n8. 引用してはいけない DOI の札');

{
  const T = DECL['旧 DOI の札'];
  const SKIPDIR = new Set(['.git', 'node_modules', 'site', 'dist', '__pycache__', 'venv']);
  const naked = [];
  let found = 0;

  function walk(dir, repo) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIPDIR.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, repo); continue; }
      if (!['.md', '.html'].includes(path.extname(e.name))) continue;
      const text = fs.readFileSync(full, 'utf8');
      let i = -1;
      while ((i = text.indexOf(T.doi, i + 1)) >= 0) {
        found++;
        const w = text.slice(Math.max(0, i - T['窓']), i + T.doi.length + T['窓']);
        if (!T['札'].some((l) => w.indexOf(l) >= 0)) {
          naked.push(repo + '/' + path.relative(path.join(ROOT, repo), full));
        }
      }
    }
  }
  for (const repo of C.repos) {
    const dir = path.join(ROOT, repo);
    if (fs.existsSync(dir)) walk(dir, repo);
  }
  check('引用してはいけない DOI が、無標で置かれていない', naked.length === 0,
    naked.length ? [...new Set(naked)].join(', ') : found + ' 箇所すべてに札がある');
}

/* ---------- 論文の外で撤回した書籍 ---------- */

/* **登録簿の奥にしか無いものは、外からは見つからない。**
 * 実際に外部の評価が、この本を撤回されていないものとして挙げた。
 * 撤回したのなら、読まれる場所に書く。 */

console.log('\n9. 論文の外で撤回した書籍');

{
  const B = DECL['書籍の撤回'];
  const reg = read('self-correction', 'register.toml') || '';
  check('登録簿に項目がある', reg.indexOf('id = "' + B['項目'] + '"') >= 0, B['項目']);
  B['出す場所'].forEach((p) => {
    const text = read(p.repo, p.file) || '';
    check(p.repo + '/' + p.file + ' が題名を出している',
      text.indexOf(B['題名']) >= 0, B['題名']);
  });
  /* 題名だけ出して、何が起きたかを書かないのは出したことにならない。 */
  const ti = read('trinity-infinity', 'README.md') || '';
  B['必ず添えること'].forEach((w) => {
    check('trinity-infinity の README が「' + w + '」を添えている', ti.indexOf(w) >= 0);
  });
}

/* ---------- Zenodo との連携の但書 ---------- */

/* 「Zenodo が正」とだけ書くと、仕組みで保証されていると読まれる。
 * **実際には、この環境から Zenodo へは何も送れない。**番号は転記であって確認ではなく、
 * 版の DOI か概念 DOI かの判別も付かない。その但書が消えたら落ちる。 */

console.log('\n10. Zenodo との連携の但書');

{
  const Z = DECL['Zenodo の但書'];
  const text = read('cpsbvbng26-dotcom', Z.file);
  check('但書がある', text !== null, Z.file);
  if (text !== null) {
    const i = text.indexOf(Z['見出し']);
    check('但書の節がある', i >= 0, Z['見出し']);
    const sec = i < 0 ? '' : text.slice(i);
    for (const line of Z['必ず書いてあること']) {
      check('  ' + line.replace(/\n/g, ' ').slice(0, 36),
        sec.indexOf(line) >= 0);
    }
  }

  /* 但書が「確かめていない」と言っている以上、一覧の側も未確認を未確認のまま
   * 持っていること。片方だけ書き換わると、但書が空文になる。 */
  const idx = read('cpsbvbng26-dotcom', Z['一覧']) || '';
  check('一覧が、確かめていないことを書いている',
    idx.indexOf(Z['一覧に必ずあること']) >= 0, Z['一覧に必ずあること']);
  /* 414（百本ノック五）。2026-11-12 に DataCite で、未確認だった番号が概念 DOI だと決まった。
   * 番号が一覧に残り、その行が概念 DOI と名乗っていること。決まった結果を書き換えれば落ちる。 */
  {
    const 行 = idx.split('\n').find((l) => /^\| \d+ \|/.test(l) && l.indexOf('`' + Z['確かめた番号'] + '`') >= 0) || '';
    check('一覧に、確かめた番号が概念 DOI として残っている',
      行.indexOf('概念 DOI') >= 0 && idx.indexOf('## 確かめた番号') >= 0, Z['確かめた番号']);
  }
  /* **Software Heritage が指している版が、実際に履歴にあるか。**
   * 一覧が木の名前を印字している。そこから短縮ハッシュを取り出して
   * researcher-profile の履歴に当たる。**印字を書き換えれば落ちる。**
   * 番号そのものは Zenodo に出られないので確かめられない。
   * **確かめられるのは、指し先の版が実在することだけである。** */
  {
    const m = /`cpsbvbng26-dotcom-researcher-profile-([0-9a-f]{7,})`/.exec(idx);
    let 件名 = '';
    if (m) {
      try {
        件名 = require('child_process')
          .execFileSync('git', ['log', '-1', '--format=%s', m[1]],
                        { cwd: path.join(ROOT, 'researcher-profile'), encoding: 'utf8' }).trim();
      } catch (e) { 件名 = ''; }
    }
    check('Software Heritage が指す版が、researcher-profile の履歴にある',
      m !== null && 件名 !== '',
      m ? (m[1] + ' —— ' + (件名 || '履歴に無い')) : '木の名前が印字されていない');
  }
}

/* ---------- 先に立てておく反論 ---------- */

/* 三つの反論は、実際に受けた形のまま置いてある。**当たっている部分を先に書く。**
 * ここが「反論を黙らせる文書」に書き換わると、記録ではなく宣伝になる。
 * 認めるところと、崩し方が消えたら落ちるようにしてある。 */

console.log('\n11. 先に立てておく反論');

{
  const O = DECL['反論'];
  const text = read('cpsbvbng26-dotcom', O.file);
  check('反論を先に立てた文書がある', text !== null, O.file);
  if (text !== null) {
    for (const item of O['項目']) {
      check('反論が原文のまま置いてある  ' + item['見出し'],
        text.indexOf(item['原文']) >= 0, item['原文']);
      const i = text.indexOf(item['原文']);
      const j = text.indexOf('## 反論', i + 1);
      const sec = text.slice(i, j < 0 ? text.length : j);
      check('  認めるところが書いてある  ' + item['見出し'],
        sec.indexOf('### 認めるところ') >= 0 && sec.indexOf(item['認める']) >= 0,
        item['認める']);
      check('  崩し方が書いてある  ' + item['見出し'],
        sec.indexOf('### この答えの崩し方') >= 0);
    }
    check('答えきれない部分を、答えきれないと書いてある',
      text.indexOf(O['限界']) >= 0, O['限界']);
    for (const f of O['入口']) {
      const r = read('cpsbvbng26-dotcom', f) || '';
      check('入口から辿れる  ' + f, r.indexOf(O.file) >= 0);
    }
  }

  /* 反論 1 の核は解けていない。**登録簿でも open のままであること。**
   * ここが standing や corrected に変わったら、解けたと名乗ったことになる。 */
  const reg = read('self-correction', 'register.toml') || '';
  const k = reg.indexOf('id = "' + O['未解決の項目'] + '"');
  const blk = k < 0 ? '' : reg.slice(k, k + 400);
  check('価値を判定できないことが、登録簿で未解決のままである',
    /status\s*=\s*"open"/.test(blk), O['未解決の項目']);
}

/* ---------- ライセンスの分け方 ---------- */

/* 散文と論文は CC BY 4.0、実装は MIT。両方が入っているリポジトリで LICENSE が
 * CC BY 4.0 しか無いと、検査スクリプトを CC BY 4.0 だと読む余地が残る。
 * **実際に四つのリポジトリがその状態だった。** */

console.log('\n12. ライセンスの分け方');

{
  const L = DECL['ライセンス'];
  for (const repo of L['両方']) {
    const prose = read(repo, 'LICENSE');
    const code = read(repo, 'LICENSE-CODE');
    const readme = read(repo, 'README.md') || '';
    check(repo + '  散文が CC BY 4.0 である',
      prose !== null && prose.indexOf(L['散文の見出し']) === 0);
    check(repo + '  実装の MIT が別に置いてある',
      code !== null && code.indexOf(L['実装の見出し']) === 0);
    check(repo + '  README がどちらがどちらかを書いている',
      readme.indexOf(L['README が指す先']) >= 0, L['README が指す先']);
  }
  for (const repo of L['実装のみ']) {
    const prose = read(repo, 'LICENSE');
    check(repo + '  LICENSE が MIT である',
      prose !== null && prose.indexOf(L['実装の見出し']) === 0);
    check(repo + '  分けていない（LICENSE-CODE を置いていない）',
      read(repo, 'LICENSE-CODE') === null);
  }

  /* 写した errata_check.py に、MIT の権利表示が入っているか。
   * MIT は「著作権表示と許諾表示を全ての複製に含める」ことを条件にしている。
   * 写した先の LICENSE は CC BY 4.0 なので、表示が無いと辿れる先が無くなる。 */
  for (const item of DECL['写した版と DOI']) {
    const src = read(item.repo, 'verification/errata_check.py') || '';
    const head = src.slice(0, 2000);
    check(item.repo + '  写した道具に MIT の権利表示がある',
      head.indexOf(L['実装の見出し']) >= 0
        && head.indexOf('The above copyright notice') >= 0);
  }
}

/* 正誤表に足した数が、それを出した道具の側と合っているか。
 *
 * `E8` の寸法の表は `trinity-operator` の段 6 が出した数である。
 * **二つの repo に同じ数が載っている。**片方を直してもう片方を忘れると、
 * 凍結された紙面についての訂正のほうがずれる。ここで突き合わせる。 */
{
  console.log('\n14. 正誤表の寸法と、それを出した道具');
  const err = read('trinity-infinity', 'ERRATA.md');
  const road = read('trinity-operator', 'roadmap/README.md');
  check('trinity-infinity に ERRATA.md がある', err !== null);
  check('trinity-operator に展望の README がある', road !== null);
  if (err !== null && road !== null) {
    check('E8 に寸法の節がある', err.indexOf('### 特殊例の寸法 —— 測った') >= 0);
    /* 二つの文書から同じ形の行を拾い、n ごとに突き合わせる。 */
    const rows = (t) => {
      const out = {};
      const re = /^\| (\d) \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \| (\d+) \| 1\/(\d+) \|$/gm;
      let m;
      while ((m = re.exec(t)) !== null) {
        out[m[1]] = [m[2], m[3], m[4], m[5]].join('/');
      }
      return out;
    };
    const a1 = rows(err);
    const b1 = rows(road);
    const ns = Object.keys(a1);
    check('E8 の寸法の表に行がある（' + ns.length + ' 行）', ns.length >= 4,
      String(ns.length));
    const bad = ns.filter((n) => a1[n] !== b1[n]);
    check('E8 の寸法が、段 6 の README と一字一句合う', bad.length === 0,
      bad.map((n) => 'n=' + n + ' 正誤表 ' + a1[n] + ' / 展望 ' + (b1[n] || '無し'))
        .join('; '));
    /* **一点では分離しないことを、正誤表の側でも消せなくする。** */
    check('E8 が、一点の均衡では区別がつかないと書いている',
      err.indexOf('一点の均衡では、区別がつかない') >= 0
      && err.indexOf('一件も落ちませんでした') >= 0);
    /* **弁明にしない一行。**ここが消えると、測ったことが言い訳に転じる。 */
    check('E8 が、これは弁明ではないと書いている',
      err.indexOf('ただし、これは弁明ではありません。') >= 0);
    /* **PDF を直していないことを書いてある。** */
    check('E8 が、直したのは正誤表のほうだと書いている',
      err.indexOf('**PDF は直していない**') >= 0);
  }
}

/* ---------- 予想の英語サイトが、生成もとと同じか ----------
 *
 * trinity-operator/site/index.html は researcher-profile から生成して写したもの。
 * 写したあとで手で直すと、次の生成で黙って戻る。生成し直して、一字一句を突き合わせる。 */

console.log('\n12b. 予想の英語サイト（golden-window-conjecture.vercel.app）');

{
  const rp = path.join(ROOT, 'researcher-profile');
  const 写し = read('trinity-operator', path.join('site', 'index.html'));
  let 生成 = null;
  if (写し !== null && fs.existsSync(path.join(rp, 'build.js'))) {
    const out = fs.mkdtempSync(path.join(require('os').tmpdir(), 'golden-window-'));
    try {
      execFileSync('node', [path.join(rp, 'build.js')], {
        env: Object.assign({}, process.env, {
          PROFILE_CONFIG: path.join(rp, 'golden-window.en.json'),
          PROFILE_OVERLAY: path.join(rp, 'golden-window.site.json'),
          PROFILE_OUT: out,
        }),
        stdio: 'pipe',
      });
      生成 = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    } catch (e) {
      生成 = null;
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  check('trinity-operator/site/index.html が、researcher-profile から生成したものと一字一句同じ',
    写し !== null && 生成 !== null && 写し === 生成,
    写し === null ? 'site/index.html が無い' : (生成 === null ? '生成できない' : ''));
}

/* Sophaxis の頁（researcher-profile の sophaxis*.json と、写した notes/sophaxis*.html）は、
 * 載っている記録の数を地の文で名乗る。決めごと 5 により、名乗りを一覧の項目と突き合わせる。
 * 一覧の id は 2026.0001 から欠けずに並ぶ。sophaxis は十に入らないので、その記録とは比べない。 */

console.log('\n12c. Sophaxis の頁が名乗る記録の数');

{
  const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const listed = (html) => [...String(html).matchAll(/Sophaxis:(2026\.\d{4})<\/a>/g)].map((m) => m[1]);
  const consecutive = (ids) => ids.length > 0 && ids.every((id, i) => id === '2026.' + String(i + 1).padStart(4, '0'));
  const ja = [read('researcher-profile', 'sophaxis.json'), read('cpsbvbng26-dotcom', 'notes/sophaxis.html')];
  const en = [read('researcher-profile', 'sophaxis.en.json'), read('cpsbvbng26-dotcom', 'notes/sophaxis.en.html')];
  const jaClaims = ja.map((t) => { const m = /いま載っている記録は (\d+) 件で/.exec(t || ''); return m ? Number(m[1]) : null; });
  const jaIds = ja.map((t) => listed(t || ''));
  check('Sophaxis の頁（日本語）が名乗る記録の数が、一覧の項目の数と合い、id が欠けずに並ぶ',
    jaClaims.every((n, i) => n !== null && n === jaIds[i].length && consecutive(jaIds[i])),
    '名乗り ' + jaClaims.join('・') + ' / 一覧 ' + jaIds.map((x) => x.length).join('・'));
  const enClaims = en.map((t) => { const m = /The (\w+) records listed so far/.exec(t || ''); return m ? EN.indexOf(m[1]) : null; });
  const enIds = en.map((t) => listed(t || ''));
  check('Sophaxis の頁（英語）が名乗る記録の数が、一覧の項目の数と合い、日本語版と同じ id を挙げる',
    enClaims.every((n, i) => n !== null && n > 0 && n === enIds[i].length && consecutive(enIds[i]))
      && enIds.every((x) => x.join() === jaIds[0].join()),
    '名乗り ' + enClaims.join('・') + ' / 一覧 ' + enIds.map((x) => x.length).join('・'));
}

/* この検査自身が名乗る件数も、実際と合わせる。
 * 実際に一度ずれている —— 中身を足したのに 62 のまま残っていた。
 * 自分を走らせるわけにはいかないので、ここまでの件数に自分の一件を足して数える。 */

console.log('\n12d. 免責と、法的なずれ');

/* **免責は、効く形でだけ置く。**全部を免じる文は消費者契約法で無効になり、免責そのものを失う。
 * 読むことを同意とみなす文は、定型約款の要件を満たさない。どちらも見つけたら止める。
 * 個人の連絡先は、許した二つのほかに置かない（決めごと 9）。 */
{
  const L = DECL['免責'];
  const ja = read('cpsbvbng26-dotcom', L.file) || '';
  const en = read('cpsbvbng26-dotcom', L.fileEn) || '';
  const lack = L['必須の文'].filter((x) => ja.indexOf(x) < 0).concat(L['必須の文 英'].filter((x) => en.indexOf(x) < 0));
  check('免責事項（日本語と英語）が、法令の定めるとおり責任を負うこと、同意とみなさないこと、情報の扱いを書いている', lack.length === 0,
    lack.length ? lack.map((x) => x.slice(0, 24)).join(' / ') : (L['必須の文'].length + L['必須の文 英'].length) + ' 文');
  check('免責事項が 10 リポジトリを名指している', C.repos.every((r) => ja.indexOf(r) >= 0 && en.indexOf(r) >= 0));
  const unlinked = [];
  for (const repo of C.repos) {
    const rd = read(repo, 'README.md');
    if (rd === null || rd.indexOf(L.readmeLine) < 0) unlinked.push(repo + '/README.md');
    const rdEn = read(repo, 'README.en.md');
    if (rdEn !== null && rdEn.indexOf(L.readmeLineEn) < 0) unlinked.push(repo + '/README.en.md');
  }
  check('10 リポジトリの README が、免責事項へつないでいる', unlinked.length === 0, unlinked.join(', '));

  const SKIPDIR = new Set(['.git', 'node_modules', 'site', 'dist', '__pycache__', 'venv']);
  const EXT = new Set(['.md', '.html', '.json', '.yml', '.cff', '.txt']);
  const void_ = L['無効になりうる言い回し'].map((x) => new RegExp(x, 'i'));
  const mail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
  const 無効 = [], 宛先 = [];
  let 数 = 0;
  function walk(dir, repo) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIPDIR.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, repo); continue; }
      if (!EXT.has(path.extname(e.name)) || /^LICENSE/.test(e.name)) continue;
      const rel = path.relative(path.join(ROOT, repo), full);
      /* この検査の表そのものと、指示書は除く。 */
      if (repo === 'cpsbvbng26-dotcom' && (rel === path.join('verification', 'ecosystem.json') || rel === 'CLAUDE.md')) continue;
      数++;
      const lines = fs.readFileSync(full, 'utf8').split('\n').filter((l) => !/^\s*>/.test(l));
      for (const l of lines) {
        if (void_.some((re) => re.test(l))) 無効.push(repo + '/' + rel);
        for (const m of l.match(mail) || []) if (!L['許すメールアドレス'].includes(m)) 宛先.push(repo + '/' + rel + ' ' + m);
      }
    }
  }
  for (const repo of C.repos) { const dir = path.join(ROOT, repo); if (fs.existsSync(dir)) walk(dir, repo); }
  check('10 リポジトリのどこにも、無効になりうる免責や、読むことを同意とみなす文が無い（' + 数 + ' ファイル）', 無効.length === 0, [...new Set(無効)].join(', '));
  check('10 リポジトリに、許した二つのほかのメールアドレスが無い', 宛先.length === 0, [...new Set(宛先)].slice(0, 10).join(', '));

  /* 免責事項の「再利用」は、各リポジトリの LICENSE の置き方のとおりに書く。
   * LICENSE 一つなら全体が MIT、二つなら LICENSE が CC BY 4.0、LICENSE-CODE が MIT。 */
  const LC = L['ライセンス'];
  const wrong = [];
  for (const repo of C.repos) {
    const lic = read(repo, 'LICENSE'), code = read(repo, 'LICENSE-CODE');
    const mitOnly = LC['全体が MIT'].includes(repo);
    if (lic === null) { wrong.push(repo + '：LICENSE が無い'); continue; }
    if (mitOnly && (!/^MIT License/.test(lic) || code !== null)) wrong.push(repo + '：全体が MIT のはず');
    if (!mitOnly && (!/^Creative Commons Attribution 4\.0 International/.test(lic) || code === null || !/^MIT License/.test(code))) wrong.push(repo + '：CC BY 4.0 と MIT の二つのはず');
  }
  check('免責事項の「再利用」が、10 リポジトリの LICENSE の置き方（全体が MIT ' + LC['全体が MIT'].length + '、二つ ' + (C.repos.length - LC['全体が MIT'].length) + '）のとおりに書く',
    wrong.length === 0 && ja.indexOf(LC['文の一節']) >= 0 && en.indexOf(LC['文の一節 英']) >= 0, wrong.join(' / '));

  /* 全体が MIT のリポジトリでも、中の LICENSE で CC BY 4.0 にしたディレクトリがある（trinity-operator の
   * lessons/ と games/。games/ は 2026-11-11）。免責事項はその全部を名指す。LICENSE が無ければ落とす。 */
  const 中 = [];
  for (const [repo, dirs] of Object.entries(LC['中の LICENSE で CC BY 4.0'])) {
    for (const d of dirs) {
      const l = read(repo, path.join(d, 'LICENSE'));
      if (l === null || !/^Creative Commons Attribution 4\.0 International/.test(l)) 中.push(repo + '/' + d + '/LICENSE');
    }
  }
  check('免責事項が、中の LICENSE で CC BY 4.0 にしたディレクトリを全部名指し、その LICENSE がある',
    中.length === 0 && ja.indexOf(LC['中の一節']) >= 0 && en.indexOf(LC['中の一節 英']) >= 0, 中.join(', '));

  /* 2026-11-12 の法令の点検。trinity-operator の site/ の頁は、LICENSE ファイルではなく頁の末尾の表示で
   * CC BY 4.0 にしている。免責事項はそれを書いていなかった（全体が MIT と読めた）。
   * 免責事項がその一文を持ち、site/ の頁がどれも末尾に CC BY 4.0 と書いていることを見る。 */
  const 表示 = [];
  for (const [repo, dirs] of Object.entries(LC['頁の表示で CC BY 4.0'])) {
    for (const d of dirs) {
      const dir = path.join(ROOT, repo, d);
      const pages = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.html$/.test(f)) : [];
      if (!pages.length) 表示.push(repo + '/' + d + ' に頁が無い');
      pages.forEach((f) => {
        const ft = (/<footer[\s\S]*?<\/footer>/.exec(fs.readFileSync(path.join(dir, f), 'utf8')) || [''])[0];
        if (ft.indexOf('CC BY 4.0') < 0) 表示.push(repo + '/' + d + '/' + f);
      });
    }
  }
  check('免責事項が、頁の末尾の表示で CC BY 4.0 にした頁（trinity-operator の site/）を名指し、その頁が末尾に CC BY 4.0 と書く',
    表示.length === 0 && ja.indexOf(LC['表示の一節']) >= 0 && en.indexOf(LC['表示の一節 英']) >= 0, 表示.join(', '));
}

/* ---------- 法令の点検の記録（2026-11-12） ----------
 *
 * 10 のリポジトリと deposit-check に、法令の点検の記録 docs/legal-audit-2026-11-12.md を置いた。
 * **記録が挙げる条は、取り寄せた条文にあるものだけ。**条文は verification/statutes.json にあり、
 * Sophaxis の取り寄せの仕事の結果から写した。記憶から書いた条（作り出した条）を止める。
 * 写した文は、Sophaxis と Nusquama が別に取り寄せた同じ条の文と一字一句同じであること。
 * 記録は六つの欄の表で、判定は五つの語のどれかで、弁護士が見ていないことを書く。 */
console.log('\n12f. 法令の点検の記録');
{
  const ST = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')));
  const 条文 = ST['条文'];
  const crypto = require('crypto');
  const 壊れ = Object.entries(条文).filter(([, v]) => crypto.createHash('sha256').update(v['文'], 'utf8').digest('hex') !== v.sha256).map(([k]) => k);
  check('取り寄せた条文の表（statutes.json）の各条の SHA-256 が、その文と合う（' + Object.keys(条文).length + ' 条）', 壊れ.length === 0, 壊れ.join(', '));

  /* 同じ条を Sophaxis と Nusquama も取り寄せている。そろって CI が複製する。無ければ、無いと言って通さない。 */
  const EN = { '著作権法': 'Copyright Act', '個人情報保護法': 'Act on the Protection of Personal Information', '消費者契約法': 'Consumer Contract Act',
    '民法': 'Civil Code', '刑法': 'Penal Code', '商標法': 'Trademark Act', '電気通信事業法': 'Telecommunications Business Act',
    '情報流通プラットフォーム対処法': 'Act on providers of specified telecommunications services' };
  const so = read('sophaxis', path.join('verification', 'statutes-texts.json'));
  const nu = read('nusquama', path.join('verification', 'statutes-texts.json'));
  if (so === null || nu === null) {
    check('写した条文が、Sophaxis と Nusquama の取り寄せた文と一字一句同じ', false, 'sophaxis か nusquama が並んでいない');
  } else {
    const S = JSON.parse(so), N = JSON.parse(nu);
    let 比べた = 0;
    const 違い = [];
    for (const [k, v] of Object.entries(条文)) {
      const m = /^(.+) 第(\d+)条(?:の(\d+))?$/.exec(k);
      const ek = m && EN[m[1]] ? EN[m[1]] + ' Article ' + m[2] + (m[3] ? '-' + m[3] : '') : null;
      if (ek && S[ek] !== undefined) { 比べた++; if (S[ek] !== v['文']) 違い.push('Sophaxis ' + k); }
      if (N[k] !== undefined) { 比べた++; if (N[k] !== v['文']) 違い.push('Nusquama ' + k); }
    }
    check('写した条文が、Sophaxis と Nusquama の取り寄せた文と一字一句同じ（' + 比べた + ' 組）', 違い.length === 0 && 比べた > 0, 違い.join(', '));
  }

  /* 2026-11-12 の続き。施行令・施行規則・附則は、Sophaxis の main の sources-raw.json の laws に取り寄せてある（PR #218）。
   * 「照合」を持つ条は、そこの文と突き合わせる。条は一字一句同じ、附則は取り寄せた附則の文の中に一字一句あること。 */
  {
    const rawText = read('sophaxis', path.join('verification', 'sources-raw.json'));
    const 照合 = Object.entries(条文).filter(([, v]) => v['照合']);
    const 違い = [];
    if (rawText === null) 違い.push('sophaxis の sources-raw.json が並んでいない');
    else {
      const LAWS = JSON.parse(rawText).laws || {};
      for (const [k, v] of 照合) {
        const r = v['照合'], law = LAWS[r.laws];
        if (!law) { 違い.push(k + '（' + r.laws + ' が無い）'); continue; }
        if (r['条'] !== undefined) { if (!law.articles || law.articles[r['条']] !== v['文']) 違い.push(k); }
        else if (!law.suppl || !law.suppl[r['附則']] || law.suppl[r['附則']].text.indexOf(v['文']) < 0) 違い.push(k);
      }
    }
    check('施行令・施行規則・附則から写した条が、Sophaxis の取り寄せた文と一字一句同じ（' + 照合.length + ' 条）', 照合.length > 0 && 違い.length === 0, 違い.join(', '));
  }

  const 法令名 = [...new Set(Object.keys(条文).map((k) => k.replace(/ 第.*$/, '')))].sort((a, b) => b.length - a.length);
  const 名の形 = new RegExp('(' + 法令名.join('|') + ')', 'g');
  const 先 = C.repos.concat(['deposit-check']);
  const JA = { head: '| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |', 判定: ['誤り', '根拠不足', '漏れ', '表現', '問題なし'],
    節: ['## 調べた法令', '## 取り寄せられなかった文'], 弁護士: '弁護士は、この点検を見ていません。' };
  const EN_ = { head: '| Place | Law and article | Requirements | Facts | Finding | Action |', 判定: ['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'],
    節: ['## Laws checked', '## Texts that could not be fetched'], 弁護士: 'No lawyer has reviewed this audit.' };
  const 無い = [], 形 = [], 無い条 = [];
  let 条数 = 0, 行数 = 0;
  for (const repo of 先) {
    const f = path.join('docs', 'legal-audit-2026-11-12.md');
    const t = read(repo, f);
    if (t === null) { 無い.push(repo); continue; }
    const L = t.indexOf(EN_.head) >= 0 ? EN_ : JA;
    const rows = t.split('\n').filter((l) => /^\| /.test(l) && l !== L.head && !/^\| ---/.test(l));
    行数 += rows.length;
    const 悪い行 = rows.filter((l) => { const c = l.split('|').slice(1, -1).map((x) => x.trim()); return c.length !== 6 || !L.判定.includes(c[4]); });
    if (t.indexOf(L.head) < 0 || !rows.length || 悪い行.length || !L.節.every((x) => t.indexOf(x) >= 0) || t.indexOf(L.弁護士) < 0) {
      形.push(repo + (悪い行.length ? '（判定の欄 ' + 悪い行.length + ' 行）' : ''));
    }
    /* 「第N条」は、同じ行で前に出た法令の名の条として読む。名が無ければ、それも作り出した条として落とす。 */
    t.split('\n').forEach((line) => {
      for (const m of line.matchAll(/第\s*(\d+)\s*条(?:の\s*(\d+))?/g)) {
        条数++;
        const before = line.slice(0, m.index);
        const names = [...before.matchAll(名の形)];
        const law = names.length ? names[names.length - 1][1] : null;
        const key = law ? law + ' 第' + m[1] + '条' + (m[2] ? 'の' + m[2] : '') : null;
        if (!key || !Object.prototype.hasOwnProperty.call(条文, key)) 無い条.push(repo + '：' + (key || '名の無い 第' + m[1] + '条'));
      }
    });
  }
  check('10 のリポジトリと deposit-check に、法令の点検の記録がある（' + (先.length - 無い.length) + ' 本）', 無い.length === 0, 無い.join(', '));
  check('点検の記録が、六つの欄の表と五つの判定、調べた法令、取り寄せられなかった文、弁護士が見ていないことの一文を持つ（' + 行数 + ' 行）', 形.length === 0, 形.join(', '));
  check('点検の記録が挙げる条が、どれも取り寄せた条文の表にある（' + 条数 + ' 箇所）', 無い条.length === 0, [...new Set(無い条)].slice(0, 8).join(', '));
}

/* ---------- 法的なリスクを締めた（2026-11-12 の続き） ----------
 *
 * 利用者が「法的リスクをさらにシメて」と求めた。根拠不足や不確かな読みに頼っていたところを、
 * 厳しいほうの読みでも成り立つ形に直した（責任を免除しない、個人情報取扱事業者として扱う、
 * 確かめられない評判を名指しの相手に並べない、Vercel で配る頁に受注の場への道を置かない、
 * 存命かどうか確かめていない親族の出自を書かない）。
 * **直した文を固定し、外した言い回しが戻れば落とす。**決めたことは 11 の点検の記録の同じ見出しの節にある。 */
console.log('\n12g. 法的なリスクを締めた（2026-11-12 の続き）');
{
  const K = DECL['締めた'] || null;
  const 先 = C.repos.concat(['deposit-check']);
  const 欠け = [];
  let 行 = 0;
  for (const repo of 先) {
    const t = K === null ? null : read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length || sec.indexOf(K['決めた']) < 0) 欠け.push(repo + (i < 0 ? '（節が無い）' : '（行か決めた一文が無い）'));
  }
  check('11 の点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行と Claude が決めたことの一文がある（' + (先.length - 欠け.length) + ' 本、' + 行 + ' 行）',
    K !== null && 欠け.length === 0, 欠け.join(', '));

  const 無い文 = [];
  let 文数 = 0;
  for (const [repo, files] of Object.entries(K ? K['ある文'] : {})) {
    for (const [f, xs] of Object.entries(files)) {
      const t = read(repo, f) || '';
      xs.forEach((x) => { 文数++; if (t.indexOf(x) < 0) 無い文.push(repo + '/' + f + '「' + x.slice(0, 16) + '」'); });
    }
  }
  check('締めた文が、決めた場所にある（' + 文数 + ' 文）', K !== null && 文数 > 0 && 無い文.length === 0, 無い文.join(', '));

  const 戻り = [];
  let 語数 = 0;
  for (const [repo, files] of Object.entries(K ? K['無い言い回し'] : {})) {
    for (const [f, xs] of Object.entries(files)) {
      const t = read(repo, f);
      if (t === null) { 戻り.push(repo + '/' + f + ' が無い'); continue; }
      xs.forEach((x) => { 語数++; if (new RegExp(x, 'i').test(t)) 戻り.push(repo + '/' + f + '：' + x); });
    }
  }
  check('締めて外した言い回し（免除の文、確かめられない評判、受注の場への道、親族の出自）が戻っていない（' + 語数 + ' 語）',
    K !== null && 語数 > 0 && 戻り.length === 0, 戻り.join(', '));

  /* SSRN の利用規約は、自動の問い合わせを送らないことを利用者に約させる。月に一度のリンクの確認は、
   * SSRN の頁と SSRN へ転送される DOI を開かない。外す働きそのものを、関数を呼んで確かめる。 */
  let usable = null;
  try { usable = require(path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'linkcheck.js')).usable; } catch (e) { usable = null; }
  const 開く = usable === null ? ['linkcheck.js が読めない'] : ['https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7358779', 'https://www.ssrn.com/index.cfm/en/', 'https://doi.org/10.2139/ssrn.7358779']
    .filter((u) => usable(u)).concat(usable('https://doi.org/10.5281/zenodo.22058254') ? [] : ['Zenodo の DOI まで外している']);
  check('月に一度のリンクの確認が、SSRN の頁と SSRN の DOI を開かない（SSRN の利用規約）', 開く.length === 0, 開く.join(', '));
}

/* ---------- 取り寄せた周辺の文（2026-11-12 の続き） ----------
 *
 * Sophaxis の main（PR #218）が、施行令・施行規則・附則と、場の規約を取り寄せた。
 * **取り寄せた文を、取り寄せられなかった文の一覧に残さない。**残せば、確かめたことを確かめていないと書くことになる。
 * まだ無いものは、無い理由と一緒に一覧に残す。 */
console.log('\n12h. 取り寄せた周辺の文（2026-11-12 の続き）');
{
  const K = DECL['周辺の文'] || null;
  const 先 = C.repos.concat(['deposit-check']);
  const 欠け = [], 古い = [], 無い = [];
  let 行 = 0;
  for (const repo of 先) {
    const t = K === null ? null : read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length) 欠け.push(repo);
    const h = K['一覧'].map((x) => t.indexOf('\n' + x + '\n')).find((x) => x >= 0);
    const e = h === undefined ? -1 : t.indexOf('\n## ', h + 1);
    const 一覧 = h === undefined ? '' : t.slice(h, e < 0 ? t.length : e);
    K['一覧に残さない言い回し'].forEach((x) => { if (一覧.indexOf(x) >= 0) 古い.push(repo + '：' + x); });
    (K['一覧に残す文'][repo] || []).forEach((x) => { if (一覧.indexOf(x) < 0) 無い.push(repo + '：' + x.slice(0, 16)); });
  }
  check('11 の点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行がある（' + (先.length - 欠け.length) + ' 本、' + 行 + ' 行）',
    K !== null && 欠け.length === 0, 欠け.join(', '));
  check('取り寄せられなかった文の一覧に、もう取り寄せた文を残していない（' + (K ? K['一覧に残さない言い回し'].length : 0) + ' 語）',
    K !== null && 古い.length === 0, 古い.join(', '));
  check('まだ取り寄せられない文（旧著作権法・報道の記事・東北大学の規約）を、理由と一緒に一覧に残している', K !== null && 無い.length === 0, 無い.join(', '));
}

/* ---------- 見落としていたもの（2026-11-12 の続き） ----------
 *
 * 読むだけの点検をもう一度、別の手で行った。見張りが見ていなかったところを直し、見張りを広げた。
 *   - 決めごと 10 の見張りの式（verification/kinship.js）を、self-correction の登録簿と researcher-profile の設定に当てる。
 *     check_site.js は自分の頁しか見ない。SC-016 の欄は、その外で、存命の第三者の事業計画を写していた。
 *   - 自己紹介から外した、開業届を出す予定の文が戻らないこと。出していないという文も、二度目の見落としの節で外した（下の検査は向きを逆にした）。
 *   - 月に一度のリンクの確認が、機械での利用を断る場（edX・DataCite の頁・Google Scholar・Academia.edu・ResearchGate）を開かないこと。
 * 三つの点検の記録に同じ見出しの節と、Claude が決めたことの一文があること。 */
console.log('\n12i. 見落としていたもの（2026-11-12 の続き）');
{
  const K = DECL['見落とし'] || null;
  const 欠け = [];
  let 行 = 0;
  for (const repo of (K ? K['記録'] : [])) {
    const t = read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length || sec.indexOf(K['決めた']) < 0) 欠け.push(repo + (i < 0 ? '（節が無い）' : '（行か決めた一文が無い）'));
  }
  check('点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行と Claude が決めたことの一文がある（' + (K ? K['記録'].length - 欠け.length : 0) + ' 本、' + 行 + ' 行）',
    K !== null && K['記録'].length > 0 && 欠け.length === 0, 欠け.join(', '));

  /* 決めごと 10。check_site.js と同じ式を、兄弟のリポジトリの記録と設定に当てる。 */
  const { scan } = require('./kinship');
  const 当たり = [];
  let 面 = 0;
  for (const [repo, list] of Object.entries(K ? K['見張る'] : {})) {
    for (const p of list) {
      let files = [p];
      const dir = path.join(ROOT, repo, p.endsWith('/') ? p : path.dirname(p));
      if (p.endsWith('/') || p.indexOf('*') >= 0) {
        const ext = p.endsWith('/') ? null : path.extname(p);
        files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => ext === null || n.endsWith(ext))
          .map((n) => path.join(p.endsWith('/') ? p : path.dirname(p), n)) : [];
      }
      if (!files.length) { 当たり.push(repo + '/' + p + ' が無い'); continue; }
      for (const f of files) {
        const t = read(repo, f);
        if (t === null) { 当たり.push(repo + '/' + f + ' が無い'); continue; }
        面++;
        scan(t).forEach((h) => 当たり.push(repo + '/' + f + ' に「' + h + '」'));
      }
    }
  }
  check('self-correction の登録簿、researcher-profile の設定、naval-gazette-notes の README と正誤表、来歴と外部評価の記録に、存命の人物の続柄の一語を越える記載も、存命の第三者の事業や計画への言及も無い（決めごと 10、' + 面 + ' ファイル）',
    K !== null && 面 > 0 && 当たり.length === 0, 当たり.slice(0, 6).join(' / '));

  const 戻り = [];
  let 語数 = 0;
  for (const [repo, files] of Object.entries(K ? K['無い言い回し'] : {})) {
    for (const [f, xs] of Object.entries(files)) {
      const t = read(repo, f);
      if (t === null) { 戻り.push(repo + '/' + f + ' が無い'); continue; }
      xs.forEach((x) => { 語数++; if (t.indexOf(x) >= 0) 戻り.push(repo + '/' + f + '：' + x); });
    }
  }
  check('外した文（開業届を出す予定、両親の考え）が、設定にも頁にも戻っていない（' + 語数 + ' 語）',
    K !== null && 語数 > 0 && 戻り.length === 0, 戻り.join(', '));

  /* 2026-11-12（二度目の見落とし）。ここはもとは、開業届を出していないという事実の文が残っていることを求めていた。
   * 「消せば事実を隠すことになる」という理由だったが、誤りだった。公開を求める法令は無く、届け出についての
   * 事実を公に置き続ける理由も無い。同じ文の並びを、同じ厳しさで、逆の向きに求める。 */
  const 残り = [];
  let 文数 = 0;
  for (const [repo, files] of Object.entries(K ? K['外した届けの文'] : {})) {
    for (const [f, xs] of Object.entries(files)) {
      const t = read(repo, f);
      if (t === null) { 残り.push(repo + '/' + f + ' が無い'); continue; }
      xs.forEach((x) => { 文数++; if (t.indexOf(x) >= 0) 残り.push(repo + '/' + f + '「' + x.slice(0, 16) + '」'); });
    }
  }
  check('開業届を出していないという文も、五つの言語の設定と頁と README から外れている（' + 文数 + ' 文）',
    K !== null && 文数 > 0 && 残り.length === 0, 残り.join(', '));

  let lc = null;
  try { lc = require(path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'linkcheck.js')); } catch (e) { lc = null; }
  const 誤り = lc === null || typeof lc.usable !== 'function' ? ['linkcheck.js が読めない'] :
    (K ? K['開かない'] : []).filter((u) => lc.usable(u)).map((u) => '開く: ' + u)
      .concat((K ? K['開く'] : []).filter((u) => !lc.usable(u)).map((u) => '外している: ' + u));
  check('月に一度のリンクの確認が、機械での利用を断る場（edX・DataCite の頁・Google Scholar・Academia.edu・ResearchGate）を開かず、ほかは開く（' + (K ? K['開かない'].length + ' と ' + K['開く'].length : 0) + ' 件）',
    K !== null && 誤り.length === 0, 誤り.join(', '));
}

/* ---------- 二度目の見落とし（2026-11-12 の続き） ----------
 *
 * 読むだけの点検を、さらに別の手でもう一度行った。直したものが戻らないことを見る。
 *   - 安全の窓口（SECURITY.md）が、在るメールの窓口（ORCID の記録）を書き、有効でない GitHub の非公開の報告を約さないこと。
 *   - 論文と目録の生成が、作品の著者に所属を付けないこと。
 *   - 存命かどうか確かめていない親族の名を載せる Google サイトの頁へのリンクが、どのリポジトリにも無いこと。
 *   - SSRN と PhilArchive について、取り寄せた場の文の句だけを置き、場が品質を判定したと読める文を戻さないこと。
 *   - 「使われた記録」の様式がある限り、免責事項の利用目的にそれがあること。
 *   - SC-016 が、何についての文だったかを書かないこと。 */
console.log('\n12j. 二度目の見落とし（2026-11-12 の続き）');
{
  const K = DECL['二度目の見落とし'] || null;
  const present = (r) => fs.existsSync(path.join(ROOT, r));

  const 欠け = [];
  let 行 = 0;
  for (const repo of (K ? K['記録'] : [])) {
    const t = read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length || sec.indexOf(K['決めた']) < 0) 欠け.push(repo + (i < 0 ? '（節が無い）' : '（行か決めた一文が無い）'));
  }
  check('点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行と Claude が決めたことの一文がある（' + (K ? K['記録'].length - 欠け.length : 0) + ' 本、' + 行 + ' 行）',
    K !== null && K['記録'].length > 0 && 欠け.length === 0, 欠け.join(', '));

  /* 安全の窓口。11 の写しのどれもが、在る窓口を書き、無い入口を約さない。 */
  const S = K ? K['安全の窓口'] : null;
  const 窓口ずれ = [];
  for (const repo of (S ? S.repos : [])) {
    const t = read(repo, 'SECURITY.md');
    if (t === null) { 窓口ずれ.push(repo + ' に無い'); continue; }
    S['要る'].forEach((x) => { if (t.indexOf(x) < 0) 窓口ずれ.push(repo + ' に「' + x.slice(0, 20) + '」が無い'); });
    S['無い'].forEach((x) => { if (t.indexOf(x) >= 0) 窓口ずれ.push(repo + ' に「' + x + '」'); });
  }
  check('SECURITY.md が、メールの窓口（ORCID の記録）と、GitHub の非公開の報告が有効でないことを書き、無い入口を約さない（' + (S ? S.repos.length : 0) + ' 本）',
    S !== null && S.repos.length > 0 && 窓口ずれ.length === 0, 窓口ずれ.slice(0, 6).join(' / '));
  const 案内ずれ = Object.entries(S ? S['README'] : {}).filter(([f, x]) => (read('cpsbvbng26-dotcom', f) || x).indexOf(x) >= 0).map(([f]) => f);
  check('README の文書の一覧が、SECURITY.md を「非公開の報告の入口」と呼んでいない', S !== null && 案内ずれ.length === 0, 案内ずれ.join(', '));

  /* 所属。作品の著者に付けない。生成もとで見る（頁の側は check_site.js が見る）。 */
  const 所属 = [];
  for (const [repo, files] of Object.entries(K ? K['所属を付けない生成'] : {})) {
    files.forEach((f) => { const t = read(repo, f); if (t === null || /affiliation/.test(t)) 所属.push(repo + '/' + f); });
  }
  check('論文の頁と目録の生成もとが、作品の著者に所属を付けない', K !== null && 所属.length === 0, 所属.join(', '));

  /* Google サイト。記録が出来事を述べるのはよいが、所在そのものはどこにも置かない。 */
  const 所在 = [];
  let 本 = 0;
  const repos = C.repos.concat(['sophaxis', 'deposit-check', 'nusquama']).filter(present);
  for (const repo of repos) {
    let files = [];
    try { files = execFileSync('git', ['-C', path.join(ROOT, repo), 'ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean); } catch (e) { 所在.push(repo + ' の一覧が読めない'); continue; }
    本++;
    for (const f of files) {
      if (!/\.(md|html|json|toml|yml|yaml|js|py|txt|xml|csv|cff|bib)$/.test(f)) continue;
      let t = '';
      try { t = fs.readFileSync(path.join(ROOT, repo, f), 'utf8'); } catch (e) { continue; }
      if (K && t.indexOf(K['外したリンク']) >= 0 && f !== path.join('verification', 'ecosystem.json')) 所在.push(repo + '/' + f);
    }
  }
  check('Google サイトの頁の所在が、どのリポジトリの頁・設定・README・記録にも無い（' + 本 + ' 本）',
    K !== null && 本 > 0 && 所在.length === 0, 所在.slice(0, 6).join(', '));

  /* 場の文。取り寄せた頁にある句だけを置き、どの句も点検の記録が取り寄せた所在と一緒に挙げている。 */
  const 句ずれ = [];
  const audit = read('cpsbvbng26-dotcom', path.join('docs', 'legal-audit-2026-11-12.md')) || '';
  for (const q of (K ? K['場の文'] : [])) {
    for (const [repo, files] of Object.entries(K['場の文を置く'])) {
      files.forEach((f) => { if ((read(repo, f) || '').indexOf(q['句']) < 0) 句ずれ.push(repo + '/' + f + ' に「' + q['句'].slice(0, 24) + '」が無い'); });
    }
    if (audit.indexOf(q['句']) < 0 || audit.indexOf(q['頁']) < 0) 句ずれ.push('点検の記録に「' + q['句'].slice(0, 24) + '」とその所在が無い');
  }
  check('SSRN と PhilArchive の句は、取り寄せた場の文の句で、頁と README と点検の記録にある（' + (K ? K['場の文'].length : 0) + ' 句）',
    K !== null && K['場の文'].length > 0 && 句ずれ.length === 0, 句ずれ.slice(0, 6).join(' / '));
  const 判断 = [];
  let 判断数 = 0;
  for (const [repo, files] of Object.entries(K ? K['無い判断'] : {})) {
    for (const [f, xs] of Object.entries(files)) {
      const t = read(repo, f);
      if (t === null) { 判断.push(repo + '/' + f + ' が無い'); continue; }
      xs.forEach((x) => { 判断数++; if (t.indexOf(x) >= 0) 判断.push(repo + '/' + f + '：' + x); });
    }
  }
  check('場が品質を判定したと読める文と、取り寄せた頁に無い句が、五つの言語の設定と頁と README に戻っていない（' + 判断数 + ' 語）',
    K !== null && 判断数 > 0 && 判断.length === 0, 判断.slice(0, 6).join(', '));

  /* 使われた記録。様式がある限り、免責事項の利用目的にある。 */
  const U = K ? K['使われた記録'] : null;
  const 様式 = [];
  for (const repo of C.repos.filter(present)) {
    const dir = path.join(ROOT, repo, '.github', 'ISSUE_TEMPLATE');
    if (!fs.existsSync(dir)) continue;
    fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).forEach((n) => {
      if (U && fs.readFileSync(path.join(dir, n), 'utf8').indexOf(U['様式の句']) >= 0) 様式.push(repo + '/' + n);
    });
  }
  const 目的 = Object.entries(U ? U['免責'] : {}).filter(([f, x]) => (read('cpsbvbng26-dotcom', f) || '').indexOf(x) < 0).map(([f]) => f);
  check('「使われた記録」の様式（' + 様式.length + ' 本）があり、免責事項の利用目的が日英ともそれを挙げている',
    U !== null && 様式.length > 0 && 目的.length === 0, 目的.join(', ') || 様式.join(', '));

  /* SC-016。自己紹介の一文を直したことと、凍結した写しと履歴の事実だけを書く。 */
  const reg = read('self-correction', 'register.toml') || '';
  const i = reg.indexOf('id = "SC-016"');
  const j = i < 0 ? -1 : reg.indexOf('[[entry]]', i);
  const blk = i < 0 ? '' : reg.slice(i, j < 0 ? reg.length : j);
  const P = K ? K['SC-016'] : null;
  const 余り = P ? P['外す語'].filter((x) => blk.indexOf(x) >= 0).map((x) => '「' + x + '」がある')
    .concat(P['残す句'].filter((x) => blk.indexOf(x) < 0).map((x) => '「' + x + '」が無い')) : ['宣言が無い'];
  check('SC-016 が、自己紹介の一文を直したことと、凍結した Zenodo の版と git の履歴の事実だけを書き、第三者・事業・計画に触れない',
    blk !== '' && 余り.length === 0, 余り.join(', '));
}

/* ---------- 三度目の見落とし（2026-11-12 の続き） ----------
 *
 * 読むだけの点検を、三度目に別の手で行った。直したものが戻らないことを見る。
 *   - 月に一度のリンクの確認は、許す一覧の場だけを開く。断りの一覧の形では、外し忘れた場を開き続けた。
 *     名乗りにブラウザの名を借りず、リポジトリを書く。DOI の転送の先が一覧に無ければ、そこで止める。
 *   - 決めごと 10 の見張りは、祖父・曾祖父・祖母を一律に外さない。公開している頁が故人と述べる人だけを外す。
 *     兄弟姉妹・おじおば・義理の親・配偶者も見る（独英仏伊を含む）。家の伝統・宗旨を書く文も止める。
 *   - 死後の頁は、著者自身の手配だけを書く。Sophaxis の頁は、ライセンスの範囲を書く。
 *   - SECURITY.md は、二つの GitHub Action が入力を受け取ることを書く。
 *   - 自己分析と独仏伊の自己紹介は、SSRN の編集の人が見るとは書かない。 */
console.log('\n12k. 三度目の見落とし（2026-11-12 の続き）');
{
  const K = DECL['三度目の見落とし'] || null;

  const 欠け = [];
  let 行 = 0;
  for (const repo of (K ? K['記録'] : [])) {
    const t = read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length || sec.indexOf(K['決めた']) < 0) 欠け.push(repo + (i < 0 ? '（節が無い）' : '（行か決めた一文が無い）'));
  }
  check('点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行と Claude が決めたことの一文がある（' + (K ? K['記録'].length - 欠け.length : 0) + ' 本、' + 行 + ' 行）',
    K !== null && K['記録'].length > 0 && 欠け.length === 0, 欠け.join(', '));
  const 訂正 = K ? K['記録の訂正'] : null;
  check('「機械での取得を断る場なので写しから読んだ」の記録に、リンクの確認がその場を開いていたことを書き足している',
    訂正 !== null && (read('cpsbvbng26-dotcom', 訂正.file) || '').indexOf(訂正['句']) >= 0);

  /* リンクの確認。許す一覧の形、名乗り、転送の止め。 */
  let lc = null;
  try { lc = require(path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'linkcheck.js')); } catch (e) { lc = null; }
  const 理由 = ['自分の場', 'DOI の解決', '規約'];
  const 一覧ずれ = [];
  if (lc === null || !Array.isArray(lc.OPEN)) 一覧ずれ.push('linkcheck.js の OPEN が読めない');
  else {
    const want = K ? K['許す一覧'] : {};
    const have = {};
    lc.OPEN.forEach((o) => { have[o.host] = o.why; });
    Object.keys(Object.assign({}, want, have)).forEach((h) => { if (want[h] !== have[h]) 一覧ずれ.push(h + '：宣言 ' + want[h] + ' / 実物 ' + have[h]); });
    lc.OPEN.forEach((o) => {
      if (!理由.includes(o.why) || !o.note) 一覧ずれ.push(o.host + ' に理由が無い');
      if (o.why === '規約' && !(/取得/.test(o.note) && /SHA-256 [0-9a-f]{8}/.test(o.note) && /"[^"]{20,}"/.test(o.note))) 一覧ずれ.push(o.host + ' に、取り寄せた規約の句・日・SHA-256 が無い');
    });
    if (typeof lc.usable !== 'function' || typeof lc.allowed !== 'function') 一覧ずれ.push('usable と allowed が無い');
  }
  check('リンクの確認は、許す一覧（' + (K ? Object.keys(K['許す一覧']).length : 0) + ' の場）だけを開き、どの場にも理由がある。規約の場には取り寄せた句・日・SHA-256 がある',
    K !== null && 一覧ずれ.length === 0, 一覧ずれ.join(', '));
  const N = K ? K['名乗り'] : null;
  const 名乗り = lc === null ? '' : String(lc.UA || '');
  check('リンクの確認の名乗りが、ブラウザの名を借りず、このリポジトリを書く', N !== null && 名乗り.indexOf(N['含む']) >= 0
    && N['含まない'].every((x) => 名乗り.indexOf(x) < 0), 名乗り);

  /* 転送の止め。fetch を差し替えた子の処理で probe を呼び、問い合わせた先を数える。網には出ない。 */
  const 転送 = (start, target) => {
    const src = 'const lc = require(' + JSON.stringify(path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'linkcheck.js')) + ');'
      + 'const seen = [];'
      + 'globalThis.fetch = async (url, opts) => { seen.push({ url: String(url), ua: (opts && opts.headers && opts.headers["User-Agent"]) || "" });'
      + '  const go = String(url).startsWith("https://doi.org/");'
      + '  return { status: go ? 302 : 200, headers: { get: (k) => (go && k.toLowerCase() === "location") ? ' + JSON.stringify(target) + ' : null }, body: null }; };'
      + 'lc.probe(' + JSON.stringify(start) + ').then((r) => console.log(JSON.stringify({ r, seen })));';
    try { return JSON.parse(execFileSync(process.execPath, ['-e', src], { encoding: 'utf8', timeout: 20000 })); } catch (e) { return null; }
  };
  const T = K ? K['転送'] : null;
  const 止め = T ? 転送(T['始め'], T['先']) : null;
  const 進み = T ? 転送(T['始め'], 'https://zenodo.org/records/22058254') : null;
  check('DOI の転送の先が許す一覧に無ければ、そこで止め、先の場（' + (T ? new URL(T['先']).hostname : '') + '）へは問い合わせない',
    止め !== null && 止め.seen.length > 0 && 止め.seen.every((x) => x.url.indexOf(T['始め']) === 0 && x.ua === 名乗り) && 止め.r && 止め.r.status === 302,
    止め ? 止め.seen.map((x) => x.url).join(' → ') : '子の処理が走らない');
  check('転送の先が許す一覧にあれば、そこまで辿る（Zenodo）',
    進み !== null && 進み.seen.some((x) => x.url.indexOf('https://zenodo.org/') === 0) && 進み.r && 進み.r.status === 200,
    進み ? 進み.seen.map((x) => x.url).join(' → ') : '子の処理が走らない');

  /* 決めごと 10 の式。止める文と通す文を、式そのものに当てる。故人の表の文は、名指した頁に一字一句ある。 */
  const KS = require('./kinship');
  const 止めない = (K ? K['止める文'] : []).filter((x) => KS.scan(x).length === 0);
  const 止める = (K ? K['通す文'] : []).filter((x) => KS.scan(x).length > 0);
  check('決めごと 10 の式が、祖父母・兄弟姉妹・おじおば・義理の親・配偶者（独英仏伊を含む）と家の伝統を止め、人を指さない語と故人の表の人を通す（'
    + (K ? K['止める文'].length + ' と ' + K['通す文'].length : 0) + ' 文）',
    K !== null && 止めない.length === 0 && 止める.length === 0,
    止めない.map((x) => '通した：' + x).concat(止める.map((x) => '止めた：' + x)).join(' / '));
  const 故人ずれ = (KS.故人 || []).filter((p) => {
    const i = p['頁'].indexOf('/');
    const t = read(p['頁'].slice(0, i), p['頁'].slice(i + 1));
    return !p['名'] || !p['語'].length || t === null || t.indexOf(p['文']) < 0 || t.indexOf(p['名']) < 0;
  }).map((p) => p['名']);
  check('故人として外す人は、名指した頁が自ら故人と述べている人だけで、その文が頁に一字一句ある（' + (KS.故人 || []).length + ' 人）',
    (KS.故人 || []).length > 0 && 故人ずれ.length === 0, 故人ずれ.join(', '));
  check('決めごと 10 の式が、祖父・曾祖父・祖母を一律には外さない', KS.scan('祖父が言った。').length > 0 && KS.scan('曾祖父は').length > 0 && KS.scan('祖母の家').length > 0);

  /* SC-030。話し手を書かない。 */
  const reg = read('self-correction', 'register.toml') || '';
  const i30 = reg.indexOf('id = "SC-030"');
  const j30 = i30 < 0 ? -1 : reg.indexOf('[[entry]]', i30);
  const b30 = i30 < 0 ? '' : reg.slice(i30, j30 < 0 ? reg.length : j30);
  const P = K ? K['SC-030'] : null;
  const 余り = P === null || b30 === '' ? ['項目が無い'] : P['外す語'].filter((x) => b30.indexOf(x) >= 0).map((x) => '「' + x + '」がある')
    .concat(P['残す句'].filter((x) => b30.indexOf(x) < 0).map((x) => '「' + x.slice(0, 16) + '」が無い'));
  check('SC-030 が、伝聞の話し手の続柄を書かず、書かない理由を書く', 余り.length === 0, 余り.join(', '));

  /* 死後の頁とライセンスの範囲。 */
  const 文ずれ = (decl, must) => {
    const out = [];
    let n = 0;
    for (const [repo, files] of Object.entries(decl || {})) {
      if (!fs.existsSync(path.join(ROOT, repo))) { out.push(repo + ' が無い'); continue; }
      for (const [f, xs] of Object.entries(files)) {
        const t = read(repo, f);
        if (t === null) { out.push(repo + '/' + f + ' が無い'); continue; }
        xs.forEach((x) => { n++; if ((t.indexOf(x) >= 0) !== must) out.push(repo + '/' + f + (must ? ' に無い：' : ' にある：') + x.slice(0, 24)); });
      }
    }
    return { out, n };
  };
  const D = K ? K['死後の頁'] : null;
  const d1 = 文ずれ(D && D['無い'], false), d2 = 文ずれ(D && D['要る'], true);
  check('死後の頁が、家の伝統・親族・名を付けた場を書かず、著者自身の手配を書く（日英、設定と頁、' + (d1.n + d2.n) + ' 句）',
    D !== null && d1.n > 0 && d2.n > 0 && d1.out.length + d2.out.length === 0, d1.out.concat(d2.out).join(', '));
  const L = 文ずれ(K && K['ライセンスの範囲'], true);
  check('Sophaxis の頁が、README と同じライセンスの範囲（載っている作品・保存版の MIT・他人の文）を書く（' + L.n + ' 句）',
    K !== null && L.n > 0 && L.out.length === 0, L.out.join(', '));

  /* SECURITY.md。二つの Action が入力を受け取ることを、11 の写しのどれもが書く。 */
  const S = K ? K['安全の窓口'] : null;
  const 窓口ずれ = [];
  for (const repo of (S ? S.repos : [])) {
    const t = read(repo, 'SECURITY.md');
    if (t === null) { 窓口ずれ.push(repo + ' に無い'); continue; }
    S['要る'].forEach((x) => { if (t.indexOf(x) < 0) 窓口ずれ.push(repo + ' に「' + x.slice(0, 20) + '」が無い'); });
    S['無い'].forEach((x) => { if (t.indexOf(x) >= 0) 窓口ずれ.push(repo + ' に「' + x + '」'); });
  }
  Object.entries(S ? S['Action'] : {}).forEach(([repo, f]) => {
    const a = read(repo, f);
    if (a !== null && !/^inputs:/m.test(a)) 窓口ずれ.push(repo + '/' + f + ' に inputs が無い（SECURITY.md の文を見直す）');
  });
  check('SECURITY.md が、二つの GitHub Action が使う人のワークフローで動いて入力を受け取ることを書き、報告の範囲に入れる（' + (S ? S.repos.length : 0) + ' 本）',
    S !== null && S.repos.length > 0 && 窓口ずれ.length === 0, 窓口ずれ.slice(0, 6).join(' / '));

  /* 自己分析と独仏伊。SSRN の編集の人が見るという文を戻さず、取り寄せた場の句を置く。 */
  const A = K ? K['自己分析'] : null;
  const 自己 = read('cpsbvbng26-dotcom', path.join('docs', 'self-assessment.md')) || '';
  const 自己ずれ = A === null ? ['宣言が無い'] : A['無い'].filter((x) => 自己.indexOf(x) >= 0).map((x) => 'ある：' + x)
    .concat(A['要る'].filter((x) => 自己.indexOf(x) < 0).map((x) => '無い：' + x.slice(0, 24)));
  check('自己分析が、SSRN と PhilArchive の閾値を、取り寄せた頁の言えることだけで書く', 自己ずれ.length === 0, 自己ずれ.join(', '));
  const F = K ? K['独仏伊'] : null;
  const f1 = 文ずれ(F && F['無い'], false);
  const 句 = DECL['二度目の見落とし'] ? DECL['二度目の見落とし']['場の文'] : [];
  const f2 = [];
  for (const [repo, files] of Object.entries(F ? F['句を置く'] : {})) {
    files.forEach((f) => { const t = read(repo, f) || ''; 句.forEach((q) => { if (t.indexOf(q['句']) < 0) f2.push(repo + '/' + f + ' に「' + q['句'].slice(0, 20) + '」が無い'); }); });
  }
  check('独仏伊の自己紹介が、SSRN の編集の人が見るという文と取り寄せた頁に無い句を戻さず、取り寄せた場の句（' + 句.length + ' 句）を置く（設定と頁）',
    F !== null && f1.n > 0 && 句.length > 0 && f1.out.length + f2.length === 0, f1.out.concat(f2).slice(0, 6).join(' / '));
}

console.log('\n12l. 四度目の見落とし（2026-11-12 の続き）');
{
  const K = DECL['四度目の見落とし'] || null;

  const 欠け = [];
  let 行 = 0;
  for (const repo of (K ? K['記録'] : [])) {
    const t = read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length || sec.indexOf(K['決めた']) < 0) 欠け.push(repo + (i < 0 ? '（節が無い）' : '（行か決めた一文が無い）'));
  }
  check('点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行と Claude が決めたことの一文がある（' + (K ? K['記録'].length - 欠け.length : 0) + ' 本、' + 行 + ' 行）',
    K !== null && K['記録'].length > 0 && 欠け.length === 0, 欠け.join(', '));

  /* 場の選別。語の表ではなく形で止める。式は screening.js。 */
  const SC = require('./screening');
  const V = K ? K['選別の見張り'] : null;
  const 止めない = (V ? V['止める文'] : []).filter((x) => SC.scan(x).length === 0);
  const 止める = (V ? V['通す文'] : []).filter((x) => SC.scan(x).length > 0);
  check('選別の見張りの式が、SSRN・PhilArchive に選別の中身か担い手を帰す文を日英独仏伊で止め、取り寄せた頁が言わないと述べる文を通す（'
    + (V ? V['止める文'].length + ' と ' + V['通す文'].length : 0) + ' 文）',
    V !== null && 止めない.length === 0 && 止める.length === 0,
    止めない.map((x) => '通した：' + x.slice(0, 40)).concat(止める.map((x) => '止めた：' + x.slice(0, 40))).join(' / '));
  /* 面を開く。* は一つの階層の中だけを指す。 */
  const 開く = (repo, pat) => {
    const dir = path.dirname(pat) === '.' ? '' : path.dirname(pat);
    const base = path.basename(pat);
    const re = new RegExp('^' + base.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
    const abs = path.join(ROOT, repo, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs).filter((f) => re.test(f)).map((f) => path.join(dir, f));
  };
  const 選別ずれ = [];
  let 面 = 0;
  for (const [repo, pats] of Object.entries(V ? V['面'] : {})) {
    if (!fs.existsSync(path.join(ROOT, repo))) { 選別ずれ.push(repo + ' が無い'); continue; }
    for (const pat of pats) {
      for (const f of 開く(repo, pat)) {
        面++;
        SC.scan(read(repo, f) || '').forEach((s) => 選別ずれ.push(repo + '/' + f + '：' + s.slice(0, 60)));
      }
    }
  }
  check('自己紹介・頁・README のどの言語も、SSRN・PhilArchive が載せる前に何を、誰が見るかを、取り寄せた頁に無い形で書かない（' + 面 + ' 面）',
    V !== null && 面 > 0 && 選別ずれ.length === 0, 選別ずれ.slice(0, 6).join(' / '));

  /* deposit-check の読む API。自己紹介が名乗る場の集まりが、fetch.js の問い合わせる場の集まりと同じ。 */
  const A = K ? K['API の名'] : null;
  const fetchJs = read('deposit-check', path.join('src', 'fetch.js')) || '';
  const hosts = [...new Set((fetchJs.match(/get\('https:\/\/[a-z0-9.-]+/g) || []).map((x) => x.replace(/^get\('https:\/\//, '')))].sort();
  const 名 = A ? hosts.map((h) => A['対応'][h] || ('対応に無い場 ' + h)).sort() : [];
  const API名ずれ = [];
  if (!hosts.length) API名ずれ.push('fetch.js の問い合わせる場が読めない');
  for (const s of (A ? A['面'] : [])) {
    const t = read(s.repo, s.file);
    const m = t === null ? null : new RegExp(s['式']).exec(t);
    if (m === null) { API名ずれ.push(s.repo + '/' + s.file + ' に API の名乗りが無い'); continue; }
    const got = m[1].split(/・|、|, | and | と /).map((x) => x.trim()).filter(Boolean).sort();
    if (JSON.stringify(got) !== JSON.stringify(名)) API名ずれ.push(s.repo + '/' + s.file + '：' + got.join('・') + ' / ' + 名.join('・'));
  }
  check('自己紹介と deposit-check の README・.zenodo.json・package.json が名乗る、deposit-check の読む API が、src/fetch.js の問い合わせる場（' + hosts.length + ' か所）と同じ',
    A !== null && hosts.length > 0 && API名ずれ.length === 0, API名ずれ.join(' / ') || 名.join('・'));

  /* 登録簿の件数（決めごと 5）。 */
  const R = K ? K['登録簿の数'] : null;
  const 実 = ((read('self-correction', 'register.toml') || '').match(/^\[\[entry\]\]/gm) || []).length;
  const 数ずれ = [];
  let 名乗り数 = 0;
  for (const s of (R ? R['面'] : [])) {
    const t = read(s.repo, s.file);
    if (t === null) { 数ずれ.push(s.repo + '/' + s.file + ' が無い'); continue; }
    s['式'].forEach((x) => {
      const ms = [...t.matchAll(new RegExp(x, 'g'))];
      if (!ms.length) 数ずれ.push(s.repo + '/' + s.file + ' に「' + x + '」が無い');
      ms.forEach((m) => { 名乗り数++; if (parseInt(m[1], 10) !== 実) 数ずれ.push(s.repo + '/' + s.file + '：' + m[0] + '（実際 ' + 実 + '）'); });
    });
  }
  check('自己紹介・頁・README・自己分析が名乗る登録簿の件数が、register.toml の項目の数（' + 実 + ' 件）と同じ（' + 名乗り数 + ' か所）',
    R !== null && 実 > 0 && 名乗り数 > 0 && 数ずれ.length === 0, 数ずれ.slice(0, 6).join(' / '));

  /* 一日に一度の見張りの名乗り。どのスクリプトも、ブラウザの名を名乗りに書かない。 */
  const U = K ? K['見張りの名乗り'] : null;
  let up = null;
  try { up = require(path.join(ROOT, 'cpsbvbng26-dotcom', U ? U.file : 'x')); } catch (e) { up = null; }
  const 見張り = up === null ? '' : String(up.UA || '');
  check('一日に一度の見張りの名乗りが、ブラウザの名を借りず、このリポジトリのこの仕事を書く', U !== null && 見張り.indexOf(U['含む']) >= 0
    && U['ブラウザ'].every((x) => 見張り.indexOf(x) < 0), 見張り);
  const 借り = [];
  const 文字列 = new RegExp('[\'"`][^\'"`\\n]*(?:' + (U ? U['ブラウザ'] : ['x']).map((x) => x.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|') + ')[^\'"`\\n]*[\'"`]');
  const 歩く = (dir, rel) => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) return /^(\.git|node_modules)$/.test(e.name) ? [] : 歩く(dir, r);
    return /\.(?:js|mjs|cjs|py|sh|yml|yaml)$/.test(e.name) ? [r] : [];
  });
  let 走査 = 0;
  for (const repo of (K ? K['記録'] : [])) {
    const dir = path.join(ROOT, repo);
    if (!fs.existsSync(dir)) continue;
    for (const f of 歩く(dir, '')) {
      if (repo === 'cpsbvbng26-dotcom' && f === path.join('verification', 'check_ecosystem.js')) continue;
      走査++;
      const t = fs.readFileSync(path.join(dir, f), 'utf8');
      t.split('\n').forEach((l, n) => { if (/user-agent|\bUA\b|ua\s*=/i.test(l) && 文字列.test(l)) 借り.push(repo + '/' + f + ':' + (n + 1)); });
    }
  }
  check('11 のリポジトリのどのスクリプトも、名乗り（User-Agent）にブラウザの名を書かない（' + 走査 + ' ファイル）', U !== null && 走査 > 0 && 借り.length === 0, 借り.join(', '));

  /* 他人の文。README のライセンスの節と免責事項の「再利用」。 */
  const O = K ? K['他人の文'] : null;
  const 他ずれ = [];
  for (const [repo, files] of Object.entries(O ? O['README'] : {})) {
    files.forEach((f) => {
      const t = read(repo, f);
      if (t === null) { 他ずれ.push(repo + '/' + f + ' が無い'); return; }
      const want = /\.en\.md$/.test(f) ? [O['英']] : repo === 'deposit-check' ? [O['英'], O['和']] : [O['和']];
      want.forEach((x) => { if (t.indexOf(x) < 0) 他ずれ.push(repo + '/' + f + ' に' + (x === O['英'] ? '英' : '和') + 'の一文が無い'); });
    });
  }
  Object.entries(O ? O['免責'] : {}).forEach(([f, x]) => {
    const t = read('cpsbvbng26-dotcom', f) || '';
    const i = t.indexOf(/\.en\.md$/.test(f) ? '## Reuse' : '## 再利用');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    if (i < 0 || t.slice(i, j < 0 ? t.length : j).indexOf(x) < 0) 他ずれ.push(f + ' の再利用の節に一文が無い');
  });
  check('README のライセンスの節（' + (O ? Object.values(O['README']).flat().length : 0) + ' 面）と免責事項の「再利用」（日英）が、引いた他人の文は CC BY 4.0 でも MIT でも許諾していないと書く',
    O !== null && 他ずれ.length === 0, 他ずれ.join(', '));

  /* 公開前の確認。取り寄せた頁が言わない確認を、場に帰さない（Research Square）。全リポジトリを語で探す。 */
  const Q = K ? K['公開前の確認'] : null;
  const 確認ずれ = [];
  let 確認数 = 0;
  [['無い', false], ['要る', true]].forEach(([key, must]) => {
    for (const [repo, files] of Object.entries(Q ? Q[key] : {})) {
      for (const [f, xs] of Object.entries(files)) {
        const t = read(repo, f);
        if (t === null) { 確認ずれ.push(repo + '/' + f + ' が無い'); continue; }
        xs.forEach((x) => { 確認数++; if ((t.indexOf(x) >= 0) !== must) 確認ずれ.push(repo + '/' + f + (must ? ' に無い：' : ' にある：') + x.slice(0, 24)); });
      }
    }
  });
  const 語 = (Q ? Q['無い']['cpsbvbng26-dotcom']['docs/submission-disclosure.md'] : []);
  for (const repo of (K ? K['記録'] : [])) {
    const dir = path.join(ROOT, repo);
    if (!fs.existsSync(dir)) continue;
    let out = '';
    try { out = execFileSync('git', ['grep', '-l', '-F'].concat(語.flatMap((x) => ['-e', x])), { cwd: dir, encoding: 'utf8' }); } catch (e) { out = ''; }
    out.split('\n').filter((f) => f && !/legal-audit|ecosystem\.json|check_ecosystem\.js/.test(f)).forEach((f) => 確認ずれ.push(repo + '/' + f + ' に残る'));
  }
  check('Research Square が公開の前に確認するという、取り寄せた頁に無い文を、どのリポジトリにも置かない（' + 確認数 + ' 句）',
    Q !== null && 確認数 > 0 && 確認ずれ.length === 0, 確認ずれ.join(', '));

  /* CITATION.cff と .zenodo.json のライセンスの範囲。置き方は目録の licenceLayout と同じ。 */
  const Z = K ? K['引用情報の範囲'] : null;
  let lay = null;
  try { lay = JSON.parse(read('researcher-profile', 'catalog.json')).licenceLayout; } catch (e) { lay = null; }
  const 範囲ずれ = [];
  for (const [repo, e] of Object.entries(Z ? Z.repos : {})) {
    const cff = read(repo, 'CITATION.cff');
    let notes = null;
    try { notes = JSON.parse(read(repo, '.zenodo.json')).notes; } catch (err) { notes = null; }
    if (cff === null || notes === null) { 範囲ずれ.push(repo + ' に CITATION.cff か .zenodo.json が無い'); continue; }
    const msg = (/^message:[\s\S]*?(?=^[a-z-]+:)/m.exec(cff) || [''])[0];
    const 和 = e['和'] ? e['和'].concat([O ? O['和'] : '']) : e['英'].concat([O ? O['英'] : '']);
    和.forEach((x) => { if (msg.indexOf(x) < 0) 範囲ずれ.push(repo + '/CITATION.cff の message に「' + x.slice(0, 24) + '」が無い'); });
    e['英'].concat([O ? O['英'] : '']).forEach((x) => { if (notes.indexOf(x) < 0) 範囲ずれ.push(repo + '/.zenodo.json の notes に「' + x.slice(0, 24) + '」が無い'); });
    const 英 = e['英'].join(' ');
    if (lay === null) 範囲ずれ.push('目録の licenceLayout が読めない');
    else if (lay.mit.includes(repo)) {
      if (英.indexOf('MIT (LICENSE)') < 0 || 英.indexOf('LICENSE-CODE') >= 0) 範囲ずれ.push(repo + '：目録は LICENSE 一つで MIT');
      ((lay.exceptions || {})[repo] || []).forEach((d) => { if (英.indexOf(d + '/') < 0) 範囲ずれ.push(repo + '：例外の ' + d + '/ が無い'); });
    } else if (lay.split.includes(repo)) {
      if (英.indexOf('CC BY 4.0 (LICENSE)') < 0 || 英.indexOf('MIT (LICENSE-CODE)') < 0) 範囲ずれ.push(repo + '：目録は LICENSE が CC BY 4.0、LICENSE-CODE が MIT');
    } else 範囲ずれ.push(repo + '：目録の licenceLayout に無い');
  }
  check('CITATION.cff の message と .zenodo.json の notes が、どこが MIT でどこが CC BY 4.0 か、license の欄の掛かる範囲、他人の文を許諾していないことを書き、置き方が目録と同じ（'
    + (Z ? Object.keys(Z.repos).length : 0) + ' 本）', Z !== null && Object.keys(Z.repos).length > 0 && 範囲ずれ.length === 0, 範囲ずれ.slice(0, 6).join(' / '));

  /* 十度目の見落とし（2026-11-13）。**license の欄を語る文が、欄そのものと合うこと。**
   * cpsbvbng26-dotcom の .zenodo.json の notes は「licence field ... names both」と書き、欄は cc-by-4.0 一つだった。
   * 上の検査は文があることと置き方しか見ておらず、欄の値を読んでいなかった。ここでは、13 のリポジトリのうち
   * .zenodo.json を持つものすべてで、notes と CITATION.cff の message を読み、
   *   一、「A は CC BY 4.0、B は MIT」の形の文から、ライセンスごとに部分を集める。
   *   二、欄を語る文が名指すライセンスを決める。名を括弧で書けばそれ、「二つを挙げ」「names both」なら両方、
   *       「X だけに掛かる」「covers X only」なら、X の語がすべて部分の文に出るライセンス（ちょうど一つ）。
   *   三、それが .zenodo.json の license の値と、CITATION.cff の license の並びと、集合として同じであること。 */
  const 欄の名 = { 'cc-by-4.0': 'CC BY 4.0', 'CC-BY-4.0': 'CC BY 4.0', mit: 'MIT', MIT: 'MIT' };
  const 部分 = (text, ja) => {
    const out = {};
    const add = (k, v) => { out[k] = (out[k] || '') + ' ' + v; };
    if (ja) {
      for (const m of text.matchAll(/([^、。]*?)(?:は|が) (CC BY 4\.0|MIT)(?:（[^）]*）)?(?=[、。]|です)/g)) add(m[2], m[1]);
    } else {
      for (const s of text.split(/(?<=[.;])\s+/)) {
        if (/licen[cs]e field/i.test(s)) continue;
        const m = /^(.*?)\s+(?:is|are)\s+(CC BY 4\.0|MIT)\b/.exec(s);
        if (m) add(m[2], m[1]);
        const e = /except (.*?), which (?:is|are) (CC BY 4\.0|MIT)\b/.exec(s);
        if (e) add(e[2], e[1]);
      }
    }
    return out;
  };
  const 止め語 = new Set(['the', 'and', 'of', 'in', 'only', 'a', 'an', 'this', 'record', 'other', 'its']);
  const 欄の語 = (s, ja) => (ja ? s.split(/と|・|、|の|\s+/) : s.toLowerCase().split(/[^a-z]+/))
    .map((x) => x.trim()).filter((x) => x && (ja || !止め語.has(x)));
  const 名指す = (text, ja) => {
    const P = 部分(text, ja);
    const s = ja ? (/license の欄[^。]*。/.exec(text) || [''])[0] : (/The licen[cs]e field of this record[^.]*\./.exec(text) || [''])[0];
    if (!s) return { err: '欄を語る文が無い' };
    if (!Object.keys(P).length) return { err: 'どこが何のライセンスかを書く文が読めない' };
    const ex = ja ? /license の欄（(CC BY 4\.0|MIT)）/.exec(s) : /licen[cs]e field of this record \((CC BY 4\.0|MIT)\)/.exec(s);
    if (ex) return { set: [ex[1]] };
    if (ja ? /二つを挙げ/.test(s) : /names both/.test(s)) return { set: Object.keys(P).sort() };
    const x = ja ? (/license の欄は、(.*?)(?:だけ)?に掛かります/.exec(s) || [])[1] : (/covers (.*?)(?: only)?\.$/.exec(s) || [])[1];
    if (!x) return { err: '欄を語る文の形が読めない' };
    const w = 欄の語(x, ja);
    const hit = Object.keys(P).filter((L) => { const pw = ja ? P[L] : 欄の語(P[L], false); return w.length > 0 && w.every((t) => pw.includes(t)); });
    return hit.length === 1 ? { set: hit } : { err: '欄が掛かる部分（' + x + '）が、' + (hit.length ? '二つのライセンスに' : 'どのライセンスの部分にも') + '当たる' };
  };
  const 欄を読む = (files) => {
    const bad = [];
    let n = 0;
    for (const [repo, f] of Object.entries(files)) {
      if (f.zenodo === null) continue;
      n++;
      let z = null;
      try { z = JSON.parse(f.zenodo); } catch (e) { bad.push(repo + '/.zenodo.json が読めない'); continue; }
      const zl = [...new Set([].concat(z.license || []).map((v) => 欄の名[(v && v.id) || v] || String(v)))].sort();
      const a = 名指す(String(z.notes || ''), false);
      if (a.err) bad.push(repo + '/.zenodo.json の notes：' + a.err);
      else if (JSON.stringify(a.set) !== JSON.stringify(zl)) bad.push(repo + '/.zenodo.json：notes は ' + a.set.join('+') + '、license は ' + zl.join('+'));
      const cff = f.cff;
      if (cff === null) { bad.push(repo + '/CITATION.cff が無い'); continue; }
      const msg = ((/^message:[\s\S]*?(?=^[a-z-]+:)/m.exec(cff) || [''])[0]).replace(/\s*\n\s*/g, ' ');
      const lm = /^license:[ \t]*(\S*)[ \t]*\n((?:[ \t]+-[ \t]*\S+[ \t]*\n)*)/m.exec(cff);
      const cl = lm === null ? [] : [...new Set((lm[1] ? [lm[1]] : (lm[2].match(/(?<=-[ \t]*)\S+/g) || [])).map((v) => 欄の名[v.replace(/"/g, '')] || v))].sort();
      const b = 名指す(msg, /[ぁ-ん]/.test(msg));
      if (b.err) bad.push(repo + '/CITATION.cff の message：' + b.err);
      else if (JSON.stringify(b.set) !== JSON.stringify(cl)) bad.push(repo + '/CITATION.cff：message は ' + b.set.join('+') + '、license は ' + (cl.join('+') || '無い'));
    }
    return { bad, n };
  };
  const 十三l = (DECL['八度目の見落とし'] || {})['記録'] || [];
  const 欄の元 = Object.fromEntries(十三l.map((r) => [r, { zenodo: read(r, '.zenodo.json'), cff: read(r, 'CITATION.cff') }]));
  const 欄 = 欄を読む(欄の元);
  check('.zenodo.json の notes と CITATION.cff の message が license の欄について書くことが、欄の値そのものと合う（' + 欄.n + ' 本。13 のリポジトリのうち .zenodo.json を持つもの）',
    十三l.length === 13 && 欄.n >= 12 && 欄.bad.length === 0, 欄.bad.slice(0, 6).join(' / '));
  const 欄替 = (r, k, a2, b2) => Object.assign({}, 欄の元, { [r]: Object.assign({}, 欄の元[r], { [k]: String((欄の元[r] || {})[k] || '').replace(a2, b2) }) });
  const 欄壊す = [
    ['cpsbvbng26-dotcom の notes を「names both」に戻す', 欄替('cpsbvbng26-dotcom', 'zenodo', 'The licence field of this record covers the texts, the structured data and the images only.', 'The licence field of this record names both; each covers only its own part.')],
    ['cpsbvbng26-dotcom の .zenodo.json の license を mit にする', 欄替('cpsbvbng26-dotcom', 'zenodo', '"license": "cc-by-4.0"', '"license": "mit"')],
    ['autonomy の notes の掛かる部分をコードにする', 欄替('autonomy-and-self-cultivation', 'zenodo', 'covers the texts and the papers only', 'covers the code only')],
    ['sophaxis の .zenodo.json の license を cc-by-4.0 にする', 欄替('sophaxis', 'zenodo', '"license": "mit"', '"license": "cc-by-4.0"')],
    ['trinity-operator の括弧の名を変える', 欄替('trinity-operator', 'zenodo', 'licence field of this record (MIT)', 'licence field of this record (CC BY 4.0)')],
    ['cpsbvbng26-dotcom の CITATION.cff の並びから MIT を外す', 欄替('cpsbvbng26-dotcom', 'cff', /\n  - MIT\n/, '\n')],
    ['justice-and-algorithms の message の掛かる部分をスクリプトにする', 欄替('justice-and-algorithms', 'cff', 'license の欄は、本文だけに掛かります。', 'license の欄は、スクリプトだけに掛かります。')],
    ['errata-check の CITATION.cff の license を CC-BY-4.0 にする', 欄替('errata-check', 'cff', /^license: MIT$/m, 'license: CC-BY-4.0')],
    ['naval-gazette-notes の message から欄を語る文を外す', 欄替('naval-gazette-notes', 'cff', 'license の欄は、文書とデータだけに掛かります。', '')],
  ];
  const 欄落ちた = 欄壊す.filter(([, y]) => 欄を読む(y).bad.length > 0).map(([n]) => n);
  check('壊して確かめる：notes を「names both」に戻す・欄の値を替える（二本）・掛かる部分を替える（日英）・括弧の名を替える・CITATION.cff の並びを減らす・値を替える・欄を語る文を外す、のどれでも落ちる（'
    + 欄落ちた.length + ' / ' + 欄壊す.length + '）', 欄落ちた.length === 欄壊す.length, 欄壊す.filter(([n]) => !欄落ちた.includes(n)).map(([n]) => n).join(' / '));
}

/* ---------- 六度目の見落とし（2026-11-12 の続き。直したのは日本時間の 2026-11-13） ----------
 *
 * 一つ目。海軍公報の史料ノートの英語の要旨が「held by JACAR」と書いていた。JACAR の目録（C12070491000）は
 * 所蔵館を防衛省防衛研究所と書く。JACAR は画像を公開する側である。13 のリポジトリのどこにも、どの言語でも、
 * JACAR を所蔵の主に置く文を置かない。直した文が、要旨の出る頁と設定に在ること。
 * 二つ目。Friedkin と Johnsen の 2011 年の本を「単著の理論書」と書いていた。Crossref は著者を二人と返す。
 * 二人の名か本の題と同じ段落に、単著や single-authored を置かない。
 * どちらの式も、止める文と通す文で先に壊して確かめる。記録の節と、点検の検査そのものは探す先から外す
 * （直す前の文を引いて記録しているため）。 */
console.log('\n12m. 六度目の見落とし（2026-11-12 の続き）');
{
  const K = DECL['六度目の見落とし'] || null;

  const 欠け = [];
  let 行 = 0;
  for (const repo of (K ? K['記録'] : [])) {
    const t = read(repo, path.join('docs', 'legal-audit-2026-11-12.md'));
    if (t === null) { 欠け.push(repo); continue; }
    const i = t.indexOf('\n' + K['節'] + '\n');
    const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
    const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
    const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l));
    行 += rows.length;
    if (i < 0 || !rows.length || sec.indexOf(K['決めた']) < 0) 欠け.push(repo + (i < 0 ? '（節が無い）' : '（行か決めた一文が無い）'));
    const 書く = K['単著の見張り']['記録に書くこと'].filter((x) => sec.indexOf(x) < 0);
    if (i >= 0 && 書く.length) 欠け.push(repo + '（Crossref の記録の「' + 書く[0] + '」が無い）');
  }
  check('点検の記録に「' + (K ? K['節'].replace(/^## /, '') : '') + '」の節があり、表の行と Claude が決めたこと、読んだ Crossref の記録の所在・日・欄がある（'
    + (K ? K['記録'].length - 欠け.length : 0) + ' 本、' + 行 + ' 行）', K !== null && K['記録'].length > 0 && 欠け.length === 0, 欠け.join(', '));

  /* 13 のリポジトリを、語で絞ってから式で見る。 */
  const 見ない = new Set(K ? K['見ないファイル'] : []);
  const 絞る = (repo, words) => {
    try {
      return execFileSync('git', ['grep', '-l', '-I', '-F'].concat(words.flatMap((x) => ['-e', x])), { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 1 << 26 })
        .split('\n').filter((f) => f && !見ない.has(f));
    } catch (e) { return []; }
  };
  const 先 = K ? K['探す先'] : [];
  const 無い先 = 先.filter((r) => !fs.existsSync(path.join(ROOT, r)));

  const S = K ? K['所蔵の見張り'] : null;
  const 式 = S ? S['式'].map((x) => new RegExp(x, 'i')) : [];
  const 所蔵か = (s) => 式.some((re) => re.test(s));
  const 試験 = [];
  (S ? S['止める文'] : []).forEach((x) => { if (!所蔵か(x)) 試験.push('通した：' + x.slice(0, 40)); });
  (S ? S['通す文'] : []).forEach((x) => { if (所蔵か(x)) 試験.push('止めた：' + x.slice(0, 40)); });
  const 所蔵ずれ = [];
  let 所蔵面 = 0;
  for (const repo of 先) {
    if (無い先.includes(repo) || S === null) continue;
    for (const f of 絞る(repo, S['絞り込み'])) {
      所蔵面++;
      (read(repo, f) || '').split('\n').forEach((l, n) => { if (所蔵か(l)) 所蔵ずれ.push(repo + '/' + f + ':' + (n + 1)); });
    }
  }
  const 在る = (A) => {
    const out = [];
    let n = 0;
    for (const [repo, files] of Object.entries(A || {})) {
      for (const [f, xs] of Object.entries(files)) {
        const t = read(repo, f);
        xs.forEach((x) => { n++; if (t === null || t.indexOf(x) < 0) out.push(repo + '/' + f + ' に「' + x.slice(0, 30) + '」が無い'); });
      }
    }
    return { out, n };
  };
  const 所蔵在る = 在る(S ? S['ある文'] : null);
  check('13 のリポジトリのどこにも、JACAR を原資料の所蔵の主に置く文が無く（JACAR の名を持つ ' + 所蔵面 + ' ファイル、式は日英独仏伊）、要旨の出る面（'
    + 所蔵在る.n + ' か所）が所蔵館を防衛研究所、JACAR を公開の側と書く',
    S !== null && 無い先.length === 0 && 所蔵面 > 0 && 所蔵在る.n > 0 && 試験.length + 所蔵ずれ.length + 所蔵在る.out.length === 0,
    無い先.map((r) => r + ' が並んでいない').concat(試験, 所蔵ずれ, 所蔵在る.out).slice(0, 6).join(' / ')
      || (S ? '止める文 ' + S['止める文'].length + '・通す文 ' + S['通す文'].length : ''));

  const T = K ? K['単著の見張り'] : null;
  const 相手 = new RegExp(T ? T['相手'] : 'x^');
  const 語 = new RegExp(T ? T['語'] : 'x^', 'i');
  const 単著か = (s) => 相手.test(s) && 語.test(s);
  const 試験2 = [];
  (T ? T['止める文'] : []).forEach((x) => { if (!単著か(x)) 試験2.push('通した：' + x.slice(0, 40)); });
  (T ? T['通す文'] : []).forEach((x) => { if (単著か(x)) 試験2.push('止めた：' + x.slice(0, 40)); });
  const 単著ずれ = [];
  let 単著面 = 0;
  for (const repo of 先) {
    if (無い先.includes(repo) || T === null) continue;
    for (const f of 絞る(repo, T['絞り込み'])) {
      単著面++;
      (read(repo, f) || '').split(/\n\s*\n|<\/p>|<\/li>|<\/td>/).forEach((p) => { if (単著か(p)) 単著ずれ.push(repo + '/' + f + '：' + p.trim().slice(0, 40)); });
    }
  }
  const 単著在る = 在る(T ? T['ある文'] : null);
  check('13 のリポジトリのどこにも、Friedkin と Johnsen の本を単著と書く段落が無く（二人の名か題を持つ ' + 単著面 + ' ファイル）、日本語の面（'
    + 単著在る.n + ' か所）が二人の共著と書く',
    T !== null && 無い先.length === 0 && 単著面 > 0 && 単著在る.n > 0 && 試験2.length + 単著ずれ.length + 単著在る.out.length === 0,
    無い先.map((r) => r + ' が並んでいない').concat(試験2, 単著ずれ, 単著在る.out).slice(0, 6).join(' / ')
      || (T ? '止める文 ' + T['止める文'].length + '・通す文 ' + T['通す文'].length : ''));
}

/* ---------- 七度目の見落とし：頁の最終更新の日付（2026-11-12 の続き） ----------
 *
 * 頁の最終更新は、その頁の文を変えた最後のコミットの、日本時間の日付より前にならない。最終更新の行だけを変えた
 * コミットは数えない。作業の時計（協定世界時）の日付を書くと、日本時間で公開した日より一日早くなる。
 * 免責事項（日英）が 2026-11-13 の変更のあとも 2026-11-12 を書いていて、見落とした。nusquama の検査 70 と
 * sophaxis の検査 121 と同じ形を、10 のリポジトリの日付のある頁に当てる。履歴を読むので、浅い複製では通さない。 */

console.log('\n12n. 七度目の見落とし：頁の最終更新（2026-11-12 の続き）');
{
  const K = DECL['七度目の見落とし'] || null;
  const G = K ? K['日付の頁'] : null;
  const 今日 = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const 式 = G ? G['式'].map((x) => new RegExp(x, 'm')) : [];
  const 消す = G ? G['式'].map((x) => new RegExp(x, 'gm')) : [];
  const 本文 = (t) => 消す.reduce((a, re) => a.replace(re, ''), String(t === null || t === undefined ? '' : t));
  const 日付 = (t) => {
    for (const re of 式) {
      const m = re.exec(t || '');
      if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    }
    return null;
  };
  const git = (repo, args) => execFileSync('git', args, { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'], env: Object.assign({}, process.env, { TZ: 'Asia/Tokyo' }) });
  const 試す = (f, d) => { try { return f(); } catch (e) { return d; } };
  const 浅い = {}, 頁 = [], 今 = {}, 最後 = {};
  for (const repo of (G ? G.repos : [])) {
    浅い[repo] = 試す(() => git(repo, ['rev-parse', '--is-shallow-repository']).trim() !== 'false', true);
    const fs_ = 試す(() => git(repo, ['ls-files', '*.md']).split('\n').filter(Boolean), []);
    for (const f of fs_) {
      if (G['見ない'].some((x) => f.startsWith(x))) continue;
      const t = read(repo, f);
      if (t === null || !式.some((re) => re.test(t))) continue;
      const k = repo + '/' + f;
      頁.push(k); 今[k] = t;
      /* 文を変えた最後の日。いまの文が HEAD と違えば今日。そうでなければ、前の版と本文が違う最も新しいコミットの日。 */
      const log = 試す(() => git(repo, ['log', '--format=%H %cd', '--date=format-local:%Y-%m-%d', '--', f]).split('\n').filter(Boolean).map((l) => l.split(' ')), []);
      const 版 = (h) => 試す(() => git(repo, ['show', h + ':' + f]), null);
      if (!log.length || 本文(t) !== 本文(版(log[0][0]))) { 最後[k] = 今日; continue; }
      let d = log[log.length - 1][1];
      let 前 = 本文(版(log[0][0]));
      for (let i = 0; i < log.length; i++) {
        const 次 = i + 1 < log.length ? 本文(版(log[i + 1][0])) : null;
        if (次 === null || 次 !== 前) { d = log[i][1]; break; }
        前 = 次;
      }
      最後[k] = d;
    }
  }
  const WF = G ? read('cpsbvbng26-dotcom', G['workflow']) : null;
  const 記録 = Object.fromEntries((K ? K['記録'] : []).map((r) => [r, read(r, path.join('docs', 'legal-audit-2026-11-12.md'))]));
  function 判定(x) {
    const bad = [];
    if (K === null || G === null) return ['宣言が無い'];
    for (const r of G.repos) if (x.浅い[r]) bad.push(r + ' の履歴が浅い');
    for (const k of G['在るべき頁']) if (!x.頁.includes(k) || !日付(x.今[k])) bad.push(k + ' に最終更新の行が無い');
    for (const k of x.頁) {
      const d = 日付(x.今[k]);
      if (!d || d < x.最後[k]) bad.push(k + '：最終更新 ' + d + ' が、文を変えた日 ' + x.最後[k] + ' より前');
    }
    for (const [k, suf] of Object.entries(G['日本時間と書く頁'])) {
      if (k === '_') continue;
      const l = (x.今[k] || '').split('\n').find((y) => 式.some((re) => re.test(y))) || '';
      if (!l.endsWith(suf)) bad.push(k + ' の最終更新が日本時間だと書いていない');
    }
    for (const r of G.repos) {
      const want = r === 'cpsbvbng26-dotcom' ? 'path: repos/cpsbvbng26-dotcom, fetch-depth: 0 }' : 'repository: cpsbvbng26-dotcom/' + r + ', path: repos/' + r + ', fetch-depth: 0 }';
      if ((x.WF || '').indexOf(want) < 0) bad.push(G['workflow'] + ' が ' + r + ' の履歴をすべて取らない');
    }
    for (const r of K['記録']) {
      const t = x.記録[r] || '';
      const i = t.indexOf('\n' + K['節'] + '\n');
      const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
      const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
      const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|---)/.test(l));
      if (i < 0 || !rows.length || !rows.every((l) => l.split(' | ').length === 6) || sec.indexOf(K['決めた']) < 0) bad.push(r + ' の点検の記録に、七度目の節・表・決めた一文が無い');
    }
    return bad;
  }
  const 実 = { 浅い, 頁, 今, 最後, WF, 記録 };
  const bad = 判定(実);
  check('10 のリポジトリの日付のある頁（' + 頁.length + ' 頁）の最終更新が、文を変えた最後のコミットの日本時間の日付より前でなく、免責事項は日本時間と書き、横断の CI は 10 のリポジトリの履歴をすべて取り、点検の記録（'
    + (K ? K['記録'].length : 0) + ' 本）に七度目の節がある', bad.length === 0, bad.slice(0, 6).join(' / '));
  const 替 = (k, a, b) => Object.assign({}, 実, { 今: Object.assign({}, 今, { [k]: (今[k] || '').replace(a, b) }) });
  const 壊す = [
    ['免責事項を前の日に戻す', 替('cpsbvbng26-dotcom/DISCLAIMER.md', '最終更新：2026-11-13（日本時間）。', '最終更新：2026-11-12（日本時間）。')],
    ['英語の免責事項を前の日に戻す', 替('cpsbvbng26-dotcom/DISCLAIMER.en.md', 'Last updated: 2026-11-13 (Japan time).', 'Last updated: 2026-11-12 (Japan time).')],
    ['免責事項から日本時間を外す', 替('cpsbvbng26-dotcom/DISCLAIMER.md', '最終更新：2026-11-13（日本時間）。', '最終更新：2026-11-13。')],
    ['英語の免責事項から日本時間を外す', 替('cpsbvbng26-dotcom/DISCLAIMER.en.md', 'Last updated: 2026-11-13 (Japan time).', 'Last updated: 2026-11-13.')],
    ['trinity-infinity の正誤表を前の日に戻す', 替('trinity-infinity/ERRATA.md', '最終更新: 2026年11月13日', '最終更新: 2026年11月12日')],
    ['正誤表の文を今日変えて、最終更新を変えない', Object.assign({}, 実, { 最後: Object.assign({}, 最後, { 'naval-gazette-notes/ERRATA.md': '2099-01-01' }) })],
    ['最終更新の行の形を崩す', 替('autonomy-and-self-cultivation/ERRATA.md', /^最終更新: /m, '最終更新 ')],
    ['頁を数えから外す', Object.assign({}, 実, { 頁: 頁.filter((k) => k !== 'cpsbvbng26-dotcom/DISCLAIMER.en.md') })],
    ['履歴が浅い', Object.assign({}, 実, { 浅い: Object.assign({}, 浅い, { 'self-correction': true }) })],
    ['横断の CI から fetch-depth を外す', Object.assign({}, 実, { WF: (WF || '').replace('repository: cpsbvbng26-dotcom/solitary-school, path: repos/solitary-school, fetch-depth: 0 }', 'repository: cpsbvbng26-dotcom/solitary-school, path: repos/solitary-school }') })],
    ['点検の記録から七度目の節を外す', Object.assign({}, 実, { 記録: Object.assign({}, 記録, { 'trinity-infinity': (記録['trinity-infinity'] || '').replace(K ? K['節'] : 'x^', '## 七度目') }) })],
    ['点検の記録から決めた一文を外す', Object.assign({}, 実, { 記録: Object.assign({}, 記録, { 'cpsbvbng26-dotcom': (記録['cpsbvbng26-dotcom'] || '').split(K ? K['決めた'] : 'x^').join('決めた') }) })],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  check('壊して確かめる：免責事項の日付（日英）・日本時間の書き（日英）・trinity-infinity の正誤表・今日変えた正誤表・行の形・数えから外す・浅い履歴・CI の fetch-depth・記録の節・決めた一文のどれでも落ちる（'
    + 落ちた.length + ' / ' + 壊す.length + '）', 落ちた.length === 壊す.length, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / '));
}

/* ---------- 八度目の見落とし：GitHub Actions の規約（2026-11-12 の続き） ----------
 *
 * GitHub の利用規約は I 節で追加製品の規約を取り込み、その Actions の節は、GitHub の実行環境での使い方を、
 * リポジトリのソフトウェアのプロジェクトの制作・検査・配備・公開に限る。どの点検もこの規約を読んでいなかった。
 * **13 のリポジトリのどのワークフローも、その記録の八度目の節の表に行を持つ。**新しいワークフローは、行を足して判定するまで落ちる。
 * 外したワークフローは、ファイルが無く、その行が外したと書く。記録の英語の引用は、statutes.json の規約の引いた句にある。 */
console.log('\n12o. 八度目の見落とし：GitHub Actions の規約（2026-11-12 の続き）');
{
  const K = DECL['八度目の見落とし'] || null;
  const ST = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')));
  const 判定語 = ['誤り', '根拠不足', '漏れ', '表現', '問題なし', 'Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'];
  const 平 = (x) => String(x || '').replace(/\s+/g, '');
  const 実 = {
    規約: ST['規約'],
    記録: Object.fromEntries((K ? K['記録'] : []).map((r) => [r, read(r, path.join('docs', 'legal-audit-2026-11-12.md'))])),
    流れ: Object.fromEntries((K ? K['記録'] : []).map((r) => {
      const d = path.join(ROOT, r, '.github', 'workflows');
      return [r, fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.ya?ml$/.test(f)).sort() : null];
    })),
  };
  function 判定(x) {
    const bad = [];
    if (K === null) return ['宣言が無い'];
    for (const [k, h] of Object.entries(K['規約'])) {
      const e = x.規約[k];
      if (!e || e['全文の sha256'] !== h || !e['引いた句']) bad.push('statutes.json の「' + k + '」');
    }
    const 句 = 平(Object.values(x.規約).flatMap((e) => Object.entries(e).filter(([k]) => /^引いた句/.test(k)).map(([, v]) => v)).join('|'));
    if (!句.includes(平(K['目的の句']))) bad.push('目的の句を写していない');
    for (const r of K['記録']) {
      const t = x.記録[r];
      if (t === null || t === undefined) { bad.push(r + ' の記録が無い'); continue; }
      const i = t.indexOf('\n' + K['節'] + '\n');
      const j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
      const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
      if (!sec) { bad.push(r + ' に八度目の節が無い'); continue; }
      const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l)).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
      if (!rows.length || !rows.every((c) => c.length === 6 && 判定語.includes(c[4]))) bad.push(r + ' の表の形');
      if (!K['決めた'].some((d) => sec.includes(d))) bad.push(r + ' に決めた一文が無い');
      if (!sec.includes(K['目的の句'])) bad.push(r + ' が目的の句を引いていない');
      const 名 = rows.map((c) => (/^`\.github\/workflows\/([^`]+)`/.exec(c[0]) || [])[1]).filter(Boolean);
      const 外した = (K['外したワークフロー'] || {})[r] || [];
      const 在る = x.流れ[r] || [];
      for (const f of 在る) if (!名.includes(f)) bad.push(r + '：行の無いワークフロー ' + f);
      for (const f of 名) if (!在る.includes(f) && !外した.includes(f)) bad.push(r + '：無いワークフローの行 ' + f);
      for (const f of 外した) {
        const row = rows.find((c) => c[0].startsWith('`.github/workflows/' + f + '`'));
        if (在る.includes(f)) bad.push(r + '：外したはずの ' + f + ' が在る');
        if (!row || !K['外した印'].some((m) => row[5].includes(m))) bad.push(r + '：' + f + ' の行が外したと書いていない');
      }
      /* 英語の引用は、写した規約の句にある。 */
      for (const m of sec.matchAll(/「([^「」\n]+)」|“([^“”\n]+)”/g)) {
        const q = m[1] || m[2];
        if (q.length >= 20 && /^[\x20-\x7E’]+$/.test(q) && !句.includes(平(q))) bad.push(r + '：写した句に無い引用「' + q.slice(0, 24) + '」');
      }
    }
    return bad;
  }
  const bad = 判定(実);
  const 本数 = Object.values(実.流れ).reduce((a, v) => a + (v ? v.length : 0), 0);
  check('13 のリポジトリのワークフロー（' + 本数 + ' 本）が、どれもその記録の八度目の節の表に行を持ち、外した二つは無く、引用は写した GitHub の規約と OpenAlex の文書の句にある',
    bad.length === 0, bad.slice(0, 6).join(' / '));
  const 替 = (r, a2, b2) => Object.assign({}, 実, { 記録: Object.assign({}, 実.記録, { [r]: (実.記録[r] || '').replace(a2, b2) }) });
  const 流れ替 = (r, v) => Object.assign({}, 実, { 流れ: Object.assign({}, 実.流れ, { [r]: v }) });
  const 規約替 = (k, v) => Object.assign({}, 実, { 規約: Object.assign({}, 実.規約, { [k]: Object.assign({}, 実.規約[k], v) }) });
  const 壊す = [
    ['self-correction に行の無いワークフローを足す', 流れ替('self-correction', (実.流れ['self-correction'] || []).concat(['newsletter.yml']))],
    ['nusquama に行の無いワークフローを足す', 流れ替('nusquama', (実.流れ.nusquama || []).concat(['newsletter.yml']))],
    ['sophaxis の表から行を外す', 替('sophaxis', /\n\| `\.github\/workflows\/pdf\.yml`[^\n]*/, '')],
    ['deposit-check の表から行を外す', 替('deposit-check', /\n\| `\.github\/workflows\/run\.yml`[^\n]*/, '')],
    ['索引の網羅調査を戻す', 流れ替('cpsbvbng26-dotcom', (実.流れ['cpsbvbng26-dotcom'] || []).concat(['index-survey.yml']).sort())],
    ['外した行から外したことを消す', 替('cpsbvbng26-dotcom', 'ワークフローと道具（`verification/watch_outside.js`）を外しました。', 'ワークフローと道具（`verification/watch_outside.js`）を残しました。')],
    ['errata-check の記録から八度目の節を外す', 替('errata-check', K ? K['節'] : 'x^', '## 八度目')],
    ['引用を一語変える', 替('trinity-operator', 'or publication of the software project', 'or promotion of the software project')],
    ['英語の引用を一語変える', 替('deposit-check', 'free to use in any way you like.” The page', 'free to use in any way at all.” The page')],
    ['規約の SHA-256 を変える', 規約替('GitHub の追加製品の規約 Actions', { '全文の sha256': '0'.repeat(64) })],
    ['決めた一文を外す', 替('trinity-infinity', /2026-11-13 に Claude が決めました/g, '決めました')],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  check('壊して確かめる：行の無いワークフロー（二つのリポジトリ）・表から外した行（二つ）・戻したワークフロー・外したと書かない行・節・引用の一語（日英）・規約の SHA-256・決めた一文のどれでも落ちる（'
    + 落ちた.length + ' / ' + 壊す.length + '）', 落ちた.length === 壊す.length, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / '));
}

/* ---------- 九度目の見落とし：削除した HAL の ID、OAI-PMH の口のアドレス、最初のコミットの日付（2026-11-12 の続き） ----------
 *
 * 一。**削除した HAL の ID は、doi-index.md の削除の表の行にだけ置く。**それまでの検査はリンクしか見ておらず、
 * 地の文の ID（cpsbvbng26-dotcom・solitary-school・justice-and-algorithms）を通していた。13 のリポジトリの
 * どのファイルも、表の行のほかに削除した ID を持たない。数字の並びで探すので、hal- を付けても、URL でも、数字だけでも拾う。
 * 二。**Sophaxis の OAI-PMH の口のアドレスは、運営者の ORCID の記録と同じで、sophaxis の二つのファイルにだけ書く。**
 * 頁は「収集者のための別のアドレス」と書いていた。13 のリポジトリのどのファイルも、宣言した二つの外にそのアドレスを持たない。
 * 知らせにはアドレスを出さない（ファイルの名だけを出す）。
 * 三。**最初のコミットの日付は、git の履歴が記す UTC の日付である。**七つの面は時刻の帯を書かずに
 * 「2026-10-30 と 2026-11-02」と書いていた。deposit-check の最初のコミットは日本時間では 2026-11-03 になる。
 * 面の日付が git の UTC の日付と合い、最初のコミットの日付を書く段が、その文か段のそれより前に UTC と書くこと。
 * 四。直したリポジトリの記録に九度目の節がそろうこと。 */
console.log('\n12p. 九度目の見落とし：削除した ID・口のアドレス・最初のコミットの日付（2026-11-12 の続き）');
{
  const K = DECL['九度目の見落とし'] || null;
  const 十三 = (DECL['八度目の見落とし'] || {})['記録'] || [];
  const 判定語 = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const 中身 = (repo) => {
    let files = [];
    try { files = execFileSync('git', ['ls-files', '-z'], { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean); } catch (e) { return null; }
    const out = {};
    for (const f of files) {
      if (/\.(pdf|png|jpe?g|gif|ico|webp|woff2?|zip|gz|xlsx?|docx?)$/i.test(f)) continue;
      const p = path.join(ROOT, repo, f);
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
      const b = fs.readFileSync(p);
      if (b.includes(0)) continue;
      out[f] = b.toString('utf8');
    }
    return out;
  };
  const 最初の日 = (repo) => {
    try {
      const dir = path.join(ROOT, repo);
      if (execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: dir, encoding: 'utf8' }).trim() === 'true') return '浅い複製';
      return execFileSync('git', ['log', '--reverse', '--format=%cd', '--date=format-local:%Y-%m-%d'],
        { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, { TZ: 'UTC' }) }).split('\n')[0].trim();
    } catch (e) { return ''; }
  };
  const 全部 = Object.fromEntries(十三.map((r) => [r, 中身(r)]));
  const di = (全部['cpsbvbng26-dotcom'] || {})['docs/doi-index.md'] || '';
  const 実 = {
    全部,
    git: Object.fromEntries(Object.keys((K || {})['最初のコミット'] || {}).map((r) => [r, 最初の日(r)])),
    site: (() => { try { return JSON.parse((全部.sophaxis || {})['site.json'] || '{}'); } catch (e) { return {}; } })(),
  };
  const 表を外す = (x) => x.split('\n').filter((l) => !/^\| `hal-\d+` \| /.test(l)).join('\n');
  const 文 = (x) => String(x).split(/\n|(?<=[.。])\s+|(?<=。)/);
  const 履歴 = /^(?:docs\/legal-audit-2026-11-12\.md|CHANGELOG\.md|verification\/|data\/policy-changes\.json|site\/policies\/changes\.xml)/;
  const 離す = /separate (?:e-?mail )?address|different (?:e-?mail )?address|made for (?:harvesters|this use)|address the operator made|(?:is|are) for harvesters|not the one for harvesters|収集者のため|別のアドレス|別の宛先/i;
  const 初語 = /最初のコミット|first commits?|ersten? Commits?|premiers? commits?|prim[oi] commit/i;
  const 一文 = {
    'index.html': /最初のコミットは、協定世界時（UTC）で (\d{4}-\d{2}-\d{2}) と (\d{4}-\d{2}-\d{2}) です。/,
    'README.md': /最初のコミットは、協定世界時（UTC）で (\d{4}-\d{2}-\d{2}) と (\d{4}-\d{2}-\d{2}) です。/,
    'index.en.html': /Their first commits are dated (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2}), in UTC\./,
    'README.en.md': /Their first commits are dated (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2}), in UTC\./,
    'index.de.html': /Ihre ersten Commits tragen die Daten (\d{4}-\d{2}-\d{2}) und (\d{4}-\d{2}-\d{2}), in UTC\./,
    'index.fr.html': /Leurs premiers commits datent du (\d{4}-\d{2}-\d{2}) et du (\d{4}-\d{2}-\d{2}), en UTC\./,
    'index.it.html': /I loro primi commit sono datati (\d{4}-\d{2}-\d{2}) e (\d{4}-\d{2}-\d{2}), in UTC\./,
  };
  const 覚え = new Map();
  function 判定(x) {
    const bad = [];
    if (K === null) return ['宣言が無い'];
    if (十三.length !== 13) bad.push('13 のリポジトリの一覧が読めない');
    for (const r of 十三) if (!x.全部[r]) bad.push(r + ' のファイルの一覧が読めない');
    /* 一。削除した ID。 */
    const idx = (x.全部['cpsbvbng26-dotcom'] || {})['docs/doi-index.md'] || '';
    const i = idx.indexOf('## 削除した所在');
    const j = idx.indexOf('\n## ', i + 1);
    const 節 = i >= 0 ? idx.slice(i, j < 0 ? idx.length : j) : '';
    const 消した = [...節.matchAll(/^\| `hal-(\d+)` \|/gm)].map((m) => m[1]);
    if (消した.length < 9) bad.push('削除の表が読めない（' + 消した.length + ' 件）');
    /* 二。口のアドレス。 */
    const mails = ((x.site || {}).oai || {}).adminEmails || [];
    if (mails.length !== 1) bad.push('sophaxis の site.json の口のアドレスが ' + mails.length + ' 件');
    /* 一と二を、ファイルごとに一度だけ読む。壊して確かめるときは、替えたファイルだけを読み直す。 */
    const 鍵 = 消した.join(',') + '|' + mails.join(',');
    for (const [r, fs_] of Object.entries(x.全部)) {
      for (const [f, t] of Object.entries(fs_ || {})) {
        const k = r + '/' + f;
        let v = 覚え.get(k);
        if (!v || v.t !== t || v.鍵 !== 鍵) {
          const y = r === 'cpsbvbng26-dotcom' && f === 'docs/doi-index.md' ? 表を外す(t) : t;
          v = { t, 鍵, ids: 消した.filter((n) => y.includes(n) && new RegExp('(?<!\\d)' + n + '(?!\\d)').test(y)),
                mail: mails.some((e) => t.includes(e)),
                apart: !履歴.test(f) && t.includes('OAI') && 離す.test(t) && 文(t).some((s) => /OAI/.test(s) && 離す.test(s)) };
          覚え.set(k, v);
        }
        for (const n of v.ids) bad.push(k + ' に削除した hal-' + n);
        if (v.mail && !(r === 'sophaxis' && K['アドレスの置き場'].includes(f))) bad.push(k + ' が口のアドレスを持つ');
        if (v.apart) bad.push(k + ' が口のアドレスを別のものと書く');
      }
    }
    for (const f of K['アドレスの置き場']) if (!mails.every((e) => String(((x.全部.sophaxis || {})[f]) || '').includes(e))) bad.push('sophaxis/' + f + ' に口のアドレスが無い');
    /* 三。最初のコミットの日付。 */
    const 宣言 = K['最初のコミット'];
    for (const [r, d] of Object.entries(宣言)) if (x.git[r] !== d) bad.push(r + ' の最初のコミット（UTC）が ' + (x.git[r] || '取れない') + '、宣言は ' + d);
    const 面 = x.全部['cpsbvbng26-dotcom'] || {};
    for (const f of K['面']) {
      const t = String(面[f] || '');
      const m = 一文[f] ? 一文[f].exec(t) : null;
      if (!m || m[1] !== 宣言.sophaxis || m[2] !== 宣言['deposit-check']) bad.push(f + ' の一文が UTC で git の日付を書いていない');
      /* 段（HTML は </p>、Markdown は空行）ごとに、最初のコミットの日付の文か、段のそれより前に UTC がある。 */
      const 段 = /\.html$/.test(f) ? t.split(/<\/p>/) : t.split(/\n\s*\n/);
      段.forEach((p, k) => {
        if (/^\s*\|/.test(p)) return;
        const mm = 初語.exec(p);
        if (!mm) return;
        const d = /\d{4}-\d{2}-\d{2}/.exec(p.slice(mm.index));
        if (!d) return;
        const at = mm.index + d.index;
        const end = p.slice(at).search(/[。.](?:\s|<|$)/);
        const s = p.slice(Math.max(p.lastIndexOf('。', at), p.lastIndexOf('. ', at)) + 1, end < 0 ? p.length : at + end + 1);
        if (p.slice(0, at).indexOf('UTC') < 0 && s.indexOf('UTC') < 0) bad.push(f + ' の ' + (k + 1) + ' 段目が UTC と書かずに最初のコミットの日付を書く');
      });
    }
    /* 四。記録。 */
    for (const r of K['記録']) {
      const t = (x.全部[r] || {})['docs/legal-audit-2026-11-12.md'];
      if (!t) { bad.push(r + ' の記録が無い'); continue; }
      const a = t.indexOf('\n' + K['節'] + '\n');
      const b = a < 0 ? -1 : t.indexOf('\n## ', a + 1);
      const sec = a < 0 ? '' : t.slice(a, b < 0 ? t.length : b);
      if (!sec) { bad.push(r + ' に九度目の節が無い'); continue; }
      if (!sec.includes('| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |')) bad.push(r + ' の表の列');
      const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|---)/.test(l)).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
      if (!rows.length || !rows.every((c) => c.length === 6 && 判定語.includes(c[4]))) bad.push(r + ' の表の形');
      const 数 = 'この表の判定は、' + 判定語.filter((w) => rows.some((c) => c[4] === w)).map((w) => w + ' ' + rows.filter((c) => c[4] === w).length).join('、') + ' です。';
      if (!sec.includes(数)) bad.push(r + ' の判定の数');
      for (const c of rows.filter((c2) => c2[4] !== '問題なし')) if (!c[5].includes(K['決めた']) || !/ためです$/.test(c[5])) bad.push(r + '：決めた一文か理由が無い行 ' + c[0].slice(0, 20));
      if (!K['弁護士'].some((w) => sec.includes(w))) bad.push(r + ' に弁護士の一文が無い');
      if (/[^\s@<>"`]+@[^\s@<>"`]+\.[a-z]{2,}/i.test(sec)) bad.push(r + ' の九度目の節がアドレスを書く');
    }
    return bad;
  }
  const bad = 判定(実);
  const 数 = Object.values(実.全部).reduce((a, v) => a + (v ? Object.keys(v).length : 0), 0);
  check('13 のリポジトリ（' + 数 + ' ファイル）に、削除した HAL の ID が表の外に無く、Sophaxis の口のアドレスが二つのファイルの外に無く、最初のコミットの日付が git の UTC の日付と合って七つの面が UTC と書き、九度目の節が五つの記録にそろう',
    bad.length === 0, bad.slice(0, 6).join(' / '));
  const mail = ((実.site || {}).oai || {}).adminEmails || ['x'];
  const 一つ = ([...di.matchAll(/^\| `hal-(\d+)` \|/gm)][0] || [])[1] || '0';
  const 替 = (r, f, a2, b2) => Object.assign({}, 実, { 全部: Object.assign({}, 実.全部, { [r]: Object.assign({}, 実.全部[r], { [f]: String((実.全部[r] || {})[f] || '').replace(a2, b2) }) }) });
  const 壊す = [
    ['solitary-school の README に削除した ID を書く', 替('solitary-school', 'README.md', /$/, '\nHAL（`hal-' + 一つ + '`）\n')],
    ['justice-and-algorithms に数字だけを書く', 替('justice-and-algorithms', 'README.md', /$/, '\nHAL ' + 一つ + '\n')],
    ['nusquama に削除した ID の URL を書く', 替('nusquama', 'README.md', /$/, '\nhttps://hal.science/hal-' + 一つ + 'v1\n')],
    ['doi-index.md の表の外に書く', 替('cpsbvbng26-dotcom', 'docs/doi-index.md', '## 削除した所在', '## 削除した所在\n\nいちばん古いのは hal-' + 一つ + ' です。')],
    ['submission-disclosure.md に戻す', 替('cpsbvbng26-dotcom', 'docs/submission-disclosure.md', 'HAL には、取り消した PDF の投稿とは別に、同じ篇の書誌の登録がありました。', 'HAL の書誌の登録 `hal-' + 一つ + '` は、取り消した PDF の投稿とは別のものです。')],
    ['口のアドレスを sophaxis のほかのファイルに書く', 替('sophaxis', 'docs/operations.md', /$/, '\n' + mail[0] + '\n')],
    ['口のアドレスを別のリポジトリに書く', 替('deposit-check', 'README.md', /$/, '\n' + mail[0] + '\n')],
    ['口のアドレスを別のものと書く', 替('sophaxis', 'contact.md', 'gives the same address, because', 'gives a separate address made for harvesters, because')],
    ['日本時間の日付にする', 替('cpsbvbng26-dotcom', 'index.html', 'と 2026-11-02 です。', 'と 2026-11-03 です。')],
    ['README から UTC を外す', 替('cpsbvbng26-dotcom', 'README.md', '最初のコミットは、協定世界時（UTC）で 2026-10-30', '最初のコミットは 2026-10-30')],
    ['英語の JOSS の段から UTC の一文を外す', 替('cpsbvbng26-dotcom', 'index.en.html', 'Every date in this paragraph is a date in UTC. ', '')],
    ['イタリア語の一文から UTC を外す', 替('cpsbvbng26-dotcom', 'index.it.html', '2026-11-02, in UTC.', '2026-11-02.')],
    ['git の最初のコミットがずれる', Object.assign({}, 実, { git: Object.assign({}, 実.git, { 'deposit-check': '2026-11-03' }) })],
    ['記録から九度目の節を外す', 替('solitary-school', 'docs/legal-audit-2026-11-12.md', K ? K['節'] : 'x^', '## 九度目')],
    ['記録の判定の数を変える', 替('cpsbvbng26-dotcom', 'docs/legal-audit-2026-11-12.md', 'この表の判定は、漏れ 3、表現 2 です。', 'この表の判定は、漏れ 2、表現 2 です。')],
    ['決めた一文を外す', 替('justice-and-algorithms', 'docs/legal-audit-2026-11-12.md', /2026-11-13 に Claude が決めました。/g, '')],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  const 漏れ出た = 壊す.some(([, y]) => mail.some((e) => 判定(y).join(' ').includes(e)));
  check('壊して確かめる：削除した ID（三つのリポジトリ、表の外、元の一文）・口のアドレス（ほかのファイル、別のリポジトリ、別のものと書く）・日本時間の日付・UTC を外す（README、英語の段、イタリア語）・git の日付・記録の節・判定の数・決めた一文のどれでも落ち、知らせにアドレスが出ない（'
    + 落ちた.length + ' / ' + 壊す.length + '）', 落ちた.length === 壊す.length && !漏れ出た, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / ') + (漏れ出た ? ' / アドレスが知らせに出た' : ''));
}

/* ---------- 十度目の見落とし：引用情報の振る舞い、PhilArchive の三篇、OSF の説明の欄（2026-11-12 の続き） ----------
 *
 * 一。**引用情報は、消えた頁の振る舞いを書かない。**cpsbvbng26-dotcom の CITATION.cff と .zenodo.json は、
 * 2026-09-07 に消した DOI の照会の頁を例外に挙げたまま、外へ要求を出さないと書いていた。README と頁の検査は
 * 引用情報を読んでいなかった。13 のリポジトリのどのファイルも（記録とこの検査のほか）、その例外を書かない。
 * 二つのファイルは、どの頁も外へ要求を出さず connect-src が 'none' だと書き、pages.json のどの頁でもそれが本当であること。
 * deposit-check の .zenodo.json と package.json が名乗る API は、12l が fetch.js と突き合わせる。ここでは壊して確かめる。
 * 二。license の欄を語る文と欄の値は、12l が見る。
 * 三。**PhilArchive の三篇は、記録にある事実だけを、五言語で同じに書く。**頁は「三篇とも載っています」と
 * 現在形で書き、同じ頁の所在の欄は一篇の削除を 2026-09-26 に依頼したと書いていた。いまの状態は、作業環境から
 * 確かめていない。五つの設定と五つの頁と README（日英）が、載ったこと・削除の依頼・確かめていないことを書き、
 * 現在形で三篇とも載っているとは書かない。
 * 四。**OSF のプロジェクトの説明の欄の、各リポジトリを部品とする文を、どのリポジトリにも置かない。**欄は作業環境から
 * 触れない。記録は DataCite が返した文を、所在と SHA-256 とともに引く。
 * 五。直したリポジトリの記録に十度目の節がそろうこと。 */
console.log('\n12q. 十度目の見落とし：引用情報の振る舞い・PhilArchive の三篇・OSF の説明の欄（2026-11-12 の続き）');
{
  const K = DECL['十度目の見落とし'] || null;
  const 十三 = (DECL['八度目の見落とし'] || {})['記録'] || [];
  const 判定語 = { ja: ['誤り', '根拠不足', '漏れ', '表現', '問題なし'], en: ['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'] };
  const 中身 = (repo) => {
    let files = [];
    try { files = execFileSync('git', ['ls-files', '-z'], { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 1 << 28 }).split('\0').filter(Boolean); } catch (e) { return null; }
    const out = {};
    for (const f of files) {
      if (/\.(pdf|png|jpe?g|gif|ico|webp|woff2?|zip|gz|xlsx?|docx?)$/i.test(f)) continue;
      const p = path.join(ROOT, repo, f);
      if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
      const b = fs.readFileSync(p);
      if (b.includes(0)) continue;
      out[f] = b.toString('utf8');
    }
    return out;
  };
  const 実 = { 全部: Object.fromEntries(十三.map((r) => [r, 中身(r)])) };
  let pages = [];
  try { pages = JSON.parse((実.全部['cpsbvbng26-dotcom'] || {})['verification/pages.json'] || '{}').pages.map((p) => p.file); } catch (e) { pages = []; }
  function 判定(x) {
    const bad = [];
    if (K === null) return ['宣言が無い'];
    if (十三.length !== 13) bad.push('13 のリポジトリの一覧が読めない');
    for (const r of 十三) if (!x.全部[r]) bad.push(r + ' のファイルの一覧が読めない');
    const 見ない = new RegExp(K['見ないファイル']);
    const 古い = new RegExp(K['要求']['古い例外'], 'i');
    const 引用情報 = new RegExp(K['要求']['引用情報']);
    let 引用数 = 0;
    for (const [r, fs_] of Object.entries(x.全部)) {
      for (const [f, t] of Object.entries(fs_ || {})) {
        if (引用情報.test(f)) 引用数++;
        if (見ない.test(f)) continue;
        /* 一。消えた頁を例外に挙げる文。 */
        if (古い.test(t)) bad.push(r + '/' + f + ' が消えた照会の頁を例外に挙げる');
        /* 四。OSF の説明の欄の文。 */
        for (const s of K['OSF']['書かない']) if (t.includes(s)) bad.push(r + '/' + f + ' が OSF の説明の欄の、部品の文を持つ');
      }
    }
    if (引用数 < 25) bad.push('引用情報のファイルが ' + 引用数 + ' 本しか読めない');
    /* 一。二つのファイルの文と、それが本当であること。 */
    const 面 = x.全部['cpsbvbng26-dotcom'] || {};
    for (const [f, xs] of Object.entries(K['要求']['文'])) for (const s of xs) if (!String(面[f] || '').includes(s)) bad.push('cpsbvbng26-dotcom/' + f + ' に「' + s.slice(0, 20) + '」が無い');
    if (pages.length < 30) bad.push('pages.json の頁が ' + pages.length + ' 本しか読めない');
    for (const p of pages) {
      const h = String(面[p] || '');
      const csp = (/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(h) || [])[1] || '';
      if (!/(?:^|;\s*)connect-src 'none'(?:;|$)/.test(csp)) bad.push(p + ' の CSP の connect-src が \'none\' でない');
    }
    /* 三。PhilArchive の三篇。 */
    const PA = K['PhilArchive'];
    for (const [rf, lang] of Object.entries(PA['面'])) {
      const [r, ...rest] = rf.split('/');
      const t = String((x.全部[r] || {})[rest.join('/')] || '');
      if (!t) { bad.push(rf + ' が無い'); continue; }
      for (const s of PA['書く'][lang]) if (!t.includes(s)) bad.push(rf + ' に「' + s.slice(0, 24) + '」が無い');
      if (!/README/.test(rf) && !t.includes(PA['所在の欄'][lang].replace(/"/g, '\\"')) && !t.includes(PA['所在の欄'][lang])) bad.push(rf + ' の所在の欄に削除の依頼が無い');
      for (const s of PA['書かない']) if (t.includes(s)) bad.push(rf + ' が「' + s + '」と書く');
    }
    for (const [r, fl] of Object.entries(PA['記録の面'])) for (const f of fl) {
      const t = String((x.全部[r] || {})[f] || '');
      for (const s of PA['書かない']) if (t.includes(s)) bad.push(r + '/' + f + ' が「' + s + '」と書く');
      if (/PhilArchive に載っています/.test(t)) bad.push(r + '/' + f + ' が PhilArchive に載っていると現在形で書く');
    }
    /* 五。記録。 */
    for (const r of K['記録']) {
      const t = (x.全部[r] || {})['docs/legal-audit-2026-11-12.md'];
      if (!t) { bad.push(r + ' の記録が無い'); continue; }
      const a = t.indexOf('\n' + K['節'] + '\n');
      const b = a < 0 ? -1 : t.indexOf('\n## ', a + 1);
      const sec = a < 0 ? '' : t.slice(a, b < 0 ? t.length : b);
      if (!sec) { bad.push(r + ' に十度目の節が無い'); continue; }
      const lang = sec.includes('| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |') ? 'ja' : sec.includes('| Place | Law and article | Requirements | Facts | Finding | Action |') ? 'en' : null;
      if (!lang) { bad.push(r + ' の表の列'); continue; }
      const rows = sec.split('\n').filter((l) => /^\| /.test(l) && !/^\| (箇所|Place|---)/.test(l)).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
      if (!rows.length || !rows.every((c) => c.length === 6 && 判定語[lang].includes(c[4]))) bad.push(r + ' の表の形');
      const 内訳 = 判定語[lang].filter((w) => rows.some((c) => c[4] === w)).map((w) => w + ' ' + rows.filter((c) => c[4] === w).length).join(lang === 'ja' ? '、' : ', ');
      if (!sec.includes(lang === 'ja' ? 'この表の判定は、' + 内訳 + ' です。' : 'Findings in this table: ' + 内訳 + '.')) bad.push(r + ' の判定の数');
      for (const c of rows.filter((c2) => c2[4] !== 判定語[lang][4])) {
        if (!c[5].includes(K['決めた'])) bad.push(r + '：決めた一文が無い行 ' + c[0].slice(0, 20));
        else if (lang === 'ja' && !/ためです。?$/.test(c[5])) bad.push(r + '：理由が無い行 ' + c[0].slice(0, 20));
      }
      if (!K['弁護士'].some((w) => sec.includes(w))) bad.push(r + ' に弁護士の一文が無い');
      if (r === 'cpsbvbng26-dotcom') for (const s of K['OSF']['記録に書くこと']) if (!sec.includes(s)) bad.push(r + ' の十度目の節に「' + s.slice(0, 30) + '」が無い');
    }
    return bad;
  }
  const bad = 判定(実);
  const 数 = Object.values(実.全部).reduce((a, v) => a + (v ? Object.keys(v).length : 0), 0);
  check('13 のリポジトリ（' + 数 + ' ファイル）が消えた照会の頁を例外に挙げず、cpsbvbng26-dotcom の引用情報が書くとおり ' + pages.length + ' 頁の connect-src が \'none\' で、PhilArchive の三篇を五言語の設定・頁・README が記録のとおりに書き、OSF の部品の文がどこにも無く、十度目の節が三つの記録にそろう',
    bad.length === 0, bad.slice(0, 6).join(' / '));
  const 替 = (r, f, a2, b2) => Object.assign({}, 実, { 全部: Object.assign({}, 実.全部, { [r]: Object.assign({}, 実.全部[r], { [f]: String((実.全部[r] || {})[f] || '').replace(a2, b2) }) }) });
  const 壊す = [
    ['CITATION.cff に照会の例外を戻す', 替('cpsbvbng26-dotcom', 'CITATION.cff', 'サイトのどの頁も、外部へリクエストを出さない。', '外部へのリクエストは、利用者が照会を押したときの DOI 問い合わせを除いて出さない。')],
    ['.zenodo.json に照会の例外を戻す', 替('cpsbvbng26-dotcom', '.zenodo.json', 'サイトのどの頁も、外部へリクエストを出しません。', '外部へのリクエストは、利用者が照会を押したときの DOI 問い合わせを除いて出しません。')],
    ['ほかのリポジトリの package.json に英語の例外を書く', 替('deposit-check', 'package.json', '"license": "MIT"', '"license": "MIT", "note": "No requests except the DOI lookup"')],
    ['一つの頁の connect-src を開く', 替('cpsbvbng26-dotcom', pages[0] || 'index.html', "connect-src 'none'", "connect-src 'self'")],
    ['日本語の設定を現在形に戻す', 替('researcher-profile', 'site.json', 'PhilArchive には三篇とも載りました。', 'PhilArchive には三篇とも載っています。')],
    ['英語の頁から確かめていない一文を外す', 替('cpsbvbng26-dotcom', 'index.en.html', ' Whether it is still on PhilArchive has not been checked from here.', '')],
    ['ドイツ語の頁を「置いたまま」に戻す', 替('cpsbvbng26-dotcom', 'index.de.html', ': Für eine Einreichung bei einer Zeitschrift wird keiner von Zenodo, SSRN oder PhilArchive genommen.', ', auf Zenodo, PhilArchive und SSRN.')],
    ['フランス語の設定から削除の依頼を外す', 替('researcher-profile', 'site.fr.json', ' La suppression du troisième a été demandée le 2026-09-26.', '')],
    ['イタリア語の頁の所在の欄から削除の依頼を外す', 替('cpsbvbng26-dotcom', 'index.it.html', ' (cancellazione richiesta il 2026-09-26)', '')],
    ['README を現在形に戻す', 替('cpsbvbng26-dotcom', 'README.md', 'PhilArchive には三篇とも載りました。', 'PhilArchive には三篇とも載っています。')],
    ['joss.md を「置いたまま」に戻す', 替('cpsbvbng26-dotcom', 'docs/joss.md', '査読誌に出すために、Zenodo・SSRN・PhilArchive から下ろすことはしません。', 'Zenodo と PhilArchive と SSRN に置いたままにします。')],
    ['OSF の部品の文を osf.md に書く', 替('cpsbvbng26-dotcom', 'docs/osf.md', /$/, '\nEach repository is a component and links to its GitHub repository.\n')],
    ['OSF の部品の和文をほかのリポジトリに書く', 替('trinity-operator', 'README.md', /$/, '\n各リポジトリは部品として置き、GitHub につないでいます。\n')],
    ['記録から DataCite の SHA-256 を外す', 替('cpsbvbng26-dotcom', 'docs/legal-audit-2026-11-12.md', 'df234f07e9e8090fc56d9ac4c6c1ed96af2376da36dee5611e7ed20a6d010662', '0'.repeat(64))],
    ['記録から十度目の節を外す', 替('deposit-check', 'docs/legal-audit-2026-11-12.md', K ? K['節'] : 'x^', '## 十度目')],
    ['英語の記録の判定の数を変える', 替('deposit-check', 'docs/legal-audit-2026-11-12.md', /Findings in this table: ([^\n]*?)(\d+)\.\n(?![\s\S]*Findings in this table:)/, (m, a, n) => 'Findings in this table: ' + a + (Number(n) + 1) + '.\n')],
    ['決めた一文を外す', 替('researcher-profile', 'docs/legal-audit-2026-11-12.md', /2026-11-13 に Claude が決めました。(?![\s\S]*## 2026-11-12 の続き：九度目)/g, '')],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  check('壊して確かめる：照会の例外（CITATION.cff、.zenodo.json、ほかのリポジトリの英語）・頁の connect-src・PhilArchive（日英独仏伊の設定と頁、所在の欄、README、joss.md）・OSF の部品の文（日英、二つのリポジトリ）・記録の SHA-256・節・英語の判定の数・決めた一文のどれでも落ちる（'
    + 落ちた.length + ' / ' + 壊す.length + '）', 落ちた.length === 壊す.length, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / '));

  /* deposit-check の引用情報が名乗る API は 12l が見る。12l の式で、OpenAlex を落とすと名乗りがずれることを確かめる。 */
  const A = (DECL['四度目の見落とし'] || {})['API の名'] || { 面: [] };
  const 名乗り = (t, s) => { const m = new RegExp(s['式']).exec(t); return m ? m[1].split(/・|、|, | and | と /).map((v) => v.trim()).filter(Boolean).sort() : null; };
  const zs = A['面'].find((s) => s.repo === 'deposit-check' && s.file === '.zenodo.json');
  const ps = A['面'].find((s) => s.repo === 'deposit-check' && s.file === 'package.json');
  const zt = String((実.全部['deposit-check'] || {})['.zenodo.json'] || '');
  const pt = String((実.全部['deposit-check'] || {})['package.json'] || '');
  const 五 = ['Crossref', 'DataCite', 'JaLC', 'OpenAlex', 'ORCID'].sort();
  check('壊して確かめる：deposit-check の .zenodo.json と package.json の名乗りから OpenAlex を外すと、12l の式が四つしか読まず、ずれる',
    zs && ps && JSON.stringify(名乗り(zt, zs)) === JSON.stringify(五) && JSON.stringify(名乗り(pt, ps)) === JSON.stringify(五)
    && JSON.stringify(名乗り(zt.replace('JaLC and OpenAlex', 'and JaLC'), zs)) !== JSON.stringify(五)
    && JSON.stringify(名乗り(pt.replace('JaLC and OpenAlex', 'and JaLC'), ps)) !== JSON.stringify(五));
}

/* ---------- 種類と状態の札、CITATION.cff の type、目録 ----------
 *
 * 各リポジトリの README の H1 のすぐ下に「種類」と「状態」の札を置いた（2026-11-11）。
 * 札は目録（researcher-profile の catalog.json）と同じ区別で書く。食い違えば落とす。
 * CITATION.cff の type は、道具が software、それ以外が dataset。 */

console.log('\n12e. 種類と状態の札、CITATION.cff の type、目録');

{
  const K = DECL['種類と状態'];
  const fill = (t, o) => t.replace(/\{([^}]+)\}/g, (_, k) => o[k]);
  const 札 = (text) => {
    if (text === null) return null;
    const lines = text.split('\n');
    const i = lines.findIndex((l) => /^# /.test(l));
    if (i < 0) return null;
    const j = lines.findIndex((l, k) => k > i && l.trim() !== '');
    return j < 0 ? null : lines[j];
  };
  const 札ずれ = [], 英ずれ = [], 型ずれ = [];
  for (const repo of C.repos) {
    const e = K.repos[repo];
    if (!e) { 札ずれ.push(repo + '：表に無い'); continue; }
    const ja = 札(read(repo, 'README.md'));
    if (ja !== fill(K['札'], e)) 札ずれ.push(repo + '：' + (ja === null ? '無い' : ja.slice(0, 30)));
    const enText = read(repo, 'README.en.md');
    if (enText !== null) {
      const en = 札(enText);
      if (en !== fill(K['札 英'], e)) 英ずれ.push(repo + '：' + (en === null ? '無い' : en.slice(0, 30)));
    }
    const cff = read(repo, 'CITATION.cff');
    const m = cff === null ? null : /^type:\s*"?([a-z-]+)"?\s*$/m.exec(cff);
    if (!m || m[1] !== e.cff) 型ずれ.push(repo + '：' + (m ? m[1] : '無い') + ' / ' + e.cff);
  }
  check('10 リポジトリの README.md の H1 のすぐ下に、種類と状態の札が表のとおりにある', 札ずれ.length === 0,
    札ずれ.join(', ') || C.repos.length + ' 本');
  check('README.en.md のあるリポジトリは、英語の札も表のとおりに置いている', 英ずれ.length === 0,
    英ずれ.join(', ') || C.repos.filter((r) => read(r, 'README.en.md') !== null).length + ' 本');
  check('10 リポジトリの CITATION.cff の type が、道具は software、ほかは dataset である', 型ずれ.length === 0,
    型ずれ.join(', ') || C.repos.length + ' 本');

  /* 目録。リポジトリそのものを表す行の状態が、札と同じであること。 */
  let cat = null;
  try { cat = JSON.parse(read('researcher-profile', 'catalog.json')); } catch (e) { cat = null; }
  check('researcher-profile に目録の設定（catalog.json）がある', cat !== null && Array.isArray(cat.works));
  if (cat !== null) {
    const 状態 = { '凍結': 'frozen', '改訂中': 'revising', '保守のみ': 'maintenance', '運営中': 'running' };
    const 行ずれ = cat.works.filter((w) => w.kind === 'repository' && K.repos[w.repo]
      && 状態[K.repos[w.repo]['状態']] !== w.status).map((w) => w.id + ' ' + w.status);
    check('目録のリポジトリの行の状態が、README の札の状態と同じ', 行ずれ.length === 0, 行ずれ.join(', '));

    /* ライセンスの列の出所。LICENSE の置き方が、表と実物で同じこと。 */
    const lay = cat.licenceLayout;
    const 置きずれ = [];
    for (const repo of lay.mit.concat(lay.split)) {
      const lic = read(repo, 'LICENSE');
      if (lic === null) continue;   /* 十の外で、複製していないもの */
      const code = read(repo, 'LICENSE-CODE');
      const mit = /^MIT License/.test(lic) && code === null;
      const split = /^Creative Commons Attribution 4\.0 International/.test(lic) && code !== null && /^MIT License/.test(code);
      if (lay.mit.includes(repo) ? !mit : !split) 置きずれ.push(repo);
    }
    check('目録のライセンスの列の出所（licenceLayout）が、各リポジトリの LICENSE の置き方と同じ', 置きずれ.length === 0
      && C.repos.every((r) => lay.mit.includes(r) || lay.split.includes(r)), 置きずれ.join(', '));

    /* 2026-11-12 の法令の点検。目録は trinity-operator を「MIT（全体）」と書いていたが、lessons/・games/・site/ は
     * CC BY 4.0 である。目録の例外の表（licenceLayout.exceptions）が、免責事項の表（中の LICENSE と頁の表示）と
     * 同じで、目録の頁がその例外を出していることを見る。 */
    const LCx = DECL['免責']['ライセンス'];
    const 免責の例外 = {};
    [LCx['中の LICENSE で CC BY 4.0'], LCx['頁の表示で CC BY 4.0']].forEach((m) => Object.entries(m).forEach(([r, ds]) => {
      免責の例外[r] = (免責の例外[r] || []).concat(ds);
    }));
    const 目録の例外 = Object.fromEntries(Object.entries(lay.exceptions || {}).filter(([k]) => k !== '_'));
    const 例外ずれ = Object.keys(Object.assign({}, 免責の例外, 目録の例外)).filter((r) =>
      JSON.stringify((免責の例外[r] || []).slice().sort()) !== JSON.stringify((目録の例外[r] || []).slice().sort()));
    const 頁ずれ = Object.entries(目録の例外).filter(([r, ds]) => {
      const row = (new RegExp('<tr id="' + r + '">[\\s\\S]*?</tr>').exec(read('cpsbvbng26-dotcom', 'catalog.html') || '') || [''])[0];
      return !ds.every((d) => row.indexOf(d + '/') >= 0) || row.indexOf('CC BY 4.0') < 0;
    }).map(([r]) => r);
    check('目録のライセンスの例外が、免責事項の表と同じで、目録の頁に出ている（' + Object.keys(目録の例外).join(', ') + '）',
      例外ずれ.length === 0 && 頁ずれ.length === 0, 例外ずれ.concat(頁ずれ).join(', '));

    /* 始めた時期の列の出所。最初のコミットの日付が、git の履歴と同じこと。
     * 浅い複製では最初のコミットが取れないので、落とす（取れないことを通ったことにしない）。 */
    const 日ずれ = [];
    let 見た = 0;
    for (const [repo, date] of Object.entries(cat.years.firstCommit)) {
      const dir = path.join(ROOT, repo);
      if (!fs.existsSync(path.join(dir, '.git'))) { if (C.repos.includes(repo)) 日ずれ.push(repo + '：無い'); continue; }
      let first = null;
      try {
        if (execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: dir, encoding: 'utf8' }).trim() === 'true') {
          日ずれ.push(repo + '：浅い複製'); continue;
        }
        first = execFileSync('git', ['log', '--reverse', '--format=%ad', '--date=short'], { cwd: dir, encoding: 'utf8' }).split('\n')[0];
      } catch (e) { first = null; }
      見た++;
      if (first !== date) 日ずれ.push(repo + '：' + first + ' / ' + date);
    }
    check('目録の始めた時期の出所（最初のコミットの日付）が、各リポジトリの git の履歴と同じ', 日ずれ.length === 0,
      日ずれ.join(', ') || 見た + ' 本');
    const 二年 = ['sophaxis', 'deposit-check'].filter((r) => !(cat.years.firstCommit[r] >= cat.years.secondYearFrom));
    check('Sophaxis と deposit-check を、目録で学部二年次に始めたものとしている', 二年.length === 0, 二年.join(', '));

    /* DOI は doi-index に載っている番号だけを書く。 */
    const idx = read('cpsbvbng26-dotcom', 'docs/doi-index.md') || '';
    const 無い = [];
    cat.works.forEach((w) => [w.doi, w.conceptDoi].concat(w.otherDois || []).filter(Boolean)
      .forEach((d) => { if (idx.indexOf(d) < 0) 無い.push(d); }));
    check('目録の DOI が、すべて docs/doi-index.md に載っている', 無い.length === 0, 無い.join(', '));
  }
}

/* ---------- 百本ノック四：リポジトリをまたぐ決まり ----------
 *
 * 2026-11-11。安全の窓口・誤りの知らせの様式・キーワード・CI の権限と固定・依存・秘密情報・
 * サイトの CSP と正の URL・言語モデルの使い方の表・正誤表の番号・検査の本数。
 * どれも「一つのリポジトリの中では見えない」ずれである。 */

console.log('\n13. リポジトリをまたぐ決まり（安全・様式・語彙・CI・依存・秘密・サイト・開示）');

{
  const C = DECL['共通の決めごと'];
  const HOME = 'cpsbvbng26-dotcom';
  const present = (r) => fs.existsSync(path.join(ROOT, r));

  /* 317・345。**同じ文を、一字一句同じに置く。**一つだけ直すと落ちる。直すときは全部直す。 */
  for (const [f, label] of [['SECURITY.md', '安全の問題の知らせ方（SECURITY.md）'],
                            [path.join('.github', 'ISSUE_TEMPLATE', 'error-report.yml'), '誤りの知らせの様式（error-report.yml）']]) {
    const want = read(HOME, f);
    const ずれ = C.repos.filter((r) => read(r, f) !== want);
    check(label + 'が、10 リポジトリで一字一句同じ', want !== null && ずれ.length === 0, ずれ.join(', '));
  }

  /* 340。**同じ主題には同じ語を。**語彙は docs/keywords.json 一つ。言い換えの組は avoid が止める。 */
  {
    const V = JSON.parse(read(HOME, path.join('docs', 'keywords.json')));
    const ok = new Set(V.terms.flatMap((x) => [x.en].concat(x.ja ? [x.ja] : [])));
    const bad = [];
    const repos = C.repos.concat(['sophaxis', 'deposit-check'].filter(present));
    for (const r of repos) {
      let z = [];
      try { z = JSON.parse(read(r, '.zenodo.json') || '{}').keywords || []; } catch (e) { bad.push(r + ' の .zenodo.json が読めない'); }
      const cff = read(r, 'CITATION.cff') || '';
      const m = /^keywords:\n((?:[ \t]+- .*\n?)+)/m.exec(cff);
      const c = m ? m[1].split('\n').filter(Boolean).map((l) => l.trim().slice(2).trim().replace(/^["']|["']$/g, '')) : [];
      z.concat(c).forEach((k) => {
        if (V.avoid[k]) bad.push(r + '「' + k + '」→「' + V.avoid[k] + '」');
        else if (!ok.has(k)) bad.push(r + '「' + k + '」が語彙に無い');
      });
      c.filter((k) => !z.includes(k)).forEach((k) => bad.push(r + ' の CITATION.cff だけにある「' + k + '」'));
    }
    check('キーワードが語彙（docs/keywords.json、' + V.terms.length + ' 語）の内にあり、言い換えを使わない（' + repos.length + ' 本）',
      bad.length === 0, [...new Set(bad)].slice(0, 8).join(' / '));
  }

  /* 314・315・313。**CI は読むだけを既定にし、外のアクションはコミットの値で固定する。**
   * 依存は足さない。入れてよいのは、検査が実際に使う五つだけ。 */
  {
    const 権限 = [], 固定 = [], 依存 = [];
    const ALLOWED = new Set(['pypdf', 'numpy', 'playwright', 'build', 'twine']);
    for (const r of C.repos) {
      const dir = path.join(ROOT, r, '.github', 'workflows');
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
        const y = fs.readFileSync(path.join(dir, f), 'utf8');
        if (!/^permissions:/m.test(y)) 権限.push(r + '/' + f);
        for (const m of y.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)) {
          if (m[1].startsWith('./')) continue;
          if (!/@[0-9a-f]{40}$/.test(m[1]) || !/^\s+#\s*\S+/.test(m[2])) 固定.push(r + '/' + f + ' ' + m[1]);
        }
        const code = y.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
        for (const m of code.matchAll(/(?:pip|npm) (?:install|i)\s+([^\n]+)/g)) {
          m[1].split(/\s+/).filter((w) => w && !w.startsWith('-') && w !== 'requirements.txt' && !/^\$/.test(w))
            .map((w) => w.replace(/[@=<>].*$/, '')).filter((w) => !ALLOWED.has(w)).forEach((w) => 依存.push(r + '/' + f + ' ' + w));
        }
      }
      const req = read(r, 'requirements.txt');
      if (req !== null) req.split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
        .map((l) => l.replace(/[<>=!~\s].*$/, '')).filter((n) => !['numpy', 'pypdf'].includes(n)).forEach((n) => 依存.push(r + '/requirements.txt ' + n));
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        if (['.git', 'node_modules', 'site', 'dist'].includes(e.name)) return;
        const p2 = path.join(d, e.name);
        if (e.isDirectory()) return walk(p2);
        if (e.name === 'package.json') {
          const j = JSON.parse(fs.readFileSync(p2, 'utf8'));
          if (Object.keys(j.dependencies || {}).length || Object.keys(j.devDependencies || {}).length) 依存.push(path.relative(ROOT, p2));
        }
        if (e.name === 'pyproject.toml' && !/^dependencies = \[\]$/m.test(fs.readFileSync(p2, 'utf8'))) 依存.push(path.relative(ROOT, p2));
      });
      walk(path.join(ROOT, r));
    }
    check('10 リポジトリのすべての CI に、上の段の permissions がある', 権限.length === 0, 権限.join(', '));
    check('10 リポジトリの CI の外部のアクションが、コミットの値（40 桁）と版の注釈で固定されている', 固定.length === 0, 固定.slice(0, 6).join(', '));
    check('10 リポジトリが依存を足していない（CI が入れるのは pypdf・numpy・playwright・build・twine だけ）', 依存.length === 0, 依存.join(', '));
  }

  /* 316。**秘密の鍵の形が、どこにも無い。**メールアドレスは上の免責の段が見ている。
   * 鍵の形はここで組み立てる（この検査のファイルそのものに鍵の形を置かない）。 */
  {
    const P = [new RegExp('-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE ' + 'KEY-----'),
               new RegExp('\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\\b'), new RegExp('\\bgithub_pat_[A-Za-z0-9_]{60,}'),
               new RegExp('\\bAKIA[0-9A-Z]{16}\\b'), new RegExp('\\bxox[abprs]-[A-Za-z0-9-]{10,}'), new RegExp('\\bAIza[0-9A-Za-z_-]{35}\\b')];
    const hits = [];
    let n = 0;
    for (const r of C.repos) {
      let files = [];
      try { files = execFileSync('git', ['ls-files'], { cwd: path.join(ROOT, r), encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { files = []; }
      for (const f of files.filter((x) => /\.(md|html|json|js|py|yml|yaml|toml|cff|txt|csv|bib|sh)$/i.test(x))) {
        let s; try { s = fs.readFileSync(path.join(ROOT, r, f), 'utf8'); } catch (e) { continue; }
        n++;
        if (P.some((re) => re.test(s))) hits.push(r + '/' + f);
      }
    }
    check('10 リポジトリの追跡中のファイル（' + n + ' 本）に、秘密の鍵の形が無い', n > 0 && hits.length === 0, hits.join(', '));
  }

  /* 320・331・332。**サイトの CSP は同じ厳しさで、正の URL を持つ。**一覧は verification/sites.json。 */
  {
    const S = JSON.parse(read(HOME, path.join('verification', 'sites.json'))).sites;
    const csp = [], 正 = [], 地図 = [];
    let pages = 0;
    for (const s of S) {
      const base = path.join(ROOT, s.repo, s.dir);
      /* 474（百本ノック五）。site/ は生成物で、git に入っていない。取ってきた直後のリポジトリには無い。
       * 無ければ、そのリポジトリの build.js で作ってから見る。作れなければ落とす。**検査は緩めない。** */
      if (!fs.existsSync(base) && C.repos.includes(s.repo) && s.dir === 'site' && fs.existsSync(path.join(ROOT, s.repo, 'build.js'))) {
        try {
          execFileSync('node', ['build.js'], { cwd: path.join(ROOT, s.repo), stdio: 'ignore' });
          console.log('  ・  ' + s.repo + '/site が無かったので、node build.js で作りました');
        } catch (e) { csp.push(s.repo + '/site を build.js で作れない'); continue; }
      }
      if (!fs.existsSync(base)) { if (C.repos.includes(s.repo)) csp.push(s.repo + '/' + s.dir + ' が無い'); continue; }
      const htmls = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        if (['.git', 'node_modules', 'drafts', 'deploy', 'doi-index-check', 'examples', 'verification', 'dist', 'templates'].includes(e.name)) return;
        if (s.dir === '.' && ['site'].includes(e.name)) return;
        const p2 = path.join(d, e.name);
        if (e.isDirectory()) return walk(p2);
        if (/\.html$/.test(e.name)) htmls.push(p2);
      });
      walk(base);
      for (const h of htmls) {
        const x = fs.readFileSync(h, 'utf8');
        if (!/<head[\s>]/i.test(x)) continue;   /* 検索の所有確認のための一行のファイルなど */
        pages++;
        const rel = path.relative(ROOT, h);
        const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(x);
        if (!m || m[1].indexOf("default-src 'none'") !== 0 || /unsafe-inline|unsafe-eval/.test(m[1])) csp.push(rel);
        if (s.canonical && !/404\.html$/.test(h)) {
          const c = /<link rel="canonical" href="([^"]+)"/.exec(x);
          if (!c || c[1].indexOf(s.url) !== 0) 正.push(rel);
        }
      }
      if (s.canonical) {
        const robots = read(s.repo, path.join(s.dir, 'robots.txt')) || '';
        const sm = read(s.repo, path.join(s.dir, 'sitemap.xml')) || '';
        const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1]);
        if (robots.indexOf('Sitemap: ' + s.url) < 0 || !locs.length || locs.some((l) => l.indexOf(s.url) !== 0)) 地図.push(s.repo);
      }
    }
    check('研究の系列のサイトの頁（' + pages + ' 頁）の CSP が、default-src \'none\' から始まり unsafe-inline を使わない', pages > 0 && csp.length === 0, csp.slice(0, 6).join(', '));
    check('正の URL を持つサイトの頁が canonical を置き、その URL がサイトの正の場所を指す', 正.length === 0, 正.slice(0, 6).join(', '));
    check('正の URL を持つサイトに sitemap.xml と robots.txt があり、robots が sitemap を名指す', 地図.length === 0, 地図.join(', '));
  }

  /* 348。**言語モデルの使い方を、同じ形の表で。**道具・使ったところ・確かめた人。 */
  {
    const 欠け = [];
    for (const r of C.repos) {
      if (!/^\| 道具 \| 使ったところ \| 確かめた人 \|$/m.test(read(r, 'README.md') || '')) 欠け.push(r + '/README.md');
      const en = read(r, 'README.en.md');
      if (en !== null && !/^\| Tool \| Used for \| Checked by \|$/m.test(en)) 欠け.push(r + '/README.en.md');
    }
    check('10 リポジトリの README が、言語モデルの使い方を同じ形の表（道具・使ったところ・確かめた人）で置く', 欠け.length === 0, 欠け.join(', '));
  }

  /* 343。**正誤表の番号は E1 から欠けずに続く。**欠けたら、消した項目がある。 */
  {
    const 欠け = [];
    for (const r of C.repos) {
      const e = read(r, 'ERRATA.md');
      if (e === null) continue;
      const n = [...e.matchAll(/^## E(\d+) — /gm)].map((m) => Number(m[1]));
      if (!n.length || n.some((x, i) => x !== i + 1)) 欠け.push(r + '（' + n.join(',') + '）');
    }
    check('正誤表の項目の番号が、E1 から欠けずに続く', 欠け.length === 0, 欠け.join(', '));
  }
}

/* ---------- 名乗る件数 ---------- */

console.log('\n13b. 百本ノック五（OSF・識別子・名寄せ・用語・数の書き方・外部の指摘）');

{
  const HOME = 'cpsbvbng26-dotcom';
  const D = (f) => read(HOME, path.join('docs', f)) || '';
  const 表 = (text, head) => {
    const i = text.indexOf(head);
    if (i < 0) return [];
    /* 見出しのあとの最初の表だけを取る。表の後ろに続く節の表は混ぜない。 */
    const lines = text.slice(i + head.length).split('\n');
    const k = lines.findIndex((l) => l.indexOf('|') === 0);
    if (k < 0) return [];
    const block = [];
    for (let n = k; n < lines.length && lines[n].indexOf('|') === 0; n++) block.push(lines[n]);
    return block.filter((l) => !/^\|\s*-/.test(l)).slice(1)
      .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  };

  /* 401–403・406。OSF は一つのプロジェクトに cpsbvbng26-dotcom を一つつなぐ。
   * 部品をやめた理由が「ほかの九つへの道を持っている」なので、README がほかの九つへ実際に道を持っていること。 */
  {
    const osf = D('osf.md');
    const 他 = C.repos.filter((r) => r !== HOME);
    const 漢 = '〇一二三四五六七八九十'.split('');
    const m = /`cpsbvbng26-dotcom` が、ほかの(.)つのリポジトリへの道をすべて持っているからです。/.exec(osf);
    /* README と、README から移した縄張りの頁（docs/castle.md）を合わせて、このリポジトリの入口とみる。 */
    const readme = (read(HOME, 'README.md') || '') + (read(HOME, path.join('docs', 'castle.md')) || '');
    const 道無し = 他.filter((r) => readme.indexOf('github.com/cpsbvbng26-dotcom/' + r) < 0);
    check('OSF の計画が名乗る「ほかの九つ」が、README と縄張りの頁から実際に辿れるリポジトリの数と合う',
      m !== null && 漢.indexOf(m[1]) === 他.length && 道無し.length === 0,
      (m ? '名乗り ' + m[1] : '名乗りが無い') + ' / 実際 ' + 他.length + (道無し.length ? ' / 道が無い: ' + 道無し.join(', ') : ''));
    const idx = read(HOME, DOI_INDEX) || '';
    const o = 表(idx, '## OSF のプロジェクトの DOI').map((r) => (r[1] || '').replace(/`/g, ''));
    const osfDois = [...osf.matchAll(/`(10\.17605\/osf\.io\/[a-z0-9]+)`/g)].map((x) => x[1]);
    check('OSF の計画に書いた DOI が、すべて doi-index の OSF の表にある', osfDois.length > 0 && osfDois.every((d) => o.includes(d)),
      osfDois.filter((d) => !o.includes(d)).join(', ') || osfDois.length + ' 件');
    const 大 = /10\.17605\/OSF\.IO/.test(osf + idx);
    check('OSF の番号を、小文字の一つの形で書いている', !大, 大 ? '大文字の形が混ざっている' : '');
  }

  /* 405。識別子の使い分けの頁。論文は Zenodo で引き、OSF の DOI で引かないこと。 */
  {
    const t = D('identifiers.md');
    check('識別子の頁が、論文は Zenodo で引き、OSF の DOI では引かないと書いている',
      t.indexOf('引用。論文は Zenodo の DOI で引きます') >= 0 && t.indexOf('論文を引くときに OSF の DOI を使いません。') >= 0);
  }

  /* 416。Zenodo と SSRN の同一本文。記録の表の組が、doi-index の「別の所在」の表の組と一致する。 */
  {
    const idx = read(HOME, DOI_INDEX) || '';
    const 組 = (rows, zi, si) => rows.map((r) => {
      const z = /10\.5281\/zenodo\.\d+/.exec(r[zi] || ''); const ss = /10\.2139\/ssrn\.\d+/.exec(r[si] || '');
      return z && ss ? z[0] + '↔' + ss[0] : null;
    }).filter(Boolean).sort();
    const 一覧 = 組(表(idx, '## 別の所在にある同一本文'), 1, 2);
    const ic = D('identical-copies.md');
    const 記録 = 組(表(ic, '# Zenodo と SSRN の同一本文のつなぎ'), 0, 1);
    const 名乗り = /(\d+) 組とも Zenodo の記録に IsIdenticalTo の関係が入っていました。/.exec(ic);
    check('同一本文のつなぎの記録が、doi-index の Zenodo と SSRN の組と一致し、組の数を正しく名乗る',
      一覧.length > 0 && JSON.stringify(一覧) === JSON.stringify(記録) && 名乗り !== null && Number(名乗り[1]) === 一覧.length,
      'doi-index ' + 一覧.length + ' 組 / 記録 ' + 記録.length + ' 組 / 名乗り ' + (名乗り ? 名乗り[1] : '無し'));
  }

  /* 430・479。名寄せの頁の数は、外の値の控え（verification/outside.json）と同じ。 */
  {
    let o = null;
    try { o = JSON.parse(read(HOME, path.join('verification', 'outside.json'))); } catch (e) { o = null; }
    const t = D('name-disambiguation.md');
    const 取 = (re) => { const m = re.exec(t); return m ? Number(m[1]) : null; };
    const 対 = o ? [
      ['ORCID の作品', 取(/\| ORCID \| 一つ。作品は \*\*(\d+)\*\* 件/), o.orcidWorks],
      ['OpenAlex の著者の ID', 取(/著者が \*\*(\d+)\*\* 件に分かれています/), o.openalexAuthorIds],
      ['OpenAlex で引いた番号', 取(/番号 \*\*(\d+)\*\* 件を OpenAlex で引くと/), o.openalexAsked],
      ['OpenAlex で見つかった番号', 取(/\*\*(\d+)\*\* 件が見つかり/), o.openalexFound],
      ['OpenAlex の著者の無い記録', 取(/そのうち \*\*(\d+)\*\* 件に著者が付いていませんでした/), o.openalexNoAuthor],
      ['DataCite の同名の別人', 取(/別人の記録が \*\*(\d+)\*\* 件あります/), o.dataciteOthers],
    ] : [];
    const ずれ = 対.filter(([, a, b]) => a === null || a !== b).map(([n, a, b]) => n + ' 頁 ' + a + ' / 控え ' + b);
    check('名寄せの頁の数が、外の値の控えと合う', o !== null && ずれ.length === 0, ずれ.join(', ') || 対.length + ' 項目');
    check('外の値の控えの日付を、名寄せの頁が名乗っている', o !== null && t.indexOf('数は ' + o.asOf + ' に読んだものです。') >= 0);
    /* 2026-11-13（八度目の見落とし）。索引の網羅調査と外の値の見張りは、著者の記録を外の索引で調べる仕事で、サイトの制作・検査・
     * 配備・公開のどれにも当たらない。GitHub の追加製品の規約が GitHub の実行環境に許す使い方の外にあったので、ワークフローも道具も外した。
     * 控え（outside.json）と頁の数の突き合わせは残る。戻せば落ちる。 */
    const 戻り = ['.github/workflows/index-survey.yml', '.github/workflows/watch-outside.yml', 'verification/index_survey.js', 'verification/watch_outside.js'].filter((f) => read(HOME, f) !== null);
    check('索引の網羅調査と外の値の見張りは、ワークフローも道具も外してある（GitHub の追加製品の規約、2026-11-13）', 戻り.length === 0, 戻り.join(', '));
  }

  /* 468。用語集。使わない語が、研究のリポジトリと Sophaxis・deposit-check の散文に無い。 */
  const 散文の行 = (text) => {
    const out = [];
    let fence = false;
    text.split('\n').forEach((l, i) => {
      if (l.trim().indexOf('```') === 0) { fence = !fence; return; }
      if (fence) return;
      const s0 = l.replace(/^\s+/, '');
      if (s0.indexOf('>') === 0 || s0.indexOf('#') === 0) return;
      out.push([i + 1, l.replace(/「[^」]*」/g, '＿').replace(/『[^』]*』/g, '＿').replace(/`[^`]*`/g, '＿')]);
    });
    return out;
  };
  const 散文のファイル = (repos, skip) => {
    const files = [];
    const walk = (repo, rel) => {
      let ents;
      try { ents = fs.readdirSync(path.join(ROOT, repo, rel), { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) {
          if (/^(\.git|node_modules|site|dist|papers|examples|fixtures|__pycache__|preprint)$/.test(e.name)) continue;
          walk(repo, r);
        } else if (/\.(md|toml)$/.test(e.name) && !/\.en\.md$/.test(e.name) && !/(^|\/)CLAUDE\.md$/.test(r) && !skip(repo, r)) files.push([repo, r]);
      }
    };
    repos.forEach((r) => walk(r, ''));
    return files;
  };
  {
    const g = D('glossary.md');
    const rows = 表(g, '# 用語集');
    const 禁 = [];
    rows.forEach((r) => (r[1] || '').split('、').map((w) => w.trim()).filter(Boolean).forEach((w) => 禁.push([w, r[0]])));
    const repos = C.repos.concat(['sophaxis', 'deposit-check']).filter((r) => fs.existsSync(path.join(ROOT, r)));
    const 出た = [];
    for (const [repo, rel] of 散文のファイル(repos, (r, f) => r === HOME && f === 'docs/glossary.md')) {
      for (const [n, l] of 散文の行(read(repo, rel) || '')) for (const [w, right] of 禁) if (l.indexOf(w) >= 0) 出た.push(repo + '/' + rel + ':' + n + ' 「' + w + '」→「' + right + '」');
    }
    check('用語集が使わないと決めた語が、' + repos.length + ' リポジトリの散文に無い', rows.length > 0 && 禁.length > 0 && 出た.length === 0,
      出た.length ? 出た.slice(0, 4).join(' / ') : (rows.length + ' 語 / 使わない語 ' + 禁.length));
  }

  /* 共通の決めごと 16（2026-11-12）。Claude は利用者に作業を割り当てない。文書のどこにも、利用者の仕事を作る形を置かない。
   * 研究の十と、Sophaxis・deposit-check・nusquama の散文（英語の対も含む）を走る。CLAUDE.md は指示書なので外す。
   * 鉤括弧とコードの中は、散文の行が伏せるので、規則そのものを引くことはできる。過去の事実（「利用者が行いました」）は止めない。 */
  {
    const 形 = ['利用者が確かめる', '利用者が確かめます', '利用者の手作業', '利用者の手にな', '利用者の手です', '利用者の作業', '利用者が手で',
      '利用者が行います', '利用者が決めます', '利用者を待', '利用者の観察を待', '案（利用者',
      'needs the owner', 'for the owner to', "owner's steps", 'for the operator to confirm', 'is for the King to decide', '埋めるかどうかは、王が決めます'];
    const repos = C.repos.concat(['sophaxis', 'deposit-check', 'nusquama']).filter((r) => fs.existsSync(path.join(ROOT, r)));
    const files = [];
    const walk = (repo, rel) => {
      let ents;
      try { ents = fs.readdirSync(path.join(ROOT, repo, rel), { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) { if (!/^(\.git|node_modules|site|dist|papers|examples|fixtures|__pycache__|preprint)$/.test(e.name)) walk(repo, r); }
        else if (/\.(md|toml)$/.test(e.name) && !/(^|\/)CLAUDE\.md$/.test(r)) files.push([repo, r]);
      }
    };
    repos.forEach((r) => walk(r, ''));
    /* 決めたことと理由は Claude が書く。2026-11-12 からの決めの行は、決めた者を名乗る。利用者の決めと見分けるためである。
     * 決めの行：日付に決めの語が続く行（「2026-11-12 に Claude が決めました」「決めました（2026-11-12）」「Decided by Claude on 2026-11-12」の形）。
     *   日付が 2026-11-12 より前の行と、先の日付を挙げるだけの行は見ない。
     * 名乗りは Claude か、利用者・著者・運営者・王（owner・operator・author・King）。
     * 決めごと 16 より前に置かれ、決めた者を書いていなかった三行だけは除く（誰の決めかを、こちらで書き足して作り出さない）。 */
    /* 決めの語と日付の組を拾い、その組の中か直前に、決めた者の名乗りがあるかを見る（行のどこかに名があるだけでは足りない）。 */
    const 決めの形 = [/(\d{4}-\d{2}-\d{2}) に、?[^。]{0,40}?(?:決めました|決めて|決めた|採りました|採った|凍結と決め)/g, /(?:決めました|採った|決め)（(\d{4}-\d{2}-\d{2})）/g,
      /(?:Decided|decided|decisions|Adopted|adopted)[^.]{0,40}? on (\d{4}-\d{2}-\d{2})/g];
    const 名乗り = /Claude|(利用者|著者|運営者|王)が|by the (owner|operator|author|King)|(owner|operator|author|King) (decided|adopted)/;
    const 名の無い決め = (l) => 決めの形.some((re) => [...l.matchAll(re)].some((m) => m[1] >= '2026-11-12' && !名乗り.test(l.slice(Math.max(0, m.index - 20), m.index + m[0].length))));
    const 前から = [['cpsbvbng26-dotcom', 'docs/site-rules.md', '顔写真は置きません'], ['cpsbvbng26-dotcom', 'docs/osf.md', 'OSF のプロジェクトの組み方を決めました'],
      ['researcher-profile', 'README.md', 'テンプレート']];
    const 出た = [];
    for (const [repo, rel] of files) {
      for (const [n, l] of 散文の行(read(repo, rel) || '')) {
        for (const w of 形) if (l.indexOf(w) >= 0) 出た.push(repo + '/' + rel + ':' + n + ' 「' + w + '」');
        if (名の無い決め(l)
          && !前から.some(([r, f, t]) => r === repo && f === rel && l.indexOf(t) >= 0)) 出た.push(repo + '/' + rel + ':' + n + ' 決めた者の無い決め');
      }
    }
    check('利用者に作業を割り当てる形が、' + repos.length + ' リポジトリの散文（' + files.length + ' ファイル）に無く、2026-11-12 からの決めの行が決めた者を名乗る（共通の決めごと 16）',
      repos.length >= 13 && files.length > 0 && 出た.length === 0, 出た.slice(0, 4).join(' / '));
  }

  /* 473。数の書き方。一つの日付の中で漢数字と算用数字を混ぜない。全角の数字を使わない。
   * Sophaxis は自分の英日の数の検査を直してから入れる（docs/number-style.md）。 */
  {
    const K = '[〇一二三四五六七八九十]';
    const 混 = [new RegExp(K + '+月\\s*\\d+\\s*日'), new RegExp('\\d+\\s*月\\s*' + K + '+日'),
               new RegExp(K + '{2,}年\\s*\\d+\\s*月'), new RegExp('\\d+\\s*年\\s*' + K + '+月'), /[０-９]/];
    const repos = C.repos.concat(['deposit-check']).filter((r) => fs.existsSync(path.join(ROOT, r)));
    const 出た = [];
    const files = 散文のファイル(repos, () => false);
    for (const [repo, rel] of files) {
      for (const [n, l] of 散文の行(read(repo, rel) || '')) for (const re of 混) { const m = re.exec(l); if (m) 出た.push(repo + '/' + rel + ':' + n + ' 「' + m[0] + '」'); }
    }
    check('漢数字と算用数字の混ざった日付と、全角の数字が、' + repos.length + ' リポジトリの散文（' + files.length + ' ファイル）に無い',
      files.length > 0 && 出た.length === 0, 出た.slice(0, 4).join(' / '));
    check('数の書き方の決まりが、混ぜない例と外すところを書いている',
      D('number-style.md').indexOf('「十月 30 日」とは書かず、「10 月 30 日」と書きます。') >= 0 && D('number-style.md').indexOf('`papers/*.md`。紙面の逐語の翻刻です。') >= 0);
  }

  /* 480。外部の指摘の追跡表。行の数と評価の数を名乗り、受けた評価の表の評価がすべて行を持つ。状態は五つのどれか。 */
  {
    const t = D('external-review-tracker.md');
    const rows = 表(t, '外部の評価は査読ではありません。');
    const 状態 = new Set(['対応済み', '対応中', '未対応', '採らない', '外れ']);
    const 評価 = [...new Set(rows.map((r) => r[1]))];
    const m = /いま、評価 (\d+) 件から、指摘 (\d+) 件です。/.exec(t);
    const 番号 = rows.map((r) => Number(r[0]));
    check('外部の指摘の追跡表が名乗る評価と指摘の数が、表と合う',
      m !== null && Number(m[1]) === 評価.length && Number(m[2]) === rows.length && 番号.every((n, i) => n === i + 1),
      (m ? '名乗り ' + m[1] + ' / ' + m[2] : '名乗りが無い') + ' / 表 ' + 評価.length + ' / ' + rows.length);
    const 外れ状態 = rows.filter((r) => !状態.has(r[4])).map((r) => r[0]);
    check('追跡表の状態が、決めた五つのどれかである', rows.length > 0 && 外れ状態.length === 0, 外れ状態.join(', '));
    const ev = read(HOME, path.join('docs', 'external-evaluations.md')) || '';
    /* 受けた評価の表の行ごとに、追跡表の評価が一つある。Sophaxis への評価（ChatGPT）は Sophaxis の側に記録するので、
     * 受けた評価の表には入っていない。それを除いた数が、受けた評価の表の行の数と同じ。 */
    const 受 = 表(ev, '## 受けた評価');
    const 外 = 評価.filter((e) => e.indexOf('ChatGPT — Sophaxis') !== 0);
    const 場の無い = 外.filter((e) => !受.some((r) => r[0].indexOf(e.split(' — ')[0]) === 0));
    check('external-evaluations.md の受けた評価が、すべて追跡表に行を持つ',
      受.length > 0 && 外.length === 受.length && 場の無い.length === 0,
      '受けた評価 ' + 受.length + ' 件 / 追跡表 ' + 外.length + ' 件' + (場の無い.length ? ' / 場が無い: ' + 場の無い.join(', ') : ''));
  }

  /* 489。Figshare の頁の表の DOI が、doi-index の Figshare の番号と同じ。 */
  {
    const f = D('figshare.md');
    const a = [...new Set(f.match(/10\.6084\/m9\.figshare\.\d+/g) || [])].sort();
    const b = [...(一覧の番号(/10\.6084\/m9\.figshare\.\d+/g) || [])].sort();
    check('Figshare の頁の稿が、doi-index の Figshare の番号と一致する', a.length > 0 && JSON.stringify(a) === JSON.stringify(b), a.join(', ') + ' / ' + b.join(', '));
    check('Figshare の頁が、決めごと 15 の水準（researchmap の MISC）を書いている', f.indexOf('researchmap の MISC に載せられる水準のものに限ります') >= 0);
  }
}

/* 481（百本ノック五）。**この検査の件数は docs/checks.md の一か所にだけ書く。**
 * 2026-11-12 まで五か所に書いて突き合わせていた。ほかの場所は、その頁を指す。数を書き戻せば落とす。 */
console.log('\n14. この検査が名乗る件数');

{
  const total = passed + failures.length + 2;
  const 正 = read('cpsbvbng26-dotcom', path.join('docs', 'checks.md')) || '';
  const m = /いま 10 リポジトリ横断 (\d+) 項目です。/.exec(正);
  check('この検査が名乗る件数が実際と合う（docs/checks.md の一か所）', m !== null && Number(m[1]) === total,
    '実際 ' + total + ' / 名乗り ' + (m ? m[1] : '無し'));
  const 指す = [
    ['README.md', /10 リポジトリ横断 \d+ 項目/],
    ['.github/workflows/ecosystem.yml', /10 リポジトリ横断 \d+ 項目/],
    ['.claude/commands/check.md', /横断のずれ（\d+ 項目）/],
    ['.claude/commands/開始.md', /check_ecosystem\.js`（\d+ 項目）/],
    ['docs/self-assessment.md', /横断 \*\*\d+ 項目\*\*/],
  ];
  const 書き戻し = [];
  for (const [f, re] of 指す) {
    const text = read('cpsbvbng26-dotcom', f);
    if (text === null || re.test(text) || text.indexOf('checks.md') < 0) 書き戻し.push(f);
  }
  check('ほかの場所は件数を書かず、docs/checks.md を指している', 書き戻し.length === 0,
    書き戻し.length ? ('数を書いている、または指していない: ' + 書き戻し.join(', ')) : 指す.length + ' 箇所');
}

/* ---------- ここまで ---------- */

console.log('\n' + '-'.repeat(58));
if (failures.length) {
  console.log(passed + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  failures.forEach((f) => console.log('  - ' + f.trim()));
  process.exit(1);
}
console.log(passed + ' 件すべて通りました。');
