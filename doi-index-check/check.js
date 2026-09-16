#!/usr/bin/env node
/* DOI 一件が、どの索引に載っているかを確かめる。
 *
 *   node check.js 10.5281/zenodo.22058254 --mail you@example.com
 *   node check.js --offline --fixture fixtures/sample.json 10.5281/zenodo.22058254
 *
 * **鍵の要る場には当たらない。規約が自動取得を禁じている場にも当たらない。**
 * 当たらなかったものは「確かめていない」と出す。**「載っていない」とは書かない。**
 * この区別がこの道具の芯である。無いことと、確かめられなかったことは違う。
 *
 * 依存パッケージは無い。Node だけで動く。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname;
const TARGETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'targets.json'), 'utf8')).targets;

const VERSION = '0.1.0';
const REPO = 'https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom';

/* ---------------- 結果の型 ----------------
 * 載っている / 載っていない / 確かめていない / 落ちた
 * **「載っていない」は、その場が「無い」と答えたときだけ。**
 * 通信が失敗したら「落ちた」であって「載っていない」ではない。 */
const 載 = '載っている';
const 無 = '載っていない';
const 未 = '確かめていない';
const 落 = '落ちた';

function get(obj, dotted) {
  if (dotted === '$') return obj;
  let cur = obj;
  for (const k of dotted.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    if (k === '$') continue;
    cur = cur[k];              /* 配列も同じ。"0" で添字を引ける */
  }
  return cur;
}

/* 応答が「載っている」と言っているかを、宣言どおりに判定する。
 * **推論を入れない。**あるか無いか、数がゼロより大きいか、それだけで決める。 */
function judge(hit, status, body) {
  /* **ここを先に通す。**状態番号だけで決める当て方でも、
   * 404 以外の 4xx と 5xx は「落ちた」である。「載っていない」ではない。
   * 403 を「載っていない」と読んだら、この道具は無いことを捏造する。 */
  if (status === 404) return 無;
  if (status >= 400) return null;            /* 呼び出し側で「落ちた」にする */
  if (!hit) return 載;
  if (hit.status_lt !== undefined) return status < hit.status_lt ? 載 : 無;
  let j;
  try { j = JSON.parse(body); } catch (e) { return null; }
  if (hit.json_has !== undefined) return get(j, hit.json_has) !== undefined ? 載 : 無;
  if (hit.json_not_empty !== undefined) {
    const v = get(j, hit.json_not_empty);
    return (v !== undefined && v !== null && v !== '') ? 載 : 無;
  }
  if (hit.json_gt0 !== undefined) return Number(get(j, hit.json_gt0)) > 0 ? 載 : 無;
  if (hit.json_array_nonempty !== undefined) {
    const v = get(j, hit.json_array_nonempty);
    return (Array.isArray(v) && v.length > 0) ? 載 : 無;
  }
  return null;
}

/* **XML を返す場が一つある**（国立国会図書館サーチ）。
 * 総件数の要素だけを見る。**解析器は持ち込まない。**数を一つ取るだけである。 */
function judgeXml(hit, status, body) {
  if (status === 404) return 無;
  if (status >= 400) return null;
  const tag = hit.xml_gt0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('<' + tag + '[^>]*>\\s*(\\d+)\\s*</' + tag + '>').exec(body);
  if (!m) return null;
  return Number(m[1]) > 0 ? 載 : 無;
}

function fill(tpl, doi, mail) {
  return tpl
    .replace(/\{doi_url\}/g, encodeURIComponent('https://doi.org/' + doi))
    .replace(/\{doi_upper\}/g, doi.toUpperCase())
    .replace(/\{doi\}/g, encodeURIComponent(doi).replace(/%2F/g, '/'))
    .replace(/\{mail\}/g, encodeURIComponent(mail || ''));
}

