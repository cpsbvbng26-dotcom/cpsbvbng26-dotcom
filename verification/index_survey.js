/* 索引の網羅調査。月に一度、GitHub Actions が回す（.github/workflows/index-survey.yml）。
 *
 *     node verification/index_survey.js --out survey.json     # 外へ出る。結果を JSON と要約に書く
 *     node verification/index_survey.js --self-test           # 外へ出ない。判定の部品だけを確かめる
 *
 * 2026-11-11 に、マージしない枝（claude/linkcheck-run-1111）の .indexcheck/run.js で一度だけ回した調べを、
 * 定期の仕事に移したもの。結果は main に書かない。Actions の要約と成果物にだけ残す。
 *
 * 番号は docs/doi-index.md の表から読む。ここに番号を書き写さない（書き写せば、一覧と二つになってずれる）。
 *
 * 判定は四つに分ける。載っている / 載っていない / 確かめていない / 落ちた。
 * 「載っていない」は、その場が 404 か、件数 0 を答えたときだけ。通信の失敗と 4xx・5xx は「落ちた」。
 *
 * DOAPR は検索の頁が Cloudflare の確かめの頁を返す。前の調べは、その頁に入っていた
 * 問い合わせの語（sophaxis）を拾って「載っている」と出した。誤りである。
 * DOAPR は GitHub の antleaf/doapr のデータと、申請の issue（#105）の状態で見る。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ORCID = '0009-0000-1406-0547';
const WIKIDATA = 'Q139590485';
const DOAPR_REPO = 'antleaf/doapr';
const DOAPR_ISSUE = 105;
const UA = 'index-survey/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom)';

const 載 = '載っている';
const 無 = '載っていない';
const 未 = '確かめていない';
const 落 = '落ちた';

/* ---------- 番号を doi-index.md の表から読む ---------- */

/* 表の行（| で始まる行）にある番号だけを取る。散文の中の番号は一覧ではない。
 * 第三者の番号と、実在しない番号の節は外す。 */
function doisFromIndex(text) {
  const 外す = ['## 第三者の SSRN DOI', '## 実在しない番号'];
  const RE = /10\.5281\/zenodo\.\d+|10\.2139\/ssrn\.\d+|10\.6084\/m9\.figshare\.\d+|10\.17605\/osf\.io\/[a-z0-9]+/gi;
  const works = new Map();
  let skip = false;
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) skip = 外す.some((h) => line.indexOf(h) === 0);
    if (skip || line.indexOf('|') !== 0) continue;
    for (const m of line.match(RE) || []) {
      const d = m.toLowerCase();
      if (!works.has(d)) works.set(d, { doi: d, concept: false });
      /* 番号が行の最初の DOI のときだけ、その行の説明で概念 DOI かを決める。 */
      const first = (line.match(RE) || [])[0];
      if (first && first.toLowerCase() === d && /概念 DOI/.test(line)) works.get(d).concept = true;
    }
  }
  return [...works.values()];
}

/* ---------- 判定 ---------- */

function judgeStatus(status) {
  if (status === 404) return 無;
  if (status === 0 || status >= 400) return 落;
  return null;
}

/* DOAPR。issue が閉じて完了なら載った。開いていれば審査待ち。
 * データの中に名があれば載っている。どれも取れなければ「確かめていない」。
 * **検索の頁の本文は見ない。**確かめの頁にも問い合わせの語が入る。 */
function judgeDoapr(issue, codeHits) {
  if (codeHits !== null && codeHits > 0) return { state: 載, note: 'データに Sophaxis の項目がある' };
  if (!issue) return { state: 未, note: 'issue を読めなかった' };
  if (issue.state === 'closed' && issue.state_reason === 'completed') return { state: 載, note: '申請の issue が完了で閉じた' };
  if (issue.state === 'closed') return { state: 無, note: '申請の issue が閉じた（' + (issue.state_reason || '理由なし') + '）' };
  return { state: 未, note: '申請の issue は開いている（審査待ち、コメント ' + issue.comments + ' 件）' };
}

