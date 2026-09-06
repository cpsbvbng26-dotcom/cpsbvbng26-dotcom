/* doi.js の純粋な関数を、ブラウザを起こさずに検査する。
 *
 *   node verification/check_doi.js
 *
 * 依存パッケージなし。doi.js は Node から読むと配線せず関数だけを出す。
 *
 * 通信する部分（照会・ORCID の読み込み）はここでは扱わない。代わりに、
 * 応答を解釈する関数に**記録した形の JSON を流し込んで**確かめる。
 * 実際の API に届くかどうかは、この検査の対象外である。
 */

'use strict';

const path = require('path');
const D = require(path.resolve(__dirname, '..', 'doi.js'));

let pass = 0;
const failures = [];

function eq(label, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) { pass++; return; }
  failures.push(label + '\n      期待 ' + b + '\n      実際 ' + a);
}

function ok(label, cond, detail) {
  if (cond) { pass++; return; }
  failures.push(label + (detail ? '\n      ' + detail : ''));
}

function section(name) { console.log('\n' + name); }

/* ---------------------------------------------------------------- 正規化 */
section('正規化');

eq('全角の英数字を半角にする',
   D.toHalfWidth('１０.５２８１ｚ'), '10.5281z');
// 全角スラッシュも半角になる。全角で打たれた DOI をそのまま拾うため、これが要る。
eq('全角スラッシュを半角にする',
   D.toHalfWidth('１０.５２８１／ｚ'), '10.5281/z');
eq('全角で打たれた DOI を拾える',
   D.extract('１０.５２８１／ｚｅｎｏｄｏ.１').list, ['10.5281/zenodo.1']);
eq('全角スペースを半角にする', D.toHalfWidth('a　b'), 'a b');

eq('末尾の句点を落とす', D.trimTail('10.1145/x.'), '10.1145/x');
eq('末尾の読点を落とす', D.trimTail('10.1145/x、'), '10.1145/x');
eq('対応の取れない閉じ括弧を落とす', D.trimTail('10.1145/x)'), '10.1145/x');
eq('対応の取れている括弧は残す', D.trimTail('10.1002/(SICI)x'), '10.1002/(SICI)x');
eq('対応の取れない開き括弧を落とす', D.trimTail('10.1145/x('), '10.1145/x');
eq('鉤括弧を落とす', D.trimTail('10.1145/x」'), '10.1145/x');

/* ---------------------------------------------------------------- 抽出 */
section('抽出');

eq('素の DOI', D.extract('10.5281/zenodo.1').list, ['10.5281/zenodo.1']);
eq('doi: の接頭語つき', D.extract('doi:10.5281/zenodo.1').list, ['10.5281/zenodo.1']);
eq('DOI: の接頭語つき', D.extract('DOI: 10.5281/zenodo.1').list, ['10.5281/zenodo.1']);
eq('https://doi.org/ 形式', D.extract('https://doi.org/10.5281/zenodo.1').list, ['10.5281/zenodo.1']);
eq('http://dx.doi.org/ 形式', D.extract('http://dx.doi.org/10.5281/zenodo.1').list, ['10.5281/zenodo.1']);
eq('全角で入力されたもの', D.extract('１０.１０３８/s42256').list, ['10.1038/s42256']);
eq('散文の中の括弧つき', D.extract('Mittelstadt (10.1177/2053951716679679).').list, ['10.1177/2053951716679679']);

// 回帰: 全角括弧を半角に直した後、括弧の対応が取れて日本語を飲み込んでいた
eq('和文の丸括弧を飲み込まない',
   D.extract('DOI: 10.5281/zenodo.1（そして）').list, ['10.5281/zenodo.1']);
eq('和文の読点で切れる',
   D.extract('「独身論」10.5281/zenodo.22058254、および').list, ['10.5281/zenodo.22058254']);
eq('和文の角括弧を飲み込まない',
   D.extract('［10.1145/3287560.3287598］').list, ['10.1145/3287560.3287598']);

