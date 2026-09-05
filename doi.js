/* DOI アナライザー
 *
 * 依存パッケージなし。読み込み時は外部へリクエストを出さない。
 * ネットワークに触れるのは lookup()（「メタデータを照会」）だけで、
 * 送るのは DOI のみ。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 接頭辞の一覧
   *
   * 網羅ではない。載っているものだけ推定に使い、載っていなければ「不明」と出す。
   * ra は登録機関（Registration Agency）。確定は照会で得る。
   * ------------------------------------------------------------------ */
  var PREFIX = {
    '10.5281': ['Zenodo（CERN）', 'DataCite'],
    '10.48550': ['arXiv', 'DataCite'],
    '10.6084': ['figshare', 'DataCite'],
    '10.5061': ['Dryad', 'DataCite'],
    '10.7910': ['Harvard Dataverse', 'DataCite'],
    '10.17605': ['OSF', 'DataCite'],
    '10.2139': ['SSRN（Elsevier）', 'Crossref'],
    '10.1145': ['ACM', 'Crossref'],
    '10.1109': ['IEEE', 'Crossref'],
    '10.1038': ['Springer Nature', 'Crossref'],
    '10.1007': ['Springer', 'Crossref'],
    '10.1002': ['Wiley', 'Crossref'],
    '10.1111': ['Wiley', 'Crossref'],
    '10.1016': ['Elsevier', 'Crossref'],
    '10.1080': ['Taylor & Francis', 'Crossref'],
    '10.1017': ['Cambridge University Press', 'Crossref'],
    '10.1093': ['Oxford University Press', 'Crossref'],
    '10.1177': ['SAGE', 'Crossref'],
    '10.1126': ['AAAS（Science）', 'Crossref'],
    '10.1073': ['PNAS', 'Crossref'],
    '10.1371': ['PLOS', 'Crossref'],
    '10.3389': ['Frontiers', 'Crossref'],
    '10.1103': ['American Physical Society', 'Crossref'],
    '10.1063': ['AIP Publishing', 'Crossref'],
    '10.1021': ['American Chemical Society', 'Crossref'],
    '10.1101': ['Cold Spring Harbor（bioRxiv / medRxiv）', 'Crossref'],
    '10.7554': ['eLife', 'Crossref'],
    '10.5334': ['Ubiquity Press', 'Crossref'],
    '10.4230': ['Schloss Dagstuhl（LIPIcs）', 'Crossref'],
    '10.1089': ['Mary Ann Liebert', 'Crossref'],
    '10.1162': ['MIT Press', 'Crossref'],
    '10.31222': ['MetaArXiv（OSF Preprints）', 'Crossref'],
    '10.31234': ['PsyArXiv（OSF Preprints）', 'Crossref'],
    '10.31219': ['OSF Preprints', 'Crossref'],
    '10.11501': ['国立国会図書館', 'JaLC']
  };

  /* ------------------------------------------------------------------ *
   * 既知の注意
   *
   * 取り違えやすいものを DOI 単位で持つ。kind は 'warn'（誤った版を指す）と
   * 'info'（同一本文に DOI が二つある）。
   * ------------------------------------------------------------------ */
  var NOTES = {
    '10.5281/zenodo.17173703': {
      kind: 'warn',
      html: '<b>これは撤回対象の初版（2025年）です。</b> Trinity-Infinity Series I の改訂版は ' +
            '<code>10.5281/zenodo.22058624</code> です。Series II と III の参考文献欄が、' +
            '改訂版を指すつもりでこの番号を書いています。'
    },
    '10.2139/ssrn.7358779': {
      kind: 'info', pair: '10.5281/zenodo.22058254',
      html: '同一の本文が Zenodo にもあります（<code>10.5281/zenodo.22058254</code>）。' +
            '<b>引用は Zenodo の DOI を正とします。</b>'
    },
    '10.2139/ssrn.7358818': {
      kind: 'info', pair: '10.5281/zenodo.22057583',
      html: '同一の本文が Zenodo にもあります（<code>10.5281/zenodo.22057583</code>）。' +
            '<b>引用は Zenodo の DOI を正とします。</b>'
    },
    '10.5281/zenodo.22058254': { kind: 'info', pair: '10.2139/ssrn.7358779', html: 'SSRN にも同一の本文があります（<code>10.2139/ssrn.7358779</code>）。こちらが正です。' },
    '10.5281/zenodo.22057583': { kind: 'info', pair: '10.2139/ssrn.7358818', html: 'SSRN にも同一の本文があります（<code>10.2139/ssrn.7358818</code>）。こちらが正です。' },
    '10.5281/zenodo.22058624': { kind: 'info', html: 'Trinity-Infinity Series I の<b>改訂版</b>です。初版 <code>10.5281/zenodo.17173703</code> と取り違えないでください。' }
  };

  // 例は各経路を一度ずつ通す —— 妥当・要注意・重複・全角入力・散文からの抽出・不正 2 種。
  var SAMPLE = [
    '10.5281/zenodo.22058624',
    'https://doi.org/10.5281/zenodo.17173703',
    'DOI: 10.2139/ssrn.7358779',
    'doi:10.5281/zenodo.22058254',
    'http://dx.doi.org/10.1145/3287560.3287598',
    '１０.１０３８/s42256-019-0048-x',
    'Mittelstadt et al., Big Data & Society 3(2), 2016 (10.1177/2053951716679679).',
    '10.5281/ZENODO.22058624',
    '10.99/接頭辞の桁が足りない',
    'Nemoto 2026, DOI 10.5281zenodo.22058777（スラッシュが抜けている）'
  ].join('\n');

  /* ------------------------------------------------------------------ *
   * 索引先
   *
   * kind は二種類。'direct' はその DOI のレコードを直接指す URL、
   * 'search' は DOI を検索語として投げる URL。**同じ扱いにしない。**
   * direct は当たれば必ずその資料、search は当たらないことも別物が出ることもある。
   * ------------------------------------------------------------------ */

  // API のパスに DOI を置くとき、'/' は生のまま渡す（各 API はこれを受ける）。
  function pathSafe(doi) { return encodeURIComponent(doi).replace(/%2F/gi, '/'); }
  var q = encodeURIComponent;

  var INDEXES = [
    { name: 'Crossref', kind: 'direct', group: '登録機関', ra: 'Crossref',
      url: function (d) { return 'https://api.crossref.org/works/' + pathSafe(d); } },
    { name: 'DataCite Commons', kind: 'direct', group: '登録機関', ra: 'DataCite',
      url: function (d) { return 'https://commons.datacite.org/doi.org/' + pathSafe(d); } },
    { name: 'DataCite API', kind: 'direct', group: '登録機関', ra: 'DataCite',
      url: function (d) { return 'https://api.datacite.org/dois/' + pathSafe(d); } },

    { name: 'OpenAlex', kind: 'direct', group: '索引',
      url: function (d) { return 'https://api.openalex.org/works/doi:' + pathSafe(d); } },
    { name: 'Semantic Scholar', kind: 'direct', group: '索引',
      url: function (d) { return 'https://api.semanticscholar.org/' + pathSafe(d); } },
    { name: 'Scholia（Wikidata）', kind: 'direct', group: '索引',
      url: function (d) { return 'https://scholia.toolforge.org/doi/' + pathSafe(d); } },
    { name: 'OpenCitations', kind: 'direct', group: '索引',
      url: function (d) { return 'https://opencitations.net/index/coci/api/v1/citations/' + pathSafe(d); } },
    { name: 'scite', kind: 'direct', group: '索引',
      url: function (d) { return 'https://scite.ai/reports/' + pathSafe(d); } },
    { name: 'Unpaywall', kind: 'direct', group: '索引',
      url: function (d) { return 'https://unpaywall.org/' + pathSafe(d); } },

    { name: 'Google Scholar', kind: 'search', group: '検索',
      url: function (d) { return 'https://scholar.google.com/scholar?q=' + q('"' + d + '"'); } },
    { name: 'Crossref 検索', kind: 'search', group: '検索',
      url: function (d) { return 'https://search.crossref.org/search/works?q=' + q(d) + '&from_ui=yes'; } },
    { name: 'BASE', kind: 'search', group: '検索',
      url: function (d) { return 'https://www.base-search.net/Search/Results?lookfor=' + q(d); } },
    { name: 'CORE', kind: 'search', group: '検索',
      url: function (d) { return 'https://core.ac.uk/search?q=' + q('"' + d + '"'); } },
    { name: 'Lens.org', kind: 'search', group: '検索',
      url: function (d) { return 'https://www.lens.org/lens/search/scholar/list?q=' + q(d); } },
    { name: 'Dimensions', kind: 'search', group: '検索',
      url: function (d) { return 'https://app.dimensions.ai/discover/publication?search_text=' + q(d); } },
    { name: 'Europe PMC', kind: 'search', group: '分野別',
      url: function (d) { return 'https://europepmc.org/search?query=DOI:' + q('"' + d + '"'); } },
    { name: 'PubMed', kind: 'search', group: '分野別',
      url: function (d) { return 'https://pubmed.ncbi.nlm.nih.gov/?term=' + q(d); } },
    { name: 'PhilPapers', kind: 'search', group: '分野別',
      url: function (d) { return 'https://philpapers.org/s/' + q(d); } }
  ];

  /* 接尾辞から、掲載元のレコードそのものを組み立てられるもの。
   * 検索でも索引でもなく、DOI の中に識別子が入っているので確実に当たる。 */
  var REGISTRY = [
    { re: /^10\.5281\/zenodo\.(\d+)$/i, name: 'Zenodo のレコード',
      url: function (m) { return 'https://zenodo.org/records/' + m[1]; } },
    { re: /^10\.2139\/ssrn\.(\d+)$/i, name: 'SSRN の要旨ページ',
      url: function (m) { return 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=' + m[1]; } },
    { re: /^10\.48550\/arxiv\.(.+)$/i, name: 'arXiv の abs ページ',
      url: function (m) { return 'https://arxiv.org/abs/' + m[1]; } },
    { re: /^10\.312(?:19|22|34)\/osf\.io\/(\w+)$/i, name: 'OSF のレコード',
      url: function (m) { return 'https://osf.io/' + m[1]; } },
    { re: /^10\.17605\/osf\.io\/(\w+)$/i, name: 'OSF のレコード',
      url: function (m) { return 'https://osf.io/' + m[1]; } }
  ];

  function registryLink(doi) {
    for (var i = 0; i < REGISTRY.length; i++) {
      var m = REGISTRY[i].re.exec(doi);
      if (m) return { name: REGISTRY[i].name, url: REGISTRY[i].url(m) };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * 正規化
   * ------------------------------------------------------------------ */

  // 全角の英数字・記号を半角に。日本語環境での入力を拾うため。
  function toHalfWidth(s) {
    return s
      .replace(/[！-～]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
      })
      .replace(/　/g, ' ');
  }

  // 末尾に紛れこんだ句読点・閉じ括弧を落とす。
  // 括弧は DOI 自体に含まれうる（Wiley の SICI 形式など）ので、
  // 開きより閉じが多いときだけ落とす。
  function trimTail(doi) {
    var changed = true;
    while (changed && doi.length > 0) {
      changed = false;
      var last = doi.charAt(doi.length - 1);
      if ('.,;:、。，．'.indexOf(last) >= 0) {
        doi = doi.slice(0, -1); changed = true; continue;
      }
      if (last === ')' && count(doi, ')') > count(doi, '(')) { doi = doi.slice(0, -1); changed = true; continue; }
      if (last === ']' && count(doi, ']') > count(doi, '[')) { doi = doi.slice(0, -1); changed = true; continue; }
      if ('>」』】）"\''.indexOf(last) >= 0) { doi = doi.slice(0, -1); changed = true; }
    }
    return doi;
  }

  function count(s, ch) {
    var n = 0;
    for (var i = 0; i < s.length; i++) if (s.charAt(i) === ch) n++;
    return n;
  }

  var EXTRACT = /10\.\d{4,9}(?:\.\d+)*\/[^\s"'<>、。「」『』]+/g;
  var STRICT = /^10\.\d{4,9}(?:\.\d+)*\/\S+$/;

  // 貼りこまれた文字列から DOI を全部拾う。入力が 1 件でも一覧でも同じ経路。
  function extract(raw) {
    var text = toHalfWidth(String(raw));
    var found = [];
    var seen = {};
    var m;
    EXTRACT.lastIndex = 0;
    while ((m = EXTRACT.exec(text)) !== null) {
      var doi = trimTail(m[0]);
      if (!doi) continue;
      var key = doi.toLowerCase();
      if (!seen[key]) { seen[key] = 1; found.push(doi); }
      else { seen[key]++; }
    }
    return { list: found, counts: seen };
  }

  // 拾えなかった行のうち、DOI を書こうとして失敗していそうなものを拾う。
  // EXTRACT は /g つきで lastIndex を持つため、判定には状態のない写しを使う。
  var HAS_DOI = new RegExp(EXTRACT.source);

  function suspects(raw) {
    var out = [];
    toHalfWidth(String(raw)).split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      if (HAS_DOI.test(t)) return;
      if (/(^|[^\d])10\./.test(t) || /doi/i.test(t)) out.push(t);
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 解析
   * ------------------------------------------------------------------ */

  function analyseOne(doi, duplicates) {
    var valid = STRICT.test(doi);
    var slash = doi.indexOf('/');
    var prefix = slash > 0 ? doi.slice(0, slash) : doi;
    var suffix = slash > 0 ? doi.slice(slash + 1) : '';
    var known = PREFIX[prefix] || null;
    var note = NOTES[doi.toLowerCase()] || null;

    return {
      raw: doi,
      doi: doi,
      valid: valid,
      prefix: prefix,
      registrant: prefix.replace(/^10\./, ''),
      suffix: suffix,
      owner: known ? known[0] : null,
      ra: known ? known[1] : null,
      url: 'https://doi.org/' + doi,
      duplicate: duplicates > 1 ? duplicates : 0,
      note: note,
      meta: null,
      lookupState: null
    };
  }

  /* ------------------------------------------------------------------ *
   * 描画
   * ------------------------------------------------------------------ */

  var $ = function (id) { return document.getElementById(id); };
  var state = { items: [], bad: [] };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function row(term, value, strong) {
    return '<dt>' + esc(term) + '</dt><dd' + (strong ? ' class="strong"' : '') + '>' + value + '</dd>';
  }

  function renderIndexes(it) {
    var reg = registryLink(it.doi);
    var groups = { '登録機関': [], '索引': [], '検索': [], '分野別': [] };

    // 登録機関は、接頭辞から推定したほうを先に出す。Crossref の DOI を DataCite に
    // 問い合わせても当たらないので、同格に並べると無駄足になる。
    var ordered = INDEXES.slice().sort(function (a, b) {
      if (a.group !== '登録機関' || b.group !== '登録機関' || !it.ra) return 0;
      return (b.ra === it.ra ? 1 : 0) - (a.ra === it.ra ? 1 : 0);
    });

    ordered.forEach(function (ix) {
      var off = ix.group === '登録機関' && it.ra && ix.ra !== it.ra;
      groups[ix.group].push(
        '<a class="ix ' + ix.kind + (off ? ' off' : '') + '" href="' + esc(ix.url(it.doi)) +
        '" target="_blank" rel="noopener"' + (off ? ' title="接頭辞からの推定では別の登録機関です"' : '') + '>' +
        esc(ix.name) + '</a>');
    });

    var n = INDEXES.length + (reg ? 1 : 0);
    var html = '<details class="ixbox"><summary>索引先を開く（' + n + ' 件）</summary>';

    if (reg) {
      html += '<div class="ixgroup"><span class="ixlabel">掲載元のレコード</span><div class="ixlinks">' +
        '<a class="ix direct" href="' + esc(reg.url) + '" target="_blank" rel="noopener">' + esc(reg.name) + '</a>' +
        '</div><p class="ixnote">DOI の接尾辞に識別子が入っているので、検索を経ずに組み立てられます。</p></div>';
    }

    ['登録機関', '索引', '検索', '分野別'].forEach(function (g) {
      var label = g;
      if (g === '登録機関' && it.ra) label += '（推定は ' + it.ra + '）';
      if (g === '分野別') label += '（資料の分野によります）';
      html += '<div class="ixgroup"><span class="ixlabel">' + esc(label) + '</span>' +
        '<div class="ixlinks">' + groups[g].join('') + '</div></div>';
    });

    html += '<p class="ixnote"><b>実線は直接</b>その DOI のレコードを指します。' +
      '<b>点線は検索</b>で、DOI を検索語として投げるだけです。当たらないことも、別のものが出ることもあります。' +
      '<b>薄いものは、接頭辞からの推定では別の登録機関</b>のため、おそらく当たりません。' +
      '実際に収録されているかどうかは、ここでは確かめていません —— <b>開いて初めて分かります。</b></p>';
    html += '</details>';
    return html;
  }

  function renderItem(it) {
    var cls = !it.valid ? 'bad' : (it.note && it.note.kind === 'warn' ? 'flagged' : 'ok');
    var tag = !it.valid ? '<span class="tag bad">書式が不正</span>'
            : (it.note && it.note.kind === 'warn' ? '<span class="tag flagged">要注意</span>'
                                                  : '<span class="tag ok">書式は妥当</span>');
    var dup = it.duplicate ? '<span class="tag">' + it.duplicate + ' 回</span>' : '';

    var html = '<div class="res ' + cls + '">';
    html += '<div class="res-head">';
    html += it.valid
      ? '<a class="res-doi" href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.doi) + '</a>'
      : '<span class="res-doi">' + esc(it.doi) + '</span>';
    html += tag + dup + '</div>';

    html += '<dl class="kv">';
    if (it.valid) {
      html += row('解決 URL', '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.url) + '</a>', true);
      html += row('接頭辞', '<code>' + esc(it.prefix) + '</code>（登録者番号 ' + esc(it.registrant) + '）');
      html += row('接尾辞', '<code>' + esc(it.suffix) + '</code>');
      html += row('登録者', it.owner ? esc(it.owner) + '<span style="color:var(--faint)"> — 接頭辞からの推定</span>'
                                     : '<span style="color:var(--faint)">内蔵の一覧に無し</span>');
      html += row('登録機関', it.ra ? esc(it.ra) : '<span style="color:var(--faint)">不明</span>');
      html += row('大文字小文字', 'DOI は区別しません。表示は入力のまま。');
    } else {
      html += row('判定', '<code>10.</code> + 4〜9 桁の登録者番号 + <code>/</code> + 接尾辞、の形になっていません。', true);
    }
    html += '</dl>';

    if (it.note) {
      html += '<div class="note">' + it.note.html + '</div>';
    }

    if (it.valid) html += renderIndexes(it);

    if (it.lookupState === 'pending') {
      html += '<div class="meta-block"><dl class="kv">' + row('照会', '問い合わせ中…') + '</dl></div>';
    } else if (it.lookupState === 'fail') {
      html += '<div class="meta-block"><dl class="kv">' +
        row('照会', '<span style="color:var(--faint)">CrossRef にも DataCite にも見つかりませんでした。登録が新しい、通信が遮断されている、または DOI が存在しません。</span>') +
        '</dl></div>';
    } else if (it.meta) {
      var m = it.meta;
      var b = '<div class="meta-block"><dl class="kv">';
      b += row('照会先', esc(m.source), true);
      if (m.title) b += row('題名', esc(m.title), true);
      if (m.authors && m.authors.length) b += row('著者', esc(m.authors.join(' / ')));
      if (m.type) b += row('種別', esc(m.type));
      if (m.container) b += row('掲載', esc(m.container));
      if (m.publisher) b += row('発行', esc(m.publisher));
      if (m.year) b += row('年', esc(m.year));
      if (m.version) b += row('版', esc(m.version));
      if (m.license) b += row('ライセンス', '<a href="' + esc(m.license) + '" target="_blank" rel="noopener">' + esc(m.license) + '</a>');
      if (m.zenodoKind) b += row('Zenodo', esc(m.zenodoKind), true);
      if (m.relations && m.relations.length) {
        b += row('関連', m.relations.map(function (r) { return esc(r.type) + ' → <code>' + esc(r.id) + '</code>'; }).join('<br>'));
      }
      b += '</dl></div>';
      html += b;
    }

    html += '</div>';
    return html;
  }

  function render() {
    var results = $('results');
    var summary = $('summary');
    var empty = $('empty');

    if (!state.items.length && !state.bad.length) {
      results.innerHTML = '';
      summary.hidden = true;
      $('exportBlock').hidden = true;
      empty.hidden = false;
      $('lookup').disabled = true;
      return;
    }
    empty.hidden = true;

    var valid = 0, flagged = 0, dupes = 0;
    state.items.forEach(function (it) {
      if (it.valid) valid++;
      if (it.note && it.note.kind === 'warn') flagged++;
      if (it.duplicate) dupes += it.duplicate - 1;
    });
    var invalid = state.items.length - valid;

    var s = '<span class="stat">見つかった DOI <b>' + state.items.length + '</b></span>';
    s += '<span class="stat">書式が妥当 <b>' + valid + '</b></span>';
    if (invalid) s += '<span class="stat warn">不正 <b>' + invalid + '</b></span>';
    if (dupes) s += '<span class="stat warn">重複 <b>' + dupes + '</b></span>';
    if (flagged) s += '<span class="stat warn">要注意 <b>' + flagged + '</b></span>';
    if (state.bad.length) s += '<span class="stat">拾えなかった行 <b>' + state.bad.length + '</b></span>';
    summary.innerHTML = s;
    summary.hidden = false;

    var html = state.items.map(renderItem).join('');
    if (state.bad.length) {
      html += '<div class="res"><div class="res-head"><span class="res-doi">拾えなかった行</span>' +
        '<span class="tag">' + state.bad.length + ' 行</span></div>' +
        '<dl class="kv">' + row('内容', state.bad.map(esc).join('<br>')) + '</dl>' +
        '<div class="note">DOI らしき記述はありますが、書式として取り出せませんでした。' +
        '接頭辞の桁数、<code>/</code> の有無、途中の改行を確認してください。</div></div>';
    }
    results.innerHTML = html;

    $('lookup').disabled = valid === 0;
    $('exportBlock').hidden = valid === 0;
    if (valid) renderExport();
  }

  /* ------------------------------------------------------------------ *
   * 照会（ここだけがネットワークに触れる）
   * ------------------------------------------------------------------ */

  function fromCrossref(m) {
    var issued = m.issued && m.issued['date-parts'] && m.issued['date-parts'][0];
    return {
      source: 'Crossref',
      title: m.title && m.title[0],
      authors: (m.author || []).map(function (a) {
        return a.family ? (a.family + (a.given ? ', ' + a.given : '')) : (a.name || '');
      }).filter(Boolean),
      type: m.type,
      container: m['container-title'] && m['container-title'][0],
      publisher: m.publisher,
      year: issued && issued[0],
      license: m.license && m.license[0] && m.license[0].URL,
      volume: m.volume, issue: m.issue, page: m.page,
      relations: []
    };
  }

  function fromDataCite(a) {
    var rel = (a.relatedIdentifiers || []).map(function (r) {
      return { type: r.relationType, id: r.relatedIdentifier };
    });
    var kind = null;
    rel.forEach(function (r) {
      if (r.type === 'HasVersion') kind = 'コンセプト DOI（常に最新版を指します）';
      else if (r.type === 'IsVersionOf' && !kind) kind = 'バージョン DOI（この版を固定して指します）';
    });
    return {
      source: 'DataCite',
      title: a.titles && a.titles[0] && a.titles[0].title,
      authors: (a.creators || []).map(function (c) { return c.name; }).filter(Boolean),
      type: a.types && (a.types.resourceTypeGeneral || a.types.resourceType),
      container: null,
      publisher: a.publisher,
      year: a.publicationYear,
      version: a.version,
      license: a.rightsList && a.rightsList[0] && a.rightsList[0].rightsUri,
      zenodoKind: kind,
      relations: rel
    };
  }

  function lookupOne(it) {
    it.lookupState = 'pending';
    return fetch('https://api.crossref.org/works/' + pathSafe(it.doi))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) { it.meta = fromCrossref(j.message); it.lookupState = 'ok'; })
      .catch(function () {
        return fetch('https://api.datacite.org/dois/' + pathSafe(it.doi))
          .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
          .then(function (j) { it.meta = fromDataCite(j.data.attributes); it.lookupState = 'ok'; })
          .catch(function () { it.lookupState = 'fail'; });
      });
  }

  function lookupAll() {
    var targets = state.items.filter(function (it) { return it.valid && !it.meta; });
    if (!targets.length) return;
    var btn = $('lookup');
    btn.disabled = true;
    btn.textContent = '照会中… 0 / ' + targets.length;
    render();

    var done = 0;
    // 相手のサーバに配慮して 1 件ずつ順に投げる。
    targets.reduce(function (chain, it) {
      return chain.then(function () {
        return lookupOne(it).then(function () {
          done++;
          btn.textContent = '照会中… ' + done + ' / ' + targets.length;
          render();
        });
      });
    }, Promise.resolve()).then(function () {
      btn.textContent = 'メタデータを照会';
      btn.disabled = state.items.filter(function (i) { return i.valid && !i.meta; }).length === 0;
      render();
    });
  }

  /* ------------------------------------------------------------------ *
   * 書き出し
   * ------------------------------------------------------------------ */

  var fmt = 'bibtex';

  function bibKey(it, i) {
    var a = it.meta && it.meta.authors && it.meta.authors[0]
      ? it.meta.authors[0].split(',')[0].replace(/[^A-Za-z]/g, '').toLowerCase() : 'ref';
    var y = it.meta && it.meta.year ? it.meta.year : 'nd';
    return (a || 'ref') + y + (i + 1);
  }

  function bibtex() {
    return state.items.filter(function (it) { return it.valid; }).map(function (it, i) {
      var m = it.meta;
      var type = m && m.container ? 'article' : 'misc';
      var lines = ['@' + type + '{' + bibKey(it, i) + ','];
      if (m && m.authors && m.authors.length) lines.push('  author       = {' + m.authors.join(' and ') + '},');
      if (m && m.title) lines.push('  title        = {{' + m.title + '}},');
      if (m && m.container) lines.push('  journal      = {' + m.container + '},');
      if (m && m.publisher) lines.push('  publisher    = {' + m.publisher + '},');
      if (m && m.year) lines.push('  year         = {' + m.year + '},');
      if (m && m.volume) lines.push('  volume       = {' + m.volume + '},');
      if (m && m.issue) lines.push('  number       = {' + m.issue + '},');
      if (m && m.page) lines.push('  pages        = {' + m.page + '},');
      lines.push('  doi          = {' + it.doi + '},');
      lines.push('  url          = {' + it.url + '}');
      lines.push('}');
      return lines.join('\n');
    }).join('\n\n');
  }

  function csl() {
    return JSON.stringify(state.items.filter(function (it) { return it.valid; }).map(function (it, i) {
      var m = it.meta;
      var o = { id: bibKey(it, i), DOI: it.doi, URL: it.url, type: 'document' };
      if (m) {
        if (m.title) o.title = m.title;
        if (m.container) { o['container-title'] = m.container; o.type = 'article-journal'; }
        if (m.publisher) o.publisher = m.publisher;
        if (m.year) o.issued = { 'date-parts': [[Number(m.year)]] };
        if (m.authors && m.authors.length) {
          o.author = m.authors.map(function (n) {
            var p = n.split(',');
            return p.length > 1 ? { family: p[0].trim(), given: p.slice(1).join(',').trim() } : { literal: n };
          });
        }
      }
      return o;
    }), null, 2);
  }

  function cff() {
    var out = ['references:'];
    state.items.filter(function (it) { return it.valid; }).forEach(function (it) {
      var m = it.meta;
      out.push('  - type: ' + (m && m.container ? 'article' : 'generic'));
      if (m && m.title) out.push('    title: "' + String(m.title).replace(/"/g, '\\"') + '"');
      if (m && m.authors && m.authors.length) {
        out.push('    authors:');
        m.authors.forEach(function (n) {
          var p = n.split(',');
          if (p.length > 1) {
            out.push('      - family-names: "' + p[0].trim() + '"');
            out.push('        given-names: "' + p.slice(1).join(',').trim() + '"');
          } else {
            out.push('      - name: "' + n + '"');
          }
        });
      }
      if (m && m.year) out.push('    year: ' + m.year);
      out.push('    doi: ' + it.doi);
    });
    return out.join('\n');
  }

  function markdown() {
    var rows = ['| DOI | 題名 | 登録者 | 年 |', '| --- | --- | --- | --- |'];
    state.items.filter(function (it) { return it.valid; }).forEach(function (it) {
      var m = it.meta || {};
      rows.push('| [' + it.doi + '](' + it.url + ') | ' +
        (m.title ? String(m.title).replace(/\|/g, '\\|') : '—') + ' | ' +
        (m.publisher || it.owner || '—') + ' | ' + (m.year || '—') + ' |');
    });
    return rows.join('\n');
  }

  function indexLinks() {
    var out = [];
    state.items.filter(function (it) { return it.valid; }).forEach(function (it) {
      out.push('## ' + it.doi);
      out.push('');
      var reg = registryLink(it.doi);
      if (reg) out.push('- 掲載元 — [' + reg.name + '](' + reg.url + ')');
      INDEXES.forEach(function (ix) {
        out.push('- ' + ix.group + '（' + (ix.kind === 'direct' ? '直接' : '検索') + '） — [' +
                 ix.name + '](' + ix.url(it.doi) + ')');
      });
      out.push('');
    });
    return out.join('\n');
  }

  function plain() {
    return state.items.filter(function (it) { return it.valid; })
      .map(function (it) { return it.url; }).join('\n');
  }

  function renderExport() {
    var map = { bibtex: bibtex, csl: csl, cff: cff, md: markdown, links: indexLinks, txt: plain };
    $('out').textContent = (map[fmt] || bibtex)();
  }

  /* ------------------------------------------------------------------ *
   * 配線
   * ------------------------------------------------------------------ */

  function run() {
    var raw = $('input').value;
    var got = extract(raw);
    state.items = got.list.map(function (d) {
      return analyseOne(d, got.counts[d.toLowerCase()]);
    });
    state.bad = suspects(raw);
    render();
  }

  $('analyze').addEventListener('click', run);
  $('lookup').addEventListener('click', lookupAll);
  $('sample').addEventListener('click', function () { $('input').value = SAMPLE; run(); });
  $('clear').addEventListener('click', function () {
    $('input').value = '';
    state.items = []; state.bad = [];
    render();
  });

  // Ctrl/Cmd + Enter でも解析する
  $('input').addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
        t.setAttribute('aria-selected', String(t === tab));
      });
      fmt = tab.getAttribute('data-fmt');
      renderExport();
    });
  });

  $('copy').addEventListener('click', function () {
    var text = $('out').textContent;
    var btn = $('copy');
    var done = function () { btn.textContent = 'コピーしました'; setTimeout(function () { btn.textContent = 'コピー'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { btn.textContent = 'コピーできません'; });
    } else {
      btn.textContent = 'コピーできません';
    }
  });
})();