/* ---------- 通信 ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, headers = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      let b = null;
      try { b = JSON.parse(t); } catch (e) { b = null; }
      if (r.status === 429 && i < tries - 1) { await sleep(5000 * (i + 1)); continue; }
      return { s: r.status, b };
    } catch (e) {
      if (i === tries - 1) return { s: 0, b: null, e: String((e.cause && e.cause.code) || e.message) };
      await sleep(2000);
    }
  }
  return { s: 0, b: null };
}

async function survey() {
  const dois = doisFromIndex(fs.readFileSync(path.join(ROOT, 'docs', 'doi-index.md'), 'utf8'));
  const out = { at: new Date().toISOString(), dois: dois.length, works: {}, author: {}, doapr: null };

  for (const w of dois) {
    const row = { concept: w.concept };
    let r = await get('https://api.openalex.org/works/doi:' + w.doi);
    row.openalex = r.s === 200
      ? { state: 載, id: r.b.id, authors: (r.b.authorships || []).map((a) => a.author && a.author.id).filter(Boolean), abstract: !!r.b.abstract_inverted_index }
      : { state: judgeStatus(r.s) || 落, http: r.s };
    await sleep(250);
    r = await get('https://api.semanticscholar.org/graph/v1/paper/DOI:' + w.doi + '?fields=title,citationCount');
    row.semanticscholar = r.s === 200 ? { state: 載, cited: r.b.citationCount } : { state: judgeStatus(r.s) || 落, http: r.s };
    await sleep(1500);
    r = await get('https://api.openaire.eu/search/researchProducts?doi=' + encodeURIComponent(w.doi) + '&format=json');
    if (r.s === 200) {
      const n = Number(((((r.b || {}).response || {}).header || {}).total || {}).$);
      row.openaire = Number.isFinite(n) ? { state: n > 0 ? 載 : 無, total: n } : { state: 落, http: r.s };
    } else row.openaire = { state: judgeStatus(r.s) || 落, http: r.s };
    r = await get('https://opencitations.net/index/api/v2/citation-count/doi:' + w.doi);
    row.opencitations = r.s === 200 && Array.isArray(r.b) ? { state: 載, count: Number((r.b[0] || {}).count || 0) } : { state: judgeStatus(r.s) || 落, http: r.s };
    out.works[w.doi] = row;
  }

  const a = out.author;
  let r = await get('https://api.openalex.org/authors?filter=orcid:' + ORCID);
  a.openalex = r.s === 200 ? { ids: r.b.results.map((x) => ({ id: x.id, works: x.works_count })) } : { state: 落, http: r.s };
  r = await get('https://pub.orcid.org/v3.0/' + ORCID + '/works');
  a.orcid = r.s === 200 ? { works: (r.b.group || []).length } : { state: 落, http: r.s };
  r = await get('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent('SELECT ?w WHERE { ?w wdt:P50 wd:' + WIKIDATA + ' }'), { Accept: 'application/sparql-results+json' });
  a.wikidataWorks = r.s === 200 ? { works: r.b.results.bindings.length } : { state: 落, http: r.s };
  r = await get('https://api.datacite.org/dois?query=' + encodeURIComponent('creators.name:"Nemoto, Takuya"') + '&page[size]=200');
  if (r.s === 200) {
    const others = r.b.data.filter((x) => JSON.stringify(x.attributes.creators).indexOf(ORCID) < 0);
    a.datacite = { total: r.b.meta.total, others: others.length };
  } else a.datacite = { state: 落, http: r.s };

  /* DOAPR は GitHub から。鍵は Actions が渡す GITHUB_TOKEN（読むだけ）。 */
  const gh = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) gh.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const iss = await get('https://api.github.com/repos/' + DOAPR_REPO + '/issues/' + DOAPR_ISSUE, gh);
  const code = await get('https://api.github.com/search/code?q=' + encodeURIComponent('sophaxis repo:' + DOAPR_REPO), gh);
  const hits = code.s === 200 ? Number(code.b.total_count) : null;
  out.doapr = Object.assign({ issue: iss.s === 200 ? { state: iss.b.state, state_reason: iss.b.state_reason, comments: iss.b.comments } : { http: iss.s }, codeHits: hits },
    judgeDoapr(iss.s === 200 ? iss.b : null, hits));
  return out;
}

/* ---------- 要約 ---------- */

function summary(out) {
  const L = [];
  L.push('## 索引の網羅調査（' + out.at.slice(0, 10) + '）', '');
  L.push('番号は docs/doi-index.md の表から ' + out.dois + ' 件。「確かめていない」と「落ちた」を「載っていない」と読まない。', '');
  const keys = ['openalex', 'semanticscholar', 'openaire', 'opencitations'];
  L.push('| 索引 | ' + [載, 無, 未, 落].join(' | ') + ' |', '| --- | --- | --- | --- | --- |');
  for (const k of keys) {
    const c = (s) => Object.values(out.works).filter((w) => w[k] && w[k].state === s).length;
    L.push('| ' + k + ' | ' + [載, 無, 未, 落].map(c).join(' | ') + ' |');
  }
  const noAuthor = Object.values(out.works).filter((w) => w.openalex && w.openalex.state === 載 && !w.openalex.authors.length).length;
  L.push('', '| 著者の側 | 値 |', '| --- | --- |');
  L.push('| OpenAlex で著者の付いていない記録 | ' + noAuthor + ' |');
  L.push('| OpenAlex の著者の ID（ORCID iD で引いた数） | ' + (out.author.openalex.ids ? out.author.openalex.ids.length : '落ちた') + ' |');
  L.push('| ORCID の作品 | ' + (out.author.orcid.works !== undefined ? out.author.orcid.works : '落ちた') + ' |');
  L.push('| Wikidata の作品の項目 | ' + (out.author.wikidataWorks.works !== undefined ? out.author.wikidataWorks.works : '落ちた') + ' |');
  L.push('| DataCite の同名の別人の記録 | ' + (out.author.datacite.others !== undefined ? out.author.datacite.others : '落ちた') + ' |');
  L.push('| DOAPR | ' + out.doapr.state + '（' + out.doapr.note + '） |');
  return L.join('\n') + '\n';
}