// Wiley の SICI 形式は '<' '>' と括弧を本当に含む
eq('SICI 形式を切らない',
   D.extract('10.1002/(SICI)1097-0258(19980815)17:15<1623::AID-SIM871>3.0.CO;2-N').list,
   ['10.1002/(SICI)1097-0258(19980815)17:15<1623::AID-SIM871>3.0.CO;2-N']);

const many = D.extract('10.5281/zenodo.1\n10.5281/ZENODO.1\n10.1145/x');
eq('大文字小文字を無視して重複を数える', many.list, ['10.5281/zenodo.1', '10.1145/x']);
eq('重複の回数', many.counts['10.5281/zenodo.1'], 2);

eq('接頭辞の桁が足りないものは拾わない', D.extract('10.99/x').list, []);
eq('スラッシュがないものは拾わない', D.extract('10.5281zenodo.1').list, []);

eq('拾えなかった行を拾う', D.suspects('10.99/短すぎる').length, 1);
eq('妥当な行は拾わない', D.suspects('10.5281/zenodo.1').length, 0);

/* ---------------------------------------------------------------- 解析 */
section('解析');

const a1 = D.analyseOne('10.5281/zenodo.22058624', 1);
eq('妥当と判定する', a1.valid, true);
eq('接頭辞を切り出す', a1.prefix, '10.5281');
eq('接尾辞を切り出す', a1.suffix, 'zenodo.22058624');
eq('登録者を推定する', a1.owner, 'Zenodo（CERN）');
eq('登録機関を推定する', a1.ra, 'DataCite');
eq('解決 URL を組み立てる', a1.url, 'https://doi.org/10.5281/zenodo.22058624');
ok('既知の注意がつく', !!a1.note, '改訂版 Series I の注記が出るはず');

const a2 = D.analyseOne('10.99999/unknown', 1);
eq('未知の接頭辞は推定しない', a2.owner, null);
eq('未知の接頭辞は登録機関も出さない', a2.ra, null);

ok('撤回対象の初版に警告がつく',
   D.NOTES['10.5281/zenodo.17173703'] && D.NOTES['10.5281/zenodo.17173703'].kind === 'warn');

/* ------------------------------------------------------- 掲載元の組み立て */
section('掲載元のレコード');

eq('Zenodo', D.registryLink('10.5281/zenodo.22058624').url, 'https://zenodo.org/records/22058624');
eq('SSRN', D.registryLink('10.2139/ssrn.7358779').url,
   'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7358779');
eq('arXiv', D.registryLink('10.48550/arXiv.1808.00023').url, 'https://arxiv.org/abs/1808.00023');
eq('組み立てられないものは null', D.registryLink('10.1145/3287560.3287598'), null);

/* ---------------------------------------------------------------- ORCID */
section('ORCID');

eq('区切りつきをそのまま', D.normalizeOrcid('0009-0000-1406-0547'), '0009-0000-1406-0547');
eq('URL 形式', D.normalizeOrcid('https://orcid.org/0009-0000-1406-0547'), '0009-0000-1406-0547');
eq('区切りなしの 16 桁', D.normalizeOrcid('0009000014060547'), '0009-0000-1406-0547');
eq('全角入力', D.normalizeOrcid('０００９－００００－１４０６－０５４７'), '0009-0000-1406-0547');
eq('末尾の X を大文字に', D.normalizeOrcid('0000-0002-1694-233x'), '0000-0002-1694-233X');

// ISO 7064 MOD 11-2。既知の iD で照合する。
eq('チェックディジット（著者）', D.orcidCheckDigit('000900001406054'), '7');
eq('チェックディジット（ORCID の例 1）', D.orcidCheckDigit('000000021825009'), '7');
eq('チェックディジット（ORCID の例 2）', D.orcidCheckDigit('000000015109370'), '0');
// 末尾が X になる実在の形（0000-0002-1694-233X）
eq('チェックディジットが X になる例', D.orcidCheckDigit('000000021694233'), 'X');
eq('末尾 X の iD を妥当と認める', D.validateOrcid('0000-0002-1694-233X').ok, true);

