/* 目録に載せた DOI の資源の種類を、DataCite の記録と突き合わせる。
 *
 *   node verification/check_datacite.js
 *
 * **外へ出る検査である。**api.datacite.org に問い合わせる。だから check_site.js や
 * check_ecosystem.js には混ぜず、CI でも別の仕事にしてある（.github/workflows/datacite.yml）。
 * 作業環境から DataCite に届かないときは、通ったことにせず「走らなかった」で止まる。
 *
 * 期待する種類は catalog.json（researcher-profile の catalog.json から生成したもの）の
 * resourceType である。Zenodo で選んだ種類が目録と食い違えば落ちる。
 * self-correction が Software として登録されていたずれを、二度と起こさないために置いた。
 *
 * SSRN の DOI は Crossref の番号で、DataCite には無い。目録はそれを registry: Crossref と書き、
 * ここでは問い合わせない。問い合わせない番号も、数だけは出す。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API = 'https://api.datacite.org/dois/';

let passed = 0;
const failures = [];
function check(label, ok, detail) {
  if (ok) { passed++; console.log('  通  ' + label + (detail ? '  ' + detail : '')); }
  else { failures.push(label); console.log('  落  ' + label + (detail ? '  ' + detail : '')); }
}

async function get(doi) {
  let last = null;
  for (const wait of [0, 5000, 20000]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const r = await fetch(API + doi, {
        headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'cpsbvbng26-dotcom check_datacite' },
        signal: AbortSignal.timeout(30000),
      });
      if (r.status === 404) return { missing: true };
      if (r.status === 429 || r.status >= 500) { last = 'HTTP ' + r.status; continue; }
      if (!r.ok) return { error: 'HTTP ' + r.status };
      const j = await r.json();
      return { attrs: j.data && j.data.attributes };
    } catch (e) {
      last = String((e.cause && e.cause.code) || e.message);
    }
  }
  return { unreachable: last };
}

(async () => {
  const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));
  const asked = [];
  const crossref = [];
  cat.works.forEach((w) => {
    if (!w.doi) return;
    if (w.registry === 'Crossref') { crossref.push(w.doi); return; }
    asked.push({ w, doi: w.doi, role: '版' });
    if (w.conceptDoi) asked.push({ w, doi: w.conceptDoi, role: '全版' });
  });
  console.log('目録の DOI を DataCite に問い合わせる（' + asked.length + ' 件。Crossref の番号 '
    + crossref.length + ' 件は問い合わせない）\n');

  let unreachable = 0;
  for (const a of asked) {
    const r = await get(a.doi);
    const label = a.w.id + '  ' + a.doi + '（' + a.role + '）';
    if (r.unreachable) {
      unreachable++;
      console.log('  ？  ' + label + '  届かない ' + r.unreachable);
      /* 続けて三つ届かなければ、残りも届かないと見て打ち切る。待つだけ長くなる。 */
      if (unreachable >= 3 && passed + failures.length === 0) break;
      continue;
    }
    if (r.missing) { check(label + '  DataCite に記録がある', false, '404'); continue; }
    if (r.error) { check(label + '  DataCite から読める', false, r.error); continue; }
    const got = r.attrs && r.attrs.types ? r.attrs.types.resourceTypeGeneral : null;
    check(label + '  資源の種類が目録と同じ', got === a.w.resourceType,
      '目録 ' + a.w.resourceType + ' / DataCite ' + got);
  }

  console.log('\n' + '-'.repeat(58));
  if (unreachable) {
    /* **届かなかったものを、通ったことにしない。**数えずに、走らなかったと言って止まる。 */
    console.log(unreachable + ' 件は DataCite に届かず、確かめられませんでした。この検査は走りきっていません。');
    process.exit(2);
  }
  if (failures.length) {
    console.log(passed + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log(passed + ' 件すべて通りました。');
})();
