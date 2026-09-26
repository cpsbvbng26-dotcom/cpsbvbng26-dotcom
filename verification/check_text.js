/* 文字化けと既知の誤変換を止める。
 *
 *   node verification/check_text.js
 *
 * 依存パッケージなし。
 *
 * このリポジトリ群では、公開文の編集にあたって同じ種類の壊れ方が繰り返し起きている。
 * 見た目が似た別の漢字に置き換わり、意味が通らなくなる。日本語を読まない目視では
 * 気づきにくく、しかも壊れる場所が「捏造は行われていません」のような、いちばん
 * 重い一文であることが多い。
 *
 * 実際に起きたものを表に持ち、push のたびに落とす。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'site', 'pdf', 'venv']);
const EXT = ['.md', '.html', '.cff', '.json', '.js', '.py', '.yml'];

/* 実際に混入したもの。wrong は日本語として成立しない、または文脈で明らかに誤り。 */
const CORRUPTIONS = [
  { wrong: '捨造', right: '捏造', note: '「引用・出典の捏造は行われていません」— 開示文で最も重い一文' },
  { wrong: '取り縹う', right: '取り繕う', note: '「あとから表示だけを取り繕うことはできません」' },
  { wrong: '取り縁う', right: '取り繕う', note: '同上' },
  { wrong: '精締', right: '精緻', note: '「精緻な議論」' },
  { wrong: 'チェックデジット', right: 'チェックディジット', note: 'check digit の表記' }
];

/* 文字化けではなく、実在する字だが、この一連のリポジトリで表記を一つに決めたもの。
 * 誤変換と混ぜると、壊れているのか選んだのかが区別できなくなる。 */
const INCONSISTENT = [
  { wrong: '叙勳', right: '叙勲',
    note: '散文は常用字体。史料そのものの引用（敍勲四等授瑞寶章 など）はこの限りではない' }
];

/* 自分の散文では使わないと決めた自称。
 *
 * **紙面には印字されている。**そこは直せないし、直さない。だが、いま自分が
 * 書く文章では使わない。忘れると自然に戻ってくるので、機械で止める。
 * このリポジトリには逐語転記が無いので、例外は無い。 */
const FORBIDDEN = [
  { term: '独立研究者', note: '自分の散文では使わない' },
  { term: 'Independent Researcher', note: '同上（英訳）' }
];

/* **例外は、注釈と一体の一文だけ。**2026-09-26、著者が「独立研究者」を分かりやすさの
 * ための仮の肩書きとして使うと決めた。**語を解禁したのではない。**実際には一学部生で
 * あるという注釈が同じ一文に入っているときだけ通す。注釈を外して語だけ残せば、
 * これまでどおり止まる。文は一字一句で照らすので、言い換えれば止まる。 */
const ALLOWED_TITLE = [
  '「独立研究者」は、分かりやすさのための仮の肩書きで、実際には一学部生である',
  '「独立研究者」は分かりやすさのための仮の肩書きで、実際には一学部生です',
  '“Independent Researcher” is a provisional title used for clarity; in fact the author is an undergraduate'
];


/* ですます調から である調へ書き換えたとき、五段活用の連用形に「た」「ない」を
 * そのまま繋ぐ壊れ方が起きた。「載りました」→「載りた」、「使いません」→「使いない」。
 * 日本語として成立しないが、漢字は正しいので目視では通り抜ける。
 *
 * 推測で活用を作らない。実際に混入した形だけを表に持つ。 */
