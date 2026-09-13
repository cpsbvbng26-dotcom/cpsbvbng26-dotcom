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
    check('貢献 0 と到達を、分けて書いてある',
      text.indexOf('新しい結果としての貢献は 0 である') >= 0
      && text.indexOf('新しい数学は無い') >= 0
      && text.indexOf('**だが「貢献」は一つの軸ではない。**') >= 0
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

    /* **研究の外の等級は、この体系で唯一、他人が出しているものである。**
     * だから書く値打ちがあり、だからこそ増やす誘惑がある。
     * **段が一つも無いこと、根拠が全部「証言」であること、年数を書かないこと** ——
     * この三つが落ちた瞬間に、欄は肩書きの並びに変わる。
     * **膨らませる手は年数のほうである** —— 年数は審査を経ていないのに、
     * 先に置けば上の段にいるように読める。書かないことを機械で押さえる。 */
    {
      const 漢 = '〇一二三四五六七八九十'.split('');
      const 見出し = '| 等級 | 出しているもの | 根拠 |';
      const i = text.indexOf(見出し);
      const lines = i < 0 ? [] : text.slice(i).split('\n');
      const 行 = [];
      for (let k = 2; k < lines.length; k++) {
        if (!/^\|/.test(lines[k])) break;
        行.push(lines[k].split('|').slice(1, -1).map((c) => c.trim()));
      }
      const n = 行.length;
      check('研究の外の等級の数が、表から数え直したものと合う',
        n > 0 && n < 漢.length
        && text.indexOf('**' + 漢[n] + 'つとも級である。段は一つも無い。**') >= 0
        && text.indexOf('この' + 漢[n] + 'つしかない') >= 0
        && text.indexOf('そして' + 漢[n] + 'つとも下の段である') >= 0,
        n + ' 行');
      const 段 = 行.filter((r) => /段/.test(r[0])).map((r) => r[0]);
      check('等級に段位が混ざっていない', n > 0 && 段.length === 0,
        段.length ? 段.join(' / ') : (n + ' 行すべて級'));
      const 根拠 = [...new Set(行.map((r) => r[2]))];
      check('等級の根拠が、表でも散文でもすべて証言である',
        根拠.length === 1 && 根拠[0] === '証言'
        && text.indexOf('根拠はすべて `証言` である') >= 0
        && text.indexOf('免状または認定状を指せるようになれば `紙面` に上がる') >= 0,
        根拠.join(' / '));
    }
    check('等級が、著者が書いた記録ではないと書いてある',
      text.indexOf('この体系で唯一、**著者が書いた記録ではない**') >= 0
      && text.indexOf('他人が判定して、他人が出している') >= 0);
    check('稽古や対局の年数を書いていない',
      text.indexOf('稽古や対局の年数は書かない') >= 0
      && text.indexOf('年数は審査を経ていない') >= 0
      && !/(合氣道|合気道|稽古|通算|囲碁|将棋|対局)[^。\n]{0,30}[0-9０-９〇一二三四五六七八九十]+\s*年/
            .test(text));

    /* **査読 0 篇は、この文書の土台である。**ここが動けば全部動く。 */
    check('査読を通った論文が 0 篇だと書いてある',
      text.indexOf('| 査読を通った論文 | 学術誌・学会 | **0 篇** |') >= 0
      && text.indexOf('低い段にいるのではなく、段に乗っていない') >= 0);
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

/* この検査自身が名乗る件数も、実際と合わせる。
 * 実際に一度ずれている —— 中身を足したのに 62 のまま残っていた。
 * 自分を走らせるわけにはいかないので、ここまでの件数に自分の一件を足して数える。 */

console.log('\n13. この検査が名乗る件数');

{
  const total = passed + failures.length + 1;
  const claims = [
    ['README.md', /9 リポジトリ横断 (\d+) 項目/],
    ['.github/workflows/ecosystem.yml', /9 リポジトリ横断 (\d+) 項目/],
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
