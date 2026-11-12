// One-off: find Internet Archive snapshots of the OAD Disciplinary repositories page and whether they list Sophaxis.
const fs = require('fs');
const UA = { 'User-Agent': 'index-check/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom)' };
const PAGE = 'oad.simmons.edu/oadwiki/Disciplinary_repositories';
(async () => {
  const out = { at: new Date().toISOString(), snaps: [] };
  try {
    const r = await fetch('https://web.archive.org/cdx/search/cdx?url=' + encodeURIComponent(PAGE) + '&output=json&from=20261101&filter=statuscode:200', { headers: UA, signal: AbortSignal.timeout(60000) });
    const rows = await r.json();
    out.cdxStatus = r.status;
    for (const row of rows.slice(1).slice(-6)) {
      const ts = row[1];
      const u = 'https://web.archive.org/web/' + ts + 'id_/https://' + PAGE;
      try {
        const p = await fetch(u, { headers: UA, signal: AbortSignal.timeout(60000) });
        const t = await p.text();
        const i = t.search(/sophaxis/i);
        let head = null;
        if (i >= 0) { const before = t.slice(0, i); const hs = [...before.matchAll(/<span class="mw-headline" id="([^"]+)">([^<]+)</g)]; head = hs.length ? hs[hs.length - 1].slice(1, 3) : null; }
        const all = [...t.matchAll(/sophaxis/gi)].length;
        out.snaps.push({ ts, status: p.status, hits: all, lastHeadingBeforeFirstHit: head, sample: i >= 0 ? t.slice(Math.max(0, i - 300), i + 150).replace(/\s+/g, ' ') : null });
      } catch (e) { out.snaps.push({ ts, error: e.message }); }
    }
  } catch (e) { out.error = e.message; }
  fs.writeFileSync('.indexcheck/result.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
