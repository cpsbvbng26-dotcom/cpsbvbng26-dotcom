#!/usr/bin/env node
/* The heartbeat of the scheduled work (2026-11-15). For every workflow of the repositories that tools/heartbeat.json names,
 * it reads the workflow file from GitHub (main) and finds its schedules, then reads the public Actions API:
 *   - a scheduled workflow fails when it has had no successful scheduled run within twice its period, counted from the day
 *     its file first held a schedule on main when that is later, or when GitHub has stopped it (its state is not "active");
 *   - a yearly one (a schedule with a day and a month) fails when the issue it opens for its last day has not been opened,
 *     two days after that day, if the workflow existed on that day; heartbeat.json gives the title of that issue;
 *   - a job that tells IndexNow (it runs a script named indexnow.js), and a job of a workflow that asks the Internet Archive
 *     to save pages, fails when the last run in which it ran did not succeed;
 *   - a workflow that runs on a push to main fails when its last finished run on main (a cancelled one is passed over) did not
 *     succeed (in a workflow that holds this heartbeat, the job of the heartbeat is not counted: otherwise one failure of it
 *     would fail every later run, 2026-11-19), and a repository that heartbeat.json names under "vercel" fails when the status "Vercel" of the head of main is
 *     not success (pending is allowed for an hour after the commit).
 * Then it opens or updates one issue in this repository, or closes it when nothing fails. The issue holds fixed words and
 * counts only; which workflow failed is in the log of the run. It reads no issue text and writes none.
 *
 * This file is the same, byte for byte, in every repository that uses it; what differs is tools/heartbeat.json there:
 *   owner    the owner of the repositories
 *   repos    the repositories whose workflows are read
 *   only     where given, the only workflow files read in each repository it names
 *   yearly   "<repository>/<file>": the title of the issue of a yearly workflow, {year} for the year of its day in Japan time,
 *            and {year-1} for the year before
 *   lang     the language of the issue: "en" or "ja"
 *   vercel   the repositories whose head of main Vercel deploys and marks with the status "Vercel"
 *
 *   node tools/heartbeat.js          (GITHUB_TOKEN, GITHUB_REPOSITORY; GitHub Actions)
 *   node tools/heartbeat.js --test   the self-test, on answers made here
 */
'use strict';
const ua = require('./ua.js');
const fs = require('fs');
const path = require('path');

const CONF = JSON.parse(fs.readFileSync(path.join(__dirname, 'heartbeat.json'), 'utf8'));
const MARK = '<!-- heartbeat -->';
const HOUR = 3600 * 1000;
const GRACE_DAYS = 2;
const TEXTS = {
  en: { title: 'Scheduled work has stopped', head: 'The heartbeat of the scheduled work ({when}) found:', seen: 'workflows read', stale: 'scheduled workflows with no successful scheduled run within twice their period', stopped: 'scheduled workflows that GitHub has stopped', yearly: 'yearly workflows whose issue for their last day was not opened', watched: 'jobs that tell IndexNow or save to the Internet Archive whose last run did not succeed', push: 'workflows run on a push to main whose last run on main did not succeed', deploy: 'repositories whose head of main Vercel has not deployed with success', foot: 'The log of the run names them: {run}. This issue closes by itself when nothing fails.', closed: 'Nothing fails any more ({when}). Closing.' },
  ja: { title: '定期の仕事が止まっている', head: '定期の仕事の見張り（{when}）の結果です。', seen: '読んだワークフロー', stale: '周期の二倍のあいだ、定期の実行が一度も成功していない定期の仕事', stopped: 'GitHub が止めている定期の仕事', yearly: '最後の日の issue が開かれていない年に一度の仕事', watched: '最後の実行が成功していない、IndexNow に知らせる仕事と Internet Archive に保存させる仕事', push: 'main への push で動き、main での最後の実行が成功していないワークフロー', deploy: 'main の先を Vercel が成功して配っていないリポジトリ', foot: 'どの仕事かは、この実行の記録にあります：{run}。どれも落ちなくなれば、この issue はひとりでに閉じます。', closed: 'どれも落ちなくなりました（{when}）。閉じます。' },
};
const T = TEXTS[CONF.lang] || TEXTS.en;

/* ------------------------------------------------------------ the workflow file (pure) */

