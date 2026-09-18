/* 検査そのものを検査する。
 *
 *   node verification/check_guards.js
 *
 * **検査の道具は、通ることでは信用できない。**何も見ていなくても全部通る
 * からである。そこで、通る状態を一つずつ壊し、**壊したところがちょうど
 * 落ちること**を確かめる。落ちなければ、その検査は何も見ていない。
 *
 * errata-check の tests/check_tool.py と同じ考え方である。あちらは Python の
 * 道具に当てている。こちらは JS の検査（サイト・配色・作用素）に当てる。
 * 約 500 項目が「通っている」という理由だけで信用されていた。
 *
 * やり方。リポジトリを一度だけ複製し、場合ごとに一つのファイルを書き換え、
 * 検査を走らせ、書き戻す。**本物のリポジトリには触らない。**
 *
 * 落とし穴が一つある。**<style> の中を書き換えると、CSP のハッシュが合わなくなり、
 * ブラウザは配色ごと丸ごと捨てる。**壊したつもりが、全部が既定の見た目に戻って
 * 通ってしまう。ここで壊す先は字面を読む検査に限ってあるので当たらないが、
 * ブラウザを起こす検査を壊すときは update_csp.js を挟むこと。
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

let pass = 0;
const failures = [];

function ok(label, cond, detail) {
  if (cond) { console.log('  OK   ' + label + (detail ? '  ' + detail : '')); pass++; return; }
  console.log('  FAIL ' + label + (detail ? ' — ' + detail : ''));
  failures.push(label);
}
function section(n) { console.log('\n' + n); }

/* ---------- 複製 ---------- */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'guards-'));
const COPY = path.join(TMP, 'site');
execFileSync('cp', ['-a', ROOT, COPY]);

function run(script) {
  const r = spawnSync('node', [path.join(COPY, 'verification', script)],
                      { cwd: COPY, encoding: 'utf8' });
  /* **落ちた項目の名前を拾う。**check_site / check_contrast / check_trinity は
   * `FAIL …` で出すが、**check_text は `[種別] ファイル:行` で出す。**
   * 片方しか読まないと、check_text に当てた壊す先が「何も落ちなかった」になる。
   * 実際になった。 */
  const lines = (r.stdout || '').split('\n');
  const bad = lines
    .filter((l) => l.trim().startsWith('FAIL'))
    .map((l) => l.trim().slice(4).trim())
    .concat(lines
      .filter((l) => /^ *\[[^\]]+\] .+:\d+$/.test(l))
      .map((l) => l.trim()));
  return { code: r.status, bad };
}

