/* 外部リンクの切れを、月に一度数える。
 *
 *   node verification/linkcheck.js
 *
 * **外へ出る検査である。**だから check_site.js や check_ecosystem.js には混ぜない。
 * CI では .github/workflows/linkcheck.yml が月に一度回し、結果を issue 一つにまとめる。
 *
 * 2026-11-11 に一度だけ手で回した確認（枝 claude/linkcheck-run-1111 の .linkcheck/check.js）を、
 * 定期の見張りにしたもの。そのときは URL の一覧を手で作って枝に置いた。ここでは走らせるたびに
 * リポジトリを複製し、その中身から URL を集める。一覧を置かないので、古くならない。
 *
 * **開くのは、下の OPEN に挙げた場だけである**（2026-11-12、三度目の見落としから）。それまでは、機械での利用を
 * 断る場を一つずつ外す形（断りの一覧）だった。外し忘れた場（philpapers.org・philarchive.org・elsevier.support）を
 * 月に一度開き続けていた。向きを逆にした。ほかの場は開かず、「機械では確かめていない」として場ごとの数を出す。
 *
 * 切れとして挙げるのは 404・410 と、名前が引けないもの（DNS）だけである。
 * **403 と 429 は「止められた」であって「切れた」ではない。**機械からの読み込みを断る場は多い。
 * 止められたもの、時間切れ、5xx は、別の欄に数だけ出す。どれも CI を落とさない。
 *
 * 環境変数
 *   LINKCHECK_OWNER   リポジトリの持ち主（既定 cpsbvbng26-dotcom）。公開のリポジトリをすべて見る
 *   LINKCHECK_REPOS   見るリポジトリを名指すとき（読点ではなくコンマで区切る）
 *   LINKCHECK_DIR     複製せずに、この下に並んだリポジトリを読む（手元で試すとき）
 *   LINKCHECK_ISSUE   1 なら、GITHUB_TOKEN と GITHUB_REPOSITORY を使って issue を立てるか直す
 *   LINKCHECK_ONLY    この文字列を含む URL だけを開く（手元で試すとき）
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OWNER = process.env.LINKCHECK_OWNER || 'cpsbvbng26-dotcom';
const TOKEN = process.env.GITHUB_TOKEN || '';
const MARK = '<!-- linkcheck:monthly -->';
const TITLE = '外部リンクの切れ（月に一度の確認）';
/* 名乗り。ブラウザの名を借りない（2026-11-12、三度目の見落とし。それまでは Mozilla/5.0 を頭に付けていた）。
 * どのリポジトリの、どの仕事かを書く。 */
const UA = 'cpsbvbng26-dotcom-linkcheck/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/blob/main/verification/linkcheck.js)';

const TEXT = new Set(['.md', '.html', '.json', '.yml', '.yaml', '.cff', '.txt', '.toml', '.py', '.js', '.bib', '.xml', '.tex', '.csv']);
const SKIPDIR = new Set(['.git', 'node_modules', '__pycache__', 'venv', '.venv', 'dist']);

async function api(p, opts) {
  const r = await fetch('https://api.github.com' + p, Object.assign({
    headers: Object.assign({ Accept: 'application/vnd.github+json', 'User-Agent': UA },
      TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}),
  }, opts || {}));
  if (!r.ok) throw new Error('GitHub API ' + p + ' → ' + r.status);
  return r.json();
}

/* ------------------------------------------------------------ 集める */

async function repoNames() {
  if (process.env.LINKCHECK_REPOS) return process.env.LINKCHECK_REPOS.split(',').map((x) => x.trim()).filter(Boolean);
  if (process.env.LINKCHECK_DIR) {
    return fs.readdirSync(process.env.LINKCHECK_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(process.env.LINKCHECK_DIR, e.name, '.git')))
      .map((e) => e.name).sort();
  }
  const list = await api('/users/' + OWNER + '/repos?per_page=100&type=owner');
  return list.filter((r) => !r.fork && !r.archived && !r.private).map((r) => r.name).sort();
}

