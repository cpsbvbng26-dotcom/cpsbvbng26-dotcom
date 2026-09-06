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
eq('Crossref: ORCID のある著者だけ拾う', cr.orcids, [{ name: 'Selbst, Andrew D.', id: '0000-0002-1825-0097' }]);
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
eq('DataCite: ORCID', dcVersion.orcids, [{ name: 'Nemoto, Takuya', id: '0009-0000-1406-0547' }]);
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

/* ---------------------------------------------------------------- 結果 */
console.log('\n' + '-'.repeat(56));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。\n');
  failures.forEach((f, i) => console.log('  ' + (i + 1) + '. ' + f));
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
