/* 外の値を見張る。週に一度、GitHub Actions が回す（.github/workflows/watch-outside.yml）。
 *
 *     node verification/watch_outside.js              # 外へ出る。控えと違えば終了コード 1 ではなく、issue で知らせる
 *     node verification/watch_outside.js --self-test  # 外へ出ない。比べる部品だけを確かめる
 *
 * 見る値は三つ。控えは verification/outside.json にある。
 *   - ORCID の作品の数
 *   - OpenAlex で ORCID iD から引いた著者の ID の数
 *   - Zenodo の七つの記録に要旨があるか（DataCite の記録の Abstract で見る。Zenodo が DataCite に送る中身である）
 *
 * 控えと違えば、issue を一つ立てるか直す。同じに戻れば閉じる。読めなかった値は「読めなかった」と書き、
 * ずれとは数えない（読めないことと、値が変わったことは違う）。
 * 控えを直すのは人である。外の値が変わったと確かめてから、outside.json と
 * docs/name-disambiguation.md を同じ日に書き換える。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UA = 'watch-outside/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom)';
const MARK = '<!-- watch-outside -->';
const TITLE = '外の値が控えと違う（ORCID・OpenAlex・Zenodo の要旨）';
const TOKEN = process.env.GITHUB_TOKEN || '';

const 読めない = '読めなかった';

/* 控えと、読んだ値を比べる。読めなかった値は、ずれに数えない。 */
function compare(expected, got) {
  const rows = [];
  const add = (name, want, have) => {
    const read = have !== null && have !== undefined;
    rows.push({ name, want, have: read ? have : 読めない, moved: read && JSON.stringify(want) !== JSON.stringify(have) });
  };
  add('ORCID の作品の数', expected.orcidWorks, got.orcidWorks);
  add('OpenAlex の著者の ID の数', expected.openalexAuthorIds, got.openalexAuthorIds);
  add('Zenodo の要旨がある記録', [...expected.zenodoAbstract.present].sort(), got.zenodoAbstract ? [...got.zenodoAbstract].sort() : null);
  return rows;
}

function body(rows, asOf) {
  const L = [MARK, '', '控え（`verification/outside.json`、' + asOf + '）と、いま外で読んだ値です。', '',
    '| 値 | 控え | いま | |', '| --- | --- | --- | --- |'];
  const show = (v) => Array.isArray(v) ? (v.length ? v.join(', ') : '無し') : String(v);
  rows.forEach((r) => L.push('| ' + r.name + ' | ' + show(r.want) + ' | ' + show(r.have) + ' | ' + (r.moved ? '**ずれ**' : '') + ' |'));
  L.push('', '外の値が本当に変わったと確かめたら、`verification/outside.json` と `docs/name-disambiguation.md` を同じ日に書き換えます。',
    '', '生成: `verification/watch_outside.js`（' + new Date().toISOString().slice(0, 10) + '）');
  return L.join('\n');
}