function request(url, method, headers) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: Object.assign({
        'User-Agent': 'doi-index-check/' + VERSION + ' (+' + REPO + ')',
        'Accept': 'application/json',
      }, headers || {}),
      timeout: 20000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, body, retry: res.headers['retry-after'] }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: '', err: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, body: '', err: e.code || e.message }));
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(doi, opts) {
  const rows = [];
  const fixture = opts.fixture ? JSON.parse(fs.readFileSync(opts.fixture, 'utf8')) : null;

  for (const t of TARGETS) {
    if (t.forbidden) {
      rows.push({ id: t.id, name: t.name, kind: t.kind, state: 未,
                  note: '規約が自動取得を禁じている。人が手で見ること' });
      continue;
    }
    if (t.requires_key) {
      rows.push({ id: t.id, name: t.name, kind: t.kind, state: 未, note: '鍵が要る' });
      continue;
    }
    if (t.needs_mail && !opts.mail && !fixture) {
      rows.push({ id: t.id, name: t.name, kind: t.kind, state: 未,
                  note: '連絡先のメールを求めている。--mail で渡す' });
      continue;
    }

    const url = fill(t.url, doi, opts.mail);
    let res;
    if (fixture) {
      res = fixture[t.id];
      if (!res) { rows.push({ id: t.id, name: t.name, kind: t.kind, state: 未, note: '見本が無い' }); continue; }
    } else {
      res = await request(url, t.method || 'GET', t.headers);
      if (res.status === 429) {
        const wait = Number(res.retry || opts.gap / 1000) * 1000 || 5000;
        await sleep(Math.min(wait, 60000));
        res = await request(url, t.method || 'GET', t.headers);
      }
      await sleep(opts.gap);
    }

    if (res.status === 0) {
      rows.push({ id: t.id, name: t.name, kind: t.kind, state: 落, note: res.err || '届かない' });
      continue;
    }
    const v = (t.hit && t.hit.xml_gt0 !== undefined)
      ? judgeXml(t.hit, res.status, res.body)
      : judge(t.hit, res.status, res.body);
    if (v === null) {
      rows.push({ id: t.id, name: t.name, kind: t.kind, state: 落, note: 'HTTP ' + res.status });
    } else {
      rows.push({ id: t.id, name: t.name, kind: t.kind, state: v, note: 'HTTP ' + res.status });
    }
  }
  return rows;
}

function report(doi, rows) {
  const w = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0)));
  console.log('\nDOI  ' + doi + '\n');
  console.log(w('場', 38) + w('種', 12) + w('状態', 16) + '備考');
  console.log('-'.repeat(92));
  for (const r of rows) console.log(w(r.name, 38) + w(r.kind || '', 12) + w(r.state, 16) + (r.note || ''));
  const c = (s) => rows.filter((r) => r.state === s).length;
  console.log('-'.repeat(92));
  console.log('載っている ' + c(載) + ' / 載っていない ' + c(無)
            + ' / 確かめていない ' + c(未) + ' / 落ちた ' + c(落) + '　（全 ' + rows.length + '）');
  console.log('\n**「確かめていない」を「載っていない」と読まないこと。**'
            + '鍵が要る場と、規約が自動取得を禁じている場は、当たっていない。');
  return rows;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = { gap: 1200, mail: null, fixture: null, json: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mail') opts.mail = argv[++i];
    else if (argv[i] === '--fixture') opts.fixture = argv[++i];
    else if (argv[i] === '--gap') opts.gap = Number(argv[++i]);
    else if (argv[i] === '--json') opts.json = true;
    else if (argv[i] === '--offline') opts.gap = 0;
    else rest.push(argv[i]);
  }
  const doi = (rest[0] || '').replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) {
    console.error('使い方: node check.js 10.5281/zenodo.22058254 [--mail you@example.com]');
    process.exit(2);
  }
  run(doi, opts).then((rows) => {
    if (opts.json) console.log(JSON.stringify({ doi, checked_at: new Date().toISOString(), rows }, null, 2));
    else report(doi, rows);
  });
}

module.exports = { judge, judgeXml, fill, get, run, 載, 無, 未, 落 };