/* 一箇所だけ書き換えて走らせ、書き戻す。 */
function broken(file, mutate, script) {
  const p = path.join(COPY, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = mutate(before);
  if (after === before) return { code: -1, bad: ['書き換えが効いていない: ' + file] };
  fs.writeFileSync(p, after);
  try {
    return run(script);
  } finally {
    fs.writeFileSync(p, before);
  }
}

const swap = (from, to) => (s) => s.split(from).join(to);

/* ---------- 壊す前に、通ることを確かめる ---------- */
section('0. 壊す前');

['check_site.js', 'check_contrast.js', 'check_trinity.js'].forEach((s) => {
  const r = run(s);
  ok('複製した状態で ' + s + ' が通る', r.code === 0, r.bad.slice(0, 2).join(' / '));
});

/* ---------- 壊す ---------- */
section('1. 壊した箇所がちょうど落ちるか');

const CASES = [
  ['sitemap の lastmod を古くすると落ちる', 'sitemap.xml',
   (s) => s.replace(/<lastmod>2026-09-\d\d<\/lastmod>/, '<lastmod>2020-01-01</lastmod>'),
   'check_site.js', 'lastmod が git の記録より古くない'],

  ['CSP のハッシュを一つ変えると落ちる', 'index.html',
   (s) => s.replace(/'sha256-([A-Za-z0-9+/=]{10})/, "'sha256-AAAAAAAAAA"),
   'check_site.js', 'CSP'],

  ['核の頁に、置かないと決めた語を入れると落ちる', 'index.html',
   swap('</h1>', '</h1><p>コンサルタント</p>'),
   'check_site.js', '本文の核に置かないと決めたもの'],

  ['JS 無しで本文を隠すと落ちる', 'index.html',
   swap('.js .reveal { opacity: 0;', '.reveal { opacity: 0;'),
   'check_site.js', 'JS 無しで本文を隠していない'],

  ['暗い側の二つの指定を食い違わせると落ちる', 'index.html',
   (s) => s.replace('--bg: #121214;', '--bg: #121215;'),
   'check_site.js', '暗い側の二つの指定が一字一句同じ'],

  ['トップから三篇の結論を消すと落ちる', 'index.html',
   swap('枠組みは残らなかった', '（削除）'),
   'check_site.js', '枠組みは残らなかった'],

  ['配っている頁へのリンクを壊すと落ちる', 'index.html',
   swap('href="./cv.html"', 'href="./cv-none.html"'),
   'check_site.js', 'リンク'],

  ['本文の色を薄くすると配色が落ちる', 'index.html',
   (s) => s.replace('--muted: #63636b;', '--muted: #c9c9cf;'),
   'check_contrast.js', ''],

  ['作用素の照合用の数値をずらすと落ちる', 'verification/trinity_fixtures.json',
   (s) => s.replace('0.5025', '0.5026'),
   'check_trinity.js', ''],

  /* 以下の三つは、Tab で辿ったときに出た不備に当てている。
   * check_keyboard.js はブラウザを起こすので、ここでは字面を見る側だけを壊す。 */

  ['焦点の入った塊をすぐ出す指定を消すと落ちる', 'index.html',
   swap('.js .reveal:focus-within { opacity: 1; transform: none; transition: none; }', ''),
   'check_site.js', '焦点の入った塊をすぐ出す'],

  ['焦点の枠を消すと落ちる', 'trinity.html',
   swap('.mcell:focus-visible { border-color: var(--accent); }',
        '.mcell:focus { outline: none; border-color: var(--accent); }'),
   'check_site.js', '焦点の枠を消している頁が無い'],

  ['見出しの階層を飛ばすと落ちる', 'cv.html',
   swap('<h2 class="serif">修了証</h2>', '<h4 class="serif">修了証</h4>'),
   'check_site.js', '見出しが階層を飛ばさない'],

  ['外部の点検に第三者の氏名を戻すと落ちる', 'docs/external-evaluations.md',
   swap('〔氏名を伏せた一名〕', '小島勤'),
   'check_site.js', '第三者の氏名を伏せてある'],

  ['英語の科目名から断りを消すと落ちる', 'index.en.html',
   swap("unofficial translations, not the university's own", 'official titles'),
   'check_site.js', '科目名は公式名ではないと断っている'],

  ['英語の README から断りを消すと落ちる', 'README.en.md',
   swap("unofficial translations, not the university's own", 'official titles'),
   'check_site.js', 'README が、科目名は公式名ではないと断っている'],

  ['英語の学部名から出所の断りを消すと落ちる', 'index.en.html',
   swap('are reported to use', 'use'),
   'check_site.js', '学部名の出所を断っている'],

  /* **Claude と名指ししたまま、特定できない断りだけを消す。**
   * 三篇まで Claude が書いたように読める形になる。 */
  ['道具の名前だけ残して断りを消すと落ちる', 'index.html',
   swap('<b>ただし、哲学三篇に何を使ったかは特定できない</b>', '<b>三篇も同じである</b>'),
   'check_site.js', '三篇の道具は特定できないと、同じ段に書いてある'],

  /* **PhilArchive の到達点を、上への指しに戻す。**片方の門だけ空欄になる。 */
  ['PhilArchive の到達点を上への指しに戻すと落ちる', 'index.html',
   swap('<b>PhilArchive では、三篇のうち二篇が、学術哲学の領域にあり、専門職の水準（<code translate="no" class="notranslate">professional quality</code>）を満たすものとして扱われた。</b>',
        '明文の水準は上のとおりである。'),
   'check_site.js', 'PhilArchive の到達点が書いてある'],

  ['根幹の一段から限界を外すと落ちる', 'index.html',
   swap('通ったのは受け付けの門であって査読ではなく', '査読を受けており'),
   'check_site.js', '自己紹介に導けないものが書いてある'],

  /* **到達点だけを残して基準を消す。**何を通したのか分からないまま、通ったことだけが残る。 */
  ['自己紹介から通過基準を消すと落ちる', 'index.html',
   swap('<b>通した基準は、明文で次のとおりである。</b>', ''),
   'check_site.js', '自己紹介に通過基準が具体に書いてある'],

  /* **到達点を二篇から三篇に広げる。**門が下りていない一篇を含めてしまう。 */
  ['到達点を三篇に広げると落ちる', 'index.html',
   swap('二篇について、公開前に人が見て、落とさなかった',
        '三篇について、公開前に人が見て、落とさなかった'),
   'check_site.js', '到達点を三篇に広げていない'],

  /* **片方の門だけを細かく書く。**厳しいほうだけを見せる形になる。 */
  ['PhilArchive の基準を省くと落ちる', 'index.html',
   swap('<code translate="no" class="notranslate">cross-disciplinary and of clear interest to philosophers</code>', '学際的なもの'),
   'check_site.js', 'PhilArchive の基準を省略していない'],

  /* **頁にだけ出して README に出さない。**実際に一度そうなった。 */
  ['GitHub のプロフィールから根幹を落とすと落ちる', 'README.md',
   swap('ここにあるものの根幹は、独学と、言語モデルを使って進めたことである', '独学である'),
   'check_site.js', 'GitHub のプロフィールに根幹の一段がある'],

  /* **単位の断りを消す。**すぐ下に単位の表が並ぶので、授業の成果まで独学に読まれる。 */
  ['大学の単位の断りを消すと落ちる', 'index.html',
   swap('<b>ただし、大学の単位は独学ではない。</b>', ''),
   'check_site.js', '大学の単位が独学ではないと書いてある'],

  /* 外部プロフィールの一覧は 4 か所にある。**片方にだけ足すと、そこで割れる。**
   * 並びを入れ替えるだけでも落ちることを見る。数が合っていても割れているため。 */
  ['README の外部プロフィールの並びを入れ替えると落ちる', 'README.en.md',
   (s) => s.replace(
     '- Medium — [articles](https://medium.com/@heaven_livid_frog_333/lists)\n'
     + '- DEV Community — [articles](https://dev.to/cpsbvbng26dotcom)\n',
     '- DEV Community — [articles](https://dev.to/cpsbvbng26dotcom)\n'
     + '- Medium — [articles](https://medium.com/@heaven_livid_frog_333/lists)\n'),
   'check_site.js', '外部プロフィールを同じ順で並べている'],

  ['README にある行き先が cv.html から消えると落ちる', 'cv.html',
   swap('https://www.growkudos.com/profile/%E5%8D%93%E5%93%89_%E6%A0%B9%E6%9C%AC',
        'https://www.growkudos.com/profile/none'),
   'check_site.js', 'cv.html にも出ている'],

  ['英語の頁の sameAs だけを削ると落ちる', 'index.en.html',
   swap('        "https://dev.to/cpsbvbng26dotcom",\n', ''),
   'check_site.js', 'sameAs が一致する'],

  /* **肩書きは cv.html にも置かない**（決めごと 10）。受注先の説明文をここに
   * 足したとき、この頁だけ公の面の外に居た。 */
  ['配っている頁に肩書きを入れると落ちる', 'cv.html',
   swap('ランサーズ <span>独立での案件募集</span>',
        'ランサーズ <span>独立コンサルタントとしての案件募集</span>'),
   'check_site.js', 'コンサルタント肩書き'],

  /* **評語。**受け取った一文字をそのまま出す欄である。四つの壊れ方を見る ——
   * 一つ落ちる、知らない評語が混ざる、頁のあいだで食い違う、換算した数が混ざる。 */
  ['評語が一つ抜けると落ちる', 'index.html',
   swap('data-grade="D">心理学', 'data-grade="">心理学'),
   'check_site.js', '評語を持つ'],

  ['知らない評語が混ざると落ちる', 'index.html',
   swap('data-grade="A"', 'data-grade="S"'),
   'check_site.js', '知らない評語が混ざっていない'],

  ['英語の頁だけ評語が変わると落ちる', 'index.en.html',
   swap('data-grade="D">Psychology', 'data-grade="B">Psychology'),
   'check_site.js', '同じ並びである'],

  ['GPA を書き足すと落ちる', 'cv.html',
   swap('<h2 class="serif">修得した科目</h2>',
        '<h2 class="serif">修得した科目</h2><p>GPA 2.1</p>'),
   'check_site.js', 'GPA を書いていない'],

  /* **本丸。**特性ごとに三つ置いた欄である。四つの壊れ方を見る ——
   * 一つ減る、Zenodo が混ざる、国の機関でないものが消える、
   * そして「正本に勝たない」の一行が落ちる。 */
  ['本丸が一つ減ると落ちる', 'docs/canonical-sources.md',
   (s2) => s2.replace(/^\| \*\*哲学分野\*\*.*\n/m, ''),
   'check_site.js', '本丸の数が、散文と表で合う'],

  ['本丸の表に Zenodo を入れると落ちる', 'docs/canonical-sources.md',
   swap('| **国内** | **researchmap** |', '| **国内** | **Zenodo** |'),
   'check_site.js', '本丸の表に Zenodo が入っていない'],

  ['国の機関でない本丸が消えると落ちる', 'docs/canonical-sources.md',
   swap('学界の非営利。国の機関ではない。', '**学界の非営利**。'),
   'check_site.js', '国の機関でない本丸の数'],

  ['本丸が正本に勝たない一行を消すと落ちる', 'docs/canonical-sources.md',
   swap('本丸だからといって、正本に勝つことはない。', ''),
   'check_site.js', '本丸が正本に勝たないと書いてある'],

  /* **計測の出所。**同じ画面に並んでいても数え手が違う。混ぜると落ちる。 */
  ['Kudos の数の出所をまとめると落ちる', 'docs/canonical-sources.md',
   swap('**Kudos の欄には、他所の数も混ざる**。', ''),
   'check_site.js', '他所から引いた数が混ざる'],

  ['営利と計測の重なりを規則に格上げすると落ちる', 'docs/canonical-sources.md',
   swap('**これは規則ではない**。', '**これは規則である**。'),
   'check_site.js', '規則だと書いていない'],

  /* **面と置き場。**本丸は面のほうである。二つの壊れ方を見る ——
   * 行き先が紙面とずれる、面と置き場を分ける断りが消える。 */
  ['CV HAL の行き先が紙面とずれると落ちる', 'docs/canonical-sources.md',
   swap('cv.hal.science/nemoto-takuya', 'cv.hal.science/takuya-nemoto'),
   'check_site.js', 'CV HAL の行き先が'],

  ['欧州の本丸が CV HAL である断りを消すと落ちる', 'docs/canonical-sources.md',
   swap('**欧州の本丸は CV HAL であって、HAL そのものではない**', 'HAL である'),
   'check_site.js', '欧州の本丸が CV HAL であると'],

  /* **下書きが、公開したものの顔をしないこと。**等級と限界の一行を消すと落ちる。 */
  ['下書きの原典未読の断りを消すと落ちる', 'drafts/undisclosable-disclosure.md',
   swap('いずれも原典を読んでいない', 'いずれも原典に当たった'),
   'check_site.js', '原典未読だと書いてある'],

  ['下書きの事例が一件である断りを消すと落ちる', 'drafts/undisclosable-disclosure.md',
   swap('**事例が一件しかない**。', '事例は足りている。'),
   'check_site.js', '事例が一件であることを'],

  ['名指しで非難しない断りを消すと落ちる', 'drafts/undisclosable-disclosure.md',
   swap('「開示を怠った」と書くことはしない', '「開示を怠った」と書く'),
   'check_site.js', '名指しで開示を怠ったと'],

  /* **取り消した誤りを消さないこと。**「哲学の出し先が無い」と書いていた。
   * **取り消しを消せば、誤りを消したことになる。** */
  ['取り消しの一行を消すと落ちる', 'docs/submission-disclosure.md',
   swap('**「Janeway と OLH に哲学の出し先が無い」は誤りだった**', '誤りだった'),
   'check_site.js', '取り消してある'],

  ['旧誌の数字を新誌の格に使うと落ちる', 'docs/submission-disclosure.md',
   swap('**旧誌の数字を新誌の格として使わない**', '旧誌の数字を新誌の格に使う'),
   'check_site.js', '旧誌の数字を新誌の格に使わない'],

  ['未確認の条件を満たしたことにすると落ちる', 'docs/submission-disclosure.md',
   swap('**②で止まっている**', '②も満たしている'),
   'check_site.js', '条件②が未確認だと'],

  ['OLH の誌が一つ減ると落ちる', 'docs/submission-disclosure.md',
   (s2) => s2.replace(/^\| \*\*Philosophical Logic\*\* \|.*\n/m, ''),
   'check_site.js', 'OLH の哲学の誌の数'],

  /* **凍結された版。**各行が持つか持たないかを述べている。
   * 行ではなくリポジトリを数えているので、三の丸を書き換えても出る。 */
  ['凍結の記述が一行から消えると落ちる', 'README.md',
   swap('| 石垣 | `self-correction` | **墨付なし・凍結なし**。',
        '| 石垣 | `self-correction` | **墨付なし**。'),
   'check_site.js', '凍結の有無を述べている'],

  ['三の丸の片方だけ凍結を書き換えると落ちる', 'README.md',
   swap('前者は墨付なし・凍結なし', '**前者は墨付なし・凍結 1 版'),
   'check_site.js', '墨付も凍結も欠く曲輪の数'],

  /* **閉じない太字。**`**…である**。` を `**…である。**` に戻すと、
   * GitHub では `**` が字のまま出る。**そのことを check_text が言えるか。** */
  ['太字の句読点を中に入れ直すと落ちる', 'README.md',
   swap('**墨付なし・凍結なし**。免状は二枚',
        '**墨付なし・凍結なし。**免状は二枚'),
   'check_text.js', '閉じない太字'],

  ['太字の数が奇数になると落ちる', 'README.md',
   swap('**墨付なし・凍結なし**。免状は二枚',
        '**墨付なし・凍結なし。免状は二枚'),
   'check_text.js', '太字の数が奇数'],

  /* 書き方 5 —— 文を丸ごと太字にしない。**語と数に掛けるものである。**
   * 句点をまたぐ太字が一つでも戻れば、check_text が言えなければならない。 */
  ['文を丸ごと太字にすると落ちる', 'README.md',
   swap('免状は二枚（散文 CC BY 4.0／実装 MIT）。', '**免状は二枚である。散文 CC BY 4.0、実装 MIT**'),
   'check_text.js', '文を太字にしている'],

  /* 書き方 6 —— ダッシュを連ねない。**段落の中に二つ置いたら落ちる。**
   * 表と箇条は段落ではないので、地の文の段落で試す。 */
  ['段落にダッシュを二つ置くと落ちる', 'docs/objections.md',
   swap('反論 1 の核には答えていない。',
        '反論 1 の核 —— 内容に価値があるか —— には答えていない。'),
   'check_text.js', 'ダッシュが多い'],

  /* **墨付。**各行が自分の DOI を持つかどうかを述べている。
   * 一行だけ落としても、数えているので出る。 */
  ['城内の一行から墨付の記述が消えると落ちる', 'README.md',
   swap('| 石垣 | `self-correction` | **墨付なし・凍結なし**。免状 MIT',
        '| 石垣 | `self-correction` | 免状 MIT'),
   'check_site.js', '墨付の有無を述べている'],

  ['墨付ありの数が表と散文でずれると落ちる', 'README.md',
   swap('**墨付あり** `10.5281/zenodo.22765695`**・凍結 1 版**。',
        '**墨付なし・凍結なし**。'),
   'check_site.js', '墨付を持つ曲輪の数'],

  /* **本丸が両方の文書で同じ六つを指していること。**
   * 衝突そのものは禁じない。**指すものがずれたときに落ちる。** */
  ['README の本丸から一つ落ちると落ちる', 'README.md',
   (s2) => s2.replace(/^\| 平易な説明 \| \*\*Kudos\*\*.*\n/m, ''),
   'check_site.js', 'README に本丸の表がある'],

  ['README の本丸から運営母体を落とすと落ちる', 'README.md',
   swap('| **Elsevier**（2016年5月に買収） |', '| —— |'),
   'check_site.js', '運営母体 Elsevier がある'],

  ['本丸が正本でないという断りを README から消すと落ちる', 'README.md',
   swap('**六つとも写しである**。', ''),
   'check_site.js', '本丸が正本でないと'],

  /* **縄張りの網羅。**十のうち一つが図に無いまま残っていた。
   * 数だけ合っていても、当てていないものは見つからない。 */
  ['縄張りからリポジトリが一つ落ちると落ちる', 'README.md',
   (s2) => s2.replace(/^\| 馬出 \| `solitary-school`.*\n/m, ''),
   'check_site.js', 'ecosystem.json の 10 を網羅している'],


  /* **縄張りの語の衝突。**城絵図が README の部位名を自分の見出しに使うと落ちる。
   * **今日これをやった。**外のプロフィール頁を `本丸` と呼び、README では
   * `本丸` が trinity-infinity を指していた。**数の検査では出なかった。** */

  ['縄張りが README にあるという断りを消すと落ちる', 'docs/canonical-sources.md',
   swap('## 縄張りは README にある', '## 縄張りについて'),
   'check_site.js', '縄張りは README にあると書いてある'],


  /* **営利の本丸。**四つのうち一つが営利企業の手にある。
   * **その一つを消しても、数の検査が気づくこと**を見る。 */
  ['営利の本丸の性格を書き換えると落ちる', 'docs/canonical-sources.md',
   swap('| 営利企業。国の機関ではない |', '| **国の機関** |'),
   'check_site.js', '営利企業が持つ本丸の数'],

  ['本丸と計測が同じ手にある一行を消すと落ちる', 'docs/canonical-sources.md',
   swap('**本丸と計測が同じ手にある**。', ''),
   'check_site.js', '本丸と計測が同じ手にある'],

  /* **表にある場を「まだ入れていない」側にも並べると落ちる。**両方に書けば矛盾する。
   * この壊し方が要るのは、検査に名前を書き込まない形に直したためである。 */
  ['表にある場を、入れていない側にも並べると落ちる', 'docs/canonical-sources.md',
   swap('**Internet Archive・NDL WARP', '**Zenodo・Internet Archive・NDL WARP'),
   'check_site.js', '入れていない側に並んでいない'],

  /* **本丸と計測が同じ手にある例の数。**一行消せば、散文の「二例」が外れる。 */
  ['同じ手が計測を持つ例が一つ減ると落ちる', 'docs/canonical-sources.md',
   (s2) => s2.replace(/^\| Google Scholar（Google） \|.*\n/m, ''),
   'check_site.js', '同じ手にある例の数'],

  /* **運営は入れ替わる。**買収で移った先と、表が書いた日のものである断り。
   * どちらも落とせば、古い表が現在の顔で残る。 */
  ['買収で運営が変わった先を消すと落ちる', 'docs/canonical-sources.md',
   swap('DEV Community は 2026年2月18日に Major League Hacking へ移った。', ''),
   'check_site.js', '運営が買収で変わった先を書いてある'],

  ['運営母体の表が書いた日のものである断りを消すと落ちる', 'docs/canonical-sources.md',
   swap('運営母体の表は、書いた日のものである。', ''),
   'check_site.js', '書いた日のものだと断ってある'],

  ['運営母体の表に善し悪しを持ち込むと落ちる', 'docs/canonical-sources.md',
   swap('**この表は誰が動かしているかだけを書く**。善し悪しを書かない。',
        '**この表は運営の良い先と悪い先を分ける**。'),
   'check_site.js', '善し悪しを書かないと断ってある'],

  /* **運営母体。**同じ手に幾つあるかを数えている欄である。三つの壊れ方を見る ——
   * 表から一行減る、Jxiv を表に入れる、調べていない場を混ぜる。 */
  ['同じ手が持つ場の数が減ると落ちる', 'docs/canonical-sources.md',
   swap('| **J-GLOBAL** | **JST** |', '| **J-GLOBAL** | 運営は分からない |'),
   'check_site.js', 'JST が持つ場の数'],

  ['候補の Jxiv を運営母体の表に入れると落ちる', 'docs/canonical-sources.md',
   swap('| **J-GLOBAL** | **JST** |',
        '| **J-GLOBAL** | **JST** |\n| **Jxiv** | **JST** |'),
   'check_site.js', 'Jxiv が候補として'],

  /* **調べていない場を表に混ぜると落ちる。**混ぜる名前は、散文が
   * 「まだ入れていない」と並べているもののうち一つでなければならない。
   * GitHub を使っていたが、あれは表に入ったので当たらなくなった。 */
  ['調べていない場を運営母体の表に混ぜると落ちる', 'docs/canonical-sources.md',
   swap('| **MERLOT** | **California State University** |',
        '| **MERLOT** | **California State University** |\n'
        + '| **Internet Archive** | 非営利 |'),
   'check_site.js', 'Internet Archive を運営母体の表に入れていない'],

  ['Figshare の所属を締め出しの理由と結ぶと落ちる', 'docs/canonical-sources.md',
   swap('**それが締め出しの理由だとは書かない**。', '**それが締め出しの理由である**。'),
   'check_site.js', '締め出しの理由と結んでいない'],

  /* 短大の分の評語は受け取っていない。**空でなければ、どこかで埋めている。** */
  ['短大の科目に評語を作ると落ちる', 'index.html',
   swap('data-grade="">仕事の上手な教え方',
        'data-grade="B">仕事の上手な教え方'),
   'check_site.js', '評語を作っていない']
];

CASES.forEach(([label, file, mutate, script, expect]) => {
  const r = broken(file, mutate, script);
  const hit = expect ? r.bad.some((b) => b.indexOf(expect) >= 0) : r.bad.length > 0;
  ok(label, r.code === 1 && hit,
     r.bad.length ? ('落ちた: ' + r.bad.slice(0, 2).join(' / ')) : '何も落ちなかった');
});

/* ---------- 数を名乗る ---------- */
section('2. 壊す先の数');

{
  const self = fs.readFileSync(path.join(ROOT, 'verification', 'check_guards.js'), 'utf8');
  const declared = /壊す先は (\d+) 通り/.exec(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'));
  ok('README が名乗る壊す先の数が実際と合う',
     declared !== null && Number(declared[1]) === CASES.length,
     declared ? ('名乗り ' + declared[1] + ' / 実際 ' + CASES.length) : '名乗っていない');
}

/* 壊す先の数だけでは足りない。**この道具が名乗る総数のほうは、誰も見ていなかった。**
 * 壊す先を足したときに、README の「NN 項目」だけが古いまま残る。
 * check_site.js と同じやり方で、この検査自身を足した数と突き合わせる。 */
{
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const m = /検査そのものを壊して確かめる (\d+) 項目/.exec(readme);
  const total = pass + 1;
  ok('README が名乗るこの道具の項目数が実際と合う',
     m !== null && Number(m[1]) === total,
     m ? ('名乗り ' + m[1] + ' / 実際 ' + total) : '名乗っていない');
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log('\n' + '-'.repeat(58));
if (failures.length) {
  console.log(pass + ' 件が通り、' + failures.length + ' 件が通りませんでした。');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log(pass + ' 件すべて通りました。');