eq('妥当な iD', D.validateOrcid('0009-0000-1406-0547').ok, true);
eq('チェックディジット違いを落とす', D.validateOrcid('0009-0000-1406-0548').ok, false);
ok('落とすときに正しい末尾を示す',
   /末尾は 7 のはず/.test(D.validateOrcid('0009-0000-1406-0548').reason),
   D.validateOrcid('0009-0000-1406-0548').reason);
eq('桁足らずを落とす', D.validateOrcid('0009-0000-1406-054').ok, false);
eq('英字混じりを落とす', D.validateOrcid('0009-0000-140A-0547').ok, false);

/* -------------------------------------------------- 応答の解釈（記録した形） */
section('応答の解釈');

const cr = D.fromCrossref({
  title: ['Fairness and Abstraction in Sociotechnical Systems'],
  author: [{ given: 'Andrew D.', family: 'Selbst', ORCID: 'https://orcid.org/0000-0002-1825-0097' },
           { given: 'danah', family: 'boyd' }],
  type: 'proceedings-article',
  'container-title': ['FAT* ’19'],
  publisher: 'ACM',
  issued: { 'date-parts': [[2019, 1, 29]] },
  license: [{ URL: 'https://example.org/license' }],
  URL: 'https://doi.org/10.1145/3287560.3287598',
  volume: '1', issue: '2', page: '59-68'
});
eq('Crossref: 題名', cr.title, 'Fairness and Abstraction in Sociotechnical Systems');
eq('Crossref: 著者名を姓, 名 にする', cr.authors, ['Selbst, Andrew D.', 'boyd, danah']);
eq('Crossref: 年', cr.year, 2019);
eq('Crossref: 掲載', cr.container, 'FAT* ’19');
eq('Crossref: ORCID のある著者だけ拾う', cr.orcids,
   [{ name: 'Selbst, Andrew D.', id: '0000-0002-1825-0097', bad: false, authenticated: false }]);
eq('Crossref: 掲載ページ', cr.landing, 'https://doi.org/10.1145/3287560.3287598');

const dcVersion = D.fromDataCite({
  titles: [{ title: 'The Trinity-Infinity Framework' }],
  creators: [{ name: 'Nemoto, Takuya',
               nameIdentifiers: [{ nameIdentifierScheme: 'ORCID', nameIdentifier: 'https://orcid.org/0009-0000-1406-0547' }] }],
  types: { resourceTypeGeneral: 'Preprint' },
  publisher: 'Zenodo', publicationYear: 2026, version: 'v2',
  rightsList: [{ rightsUri: 'https://creativecommons.org/licenses/by/4.0/' }],
  url: 'https://zenodo.org/records/22058624',
  relatedIdentifiers: [{ relationType: 'IsVersionOf', relatedIdentifier: '10.5281/zenodo.22058623' }]
});
eq('DataCite: 題名', dcVersion.title, 'The Trinity-Infinity Framework');
eq('DataCite: 著者', dcVersion.authors, ['Nemoto, Takuya']);
eq('DataCite: ORCID', dcVersion.orcids, [{ name: 'Nemoto, Takuya', id: '0009-0000-1406-0547', bad: false }]);
eq('DataCite: バージョン DOI と判定', dcVersion.zenodoKind, 'バージョン DOI（この版を固定して指します）');
eq('DataCite: 掲載ページ', dcVersion.landing, 'https://zenodo.org/records/22058624');

const dcConcept = D.fromDataCite({
  titles: [{ title: 'x' }], creators: [], types: {}, publisher: 'Zenodo', publicationYear: 2026,
  relatedIdentifiers: [{ relationType: 'HasVersion', relatedIdentifier: '10.5281/zenodo.1' }]
});
eq('DataCite: コンセプト DOI と判定', dcConcept.zenodoKind, 'コンセプト DOI（常に最新版を指します）');