function checkout(names) {
  if (process.env.LINKCHECK_DIR) return { root: process.env.LINKCHECK_DIR, names };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'linkcheck-'));
  const ok = [];
  for (const n of names) {
    try {
      execFileSync('git', ['clone', '--quiet', '--depth', '1', 'https://github.com/' + OWNER + '/' + n + '.git', path.join(root, n)],
        { stdio: 'pipe' });
      ok.push(n);
    } catch (e) {
      console.log('複製できなかった: ' + n);
    }
  }
  return { root, names: ok };
}

/* URL の終わりに付いてくる句読点と括弧を落とす。囲みの中の見本（{doi} など）は数えない。 */
function clean(u) {
  let x = u.replace(/&amp;/g, '&');
  for (;;) {
    const y = x.replace(/[.,;:!?'"*_]+$/, '');
    if (/\)$/.test(y) && (y.match(/\(/g) || []).length < (y.match(/\)/g) || []).length) { x = y.slice(0, -1); continue; }
    if (/[\]}>]$/.test(y)) { x = y.slice(0, -1); continue; }
    if (y === x) break;
    x = y;
  }
  return x;
}
/* 数える URL か。見本・試験用の接頭辞・API の入口・名前空間の識別子は、読み手が開く頁ではないので数えない。 */
function link(u) {
  if (/[{}…$<>\\]|%s|\*/.test(u)) return false;
  let h;
  try { h = new URL(u).hostname; } catch (e) { return false; }
  if (!h || h.indexOf('.') < 0) return false;
  if (/(^|\.)(example\.(org|com|net)|localhost|invalid|test)$/.test(h) || /^127\.|^0\.0\.0\.0$/.test(h)) return false;
  /* API の入口は、道具が問い合わせる先であって、読み手が開く頁ではない。
   * 10.5072 は DataCite の試験用の接頭辞で、道具の見本と試験にしか出てこない。 */
  if (/^api\./.test(h) || /10\.5072(\/|%2F)/i.test(u)) return false;
  /* 名前空間の識別子であって、開く頁ではないもの。 */
  if (/^https?:\/\/www\.w3\.org\/(2000|1999|1998|XML)\//.test(u)) return false;
  return true;
}

/* 機械で開く場（許す一覧）。2026-11-12 の続き：三度目の見落とし。ここに無い場は開かない。
 * 一つの場ごとに、開いてよいとした理由を持つ。理由は三つのどれかである。
 *   自分の場     このプロジェクト自身が配っている頁と、運営者のリポジトリ。
 *   DOI の解決   doi.org。転送の先が許す一覧に無ければ、そこで止める（先は開かない）。
 *   規約         取り寄せた利用規約が、機械での利用そのものを禁じていない場。頼った句と、取り寄せた所在・日・SHA-256 を添える。
 * path を持つ行は、その道の下だけを許す（github.com のほかの持ち主のリポジトリは開かない）。 */
const OPEN = [
  { host: 'cpsbvbng26-dotcom.vercel.app', why: '自分の場', note: 'このリポジトリの頁を配っている（verification/sites.json）' },
  { host: 'golden-window-conjecture.vercel.app', why: '自分の場', note: 'trinity-operator の site/ を配っている（verification/sites.json）' },
  { host: 'sophaxis.vercel.app', why: '自分の場', note: 'sophaxis の site/ を配っている（verification/sites.json）' },
  { host: 'nusquama.vercel.app', why: '自分の場', note: 'nusquama の site/ を配っている（nusquama の README）' },
  { host: 'cpsbvbng26-dotcom.github.io', why: '自分の場', note: '運営者の GitHub Pages' },
  { host: 'github.com', path: '/cpsbvbng26-dotcom', why: '自分の場',
    note: '運営者のリポジトリの頁だけ。GitHub の Acceptable Use Policies（https://github.com/github/site-policy の '
      + 'Policies/acceptable-use-policies/github-acceptable-use-policies.md、コミット b9578b5、2026-11-12 取得、SHA-256 6ff940ad…）は '
      + '"using our servers for any form of excessive automated bulk activity, to place undue burden on our servers through automated means" を禁じる。'
      + '月に一度、自分のリポジトリの頁を一度ずつ開くことは、これに当たらないとした' },
  { host: 'raw.githubusercontent.com', path: '/cpsbvbng26-dotcom', why: '自分の場', note: '運営者のリポジトリの生のファイルだけ。理由は github.com と同じ' },
  { host: 'doi.org', why: 'DOI の解決', note: '番号が解決するかを見る。転送の先が許す一覧に無ければ、そこで止める' },
  { host: 'dx.doi.org', why: 'DOI の解決', note: 'doi.org の旧い名。扱いは doi.org と同じ' },
  { host: 'zenodo.org', why: '規約',
    note: 'Zenodo の Terms of Use v1.3（https://about.zenodo.org/terms/、2026-11-12 取得、SHA-256 3c2c8336…）に機械での利用を禁じる句は無い。'
      + '頼った句は "Access to Zenodo’s content is open to all, for non-military purposes only." と、CERN が '
      + '"to restrict or remove User access where it considers that use of Zenodo interferes with its operations" とする句' },
  { host: 'orcid.org', why: '規約',
    note: 'ORCID の Terms and Conditions of Use（https://info.orcid.org/terms-of-use/、2026-11-12 取得、SHA-256 77ea95c9…）は、'
      + '"You may not use the Websites or Registry in any way that damages, disables, overburdens or impairs the operation of the Websites or Registry including, without limitation, through the use of bots." と書く。'
      + '禁じるのは負荷を掛けることで、機械での利用そのものではない' },
  { host: 'info.orcid.org', why: '規約',
    note: '規約は info.orcid.org にあり（https://info.orcid.org/terms-of-use/、2026-11-12 取得、SHA-256 77ea95c9…）、'
      + '"certain Websites at the orcid.org URL (\u201cWebsites\u201d)" に掛かる。頼った句と理由は orcid.org と同じ' },
];

/* 断りの一覧。許す一覧に入っていても、ここに当たれば開かない（DOI の転送の先を含む）。
 * 許す一覧に無い場はもともと開かないので、これは二重の止めである。名指して止める場を、一覧の形で残しておく。
 *   ssrn.com          利用規約が "or otherwise send automated queries of any sort to SSRN" を禁じる（Sophaxis の sources-raw.json の pages.ssrn-terms）
 *   elsevier.support  SSRN の支援の頁の置き場。取り寄せた頁（pages.ssrn-nonscholarly）は "All rights are reserved, including those for
 *                     text and data mining, AI training, and similar technologies." と書く。場の利用規約は取り寄せていない
 *   philpapers.org    利用規約 第 9 項が、OAI-PMH の口の外からの "Download or redistribution of substantive parts" を、書面の同意なしに禁じる（pages.philpapers-terms、SHA-256 97be7037…）
 *   philarchive.org   FAQ が "The general PhilPapers Foundation term and conditions apply regarding scraping" と書く（pages.philarchive-faq、SHA-256 781829dc…）
 *   edx.org・datacite.org・scholar.google.com・academia.edu・researchgate.net は、2026-11-12 の続き（見落としていたもの）の行のとおり
 * philpapers.org・philarchive.org・elsevier.support は、三度目の見落としで足した。それまでは月に一度開いていた。
 * SSRN と ResearchGate の DOI は、doi.org にも問い合わせない（転送の先がそこなので）。 */
const CLOSED = /(^|\.)(ssrn\.com|elsevier\.support|philpapers\.org|philarchive\.org|edx\.org|datacite\.org|scholar\.google\.com|academia\.edu|researchgate\.net)$/i;
function closed(u) {
  let h;
  try { h = new URL(u).hostname; } catch (e) { return false; }
  return CLOSED.test(h) || /10\.2139(\/|%2F)ssrn/i.test(u) || /10\.13140(\/|%2F)rg\./i.test(u);
}

/* 許す一覧のどの行に当たるか。当たらなければ null。 */
function allowed(u) {
  let x;
  try { x = new URL(u); } catch (e) { return null; }
  if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
  const h = x.hostname.toLowerCase();
  const p = x.pathname.toLowerCase();
  return OPEN.find((o) => o.host === h && (!o.path || p === o.path || p.startsWith(o.path + '/'))) || null;
}

/* 機械で開くか。数える URL で、許す一覧にあり、断りの一覧に当たらないものだけ。 */
function usable(u) {
  return link(u) && allowed(u) !== null && !closed(u);
}

function collect(root, names) {
  const where = new Map();
  for (const repo of names) {
    const base = path.join(root, repo);
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIPDIR.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!TEXT.has(path.extname(e.name))) continue;
        let text;
        try { text = fs.readFileSync(full, 'utf8'); } catch (err) { continue; }
        if (text.length > 5e6) continue;
        for (const m of text.matchAll(/https?:\/\/[^\s"'`<>|^\\]+/g)) {
          const u = clean(m[0]);
          if (!link(u)) continue;
          const at = repo + '/' + path.relative(base, full);
          if (!where.has(u)) where.set(u, new Set());
          where.get(u).add(at);
        }
      }
    };
    if (fs.existsSync(base)) walk(base);
  }
  return where;
}