const CONJUGATION = [
  { re: /ありなかった/, right: 'なかった', note: '「ありません」からの書き換え' },
  { re: /ありた(?![いくかけ])/, right: 'あった', note: '同上' },
  { re: /なりた(?![いくかけ])/, right: 'なった', note: '「なりました」からの書き換え' },
  { re: /残りた(?![いくかけ])/, right: '残った', note: '「残りました」からの書き換え' },
  { re: /載りた(?![いくかけ])/, right: '載った', note: '「載りました」からの書き換え' },
  { re: /分かりた(?![いくかけ])/, right: '分かった', note: '「分かりました」からの書き換え' },
  { re: /書きた(?![いくかけ])/, right: '書いた', note: '「書きました」からの書き換え' },
  { re: /置きた(?![いくかけ])/, right: '置いた', note: '「置きました」からの書き換え' },
  { re: /拾いた(?![いくかけ])/, right: '拾った', note: '「拾いました」からの書き換え' },
  { re: /行いた(?![いくかけ])/, right: '行った', note: '「行いました」からの書き換え' },
  { re: /使いた(?![いくかけ])/, right: '使った', note: '「使いました」からの書き換え' },
  { re: /使いない/, right: '使わない', note: '「使いません」からの書き換え' },
  { re: /言いない/, right: '言わない', note: '「言いません」からの書き換え' },
  { re: /狂いる/, right: '狂う', note: '「狂います」からの書き換え' },
  { re: /落とする/, right: '落とす', note: '「落とします」からの書き換え' },
  /* 逆向きの壊れ方。**である調から ですます調へ書き換えたときに出た。**
   * く 五段の音便「書いた」に「ました」を繋いで「書いました」になる。
   * 「書く」の丁寧過去は「書きました」であって「書いました」ではない。
   * 2026-09-19 の書き換えで、10 リポジトリに 50 か所入った。
   * **推測で活用を作らない。**実際に混入した五つだけを持つ。 */
  { re: /書いました/, right: '書きました', note: '「書いた」＋「ました」' },
  { re: /置いました/, right: '置きました', note: '「置いた」＋「ました」' },
  { re: /届いました/, right: '届きました', note: '「届いた」＋「ました」' },
  { re: /効いました/, right: '効きました', note: '「効いた」＋「ました」' },
  { re: /付いました/, right: '付きました', note: '「付いた」＋「ました」' },
  /* **助詞を動詞として活用させた形。**同じ書き換えで出た別の壊れ方である。
   * 「一つしかない」の「か」を五段の語幹と見て「一つしきません」になる。
   * **実際に混入した二つだけを持つ。** */
  { re: /しきません/, right: 'しかありません', note: '助詞「しか」を活用させた形' },
  { re: /以外にません/, right: '以外にありません', note: '助詞「に」を活用させた形' },
  { re: /ひません/, right: 'はありません', note: '助詞「は」を活用させた形' }
];

/* Markdown のバッジ記法の壊れ。![...] の ! が落ちる、括弧が全角になる。 */
const BADGE_BROKEN = /\[!(?!\[)[^\]]*\]\(https?:\/\/[^)]*badge/;

/* 第三者のロゴは載せない方針。バッジは文字と色だけにする。
 * 商標は各社のもので、使用許諾を得ているわけではないため。 */
const BADGE_LOGO = /img\.shields\.io\/badge\/[^)\s"]*[?&]logo=/;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return [];
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return EXT.includes(path.extname(e.name)) ? [full] : [];
  });
}

const files = walk(ROOT);
const hits = [];

