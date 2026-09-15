# 投稿に添える開示

**六篇を査読誌に出すと決めた。**2026-09-15 の決定である。
それまでは出さないと決めていた。理由も含めて、経緯は下に書いてある。

この文書は、投稿の欄にそのまま貼れる形の開示文を置く場所である。
**日本語の側は説明であり、英文の側が貼るものである。**

---

## 何を開示するか

**二つある。混ぜない。**

1. **生成 AI の使用。**何に、どの道具を使い、人が何を検証したか。
2. **成果そのものの位置。**Trinity-Infinity の三篇は既知の模型の特殊例である。

二つ目は AI の話ではない。**新規性の話である。**査読の前に自分から出す。

---

## 哲学三篇 —— 開示できない部分を、開示できない形のまま書く

対象は三篇である。

| 論文 | DOI |
| --- | --- |
| The Nobility and Exemplarity of the Celibate Individual | `10.5281/zenodo.22058254` |
| Manifesto of Imperial Selfhood | `10.5281/zenodo.22057583` |
| Fragmentarian Spiritual Individualism | `10.5281/zenodo.22064241` |

**分かっていることと、分かっていないことが、はっきり分かれている。**

分かっていること。原稿は日本語で書かれた。公開されている英文は AI による翻訳である。
三篇はいずれも AI の使用を開示しており、何をさせたかを列挙している。
挙げている道具は Claude だけである。

分かっていないこと。**翻訳に用いた道具が何であったか、特定できない。**
記録が残っておらず、著者の記憶でも定まらない。

**分からないことを分かったように書かない。**これが開示の全部である。
この状態そのものが、正誤表の `E5` に記録されている。

### 貼る文（英語）

> **Disclosure of generative AI use.**
> The original manuscript was written in Japanese by the author. The English text
> was produced with generative AI, which translated it and expanded the prose.
> The papers themselves disclose AI assistance and name Claude (Anthropic).
>
> **The specific tool used for the translation cannot be determined.** No record
> was kept at the time, and the author's recollection does not settle it. This gap
> is recorded as erratum E5 in the public errata for these papers, together with
> the reason it cannot be closed: the deposited PDFs are frozen and are not
> regenerated.
>
> At the time of deposit these were self-registered preprints with no publisher,
> no submission guidelines, and no review. The disclosure obligations now in force
> did not apply to them. This statement is not a record of a violation. It is a
> record of what was and was not written down.
>
> The author reviewed and takes responsibility for the whole of the submitted text.
> Errata: https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/ERRATA.md

---

## Trinity-Infinity 三篇 —— 道具は特定できる。位置づけのほうを先に出す

対象は三篇である。

| 論文 | DOI |
| --- | --- |
| Trinity-Infinity Series I 改訂版 | `10.5281/zenodo.22058624` |
| Trinity-Infinity Series II 改訂版 | `10.5281/zenodo.22058777` |
| Trinity-Infinity Series III | `10.5281/zenodo.22058964` |

**こちらは道具と版を特定できる。**開示の側に穴は無い。

**穴があるのは中身の側である。**この系列の作用素は、Friedkin–Johnsen 意見動学の
影響行列を巡回置換に限った特殊例である。**新しい結果は無い。**
そのことは著者自身が紙面と README に書いており、正誤表の `E8` が全部を並べている。

**原典は読んでいない。**Friedkin & Johnsen の 1990 年と 1999 年の論文について、
式と結論は検索で確認したが、本文には当たっていない。**その札も外していない。**

### 貼る文（英語）

> **Disclosure of generative AI use.**
> Generative AI (Claude, Anthropic) was used in preparing this series. The tools
> and versions are identifiable, and the git history of the accompanying
> repository records the assistance commit by commit. The author reviewed and
> takes responsibility for the whole of the submitted text.
>
> **Disclosure of prior art.**
> The operator studied in this series is a special case of the Friedkin–Johnsen
> model of opinion dynamics (Friedkin & Johnsen 1990, 1999), obtained by
> restricting the influence matrix to a cyclic permutation. **The series contains
> no new mathematical result.** This is stated by the author in the papers
> themselves and is set out in full as erratum E8, which gives the correspondence
> term by term.
>
> **The primary sources have not been read by the author.** The equations and
> conclusions attributed to Friedkin & Johnsen were confirmed through secondary
> sources and are labelled as such in the errata. That label has not been removed.
>
> Errata: https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md

---

## 書かないと決めていること

**著作者に AI を並べない**（決めごと 8）。COPE も同じことを定めている。

**「文章は実質的に著者自身のものである」という申告に、丸を付けない。**
そう求める欄がある場を選ばない。開示を求める場と、著者自身の筆であることを
申告させる場は、別である。**前者には出せる。後者には出せない。**

**費用の掛かる場に出さない**（決めごと 14）。掲載料も投稿料も取らない場だけである。

---

## 経緯

**2026-09-15 より前、この六篇は出さないと決めていた。**理由は費用ではなく、
生成 AI の使用を完全には開示できないことであった。

**決めを変えた。**変えた理由は次の一点である。
「何を使ったか再構成できない」と書くことは、**分かっていることの全部を書くことである。**
不完全なのは開示ではなく、開示できる材料のほうである。
それを受け付けるかどうかは場の判断であって、こちらで先回りして落とすものではない。

**落ちたら、その記録も残す。**通ったものだけを並べれば、門が何も落とさないように見える。
落とす門であることは、落とされた側にしか示せない。

## 出す先の条件

**三つ全部を満たす場にだけ出す。**

1. **掲載料も投稿料も取らない**（決めごと 14）。
2. **既に公開されているプレプリントを除外していない。**六篇は Zenodo にあり、
   動かさない。受け付けない場は、この時点で外れる。
3. **著者自身の筆であることを申告させない。**開示を求める欄と、申告させる欄は違う。
   **前者には出す。後者には出さない。**

### いま分かっている候補

| 場 | 形 | 三つの条件 | 確かめた度合 |
| --- | --- | --- | --- |
| Episciences（CNRS） | 重ね刷りの誌。**Zenodo に置いた稿をそのまま出せる** | 1 と 2 は明文で満たす | 検索で確認。原典未読 |
| Conatus（アテネ大学） | 哲学。双方向匿名査読 | 1 と 2 は明文で満たす | 検索で確認。原典未読 |

**Episciences は形が合っている。**稿を出すのではなく、公開済みの置き場所を指して出す。
**プレプリントを動かさないという決めと、投稿の手順が衝突しない。**
Zenodo・HAL・arXiv などが置き場所として使える。**六篇はすでに Zenodo にある。**

**三つ目の条件は、どちらもまだ確かめていない。**投稿規程の当該欄へこの作業環境から
届かない。`episciences.org` も `conatus.philosophy.uoa.gr` も egress proxy が塞いでいる。
**画面を見るのは利用者の手になる。**

### 見込みについて

**Trinity-Infinity の三篇は、新規性で返る見込みが高い。**新しい結果が無いことを
こちらから開示して出すのだから、そう判断されるのが筋である。

**それでも出す。**返ってきた理由が記録になる。通ったものだけを並べれば、門が何も
落とさないように見える。**落とす門であることは、落とされた側にしか示せない。**

---

出した先と結果は [`external-evaluations.md`](external-evaluations.md) の「出した先」に記録する。
