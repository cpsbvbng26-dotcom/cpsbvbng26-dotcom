/* 決めごと 10 の見張りの式。check_site.js と check_ecosystem.js が、ここから同じ式を読む。
 *
 * **存命の人物は「両親」という語までにする。**親がいることは当たり前なので、続柄の一語までは通す。
 *
 *   越え  一人を指す語。祖父・曾祖父・祖母は故人であり、この限りではないので外す。
 *         「運営母体」のような複合語は、助詞が続かないので当たらない。
 *   帰属  「両親」の語に、考え・同意・計画・気持ちを帰す文。語は一語でも、中身を足せば一語を越える。
 *         2026-11-12 まで、死後の頁に、誓いを両親が理解しているという一文があった。
 *         越えの式は一人を指す語しか見ておらず、通していた。
 *         「両親が存命のうちに」のような、時を区切るだけの文は当たらない。
 *
 *   計画  存命の第三者の事業や計画に触れる記載。2026-11-12 の続きの二度目の点検で、self-correction の
 *         SC-016 が、中身を外したあとも「生存する第三者の事業計画」と、何についての文だったかを書き続けていた。
 *         続柄の語が無いので、越えの式も帰属の式も通していた。登録簿と設定に当てる（check_ecosystem.js の 12i）。
 *
 * 三つの式を一か所に置くのは、写せば黙ってずれるからである。
 */

'use strict';

const 越え = /(?<![祖曾伯叔義])(父|母)(が|の|は|を|も|に|と|へ)|父親|母親|my (father|mother)|mein Vater|meine Mutter|mon père|ma mère|mio padre|mia madre/;

const 帰属 = new RegExp([
  /両親(?:の|が|は|も|から|に|とも)[^。\n]*?(?:理解|了解|了承|承諾|同意|賛成|反対|許し|許可|希望|意向|意見|考え|計画|予定|気持ち|思い|願い|望み|期待|心配|喜|応援|支持|納得|認め|望ん|願っ|思っ|知っ|祝福)/.source,
  /\bparents\b[^.\n]*?\b(?:understand|understood|know|knew|agree|approve|consent|support|accept|wish|hope|want|plan|feel|felt|think|thought|believe|bless)\w*/.source,
  /\b(?:understanding|consent|approval|support|blessing|permission|wish(?:es)?|hopes|plans|feelings|views?) of (?:my |the author['’]s |both )?parents\b/.source,
  /\bEltern\b[^.\n]*?\b(?:versteh|wiss|zustimm|einverstanden|unterstütz|billig|wünsch|hoff|plan)\w*/.source,
  /\bparents\b[^.\n]*?\b(?:compren|approuv|consent|souti|accept|souhait|espè|espér)\w*/.source,
  /\bgenitori\b[^.\n]*?\b(?:capisc|comprend|approv|consent|sosten|accett|desider|sper)\w*/.source,
].join('|'), 'i');

const 計画 = new RegExp([
  /(?:存命|生存)(?:する|している|中の|の)?(?:第三者|家族|親族|人物|方)[^。\n]{0,40}?(?:事業|計画|予定|承継|継が)/.source,
  /事業計画|事業(?:を|の)承継|承継する事業/.source,
  /\b(?:living|third[- ]party)\b[^.\n]{0,60}?\b(?:business(?:es)?|plans?|planned|planning|succession)\b/.source,
  /\bbusiness plans?\b/.source,
].join('|'), 'i');

/* 文から、越え・帰属・計画の当たりを返す。当たらなければ空の配列。 */
function scan(text) {
  const hits = [];
  const a = 越え.exec(text);
  if (a) hits.push(a[0]);
  const b = 帰属.exec(text);
  if (b) hits.push(b[0].length > 40 ? b[0].slice(0, 40) + '…' : b[0]);
  const c = 計画.exec(text);
  if (c) hits.push(c[0].length > 40 ? c[0].slice(0, 40) + '…' : c[0]);
  return hits;
}

module.exports = { 越え, 帰属, 計画, scan };