const dcBare = D.fromDataCite({ titles: [], creators: [], types: {} });
eq('DataCite: 欄が無くても落ちない', dcBare.orcids, []);
eq('DataCite: 関連が無ければ判定しない', dcBare.zenodoKind, null);

const crBare = D.fromCrossref({});
eq('Crossref: 欄が無くても落ちない', crBare.authors, []);
eq('Crossref: 題名が無ければ undefined', crBare.title, undefined);

/* ---------------------------------------------------------------- 索引先 */
section('索引先');

ok('索引先が三つの群に分かれている',
   ['索引', '発見', 'API'].every(g => D.INDEXES.some(i => i.group === g)));
ok('API 群のホストがすべて api. か既知の API',
   D.INDEXES.filter(i => i.group === 'API')
     .every(i => /^https:\/\/(api\.|opencitations\.net)/.test(i.url('10.1/x'))),
   D.INDEXES.filter(i => i.group === 'API').map(i => i.url('10.1/x')).join(' '));
ok('索引群に api.crossref.org / api.datacite.org / api.openalex.org を置いていない',
   !D.INDEXES.filter(i => i.group === '索引')
     .some(i => /^https:\/\/api\.(crossref|datacite|openalex)\./.test(i.url('10.1/x'))),
   D.INDEXES.filter(i => i.group === '索引').map(i => i.url('10.1/x')).join(' '));
ok('すべての索引先が https',
   D.INDEXES.every(i => i.url('10.1145/x').indexOf('https://') === 0));

/* -------------------------------------------------- URL への載せ方（厳密） */
section('URL への載せ方');

/* DOI Handbook 2.5.2.3 が符号化を求める文字。生のまま href に置くと、
 * リンクが別の場所を指すか、そもそも URL として成立しない。 */
eq('% を符号化する', D.encodeDoi('10.1234/a%b'), '10.1234/a%25b');
eq('空白を符号化する', D.encodeDoi('10.1234/a b'), '10.1234/a%20b');
eq('# を符号化する（素片と読まれるため）', D.encodeDoi('10.1234/a#b'), '10.1234/a%23b');
eq('? を符号化する（クエリと読まれるため）', D.encodeDoi('10.1234/a?b'), '10.1234/a%3Fb');
eq('" を符号化する', D.encodeDoi('10.1234/a"b'), '10.1234/a%22b');
eq("' を符号化する", D.encodeDoi("10.1234/a'b"), '10.1234/a%27b');
/* RFC 3986 が URI から除いている文字。Wiley の SICI 形式が < > を本当に含む。 */
eq('< > を符号化する', D.encodeDoi('10.1234/a<b>c'), '10.1234/a%3Cb%3Ec');
eq('{ } | \\ ^ ` [ ] を符号化する',
   D.encodeDoi('10.1234/{}|\\^`[]'), '10.1234/%7B%7D%7C%5C%5E%60%5B%5D');
eq('非 ASCII は UTF-8 で符号化する', D.encodeDoi('10.1234/あ'), '10.1234/%E3%81%82');
/* DOI に頻出し、パスの中では曖昧にならない文字は残す。読める URL のため。 */
eq('/ : ; ( ) , = + $ ! * @ - _ . ~ は残す',
   D.encodeDoi('10.1234/a/b:c;d(e),f=g+h$i!j*k@l-m_n.o~p'),
   '10.1234/a/b:c;d(e),f=g+h$i!j*k@l-m_n.o~p');

const SICI = '10.1002/(SICI)1097-0258(19980815)17:15<1623::AID-SIM871>3.0.CO;2-N';
eq('SICI 形式の DOI が正しい解決 URL になる',
   D.doiUrl(SICI),
   'https://doi.org/10.1002/(SICI)1097-0258(19980815)17:15%3C1623::AID-SIM871%3E3.0.CO;2-N');