files.forEach((file) => {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // 表そのものを走査対象から外す（このファイル自身）
    if (rel === path.join('verification', 'check_text.js')) return;

    CORRUPTIONS.forEach((c) => {
      if (line.indexOf(c.wrong) >= 0) {
        hits.push({
          file: rel, line: i + 1, kind: '誤変換',
          msg: '「' + c.wrong + '」→「' + c.right + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });

    const 注釈を除いた行 = ALLOWED_TITLE.reduce((l, a) => l.split(a).join(''), line);
    FORBIDDEN.forEach((c) => {
      if (注釈を除いた行.indexOf(c.term) >= 0) {
        hits.push({
          file: rel, line: i + 1, kind: '使わないと決めた語',
          msg: '「' + c.term + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });

    INCONSISTENT.forEach((c) => {
      if (line.indexOf(c.wrong) >= 0) {
        hits.push({
          file: rel, line: i + 1, kind: '表記の揺れ',
          msg: '「' + c.wrong + '」→「' + c.right + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });
    CONJUGATION.forEach((c) => {
      const m = line.match(c.re);
      if (m) {
        hits.push({
          file: rel, line: i + 1, kind: '活用の壊れ',
          msg: '「' + m[0] + '」→「' + c.right + '」  ' + c.note,
          text: line.trim().slice(0, 90)
        });
      }
    });

    if (BADGE_BROKEN.test(line)) {
      hits.push({
        file: rel, line: i + 1, kind: 'バッジ記法',
        msg: '! または [ が欠けています（[![…](…)](…) の形）',
        text: line.trim().slice(0, 90)
      });
    }
    if (BADGE_LOGO.test(line)) {
      hits.push({
        file: rel, line: i + 1, kind: '第三者のロゴ',
        msg: 'バッジに logo= が入っています。文字と色だけにしてください',
        text: line.trim().slice(0, 90)
      });
    }
  });
});

/* **閉じない太字。**`**…である。**続き` は太字にならず、`**` が字のまま出る。
 *
 * CommonMark では、閉じの `**` は右側に接していなければならない。
 * 直前が句読点のときは、直後が空白か句読点でなければ閉じと見なされない。
 * **日本語でいちばん書きたくなる形が、ちょうどそれに当たる。**
 *
 * 直し方は一つ。**句読点を太字の外に出す** —— `**…である**。続き` にする。
 * 読みは変わらない。
 *
 * **開きの `**` は触らない。**`…である。**ここから太字` は正しい。
 * 開きか閉じかは、現れた順の偶奇でしか決まらない。 */
{
  const PUNCT = '。、）」！？';
  const STOP = ' \u3000*_（「。、！？）」\n\t';
  files.filter((f) => path.extname(f) === '.md').forEach((file) => {
    const rel = path.relative(ROOT, file);
    const src = fs.readFileSync(file, 'utf8').split('\n');
    /* 囲みの中は Markdown ではない。外した本文だけを見る。 */
    let infence = false;
    const keep = [];
    src.forEach((l, i) => {
      if (l.trim().indexOf('```') === 0) { infence = !infence; return; }
      if (!infence) keep.push([i + 1, l]);
    });
    const body = keep.map((x) => x[1]).join('\n');
    /* 行番号を引くための索引。 */
    const lineAt = (pos) => {
      let n = 0;
      for (let k = 0; k < keep.length; k++) {
        n += keep[k][1].length + 1;
        if (pos < n) return keep[k][0];
      }
      return keep.length ? keep[keep.length - 1][0] : 0;
    };
    let depth = 0;
    const re = /\*\*/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const opening = depth === 0;
      depth = 1 - depth;
      if (opening) continue;
      const prev = m.index > 0 ? body[m.index - 1] : '';
      const next = m.index + 2 < body.length ? body[m.index + 2] : '';
      if (PUNCT.indexOf(prev) >= 0 && next !== '' && STOP.indexOf(next) < 0) {
        hits.push({
          file: rel, line: lineAt(m.index), kind: '閉じない太字',
          msg: '「' + prev + '**」の直後が文字です。'
               + '句読点を外に出してください（**…' + prev + ' → …' + prev + '）',
          text: body.slice(Math.max(0, m.index - 30), m.index + 12).replace(/\n/g, ' ')
        });
      }
    }
    /* **指示書は対象外である**（書き方の但書）。CLAUDE.md と `.claude/commands/` は
     * 記録ではなく指示書なので、5 と 6 を掛けない。 */
    const 指示書 = rel === 'CLAUDE.md' || rel.indexOf('.claude/commands/') === 0;
    /* **生成された欄も対象外である**（書き方の但書）。README の自己紹介は
     * サイトの同じ欄からの写しで、文体は生成元に従う。**写しの文体をこちらで
     * 変えれば、それは写しではなくなる。**印の間だけ落として数える。 */
    const 写し = [['<!-- 自己紹介:ここから -->', '<!-- 自己紹介:ここまで -->'],
                  ['<!-- 経歴:ここから -->', '<!-- 経歴:ここまで -->']];
    let 生成中 = false;
    const 地 = [];
    keep.forEach(([ln, l]) => {
      if (写し.some(([a]) => l.indexOf(a) >= 0)) { 生成中 = true; return; }
      if (写し.some(([, b]) => l.indexOf(b) >= 0)) { 生成中 = false; return; }
      if (!生成中) 地.push([ln, l]);
    });

    /* 書き方 5 —— 文を丸ごと太字にしない。
     * 太字は語と数に掛けるものである。句点をまたいだ時点で、
     * 掛かっているのは語ではなく声の大きさである。
     * 一度これが 1487 個のうち 430 個まで増えて、地の文が読めなくなった。
     *
     * **偶奇で対を取る。**正規表現だけで挟むと、`**A**。**B**` の
     * 「閉じ」と「次の開き」を一つの太字として拾う。**実際に 79 件の偽陽性が出た。** */
    if (!指示書) {
      const marks = [];
      const re5 = /\*\*/g;
      let mm;
      while ((mm = re5.exec(body)) !== null) marks.push(mm.index);
      for (let k = 0; k + 1 < marks.length; k += 2) {
        const inner = body.slice(marks[k] + 2, marks[k + 1]);
        if (inner.indexOf('。') < 0) continue;
        hits.push({
          file: rel, line: lineAt(marks[k]), kind: '文を太字にしている',
          msg: '句点をまたぐ太字です。太字は語と数にだけ掛けます（書き方 5）',
          text: inner.slice(0, 40).replace(/\n/g, ' ')
        });
      }
    }
    /* 書き方 6 —— ダッシュを連ねない。一つの段落に二つ以上置かない。 */
    if (!指示書) {
      let para = [], start = 0;
      const flush = () => {
        if (!para.length) return;
        const n = (para.join('').match(/——/g) || []).length;
        if (n >= 2) {
          hits.push({
            file: rel, line: start, kind: 'ダッシュが多い',
            msg: '一つの段落にダッシュが ' + n + ' 個あります（書き方 6 は一つまで）',
            text: para.join('').slice(0, 44)
          });
        }
        para = [];
      };
      地.forEach(([ln, l]) => {
        if (l.trim() === '') { flush(); return; }
        /* **表の行は段落ではない。**欄の中のダッシュは、同格を示す記号として
         * 一行に一つずつ立っている。**行をまとめて数えると、表が段落に化ける。** */
        if (l.trim().indexOf('|') === 0) { flush(); return; }
        /* **箇条も段落ではない。**項目ごとに「名 —— 説明」の形で一つ立つ。
         * まとめて数えると、箇条書きが段落に化ける。 */
        if (/^([-*+]|\d+\.)\s/.test(l.trim())) { flush(); return; }
        if (!para.length) start = ln;
        para.push(l);
      });
      flush();
    }
    /* **数が奇数なら、どこかで閉じていない。**偶奇で判定しているので、
     * ここが崩れると上の判定そのものが当てにならない。 */
    if (depth !== 0) {
      hits.push({
        file: rel, line: 0, kind: '太字の数が奇数',
        msg: '** の数が奇数です。開きと閉じの対応が取れません',
        text: ''
      });
    }
  });
}

console.log(files.length + ' ファイルを走査しました。');
if (hits.length) {
  console.log('\n' + hits.length + ' 件見つかりました。\n');
  hits.forEach((h) => {
    console.log('  [' + h.kind + '] ' + h.file + ':' + h.line);
    console.log('    ' + h.msg);
    console.log('    > ' + h.text + '\n');
  });
  process.exit(1);
}
console.log('既知の誤変換・活用の壊れ・表記の揺れ・使わないと決めた語・バッジの壊れ・第三者のロゴは見つかりませんでした。');
