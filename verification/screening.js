/* 場の選別の見張りの式。check_ecosystem.js の 12l が、ここから読む。
 *
 * SSRN・PhilArchive・PhilPapers が、載せる前に「何を」「誰が」見るかを、取り寄せた頁は言っていない。
 * 取り寄せた SSRN の頁が言うのは、SSRN が学術的な内容の基準を満たすかを決めること、プレプリントを査読しないこと、
 * 非学術的なものは投稿の要件を満たさないこと、題・執筆日・要旨・全著者の情報が要ることだけである。
 * PhilArchive の頁は、載せる前に誰が何を見るかを言っていない。
 *
 * 2026-11-12 の二度目と三度目の見落としの節は、独仏伊の頁から「編集の人が見る」という文を外し、
 * その語を一つずつ「無い」の表に入れた。四度目の点検で、同じ段落の次の文「主題と形式を見る」が三つの言語に残り、
 * trinity-infinity の README（日英）と ARXIV.md にも「主題と体裁を見る」が残っていた。語の表では、言い換えを止められない。
 * そこで、語ではなく形で止める。
 *
 *   段落  場の名（SSRN・PhilArchive・PhilPapers）を含む段落。HTML の <p>・<li>・<dd>・<td>、Markdown の空行で区切る。
 *         「Geprüft werden Gegenstand und Form.」のように、場の名を前の文に置いて主語を省く文があるので、文ではなく段落で見る。
 *   見る  選別の動き（見る・確かめる・審査・選別・check・screen・prüfen・examiner・controllare など）と、
 *         選別の中身か担い手（主題・体裁・形式・射程・編集者・subject・scope・format・Form・sujet・argomento など）が、
 *         同じ文にあれば止める。日英独仏伊の五つ。
 *   通す  取り寄せた頁が何も言わないことを述べる文（「…頁は、誰が何を見るかを書いていません」「None of the … pages
 *         fetched says …」など）。<code> の中の句は、取り寄せた頁からの引用なので、式に当てない。
 *
 * 記録（点検の記録、self-correction の登録簿、外部の評価の記録）には当てない。そこにある文は、その日に何が書かれていたかの記録である。
 */

'use strict';

/* 語の境目。JavaScript の \b は é・ü のような字を語の外と見るので、文字の種類で切る。 */
const 語 = (alts) => new RegExp('(?<![\\p{L}\\p{N}_])(?:' + alts + ')(?![\\p{L}\\p{N}_])', 'iu');
const 頭 = (alts) => '(?<![\\p{L}\\p{N}_])(?:' + alts + ')';

const 場 = 語('SSRN|PhilArchive|PhilPapers');

/* 選別の動き。日本語は語の境目を持たないので、そのまま当てる。 */
const 動き = new RegExp([
  '見る|見ます|見て|見た|見るもの|確かめ|確認|審査|選別|点検|調べ|判断|ふるい|門',
  頭('check(?:s|ed|ing)?|screen(?:s|ed|ing)?|examin|vet(?:s|ted|ting)?|review(?:s|ed|ing)?|assess|judg|look(?:s|ed)? at'),
  頭('prüf|geprüft|Prüfung|begutacht|kontrollier|gesichtet'),
  頭('examin|vérifi|contrôl|évalu|filtr'),
  頭('controll|verific|esamin|valut|vagli'),
].join('|'), 'iu');

/* 選別の中身か担い手。 */
const 中身 = new RegExp([
  '主題|題材|体裁|書式|形式|射程|分野の範囲|編集スタッフ|編集者|編集の人|カテゴリ編集|担当者|モデレーター',
  頭('subject(?: matter)?|scope|format|form|topic|editors?|editorial|staff|moderators?') + '(?![\\p{L}])',
  頭('Gegenstand|Form|Format|Thema|Umfang|Redaktion|Redakteur|Mitarbeiter|Herausgeber'),
  頭('sujet|forme|format|thème|rédaction|rédacteur|éditeur|personnel|modérateur'),
  頭('argomento|forma|formato|tema|redazion|redattor|editor|personale|moderator'),
].join('|'), 'iu');

/* 取り寄せた頁が言わないことを述べる文は通す。 */
const 言わない = new RegExp([
  '書いていません|書きません|言っていません|述べていません|書いていない|言っていない|書かれていない|書かれていません',
  頭('(?:none of|no) (?:the )?[\\p{L}\\s]{0,30}pages?') + '[^.]{0,40}' + 頭('says?') + '|' + 頭('does not say|do not say'),
  頭('keine der abgerufenen Seiten|sagt keine der'),
  頭('aucune des pages'),
  頭('nessuna delle pagine'),
].join('|'), 'iu');

const 剥ぐ = (s) => s.replace(/<code>[\s\S]*?<\/code>/g, ' ').replace(/<\/?t[dh]\b[^>]*>/gi, ' | ').replace(/`[^`\n]*`/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\\n/g, ' ').replace(/\s+/g, ' ');

/* JSON は値の文字列ごとに、HTML は塊の要素ごとに、Markdown は空行と行頭の記号で分ける。表の一行は一つの段落で、欄は文として見る。 */
function 段落(text) {
  let parts = [String(text)];
  try {
    const j = JSON.parse(text);
    parts = [];
    (function walk(v) {
      if (typeof v === 'string') parts.push(v);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    })(j);
  } catch (e) { /* JSON でなければ、そのまま */ }
  return parts.flatMap((s) => s.split(/<\/?(?:p|li|dd|dt|tr|h[1-6]|div|section|br)\b[^>]*>|\n\s*\n|\n(?=\s*(?:[-*|#>]|\d+\.)\s)/i));
}

function 文(p) {
  return p.split(/(?<=[。！？])|(?<=[.!?])\s+(?=[A-Z0-9「（(“"‘']|[À-ÖØ-Þ])|;\s+|\s\|\s/);
}

/* 止める文を返す。 */
function scan(text) {
  const out = [];
  for (const raw of 段落(text)) {
    const p = 剥ぐ(raw);
    if (!場.test(p)) continue;
    for (const s of 文(p)) {
      const t = s.trim();
      if (!t || 言わない.test(t)) continue;
      if (動き.test(t) && 中身.test(t)) out.push(t);
    }
  }
  return out;
}

module.exports = { scan, 場, 動き, 中身, 言わない };
