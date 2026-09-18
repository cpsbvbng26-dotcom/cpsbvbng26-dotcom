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

/* SSRN の DOI も同じ扱いにする。Zenodo と違い、番号は SSRN が発行し、
 * 著者が読み取って渡す。**実在は確かめない**（この環境から届かない）。
 * 確かめるのは、写した番号がリポジトリ間でずれていないことだけである。
 * 一箇所だけ直して他を直し忘れると、ここで落ちる。 */

{
  const DOI = /10\.2139\/ssrn\.\d+/g;
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
  for (const repo of C.repos) {
    const dir = path.join(ROOT, repo);
    if (fs.existsSync(dir)) scan(dir, found);
  }

  const missing = [...found].filter((d) => !listed.has(d)).sort();
  const orphan = [...listed].filter((d) => !found.has(d)).sort();

  check('出てくる SSRN の番号が、すべて一覧に載っている',
    index !== null && missing.length === 0,
    missing.length ? ('一覧に無い: ' + missing.join(', ')) : (found.size + ' 種'));
  check('一覧の SSRN の番号が、すべてどこかに出てくる',
    index !== null && orphan.length === 0,
    orphan.length ? ('どこにも無い: ' + orphan.join(', ')) : ('一覧 ' + listed.size + ' 種'));
}

/* **落ちた理由の推定に数を書いた。だから数え直す。**
 * 参考文献の項目数と、版元の記載がある項目数を、紙面の書き起こしから数える。
 * 散文の表と一つでも違えば落ちる。**推定であることは変わらないが、
 * 推定の土台になっている数は動かせない。** */

