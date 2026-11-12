// One-off: is Sophaxis on the Open Access Directory's Disciplinary repositories page, and under which headings?
const fs = require('fs');
const UA = { 'User-Agent': 'index-check/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom)' };
(async () => {
  const out = { at: new Date().toISOString() };
  for (const u of ['https://oad.simmons.edu/oadwiki/Disciplinary_repositories', 'https://oad.simmons.edu/oadwiki/index.php?title=Disciplinary_repositories&action=raw']) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30000) });
      const t = await r.text();
      const hits = [];
      const re = /sophaxis/gi; let m;
      while ((m = re.exec(t)) && hits.length < 10) hits.push(t.slice(Math.max(0, m.index - 400), m.index + 200).replace(/\s+/g, ' '));
      const heads = [...t.matchAll(/<span class="mw-headline" id="([^"]+)">([^<]+)</g)].map((x) => [x[1], x[2]]);
      const rawHeads = [...t.matchAll(/^=+\s*([^=]+?)\s*=+\s*$/gm)].map((x) => x[1]);
      out[u] = { status: r.status, final: r.url, length: t.length, cloudflare: /cf_chl|challenge-platform/.test(t), hits, heads: heads.slice(0, 80), rawHeads: rawHeads.slice(0, 80) };
    } catch (e) { out[u] = String(e.message); }
  }
  fs.writeFileSync('.indexcheck/result.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