/* The jobs of a workflow file: their key, their name and their lines. The files are indented by two spaces. */
function jobsOf(text) {
  const lines = String(text).split('\n');
  const at = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const out = [];
  if (at < 0) return out;
  for (const l of lines.slice(at + 1)) {
    if (/^\S/.test(l)) break;
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (m) { out.push({ id: m[1], name: m[1], lines: [] }); continue; }
    if (!out.length) continue;
    const j = out[out.length - 1];
    j.lines.push(l);
    const n = /^ {4}name:\s*(.+?)\s*$/.exec(l);
    if (n) j.name = n[1].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out.map((j) => ({ id: j.id, name: j.name, text: j.lines.join('\n') }));
}

/* The cron expressions under `schedule:`; a comment line among them is passed over (a yearly workflow of the repositories has one). */
function cronsOf(text) {
  const m = /^ {2}schedule:\n((?: {4}(?:- cron: .*|#.*)\n?)+)/m.exec(String(text));
  return m ? [...m[1].matchAll(/^ {4}- cron: '([^']+)'/gm)].map((x) => x[1]) : [];
}

/* The period of a cron in hours, and its kind. Only the forms these repositories use are read; any other is an error. */
function periodOf(cron) {
  const f = String(cron).trim().split(/\s+/);
  if (f.length !== 5) throw new Error('not a cron: ' + cron);
  const [, h, dom, mon, dow] = f;
  const any = (x) => x === '*';
  if (any(dom) && any(mon) && any(dow)) {
    if (any(h)) return { kind: 'hourly', hours: 1 };
    const step = /^\*\/(\d+)$/.exec(h);
    if (step) return { kind: 'hourly', hours: Number(step[1]) };
    return { kind: 'daily', hours: 24 };
  }
  if (any(dom) && any(mon) && /^\d$/.test(dow)) return { kind: 'weekly', hours: 7 * 24 };
  if (/^\d+$/.test(dom) && any(mon) && any(dow)) return { kind: 'monthly', hours: 31 * 24 };
  if (/^\d+$/.test(dom) && /^\d+$/.test(mon) && any(dow)) return { kind: 'yearly', hours: 366 * 24 };
  throw new Error('a cron of a form the heartbeat does not read: ' + cron);
}

/* The last time before `now` that a yearly cron fired (UTC, as GitHub reads a cron). */
function lastYearly(cron, now) {
  const [m, h, dom, mon] = String(cron).trim().split(/\s+/).map(Number);
  const y = new Date(now).getUTCFullYear();
  for (const year of [y, y - 1]) {
    const t = Date.UTC(year, mon - 1, dom, h, m);
    if (t <= now) return t;
  }
  return Date.UTC(y - 2, mon - 1, dom, h, m);
}

/* The jobs watched beyond the schedules: one that runs a script named indexnow.js, and every job of a workflow that asks the
 * Internet Archive to save pages. */
function watchedJobs(text) {
  const saves = /web\.archive\.org\/save/.test(String(text));
  return jobsOf(text).filter((j) => /\bindexnow\.js\b/.test(j.text) || saves).map((j) => ({ id: j.id, name: j.name }));
}

/* Whether a workflow runs on a push to main: a push without branches, or with main among them. */
function onPushToMain(text) {
  const on = (/^on:\n((?: {2}.*\n|\n)*)/m.exec(String(text) + '\n') || [])[1] || '';
  const m = /^ {2}push:\s*\n((?: {4}.*\n)*)/m.exec(on) || /^ {2}push:\s*$/m.exec(on);
  if (!m) return false;
  const b = /branches: \[([^\]]*)\]/.exec(m[1] || '');
  return !b || b[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).includes('main');
}

/* The names of the jobs of a workflow file that run this heartbeat: a step "run: node tools/heartbeat.js". A comment that
 * names the file does not count; the comment above a job is read as a line of the job before it. */
function heartbeatJobs(text) {
  return jobsOf(text).filter((j) => /^\s*(?:-\s+)?run:\s*node\s+tools\/heartbeat\.js\s*$/m.test(j.text)).map((j) => j.name);
}

/* The conclusion of the last push run on main. In a workflow that holds this heartbeat, the job of the heartbeat is not
 * counted: it judges the run before, so a failure of it would fail the next run, and that one the next, without end. The
 * other jobs decide; when the run did not succeed, the first of them that did not succeed gives the conclusion. */
function pushConclusionOf(run, jobs, own) {
  if (!run) return null;
  if (!own.length || run.conclusion === 'success') return run.conclusion || null;
  if (!Array.isArray(jobs)) throw new Error('the jobs of a run could not be read');
  const bad = jobs.filter((j) => !own.includes(j.name)).find((j) => j.conclusion && !['success', 'skipped', 'neutral'].includes(j.conclusion));
  return bad ? bad.conclusion : 'success';
}

/* The title of the issue of a yearly workflow, for the year of its day in Japan time. */
function yearlyTitle(pattern, t) {
  const y = new Date(t + 9 * HOUR).getUTCFullYear();
  return String(pattern).split('{year-1}').join(String(y - 1)).split('{year}').join(String(y));
}

/* ------------------------------------------------------------ the judgement (pure) */

/* One entry per workflow read: { repo, file, crons, state, created, lastSuccess, yearlyDue, yearlyFound, watched: [{ name, conclusion }] }.
 * Returns the findings: { repo, file, what } with what one of stale, stopped, yearly, watched. */
function judge(entries, now) {
  const out = [];
  for (const e of entries) {
    if (e.crons.length) {
      const p = e.crons.map(periodOf).sort((a, b) => a.hours - b.hours)[0];
      if (e.state !== 'active') out.push({ repo: e.repo, file: e.file, what: 'stopped' });
      else if (p.kind === 'yearly') { if (e.yearlyDue && !e.yearlyFound) out.push({ repo: e.repo, file: e.file, what: 'yearly' }); }
      else {
        const since = Math.max(Date.parse(e.lastSuccess || 0) || 0, Date.parse(e.created || 0) || 0);
        if (now - since > 2 * p.hours * HOUR) out.push({ repo: e.repo, file: e.file, what: 'stale' });
      }
    }
    for (const w of e.watched || []) if (w.conclusion && w.conclusion !== 'success') out.push({ repo: e.repo, file: e.file, what: 'watched', job: w.name });
    if (e.pushConclusion && !['success', 'skipped', 'neutral'].includes(e.pushConclusion)) out.push({ repo: e.repo, file: e.file, what: 'push' });
    if (e.deploy === false) out.push({ repo: e.repo, file: e.file, what: 'deploy' });
  }
  return out;
}

/* Pure: whether the status "Vercel" of the head of main is fine: success, or pending within an hour of the commit. */
function deployFine(status, committed, now) {
  const v = ((status && status.statuses) || []).find((s) => s.context === 'Vercel');
  if (!v) return false;
  return v.state === 'success' || (v.state === 'pending' && now - Date.parse(committed) < HOUR);
}

/* The issue: fixed words and counts. */
function issueBody(findings, seen, when, run) {
  const n = (k) => findings.filter((f) => f.what === k).length;
  return [MARK, T.head.replace('{when}', when), '',
    '- ' + T.seen + ': ' + seen,
    '- ' + T.stale + ': ' + n('stale'),
    '- ' + T.stopped + ': ' + n('stopped'),
    '- ' + T.yearly + ': ' + n('yearly'),
    '- ' + T.watched + ': ' + n('watched'),
    '- ' + T.push + ': ' + n('push'),
    '- ' + T.deploy + ': ' + n('deploy'),
    '', T.foot.replace('{run}', run)].join('\n');
}

/* ------------------------------------------------------------ GitHub */

/* The GitHub API. A GET refused to the token (401 or 403: the token of a run may not read another repository) is asked again
 * without it; a 404 is an answer, "not there", and is never asked again (2026-11-15: a workflow file removed from main gave 404,
 * the question was asked again without the token, the anonymous limit answered 403, and the run stopped). */
function makeApi(request = ua.request, token = process.env.GITHUB_TOKEN) {
  const call = async (p, { method = 'GET', body, auth = true } = {}) => {
    const headers = { Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = 'Bearer ' + token;
    const r = await request('https://api.github.com' + p, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    if (auth && token && method === 'GET' && [401, 403].includes(r.status)) return call(p, { method, body, auth: false });
    if (r.status === 404) return null;
    if (!r.ok) {
      const left = r.headers && typeof r.headers.get === 'function' ? r.headers.get('x-ratelimit-remaining') : null;
      throw new Error(method + ' ' + p.split('?')[0] + ': HTTP ' + r.status + (auth && token ? '' : ' without the token') + (left === '0' ? ' (the rate limit is used up)' : ''));
    }
    return r.status === 204 ? null : r.json();
  };
  return call;
}
const api = makeApi();

/* Every page of a list on GitHub, to the end; an answer that is not a list stops the run, never read as an empty list. */
async function allPages(gh, p) {
  const out = [];
  for (let page = 1; ; page++) {
    const list = await gh('GET', p + (p.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    if (!Array.isArray(list)) throw new Error('GET ' + p.split('?')[0] + ': not a list');
    out.push(...list);
    if (list.length < 100) return out;
  }
}

/* The day the file first held a schedule on main: its commits, newest first, are read back while their file has one. */
async function scheduleSince(get, base, file) {
  const commits = (await get(base + '/commits?sha=main&path=' + encodeURIComponent(file) + '&per_page=30')) || [];
  if (!Array.isArray(commits)) throw new Error(file + ': the commits could not be read');
  let since = null;
  for (const c of commits) {
    const x = await get(base + '/contents/' + file + '?ref=' + c.sha);
    if (!x || !cronsOf(Buffer.from(x.content || '', 'base64').toString('utf8')).length) break;
    since = c.commit.committer.date;
  }
  return since;
}

/* Everything the judgement reads, from GitHub. Any answer that cannot be read stops the run: it is not taken as success. */
async function gather(get = api, now = Date.now()) {
  const entries = [];
  for (const repo of CONF.repos) {
    const base = '/repos/' + CONF.owner + '/' + repo;
    const list = ((await get(base + '/actions/workflows?per_page=100')) || {}).workflows;
    if (!Array.isArray(list)) throw new Error(repo + ': the workflows could not be read');
    /* GitHub goes on listing a workflow whose file was removed from main. Only the files that main holds are read. */
    const dir = await get(base + '/contents/.github/workflows?ref=main');
    if (dir !== null && !Array.isArray(dir)) throw new Error(repo + ': the files of .github/workflows could not be read');
    const held = new Set((dir || []).filter((x) => x.type === 'file').map((x) => x.name));
    for (const w of list.filter((x) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(x.path) && held.has(x.path.split('/').pop()))) {
      const file = w.path.split('/').pop();
      if (CONF.only && CONF.only[repo] && !CONF.only[repo].includes(file)) continue;
      if (CONF.only && !CONF.only[repo]) continue;
      const c = await get(base + '/contents/' + w.path + '?ref=main');
      if (!c) continue;
      const text = Buffer.from(c.content || '', 'base64').toString('utf8');
      const e = { repo, file, crons: cronsOf(text), state: w.state, created: w.created_at, lastSuccess: null, yearlyDue: false, yearlyFound: false, watched: [] };
      const watched = watchedJobs(text);
      const pushed = onPushToMain(text);
      if (!e.crons.length && !watched.length && !pushed) continue;
      if (pushed) {
        const runs = await get(base + '/actions/workflows/' + w.id + '/runs?branch=main&event=push&status=completed&per_page=10');
        if (!runs || !Array.isArray(runs.workflow_runs)) throw new Error(repo + '/' + file + ': the runs on main could not be read');
        const last = runs.workflow_runs.find((r) => r.conclusion !== 'cancelled');
        const own = heartbeatJobs(text);
        const jobs = last && own.length && last.conclusion !== 'success' ? ((await get(base + '/actions/runs/' + last.id + '/jobs?per_page=100')) || {}).jobs : [];
        e.pushConclusion = pushConclusionOf(last, jobs, own);
      }
      if (e.crons.length) {
        e.created = (await scheduleSince(get, base, w.path)) || w.created_at;
        const p = e.crons.map(periodOf).sort((a, b) => a.hours - b.hours)[0];
        if (p.kind === 'yearly') {
          const day = Math.max(...e.crons.map((x) => lastYearly(x, now)));
          e.yearlyDue = day > Date.parse(e.created) && now - day > GRACE_DAYS * 24 * HOUR;
          if (e.yearlyDue) {
            const pattern = (CONF.yearly || {})[repo + '/' + file];
            if (!pattern) throw new Error(repo + '/' + file + ': a yearly workflow without the title of its issue in heartbeat.json');
            const title = yearlyTitle(pattern, day);
            const issues = await allPages((m, p) => get(p), base + '/issues?state=all&since=' + new Date(day).toISOString());
            e.yearlyFound = issues.some((i) => !i.pull_request && i.title === title);
          }
        } else {
          const runs = await get(base + '/actions/workflows/' + w.id + '/runs?event=schedule&status=success&per_page=1');
          if (!runs || !Array.isArray(runs.workflow_runs)) throw new Error(repo + '/' + file + ': the runs could not be read');
          e.lastSuccess = runs.workflow_runs.length ? runs.workflow_runs[0].created_at : null;
        }
      }
      if (watched.length) {
        const runs = ((await get(base + '/actions/workflows/' + w.id + '/runs?status=completed&per_page=10')) || {}).workflow_runs || [];
        for (const j of watched) {
          let conclusion = null;
          for (const r of runs) {
            const jobs = ((await get(base + '/actions/runs/' + r.id + '/jobs?per_page=100')) || {}).jobs || [];
            const hit = jobs.find((x) => x.name === j.name && x.conclusion && x.conclusion !== 'skipped');
            if (hit) { conclusion = hit.conclusion; break; }
          }
          e.watched.push({ name: j.name, conclusion });
        }
      }
      entries.push(e);
    }
    if ((CONF.vercel || []).includes(repo)) {
      const head = await get(base + '/commits/main');
      const status = await get(base + '/commits/main/status');
      if (!head || !status) throw new Error(repo + ': the head of main or its status could not be read');
      entries.push({ repo, file: '(Vercel)', crons: [], watched: [], deploy: deployFine(status, head.commit.committer.date, now) });
    }
  }
  return entries;
}

async function main() {
  const now = Date.now();
  const entries = await gather(api, now);
  const findings = judge(entries, now);
  for (const f of findings) console.log(f.repo + '/' + f.file + ': ' + f.what + (f.job ? ' (' + f.job + ')' : ''));
  console.log(entries.length + ' workflows read; ' + findings.length + ' failing');
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    const when = new Date(now).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    const run = (process.env.GITHUB_SERVER_URL || 'https://github.com') + '/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + (process.env.GITHUB_RUN_ID || '');
    const own = '/repos/' + process.env.GITHUB_REPOSITORY;
    const open = (await allPages((m, p) => api(p), own + '/issues?state=open')).find((i) => !i.pull_request && (i.body || '').startsWith(MARK));
    if (findings.length) {
      const body = issueBody(findings, entries.length, when, run);
      if (open) await api(own + '/issues/' + open.number, { method: 'PATCH', body: { body } });
      else await api(own + '/issues', { method: 'POST', body: { title: T.title, body } });
    } else if (open) {
      await api(own + '/issues/' + open.number + '/comments', { method: 'POST', body: { body: MARK + '\n' + T.closed.replace('{when}', when) } });
      await api(own + '/issues/' + open.number, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
    }
  }
  if (findings.length) process.exit(1);
}

/* ------------------------------------------------------------ the self-test, on answers made here */

async function selfTest() {
  let passed = 0;
  const failed = [];
  const t = (label, ok) => { if (ok) passed++; else failed.push(label); console.log((ok ? '  ok    ' : '  FAIL  ') + label); };
  const now = Date.parse('2026-11-20T12:00:00Z');
  const day = 24 * HOUR;
  const iso = (ms) => new Date(ms).toISOString();
  const wf = (crons, extra = '') => 'name: x\non:\n' + (crons.length ? '  schedule:\n' + crons.map((c) => "    - cron: '" + c + "'\n").join('') : '  workflow_dispatch:\n') + 'permissions:\n  contents: read\njobs:\n  a:\n    name: The job\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo' + extra + '\n';
  t('the schedules of a file are read, also past a comment line among them, and their periods', cronsOf(wf(['17 0 * * *', '7 5 * * 1'])).join() === '17 0 * * *,7 5 * * 1'
    && cronsOf("on:\n  schedule:\n    # once a year\n    - cron: '17 0 7 11 *'\n  workflow_dispatch:\n").join() === '17 0 7 11 *'
    && ['17 0 * * *', '7 5 * * 1', '23 5 9 * *', '17 0 30 10 *', '0 */4 * * *'].map((c) => periodOf(c).kind).join() === 'daily,weekly,monthly,yearly,hourly');
  let threw = false;
  try { periodOf('0 0 1-7 * 1'); } catch (e) { threw = true; }
  t('a cron of another form stops the run instead of being guessed', threw);
  t('the jobs that tell IndexNow or save to the Internet Archive are found from the file', watchedJobs(wf([], '\n      - run: node tools/indexnow.js')).map((j) => j.name).join() === 'The job'
    && watchedJobs(wf([], '\n      - run: curl https://web.archive.org/save/x')).length === 1 && watchedJobs(wf(['17 0 * * *'])).length === 0);
  const ok = { repo: 'r', file: 'daily.yml', crons: ['17 0 * * *'], state: 'active', created: iso(now - 100 * day), lastSuccess: iso(now - 1 * day), watched: [] };
  t('a daily workflow that succeeded yesterday passes', judge([ok], now).length === 0);
  t('a daily workflow whose last success is three days old fails (break on purpose: a stale schedule)', judge([Object.assign({}, ok, { lastSuccess: iso(now - 3 * day) })], now).map((f) => f.what).join() === 'stale');
  t('a daily workflow that never succeeded fails once it is older than two days, and not before', judge([Object.assign({}, ok, { lastSuccess: null })], now).length === 1
    && judge([Object.assign({}, ok, { lastSuccess: null, created: iso(now - 1 * day) })], now).length === 0);
  t('a weekly workflow is given fourteen days, a monthly one sixty-two', judge([Object.assign({}, ok, { crons: ['7 5 * * 1'], lastSuccess: iso(now - 13 * day) })], now).length === 0
    && judge([Object.assign({}, ok, { crons: ['7 5 * * 1'], lastSuccess: iso(now - 15 * day) })], now).length === 1
    && judge([Object.assign({}, ok, { crons: ['23 5 9 * *'], lastSuccess: iso(now - 61 * day) })], now).length === 0
    && judge([Object.assign({}, ok, { crons: ['23 5 9 * *'], lastSuccess: iso(now - 63 * day) })], now).length === 1);
  t('a workflow that GitHub stopped fails, whatever its runs', judge([Object.assign({}, ok, { state: 'disabled_inactivity' })], now).map((f) => f.what).join() === 'stopped');
  const y = { repo: 'r', file: 'yearly.yml', crons: ['17 0 30 10 *'], state: 'active', created: iso(now - 400 * day), yearlyDue: true, yearlyFound: false, watched: [] };
  t('a yearly workflow whose issue was not opened fails, and passes once it is', judge([y], now).map((f) => f.what).join() === 'yearly' && judge([Object.assign({}, y, { yearlyFound: true })], now).length === 0
    && judge([Object.assign({}, y, { yearlyDue: false })], now).length === 0);
  t('the last day of a yearly cron, and the title of its issue', iso(lastYearly('17 0 30 10 *', now)) === '2026-10-30T00:17:00.000Z' && iso(lastYearly('23 3 2 1 *', now)) === '2026-01-02T03:23:00.000Z'
    && yearlyTitle('Yearly audit, {year}', lastYearly('17 0 30 10 *', now)) === 'Yearly audit, 2026' && yearlyTitle('Decisions of {year-1}', lastYearly('23 3 2 1 *', now)) === 'Decisions of 2025');
  t('a job that tells IndexNow fails when its last run failed, and not when it succeeded or never ran',
    judge([{ repo: 'r', file: 'i.yml', crons: [], watched: [{ name: 'IndexNow', conclusion: 'failure' }] }], now).map((f) => f.what).join() === 'watched'
    && judge([{ repo: 'r', file: 'i.yml', crons: [], watched: [{ name: 'IndexNow', conclusion: 'success' }, { name: 'x', conclusion: null }] }], now).length === 0);
  t('a workflow that runs on a push to main is found from the file, with or without branches; one on other branches is not',
    onPushToMain('on:\n  push:\n    branches: [main]\n') && onPushToMain('on:\n  push:\n  pull_request:\n') && !onPushToMain("on:\n  push:\n    branches: ['claude/x-*']\n") && !onPushToMain('on:\n  schedule:\n'));
  {
    const two = 'name: x\non:\n  push:\n    branches: [main]\njobs:\n  check:\n    name: The check\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n  # the heartbeat (tools/heartbeat.js) below\n  beat:\n    name: The heartbeat\n    runs-on: ubuntu-latest\n    steps:\n      - run: node tools/heartbeat.js\n';
    const own = heartbeatJobs(two);
    const fail = { id: 9, conclusion: 'failure' };
    t('a push run of the workflow that holds the heartbeat is judged without the job of the heartbeat: its own failure passes, a failure of another job fails, and a comment naming the file does not make a job the heartbeat (break on purpose: the other job fails)',
      own.join() === 'The heartbeat' && heartbeatJobs(wf([])).length === 0
      && pushConclusionOf(fail, [{ name: 'The check', conclusion: 'success' }, { name: 'The heartbeat', conclusion: 'failure' }], own) === 'success'
      && pushConclusionOf(fail, [{ name: 'The check', conclusion: 'failure' }, { name: 'The heartbeat', conclusion: 'success' }], own) === 'failure'
      && pushConclusionOf(fail, [{ name: 'The check', conclusion: 'success' }], []) === 'failure'
      && pushConclusionOf({ id: 8, conclusion: 'success' }, undefined, own) === 'success' && pushConclusionOf(undefined, [], own) === null
      && (() => { try { pushConclusionOf(fail, null, own); return false; } catch (e) { return true; } })());
  }
  t('the last run on main of a workflow run on a push fails when it failed, and passes when it succeeded or was skipped (break on purpose: a failed push run)',
    judge([{ repo: 'r', file: 'p.yml', crons: [], watched: [], pushConclusion: 'failure' }], now).map((f) => f.what).join() === 'push' && judge([{ repo: 'r', file: 'p.yml', crons: [], watched: [], pushConclusion: 'success' }], now).length === 0);
  const st = (state) => ({ statuses: [{ context: 'Vercel', state }] });
  t('the status "Vercel" of the head of main: success passes; failure, none, and pending after an hour fail; pending within the hour passes',
    deployFine(st('success'), iso(now), now) && !deployFine(st('failure'), iso(now), now) && !deployFine({ statuses: [] }, iso(now), now) && !deployFine(st('pending'), iso(now - 2 * HOUR), now) && deployFine(st('pending'), iso(now - 10 * 60000), now)
    && judge([{ repo: 'r', file: '(Vercel)', crons: [], watched: [], deploy: false }], now).map((f) => f.what).join() === 'deploy');
  t('every list is read to its end: an issue on the fourth page is found, and a page that is not a list stops the run',
    await (async () => { const pages = [1, 2, 3].map((k) => Array.from({ length: 100 }, (_, i) => ({ number: k * 1000 + i, body: 'x' }))).concat([[{ number: 4001, body: MARK }]]); const got = await allPages(async (m, p) => pages[Number(/&page=(\d+)/.exec(p)[1]) - 1], '/issues?state=open'); return got.find((i) => (i.body || '').startsWith(MARK)).number === 4001; })()
    && await allPages(async () => null, '/x').then(() => false, () => true));
  /* gather() on answers made here: the files, the workflows, the runs and the issues. */
  const A = {
    workflows: { workflows: [{ id: 1, path: '.github/workflows/daily.yml', state: 'active', created_at: iso(now - 100 * day) }, { id: 2, path: '.github/workflows/push.yml', state: 'active', created_at: iso(now - 100 * day) },
      { id: 3, path: '.github/workflows/indexnow.yml', state: 'active', created_at: iso(now - 100 * day) }, { id: 4, path: 'dynamic/pages/pages-build-deployment', state: 'active', created_at: iso(now) }] },
    files: { 'daily.yml': wf(['17 0 * * *']), 'push.yml': wf([]), 'indexnow.yml': wf([], '\n      - run: node tools/indexnow.js') },
    runs: { 1: [{ id: 11, created_at: iso(now - 5 * day) }], 3: [{ id: 31 }, { id: 32 }] },
    /* daily.yml: its schedule came in the second commit of three, 40 days ago; the first had none. */
    commits: [{ sha: 'c3', commit: { committer: { date: iso(now - 10 * day) } } }, { sha: 'c2', commit: { committer: { date: iso(now - 40 * day) } } }, { sha: 'c1', commit: { committer: { date: iso(now - 90 * day) } } }],
    at: { c3: wf(['17 0 * * *']), c2: wf(['17 0 * * *']), c1: wf([]) },
    jobs: { 31: [{ name: 'The job', conclusion: 'skipped' }], 32: [{ name: 'The job', conclusion: 'failure' }] },
  };
  /* gone.yml: GitHub still lists it, but main no longer holds its file; its contents answer 404. */
  A.workflows.workflows.push({ id: 5, path: '.github/workflows/gone.yml', state: 'active', created_at: iso(now - 100 * day) });
  const asked = [];
  const fake = async (p) => {
    asked.push(p);
    if (/\/actions\/workflows\?/.test(p)) return A.workflows;
    if (/\/contents\/\.github\/workflows\?ref=main$/.test(p)) return Object.keys(A.files).map((name) => ({ name, type: 'file' }));
    if (/\/contents\/\.github\/workflows\/gone\.yml/.test(p)) return null;
    let m = /\/contents\/\.github\/workflows\/([^?]+)\?ref=main$/.exec(p);
    if (m) return { content: Buffer.from(A.files[m[1]]).toString('base64') };
    if (/\/commits\?sha=main&path=/.test(p)) return A.commits;
    m = /\/contents\/\.github\/workflows\/[^?]+\?ref=(c\d)$/.exec(p);
    if (m) return { content: Buffer.from(A.at[m[1]]).toString('base64') };
    m = /\/actions\/workflows\/(\d+)\/runs\?/.exec(p);
    if (m) return { workflow_runs: A.runs[m[1]] || [] };
    m = /\/actions\/runs\/(\d+)\/jobs/.exec(p);
    if (m) return { jobs: A.jobs[m[1]] || [] };
    throw new Error('not answered: ' + p);
  };
  const keep = CONF.repos;
  CONF.repos = ['r'];
  const only = CONF.only;
  CONF.only = undefined;
  const got = await gather(fake, now);
  CONF.repos = keep;
  CONF.only = only;
  const fs2 = judge(got, now);
  t('gather reads only the workflows with a schedule or a watched job, counts a schedule from the first commit that held it, and the judgement finds the stale schedule and the failed IndexNow job (fixture answers)',
    got.map((e) => e.file).join() === 'daily.yml,indexnow.yml' && got[0].created === iso(now - 40 * day) && fs2.map((f) => f.file + ':' + f.what).join() === 'daily.yml:stale,indexnow.yml:watched');
  t('a workflow that GitHub still lists but whose file main no longer holds is passed over, and its file is not asked for (fixture answers)',
    !got.some((e) => e.file === 'gone.yml') && !asked.some((p) => /gone\.yml/.test(p)));
  /* The API itself, on answers made here: a 404 is "not there" and is not asked again; a 401 or 403 to the token is asked again
   * without it; an anonymous 403 stops the run and says why. */
  const reply = (status, json, left) => ({ status, ok: status >= 200 && status < 300, json: async () => json, headers: { get: (k) => (k === 'x-ratelimit-remaining' ? left : null) } });
  const seen = [];
  const answers = { '/gone': [reply(404), reply(403, {}, '0')], '/other': [reply(403), reply(200, [1])], '/limit': [reply(403), reply(403, {}, '0')] };
  const req = async (url, o) => { const p = url.replace('https://api.github.com', ''); seen.push(p + (o.headers.Authorization ? ' token' : ' anonymous')); return answers[p].shift(); };
  const A2 = makeApi(req, 'tok');
  const gone = await A2('/gone');
  const other = await A2('/other');
  let why = '';
  try { await A2('/limit'); } catch (e) { why = e.message; }
  t('the API: a 404 to the token is "not there" and is not asked again without it; a 403 is asked again without it; an anonymous 403 stops the run and names the rate limit (fixture answers)',
    gone === null && seen.filter((s) => s.startsWith('/gone')).join() === '/gone token' && Array.isArray(other) && other[0] === 1
    && seen.filter((s) => s.startsWith('/other')).join() === '/other token,/other anonymous' && /HTTP 403 without the token \(the rate limit is used up\)/.test(why));
  /* The schedule came a day ago, in the last commit; the commit before had none. It has not run yet. */
  A.runs[1] = [];
  A.commits = [{ sha: 'c5', commit: { committer: { date: iso(now - 1 * day) } } }, { sha: 'c4', commit: { committer: { date: iso(now - 30 * day) } } }];
  A.at.c5 = wf(['17 0 * * *']);
  A.at.c4 = wf([]);
  CONF.repos = ['r'];
  CONF.only = undefined;
  const young = await gather(fake, now);
  CONF.repos = keep;
  CONF.only = only;
  t('a schedule added a day ago that has not run yet does not fail (fixture answers)', young[0].created === iso(now - 1 * day) && judge(young, now).filter((f) => f.what === 'stale').length === 0);
  const body = issueBody(fs2, got.length, '2026-11-20 12:00 UTC', 'https://example.invalid/run');
  t('the issue holds fixed words and counts only, and names no workflow', body.startsWith(MARK) && !/daily\.yml|indexnow\.yml/.test(body) && /: 1$/m.test(body));
  let stopped = false;
  try { await gather(async () => { throw new Error('HTTP 502'); }, now); } catch (e) { stopped = true; }
  t('an answer that cannot be read stops the run instead of passing', stopped);
  t('heartbeat.json names an owner and the repositories, and every yearly title has {year}',
    typeof CONF.owner === 'string' && Array.isArray(CONF.repos) && CONF.repos.length > 0 && Object.values(CONF.yearly || {}).every((x) => /\{year(-1)?\}/.test(x)));
  console.log(passed + ' passed, ' + failed.length + ' failed');
  if (failed.length) process.exit(1);
}

module.exports = { makeApi, allPages, onPushToMain, heartbeatJobs, pushConclusionOf, deployFine, jobsOf, cronsOf, periodOf, lastYearly, watchedJobs, yearlyTitle, judge, issueBody, gather, CONF, MARK, TEXTS };
if (require.main === module) (process.argv.includes('--test') ? selfTest() : main()).catch((e) => { console.error(e.message); process.exit(1); });
