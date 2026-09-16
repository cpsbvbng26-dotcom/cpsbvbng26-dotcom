#!/usr/bin/env node
/* この道具そのものを検査する。
 *
 * 検査の道具は、通ることでは信用できない。だから項目のほとんどに「壊す先」を添える。
 * 壊す先は、もと（targets.json / check.js / README.md）を書き換えた写しを作り、
 * 同じ判定をその写しに当てて、**落ちることを確かめる**。落ちなければ検査が嘘である。
 *
 *   node verification/check_tool.js
 *   node verification/check_tool.js --break
 *
 * 外へは一度も出ない。fixtures/ の見本だけで回る。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'targets.json'), 'utf8');
const SRC = fs.readFileSync(path.join(ROOT, 'check.js'), 'utf8');
const DOC = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const FIX = path.join(ROOT, 'fixtures/found.json');

/* check.js の写しを作って読み込む。もとの check.js は触らない。 */
let 通番 = 0;
function 写し(src) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dic-'));
  fs.writeFileSync(path.join(dir, 'check.js'), src);
  fs.writeFileSync(path.join(dir, 'targets.json'), RAW);
  const p = path.join(dir, 'check.js');
  delete require.cache[p];
  return require(p);
}

const 元 = { T: JSON.parse(RAW).targets, C: require(path.join(ROOT, 'check.js')), DOC, fixture: FIX };

const BREAK = process.argv.indexOf('--break') >= 0;
let pass = 0;
const fails = [];
const 壊す先 = [];

async function ok(name, probe, breaker) {
  let got;
  try { got = await probe(元); } catch (e) { got = false; }
  if (got === true) { pass++; } else { fails.push(name); }
  console.log((got === true ? '  ok   ' : '  NG   ') + name);
  if (breaker) 壊す先.push({ name, probe, breaker });
}

/* 壊した文脈を組み立てる。breaker は次のどれかを返す。
 *   {targets: <書き換えた JSON 文字列>} / {src: <書き換えた check.js>} / {doc: <書き換えた README>} */
function 壊す(breaker) {
  const d = breaker();
  const ctx = { T: 元.T, C: 元.C, DOC: 元.DOC, fixture: 元.fixture };
  if (d.targets !== undefined) ctx.T = JSON.parse(d.targets).targets;
  if (d.src !== undefined) ctx.C = 写し(d.src);
  if (d.doc !== undefined) ctx.DOC = d.doc;
  if (d.fixture !== undefined) ctx.fixture = d.fixture;
  return ctx;
}

const 目録を = (f) => () => { const j = JSON.parse(RAW); f(j.targets); return { targets: JSON.stringify(j) }; };
const 中身を = (a, b) => () => {
  if (SRC.indexOf(a) < 0) throw new Error('壊す先が見つからない: ' + a);
  return { src: SRC.replace(a, b) };
};
const 散文を = (a, b) => () => {
  if (DOC.indexOf(a) < 0) throw new Error('壊す先が見つからない: ' + a);
  return { doc: DOC.replace(a, b) };
};

