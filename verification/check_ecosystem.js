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
                   ['7358779', '10.2139/ssrn.7358779']];
    const wrong = pairs.filter(([id, doi]) => {
      const row = plum.split('\n').find((l) => l.indexOf('ssrn_id=' + id) >= 0);
      return !row || row.indexOf(doi) < 0;
    }).map(([id]) => id);
    check('PlumX の宛先が、対応する SSRN の DOI と同じ行にある',
      wrong.length === 0, wrong.length ? ('ずれ: ' + wrong.join(', ')) : pairs.length + ' 件');
    const digits = /PlumX[^\n]*?[:：]\s*\d|閲覧\s*\d|ビュー\s*\d|保存\s*\d|言及\s*\d/;
    check('PlumX の数値が転記されていない', !digits.test(plum));

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
