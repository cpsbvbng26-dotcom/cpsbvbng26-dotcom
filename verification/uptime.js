/* 配っているサイトが応答しているかを見る。
 *
 *   node verification/uptime.js
 *
 * **外へ出る検査である。**CI では .github/workflows/uptime.yml が一日に一度回す。
 * 見る URL は verification/sites.json の watch だけ。2xx と 3xx を「応答した」とする。
 * 4xx・5xx・時間切れ・名前が引けないものを「応答しない」とし、少し待って一度だけ確かめ直す。
 * UPTIME_ISSUE=1 なら、応答しないものを issue 一つにまとめて立てるか直し、全部戻れば閉じる。
 * linkcheck.js と同じ作りで、印（MARK）で自分の issue を見分ける。 */

'use strict';

const fs = require('fs');
const path = require('path');

const LIST = JSON.parse(fs.readFileSync(path.join(__dirname, 'sites.json'), 'utf8')).watch;
const TOKEN = process.env.GITHUB_TOKEN || '';
const MARK = '<!-- uptime:daily -->';
const TITLE = 'サイトが応答しない（一日に一度の見張り）';
/* 名乗り。ブラウザの名を借りない（2026-11-12、四度目の見落とし。それまでは Mozilla/5.0 を頭に付けていた）。
 * linkcheck.js と同じ形で、どのリポジトリの、どの仕事かを書く。check_ecosystem.js の 12l が見る。 */
const UA = 'cpsbvbng26-dotcom-uptime/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/blob/main/verification/uptime.js)';

async function probe(u) {
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    if (r.body) { try { await r.body.cancel(); } catch (e) { /* 読み捨て */ } }
    return { status: r.status };
  } catch (e) {
    return { status: 0, error: String((e.cause && e.cause.code) || e.name || e.message) };
  }
}
const up = (r) => r.status >= 200 && r.status < 400;

async function api(p, opts) {
  const r = await fetch('https://api.github.com' + p, Object.assign({
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': UA, Authorization: 'Bearer ' + TOKEN },
  }, opts || {}));
  if (!r.ok) throw new Error('GitHub API ' + p + ' → ' + r.status);
  return r.json();
}

async function upsert(body, down) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !TOKEN) { console.log('GITHUB_TOKEN か GITHUB_REPOSITORY が無いので、issue は触らない。'); return; }
  const list = await api('/repos/' + repo + '/issues?state=all&per_page=100');
  const found = list.find((i) => !i.pull_request && (i.body || '').indexOf(MARK) === 0) || null;
  const state = down ? 'open' : 'closed';
  if (found) {
    if (found.state === state && !down) { console.log('issue #' + found.number + ' は閉じたまま。'); return; }
    await api('/repos/' + repo + '/issues/' + found.number, { method: 'PATCH', body: JSON.stringify({ title: TITLE, body, state }) });
    console.log('issue #' + found.number + ' を直した（' + state + '）');
  } else if (down) {
    const made = await api('/repos/' + repo + '/issues', { method: 'POST', body: JSON.stringify({ title: TITLE, body }) });
    console.log('issue #' + made.number + ' を立てた');
  } else {
    console.log('全部が応答し、立てる issue も無い。');
  }
}

module.exports = { UA, probe, up };

if (require.main === module) (async () => {
  const results = [];
  for (const u of LIST) {
    let r = await probe(u);
    if (!up(r)) { await new Promise((ok) => setTimeout(ok, 30000)); r = await probe(u); }
    results.push({ u, r });
    console.log((up(r) ? '  応答した    ' : '  応答しない  ') + u + '  ' + (r.status || r.error));
  }
  const down = results.filter((x) => !up(x.r));
  const body = [MARK, '', '見張った日: ' + new Date().toISOString().slice(0, 10), '',
    '| URL | 結果 |', '| --- | --- |']
    .concat(results.map((x) => '| ' + x.u + ' | ' + (up(x.r) ? '応答した（' + x.r.status + '）' : '**応答しない**（' + (x.r.status || x.r.error) + '）') + ' |'))
    .join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body + '\n');
  if (process.env.UPTIME_ISSUE === '1') await upsert(body, down.length);
  console.log(down.length ? down.length + ' 件が応答しませんでした。' : LIST.length + ' 件すべて応答しました。');
  /* 落ちていても CI は落とさない。知らせる先は issue である。 */
})().catch((e) => { console.error('見張りが走りきらなかった: ' + e.message); process.exit(1); });