eq('analyseOne が返す url も符号化済み', D.analyseOne(SICI, 0).url, D.doiUrl(SICI));

/* URL の中の %XX は定義上つねに符号化である（DOI 自身の % は %25 になる）。 */
eq('百分率符号化された URL から素の DOI に戻す',
   D.extract('https://doi.org/10.1002/%28SICI%291097-0258%2819980815%2917%3A15%3C1623%3A%3AAID-SIM871%3E3.0.CO%3B2-N').list,
   [SICI]);
eq('%25 は % に戻す', D.extract('https://doi.org/10.1234/a%25b').list, ['10.1234/a%b']);
eq('壊れた符号化には触らない', D.extract('https://doi.org/10.1234/ab%zz').list, ['10.1234/ab%zz']);
eq('解いて空白になるなら触らない', D.extract('https://doi.org/10.1234/a%20b').list, ['10.1234/a%20b']);
eq('平文の % はそのまま', D.extract('10.1234/a%25b は平文').list, ['10.1234/a%25b']);

/* 往復。符号化して解くと元に戻る。 */
ok('符号化 → 復号で元に戻る',
   ['10.1234/a%b', '10.1234/a b', SICI, '10.1234/あ', '10.1234/a<b>c']
     .every((d) => decodeURIComponent(D.encodeDoi(d)) === d));

/* ------------------------------------------------- URL の尾を落とす（厳密） */
section('URL の尾');

eq('URL の素片（#）を落とす',
   D.extract('https://doi.org/10.1234/abc#section2').list, ['10.1234/abc']);
eq('URL のクエリ（&）を落とす',
   D.extract('https://ex.com/s?doi=10.1234/abc&lang=ja').list, ['10.1234/abc']);
eq('URL のクエリ（?）を落とす',
   D.extract('https://ex.com/10.1234/abc?utm_source=x').list, ['10.1234/abc']);
/* 平文では落とさない。DOI の接尾辞は規格上は不透明で、# や & を含みうる。 */
eq('平文の # は落とさない', D.extract('10.1234/abc#frag は平文').list, ['10.1234/abc#frag']);
eq('平文の & は落とさない', D.extract('10.1234/a&b は平文').list, ['10.1234/a&b']);
eq('doi: 接頭の平文でも落とさない', D.extract('doi:10.1234/a&b').list, ['10.1234/a&b']);

/* ------------------------------------------------------ 点検（何が悪いか） */
section('点検');

const lv = (d) => D.inspect(d).map((f) => f.level);
const txt = (d) => D.inspect(d).map((f) => f.text).join(' / ');

ok('正しい DOI には bad が出ない', lv('10.5281/zenodo.22058624').indexOf('bad') < 0, txt('10.5281/zenodo.22058624'));
ok('接頭辞の桁が足りないと bad', lv('10.99/x').indexOf('bad') >= 0);
ok('接頭辞が 10 桁だと bad', lv('10.1234567890/x').indexOf('bad') >= 0);
ok('10. で始まらないと bad', lv('11.1234/x').indexOf('bad') >= 0);
ok('スラッシュが無いと bad', lv('10.5281zenodo.1').indexOf('bad') >= 0);
ok('接尾辞が空だと bad', lv('10.5281/').indexOf('bad') >= 0);
ok('下位接頭辞（10.1234.5/x）は通る', lv('10.1234.5/x').indexOf('bad') < 0, txt('10.1234.5/x'));
ok('符号化が要る文字があると warn', lv(SICI).indexOf('warn') >= 0, txt(SICI));
ok('非 ASCII の接尾辞は warn', lv('10.1234/あ').indexOf('warn') >= 0);
ok('大文字を含むと info（DOI は大小を区別しない）',
   lv('10.5281/ZENODO.1').indexOf('info') >= 0, txt('10.5281/ZENODO.1'));