{
  const F = path.join('docs', 'external-evaluations.md');
  const text = read('cpsbvbng26-dotcom', F);
  const PUB = /(University Press|Univ\. Press|Press|Verlag|Routledge|Penguin|de Gruyter|Simon & Schuster|Brothers|Books|Publishers?|Publishing|Oxford|Cambridge|Harvard|Chicago|Princeton)/;
  const PAPERS = [
    ['独身者論（通った）', 'celibate-individual'],
    ['人格的帝国主義（通った）', 'imperial-selfhood'],
    ['断片主義（落ちた）', 'fragmentarian-spiritual-individualism'],
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
    && text.indexOf('SSRN がそう判断したという証拠ではない') >= 0);
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
      && text.indexOf('書けないことを埋めない') >= 0);
    check('自称の肩書きでないと書いてある',
      text.indexOf('自称の肩書きを書かない') >= 0
      && text.indexOf('これらは肩書きではない') >= 0 === false
      && text.indexOf('以下の位置づけは肩書きではない') >= 0);
    check('根拠を三つに分けてある',
      ['`紙面`', '`証言`', '`未確認`'].every((x) => text.indexOf(x) >= 0));
    check('総合点を作らないと書いてある',
      text.indexOf('総合点は作らない') >= 0);
    check('比較の相手を先に定義してある',
      text.indexOf('比較の相手を先に定義する') >= 0);
    check('覆し方が書いてある',
      text.indexOf('## 覆し方') >= 0
      && text.indexOf('査読を通った論文を一篇示せば') >= 0);

    /* 数を他から数え直す。 */
    const papers = (() => {
      const raw = read('researcher-profile', 'papers.json');
      if (raw === null) return null;
      try { const j = JSON.parse(raw); return (Array.isArray(j) ? j : j.papers).length; }
      catch (e) { return null; }
    })();
    const zen = (() => {
      const raw = read('cpsbvbng26-dotcom', path.join('docs', 'doi-index.md'));
      if (raw === null) return null;
      return (raw.match(/^\| \d+ \| `10\.5281\/zenodo\.\d+`/gm) || []).length;
    })();
    const reg = (() => {
      const raw = read('self-correction', 'register.toml');
      if (raw === null) return null;
      return (raw.match(/^\[\[entry\]\]/gm) || []).length;
    })();

    const rows = [['公開した成果物', papers, '篇'],
                  ['Zenodo の DOI', zen, '件'],
                  ['登録簿', reg, '件']];
    const wrong = [];
    for (const [label, actual, unit] of rows) {
      if (actual === null) { wrong.push(label + ' を数えられない'); continue; }
      if (text.indexOf('**' + actual + ' ' + unit + '**') < 0) {
        wrong.push(label + ' 実際 ' + actual + unit + ' が書かれていない');
      }
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
      text.indexOf('新しい結果としての貢献は 0 である') >= 0
      && text.indexOf('新しい数学は無い') >= 0
      && text.indexOf('だが「貢献」は一つの軸ではない') >= 0
      && text.indexOf('数学を専門にしない者') >= 0);

    /* **「再発見も広義には貢献である」を認めた。認めた以上、どこまで認めたかを
     * 固定する。**当たっているのは経路の記録のほうで、再発見そのものではない。
     * この切り分けが落ちると、認めた範囲が静かに広がる。 */
    check('再発見そのものは数えられないと書いてある',
      text.indexOf('| **再発見そのもの** | **数えない** |') >= 0
      && text.indexOf('同じ定理に二度目に辿り着くこと自体は、分野の既知を一つも増やさない') >= 0
      && text.indexOf('増えているのは、辿り着き方の記録のほうである') >= 0);
    check('経路の記録の価値を、ここでは決めないと書いてある',
      text.indexOf('この経路の記録に価値があるかどうかは、ここでは決められない') >= 0
      && text.indexOf('存在することと、機械で検査されていることまでである') >= 0);
    check('経路の記録の強度の限りを書いてある',
      text.indexOf('事後に書き起こしたものであり、その時点で書かれたものではない') >= 0
      && text.indexOf('そこを書かずに経路の記録を持ち出せば、実際より強く見える') >= 0);

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
      const i0 = text.indexOf('**種別で数えると、こうなる**');
      const seg = i0 < 0 ? '' : text.slice(i0, text.indexOf('。', i0));
      const 名乗り = [...seg.matchAll(/([^\s、—]+) (\d+)/g)]
        .map((m) => m[1] + ' ' + m[2]).sort();
      check('内訳が、種別の欄だけを数えたものだと書いてある',
        text.indexOf('この数は種別の欄だけを数えたものである') >= 0
        && text.indexOf('欄をまたいで足していない') >= 0);
      check('内訳に、ROUTE.md に無い種別が混ざっていない',
        名乗り.length > 0 && 名乗り.join('／') === 内訳.join('／'),
        名乗り.length ? 名乗り.join('、') : '内訳の文が見つからない');

      const 再構成 = 記録['再構成'] || 0;
      const 同時 = 記録['同時'] || 0;
      check('再構成と同時記録の行数が、ROUTE.md から数え直したものと合う',
        再構成 > 0 && 同時 > 0 && 再構成 < 漢.length && 同時 < 漢.length
        && text.indexOf(漢[n] + '行のうち' + 漢[再構成] + '行は「再構成」である') >= 0
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
        && text.indexOf('経路の ' + 否定行[0] + ' は種別が「発見の否定」だが') >= 0,
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
        && arxiv.indexOf('**第一希望から外した。**') >= 0);
    }
    check('到達が貢献に読み替えられないようにしてある',
      text.indexOf('分野への貢献では一切ない') >= 0
      && text.indexOf('一般の読者から見て珍しいことと、分野にとって新しいことは、別の話である') >= 0
      && text.indexOf('貢献 0 を薄めるためではない') >= 0);
    check('コードが同梱されていないことを書いてある',
      text.indexOf('コードは論文に同梱されていない') >= 0
      && text.indexOf('E3') >= 0);

    /* **水準を書いたのは数学だけである。**黙っているのは低いからではなく、
     * 測れないからである。**その断りが無いと、読む側から区別が付かない。**
     * そして「無い」と書いた以上、本当に無いことを機械で当たる。 */
    check('水準を書いたのが数学だけだと書いてある',
      text.indexOf('## 水準を書いたのは、数学だけである') >= 0
      && text.indexOf('**黙っているのは、低いからではない。測れないからである。**') >= 0
      && text.indexOf('機械で切り出せる「残った命題」が無い') >= 0);
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
      text.indexOf('だが、ここから「だから水準が低い」へは飛ばない') >= 0
      && text.indexOf('材料は材料のまま置く') >= 0);

    /* **新規性 0 は、意味 0 を含意しない。**分野が数えないことと、
     * 中身が無いことは別である。**混ぜると、片方を根拠にもう片方を言えてしまう。**
     * そして逆向きにも滑る —— 限定的な意味を「小さいが貢献」に読み替える道である。
     * **両方を塞ぐ。** */
    check('新規性 0 と意味 0 を、分けて書いてある',
      text.indexOf('## 新規性が 0 であることと、意味が無いことは違う') >= 0
      && text.indexOf('そこから「意味が無い」は出ない') >= 0
      && text.indexOf('分野が数えないことと、何の内容も無いことは、\n別のことである') >= 0);
    /* **射程はどちらにも滑る。**「意味を持たない」の範囲を作用素まで広げれば
     * 実際より低く、狭めれば高く読める。**証明されたのは三という数についてだけである。** */
    check('「意味を持たない」の範囲が、三という数に限られている',
      text.indexOf('記号 `Ⅲ` の側 —— 三という数についてだけである') >= 0
      && text.indexOf('作用素そのものでも、残った事実でもない') >= 0
      && text.indexOf('**その範囲を広げない。**') >= 0);
    check('限定的な意味を、貢献に足し算しないと書いてある',
      text.indexOf('どちらも「小さいが貢献」ではない') >= 0
      && text.indexOf('分野の既知は一つも増えていない') >= 0
      && text.indexOf('軸が違うものを、足し算にしない') >= 0);
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
        [text, '収束を決めているのは係数の**相乗平均**であって、三篇が書いた `maxᵢ aᵢ` ではない'],
        [text, '**相乗平均は最大値以下であり、三篇の評価より真の値に近い**'],
        [ti, '相乗平均であって、最大値でも作用素ノルムでもない']
      ];
      const 欠け = 両方.filter(([a, b]) => text.indexOf(a) < 0 || ti.indexOf(b) < 0)
        .map(([a]) => a)
        .concat(片側.filter(([src, x]) => src.indexOf(x) < 0).map(([, x]) => x));
      /* 「真であることに尽きる」は、新規性 0 の受け皿である。
       * **片方だけ動かせば、受け皿の無い 0 か、根拠の無い価値になる。** */
      const 尽きる = ['論文としての価値は、真であることに尽きる。ただし、いまは条件つきである',
                      'だが、貢献は主張している',
                      'この四文は帰属の側で立たない',
                      '下限と上限が一致しているとは、現在形では書けない'];
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
      && text.indexOf('低い段にいるのではなく、段に乗っていない') >= 0);
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
    const 実際 = (節.match(/^\d+\. \*\*/gm) || []).length;
    const 名乗り = (/決めごとは(.)つある/.exec(text) || [null, ''])[1];
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
      散文.indexOf('事実が許す上限まで書かせる') >= 0
      && 散文.indexOf('ただし事実を超えない') >= 0
      && 散文.indexOf('上限を決めるのは事実であって、語彙ではない') >= 0);
    check('渡す文の側にも、その対が入っている',
      囲み.indexOf('事実が許す上限まで書く') >= 0
      &&囲み.indexOf('ただし事実を超えない') >= 0
      && 囲み.indexOf('事実を足さない') >= 0);

    /* **低い側へ倒す指示にもしない。**両側を塞いで初めて、事実のままになる。 */
    check('低い側にも倒さないと書いてある',
      散文.indexOf('低い側にも倒さない') >= 0
      && 散文.indexOf('ST-002') >= 0
      && 囲み.indexOf('ST-002 がその判定を塞いでいる') >= 0);

    /* **謙遜を形容詞でやらせない。**語尾で謙遜すると、範囲を書かずに済んでしまう。 */
    check('謙遜を順序で出すと書いてある',
      散文.indexOf('謙遜は語尾ではなく順序で出す') >= 0
      && ['ささやかな', '拙い'].every((w) => 散文.indexOf(w) >= 0)
      && 囲み.indexOf('範囲を書くことで謙遜する') >= 0);

    check('覆し方を添えさせると書いてある',
      散文.indexOf('覆し方を添えさせる') >= 0
      && 散文.indexOf('覆し方の無い行は、評価ではなく宣伝である') >= 0
      && 囲み.indexOf('それが覆る条件を添える') >= 0);

    /* **仕様を変えても動かないものを、仕様自身に書かせる。** */
    check('貢献 0 と ST-002 は動かないと書いてある',
      散文.indexOf('分野への貢献は 0 である') >= 0
      && 散文.indexOf('上限まで書かせても、ここは動かない') >= 0
      && 散文.indexOf('`ST-002` は塞がったままである') >= 0);
    check('自称の肩書きにしないと書いてある',
      散文.indexOf('自称の肩書きにしない') >= 0
      && 散文.indexOf('外が書いたものを、こちらの名乗りに移さない') >= 0);
    check('査読と呼ばないと書いてある',
      散文.indexOf('外の AI が返した文は、査読ではない') >= 0);
    check('本人の側の文書に混ぜないと書いてある',
      散文.indexOf('`self-assessment.md` は書き換えない') >= 0
      && 散文.indexOf('外が書いたものは外の欄に置く') >= 0);

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
      && 自己.indexOf('返ってきた文は、この文書に混ぜない') >= 0
      && 自己.indexOf('貢献 0 と `ST-002` は、どちらの側からも動かない') >= 0);
  }
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
    /* **強調の記法に依らせない。**閉じない太字を直したとき、
     * `**いま N 件。**` が `**…**。いま N 件。` に変わって外れた。
     * 見るのは数のほうである。 */
    const m = /いま (\d+) 件。/.exec(text);
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

    /* PlumX は計測であって評価ではない。「受けた評価」に混ぜない。
     * そして数値を転記しない —— 動くし、この環境から確かめられない。 */
    const plum = text.slice(text.indexOf('## 計測されているもの'),
                            text.indexOf('### 経路が二つある'));
    check('PlumX が評価ではないと書いてある',
      text.indexOf('計測であって評価ではない') >= 0);
    check('PlumX の数を書き写さないと書いてある',
      text.indexOf('この記録に転記しない') >= 0);
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
      && plum.indexOf('宛先の形から組み立てた URL である') >= 0);

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
      text.indexOf('原文に当たっていない') >= 0);
    check('接地の材料が薄い側に当たると書いてある',
      text.indexOf('接地の材料が薄い側に当たる') >= 0);

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
      && F.indexOf('**この文書は、記録ではない。**') >= 0
      && F.indexOf('**当てはめは、知見ではない。**') >= 0);
    check('等級を、書誌と当てはめで分けてある',
      F.indexOf('**検索で確認。原典には当たっていない**') >= 0
      && F.indexOf('**解釈。検証不能**') >= 0);
    /* 出典の数は表から数え直す。手で書けばずれる。 */
    const 漢 = '〇一二三四五六七八九十'.split('');
    const n = (F.match(/^\| \d+ \| /gm) || []).length;
    check('出典の数が、表から数え直したものと合う',
      n > 0 && n < 漢.length && F.indexOf('## 出典 —— ' + 漢[n] + 'つ') >= 0,
      n + ' 行');
    /* **枠組みを増やしても記録は上がらない。**そこが消えると宣伝に変わる。 */
    check('この当てはめが何も証明しないと書いてある',
      F.indexOf('## この当てはめが証明しないこと') >= 0
      && F.indexOf('**何も証明しない。**') >= 0
      && F.indexOf('**枠組みを増やしても、記録は一段も上がらない。**') >= 0);
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
    && E.indexOf('**選別を一つも経ていない。**') >= 0
    && E.indexOf('**応じなかった記録も置く。**') >= 0);
  /* **個人の名は書かない**（決めごと 9）。会社と役だけで足りる。 */
  check('個人名を記録しないと書いてある',
    E.indexOf('**個人名は記録しない**') >= 0);
  /* **相手を評価していない。**決めたのは自分の側の規則である。 */
  check('相手についての判定ではないと書いてある',
    E.indexOf('これは相手についての判定ではない**。') >= 0
    && E.indexOf('決めたのは自分の側の規則であって、相手の性質ではない') >= 0
    && E.indexOf('**返信していない。**') >= 0);
  /* **登録の審査は、中身の審査ではない。**推薦でないことを書くなら、
   * **何の審査だったかも同じ場所に書く。**でないと、査読の隣に並んで読まれる。 */
  check('researchmap が推薦ではないと書いてある',
    E.indexOf('### 登録の審査 —— **中身の審査ではない**') >= 0
    && E.indexOf('**researchmap の登録は、誰かの推薦で入ったものではない。**') >= 0
    && E.indexOf('**HAL に登録したプレプリントを業績として出し、審査を通っている。**') >= 0);
  check('登録の審査が、中身の審査ではないと書いてある',
    E.indexOf('**論文の中身ではない**。査読でもなければ、受け付けの門でもない。') >= 0
    && E.indexOf('**通ったのは登録の資格であって、書いたものの質ではない。**') >= 0);
  check('登録の審査について、確かめられないことを書いてある',
    E.indexOf('**審査の記録は、こちらから見えない**。') >= 0
    && E.indexOf('検索でも、同姓同名の別人しか出てこない') >= 0
    && E.indexOf('| 根拠 | **証言** |') >= 0);
  {
    /* 正本の一覧の側にも同じ断りがあること。片方だけだと写しが古くなる。 */
    const C = read('cpsbvbng26-dotcom', path.join('docs', 'canonical-sources.md')) || '';
    check('正本の一覧も、推薦でないことを書いている',
      C.indexOf('**推薦ではなく、HAL に登録したプレプリントを業績として出して審査を通っている**') >= 0
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
  }

  /* **相手を調べたなら、調べた順序と等級を書く。**規則が先で調査が後である。
   * **そして、争われている一覧を確定した事実として使わない。** */
  check('調べたのが決めた後だと書いてある',
    E.indexOf('**順序を先に書く。決めたのが先で、調べたのは後である。**') >= 0
    && E.indexOf('調べた結果がどうであれ、決定は変わらない') >= 0);
  check('国・言語・規模・水準が、等級つきで並べてある',
    ['| **国** |', '| **言語** |', '| **規模** |', '| **水準** |']
      .every((x) => E.indexOf(x) >= 0)
    && E.indexOf('**取れていない**。刊行点数も従業員数も') >= 0);
  check('会員として見つからないことが、証明ではないと書いてある',
    E.indexOf('**ただしこれは、会員でないことの証明ではない**。') >= 0
    && E.indexOf('見つからなかった、というだけである') >= 0);
  check('争われている一覧を、確定した事実として使っていない',
    E.indexOf('**そしてこの一覧自体が、学術界で争われているものである**') >= 0
    && E.indexOf('こちらは一覧そのものを読んでいない') >= 0
    && E.indexOf('一覧を作った側の判断であって、確定した事実ではない') >= 0);
  check('どちらとも判定しないと書いてある',
    E.indexOf('**この記録は、どちらとも判定しない**。') >= 0
    && E.indexOf('**並べたのは、出典と等級だけである。**') >= 0);

  /* 引かれた題名が現行の紙面と一致することは、機械で当たれる。 */
  const cff = (read('autonomy-and-self-cultivation', 'CITATION.cff') || '')
    .replace(/\s+/g, ' ');
  const 題 = 'Manifesto of Imperial Selfhood: The Age of Personal Imperialism'
    + ' and Its Spiritual Existence';
  check('引かれた題名が、現行の紙面と一致する',
    E.indexOf('`' + 題 + '`') >= 0 && cff.indexOf(題) >= 0,
    cff.indexOf(題) >= 0 ? '一致' : 'CITATION.cff に無い');
  /* 決めごと 14 が根拠であること。相手の性質ではなく規則で決めている。 */
  check('決めごと 14 を根拠として引いている',
    E.indexOf('**決めごとの 14 番が、この形をそのまま名指ししている。**') >= 0
    && E.indexOf('**無償を謳う勧誘にも応じない**') >= 0);
}

