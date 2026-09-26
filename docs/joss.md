# JOSS に出す —— 一本と、十の状態

定期的な目標は、Journal of Open Source Software（JOSS。ISSN `2475-9066`）に通すことです。
**出すのは `errata-check` 一本です**。2026-09-26 に決めを変えました。
それまでは「出すのは十全部です」と書いていました。
この文書は、その一本がどの門をいつどう満たすかと、ほかを出さない理由を並べます。

**明文は `openjournals/joss` の `docs/` から写しています**。リンクと強調の記法だけ外してあります。
**`joss.theoj.org` にはこの作業環境から届きません**。照合したのは、その公開リポジトリの中身です。

## 一本に絞った —— 2026-09-26

**JOSS が載せるのは研究ソフトウェアです**（`JOSS publishes articles about research software.`）。
範囲の外のものまで、出す数に入れていました。規定を読み直して、一つずつ当てました。

| リポジトリ | 出すか | 理由 |
| --- | --- | --- |
| errata-check | **出す** | 公開した研究物の正誤表を監査する道具。範囲に入り、形もほぼ揃っている |
| cpsbvbng26-dotcom | 出さない | この場所と、横断の検査。研究ソフトウェアではない |
| researcher-profile | 出さない | プロフィールの頁を作る道具。研究ソフトウェアとは言いにくい |
| trinity-operator | 出さない | 既知の数学の実装。数学の側はここで終えた |
| self-correction | 出さない | 中心は訂正の登録簿で、検査はその付属 |
| trinity-infinity | 出さない | 論文 |
| autonomy-and-self-cultivation | 出さない | 論文 |
| justice-and-algorithms | 出さない | 論文 |
| naval-gazette-notes | 出さない | 史料ノート |
| solitary-school | 出さない | 覚書 |

**`errata-check` にも、まだ届いていないものがあります**。

- **門 2**。使っているのは著者自身の正誤表だけで、外の利用者はいません。
- **門 4**。作業は最初の数週間に集まっています。
- **大きさ**。場の側は `"Minor utility" packages, including "thin" API clients, and single-function packages are not acceptable` と書いています。本体は一つのファイルです。

**AI の使用は、それだけでは壁になりません**。場の側は使用を認めています
（`The Journal of Open Source Software permits the use of generative AI in submissions with mandatory disclosure and human oversight requirements.`）。
ただし、人が主要な設計を決めたと書かせます
（`Authors must affirm that human team members thoroughly reviewed, modified, and validated all AI-generated content while making primary architectural and design decisions.`）。
**`errata-check` のコミットの大半は、Claude との共作です**。この一文に署名できるかは、著者が決めることです。

## 門は四つある

査読に入る前に、四つの門があります。**一つでも欠ければ、査読に入らずに返される**
（`will receive a desk rejection`）。**返されることは「まだ」であって「二度と」ではない**と
場の側が書いている（`A desk rejection on these grounds may be a "not yet," rather than a "never."`）。

| | 門 | 明文 |
| --- | --- | --- |
| 1 | 公開の期間 | `The repository must have been public for more than six months prior to submission, with active development spanning that period` |
| 2 | 研究に使われている証拠 | `There must be evidence that the software is being used for research` |
| 3 | 開かれた開発の実践 | 単独の著者なら、複数の指標が同時に要る |
| 4 | 反復した開発 | `The development history must show ongoing iteration, not a single burst of commits` |

## 十の状態

| リポジトリ | 種別 | OSI のライセンス | 公開したタグ | CONTRIBUTING | 最初のコミット | 門 1 に届く最短 |
| --- | --- | --- | --- | --- | --- | --- |
| cpsbvbng26-dotcom | 場所と横断の検査 | `LICENSE-CODE` が MIT | **無い** | ある | 2026-06-12 | 2026-12-13 |
| researcher-profile | 道具 | `LICENSE` が MIT | **1 件** | ある | 2026-09-05 | 2027-03-06 |
| trinity-infinity | 論文 | `LICENSE-CODE` が MIT | **無い** | ある | 2026-09-05 | 2027-03-06 |
| autonomy-and-self-cultivation | 論文 | `LICENSE-CODE` が MIT | **1 件** | ある | 2026-09-05 | 2027-03-06 |
| justice-and-algorithms | 論文 | `LICENSE-CODE` が MIT | **1 件** | ある | 2026-09-05 | 2027-03-06 |
| naval-gazette-notes | 史料ノート | `LICENSE-CODE` が MIT | **無い** | ある | 2026-09-05 | 2027-03-06 |
| trinity-operator | 道具 | `LICENSE` が MIT | **無い** | ある | 2026-09-06 | 2027-03-07 |
| errata-check | 道具 | `LICENSE` が MIT | **3 件** | ある | 2026-09-07 | 2027-03-08 |
| self-correction | 記録と道具 | `LICENSE` が MIT | **無い** | ある | 2026-09-07 | 2027-03-08 |
| solitary-school | 覚書 | `LICENSE-CODE` が MIT | **1 件** | ある | 2026-09-15 | 2027-03-16 |

「門 1 に届く最短」は、最初のコミットの日から公開されていた場合の日付です。
公開に切り替えた日は、最初のコミットと同じとは限りません。こちらでは確かめていません。
遅れていれば、その分だけ後ろにずれます。

## 門 1 —— 期間が満ちるのを待つ

いちばん早いものでも、六か月を超えていません。
最初のコミットで数えて、最も早いのが 2026-06-12 です。
道具の側は、いちばん早いもので 2026-09-05 です。

