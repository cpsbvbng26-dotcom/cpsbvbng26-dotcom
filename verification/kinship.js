/* 決めごと 10 の見張りの式。check_site.js と check_ecosystem.js が、ここから同じ式を読む。
 *
 * **存命の人物は「両親」という語までにする。**親がいることは当たり前なので、続柄の一語までは通す。
 *
 *   越え  一人を指す語。父・母のほか、祖父母・曾祖父母、兄弟姉妹、おじ・おば、義理の親、配偶者。
 *         「運営母体」「分母」のような複合語は当たらない。「兄弟」「姉妹」「師弟」は、ここでは兄弟の
 *         リポジトリや姉妹の頁を指す語なので、二字のままでは当たらない（兄・姉・弟・妹の一字に助詞が続けば当たる）。
 *         配偶者・妻・夫は、本の要約にも出る一般の語なので、私・著者・筆者・運営者の、が付くときだけ当たる。
 *         2026-11-12（三度目の見落とし）まで、この式は祖父・曾祖父・祖母を「故人である」として一律に外していた。
 *         その一律の前提を、どの頁も述べていなかった。self-correction の SC-030 は、存命かどうか確かめていない
 *         親族に、伝聞を帰していた。一律に外すのをやめ、公開している頁が自ら故人だと述べる人だけを、
 *         下の「故人」の表で外す。
 *   帰属  「両親」の語に、考え・同意・計画・気持ちを帰す文。語は一語でも、中身を足せば一語を越える。
 *         2026-11-12 まで、死後の頁に、誓いを両親が理解しているという一文があった。
 *         越えの式は一人を指す語しか見ておらず、通していた。
 *         「両親が存命のうちに」のような、時を区切るだけの文は当たらない。
 *         2026-11-12（三度目の見落とし）から、家の伝統・宗旨・家の祭祀を書く文も止める。
 *         死後の頁が、家の伝統の葬儀の形と、名の漢字を付けた場を書いていた。家の、と書けば、
 *         存命の家族の宗教の事実になる。著者自身の手配だけを書く。
 *
 *   計画  存命の第三者の事業や計画に触れる記載。2026-11-12 の続きの二度目の点検で、self-correction の
 *         SC-016 が、中身を外したあとも「生存する第三者の事業計画」と、何についての文だったかを書き続けていた。
 *         続柄の語が無いので、越えの式も帰属の式も通していた。登録簿と設定に当てる（check_ecosystem.js の 12i）。
 *
 * 三つの式を一か所に置くのは、写せば黙ってずれるからである。
 */

'use strict';

/* 公開している頁が、自ら故人だと述べている人。ここに無い人は、続柄の語ごと止める。
 * 語の除外は、その人の名が同じ文書にあるときだけ効く（名の無い文書の同じ語は、別の人かもしれない）。 */
const 故人 = [
  {
    名: '大谷恒',
    語: ['外曾祖父', '外曽祖父', '曾祖父', 'great-grandfather'],
    頁: 'naval-gazette-notes/README.md',
    文: '公報の大尉と報道の少佐の違いは、戦死による一階級の特進によるものと判断しています。',
  },
];

