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

**四つ全部を満たす場にだけ出す。**

1. **掲載料も投稿料も取らない**（決めごと 14）。
2. **既に公開されているプレプリントを除外していない。**六篇は Zenodo にあり、
   動かさない。受け付けない場は、この時点で外れる。
3. **著者自身の筆であることを申告させない。**開示を求める欄と、申告させる欄は違う。
   **前者には出す。後者には出さない。**
4. **格を先に見る。**索引・区分・順位を、出す前に調べる。
   **2026-09-16 に足した。**Conatus に出して机上で返されたあとで調べたら、
   Scopus 収録、Arts and Humanities – Philosophy の 854 誌中 197 位、
   上位四分の一の誌だった。**出すなという意味ではない。**
   返る確率がどれくらいかを、先に知っているかどうかの違いである。

**四つ目は、落ちたあとで足した条件である。**三つで選んだ結果、
格を見ないまま上位四分の一に出していた。**条件が足りなかった。**

### いま分かっている候補

| 場 | 形 | 条件 | 確かめた度合 |
| --- | --- | --- | --- |
| Episciences（CNRS） | 重ね刷りの誌。**Zenodo に置いた稿をそのまま出せる** | 1 と 2 は明文で満たす。3 と 4 は未確認 | 検索で確認。原典未読 |
| Conatus（アテネ大学） | 哲学。双方向匿名査読 | **1・2・3 を満たす。4 は上位四分の一** | **出して落ちた** |

**Conatus の数字を、次の物差しにする。**

| | |
| --- | --- |
| SJR | 0.211（2025 年算出） |
| CiteScore | 1.2。パーセンタイル 76 パーセント |
| 順位 | Arts and Humanities – Philosophy の 854 誌中 197 位 |
| 区分 | Scimago で Q2、CiteScore の順位で Q1 |

**同じ高さに出し続けるか、低いところを混ぜるかは、決めの問題である。**
どちらでもよいが、**どちらなのかを知らずに出すのはやめる。**

### 次の候補 —— 2026-09-16 に調べた

**哲学の誌で、掲載料も投稿料も取らないものを当たった。**

| 場 | 主題の合い方 | 条件 1（無償） | 格 | 条件 2・3 |
| --- | --- | --- | --- | --- |
| **Ethics & Bioethics (in Central Europe)** | **最も近い。**応用倫理と生命倫理。反出生主義はこの棚である | **未確認** | Scopus 収録。Scimago で Q1、JCR では IF 0.53 の Q4 | 未確認 |
| **Organon F** | 中くらい。分析哲学。倫理も載せる | **満たす。**投稿料も掲載料も取らない | Scopus・A&HCI・DOAJ・Philosopher's Index。IF 0.3（2023） | 未確認 |
| **Disputatio** | 中くらい。分析哲学 | **満たす。**必須の掲載料は無い | Scimago で Q1（2020・2023）／Q2（2021・2022） | 未確認 |

**外れたもの。**

| 場 | 外れた理由 |
| --- | --- |
| Kriterion – Journal of Philosophy | **掲載料 1,500 ユーロ。**免除の仕組みはあるが、費用を取る場である（決めごと 14） |
| Journal of Practical Ethics | **招待制。**投稿を受け付けていない |
| Studia Humana | **2025 年 11 月に刊行停止。**反出生主義の論文を載せていた誌だが、もう出せない |

**Ethics & Bioethics の掲載料が分かっていない。**そこが分かるまで、この誌は候補として確定しない。
**Organon F は条件 1 を満たすことが明文で確認できている。**

**主題の合い方と、条件の確かさが、別の誌を指している。**
どちらを先に取るかは決めの問題である。

**上の表はすべて検索で確認したものである。原典には当たっていない。**
`organonf.com` も `unipo.sk` も、この作業環境から届かない。

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

## Conatus に出すのは独身論である

**枠は一つである。**三篇のうち一つしか出せない。選んだのは
`The Nobility and Exemplarity of the Celibate Individual` である。

**理由は四つある。**

1. **形が論文である。**前提があり、反論に答える節があり、名前のある相手と
   噛み合っている。`Manifesto of Imperial Selfhood` は題名が宣言である。
   **誌は宣言を載せない。**中身を読む前の段階で種別が合わない。
2. **主題が誌の射程に入っている。**反出生主義・自律・生活の質は応用倫理の語彙である。
   Conatus は応用倫理と生命倫理を中心に置いている。
3. **三篇のうち、どこかの門を通ったのはこれだけである。**SSRN に受け付けられている。
   `Fragmentarian Spiritual Individualism` は同じ門で弾かれている。
   **理由は示されていない。**示されていないことと、通らなかったことは別である。
4. **一度改訂を経ている。**v2 であり、正誤表の手も入っている。

**出す前に確かめることが一つある。**投稿画面に「文章は実質的に著者自身のものである」に
相当する申告欄があるかどうかである。**あれば、この誌には出さない。**
開示は書けるが、申告は事実に反する。

**その確認より先に稿を送らない。**送れば、いちばん仕上がっている一篇が塞がる。

## 編集者へのコメント —— Conatus に独身論を出す場合

投稿欄の `Comments for the Editor` に入れるものである。**そのまま貼る。**