ok('小文字だけなら info は出ない', lv('10.5281/zenodo.1').indexOf('info') < 0);
ok('bad があれば valid にならない', D.analyseOne('10.99/x', 0).valid === false);
ok('warn だけなら valid のまま', D.analyseOne(SICI, 0).valid === true, txt(SICI));

/* ------------------------------------------------------------ 日付の採り方 */
section('Crossref の日付');

/* issued が空でも、published-online などに入っていることがある。
 * created は登録日であって刊行日ではないので、最後に見る。 */
eq('issued があればそれを採る',
   D.crossrefDate({ issued: { 'date-parts': [[2019, 1, 29]] } }),
   { parts: [2019, 1, 29], from: 'issued' });
const dOnline = D.crossrefDate({ issued: { 'date-parts': [[null]] },
                                 'published-online': { 'date-parts': [[2019, 3, 4]] } });
eq('issued が [[null]] なら次を見る', dOnline && dOnline.from, 'published-online');
eq('その日付も年月日まで採る', dOnline && dOnline.parts, [2019, 3, 4]);
eq('どこにも無ければ null', D.crossrefDate({}), null);
const dCreated = D.crossrefDate({ created: { 'date-parts': [[2020]] } });
eq('created は最後の手段', dCreated && dCreated.from, 'created');
const dMixed = D.crossrefDate({ issued: { 'date-parts': [[2019, null, null]] } });
eq('null 混じりの date-parts から数字だけ採る', dMixed && dMixed.parts, [2019]);

/* ------------------------------------------------------------ 種別の対応 */
section('種別の対応');

eq('journal-article', D.typePair('journal-article'), ['article', 'article-journal']);
eq('proceedings-article', D.typePair('proceedings-article'), ['inproceedings', 'paper-conference']);
eq('book-chapter', D.typePair('book-chapter'), ['incollection', 'chapter']);
eq('dissertation', D.typePair('dissertation'), ['phdthesis', 'thesis']);
eq('DataCite の Software', D.typePair('Software'), ['software', 'software']);
eq('知らない種別は null（当てずっぽうにしない）', D.typePair('とても新しい種別'), null);

/* ---------------------------------------------------------- 書き出しの逃がし */
section('書き出しの逃がし');

eq('LaTeX: & % $ # _ { }', D.tex('& % $ # _ { }'), '\\& \\% \\$ \\# \\_ \\{ \\}');
eq('LaTeX: ~ と ^ は命令にする', D.tex('~^'), '\\textasciitilde{}\\textasciicircum{}');
/* \ を先に直してから { } を直すと、差し込んだ命令の中括弧まで逃がしてしまう。 */
eq('LaTeX: バックスラッシュを二重に逃がさない',
   D.tex('a\\b'), 'a\\textbackslash{}b');
eq('LaTeX: 頁は en ダッシュ二つでつなぐ', D.texPages('1623-1633'), '1623--1633');
eq('LaTeX: 全角ダッシュの頁も同じ形にする', D.texPages('1–9'), '1--9');
eq('LaTeX: 頁が一つなら触らない', D.texPages('e12345'), 'e12345');

eq('YAML: " を逃がす', D.yaml('a"b'), '"a\\"b"');
eq('YAML: \\ を逃がす', D.yaml('a\\b'), '"a\\\\b"');
eq('YAML: 制御文字を逃がす', D.yaml('a\tb'), '"a\\x09b"');

eq('Markdown: | を逃がす', D.mdCell('a|b'), 'a\\|b');
eq('Markdown: [ ] を逃がす', D.mdCell('[a]'), '\\[a\\]');
eq('Markdown: 改行は空白にする', D.mdCell('a\nb'), 'a b');
eq('Markdown: . や - は素のまま', D.mdCell('10.1234/a-b'), '10.1234/a-b');

