// One-off: find the Sophaxis application in antleaf/doapr issues and pull requests.
const fs = require('fs');
const H = { 'User-Agent': 'index-check', Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + process.env.GITHUB_TOKEN };
(async () => {
  const out = {};
  for (const q of ['repo:antleaf/doapr sophaxis', 'repo:antleaf/doapr Sophaxis in:title,body,comments', 'sophaxis doapr']) {
    const r = await fetch('https://api.github.com/search/issues?q=' + encodeURIComponent(q), { headers: H });
    const b = await r.json();
    out[q] = { status: r.status, total: b.total_count, items: (b.items || []).map((i) => ({ url: i.html_url, state: i.state, created: i.created_at, title: i.title, comments: i.comments, labels: (i.labels || []).map((l) => l.name) })) };
  }
  const r = await fetch('https://api.github.com/repos/antleaf/doapr/issues?state=all&per_page=50&sort=created&direction=desc', { headers: H });
  const b = await r.json();
  out.recent = Array.isArray(b) ? b.map((i) => ({ url: i.html_url, state: i.state, created: i.created_at, title: i.title })) : b;
  fs.writeFileSync('.indexcheck/result.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