題名と三つの番号を入れ替えれば、他の二篇にも使える。

| 論文 | Zenodo | SSRN | PhilArchive |
| --- | --- | --- | --- |
| The Nobility and Exemplarity of the Celibate Individual | `10.5281/zenodo.22058254` | `10.2139/ssrn.7358779` | `NEMTNA` |
| Manifesto of Imperial Selfhood | `10.5281/zenodo.22057583` | `10.2139/ssrn.7358818` | `NEMMOI` |
| Fragmentarian Spiritual Individualism | `10.5281/zenodo.22064241` | —（SSRN に弾かれた） | `NEMFSI` |

**肩書きを名乗らない**（決めごと 6）。凍結された PDF の扉には使わないと決めた語が
印字されているが、そこは直せないし直さない。**新しく書く文では使わない。**
状態を述べるだけにする。`check_text.js` がこの文書も見ている。

### 貼る文

> **Dear Editors,**
>
> I am submitting "The Nobility and Exemplarity of the Celibate Individual: An
> Antinatalist and Ascetic Reconsideration of Autonomy and Quality of Life" for
> consideration. The paper argues that the standard case for treating sexual
> activity as ethically required moves from a demographic fact to an individual
> obligation, that this move does not survive the antinatalist objection, and that
> celibacy can then be positively assessed through the Epicurean distinction
> between kinetic and katastematic pleasure together with Schopenhauer's metaphysics
> of will.
>
> **Three things should be on the record before any reviewer time is spent.**
>
> **1. The paper is already public as a preprint.** It is deposited on Zenodo
> (10.5281/zenodo.22058254, v2, August 2026), SSRN (10.2139/ssrn.7358779) and
> PhilArchive (NEMTNA), under CC BY 4.0. A further copy is currently in moderation
> for deposit in HAL. I note that your copyright terms expressly permit and
> encourage posting a work online before and during submission.
>
> **It has never been peer reviewed, and it is not under consideration at any other
> journal.** I have an open review request outstanding for this paper on PREreview,
> which is a platform for community review of preprints rather than a publisher;
> no review has appeared there to date. Should one appear while the paper is with
> you, it would be public, and I would rather you knew of the request now than
> came upon it later.
>
> **2. Disclosure of generative AI use.** The manuscript was written by me in
> Japanese. The English text was produced with generative AI, which translated it
> and expanded the prose; I reviewed the result and take responsibility for the
> whole of it. The deposited paper discloses AI assistance and names Claude
> (Anthropic).
>
> **The specific tool used for the translation cannot be determined.** No record
> was kept at the time, and my own recollection does not settle it. I have recorded
> this gap, and the reason it cannot be closed, as erratum E5 in the public errata
> for these papers. I am telling you rather than presenting a tidier account than I
> can support. **If this is disqualifying under your policy, I would rather be told
> at the desk stage than have reviewers read the paper first.**
>
> **3. I hold no research affiliation.** I am an undergraduate student, working
> without a supervisor or a co-author. The errata for these papers are public and
> are checked mechanically on every commit; corrections are recorded rather than
> silently applied.
>
> Errata: https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/ERRATA.md
>
> Thank you for your time.
>
> Takuya Nemoto
> ORCID 0009-0000-1406-0547

### 二文を足した理由

**PREreview と HAL は、どちらも「他誌で審査中」には当たらない。**
PREreview は出版者ではなく、公開のレビューを募る場である。HAL は保管庫である。
**それでも書く。**

理由は二つある。**一つ。**この稿には PREreview の依頼が立っている。
審査中に評価が付けば、それは公開の場に出る。**編集者が後から見つける形にしない。**
**二つ。**Conatus の著作権条項が、投稿前と投稿期間中の公開を明文で勧めている。
書いても不利にならない。

> 著者は、投稿前および投稿期間中に、自身の研究成果をオンラインに掲載することが
> 許可されており、また推奨されています。

**この条項が、「これまで出版されたことはなく」の読み方を決めている。**
指しているのは正式な出版と他誌投稿であって、プレプリントではない。

### ライセンスが版ごとに割れる

Zenodo の公開版は **CC BY 4.0**、誌が付けるのは **CC BY-NC 4.0** である。

**衝突はしない。**著作権は著者が保持し、供与するのは非独占のライセンスなので、
版ごとに条件が違って構わない。**Zenodo の CC BY 4.0 は撤回できない。**そのまま残る。

決めごと 7 は「論文は CC BY 4.0」と定めている。**誌の版だけ NC が付く。**
記録の外側の話だが、黙って通さずに書いておく。

### 気をつけること

**同じ稿を二つの誌に同時に出さない。**「他誌で審査中ではない」と書いている。
Conatus に出しているあいだ、その一篇を Episciences へ出すことはできない。
**三篇それぞれ別の誌へ出すのは差し支えない。**

**PhilArchive と SSRN と Zenodo は誌ではない。**置いたままで問題にならない。
そのことも文中で先に言ってある。

**断章論には SSRN の番号が無い。**弾かれているので、その行だけ落とす。
**落とされたこと自体は書かない。**編集者に関係が無い。

---

出した先と結果は [`external-evaluations.md`](external-evaluations.md) の「出した先」に記録する。
