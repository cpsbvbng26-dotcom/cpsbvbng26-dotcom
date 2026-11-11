// One-off: find Sophaxis in DOAPR. Saves every link and text snippet around "sophaxis".
const fs = require('fs');
const UA = { 'User-Agent': 'index-check/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom)' };
const urls = ['https://doapr.coar-repositories.org/repositories/?q=sophaxis', 'https://doapr.coar-repositories.org/repositories/?search=sophaxis',
  'https://doapr.coar-repositories.org/repositories/', 'https://doapr.coar-repositories.org/api/repositories/?search=sophaxis', 'https://doapr.coar-repositories.org/'];
(async () => {
  const out = {};
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      const hits = [];
      const re = /sophaxis/gi; let m;
      while ((m = re.exec(t)) && hits.length < 30) hits.push(t.slice(Math.max(0, m.index - 300), m.index + 200).replace(/\s+/g, ' '));
      const links = [...new Set((t.match(/href="[^"]*"/g) || []))].slice(0, 300);
      out[u] = { status: r.status, final: r.url, length: t.length, hits, links };
    } catch (e) { out[u] = String(e.message); }
  }
  fs.writeFileSync('.indexcheck/result.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
