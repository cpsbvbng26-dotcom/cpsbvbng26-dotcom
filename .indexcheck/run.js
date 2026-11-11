// One-off: query public scholarly indexes for the owner's works. Results go to .indexcheck/result.json.
const fs = require('fs');
const DOIS = ['10.2139/ssrn.7358779','10.2139/ssrn.7358818','10.2139/ssrn.7446961','10.2139/ssrn.7449338','10.2139/ssrn.7537983',
 '10.5281/zenodo.22055709','10.5281/zenodo.22057583','10.5281/zenodo.22058254','10.5281/zenodo.22058624','10.5281/zenodo.22058777','10.5281/zenodo.22058964','10.5281/zenodo.22064241','10.5281/zenodo.22335676','10.5281/zenodo.22335692','10.5281/zenodo.22685687','10.5281/zenodo.22765695','10.5281/zenodo.23114131','10.5281/zenodo.24033082','10.5281/zenodo.24033372','10.5281/zenodo.24033459','10.5281/zenodo.24033597','10.5281/zenodo.24033809','10.5281/zenodo.24033961','10.5281/zenodo.24034131','10.5281/zenodo.24034360','10.6084/m9.figshare.34419198'];
const UA = { 'User-Agent': 'index-check (mailto:noreply@example.invalid)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(u, h = {}) { try { const r = await fetch(u, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(30000) }); const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = t.slice(0, 300); } return { s: r.status, b }; } catch (e) { return { s: 0, e: String(e.cause && e.cause.code || e.message) }; } }
(async () => {
  const out = { at: new Date().toISOString(), works: {}, other: {} };
  for (const d of DOIS) {
    const w = {};
    let r = await j('https://api.openalex.org/works/doi:' + d); w.openalex = r.s === 200 ? { id: r.b.id, cited: r.b.cited_by_count, type: r.b.type, title: (r.b.title || '').slice(0, 80) } : r.s;
    await sleep(300);
    r = await j('https://api.semanticscholar.org/graph/v1/paper/DOI:' + d + '?fields=title,citationCount,externalIds'); w.s2 = r.s === 200 ? { cited: r.b.citationCount, title: (r.b.title || '').slice(0, 80) } : r.s;
    await sleep(1200);
    r = await j('https://opencitations.net/index/api/v2/citation-count/doi:' + d); w.opencitations = r.s === 200 && Array.isArray(r.b) ? r.b[0] && r.b[0].count : r.s;
    r = await j('https://api.openaire.eu/search/researchProducts?doi=' + encodeURIComponent(d) + '&format=json'); w.openaire = r.s === 200 ? ((((r.b || {}).response || {}).header || {}).total || {}).$ : r.s;
    out.works[d] = w;
  }
  out.other.openalex_author = (await j('https://api.openalex.org/authors?filter=orcid:0009-0000-1406-0547')).b;
  if (out.other.openalex_author && out.other.openalex_author.results) out.other.openalex_author = out.other.openalex_author.results.map((a) => ({ id: a.id, name: a.display_name, works: a.works_count, cited: a.cited_by_count }));
  out.other.s2_author = (await j('https://api.semanticscholar.org/graph/v1/author/search?query=Takuya%20Nemoto&fields=name,paperCount,citationCount,externalIds')).b;
  for (const q of ['Sophaxis', 'Nusquama', 'Takuya Nemoto', '根本卓哉']) out.other['wikidata_' + q] = ((await j('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' + encodeURIComponent(q) + '&language=en&format=json')).b || {}).search;
  out.other.core_sophaxis = (await j('https://api.core.ac.uk/v3/search/works?q=sophaxis&limit=5'));
  out.other.core_author = (await j('https://api.core.ac.uk/v3/search/works?q=authors:%22Takuya%20Nemoto%22&limit=10'));
  for (const id of ['NEMFSI', 'NEMMOI', 'NEMMRA', 'NEMTNA']) out.other['philarchive_' + id] = (await j('https://philarchive.org/rec/' + id)).s;
  const doapr = await j('https://doapr.coar-repositories.org/repositories/'); out.other.doapr_has_sophaxis = typeof doapr.b === 'string' ? null : null;
  try { const t = await (await fetch('https://doapr.coar-repositories.org/repositories/', { headers: UA })).text(); out.other.doapr_has_sophaxis = /sophaxis/i.test(t); } catch (e) {}
  for (const q of ['sophaxis', '%22Takuya+Nemoto%22']) { try { const t = await (await fetch('https://www.base-search.net/Search/Results?lookfor=' + q, { headers: UA, signal: AbortSignal.timeout(30000) })).text(); const m = /([\d,]+)\s*(?:hits|Treffer|results)/i.exec(t); out.other['base_' + q] = m ? m[1] : (t.length + ' bytes, no count'); } catch (e) { out.other['base_' + q] = String(e.message); } }
  fs.writeFileSync('.indexcheck/result.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