async function main() {

/* ---------- 一 目録そのもの ---------- */

await ok('目録が読める形である', (x) => Array.isArray(x.T) && x.T.length > 0);

await ok('識別子が重複していない',
  (x) => new Set(x.T.map((t) => t.id)).size === x.T.length,
  目録を((t) => { t[1].id = t[0].id; }));

await ok('すべての場に名と種と根拠がある',
  (x) => x.T.every((t) => t.id && t.name && t.kind && t.terms),
  目録を((t) => { delete t[0].terms; }));

await ok('当たる先はすべて https である',
  (x) => x.T.filter((t) => t.url).every((t) => t.url.startsWith('https://')),
  目録を((t) => { t[0].url = 'http://doi.org/{doi}'; }));

/* 読むだけの当て方しかしない。**書き換える当て方を一つも持たない。**
 * HEAD を一つ使っている（DOI の解決）。本文を貰わずに済むぶん、そのほうが軽い。 */
await ok('当たる場は読むだけの当て方しか使わない（GET か HEAD）',
  (x) => x.T.filter((t) => t.url).every((t) => ['GET', 'HEAD'].indexOf(t.method || 'GET') >= 0),
  目録を((t) => { t.find((y) => y.url).method = 'POST'; }));

await ok('鍵の要る場には url を書いていない',
  (x) => x.T.filter((t) => t.requires_key).every((t) => !t.url),
  目録を((t) => { t.find((y) => y.requires_key).url = 'https://example.org/{doi}'; }));

await ok('規約が禁じている場には url を書いていない',
  (x) => x.T.filter((t) => t.forbidden).every((t) => !t.url),
  目録を((t) => { t.find((y) => y.forbidden).url = 'https://example.org/{doi}'; }));

await ok('どの場も、鍵と禁の両方には立たない',
  (x) => x.T.every((t) => !(t.requires_key && t.forbidden)),
  目録を((t) => { t.find((y) => y.forbidden).requires_key = true; }));

/* ---------- 二 数 ---------- */

const 当 = 元.T.filter((t) => !t.forbidden && !t.requires_key).length;
const 鍵 = 元.T.filter((t) => t.requires_key).length;
const 禁 = 元.T.filter((t) => t.forbidden).length;

await ok('全 ' + 元.T.length + ' = 当たる ' + 当 + ' + 鍵 ' + 鍵 + ' + 禁 ' + 禁,
  (x) => x.T.filter((t) => !t.forbidden && !t.requires_key).length
       + x.T.filter((t) => t.requires_key).length
       + x.T.filter((t) => t.forbidden).length === x.T.length);

const 素 = (s) => s.replace(/\*\*/g, '');
const 数え = (s, x) => 素(s).indexOf(x) >= 0;

await ok('README の「' + 元.T.length + ' の場」が実際と合う',
  (x) => 数え(x.DOC, x.T.length + ' の場'),
  散文を('全 **29 の場**', '全 **30 の場**'));

await ok('README の「当たるのは ' + 当 + '」が実際と合う',
  (x) => 数え(x.DOC, '当たるのは ' + x.T.filter((t) => !t.forbidden && !t.requires_key).length),
  散文を('当たるのは **19**', '当たるのは **18**'));

await ok('README の「鍵が要るのは ' + 鍵 + '」が実際と合う',
  (x) => 数え(x.DOC, '鍵が要るのは ' + x.T.filter((t) => t.requires_key).length),
  散文を('鍵が要るのは **7**', '鍵が要るのは **6**'));

await ok('README の「規約が禁じているのは ' + 禁 + '」が実際と合う',
  (x) => 数え(x.DOC, '規約が禁じているのは ' + x.T.filter((t) => t.forbidden).length),
  散文を('規約が禁じているのは **3**', '規約が禁じているのは **2**'));

await ok('README の「当たる」の表が ' + 当 + ' 行である',
  (x) => {
    const m = /### 当たる（\d+）\n\n([\s\S]*?)\n\n/.exec(x.DOC);
    if (!m) return false;
    const 行 = m[1].split('\n').filter((l) => l.startsWith('|')).length - 2;
    return 行 === x.T.filter((t) => !t.forbidden && !t.requires_key).length;
  },
  散文を('| DOAJ | 索引 | 公開 API |\n', ''));

/* ---------- 二・五 合法の範囲 ----------
 * **散文が守ると言っていることを、目録の側で確かめる。**
 * 言うだけなら書けてしまう。 */

await ok('README が、鍵と規約で当たらないと書いている',
  (x) => 数え(x.DOC, '認証を送らない。回避もしない。')
      && 数え(x.DOC, '規約が自動取得を禁じている場に当たらない。')
      && 数え(x.DOC, 'HTML の頁を掻き取らない。'),
  散文を('**認証を送らない。回避もしない。**', '認証はだいたい送らない。'));

await ok('README が、法律意見ではないと断っている',
  (x) => 数え(x.DOC, 'これは法律意見ではない。')
      && 数え(x.DOC, '使う側が、使う時点の規約を見ること。'),
  散文を('**これは法律意見ではない。**', 'これは法律意見である。'));

await ok('Altmetric の非商用の断りが、目録と散文の両方にある',
  (x) => {
    const t = x.T.find((y) => y.id === 'altmetric');
    return !!t && t.terms.indexOf('非商用に限られる') >= 0
        && 数え(x.DOC, 'Altmetric は非商用に限られる');
  },
  目録を((t) => { const a = t.find((y) => y.id === 'altmetric'); a.terms = '公開の口'; }));

await ok('Wikidata が連絡先を求めていることが目録に書いてある',
  (x) => {
    const t = x.T.find((y) => y.id === 'wikidata');
    return !!t && t.terms.indexOf('User-Agent に連絡先') >= 0;
  },
  目録を((t) => { const w = t.find((y) => y.id === 'wikidata'); w.terms = '公開 API'; }));

/* ---------- 三 判定の芯 ----------
 * ここが道具の要である。**通信の失敗を「載っていない」と読まない。** */

await ok('HTTP 500 は「載っていない」にならない',
  (x) => x.C.judge({ json_has: 'id' }, 500, '') === null,
  中身を('if (status >= 400) return null;            /* 呼び出し側で「落ちた」にする */',
         'if (status >= 400) return 無;'));

await ok('HTTP 403 は「載っていない」にならない',
  (x) => x.C.judge({ json_has: 'id' }, 403, '') === null);

/* **実際に出た誤りである。**状態番号だけで決める当て方が、4xx と 5xx を
 * 素通しして「載っていない」を返していた。串越しの 403 で表に出た。 */
await ok('状態番号だけで決める当て方でも、403 は「載っていない」にならない',
  (x) => x.C.judge({ status_lt: 400 }, 403, '') === null
      && x.C.judge({ status_lt: 400 }, 503, '') === null,
  中身を('  if (status === 404) return 無;\n  if (status >= 400) return null;            /* 呼び出し側で「落ちた」にする */\n  if (!hit) return 載;\n  if (hit.status_lt !== undefined) return status < hit.status_lt ? 載 : 無;',
         '  if (hit.status_lt !== undefined) return status < hit.status_lt ? 載 : 無;\n  if (status === 404) return 無;\n  if (status >= 400) return null;\n  if (!hit) return 載;'));

await ok('状態番号だけで決める当て方が、302 を「載っている」と読む',
  (x) => x.C.judge({ status_lt: 400 }, 302, '') === x.C.載
      && x.C.judge({ status_lt: 400 }, 404, '') === x.C.無);

await ok('当て方を宣言していない場でも、5xx は「載っていない」にならない',
  (x) => x.C.judge(null, 500, '') === null && x.C.judge(null, 200, '') === x.C.載,
  中身を('  if (status === 404) return 無;',
         '  if (!hit) return status < 400 ? 載 : 無;\n  if (status === 404) return 無;'));

await ok('通信が届かなかったものは「落ちた」であって「載っていない」ではない',
  (x) => x.C.judge({ json_has: 'id' }, 0, '') === null);

await ok('壊れた JSON は「載っていない」にならない',
  (x) => x.C.judge({ json_has: 'id' }, 200, '<html>502 Bad Gateway</html>') === null,
  中身を('catch (e) { return null; }', 'catch (e) { return 無; }'));

await ok('宣言の無い当て方は「載っていない」にならない',
  (x) => x.C.judge({ json_unknown_rule: 'x' }, 200, '{}') === null,
  中身を('  return null;\n}\n\n/* **XML を返す場が一つある**',
         '  return 無;\n}\n\n/* **XML を返す場が一つある**'));

await ok('404 は「載っていない」になる',
  (x) => x.C.judge({ json_has: 'id' }, 404, '') === x.C.無,
  中身を('if (status === 404) return 無;\n  if (status >= 400) return null;',
         'if (status === 404) return null;\n  if (status >= 400) return null;'));

await ok('場が「無い」と答えたときだけ「載っていない」になる',
  (x) => x.C.judge({ json_has: 'id' }, 200, '{"other":1}') === x.C.無
      && x.C.judge({ json_has: 'id' }, 200, '{"id":"x"}') === x.C.載,
  中身を("if (hit.json_has !== undefined) return get(j, hit.json_has) !== undefined ? 載 : 無;",
         "if (hit.json_has !== undefined) return 載;"));

await ok('件数ゼロは「載っていない」である',
  (x) => x.C.judge({ json_gt0: 'hitCount' }, 200, '{"hitCount":0}') === x.C.無
      && x.C.judge({ json_gt0: 'hitCount' }, 200, '{"hitCount":3}') === x.C.載,
  中身を('Number(get(j, hit.json_gt0)) > 0 ? 載 : 無', 'Number(get(j, hit.json_gt0)) >= 0 ? 載 : 無'));

await ok('空の配列は「載っていない」である',
  (x) => x.C.judge({ json_array_nonempty: '$' }, 200, '[]') === x.C.無
      && x.C.judge({ json_array_nonempty: '$' }, 200, '[{"x":1}]') === x.C.載,
  中身を('(Array.isArray(v) && v.length > 0) ? 載 : 無', 'Array.isArray(v) ? 載 : 無'));

await ok('空文字の欄は「載っていない」である',
  (x) => x.C.judge({ json_not_empty: 'a' }, 200, '{"a":""}') === x.C.無
      && x.C.judge({ json_not_empty: 'a' }, 200, '{"a":"x"}') === x.C.載,
  中身を("(v !== undefined && v !== null && v !== '') ? 載 : 無", 'v !== undefined ? 載 : 無'));

await ok('配列の添字をたどれる（登録機関の判定）',
  (x) => x.C.judge({ json_not_empty: '0.RA' }, 200, '[{"RA":"DataCite"}]') === x.C.載
      && x.C.judge({ json_not_empty: '0.RA' }, 200, '[{}]') === x.C.無,
  中身を("for (const k of dotted.split('.'))", 'for (const k of [dotted])'));

await ok('XML の総件数を読む（国立国会図書館サーチ）',
  (x) => x.C.judgeXml({ xml_gt0: 'numberOfRecords' }, 200, '<x><numberOfRecords>2</numberOfRecords></x>') === x.C.載
      && x.C.judgeXml({ xml_gt0: 'numberOfRecords' }, 200, '<x><numberOfRecords>0</numberOfRecords></x>') === x.C.無,
  中身を("return Number(m[1]) > 0 ? 載 : 無;", "return 載;"));

await ok('XML でも 5xx は「載っていない」にならない',
  (x) => x.C.judgeXml({ xml_gt0: 'numberOfRecords' }, 500, '') === null,
  中身を('if (status === 404) return 無;\n  if (status >= 400) return null;\n  const tag',
         'if (status === 404) return 無;\n  if (status >= 400) return 無;\n  const tag'));

await ok('要素が見つからない XML は「載っていない」にならない',
  (x) => x.C.judgeXml({ xml_gt0: 'numberOfRecords' }, 200, '<html>proxy</html>') === null,
  中身を('if (!m) return null;', 'if (!m) return 無;'));

/* ---------- 四 DOI の埋め方 ---------- */

await ok('DOI の斜線を潰さない',
  (x) => x.C.fill('{doi}', '10.5281/zenodo.1', null) === '10.5281/zenodo.1',
  中身を(".replace(/%2F/g, '/')", ''));

await ok('URL の形にしたものは逃がしてある',
  (x) => x.C.fill('{doi_url}', '10.5281/zenodo.1', null)
       === 'https%3A%2F%2Fdoi.org%2F10.5281%2Fzenodo.1');

await ok('メールを渡さなければ空で埋まる',
  (x) => x.C.fill('{mail}', '10.1/x', null) === '');

/* ---------- 五 見本で回す ---------- */

const F = JSON.parse(fs.readFileSync(FIX, 'utf8'));

await ok('見本が、当たる場をすべて覆っている',
  (x) => {
    const f = JSON.parse(fs.readFileSync(x.fixture, 'utf8'));
    return x.T.filter((t) => !t.forbidden && !t.requires_key && !t.needs_mail)
             .every((t) => f[t.id] !== undefined);
  },
  () => {
    const f = JSON.parse(fs.readFileSync(FIX, 'utf8'));
    delete f.datacite;
    const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dic-')), 'f.json');
    fs.writeFileSync(p, JSON.stringify(f));
    return { fixture: p };
  });

await ok('見本に、鍵の要る場と禁じられた場の答えが入っていない',
  (x) => x.T.filter((t) => t.forbidden || t.requires_key).every((t) => F[t.id] === undefined));

/* **見本で回すあいだ、外へ一度も出ない。**出たら落ちる。 */
const https = require('https');
const 本物 = https.request;
let 出た = 0;
https.request = function () { 出た++; return 本物.apply(this, arguments); };
const rows = await 元.C.run('10.5281/zenodo.22058254', { gap: 0, mail: null, fixture: FIX });
https.request = 本物;

await ok('見本で回すあいだ、外へ一度も出ていない', () => 出た === 0);

await ok('全 ' + 元.T.length + ' の場すべてに行が立つ', () => rows.length === 元.T.length);

const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

await ok('鍵の要る場は「確かめていない」である',
  () => 元.T.filter((t) => t.requires_key).every((t) => byId[t.id].state === 元.C.未));

await ok('規約が禁じている場は「確かめていない」である',
  () => 元.T.filter((t) => t.forbidden).every((t) => byId[t.id].state === 元.C.未));

await ok('禁じている場の備考が、理由を言っている',
  () => 元.T.filter((t) => t.forbidden).every((t) => /規約/.test(byId[t.id].note)));

await ok('どの行も、四つの状態のどれかである',
  () => rows.every((r) => [元.C.載, 元.C.無, 元.C.未, 元.C.落].indexOf(r.state) >= 0));

await ok('見本の 404 は「載っていない」になっている', () => byId.crossref.state === 元.C.無);
await ok('見本の 200 は「載っている」になっている', () => byId.datacite.state === 元.C.載);
await ok('リダイレクトの解決は「載っている」になっている', () => byId['doi.org'].state === 元.C.載);

/* 見本の Zenodo を 503 に差し替えると、その行は「落ちた」になる。
 * **「載っていない」にはならない。**これがこの道具の芯である。 */
{
  const f = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  f.zenodo = { status: 503, body: 'Service Unavailable' };
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dic-')), 'f.json');
  fs.writeFileSync(p, JSON.stringify(f));
  const r2 = await 元.C.run('10.5281/zenodo.22058254', { gap: 0, mail: null, fixture: p });
  const z = r2.find((r) => r.id === 'zenodo');
  await ok('503 を返した場は「落ちた」になり、「載っていない」にならない',
    () => z.state === 元.C.落);
}

/* ---------- 六 自身の数 ---------- */

/* どちらも自分自身を数に入れる。**自分の分は、まだ積まれていない。**
 * 検査の数は pass + fails + 1、壊す先の数は 壊す先.length + 1。
 * check_site.js と同じ形である。 */
{
  const 実際 = 壊す先.length + 1;
  await ok('README の「壊す先は ' + 実際 + ' 通り」が実際と合う',
    (x) => 数え(x.DOC, '壊す先は ' + 実際 + ' 通り'),
    散文を('壊す先は **33 通り**', '壊す先は **32 通り**'));
}
{
  const m = /検査は \*\*(\d+) 項目\*\*/.exec(DOC);
  const 実際 = pass + fails.length + 1;
  await ok('README の「検査は ' + (m ? m[1] : '?') + ' 項目」が実際（' + 実際 + '）と合う',
    () => m !== null && Number(m[1]) === 実際);
}

/* ---------- 壊す ---------- */

let 壊れた = 0;
const 壊れない = [];
if (BREAK) {
  console.log('\n壊す —— もとを書き換えた写しに同じ判定を当て、落ちることを見る\n');
  for (const b of 壊す先) {
    let got;
    try { got = await b.probe(壊す(b.breaker)); } catch (e) { got = 'throw'; }
    const 落ちた = got !== true;
    if (落ちた) { 壊れた++; console.log('  落   ' + b.name); }
    else { 壊れない.push(b.name); console.log('  通   ' + b.name + '　← 壊しても通った'); }
  }
  console.log('\n壊して落ちた ' + 壊れた + ' / 壊す先 ' + 壊す先.length + ' 通り');
}

console.log('\n' + '-'.repeat(64));
console.log('通った ' + pass + ' / 全 ' + (pass + fails.length) + '　壊す先 ' + 壊す先.length + ' 通り');
if (fails.length) {
  console.log('\n落ちた:');
  for (const f of fails) console.log('  - ' + f);
}
if (壊れない.length) {
  console.log('\n壊しても通ったもの（検査が効いていない）:');
  for (const f of 壊れない) console.log('  - ' + f);
}
if (fails.length || 壊れない.length) process.exit(1);
console.log('落ちたものは無い。');

}

main();
