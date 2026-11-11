// One-off, exhaustive: query public scholarly indexes for the owner's works. Results go to .indexcheck/result.json.
const fs = require('fs');
const ORCID = '0009-0000-1406-0547';
const WORKS = ['10.2139/ssrn.7358779','10.2139/ssrn.7358818','10.2139/ssrn.7446961','10.2139/ssrn.7449338','10.2139/ssrn.7537983',
 '10.5281/zenodo.17173703','10.5281/zenodo.22055709','10.5281/zenodo.22057583','10.5281/zenodo.22058254','10.5281/zenodo.22058624','10.5281/zenodo.22058777','10.5281/zenodo.22058964','10.5281/zenodo.22064241','10.5281/zenodo.22335676','10.5281/zenodo.22335692','10.5281/zenodo.22649054','10.5281/zenodo.22649899','10.5281/zenodo.22685687','10.5281/zenodo.22765695','10.5281/zenodo.23114131','10.5281/zenodo.24033082','10.5281/zenodo.24033372','10.5281/zenodo.24033459','10.5281/zenodo.24033597','10.5281/zenodo.24033809','10.5281/zenodo.24033961','10.5281/zenodo.24034131','10.5281/zenodo.24034360','10.6084/m9.figshare.34419198','10.17605/osf.io/mq7za',
 '10.5281/zenodo.18525532','10.5281/zenodo.22055553'];