/* **同じ語が三つの別のものに付いている場。**PhilArchive の投稿要件、PhilPapers の
 * 収録作品の区分、PhilPeople の人の区分である。混ざると、載っていることが
 * 審査を通ったことに化ける。**一度そう書いて直している**（SC-027）。
 * ここで見るのは、三つが範囲つきで分かれていることと、区分と審査を分ける一文である。 */

/* **出す先を決めただけでは、出したことにならない。**直近の目標として一つの場を挙げるなら、
 * その場の明文と、いま届いていない分を同じところに書く。**将来の言明は、この場では
 * 根拠にならない**と場の側が明記している（<code>Aspirational statements…</code>）ので、
 * こちらもそれに合わせる。日付は git から取って突き合わせる。 */

console.log('\n7.10 直近の目標（JOSS）');

{
  const J = DECL['直近の目標'];
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
    md.indexOf('**費用の問題ではない**。決めごと 14 は、その六篇について障害になっていない。') >= 0
    && md.indexOf('**不完全なのは開示ではなく、開示できる材料のほうである。**') >= 0);
  check('前の決めと、変えた理由が同じ節にある',
    md.indexOf('**2026-09-15 に決めを変えた**。') >= 0
    && md.indexOf('**前は「開示が書けないから出さない」であった。**') >= 0);
  /* **撤回ではない。**棚から動かさないだけである。ここを落とすと、取り下げに読める。 */
  check('取り下げではないと書いてある',
    md.indexOf('**プレプリントは動かさない**。') >= 0
    && md.indexOf('**取り下げるのではない**。査読誌に出すこととは別である。') >= 0);
  /* **申告と開示は別である。**丸を付けない欄があることを、同じ節に書く。 */
  check('丸を付けない欄があると書いてある',
    md.indexOf('**「文章は実質的に著者自身のものである」という申告には、丸を付けない。**') >= 0);
  /* **六篇の内訳が、実際の篇数と合う。**哲学三篇と Trinity-Infinity 三篇である。 */
  {
    const 数 = (repo) => ((read(repo, 'CITATION.cff') || '').match(/^\s+- type: article$/gm) || []).length;
    const 哲 = 数('autonomy-and-self-cultivation');
    const ti = 数('trinity-infinity');
    check('「六篇」が、哲学三篇と Trinity-Infinity 三篇の和と合う',
      哲 + ti === 6 && md.indexOf('**出すのは六篇である**。') >= 0,
      '哲学 ' + 哲 + ' / Trinity-Infinity ' + ti);
  }

  /* **出すのは全部である**と書いた以上、十のどれも外していないこと。 */
  check('全部出すと書いてあり、届いていない門も同じ文書にある',
    md.indexOf('**出すのは十全部である**。') >= 0
    && md.indexOf('**いちばん早いものでも、六か月を超えていない。**') >= 0
    && md.indexOf('**十とも、著者以外に使われた記録が無い。**') >= 0
    && md.indexOf('**論文と史料ノートは、そもそも software ではない**。') >= 0);

  /* **software でないものの数を、表から数え直す。**
   * 散文に「この五つ」と書いた以上、表の種別と食い違えば落ちる。 */
  {
    const 非 = ['論文', '史料ノート', '覚書'];
    const 行 = md.split('\n').filter((l) => l.startsWith('| ') && l.split('|').length >= 9);
    const n = 行.filter((l) => 非.indexOf(l.split('|')[2].trim()) >= 0).length;
    const 漢 = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
    check('software でないものの数が、表と散文で合う',
      md.indexOf('**この' + 漢 + 'つを出すなら') >= 0,
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
    E.indexOf('既定の一覧に出ることは、門が下りたことではない。**') >= 0
    && E.indexOf('**門は下りていない**（SC-027）') >= 0
    && E.indexOf('一覧に出すかどうかを決める区分と、誰かが読んだかどうかは、別の事柄である') >= 0);

  /* **人の側の条件は二つしか無い。**丸めて書くと、条件が増えたようにも減ったようにも読める。 */
  check('人の側の条件が、二つとも書いてある',
    E.indexOf('**人の側の条件は二つしか無い**。') >= 0
    && E.indexOf('PhilPapers が「最も人気のある」と挙げる') >= 0
    && E.indexOf('**どちらも満たしていない。**') >= 0);
  check('自己分析の学位の行も、同じ二つの条件で書いてある',
    /\| 学位 \|[^|]*\|[^|]*PhilPapers が「最も人気のある」と挙げる雑誌への掲載[^|]*\| \*\*検索で確認\*\*（原典未読） \|/.test(A));

  /* **丸めた言い方に戻していない。**「指定誌」では、どの一覧かが落ちる。 */
  const 丸めた = ['docs/self-assessment.md', 'docs/external-evaluations.md']
    .filter((x) => (read('cpsbvbng26-dotcom', x) || '').indexOf('指定誌') >= 0);
  check('条件を「指定誌」と丸めていない', 丸めた.length === 0, 丸めた.join(', '));

  /* **区分は、推した結果ではなく引いた結果である。**所属で一件出たことを、
   * 区分の証拠に読み替えない。SC-027 と SC-029 が、同じ読み替えの記録である。 */
  check('人の側の区分を、画面で引いた結果として書いてある',
    E.indexOf('**人の側の区分は、あとから画面で確かめている。区分は non-pro である。**') >= 0
    && E.indexOf('non-pro を**含める**設定にすると、所属（`ZEN大学`）で引いて出る') >= 0
    && E.indexOf('**所属で出たことは、区分を覆さない**。分けているのは設定のほうである。') >= 0
    && E.indexOf('**根拠は著者の画面であって、こちらは見ていない**（**証言**）') >= 0);

  /* **明文を読んでいないことを、読んだように書かない。**三つとも検索から写している。 */
  check('原典を読んでいないと書いてある',
    E.indexOf('**明文の三つも、検索の結果から写している。原典の頁は読んでいない。**') >= 0
    && E.indexOf('egress proxy が `connect_rejected` を返す') >= 0
    && E.indexOf('**だから、この節が言えるのは区分の存在までである**。') >= 0);
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
  check('一覧に未確認の番号が残っている',
    idx.indexOf(Z['未確認の番号']) >= 0, Z['未確認の番号']);
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
      && err.indexOf('一件も落ちなかった') >= 0);
    /* **弁明にしない一行。**ここが消えると、測ったことが言い訳に転じる。 */
    check('E8 が、これは弁明ではないと書いている',
      err.indexOf('**ただし、これは弁明ではない。**') >= 0);
    /* **PDF を直していないことを書いてある。** */
    check('E8 が、直したのは正誤表のほうだと書いている',
      err.indexOf('**PDF は直していない**') >= 0);
  }
}

/* この検査自身が名乗る件数も、実際と合わせる。
 * 実際に一度ずれている —— 中身を足したのに 62 のまま残っていた。
 * 自分を走らせるわけにはいかないので、ここまでの件数に自分の一件を足して数える。 */

console.log('\n13. この検査が名乗る件数');

{
  const total = passed + failures.length + 1;
  const claims = [
    ['README.md', /10 リポジトリ横断 (\d+) 項目/],
    ['.github/workflows/ecosystem.yml', /10 リポジトリ横断 (\d+) 項目/],
    ['.claude/commands/check.md', /横断のずれ（(\d+) 項目）/],
    ['.claude/commands/開始.md', /check_ecosystem\.js`（(\d+) 項目）/],
    ['docs/self-assessment.md', /横断 \*\*(\d+) 項目\*\*/]
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