**この門は日付で決まる**。六か月を超えるのは、この場所そのものが 2026-12-13、
道具の側が 2027-03-06 です。待てば満ちる唯一の門です。
出す一本の `errata-check` は 2027-03-08 です。

## 門 2 —— 証拠の側に、一つだけ材料がある

十とも、著者以外に使われた記録がありません。
ただし場の側は、著者自身の研究利用でも最低限は足りると書いている
（`at minimum by the developers themselves, and ideally by others`）。

ここで論文の側と道具の側が繋がっています。
哲学三篇の正誤表は、`errata-check` が実際に監査しています。
Trinity-Infinity の三篇も同じ道具で監査しています。
道具が、自分の外にある公開物に対して使われています。

それが証拠として足りるかは、編集側の判断です。こちらでは決まりません。
そして、場の側は釘を刺している —— `Aspirational statements about future use are not sufficient`。

## 門 3 —— 残っているのはタグである

単独の著者の場合、複数の指標が同時に要る ——
公開された履歴、タグ付きの版または変更履歴、試験と CI、文書、`CONTRIBUTING`、支援の方針です。
十とも、試験と CI と文書は揃っています。

**`CONTRIBUTING` は十とも揃った**。2026-09-15 に、欠けていた七つへ置きました。
`solitary-school` は作ったときから置いてあります。
支援の範囲とこれからの見込みも、そのそれぞれに書いてあります。

**タグを公開しているのは五つです**。`errata-check`（**3 件**）、`researcher-profile`（**1 件**）、
`justice-and-algorithms`（**1 件**）、`autonomy-and-self-cultivation`（**1 件**）、
`solitary-school`（**1 件**）です。
残る五つは一つも公開していません。
**理由は環境にある** —— この作業環境からタグを push すると 403 で返ります。
利用者の手作業にしか置き換えられません。

**ローカルのタグと、公開されたタグは別です**。数え直すまで、こちらは一つだけだと書いていました。
手元に残っているタグを数えていたためです。検査は `git ls-remote` のほうを見ます。
`autonomy-and-self-cultivation` の一件も、この検査が拾いました。

## 門 4 —— 履歴が伸びるのを待つ

**いまの作業は数週間に集中しています**。`not a single burst of commits` の逆です。
足して直せるものではありません。**ただし、待つだけでも満ちません**。
場の側が見るのは `evidence that the software has been refined through use and feedback over time` です。
使いながら手を入れ続けた跡が要ります。

## 種別で分かれるもの

**論文と史料ノートは、そもそも software ではありません**。覚書も同じです。
`LICENSE` が CC BY 4.0 で、MIT は `LICENSE-CODE` のほうにある（決めごと 7）。
JOSS が受けるのは research software であって、論文そのものではありません。
この五つは出しません。
出せるとすれば同梱の検査の側ですが、切り出しません。

## 論文の側も出す —— 開示できない部分を、できないまま書いて出す

**2026-09-15 に決めを変えました**。それまでは、六篇を査読誌に出さないと決めていました。

| | 出す先 | 開示の形 |
| --- | --- | --- |
| **道具（リポジトリ）** | **JOSS** | git の履歴が、commit ごとに開示を裏づける |
| **論文（プレプリント）** | **ダイヤモンド・オープンアクセスの査読誌** | 書ける範囲を書き、書けない部分はそう書く |

**出すのは六篇です**。哲学三篇と Trinity-Infinity の三篇です。

**費用の問題ではありません**。決めごと 14 は、その六篇について障害になっていません。
出すのは掲載料も投稿料も取らない場だけです。

### 前の決めと、変えた理由

前は「開示が書けないから出さない」でした。
いまの学術誌は、道具と版、使った場所、人が検証したことを書かせます。
哲学三篇については、翻訳に用いた道具が特定できない
（[三篇の正誤表 E5](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/ERRATA.md)）。
記録が残っておらず、著者の記憶でも定まりません。

変えた理由は一点です。
「何を使ったか再構成できない」と書くことは、分かっていることの全部を書くことです。
不完全なのは開示ではなく、開示できる材料のほうです。
それを受け付けるかどうかは場の判断であって、こちらで先回りして落とすものではありません。

**COPE に沿う場の定めは守る**。AI を著作者に並べません。使用は開示します。
変えたのは投稿するかどうかであって、開示の中身ではありません。

### Trinity-Infinity の三篇は、位置づけのほうを先に出す

**道具と版は特定できます**。開示の側に穴はありません。
穴があるのは中身の側です。`E8` が立っており、この作用素は
Friedkin–Johnsen 意見動学の特殊例です。新しい結果はありません。

**それも投稿に添える**。査読が見つける前に、こちらから出します。
原典を読んでいないという札も、外さずにそのまま添える。

### 丸を付けない欄がある

「文章は実質的に著者自身のものである」という申告には、丸を付けません。
開示を求める場と、著者自身の筆であることを申告させる場は、別です。
前者には出します。後者には出しません。

**プレプリントは動かしません**。Zenodo と PhilArchive と SSRN に置いたままにします。
**取り下げるのではありません**。査読誌に出すこととは別です。

貼る形の開示文は [`submission-disclosure.md`](submission-disclosure.md) にあります。

## 覆し方

**(1)** 十のいずれかについて、この表より早く門 1 を満たせる公開日を示します。
**(2)** あるいは、表が「無い」と書いたリポジトリに公開されたタグがあることを示します。
どちらも一件で覆ります。表の数は `check_ecosystem.js` が git から数え直しています。