/* ------------------------------------------------------------ 確かめる */

const DNS = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EAI_NONAME', 'EAI_NODATA']);

async function probe(u) {
  let last = null;
  for (const method of ['HEAD', 'GET']) {
    try {
      /* 転送は手で辿る。行き先が許す一覧に無ければ（usable でなければ）、そこで止めて転送の応答を結果にする。 */
      let r = null;
      let at = u;
      for (let hop = 0; hop < 10; hop++) {
        r = await fetch(at, { method, redirect: 'manual',
          headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
          signal: AbortSignal.timeout(30000) });
        const loc = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
        if (!loc) break;
        const next = new URL(loc, at).href;
        if (!usable(next)) break;
        if (r.body) { try { await r.body.cancel(); } catch (e) { /* 読み捨て */ } }
        at = next;
      }
      /* HEAD を断る場がある。GET で確かめ直す。 */
      if (method === 'HEAD' && (r.status === 405 || r.status === 403 || r.status === 404 || r.status === 410 || r.status >= 500)) {
        last = { status: r.status }; continue;
      }
      if (r.body) { try { await r.body.cancel(); } catch (e) { /* 読み捨て */ } }
      return { status: r.status };
    } catch (e) {
      last = { status: 0, error: String((e.cause && e.cause.code) || e.name || e.message) };
    }
  }
  return last;
}

