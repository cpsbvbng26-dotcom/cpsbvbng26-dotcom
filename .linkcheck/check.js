// One-off: fetch every external URL found in the repositories and record the HTTP status.
const fs = require('fs');
const urls = fs.readFileSync('.linkcheck/urls.txt', 'utf8').split('\n').filter(Boolean);
const UA = 'Mozilla/5.0 (link check; https://github.com/cpsbvbng26-dotcom)';
async function one(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(u, { method, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(30000) });
      if (method === 'HEAD' && (r.status === 405 || r.status === 403 || r.status === 404 || r.status >= 500)) continue;
      return { u, status: r.status, final: r.url };
    } catch (e) { if (method === 'GET') return { u, status: 0, error: String(e.cause && e.cause.code || e.message) }; }
  }
}
(async () => {
  const out = [];
  for (let i = 0; i < urls.length; i += 8) out.push(...await Promise.all(urls.slice(i, i + 8).map(one)));
  fs.writeFileSync('.linkcheck/result.json', JSON.stringify(out, null, 1));
  console.log(out.filter((r) => r.status !== 200).length, 'not 200 of', out.length);
})();