/* ---------- 自分を確かめる（外へ出ない） ---------- */

function selfTest() {
  let pass = 0;
  const bad = [];
  const ok = (label, cond) => { if (cond) pass++; else bad.push(label); };

  /* 見本の番号は組み立てて作る。この文書に番号の形のまま書くと、横断の検査が一覧に無い番号として拾う。 */
  const Z = (n) => ['10.5281', 'zenodo.' + n].join('/');
  const S = (n) => ['10.2139', 'ssrn.' + n].join('/');
  const O = (n) => ['10.17605', 'OSF.IO', n].join('/');
  const sample = [
    '## 著者自身の Zenodo DOI', '| 1 | `' + Z(11) + '` | 作品 | 現行 |',
    '| R2 | `' + Z(12) + '` | 全版 | 概念 DOI。いちばん新しい版を指す |',
    '散文の `' + Z(13) + '` は一覧ではない。',
    '| 論文 | `' + Z(11) + '` | SSRN `' + S(14) + '` |',
    '| O1 | `' + O('ABCDE') + '` | 束ね | 現行 |',
    '## 第三者の SSRN DOI', '| `' + S(15) + '` | 他人 | x |',
    '## 実在しない番号', '| `' + Z(16) + '` | 見本 |',
  ].join('\n');
  const got = doisFromIndex(sample);
  const ids = got.map((x) => x.doi);
  ok('表の行の番号を取る', ids.includes(Z(11)) && ids.includes(S(14)));
  ok('散文の番号を取らない', !ids.includes(Z(13)));
  ok('第三者と実在しない番号の節を外す', !ids.includes(S(15)) && !ids.includes(Z(16)));
  ok('OSF の番号を小文字にそろえて取る', ids.includes(O('ABCDE').toLowerCase()));
  ok('概念 DOI を見分ける', got.find((x) => x.doi === Z(12)).concept === true
     && got.find((x) => x.doi === Z(11)).concept === false);
  ok('番号を二度数えない', ids.length === new Set(ids).size && ids.length === 4);

  ok('404 は載っていない', judgeStatus(404) === 無);
  ok('403 は落ちた', judgeStatus(403) === 落);
  ok('通信の失敗は落ちた', judgeStatus(0) === 落);

  /* 前の調べの誤り。確かめの頁を読んでも「載っている」と出さない。 */
  ok('開いた issue は確かめていない', judgeDoapr({ state: 'open', comments: 0 }, 0).state === 未);
  ok('データに名があれば載っている', judgeDoapr({ state: 'open', comments: 0 }, 1).state === 載);
  ok('完了で閉じた issue は載っている', judgeDoapr({ state: 'closed', state_reason: 'completed', comments: 2 }, 0).state === 載);
  ok('完了でなく閉じた issue は載っていない', judgeDoapr({ state: 'closed', state_reason: 'not_planned', comments: 2 }, 0).state === 無);
  ok('issue を読めなければ確かめていない', judgeDoapr(null, null).state === 未);

  const real = doisFromIndex(fs.readFileSync(path.join(ROOT, 'docs', 'doi-index.md'), 'utf8'));
  ok('doi-index.md から番号を読める', real.length > 0);
  ok('doi-index.md の第三者の番号を取らない', !real.some((x) => x.doi === S(2477899)));

  bad.forEach((b) => console.log('  落  ' + b));
  if (bad.length) { console.log(pass + ' 件が通り、' + bad.length + ' 件が通りませんでした。'); process.exit(1); }
  console.log(pass + ' 件すべて通りました。');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) { selfTest(); return; }
  const i = argv.indexOf('--out');
  const file = i >= 0 ? argv[i + 1] : 'index-survey.json';
  survey().then((out) => {
    fs.writeFileSync(file, JSON.stringify(out, null, 1));
    const s = summary(out);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, s);
    console.log(s);
  });
}

module.exports = { doisFromIndex, judgeStatus, judgeDoapr };