async function check(u) {
  let r = await probe(u);
  /* 名前が引けないのは、一時のこともある。少し待って一度だけ引き直す。 */
  if (r.status === 0 && DNS.has(r.error)) {
    await new Promise((ok) => setTimeout(ok, 5000));
    r = await probe(u);
  }
  return r;
}

function kind(r) {
  if (r.status === 404 || r.status === 410) return 'broken';
  if (r.status === 0 && DNS.has(r.error)) return 'broken';
  if (r.status === 403 || r.status === 429 || r.status === 999) return 'blocked';
  if (r.status >= 200 && r.status < 400) return 'ok';
  return 'unsure';
}

/* ------------------------------------------------------------ 書く */

function report(names, results, skipped) {
  const by = (k) => results.filter((x) => x.kind === k);
  const broken = by('broken'), blocked = by('blocked'), unsure = by('unsure');
  const at = (x) => [...x.where].slice(0, 5).map((w) => '`' + w + '`').join('、')
    + (x.where.size > 5 ? ' ほか ' + (x.where.size - 5) + ' 箇所' : '');
  const why = (x) => x.r.status ? String(x.r.status) : (x.r.error || '応答なし');
  const lines = [
    MARK,
    '月に一度、公開のリポジトリを複製して、その中の外部リンクを開いた結果です。',
    'リポジトリ ' + names.length + ' 本、開いた URL ' + results.length + ' 件。'
      + '切れ ' + broken.length + ' 件、止められた ' + blocked.length + ' 件、確かめきれない ' + unsure.length + ' 件。'
      + '機械では確かめていない URL ' + skipped.length + ' 件。',
    '',
    '開くのは、`verification/linkcheck.js` の許す一覧（OPEN）にある場だけです。自分の場、doi.org、取り寄せた利用規約が機械での利用を禁じていない場です。ほかの場は開いていません。',
    '',
    '切れとして挙げるのは 404・410 と、名前が引けないもの（DNS）だけです。403 と 429 は止められたのであって、切れたのではありません。',
    '',
    '## 切れ（404・410・DNS）',
    '',
  ];
  if (!broken.length) lines.push('ありませんでした。');
  else {
    lines.push('| URL | 結果 | 書いてある場所 |', '| --- | --- | --- |');
    broken.forEach((x) => lines.push('| ' + x.u + ' | ' + why(x) + ' | ' + at(x) + ' |'));
  }
  lines.push('', '<details><summary>止められたもの（' + blocked.length + ' 件）と、確かめきれないもの（' + unsure.length + ' 件）</summary>', '');
  blocked.concat(unsure).forEach((x) => lines.push('- ' + why(x) + ' ' + x.u));
  lines.push('', '</details>');
  const hosts = new Map();
  skipped.forEach((u) => { let h = ''; try { h = new URL(u).hostname; } catch (e) { h = '?'; } hosts.set(h, (hosts.get(h) || 0) + 1); });
  lines.push('', '<details><summary>機械では確かめていないもの（' + skipped.length + ' 件、' + hosts.size + ' の場）</summary>', '',
    '許す一覧に無い場の URL です。開いていないので、切れているかどうかは分かりません。', '');
  [...hosts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).forEach(([h, n]) => lines.push('- ' + h + '（' + n + ' 件）'));
  lines.push('', '</details>', '', '生成: `verification/linkcheck.js`（' + new Date().toISOString().slice(0, 10) + '）');
  return { body: lines.join('\n'), broken };
}