const 助 = '(?:が|の|は|を|も|に|と|へ|から)';
const 越え = new RegExp([
  '(?<![祖曾曽伯叔義分])(?:父|母)' + 助 + '|父親|母親',
  /(?:外)?(?:曾|曽|高)?祖(?:父|母)|(?:伯|叔)(?:父|母)|義(?:父|母|兄|姉|弟|妹)/.source,
  '(?<![師子門姉兄])(?:兄|姉|弟|妹)' + 助,
  /(?:私|わたし|著者|筆者|運営者)の(?:配偶者|妻|夫)/.source,
  /\b(?:my|the author['’]s) (?:father|mother|grandfather|grandmother|great-grandfather|great-grandmother|brother|sister|uncle|aunt|spouse|wife|husband|father-in-law|mother-in-law|brother-in-law|sister-in-law)\b/.source,
  /\b(?:mein|meine|meinem|meiner|meinen) (?:Vater|Mutter|Großvater|Großmutter|Urgroßvater|Urgroßmutter|Bruder|Schwester|Onkel|Tante|Ehefrau|Ehemann|Ehepartner|Ehepartnerin|Schwiegervater|Schwiegermutter)\b/.source,
  /\b(?:mon|ma) (?:père|mère|grand-père|grand-mère|arrière-grand-père|arrière-grand-mère|frère|sœur|soeur|oncle|tante|époux|épouse|mari|femme|conjoint|conjointe|beau-père|belle-mère)(?![\w-])/.source,
  /\b(?:mio|mia) (?:padre|madre|nonno|nonna|bisnonno|bisnonna|fratello|sorella|zio|zia|marito|moglie|coniuge|suocero|suocera)\b/.source,
].join('|'), 'i');

const 帰属 = new RegExp([
  /両親(?:の|が|は|も|から|に|とも)[^。\n]*?(?:理解|了解|了承|承諾|同意|賛成|反対|許し|許可|希望|意向|意見|考え|計画|予定|気持ち|思い|願い|望み|期待|心配|喜|応援|支持|納得|認め|望ん|願っ|思っ|知っ|祝福)/.source,
  /\bparents\b[^.\n]*?\b(?:understand|understood|know|knew|agree|approve|consent|support|accept|wish|hope|want|plan|feel|felt|think|thought|believe|bless)\w*/.source,
  /\b(?:understanding|consent|approval|support|blessing|permission|wish(?:es)?|hopes|plans|feelings|views?) of (?:my |the author['’]s |both )?parents\b/.source,
  /\bEltern\b[^.\n]*?\b(?:versteh|wiss|zustimm|einverstanden|unterstütz|billig|wünsch|hoff|plan)\w*/.source,
  /\bparents\b[^.\n]*?\b(?:compren|approuv|consent|souti|accept|souhait|espè|espér)\w*/.source,
  /\bgenitori\b[^.\n]*?\b(?:capisc|comprend|approv|consent|sosten|accett|desider|sper)\w*/.source,
  /* 家の伝統・宗旨・祭祀（2026-11-12、三度目の見落とし）。 */
  /家の(?:伝統|宗旨|宗教|宗派|祭祀|祖霊|しきたり|習わし|菩提寺)|(?:家|一族|実家)(?:の|が)?(?:宗旨|宗派|檀家|氏子)|神社で付けられた/.source,
  /\b(?:family|household)(?:['’]s)? (?:tradition|religion|faith|rite|rites|denomination|shrine|temple|ancestral spirits?)\b|\b(?:tradition|religion|faith|rites?) of (?:the|my|our) (?:family|household)\b|\b(?:given|assigned|chosen) at a (?:Shinto )?shrine\b/.source,
].join('|'), 'i');

const 計画 = new RegExp([
  /(?:存命|生存)(?:する|している|中の|の)?(?:第三者|家族|親族|人物|方)[^。\n]{0,40}?(?:事業|計画|予定|承継|継が)/.source,
  /事業計画|事業(?:を|の)承継|承継する事業/.source,
  /\b(?:living|third[- ]party)\b[^.\n]{0,60}?\b(?:business(?:es)?|plans?|planned|planning|succession)\b/.source,
  /\bbusiness plans?\b/.source,
].join('|'), 'i');

/* 故人の表に従って、その人の名がある文書からだけ、その人の続柄の語を外す。 */
function 外す(text) {
  let t = text;
  for (const p of 故人) {
    if (t.indexOf(p.名) < 0) continue;
    for (const w of p.語) t = t.split(w).join('〓');
  }
  return t;
}

/* 文から、越え・帰属・計画の当たりを返す。当たらなければ空の配列。 */
function scan(text) {
  const hits = [];
  const a = 越え.exec(外す(text));
  if (a) hits.push(a[0]);
  const b = 帰属.exec(text);
  if (b) hits.push(b[0].length > 40 ? b[0].slice(0, 40) + '…' : b[0]);
  const c = 計画.exec(text);
  if (c) hits.push(c[0].length > 40 ? c[0].slice(0, 40) + '…' : c[0]);
  return hits;
}

module.exports = { 越え, 帰属, 計画, 故人, 外す, scan };
