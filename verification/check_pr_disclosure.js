/* PR の段階で、言語モデル利用の開示を確かめる（決めごと 8）。
 *
 *     node verification/check_pr_disclosure.js              # CI。GITHUB_EVENT_PATH の PR を見る
 *     node verification/check_pr_disclosure.js --self-test  # 外へ出ない。判定の部品だけを確かめる
 *
 * 枝の中のコミットに Claude の Co-Authored-By があれば、その PR は言語モデルと書いたものである。
 * そのとき PR の本文が、開示の行（Claude Code で作ったことと、作業の session の URL）を持っていなければ落とす。
 *
 * **マージのコミットの本文は、ここでは確かめられない。**マージする側が API に渡す本文は、
 * マージの時に初めて決まり、PR の段階ではどこにも無い。だからマージのあとで数える検査
 * （check_ecosystem.js の、開示の無いマージの件数）は外さない。ここでは、マージに渡す本文の
 * 末尾に置く二行を枝のコミットから組み立てて、Actions の要約に出す。写せば付け忘れない。
 */

'use strict';

const fs = require('fs');

const CO = /^Co-Authored-By:\s*Claude\b.*$/m;
const SESSION = /^Claude-Session:\s*(https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+)\s*$/m;

/* 枝のコミットの本文から、マージに渡す二行を組み立てる。言語モデルが関わっていなければ null。 */
function trailers(messages) {
  let co = null, session = null;
  for (const m of messages) {
    const c = CO.exec(m || '');
    if (c && !co) co = c[0].trim();
    const s = SESSION.exec(m || '');
    if (s) session = s[1];
  }
  if (!co) return null;
  return { co, session };
}

/* PR の本文が開示を持っているか。Claude Code で作ったことの行か Co-Authored-By の行と、session の URL。 */
function bodyDiscloses(body, t) {
  const b = body || '';
  const said = /Generated with \[Claude Code\]/.test(b) || CO.test(b);
  const url = t && t.session ? b.indexOf(t.session) >= 0 : /https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/.test(b);
  return said && url;
}

function judge(body, messages) {
  const t = trailers(messages);
  if (!t) return { ok: true, why: '枝のコミットに Claude の Co-Authored-By が無い（言語モデルの関わらない PR）', t };
  if (!bodyDiscloses(body, t)) return { ok: false, why: 'PR の本文に開示の行（Claude Code の行と session の URL）が無い', t };
  return { ok: true, why: 'PR の本文に開示がある', t };
}

function selfTest() {
  let pass = 0;
  const bad = [];
  const ok = (label, cond) => { if (cond) pass++; else bad.push(label); };
  const C = 'x\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_abc123';
  const BODY = '本文\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nhttps://claude.ai/code/session_abc123';
  ok('開示のある本文は通る', judge(BODY, [C]).ok);
  ok('開示の無い本文は落ちる', !judge('本文だけ', [C]).ok);
  ok('session の URL が違えば落ちる', !judge(BODY.replace('abc123', 'zzz999'), [C]).ok);
  ok('Claude Code の行が無ければ落ちる', !judge('本文\n\nhttps://claude.ai/code/session_abc123', [C]).ok);
  ok('Co-Authored-By の行でも開示になる', judge('本文\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nhttps://claude.ai/code/session_abc123', [C]).ok);
  ok('言語モデルの関わらない PR は問わない', judge('', ['人が書いた']).ok);
  const t = trailers(['a', C]);
  ok('マージに渡す二行を組み立てる', t && t.co.indexOf('Co-Authored-By: Claude') === 0 && t.session === 'https://claude.ai/code/session_abc123');
  bad.forEach((b) => console.log('  落  ' + b));
  if (bad.length) { console.log(pass + ' 件が通り、' + bad.length + ' 件が通りませんでした。'); process.exit(1); }
  console.log(pass + ' 件すべて通りました。');
}

async function main() {
  const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const pr = ev.pull_request;
  if (!pr) { console.log('PR の出来事ではないので、見るものが無い。'); return; }
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'pr-disclosure' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const messages = [];
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(pr.commits_url + '?per_page=100&page=' + page, { headers });
    if (!r.ok) throw new Error('コミットを読めない: ' + r.status);
    const list = await r.json();
    list.forEach((c) => messages.push(c.commit.message));
    if (list.length < 100) break;
  }
  const v = judge(pr.body, messages);
  const L = ['## 開示（決めごと 8）', '', (v.ok ? '通' : '落') + '　' + v.why, ''];
  if (v.t) {
    L.push('マージに渡す本文の末尾に、次の二行を置きます。マージのコミットは、ここでは確かめられません。', '', '```', v.t.co, 'Claude-Session: ' + (v.t.session || '（枝のコミットに無い）'), '```');
  }
  const text = L.join('\n') + '\n';
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  if (!v.ok) process.exit(1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main().catch((e) => { console.error(e.message); process.exit(2); });
}

module.exports = { trailers, bodyDiscloses, judge };