async function upsertIssue(body, brokenCount) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !TOKEN) { console.log('GITHUB_TOKEN か GITHUB_REPOSITORY が無いので、issue は触らない。'); return; }
  let found = null;
  for (let page = 1; page <= 5 && !found; page++) {
    const list = await api('/repos/' + repo + '/issues?state=all&per_page=100&page=' + page);
    found = list.find((i) => !i.pull_request && (i.body || '').indexOf(MARK) === 0) || null;
    if (list.length < 100) break;
  }
  const state = brokenCount ? 'open' : 'closed';
  if (found) {
    await api('/repos/' + repo + '/issues/' + found.number, {
      method: 'PATCH', body: JSON.stringify({ title: TITLE, body, state }) });
    console.log('issue #' + found.number + ' を直した（' + state + '）');
  } else if (brokenCount) {
    const made = await api('/repos/' + repo + '/issues', { method: 'POST', body: JSON.stringify({ title: TITLE, body }) });
    console.log('issue #' + made.number + ' を立てた');
  } else {
    console.log('切れは無く、立てる issue も無い。');
  }
}

module.exports = { usable, closed, allowed, link, collect, probe, OPEN, CLOSED, UA };
if (require.main === module) (async () => {
  const names0 = await repoNames();
  const { root, names } = checkout(names0);
  const where = collect(root, names);
  const all = [...where.keys()].sort().filter((u) => !process.env.LINKCHECK_ONLY || u.indexOf(process.env.LINKCHECK_ONLY) >= 0);
  const urls = all.filter(usable);
  const skipped = all.filter((u) => !usable(u));
  console.log('リポジトリ ' + names.length + ' 本から URL ' + all.length + ' 件を集めた。開くのは ' + urls.length + ' 件、機械では確かめないのは ' + skipped.length + ' 件。');
  const results = [];
  for (let i = 0; i < urls.length; i += 8) {
    const part = await Promise.all(urls.slice(i, i + 8).map(async (u) => {
      const r = await check(u);
      return { u, r, kind: kind(r), where: where.get(u) };
    }));
    results.push(...part);
  }
  const { body, broken } = report(names, results, skipped);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body + '\n');
  console.log(body);
  if (process.env.LINKCHECK_ISSUE === '1') await upsertIssue(body, broken.length);
  /* **切れも止められたものも、CI を落とさない。**知らせる先は issue である。 */
})().catch((e) => {
  console.error('リンクの確認が走りきらなかった: ' + e.message);
  process.exit(1);
});