async function getJson(url, headers) {
  try {
    const r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, headers || {}), signal: AbortSignal.timeout(30000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

async function read(expected) {
  const got = {};
  const o = await getJson('https://pub.orcid.org/v3.0/' + expected.orcid + '/works');
  got.orcidWorks = o && Array.isArray(o.group) ? o.group.length : null;
  const a = await getJson('https://api.openalex.org/authors?filter=orcid:' + expected.orcid);
  got.openalexAuthorIds = a && Array.isArray(a.results) ? a.results.length : null;
  const present = [];
  let ok = true;
  for (const id of expected.zenodoAbstract.records) {
    const d = await getJson('https://api.datacite.org/dois/10.5281/zenodo.' + id);
    if (!d) { ok = false; break; }
    const ds = (d.data.attributes.descriptions || []).filter((x) => x.descriptionType === 'Abstract' && String(x.description || '').trim());
    if (ds.length) present.push(id);
  }
  got.zenodoAbstract = ok ? present : null;
  return got;
}

async function api(p, opts) {
  const r = await fetch('https://api.github.com' + p, Object.assign({
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': UA, Authorization: 'Bearer ' + TOKEN },
  }, opts || {}));
  if (!r.ok) throw new Error('GitHub API ' + p + ' → ' + r.status);
  return r.json();
}

async function upsertIssue(text, moved) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !TOKEN) { console.log('GITHUB_TOKEN か GITHUB_REPOSITORY が無いので、issue は触らない。'); return; }
  let found = null;
  for (let page = 1; page <= 5 && !found; page++) {
    const list = await api('/repos/' + repo + '/issues?state=all&per_page=100&page=' + page);
    found = list.find((i) => !i.pull_request && (i.body || '').indexOf(MARK) === 0) || null;
    if (list.length < 100) break;
  }
  const state = moved ? 'open' : 'closed';
  if (found) {
    await api('/repos/' + repo + '/issues/' + found.number, { method: 'PATCH', body: JSON.stringify({ title: TITLE, body: text, state }) });
    console.log('issue #' + found.number + ' を直した（' + state + '）');
  } else if (moved) {
    const made = await api('/repos/' + repo + '/issues', { method: 'POST', body: JSON.stringify({ title: TITLE, body: text }) });
    console.log('issue #' + made.number + ' を立てた');
  } else {
    console.log('ずれは無く、立てる issue も無い。');
  }
}

function selfTest() {
  let pass = 0;
  const bad = [];
  const ok = (label, cond) => { if (cond) pass++; else bad.push(label); };
  const exp = { orcidWorks: 4, openalexAuthorIds: 4, zenodoAbstract: { records: ['1', '2'], present: ['2'] } };
  const same = compare(exp, { orcidWorks: 4, openalexAuthorIds: 4, zenodoAbstract: ['2'] });
  ok('同じ値なら、ずれが無い', same.every((r) => !r.moved));
  ok('ORCID の作品が増えれば、ずれ', compare(exp, { orcidWorks: 5, openalexAuthorIds: 4, zenodoAbstract: ['2'] })[0].moved);
  ok('著者の ID がまとまれば、ずれ', compare(exp, { orcidWorks: 4, openalexAuthorIds: 1, zenodoAbstract: ['2'] })[1].moved);
  ok('要旨が入れば、ずれ', compare(exp, { orcidWorks: 4, openalexAuthorIds: 4, zenodoAbstract: ['1', '2'] })[2].moved);
  ok('並びが違うだけなら、ずれではない', !compare({ ...exp, zenodoAbstract: { records: [], present: ['2', '1'] } }, { orcidWorks: 4, openalexAuthorIds: 4, zenodoAbstract: ['1', '2'] })[2].moved);
  const none = compare(exp, { orcidWorks: null, openalexAuthorIds: undefined, zenodoAbstract: null });
  ok('読めなかった値は、ずれに数えない', none.every((r) => !r.moved && r.have === 読めない));
  ok('知らせの本文が印で始まる', body(same, '2026-11-12').indexOf(MARK) === 0);
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'verification', 'outside.json'), 'utf8'));
  ok('控えが読める', Number.isInteger(real.orcidWorks) && Number.isInteger(real.openalexAuthorIds)
     && Array.isArray(real.zenodoAbstract.records) && real.zenodoAbstract.present.every((x) => real.zenodoAbstract.records.includes(x)));
  bad.forEach((b) => console.log('  落  ' + b));
  if (bad.length) { console.log(pass + ' 件が通り、' + bad.length + ' 件が通りませんでした。'); process.exit(1); }
  console.log(pass + ' 件すべて通りました。');
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) { selfTest(); return; }
  (async () => {
    const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'verification', 'outside.json'), 'utf8'));
    const got = await read(expected);
    const rows = compare(expected, got);
    const text = body(rows, expected.asOf);
    console.log(text);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
    /* 知らせる先は issue である。ずれても CI は落とさない。 */
    if (process.env.WATCH_ISSUE === '1') await upsertIssue(text, rows.some((r) => r.moved));
  })();
}

module.exports = { compare, body };
