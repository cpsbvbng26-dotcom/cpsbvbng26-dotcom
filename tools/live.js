#!/usr/bin/env node
/* Checks that the live site serves what main holds: every file that tools/live.json names is fetched from the production
 * address and compared byte for byte with the file in the repository. A deployment that failed, was refused (for example
 * by the daily limit of the free plan) or still serves an earlier version shows as a difference.
 *
 * WAIT=600 retries for up to that many seconds, for a check just after a push. On a schedule or after a push,
 * a difference that remains opens (or updates) one issue; when everything matches again, the issue is closed.
 *
 * This file is the same, byte for byte, in every repository that uses it; what differs is tools/live.json there:
 *   base     the production address, ending in /
 *   dir      the folder of the repository that is served ("." for the root)
 *   include  the files compared, as patterns of the path inside dir (* within one folder, ** across folders)
 *   exclude  files and folders (ending in /) that are not served as files, such as the configuration of the host
 *   lang     the language of the issue: "en" or "ja"
 * Requests go through tools/ua.js of the repository, which sets its User-Agent.
 *
 *   node tools/live.js
 */
'use strict';
const ua = require('./ua.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONF = JSON.parse(fs.readFileSync(path.join(__dirname, 'live.json'), 'utf8'));
const SITE = path.join(ROOT, CONF.dir || 'site');
const MARK = '<!-- live-site -->';
const BASE = CONF.base;
const TEXTS = {
  en: { title: 'The live site differs from main', head: 'The live site at {base} does not serve what main holds ({when}). The deployment may have failed, may have been refused by the daily limit of the free plan, or may still be running.', foot: 'Redeploy the latest commit of main from Vercel, or push again. This issue closes by itself when the live site matches.', closed: 'The live site matches main again ({when}). Closing.', same: 'All {n} files match.', differ: '{d} of {n} files differ.' },
  ja: { title: '公開中のサイトが main と違う', head: '{base} の公開中のサイトが、main と違うものを配っています（{when}）。デプロイが失敗したか、無料の枠の一日の上限で断られたか、まだ終わっていないかもしれません。', foot: 'Vercel で main の最新のコミットをデプロイし直すか、もう一度 push します。公開中のサイトが一致すれば、この issue はひとりでに閉じます。', closed: '公開中のサイトが main とふたたび一致しました（{when}）。閉じます。', same: '{n} 件すべて一致しました。', differ: '{n} 件のうち {d} 件が違います。' },
};
const T = TEXTS[CONF.lang] || TEXTS.en;

/* Pure: whether a path matches a pattern: * stands for any part of one folder's name, ** for any number of folders. */
function matches(file, pattern) {
  const re = '^' + String(pattern).split('**').map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$';
  return new RegExp(re).test(file);
}

/* Pure: the files that are served, and their addresses. */
function served(files, conf = CONF) {
  const include = conf.include || ['**'];
  const exclude = conf.exclude || [];
  return files.filter((f) => include.some((p) => matches(f, p)) && !exclude.some((x) => (x.endsWith('/') ? f.startsWith(x) : f === x))).sort()
    .map((f) => ({ file: f, url: conf.base + (f === 'index.html' ? '' : f) }));
}

const walk = (dir, pre = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.name === '.git' ? [] : d.isDirectory() ? walk(path.join(dir, d.name), pre + d.name + '/') : [pre + d.name]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Every page of a list on GitHub, to the end; an answer that is not a list stops the run, never read as an empty list (2026-11-15). */
async function allPages(gh, p) {
  const out = [];
  for (let page = 1; ; page++) {
    const list = await gh('GET', p + (p.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    if (!Array.isArray(list)) throw new Error('GET ' + p.split('?')[0] + ': not a list');
    out.push(...list);
    if (list.length < 100) return out;
  }
}

async function compare(list, request = ua.request) {
  const out = [];
  for (const x of list) {
    try {
      const r = await request(x.url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
      const got = Buffer.from(await r.arrayBuffer());
      const want = fs.readFileSync(path.join(SITE, x.file));
      if (r.status !== 200) out.push({ file: x.file, why: 'HTTP ' + r.status });
      else if (!got.equals(want)) out.push({ file: x.file, why: got.length + ' bytes served, ' + want.length + ' in main' });
    } catch (e) { out.push({ file: x.file, why: String(e.message || e) }); }
  }
  return out;
}

async function github(method, p, body) {
  const r = await ua.request('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + p, {
    method, headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(method + ' ' + p + ': HTTP ' + r.status);
  return r.status === 204 ? null : r.json();
}

/* One run: compare, wait and compare again while WAIT lasts, then open, update or close the one issue. */
async function run({ get = ua.request, gh = github, env = process.env, log = console.log, pause = sleep, files = served(walk(SITE)) } = {}) {
  const until = Date.now() + Number(env.WAIT || 0) * 1000;
  let bad = await compare(files, get);
  while (bad.length && Date.now() < until) { await pause(30000); bad = await compare(files, get); }
  for (const b of bad) log(b.file + '  ' + b.why);
  log(bad.length ? T.differ.replace('{d}', bad.length).replace('{n}', files.length) : T.same.replace('{n}', files.length));
  if (env.GITHUB_TOKEN && ['schedule', 'push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) {
    const when = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    const open = (await allPages(gh, '/issues?state=open')).find((i) => !i.pull_request && (i.body || '').startsWith(MARK));
    if (bad.length) {
      const body = MARK + '\n' + T.head.replace('{base}', BASE).replace('{when}', when) + '\n\n' + bad.slice(0, 50).map((b) => '- `' + b.file + '` ' + b.why).join('\n')
        + (bad.length > 50 ? '\n- …' : '') + '\n\n' + T.foot;
      if (open) await gh('PATCH', '/issues/' + open.number, { body });
      else await gh('POST', '/issues', { title: T.title, body });
    } else if (open) {
      await gh('POST', '/issues/' + open.number + '/comments', { body: MARK + '\n' + T.closed.replace('{when}', when) });
      await gh('PATCH', '/issues/' + open.number, { state: 'closed', state_reason: 'completed' });
    }
  }
  return bad.length;
}

module.exports = { served, matches, compare, run, allPages, BASE, CONF, MARK, TEXTS };
if (require.main === module) run().then((n) => { if (n) process.exit(1); }).catch((e) => { console.error(e.message); process.exit(1); });