const CONCEPTS = ['10.5281/zenodo.18525531','10.5281/zenodo.17173702','10.5281/zenodo.22335691','10.5281/zenodo.24033458','10.5281/zenodo.24033596','10.5281/zenodo.22765620','10.5281/zenodo.24033960','10.5281/zenodo.24034130','10.5281/zenodo.24034359','10.5281/zenodo.24033081'];
const ZENODO_FIX = ['22055709','22057583','22058254','22058624','22058777','22058964','22064241','23114131'];
const UA = { 'User-Agent': 'index-check/1.0 (+https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(u, h = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(30000) });
      const t = await r.text(); let b = null; try { b = JSON.parse(t); } catch (e) { b = t; }
      if (r.status === 429 && i < tries - 1) { await sleep(5000 * (i + 1)); continue; }
      return { s: r.status, b };
    } catch (e) { if (i === tries - 1) return { s: 0, e: String(e.cause && e.cause.code || e.message) }; await sleep(2000); }
  }
}
const short = (s, n = 90) => String(s || '').slice(0, n);
const safe = async (k, f, o) => { try { o[k] = await f(); } catch (e) { o[k] = 'error: ' + e.message; } };
(async () => {
  const out = { at: new Date().toISOString(), works: {}, concepts: {}, zenodo: {}, other: {} };
  for (const d of [...WORKS, ...CONCEPTS]) {
    const w = {};
    await safe('openalex', async () => { const r = await j('https://api.openalex.org/works/doi:' + d); return r.s === 200 ? { id: r.b.id, cited: r.b.cited_by_count, type: r.b.type, abstract: !!r.b.abstract_inverted_index, authors: (r.b.authorships || []).map((a) => a.author && a.author.id), title: short(r.b.title) } : r.s; }, w);
    await sleep(250);
    await safe('s2', async () => { const r = await j('https://api.semanticscholar.org/graph/v1/paper/DOI:' + d + '?fields=title,citationCount'); return r.s === 200 ? { cited: r.b.citationCount, title: short(r.b.title) } : r.s; }, w);
    await sleep(1500);
    await safe('opencitations', async () => { const r = await j('https://opencitations.net/index/api/v2/citation-count/doi:' + d); return r.s === 200 && Array.isArray(r.b) ? (r.b[0] && r.b[0].count) : r.s; }, w);
    await safe('openaire', async () => { const r = await j('https://api.openaire.eu/search/researchProducts?doi=' + encodeURIComponent(d) + '&format=json'); return r.s === 200 ? ((((r.b || {}).response || {}).header || {}).total || {}).$ : r.s; }, w);
    await safe('fatcat', async () => { const r = await j('https://api.fatcat.wiki/v0/release/lookup?doi=' + encodeURIComponent(d.toLowerCase())); return r.s === 200 ? r.b.ident : r.s; }, w);
    await safe('agency', async () => { const r = await j('https://api.crossref.org/works/' + d + '/agency'); return r.s === 200 ? r.b.message.agency.id : r.s; }, w);
    (CONCEPTS.includes(d) ? out.concepts : out.works)[d] = w;
  }
  for (const id of ZENODO_FIX) {
    await safe(id, async () => { const r = await j('https://zenodo.org/api/records/' + id); return r.s === 200 ? { title: short(r.b.metadata.title, 200), description_len: (r.b.metadata.description || '').length, keywords: (r.b.metadata.keywords || []).length, license: r.b.metadata.license && r.b.metadata.license.id, dates: r.b.metadata.dates || null, pubdate: r.b.metadata.publication_date, updated: r.b.updated } : r.s; }, out.zenodo);
    await sleep(500);
  }
  const o = out.other;
  await safe('openalex_author_orcid', async () => { const a = await j('https://api.openalex.org/authors?filter=orcid:' + ORCID); return a.s === 200 ? a.b.results.map((x) => ({ id: x.id, name: x.display_name, works: x.works_count, cited: x.cited_by_count })) : a.s; }, o);
  await safe('openalex_author_name', async () => { const a = await j('https://api.openalex.org/authors?search=Takuya%20Nemoto'); return a.s === 200 ? a.b.results.map((x) => ({ id: x.id, name: x.display_name, works: x.works_count, orcid: x.orcid })) : a.s; }, o);
  await safe('s2_author', async () => { const a = await j('https://api.semanticscholar.org/graph/v1/author/search?query=Takuya%20Nemoto&fields=name,paperCount,citationCount'); return a.s === 200 ? a.b.data : a.s; }, o);
  for (const q of ['Sophaxis', 'Nusquama', 'Takuya Nemoto', '根本卓哉', 'Trinity-Infinity', 'errata-check']) {
    await safe('wikidata_search_' + q, async () => { const r = await j('https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' + encodeURIComponent(q) + '&language=en&uselang=ja&format=json'); return r.s === 200 ? (r.b.search || []).map((x) => ({ id: x.id, label: x.label, description: x.description })) : r.s; }, o);
  }
  await safe('wikidata_Q139590485', async () => { const wd = await j('https://www.wikidata.org/wiki/Special:EntityData/Q139590485.json'); if (wd.s !== 200) return wd.s; const e = wd.b.entities.Q139590485; return { labels: Object.fromEntries(Object.entries(e.labels).map(([k, v]) => [k, v.value])), descriptions: Object.fromEntries(Object.entries(e.descriptions).map(([k, v]) => [k, v.value])), claims: Object.keys(e.claims) }; }, o);
  await safe('wikidata_by_orcid', async () => { const sp = await j('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent('SELECT ?item ?itemLabel WHERE { ?item wdt:P496 "' + ORCID + '" . SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". } }'), { Accept: 'application/sparql-results+json' }); return sp.s === 200 ? sp.b.results.bindings.map((b) => [b.item.value, b.itemLabel.value]) : sp.s; }, o);
  await safe('wikidata_works', async () => { const sp = await j('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent('SELECT ?w ?wLabel ?doi WHERE { ?w wdt:P50 wd:Q139590485 . OPTIONAL { ?w wdt:P356 ?doi } SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ja". } }'), { Accept: 'application/sparql-results+json' }); return sp.s === 200 ? sp.b.results.bindings.map((b) => [b.w.value, b.wLabel.value, b.doi && b.doi.value]) : sp.s; }, o);
  await safe('core_sophaxis', async () => { const r = await j('https://api.core.ac.uk/v3/search/works?q=sophaxis&limit=5'); return r.s === 200 ? { total: r.b.totalHits, titles: (r.b.results || []).map((x) => short(x.title)) } : r.s; }, o);
  await safe('core_author', async () => { const r = await j('https://api.core.ac.uk/v3/search/works?q=authors:%22Takuya%20Nemoto%22&limit=20'); return r.s === 200 ? { total: r.b.totalHits, titles: (r.b.results || []).map((x) => short(x.title)) } : r.s; }, o);
  for (const id of ['NEMFSI', 'NEMMOI', 'NEMMRA', 'NEMTNA']) await safe('philarchive_' + id, async () => (await j('https://philarchive.org/rec/' + id)).s, o);
  await safe('doapr_has_sophaxis', async () => { const t = await (await fetch('https://doapr.coar-repositories.org/repositories/?q=sophaxis', { headers: UA, signal: AbortSignal.timeout(30000) })).text(); return /sophaxis/i.test(t); }, o);
  for (const q of ['sophaxis', '%22Takuya+Nemoto%22', '%22Nemoto%2C+Takuya%22']) {
    await safe('base_' + q, async () => { const t = await (await fetch('https://www.base-search.net/Search/Results?lookfor=' + q, { headers: UA, signal: AbortSignal.timeout(30000) })).text(); const m = /([\d,.]+)\s*(?:hits|Treffer|results|Ergebnisse)/i.exec(t); return m ? m[1] : (t.length + ' bytes, no count'); }, o);
  }
  await safe('knowledge_commons', async () => { const kc = await j('https://works.hcommons.org/api/records?q=' + encodeURIComponent('"Nemoto"') + '&size=20'); return kc.s === 200 ? { total: kc.b.hits && kc.b.hits.total, titles: ((kc.b.hits || {}).hits || []).map((h) => short(h.metadata && h.metadata.title)) } : kc.s; }, o);
  await safe('orcid_works', async () => { const r = await j('https://pub.orcid.org/v3.0/' + ORCID + '/works', { Accept: 'application/json' }); return r.s === 200 ? r.b.group.map((g) => short(g['work-summary'][0].title.title.value, 70)) : r.s; }, o);
  await safe('google_scholar', async () => (await j('https://scholar.google.com/scholar?q=%22Takuya+Nemoto%22+sophaxis', {}, 1)).s, o);
  fs.writeFileSync('.indexcheck/result.json', JSON.stringify(out, null, 1));
  console.log('done');
})();