/* 実際に一件通して、壊れた書誌が出てこないことを見る。 */
const one = D.analyseOne('10.1177/2053951716679679', 0);
one.meta = {
  source: 'Crossref', title: 'Big Data & Society: 50% of {it}',
  authors: ['Mittelstadt, Brent Daniel', 'boyd, danah'],
  container: 'Big Data & Society', publisher: 'SAGE',
  year: 2016, dateParts: [2016, 7, 1], type: 'journal-article',
  volume: '3', issue: '2', page: '1-21'
};

const bib = D.bibtex([one]);
ok('BibTeX: 逃がしていない & が残っていない', !/(^|[^\\])&/.test(bib), bib);
ok('BibTeX: 逃がしていない % が残っていない', !/(^|[^\\])%/.test(bib), bib);
ok('BibTeX: 種別が @article になる', bib.indexOf('@article{') === 0, bib.slice(0, 40));
ok('BibTeX: 月が入る', /month\s+= \{jul\}/.test(bib), bib);
ok('BibTeX: 頁が -- になる', /pages\s+= \{1--21\}/.test(bib), bib);
ok('BibTeX: 中括弧の対応が取れている',
   (bib.match(/(^|[^\\])\{/g) || []).length === (bib.match(/(^|[^\\])\}/g) || []).length, bib);

const cslOut = JSON.parse(D.csl([one]));
eq('CSL: 種別を対応させる', cslOut[0].type, 'article-journal');
eq('CSL: 日付は年月日まで入れる', cslOut[0].issued, { 'date-parts': [[2016, 7, 1]] });
eq('CSL: 巻・号・頁を入れる',
   [cslOut[0].volume, cslOut[0].issue, cslOut[0].page], ['3', '2', '1-21']);
eq('CSL: 姓名を分ける', cslOut[0].author[0], { family: 'Mittelstadt', given: 'Brent Daniel' });

const cffOut = D.cff([one]);
ok('CFF: 題名が引用符で囲まれている', /title: "Big Data & Society: 50% of \{it\}"/.test(cffOut), cffOut);
ok('CFF: 種別が article', /- type: article/.test(cffOut), cffOut);
ok('CFF: authors が必ず入る',
   D.cff([D.analyseOne('10.1234/x', 0)]).indexOf('authors:') >= 0,
   D.cff([D.analyseOne('10.1234/x', 0)]));

ok('Markdown: 表の列が割れていない',
   D.markdown([one]).split('\n').slice(2).every((r) => r.split(/(?<!\\)\|/).length === 6),
   D.markdown([one]));

ok('書き出しは書式が不正なものを含めない',
   D.bibtex([D.analyseOne('10.99/x', 0)]) === '' && D.plain([D.analyseOne('10.99/x', 0)]) === '');
eq('plain は符号化済みの URL を出す', D.plain([one]), 'https://doi.org/10.1177/2053951716679679');

/* ------------------------------------------------------- API の返す ORCID */
section('API の返す ORCID');

/* 登録側の打ち間違いは、チェックディジットで落ちる。落として捨てるのではなく、
 * 印を付けて出す —— 誰の iD が壊れているのかは、見えたほうがよい。 */
const badOrcid = D.fromCrossref({
  author: [{ family: 'X', given: 'Y', ORCID: 'https://orcid.org/0000-0002-1825-0098' }]
});
ok('チェックディジットの合わない ORCID に印が付く', badOrcid.orcids[0].bad === true,
   JSON.stringify(badOrcid.orcids));
ok('正しい ORCID には印が付かない',
   D.fromCrossref({ author: [{ family: 'X', ORCID: 'http://orcid.org/0000-0002-1825-0097' }] })
     .orcids[0].bad === false);
ok('authenticated-orcid をそのまま持つ',
   D.fromCrossref({ author: [{ family: 'X', ORCID: 'https://orcid.org/0000-0002-1825-0097',
                               'authenticated-orcid': true }] }).orcids[0].authenticated === true);

/* ---------------------------------------------------------------- 結果 */
console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。\n');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
