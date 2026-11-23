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

/* 2026-11-18（決めごと 5 の総点検）。過去の日付の付いた数は、git のその時点から数え直す。
 * commit を書いた宣言は、ファイルならその時点の中身を git show で読み、コマンドならその時点の木を
 * git worktree で一時の場所に出して走らせる（git の履歴を引く検査もあるので、archive ではなく worktree）。
 * 出した木はコミットごとに一度だけ作り、終わりに外す。 */
const 過去の木 = new Map();
function その時点の木(repo, commit) {
  const k = repo + '@' + commit;
  if (過去の木.has(k)) return 過去の木.get(k).dir;
  const dir = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'ecosystem-past-')), 'w');
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', dir, commit],
    { cwd: path.join(ROOT, repo), stdio: ['ignore', 'ignore', 'pipe'] });
  過去の木.set(k, { repo, dir });
  return dir;
}
process.on('exit', () => {
  for (const { repo, dir } of 過去の木.values()) {
    try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: path.join(ROOT, repo), stdio: 'ignore' }); }
    catch (e) { /* 外せなくても判定は変わらない */ }
    try { fs.rmSync(path.dirname(dir), { recursive: true, force: true }); } catch (e) { /* 同じ */ }
  }
});
function その時点の中身(repo, commit, rel) {
  try {
    return execFileSync('git', ['show', commit + ':' + rel],
      { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}
/* 区間：[始まりの文字列, 終わりの文字列]。始まりから終わりの手前までだけを数える。 */
function 区間で切る(text, 区間) {
  if (!区間) return text;
  const i = text.indexOf(区間[0]);
  if (i < 0) return null;
  const j = text.indexOf(区間[1], i + 区間[0].length);
  return text.slice(i, j < 0 ? text.length : j);
}

function actual(spec, label) {
  /* 差：[前, 後]。二つの時点の数の差（「見本はそれぞれ 1 項目増えます」）。 */
  if (spec['差']) return actual(spec['差'][1], label) - actual(spec['差'][0], label);
  if (spec.cmd) {
    let out;
    try {
      out = execFileSync(spec.cmd[0], spec.cmd.slice(1),
        { cwd: spec.commit ? その時点の木(spec.repo, spec.commit) : path.join(ROOT, spec.repo),
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      /* その時点の検査が落ちて終わっても、出した数は読む。いまの木の検査は、走らなければ落とす。 */
      if (spec.commit && e.stdout) out = String(e.stdout);
      else throw new Error('走らせられなかった: ' + spec.repo + ' ' + spec.cmd.join(' '));
    }
    out = 区間で切る(out, spec['区間']);
    if (out === null) throw new Error('出力に区間が無い: ' + spec.repo + ' ' + spec['区間'][0]);
    if (spec['数える']) return (out.match(new RegExp(spec['数える'], 'gm')) || []).length;
    /* 出力の途中にも数は出る（見本を走らせた分など）。
     * 名乗りの元にするのは、最後に出た数 —— そのコマンド自身の合計である。 */
    const ms = [...out.matchAll(new RegExp(spec.regex, 'g'))];
    if (!ms.length) throw new Error('出力から数を取れなかった: ' + spec.repo);
    /* 足す：その時点の検査は、いまの作業環境では落ちる項目がある（git の無い木で日付を引くなど）。
     * 項目の数は「通った数 + 落ちた数」なので、取った組をすべて足す。 */
    if (spec['足す']) return ms[ms.length - 1].slice(1).reduce((a, x) => a + (x ? parseInt(x, 10) : 0), 0);
    return parseInt(ms[ms.length - 1][1], 10);
  }
  let text = spec.commit ? その時点の中身(spec.repo, spec.commit, spec.file) : read(spec.repo, spec.file);
  if (text === null) throw new Error('無い: ' + spec.repo + '/' + spec.file + (spec.commit ? ' @' + spec.commit : ''));
  text = 区間で切る(text, spec['区間']);
  if (text === null) throw new Error('区間が無い: ' + spec.repo + '/' + spec.file + ' ' + spec['区間'][0]);
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
/* 2026-11-18 の点検。十の外の三つ（sophaxis・deposit-check・nusquama）も走る。sophaxis と deposit-check の
 * 「すべての版」の DOI が、一覧に無いまま README と CITATION.cff に出ていた。十の外の三つでは、道具と検査と
 * 作り物の答え（verification・tools・bin・src・scripts・tests・examples）を外し、配る文と設定だけを見る。
 * そこには他人の稿の DOI と、試験のための作り物の番号が並ぶので、一覧に載せる意味が無い。 */
/* 2026-11-18 に research-collaboration（共同研究の入口）を十の外に足した。DOI の走査・Google サイトの所在・
 * 決めごと 16 の形の走査（散文と YAML）は、この並びを使う。開示の無いマージの数え（13c）は、前の三つのまま。 */
const 十の外 = ['sophaxis', 'deposit-check', 'nusquama', 'research-collaboration'];
const 十の外で外す = ['verification', 'tools', 'bin', 'src', 'scripts', 'tests', 'examples'];
function 出てくる番号(re, repos, extraSkip) {
  const SKIP = new Set(['.git', 'node_modules', 'site', 'dist', 'pdf', 'venv',
                        '__pycache__', 'assets', 'data'].concat(extraSkip || []));
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
  for (const d of 出てくる番号(re, 十の外.filter((r) => !repos.includes(r)), 十の外で外す)) found.add(d);
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

    /* **aiXiv.science の公式審査を経た論文。**言語モデルの審査で載ったものを、出した先の表から数え直す。
     * 言語モデル五体の多数決は、人による査読ではない。だから「査読」の語では呼ばない（2026-11-13。12u が見る）。
     * 「査読を通った論文」の欄とは混ぜない。混ぜれば、軽い門を重い枠で数えることになる。 */
    {
      const ev = read('cpsbvbng26-dotcom', path.join('docs', 'external-evaluations.md')) || '';
      const 実 = (ev.match(/^\| aiXiv\.science \|[^\n]*\| 審査を経て掲載された。/gm) || []).length;
      const m = /^\| aiXiv\.science の公式審査を経た論文 \|[^|]*\| \*\*(\d+) 篇\*\*/m.exec(text);
      /* README の導入も同じ数を名乗る。**場の説明として書いた審査の仕組みと、この稿を誰が審査したかを確かめていない一文と、
       * 査読として数えない一文と一緒でなければ落とす**（2026-11-13、十六度目。仕組みを、この稿の審査の事実として書かない）。 */
      const 和 = /aiXiv\.science では、場の公式審査を経た論文が (\d+) 篇あります。場は、その審査を言語モデルの多数決と説明しています。この稿を誰が審査したかは、確かめていません。ここでは、この審査を査読ではないものとして数えます。学術誌・学会の査読でもありません。/
        .exec(read('cpsbvbng26-dotcom', 'README.md') || '');
      const 英 = /On aiXiv\.science, (\d+) papers? ha(?:s|ve) passed the platform's official review\. The platform describes its review as a vote of language models\. Who reviewed this paper was not checked here\. It is counted here as not peer review, and it is not review by a journal or a society either\./
        .exec(read('cpsbvbng26-dotcom', 'README.en.md') || '');
      check('aiXiv.science の公式審査を経た論文の数が、出した先の表と合う',
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
    /* 2026-11-18。篇の内訳（哲学・数学・…）の和と、実績の時期の欄の「下の N 篇」も、同じ数え直しと突き合わせる。
     * 黄金比の窓の予想の解決の稿（Figshare）を足して 10 篇から 11 篇にしたとき、内訳の数学も 4 から 5 に動かした。
     * 内訳だけ、または時期の欄だけを据え置けば落ちる。 */
    const 内訳 = /^\| 公開した成果物 \|[^\n]*\*\*(\d+) 篇\*\*（([^）]*)）/m.exec(text);
    const 内訳の和 = 内訳 ? (内訳[2].match(/ \d+(?=・|$)/g) || []).reduce((s, x) => s + parseInt(x, 10), 0) : null;
    if (papers !== null && (内訳 === null || parseInt(内訳[1], 10) !== papers || 内訳の和 !== papers)) {
      wrong.push('公開した成果物の内訳の和 ' + 内訳の和 + ' が実際 ' + papers + ' 篇と合わない');
    }
    const 時期の行 = text.split('\n').find((l) => l.indexOf('| 実績の時期 |') === 0) || '';
    const 下の = [...時期の行.matchAll(/下の (\d+) 篇/g)].map((m) => parseInt(m[1], 10));
    if (papers !== null && (下の.length === 0 || 下の.some((n) => n !== papers))) {
      wrong.push('実績の時期の欄の「下の N 篇」' + 下の.join('・') + ' が実際 ' + papers + ' 篇と合わない');
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

/* ---------- 作者のサイトの意匠が、生成もとの数から描いたものと同じか（2026-11-14） ----------
 *
 * 帯・銘・飾り・年表の棒と意匠の CSS は、researcher-profile の design.js が描く。頁に写したあとで手で直すと、
 * 次の生成で黙って戻る。design.js を呼んで、頁の SVG と CSS を一字一句で突き合わせる。
 * ロゴ（favicon.svg、手で置いたもの）は、design.js の寸法から描いたものと一字一句同じであること。飾りの比はそこから取る。
 * 年表の数（researcher-profile の register-timeline.json）は、self-correction の data/register.csv から数え直したものと同じであること。 */
console.log('\n12b2. 作者のサイトの意匠と、訂正の登録簿の年表');
{
  const R = 'cpsbvbng26-dotcom';
  const rp = path.join(ROOT, 'researcher-profile');
  let design = null, tl = null;
  try { design = require(path.join(rp, 'design.js')); } catch (e) { design = null; }
  try { tl = require(path.join(rp, 'build_timeline.js')); } catch (e) { tl = null; }
  const pages = JSON.parse(read(R, path.join('verification', 'pages.json')) || '{"pages":[]}').pages.map((p) => p.file)
    .filter((f) => /<span class="updated">/.test(read(R, f) || ''));
  const 判定 = (x) => {
    const bad = [];
    if (!design || !tl) return ['researcher-profile の design.js か build_timeline.js を読めない'];
    if ((x.favicon || '').trim() !== design.logoSvg()) bad.push('favicon.svg が design.js のロゴの寸法と違う');
    const want = { band: design.bandSvg(), seal: design.sealSvg(), long: design.ornamentSvg('long'), short: design.ornamentSvg('short') };
    for (const [f, h] of Object.entries(x.pages)) {
      const got = [...h.matchAll(/<svg class="(band|seal|orn orn-long|orn orn-short)"[\s\S]*?<\/svg>/g)];
      if (!got.length) bad.push(f + ' に意匠が無い');
      got.forEach((m) => { const k = { band: 'band', seal: 'seal', 'orn orn-long': 'long', 'orn orn-short': 'short' }[m[1]]; if (m[0] !== want[k]) bad.push(f + ' の ' + k + ' が生成もとと違う'); });
      if (h.indexOf(design.css()) < 0) bad.push(f + ' の意匠の CSS が生成もとと違う');
      const rows = [...h.matchAll(/<li><time datetime="(\d{4}-\d{2}-\d{2})">\1<\/time>(<svg class="tl-bar"[\s\S]*?<\/svg>)<span class="tl-count">(\d+)/g)];
      const max = Math.max(0, ...rows.map((m) => Number(m[3])));
      rows.forEach((m) => { if (m[2] !== design.barSvg(Number(m[3]), max)) bad.push(f + ' の年表の棒（' + m[1] + '）が件数と合わない'); });
    }
    let csvRows = null;
    try { csvRows = tl.timeline(x.csv || ''); } catch (e) { bad.push('register.csv を読めない'); }
    if (csvRows && JSON.stringify(csvRows) !== JSON.stringify((x.json || {}).rows)) bad.push('register-timeline.json が register.csv から数えたものと違う');
    const items = ((x.toml || '').match(/^\[\[(?:entry|entries|item|items|record|records)\]\]/gm) || []).length;
    const total = csvRows ? csvRows.reduce((n, r) => n + r.count, 0) : -1;
    if (items > 0 && items !== total) bad.push('年表の合計 ' + total + ' が register.toml の項目の数 ' + items + ' と違う');
    const ja = x.pages['index.html'] || '';
    if (ja.indexOf('<p class="timeline-total">合計 ' + total + ' 件</p>') < 0) bad.push('トップの頁の年表の合計が登録簿と違う');
    return bad;
  };
  let json = null;
  try { json = JSON.parse(read('researcher-profile', 'register-timeline.json') || 'null'); } catch (e) { json = null; }
  const 実 = { favicon: read(R, 'favicon.svg'), pages: Object.fromEntries(pages.map((f) => [f, read(R, f) || ''])),
    csv: read('self-correction', path.join('data', 'register.csv')), toml: read('self-correction', 'register.toml'), json };
  const now = 判定(実);
  check('生成した頁（' + pages.length + ' 頁）の帯・銘・飾り・年表の棒・意匠の CSS が design.js の描くものと一字一句同じで、favicon.svg がロゴの寸法どおりで、年表の数が self-correction の register.csv から数えたものと同じ',
    pages.length > 20 && now.length === 0, now.slice(0, 5).join(' / '));
  const 替 = (f, a, b) => Object.assign({}, 実, { pages: Object.assign({}, 実.pages, { [f]: 実.pages[f].replace(a, b) }) });
  const 壊す = [
    ['favicon の枠の太さを変える', Object.assign({}, 実, { favicon: (実.favicon || '').replace('stroke-width="3"', 'stroke-width="2"') })],
    ['帯の枠の間を変える', 替('cv.html', 'width="16" height="8" patternUnits', 'width="18" height="8" patternUnits')],
    ['節の飾りの棒を延ばす', 替('notes/mission.html', /(<svg class="orn orn-short"[\s\S]*?class="orn-frame"[^>]*\/><rect x="13" y="4.25" width=")27(")/, '$128$2')],
    ['意匠の CSS を手で直す', 替('index.en.html', '.band { display: block; }', '.band { display: block; opacity: .9; }')],
    ['年表の棒の幅を変える', 替('index.html', /(<rect width=")[\d.]+(" height="8" class="tl-fill"\/>)/, '$1' + '1' + '$2')],
    ['登録簿に一行足す', Object.assign({}, 実, { csv: (実.csv || '') + 'XX-999,open,t,,,,,,,,,,,,,,,2026-11-14,同時,紙面\n' })],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  check('壊して確かめる：ロゴの寸法・帯・節の飾り・意匠の CSS・年表の棒・登録簿の行のどれを崩しても落ちる（' + 落ちた.length + ' / ' + 壊す.length + '）',
    落ちた.length === 壊す.length, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / '));
}

/* Sophaxis の頁（researcher-profile の sophaxis*.json と、写した notes/sophaxis*.html）は、
 * 載っている記録の数を地の文で名乗る。決めごと 5 により、名乗りを一覧の項目と突き合わせる。
 * 2026-11-23 に 2026.0001 を著者の求めで削除したので、一覧の id は 2026.0001 から欠けずには並ばない。
 * 一覧の id は、sophaxis の data/papers で status が listed の記録の id と、同じものが同じ順に並ぶ。 */

console.log('\n12c. Sophaxis の頁が名乗る記録の数');

{
  const EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  const listed = (html) => [...String(html).matchAll(/Sophaxis:(2026\.\d{4})<\/a>/g)].map((m) => m[1]);
  const shownIds = (() => { try { const d = path.join(ROOT, 'sophaxis', 'data', 'papers'); return fs.readdirSync(d).filter((f) => /^\d{4}\.\d{4}\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'))).filter((p) => p.status === 'listed').map((p) => p.id).sort(); } catch (e) { return []; } })();
  const consecutive = (ids) => ids.length > 0 && ids.join() === shownIds.join();
  const ja = [read('researcher-profile', 'sophaxis.json'), read('cpsbvbng26-dotcom', 'notes/sophaxis.html')];
  const en = [read('researcher-profile', 'sophaxis.en.json'), read('cpsbvbng26-dotcom', 'notes/sophaxis.en.html')];
  const jaClaims = ja.map((t) => { const m = /いま載っている記録は (\d+) 件で/.exec(t || ''); return m ? Number(m[1]) : null; });
  const jaIds = ja.map((t) => listed(t || ''));
  check('Sophaxis の頁（日本語）が名乗る記録の数が、一覧の項目の数と合い、id が sophaxis の載っている記録（' + shownIds.length + ' 件）と同じに並ぶ',
    jaClaims.every((n, i) => n !== null && n === jaIds[i].length && consecutive(jaIds[i])),
    '名乗り ' + jaClaims.join('・') + ' / 一覧 ' + jaIds.map((x) => x.length).join('・'));
  const enClaims = en.map((t) => { const m = /The (\w+) records listed so far/.exec(t || ''); return m ? EN.indexOf(m[1]) : null; });
  const enIds = en.map((t) => listed(t || ''));
  check('Sophaxis の頁（英語）が名乗る記録の数が、一覧の項目の数と合い、日本語版と同じ id を挙げる',
    enClaims.every((n, i) => n !== null && n > 0 && n === enIds[i].length && consecutive(enIds[i]))
      && enIds.every((x) => x.join() === jaIds[0].join()),
    '名乗り ' + enClaims.join('・') + ' / 一覧 ' + enIds.map((x) => x.length).join('・'));
  check('壊して確かめる：削除した 2026.0001 を一覧に戻す・載っている記録を一つ落とす・順を替える、のどれでも落ちる（3 / 3）',
    shownIds.length > 1 && !consecutive(['2026.0001'].concat(shownIds)) && !consecutive(shownIds.slice(1)) && !consecutive(shownIds.slice().reverse()));
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
  const repos = C.repos.concat(十の外).filter(present);
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
      /* 2026-11-15 から、どの checkout も鍵を残さない（persist-credentials: false）。履歴をすべて取ることは同じに求める。 */
      const want = r === 'cpsbvbng26-dotcom' ? 'path: repos/cpsbvbng26-dotcom, fetch-depth: 0, persist-credentials: false }' : 'repository: cpsbvbng26-dotcom/' + r + ', path: repos/' + r + ', fetch-depth: 0, persist-credentials: false }';
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
    ['免責事項を前の日に戻す', 替('cpsbvbng26-dotcom/DISCLAIMER.md', /最終更新：\d{4}-\d{2}-\d{2}（日本時間）。/, '最終更新：2026-11-13（日本時間）。')],
    ['英語の免責事項を前の日に戻す', 替('cpsbvbng26-dotcom/DISCLAIMER.en.md', /Last updated: \d{4}-\d{2}-\d{2} \(Japan time\)\./, 'Last updated: 2026-11-13 (Japan time).')],
    ['免責事項から日本時間を外す', 替('cpsbvbng26-dotcom/DISCLAIMER.md', /最終更新：(\d{4}-\d{2}-\d{2})（日本時間）。/, '最終更新：$1。')],
    ['英語の免責事項から日本時間を外す', 替('cpsbvbng26-dotcom/DISCLAIMER.en.md', /Last updated: (\d{4}-\d{2}-\d{2}) \(Japan time\)\./, 'Last updated: $1.')],
    /* 2026-11-19。前は 11月13日 を文字列で固定していた。正誤表の最終更新を進めると置き換えが空振りし、何も壊さなくなる。
     * いま書いてある日の前の日に戻す。厳しさは同じで、正誤表の日付と、どちらの PR が先に入るかに縛られない。 */
    ['trinity-infinity の正誤表を前の日に戻す', 替('trinity-infinity/ERRATA.md', /^最終更新: (\d{4})年(\d{1,2})月(\d{1,2})日/m, (s, y, mo, d) => {
      const t = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)) - 86400000);
      return '最終更新: ' + t.getUTCFullYear() + '年' + (t.getUTCMonth() + 1) + '月' + t.getUTCDate() + '日';
    })],
    ['正誤表の文を今日変えて、最終更新を変えない', Object.assign({}, 実, { 最後: Object.assign({}, 最後, { 'naval-gazette-notes/ERRATA.md': '2099-01-01' }) })],
    ['最終更新の行の形を崩す', 替('autonomy-and-self-cultivation/ERRATA.md', /^最終更新: /m, '最終更新 ')],
    ['頁を数えから外す', Object.assign({}, 実, { 頁: 頁.filter((k) => k !== 'cpsbvbng26-dotcom/DISCLAIMER.en.md') })],
    ['履歴が浅い', Object.assign({}, 実, { 浅い: Object.assign({}, 浅い, { 'self-correction': true }) })],
    ['横断の CI から fetch-depth を外す', Object.assign({}, 実, { WF: (WF || '').replace('repository: cpsbvbng26-dotcom/solitary-school, path: repos/solitary-school, fetch-depth: 0, persist-credentials: false }', 'repository: cpsbvbng26-dotcom/solitary-school, path: repos/solitary-school, persist-credentials: false }') })],
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
    /* 十度目の節の判定の数を変える。後ろに節が増えても（十六度目、2026-11-13）、十度目の節の一行を狙う。 */
    ['英語の記録の判定の数を変える', 替('deposit-check', 'docs/legal-audit-2026-11-12.md', new RegExp('(' + (K ? K['節'] : 'x^').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?Findings in this table: [^\\n]*?)(\\d+)\\.\\n'), (m, a, n) => a + (Number(n) + 1) + '.\n')],
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

/* ---------- 十一度目の見落とし：NEMFSI のすべての所在、三篇と SSRN、作成者の所属の欄（2026-11-12 の続き） ----------
 *
 * 一。**PhilArchive の NEMFSI は、どの面でも削除の依頼を添えて書く。**十度目はトップの頁の段と所在の欄だけを
 * 直し、論文の頁・ノートの頁・README の表・引用情報・翻刻の書誌表は、同じ本文のある所在として挙げたままだった。
 * 論文の頁とノートの頁の構造化データは sameAs に入れていた。13 のリポジトリのどのファイルでも（記録とこの検査の
 * ほか）、そのリンクのすぐ後ろに依頼の日と削除の語があり、sameAs にも .zenodo.json・codemeta.json にも入らない。
 * 生成もと（researcher-profile の papers.json）の所在は、deletionRequested に依頼の日を持つ。
 * 二。**三篇がそろって SSRN にあると書かない。**断章論は SSRN に弾かれている。直した四つの文を戻さず、
 * 三篇と SSRN を同じ文に置いて打ち消しの語を持たない文も止める。
 * 三。**使わないと決めた語の英訳は、凍結した紙面の写しと記録と検査の表のほかに無い。**Zenodo の史料ノートの
 * 四つの記録は、作成者の所属の欄がこの語である。欄は作業環境から触れない。記録は語を書き写さず、
 * 欄の所在と値の SHA-256 を引く。SHA-256 は、naval-gazette-notes の check_text.py の表の語から計算して合わせる。
 * 許すのは、翻刻の著者の行（PDF の扉の写し）と、Sophaxis の要旨の版の注（紙面の著者の行が変わったことを書く）の形だけ。
 * 四。直したリポジトリの記録に十一度目の節がそろうこと。 */
console.log('\n12r. 十一度目の見落とし：NEMFSI のすべての所在・三篇と SSRN・作成者の所属の欄（2026-11-12 の続き）');
{
  const K = DECL['十一度目の見落とし'] || null;
  const 十三 = (DECL['八度目の見落とし'] || {})['記録'] || [];
  const 判定語 = { ja: ['誤り', '根拠不足', '漏れ', '表現', '問題なし'], en: ['Error', 'Insufficient basis', 'Omission', 'Wording', 'No problem'] };
  const crypto = require('crypto');
  const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  function 判定(x) {
    const bad = [];
    if (K === null) return ['宣言が無い'];
    if (十三.length !== 13) bad.push('13 のリポジトリの一覧が読めない');
    for (const r of 十三) if (!x.全部[r]) bad.push(r + ' のファイルの一覧が読めない');
    const 見ない = new RegExp(K['見ないファイル']);
    const 第三者 = new RegExp(K['第三者の文']);
    const N = K['NEMFSI'];
    const 式 = new RegExp(N['式'], 'g');
    const 依頼 = new RegExp(N['依頼']);
    const 同じ = new RegExp(N['sameAs'], 'g');
    const 引用情報 = new RegExp(N['引用情報で書かない']);
    const S = K['SSRN'];
    const 三 = new RegExp(S['三'], 'i');
    const 否 = new RegExp(S['否'], 'i');
    const 切れ目 = new RegExp(S['文の切れ目']);
    /* 三。表の語。SHA-256 が合う語を、naval-gazette-notes の表から取る。 */
    const T = K['肩書き'];
    const 表 = String((x.全部[T['表'].repo] || {})[T['表'].file] || '');
    const 語 = ((表.match(new RegExp(T['表']['式'], 'g')) || []).map((m) => new RegExp(T['表']['式']).exec(m)[1])).find((w) => sha(w) === T['語の SHA-256']) || null;
    if (語 === null) bad.push(T['表'].repo + '/' + T['表'].file + ' の表に、記録の SHA-256 と合う語が無い');
    const 許す = T['許す'].map((a) => Object.assign({}, a, { fileRe: new RegExp(a.file), re: new RegExp((a['行'] || a['句']).replace('{語}', esc(語 || '\u0000')), a['行'] ? 'm' : 'g') }));
    let 所在の数 = 0, 語の数 = 0;
    for (const [r, fs_] of Object.entries(x.全部)) {
      for (const [f, t] of Object.entries(fs_ || {})) {
        if (見ない.test(f) || 第三者.test(f)) continue;
        /* 一。NEMFSI のリンク。 */
        for (const m of t.matchAll(式)) {
          所在の数++;
          const w = t.slice(m.index, m.index + N['窓']);
          if (!w.includes(N['日']) || !依頼.test(w)) bad.push(r + '/' + f + ' の NEMFSI のリンクに、削除の依頼の日と語が無い');
        }
        if (引用情報.test(f) && new RegExp(N['式']).test(t)) bad.push(r + '/' + f + ' が NEMFSI を引用情報の関連に入れる');
        for (const m of t.matchAll(同じ)) if (new RegExp(N['式']).test(m[0])) bad.push(r + '/' + f + ' の sameAs に NEMFSI がある');
        /* 二。三篇と SSRN。 */
        if (t.includes('SSRN')) {
          for (const s of S['書かない']) if (t.includes(s)) bad.push(r + '/' + f + ' が「' + s.slice(0, 24) + '」と書く');
          for (const s of t.split(切れ目)) if (s.includes('SSRN') && 三.test(s) && !否.test(s)) bad.push(r + '/' + f + ' が三篇を SSRN に置くと読める文を持つ：' + s.slice(0, 40));
        }
        /* 三。使わないと決めた語。 */
        if (語 !== null && t.includes(語)) {
          let n = 0, i = -1;
          while ((i = t.indexOf(語, i + 1)) >= 0) n++;
          語の数 += n;
          const 許した = 許す.filter((a) => a.repo === r && a.fileRe.test(f)).reduce((a2, a) => a2 + (t.match(a.re) || []).length, 0);
          if (許した !== n) bad.push(r + '/' + f + ' が使わないと決めた語の英訳を、紙面の写しの形のほかで書く（' + n + ' 回、許すのは ' + 許した + ' 回）');
        }
      }
    }
    if (所在の数 < 20) bad.push('NEMFSI のリンクが ' + 所在の数 + ' しか読めない');
    /* Sophaxis の注は、その記録 2026.0001 を 2026-11-23 に著者の求めで削除して、消えた。許す所からも外した。残るのは翻刻の著者の行の二つ。 */
    if (語 !== null && 語の数 < 2) bad.push('使わないと決めた語の英訳が ' + 語の数 + ' しか読めない（翻刻の著者の行が二つあるはず）');
    /* 一。面と、生成もと。 */
    for (const [r, fl] of Object.entries(N['面'])) for (const f of fl) {
      const t = String((x.全部[r] || {})[f] || '');
      if (!new RegExp(N['式']).test(t)) bad.push(r + '/' + f + ' に NEMFSI のリンクが無い（面の一覧を見直す）');
    }
    const G = N['生成のもと'];
    let P = null;
    try { P = JSON.parse(String((x.全部[G.repo] || {})[G.file] || '')); } catch (e) { P = null; }
    const 所在 = P ? [].concat(...P.papers.map((p) => p.locations || [])).filter((l) => new RegExp(N['式']).test(l.url || '')) : [];
    if (!所在.length) bad.push(G.repo + '/' + G.file + ' に NEMFSI の所在が無い');
    for (const l of 所在) if (l[G['欄']] !== N['日']) bad.push(G.repo + '/' + G.file + ' の NEMFSI の所在の ' + G['欄'] + ' が ' + l[G['欄']]);
    /* 四。記録。 */
    for (const r of K['記録']) {
      const t = (x.全部[r] || {})['docs/legal-audit-2026-11-12.md'];
      if (!t) { bad.push(r + ' の記録が無い'); continue; }
      const a = t.indexOf('\n' + K['節'] + '\n');
      const b = a < 0 ? -1 : t.indexOf('\n## ', a + 1);
      const sec = a < 0 ? '' : t.slice(a, b < 0 ? t.length : b);
      if (!sec) { bad.push(r + ' に十一度目の節が無い'); continue; }
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
      if (T['記録'].includes(r)) {
        for (const s of T['所在'].concat([T['語の SHA-256']])) if (!sec.includes(s)) bad.push(r + ' の十一度目の節に「' + s.slice(0, 40) + '」が無い');
        if (語 !== null && sec.includes(語)) bad.push(r + ' の十一度目の節が語を書き写す');
      }
      if (r === K['Crossref']['記録']) for (const s of K['Crossref']['書くこと']) if (!sec.includes(s)) bad.push(r + ' の十一度目の節に「' + s.slice(0, 40) + '」が無い');
    }
    return bad;
  }
  const bad = 判定(実);
  check('13 のリポジトリで、NEMFSI のリンクはどれも削除の依頼を添えて sameAs と引用情報の関連に無く、生成もとが依頼の日を持ち、三篇を SSRN に置くと書く文が無く、使わないと決めた語の英訳は紙面の写しの形のほかに無く、十一度目の節が四つの記録にそろう',
    bad.length === 0, bad.slice(0, 6).join(' / '));
  const 替 = (r, f, a2, b2) => Object.assign({}, 実, { 全部: Object.assign({}, 実.全部, { [r]: Object.assign({}, 実.全部[r], { [f]: String((実.全部[r] || {})[f] || '').replace(a2, b2) }) }) });
  const 語 = (() => { try { const T = K['肩書き']; const t = String((実.全部[T['表'].repo] || {})[T['表'].file] || ''); return ((t.match(new RegExp(T['表']['式'], 'g')) || []).map((m) => new RegExp(T['表']['式']).exec(m)[1])).find((w) => sha(w) === T['語の SHA-256']) || 'x\u0000'; } catch (e) { return 'x\u0000'; } })();
  const 壊す = [
    ['論文の頁の sameAs に NEMFSI を戻す', 替('cpsbvbng26-dotcom', 'papers/fragmentarian-spiritual-individualism.html', '"sameAs": [\n        "https://doi.org/10.5281/zenodo.22064241",\n', '"sameAs": [\n        "https://doi.org/10.5281/zenodo.22064241",\n        "https://philarchive.org/rec/NEMFSI",\n')],
    ['削除の依頼を添えたまま sameAs に入れる', 替('researcher-profile', 'notes.json', '"url": "https://doi.org/10.5281/zenodo.22064241",\n', '"url": "https://doi.org/10.5281/zenodo.22064241",\n        "sameAs": "https://philarchive.org/rec/NEMFSI（2026-09-26 に削除を依頼）",\n')],
    ['英語の論文の頁の所在の欄を「Same text」に戻す', 替('cpsbvbng26-dotcom', 'papers/fragmentarian-spiritual-individualism.en.html', 'Deletion requested on 2026-09-26. Its current state has not been checked from here', 'Same text')],
    ['ノートの頁の所在の注を外す', 替('cpsbvbng26-dotcom', 'notes/index.html', '（2026-09-26 に削除を依頼。いまの状態は、ここからは確かめていません）', '')],
    ['ノートの設定の構造化データに sameAs を戻す', 替('researcher-profile', 'notes.en.json', '"url": "https://doi.org/10.5281/zenodo.22064241",\n', '"url": "https://doi.org/10.5281/zenodo.22064241",\n        "sameAs": "https://philarchive.org/rec/NEMFSI",\n')],
    ['生成もとから依頼の日を外す', 替('researcher-profile', 'papers.json', ', "deletionRequested": "2026-09-26"', '')],
    ['生成もとの依頼の日を変える', 替('researcher-profile', 'papers.json', '"deletionRequested": "2026-09-26"', '"deletionRequested": "2026-09-27"')],
    ['引用情報の説明から削除の依頼を外す', 替('autonomy-and-self-cultivation', 'CITATION.cff', 'PhilArchive の掲載ページ。2026-09-26 に削除を依頼しました。いまの状態は、ここからは確かめていません', 'PhilArchive の掲載ページ')],
    ['翻刻の書誌表から削除の依頼を外す', 替('autonomy-and-self-cultivation', 'papers/fragmentarian-spiritual-individualism.md', '（2026-09-26 に削除を依頼。いまの状態は、ここからは確かめていません）', '')],
    ['README の英語の表から削除の依頼を外す', 替('cpsbvbng26-dotcom', 'README.en.md', ' (deletion requested on 2026-09-26; its current state has not been checked from here)', '')],
    ['.zenodo.json の関連に NEMFSI を置く', 替('autonomy-and-self-cultivation', '.zenodo.json', /\n\}\s*$/, ',\n  "x": "https://philarchive.org/rec/NEMFSI (deletion requested on 2026-09-26)"\n}\n')],
    ['submission-disclosure.md の一文を戻す', 替('cpsbvbng26-dotcom', 'docs/submission-disclosure.md', 'プレプリントは置いたままにします。', '三篇は Zenodo・SSRN・PhilArchive に置いたままにします。')],
    ['正誤表の冒頭を戻す', 替('autonomy-and-self-cultivation', 'ERRATA.md', '三篇の PDF は Zenodo で公開済みで', '三篇の PDF は Zenodo・SSRN・PhilArchive で公開済みで')],
    ['引用の書き方の頁を戻す', 替('autonomy-and-self-cultivation', 'docs/how-to-cite.md', '著者による公開は Zenodo で行っており', '著者による公開は Zenodo・SSRN・PhilArchive で行って')],
    ['新しい英語の文で三篇を SSRN に置く', 替('trinity-operator', 'README.md', /$/, '\nAll three essays are on Zenodo and SSRN.\n')],
    ['naval-gazette-notes の README に語を書く', 替('naval-gazette-notes', 'README.md', /$/, '\nTakuya Nemoto, ' + 語 + '.\n')],
    ['Sophaxis の頁で語を名乗る', 替('sophaxis', 'README.md', /$/, '\nSophaxis is run by Takuya Nemoto, ' + 語 + '.\n')],
    ['翻刻の著者の行の形を変える', 替('autonomy-and-self-cultivation', 'papers/celibate-individual.md', 'Takuya Nemoto — ' + 語, 'Takuya Nemoto, ' + 語)],
    ['naval-gazette-notes の表から語を外す', 替('naval-gazette-notes', 'verification/check_text.py', "('" + 語 + "', '同上（英訳）')", "('x', '同上（英訳）')")],
    ['記録から DataCite の所在を一つ外す', 替('naval-gazette-notes', 'docs/legal-audit-2026-11-12.md', /https:\/\/api\.datacite\.org\/dois\/10\.5281\/zenodo\.22055553/g, '')],
    ['記録の語の SHA-256 を変える', 替('cpsbvbng26-dotcom', 'docs/legal-audit-2026-11-12.md', /8cd90a60fc545d0cecb6c54a0245734acb47fd9ee86060fdfc383bd6cbad25d0/g, '0'.repeat(64))],
    ['記録に語を書き写す', 替('naval-gazette-notes', 'docs/legal-audit-2026-11-12.md', '語そのものは、ここに書き写していません。', '語は「' + 語 + '」です。')],
    ['記録から Crossref の SHA-256 を外す', 替('cpsbvbng26-dotcom', 'docs/legal-audit-2026-11-12.md', '8c76309d83a868cbe77bbb38a58568090def03c377c2067994a4ecfbe3a81d24', '0'.repeat(64))],
    ['記録から十一度目の節を外す', 替('autonomy-and-self-cultivation', 'docs/legal-audit-2026-11-12.md', K ? K['節'] : 'x^', '## 十一度目')],
    ['記録の判定の数を変える', 替('researcher-profile', 'docs/legal-audit-2026-11-12.md', 'この表の判定は、誤り 3、根拠不足 1、表現 1 です。', 'この表の判定は、誤り 2、根拠不足 1、表現 1 です。')],
    ['決めた一文を外す', 替('naval-gazette-notes', 'docs/legal-audit-2026-11-12.md', /2026-11-13 に Claude が決めました。触れられないものを/, '触れられないものを')],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  check('壊して確かめる：NEMFSI（論文の頁の sameAs と所在の欄、ノートの頁と設定、生成もとの日、引用情報、翻刻の書誌表、README、.zenodo.json）・三篇と SSRN（戻した三つの文、新しい英語の文）・使わないと決めた語（二つのリポジトリ、翻刻の行の形、表）・記録（所在、SHA-256、書き写し、Crossref、節、判定の数、決めた一文）のどれでも落ちる（'
    + 落ちた.length + ' / ' + 壊す.length + '）', 落ちた.length === 壊す.length, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / '));
}

/* ---------- Vercel の Fair Use Guidelines の変更（2026-11-13） ----------
 *
 * Vercel は、最終更新の日を変えずに Fair Use Guidelines から「Commercial usage」の節を外した。利用規約の第 4 節は変わらない。
 * 一。statutes.json の Vercel の句は、Sophaxis が残す部分に一字一句あり、全文の SHA-256 は Sophaxis が記した値と同じ。
 *     利用規約の節は第 N 節の値、頁は頁の値、消えた節の句は Internet Archive の 2026-10-31 の写しの項にだけある。
 *     Vercel がまた頁を変えれば、Sophaxis の取り寄せ直しで値が変わり、ここが落ちる。
 * 二。記録と検査の注釈のほかのどのファイルも、Fair Use Guidelines を、いまの商用の定めとして書かない。
 * 三。五つの記録の十一度目の節が、取り寄せ直した頁の SHA-256 を持つ。 */
console.log('\n12s. Vercel の Fair Use Guidelines の変更：句と値、いまの定めとして書かないこと、記録（2026-11-13）');
{
  const 節 = '## 2026-11-12 の続き：十一度目の見落とし';
  const 新しい値 = '72c94595a48be0ba40257c55fcee8fc60ca983022327cdd00ced5dcfda034565';
  const 写し = 'https://web.archive.org/web/20261031091625id_/https://vercel.com/docs/limits/fair-use-guidelines';
  const 記録 = ['cpsbvbng26-dotcom', 'researcher-profile', 'trinity-operator', 'sophaxis', 'nusquama'];
  const 平 = (x) => String(x || '').replace(/\s+/g, '');
  const 部分 = (a) => (Array.isArray(a) ? a.map((y) => y.text).join(' ') : '');
  /* いまの定めとして書く文：Fair Use Guidelines と非商用・商用の例を同じ行に置き、日付も消えたことも書かない行。 */
  const いまの定め = /Fair use Guidelines|Fair Use Guidelines/i;
  const 商用 = /non-commercial|非営利|非商用|商用の例|commercial use/i;
  const 断り = /2026-11-12|2026-11-13|2026-11-08|消え|ありません|無い|no longer|until|gone|had a section|defined commercial use/i;
  const 見ない = /(^|\/)docs\/legal-audit-2026-11-12\.md$|(^|\/)docs\/world-law-2026-11-12\.md$|(^|\/)CHANGELOG\.md$|(^|\/)verification\/|(^|\/)tools\/|(^|\/)site\/llms-full\.txt$|sources-raw\.json$/;
  const 走る = (dir, rel = '') => {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const f = path.join(dir, e.name), r = rel + e.name;
      if (e.isDirectory()) out.push(...走る(f, r + '/'));
      else if (/\.(md|html|json|ya?ml|txt|js|py)$/.test(e.name)) out.push(r);
    }
    return out;
  };
  const repos = fs.readdirSync(ROOT).filter((r) => fs.existsSync(path.join(ROOT, r, '.git')));
  const 頁 = {};
  for (const r of repos) for (const f of 走る(path.join(ROOT, r))) if (!見ない.test(f)) { const t = read(r, f); if (t && いまの定め.test(t)) 頁[r + '/' + f] = t; }
  let SX = null;
  try { SX = JSON.parse(read('sophaxis', path.join('verification', 'sources-raw.json'))); } catch (e) { SX = null; }
  const 実 = {
    規約: JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')))['規約'],
    SX,
    頁,
    記録: Object.fromEntries(記録.map((r) => [r, read(r, path.join('docs', 'legal-audit-2026-11-12.md'))])),
  };
  function 判定(x) {
    const bad = [];
    if (!x.SX) return ['Sophaxis の取り寄せた文が読めない'];
    const 元 = (k, e) => {
      if (e['所在'] === 写し) { const p = (x.SX.pages || {})['vercel-fair-use-archived'] || {}; return [p.sha256, 部分(p.spans), p.url === 写し]; }
      if (e['所在'] === 'https://vercel.com/docs/limits/fair-use-guidelines') { const p = (x.SX.pages || {})['vercel-fair-use'] || {}; return [p.sha256, 部分(p.spans), true]; }
      const n = (/第(\d+)節/.exec(k) || [])[1];
      const t = (x.SX.sources || {})['vercel-terms'] || {};
      return [(t.sha256 || {})[n], 部分((t.articles || {})[n]), !!n];
    };
    const vs = Object.entries(x.規約).filter(([, e]) => /vercel\.com/.test(e['所在'] || ''));
    if (vs.length < 4) bad.push('statutes.json の Vercel の項が足りない');
    for (const [k, e] of vs) {
      const [h, 句, 所] = 元(k, e);
      if (!所 || !h || e['全文の sha256'] !== h) bad.push('値が Sophaxis と違う：' + k);
      if (!/^Sophaxis の枝 sources\/\d{8}-\d{4}/.test(e['取り寄せ'] || '')) bad.push('取り寄せの枝：' + k);
      for (const [f, v] of Object.entries(e)) if (/^引いた句/.test(f) && !平(句).includes(平(v))) bad.push('Sophaxis の残す部分に無い句：' + k);
      if (e['所在'] !== 写し && Object.entries(e).some(([f, v]) => /^引いた句/.test(f) && /Commercial usage is defined|Hobby teams are restricted|Asking for Donations/.test(v))) bad.push('消えた節の句を、いまの頁の項に置いている：' + k);
    }
    if (!vs.some(([, e]) => e['所在'] === 写し)) bad.push('写しの項が無い');
    for (const [f, t] of Object.entries(x.頁)) for (const l of t.split('\n')) if (いまの定め.test(l) && 商用.test(l) && !断り.test(l)) { bad.push('いまの定めとして書いている：' + f); break; }
    for (const r of 記録) {
      const t = x.記録[r] || '';
      const i = t.indexOf('\n' + 節 + '\n'), j = i < 0 ? -1 : t.indexOf('\n## ', i + 1);
      const sec = i < 0 ? '' : t.slice(i, j < 0 ? t.length : j);
      if (!sec.includes(新しい値)) bad.push(r + ' の十一度目の節に、取り寄せ直した値が無い');
    }
    if (!(x.記録['cpsbvbng26-dotcom'] || '').includes('五つの記録の十一度目の節が取り寄せ直した値を持つこと') || 記録.length !== 5) bad.push('記録が名乗る記録の数');
    return bad;
  }
  const bad = 判定(実);
  check('statutes.json の Vercel の句と値が Sophaxis の残す部分と値に合い、消えた節の句は写しの項にだけあり、13 のリポジトリのどの頁も Fair Use Guidelines をいまの商用の定めとして書かず（' + Object.keys(頁).length + ' のファイル）、' + 記録.length + ' つの記録の十一度目の節が取り寄せ直した値を持つ',
    bad.length === 0, bad.slice(0, 6).join(' / '));
  const 規約替 = (k, v) => Object.assign({}, 実, { 規約: Object.assign({}, 実.規約, { [k]: Object.assign({}, 実.規約[k], v) }) });
  const SX替 = (fn) => { const t = JSON.parse(JSON.stringify(実.SX)); fn(t); return Object.assign({}, 実, { SX: t }); };
  const 頁足し = (f, t) => Object.assign({}, 実, { 頁: Object.assign({}, 実.頁, { [f]: t }) });
  const 記録替 = (r, a, b) => Object.assign({}, 実, { 記録: Object.assign({}, 実.記録, { [r]: (実.記録[r] || '').split(a).join(b) }) });
  const 壊す = [
    ['頁の値を前に戻す', 規約替('Vercel の Fair use Guidelines', { '全文の sha256': 'f241dce3d1f34e326a127ae327a10d6605c0e64fb4ae91c4ed30cc8533cac58f' })],
    ['消えた節の句をいまの頁の項に戻す', 規約替('Vercel の Fair use Guidelines', { '引いた句': 'Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project' })],
    ['第 4 節の句を窓の幅で切れた形に戻す', 規約替('Vercel の利用規約 第4節', { '引いた句': 'We offer a free Hobby plan at our sole discretion. The Hobby plan is subject to all provisions of these Terms of Service' })],
    ['Vercel が第 4 節を変える', SX替((t) => { t.sources['vercel-terms'].sha256['4'] = '0'.repeat(64); })],
    ['写しの時刻を外す', SX替((t) => { t.pages['vercel-fair-use-archived'].url = 'https://web.archive.org/web/2026id_/https://vercel.com/docs/limits/fair-use-guidelines'; })],
    ['適法性の説明を前の文に戻す', 頁足し('nusquama/policies/legality.md', '- **Vercel**：サイトは Vercel の Hobby プランで配信している。Hobby プランは、個人的で非営利の利用に限られる（Vercel の [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)）。')],
    ['英語の頁に前の文を戻す', 頁足し('sophaxis/docs/legal-review.md', "Vercel's Fair Use Guidelines limit the Hobby plan to non-commercial personal use.")],
    ['記録から値を外す', 記録替('trinity-operator', 新しい値, '0'.repeat(64))],
  ];
  const 落ちた = 壊す.filter(([, y]) => 判定(y).length > 0).map(([n]) => n);
  check('壊して確かめる：頁の値・いまの頁の項の消えた句・切れた句・第 4 節の変更・写しの時刻・前の文（日英）・記録の値のどれでも落ちる（' + 落ちた.length + ' / ' + 壊す.length + '）',
    落ちた.length === 壊す.length, 壊す.filter(([n]) => !落ちた.includes(n)).map(([n]) => n).join(' / '));
}

/* ---------- 種類と状態の札、CITATION.cff の type、目録 ----------
 *
 * 各リポジトリの README の H1 のすぐ下に「種類」と「状態」の札を置いた（2026-11-11）。
 * 札は目録（researcher-profile の catalog.json）と同じ区別で書く。食い違えば落とす。
 * CITATION.cff の type は、道具が software、それ以外が dataset。 */

/* ---------- 公開の頁の書き方（2026-11-13） ----------
 * 2026-11-13 に Claude が決めた。公開の頁は運営者の立場を示し、疑いを並べない。条文から決まらない点は、決まらないことと
 * 運営者の扱いを書き、中身は点検の記録に残す。配っている頁と、免責事項と README（日本語と英語）に、続けている行いが
 * 法令に触れうると認める言い方がないことを、日本語と英語の一覧で確かめる。頁は researcher-profile の設定から作るので、
 * 作り直した頁に言い方が入れば、ここで落ちる。記録の節（表・判定の数・読んだ頁の数・決めた者と理由・弁護士の一文）もそろう。
 * 確かめる関数に壊した入力を渡し、落ちることも確かめる（壊して確かめる）。 */
console.log('\n12t. 公開の頁の書き方：続けている行いが法令に触れうると認める言い方を、配っている頁に置かない（2026-11-13）');
{
  const ADMIT_JA = ['おそれは減', 'なくなりはしません', 'なくなるわけではない', 'おそれを断たない', '余地は残る', '余地もある', '当たりうる', '言い切れません', 'はっきりしない', 'はっきりしません',
    '裁判所の判断による', '判断は裁判所による', '除ききれない', '残る危険', '違法となるおそれ', '違反するおそれ', '違反となるおそれ', '抵触するおそれ', '読む道が残ります', '無効とされる余地',
    '守るものではない', '違法の可能性', '違反の可能性'];
  const ADMIT_EN = ['does not remove the risk', 'reduces the possibility', 'a reading remains', 'risks that remain', 'risk that remains', 'risk of illegality', 'how small the risk', 'cannot be ruled out',
    'is unclear, because', 'for a court to decide', 'that is for a court', 'may also be held void', 'may still count as', 'may violate', 'may breach', 'may infringe', 'may be unlawful', 'may be illegal',
    'could be unlawful', 'could be illegal', 'might be unlawful', 'might be illegal', 'has not been settled', 'does not protect where'];
  const AUD = 'docs/legal-audit-2026-11-12.md', HEAD = '\n## 2026-11-13：公開の頁の書き方\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const R = 'cpsbvbng26-dotcom';
  const PAGES = JSON.parse(read(R, path.join('verification', 'pages.json')) || '{"pages":[]}').pages.map((p) => p.file);
  const files = PAGES.concat(['DISCLAIMER.md', 'DISCLAIMER.en.md', 'README.md', 'README.en.md']);
  function problems(c) {
    const bad = [];
    for (const f of files) for (const w of ADMIT_JA.concat(ADMIT_EN)) if (c[f].includes(w)) bad.push(f + '：' + w);
    const a = c[AUD], i = a.indexOf(HEAD), j = i < 0 ? -1 : a.indexOf('\n## ', i + 5);
    const sec = i < 0 ? '' : a.slice(i, j < 0 ? undefined : j);
    if (!sec || a.indexOf('\n## 調べた法令\n') < i) return bad.concat(['記録の節が無いか、調べた法令の後にある']);
    const t0 = sec.indexOf('\n| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |\n| --- | --- | --- | --- | --- | --- |\n');
    const rows = t0 < 0 ? [] : sec.slice(t0 + 1).split('\n\n')[0].split('\n').slice(2).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
    if (rows.length < 5 || !rows.every((y) => y.length === 6 && KINDS.includes(y[4]))) bad.push('記録の表の形');
    const m = /この表の判定は、([^。]+)です。/.exec(sec);
    const said = m ? Object.fromEntries(m[1].split('、').map((x) => { const [k, n] = x.split(' '); return [k, Number(n)]; })) : {};
    if (!m || !KINDS.every((k) => (said[k] || 0) === rows.filter((y) => y[4] === k).length)) bad.push('記録の判定の数');
    /* 読んだ頁の数。この節で読んだ数に、あとの節で配る頁に足した数（「配っている頁に、… の N 頁を足しました。」）を足すと、いまの頁の数になる。
     * 足した頁は、ここの言い方の一覧で読まれている（上の一つ目の確かめ）。2026-11-13 の運営理念・声明の節で 2 頁を足した。 */
    const 後 = j < 0 ? '' : a.slice(j, a.indexOf('\n## 調べた法令\n'));
    const 足した = [...後.matchAll(/配っている頁に、[^。]* の (\d+) 頁を足しました。/g)].reduce((n, z) => n + Number(z[1]), 0);
    if (Number((/配っている (\d+) の頁と、免責事項/.exec(sec) || [])[1]) + 足した !== PAGES.length) bad.push('読んだ頁の数');
    if ((sec.match(/2026-11-13 に Claude が決めました。/g) || []).length < 1 || !sec.includes('見つけたことと直したことを記録が示し、頁が立場を示せば、頁は確かさを言い過ぎず、理由は記録で確かめられるためです。')) bad.push('決めた者と理由');
    if (!sec.includes('1. 扱い 1：') || !sec.includes('2. 扱い 2：') || !sec.includes('12t が')) bad.push('二つの扱いか検査');
    if (!sec.includes('この節も、弁護士は見ていません。') || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(sec.replace('弁護士が確かめたとも書きません。', ''))) bad.push('弁護士の一文');
    return bad;
  }
  const real = Object.fromEntries(files.concat([AUD]).map((f) => [f, read(R, f) || '']));
  const now = problems(real);
  check('配っている頁（' + PAGES.length + '）と免責事項と README（日本語と英語）に、続けている行いが法令に触れうると認める言い方（日本語 ' + ADMIT_JA.length + '、英語 ' + ADMIT_EN.length + '）がなく、点検の記録の節がそろう',
    now.length === 0, now.slice(0, 6).join(' / '));
  const w = (f, a, b) => Object.assign({}, real, { [f]: real[f].replace(a, b) });
  const 読んだ = Number((/配っている (\d+) の頁と、免責事項/.exec(real[AUD]) || [])[1]);
  const breaks = [
    ['免責事項に認める言い方を足す', w('DISCLAIMER.md', '## 責任\n', '## 責任\n\n違法となるおそれは残りますが、続けます。\n')],
    ['英語の免責事項に認める言い方を足す', w('DISCLAIMER.en.md', '\n## ', '\nThis may be unlawful, but it goes on.\n\n## ')],
    ['トップの頁に認める言い方を足す', w('index.html', '</main>', '<p>残る危険があります。</p></main>')],
    ['英語の頁に認める言い方を足す', w('index.en.html', '</main>', '<p>The risk that remains cannot be ruled out.</p></main>')],
    ['README に認める言い方を足す', w('README.md', '\n## ', '\nどこまで違法となるおそれがあるかは言い切れません。\n\n## ')],
    ['記録の節を外す', w(AUD, HEAD, '\n## 公開の頁\n')],
    ['記録の判定の数を変える', w(AUD, 'この表の判定は、問題なし 5 です。', 'この表の判定は、問題なし 4 です。')],
    ['読んだ頁の数を変える', w(AUD, '配っている ' + 読んだ + ' の頁と、免責事項', '配っている ' + (読んだ - 1) + ' の頁と、免責事項')],
    ['あとで足した頁の数を変える', w(AUD, 'notes/mission.en.html` の 2 頁を足しました。', 'notes/mission.en.html` の 1 頁を足しました。')],
    ['決めた理由を外す', w(AUD, '頁は確かさを言い過ぎず、理由は記録で確かめられるためです。', '頁は立場を示します。')],
    ['弁護士の一文を外す', w(AUD, 'この節も、弁護士は見ていません。\n', '')],
    ['弁護士が確かめたと書く', w(AUD, 'この節も、弁護士は見ていません。\n', 'この節も、弁護士は見ていません。弁護士が確かめました。\n')],
  ];
  const missed = breaks.filter(([, x]) => problems(x).length === 0).map(([k]) => k);
  check('壊して確かめる：免責事項（日本語と英語）・トップの頁（日本語と英語）・README・記録の節・判定の数・読んだ頁の数・理由・弁護士の一文のどれでも落ちる（' + (breaks.length - missed.length) + ' / ' + breaks.length + '）',
    missed.length === 0, missed.join(' / '));
}

console.log('\n12u. 十五度目の見落とし：aiXiv.science の審査を「査読」と呼ばない（2026-11-13）');
{
  /* aiXiv.science の公式審査は、言語モデル五体の多数決である。人による査読ではない。
   * README は「言語モデル五体による公式査読」と書き、英語の「official review」とも、docs/external-evaluations.md の
   * 「人による査読ではない」とも合っていなかった。13 のリポジトリの文を読み、aiXiv を名指す文（表の行は行ごと）で
   * 「査読」が出たら、その「査読」は「ではない」「でもない」で打ち消されていなければ落とす。英語の peer review も同じ。
   * この検査のファイルは、壊して確かめるための文を持つので読まない。
   * 十六度目（2026-11-13）：英語の README は「by a panel of five language models」と、日本語の README は「言語モデル五体の多数決で」と、
   * 場の仕組みをこの稿の審査の事実として書いていた。この稿を誰が審査したかは確かめていない（docs/external-evaluations.md）。
   * aiXiv を名指す行の文（表の行は欄ごと）で「五体」「five ... models」が出たら、同じ文が場の説明であることか、
   * 確かめていないことを書いていなければ落とす。 */
  const REPOS = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check']);
  const SKIP = new Set(['.git', 'node_modules', '__pycache__', 'venv']);
  const EXT = new Set(['.md', '.html', '.json', '.yml', '.yaml', '.txt', '.js', '.py', '.toml', '.cff', '.xml', '.bib', '.csv', '.tex']);
  const SELF = path.join('cpsbvbng26-dotcom', 'verification', 'check_ecosystem.js');
  const texts = {};
  function walk(dir, repo) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, repo); continue; }
      if (!EXT.has(path.extname(e.name))) continue;
      const key = path.join(repo, path.relative(path.join(ROOT, repo), full));
      if (key === SELF) continue;
      const t = fs.readFileSync(full, 'utf8');
      if (/aixiv/i.test(t)) texts[key] = t;
    }
  }
  for (const repo of REPOS) { const dir = path.join(ROOT, repo); if (fs.existsSync(dir)) walk(dir, repo); }
  /* 点検の記録は、前の文を引いて直したことを書くので、文の検査には掛けず、節の形だけを見る。 */
  texts[path.join('cpsbvbng26-dotcom', 'docs', 'legal-audit-2026-11-12.md')] = read('cpsbvbng26-dotcom', path.join('docs', 'legal-audit-2026-11-12.md')) || '';
  const JA = /査読(?!(?:では|でも)(?:ない|なく|あり))/;
  const EN = /(?<!\bnot )\bpeer[- ]review/i;
  const FIVE = /五体|5\s*体|\bfive\b[^.。|]{0,40}\bmodels?\b|\bpanel of five\b/i;
  const HEDGE = /説明して|説明では|確かめて(?:い|は)(?:ない|ません)|取り寄せて|\bdescribes?\b|\bdescribed\b|\bnot (?:been )?(?:checked|verified)\b/i;
  const AUD = path.join('cpsbvbng26-dotcom', 'docs', 'legal-audit-2026-11-12.md'), HEAD = '\n## 2026-11-13：十五度目の見落とし\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  /* 記録の節：調べた法令の前にあり、六つの欄の表、判定の数、決めた者と理由、弁護士の一文がそろうこと。 */
  function recordProblems(a) {
    const i = a.indexOf(HEAD), j = i < 0 ? -1 : a.indexOf('\n## ', i + 5);
    const sec = i < 0 || j < 0 ? '' : a.slice(i, j);
    if (!sec || a.indexOf('\n## 調べた法令\n') < i) return ['記録の節が無いか、調べた法令の後にある'];
    const bad = [];
    const t0 = sec.indexOf('\n| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |\n| --- | --- | --- | --- | --- | --- |\n');
    const rows = t0 < 0 ? [] : sec.slice(t0 + 1).split('\n\n')[0].split('\n').slice(2).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
    if (rows.length < 5 || !rows.every((y) => y.length === 6 && KINDS.includes(y[4]))) bad.push('記録の表の形');
    const m = /この表の判定は、([^。]+)です。/.exec(sec);
    const said = m ? Object.fromEntries(m[1].split('、').map((x) => { const [k, n] = x.trim().split(' '); return [k, Number(n)]; })) : {};
    if (!m || !KINDS.every((k) => (said[k] || 0) === rows.filter((y) => y[4] === k).length)) bad.push('記録の判定の数');
    if ((sec.match(/2026-11-13 に Claude が決めました。/g) || []).length < 3 || !sec.includes('人による査読ではないことを、審査を名指す段の中で示すためです')) bad.push('決めた者と理由');
    if (!sec.includes('この一文は README の地の文で、サイトの欄からの写しではありません。')) bad.push('一文の出どころ');
    if (!sec.includes('この節も、弁護士は見ていません。') || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(sec)) bad.push('弁護士の一文');
    return bad;
  }
  function problems(c) {
    const bad = recordProblems(c[AUD] || '');
    for (const [f, t] of Object.entries(c)) {
      if (f === AUD) continue;
      for (const line of t.split('\n')) {
        if (!/aixiv/i.test(line)) continue;
        const units = /^\s*\|/.test(line) ? [line] : line.split(/(?<=[。．])|(?<=\.)\s+/);
        for (const u of units) if (/aixiv/i.test(u) && (JA.test(u) || EN.test(u))) bad.push(f + '：' + u.trim().slice(0, 60));
        /* 五体の多数決を、この稿の審査の事実として書かない。文ごと（表は欄ごと）に、場の説明か、確かめていないことを求める。 */
        for (const s of line.split(/\||(?<=[。．])|(?<=\.)\s+/)) if (FIVE.test(s) && !HEDGE.test(s)) bad.push(f + '：五体を事実として：' + s.trim().slice(0, 60));
      }
    }
    return bad;
  }
  const now = problems(texts);
  const readme = texts[path.join('cpsbvbng26-dotcom', 'README.md')] || '';
  check('13 のリポジトリで、aiXiv.science を名指す文が、その審査を打ち消しなしに「査読」（peer review）と呼んでいない（aiXiv を含む ' + (Object.keys(texts).length - 1) + ' ファイル）。点検の記録に節がそろう',
    now.length === 0 && readme.includes('場は、その審査を言語モデルの多数決と説明しています。この稿を誰が審査したかは、確かめていません。'), now.slice(0, 6).join(' / '));
  const w = (f, a, b) => Object.assign({}, texts, { [f]: (texts[f] || '').replace(a, b) });
  const RM = path.join('cpsbvbng26-dotcom', 'README.md'), SA = path.join('cpsbvbng26-dotcom', 'docs', 'self-assessment.md'), EV = path.join('cpsbvbng26-dotcom', 'docs', 'external-evaluations.md');
  const REN = path.join('cpsbvbng26-dotcom', 'README.en.md');
  const breaks = [
    ['README を前の文に戻す', w(RM, 'aiXiv.science では、場の公式審査を経た論文が 1 篇あります。', 'aiXiv.science では、言語モデル五体による公式査読を経た論文が 1 篇あります。')],
    ['自己評価の表の行を「公式査読」にする', w(SA, '| aiXiv.science の公式審査を経た論文 |', '| aiXiv.science の公式査読を経た論文 |')],
    ['外部の評価の行を「査読を経て」にする', w(EV, '| aiXiv.science | Machine-Mediated Rediscovery | `aixiv.261024.000001`（DOI ではない） | 審査を経て掲載された。', '| aiXiv.science | Machine-Mediated Rediscovery | `aixiv.261024.000001`（DOI ではない） | 査読を経て掲載された。')],
    ['英語の README を peer-reviewed にする', w(REN, 'On aiXiv.science, 1 paper has passed', 'On aiXiv.science, 1 paper was peer-reviewed and has passed')],
    ['ほかのリポジトリに足す', Object.assign({}, texts, { [path.join('sophaxis', 'README.md')]: 'aiXiv.science で査読を受けました。\n' })],
    ['記録の節を外す', w(AUD, HEAD, '\n## aiXiv の呼び方\n')],
    ['記録の判定の数を変える', w(AUD, 'この表の判定は、表現 2、問題なし 2、漏れ 1 です。', 'この表の判定は、表現 1、問題なし 2、漏れ 1 です。')],
    ['決めた理由を外す', w(AUD, '人による査読ではないことを、審査を名指す段の中で示すためです', '人による査読ではないことを示します')],
    ['弁護士の一文を外す', w(AUD, '\n\nこの節も、弁護士は見ていません。\n\n## 2026-11-13：十六度目の見落とし', '\n\n## 2026-11-13：十六度目の見落とし')],
    /* 十六度目：五体の多数決を、この稿の審査の事実として書き戻す。 */
    ['英語の README を五体の審査に戻す', w(REN, "passed the platform's official review. The platform describes its review as a vote of language models.", "passed the platform's official review by a panel of five language models.")],
    ['日本語の README を五体の多数決に戻す', w(RM, '場は、その審査を言語モデルの多数決と説明しています。', '場の審査は言語モデル五体の多数決で、人による査読ではありません。')],
    ['自己評価の表の欄を五体の多数決に戻す', w(SA, '| aiXiv.science（場は、審査を言語モデルの多数決と説明している。この稿を誰が審査したかは確かめていない） |', '| aiXiv.science（言語モデル五体の多数決） |')],
    ['外部の評価の行に、場の仕組みを事実として戻す', w(EV, '場は、その審査を言語モデルの多数決と説明している。五体のうち三体以上の受理で載るという数は、場の文を取り寄せて確かめてはいない。', '場の仕組みは、言語モデル五体のうち三体以上が受理と判定すれば載るもの。')],
    ['ほかのリポジトリに五体の審査を足す', Object.assign({}, texts, { [path.join('sophaxis', 'README.md')]: 'The paper passed review on aiXiv.science by five language models.\n' })],
  ];
  const missed = breaks.filter(([, x]) => problems(x).length === 0).map(([k]) => k);
  /* 打ち消した「査読」は通す。 */
  const negOk = problems(Object.assign({}, texts, { [path.join('sophaxis', 'README.md')]: 'aiXiv.science の審査は、人による査読ではありません。This is not peer review on aiXiv. aiXiv.science describes its review as a vote of five language models.\n' })).length === 0;
  check('壊して確かめる：README・自己評価の表・外部の評価の行・英語の README・ほかのリポジトリのどれで aiXiv の審査を査読と呼んでも、五体の多数決をこの稿の審査の事実として書いても落ち、記録の節・判定の数・理由・弁護士の一文を崩しても落ち、打ち消した「査読」と場の説明として書いた五体は通る（' + (breaks.length - missed.length + (negOk ? 1 : 0)) + ' / ' + (breaks.length + 1) + '）',
    missed.length === 0 && negOk, missed.concat(negOk ? [] : ['打ち消し']).join(' / '));
}

console.log('\n12v. 十六度目の見落とし：issue の様式は、他人の DOI・ORCID iD と、その人の記録についての道具の指摘を求めない（2026-11-13）');
{
  /* deposit-check の不具合の報告の様式は、「A DOI that shows the problem helps most.」と書き、走らせた DOI か ORCID iD と、
   * 道具の出力をそのまま貼るよう求めていた。DOI の登録情報は著者の名を持ち、出力は、その人の記録の欠けや食い違いを挙げる。
   * 2026-11-13 に Claude が決めた：道具を走らせた識別子を求める欄を持つ様式は、自分の DOI か iD で示すことを求め、
   * 記録が他人のものなら、DOI も iD も書かず、その人の記録についての指摘も貼らずに問題を書くよう求める。
   * 13 のリポジトリの .github/ISSUE_TEMPLATE/*.yml を欄ごとに読み、識別子（DOI・ORCID iD・--doi・--orcid）と、走らせる・再現する・出力を貼る語を
   * 同じ欄に持つものを「識別子を求める欄」とする。その様式は二つの文を持ち、その欄の見本に実在の形の DOI も iD も置かない。
   * どの様式にも CONTRIBUTING.md にも、識別子を出すよう誘う前の句を置かない。記録の節の形も見る。 */
  const REPOS = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check']);
  const DC = path.join('deposit-check', '.github', 'ISSUE_TEMPLATE', 'bug_report.yml');
  const DCC = path.join('deposit-check', 'CONTRIBUTING.md');
  const OWN = 'Show the problem on your own DOI or ORCID iD where you can';
  const OTHER = "If the record that shows the problem belongs to someone else, describe the problem (the rule, the field and what was expected) without naming its DOI or iD, and without pasting what the tool found about that person's record.";
  const OWN_C = "Show it on a DOI of your own work, if you can. If the deposit is someone else's, describe the problem without naming its DOI, and without pasting what the tool found about it.";
  const ID = /--doi|--orcid|\bORCID\b|\bDOIs?\b|\biDs?\b/;
  const RUN = /\brun on\b|reproduce|再現|走らせ|--doi|--orcid|paste the output|出力/i;
  const CONCRETE = /\b10\.\d{4,9}\/[^\s<>"'`]+|\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/;
  const INVITE = /helps most|Give a DOI that shows it|DOI の登録情報は公開|metadata of a DOI is public, so it can be named/;
  const AUD = path.join('cpsbvbng26-dotcom', 'docs', 'legal-audit-2026-11-12.md'), HEAD = '\n## 2026-11-13：十六度目の見落とし\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  /* 2026-11-13 の後に足した様式。権利者の知らせ（2026-11-18、利用者が求め、Claude が書いた）。 */
  const LATER = [path.join('sophaxis', '.github', 'ISSUE_TEMPLATE', 'rights.yml'), path.join('sophaxis', '.github', 'ISSUE_TEMPLATE', 'rights-ja.yml'), path.join('nusquama', '.github', 'ISSUE_TEMPLATE', 'rights.yml')];
  const forms = {}, contrib = {};
  for (const repo of REPOS) {
    const dir = path.join(ROOT, repo, '.github', 'ISSUE_TEMPLATE');
    if (fs.existsSync(dir)) fs.readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort().forEach((n) => { forms[path.join(repo, '.github', 'ISSUE_TEMPLATE', n)] = fs.readFileSync(path.join(dir, n), 'utf8'); });
    const c = read(repo, 'CONTRIBUTING.md');
    if (c !== null) contrib[path.join(repo, 'CONTRIBUTING.md')] = c;
  }
  function recordProblems(a, forms) {
    const i = a.indexOf(HEAD), j = i < 0 ? -1 : a.indexOf('\n## ', i + 5);
    const sec = i < 0 || j < 0 ? '' : a.slice(i, j);
    if (!sec || a.indexOf('\n## 調べた法令\n') < i) return ['記録の節が無いか、調べた法令の後にある'];
    const bad = [];
    const t0 = sec.indexOf('\n| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |\n| --- | --- | --- | --- | --- | --- |\n');
    const rows = t0 < 0 ? [] : sec.slice(t0 + 1).split('\n\n')[0].split('\n').slice(2).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
    if (rows.length < 8 || !rows.every((y) => y.length === 6 && KINDS.includes(y[4]))) bad.push('記録の表の形');
    const m = /この表の判定は、([^。]+)です。/.exec(sec);
    const said = m ? Object.fromEntries(m[1].split('、').map((x) => { const [k, n] = x.trim().split(' '); return [k, Number(n)]; })) : {};
    if (!m || !KINDS.every((k) => (said[k] || 0) === rows.filter((y) => y[4] === k).length)) bad.push('記録の判定の数');
    if ((sec.match(/2026-11-13 に Claude が決めました。/g) || []).length < 4) bad.push('決めた者');
    if (!sec.includes('十五度目の見落としの節の「13 のリポジトリの、aiXiv.science を名指す文」の行は、英語の README を問題なしとしていました。この判定は誤りでした。')) bad.push('十五度目の行を誤りとした文');
    if (!sec.includes('この稿を誰が審査したかは、確かめていません。')) bad.push('審査の主体を確かめていないこと');
    /* 記録が名乗る様式の数を、実際に読んだ数と突き合わせる。記録は 2026-11-13 の時点の数を書いている。それより後に足した様式は
     * LATER に名を挙げて数から除く。挙げた様式が無くなっても、挙げていない様式が増えても落ちる（2026-11-18 に Claude が決めた：
     * 記録の数を書き換えずに、同じ厳しさで突き合わせ続けるため）。 */
    const later = LATER.filter((k) => k in forms).length;
    if (later !== LATER.length) bad.push('後から足した様式が無い');
    const n = Object.keys(forms).length - later, nErr = Object.keys(forms).filter((k) => k.endsWith('error-report.yml')).length, nUsed = Object.keys(forms).filter((k) => k.endsWith('used-this-data.yml')).length;
    if (!sec.includes('deposit-check の不具合の報告のほかに、' + (n - 1) + ' 本を読みました。') || !sec.includes('誤りの知らせの様式（' + nErr + ' 本）') || !sec.includes('使われた記録の様式（' + nUsed + ' 本）')) bad.push('記録が名乗る様式の数');
    if (!sec.includes('この節も、弁護士は見ていません。') || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(sec)) bad.push('弁護士の一文');
    return bad;
  }
  /* 記録の数は、既定では読んだ様式で数える。壊し方は、数える様式を替えて渡せる。 */
  function problems(fm, cm, aud, rec = forms) {
    const bad = recordProblems(aud || '', rec);
    const asking = [];
    for (const [k, t] of Object.entries(fm)) {
      const fields = t.split(/\n  - type: /);
      const ask = fields.filter((x) => ID.test(x) && RUN.test(x));
      if (ask.length) {
        asking.push(k);
        if (!t.includes(OWN) || !t.includes(OTHER)) bad.push(k + '：自分の DOI か iD に限る文と、他人の記録のときの文が無い');
        ask.filter((x) => CONCRETE.test(x)).forEach(() => bad.push(k + '：識別子を求める欄の見本に、実在の形の DOI か iD がある'));
      }
      if (INVITE.test(t)) bad.push(k + '：識別子を出すよう誘う句');
    }
    for (const [k, t] of Object.entries(cm)) if (INVITE.test(t)) bad.push(k + '：識別子を出すよう誘う句');
    if (!asking.includes(DC)) bad.push('deposit-check の不具合の報告を、識別子を求める様式と見分けられない');
    if (!(cm[DCC] || '').includes(OWN_C)) bad.push('deposit-check の CONTRIBUTING.md に、自分の作品の DOI に限る文が無い');
    return { bad, asking };
  }
  const audText = read('cpsbvbng26-dotcom', path.join('docs', 'legal-audit-2026-11-12.md')) || '';
  const now = problems(forms, contrib, audText);
  check('13 のリポジトリの issue の様式（' + Object.keys(forms).length + ' 本）のうち、道具を走らせた識別子を求める様式（' + now.asking.length + ' 本）は、自分の DOI か iD に限り、他人の記録なら識別子も指摘も書かないよう求める。どの様式と CONTRIBUTING.md（' + Object.keys(contrib).length + ' 本）にも、識別子を出すよう誘う句が無い。点検の記録に節がそろう',
    now.bad.length === 0 && now.asking.length > 0, now.bad.slice(0, 6).join(' / ') || now.asking.join(', '));
  const wf = (k, a, b) => Object.assign({}, forms, { [k]: (forms[k] || '').replace(a, b) });
  const wc = (k, a, b) => Object.assign({}, contrib, { [k]: (contrib[k] || '').replace(a, b) });
  const breaks = [
    ['前の誘いの句を戻す', wf(DC, OWN + ': name it, and paste what the tool printed.', 'A DOI that shows the problem helps most. The metadata of a DOI is public, so it can be named here.'), contrib, audText],
    ['他人の記録のときの文を外す', wf(DC, OTHER, ''), contrib, audText],
    ['見本に実在の形の DOI を戻す', wf(DC, '--doi <your own DOI>', '--doi 10.' + '5281/zen' + 'odo.1234567'), contrib, audText],
    ['見本に ORCID iD を置く', wf(DC, '--doi <your own DOI>', '--orcid 0000-0002-1825-0097'), contrib, audText],
    ['ほかのリポジトリに識別子を求める様式を足す', Object.assign({}, forms, { [path.join('errata-check', '.github', 'ISSUE_TEMPLATE', 'x.yml')]: 'body:\n  - type: textarea\n    attributes:\n      description: The DOI it was run on, and the output.\n' }), contrib, audText],
    ['CONTRIBUTING.md に前の文を戻す', forms, wc(DCC, OWN_C, 'Give a DOI that shows it, if you can.'), audText],
    ['記録の節を外す', forms, contrib, audText.replace(HEAD, '\n## 様式\n')],
    ['記録の判定の数を変える', forms, contrib, audText.replace(/(## 2026-11-13：十六度目の見落とし[\s\S]*?この表の判定は、[^。]*?)(\d+)( です。)/, (_, a, n, b) => a + (Number(n) + 1) + b)],
    ['十五度目の行を誤りとした文を外す', forms, contrib, audText.replace('この判定は誤りでした。', '')],
    ['記録が名乗る様式の数をずらす', forms, contrib, audText.replace('deposit-check の不具合の報告のほかに、', 'deposit-check の不具合の報告のほかに、1').replace('1' + (Object.keys(forms).length - LATER.length - 1) + ' 本を読みました。', (Object.keys(forms).length - LATER.length) + ' 本を読みました。')],
    ['記録の後に足した様式を挙げずに一つ増やす', forms, contrib, audText, Object.assign({}, forms, { [path.join('nusquama', '.github', 'ISSUE_TEMPLATE', 'other.yml')]: 'name: x\n' })],
    ['後から足したと挙げた様式を外す', forms, contrib, audText, Object.fromEntries(Object.entries(forms).filter(([k]) => k !== LATER[0]))],
    /* 十七度目（2026-11-13）：後ろに節が増えたので、十六度目の節の末尾を狙う。 */
    ['弁護士の一文を外す', forms, contrib, audText.replace('\n\nこの節も、弁護士は見ていません。\n\n## 2026-11-13：十七度目の見落とし', '\n\n## 2026-11-13：十七度目の見落とし')],
  ];
  const missed = breaks.filter(([, f, c, a, r]) => problems(f, c, a, r).bad.length === 0).map(([k]) => k);
  /* 自分の識別子を求めない、ほかの様式は通る。 */
  const passOk = problems(Object.assign({}, forms, { [path.join('errata-check', '.github', 'ISSUE_TEMPLATE', 'y.yml')]: 'body:\n  - type: input\n    attributes:\n      description: A file, a page URL, or a DOI\n' }), contrib, audText).bad.length === 0;
  check('壊して確かめる：前の誘いの句・他人の記録のときの文・見本の DOI と iD・ほかのリポジトリの識別子を求める様式・CONTRIBUTING.md の前の文・記録の節と判定の数と十五度目の行の訂正と名乗る様式の数と弁護士の一文・後から足した様式の挙げ漏れと欠けのどれを崩しても落ち、識別子を走らせた先として求めない様式は通る（' + (breaks.length - missed.length + (passOk ? 1 : 0)) + ' / ' + (breaks.length + 1) + '）',
    missed.length === 0 && passOk, missed.concat(passOk ? [] : ['ほかの様式']).join(' / '));
}

console.log('\n12w. 十七度目の見落とし：issue の題と本文が Claude（Anthropic、米国）に渡ることを、同意の欄と免責事項で扱う（2026-11-13）');
{
  /* 「点検の表」の「第三者への提供」の行は、運営者が個人データを第三者へ渡す仕組みは無いとしていた。作業は Claude Code で行い、
   * issue の題と本文を読む。読んだものは Anthropic（米国）の言語モデルに渡る。Sophaxis はこれを個人情報保護法第28条の提供として扱い、
   * 様式の必須の欄で同意を得ている。2026-11-13 に Claude が決めた：同じ形を 10 のリポジトリに当てる。免責事項（両言語）に節を足し、
   * 誤りの知らせの様式（10 のリポジトリと deposit-check の 11 本）に必須の同意の欄を足し、同意の無い中身は言語モデルに渡さない。
   * 読み方は CLAUDE.md の共通の決めごと 17（deposit-check は 12）。米国の制度と Anthropic の措置の句は、Sophaxis が取り寄せた
   * 頁の句（sources-raw.json の pages の spans）にあるものだけ。第28条の句は statutes.json の文にあるものだけ。 */
  const REPOS = C.repos.concat(['deposit-check']);
  const ERR = path.join('.github', 'ISSUE_TEMPLATE', 'error-report.yml');
  const PHRASE = 'I consent to the operator giving the title and text of this issue to Claude';
  const BOX = '        - label: この issue の題と本文を、運営者が Claude（Anthropic、米国）に渡すことに同意します。 / ' + PHRASE + ' (Anthropic, United States).\n          required: true\n';
  const JA = ['issue の題と本文が言語モデルに渡るのは、次の節のとおり、本人の同意があるときだけです。', '\n## issue の中身と言語モデル\n',
    '運営者のほかの人が開いた issue の題と本文が Claude に渡ることを、運営者は、個人情報保護法第 28 条の「外国にある第三者への提供」として扱います。',
    '誤りの知らせの様式（error-report.yml）は、この節を示したうえで、題と本文が Claude に渡ることへの同意を、必須の欄で求めます。',
    'Claude に渡すのは、この欄に印を付けて開かれた issue の題と本文だけです。', 'ほかの様式の issue と、様式を通らずに開かれた issue は、Claude にもほかの言語モデルにも渡しません。',
    'コメントとメールの中身も、言語モデルに渡しません。', '同意は、issue かメールで、いつでも撤回できます。',
    'deposit-check の誤りの知らせの様式も同じ欄を持ち、そこから開かれた issue も、この節のとおりに扱います。', 'その設定は、この頁では確かめていません。'];
  const EN = ['The title and text of an issue reach a language model only with the consent of the person concerned, as the next section sets out.', '\n## Issues and the language model\n',
    "under Article 28 of Japan's Act on the Protection of Personal Information.", 'The error report form (error-report.yml) shows this section and asks, in a required box, for consent to giving the title and text to Claude.',
    'Only the title and text of an issue opened with that box ticked are given to Claude.', 'An issue from another form, and an issue opened without a form, are given neither to Claude nor to any other language model.',
    'Comments and the content of emails are not given to a language model either.', 'The consent can be withdrawn at any time, in an issue or by email.',
    'The error report form of deposit-check has the same box, and an issue opened from it is handled as this section sets out.', 'Those settings have not been checked for this page.'];
  /* 確かめられない設定に拠る約束を書かない。 */
  const PROMISE = /学習に使われ(ません|ない)|学習には使|削除されます|保存されません|not used (for|to) train|never (stored|kept|used for training)|deleted after/i;
  const RULE = ['17. **issue の中身を言語モデルに渡すのは、本人の同意がある題と本文だけにする。**', '（"' + PHRASE + '"）を引用符で囲んで渡し', '`list_issues` で一覧を取らない（本文も返る）。コメントは読まない。メールの中身は扱わない。'];
  const RULE_DC = ['12. **issue の中身を言語モデルに渡すのは、本人の同意がある題と本文だけにする。**', '`list_issues` で一覧を取らない。コメントは読まない。'];
  const AUD = path.join('cpsbvbng26-dotcom', 'docs', 'legal-audit-2026-11-12.md'), HEAD = '\n## 2026-11-13：十七度目の見落とし\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const ST = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')))['条文'];
  const rawText = read('sophaxis', path.join('verification', 'sources-raw.json'));
  const PAGES = rawText === null ? null : JSON.parse(rawText).pages || {};
  const spansOf = (k) => ((PAGES || {})[k] || {}).spans ? PAGES[k].spans.map((x) => x.text) : [];
  const x = { disc: read('cpsbvbng26-dotcom', 'DISCLAIMER.md') || '', discEn: read('cpsbvbng26-dotcom', 'DISCLAIMER.en.md') || '', aud: read('cpsbvbng26-dotcom', path.join('docs', 'legal-audit-2026-11-12.md')) || '',
    forms: Object.fromEntries(REPOS.map((r) => [r, read(r, ERR)])), claude: Object.fromEntries(REPOS.map((r) => [r, read(r, 'CLAUDE.md') || ''])) };
  const others = { bug: 0, used: 0 };
  for (const r of REPOS) { const d = path.join(ROOT, r, '.github', 'ISSUE_TEMPLATE'); if (fs.existsSync(d)) fs.readdirSync(d).forEach((n) => { if (n === 'bug_report.yml') others.bug++; if (n === 'used-this-data.yml') others.used++; }); }
  function problems(c) {
    const bad = [];
    for (const s of JA) if (!c.disc.includes(s)) bad.push('免責事項に「' + s.trim().slice(0, 24) + '」が無い');
    for (const s of EN) if (!c.discEn.includes(s)) bad.push('英語の免責事項に「' + s.trim().slice(0, 30) + '」が無い');
    if (PROMISE.test(c.disc) || PROMISE.test(c.discEn)) bad.push('免責事項が、確かめられない保ち方や使い方を約束する');
    /* 免責事項の 「…」 と "…" の句のうち、委員会と Anthropic の頁のものは、取り寄せた句そのもの。第28条の句は条文の中。 */
    if (PAGES === null) bad.push('sophaxis の sources-raw.json が並んでいない');
    else {
      const ppc = spansOf('ppc-report-us'), ant = spansOf('anthropic-privacy');
      for (const q of ['包括的な法令は存在しない。', '2012年7月25日参加', '個人情報の保護について概ね我が国と同等の保護が期待できる']) if (!ppc.includes(q) || !c.disc.includes('「' + q + '」') || !c.discEn.includes('「' + q + '」')) bad.push('委員会の句「' + q.slice(0, 12) + '」');
      const aq = (/「(appropriate technical[^」]+)」/.exec(c.disc) || [])[1], aqe = (/"(appropriate technical[^"]+)"/.exec(c.discEn) || [])[1];
      if (!aq || !ant.includes(aq) || aq !== aqe) bad.push('Anthropic の句が取り寄せた句と違う');
    }
    const a28 = (ST['個人情報保護法 第28条'] || {})['文'] || '';
    const sec = (() => { const i = c.disc.indexOf('\n## issue の中身と言語モデル\n'); const j = c.disc.indexOf('\n## ', i + 5); return i < 0 ? '' : c.disc.slice(i, j < 0 ? undefined : j); })();
    const q28 = [...sec.matchAll(/「([^」]+)」/g)].map((m) => m[1]).filter((q) => /外国|当該/.test(q) && q !== '外国にある第三者への提供');
    if (q28.length < 2 || !q28.every((q) => a28.includes(q))) bad.push('免責事項の第28条の句が条文に無い');
    /* 11 本の様式。一字一句同じで、必須の同意の欄を持つ。 */
    for (const r of REPOS) {
      const t = c.forms[r];
      if (t === null) { bad.push(r + ' に誤りの知らせの様式が無い'); continue; }
      const field = (t.split('\n  - type: ').find((f) => /^checkboxes\n    id: consent\n/.test(f)) || '') + '\n';
      if (!field.includes(BOX.trimEnd()) || !field.includes('個人情報保護法第 28 条') || !field.includes('メールの中身は、言語モデルに渡しません。') || !field.includes('The content of an email is not given to a language model.')) bad.push(r + ' の様式に必須の同意の欄が無い');
      if (t !== c.forms['cpsbvbng26-dotcom']) bad.push(r + ' の様式が cpsbvbng26-dotcom と違う');
    }
    for (const r of C.repos) if (!RULE.every((s) => c.claude[r].includes(s))) bad.push(r + ' の CLAUDE.md に決めごと 17 が無い');
    if (!RULE_DC.every((s) => c.claude['deposit-check'].includes(s))) bad.push('deposit-check の CLAUDE.md に決めごと 12 が無い');
    /* 記録の節。 */
    const a = c.aud, i = a.indexOf(HEAD), j = i < 0 ? -1 : a.indexOf('\n## ', i + HEAD.length);
    const s17 = i < 0 || j < 0 ? '' : a.slice(i, j).split('\n### 下げられずに残る危険\n').join('\n');
    if (!s17 || a.indexOf('\n## 調べた法令\n') < i) return bad.concat(['記録の節が無いか、調べた法令の後にある']);
    const t0 = s17.indexOf('\n| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |\n| --- | --- | --- | --- | --- | --- |\n');
    const rows = t0 < 0 ? [] : s17.slice(t0 + 1).split('\n\n')[0].split('\n').slice(2).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
    if (rows.length < 8 || !rows.every((y) => y.length === 6 && KINDS.includes(y[4]))) bad.push('記録の表の形');
    const m = /この表の判定は、([^。]+)です。/.exec(s17);
    const said = m ? Object.fromEntries(m[1].split('、').map((z) => { const [k, n] = z.trim().split(' '); return [k, Number(n)]; })) : {};
    if (!m || !KINDS.every((k) => (said[k] || 0) === rows.filter((y) => y[4] === k).length)) bad.push('記録の判定の数');
    for (const y of rows.filter((z) => z[4] !== '問題なし')) if (!/2026-11-13 に Claude が決めました。[^|]*ためです$/.test(y[5])) bad.push('決めた者か理由の無い行：' + y[0].slice(0, 20));
    if (!s17.includes('「点検の表」の「第三者への提供」の行は、問題なしとしていました。この判定は誤りでした。')) bad.push('前の行を誤りとした文');
    if (!s17.includes('誤りの知らせの様式（`error-report.yml`、10 のリポジトリと deposit-check の ' + REPOS.filter((r) => c.forms[r] !== null).length + ' 本）')
      || !s17.includes('ほかの様式（不具合の報告 ' + others.bug + ' 本、使われた記録 ' + others.used + ' 本）')) bad.push('記録が名乗る様式の数');
    const r28 = [...s17.matchAll(/「([^」]+)」/g)].map((z) => z[1]).filter((q) => /^あらかじめ外国|^当該外国/.test(q));
    if (r28.length < 2 || !r28.every((q) => a28.includes(q))) bad.push('記録の第28条の句が条文に無い');
    if (!s17.includes('この節も、弁護士は見ていません。') || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(s17)) bad.push('弁護士の一文');
    return bad;
  }
  const now = problems(x);
  check('免責事項（両言語）が、issue の題と本文が Claude（Anthropic、米国）に渡ることを第28条の提供として扱い、同意の無い中身を渡さないと書き、取り寄せた句だけを引く。誤りの知らせの様式（' + REPOS.length + ' 本）が一字一句同じで必須の同意の欄を持ち、CLAUDE.md に読み方があり、点検の記録に節がそろう',
    now.length === 0, now.slice(0, 6).join(' / '));
  const wf = (r, a, b) => Object.assign({}, x, { forms: Object.assign({}, x.forms, { [r]: (x.forms[r] || '').replace(a, b) }) });
  const w = (k, a, b) => Object.assign({}, x, { [k]: x[k].replace(a, b) });
  const wcl = (r, a, b) => Object.assign({}, x, { claude: Object.assign({}, x.claude, { [r]: x.claude[r].replace(a, b) }) });
  const breaks = [
    ['様式から同意の欄を外す', wf('solitary-school', /\n  - type: checkboxes\n    id: consent\n[\s\S]*$/, '\n')],
    ['同意を必須から外す', wf('deposit-check', '          required: true\n', '          required: false\n')],
    ['様式の説明からメールの扱いを外す', wf('errata-check', 'メールの中身は、言語モデルに渡しません。', '')],
    ['免責事項からコメントとメールの扱いを外す', w('disc', 'コメントとメールの中身も、言語モデルに渡しません。', '')],
    ['英語の免責事項から様式の欄を外す', w('discEn', 'The error report form (error-report.yml) shows this section and asks, in a required box, for consent to giving the title and text to Claude.', '')],
    ['免責事項に確かめられない約束を足す', w('disc', 'その設定は、この頁では確かめていません。', 'その設定は、この頁では確かめていません。題と本文は学習に使われません。')],
    ['委員会の句を変える', w('disc', '「包括的な法令は存在しない。」', '「包括的な法令は無い。」')],
    ['Anthropic の句を変える', w('discEn', 'from loss, misuse, and unauthorized access', 'from loss and unauthorized access')],
    ['第28条の句を変える', w('disc', '「あらかじめ外国にある第三者への提供を認める旨の本人の同意を得なければならない。」', '「あらかじめ本人の同意を得なければならない。」')],
    ['CLAUDE.md から読み方を外す', wcl('researcher-profile', '`list_issues` で一覧を取らない（本文も返る）。コメントは読まない。メールの中身は扱わない。', '')],
    ['deposit-check の CLAUDE.md から決めごとを外す', wcl('deposit-check', '12. **issue の中身を言語モデルに渡すのは、本人の同意がある題と本文だけにする。**', '')],
    ['記録の節を外す', w('aud', HEAD, '\n## 言語モデル\n')],
    ['記録の判定の数を変える', w('aud', 'この表の判定は、誤り 1、漏れ 4、根拠不足 1、問題なし 2 です。', 'この表の判定は、誤り 1、漏れ 3、根拠不足 1、問題なし 2 です。')],
    ['前の行を誤りとした文を外す', w('aud', '「点検の表」の「第三者への提供」の行は、問題なしとしていました。この判定は誤りでした。', '')],
    ['記録が名乗る様式の数をずらす', w('aud', 'ほかの様式（不具合の報告 ' + others.bug + ' 本', 'ほかの様式（不具合の報告 ' + (others.bug + 1) + ' 本')],
    ['決めた理由を外す', w('aud', '同意を得る前に中身が渡らないよう、issue を開くときに求めるためです |', '同意を求めます |')],
    ['弁護士の一文を外す', w('aud', '\n\nこの節も、弁護士は見ていません。\n\n## 2026-11-13：運営理念・声明', '\n\n## 2026-11-13：運営理念・声明')],
  ];
  const missed = breaks.filter(([, b]) => problems(b).length === 0).map(([k]) => k);
  check('壊して確かめる：様式の欄・必須・メールの扱い、免責事項の両言語の文・約束・委員会と Anthropic と第28条の句、CLAUDE.md の二つの決めごと、記録の節・判定の数・誤りの文・様式の数・理由・弁護士のどれを崩しても落ちる（' + (breaks.length - missed.length) + ' / ' + breaks.length + '）',
    missed.length === 0, missed.join(' / '));
}

console.log('\n12x. 運営理念・声明：頁と写しと README が同じ文で、周りの README の短い節が一字一句同じで、弁護士に依頼したと書かない。いまの事実の文と在籍の文は「現在」を持つ（2026-11-13）');
{
  /* 2026-11-13 に利用者が求めた。サイトごとに、中身に合わせた運営理念・声明を置く。このサイトの声明は researcher-profile の
   * mission.json・mission.en.json から notes/mission.html・notes/mission.en.html を作る。GitHub で読める同じ文を docs/mission.md・
   * docs/mission.en.md に置き、README（日英）に第 1 条と第 2 条を写す。周りの 10 本（免責事項が挙げる 9 と deposit-check）の README には、
   * 一字一句同じ短い節を置く。声明は拘束せず、免責事項と各ライセンスが優先する。提供しない地域の条は置かない（利用者が決めた）。
   * 弁護士には依頼していない。利用者は「弁護士が付く」と書くことを求めたが、事実と違うので、2026-11-13 に Claude が決めた：
   * 依頼していない・必要に応じて相談する・日本の法令と免責事項とライセンスに沿う・警告ではない、の四つを書く。
   * 頁・写し・README は、条ごとに見出しと項の文を取り出して比べる。どれか一つだけ直すと落ちる。 */
  const S = DECL['声明'];
  const R = 'cpsbvbng26-dotcom', RP = 'researcher-profile';
  const OPEN = S['短い節'][0], CLOSE = S['短い節'][S['短い節'].length - 1];
  const OPEN_EN = S['短い節（英語）'][0], CLOSE_EN = S['短い節（英語）'][S['短い節（英語）'].length - 1];
  const AUD = path.join('docs', 'legal-audit-2026-11-12.md'), HEAD = '\n## 2026-11-13：運営理念・声明\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const PAGES = JSON.parse(read(R, path.join('verification', 'pages.json')) || '{"pages":[]}').pages.map((p) => p.file);
  const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const mdPlain = (s) => String(s).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  /* 頁：<section id="a1">…の見出しと、<li> か <p class="profile-core"> の一つずつ。 */
  function pageUnits(h) {
    return [...String(h).matchAll(/<section id="a\d+" class="wrap block">([\s\S]*?)<\/section>/g)].map((m) => [
      plain((/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(m[1]) || [])[1] || ''),
      [...m[1].matchAll(/<li>([\s\S]*?)<\/li>|<p class="profile-core">([\s\S]*?)<\/p>/g)].map((x) => plain(x[1] || x[2]))]);
  }
  /* Markdown：見出し（level）が条の名で始まるものごとに、空でない行を項とする。番号付きの行は番号を外す。番号は 1 から順でなければ落とす。 */
  function mdUnits(t, level) {
    const out = [];
    for (const part of String(t).split('\n' + level).slice(1)) {
      const lines = part.split('\n');
      if (!/^(第 \d+ 条（|Article \d+ \()/.test(lines[0])) continue;
      const items = [];
      let n = 0;
      for (const l of lines.slice(1)) {
        if (/^#/.test(l) || l === '---') break;
        if (!l.trim()) continue;
        const m = /^(\d+)\. (.*)$/.exec(l);
        if (m) { n++; items.push(Number(m[1]) === n ? mdPlain(m[2]) : '番号のずれ'); } else items.push(mdPlain(l));
      }
      out.push([lines[0].trim(), items]);
    }
    return out;
  }
  const sectionOf = (t, head, end) => { const i = String(t).indexOf(head); if (i < 0) return ''; const j = String(t).indexOf(end, i + head.length); return String(t).slice(i, j < 0 ? undefined : j); };
  const blockOf = (t, a, b) => { const i = String(t).indexOf(a), j = String(t).indexOf(b); return i < 0 || j < 0 || j < i ? null : String(t).slice(i, j + b.length); };
  const x = {
    cfg: read(RP, 'mission.json') || '', cfgEn: read(RP, 'mission.en.json') || '',
    page: read(R, path.join('notes', 'mission.html')) || '', pageEn: read(R, path.join('notes', 'mission.en.html')) || '',
    md: read(R, path.join('docs', 'mission.md')) || '', mdEn: read(R, path.join('docs', 'mission.en.md')) || '',
    readme: read(R, 'README.md') || '', readmeEn: read(R, 'README.en.md') || '', aud: read(R, AUD) || '', sitemap: read(R, 'sitemap.xml') || '',
    homes: Object.fromEntries(['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html'].map((f) => [f, read(R, f) || ''])),
    /* 「現在」（2026-11-13 に利用者が求めた）。在籍の文を見る面と、周りの短い節のもとの並び。 */
    faces: Object.fromEntries(S['現在']['在籍']['面'].map((f) => [f, read(R, f) || ''])),
    canon: S['短い節'], canonEn: S['短い節（英語）'],
    rm: Object.fromEntries(S.repos.map((r) => [r, read(r, 'README.md')])),
    rmEn: Object.fromEntries(S.repos.map((r) => [r, read(r, 'README.en.md')])),
  };
  const N = C.repos.length;
  function problems(c) {
    const bad = [];
    /* 一。頁と設定と写し。 */
    let cj = null, ce = null;
    try { cj = JSON.parse(c.cfg); ce = JSON.parse(c.cfgEn); } catch (e) { bad.push('researcher-profile の mission.json か mission.en.json が読めない'); }
    const ja = pageUnits(c.page), en = pageUnits(c.pageEn);
    if (ja.length < 10 || ja.length !== en.length || !ja.every((u, i) => u[1].length > 0 && u[1].length === en[i][1].length)) bad.push('頁の日英の条と項の数がそろわない');
    if (cj && ce && (pageUnits(cj.blocks.map((b) => '<section id="' + b.id + '" class="wrap block"><h2>' + b.title + '</h2>' + b.html + '</section>').join('')).join('\u0000') !== ja.join('\u0000')
      || pageUnits(ce.blocks.map((b) => '<section id="' + b.id + '" class="wrap block"><h2>' + b.title + '</h2>' + b.html + '</section>').join('')).join('\u0000') !== en.join('\u0000'))) bad.push('頁が researcher-profile の設定と違う（作り直していない）');
    if (JSON.stringify(mdUnits(c.md, '## ')) !== JSON.stringify(ja)) bad.push('docs/mission.md が頁と違う');
    if (JSON.stringify(mdUnits(c.mdEn, '## ')) !== JSON.stringify(en)) bad.push('docs/mission.en.md が頁と違う');
    const tj = ja.map((u) => u[0] + ' ' + u[1].join(' ')).join(' '), te = en.map((u) => u[0] + ' ' + u[1].join(' ')).join(' ');
    for (const s of S['必須']) if (!tj.includes(s)) bad.push('頁に「' + s.slice(0, 20) + '」が無い');
    for (const s of S['必須（英語）']) if (!te.includes(s)) bad.push('英語の頁に「' + s.slice(0, 30) + '」が無い');
    const nj = Number((/免責事項が挙げる (\d+) のリポジトリ/.exec(tj) || [])[1]), ne = Number((/the (\d+) repositories listed in the Disclaimer/.exec(te) || [])[1]);
    if (nj !== N || ne !== N) bad.push('声明が名乗るリポジトリの数（' + nj + '・' + ne + '）が免責事項の ' + N + ' と違う');
    if (/提供しない|提供しません|not offered|do not offer/.test(tj + te)) bad.push('提供しない地域の条がある');
    /* 二。README（日英）の節は、第 1 条と第 2 条をそのまま写す。 */
    const rs = sectionOf(c.readme, '\n## 運営理念・声明\n', '\n責任は、法令の定めるとおりです。'), rse = sectionOf(c.readmeEn, '\n## Statement of Purpose\n', '\nLiability is as the law provides;');
    if (JSON.stringify(mdUnits(rs, '### ')) !== JSON.stringify(ja.slice(0, 2))) bad.push('README の第 1 条・第 2 条が頁と違う');
    if (JSON.stringify(mdUnits(rse, '### ')) !== JSON.stringify(en.slice(0, 2))) bad.push('英語の README の第 1 条・第 2 条が頁と違う');
    if (Number((/研究の系列の (\d+) のリポジトリ/.exec(rs) || [])[1]) !== N || Number((/for the (\d+) repositories of the research series/.exec(rse) || [])[1]) !== N) bad.push('README が名乗るリポジトリの数');
    if (!rs.includes('notes/mission.html') || !rs.includes('docs/mission.md') || !rse.includes('notes/mission.en.html') || !rse.includes('docs/mission.en.md')) bad.push('README の節から全文への道が無い');
    /* 三。トップの五言語から案内し、sitemap に二言語とも載せる。 */
    for (const [f, u] of [['index.html', './notes/mission.html'], ['index.en.html', './notes/mission.en.html'], ['index.de.html', './notes/mission.en.html'], ['index.fr.html', './notes/mission.en.html'], ['index.it.html', './notes/mission.en.html']]) if (!c.homes[f].includes('href="' + u + '"')) bad.push(f + ' から声明への道が無い');
    for (const f of ['notes/mission.html', 'notes/mission.en.html']) if (!PAGES.includes(f) || !c.sitemap.includes('https://cpsbvbng26-dotcom.vercel.app/' + f + '<')) bad.push(f + ' が配る頁か sitemap に無い');
    /* 四。周りの 10 本の短い節。一字一句同じで、全文と同じ句を持つ。 */
    const canon = c.canon.join('\n'), canonEn = c.canonEn.join('\n');
    for (const s of S['結ぶ']) if (!canon.includes(s) || !tj.includes(s)) bad.push('短い節と全文が「' + s.slice(0, 16) + '」で結ばれていない');
    for (const s of S['結ぶ（英語）']) if (!canonEn.includes(s) || !te.includes(s)) bad.push('英語の短い節と全文が「' + s.slice(0, 24) + '」で結ばれていない');
    if (!canon.includes('notes/mission.html') || !canon.includes('docs/mission.md') || !canonEn.includes('notes/mission.en.html') || !canonEn.includes('docs/mission.en.md')) bad.push('短い節から全文への道が無い');
    for (const r of S.repos) {
      const t = c.rm[r];
      if (t === null) { bad.push(r + ' に README.md が無い'); continue; }
      if (blockOf(t, OPEN, CLOSE) !== canon || t.split(OPEN).length !== 2) bad.push(r + '/README.md の短い節が違う');
      const ef = S['英語の面'][r] || (c.rmEn[r] !== null ? 'README.en.md' : null);
      if (ef) {
        const te2 = ef === 'README.md' ? t : c.rmEn[r];
        if (blockOf(te2, OPEN_EN, CLOSE_EN) !== canonEn || te2.split(OPEN_EN).length !== 2) bad.push(r + '/' + ef + ' の英語の短い節が違う');
      }
    }
    /* 四の二。「現在」。声明の頭（頁の初めの段と docs の写しの頭）に、「現在」がいつかを定める一文を置く。いまの事実を述べる文は、
     * 頁の条の中で「現在」（英語は at present）を持つ。条の中の「現在」と at present の数は、その文の数と同じ（付け落としも余りも落ちる）。
     * README の写しと周りの短い節も、それぞれの定めの一文を持つ。ZEN大学の在籍を述べる文は、どの面のどの言語でも時の印を持つ。 */
    const G = S['現在'];
    const lead = (h) => plain((/<p class="lead[^"]*">([\s\S]*?)<\/p>/.exec(h) || [])[1] || '');
    if (!lead(c.page).includes(G['定め']) || !lead(c.pageEn).includes(G['定め（英語）']) || !(cj && plain(cj.taglineHtml).includes(G['定め'])) || !(ce && plain(ce.taglineHtml).includes(G['定め（英語）']))) bad.push('頁の頭に「現在」の定めが無い');
    if (!(c.md.split('\n## 第 1 条')[0] || '').includes('\n' + G['定め'] + '\n') || !(c.mdEn.split('\n## Article 1')[0] || '').includes('\n' + G['定め（英語）'] + '\n')) bad.push('docs の写しの頭に「現在」の定めが無い');
    for (const s of G['状態の文']) if (!s.includes('現在、') || !tj.includes(s)) bad.push('いまの事実の文に「現在」が無い：' + s.slice(0, 16));
    for (const s of G['状態の文（英語）']) if (!/at present/i.test(s) || !te.includes(s)) bad.push('いまの事実の文に at present が無い：' + s.slice(0, 24));
    const nGj = (tj.match(/現在/g) || []).length, nGe = (te.match(/at present/gi) || []).length;
    if (nGj !== G['状態の文'].length || nGe !== G['状態の文（英語）'].length) bad.push('条の中の「現在」の数（' + nGj + '・' + nGe + '）が、いまの事実の文の数（' + G['状態の文'].length + '・' + G['状態の文（英語）'].length + '）と違う');
    if (!rs.includes('\n' + G['README の定め'] + '\n') || !rse.includes('\n' + G['README の定め（英語）'] + '\n')) bad.push('README の写しに「現在」の定めが無い');
    const ci = c.canon.indexOf(G['節の定め']), ce2 = c.canonEn.indexOf(G['節の定め（英語）']);
    if (ci < 1 || !c.canon.slice(ci + 1).some((l) => l.includes('現在')) || ce2 < 1 || !c.canonEn.slice(ce2 + 1).some((l) => /at present/.test(l))) bad.push('短い節に「現在」の定めが無いか、定めが「現在」より後にある');
    if (!c.canon.some((l) => l.includes('声明と免責事項は、現在、弁護士の確認を受けていません。')) || !c.canonEn.some((l) => l.includes('have not, at present, been reviewed by a lawyer.'))) bad.push('短い節の弁護士の確認の文に「現在」が無い');
    const Z = G['在籍'], RZ = new RegExp(Z['大学']), RS = new RegExp(Z['在籍'], 'i'), RM = new RegExp(Z['印'], 'i');
    const prose = (f, t) => /\.md$/.test(f)
      ? String(t).split('\n').filter((l) => !/^\s*(\||#|<|>)/.test(l)).join('\n')
      : [...String(t).replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>|<li>([\s\S]*?)<\/li>/g)].map((m) => plain(m[1] || m[2])).join('\n');
    for (const f of Z['面']) {
      const ss = prose(f, c.faces[f]).split(/\n+/).flatMap((l) => l.split(/(?<=。)|(?<=\.)\s+(?=[A-Z])/)).filter((s) => RZ.test(s) && RS.test(s));
      if (!ss.length) bad.push(f + ' に在籍の文が無い');
      for (const s of ss) if (!RM.test(s)) bad.push(f + ' の在籍の文に時の印が無い：' + s.slice(0, 30));
    }
    /* 五。弁護士に依頼した・付く・確かめたと書かない。打ち消しの文だけは通す。 */
    const L = S['弁護士の書き方'], RJ = new RegExp(L.ja), RE = new RegExp(L.en, 'i');
    const faces = [['researcher-profile/mission.json', c.cfg], ['researcher-profile/mission.en.json', c.cfgEn], ['notes/mission.html', c.page], ['notes/mission.en.html', c.pageEn],
      ['docs/mission.md', c.md], ['docs/mission.en.md', c.mdEn], ['README.md', c.readme], ['README.en.md', c.readmeEn]]
      .concat(S.repos.map((r) => [r + '/README.md', c.rm[r] || ''])).concat(S.repos.filter((r) => c.rmEn[r] !== null).map((r) => [r + '/README.en.md', c.rmEn[r]]));
    for (const [f, t] of faces) {
      const rest = L['打ち消しの文'].reduce((a, s) => a.split(s).join(''), String(t));
      if (RJ.test(rest) || RE.test(rest)) bad.push(f + ' が弁護士に依頼した・付く・確かめたと読める');
    }
    /* 六。記録の節。 */
    const a = c.aud, i = a.indexOf(HEAD), j = i < 0 ? -1 : a.indexOf('\n## ', i + HEAD.length);
    const sec = i < 0 || j < 0 ? '' : a.slice(i, j);
    if (!sec || a.indexOf('\n## 調べた法令\n') < i) return bad.concat(['記録の節が無いか、調べた法令の後にある']);
    const t0 = sec.indexOf('\n| 箇所 | 法令と条 | 要件 | 事実 | 判定 | 対応 |\n| --- | --- | --- | --- | --- | --- |\n');
    const rows = t0 < 0 ? [] : sec.slice(t0 + 1).split('\n\n')[0].split('\n').slice(2).map((l) => l.replace(/^\| | \|$/g, '').split(' | '));
    if (rows.length < 6 || !rows.every((y) => y.length === 6 && KINDS.includes(y[4]))) bad.push('記録の表の形');
    const m = /この表の判定は、([^。]+)です。/.exec(sec);
    const said = m ? Object.fromEntries(m[1].split('、').map((z) => { const [k, n] = z.trim().split(' '); return [k, Number(n)]; })) : {};
    if (!m || !KINDS.every((k) => (said[k] || 0) === rows.filter((y) => y[4] === k).length)) bad.push('記録の判定の数');
    for (const y of rows) if (!/2026-11-13 に(利用者が求め、Claude が(書きました|決めました)| Claude が決めました|利用者が決めました)。[^|]*ためです$/.test(y[5])) bad.push('決めた者か理由の無い行：' + y[0].slice(0, 16));
    const dispute = rows.find((y) => /紛争/.test(y[0]));
    if (!dispute || !dispute[5].includes('2026-11-13 に利用者が求め、Claude が決めました。') || !dispute[5].includes('事実と違い')) bad.push('紛争の行に、利用者の求めと Claude が決めたことと理由が無い');
    const k = /免責事項が挙げる (\d+) のリポジトリのうち、このリポジトリを除く (\d+) と、deposit-check/.exec(sec);
    if (!k || Number(k[1]) !== N || Number(k[2]) !== N - 1 || S.repos.length !== N || !sec.includes('周りの ' + S.repos.length + ' 本')) bad.push('記録が名乗るリポジトリの数');
    if (!sec.includes('この節も、弁護士は見ていません。') || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(sec)) bad.push('弁護士の一文');
    return bad;
  }
  const now = problems(x);
  check('運営理念・声明の頁（日英）が設定・docs の写し・README の第 1 条と第 2 条と条ごとに同じ文で、拘束しないこと・目指すもの・機関の事業でないこと・紛争の四つを書き、トップの五言語と sitemap から辿れ、周りの '
    + S.repos.length + ' 本の README の短い節が一字一句同じで全文と結ばれ、弁護士に依頼したと読める文が無く、声明の頭と README の写しと短い節に「現在」の定めがあり、いまの事実の文がどれも「現在」を持ち、ZEN大学の在籍の文がどの面でも時の印を持ち、記録の節がそろう', now.length === 0, now.slice(0, 6).join(' / '));
  const w = (k, a, b) => Object.assign({}, x, { [k]: x[k].replace(a, b) });
  const wr = (k, r, a, b) => Object.assign({}, x, { [k]: Object.assign({}, x[k], { [r]: String(x[k][r]).replace(a, b) }) });
  const wh = (f, a, b) => Object.assign({}, x, { homes: Object.assign({}, x.homes, { [f]: x.homes[f].replace(a, b) }) });
  const wf = (f, a, b) => Object.assign({}, x, { faces: Object.assign({}, x.faces, { [f]: x.faces[f].replace(a, b) }) });
  const breaks = [
    ['頁の第 2 条の一文を変える', w('page', 'それ自体で、運営者にも、読む人その他の誰にも、権利や義務を生じさせません。', 'それ自体で、運営者に義務を生じさせません。')],
    ['頁だけ直して設定を置いていく', w('pageEn', 'Its continuing is not guaranteed.', 'Its continuing is guaranteed.')],
    ['docs の写しの一項を変える', w('md', '続くことは保証しません。', '続けることを目指します。')],
    ['英語の写しの番号をずらす', w('mdEn', '\n2. Its continuing is not guaranteed.', '\n3. Its continuing is not guaranteed.')],
    ['README の第 1 条を変える', w('readme', '批判と誤りの指摘を受けることが、この場所の一番の用途です', '批判を受けることが、この場所の一番の用途です')],
    ['英語の README の第 2 条を外す', w('readmeEn', '5. This statement is not legal advice.\n', '')],
    ['目指すものの一文を外す', w('cfg', 'それが果たされることを、約束も保証もしません。', '')],
    ['機関の事業でない一文を外す', w('cfgEn', 'At present, these places are not a project of ZEN University or of any other institution. ', '')],
    ['紛争の警告でない一文を外す', w('page', '<li>この条は、誰かに対する警告ではありません。</li>', '')],
    ['リポジトリの数をずらす', w('page', '免責事項</a>が挙げる 10 のリポジトリ', '免責事項</a>が挙げる 11 のリポジトリ')],
    ['提供しない地域の条を足す', w('pageEn', '<li>This article is not a warning to anyone.</li>', '<li>This article is not a warning to anyone.</li><li>The site is not offered in some places.</li>')],
    ['トップの頁から道を外す', wh('index.fr.html', 'href="./notes/mission.en.html"', 'href="./notes/index.en.html"')],
    ['sitemap から外す', w('sitemap', 'https://cpsbvbng26-dotcom.vercel.app/notes/mission.en.html<', 'https://cpsbvbng26-dotcom.vercel.app/notes/missions.en.html<')],
    ['周りの README の短い節を一字変える', wr('rm', 'solitary-school', '権利や義務を生じさせません。', '権利を生じさせません。')],
    ['周りの README から短い節を外す', wr('rm', 'deposit-check', /<!-- 声明:ここから -->[\s\S]*<!-- 声明:ここまで -->\n/, '')],
    ['英語の短い節を変える', wr('rmEn', 'errata-check', 'This is not a warning to anyone.', 'This is a warning.')],
    ['周りの README に弁護士が付くと書く', wr('rm', 'trinity-operator', '日本の法令（国際的な事件の裁判管轄と準拠法についての定めを含む）に沿って対応します。', '日本の法令に沿って対応し、弁護士が付きます。')],
    ['英語の README に弁護士が確かめたと書く', w('readmeEn', 'Articles 1 and 2 are copied here', 'This section was reviewed by a lawyer. Articles 1 and 2 are copied here')],
    ['頁に依頼した弁護士を書く', w('page', '<li>この条は、誰かに対する警告ではありません。</li>', '<li>この条は、誰かに対する警告ではありません。顧問弁護士がいます。</li>')],
    ['頁の頭から「現在」の定めを外す', w('page', 'この声明で「現在」と書いたことは、この頁の最終更新の日の時点のことです。', '')],
    ['英語の設定の頭から「現在」の定めを外す', w('cfgEn', ' Where this statement says “at present”, it means as of the date this page was last updated.', '')],
    ['docs の写しから「現在」の定めを外す', w('md', '\nこの声明で「現在」と書いたことは、この頁の最終更新の日の時点のことです。\n', '\n')],
    ['いまの事実の文から「現在」を外す（頁と設定と写しを同じに直しても）', ['page', 'cfg', 'md'].reduce((y, k) => Object.assign(y, { [k]: y[k].replace('このサイトは、現在、運営中です。', 'このサイトは、運営中です。') }), Object.assign({}, x))],
    ['英語のいまの事実の文から at present を外す（頁と設定と写しを同じに直しても）', ['pageEn', 'cfgEn', 'mdEn'].reduce((y, k) => Object.assign(y, { [k]: y[k].replace('At present, the pages set no cookie', 'The pages set no cookie') }), Object.assign({}, x))],
    ['約束の文に「現在」を足す（頁と設定と写しを同じに直しても）', ['page', 'cfg', 'md'].reduce((y, k) => Object.assign(y, { [k]: y[k].replace('続くことは保証しません。', '現在、続くことは保証しません。') }), Object.assign({}, x))],
    ['README の写しから「現在」の定めを外す', w('readme', '写した条で「現在」と書いたことは、声明の頁の最終更新の日の時点のことです。\n', '')],
    ['英語の README の写しから「現在」の定めを外す', w('readmeEn', 'Where the articles copied here say “at present”, it means as of the date the statement’s page was last updated.\n', '')],
    ['短い節のもとの並びと全部の README から「現在」の定めを外す', Object.assign({}, x, { canon: x.canon.filter((l) => l !== S['現在']['節の定め']),
      rm: Object.fromEntries(Object.entries(x.rm).map(([r, v]) => [r, v === null ? v : v.replace(S['現在']['節の定め'] + '\n', '')])) })],
    ['短い節の弁護士の確認の文から「現在」を外す（全部の README を同じに直しても）', Object.assign({}, x, { canon: x.canon.map((l) => l.replace('声明と免責事項は、現在、弁護士', '声明と免責事項は、弁護士')),
      rm: Object.fromEntries(Object.entries(x.rm).map(([r, v]) => [r, v === null ? v : v.replace('声明と免責事項は、現在、弁護士', '声明と免責事項は、弁護士')])) })],
    ['ドイツ語のトップの頁の在籍から時の印を外す', wf('index.de.html', 'Derzeit eingeschrieben an der', 'Eingeschrieben an der')],
    ['README の紹介の在籍から「現在」を外す', wf('README.md', '計画です。現在、ZEN大学', '計画です。ZEN大学')],
    ['英語の README の自己紹介の在籍から currently を外す', wf('README.en.md', 'I am currently enrolled at ZEN University', 'I am enrolled at ZEN University')],
    ['名刺の頁の在籍から「現在」を外す', wf('card.html', '現在、ZEN大学', 'ZEN大学')],
    ['docs/collaboration.md の在籍から「現在」を外す', wf('docs/collaboration.md', '現在、ZEN大学', 'ZEN大学')],
    ['英語の声明の在籍から at present を外す', wf('notes/mission.en.html', 'The operator is, at present, a student at ZEN University.', 'The operator is a student at ZEN University.')],
    ['記録の節を外す', w('aud', HEAD, '\n## 2026-11-13：声明\n')],
    ['記録の判定の数を変える', w('aud', 'この表の判定は、表現 4、問題なし 10 です。', 'この表の判定は、表現 3、問題なし 10 です。')],
    ['紛争の行から Claude が決めた一文を外す', w('aud', '2026-11-13 に利用者が求め、Claude が決めました。事実と違う文を書かず', '事実と違う文を書かず')],
    ['行の理由を外す', w('aud', '一つの場所に二つの声明が重なって掛かることを避けるためです', '一つの場所に一つの声明にします')],
    ['記録が名乗る数をずらす', w('aud', 'このリポジトリを除く 9 と、deposit-check', 'このリポジトリを除く 8 と、deposit-check')],
    ['弁護士の一文を外す', w('aud', '\n\nこの節も、弁護士は見ていません。\n\n## 2026-11-14：意匠と免責', '\n\n## 2026-11-14：意匠と免責')],
  ];
  const missed = breaks.filter(([, b]) => problems(b).length === 0).map(([k]) => k);
  check('壊して確かめる：頁・設定・写し・番号・README・目指すもの・機関・紛争・数・地域の条・トップの道・sitemap・周りの短い節（日英）・弁護士の書き方（日英）・「現在」の定め（頁・設定・写し・README・短い節）・いまの事実の文の「現在」（日英）・約束に足した「現在」・在籍の時の印（五つの面）・記録の節・判定の数・理由・名乗る数・弁護士の一文のどれを崩しても落ちる（'
    + (breaks.length - missed.length) + ' / ' + breaks.length + '）', missed.length === 0, missed.join(' / '));
}

console.log('\n12y. 突き合わせの受付：13 の写しが同じで、どのワークフローも issue の文を環境とコマンドに入れず、求めを閉じず、記録の節がそろう（2026-11-14）');
{
  /* 2026-11-14 に利用者が求め、Claude が決めた。人が嘘をつくこと一般は止められない。止められるのは、申し立てた人がその場で書けない
   * 出どころと突き合わせられない申し立てを受けることである。道具（.github/checked-intake/verify.js）とワークフロー
   * （.github/workflows/checked-intake.yml）は 13 のリポジトリで一字一句同じにし、ここで固める。設定（config.json）はリポジトリごとで、
   * 道具の configProblems が見る。Sophaxis の検査 128 の決まり（issue・コメント・PR の本文と題を、ステップの環境にもコマンドにも入れない。
   * toJSON(github.event) も入れない）を、13 のリポジトリのすべてのワークフローに当てる。求め（削除・権利・個人の情報・同意の撤回）は閉じない。 */
  const ALL = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check']);
  const ERR11 = C.repos.concat(['deposit-check']);
  const VJS = path.join('.github', 'checked-intake', 'verify.js'), CONF = path.join('.github', 'checked-intake', 'config.json'), WFY = path.join('.github', 'workflows', 'checked-intake.yml');
  const HEAD = '\n## 2026-11-14：突き合わせの受付\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const ST = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')))['条文'];
  const LAWTEXT = Object.values(ST).map((e) => String(e['文'] || '').replace(/\s+/g, '')).concat(
    Object.values(JSON.parse(read('sophaxis', path.join('verification', 'statutes-texts.json')) || '{}')).map((t) => t.replace(/\s+/g, '')));
  const CONTRIB_HEAD = '\n## 突き合わせの受付 / Checked intake\n';
  const real = { js: {}, wf: {}, conf: {}, flows: {}, contrib: {}, aud: {}, disc: read('cpsbvbng26-dotcom', 'DISCLAIMER.md') || '', discEn: read('cpsbvbng26-dotcom', 'DISCLAIMER.en.md') || '' };
  for (const r of ALL) {
    real.js[r] = read(r, VJS); real.wf[r] = read(r, WFY); real.aud[r] = read(r, path.join('docs', 'legal-audit-2026-11-12.md')) || '';
    try { real.conf[r] = JSON.parse(read(r, CONF)); } catch (e) { real.conf[r] = null; }
    const d = path.join(ROOT, r, '.github', 'workflows');
    real.flows[r] = fs.existsSync(d) ? Object.fromEntries(fs.readdirSync(d).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => [f, fs.readFileSync(path.join(d, f), 'utf8')])) : {};
    if (ERR11.includes(r)) real.contrib[r] = read(r, 'CONTRIBUTING.md') || '';
  }
  /* 道具の文から、その中身を読み込む。壊した写しは壊したまま読み込むので、壊し方がそのまま効く。 */
  const loaded = new Map();
  const load = (src) => {
    if (!loaded.has(src)) {
      const m = { exports: {} };
      try { new Function('module', 'exports', 'require', '__dirname', String(src || '').replace(/^#!.*\n/, ''))(m, m.exports, require, path.join(ROOT, 'cpsbvbng26-dotcom', '.github', 'checked-intake')); } catch (e) { m.exports = null; }
      loaded.set(src, m.exports);
    }
    return loaded.get(src);
  };
  /* 条件（if:）の行と、その続きの行を除いた、ワークフローの残り。 */
  const outsideIf = (text) => {
    const out = []; let col = -1;
    for (const line of String(text).split('\n')) {
      const ind = line.length - line.trimStart().length;
      if (col >= 0 && line.trim() && ind > col) continue;
      col = -1;
      const m = /^(\s*(?:- )?)if:/.exec(line);
      if (m) { col = m[1].length; continue; }
      out.push(line);
    }
    return out.join('\n');
  };
  const TEXT = /github\.event\.(issue|comment|pull_request|review|discussion|discussion_comment)\.(body|title)\b|toJSON\(\s*github\.event\b|github\.event\.(issue|comment|pull_request)\s*\}\}/;
  const REQUESTS = ['この記載の削除を求めます。', '私の個人情報を消してください。', '名誉を傷つける記述です。', '著作権を侵害しています。', '同意を撤回します。', '私の氏名が誤っています。',
    'Please take down this page.', 'Remove my personal data.', 'This infringes my copyright.', 'I withdraw my consent.', 'This is defamatory.', 'My name is misspelt.',
    /* 2026-11-15：読むだけの十八度目の点検が、拾わなかった書き方として挙げたもの。拾っても閉じないことは変わらず、ラベルの目印になるだけである。 */
    'この記載は誹謗中傷なので消してください', '私の経歴が事実と違うので訂正してください', '私の住所が載っているので非公開にしてください', '載せないでください', 'Please take this down',
    'My email address is on this page, please hide it', 'The author list misspells my surname', 'unpublish my info', '利用目的を教えてください',
    /* 2026-11-15：読むだけの二度目の自動化の点検が、拾わなかった書き方として挙げたもの。全角・語の間の空白・幅のない文字・ドイツ語・フランス語。 */
    'ＧＤＰＲ に基づく求めです', '削 除してください', 'この記事を下げて', 'Bitte löschen Sie meine Daten', 'Veuillez supprimer cette page', 'de\u200Blete this page', 'Ich widerspreche der Verarbeitung meiner persönlichen Daten'];
  function problems(x) {
    const bad = [];
    const CI = load(x.js['cpsbvbng26-dotcom']);
    /* 一。道具とワークフローの 13 の写しが、一字一句同じ。 */
    const js0 = x.js['cpsbvbng26-dotcom'], wf0 = x.wf['cpsbvbng26-dotcom'];
    for (const r of ALL) {
      if (!x.js[r] || x.js[r] !== js0) bad.push(r + '：道具の写しが違う');
      if (!x.wf[r] || x.wf[r] !== wf0) bad.push(r + '：ワークフローの写しが違う');
    }
    if (!/^permissions:\n  contents: read\n  issues: write\n(?!  \w)/m.test(wf0 || '') || /^ +permissions:/m.test(wf0 || '')) bad.push('ワークフローの権限');
    if (!/node \.github\/checked-intake\/verify\.js\n {8}env:\n {10}GITHUB_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/.test(wf0 || '') || !/verify\.js --test/.test(wf0 || '')) bad.push('ワークフローの手順');
    if (/\b(sophaxis|nusquama|trinity|researcher-profile|cpsbvbng26-dotcom\.vercel)\b/i.test((js0 || '') + (wf0 || ''))) bad.push('道具が一つのリポジトリを名指す');
    /* 二。13 のリポジトリのすべてのワークフローが、issue の文を環境にもコマンドにも入れない。 */
    for (const r of ALL) for (const [f, t] of Object.entries(x.flows[r] || {})) {
      const rest = outsideIf(t);
      if (TEXT.test(rest)) bad.push(r + '/' + f + '：issue・コメント・PR の文を、条件の外で使う');
      if (/^\s+(ISSUE_BODY|ISSUE_TITLE|ISSUE_AUTHOR|COMMENT_BODY|PR_BODY|PR_TITLE|TITLE|BODY):/m.test(rest)) bad.push(r + '/' + f + '：環境に issue の文を入れる');
    }
    if (!/JSON\.parse\(fs\.readFileSync\(process\.env\.GITHUB_EVENT_PATH, 'utf8'\)\)/.test(js0 || '') || /process\.env\.(ISSUE_|COMMENT_|BODY|TITLE)/.test(js0 || '')) bad.push('道具が出来事のファイルから読まない');
    for (const m of String(js0 || '').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?:console\.(?:log|error|warn|info)|\bsay)\(([^;]*)\);/g)) {
      if (/issue\.(body|title)|\bform\b|field\(|quoteOf|\bq\b/.test(m[1].replace(/'[^']*'/g, "''"))) bad.push('道具がログに issue の文を書く');
    }
    /* 三。設定：日、形、求めを閉じないラベル。 */
    for (const r of ALL) {
      const c = x.conf[r];
      if (!c) { bad.push(r + '：設定が無い'); continue; }
      if (c.from !== '2026-12-01') bad.push(r + '：効力の日');
      if (CI && CI.configProblems(c, path.join(ROOT, r)).length) bad.push(r + '：' + CI.configProblems(c, path.join(ROOT, r)).join('、'));
      if (ERR11.includes(r)) {
        const e = (c.forms || []).find((f) => f.label === 'erratum');
        if (!e || e.kind !== 'quote' || e.where.join() !== 'どこか / Where' || e.quote.join() !== '書いてあること / What it says') bad.push(r + '：誤りの知らせの欄');
      }
      if ((c.forms || []).some((f) => f.kind === 'identity') !== (r === 'deposit-check')) bad.push(r + '：本人確認の様式');
    }
    if (x.conf.sophaxis && !['submission', 'removal', 'withdrawal', 'published'].every((l) => (x.conf.sophaxis.neverClose || []).includes(l))) bad.push('sophaxis：閉じないラベル');
    if (x.conf.nusquama && !['求め', '叙任'].every((l) => (x.conf.nusquama.neverClose || []).includes(l))) bad.push('nusquama：閉じないラベル');
    /* 四。求めは閉じない。道具の語の表と、決まった形。 */
    if (!CI) bad.push('道具が読めない');
    else {
      const miss = REQUESTS.filter((q) => !CI.legalRequest(q));
      if (miss.length) bad.push('求めと読まない：' + miss.join(' / '));
      /* 2026-11-15 から、何も閉じない。することはラベルだけで、閉じる・鍵を掛ける道は道具のどこにもない。 */
      if ([true, false, null].some((ok) => [false, true].some((legal) => Object.keys(CI.actionFor('quote', { ok, reason: 'absent' }, { legal })).join() !== 'add,remove'))) bad.push('ラベルのほかのことをする');
      if (CI.legalRequest('### What it says\n\n- [X] I consent to the operator giving the title and text of this issue to Claude.\n')) bad.push('様式の決まった欄を求めと読む');
      const code = String(js0 || '').split('function closeOrLock')[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (CI.closeOrLock(code).length || /\bstate\s*:|state_reason|\/lock\b|'PUT'/.test(code) || !/await run\(\{ event, conf: loadConf\(\), gh: github \}\)/.test(js0 || '')) bad.push('閉じる道か鍵を掛ける道がある');
      if (!/if \(byOwner\(event\)\) return say\(/.test(js0 || '') || !CI.byOwner({ sender: { login: 'Owner' }, repository: { owner: { login: 'owner' } } }) || CI.byOwner({ sender: { login: 'alice' }, repository: { owner: { login: 'owner' } } })
        || !/if: github\.event_name == 'issues' && !github\.event\.issue\.pull_request && github\.event\.sender\.login != github\.repository_owner\n/.test(wf0 || '')) bad.push('持ち主の出来事に手を出す');
    }
    /* 五。CONTRIBUTING.md の節が 11 本で同じ。免責事項（日英）。 */
    const sec = (t) => { const i = t.indexOf(CONTRIB_HEAD); if (i < 0) return null; const j = t.indexOf('\n## ', i + 5); return t.slice(i, j < 0 ? t.length : j).replace(/\nFrom 2026-12-01, a bug report[^\n]*\n?/, '\n').trimEnd(); };
    const s0 = sec(x.contrib['cpsbvbng26-dotcom'] || '');
    for (const r of ERR11) if (!s0 || sec(x.contrib[r] || '') !== s0) bad.push(r + '：CONTRIBUTING.md の節');
    if (!(x.contrib['deposit-check'] || '').includes('From 2026-12-01, a bug report (`bug_report.yml`) is checked in the same way')) bad.push('deposit-check：不具合の報告の節');
    for (const t of ['突き合わせの受付は、どの issue も閉じず、鍵も掛けません。どの issue も運営者が読みます。', '法令が受けて扱うことを求める求めは、どの言語でどう書かれても、確かめずに退けないためです。', '確かめるのは前からある文書の語であって、それが誤りかどうかではありません。']) if (!x.disc.includes(t)) bad.push('免責事項：' + t.slice(0, 10));
    if (!x.discEn.includes('The checked intake never closes or locks an issue; the operator reads every one.')) bad.push('免責事項（英語）');
    /* 六。13 の記録の節：表、判定の数、決めた者、取り寄せた文にある引用、弁護士の文。 */
    for (const r of ALL) {
      const a = x.aud[r];
      const i = a.indexOf(HEAD);
      if (i < 0) { bad.push(r + '：記録の節が無い'); continue; }
      const t = a.slice(i, a.indexOf('\n## ', i + 5) < 0 ? a.length : a.indexOf('\n## ', i + 5));
      const rows = t.split('\n').filter((l) => /^\| (?!---|箇所 \||Place \|)/.test(l)).map((l) => l.slice(2, -2).split(' | '));
      const EN = { Error: '誤り', 'Insufficient basis': '根拠不足', Omission: '漏れ', Wording: '表現', 'No problem': '問題なし' };
      const kind = (k) => EN[k] || k;
      if (rows.length < 4 || !rows.every((y) => y.length === 6 && KINDS.includes(kind(y[4])))) bad.push(r + '：記録の表');
      const n = (k) => rows.filter((y) => kind(y[4]) === k).length;
      const ja = 'この表の判定は、' + KINDS.filter((k) => n(k)).map((k) => k + ' ' + n(k)).join('、') + ' です。';
      const ja2 = '判定は、誤り ' + n('誤り') + ' 件、根拠不足 ' + n('根拠不足') + ' 件、漏れ ' + n('漏れ') + ' 件、表現 ' + n('表現') + ' 件、問題なし ' + n('問題なし') + ' 件で、合わせて ' + rows.length + ' 件です。';
      const en = 'Findings in this table: ' + Object.keys(EN).filter((k) => n(EN[k])).map((k) => k + ' ' + n(EN[k])).join(', ') + '.';
      if (!t.includes(ja) && !t.includes(ja2) && !t.includes(en)) bad.push(r + '：記録の判定の数');
      if (!t.includes('2026-11-14 に利用者が求め、Claude が決めました') || rows.some((y) => !y[5].includes('2026-11-14 に Claude が決めました'))) bad.push(r + '：決めた者');
      for (const y of rows) for (const m of y[2].matchAll(/「([^「」]+)」/g)) if (/[぀-ヿ一-鿿]{8}/.test(m[1]) && /法|条/.test(y[1]) && !LAWTEXT.some((L) => L.includes(m[1].replace(/\s+/g, '')))) bad.push(r + '：取り寄せた文にない引用「' + m[1].slice(0, 12) + '」');
      if (!/弁護士は見ていません|弁護士の確認は受けていません|No lawyer has reviewed this section/.test(t) || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(t)) bad.push(r + '：弁護士の文');
    }
    return bad;
  }
  const now = problems(real);
  let selfTest = '';
  try { selfTest = require('child_process').execFileSync('node', [path.join(ROOT, 'cpsbvbng26-dotcom', VJS), '--test'], { encoding: 'utf8' }); } catch (e) { selfTest = String(e.stdout || ''); }
  let havePdf = true;
  try { require('child_process').execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { havePdf = false; }
  const flows = ALL.reduce((a, r) => a + Object.keys(real.flows[r] || {}).length, 0);
  check('突き合わせの受付：道具とワークフローが 13 のリポジトリで一字一句同じで、13 のリポジトリのワークフロー（' + flows + ' 本）のどれも issue の文を環境とコマンドに入れず、設定と求めの語と閉じる道と CONTRIBUTING.md（11 本）と免責事項と 13 の記録の節がそろう',
    now.length === 0, now.slice(0, 6).join(' / '));
  check('突き合わせの受付の道具の自己検査が、すべての枝で通る' + (havePdf ? '（PDF の場合を含む）' : '（pdftotext が無く、PDF の場合は走らない）'),
    /\d+ passed, 0 failed/.test(selfTest) && (!havePdf || !selfTest.includes('the PDF case was not run')), selfTest.split('\n').filter((l) => /FAIL/.test(l)).join(' / '));
  const w = (k, r, v) => Object.assign({}, real, { [k]: Object.assign({}, real[k], { [r]: v }) });
  const flowsWith = (r, f, t) => Object.assign({}, real, { flows: Object.assign({}, real.flows, { [r]: Object.assign({}, real.flows[r], { [f]: t }) }) });
  const breaks = [
    ['一つの写しの道具を変える', w('js', 'trinity-operator', (real.js['trinity-operator'] || '') + '\n')],
    ['一つの写しのワークフローを変える', w('wf', 'nusquama', (real.wf.nusquama || '').replace('cancel-in-progress: true', 'cancel-in-progress: false'))],
    ['ワークフローの権限を広げる', w('wf', 'cpsbvbng26-dotcom', (real.wf['cpsbvbng26-dotcom'] || '').replace('  issues: write\n', '  issues: write\n  contents: write\n'))],
    ['issue の本文を環境に入れる', flowsWith('errata-check', 'verify.yml', (real.flows['errata-check']['verify.yml'] || '') + '        env:\n          ISSUE_BODY: ${{ github.event.issue.body }}\n')],
    ['出来事を丸ごと環境に入れる', flowsWith('self-correction', 'hygiene.yml', (real.flows['self-correction']['hygiene.yml'] || '') + '        env:\n          EVENT: ${{ toJSON(github.event) }}\n')],
    ['コメントの本文をコマンドに入れる', flowsWith('deposit-check', 'check.yml', (real.flows['deposit-check']['check.yml'] || '') + '      - run: echo "${{ github.event.comment.body }}"\n')],
    ['効力の日を早める', w('conf', 'solitary-school', Object.assign({}, real.conf['solitary-school'], { from: '2026-11-15' }))],
    ['設定に求めのラベルを取る', w('conf', 'justice-and-algorithms', Object.assign({}, real.conf['justice-and-algorithms'], { forms: real.conf['justice-and-algorithms'].forms.concat([{ label: 'removal', kind: 'quote', where: ['W'], quote: ['Q'] }]) }))],
    ['Sophaxis の削除を閉じないラベルから外す', w('conf', 'sophaxis', Object.assign({}, real.conf.sophaxis, { neverClose: real.conf.sophaxis.neverClose.filter((l) => l !== 'removal') }))],
    ['Nusquama の求めを閉じないラベルから外す', w('conf', 'nusquama', Object.assign({}, real.conf.nusquama, { neverClose: ['叙任'] }))],
    ['求めの語を表から外す', Object.assign({}, real, { js: Object.fromEntries(ALL.map((r) => [r, (real.js[r] || '').replace("'削除', ", '')])) })],
    ['閉じる道を戻す', Object.assign({}, real, { js: Object.fromEntries(ALL.map((r) => [r, (real.js[r] || '').replace("  await gh('POST', '/issues/' + n + '/labels', { labels: act.add });", "  await gh('POST', '/issues/' + n + '/labels', { labels: act.add });\n  if (result.ok === false) await gh('PATCH', '/issues/' + n, { state: 'closed', state_reason: 'not_planned' });")])) })],
    ['鍵を掛ける道を足す', Object.assign({}, real, { js: Object.fromEntries(ALL.map((r) => [r, (real.js[r] || '').replace("  await gh('POST', '/issues/' + n + '/labels', { labels: act.add });", "  await gh('POST', '/issues/' + n + '/labels', { labels: act.add });\n  await gh('PUT', '/issues/' + n + '/lock', {});")])) })],
    ['持ち主が開き直した issue にも手を出す', Object.assign({}, real, { js: Object.fromEntries(ALL.map((r) => [r, (real.js[r] || '').replace('  if (byOwner(event)) return say(', '  if (false) return say(')])) })],
    ['ワークフローが持ち主の出来事でも走る', Object.assign({}, real, { wf: Object.fromEntries(ALL.map((r) => [r, (real.wf[r] || '').replace(' && github.event.sender.login != github.repository_owner', '')])) })],
    ['設定から needs a person を外す', w('conf', 'trinity-infinity', Object.assign({}, real.conf['trinity-infinity'], { neverClose: (real.conf['trinity-infinity'].neverClose || []).filter((l) => l !== 'needs a person') }))],
    ['CONTRIBUTING.md の節を一本だけ変える', w('contrib', 'naval-gazette-notes', (real.contrib['naval-gazette-notes'] || '').replace('新しい issue で出し直せば、もう一度確かめる。', '出し直しはできない。'))],
    ['免責事項から閉じない文を外す', Object.assign({}, real, { disc: real.disc.replace('突き合わせの受付は、どの issue も閉じず、鍵も掛けません。どの issue も運営者が読みます。', '') })],
    ['記録の節を外す', w('aud', 'researcher-profile', real.aud['researcher-profile'].replace(HEAD, '\n## 突き合わせ\n'))],
    ['記録の判定の数を変える', w('aud', 'trinity-infinity', real.aud['trinity-infinity'].replace(/(## 2026-11-14：突き合わせの受付[\s\S]*?この表の判定は、問題なし )(\d+)/, (m0, a, b) => a + (Number(b) + 1)))],
    ['記録の引用を一語変える', w('aud', 'autonomy-and-self-cultivation', real.aud['autonomy-and-self-cultivation'].replace('遅滞なく必要な調査を行い', '遅滞なく調査を行い'))],
    ['英語の記録から弁護士の文を外す', w('aud', 'deposit-check', real.aud['deposit-check'].replace(/(## 2026-11-14：突き合わせの受付[\s\S]*?)No lawyer has reviewed this section\./, '$1'))],
  ];
  const missed = breaks.filter(([, y]) => problems(y).length === 0).map(([k]) => k);
  check('壊して確かめる：道具とワークフローの一つの写し・権限・issue の本文と出来事とコメントを環境とコマンドに入れること・効力の日・設定の求めのラベル・Sophaxis と Nusquama の閉じないラベル・求めの語・閉じる道・鍵を掛ける道・持ち主の出来事（道具とワークフロー）・設定の needs a person・CONTRIBUTING.md の一本・免責事項・記録の節と判定の数と引用と英語の弁護士の文のどれでも落ちる（' + (breaks.length - missed.length) + ' / ' + breaks.length + '）',
    missed.length === 0, missed.join(' / '));
}

console.log('\n12z. 十八度目の点検：突き合わせの受付は 13 のリポジトリのどこでも閉じず、鍵も掛けず、持ち主の出来事に手を出さない。様式・CONTRIBUTING.md・免責事項が閉じると書かず、免責事項の「情報の扱い」が deposit-check を挙げ、13 の記録に節がある（2026-11-15）');
{
  /* 2026-11-15 に、読むだけの十八度目の点検が見つけた。語の並び（LEGAL）は求めの書き方を拾いきれず、閉じる道が残る限り求めを閉じえた。
   * 直し方は 2026-11-15 に Claude が決めた。道具は何も閉じず、鍵も掛けない。持ち主の出来事に手を出さない。免責事項の「情報の扱い」は、
   * 2026-12-01 から不具合の報告の本人を確かめる deposit-check にも掛かる。12y は道具と設定を、ここは頁と記録を見る。 */
  const ALL = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check']);
  const ERR11 = C.repos.concat(['deposit-check']);
  const HEAD = '\n## 2026-11-15：十八度目の点検\n';
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const EN = { Error: '誤り', 'Insufficient basis': '根拠不足', Omission: '漏れ', Wording: '表現', 'No problem': '問題なし' };
  const ST = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')))['条文'];
  const LAWTEXT = Object.values(ST).map((e) => String(e['文'] || '').replace(/\s+/g, '')).concat(
    ['sophaxis', 'nusquama'].flatMap((r) => Object.values(JSON.parse(read(r, path.join('verification', 'statutes-texts.json')) || '{}')).map((t) => String(t).replace(/\s+/g, ''))));
  const ERR = path.join('.github', 'ISSUE_TEMPLATE', 'error-report.yml');
  const real = { aud: {}, form: {}, contrib: {}, disc: read('cpsbvbng26-dotcom', 'DISCLAIMER.md') || '', discEn: read('cpsbvbng26-dotcom', 'DISCLAIMER.en.md') || '',
    dcReadme: read('deposit-check', 'README.md') || '', dcBug: read('deposit-check', path.join('.github', 'ISSUE_TEMPLATE', 'bug_report.yml')) || '' };
  for (const r of ALL) real.aud[r] = read(r, path.join('docs', 'legal-audit-2026-11-12.md')) || '';
  for (const r of ERR11) { real.form[r] = read(r, ERR) || ''; real.contrib[r] = read(r, 'CONTRIBUTING.md') || ''; }
  /* 閉じると書いた前の文。どの様式・CONTRIBUTING.md・免責事項・deposit-check の様式にも戻さない。 */
  const OLD = ['決まった文のコメントを付けて閉じます', '決まった文のコメントを付けて閉じる', 'the issue is closed with a fixed comment', 'is closed with a fixed comment', 'closed as not planned', 'This issue stays closed',
    'なければ、決まった文のコメントを付けて閉じ', '自動では閉じません。'];
  const FORM_JA = '突き合わせの受付は、どの issue も閉じず、人が読みます。', FORM_EN = 'The checked intake never closes an issue; a person reads every one.';
  const CONTRIB_JA = '突き合わせの受付は、どの issue も閉じず、鍵も掛けない。どの issue も人が読む。', CONTRIB_EN = 'The checked intake never closes or locks an issue; a person reads every one.';
  function problems(x) {
    const bad = [];
    const f0 = x.form['cpsbvbng26-dotcom'];
    for (const r of ERR11) {
      if (x.form[r] !== f0) bad.push(r + '：誤りの知らせの様式の写しが違う');
      if (!x.contrib[r].includes(CONTRIB_JA) || !x.contrib[r].includes(CONTRIB_EN)) bad.push(r + '：CONTRIBUTING.md が閉じないと書かない');
      for (const t of OLD) if (x.form[r].includes(t) || x.contrib[r].includes(t)) bad.push(r + '：閉じると書く「' + t.slice(0, 16) + '」');
    }
    if (!f0.includes(FORM_JA) || !f0.includes(FORM_EN)) bad.push('様式が閉じないと書かない');
    for (const t of OLD) if (x.disc.includes(t) || x.discEn.includes(t) || x.dcBug.includes(t)) bad.push('免責事項か deposit-check の様式が閉じると書く「' + t.slice(0, 16) + '」');
    if (!x.dcBug.includes('No issue is closed or locked by the check; a person reads every report.')) bad.push('deposit-check の不具合の報告の様式');
    /* 免責事項の「情報の扱い」が deposit-check を挙げ、目的・読むもの・残さないことを書き、deposit-check の README と様式がそこを指す。 */
    const sec = (t, h) => { const i = t.indexOf(h); const j = i < 0 ? -1 : t.indexOf('\n## ', i + h.length); return i < 0 ? '' : t.slice(i, j < 0 ? t.length : j); };
    const info = sec(x.disc, '\n## 情報の扱い\n'), infoEn = sec(x.discEn, '\n## Information\n');
    for (const t of ['この節は、上の 10 のリポジトリに加えて、deposit-check のリポジトリにも掛かります。', '不具合を知らせた人を確かめることにだけ使います。', '報告に書かれた ORCID iD の公開の記録のうちリンクの欄と、報告に書かれた DOI の登録情報（DataCite か Crossref）のうち作成者の ORCID iD だけです。', '残さず、issue にもコメントにも実行の記録にも写しません。', '本人からの開示・訂正・利用の停止・消去の求めは']) if (!info.includes(t)) bad.push('免責事項「情報の扱い」：' + t.slice(0, 14));
    for (const t of ['This section applies, besides the 10 repositories above, to the deposit-check repository.', 'and to check who reports a bug.', 'It is not kept, and it is not copied into the issue, a comment or the log of the run.']) if (!infoEn.includes(t)) bad.push('Disclaimer "Information": ' + t.slice(0, 20));
    if (!x.dcReadme.includes('DISCLAIMER.en.md#information') || !x.dcReadme.includes('DISCLAIMER.md#情報の扱い') || !x.dcBug.includes('DISCLAIMER.en.md#information')) bad.push('deposit-check の README と様式が免責事項を指さない');
    /* 13 の記録の節。 */
    for (const r of ALL) {
      const a = x.aud[r], i = a.indexOf(HEAD);
      if (i < 0) { bad.push(r + '：記録の節が無い'); continue; }
      const t = a.slice(i, a.indexOf('\n## ', i + 5) < 0 ? a.length : a.indexOf('\n## ', i + 5));
      const rows = t.split('\n').filter((l) => /^\| (?!---|箇所 \||Place \|)/.test(l)).map((l) => l.slice(2, -2).split(' | '));
      const kind = (k) => EN[k] || k;
      if (rows.length < 4 || !rows.every((y) => y.length === 6 && KINDS.includes(kind(y[4])))) bad.push(r + '：記録の表');
      const n = (k) => rows.filter((y) => kind(y[4]) === k).length;
      const ja = 'この表の判定は、' + KINDS.filter((k) => n(k)).map((k) => k + ' ' + n(k)).join('、') + ' です。';
      const ja2 = '判定は、誤り ' + n('誤り') + ' 件、根拠不足 ' + n('根拠不足') + ' 件、漏れ ' + n('漏れ') + ' 件、表現 ' + n('表現') + ' 件、問題なし ' + n('問題なし') + ' 件で、合わせて ' + rows.length + ' 件です。';
      const en = 'Findings in this table: ' + Object.keys(EN).filter((k) => n(EN[k])).map((k) => k + ' ' + n(EN[k])).join(', ') + '.';
      if (!t.includes(ja) && !t.includes(ja2) && !t.includes(en)) bad.push(r + '：記録の判定の数');
      if (!/直し方は 2026-11-15 に Claude が決めました。|Claude decided the fixes on 2026-11-15/.test(t) || rows.some((y) => !y[5].includes('2026-11-15 に Claude が決めました'))) bad.push(r + '：決めた者');
      if (!/2026-11-14 の節のその行は「問題なし」としていましたが、誤りでした|The row of 2026-11-14 judged this "No problem"; that was wrong/.test(t)) bad.push(r + '：前の行の誤りを書かない');
      for (const y of rows) for (const m of y[2].matchAll(/「([^「」]+)」/g)) if (/[぀-ヿ一-鿿]{8}/.test(m[1]) && /法|条/.test(y[1]) && !LAWTEXT.some((L) => L.includes(m[1].replace(/\s+/g, '')))) bad.push(r + '：取り寄せた文にない引用「' + m[1].slice(0, 12) + '」');
      if (!/弁護士は見ていません|弁護士の確認は受けていません|No lawyer has reviewed this section/.test(t) || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(t)) bad.push(r + '：弁護士の文');
    }
    return bad;
  }
  const now = problems(real);
  check('十八度目の点検：誤りの知らせの様式（' + ERR11.length + ' 本）と CONTRIBUTING.md と免責事項（日英）と deposit-check の様式が閉じないと書き、前の文を戻さず、免責事項の「情報の扱い」が deposit-check を挙げて目的と読むものと残さないことを書き、deposit-check の README と様式がそこを指し、' + ALL.length + ' の記録に節がある',
    now.length === 0, now.slice(0, 6).join(' / '));
  const w = (k, r, v) => Object.assign({}, real, { [k]: Object.assign({}, real[k], { [r]: v }) });
  const breaks = [
    ['一つの様式を閉じる文に戻す', w('form', 'solitary-school', (real.form['solitary-school'] || '').replace(FORM_EN, 'If they do not, the issue is closed with a fixed comment.'))],
    ['一つの CONTRIBUTING.md から閉じない文を外す', w('contrib', 'errata-check', (real.contrib['errata-check'] || '').replace(CONTRIB_JA, ''))],
    ['英語の免責事項を閉じる文に戻す', Object.assign({}, real, { discEn: real.discEn.replace('The checked intake never closes or locks an issue; the operator reads every one.', 'If they do not, the issue is closed with a fixed comment.') })],
    ['deposit-check の様式を閉じる文に戻す', Object.assign({}, real, { dcBug: real.dcBug.replace('No issue is closed or locked by the check; a person reads every report.', 'If either check fails, the issue is closed with a fixed comment.') })],
    ['「情報の扱い」から deposit-check を外す', Object.assign({}, real, { disc: real.disc.replace('この節は、上の 10 のリポジトリに加えて、deposit-check のリポジトリにも掛かります。\n', '') })],
    ['英語の「Information」から目的を外す', Object.assign({}, real, { discEn: real.discEn.replace(', to keep the record of use, and to check who reports a bug.', ', and to keep the record of use.') })],
    ['読んだものを残す', Object.assign({}, real, { disc: real.disc.replace('残さず、issue にもコメントにも実行の記録にも写しません。', 'issue に写します。') })],
    ['deposit-check の README が指さない', Object.assign({}, real, { dcReadme: real.dcReadme.replace('DISCLAIMER.en.md#information', 'DISCLAIMER.en.md') })],
    ['記録の節を外す', w('aud', 'naval-gazette-notes', real.aud['naval-gazette-notes'].replace(HEAD, '\n## 2026-11-15：点検\n'))],
    ['記録の判定の数を変える', w('aud', 'justice-and-algorithms', real.aud['justice-and-algorithms'].replace(/(## 2026-11-15：十八度目の点検[\s\S]*?この表の判定は、誤り )(\d+)/, (m0, a, b) => a + (Number(b) + 1)))],
    ['前の行の誤りを書かない', w('aud', 'self-correction', real.aud['self-correction'].replace('2026-11-14 の節のその行は「問題なし」としていましたが、誤りでした', '2026-11-14 の節のその行は残します'))],
    ['記録の引用を一語変える', w('aud', 'trinity-operator', real.aud['trinity-operator'].replace(/(## 2026-11-15：十八度目の点検[\s\S]*?)遅滞なく必要な調査を行い/, '$1遅滞なく調査を行い'))],
    ['英語の記録から弁護士の文を外す', w('aud', 'deposit-check', real.aud['deposit-check'].replace(/(## 2026-11-15：十八度目の点検[\s\S]*?)No lawyer has reviewed this section\./, '$1'))],
    ['Nusquama の記録で決めた者を外す', w('aud', 'nusquama', real.aud.nusquama.replace('直し方は 2026-11-15 に Claude が決めました。', '直しました。'))],
  ];
  const missed = breaks.filter(([, y]) => problems(y).length === 0).map(([k]) => k);
  check('壊して確かめる：一つの様式・一つの CONTRIBUTING.md・英語の免責事項・deposit-check の様式を閉じる文に戻すこと、「情報の扱い」の deposit-check・英語の目的・残さないこと・README の指し先、記録の節と判定の数と前の行の誤りと引用と英語の弁護士の文と Nusquama の決めた者のどれでも落ちる（'
    + (breaks.length - missed.length) + ' / ' + breaks.length + '）', missed.length === 0, missed.join(' / '));
}

console.log('\n12za. 自動化を固める：13 のリポジトリのワークフローが表のとおりに起こされて権限を持ち、時間の上限と鍵を残さない checkout と固めた pip を持ち、同時実行の組が出来事の見本で正しく、見張りと写しと記録がそろう（2026-11-15）');
{
  /* 2026-11-15 に、読むだけの二度の点検が、13 のリポジトリのワークフローの乗っ取りへの備えと、黙って止まる仕組みを洗い出した。
   * 2026-11-15 に利用者が決め、Claude が書いた。ここで固めるもの:
   *   一  起こす出来事と権限（全体と仕事ごと）が verification/workflows.json の表と一字一句同じ。表はファイルから作らない。
   *       pull_request_target・workflow_run・write-all はどこにも置けない。書く権限を持つ仕事は、式（${{ }}）から ref も repository も取らない。
   *   二  どの仕事にも timeout-minutes があり、60 分まで。長い四つだけは LONG の分と同じ。
   *   三  push しない仕事（contents: write を持たない仕事）の checkout は persist-credentials: false。Sophaxis の removal.yml はすべて。
   *   四  書く権限か id-token を持つワークフローと横断の検査の pip は、版とハッシュを固めた一覧からだけ入れる。一覧のどの行も版とハッシュを持つ。
   *   五  tools/live.js は四つのリポジトリで、tools/ua.js は三つで一字一句同じ。道具にはどのリポジトリの名も無く、設定は自分の場だけを名指す。
   *   六  見張り（tools/heartbeat.js）は二つの写しが同じで、自己検査が通り、見本の古い定期の仕事で落ちる。issues に書くのは見張りの仕事だけ。
   *   七  同時実行の組：出来事の見本で式を評価し、仕事の if が偽なら、その実行だけの組に入り、真なら決まった組に入る。
   *   八  自分の issue を探す道具は、一覧を終わりの頁まで読む（4 頁目の issue を見つける）。受付の道具は、取り消しのあとの確かめ直しで二つ目のコメントを作らない。
   *   九  13 の記録の節。cpsbvbng26-dotcom の記録に、13 のリポジトリの main の枝の規則の勧めがある。
   * GitHub の同時実行の振る舞いは取り寄せて確かめていないので、どちらに振る舞っても正しい形（スキップされた仕事が場所を取らない）を見る。 */
  const ALL = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check']);
  const HEAD = '\n## 2026-11-15：自動化を固める\n';
  /* 2026-11-19：cpsbvbng26-dotcom の記録は、この節の後に「2026-11-19：誤りの知らせの様式が YAML として読めなかった」（13h が中身を見る）と、
   * 「2026-11-19：読むだけの法令の点検を受けて」（A1・A2・B4・C1 などの直し）を、この順に一つずつ持つ。 */
  const LATER_SECTIONS = { sophaxis: ['2026-11-18：名称と商標'], nusquama: ['2026-11-18：名称と商標', '2026-11-19：参加のハードル', '2026-11-23：日本の外に出たことがないこと'], 'cpsbvbng26-dotcom': ['2026-11-19：誤りの知らせの様式が YAML として読めなかった', '2026-11-19：読むだけの法令の点検を受けて', '2026-11-22：デザインに関する法的な扱いの頁'] };
  const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
  const EN = { Error: '誤り', 'Insufficient basis': '根拠不足', Omission: '漏れ', Wording: '表現', 'No problem': '問題なし' };
  const DECIDED = '2026-11-15 に利用者が決め、Claude が書きました';
  const MAX = 60;
  const LONG = { 'nusquama/world.yml/fetch': 340, 'errata-check/swh-save.yml/save': 150, 'cpsbvbng26-dotcom/wayback.yml/save': 90, 'sophaxis/watch.yml/watch': 180 };
  const LIVE4 = ['sophaxis', 'nusquama', 'cpsbvbng26-dotcom', 'trinity-operator'], UA3 = ['nusquama', 'cpsbvbng26-dotcom', 'trinity-operator'];
  const LOCKS = { 'cpsbvbng26-dotcom/ecosystem.yml': '.github/requirements-ecosystem.txt', 'errata-check/pypi.yml': '.github/requirements-pypi.txt' };
  const NAMES = ALL.filter((r) => r !== 'nusquama').concat(['cpsbvbng26']);
  const real = { table: null, flows: {}, live: {}, ua: {}, liveConf: {}, liveYml: {}, hb: {}, hbConf: {}, aud: {}, locks: {},
    uptime: read('cpsbvbng26-dotcom', path.join('verification', 'uptime.js')) || '', linkcheck: read('cpsbvbng26-dotcom', path.join('verification', 'linkcheck.js')) || '',
    verify: read('cpsbvbng26-dotcom', path.join('.github', 'checked-intake', 'verify.js')) || '', checkAll: read('cpsbvbng26-dotcom', path.join('verification', 'check_all.js')) || '' };
  try { real.table = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'workflows.json'))); } catch (e) { real.table = null; }
  for (const r of ALL) {
    const d = path.join(ROOT, r, '.github', 'workflows');
    real.flows[r] = fs.existsSync(d) ? Object.fromEntries(fs.readdirSync(d).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => [f, fs.readFileSync(path.join(d, f), 'utf8')])) : {};
    real.aud[r] = read(r, path.join('docs', 'legal-audit-2026-11-12.md')) || '';
  }
  for (const r of LIVE4) { real.live[r] = read(r, path.join('tools', 'live.js')); real.liveConf[r] = read(r, path.join('tools', 'live.json')); real.ua[r] = read(r, path.join('tools', 'ua.js')); }
  for (const r of ['cpsbvbng26-dotcom', 'sophaxis']) { real.hb[r] = read(r, path.join('tools', 'heartbeat.js')); real.hbConf[r] = read(r, path.join('tools', 'heartbeat.json')); }
  for (const [k, f] of Object.entries(LOCKS)) real.locks[k] = read(k.split('/')[0], f);

  /* ---- ワークフローを読む。決まった形（ブロックの YAML、二つ空けの字下げ）の外は、読めないものとして表と合わない。 */
  const permsOf = (head, rest, ind) => {
    if (head.trim()) return head.trim();
    const out = {};
    for (const l of rest) {
      const m = new RegExp('^ {' + ind + '}([a-z-]+): (read|write|none)\\s*$').exec(l);
      if (!m) return '<読めない>';
      out[m[1]] = m[2];
    }
    return out;
  };
  function parseFlow(text) {
    const lines = String(text).replace(/\r/g, '').split('\n');
    const block = (i, ind) => { const out = []; for (let k = i + 1; k < lines.length; k++) { const l = lines[k]; if (l.trim() === '' || /^\s*#/.test(l)) continue; if (l.length - l.trimStart().length < ind) break; out.push(l); } return out; };
    const res = { on: null, perms: null, jobs: {}, topConcurrency: false };
    lines.forEach((l, i) => {
      let m;
      if ((m = /^on:(.*)$/.exec(l))) res.on = m[1].trim() ? ['<一行で書いた on: ' + m[1].trim() + '>'] : block(i, 2).filter((x) => /^ {2}\S/.test(x)).map((x) => x.trim().replace(/:.*$/, '')).sort();
      if ((m = /^permissions:(.*)$/.exec(l))) res.perms = permsOf(m[1], block(i, 2), 2);
      if (/^concurrency:/.test(l)) res.topConcurrency = true;
    });
    const at = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    let cur = null;
    for (const l of at < 0 ? [] : lines.slice(at + 1)) {
      if (/^\S/.test(l)) break;
      const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
      if (m) { cur = res.jobs[m[1]] = { lines: [] }; continue; }
      if (cur) cur.lines.push(l);
    }
    for (const j of Object.values(res.jobs)) {
      const L = j.lines;
      const sub = (i, ind) => { const out = []; for (let k = i + 1; k < L.length; k++) { const l = L[k]; if (l.trim() === '' || /^\s*#/.test(l)) continue; if (l.length - l.trimStart().length < ind) break; out.push(l); } return out; };
      j.perms = null; j.timeout = null; j.group = null; j.cancel = null; j.if = null;
      L.forEach((l, i) => {
        let m;
        if ((m = /^ {4}permissions:(.*)$/.exec(l))) j.perms = permsOf(m[1], sub(i, 6), 6);
        if ((m = /^ {4}timeout-minutes:\s*(\d+)\s*$/.exec(l))) j.timeout = Number(m[1]);
        if ((m = /^ {6}group:\s*(.+?)\s*$/.exec(l))) j.group = m[1];
        if ((m = /^ {6}cancel-in-progress:\s*(\S+)\s*$/.exec(l))) j.cancel = m[1];
        if ((m = /^ {4}if:\s*(.*?)\s*$/.exec(l))) j.if = /^>-?$/.test(m[1]) ? sub(i, 6).map((x) => x.trim()).join(' ') : m[1];
      });
      if (j.if) j.if = j.if.replace(/^\$\{\{([\s\S]*)\}\}$/, '$1').trim();
      /* 手順。「      - 」で始まる行から次のそれまで。 */
      j.steps = [];
      for (const l of L) { if (/^ {6}- /.test(l)) j.steps.push([l]); else if (j.steps.length && (/^ {8}/.test(l) || l.trim() === '')) j.steps[j.steps.length - 1].push(l); }
      j.steps = j.steps.map((s) => s.join('\n'));
    }
    return res;
  }
  const writes = (p) => (typeof p === 'string' ? /write/.test(p) : Object.values(p || {}).some((v) => v === 'write'));
  const effective = (flow, j) => (j.perms !== null ? j.perms : flow.perms);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const code = (t) => String(t).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

  /* ---- GitHub の式の小さな評価器。この 13 のリポジトリが組の名と if に使う形（|| && ! == != 括弧 文字列 数 format contains always）だけを読む。 */
  function evalExpr(src, ctx) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "'") { let j = i + 1, s = ''; for (; j < src.length; j++) { if (src[j] === "'" && src[j + 1] === "'") { s += "'"; j++; continue; } if (src[j] === "'") break; s += src[j]; } if (j >= src.length) throw new Error('閉じない文字列'); toks.push({ t: 'str', v: s }); i = j + 1; continue; }
      const two = src.slice(i, i + 2);
      if (['&&', '||', '==', '!='].includes(two)) { toks.push({ t: two }); i += 2; continue; }
      if ('()!,'.includes(c)) { toks.push({ t: c }); i++; continue; }
      let m = /^\d+/.exec(src.slice(i));
      if (m) { toks.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_-]*(?:\.(?:\*|[A-Za-z_][A-Za-z0-9_-]*))*/.exec(src.slice(i));
      if (m) { toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
      throw new Error('読めない字「' + src.slice(i, i + 8) + '」');
    }
    let p = 0;
    const peek = () => toks[p] || {};
    const eat = (t) => { if (peek().t !== t) throw new Error(t + ' が無い'); p++; };
    const truthy = (v) => !(v === false || v === null || v === undefined || v === 0 || v === '');
    const eq = (a, b) => {
      if (a === null || a === undefined) return b === null || b === undefined;
      if (b === null || b === undefined) return false;
      return typeof a === 'string' && typeof b === 'string' ? a.toLowerCase() === b.toLowerCase() : String(a) === String(b);
    };
    const resolve = (name) => {
      let cur = [ctx], star = false;
      for (const part of name.split('.')) {
        if (part === '*') { star = true; cur = cur.flatMap((x) => (Array.isArray(x) ? x : [])); continue; }
        cur = cur.map((x) => (x !== null && typeof x === 'object' && part in x ? x[part] : undefined));
      }
      return star ? cur.filter((x) => x !== undefined) : (cur[0] === undefined ? null : cur[0]);
    };
    const call = (f, a) => {
      if (f === 'format') return String(a[0]).replace(/\{(\d+)\}/g, (_, k) => String(a[Number(k) + 1] ?? ''));
      if (f === 'contains') return Array.isArray(a[0]) ? a[0].some((x) => eq(x, a[1])) : String(a[0] ?? '').toLowerCase().includes(String(a[1] ?? '').toLowerCase());
      if (f === 'always') return true;
      throw new Error('知らない関数 ' + f);
    };
    let or;
    const prim = () => {
      const k = toks[p++] || {};
      if (k.t === 'str' || k.t === 'num') return k.v;
      if (k.t === '(') { const v = or(); eat(')'); return v; }
      if (k.t === '!') return !truthy(prim());
      if (k.t === 'id') {
        if (peek().t === '(') { p++; const a = []; if (peek().t !== ')') { a.push(or()); while (peek().t === ',') { p++; a.push(or()); } } eat(')'); return call(k.v, a); }
        if (k.v === 'true') return true;
        if (k.v === 'false') return false;
        if (k.v === 'null') return null;
        return resolve(k.v);
      }
      throw new Error('式の形');
    };
    const cmp = () => { let v = prim(); while (peek().t === '==' || peek().t === '!=') { const op = toks[p++].t; const r = prim(); v = op === '==' ? eq(v, r) : !eq(v, r); } return v; };
    const and = () => { let v = cmp(); while (peek().t === '&&') { p++; const r = cmp(); v = truthy(v) ? r : v; } return v; };
    or = () => { let v = and(); while (peek().t === '||') { p++; const r = and(); v = truthy(v) ? v : r; } return v; };
    const v = or();
    if (p !== toks.length) throw new Error('式の残り');
    return v;
  }
  const truthy = (v) => !(v === false || v === null || v === undefined || v === 0 || v === '');
  const interp = (s, ctx) => String(s).replace(/\$\{\{([\s\S]*?)\}\}/g, (_, e) => String(evalExpr(e, ctx) ?? ''));
  const OWNER = 'cpsbvbng26-dotcom';
  const ctxOf = (repo, name, event, runId, extra = {}) => ({ github: { event_name: name, event: Object.assign({ sender: { login: 'alice' } }, event), repository_owner: OWNER, repository: OWNER + '/' + repo, run_id: runId, ref: 'refs/heads/main' }, inputs: extra.inputs || {} });
  const issue = (n, labels, o = {}) => Object.assign({ number: n, labels: labels.map((x) => ({ name: x })) }, o);
  /* 出来事の見本。[名, 出来事の名, 出来事]。同じ見本を二つの run_id で評価する。 */
  const FIX = {
    'checked-intake.yml': [
      ['よその人の issue #5', 'issues', { action: 'opened', issue: issue(5, ['erratum']) }, 'checked-intake-issue-5'],
      ['よその人の issue #6', 'issues', { action: 'edited', issue: issue(6, ['erratum']) }, 'checked-intake-issue-6'],
      ['持ち主の issue #5（名の大小が違う）', 'issues', { action: 'edited', sender: { login: 'CPSBVBNG26-Dotcom' }, issue: issue(5, ['erratum']) }, null],
      ['push', 'push', {}, null], ['PR', 'pull_request', { pull_request: { number: 9 } }, null]],
    'sophaxis/removal.yml': [
      ['削除の issue を開く', 'issues', { action: 'opened', issue: issue(11, ['removal']) }, { intake: 'removal' }],
      ['持ち主が upheld を付ける', 'issues', { action: 'labeled', label: { name: 'upheld' }, sender: { login: OWNER }, issue: issue(11, ['removal', 'upheld']) }, { decide: 'removal' }],
      ['持ち主が取り下げに not-upheld を付ける', 'issues', { action: 'labeled', label: { name: 'not-upheld' }, sender: { login: OWNER }, issue: issue(12, ['withdrawal', 'not-upheld']) }, { decide: 'removal' }],
      ['よその人が upheld を付ける', 'issues', { action: 'labeled', label: { name: 'upheld' }, issue: issue(11, ['removal', 'upheld']) }, {}],
      ['持ち主がほかのラベルを付ける', 'issues', { action: 'labeled', label: { name: 'question' }, sender: { login: OWNER }, issue: issue(11, ['removal', 'question']) }, {}],
      ['投稿の issue を開く', 'issues', { action: 'opened', issue: issue(13, ['submission']) }, {}],
      ['毎日の手順', 'schedule', {}, { remind: 'removal' }], ['手で起こす', 'workflow_dispatch', {}, { manual: 'removal' }]],
    'sophaxis/record.yml': [
      ['持ち主が見張りの枝の PR に record を付ける', 'pull_request', { action: 'labeled', label: { name: 'record' }, sender: { login: OWNER }, pull_request: { head: { repo: { full_name: OWNER + '/sophaxis' }, ref: 'statutes/record' } } }, { record: 'removal' }],
      ['よその人が付ける', 'pull_request', { action: 'labeled', label: { name: 'record' }, pull_request: { head: { repo: { full_name: OWNER + '/sophaxis' }, ref: 'statutes/record' } } }, {}],
      ['ほかの枝', 'pull_request', { action: 'labeled', label: { name: 'record' }, sender: { login: OWNER }, pull_request: { head: { repo: { full_name: OWNER + '/sophaxis' }, ref: 'claude/x' } } }, {}],
      ['よそのリポジトリの枝', 'pull_request', { action: 'labeled', label: { name: 'record' }, sender: { login: OWNER }, pull_request: { head: { repo: { full_name: 'mallory/sophaxis' }, ref: 'statutes/record' } } }, {}]],
    'sophaxis/intake.yml': [
      ['投稿の issue #7', 'issues', { action: 'edited', issue: issue(7, ['submission']) }, { intake: 'intake-issue-7' }],
      ['投稿の issue #8', 'issues', { action: 'opened', issue: issue(8, ['submission']) }, { intake: 'intake-issue-8' }],
      ['確かめの語のあるコメント', 'issue_comment', { action: 'created', comment: { user: { type: 'User' }, body: 'I vouch for this submission to Sophaxis' }, issue: issue(7, ['submission']) }, {}],
      ['確かめの語の無いコメント', 'issue_comment', { action: 'created', comment: { user: { type: 'User' }, body: 'thanks' }, issue: issue(7, ['submission']) }, {}],
      ['取り下げの issue', 'issues', { action: 'opened', issue: issue(9, ['withdrawal']) }, { withdrawal: 'intake-withdrawal-9' }],
      ['出版の issue', 'issues', { action: 'opened', issue: issue(10, ['published']) }, { published: 'intake-published-10' }],
      ['毎日の手順', 'schedule', {}, { deadline: 'intake-daily' }]],
    'nusquama/reporter.yml': [
      ['よその人の誤りの issue #3', 'issues', { action: 'opened', issue: issue(3, ['誤り']) }, { place: 'reporter-issue-3' }],
      ['持ち主の誤りの issue #3', 'issues', { action: 'edited', sender: { login: OWNER }, issue: issue(3, ['誤り']) }, {}],
      ['PR', 'issues', { action: 'opened', issue: issue(4, ['誤り'], { pull_request: {} }) }, {}],
      ['ラベルの無い issue', 'issues', { action: 'opened', issue: issue(5, []) }, {}]],
  };
  /* 一つのワークフローの、見本ごとの組の答え。if が偽の仕事は run ごとに違う組、真の仕事は表の組。表に無い真の仕事は、run ごとに違う組。 */
  function groupProblems(repo, file, text, fixtures) {
    const bad = [];
    const f = parseFlow(text);
    if (f.topConcurrency) bad.push(repo + '/' + file + '：同時実行の組をワークフローの全体に置く');
    const grouped = Object.entries(f.jobs).filter(([, j]) => j.group);
    if (!grouped.length) bad.push(repo + '/' + file + '：組が無い');
    for (const [name, ev, event, want] of fixtures) {
      for (const [id, j] of grouped) {
        let g1, g2, on;
        try { g1 = interp(j.group, ctxOf(repo, ev, event, 1001)); g2 = interp(j.group, ctxOf(repo, ev, event, 1002)); on = j.if ? truthy(evalExpr(j.if, ctxOf(repo, ev, event, 1001))) : true; } catch (e) { bad.push(repo + '/' + file + ' ' + id + '：式が読めない（' + e.message + '）'); continue; }
        const shared = typeof want === 'string' || want === null ? want : (want[id] || null);
        if (!on && shared !== null) bad.push(repo + '/' + file + ' ' + id + '：見本（' + name + '）で仕事の if が偽');
        if (!on && g1 === g2) bad.push(repo + '/' + file + ' ' + id + '：動かない実行（' + name + '）が共有の組「' + g1 + '」に入る');
        if (on && shared !== null && (g1 !== shared || g2 !== shared)) bad.push(repo + '/' + file + ' ' + id + '：' + name + ' の組が「' + g1 + '」');
        if (shared === null && g1 === g2) bad.push(repo + '/' + file + ' ' + id + '：' + name + ' が共有の組「' + g1 + '」に入る');
      }
    }
    return bad;
  }

  /* ---- 非同期の見本（子の工程で回す）：一覧の頁、受付の確かめ直し。 */
  const CHILD = String.raw`
    const path = require('path'), Mod = require('module');
    const S = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    process.env.GITHUB_TOKEN = 'x'; process.env.GITHUB_REPOSITORY = 'o/r';
    const load = (src, file, env) => { const m = { exports: {} }; const old = process.env; process.env = Object.assign({}, old, env || {});
      try { new Function('module', 'exports', 'require', '__dirname', '__filename', String(src).replace(/^#!.*\n/, ''))(m, m.exports, Mod.createRequire(file), path.dirname(file), file); } finally { process.env = old; } return m.exports; };
    /* 350 の issue：1〜3 頁は 100 ずつ、4 頁目は 50。2 頁目に印を持つ PR、4 頁目に印を持つ issue #321。 */
    const items = (mark) => Array.from({ length: 350 }, (_, k) => k === 150 ? { number: 151, pull_request: {}, body: mark } : k === 320 ? { number: 321, state: 'closed', body: mark + '\n' } : { number: k + 1, body: 'other' });
    const pageOf = (url, list) => { const per = Number((/[?&]per_page=(\d+)/.exec(url) || [, 30])[1]); const page = Number((/[?&]page=(\d+)/.exec(url) || [, 1])[1]); return list.slice((page - 1) * per, page * per); };
    const out = {};
    (async () => {
      for (const k of ['uptime', 'linkcheck']) {
        const calls = [];
        let broken = false;
        globalThis.fetch = async (url, o) => { const u = String(url); const m = (o && o.method) || 'GET'; calls.push(m + ' ' + u); const body = broken ? { message: 'x' } : (m === 'GET' ? pageOf(u, items(S.marks[k])) : { number: 999 }); return { ok: true, status: 200, json: async () => body }; };
        const log = console.log; console.log = () => {};
        try {
          const M = load(S[k], S.files[k], { GITHUB_TOKEN: 'x', GITHUB_REPOSITORY: 'o/r' });
          const up = M.upsert || M.upsertIssue;
          await up('body', 1);
          out[k + 'Page4'] = calls.some((c) => /^PATCH .*\/issues\/321$/.test(c)) && !calls.some((c) => /^POST /.test(c) || /\/issues\/151$/.test(c));
          broken = true; calls.length = 0;
          try { await up('body', 1); out[k + 'NotList'] = false; } catch (e) { out[k + 'NotList'] = !calls.some((c) => /^POST /.test(c)); }
        } catch (e) { out[k + 'Page4'] = false; out[k + 'NotList'] = false; }
        console.log = log;
      }
      try {
        const L = load(S.live, S.files.live, {});
        const got = await L.allPages(async (m, u) => pageOf(u, items(L.MARK)), '/issues?state=open');
        out.livePage4 = got.length === 350 && got.some((i) => i.number === 321);
        try { await L.allPages(async () => ({ message: 'x' }), '/issues'); out.liveNotList = false; } catch (e) { out.liveNotList = true; }
      } catch (e) { out.livePage4 = false; out.liveNotList = false; }
      try {
        /* 受付：一つ目の実行が取り消され（何もしない）、編まれた issue の二つ目の実行と、同じ出来事の三つ目の実行が、一つのコメントとそのときのラベルを残す。 */
        const V = load(S.verify, S.files.verify, {});
        const ID = '0000-0002-1825-0097';
        const conf = { forms: [{ label: 'bug', kind: 'identity', orcid: ['Your ORCID iD'], doi: ['Your DOI (optional)'] }], neverClose: ['needs a person'], from: '2026-12-01' };
        const look = async (k, id) => (k === 'orcid' && id === ID ? { 'researcher-url': [{ url: { value: 'https://github.com/alice' } }] } : null);
        const st = { comments: [], labels: new Set(), next: 1 };
        const gh = async (m, u, b) => {
          if (m === 'GET') return st.comments.map((c) => Object.assign({}, c));
          if (m === 'POST' && /\/comments$/.test(u)) { st.comments.push({ id: st.next++, user: { type: 'Bot' }, body: b.body }); return {}; }
          if (m === 'PATCH') { const c = st.comments.find((x) => '/issues/comments/' + x.id === u); if (c) c.body = b.body; return {}; }
          if (m === 'DELETE') { st.labels.delete(decodeURIComponent(u.split('/').pop())); return {}; }
          if (m === 'POST') { b.labels.forEach((l) => st.labels.add(l)); return {}; }
          return {};
        };
        const ev = (action, login, body) => ({ action, sender: { login: 'alice' }, repository: { owner: { login: 'example' } }, issue: { number: 7, state: 'open', created_at: '2026-12-02T00:00:00Z', title: 't', user: { login }, labels: [{ name: 'bug' }], body } });
        const bodyOf = (id) => '### Your ORCID iD\n\n' + id + '\n\n### Your DOI (optional)\n\n_No response_\n';
        const say = () => {};
        await V.run({ event: ev('opened', 'alice', bodyOf('0000-0001-5109-3700')), conf, gh, look, say });
        const afterFirst = [...st.labels].join();
        await V.run({ event: ev('edited', 'alice', bodyOf(ID)), conf, gh, look, say });
        await V.run({ event: ev('edited', 'alice', bodyOf(ID)), conf, gh, look, say });
        out.verifyRerun = st.comments.length === 1 && st.labels.has(V.LABELS.identity) && !st.labels.has(V.LABELS.notFound) && afterFirst.includes(V.LABELS.notFound);
      } catch (e) { out.verifyRerun = false; }
      process.stdout.write(JSON.stringify(out));
    })();`;
  const markOf = (src, re) => (re.exec(src) || [, ''])[1];
  const asyncProbe = (x) => {
    try {
      return JSON.parse(require('child_process').execFileSync('node', ['-e', CHILD], { encoding: 'utf8', input: JSON.stringify({
        uptime: x.uptime, linkcheck: x.linkcheck, live: x.live['cpsbvbng26-dotcom'], verify: x.verify,
        marks: { uptime: markOf(x.uptime, /const MARK = '([^']+)'/), linkcheck: markOf(x.linkcheck, /const MARK = '([^']+)'/) },
        files: { uptime: path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'uptime.js'), linkcheck: path.join(ROOT, 'cpsbvbng26-dotcom', 'verification', 'linkcheck.js'),
          live: path.join(ROOT, 'cpsbvbng26-dotcom', 'tools', 'live.js'), verify: path.join(ROOT, 'cpsbvbng26-dotcom', '.github', 'checked-intake', 'verify.js') } }) }));
    } catch (e) { return {}; }
  };
  /* 見張りの判定を、写しの文から読み込む。 */
  const loadHb = (src) => {
    const file = path.join(ROOT, 'cpsbvbng26-dotcom', 'tools', 'heartbeat.js');
    const m = { exports: {} };
    try { new Function('module', 'exports', 'require', '__dirname', '__filename', String(src || '').replace(/^#!.*\n/, ''))(m, m.exports, require('module').createRequire(file), path.dirname(file), file); } catch (e) { return null; }
    return m.exports;
  };

  /* 見張りの自己検査を、写しの文のまま回す（壊した写しは、壊したまま回る）。tools/ の写しを一時の場所に置き、heartbeat.js だけを差し替える。 */
  const hbRan = new Map();
  const hbSelf = (src) => {
    if (!hbRan.has(src)) {
      const os = require('os');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-'));
      let ok = false;
      try {
        for (const f of ['ua.js', 'heartbeat.json']) fs.copyFileSync(path.join(ROOT, 'cpsbvbng26-dotcom', 'tools', f), path.join(dir, f));
        fs.writeFileSync(path.join(dir, 'heartbeat.js'), String(src || ''));
        ok = /\d+ passed, 0 failed/.test(require('child_process').execFileSync('node', [path.join(dir, 'heartbeat.js'), '--test'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      } catch (e) { ok = false; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
      hbRan.set(src, ok);
    }
    return hbRan.get(src);
  };
  function problems(x, probe) {
    const bad = [];
    const T = x.table;
    /* 一。表と同じ。 */
    if (!T) bad.push('表（verification/workflows.json）が読めない');
    for (const r of ALL) {
      const files = Object.keys(x.flows[r] || {}).sort(), want = Object.keys((T && T[r]) || {}).sort();
      if (!same(files, want)) bad.push(r + '：ワークフローの並びが表と違う（' + files.filter((f) => !want.includes(f)).concat(want.filter((f) => !files.includes(f))).join('、') + '）');
      for (const [file, text] of Object.entries(x.flows[r] || {})) {
        const f = parseFlow(text), e = (T && T[r] && T[r][file]) || null;
        const at = r + '/' + file;
        if (e) {
          if (!same(f.on, e.on)) bad.push(at + '：起こす出来事が表と違う（' + JSON.stringify(f.on) + '）');
          if (!same(f.perms, e.permissions)) bad.push(at + '：全体の権限が表と違う');
          if (!same(Object.keys(f.jobs).sort(), Object.keys(e.jobs || {}).sort())) bad.push(at + '：仕事の並びが表と違う');
          for (const [id, j] of Object.entries(f.jobs)) if (e.jobs && id in e.jobs && !same(j.perms, e.jobs[id])) bad.push(at + ' ' + id + '：仕事の権限が表と違う');
        }
        const c = code(text);
        for (const w of ['pull_request_target', 'workflow_run', 'write-all']) if (new RegExp('\\b' + w + '\\b').test(c)) bad.push(at + '：' + w + ' がある');
        for (const [id, j] of Object.entries(f.jobs)) {
          const eff = effective(f, j);
          if (writes(eff) && j.steps.some((s) => /\b(ref|repository):\s*[^\n]*\$\{\{/.test(code(s)))) bad.push(at + ' ' + id + '：書く権限を持つ仕事が、式から ref か repository を取る');
          /* 二。時間の上限。 */
          const key = r + '/' + file + '/' + id;
          if (j.timeout === null) bad.push(key + '：時間の上限が無い');
          else if (key in LONG ? j.timeout !== LONG[key] : j.timeout > MAX) bad.push(key + '：時間の上限 ' + j.timeout + ' 分');
          /* 三。鍵を残さない checkout。 */
          const pushes = typeof eff === 'object' && eff && eff.contents === 'write';
          for (const s of j.steps) if (/uses: actions\/checkout@/.test(s) && (!pushes || at === 'sophaxis/removal.yml') && !/persist-credentials: false/.test(s)) bad.push(key + '：checkout が鍵を残す');
        }
        /* 四。固めた pip。 */
        const strict = Object.values(f.jobs).some((j) => { const eff = effective(f, j); return writes(eff) || (typeof eff === 'object' && eff && eff['id-token'] === 'write'); }) || at in LOCKS;
        if (strict) for (const m of c.matchAll(/\bpip3? install\b([^\n]*)/g)) {
          const mm = /^ --require-hashes --only-binary=:all: -r (\S+)\s*$/.exec(m[1]);
          if (!mm) bad.push(at + '：pip が版とハッシュを固めた一覧から入れない');
          else if (LOCKS[at] === undefined || mm[1].replace(new RegExp('^repos/' + r + '/'), '') !== LOCKS[at]) bad.push(at + '：pip の一覧が決めたファイルでない');
        }
        if (at in LOCKS && !/\bpip3? install --require-hashes/.test(c)) bad.push(at + '：固めた pip が無い');
      }
    }
    for (const k of Object.keys(LONG)) { const [r, file, id] = k.split('/'); if (!x.flows[r] || !x.flows[r][file] || !parseFlow(x.flows[r][file]).jobs[id]) bad.push(k + '：長い仕事の表が古い'); }
    for (const [k, t] of Object.entries(x.locks)) {
      const entries = String(t || '').split(/\n(?=[A-Za-z])/).filter((e) => /^[A-Za-z]/.test(e));
      if (!entries.length) bad.push(k + '：一覧が無い');
      for (const e of entries) if (!/^[A-Za-z0-9._-]+==[0-9][0-9A-Za-z.]*(?: \\\n {4}--hash=sha256:[0-9a-f]{64})+\s*(?:\n#.*)*\s*$/.test(e)) bad.push(k + '：版かハッシュを持たない行「' + e.split('\n')[0].slice(0, 30) + '」');
    }
    /* 五。写し。 */
    for (const r of LIVE4) {
      if (!x.live[r] || x.live[r] !== x.live['cpsbvbng26-dotcom']) bad.push(r + '：tools/live.js の写しが違う');
      if (!(x.flows[r] || {})['live.yml'] || !/node tools\/live\.js/.test(x.flows[r]['live.yml'])) bad.push(r + '：live.yml が無い');
      let conf = null;
      try { conf = JSON.parse(x.liveConf[r]); } catch (e) { conf = null; }
      if (!conf || !/^https:\/\//.test(conf.base || '')) bad.push(r + '：tools/live.json');
      const names = r === 'nusquama' ? NAMES : ['nusquama'];
      if (names.some((n) => new RegExp(n, 'i').test(x.liveConf[r] || ''))) bad.push(r + '：tools/live.json がほかの場を名指す');
    }
    for (const r of UA3) if (!x.ua[r] || x.ua[r] !== x.ua['cpsbvbng26-dotcom']) bad.push(r + '：tools/ua.js の写しが違う');
    for (const t of [x.live['cpsbvbng26-dotcom'], x.ua['cpsbvbng26-dotcom']]) if (NAMES.concat(['nusquama']).some((n) => new RegExp(n, 'i').test(t || ''))) bad.push('tools/live.js か tools/ua.js がリポジトリを名指す');
    /* 六。見張り。 */
    if (!x.hb['cpsbvbng26-dotcom'] || x.hb.sophaxis !== x.hb['cpsbvbng26-dotcom']) bad.push('tools/heartbeat.js の写しが違う');
    let hc = null, hs = null;
    try { hc = JSON.parse(x.hbConf['cpsbvbng26-dotcom']); hs = JSON.parse(x.hbConf.sophaxis); } catch (e) { hc = null; }
    if (!hc || !same((hc.repos || []).slice().sort(), ALL.slice().sort()) || hc.owner !== OWNER) bad.push('見張りが 13 のリポジトリを読まない');
    if (!hs || !same(hs.repos, ['cpsbvbng26-dotcom']) || !same(hs.only, { 'cpsbvbng26-dotcom': ['ecosystem.yml'] })) bad.push('Sophaxis の見張りが横断の検査を見ない');
    const eco = parseFlow((x.flows['cpsbvbng26-dotcom'] || {})['ecosystem.yml'] || '');
    const hbj = eco.jobs.heartbeat, ecj = eco.jobs.ecosystem;
    if (!hbj || !same(hbj.perms, { contents: 'read', actions: 'read', issues: 'write' }) || hbj.steps.some((s) => /repository:|check_all|check_ecosystem/.test(s)) || !hbj.steps.some((s) => /run: node tools\/heartbeat\.js --test/.test(s)) || !hbj.steps.some((s) => /run: node tools\/heartbeat\.js\n/.test(s + '\n'))) bad.push('見張りの仕事の形');
    if (!ecj || writes(effective(eco, ecj))) bad.push('ほかのリポジトリを動かす仕事が書く権限を持つ');
    const sl = parseFlow((x.flows.sophaxis || {})['live.yml'] || '').jobs.heartbeat;
    if (!sl || !sl.steps.some((s) => /node tools\/heartbeat\.js --test/.test(s)) || !/schedule/.test(sl.if || '')) bad.push('Sophaxis の見張りの仕事が無い');
    if (!hbSelf(x.hb['cpsbvbng26-dotcom'])) bad.push('見張りの自己検査が落ちる');
    const H = loadHb(x.hb['cpsbvbng26-dotcom']);
    if (!H || typeof H.judge !== 'function') bad.push('見張りが読めない');
    else {
      const now = Date.UTC(2026, 10, 15, 12), day = 24 * 3600 * 1000, iso = (t) => new Date(t).toISOString();
      const ok = { repo: 'r', file: 'daily.yml', crons: ['17 21 * * *'], state: 'active', created: iso(now - 30 * day), lastSuccess: iso(now - day), watched: [] };
      if (H.judge([ok], now).length !== 0 || H.judge([Object.assign({}, ok, { lastSuccess: iso(now - 3 * day) })], now).map((y) => y.what).join() !== 'stale'
        || H.judge([Object.assign({}, ok, { state: 'disabled_inactivity' })], now).map((y) => y.what).join() !== 'stopped'
        || H.judge([Object.assign({}, ok, { pushConclusion: 'failure' })], now).map((y) => y.what).join() !== 'push'
        || H.judge([Object.assign({}, ok, { deploy: false })], now).map((y) => y.what).join() !== 'deploy'
        || H.judge([Object.assign({}, ok, { watched: [{ name: 'indexnow', conclusion: 'failure' }] })], now).map((y) => y.what).join() !== 'watched') bad.push('見張りの判定が、見本の古い仕事・止められた仕事・push の失敗・配備の失敗・IndexNow の失敗を拾わない');
      /* 見張りは定期の仕事をファイルから拾う。13 のリポジトリのどのファイルでも、cron の行をすべて拾うこと。 */
      for (const r of ALL) for (const [file, text] of Object.entries(x.flows[r] || {})) {
        const n = (code(text).match(/^ {4}- cron: '[^']+'\s*$/gm) || []).length;
        if (H.cronsOf(text).length !== n) bad.push(r + '/' + file + '：見張りが cron を ' + H.cronsOf(text).length + ' / ' + n + ' だけ拾う');
      }
      /* 年に一度の仕事の最初の期日を、ファイルの cron から求める。 */
      const first = { 'sophaxis/report.yml': '2027-01-02', 'sophaxis/audit.yml': '2027-10-30', 'nusquama/review.yml': '2027-11-07' };
      for (const [k, d] of Object.entries(first)) {
        const [r, file] = k.split('/');
        const crons = H.cronsOf ? H.cronsOf((x.flows[r] || {})[file] || '') : [];
        const y = crons.length ? Math.max(...crons.map((c) => H.lastYearly(c, Date.UTC(2027, 11, 31)))) : 0;
        if (!y || iso(y).slice(0, 10) !== d) bad.push(k + '：年に一度の最初の期日が ' + d + ' でない');
        if (!hc || !hc.yearly || !hc.yearly[k]) bad.push(k + '：年に一度の issue の題が無い');
      }
    }
    /* 七。同時実行の組。 */
    const ci = (x.flows['cpsbvbng26-dotcom'] || {})['checked-intake.yml'] || '';
    bad.push(...groupProblems('cpsbvbng26-dotcom', 'checked-intake.yml', ci, FIX['checked-intake.yml']));
    for (const k of Object.keys(FIX).filter((y) => y.includes('/'))) { const [r, file] = k.split('/'); bad.push(...groupProblems(r, file, (x.flows[r] || {})[file] || '', FIX[k])); }
    const cij = parseFlow(ci).jobs.intake;
    if (!cij || cij.cancel !== 'true') bad.push('受付の組が古い確かめを取り消さない');
    /* 八。非同期の見本。 */
    for (const [k, what] of [['uptimePage4', 'uptime.js が 4 頁目の自分の issue を見つけない'], ['uptimeNotList', 'uptime.js が一覧でない答えで落ちない'], ['linkcheckPage4', 'linkcheck.js が 4 頁目の自分の issue を見つけない'],
      ['linkcheckNotList', 'linkcheck.js が一覧でない答えで落ちない'], ['livePage4', 'live.js が 4 頁目まで読まない'], ['liveNotList', 'live.js が一覧でない答えで落ちない'], ['verifyRerun', '受付が、取り消しのあとの確かめ直しで、一つのコメントとそのときのラベルを残さない']]) if (probe[k] !== true) bad.push(what);
    /* C3・C4：回す検査と、無いリポジトリ。 */
    if (!/'verification\/check_pdf_shape\.py'\]/.test(x.checkAll) || !/'verification\/check_manuscript\.py'\]/.test(x.checkAll) || !/if \(missing && process\.env\.GITHUB_ACTIONS === 'true'\) \{ failed \+= missing;/.test(x.checkAll)) bad.push('check_all.js が二つの検査を回さないか、CI で無いリポジトリを落とさない');
    /* 九。記録。 */
    for (const r of ALL) {
      const a = x.aud[r], i = a.indexOf(HEAD);
      if (i < 0) { bad.push(r + '：記録の節が無い'); continue; }
      const j = a.indexOf('\n## ', i + 5);
      const t = a.slice(i, j < 0 ? a.length : j);
      /* 2026-11-18：Sophaxis と Nusquama の記録は、この節の後に「2026-11-18：名称と商標」を一つだけ持つ（利用者が求め、Claude が書いた）。
       * 2026-11-19：Nusquama の記録は、その後に「2026-11-19：参加のハードル」を持つ（利用者が決め、Claude が書いた）。
       * 2026-11-23：Nusquama の記録は、その後に「2026-11-23：日本の外に出たことがないこと」を持つ（運営者が決め、細かな定めは Claude が決めた）。
       * ほかの日付の節は、どのリポジトリでもこの節の後に置かない。後に置く節は、名と順をここに挙げたものだけ。 */
      const after = [...a.slice(i + 5).matchAll(/\n## (2026-[^\n]*)/g)].map((m) => m[1]);
      if (JSON.stringify(after) !== JSON.stringify(LATER_SECTIONS[r] || [])) bad.push(r + '：記録の節が最後の日付の節でない');
      const rows = t.split('\n').filter((l) => /^\| (?!---|箇所 \||Place \|)/.test(l)).map((l) => l.slice(2, -2).split(' | '));
      const kind = (k) => EN[k] || k;
      if (rows.length < 3 || !rows.every((y) => y.length === 6 && KINDS.includes(kind(y[4])))) bad.push(r + '：記録の表');
      const n = (k) => rows.filter((y) => kind(y[4]) === k).length;
      const ja = 'この表の判定は、' + KINDS.filter((k) => n(k)).map((k) => k + ' ' + n(k)).join('、') + ' です。';
      const en = 'Findings in this table: ' + Object.keys(EN).filter((k) => n(EN[k])).map((k) => k + ' ' + n(EN[k])).join(', ') + '.';
      if (!t.includes(ja) && !t.includes(en)) bad.push(r + '：記録の判定の数');
      if (!t.split('\n|')[0].includes(DECIDED) || rows.some((y) => !y[5].includes(DECIDED))) bad.push(r + '：決めた者');
      if (!/GitHub の説明書を取り寄せて確かめていません|\(unverified\)/.test(t)) bad.push(r + '：確かめていないことを書かない');
      if (!/弁護士は見ていません|No lawyer has reviewed this section/.test(t) || /弁護士(が|の)(確かめ|確認し)(た|まし)/.test(t)) bad.push(r + '：弁護士の文');
      if (r === 'cpsbvbng26-dotcom') {
        const rule = rows.find((y) => /枝の規則/.test(y[0])) || [];
        for (const w of ['`main` についてだけ、力ずくの push と枝の削除を止める規則です。', 'bot の普通の push は止めません。', '公開のリポジトリでは費用が掛からないと理解していますが、GitHub の説明書は取り寄せて確かめていません。'])
          if (!String(rule[5] || '').includes(w)) bad.push('cpsbvbng26-dotcom：枝の規則の勧め「' + w.slice(0, 12) + '」');
        if (!String(rule[3] || '').includes('ここからは読めません')) bad.push('cpsbvbng26-dotcom：枝の規則が読めないことを書かない');
        if (!String(rule[5] || '').includes('利用者はこの設定を掛けないと決めました。') || !String(rule[5] || '').includes('残る危うさとして')) bad.push('cpsbvbng26-dotcom：枝の規則を掛けないという利用者の決めと、残る危うさを書かない');
      }
      if (r === 'sophaxis' && !t.includes('`main` の枝の規則（ruleset）について勧める設定とその効きめは、cpsbvbng26-dotcom の記録の同じ節に、13 のリポジトリの分をまとめて書きました。')) bad.push('sophaxis：枝の規則の指し先');
      if (r === 'nusquama' && !t.includes('`main` の枝の規則（ruleset）について勧める設定とその効きめは、この国の外の記録に、まとめて書きました。')) bad.push('nusquama：枝の規則の指し先');
    }
    return bad;
  }
  const probe = asyncProbe(real);
  const now = problems(real, probe);
  const flows = ALL.reduce((s, r) => s + Object.keys(real.flows[r] || {}).length, 0);
  check('自動化を固める：13 のリポジトリのワークフロー（' + flows + ' 本）の起こす出来事と権限が表のとおりで、どの仕事にも時間の上限と鍵を残さない checkout があり、固めた pip と写しと見張りと同時実行の組と一覧の頁と記録がそろう',
    now.length === 0, now.slice(0, 6).join(' / '));
  let hbTest = '';
  for (const r of ['cpsbvbng26-dotcom', 'sophaxis']) { try { hbTest += require('child_process').execFileSync('node', [path.join(ROOT, r, 'tools', 'heartbeat.js'), '--test'], { encoding: 'utf8' }); } catch (e) { hbTest += String(e.stdout || '') + ' FAILED'; } }
  check('見張りの自己検査が、二つの写しで通る', (hbTest.match(/\d+ passed, 0 failed/g) || []).length === 2 && !hbTest.includes('FAILED'));

  /* 壊して確かめる。点検の書いた壊し方（J1）と、各部を一つずつ。 */
  const fw = (r, f, fn) => Object.assign({}, real, { flows: Object.assign({}, real.flows, { [r]: Object.assign({}, real.flows[r], { [f]: fn(real.flows[r][f] || '') }) }) });
  const addOn = (r, f, line) => fw(r, f, (t) => t.replace(/^on:\n/m, 'on:\n' + line + '\n'));
  const sub = (k, r, v) => Object.assign({}, real, { [k]: Object.assign({}, real[k], { [r]: v }) });
  const tableWith = (fn) => { const t = JSON.parse(JSON.stringify(real.table)); fn(t); return Object.assign({}, real, { table: t }); };
  const breaks = [
    ['uptime.yml に pull_request_target', addOn('cpsbvbng26-dotcom', 'uptime.yml', '  pull_request_target:')],
    ['uptime.yml に issue_comment', addOn('cpsbvbng26-dotcom', 'uptime.yml', '  issue_comment:\n    types: [created]')],
    ['uptime.yml の権限を write-all に', fw('cpsbvbng26-dotcom', 'uptime.yml', (t) => t.replace(/^permissions:\n(?: {2}.*\n)+/m, 'permissions: write-all\n'))],
    ['linkcheck.yml に pull_request_target と PR の先の checkout', fw('cpsbvbng26-dotcom', 'linkcheck.yml', (t) => t.replace(/^on:\n/m, 'on:\n  pull_request_target:\n').replace(/(uses: actions\/checkout@\S+[^\n]*\n)/, '$1        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n'))],
    ['書く仕事が PR の先を取り出す', Object.assign({}, fw('sophaxis', 'statutes.yml', (t) => t.replace(/(  statutes:\n[\s\S]*?uses: actions\/checkout@\S+[^\n]*\n)/, '$1        with:\n          ref: ${{ github.event.pull_request.head.ref }}\n')))],
    ['sophaxis の intake.yml に pull_request_target', addOn('sophaxis', 'intake.yml', '  pull_request_target:')],
    ['sophaxis の removal.yml に issue_comment', addOn('sophaxis', 'removal.yml', '  issue_comment:\n    types: [created]')],
    ['sophaxis の live.yml に workflow_run', addOn('sophaxis', 'live.yml', '  workflow_run:\n    workflows: [check]')],
    ['sophaxis の audit.yml に pull_request', addOn('sophaxis', 'audit.yml', '  pull_request:')],
    ['nusquama の statutes.yml に pull_request_target', addOn('nusquama', 'statutes.yml', '  pull_request_target:')],
    ['nusquama の world.yml に pull_request_target', addOn('nusquama', 'world.yml', '  pull_request_target:')],
    ['nusquama の record.yml に issue_comment', addOn('nusquama', 'record.yml', '  issue_comment:')],
    ['表にも同じ出来事を足して pull_request_target', Object.assign({}, addOn('trinity-operator', 'labels.yml', '  pull_request_target:'), { table: (() => { const t = JSON.parse(JSON.stringify(real.table)); t['trinity-operator']['labels.yml'].on = t['trinity-operator']['labels.yml'].on.concat(['pull_request_target']).sort(); return t; })() })],
    ['on を一行で書く', fw('justice-and-algorithms', 'pages.yml', (t) => t.replace(/^on:\n(?: {2}.*\n|\s*\n)*/m, 'on: [push, workflow_dispatch]\n'))],
    ['組む仕事に Pages に書く権限', fw('researcher-profile', 'pages.yml', (t) => t.replace(/(  build:\n[\s\S]*?    permissions:\n)/, '$1      pages: write\n'))],
    ['表の仕事の権限だけを変える', tableWith((t) => { t['errata-check']['pypi.yml'].jobs.build = { contents: 'read' }; })],
    ['表に無いワークフローを足す', fw('naval-gazette-notes', 'extra.yml', () => 'on:\n  push:\npermissions:\n  contents: read\njobs:\n  x:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - run: true\n')],
    ['一つの仕事から時間の上限を外す', fw('trinity-infinity', 'verify.yml', (t) => t.replace(/^ {4}timeout-minutes: \d+\n/m, ''))],
    ['一つの仕事の時間の上限を 61 分に', fw('self-correction', 'verify.yml', (t) => t.replace(/^( {4}timeout-minutes: )\d+$/m, '$161'))],
    ['長い仕事の上限を変える', fw('nusquama', 'world.yml', (t) => t.replace(/timeout-minutes: 340/, 'timeout-minutes: 341'))],
    ['読むだけの仕事の checkout が鍵を残す', fw('deposit-check', 'check.yml', (t) => t.replace(/\n {10}persist-credentials: false|, persist-credentials: false/, ''))],
    ['removal.yml の書く仕事の checkout が鍵を残す', fw('sophaxis', 'removal.yml', (t) => t.replace(/(  decide:\n[\s\S]*?)\n {10}persist-credentials: false/, '$1'))],
    ['pypi.yml の pip がハッシュを求めない', fw('errata-check', 'pypi.yml', (t) => t.replace('pip install --require-hashes --only-binary=:all: -r .github/requirements-pypi.txt', 'pip install build twine'))],
    ['横断の検査の pip を元に戻す', fw('cpsbvbng26-dotcom', 'ecosystem.yml', (t) => t.replace(/pip install --require-hashes --only-binary=:all: -r \S+/, 'pip install numpy pypdf==6.19.0'))],
    ['一覧の一行からハッシュを外す', sub('locks', 'cpsbvbng26-dotcom/ecosystem.yml', String(real.locks['cpsbvbng26-dotcom/ecosystem.yml']).replace(/^(numpy==\S+) \\\n {4}--hash=sha256:[0-9a-f]{64}/m, '$1'))],
    ['一覧の一行を版の幅にする', sub('locks', 'errata-check/pypi.yml', String(real.locks['errata-check/pypi.yml']).replace(/^twine==/m, 'twine>='))],
    ['live.js の一つの写しを変える', sub('live', 'trinity-operator', (real.live['trinity-operator'] || '') + '\n')],
    ['ua.js の Nusquama の写しを変える', sub('ua', 'nusquama', (real.ua.nusquama || '').replace('live-site-check', 'live-check'))],
    ['live.js がリポジトリを名指す', Object.assign({}, real, { live: Object.fromEntries(LIVE4.map((r) => [r, String(real.live[r]).replace("'use strict';", "'use strict';\n/* like sophaxis */")])) })],
    ['研究のリポジトリの設定が Nusquama を名指す', sub('liveConf', 'trinity-operator', String(real.liveConf['trinity-operator']).replace('"base"', '"note": "as nusquama",\n  "base"'))],
    ['Nusquama の設定がほかの場を名指す', sub('liveConf', 'nusquama', String(real.liveConf.nusquama).replace('"base"', '"note": "like sophaxis",\n  "base"'))],
    ['trinity-operator の live.yml を外す', fw('trinity-operator', 'live.yml', () => '')],
    ['見張りの写しを変える', sub('hb', 'sophaxis', (real.hb.sophaxis || '') + '\n')],
    ['見張りから一つのリポジトリを外す', sub('hbConf', 'cpsbvbng26-dotcom', String(real.hbConf['cpsbvbng26-dotcom']).replace('    "solitary-school",\n', ''))],
    ['Sophaxis の見張りが横断の検査を見ない', sub('hbConf', 'sophaxis', String(real.hbConf.sophaxis).replace('"ecosystem.yml"', '"verify.yml"'))],
    ['横断の検査の仕事に issues の書く権限', fw('cpsbvbng26-dotcom', 'ecosystem.yml', (t) => t.replace(/(  ecosystem:\n(?: {4}.*\n)*? {4}timeout-minutes: 45\n)/, '$1    permissions:\n      contents: read\n      issues: write\n'))],
    ['見張りの仕事にほかの書く権限', fw('cpsbvbng26-dotcom', 'ecosystem.yml', (t) => t.replace('      actions: read\n      issues: write\n', '      actions: read\n      issues: write\n      pull-requests: write\n'))],
    ['見張りの仕事から Actions を読む権限を外す', fw('cpsbvbng26-dotcom', 'ecosystem.yml', (t) => t.replace('      actions: read\n      issues: write\n', '      issues: write\n'))],
    ['見張りが 404 を鍵なしで尋ね直す', Object.assign({}, real, { hb: Object.assign({}, real.hb, { 'cpsbvbng26-dotcom': String(real.hb['cpsbvbng26-dotcom']).replace("[401, 403].includes(r.status)", "[401, 403, 404].includes(r.status)") }) })],
    ['見張りが main に無いワークフローのファイルを尋ねる', Object.assign({}, real, { hb: Object.assign({}, real.hb, { 'cpsbvbng26-dotcom': String(real.hb['cpsbvbng26-dotcom']).replace(" && held.has(x.path.split('/').pop())))", "))") }) })],
    ['見張りの仕事がほかのリポジトリの検査を動かす', fw('cpsbvbng26-dotcom', 'ecosystem.yml', (t) => t.replace('      - run: node tools/heartbeat.js --test\n', '      - run: node tools/heartbeat.js --test\n      - run: node verification/check_all.js\n'))],
    ['見張りが古い定期の仕事を見逃す', Object.assign({}, real, { hb: Object.assign({}, real.hb, { 'cpsbvbng26-dotcom': String(real.hb['cpsbvbng26-dotcom']).replace('2 * p.hours * HOUR', '200 * p.hours * HOUR') }) })],
    ['見張りが注釈の行のあとの cron を拾わない', Object.assign({}, real, { hb: Object.assign({}, real.hb, { 'cpsbvbng26-dotcom': String(real.hb['cpsbvbng26-dotcom']).replace("(?: {4}(?:- cron: .*|#.*)\\n?)+", "(?: {4}- cron: .*\\n?)+") }) })],
    ['見張りが push の失敗を見逃す', Object.assign({}, real, { hb: Object.assign({}, real.hb, { 'cpsbvbng26-dotcom': String(real.hb['cpsbvbng26-dotcom']).replace("['success', 'skipped', 'neutral'].includes(e.pushConclusion)", 'true') }) })],
    ['年に一度の仕事の cron を変える', fw('sophaxis', 'report.yml', (t) => t.replace("'23 3 2 1 *'", "'23 3 2 2 *'"))],
    ['受付の組を一つにする', Object.assign({}, real, { flows: Object.fromEntries(ALL.map((r) => [r, Object.assign({}, real.flows[r], { 'checked-intake.yml': String(real.flows[r]['checked-intake.yml']).replace(/group: \$\{\{[^\n]*\}\}/, 'group: checked-intake') })])) })],
    ['受付の組から持ち主の条件を外す', fw('cpsbvbng26-dotcom', 'checked-intake.yml', (t) => t.replace(" && github.event.sender.login != github.repository_owner) && format('checked-intake-issue-{0}'", ") && format('checked-intake-issue-{0}'"))],
    ['受付の組をワークフローの全体に戻す', fw('cpsbvbng26-dotcom', 'checked-intake.yml', (t) => t.replace(/^jobs:\n/m, 'concurrency:\n  group: checked-intake\n  cancel-in-progress: true\njobs:\n'))],
    ['受付が古い確かめを取り消さない', fw('cpsbvbng26-dotcom', 'checked-intake.yml', (t) => t.replace(/(group: \$\{\{[^\n]*\n {6}cancel-in-progress: )true/, '$1false'))],
    ['削除の判断の組から持ち主の条件を外す', fw('sophaxis', 'removal.yml', (t) => t.replace(" && github.event.sender.login == github.repository_owner) && 'removal'", ") && 'removal'"))],
    ['削除の受付の組を一つにする', fw('sophaxis', 'removal.yml', (t) => t.replace(/(  intake:\n[\s\S]*?group: )\$\{\{[^\n]*\}\}/, '$1removal'))],
    ['取り込みの組から枝の条件を外す', fw('sophaxis', 'record.yml', (t) => t.replace(" && github.event.pull_request.head.ref == 'statutes/record') && 'removal'", ") && 'removal'"))],
    ['投稿のコメントの実行を issue の組に入れる', fw('sophaxis', 'intake.yml', (t) => t.replace("${{ (github.event_name == 'issues' && contains(github.event.issue.labels.*.name, 'submission'))", "${{ (contains(github.event.issue.labels.*.name, 'submission'))"))],
    ['毎日の手順の組を run ごとにする', fw('sophaxis', 'intake.yml', (t) => t.replace("github.event_name == 'schedule' && 'intake-daily'", "github.event_name == 'never' && 'intake-daily'"))],
    ['報告の組から持ち主の条件を外す', fw('nusquama', 'reporter.yml', (t) => t.replace(/(group: \$\{\{ \(!github\.event\.issue\.pull_request) && github\.event\.sender\.login != github\.repository_owner/, '$1'))],
    ['uptime.js が 3 頁までしか読まない', Object.assign({}, real, { uptime: real.uptime.replace('for (let page = 1; !found; page++)', 'for (let page = 1; page <= 3 && !found; page++)') })],
    ['uptime.js が一覧でない答えを空と読む', Object.assign({}, real, { uptime: real.uptime.replace("if (!Array.isArray(list)) throw new Error('GitHub API の issue の一覧が読めない');", "if (!Array.isArray(list)) break;") })],
    ['linkcheck.js が PR を除かない', Object.assign({}, real, { linkcheck: real.linkcheck.replace("found = list.find((i) => !i.pull_request && (i.body || '').indexOf(MARK) === 0)", "found = list.find((i) => (i.body || '').indexOf(MARK) === 0)") })],
    ['live.js が一頁だけ読む', sub('live', 'cpsbvbng26-dotcom', String(real.live['cpsbvbng26-dotcom']).replace('if (list.length < 100) return out;', 'return out;'))],
    ['live.js の per_page を 1 に', sub('live', 'cpsbvbng26-dotcom', String(real.live['cpsbvbng26-dotcom']).replace("'per_page=100&page='", "'per_page=1&page='"))],
    ['受付が確かめ直しのたびにコメントを足す', Object.assign({}, real, { verify: real.verify.replace("  if (mine) await gh('PATCH', '/issues/comments/' + mine.id, { body });\n  else await gh('POST', '/issues/' + n + '/comments', { body });", "  await gh('POST', '/issues/' + n + '/comments', { body });") })],
    ['check_all.js が PDF の形を回さない', Object.assign({}, real, { checkAll: real.checkAll.replace("'verification/check_pdf_shape.py']", "'verification/check_pdf.py']") })],
    ['check_all.js が CI で無いリポジトリを通す', Object.assign({}, real, { checkAll: real.checkAll.replace("if (missing && process.env.GITHUB_ACTIONS === 'true') { failed += missing;", "if (false) { failed += missing;") })],
    ['記録の節を外す', sub('aud', 'solitary-school', real.aud['solitary-school'].replace(HEAD, '\n## 2026-11-15：自動化\n'))],
    ['Nusquama の記録の名称と商標の後に日付の節を足す', sub('aud', 'nusquama', real.aud.nusquama.replace('\n## 調べた法令\n', '\n## 2026-11-19：次の点検\n\n## 調べた法令\n'))],
    ['Sophaxis の記録から名称と商標の節を外す', sub('aud', 'sophaxis', real.aud.sophaxis.replace('\n## 2026-11-18：名称と商標\n', '\n## 名称と商標\n'))],
    ['記録の判定の数を変える', sub('aud', 'errata-check', real.aud['errata-check'].replace(/(## 2026-11-15：自動化を固める[\s\S]*?この表の判定は、漏れ )(\d+)/, (m0, a, b) => a + (Number(b) + 1)))],
    ['記録の一行から決めた者を外す', sub('aud', 'trinity-operator', real.aud['trinity-operator'].replace(/(## 2026-11-15：自動化を固める[\s\S]*?\| 漏れ \| [^\n]*?)2026-11-15 に利用者が決め、Claude が書きました。/, '$1'))],
    ['記録から確かめていないことを外す', sub('aud', 'justice-and-algorithms', real.aud['justice-and-algorithms'].replace(/(## 2026-11-15：自動化を固める[\s\S]*?)GitHub の説明書を取り寄せて確かめていません。/, '$1'))],
    ['英語の記録から弁護士の文を外す', sub('aud', 'deposit-check', real.aud['deposit-check'].replace(/(## 2026-11-15：自動化を固める[\s\S]*?)No lawyer has reviewed this section\./, '$1'))],
    ['枝の規則の勧めから bot の push のことを外す', sub('aud', 'cpsbvbng26-dotcom', real.aud['cpsbvbng26-dotcom'].replace('bot の普通の push は止めません。', ''))],
    ['Sophaxis の記録から枝の規則の指し先を外す', sub('aud', 'sophaxis', real.aud.sophaxis.replace('`main` の枝の規則（ruleset）について勧める設定とその効きめは、cpsbvbng26-dotcom の記録の同じ節に、13 のリポジトリの分をまとめて書きました。', ''))],
  ];
  const ASYNC = /uptime\.js|linkcheck\.js|live\.js が|live\.js の per_page|受付が確かめ直し/;
  const missed = breaks.filter(([k, y]) => problems(y, ASYNC.test(k) ? asyncProbe(y) : probe).length === 0).map(([k]) => k);
  check('壊して確かめる：点検の書いた起こし方（uptime・linkcheck・Sophaxis の intake・removal・live・audit・Nusquama の statutes・world・record）、表と権限と一行の on、時間の上限、鍵を残す checkout、固めない pip と一覧、写し、見張り、同時実行の組、一覧の頁、受付の確かめ直し、回す検査、記録のどれでも落ちる（'
    + (breaks.length - missed.length) + ' / ' + breaks.length + '）', missed.length === 0, missed.join(' / '));
}

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
    const TRANSITIVE = new Set(JSON.parse((/^transitive = (\[.*\])$/m.exec(read('errata-check', path.join('tests', 'hygiene.toml')) || '') || [, '[]'])[1]));
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
          const words = m[1].split(/\s+/);
          /* 2026-11-15 から、版とハッシュを固めた一覧（-r の次のファイル）からも入れる。一覧の名は、上の五つか、
           * errata-check の tests/hygiene.toml の transitive に挙げたその依存でなければならない。 */
          const lists = words.filter((w, i) => i > 0 && words[i - 1] === '-r' && w !== 'requirements.txt');
          words.filter((w, i) => w && !w.startsWith('-') && w !== 'requirements.txt' && !/^\$/.test(w) && !(i > 0 && words[i - 1] === '-r'))
            .map((w) => w.replace(/[@=<>].*$/, '')).filter((w) => !ALLOWED.has(w)).forEach((w) => 依存.push(r + '/' + f + ' ' + w));
          for (const l of lists) {
            const lt = read(r, l.replace(new RegExp('^repos/' + r + '/'), ''));
            if (lt === null) { 依存.push(r + '/' + f + ' ' + l + '（無い）'); continue; }
            lt.split('\n').filter((x) => /^[A-Za-z]/.test(x)).map((x) => x.replace(/[<>=!~\s\\].*$/, ''))
              .filter((n) => !ALLOWED.has(n) && !TRANSITIVE.has(n)).forEach((n) => 依存.push(r + '/' + l + ' ' + n));
          }
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
    check('10 リポジトリが依存を足していない（CI が入れるのは pypdf・numpy・playwright・build・twine と、版とハッシュを固めた一覧にある、その ' + TRANSITIVE.size + ' の依存だけ）', 依存.length === 0, 依存.join(', '));
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
    {
      /* 2026-11-16。Zenodo の閲覧とダウンロードの表は、控え（zenodoStats）と一行ずつ合う。 */
      const zs = o && o.zenodoStats ? o.zenodoStats.records : null;
      const 表 = [...t.matchAll(/^\| `(\d+)` \| [^|]+ \| \*\*(\d+)\*\* \| \*\*(\d+)\*\* \|$/gm)].map((m) => [m[1], Number(m[2]), Number(m[3])]);
      const ずれZ = zs ? 表.filter(([r, v, d]) => !zs[r] || zs[r][0] !== v || zs[r][1] !== d).map(([r]) => r).concat(Object.keys(zs).filter((r) => !表.some((x) => x[0] === r))) : ['控え無し'];
      check('名寄せの頁の Zenodo の閲覧とダウンロードの表が、控えと一行ずつ合い、読んだ日を名乗る', zs !== null && 表.length > 0 && ずれZ.length === 0 && t.includes('数は ' + o.zenodoStats.asOf + ' に Zenodo の API から読んだもの'), ずれZ.join(', ') || 表.length + ' 行');
    }
    {
      /* 2026-11-16。Wikidata の節。2026-11-16 に利用者が求め、Claude が書いた。控え（outside.json の wikidata）と四つの面で突き合わせる。
       * (a) 節の二つの表（人物の項目の識別子、作品の項目と DOI）が、控えと一行ずつ同じ。
       * (b) 頁が名乗る作品の項目の件数が、控えの作品の数と同じ。前の「作品の項目が 0 件」は戻さない。
       * (c) 生成した頁（verification/pages.json）の構造化データで、人物の項目はトップの五言語の Person（#person）の sameAs にあり、
       *     作品の項目は、その作品の論文の頁があるものに限り、その DOI を持つ論文のすべての sameAs にある。ほかの Q は無く、付け先も違えない。
       * (d) 控えの DOI は、小文字にすると、どれも doi-index.md にある。 */
      const WD = 'https://www.wikidata.org/wiki/';
      const PERSON_ID = 'https://cpsbvbng26-dotcom.vercel.app/#person';
      const TOPS = ['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html'];
      const ldNodes = (html) => {
        const out = [];
        for (const m of String(html || '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
          let j; try { j = JSON.parse(m[1]); } catch (e) { continue; }
          (function walk(x) {
            if (Array.isArray(x)) x.forEach(walk);
            else if (x && typeof x === 'object') { if (x['@type']) out.push(x); Object.keys(x).forEach((k) => walk(x[k])); }
          }(j));
        }
        return out;
      };
      const doiOf = (n) => {
        for (const x of [n['@id'], n.url].concat([].concat(n.identifier || []).map((y) => (y && typeof y === 'object') ? y.value : y))) {
          const m = /(?:doi\.org\/)?(10\.\d{4,}\/[^\s"]+)$/i.exec(String(x || ''));
          if (m) return m[1].toLowerCase();
        }
        return null;
      };
      const wdProblems = (w, text, pages, idx) => {
        const bad = [];
        if (!w || !w.person || !w.works || !w.personIds) return ['控えに wikidata が無い'];
        const works = w.works;
        const n = Object.keys(works).length;
        const a0 = text.indexOf('\n## Wikidata\n');
        const sec = a0 < 0 ? '' : text.slice(a0 + 1, (text.indexOf('\n## ', a0 + 5) + 1 || text.length + 1) - 1);
        if (!sec) bad.push('Wikidata の節が無い');
        /* (a) */
        const 項 = 表(sec, '次の表の識別子').map((r) => [r[0], (/^`(.*)`$/.exec(r[2]) || [])[1]]);
        const 項控 = Object.entries(w.personIds);
        if (JSON.stringify(項) !== JSON.stringify(項控)) bad.push('(a) 識別子の表が控えと違う（頁 ' + 項.length + ' 行 / 控え ' + 項控.length + ' 行）');
        const 作 = 表(sec, '著者と DOI が次の表のとおり').map((r) => [(/^`(Q\d+)`$/.exec(r[0]) || [])[1], (/^`(.*)`$/.exec(r[2]) || [])[1]]);
        if (JSON.stringify(作) !== JSON.stringify(Object.entries(works))) bad.push('(a) 作品の項目の表が控えと違う（頁 ' + 作.length + ' 行 / 控え ' + n + ' 行）');
        if (sec.indexOf('`' + w.person + '`') < 0 || text.indexOf('| Wikidata | 人物の項目 `' + w.person + '`') !== 0 && text.indexOf('\n| Wikidata | 人物の項目 `' + w.person + '`') < 0) bad.push('人物の項目の番号が表か節に無い');
        if (sec.indexOf('値は、' + w.asOf + ' ') < 0) bad.push('節が読んだ日 ' + w.asOf + ' を名乗らない');
        /* (b) */
        const 名乗り = [...text.matchAll(/作品の項目 \*\*(\d+)\*\* 件/g)].map((m) => Number(m[1])).concat([...sec.matchAll(/(\d+) 件とも/g)].map((m) => Number(m[1])));
        if (名乗り.length < 3 || 名乗り.some((x) => x !== n)) bad.push('(b) 作品の項目の件数の名乗り ' + 名乗り.join(',') + ' / 控え ' + n);
        if (/作品の項目(が|は) ?\**0\** ?件/.test(text)) bad.push('(b) 作品の項目が 0 件という前の文が残る');
        /* (c) */
        const byDoi = {};
        Object.entries(works).forEach(([q, d]) => { byDoi[d.toLowerCase()] = q; });
        const 頁あり = new Set();
        Object.entries(pages).forEach(([f, h]) => { if (/^papers\//.test(f)) ldNodes(h).forEach((x) => { const d = doiOf(x); if (byDoi[d] && /Article/.test(x['@type'])) 頁あり.add(byDoi[d]); }); });
        if (!頁あり.size) bad.push('(c) 作品の項目のある論文の頁が一つも無い');
        TOPS.forEach((f) => {
          if (!ldNodes(pages[f]).some((x) => x['@type'] === 'Person' && x['@id'] === PERSON_ID && [].concat(x.sameAs || []).includes(WD + w.person))) bad.push('(c) ' + f + ' の Person に ' + w.person + ' が無い');
        });
        Object.entries(pages).forEach(([f, h]) => {
          ldNodes(h).forEach((x) => {
            const qs = [].concat(x.sameAs || []).filter((u) => /wikidata\.org/.test(u)).map((u) => (u.indexOf(WD) === 0 ? u.slice(WD.length) : u));
            const d = doiOf(x);
            qs.forEach((q) => {
              if (q === w.person) { if (x['@type'] !== 'Person' || x['@id'] !== PERSON_ID) bad.push('(c) ' + f + ' の ' + (d || x['@type']) + ' に人物の項目'); }
              else if (!works[q]) bad.push('(c) ' + f + ' に控えに無い項目 ' + q);
              else if (!頁あり.has(q)) bad.push('(c) ' + f + ' に、論文の頁の無い作品の項目 ' + q);
              else if (byDoi[d] !== q) bad.push('(c) ' + f + ' の ' + (d || x['@type']) + ' に ' + q);
            });
            if (byDoi[d] && 頁あり.has(byDoi[d]) && /Article/.test(x['@type']) && !qs.includes(byDoi[d])) bad.push('(c) ' + f + ' の ' + d + ' に ' + byDoi[d] + ' が無い');
          });
          for (const m of String(h).matchAll(/wikidata\.org\/(?:wiki|entity)\/(Q\d+)/g)) if (m[1] !== w.person && !頁あり.has(m[1])) bad.push('(c) ' + f + ' の本文か属性に ' + m[1]);
        });
        /* (d) */
        const low = String(idx).toLowerCase();
        Object.values(works).forEach((d) => { if (low.indexOf(d.toLowerCase()) < 0) bad.push('(d) ' + d + ' が doi-index.md に無い'); });
        return bad;
      };
      const w = o ? o.wikidata : null;
      const pageFiles = JSON.parse(read(HOME, path.join('verification', 'pages.json')) || '{"pages":[]}').pages.map((p) => p.file);
      const pages = Object.fromEntries(pageFiles.map((f) => [f, read(HOME, f) || '']));
      const idx = read(HOME, DOI_INDEX) || '';
      const nowW = wdProblems(w, t, pages, idx);
      const 頁数 = pageFiles.filter((f) => /wikidata\.org/.test(pages[f])).length;
      check('名寄せの頁の Wikidata の節が控えと合う：識別子と作品の表・作品の件数・生成した頁の sameAs（' + 頁数 + ' 頁）・doi-index の DOI', w && nowW.length === 0,
        nowW.slice(0, 4).join(' / ') || (w ? Object.keys(w.works).length + ' 件' : ''));
      const 替W = (fn) => { const c = { w: JSON.parse(JSON.stringify(w || {})), t, pages: Object.assign({}, pages), idx }; fn(c); return wdProblems(c.w, c.t, c.pages, c.idx).length > 0; };
      const QS = (q) => '"' + WD + q + '"';
      const breaksW = [
        ['(a) 作品の表から一行を消す', (c) => { c.t = c.t.replace(/^\| `Q142184237` \|.*\n/m, ''); }],
        ['(a) 作品の表の DOI を変える', (c) => { c.t = c.t.replace('`10.5281/ZENODO.22057583` |', '`10.5281/ZENODO.22058254` |'); }],
        ['(a) 識別子の表の値を変える', (c) => { c.t = c.t.replace('| P3747 | SSRN の著者 ID | `8730280` |', '| P3747 | SSRN の著者 ID | `8730281` |'); }],
        ['(a) 控えに作品を足す', (c) => { c.w.works.Q1 = '10.5281/zenodo.1'; }],
        ['(b) 件数の名乗りを変える', (c) => { c.t = c.t.replace('作品の項目 **' + Object.keys(w.works).length + '** 件が、著者（P50）', '作品の項目 **5** 件が、著者（P50）'); }],
        ['(b) 前の文を戻す', (c) => { c.t = c.t.replace('著者としてこの項目を指す作品の項目は、ありませんでした。', '作品の項目は 0 件でした。'); }],
        ['(c) ドイツ語のトップの頁の Person から項目を外す', (c) => { c.pages['index.de.html'] = c.pages['index.de.html'].replace(QS(w.person), '"https://orcid.org/0009-0000-1406-0547"'); }],
        ['(c) 論文の頁から作品の項目を外す', (c) => { c.pages['papers/imperial-selfhood.en.html'] = c.pages['papers/imperial-selfhood.en.html'].replace(',\n        ' + QS('Q142184151'), ''); }],
        ['(c) ノートの頁の項目を取り違える', (c) => { c.pages['notes/index.html'] = c.pages['notes/index.html'].replace(QS('Q142184034'), QS('Q142184151')); }],
        ['(c) 頁の無い作品の項目を足す', (c) => { c.pages['cv.html'] = c.pages['cv.html'].replace('</main>', '<a href="' + WD + 'Q142184237">x</a></main>'); }],
        ['(d) doi-index から DOI を消す', (c) => { c.idx = c.idx.split('ssrn.7537983').join('ssrn.'); }],
      ];
      const 取り = breaksW.filter(([, fn]) => { try { return !替W(fn); } catch (e) { return true; } }).map(([k]) => k);
      check('壊して確かめる：Wikidata の節の表・件数・前の文、生成した頁の人物と作品の項目、doi-index のどれを崩しても落ちる（' + (breaksW.length - 取り.length) + ' / ' + breaksW.length + '）',
        w && 取り.length === 0, 取り.join(' / '));
    }
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
    const repos = C.repos.concat(十の外).filter((r) => fs.existsSync(path.join(ROOT, r)));
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
    /* 2026-11-18：「例として置いた番号」の節は、十の外の二つが例に置いた他人の番号なので、著者の稿と比べない。 */
    const 例 = (read('cpsbvbng26-dotcom', DOI_INDEX) || '').split('\n## 例として置いた番号\n')[1] || '';
    const 例の番号 = new Set((例.split('\n## ')[0].match(/10\.6084\/m9\.figshare\.\d+/g) || []).map((d) => d.toLowerCase()));
    const b = [...(一覧の番号(/10\.6084\/m9\.figshare\.\d+/g) || [])].filter((d) => !例の番号.has(d)).sort();
    check('Figshare の頁の稿が、doi-index の Figshare の番号と一致する', a.length > 0 && JSON.stringify(a) === JSON.stringify(b), a.join(', ') + ' / ' + b.join(', '));
    check('Figshare の頁が、決めごと 15 の水準（researchmap の MISC）を書いている', f.indexOf('researchmap の MISC に載せられる水準のものに限ります') >= 0);
  }
}

/* 2026-11-18 の点検（利用者の「命令違反していないかもう一回リポジトリ全部チェックして」に、Claude が決めたやり方で答えた）。
 * 見つけたものを直し、同じものが戻らないように三つを固める。決めたことと理由は docs/incidents.md の I6 にある。 */
console.log('\n13c. 2026-11-18 の点検：創作の系列の名・マージの二行・ワークフローの注釈');
{
  /* 一。研究の系列とプロフィールの散文は、創作の系列の名を書かない（nusquama の決めごと 4、2026-11-18 の点検）。
   * 見るのは配る文と記録：Markdown（CLAUDE.md を除く）・HTML・CFF・BibTeX・XML・テキストと、
   * researcher-profile の根の設定、.zenodo.json と catalog.json。横断の検査とワークフローと検査の控えは、
   * そのリポジトリを走るために名を持つので外す（verification・tools・tests・fixtures・.github）。 */
  const 名 = /nusquama|ヌスクァマ|無何有|騎士王国/i;
  const 外す = new Set(['.git', 'node_modules', 'verification', 'tools', 'tests', 'fixtures', '.github', 'world']);
  const 見る = (repo, rel) => /\.(md|html|cff|bib|xml|txt)$/.test(rel) && !/(^|\/)CLAUDE\.md$/.test(rel)
    || rel === '.zenodo.json' || rel === 'catalog.json' || (repo === 'researcher-profile' && /^[^/]+\.json$/.test(rel));
  const repos = C.repos.concat(['sophaxis', 'deposit-check']).filter((r) => fs.existsSync(path.join(ROOT, r)));
  const 面 = {};
  const walk = (repo, rel) => {
    let ents;
    try { ents = fs.readdirSync(path.join(ROOT, repo, rel), { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (!外す.has(e.name)) walk(repo, r); } else if (見る(repo, r)) 面[repo + '/' + r] = read(repo, r) || '';
    }
  };
  repos.forEach((r) => walk(r, ''));
  const 名のある = (m) => Object.keys(m).filter((k) => 名.test(m[k]));
  const now = 名のある(面);
  check('研究の系列とプロフィールの散文（' + repos.length + ' リポジトリ、' + Object.keys(面).length + ' ファイル）が、創作の系列の名を書かない',
    repos.length === 12 && Object.keys(面).length > 100 && now.length === 0, now.slice(0, 6).join(', '));
  const 足す = (k, t) => Object.assign({}, 面, { [k]: (面[k] || '') + t });
  const 壊し = [
    ['プロフィールの README に名を足す', 足す('cpsbvbng26-dotcom/README.md', '\nSophaxis と Nusquama には、それぞれの規約があります。\n')],
    ['声明の設定にカナで名を足す', 足す('researcher-profile/mission.json', 'ヌスクァマ')],
    ['頁に国の名を足す', 足す('cpsbvbng26-dotcom/notes/mission.html', '<p>無何有騎士王国</p>')],
    ['記録に小文字で名を足す', 足す('cpsbvbng26-dotcom/docs/legal-audit-2026-11-12.md', 'nusquama の検査')],
  ];
  const 通った = 壊し.filter(([, m]) => 名のある(m).length === 0).map(([n]) => n);
  check('壊して確かめる：創作の系列の名を README・設定・頁・記録に足すと落ちる（' + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）',
    通った.length === 0, 通った.join(', '));
}
{
  /* 二。マージの本文の二行。開示の無いマージを数える検査（5 の上）は Co-authored-by だけを見ていた。
   * Claude-Session の行の欠けも数え、十では欠けたマージが同じ 63 件であること、十の外の三つでは、
   * Claude の二行の無いマージが、ラベル record でワークフローが記したもの（作者が github-actions[bot]）だけであることを見る。 */
  const BOT = 'github-actions[bot]';
  const 欠け = (rows) => rows.filter((r) => !/^Co-authored-by: Claude /mi.test(r.body) || !/^Claude-Session: https:\/\/claude\.ai\/code\/session_/m.test(r.body));
  const 開示なし = (rows) => rows.filter((r) => !/^Co-authored-by: /mi.test(r.body));
  const 読む = (repo) => {
    try {
      const out = require('child_process').execFileSync('git', ['log', '--merges', '--format=%H%x1f%an%x1f%B%x1e'],
        { cwd: path.join(ROOT, repo), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      return out.split('\x1e').map((x) => x.replace(/^\n/, '')).filter((x) => x.trim()).map((x) => { const [h, an, body] = x.split('\x1f'); return { h, an, body: body || '' }; });
    } catch (e) { return null; }
  };
  const 十 = DECL['共通の決めごと'].repos.map((r) => [r, 読む(r)]);
  const 外 = ['sophaxis', 'deposit-check', 'nusquama'].filter((r) => fs.existsSync(path.join(ROOT, r))).map((r) => [r, 読む(r)]);
  const 名乗り = Number((/\*\*開示の無いマージが、10 リポジトリ合わせて (\d+) 件ある。\*\*/.exec(read('cpsbvbng26-dotcom', 'CLAUDE.md') || '') || [])[1]);
  const 問題 = (十, 外) => {
    const bad = [];
    if (十.some(([, x]) => x === null) || 外.some(([, x]) => x === null)) return ['git を読めない'];
    const k = 十.flatMap(([, x]) => 欠け(x)), n = 十.flatMap(([, x]) => 開示なし(x));
    if (k.length !== 名乗り) bad.push('十で二行の欠けたマージ ' + k.length + ' / 名乗り ' + 名乗り);
    if (k.map((r) => r.h).sort().join() !== n.map((r) => r.h).sort().join()) bad.push('十で、Co-authored-by の無いマージと二行の欠けたマージが違う');
    for (const [r, x] of 外) for (const m of 欠け(x)) if (!(m.an === BOT && m.body.includes('Recorded at the operator\'s label `record`') && m.body.includes('Co-authored-by: ' + BOT))) bad.push(r + ' ' + m.h.slice(0, 7));
    return bad;
  };
  const now = 問題(十, 外);
  check('マージの本文の二行：十では欠けたマージが名乗りの ' + 名乗り + ' 件と同じもので、十の外の ' + 外.length + ' つでは record のワークフローが記したものだけ', now.length === 0 && 外.length === 3, now.slice(0, 4).join(' / '));
  const 足す = (list, repo, row) => list.map(([r, x]) => [r, r === repo ? x.concat([row]) : x]);
  const 壊し = [
    ['十に Session の行の無いマージを足す', 足す(十, 'cpsbvbng26-dotcom', { h: 'f'.repeat(40), an: 'Claude', body: 'Merge pull request #1\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n' }), 外],
    ['十の外に開示の無いマージを足す', 十, 足す(外, 'deposit-check', { h: 'e'.repeat(40), an: 'Claude', body: 'Merge pull request #1\n' })],
    ['十の外に、人が bot の行だけで記したマージを足す', 十, 足す(外, 'sophaxis', { h: 'd'.repeat(40), an: 'someone', body: 'x (#1)\n\nRecorded at the operator\'s label `record`, after the checks below passed on the merged result.\n\nCo-authored-by: ' + BOT + ' <x>\n' })],
  ];
  const 通った = 壊し.filter(([, a, b]) => 問題(a, b).length === 0).map(([n]) => n);
  check('壊して確かめる：二行の欠けたマージを十と十の外に足すと落ちる（' + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}
{
  /* 三。決めごと 16 の形を、ワークフローと様式と Dependabot の設定（.github の YAML）でも見る。散文の検査は Markdown しか見ていなかった。
   * 2026-11-18 に、二つの Dependabot の設定の注釈が、マージを運営者の仕事として書いていた。 */
  const 形 = ['利用者が確かめる', '利用者が確かめます', '利用者の手作業', '利用者の作業', '利用者が手で', '運営者が確かめてから', '運営者が読んでから',
    'needs the owner', 'for the owner to', 'the operator merges', 'for the operator to confirm'];
  const repos = C.repos.concat(十の外).filter((r) => fs.existsSync(path.join(ROOT, r)));
  const 面 = {};
  const walk = (repo, rel) => {
    let ents;
    try { ents = fs.readdirSync(path.join(ROOT, repo, rel), { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const r = rel + '/' + e.name;
      if (e.isDirectory()) walk(repo, r); else if (/\.ya?ml$/.test(e.name)) 面[repo + '/' + r] = read(repo, r) || '';
    }
  };
  repos.forEach((r) => walk(r, '.github'));
  const 出た = (m) => Object.keys(m).flatMap((k) => 形.filter((w) => m[k].includes(w)).map((w) => k + ' 「' + w + '」'));
  const now = 出た(面);
  check('.github の YAML（' + repos.length + ' リポジトリ、' + Object.keys(面).length + ' ファイル）に、利用者に作業を割り当てる形が無い（共通の決めごと 16）',
    repos.length === C.repos.length + 十の外.length && Object.keys(面).length > 50 && now.length === 0, now.slice(0, 4).join(' / '));
  const 壊し = [
    ['Dependabot の注釈を前の文に戻す', Object.assign({}, 面, { 'nusquama/.github/dependabot.yml': '# マージは運営者が確かめてから行う。\n' })],
    ['英語の注釈を前の文に戻す', Object.assign({}, 面, { 'sophaxis/.github/dependabot.yml': '# the operator merges each one after its checks pass.\n' })],
    ['取り寄せの注釈を前の文に戻す', Object.assign({}, 面, { 'nusquama/.github/workflows/sources.yml': '# 取り寄せた文は、運営者が読んでから使う。\n' })],
  ];
  const 通った = 壊し.filter(([, m]) => 出た(m).length === 0).map(([n]) => n);
  check('壊して確かめる：.github の YAML に割り当ての形を戻すと落ちる（' + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

{
  /* 四。反論の頁（docs/objections.md）が名乗る登録簿の件数（決めごと 5）。2026-09-19 に書いた 92・33・59 のまま、
   * 登録簿が 104 件になっても、どの検査も数えていなかった。登録簿の basis（再構成・同時）から数え直す。 */
  const 数える = (toml) => {
    const ents = String(toml).split(/^\[\[entry\]\]$/m).slice(1);
    return { 全: ents.length, 再構成: ents.filter((e) => /^basis = "再構成"$/m.test(e)).length, 同時: ents.filter((e) => /^basis = "同時"$/m.test(e)).length };
  };
  const 名乗りの問題 = (text, n) => {
    const m = /^(\d+) 件はすべて、起きたあとに書いたものです。(\d+) 件は再構成で、同時に記録したのは (\d+) 件。$/m.exec(text);
    if (!m) return ['名乗りの文が無い'];
    const bad = [];
    if (Number(m[1]) !== n.全) bad.push('全 ' + m[1] + ' / 実際 ' + n.全);
    if (Number(m[2]) !== n.再構成) bad.push('再構成 ' + m[2] + ' / 実際 ' + n.再構成);
    if (Number(m[3]) !== n.同時) bad.push('同時 ' + m[3] + ' / 実際 ' + n.同時);
    if (n.再構成 + n.同時 !== n.全) bad.push('basis が再構成でも同時でもない項目がある');
    return bad;
  };
  const text = read('cpsbvbng26-dotcom', path.join('docs', 'objections.md')) || '';
  const toml = read('self-correction', 'register.toml');
  const n = 数える(toml || '');
  const now = toml === null ? ['self-correction が並んでいない'] : 名乗りの問題(text, n);
  check('反論の頁が名乗る登録簿の件数（' + n.全 + ' 件・再構成 ' + n.再構成 + '・同時 ' + n.同時 + '）が、登録簿と合う', now.length === 0, now.join(' / '));
  const 壊し = [
    ['頁の全体の数を動かす', 名乗りの問題(text.replace(n.全 + ' 件はすべて', (n.全 - 1) + ' 件はすべて'), n)],
    ['登録簿に同時の項目を一つ足す', 名乗りの問題(text, 数える((toml || '') + '\n[[entry]]\nid = "X-1"\nbasis = "同時"\n'))],
    ['登録簿に basis の無い項目を足す', 名乗りの問題(text.replace(n.全 + ' 件はすべて', (n.全 + 1) + ' 件はすべて'), 数える((toml || '') + '\n[[entry]]\nid = "X-2"\n'))],
  ];
  const 通った = 壊し.filter(([, b]) => b.length === 0).map(([x]) => x);
  check('壊して確かめる：頁の数か登録簿の項目を動かすと落ちる（' + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

/* 五。2026-11-18 の点検（決めごと 5）。作用素の頁の検査が突き合わせる記録の件数を、散文が名乗っている。
 * README（日英）・トップの頁（日英）・作用素の頁が 728 と 23 を書いていたが、どの検査も控えのファイルと数え合わせていなかった。 */
{
  const fx = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'trinity_fixtures.json')) || '{"cases":[]}');
  const cert = JSON.parse(read('cpsbvbng26-dotcom', path.join('verification', 'certificate_fixtures.json')) || '{"cases":[]}');
  const 実 = { numpy: fx.cases.length, cert: cert.cases.length };
  const 名乗り = [
    ['README.md', /NumPy の値と? (\d+) 件/g, 'numpy', 2], ['README.md', /証書 (\d+) 件/g, 'cert', 1],
    ['README.en.md', /against (\d+) recorded NumPy results/g, 'numpy', 2], ['README.en.md', /and (\d+) recorded contraction certificates/g, 'cert', 1],
    ['index.html', /NumPy の値 (\d+) 件/g, 'numpy', 1], ['index.html', /証書 (\d+) 件/g, 'cert', 1],
    ['index.en.html', /against (\d+) recorded NumPy results/g, 'numpy', 1], ['index.en.html', /against (\d+) recorded certificates/g, 'cert', 1],
    ['trinity.html', /行列 (\d+) 個/g, 'numpy', 1], ['trinity.html', /証書 (\d+) 件/g, 'cert', 1],
  ];
  const ずれ = (texts) => 名乗り.flatMap(([f, re, k, n]) => {
    const ms = [...(texts[f] || '').matchAll(re)].map((m) => Number(m[1]));
    return ms.length === n && ms.every((x) => x === 実[k]) ? [] : [f + ' ' + k + ' ' + ms.join(',') + ' / 実際 ' + 実[k]];
  });
  const texts = Object.fromEntries([...new Set(名乗り.map((x) => x[0]))].map((f) => [f, read('cpsbvbng26-dotcom', f) || '']));
  const now = ずれ(texts);
  check('散文が名乗る作用素の記録の件数（NumPy ' + 実.numpy + ' 件・証書 ' + 実.cert + ' 件）が、控えのファイルと合う（' + 名乗り.length + ' 箇所）', now.length === 0, now.join(' / '));
  const 壊す = [['README.md', '728 件と、', '729 件と、'], ['index.en.html', 'against 23 recorded certificates', 'against 24 recorded certificates'], ['trinity.html', '行列 728 個', '行列 727 個']]
    .map(([f, a, b]) => ずれ(Object.assign({}, texts, { [f]: texts[f].replace(a, b) })).length > 0);
  check('壊して確かめる：README・英語のトップ・作用素の頁の件数を一つ動かすと落ちる（' + 壊す.filter(Boolean).length + ' / ' + 壊す.length + '）', 壊す.every(Boolean), '');
}

{
  /* 六。README（日英）の修了証の節が名乗る件数（決めごと 5）。群ごとの見出しの数と合計を、その下に並ぶバッジの行から数える。 */
  const 問題 = (t, en) => {
    const i = t.indexOf('✴︎Credentials✴︎'), j = i < 0 ? -1 : t.indexOf('</details>', i);
    if (i < 0 || j < 0) return ['修了証の節が無い'];
    const sec = t.slice(i, j);
    const 見出し = en ? /^\*\*([^*]+)\*\* \((\d+)\)$/gm : /^\*\*([^*]+)\*\*（(\d+) 件）$/gm;
    const hs = [...sec.matchAll(見出し)];
    if (hs.length < 2) return ['群の見出しが足りない'];
    const bad = [];
    let 全 = 0;
    hs.forEach((h, k) => {
      const body = sec.slice(h.index + h[0].length, k + 1 < hs.length ? hs[k + 1].index : undefined);
      const n = (body.match(/^\[!\[/gm) || []).length;
      全 += n;
      if (n !== Number(h[2])) bad.push(h[1] + ' ' + h[2] + ' / 実際 ' + n);
    });
    const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    const m = en ? /<summary>(\w+) certificates and open badges/.exec(sec) : /<summary>修了証・オープンバッジ 計 (\d+) 件/.exec(sec);
    const 名 = m ? (en ? W.indexOf(m[1].toLowerCase()) : Number(m[1])) : -1;
    if (名 !== 全) bad.push('合計 ' + (m ? m[1] : '無し') + ' / 実際 ' + 全);
    return bad;
  };
  const ja = read('cpsbvbng26-dotcom', 'README.md') || '', en = read('cpsbvbng26-dotcom', 'README.en.md') || '';
  const now = 問題(ja, false).concat(問題(en, true).map((x) => 'en ' + x));
  check('README（日英）の修了証の節が名乗る群ごとの件数と合計が、並ぶバッジの数と合う', now.length === 0, now.join(' / '));
  const 壊し = [
    問題(ja.replace('**edX**（4 件）', '**edX**（5 件）'), false),
    問題(ja.replace('修了証・オープンバッジ 計 7 件', '修了証・オープンバッジ 計 8 件'), false),
    問題(en.replace('**edX** (4)', '**edX** (3)'), true),
    問題(ja.replace(/\n\[!\[ER22\.1x[^\n]*\n/, '\n'), false),
  ];
  check('壊して確かめる：群の件数・合計・英語の群・バッジの行を動かすと落ちる（' + 壊し.filter((b) => b.length).length + ' / ' + 壊し.length + '）', 壊し.every((b) => b.length > 0), '');
}
{
  /* 七。README の「次に読むなら」が名乗る、読者が誤った版に辿り着く誤りの件数（決めごと 5）。trinity-infinity の正誤表の重大度の印から数える。 */
  const 印 = '**重大度: 高（読者が誤った版に辿り着く）**';
  const 問題 = (readme, errata) => {
    if (errata === null) return ['trinity-infinity が並んでいない'];
    const m = /読者が誤った版に辿り着く誤りが (\d+) 件ある/.exec(readme);
    const n = errata.split(印).length - 1;
    return m && Number(m[1]) === n && n > 0 ? [] : ['名乗り ' + (m ? m[1] : '無し') + ' / 正誤表 ' + n];
  };
  const r = read('cpsbvbng26-dotcom', 'README.md') || '', e = read('trinity-infinity', 'ERRATA.md');
  const now = 問題(r, e);
  check('README が名乗る、読者が誤った版に辿り着く誤りの件数が、trinity-infinity の正誤表の印の数と合う', now.length === 0, now.join(''));
  const 壊し = [問題(r.replace(/(読者が誤った版に辿り着く誤りが )(\d+)/, (x, p, d) => p + (Number(d) + 1)), e), 問題(r, (e || '') + '\n' + 印 + '\n')];
  check('壊して確かめる：README の数を動かすか、正誤表に印を一つ足すと落ちる（' + 壊し.filter((b) => b.length).length + ' / ' + 壊し.length + '）', 壊し.every((b) => b.length > 0), '');
}

{
  /* 八。README（日英）の検査の並びが名乗る数（決めごと 5）。ほかの検査が実際と突き合わせている名乗りに揃える。
   * キーボードの項目は verify.yml の仕事の名（check_site.js が頁の数から数え直す）、DOI の索引を当たる道具の項目と壊す先は
   * doi-index-check/README.md（道具自身が数え直す）、辿る頁は verification/pages.json、全部回す検査の本数は check_all.js の表。
   * self-correction の README が名乗る登録簿の全体の数も、ここで register.toml と数え合わせる。 */
  const R = 'cpsbvbng26-dotcom';
  const x = {
    ja: read(R, 'README.md') || '', en: read(R, 'README.en.md') || '', yml: read(R, path.join('.github', 'workflows', 'verify.yml')) || '',
    tool: read(R, path.join('doi-index-check', 'README.md')) || '', toolYml: read(R, path.join('.github', 'workflows', 'doi-index-check.yml')) || '',
    pages: read(R, path.join('verification', 'pages.json')) || '{"pages":[]}', all: read(R, path.join('verification', 'check_all.js')) || '',
    sc: read('self-correction', 'README.md') || '', reg: read('self-correction', 'register.toml') || '',
  };
  const 数 = (t, re) => { const m = re.exec(t); return m ? Number(m[1]) : NaN; };
  const 問題 = (c) => {
    const bad = [];
    const kb = 数(c.yml, /キーボードで辿れるか (\d+) 項目/), tl = 数(c.tool, /検査は \*\*(\d+) 項目\*\*/), br = 数(c.tool, /壊す先は \*\*(\d+) 通り\*\*/);
    const pg = JSON.parse(c.pages).pages.length, ck = (c.all.match(/^ {2}\['[^']+', '[^']+', '(?:node|python3)'/gm) || []).length;
    const reg = (c.reg.match(/^\[\[entry\]\]$/gm) || []).length;
    const want = [
      ['README.md のキーボード', 数(c.ja, /Tab で辿って測る (\d+) 項目/), kb], ['README.en.md のキーボード', 数(c.en, /Tab traversal, (\d+) checks/), kb],
      ['README.md の道具の項目', 数(c.ja, /DOI の索引を当たる道具 (\d+) 項目/), tl], ['README.md の壊す先', 数(c.ja, /--break {2}# 壊す先 (\d+) 通り/), br],
      ['道具の仕事の名の項目', 数(c.toolYml, /name: 道具自身 (\d+) 項目/), tl], ['道具の仕事の名の壊す先', 数(c.toolYml, /項目 \/ 壊す先 (\d+) 通り/), br],
      ['README.md の辿る頁', 数(c.ja, /(\d+) ページを Tab で辿り/), pg], ['README.en.md の辿る頁', 数(c.en, /It tabs through (\d+) pages/), pg],
      ['README.md の全部回す本数', 数(c.ja, /10 リポジトリの検査を全部（(\d+) 本）/), ck],
      ['self-correction の README の全体', 数(c.sc, /^(\d+) 件のうち \d+ 件は、あとからの再構成です。/m), reg],
      ['self-correction の README の found_by の無い項目', 数(c.sc, /残る (\d+) 件には書いていません。/), reg - (c.reg.match(/^found_by = /gm) || []).length],
    ];
    for (const [w, a, b] of want) if (!(a === b && b > 0)) bad.push(w + ' ' + a + ' / 実際 ' + b);
    return bad;
  };
  const now = 問題(x);
  check('README（日英）の検査の並びと道具の仕事の名が名乗る数、self-correction の README の登録簿の数が、数え直した側と合う（11 箇所）', now.length === 0, now.join(' / '));
  const w = (k, a, b) => Object.assign({}, x, { [k]: x[k].replace(a, b) });
  const 壊し = [
    ['キーボードの項目', w('ja', /Tab で辿って測る \d+ 項目/, 'Tab で辿って測る 1 項目')], ['英語の頁の数', w('en', /It tabs through \d+ pages/, 'It tabs through 1 pages')],
    ['道具の仕事の名', w('toolYml', /name: 道具自身 \d+ 項目/, 'name: 道具自身 1 項目')], ['壊す先', w('ja', /--break {2}# 壊す先 \d+ 通り/, '--break  # 壊す先 1 通り')],
    ['全部回す本数', w('ja', /全部（\d+ 本）/, '全部（1 本）')], ['登録簿の全体', w('sc', /^\d+ 件のうち/m, '1 件のうち')],
    ['found_by の無い項目', w('sc', /残る \d+ 件には/, '残る 1 件には')],
  ];
  const 通った = 壊し.filter(([, c]) => 問題(c).length === 0).map(([n]) => n);
  check('壊して確かめる：README・仕事の名・self-correction の README の数を動かすと落ちる（' + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13d. 2026-11-18：黄金比の窓の予想の (a) と (b) の状態が、書いてあるどこでも同じ（命題 8 と 9 で証明済み。解決済みで、(a) と (b) の式は既知の定理の特別な場合、δ についての連続・狭義の増加・両端の極限は読んだ文献に見つからない）');
{
  /* 2026-11-18 に、trinity-operator のノートが予想の (a) を命題 8、(b) を命題 9 として証明した。
   * 状態を書く面は、ノート・開いている問題の頁・続ける範囲の二枚・README・予想のサイト・事前登録の頁の前書き・
   * 生成もとの設定（researcher-profile）・生成された頁（cpsbvbng26-dotcom）・目録・記録・trinity-infinity の README と年表。
   * どの面も、(a) が命題 8、(b) が命題 9 で証明済みだと、決まった文で書くこと。前の状態の文（未証明・開いている・
   * 予想の印）が一つでも残れば落とす。Sophaxis の 2026.0001 は凍結した Figshare の版の記録なので見ない。
   * 事前登録の頁は、線の下の登録した本文（OSF が正）を見ず、前書きだけを見る。 */
  const 面 = [
    ['trinity-operator', 'games/README.md', ['| for 1/φ < δ < 2/3, the sustainable set has length zero | resolved (Proposition 8); a special case of known theorems |', 'and runs from 0 to 1 across the interval | resolved (Proposition 9); the formula is a special case of known theorems; continuity, strict increase and the end limits were not found in the texts read |']],
    ['trinity-operator', 'games/OPEN-PROBLEM.md', ['| resolved: proved as Proposition 8 (2026-11-18) |', '| resolved: proved as Proposition 9 (2026-11-18) |', 'Its status is resolved (part (a) and the formula of part (b) are special cases of known theorems;']],
    ['trinity-operator', 'games/SCOPE.md', ['| resolved by Proposition 8 (2026-11-18);', '| resolved by Proposition 9 (2026-11-18);']],
    ['trinity-operator', 'games/SCOPE.ja.md', ['| 命題 8 で解決済み（2026-11-18）。', '| 命題 9 で解決済み（2026-11-18）。']],
    ['trinity-operator', 'games/PREREGISTRATION.md', ['Later. On 2026-11-18, parts (a) and (b) were proved as Propositions 8 and 9 of the note.']],
    ['trinity-operator', 'README.md', ['(a) と (b) は、2026-11-18 に証明しました。(a) が命題 8、(b) が命題 9 です。', '状態は「解決済み（(a) と (b) の式は既知の定理の特別な場合。δ についての連続・狭義の増加・両端の極限は、読んだ文献には見つからない）」です。']],
    ['trinity-operator', 'site/index.html', ['Both are proved: part (a) is Proposition 8 and part (b) is Proposition 9 of the note.', 'Status: resolved (part (a) and the formula of part (b) are special cases of known theorems;']],
    ['researcher-profile', 'golden-window.en.json', ['Both are proved: part (a) is Proposition 8 and part (b) is Proposition 9 of the note.', 'Status: resolved (part (a) and the formula of part (b) are special cases of known theorems;']],
    ['researcher-profile', 'golden-window.json', ['(a) は証明した（命題 8）。(b) も証明した（命題 9）。', '状態は、解決済み（(a) と (b) の式は既知の定理の特別な場合。δ についての連続・狭義の増加・両端の極限は、読んだ文献には見つからない）である。']],
    ['researcher-profile', 'golden-window.js', ['length zero (Proposition 8)', '狭義に増えること（命題 9）']],
    ['cpsbvbng26-dotcom', 'notes/golden-window.en.html', ['Both are proved: part (a) is Proposition 8 and part (b) is Proposition 9 of the note.', 'Status: resolved (part (a) and the formula of part (b) are special cases of known theorems;']],
    ['cpsbvbng26-dotcom', 'notes/golden-window.html', ['(a) は証明した（命題 8）。(b) も証明した（命題 9）。', '状態は、解決済み（(a) と (b) の式は既知の定理の特別な場合。']],
    ['researcher-profile', 'site.json', ['予想の二つの部分は、2026-11-18 に証明しました（命題 8 と 9）。', '予想は解決済みです。(a) と (b) の式は既知の定理の特別な場合です。']],
    ['cpsbvbng26-dotcom', 'index.html', ['予想の二つの部分は、2026-11-18 に証明しました（命題 8 と 9）。', '予想は解決済みです。(a) と (b) の式は既知の定理の特別な場合です。']],
    ['researcher-profile', 'site.en.json', ['Both parts of the conjecture were proved on 2026-11-18 (Propositions 8 and 9).', 'Part (a) and the formula of part (b) are special cases of known theorems;']],
    ['cpsbvbng26-dotcom', 'index.en.html', ['Both parts of the conjecture were proved on 2026-11-18 (Propositions 8 and 9).', 'Part (a) and the formula of part (b) are special cases of known theorems;']],
    ['researcher-profile', 'site.de.json', ['Beide Teile der Vermutung wurden am 18.11.2026 bewiesen (Propositionen 8 und 9).', 'Teil (a) und die Formel von Teil (b) sind Spezialfälle bekannter Sätze;']],
    ['cpsbvbng26-dotcom', 'index.de.html', ['Beide Teile der Vermutung wurden am 18.11.2026 bewiesen (Propositionen 8 und 9).', 'Teil (a) und die Formel von Teil (b) sind Spezialfälle bekannter Sätze;']],
    ['researcher-profile', 'site.fr.json', ['Les deux parties de la conjecture ont été démontrées le 18 novembre 2026 (propositions 8 et 9).', 'sont des cas particuliers de théorèmes connus ;']],
    ['cpsbvbng26-dotcom', 'index.fr.html', ['Les deux parties de la conjecture ont été démontrées le 18 novembre 2026 (propositions 8 et 9).', 'sont des cas particuliers de théorèmes connus ;']],
    ['researcher-profile', 'site.it.json', ['Le due parti della congettura sono state dimostrate il 18 novembre 2026 (proposizioni 8 e 9).', 'sono casi particolari di teoremi noti;']],
    ['cpsbvbng26-dotcom', 'index.it.html', ['Le due parti della congettura sono state dimostrate il 18 novembre 2026 (proposizioni 8 e 9).', 'sono casi particolari di teoremi noti;']],
    ['researcher-profile', 'catalog.json', ['ノートの命題 8 と 9 で 2026-11-18 に証明した。解決済み（(a) と (b) の式は既知の定理の特別な場合。', 'the note proves them as Propositions 8 and 9 (2026-11-18). Resolved: part (a) and the formula of part (b) are special cases of known theorems']],
    ['cpsbvbng26-dotcom', 'catalog.json', ['ノートの命題 8 と 9 で 2026-11-18 に証明した。解決済み（(a) と (b) の式は既知の定理の特別な場合。', 'the note proves them as Propositions 8 and 9 (2026-11-18). Resolved: part (a) and the formula of part (b) are special cases of known theorems']],
    ['cpsbvbng26-dotcom', 'docs/self-assessment.md', ['2026-11-18 に (a) と (b) をノートの命題 8 と 9 で証明した。解決済み（(a) と (b) の式は既知の定理の特別な場合。', '2026-11-18 に、予想の (a) と (b) を証明しました。ノートの命題 8 と命題 9 です。']],
    ['cpsbvbng26-dotcom', 'docs/figshare.md', ['(a) と (b) は、2026-11-18 にノートの命題 8 と命題 9 で証明しました。予想は解決済みです。(a) と (b) の式は既知の定理の特別な場合です。']],
    ['cpsbvbng26-dotcom', 'docs/doi-index.md', ['二つは、2026-11-18 に trinity-operator のノートの命題 8 と命題 9 で証明しました。(a) と (b) の式は既知の定理の特別な場合です。']],
    ['trinity-infinity', 'README.md', ['予想は、2026-11-18 にノートの命題 8 と 9 で解決しました。', '(a) と (b) の式は、既知の定理の特別な場合です。', 'The conjecture was resolved on 2026-11-18, as Propositions 8 and 9 of the note']],
    ['trinity-infinity', 'TIMELINE.md', ['| 2026-11-18 | ノートの命題 8 と 9 | 黄金比の窓の予想の (a) と (b) | 予想の二つの部分を証明した。', '予想は解決済み（(a) と (b) の式は既知の定理の特別な場合。']],
  ];
  /* 前の状態の文。どの面にも残さない。 */
  const 古い = [
    /\| Golden-window conjecture \([ab]\) \|[^\n]*\| \*\*conjecture\*\* \|/, /\| `conjecture \([ab]\)` \| Golden-window conjecture \([ab]\) \| open \|/,
    /証明されていない予想/, /It has not been proved\./, /予想には証明が無く/, /There is no proof, and the evidence is numerical only/,
    /Ein Beweis fehlt/, /Il n’y a pas de preuve/, /Non c’è una dimostrazione/, /is conjecture \(a\), and is not proved/,
    /予想 \(a\) で、証明していない/, /Part \(b\) is (still a conjecture|open)/, /\(b\) は証明していません/, /Part \(b\) remains\./,
    /a proof, or a counterexample, (that|about)/, /の証明か反例/,
    /* 2026-11-18 の要旨までの照合の前の状態の文。照合した命題 8・9 を「照合していない」と書かない。 */
    /The proofs have not been checked against the literature\.<\/b>/, /証明は文献と照合していない/, /Neither proof has been checked against the literature/,
    /proved by Propositions 8 and 9; literature not checked/, /予想は証明済みです/, /文献との照合を条件として/,
    /the conjecture is proved, subject to the literature check/, /They have not been checked against the literature\. Parts of the results/,
    /* 照合の途中の文（要旨まで、2026-11-18）と、取り下げられた「同時の連続が壊れる」。 */
    /read at abstract level only\)/, /文献は要旨までしか/, /一部は既知の結果から従/, /follows from known results/,
    /known in substance/, /partly known/, /fails in general/, /一部が既知/,
  ];
  const 読む = (repo, rel) => {
    const t = read(repo, rel);
    return t === null ? null : (rel === 'games/PREREGISTRATION.md' ? t.split('\n---\n')[0] : t);
  };
  const 今 = {};
  面.forEach(([repo, rel]) => { 今[repo + '/' + rel] = 読む(repo, rel); });
  const 問題 = (m) => {
    const bad = [];
    面.forEach(([repo, rel, want]) => {
      const t = m[repo + '/' + rel];
      if (t === null || t === undefined) { bad.push(repo + '/' + rel + ' が無い'); return; }
      const flat = t.replace(/\s+/g, ' ');
      const miss = want.filter((w) => t.indexOf(w) < 0 && flat.indexOf(w) < 0);
      if (miss.length) bad.push(repo + '/' + rel + ' に「' + miss[0].slice(0, 30) + '」が無い');
      const old = 古い.find((re) => re.test(t) || re.test(flat));
      if (old) bad.push(repo + '/' + rel + ' に前の状態の文 ' + old);
    });
    return bad;
  };
  const now = 問題(今);
  check('予想の (a) と (b) の状態が、' + 面.length + ' の面のどれでも「命題 8 と 9 で証明済み」（解決済み、(a) と (b) の式は既知の定理の特別な場合）で、前の状態の文が残っていない',
    now.length === 0, now.slice(0, 4).join(' / '));
  const 替 = (k, a, b) => Object.assign({}, 今, { [k]: (今[k] || '').replace(a, b) });
  const 壊し = [
    ['ノートの表の (b) を予想に戻す', 替('trinity-operator/games/README.md', '| resolved (Proposition 9); the formula is a special case of known theorems; continuity, strict increase and the end limits were not found in the texts read |', '| **conjecture** |')],
    ['予想のサイトの状態を、照合の途中の文に戻す', 替('trinity-operator/site/index.html', 'Status: resolved (part (a) and the formula of part (b) are special cases of known theorems;', 'Status: resolved (part follows from known results; the literature was read at abstract level only).')],
    ['ラベルの表の (a) を open に戻す', 替('trinity-operator/games/OPEN-PROBLEM.md', '| resolved: proved as Proposition 8 (2026-11-18) |', '| open |')],
    ['続ける範囲の頁の (b) を証明か反例に戻す', 替('trinity-operator/games/SCOPE.ja.md', '| 命題 9 で解決済み（2026-11-18）。', '| `T_δ` の次元についての証明か反例')],
    ['予想のサイトを未証明に戻す', 替('trinity-operator/site/index.html', 'Both are proved: part (a) is Proposition 8 and part (b) is Proposition 9 of the note.', 'It has not been proved.')],
    ['生成された日本語の頁だけを古い文に戻す', 替('cpsbvbng26-dotcom/notes/golden-window.html', '(a) は証明した（命題 8）。(b) も証明した（命題 9）。', '証明されていない予想である。')],
    ['トップのイタリア語だけを古い文に戻す', 替('cpsbvbng26-dotcom/index.it.html', 'Le due parti della congettura sono state dimostrate il 18 novembre 2026 (proposizioni 8 e 9).', 'Non c’è una dimostrazione.')],
    ['設定のドイツ語の命題の番号を違える', 替('researcher-profile/site.de.json', '(Propositionen 8 und 9)', '(Propositionen 8 und 10)')],
    ['目録の英語から証明の一文を外す', 替('researcher-profile/catalog.json', 'the note proves them as Propositions 8 and 9 (2026-11-18', 'the note discusses them')],
    ['年表の行を落とす', 替('trinity-infinity/TIMELINE.md', '| 2026-11-18 | ノートの命題 8 と 9 |', '| 2026-11-18 | ノート |')],
    ['trinity-infinity の README の英語の欄の日付を違える', 替('trinity-infinity/README.md', 'resolved on 2026-11-18, as Propositions 8 and 9', 'resolved on 2026-11-19, as Propositions 8 and 9')],
    ['ノートに、取り下げられた「同時の連続は壊れる」を書き戻す', 替('trinity-operator/games/README.md', '## The literature check of 2026-11-18\n', '## The literature check of 2026-11-18\n\nJoint continuity fails in general.\n')],
    ['事前登録の前書きを消す', 替('trinity-operator/games/PREREGISTRATION.md', 'Later. On 2026-11-18, parts (a) and (b) were proved', 'Later. On 2026-11-18, part (a) was proved')],
  ];
  const 通った = 壊し.filter(([, c]) => 問題(c).length === 0).map(([n]) => n);
  check('壊して確かめる：ノート・ラベル・続ける範囲・サイト・生成された頁・五言語の一つ・設定・目録・年表・英語の欄・事前登録の前書きのどれか一つを戻すと落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13e. 2026-11-18：research-collaboration（共同研究の入口、十の外）の写し・決めごとの番号・条文・入口のリンク');
{
  /* research-collaboration は、決めごと 15 が新しい主題の経路に挙げる共同研究の入口である。十の外に置く。
   * 一。SECURITY.md・誤りの知らせの様式・突き合わせの受付の二つは、ここの正本と一字一句同じで、
   *     その verification/copies.json の sha256 も、ここの正本の sha256 と同じ。
   * 二。その散文が引く「決めごと 15」は、ここの CLAUDE.md の 15 番で、台帳（numbers.json）の初めの文で始まる。
   * 三。その取り寄せた条文は、ここと Sophaxis と Nusquama が取り寄せた同じ条の文と一字一句同じ。
   * 四。docs/collaboration.md が、その入口を指す。 */
  const RC = 'research-collaboration';
  const 写し = ['SECURITY.md', '.github/ISSUE_TEMPLATE/error-report.yml', '.github/checked-intake/verify.js', '.github/workflows/checked-intake.yml'];
  const 今 = {
    copies: read(RC, path.join('verification', 'copies.json')), numbers: read(RC, path.join('verification', 'numbers.json')),
    texts: read(RC, path.join('verification', 'statutes-texts.json')), claude: read('cpsbvbng26-dotcom', 'CLAUDE.md'),
    collab: read('cpsbvbng26-dotcom', path.join('docs', 'collaboration.md')),
    so: read('sophaxis', path.join('verification', 'statutes-texts.json')), nu: read('nusquama', path.join('verification', 'statutes-texts.json')),
    cp: read('cpsbvbng26-dotcom', path.join('verification', 'statutes.json')),
  };
  写し.forEach((f) => { 今['正:' + f] = read('cpsbvbng26-dotcom', f); 今['写:' + f] = read(RC, f); });
  const 英 = { '個人情報保護法': 'Act on the Protection of Personal Information', '著作権法': 'Copyright Act', '民法': 'Civil Code' };
  const 問題 = (m) => {
    const bad = [];
    const 無い = Object.keys(m).filter((k) => m[k] === null);
    if (無い.length) return [RC + ' か兄弟のファイルが無い：' + 無い.join(', ')];
    let J, N, T, S, U, P;
    try { J = JSON.parse(m.copies); N = JSON.parse(m.numbers); T = JSON.parse(m.texts); S = JSON.parse(m.so); U = JSON.parse(m.nu); P = JSON.parse(m.cp)['条文']; } catch (e) { return ['JSON が読めない']; }
    for (const f of 写し) {
      if (m['写:' + f] !== m['正:' + f]) bad.push(f + ' が正本と違う');
      if (require('crypto').createHash('sha256').update(m['正:' + f], 'utf8').digest('hex') !== (J['写し'] || {})[f]) bad.push('copies.json の ' + f + ' の sha256 が正本と違う');
    }
    if (Object.keys(J['写し'] || {}).length !== 写し.length) bad.push('copies.json の写しの数');
    const r = N.rule || {};
    const 行 = m.claude.split('\n').find((l) => l.startsWith(r.number + '. '));
    if (!行 || 行 !== r.number + '. ' + r.begins || r.re !== '決めごと ' + r.number) bad.push('決めごと ' + r.number + ' の初めの文が CLAUDE.md と違う');
    let 比べた = 0;
    for (const [k, v] of Object.entries(T)) {
      const law = k.split(' ')[0], 条 = (/第(\d+)条$/.exec(k) || [])[1];
      const 相手 = [U[k], P[k] && P[k]['文'], 条 && 英[law] ? S[英[law] + ' Article ' + 条] : undefined].filter((x) => x !== undefined);
      比べた += 相手.length;
      if (相手.some((x) => x !== v)) bad.push(k + ' が兄弟の取り寄せた文と違う');
    }
    if (比べた < 10) bad.push('比べた組が少ない（' + 比べた + '）');
    if (m.collab.indexOf('(https://github.com/cpsbvbng26-dotcom/research-collaboration)') < 0) bad.push('docs/collaboration.md が入口を指さない');
    return bad;
  };
  const now = 問題(今);
  check('research-collaboration：正本の写しと sha256、決めごと 15 の初めの文、取り寄せた条文が兄弟の文と同じこと、docs/collaboration.md のリンク',
    now.length === 0, now.slice(0, 4).join(' / '));
  const 替 = (k, a, b) => Object.assign({}, 今, { [k]: String(今[k] || '').replace(a, b) });
  const 壊し = [
    ['写しの SECURITY.md を一字変える', 替('写:SECURITY.md', '7 日以内', '8 日以内')],
    ['正本の様式だけを変える', 替('正:.github/ISSUE_TEMPLATE/error-report.yml', 'title: "誤り: "', 'title: "誤りの知らせ: "')],
    ['copies.json の sha256 を一つ変える', 替('copies', /"SECURITY\.md": "[0-9a-f]/, '"SECURITY.md": "x')],
    ['決めごと 15 の初めの文を変える', 替('claude', '15. **独学の成果は、学部一年次までのものとする。**', '15. **独学の成果は、学部二年次までのものとする。**')],
    ['台帳の決めごとの番号を変える', 替('numbers', '"number": 15', '"number": 14')],
    ['取り寄せた条文を一字変える', 替('texts', '個人情報取扱事業者は、個人情報を取り扱うに当たっては', '個人情報取扱事業者は、個人情報を扱うに当たっては')],
    ['docs/collaboration.md のリンクを外す', 替('collab', '(https://github.com/cpsbvbng26-dotcom/research-collaboration)', '(https://github.com/cpsbvbng26-dotcom)')],
    ['research-collaboration が無い', Object.assign({}, 今, { copies: null })],
  ];
  const 通った = 壊し.filter(([, c]) => 問題(c).length === 0).map(([n]) => n);
  check('壊して確かめる：写し・正本・sha256・決めごとの文・番号・条文・リンク・リポジトリの欠けのどれか一つで落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13f. 2026-11-19：本文の空の issue に答えるワークフロー（.github/workflows/empty-issue.yml）が 15 のリポジトリで一字一句同じで、閉じず・鍵を掛けず・消さず、決めた issue にだけ答える');
{
  /* 2026-11-18 に利用者が余計な issue を除く仕組みを求め、2026-11-19 に Claude が決めた。きっかけは、スマートフォンで様式が出ず、本文の空のまま
   * 開かれた issue である。GitHub の説明書（Deleting an issue）は、個人のアカウントが持つリポジトリでは、そのアカウントだけが
   * issue を消せると書く。実行の鍵はそのアカウントではないので、消さない。閉じもせず、鍵も掛けない。題に求め（削除・権利・
   * 個人の情報・氏名・同意の撤回）が書かれうるが、語の並びでは見分けきれず（2026-11-15）、Sophaxis の規程は自動の手順が鍵を
   * 掛けないと書くためである。することは、ラベル empty body と、様式を指す決まった文のコメントを一つ付けることだけである。
   * 一。15 のリポジトリの写しが、ここの正本と一字一句同じ。docs/checks.md の名乗る数が、写しの数と同じ。
   * 二。形：権限は issues: write だけ、起こすのは開いた・直した issue と週に一度、仕事は一つで時間の上限は 15 分まで、
   *     開いたときだけ 10 分待つ、actions は 40 桁で固め、受付と同じコミットを指す。issue の文を環境とコマンドに入れない。
   *     道具に閉じる・鍵を掛ける・消す呼び出しが無い。
   * 三。振る舞い：道具の文をそのまま子の工程で、作った issue に走らせ、どの見本でも、呼んだ API が決めたとおりになる。
   *     ログに題も本文も出ない。 */
  const EI = path.join('.github', 'workflows', 'empty-issue.yml');
  const REPOS = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check', 'research-collaboration', 'golden-window-resolution']);
  const 今 = { wf: Object.fromEntries(REPOS.map((r) => [r, read(r, EI)])), checks: read('cpsbvbng26-dotcom', path.join('docs', 'checks.md')) || '',
    intake: read('cpsbvbng26-dotcom', path.join('.github', 'workflows', 'checked-intake.yml')) || '' };
  const SAY = /本文の空の issue に答える仕事（`empty-issue\.yml`）は、(\d+) のリポジトリに一字一句同じ写しを置いています。/;
  const scriptOf = (t) => {
    const m = /\n {10}node - <<'SCRIPT'\n([\s\S]*?)\n {10}SCRIPT\n/.exec(String(t || ''));
    return m ? m[1].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n') : null;
  };
  /* 子の工程：道具を見本ごとに走らせ、呼んだ API・ログ・終わりの番号を返す。fetch・fs・process・console は差し替える。 */
  const CHILD = String.raw`
    const S = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    const out = [];
    (async () => {
      for (const sc of S.scenarios) {
        const calls = [], logs = [];
        let code = 0;
        const now = Date.now(), H = 60 * 60 * 1000;
        const fix = (i) => Object.assign({ state: 'open', body: '', labels: [], comments: 0, user: { login: 'alice', type: 'User' }, author_association: 'NONE',
          title: 'TITLE-MARK-' + i.number }, i, { created_at: new Date(now - (i.hours === undefined ? 0.2 : i.hours) * H).toISOString() });
        const api = Object.fromEntries((sc.api || []).map((i) => [i.number, fix(i)]));
        const list = (sc.list || []).map(fix);
        const fetch = async (url, o) => {
          const m = (o && o.method) || 'GET', u = String(url).replace('https://api.github.com/repos/o/r', '');
          calls.push({ m, u, b: o && o.body ? JSON.parse(o.body) : null });
          if (sc.fail && m !== 'GET') return { ok: false, status: 500, json: async () => ({}) };
          let body = {}, status = 200;
          if (m === 'GET' && /^\/issues\?/.test(u)) { const p = Number(/[?&]page=(\d+)/.exec(u)[1]), per = Number(/[?&]per_page=(\d+)/.exec(u)[1]); body = list.slice((p - 1) * per, p * per); }
          else if (m === 'GET') { const n = Number(u.split('/')[2]); body = api[n] || list.find((i) => i.number === n); if (!body) status = 404; }
          else if (m === 'POST' && u === '/labels') status = sc.labelExists ? 422 : 201;
          return { ok: status < 300, status, json: async () => body };
        };
        const fakeFs = { readFileSync: () => JSON.stringify(sc.event || {}) };
        const proc = { env: { GITHUB_REPOSITORY: 'o/r', GITHUB_SERVER_URL: 'https://github.com', GITHUB_TOKEN: 'x', GITHUB_EVENT_PATH: '/e', GITHUB_EVENT_NAME: sc.name }, exit: (c) => { code = c; } };
        const cons = { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) };
        try { new Function('require', 'process', 'fetch', 'console', S.script)((n) => (n === 'fs' ? fakeFs : require(n)), proc, fetch, cons); } catch (e) { code = 'throw'; }
        await new Promise((r) => setTimeout(r, 30));
        out.push({ calls, logs, code });
      }
      process.stdout.write(JSON.stringify(out));
    })();`;
  const ev = (action, n, o = {}) => ({ action, issue: Object.assign({ number: n, body: '', labels: [] }, o) });
  const many = (extra) => Array.from({ length: 150 }, (_, k) => ({ number: 1000 + k, body: 'filled', hours: 100 })).map((i, k) => extra[k] || i);
  /* 見本：[名, 見本, 呼ぶはずの書き込み（GET を除く、メソッドと URL）]。 */
  const W3 = (n) => ['POST /labels', 'POST /issues/' + n + '/labels', 'POST /issues/' + n + '/comments'];
  const SC = [
    ['開いた・空・ラベル無し', { name: 'issues', event: ev('opened', 5), api: [{ number: 5 }] }, W3(5)],
    ['開いた・待つあいだに本文が書かれた', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, body: '### What it says\n\nBODY-MARK' }] }, []],
    ['開いた・空白だけ', { name: 'issues', event: ev('opened', 6), api: [{ number: 6, body: ' \n\t \r\n' }] }, W3(6)],
    ['開いた・ラベルあり', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, labels: [{ name: 'erratum' }] }] }, []],
    ['開いた・bot', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, user: { login: 'x[bot]', type: 'Bot' } }] }, []],
    ['開いた・持ち主', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, author_association: 'OWNER' }] }, []],
    ['開いた・共同作業者', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, author_association: 'COLLABORATOR' }] }, []],
    ['開いた・コメントあり', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, comments: 1 }] }, []],
    ['開いた・もう閉じている', { name: 'issues', event: ev('opened', 5), api: [{ number: 5, state: 'closed' }] }, []],
    ['開いた・ラベルがもうある（422）', { name: 'issues', labelExists: true, event: ev('opened', 7), api: [{ number: 7 }] }, W3(7)],
    ['直した・ラベルあり・本文が書かれた', { name: 'issues', event: ev('edited', 8), api: [{ number: 8, body: 'BODY-MARK', labels: [{ name: 'empty body' }] }] }, ['DELETE /issues/8/labels/empty%20body']],
    ['直した・ラベルあり・まだ空', { name: 'issues', event: ev('edited', 8), api: [{ number: 8, labels: [{ name: 'empty body' }] }] }, []],
    ['直した・ラベル無し・書かれた', { name: 'issues', event: ev('edited', 8), api: [{ number: 8, body: 'BODY-MARK' }] }, []],
    ['週に一度・2 頁目の古い空の issue だけ', { name: 'schedule', event: {}, list: many({ 3: { number: 21, hours: 2 }, 5: { number: 22, hours: 72, pull_request: {} }, 7: { number: 23, hours: 72, labels: [{ name: 'x' }] },
      9: { number: 24, hours: 72, body: 'BODY-MARK' }, 11: { number: 25, hours: 72, user: { login: 'b[bot]', type: 'Bot' } }, 120: { number: 20, hours: 72 } }) }, W3(20)],
    ['API が落ちる', { name: 'issues', fail: true, event: ev('opened', 9), api: [{ number: 9 }] }, ['POST /labels']],
  ];
  const run = (script) => {
    try { return JSON.parse(execFileSync(process.execPath, ['-e', CHILD], { encoding: 'utf8', input: JSON.stringify({ script, scenarios: SC.map((s) => s[1]) }) })); } catch (e) { return null; }
  };
  const ran = new Map();
  const runOnce = (s) => { if (!ran.has(s)) ran.set(s, run(s)); return ran.get(s); };
  function 問題(x) {
    const bad = [];
    const t0 = x.wf['cpsbvbng26-dotcom'];
    if (!t0) return ['正本が無い'];
    /* 一。写しと名乗る数。 */
    for (const r of REPOS) if (x.wf[r] !== t0) bad.push(r + '：' + (x.wf[r] === null ? '写しが無い' : '写しが違う'));
    const m = SAY.exec(x.checks);
    if (!m || Number(m[1]) !== REPOS.filter((r) => x.wf[r] === t0).length || Number(m[1]) !== REPOS.length) bad.push('docs/checks.md の名乗る数が写しの数と違う');
    /* 二。形。 */
    const code = t0.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    if (!/\non:\n  issues:\n    types: \[opened, edited\]\n  schedule:\n    - cron: '\d+ \d+ \* \* \d'\npermissions:\n  issues: write\njobs:\n  answer:\n/.test(code)) bad.push('起こすもの・権限・仕事の形');
    if ((code.match(/permissions:/g) || []).length !== 1) bad.push('権限がほかにもある');
    const to = /\n {4}timeout-minutes: (\d+)\n/.exec(code);
    if (!to || Number(to[1]) > 15 || (code.match(/timeout-minutes:/g) || []).length !== 1) bad.push('時間の上限');
    if (!/\n {6}- if: github\.event_name == 'issues' && github\.event\.action == 'opened'\n {8}run: sleep 600\n/.test(code)) bad.push('開いたときに 10 分待たない');
    const uses = [...code.matchAll(/uses: (\S+)@(\S+)/g)];
    if (!uses.length || uses.some(([, a, sha]) => !/^[0-9a-f]{40}$/.test(sha) || !x.intake.includes('uses: ' + a + '@' + sha))) bad.push('actions を受付と同じコミットで固めていない');
    if (/\$\{\{[^}]*github\.event\.(issue|comment)\.(body|title|user)|toJSON\(/.test(code) || /\$\{\{/.test(code.replace(/\$\{\{ secrets\.GITHUB_TOKEN \}\}/, ''))) bad.push('式で issue の中身を読む');
    const s = scriptOf(t0);
    if (s === null) return bad.concat(['道具が取り出せない']);
    if (/'PATCH'|'PUT'|\/lock|lock_reason|state_reason|state:|deleteIssue|graphql/i.test(s)) bad.push('道具に閉じる・鍵を掛ける・消す呼び出しがある');
    if (!s.includes('const DAY = 24 * 60 * 60 * 1000;')) bad.push('週の見回りの 24 時間');
    for (const w of ['この issue は閉じず、鍵も掛けません。', 'This issue is not closed or locked.', "'/issues/new/choose'", '一部のスマートフォンのアプリやブラウザでは、issue の様式が表示されないことがあります。', 'The issue forms may not show in some mobile apps and browsers.'])
      if (!s.includes(w)) bad.push('コメントに「' + w.slice(0, 16) + '」が無い');
    /* 三。振る舞い。 */
    const res = runOnce(s);
    if (!res || res.length !== SC.length) return bad.concat(['道具が走らない']);
    SC.forEach(([name, sc, want], k) => {
      const r = res[k];
      const writes = r.calls.filter((c) => c.m !== 'GET').map((c) => c.m + ' ' + c.u);
      if (JSON.stringify(writes) !== JSON.stringify(want)) bad.push(name + '：' + (writes.join('、') || '書かない'));
      if (r.logs.some((l) => /TITLE-MARK|BODY-MARK/.test(l))) bad.push(name + '：ログに題か本文が出る');
      if (sc.fail ? r.code !== 1 : r.code !== 0) bad.push(name + '：終わりの番号 ' + r.code);
      const c = r.calls.find((y) => /\/comments$/.test(y.u));
      if (c && !(c.b.body.includes('https://github.com/o/r/issues/new/choose') && /本文が空/.test(c.b.body) && /empty body/.test(c.b.body))) bad.push(name + '：コメントが様式を指さない');
      if (/^開いた|^直した/.test(name) && !r.calls.some((y) => y.m === 'GET' && y.u === '/issues/' + sc.event.issue.number)) bad.push(name + '：issue を読み直さない');
    });
    return bad;
  }
  const now = 問題(今);
  check('本文の空の issue に答えるワークフロー：' + REPOS.length + ' のリポジトリの写しが正本と一字一句同じで、権限は issues: write だけ、閉じる・鍵を掛ける・消す呼び出しが無く、'
    + SC.length + ' の見本で決めた issue にだけラベルとコメントを付け、ログに題と本文を出さない', now.length === 0, now.slice(0, 6).join(' / '));
  const wf = (r, f) => Object.assign({}, 今, { wf: Object.assign({}, 今.wf, { [r]: f(今.wf[r]) }) });
  const all = (f) => Object.assign({}, 今, { wf: Object.fromEntries(REPOS.map((r) => [r, f(今.wf[r])])) });
  const 壊し = [
    ['一つの写しを一字変える', wf('golden-window-resolution', (t) => t.replace('waits 10 minutes', 'waits ten minutes'))],
    ['一つの写しが無い', wf('research-collaboration', () => null)],
    ['名乗る数を変える', Object.assign({}, 今, { checks: 今.checks.replace(SAY, (a, n) => a.replace(n, String(Number(n) + 1))) })],
    ['権限に contents: write を足す', all((t) => t.replace('permissions:\n  issues: write\n', 'permissions:\n  contents: write\n  issues: write\n'))],
    ['PR でも起こす', all((t) => t.replace('  schedule:\n', '  pull_request_target:\n  schedule:\n'))],
    ['時間の上限を 60 分に', all((t) => t.replace('timeout-minutes: 15', 'timeout-minutes: 60'))],
    ['待たない', all((t) => t.replace('run: sleep 600', 'run: sleep 6'))],
    ['actions を版の名で指す', all((t) => t.replace(/setup-node@[0-9a-f]{40}/, 'setup-node@v7'))],
    ['本文を環境に入れる', all((t) => t.replace('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n', 'GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n          BODY: ${{ github.event.issue.body }}\n'))],
    ['閉じる', all((t) => t.replace("            await gh('POST', '/issues/' + n + '/comments', { body: COMMENT });\n", "            await gh('POST', '/issues/' + n + '/comments', { body: COMMENT });\n            await gh('PATCH', '/issues/' + n, { state: 'closed', state_reason: 'not_planned' });\n"))],
    ['鍵を掛ける', all((t) => t.replace("            await gh('POST', '/issues/' + n + '/comments', { body: COMMENT });\n", "            await gh('POST', '/issues/' + n + '/comments', { body: COMMENT });\n            await gh('PUT', '/issues/' + n + '/lock', { lock_reason: 'off-topic' });\n"))],
    ['ラベルを見ない', all((t) => t.replace('&& (i.labels || []).length === 0 ', ''))],
    ['bot を見ない', all((t) => t.replace("&& !(i.user && i.user.type === 'Bot') ", ''))],
    ['持ち主と共同作業者を見ない', all((t) => t.replace('&& !STAFF.includes(i.author_association)', ''))],
    ['コメントを見ない', all((t) => t.replace('&& Number(i.comments || 0) === 0', ''))],
    ['週の見回りが 24 時間を待たない', all((t) => t.replace('if (!qualifies(x, DAY)) continue;', 'if (!qualifies(x, 0)) continue;').replace('if (qualifies(i, DAY))', 'if (qualifies(i, 0))'))],
    ['1 頁目しか読まない', all((t) => t.replace('if (list.length < 100) break;', 'break;'))],
    ['読み直さず出来事の issue を使う', all((t) => t.replace("const i = await gh('GET', '/issues/' + n);", 'const i = event.issue;'))],
    ['ログに題を書く', all((t) => t.replace("else console.log('#' + n + ': left alone.');", "else console.log('#' + n + ': left alone. ' + i.title);"))],
    ['本文が書かれてもラベルを外さない', all((t) => t.replace("await gh('DELETE', '/issues/' + n + '/labels/' + encodeURIComponent(LABEL));", ''))],
    ['コメントから様式のリンクを外す', all((t) => t.replace("const forms = server + '/' + repo + '/issues/new/choose';", "const forms = server + '/' + repo;"))],
    ['API の失敗で止まらない', all((t) => t.replace("if (!r.ok) throw new Error(method + ' ' + url.split('?')[0] + ' answered ' + r.status);", ''))],
  ];
  const 通った = 壊し.filter(([, y]) => 問題(y).length === 0).map(([n]) => n);
  check('壊して確かめる：写し・名乗る数・権限・起こすもの・時間の上限・待ち・固めた actions・環境の本文・閉じる・鍵を掛ける・ラベル・bot・持ち主・コメント・24 時間・頁・読み直し・ログの題・ラベルを外すこと・様式のリンク・API の失敗のどれか一つで落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13g. 2026-11-19：正本の誤りの知らせの様式を置くリポジトリは、どれも突き合わせの受付を持つ。免責事項（日英）が golden-window-resolution と research-collaboration を挙げ、本文の空の issue への答え方を書く');
{
  /* 2026-11-19 の読むだけの法令の点検（A1・A2・B4・C1。点検の記録 docs/legal-audit-2026-11-12.md の 2026-11-19 の節）。golden-window-resolution は正本の誤りの知らせの様式を一字一句同じに置き、
   * その様式は「2026-12-01 から、この様式は「突き合わせの受付」で確かめます」と約していた。ところが、そのリポジトリには受付が無かった。
   * 12y は受付を 13 のリポジトリの決まった一覧でだけ見ており、一覧の外で様式を写したリポジトリを見ていなかった。直し方は 2026-11-19 に Claude が決めた。
   * 一。様式が受付を約す所（15 のリポジトリと、兄弟のディレクトリのうち、受付を約す様式を置くもの）のどれもが、受付の道具とワークフローを
   *     正本と一字一句同じに持ち、設定が読め、効力の日が様式の約す日と同じで、誤りの知らせの欄が様式の欄の名と同じで、
   *     道具の configProblems が何も返さない。一覧を決めずに兄弟を走るので、新しいリポジトリに様式だけを写しても落ちる。
   * 二。免責事項（日英）の「情報の扱い」と「issue の中身と言語モデル」の節が、二つのリポジトリを挙げる。research-collaboration の
   *     ほかの様式（任意の同意の欄）が、その節の「ほかの様式の issue」に入らないと書く。冒頭が二つに掛かる節を名指す。
   * 三。免責事項（日英）に、本文の空の issue に答えるワークフローの節があり、することがラベルとコメントだけで、閉じず、
   *     鍵も掛けず、消さず、言語モデルを使わないと書く。
   * 四。受付と本文の空の issue の二つの節（日英）は、ワークフローが題も本文もコメントと実行の記録に書かないことと、
   *     それでも GitHub が題を実行の名として Actions の一覧に示し、issue を直しても前の実行の名が残ることを書く。
   *     どちらのワークフローも run-name を持たないので、issue の出来事の実行の名は、そのときの issue の題になる。
   *     2026-11-19 まで二つの節は「どこにも写しません」「issue に書かれたことを写しません」と書き、実行の名を見落としていた（C1）。
   *     その言い切りが戻れば落とす。直し方は 2026-11-19 に Claude が決めた。ワークフローは変えていない。
   * 五。2026-11-20 に、budo-first-person-notes・family-history-archive・social-data-experiments を置いた。三つとも正本の様式・受付・
   *     本文の空の issue の仕事を一字一句同じに写す。免責事項（日英）の冒頭と二つの節に三つを足し、同じ厳しさで固める。
   *     MUST には足さない（omscs-preparation などと同じ扱い）。兄弟のディレクトリにあれば、上の一で受付を見る。
   * 六。2026-11-23 に、site-legal-risk（SSRN に出す稿の原稿・PDF・検査）を置いた。正本の様式・受付・本文の空の issue の仕事を
   *     一字一句同じに写す。五と同じく、免責事項（日英）の冒頭と二つの節に足して同じ厳しさで固め、MUST には足さない。
   * 七。2026-11-23 に、boys-school-philosophy（SSRN に出す稿の原稿・PDF・検査）を置いた。六と同じく写し、免責事項（日英）の冒頭と
   *     二つの節に足して同じ厳しさで固め、MUST には足さない。 */
  const REPOS = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check', 'research-collaboration', 'golden-window-resolution']);
  const MUST = C.repos.concat(['deposit-check', 'research-collaboration', 'golden-window-resolution']);
  const ERRF = path.join('.github', 'ISSUE_TEMPLATE', 'error-report.yml');
  const VJS = path.join('.github', 'checked-intake', 'verify.js'), CONF = path.join('.github', 'checked-intake', 'config.json'), WFY = path.join('.github', 'workflows', 'checked-intake.yml');
  const PROMISE = /(\d{4}-\d{2}-\d{2}) から、この様式は「突き合わせの受付」で確かめます。/;
  const 兄弟 = fs.readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => d.name);
  const 場 = [...new Set(REPOS.concat(兄弟))].sort();
  const 今 = { form0: read('cpsbvbng26-dotcom', ERRF), js0: read('cpsbvbng26-dotcom', VJS), wf0: read('cpsbvbng26-dotcom', WFY), repos: {},
    disc: read('cpsbvbng26-dotcom', 'DISCLAIMER.md') || '', discEn: read('cpsbvbng26-dotcom', 'DISCLAIMER.en.md') || '' };
  for (const r of 場) {
    const form = read(r, ERRF);
    /* 誤りの知らせの様式のほかにも、受付を約す様式がある（Nusquama の error.yml）。どの様式の名でも、約していれば受付を求める。 */
    const td = path.join(ROOT, r, '.github', 'ISSUE_TEMPLATE');
    const others = fs.existsSync(td) ? fs.readdirSync(td).filter((f) => /\.ya?ml$/.test(f) && f !== 'error-report.yml').map((f) => fs.readFileSync(path.join(td, f), 'utf8')).filter((x) => PROMISE.test(x)) : [];
    if (form === null && !others.length && !REPOS.includes(r)) continue;
    let conf = null;
    try { conf = JSON.parse(read(r, CONF)); } catch (e) { conf = null; }
    今.repos[r] = { form, others, js: read(r, VJS), wf: read(r, WFY), conf, root: path.join(ROOT, r) };
  }
  const CI = (() => { const m = { exports: {} }; try { new Function('module', 'exports', 'require', '__dirname', String(今.js0 || '').replace(/^#!.*\n/, ''))(m, m.exports, require, path.join(ROOT, 'cpsbvbng26-dotcom', '.github', 'checked-intake')); } catch (e) { return null; } return m.exports; })();
  const 欄 = (form, id) => (new RegExp('\\n    id: ' + id + '\\n    attributes:\\n      label: ([^\\n]+)\\n').exec(String(form || '')) || [])[1];
  const sec = (t, h) => { const i = t.indexOf(h); const j = i < 0 ? -1 : t.indexOf('\n## ', i + h.length); return i < 0 ? '' : t.slice(i, j < 0 ? t.length : j); };
  const JA = {
    top: 'golden-window-resolution、research-collaboration、legal-and-governance、verification-hub、omscs-preparation、reading-ledger、submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy には、この頁のうち「情報の扱い」「issue の中身と言語モデル」「突き合わせの受付」「本文の空の issue」の節が、それぞれの節に書いた範囲で掛かります。',
    info: ['この節は、golden-window-resolution、verification-hub、omscs-preparation、reading-ledger、submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy のリポジトリにも掛かります。',
      'research-collaboration では、誤りの知らせの様式（error-report.yml）で開かれた issue と、「人についての記載」の節のメールアドレスに届いた求めに、この節が掛かります。',
      'legal-and-governance では、誤りの知らせの様式（error-report.yml）で開かれた issue に、この節が掛かります。'],
    llm: ['golden-window-resolution、research-collaboration、legal-and-governance、verification-hub、omscs-preparation、reading-ledger、submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy の誤りの知らせの様式も、上の様式と一字一句同じ写しで、そこから開かれた issue も、この節のとおりに扱います。',
      'research-collaboration では、申し出・求め・権利者の知らせの様式も、同意の欄を持ちます。', '上の「ほかの様式の issue」は、これらの様式の issue を含みません。'],
    empty: ['することは、ラベルとコメントを付けることと、そのラベルを外すことだけです。', 'ワークフローは、issue の題も本文も、コメントにも実行の記録にも書きません。',
      'ワークフローは、どの issue でも、開かれたときと直されたときに動きます。', 'GitHub は、そのときの issue の題を、実行の名として Actions の一覧に示します。',
      'あとで issue を直しても、前の実行の名は残ります。', 'どの issue も閉じず、鍵も掛けず、消しません。', 'このワークフローは、言語モデルを使いません。'],
    intake: ['受付のワークフローは、issue の題も本文も、コメントにも実行の記録にも書きません。', 'コメントと実行の記録に書くのは、決まった文と issue の番号だけです。',
      '受付のワークフローは、どの issue でも、開かれたとき、直されたとき、開き直されたときに動きます。',
      'GitHub は、そのときの issue の題を、実行の名として Actions の一覧に示します。', 'あとで issue を直しても、前の実行の名は残ります。'],
  };
  const EN = {
    top: 'To golden-window-resolution, research-collaboration, legal-and-governance, verification-hub, omscs-preparation, reading-ledger, submission-templates, budo-first-person-notes, family-history-archive, social-data-experiments, site-legal-risk, boys-school-philosophy, the sections "Information", "Issues and the language model", "Checked intake" and "Issues with an empty body" of this page apply, each to the extent that it states.',
    info: ['This section also applies to the golden-window-resolution, verification-hub, omscs-preparation, reading-ledger, submission-templates, budo-first-person-notes, family-history-archive, social-data-experiments, site-legal-risk and boys-school-philosophy repositories.',
      'In research-collaboration, this section applies to issues opened with the error report form (error-report.yml) and to requests received at the email address in the section "Statements about people".',
      'In legal-and-governance, this section applies to issues opened with the error report form (error-report.yml).'],
    llm: ['The error report forms of golden-window-resolution, research-collaboration, legal-and-governance, verification-hub, omscs-preparation, reading-ledger, submission-templates, budo-first-person-notes, family-history-archive, social-data-experiments, site-legal-risk, boys-school-philosophy are word-for-word copies of the form above, and an issue opened from them is handled as this section sets out.',
      'In research-collaboration, the proposal, request and rights-holder forms also have a consent box.', '"An issue from another form" above does not include issues from these forms.'],
    empty: ['Adding the label and the comment, and taking the label off, is all it does.', 'The workflow writes neither the title nor the text of the issue into the comment or into the log of the run.',
      'The workflow runs whenever any issue is opened or edited.', 'GitHub shows the title the issue has at that moment as the name of the run in the Actions list.',
      'When the issue is edited later, the earlier runs keep that name.', 'No issue is closed, locked or deleted.', 'The workflow involves no language model.'],
    intake: ['The workflow of the checked intake writes neither the title nor the text of an issue into a comment or into the log of a run.',
      'Comments and logs carry only fixed words and the issue number.', 'The workflow of the checked intake runs whenever any issue is opened, edited or reopened.',
      'GitHub shows the title the issue has at that moment as the name of the run in the Actions list.', 'When the issue is edited later, the earlier runs keep that name.'],
  };
  const 問題 = (m) => {
    const bad = [];
    if (!m.form0 || !m.js0 || !m.wf0 || !CI) return ['正本の様式・道具・ワークフローのどれかが無い'];
    const day = (PROMISE.exec(m.form0) || [])[1];
    if (!day) bad.push('正本の様式が受付の日を約していない');
    const W = 欄(m.form0, 'where'), Q = 欄(m.form0, 'printed');
    let n = 0;
    for (const [r, x] of Object.entries(m.repos)) {
      const forms = (x.form !== null && PROMISE.test(x.form) ? [x.form] : []).concat(x.others || []);
      if (!forms.length) continue;
      n++;
      if (x.js !== m.js0) bad.push(r + '：受付の道具が無いか、正本と違う');
      if (x.wf !== m.wf0) bad.push(r + '：受付のワークフローが無いか、正本と違う');
      if (!x.conf) { bad.push(r + '：受付の設定が無い'); continue; }
      if (forms.some((f) => x.conf.from !== (PROMISE.exec(f) || [])[1])) bad.push(r + '：受付の日が様式の約す日と違う');
      const e = (x.conf.forms || []).find((f) => f.label === 'erratum');
      if (x.form !== null && PROMISE.test(x.form) && (!e || e.kind !== 'quote' || (e.where || []).join() !== W || (e.quote || []).join() !== Q)) bad.push(r + '：誤りの知らせの欄が様式と違う');
      const cp = CI.configProblems(x.conf, x.root);
      if (cp.length) bad.push(r + '：' + cp.join('、'));
    }
    for (const r of MUST) if (!m.repos[r] || m.repos[r].form !== m.form0) bad.push(r + '：正本の誤りの知らせの様式が無いか、正本と違う');
    if (n < MUST.length) bad.push('受付を約す様式が少ない（' + n + '）');
    const info = sec(m.disc, '\n## 情報の扱い\n'), infoEn = sec(m.discEn, '\n## Information\n');
    const llm = sec(m.disc, '\n## issue の中身と言語モデル\n'), llmEn = sec(m.discEn, '\n## Issues and the language model\n');
    const empty = sec(m.disc, '\n## 本文の空の issue\n'), emptyEn = sec(m.discEn, '\n## Issues with an empty body\n');
    const intake = sec(m.disc, '\n## 突き合わせの受付\n'), intakeEn = sec(m.discEn, '\n## Checked intake\n');
    const head = m.disc.slice(0, m.disc.indexOf('\n## ')), headEn = m.discEn.slice(0, m.discEn.indexOf('\n## '));
    if (!head.includes(JA.top)) bad.push('免責事項の冒頭が二つのリポジトリに掛かる節を挙げない');
    if (!headEn.includes(EN.top)) bad.push('英語の免責事項の冒頭');
    for (const [t, list, name] of [[info, JA.info, '「情報の扱い」'], [infoEn, EN.info, '"Information"'], [llm, JA.llm, '「issue の中身と言語モデル」'], [llmEn, EN.llm, '"Issues and the language model"'],
      [empty, JA.empty, '「本文の空の issue」'], [emptyEn, EN.empty, '"Issues with an empty body"'],
      [intake, JA.intake, '「突き合わせの受付」'], [intakeEn, EN.intake, '"Checked intake"']]) for (const s of list) if (!t.includes(s)) bad.push('免責事項 ' + name + '：' + s.slice(0, 20));
    /* C1。題は実行の名として一覧に出る。「どこにも写さない」の言い切りを、二つの節のどちらにも戻さない。 */
    if (/写しません|写さない/.test(empty + intake) || /copied nowhere|copies nothing|never what the issue says/i.test(emptyEn + intakeEn)) bad.push('受付か本文の空の issue の節が、題も本文もどこにも写さないと言い切る');
    for (const [t, l] of [[info, 'ja'], [llm, 'ja'], [infoEn, 'en'], [llmEn, 'en']]) if (!t.includes('research-collaboration/blob/main/policies/privacy' + (l === 'en' ? '.en' : '') + '.md')) bad.push('免責事項（' + l + '）が research-collaboration の個人情報の取り扱いを指さない');
    if (/閉じます|鍵を掛けます|消します|Claude に渡します/.test(empty) || /\b(is|are) (closed|locked|deleted)\b(?!,)/.test(emptyEn.replace('No issue is closed, locked or deleted.', ''))) bad.push('本文の空の issue の節が閉じる・鍵を掛ける・消す・渡すと書く');
    if (!(read('cpsbvbng26-dotcom', path.join('.github', 'workflows', 'empty-issue.yml')) || '').includes("const LABEL = 'empty body';") || !empty.includes('「empty body」') || !emptyEn.includes('"empty body"')) bad.push('本文の空の issue の節のラベルがワークフローと違う');
    return bad;
  };
  const now = 問題(今);
  const 約す = Object.values(今.repos).filter((x) => (x.form !== null && PROMISE.test(x.form)) || (x.others || []).length).length;
  check('受付を約す誤りの知らせの様式を置く ' + 約す + ' のリポジトリが、どれも受付の道具とワークフローを正本と同じに持ち、設定の日と欄が様式と合う。免責事項（日英）が golden-window-resolution と research-collaboration を挙げ、本文の空の issue の節を持つ',
    now.length === 0, now.slice(0, 6).join(' / '));
  const 替 = (r, k, v) => Object.assign({}, 今, { repos: Object.assign({}, 今.repos, { [r]: Object.assign({}, 今.repos[r], { [k]: v }) }) });
  const 文 = (k, a, b) => Object.assign({}, 今, { [k]: 今[k].replace(a, b) });
  const gw = 'golden-window-resolution', rc = 'research-collaboration';
  const 壊し = [
    ['golden-window-resolution から受付の道具を外す', 替(gw, 'js', null)],
    ['golden-window-resolution から受付のワークフローを外す', 替(gw, 'wf', null)],
    ['research-collaboration の受付の道具を一字変える', 替(rc, 'js', (今.repos[rc] || {}).js + '\n')],
    ['golden-window-resolution の設定を外す', 替(gw, 'conf', null)],
    ['golden-window-resolution の効力の日を早める', 替(gw, 'conf', Object.assign({}, (今.repos[gw] || {}).conf, { from: '2026-11-20' }))],
    ['research-collaboration の誤りの知らせの欄の名を変える', 替(rc, 'conf', Object.assign({}, (今.repos[rc] || {}).conf, { forms: [{ label: 'erratum', kind: 'quote', where: ['Where'], quote: ['書いてあること / What it says'] }] }))],
    ['golden-window-resolution の設定から needs a person を外す', 替(gw, 'conf', Object.assign({}, (今.repos[gw] || {}).conf, { neverClose: [] }))],
    ['一覧に無い新しいリポジトリに、様式だけを写す', Object.assign({}, 今, { repos: Object.assign({}, 今.repos, { 'new-repository': { form: 今.form0, others: [], js: null, wf: null, conf: null, root: path.join(ROOT, 'new-repository') } }) })],
    ['別の名の様式で受付を約すリポジトリから、受付を外す', 替('nusquama', 'js', null)],
    ['「情報の扱い」から golden-window-resolution を外す', 文('disc', 'この節は、golden-window-resolution、verification-hub、omscs-preparation、reading-ledger、submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy のリポジトリにも掛かります。\n', '')],
    ['「情報の扱い」から legal-and-governance の様式の文を外す', 文('disc', 'legal-and-governance では、誤りの知らせの様式（error-report.yml）で開かれた issue に、この節が掛かります。\n', '')],
    ['英語の「Information」から research-collaboration を外す', 文('discEn', 'In research-collaboration, this section applies to issues opened with the error report form', 'This section applies to issues opened with the error report form')],
    ['「issue の中身と言語モデル」から二つの様式を外す', 文('disc', 'golden-window-resolution、research-collaboration、legal-and-governance、verification-hub、omscs-preparation、reading-ledger、submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy の誤りの知らせの様式も、', '誤りの知らせの様式も、')],
    ['英語の「Issues and the language model」から 2026-11-20 の三つのリポジトリを外す', 文('discEn', 'submission-templates, budo-first-person-notes, family-history-archive, social-data-experiments, site-legal-risk, boys-school-philosophy are word-for-word copies', 'submission-templates are word-for-word copies')],
    ['「情報の扱い」から family-history-archive を外す', 文('disc', 'submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy のリポジトリにも掛かります。', 'submission-templates、budo-first-person-notes、social-data-experiments のリポジトリにも掛かります。')],
    ['「情報の扱い」から site-legal-risk を外す', 文('disc', 'social-data-experiments、site-legal-risk、boys-school-philosophy のリポジトリにも掛かります。', 'social-data-experiments、boys-school-philosophy のリポジトリにも掛かります。')],
    ['「情報の扱い」から boys-school-philosophy を外す', 文('disc', 'site-legal-risk、boys-school-philosophy のリポジトリにも掛かります。', 'site-legal-risk のリポジトリにも掛かります。')],
    ['英語の冒頭から site-legal-risk を外す', 文('discEn', 'social-data-experiments, site-legal-risk, boys-school-philosophy, the sections', 'social-data-experiments, boys-school-philosophy, the sections')],
    ['英語の冒頭から boys-school-philosophy を外す', 文('discEn', 'site-legal-risk, boys-school-philosophy, the sections', 'site-legal-risk, the sections')],
    ['英語の「Issues and the language model」から boys-school-philosophy を外す', 文('discEn', 'site-legal-risk, boys-school-philosophy are word-for-word copies', 'site-legal-risk are word-for-word copies')],
    ['英語の節から「ほかの様式」の断りを外す', 文('discEn', '"An issue from another form" above does not include issues from these forms.\n', '')],
    ['冒頭から二つのリポジトリを外す', 文('disc', 'golden-window-resolution、research-collaboration、legal-and-governance、verification-hub、omscs-preparation、reading-ledger、submission-templates、budo-first-person-notes、family-history-archive、social-data-experiments、site-legal-risk、boys-school-philosophy には、この頁のうち', 'ほかのリポジトリには、この頁のうち')],
    ['本文の空の issue の節を外す', 文('disc', '\n## 本文の空の issue\n', '\n## 空の issue\n')],
    ['英語の節に、閉じると書く', 文('discEn', 'No issue is closed, locked or deleted.', 'No issue is locked or deleted. An issue left empty for a week is closed.')],
    ['本文の空の issue の節に、言語モデルを使うと書く', 文('disc', 'このワークフローは、言語モデルを使いません。', 'このワークフローは、題を言語モデルに渡します。')],
    ['本文の空の issue の節を、前の「どこにも写しません」に戻す', 文('disc', 'ワークフローは、issue の題も本文も、コメントにも実行の記録にも書きません。', 'issue の題と本文は、コメントにも実行の記録にも、どこにも写しません。')],
    ['英語の受付の節から、実行の名の文を外す', 文('discEn', 'GitHub shows the title the issue has at that moment as the name of the run in the Actions list.\nWhen the issue is edited later, the earlier runs keep that name.\n', '')],
    ['受付の節に、issue に書かれたことを写さないと書き足す', 文('disc', 'あとで issue を直しても、前の実行の名は残ります。\n確かめるのは', 'あとで issue を直しても、前の実行の名は残ります。\nissue に書かれたことは、どこにも写しません。\n確かめるのは')],
    ['英語の本文の空の issue の節に、どこにも写さないと書き足す', 文('discEn', 'No issue is closed, locked or deleted.', 'The title and text of the issue are copied nowhere.\nNo issue is closed, locked or deleted.')],
  ];
  const 通った = 壊し.filter(([, y]) => 問題(y).length === 0).map(([n]) => n);
  check('壊して確かめる：道具・ワークフローの欠けと一字・設定の欠けと日と欄の名と needs a person・一覧に無いリポジトリの様式だけの写し・別の名の様式で約すリポジトリの受付・免責事項（日英）の二つのリポジトリと断りと冒頭・本文の空の issue の節と閉じる文と言語モデル・受付と本文の空の issue の節の実行の名の文と「写さない」の言い切りのどれか一つで落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

/* 481（百本ノック五）。**この検査の件数は docs/checks.md の一か所にだけ書く。**
 * 2026-11-12 まで五か所に書いて突き合わせていた。ほかの場所は、その頁を指す。数を書き戻せば落とす。 */
console.log('\n13e. 2026-11-18：散文に書いた「NN 件・NN 項目・NN 通り」が、どれも区分にある（検査で捕まる・数えられない・外す）');
{
  /* 決めごと 5。2026-11-18 に、13 のリポジトリの散文の数を一つずつ壊して、どの検査が落ちるかを見た。
   * 落ちなかった数には、いまの数なら数え直す宣言を、日付の付いた過去の数なら git のその時点から数え直す宣言を、
   * 2 の「数」に足した。どちらもできない数は、理由とともに verification/prose-numbers.json の「数えられない」に置いた。
   * 算術の恒等式・行の番号・年・注釈・直す前の文の引用は「外す」に置いた。
   * ここでは、散文に出てくる数がすべてどれかの区分にあり、区分の側に余りが無いことを見る。
   * 新しく数を書けば、区分が無くて落ちる。そのとき、検査を足して「捕まる」に入れるか、数えられない理由を書く。 */
  const PN = require('./prose_numbers.js');
  const 宣言 = JSON.parse(fs.readFileSync(path.join(__dirname, 'prose-numbers.json'), 'utf8'));
  const 表 = PN.表にする(宣言);
  const 走査 = PN.scan(ROOT);
  const r = PN.突き合わせる(走査.found, 表);
  const 見えない = 走査.無い.filter((x) => PN.REPOS.includes(x));
  check('13 のリポジトリの散文の数（' + 走査.found.length + '）が、どれも区分にあり（捕まる ' + 表['捕まる'].length + '・数えられない '
    + 表['数えられない'].length + '・外す ' + 表['外す'].length + '）、区分の側に余りが無い',
    r.無区分.length === 0 && r.余り.length === 0 && 見えない.length === 0,
    [].concat(見えない.map((x) => x + ' が無い'),
      r.無区分.slice(0, 4).map((x) => '区分が無い ' + x.f + ':' + x.line + ' 「' + x.num + ' ' + x.語 + '」'),
      r.余り.slice(0, 4).map((k) => '余り ' + k[0] + ' 「' + k[1] + '」')).join(' / '));
  const 理由なし = (宣言['数えられない'] || []).concat(宣言['外す'] || []).filter((x) => !x['理由'] || !x['文']);
  const 検査なし = Object.values(宣言['捕まる'] || {}).flat().filter((x) => !x[2]);
  check('数えられない数と外した数には理由と文があり、捕まる数には捕まえる検査の名がある',
    理由なし.length === 0 && 検査なし.length === 0, 理由なし.length + ' / ' + 検査なし.length);
  /* 壊して確かめる。散文に数を一つ書き足す、区分を一つ消す、区分を一つ余らせる。どれも落ちなければならない。 */
  const 一つ目 = 走査.found[0];
  const 壊し = [
    ['README に区分の無い数を書き足す', () => {
      const f = 'cpsbvbng26-dotcom/README.md';
      const t = (read('cpsbvbng26-dotcom', 'README.md') || '') + '\n検査は 7 項目です。\n';
      const 外 = 走査.found.filter((x) => x.f !== f).concat(PN.scanText(f, t));
      return PN.突き合わせる(外, 表);
    }],
    ['捕まる数の区分を一つ消す', () => {
      const t2 = { 捕まる: 表['捕まる'].slice(1), 数えられない: 表['数えられない'], 外す: 表['外す'] };
      return PN.突き合わせる(走査.found, t2);
    }],
    ['数えられない数の区分を一つ消す', () => {
      const t2 = { 捕まる: 表['捕まる'], 数えられない: 表['数えられない'].slice(1), 外す: 表['外す'] };
      return PN.突き合わせる(走査.found, t2);
    }],
    ['区分を一つ余らせる', () => {
      const t2 = { 捕まる: 表['捕まる'].concat([[一つ目.f, 'ここには無い前の字', '件']]), 数えられない: 表['数えられない'], 外す: 表['外す'] };
      return PN.突き合わせる(走査.found, t2);
    }],
    ['数の前の字を書き換える', () => {
      const 外 = 走査.found.filter((x) => x !== 一つ目).concat([Object.assign({}, 一つ目, { 前: 一つ目.前 + '改' })]);
      return PN.突き合わせる(外, 表);
    }],
  ];
  const 通った = 壊し.filter(([, f]) => { const x = f(); return x.無区分.length === 0 && x.余り.length === 0; }).map(([n]) => n);
  check('壊して確かめる：区分の無い数・消した区分・余った区分・書き換えた前の字のどれでも落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13h. 2026-11-19：15 のリポジトリの .github/ISSUE_TEMPLATE と .github/workflows の YAML が、どれも YAML として読める（Ruby の YAML）');
{
  /* 2026-11-19 に Claude が決めた。誤りの知らせの様式（error-report.yml）の「どこか」の説明は、2026-11-14 の 76dd969 から、囲まない値の中に
   * 「: 」を含み、PyYAML も Ruby の YAML も 20 行目で読めなかった。写しの同一と sha256 は見ていたが、YAML として読めるかは、どこも見ていなかった。
   * 一。15 のリポジトリの .github/ISSUE_TEMPLATE と .github/workflows の .yml と .yaml を、どれも Ruby の標準の YAML（Psych、libyaml の上）で読み、
   *     根が対応表（mapping）であることを見る。型の解き方には立ち入らず、構文だけを見る（Psych.parse）。ruby が無ければ落ちる。
   *     Node には YAML の読み手が無く、横断の CI の pip は numpy と pypdf だけをハッシュで固めて入れるので、作り物の読み手や PyYAML ではなく、
   *     走る機械にもとからある Ruby を使う。
   * 二。記録（docs/legal-audit-2026-11-12.md の 2026-11-19 の節）の数と日付を、写しの数と git の履歴から作り直して突き合わせる。
   *     履歴が浅ければ落ちる。
   * 三。壊して確かめる：直す前の行を正本に戻す、ワークフローを一つ壊す、根を対応表でなくす、ruby が無い、記録の数か日付を違える。 */
  const REPOS = C.repos.concat(['sophaxis', 'nusquama', 'deposit-check', 'research-collaboration', 'golden-window-resolution']);
  const DIRS = [path.join('.github', 'ISSUE_TEMPLATE'), path.join('.github', 'workflows')];
  const ERR = '.github/ISSUE_TEMPLATE/error-report.yml';
  const BAD_AT = '76dd969';
  const OLD = '      description: 欄の初めに一つだけ書きます。ファイルの名（例 `README.md`）、このリポジトリの頁かファイルの URL、またはこのリポジトリが写しを持つ論文の DOI。'
    + '頁や節は、その後に書けます（確かめるのは文書の全体です） / Begin with one of these: a file name (such as `README.md`), the URL of a page or a file of this repository, '
    + 'or the DOI of a paper of which this repository holds a copy. A page or section may follow (the whole document is checked)';
  const NEW = OLD.replace('description: ', "description: '") + "'";
  const AUD = path.join('docs', 'legal-audit-2026-11-12.md'), HEAD = '\n## 2026-11-19：誤りの知らせの様式が YAML として読めなかった\n';
  const files = {};
  for (const r of REPOS) for (const d of DIRS) {
    const p = path.join(ROOT, r, d);
    if (fs.existsSync(p)) fs.readdirSync(p).filter((n) => /\.ya?ml$/.test(n)).sort().forEach((n) => { files[r + '/' + d.split(path.sep).join('/') + '/' + n] = read(r, path.join(d, n)); });
  }
  const gitIn = (r, args) => execFileSync('git', args, { cwd: path.join(ROOT, r), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'], env: Object.assign({}, process.env, { TZ: 'Asia/Tokyo' }) });
  const 試す = (f, d) => { try { return f(); } catch (e) { return d; } };
  /* 履歴：どのリポジトリの main に、いつ（日本時間）直す前の行が入ったか。初めから入っていたか。 */
  const 歴 = {};
  for (const r of REPOS) {
    if (files[r + '/' + ERR] === undefined) continue;
    const 浅い = 試す(() => gitIn(r, ['rev-parse', '--is-shallow-repository']).trim() !== 'false', true);
    const cs = 試す(() => gitIn(r, ['log', '--first-parent', '--reverse', '--format=%H %cd', '--date=format-local:%Y-%m-%d', 'HEAD', '--', ERR]).split('\n').filter(Boolean).map((l) => l.split(' ')), []);
    const has = cs.map(([h, d]) => [d, 試す(() => gitIn(r, ['show', h + ':' + ERR]).split('\n').includes(OLD), false)]);
    const i = has.findIndex((x) => x[1]);
    歴[r] = { 浅い, 来た: i < 0 ? null : has[i][0], 初めから: i === 0 };
  }
  const 過去 = {
    日: 試す(() => gitIn('cpsbvbng26-dotcom', ['show', '-s', '--format=%cd', '--date=format-local:%Y-%m-%d', BAD_AT]).trim(), null),
    文: 試す(() => gitIn('cpsbvbng26-dotcom', ['show', BAD_AT + ':' + ERR]), null),
    前: 試す(() => gitIn('cpsbvbng26-dotcom', ['show', BAD_AT + '^:' + ERR]), null),
  };
  /* Ruby で読む。Ruby の文は ASCII だけで書く（-e の文の符号は ASCII として読まれる）。
   * 答えは { 名: null（読めた） | 文（読めない理由） }。行は 1 から数える。 */
  const RB = 'r = {}; JSON.parse(STDIN.read).each { |k, v| begin; d = Psych.parse(v, filename: k); '
    + 'r[k] = (d && d.root.is_a?(Psych::Nodes::Mapping)) ? nil : [0, 0, "notmap"]; '
    + 'rescue Psych::SyntaxError => e; r[k] = [e.line, e.column, e.problem.to_s]; end }; print JSON.generate(r)';
  const 読む = (m, bin) => {
    let raw;
    try { raw = JSON.parse(execFileSync(bin, ['-EUTF-8:UTF-8', '-rjson', '-ryaml', '-e', RB], { input: JSON.stringify(m), encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'pipe'] })); }
    catch (e) { return null; }
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === null ? null : (v[2] === 'notmap' ? '根が対応表でない' : v[0] + ' 行 ' + v[1] + ' 列：' + v[2])]));
  };
  const 今 = { files, aud: read('cpsbvbng26-dotcom', AUD) || '', 歴, 過去, bin: 'ruby' };
  const 問題 = (x) => {
    const bad = [];
    const 過去の文 = x.過去.文 === null ? '' : x.過去.文;
    const 答え = 読む(Object.assign({ ['過去:' + BAD_AT]: 過去の文 }, x.files), x.bin);
    if (答え === null) return ['ruby で YAML を読めない（ruby が無いか、走らない）'];
    for (const k of Object.keys(x.files)) if (!(k in 答え) || 答え[k] !== null) bad.push(k + '：' + (答え[k] || '読んでいない'));
    const 写し = REPOS.filter((r) => x.files[r + '/' + ERR] !== undefined);
    if (写し.some((r) => x.files[r + '/' + ERR] !== x.files['cpsbvbng26-dotcom/' + ERR])) bad.push('誤りの知らせの様式の写しが正本と違う');
    if (!写し.every((r) => x.files[r + '/' + ERR].split('\n').includes(NEW))) bad.push('「どこか」の説明が、単引用符で囲んだ形でない');
    /* 記録。 */
    const a = x.aud, i = a.indexOf(HEAD), j = i < 0 ? -1 : a.indexOf('\n## ', i + 5);
    const sec = i < 0 ? '' : a.slice(i, j < 0 ? a.length : j);
    if (!sec || a.indexOf('\n## 調べた法令\n') < i) return bad.concat(['記録の節が無いか、調べた法令の後にある']);
    const 行 = 過去の文.split('\n').indexOf(OLD) + 1;
    const 止まり = /^(\d+) 行 /.exec(String(答え['過去:' + BAD_AT] || ''));
    if (行 < 1 || !止まり || Number(止まり[1]) !== 行 || x.過去.前 === null || x.過去.前.split('\n').includes(OLD)) bad.push(BAD_AT + ' で入った行と、読むのをやめた行が、記録と合わない');
    const 来た = 写し.filter((r) => x.歴[r]);
    if (来た.length !== 写し.length || 来た.some((r) => x.歴[r].浅い || !x.歴[r].来た)) bad.push('履歴が浅いか、直す前の行が入った日を取れない：' + 写し.filter((r) => !x.歴[r] || x.歴[r].浅い || !x.歴[r].来た).join(', '));
    const 後 = 来た.filter((r) => r !== 'cpsbvbng26-dotcom' && !x.歴[r].初めから), 初 = 来た.filter((r) => x.歴[r].初めから);
    const 日 = (rs) => [...new Set(rs.map((r) => x.歴[r].来た))];
    if (日(後).length !== 1 || 日(初).length !== 1 || (x.歴['cpsbvbng26-dotcom'] || {}).初めから !== false) bad.push('直す前の行が入った日が、記録の分け方で一つにまとまらない');
    const rows = sec.split('\n').filter((l) => /^\| (?!---|箇所 \|)/.test(l)).map((l) => l.slice(2, -2).split(' | '));
    const KINDS = ['誤り', '根拠不足', '漏れ', '表現', '問題なし'];
    const 内訳 = KINDS.filter((k) => rows.some((y) => y[4] === k)).map((k) => k + ' ' + rows.filter((y) => y[4] === k).length).join('、');
    const 文 = [
      '様式は、' + 写し.length + ' のリポジトリに一字一句同じに置いています。',
      '読めない文は、cpsbvbng26-dotcom のコミット ' + BAD_AT + '（' + x.過去.日 + '）で入りました。',
      'main に入ったのは、' + 後.length + ' のリポジトリで ' + 日(後)[0] + '、cpsbvbng26-dotcom で ' + (x.歴['cpsbvbng26-dotcom'] || {}).来た + ' です（日本時間）。',
      初.join(' と ') + ' は、' + 日(初)[0] + ' に様式を置いたときから、この文でした。',
      'GitHub がこの間に様式を出していたかは、確かめていません。',
      '`verification/check_ecosystem.js` の 13h が、' + REPOS.length + ' のリポジトリの `.github/ISSUE_TEMPLATE` と `.github/workflows` にある YAML のファイルを、どれも Ruby の YAML で読みます。',
      '| `.github/ISSUE_TEMPLATE/error-report.yml`（' + 写し.length + ' のリポジトリ） |',
      '「どこか」の欄の説明（' + 行 + ' 行目）を、引用符で囲まずに書いていました。',
      'PyYAML と Ruby の YAML は、どちらも ' + 行 + ' 行目で読むのをやめました',
      'この表の判定は、' + 内訳 + ' です。',
      'この節も、弁護士は見ていません。',
      '2026-11-19 に Claude が決めました。',
    ];
    文.filter((s) => !sec.includes(s)).forEach((s) => bad.push('記録に「' + s.slice(0, 30) + '」が無い'));
    if (rows.length < 1 || !rows.every((y) => y.length === 6 && KINDS.includes(y[4]))) bad.push('記録の表の形');
    return bad;
  };
  const now = 問題(今);
  const nForms = Object.keys(files).filter((k) => k.includes('/ISSUE_TEMPLATE/')).length, nFlows = Object.keys(files).length - nForms;
  check(REPOS.length + ' のリポジトリの様式 ' + nForms + ' 本とワークフロー ' + nFlows + ' 本が Ruby の YAML で読め、誤りの知らせの様式の写しが正本と同じで、記録の 2026-11-19 の節の数と日付が写しと git の履歴に合う',
    now.length === 0, now.slice(0, 4).join(' / '));
  const 替 = (k, a, b) => Object.assign({}, 今, { files: Object.assign({}, files, { [k]: String(files[k] || '').replace(a, b) }) });
  const 記録替 = (a, b) => Object.assign({}, 今, { aud: 今.aud.replace(a, b) });
  const 壊し = [
    ['直す前の行を正本の様式に戻す', 替('cpsbvbng26-dotcom/' + ERR, NEW, OLD)],
    ['直す前の行を写しの一つに戻す', 替('golden-window-resolution/' + ERR, NEW, OLD)],
    ['ワークフローの一つに「: 」を含む囲まない値を書く', 替('research-collaboration/.github/workflows/empty-issue.yml', /$/, '\nx: a: b\n')],
    ['様式の根を対応表でなくす', 替('nusquama/.github/ISSUE_TEMPLATE/config.yml', /^[\s\S]*$/, '- blank_issues_enabled: false\n')],
    ['ruby が無い', Object.assign({}, 今, { bin: 'ruby-not-here' })],
    ['記録の写しの数を違える', 記録替('様式は、13 のリポジトリに', '様式は、12 のリポジトリに')],
    ['記録の main に入った日を違える', 記録替('cpsbvbng26-dotcom で 2026-11-15 です', 'cpsbvbng26-dotcom で 2026-11-14 です')],
    ['記録の行の番号を違える', 記録替('どちらも 20 行目で', 'どちらも 21 行目で')],
    ['記録の節を外す', 記録替(HEAD, '\n## 2026-11-19：別の節\n')],
    ['履歴が浅い', Object.assign({}, 今, { 歴: Object.assign({}, 歴, { 'research-collaboration': Object.assign({}, 歴['research-collaboration'], { 浅い: true }) }) })],
  ];
  const 通った = 壊し.filter(([, c]) => 問題(c).length === 0).map(([n]) => n);
  check('壊して確かめる：直す前の行（正本と写し）・壊したワークフロー・対応表でない根・ruby の欠け・記録の数と日付と行・節の欠け・浅い履歴のどれか一つで落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13i. 2026-11-20：利益相反の記録（cpsbvbng26-dotcom の docs/conflicts-of-interest.md、日英）が書く Sophaxis の効力の日と節が、Sophaxis の規程と規程の変更の一覧（フィード）に合う');
{
  /* 2026-11-20 に著者が決めた。氣の原理を Sophaxis では扱わない。記録（日英）は効力の日と、モデレーションの規程の「利益相反」の節を書く。
   * Sophaxis の側の正は、規程の変更の一覧（data/policy-changes.json）の項の from と、モデレーションの規程の文である。
   * 一。記録の日英が書く効力の日が、一覧の項の from と同じで、一覧の項は主題の全体（だれが投稿したものでも、運営者のものも含めて）に掛かる。
   * 二。記録が指す節の印（#conflicts-of-interest と #利益相反）が、組み上がった規程の頁にある。
   * 三。眠っている利益相反（党・在籍する大学）について、Sophaxis の規程に決まりを置いていない。記録が「氣の原理の主題にだけ掛かります」と書くため。
   * 四。壊して確かめる。 */
  const TITLE = "No work on the principle of ki, because of the operator's conflict of interest";
  const 今 = {
    ja: read('cpsbvbng26-dotcom', path.join('docs', 'conflicts-of-interest.md')) || '',
    en: read('cpsbvbng26-dotcom', path.join('docs', 'conflicts-of-interest.en.md')) || '',
    feed: read('sophaxis', path.join('data', 'policy-changes.json')) || '',
    mod: read('sophaxis', path.join('policies', 'moderation.md')) || '',
    modJa: read('sophaxis', path.join('policies', 'moderation.ja.md')) || '',
    html: read('sophaxis', path.join('site', 'policies', 'moderation.html')) || '',
    htmlJa: read('sophaxis', path.join('site', 'policies', 'moderation.ja.html')) || '',
    pol: ['moderation', 'submission', 'terms', 'privacy', 'takedown', 'withdrawal', 'licences', 'copyright'].map((s) => (read('sophaxis', path.join('policies', s + '.md')) || '') + (read('sophaxis', path.join('policies', s + '.ja.md')) || '')).join('\n'),
  };
  const 問題 = (x) => {
    const bad = [];
    let feed = [];
    try { feed = JSON.parse(x.feed); } catch (e) { return ['Sophaxis の規程の変更の一覧が読めない']; }
    const e = feed.find((c) => c.title === TITLE);
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.from || '')) return bad.concat(['Sophaxis の規程の変更の一覧に、氣の原理の項か効力の日が無い']);
    const F = e.from;
    if (!String(e.text).includes('whoever submits it, the operator included')) bad.push('一覧の項が主題の全体に掛かっていない');
    if (!x.mod.includes('From ' + F + ', Sophaxis lists no work whose subject is the principle of ki (氣の原理, also written 気の原理), whoever submits it, the operator included.')) bad.push('モデレーションの規程（英）の文が一覧の日と合わない');
    if (!x.modJa.includes(F + ' から、Sophaxis は、氣の原理（気の原理とも書きます）を主題とする作品を、運営者のものも含めて、だれが投稿したものでも載せません。')) bad.push('モデレーションの規程（日）の文が一覧の日と合わない');
    if (!x.ja.includes(F + ' から、Sophaxis は、氣の原理を主題とする作品を、だれが投稿したものでも載せません。')) bad.push('記録（日）の効力の日が一覧の ' + F + ' と合わない');
    if (!x.en.includes('From ' + F + ', Sophaxis lists no work whose subject is the principle of ki, whoever submits it.')) bad.push('記録（英）の効力の日が一覧の ' + F + ' と合わない');
    if (!x.ja.includes('(https://sophaxis.vercel.app/policies/moderation.ja.html#利益相反)') || !x.htmlJa.includes('id="利益相反"')) bad.push('記録（日）が指す節の印が無い');
    if (!x.en.includes('(https://sophaxis.vercel.app/policies/moderation.html#conflicts-of-interest)') || !x.html.includes('id="conflicts-of-interest"')) bad.push('記録（英）が指す節の印が無い');
    if (!x.ja.includes('Sophaxis の除外は、氣の原理の主題にだけ掛かります。') || !x.en.includes('The exclusion on Sophaxis applies only to the principle of ki.')) bad.push('記録が Sophaxis の範囲を書いていない');
    ['国民民主', 'Democratic Party for the People', 'online degree', 'オンラインの学位'].filter((w) => x.pol.includes(w)).forEach((w) => bad.push('Sophaxis の規程に「' + w + '」'));
    return bad;
  };
  const now = 問題(今);
  check('利益相反の記録（日英）が書く Sophaxis の効力の日と節の印が、Sophaxis の規程・組み上がった頁・規程の変更の一覧に合い、範囲は主題の全体で、眠っている利益相反の決まりを Sophaxis に置いていない',
    now.length === 0, now.slice(0, 4).join(' / '));
  const 替 = (k, a, b) => Object.assign({}, 今, { [k]: 今[k].replace(a, b) });
  const 壊し = [
    ['記録（日）の効力の日を一日ずらす', 替('ja', /(\d{4}-\d{2}-)(\d{2})( から、Sophaxis は、氣の原理を主題とする作品を)/, (m, a, d, c) => a + String(Number(d) + 1).padStart(2, '0') + c)],
    ['記録（英）の効力の日を一日ずらす', 替('en', /(From \d{4}-\d{2}-)(\d{2})(, Sophaxis lists no work)/, (m, a, d, c) => a + String(Number(d) + 1).padStart(2, '0') + c)],
    ['一覧の項を外す', 替('feed', TITLE, 'Something else')],
    ['一覧の項の範囲を運営者の作品に狭める', 替('feed', 'whoever submits it, the operator included', 'when the operator submits it')],
    ['規程（英）の範囲を狭める', 替('mod', 'whoever submits it, the operator included.', 'when the operator submits it.')],
    ['組み上がった頁から節の印が消える', 替('htmlJa', 'id="利益相反"', 'id="conflicts"')],
    ['記録（英）が別の節を指す', 替('en', 'moderation.html#conflicts-of-interest', 'moderation.html#decisions')],
    ['Sophaxis に党の決まりを置く', 替('pol', /$/, '\nFrom 2026-12-15, Sophaxis lists no work on the policy of the Democratic Party for the People.')],
    ['記録が Sophaxis の範囲を広げる', 替('ja', 'Sophaxis の除外は、氣の原理の主題にだけ掛かります。', 'Sophaxis の除外は、この節の主題にも掛かります。')],
  ];
  const 通った = 壊し.filter(([, x]) => 問題(x).length === 0).map(([n]) => n);
  check('壊して確かめる：記録の効力の日（日・英）・一覧の項・一覧と規程の範囲・節の印（頁・記録）・Sophaxis の党の決まり・記録の範囲のどれか一つで落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

console.log('\n13j. 2026-11-20 と 2026-11-23：利益相反の記録（日英）の文・年数・人名・断り・決めごと 10 と 15・README と CV、壊して確かめる');
  /* 2026-11-20。利益相反の記録（docs/conflicts-of-interest.md と .en.md）。著者が述べたことを日英で置く。
   * ここに置くのは、check_site.js の項目の数が五つの言語のトップの頁（生成物）に名乗られているためである。
   * 師範の名は書かない（決めごと 10）。人名（藤平・植芝、英字の Tohei・Ueshiba）を置かない。
   * 団体の名は、所属の経歴の開示として、2026-11-20 に本人が許した。check_site.js の独我流の頁の「借り」の締め出しは、
   * 名乗りの頁にだけ掛かる。この記録は名乗りではなく開示であり、承認を受けていないこと、名を裏付けに使わないことを
   * 自分で書く。その断りが消えたら落とす。本人の受け止めとして書いた評価には、確かめた事実ではないという断りが要る。
   * 年数は独我流の頁と合わせる（決めごと 5）。師事した年数は、経験した年数を超えない。
   * 独学の系列に主題を足さないこと（決めごと 15）、Sophaxis では扱わないこと、研究をしない理由ではないことを固める。
   * 決めごと 10 の式（verification/kinship.js）も、この二つに当てる。 */
  {
    const { 越え, 帰属, 計画 } = require('./kinship');
    const 利 = { ja: 'docs/conflicts-of-interest.md', en: 'docs/conflicts-of-interest.en.md' };
    const 利文 = {
      ja: ['2026-11-20 の記録です。', '師範の名は書きません。', '師範を特定できる言い方もしません。',
        'この記録は、団体の承認を受けたものではありません。', '団体の名を、こちらの主張の裏付けには使いません。',
        'この立場で氣の原理を研究すると、結論がどちらに転んでも中立にはなりません。',
        '肯定する結論は、私自身の経歴と、師と流派の権威を裏付けることになります。',
        '否定する結論には、師弟関係への遠慮や圧力がかかります。',
        '扱うとすれば、当事者記録としてだけです。', '立場と師弟関係を開示します。', '体験と検証を分けた形にします。',
        'この記録は、新しい研究の主題を始めるものではありません。', '独学の系列に、この主題を足しません。',
        '私が運営する Sophaxis で、この主題を扱うことはしません。',
        'これは研究をしない理由の記録ではなく、扱う場合の条件の記録です。',
        '## 眠っている利益相反（題材が寄ったときに起きるもの）', '論点は、著者が受け取った別の言語モデル（Muse）の分析から来ています。', '書いたのは Claude です。',
        'いまはどれも弱いものです。', '題材が寄ったときにだけ、強くなります。',
        '私は、国民民主党の本部登録ファンです。', '党の名は、著者が公開すると決めて書いています。', '政治についての見解は、個人情報保護法でいう「信条」に当たりえます。',
        '党の政策に近い結論は、学術の形をとった政治的な支持に読めます。', 'ほかの党や今の制度への批判は、支持する党を守る議論に読めます。',
        'そうなった時点で、この利益相反は中程度になります。', '大学の名は、この記録には書きません。',
        '私自身の道は、いまのオンラインの学習、その先の OMSCS、その先のオンラインの博士課程です。',
        '褒めれば、単位・推薦・卒業を与える側へのへつらいに見えます。', '批判すれば、不利益を恐れて弱めたのではないかと疑われます。',
        '党と大学が重なると、弱いもの同士が中程度になります。', 'これらの主題を書くときは、開示を冒頭に置きます。', '事実と評価を分けます。',
        '在籍する大学やオンラインの学位についての一般的な評価を、研究としては書きません。', 'Sophaxis の除外は、氣の原理の主題にだけ掛かります。'],
      en: ['This is a record of 2026-11-20.', "The teacher's name is not written here.", 'Nor is anything that would identify the teacher.',
        'This record has not been approved by the organisation.', 'Its name is not used to support any claim made here.',
        'If I research the principle of ki from this position, the conclusion cannot be neutral, whichever way it falls.',
        'A conclusion that affirms it would support my own background and the authority of my teacher and the school.',
        'A conclusion that denies it would be subject to deference to, or pressure from, the relationship between teacher and student.',
        'If it is handled at all, it is only as a first-person record.', 'My position and the relationship between teacher and student are disclosed.',
        'Experience is kept apart from verification.', 'This record does not start a new research topic.', 'The subject is not added to the self-taught series.',
        'Sophaxis, which I operate, does not handle this subject.',
        'This is not a record of a reason not to research the subject; it is a record of the conditions under which it could be handled.',
        '## Dormant conflicts of interest (those that wake when the subject comes close)', 'Its points come from an analysis by another language model (Muse) that the author passed on.', 'Claude wrote it.',
        'What is set out here is weak now.', 'It becomes stronger only when the subject comes close.',
        'I am a supporter registered with the headquarters of the Democratic Party for the People (国民民主党).', 'The author chose to publish the name of the party.',
        "A political view can be a creed (「信条」) under Japan's Act on the Protection of Personal Information.",
        "A conclusion close to the party's policy can read as political endorsement in academic dress.", 'Criticism of other parties or of present institutions can read as a defence of the party I support.',
        'At that point this conflict of interest is of medium strength.', 'The name of the university is not written in this record.',
        'My own path is online study now, then OMSCS, then an online doctorate.',
        'Praise can look like flattery of those who grant credits, recommendations and graduation.', 'Criticism may be suspected of having been softened for fear of a disadvantage.',
        'Where the party and the university overlap, weak and weak become medium.', 'When I write on these subjects, the disclosure comes first.', 'Facts and evaluation are kept apart.',
        'No general evaluation of the university where I am enrolled, or of online degrees, is written as research.', 'The exclusion on Sophaxis applies only to the principle of ki.'],
    };
    const 断り = { ja: ['高い評価', 'これは私自身の受け止めとして書くもので、確かめた事実ではありません。'], en: ['rated highly', 'This is my own account, not a verified fact.'] };
    const 年の式 = { ja: [/心身統一合氣道を (\d+) 年間経験しました。/, /師範に (\d+) 年間師事して学んだ/, /本場である栃木で通算 (\d+) 年と書いています。/],
      en: [/Shinshin Toitsu Aikido \(心身統一合氣道\) for (\d+) years\./, /for (\d+) years I studied under a teacher/, /says (\d+) years in all, in Tochigi/] };
    const 利の問題 = (x) => {
      const bad = [];
      for (const l of ['ja', 'en']) {
        const t = x[l] || '';
        利文[l].filter((s) => t.indexOf(s) < 0).forEach((s) => bad.push(利[l] + ' に「' + s.slice(0, 24) + '」が無い'));
        ['藤平', '植芝', 'Tohei', 'Ueshiba'].filter((w) => t.indexOf(w) >= 0).forEach((w) => bad.push(利[l] + ' に人名「' + w + '」'));
        if (t.indexOf(断り[l][0]) >= 0 && t.indexOf(断り[l][1]) < 0) bad.push(利[l] + ' の評価に、本人の受け止めだという断りが無い');
        [越え, 帰属, 計画].forEach((re) => { const m = re.exec(t); if (m) bad.push(利[l] + ' に決めごと 10 の式が当たる「' + m[0] + '」'); });
        const 年 = 年の式[l].map((re) => { const m = re.exec(t); return m ? Number(m[1]) : null; });
        if (年.some((n) => n === null)) bad.push(利[l] + ' の年数が読めない');
        else if (年[0] !== x.通算 || 年[2] !== x.通算 || !(年[1] > 0 && 年[1] <= 年[0])) bad.push(利[l] + ' の年数（' + 年.join('・') + '）が独我流の頁の通算 ' + x.通算 + ' 年と合わない');
        if (t.indexOf('2026-12-15') < 0) bad.push(利[l] + ' に Sophaxis の効力の日が無い');
        /* 在籍する大学の名は書かない（大学は名を伏せて挙げる）。 */
        if (t.indexOf('ZEN') >= 0) bad.push(利[l] + ' に在籍する大学の名');
      }
      /* 記録が書く道（OMSCS、その先のオンラインの博士課程）は、README の目標の表にあるものだけである。 */
      if (x.rj.indexOf('| Georgia Tech の OMSCS（Online Master of Science in Computer Science）で修士号を取得すること |') < 0
          || x.rj.indexOf('University at Buffalo のオンライン博士課程') < 0
          || x.re.indexOf("| To earn a master’s degree through Georgia Tech’s OMSCS") < 0 || x.re.indexOf('University at Buffalo’s online doctoral program') < 0) bad.push('記録が書く道が README の目標に無い');
      if (x.通算 === null) bad.push('独我流の頁の通算の年数が読めない');
      if (['<p>心身統一合氣道 五級<span>', '<p>心身統一道 初級<span>', '氣の原理を日常で実践活用し得ることを認める'].some((s) => x.cv.indexOf(s) < 0)) bad.push('記録が指す CV の級が無い');
      if (x.rj.indexOf('(docs/conflicts-of-interest.md)') < 0 || x.re.indexOf('(docs/conflicts-of-interest.en.md)') < 0) bad.push('README から辿れない');
      /* 2026-11-23 の節。著者は、強い利益相反を開示して氣の原理を客観的な研究の対象にすることを考え（理由は「勿体無い」、
       * 成果は読む側からも書く側からも金を取らないプレプリントサーバーにだけ置く考え）、Claude が団体の会員規約とサイトポリシーを読み、
       * 同じ日に著者が「危ない」として進めないと決めた。2026-11-20 の立場は変わらない。
       * 固めるもの：節が日英にあり、2026-11-20 の節のあと・眠っている利益相反の前にあること。著者の言葉。規約の所在と SHA-256。
       * 会員規約の条（第 13 条の 1・2・3・5 項、第 14 条の（5）、第 17 条）の一字一句。確かめていないという断り。
       * 指導資格は記録に無いこと（CV の「武道」の欄に指導資格が無いことと突き合わせる）。2026-11-20 の立場が続くこと。
       * 始めていない研究の手立て（事前登録・倫理審査・学術誌・公開の経路）を節に書かないこと。特定のプレプリントサーバーの名を書かないこと。
       * 2026-11-20 の文は改めていないので、その横に「改めました」の注を置かないこと。 */
      const 検の条 = ['> 第１３条 権利帰属',
        '> １.心身統一道および心身統一合氣道の内容、本会が発行する著作物や教材など、すべての著作権、その他の知的財産権は本会に帰属する。会員は自身の心身統一道および心身統一合氣道の稽古にのみこれを使用することができる。',
        '> ２.会員は、本会から提供されるあらゆる形のコンテンツを使用し、書籍の出版・教材の製作・インターネットでの公開など、著作権法に違反する行為をすることはできない。また、本会から提供されるあらゆる形のコンテンツを利用する場合には、あらかじめ本会の許可を得るものとする。',
        '> ３.会員は、心身統一道および心身統一合氣道に関する書籍の出版や有料動画などの作成・販売、および教材の製作はできない。',
        '> ５.第１項、第２項、第３項の規定は、会員の退会後または除名後も同様とする。',
        '> 第１４条 禁止事項', '> （５）許可なく撮影・録音・記録すること', '> 第１７条 除名',
        '> 会員が本規約に違反し本会の指示に従わない場合、もしくは会員が本会の社会的信用を毀損した場合は、社員総会の決定により当該会員を除名する。当該会員は段位・伝位・級位は剥奪され、再入会することはできない。'];
      const 検の所在 = ['`https://shinshintoitsuaikido.org/wp/wp-content/uploads/2026/03/会員規約2026.pdf`', '`3875eeb158c6d5f7aaa340462239bc5766ea86fc6f2ed2f0e985c108d107bba3`',
        '`https://shinshintoitsuaikido.org/guidance/sitepolicy.php`', '`2ca8d01c3a55574eca5a564d5bcc393c1a6fd280c9bf249986035637a64ed387`'];
      const 検 = {
        ja: { head: '\n## 2026-11-23 に検討したこと\n', prev: '\n### これは研究をしない理由ではない\n', next: '\n## 眠っている利益相反',
          must: ['2026-11-20 の立場は、変わっていません。', '著者の言葉は「氣の原理についての研究を強い利益相反を開示しつつ客観的にやろうと思う」です。',
            '理由として、著者は、稽古の内側で得た知識を使わずに置くのは「勿体無い」と述べました。',
            '成果は、読む側からも書く側からも金を取らないプレプリントサーバーにだけ置く考えでした。', '著者の言葉は「プレプリントサーバーに留めておく」です。',
            '著者の求めで、Claude は 2026-11-23（日本時間）に、心身統一合氣道会の規約を読みました。', '附則：2011-04-01 発効、2026-04-01 改定',
            'この定めが元の会員をどこまで縛るかは、確かめていません。', 'この定めが著作権法とどう関わるかも、確かめていません。', '弁護士の確認も受けていません。',
            '著者がいま会員かどうかは、この記録には書きません。', '第 17 条の除名は、会員についての定めです。', 'これは、指導資格者に掛かる規約です。',
            'CV の「武道」の欄が挙げるのは、心身統一合氣道 五級と心身統一道 初級だけです。', '指導資格は、記録のどこにも書いてありません。',
            '同じ 2026-11-23 に、この研究を進めないと著者が決めました。', '著者の言葉は「いやぁでもやっぱり危ないね辞めておく」です。',
            '著者は、法の面の危うさを「危ない」と判断しました。', '研究は始めていません。', 'したがって、2026-11-20 の立場はそのまま続きます。',
            '氣の原理は、扱うとしても当事者記録の形に限ります。', '独学の系列にも足しません。', 'Sophaxis にも載せません。'],
          退け: /事前登録|倫理審査|学術誌|共同研究者|最初の一歩|公開の経路/, 改め: /2026-11-23 に改め/ },
        en: { head: '\n## Considered on 2026-11-23\n', prev: '\n### This is not a reason not to research it\n', next: '\n## Dormant conflicts of interest',
          must: ['The position of 2026-11-20 has not changed.', "In the author's words: 「氣の原理についての研究を強い利益相反を開示しつつ客観的にやろうと思う」.",
            'As the reason, the author said that leaving unused the knowledge gained inside the practice would be a waste (「勿体無い」).',
            'The outputs were to be placed only on preprint servers that charge neither authors nor readers.', "In the author's words: 「プレプリントサーバーに留めておく」.",
            "At the author's request, Claude read the rules of the Shinshin Toitsu Aikido Kai on 2026-11-23 (Japan time).",
            'Supplementary provisions: in force from 2011-04-01, revised 2026-04-01',
            'Whether, and how far, this binds a former member was not checked.', 'How it relates to copyright law was not checked either.', 'No lawyer has reviewed it.',
            'Whether the author is a member now is not recorded here.', 'Expulsion under Article 17 concerns members.', 'These rules apply to qualified instructors.',
            'The section 「武道」 of the CV lists only fifth kyu of Shinshin Toitsu Aikido and the first grade of Shinshin Toitsu Dō.',
            'No instructor qualification is written anywhere in the records.',
            'On the same day, 2026-11-23, the author decided not to proceed with this research.', "In the author's words: 「いやぁでもやっぱり危ないね辞めておく」.",
            'The author judged the legal risk to be too high (「危ない」).', 'No research has been started.', 'The position of 2026-11-20 therefore continues as it was.',
            'The principle of ki, if handled at all, is handled only in the form of a first-person record.', 'It is not added to the self-taught series either.',
            'It is not listed on Sophaxis either.'],
          退け: /preregist|ethics review|journal|collaborator|first step|route of publication/i, 改め: /revised on 2026-11-23/i },
      };
      const 鯖 = /arXiv|PsyArXiv|SocArXiv|Jxiv|bioRxiv|medRxiv|SSRN|Research Square|Preprints\.org|OSF|Zenodo|Figshare|HAL\b|J-STAGE/;
      for (const l of ['ja', 'en']) {
        const t = x[l] || '';
        const k = 検[l];
        const a = t.indexOf(k.head), p = t.indexOf(k.prev), n = t.indexOf(k.next);
        if (a < 0) { bad.push(利[l] + ' に 2026-11-23 の節が無い'); continue; }
        if (!(p >= 0 && p < a && n > a)) bad.push(利[l] + ' の 2026-11-23 の節が、2026-11-20 の氣の原理の節のあと・眠っている利益相反の前にない');
        const e = t.indexOf('\n## ', a + 1);
        const sec = t.slice(a, e < 0 ? t.length : e);
        k.must.filter((s) => sec.indexOf(s) < 0).forEach((s) => bad.push(利[l] + ' の 2026-11-23 の節に「' + s.slice(0, 24) + '」が無い'));
        const 引 = sec.split('\n').filter((s) => s.startsWith('> ')).join('\n');
        検の条.filter((s) => 引.indexOf(s) < 0).forEach((s) => bad.push(利[l] + ' の 2026-11-23 の節に、会員規約の「' + s.slice(2, 22) + '」が一字一句ない'));
        検の所在.filter((s) => sec.indexOf(s) < 0).forEach((s) => bad.push(利[l] + ' の 2026-11-23 の節に、規約の所在か SHA-256 の「' + s.slice(1, 25) + '」が無い'));
        const 退 = k.退け.exec(sec); if (退) bad.push(利[l] + ' の 2026-11-23 の節に、始めていない研究の手立て「' + 退[0] + '」');
        const 名 = 鯖.exec(sec); if (名) bad.push(利[l] + ' の 2026-11-23 の節に、特定のサーバーの名「' + 名[0] + '」');
        const 改 = k.改め.exec(t); if (改) bad.push(利[l] + ' に、改めていない 2026-11-20 の文への注「' + 改[0] + '」');
      }
      if (/指導資格|指導員/.test(x.cv)) bad.push('CV に指導資格があるのに、記録は無いと書いている');
      if (x.rj.indexOf('進めないと決めたこと（2026-11-23）') < 0 || x.re.indexOf('the decision not to proceed (2026-11-23') < 0) bad.push('README の行が 2026-11-23 の節を書いていない');
      return bad;
    };
    const 通算 = (h) => { const m = /本場である栃木で通算 (\d+) 年/.exec(h); return m ? Number(m[1]) : null; };
    const C_ = (f) => read('cpsbvbng26-dotcom', f) || '';
    const 利今 = { ja: C_(利.ja), en: C_(利.en), 通算: 通算(C_(path.join('notes', 'solitary-school.html'))), cv: C_('cv.html'), rj: C_('README.md'), re: C_('README.en.md') };
    const 利今の問題 = 利の問題(利今);
    check('利益相反の記録（2026-11-20）が日英で、氣の原理の立場・中立にならない理由・扱う場合の条件・独学の系列に足さないこと・Sophaxis で扱わないこと、眠っている利益相反（党・在籍する大学・重なり・条件・Sophaxis の範囲）を書き、人名も大学の名も置かず、年数が独我流の頁の通算 ' + 利今.通算 + ' 年と合い、道が README の目標にあり、2026-11-23 の節（検討・会員規約とサイトポリシーの所在と SHA-256・条の一字一句・確かめていない断り・指導資格・進めない決め・2026-11-20 の立場の続き）を日英で、退けた手立てと特定のサーバーの名と改めの注を置かずに書く',
       利今の問題.length === 0, 利今の問題.slice(0, 4).join(' / '));
    const 利替 = (k, a, b) => Object.assign({}, 利今, { [k]: 利今[k].replace(a, b) });
    const 利壊 = [
      ['経験の年数を 8 年にする', 利替('ja', '心身統一合氣道を 7 年間', '心身統一合氣道を 8 年間')],
      ['英語の年数だけを変える', 利替('en', 'for 7 years.', 'for 6 years.')],
      ['師事の年数を経験の年数より長くする', 利替('ja', '師範に 4 年間師事', '師範に 9 年間師事')],
      ['独我流の頁の通算が変わる', Object.assign({}, 利今, { 通算: (利今.通算 || 0) + 1 })],
      ['人名を書く（どの人とも結び付けず、末尾に一語だけ置く）', 利替('ja', /$/, '\n藤平\n')],
      ['英語に人名を書く（末尾に一語だけ置く）', 利替('en', /$/, '\nUeshiba\n')],
      ['評価の断りを外す', 利替('ja', 'これは私自身の受け止めとして書くもので、確かめた事実ではありません。', '')],
      ['承認を受けていないという断りを外す', 利替('en', 'This record has not been approved by the organisation.', '')],
      ['独学の系列に足さないという文を外す', 利替('ja', '独学の系列に、この主題を足しません。', '')],
      ['否定の向きを外す', 利替('en', 'A conclusion that denies it would be subject to deference to, or pressure from, the relationship between teacher and student.', '')],
      ['続柄の一語を越える', 利替('ja', '私は、心身統一合氣道を', '父が勧めて、私は心身統一合氣道を')],
      ['README から外す', 利替('re', '(docs/conflicts-of-interest.en.md)', '(docs/governance.md)')],
      ['CV の級が消える', 利替('cv', '<p>心身統一道 初級<span>', '<p>初級<span>')],
      ['在籍する大学の名を書く', 利替('ja', 'いまは弱いものです。\n私は大学の職員ではなく', 'いまは弱いものです。\n私は ZEN大学の職員ではなく')],
      ['党の名を外す', 利替('ja', '私は、国民民主党の本部登録ファンです。', '私は、ある党の本部登録ファンです。')],
      ['別の言語モデルの分析だという断りを外す', 利替('en', 'Its points come from an analysis by another language model (Muse) that the author passed on.', '')],
      ['支持の向きの片方を外す', 利替('ja', 'ほかの党や今の制度への批判は、支持する党を守る議論に読めます。', '')],
      ['Sophaxis の除外を広げる', 利替('en', 'The exclusion on Sophaxis applies only to the principle of ki.', 'The exclusion on Sophaxis applies to these subjects too.')],
      ['README の目標から OMSCS が消える', 利替('rj', '| Georgia Tech の OMSCS（Online Master of Science in Computer Science）で修士号を取得すること |', '| 修士号を取得すること |')],
      ['2026-11-23 の節を外す（日）', 利替('ja', '\n## 2026-11-23 に検討したこと\n', '\n## 別の節\n')],
      ['2026-11-23 の節を眠っている利益相反のあとへ動かす（英）', 利替('en', /(\n## Considered on 2026-11-23\n[\s\S]*?)(\n## Dormant conflicts of interest[\s\S]*)$/, (m, a, b) => b + a)],
      ['「危ない」の引用を外す（英）', 利替('en', 'The author judged the legal risk to be too high (「危ない」).', 'The author judged the legal risk to be too high.')],
      ['進めないと決めた文を外す（日）', 利替('ja', '同じ 2026-11-23 に、この研究を進めないと著者が決めました。', '')],
      ['会員規約の第 13 条第 5 項を一字変える（日）', 利替('ja', '会員の退会後または除名後も同様とする。', '会員の退会後も同様とする。')],
      ['会員規約の第 17 条を一字変える（英）', 利替('en', '社員総会の決定により当該会員を除名する。', '理事会の決定により当該会員を除名する。')],
      ['会員規約の第 14 条の（5）を外す（日）', 利替('ja', '> （５）許可なく撮影・録音・記録すること', '> （５）許可なく撮影すること')],
      ['会員規約の SHA-256 を一字変える（英）', 利替('en', '`3875eeb158c6d5f7aaa340462239bc5766ea86fc6f2ed2f0e985c108d107bba3`', '`3875eeb158c6d5f7aaa340462239bc5766ea86fc6f2ed2f0e985c108d107bba4`')],
      ['サイトポリシーの所在を外す（日）', 利替('ja', '`https://shinshintoitsuaikido.org/guidance/sitepolicy.php`', '団体のサイト')],
      ['弁護士の確認を受けていないという断りを外す（日）', 利替('ja', '弁護士の確認も受けていません。', '')],
      ['退けた手立てを書く（日）', 利替('ja', '研究は始めていません。', '研究は始めていません。\n分析の前に、問いと判定の基準を事前登録します。')],
      ['退けた公開の経路を書く（英）', 利替('en', 'No research has been started.', 'No research has been started.\nThe work will be submitted to a journal.')],
      ['特定のサーバーの名を書く（英）', 利替('en', 'No research has been started.', 'No research has been started.\nThe server considered was arXiv.')],
      ['2026-11-20 の文の横に「改めました」の注を置く（日）', 利替('ja', 'どれかを欠く形では扱いません。\n', 'どれかを欠く形では扱いません。\n\nこの節の一文目は、2026-11-23 に改めました。\n')],
      ['2026-11-20 の立場が続くという文を外す（英）', 利替('en', 'The position of 2026-11-20 therefore continues as it was.', '')],
      ['指導資格が CV に載る', 利替('cv', '<p>心身統一道 初級<span>', '<p>心身統一合氣道 指導資格<span>2024 年</span></p>\n      <p>心身統一道 初級<span>')],
      ['README の行から 2026-11-23 を外す', 利替('rj', '進めないと決めたこと（2026-11-23）', '')],
    ];
    const 利通った = 利壊.filter(([, x]) => 利の問題(x).length === 0).map(([n]) => n);
    check('壊して確かめる：年数（日・英・師事・独我流の頁）・人名（日・英）・断り（評価・承認・別の言語モデル）・決めごと 15 の文・否定の向き・続柄・README・CV・大学の名・党の名・支持の向き・Sophaxis の範囲・目標の表、2026-11-23 の節（有無・位置・引用・決め・条・SHA-256・所在・断り・退けた手立て・経路・サーバーの名・改めの注・立場・指導資格・README）のどれを崩しても落ちる（'
       + (利壊.length - 利通った.length) + ' / ' + 利壊.length + '）', 利通った.length === 0, 利通った.join(', '));
  }

console.log('\n13k. 2026-11-23：国立国会図書館デジタルコレクションの三篇の番号が、所在を並べるどの面にもそろい、篇を取り違えていない');
{
  /* 2026-11-21 に、独身論・人格的帝国主義・海軍公報の史料ノートが国立国会図書館デジタルコレクションに登録された
   * （オンライン資料収集制度。番号は 2026-11-23 に国立国会図書館サーチの検索 API と資料 API から読んだ）。
   * 利用者は「GitHub とサイトの側にだけ余す所なく」と決めた。所在を並べる面のどれかで抜けるか、篇を取り違えると落ちる。
   * 一。どの面にも、その面が扱う篇の番号がある（ノートの頁の設定は所在と sameAs の二か所）。
   * 二。論文の頁には、その篇の番号しか無い。
   * 三。行に Zenodo の DOI と NDL の番号が並ぶ表では、同じ行の二つが同じ篇を指す。
   * 四。壊して確かめる。 */
  const 篇 = { '15017937': '22058254', '15017938': '22057583', '15017939': '22055709' };
  const 全 = Object.keys(篇);
  const 哲 = ['15017937', '15017938'];
  const 面 = [
    ['researcher-profile', 'papers.json', 全, 1],
    ['researcher-profile', 'notes.json', 全, 2],
    ['researcher-profile', 'notes.en.json', 全, 2],
    ...['site.json', 'site.en.json', 'site.de.json', 'site.fr.json', 'site.it.json'].map((x) => ['researcher-profile', x, 哲, 1]),
    ...['index.html', 'index.en.html', 'index.de.html', 'index.fr.html', 'index.it.html'].map((x) => ['cpsbvbng26-dotcom', x, 哲, 1]),
    ['cpsbvbng26-dotcom', 'notes/index.html', 全, 2],
    ['cpsbvbng26-dotcom', 'notes/index.en.html', 全, 2],
    ...[['celibate-individual', '15017937'], ['imperial-selfhood', '15017938'], ['naval-gazette-otani-tsune', '15017939']]
      .flatMap(([p, id]) => ['', '.en'].map((l) => ['cpsbvbng26-dotcom', 'papers/' + p + l + '.html', [id], 1])),
    ...['README.md', 'README.en.md', 'docs/doi-index.md', 'docs/submission-disclosure.md', 'docs/canonical-sources.md'].map((x) => ['cpsbvbng26-dotcom', x, 全, 1]),
    ...['README.md', 'CITATION.cff', 'docs/how-to-cite.md'].map((x) => ['autonomy-and-self-cultivation', x, 哲, 1]),
    ...['README.md', 'CITATION.cff'].map((x) => ['naval-gazette-notes', x, ['15017939'], 1]),
    ['solitary-school', 'index.html', ['15017937'], 1],
  ];
  const 行の面 = ['cpsbvbng26-dotcom:README.md', 'cpsbvbng26-dotcom:README.en.md', 'cpsbvbng26-dotcom:docs/doi-index.md',
    'cpsbvbng26-dotcom:docs/canonical-sources.md', 'autonomy-and-self-cultivation:README.md'];
  const 今 = {};
  面.forEach(([r, f]) => { 今[r + ':' + f] = read(r, f) || ''; });
  const 問題 = (x) => {
    const bad = [];
    for (const [r, f, ids, n] of 面) {
      const t = x[r + ':' + f] || '';
      if (!t) { bad.push(r + '/' + f + ' が読めない'); continue; }
      for (const id of ids) {
        /* 二か所を求める面（ノートの頁の所在と sameAs）は、頁の URL の数で数える。所在の欄は番号と URL を両方持つので、番号を足すと sameAs の欠けを見逃す。 */
        const url = t.split('dl.ndl.go.jp/pid/' + id).length - 1;
        const ある = url > 0 || t.includes('ndljp/pid/' + id);
        if (!ある) bad.push(r + '/' + f + ' に ' + id + ' が無い');
        else if (n > 1 && url < n) bad.push(r + '/' + f + ' に ' + id + ' の頁が ' + n + ' か所そろっていない');
      }
      if (f.startsWith('papers/')) 全.filter((id) => !ids.includes(id) && t.includes('pid/' + id)).forEach((id) => bad.push(f + ' に別の篇の ' + id));
    }
    for (const k of 行の面) {
      (x[k] || '').split('\n').forEach((l) => {
        const ids = 全.filter((id) => l.includes('pid/' + id));
        const zs = 全.filter((id) => l.includes('zenodo.' + 篇[id]));
        if (ids.length && zs.length && ids.join() !== zs.join()) bad.push(k + ' の行で、Zenodo と NDL が別の篇を指す');
      });
    }
    return bad;
  };
  const now = 問題(今);
  check('国立国会図書館の三篇の番号（info:ndljp/pid/15017937〜15017939）が、所在を並べる ' + 面.length + ' の面にそろい、論文の頁と表の行で篇を取り違えていない',
    now.length === 0, now.slice(0, 4).join(' / '));
  const 替 = (k, a, b) => Object.assign({}, 今, { [k]: 今[k].replace(a, b) });
  const 壊し = [
    ['一覧の表の行で独身論と人格的帝国主義の番号を入れ替える', 替('cpsbvbng26-dotcom:docs/doi-index.md', '`info:ndljp/pid/15017937`', '`info:ndljp/pid/15017938`')],
    ['海軍公報の論文の頁から外す', 替('cpsbvbng26-dotcom:papers/naval-gazette-otani-tsune.html', /pid\/15017939/g, 'pid/0')],
    ['独身論の論文の頁に別の篇の番号を書く', 替('cpsbvbng26-dotcom:papers/celibate-individual.en.html', /<\/body>/, 'pid/15017938</body>')],
    ['イタリア語の設定から人格的帝国主義を外す', 替('researcher-profile:site.it.json', /pid\/15017938/g, 'pid/0')],
    ['英語のノートの設定から sameAs の一つを外す', 替('researcher-profile:notes.en.json', '"https://dl.ndl.go.jp/pid/15017939"', '"https://example.org/"')],
    ['自己陶冶の CITATION.cff から外す', 替('autonomy-and-self-cultivation:CITATION.cff', /pid\/15017937/g, 'pid/0')],
    ['史料ノートの README から外す', 替('naval-gazette-notes:README.md', /pid\/15017939/g, 'pid/0')],
    ['独我流の頁から外す', 替('solitary-school:index.html', /pid\/15017937/g, 'pid/0')],
    ['英語の README の行で篇を取り違える', 替('cpsbvbng26-dotcom:README.en.md', /pid\/15017939\)/, 'pid/15017937)')],
  ];
  const 通った = 壊し.filter(([, x]) => 問題(x).length === 0).map(([n]) => n);
  check('壊して確かめる：表の行の入れ替え・論文の頁の欠けと取り違え・五言語の設定・ノートの sameAs・CITATION.cff・README・独我流の頁のどれを崩しても落ちる（'
    + (壊し.length - 通った.length) + ' / ' + 壊し.length + '）', 通った.length === 0, 通った.join(', '));
}

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
