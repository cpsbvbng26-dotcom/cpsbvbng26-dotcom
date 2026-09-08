# 外部からの評価

**いま 5 件。**

この文書は、外部の場から受けた評価を記録するためのものである。
**評価が来る前に作ってある。**あとから作ると、都合の悪いものだけ載せない、が
できてしまう。器を先に固定しておけば、それができなくなる。

---

## 決めごと

**破ると記録の意味が消える順に並べてある。**

1. **査読と呼ばない。**公開している論文はいずれも査読を受けていない。
   DOI があることは、査読を受けたことを意味しない。外部の場が「ピアレビュー」を
   名乗っていても、こちらの記録では査読と書かない。
2. **丸写ししない。**評価文は書いた側のものである。このリポジトリは CC BY 4.0
   なので、丸写しは他人の文章を勝手に再配布することになる。**引用は短く、
   原文どおり、出典を添えて。**地の文はこちらで書く。
3. **褒めた箇所だけ載せない。**指摘も同じ表に入れる。片方だけ載せた時点で、
   これは記録ではなく宣伝である。
4. **検証していないものは、検証していないと書く。**外部の評価は、こちらで
   確かめていない主張の塊である。当たっていない指摘を「当たった」と書かない。
5. **人が書いたものと、機械が出したものを分ける。**表の「種別」欄がそれである。
6. **件数を機械で数える。**下の表の行数と冒頭の「いま NN 件」が食い違えば、
   横断の検査が落ちる。
7. **出典が消えるものは、証言として扱う。**一回きりのリンクやメールで届いた評価は、
   そのうち辿れなくなる。**死んだリンクは、証拠のふりをした穴である。**書かない。
   代わりに `第三者` の欄に「確かめられない」と書く。**載せないのではなく、
   確かめられないと書いて載せる。**
8. **日付を手で書かない。**その行を足したコミットの日付が日付である。
   git から取れるものを手で打つと、打ち間違いと詐称の余地だけが増える。

---

## 受けた評価

| 場 | 種別 | 対象 | 第三者 | こちらの検証 | 指摘への対応 |
| --- | --- | --- | --- | --- | --- |
| Stanford Agentic Reviewer（paperreview.ai） | 機械 | Trinity-Infinity Series III | 確かめられない | 全項目を当たった（下記） | `ERRATA` の N6・N7、登録簿の `EX-002`・`EX-003`・`EX-004` |
| Stanford Agentic Reviewer（paperreview.ai） | 機械 | Trinity-Infinity Series I | 確かめられない | 全項目を当たった（下記） | `ERRATA` の N8、登録簿の `EX-004`・`EX-005`・`EX-006` |
| Stanford Agentic Reviewer（paperreview.ai） | 機械 | Trinity-Infinity Series II | 確かめられない | 全項目を当たった（下記） | `ERRATA` の N2・N9・N10、登録簿の `EX-004`・`EX-007` |
| Stanford Agentic Reviewer（paperreview.ai） | 機械 | Manifesto of Imperial Selfhood（改訂版） | 確かめられない | 版を同定し、全項目を当たった（下記） | `autonomy` の `ERRATA` E7、登録簿の `PH-008`・`EX-008` |
| Stanford Agentic Reviewer（paperreview.ai） | 機械 | The Nobility and Exemplarity of the Celibate Individual（v2） | 確かめられない | 版を同定し、全項目を当たった（下記） | `autonomy` の `ERRATA` N5・N6、登録簿の `PH-009` |

**場** —— 評価を出した先の名前。URL は書かない。消えるものを所在として書くと、
あとから開けない穴が残る。

**種別** —— `人` は人間が書いたもの。`機械` は言語モデルなどが出力したもの。
どちらか分からないものは `不明` と書く。**推測で埋めない。**

**第三者** —— `確かめられる` は、いま誰でも原文に辿り着ける場合。
`確かめられない` は、出典が消えたか、最初から一回きりだった場合。
**後者は著者の言葉以外に根拠が無い。反証もできない。**

**こちらの検証** —— `未検証` / `確認した` / `当たらない`。既定は `未検証` である。

**日付は無い。**その行を足したコミットの日付が日付である。`git log` で辿れる。

---

### Stanford Agentic Reviewer — Series III

**全文は載せない。**生成物の権利についての公開された記述が見つからないため、
引用は短くとどめる（決めごと 2）。**指摘は一つずつ当たり、外れたものも残す**（決めごと 3・4）。

対象の同定は本文からである。**査読の側に論文名のラベルは無く、利用者も
「多分これで合っている」と述べている。**内容が Series III のもので一致している。

**三つの向きは、登録簿でも別の項目にしてある。**一件ずつ、消さずに記録する。

| | 登録簿 | 状態 |
| --- | --- | --- |
| 独立に当てた | `EX-002` | いま立っている主張（覆し方あり） |
| 新しく出した | `EX-003` | 直した |
| 外した | `EX-004` | いま立っている主張（覆し方あり） |

#### 独立に当てたもの

**この査読には `ERRATA.md` を渡していない。**紙面だけである。

| 指摘 | こちらの記録 | 判定 |
| --- | --- | --- |
| > The paper does not cite the Banach fixed-point theorem or standard texts on contractions/affine maps | **E6**（同日、通し読みで記録） | **当たった。独立の確認である** |
| > “Pⁿ is a permutation matrix” appears to mean P_n; stray primes in P_n' … 10-16 vs 10^−16 | **N5** | **同じ箇所。**ただし査読も PDF から文字を取り出しているので、同じ崩れを共有している可能性がある |

**E6 は、こちらが先に記録し、そのあと外部が独立に同じ結論に達した。**
教えてから言わせたのではない。

#### 新しく出したもの

| 指摘 | こちらの検証 | 記録 |
| --- | --- | --- |
| `exact for n=2,3` は machine precision と書くべき | **当たっている（理由は違う）。**乱数種を固定した実装では本当に 0 になる。別の基準点では `5.551e-17` が出る。問題は 0 かどうかではなく、**同じ表の中で厳密な 0 と丸めの 0 が書き分けられていないこと** | **N6** + `claims_audit.py`（32 項目） |
| 異方性版が一般の `n` で定義されていない（`f(T) = D P_n T + (I − D)p` を書くべき） | 当たっている。三本のどこにも一般の `n` の式が無い | **N7** |
| 定理1のノルムを特定していない | 当たっている。Series I は `Euclidean norm` と明記、Series III は `‖·‖` のみ | **N7** |
| 異方性の場合に等号と不等号を区別すべき | 当たっている。異方性では `≤` で、等号は最大値を達成する座標に台が乗るときだけ | **N7** |
| `isometry error` の定義と許容差を書くべき | 当たっている。紙面は指標を定義していない | **N7 に含めた** |
| 定理を任意の直交行列、あるいは任意の `‖A‖ < 1` で述べれば射程が広がる | 妥当な助言である。**紙面の誤りではないので正誤表には入れない** | 入れない |

#### 外したもの

**記録しないと、この査読の性能を過大に見せることになる。**

| | |
| --- | --- |
| **E3 を見抜けなかった** | 査読は `The script availability claim (series3_verification.py) supports reproducibility` と書き、**存在しないスクリプトを強みとして数えた。**同梱を謳うスクリプトは三本とも存在しない（`ERRATA` の E3）。**紙面だけからは確かめられない種類の欠陥である** |
| **E1 を見抜けなかった** | 参考文献 [1] は `(Revised Edition)` と書きながら 2025年初版の DOI を載せている。**参考文献欄だけで確かめられる**のに、触れていない |
| **`isometry error` の 0 を疑ったが、これは厳密** | 置換行列の成分は 0 と 1 だけなので `PPᵀ − I` に誤差が入らない（`n = 2` から `8` まで `‖PPᵀ − I‖_F = 0.0`）。**指摘が外れている** |

#### 総評について

査読は novelty を `low`、貢献を `incremental` とし、`too modest for a top-tier venue`
と述べた。**これは紙面の主張と衝突しない。**Series III 自身が
`a smaller mathematical universe than its name suggests` と書き、README は
「数学という分野に対しては、寄与ゼロである」と書いている。

**評点は記録しない。**覆せないものは、この登録簿の材料にならない（`ST-002`）。
記録する価値があるのは、上の三つの表のほうである。

---

### Stanford Agentic Reviewer — Series I

同じ場、同じ種別。**`EX-004` の試験である** —— 「紙面だけを読む査読は、同梱物の
不在を見抜けない」という、こちらが立てた主張を試すために出した。

#### 独立に当てたもの

| 指摘 | こちらの記録 | 判定 |
| --- | --- | --- |
| > does not verify subgame perfection conditions in detail (e.g., one-shot deviation principle under the specified trigger) | **N8 ①** | **当たった。**こちらの読み直しと、互いを知らずに同じ箇所 |
| > The engineering analogy would benefit from citing standard references on Neumann series, spectral-radius conditions, and matrix norms | **E6 の一部**（Euler 1735 と Neumann 級数が参考文献欄に無い） | **部分的に当たった。**バナッハ自体には触れていない |

#### 新しく出したもの

| 指摘 | こちらの検証 | 記録 |
| --- | --- | --- |
| `I − αP` の可逆性（`P` の固有値は絶対値 1 なので `ρ(αP) = α < 1`） | 当たっている。紙面は閉形式を使うが、逆行列が存在する理由を書いていない | **N8 ②** |
| 置換はすべての `ℓᵖ` で等長なので、`ℓ²` に限らず一般化できる | 当たっている。**ただし紙面の誤りではない** —— Series I は `under the Euclidean norm` と明記している。射程の助言である | 入れない |
| 自己言及版は対角線への一段射影であり、不動点集合は線分である。代数的に書けば数値実験は要らない | 当たっている。紙面は `every state with T1=T2=T3 is already a fixed point` と述べているので、内容は書かれている。**書き方の助言である** | 入れない |
| 題が射程より広い | Series III 自身が `a smaller mathematical universe than its name suggests` と書いている。**凍結された題は変えない** | 入れない |

#### 外したもの

| | |
| --- | --- |
| **E5 を見抜けなかった** | 査読は `Beyond Fudenberg–Maskin (1986), the modern unilateral enforcement ... framework gives exact discount thresholds` と述べ、**Fudenberg & Maskin を正しい出所として扱ったうえで、追加の文献を勧めた。**grim trigger の閾値の出所が Friedman (1971) であることには触れていない。**参考文献欄と本文だけで確かめられる誤りである** |
| E3 に触れなかった | Series III では存在しないスクリプトを強みとして数えたが、今回は言及していない。**当てたのでもなく、外したのでもない** |
| E1 は Series I に無い | **こちらの見立てが誤っていた。**E1 は Series II と III の話であり、Series I の `Nemoto (2025) DOI: 17173703` は初版を指す正しい用法である。**査読の落ち度ではない** |

#### 作ったもの —— 実在しない誤植

> Minor notation inconsistency: f(T) = α σ(T) + (1−**a**)p uses “a” instead of “α” once.

**そのような箇所は無い。**PDF から取り出して、Series I の該当形をすべて数えた。

```
'(1−α)'  …the integration map Ip,α(y) = αy + (1−α)p…
'(1−α)'  …f(T) = α σ(T) + (1−α)p…
'(1−α)'  …T* = (1−α)(I−αP)−1p exactly…
```

**三箇所すべて `α` である。**Series II の `(1−ai)pi` は異方性版の正しい表記であり、
Series I には現れない。

**これは見落としとは別の壊れ方である。**見落としは沈黙だが、これは**確かめられる形の
偽の指摘**である。指摘が具体的であるほど、確かめずに直してしまう危険が高い。
登録簿の `EX-005` に立てた。

---

### Stanford Agentic Reviewer — Series II

**三本目。`EX-004` の試験としては、E7 が対象だった** ——「`strictly above 2` と
置いた二文後に `(2,4,2)` を例示」。同じ節の中で完結している矛盾である。

#### いちばん重い —— 独立に導出された

> A stronger structural fact is available … **(D P)^3 = (a1 a2 a3) I** because P^3 = I
> and conjugation by P cyclically permutes the diagonal entries … an asymptotic linear
> rate (Π a_i)^(1/3) equal to the spectral radius of D P.

**正しい。測った。**

| | |
| --- | --- |
| `(DQ)³` | `0.105 · I`（誤差 `0.0e+00`） |
| `ρ(DQ)` | `0.471769398032` = `(0.105)^{1/3}` |
| `‖DQ‖₂ = maxᵢ aᵢ` | `0.700000000000` |
| 30 反復の実際の誤差比 | `1.63e-10` |
| 紙面が名乗る `max(aᵢ)³⁰` | `2.25e-05` |

**紙面の率は 5 桁ゆるい。**そして —— **これは
[trinity-operator](https://github.com/cpsbvbng26-dotcom/trinity-operator) が
実装している中心的事実そのものである。**`ρ(DQ)` は巡回ごとの幾何平均。
[作用素のページ](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html)
がその場で計算する。**査読はそのリポジトリもこの文書も渡されていない。**

`ERRATA` の **N9** に立てた。この系列でいちばん重い見落としである。
機械でも当たるようにした（`independent_check.py`、15 項目）。

#### 新しく出したもの

| 指摘 | こちらの検証 | 記録 |
| --- | --- | --- |
| `(DP)³ = (∏aᵢ)I`、漸近率は幾何平均 | **当たっている。**上記 | **N9** |
| 凸包を実現可能集合とするには公開ランダム化か時間平均が要る。監視構造も未明示 | 当たっている。紙面はどちらも述べていない | **N10** |
| `V(x) = ‖x−T*‖2` が 2 乗なのかノルムの添字なのか曖昧 | **曖昧である。**リャプノフ関数の慣例では 2 乗で、その場合は紙面の `max(aᵢ)²` が正しい。**抽出したテキストでは区別できない** | **TI-011** |
| 級数に `+☐` が出る | 同じ。抽出の崩れか紙面の崩れか区別できない | **TI-011** |
| Series II 単独では利得表が復元できない（ミニマックス 2 と凸包の体積が自己完結していない） | 当たっている。**紙面の誤りではない** —— 参照は明示されている | 入れない |
| 閉形式 `T* = (I − DP)⁻¹(I − D)p` を本文に書くべき | 当たっている。**書き方の助言である** | 入れない |
| `d` 次元へ一般化できる | Series III がやっている。**査読は Series III を見ていない** | 入れない |

#### 外したもの

| | |
| --- | --- |
| **E7 を見抜けなかった** | `strictly above 2` と置いた二文後に `(2,4,2)` を例示している。**同じ節の中で完結している矛盾**である。査読は第4節を Blackwell 均衡の頑健性の観点から論じたが、この食い違いには触れていない |
| E3 に触れなかった | Series II も `series2_verification.py` の同梱を三箇所で謳っている。むしろ `a companion script claimed to regenerate every reported number` を強みに数えた |

**三本で三本、本文と参考文献欄の中で完結している誤りを拾えていない**
（III の E1、I の E5、II の E7）。`EX-004` に書いた。

#### 総評について

`novelty is limited` / `a solid technical note with pedagogical value rather than a
contribution of high originality`。**紙面と衝突しない。**評点は記録しない。

**ただし、この一件は評点の話ではない。**査読が出した `(DP)³` は、
**紙面を一段深く訂正する事実**である。こちらが別のリポジトリで実装していた
向きに、外から独立に届いた。

---

### Stanford Agentic Reviewer — Manifesto of Imperial Selfhood

**四件目。数学ではなく哲学の一篇である。**利用者から「改訂後のやつか確認して」と
求められたので、版の同定から始めた。

#### 版の同定 —— 改訂版である

| 査読が言っていること | 紙面 |
| --- | --- |
| `Section 5 objection handling` | 第5節 = `Objections and Limitations` |
| Foucault / Stoicism / sovereign individual | 第4節 = `Situating Personal Imperialism: Adjacent Discourses` |
| `the declared AI assistance` | `Declaration on the Use of Artificial Intelligence` あり |
| `will to power` の後世編纂への注意 | `will to power` 9 回、`posthum` 1 回 |

ファイルは `manifesto-of-imperial-selfhood-revised.pdf`、表紙に
`Revised and Expanded Edition`、2026年8月、9 ページ。**第4節と第5節は改訂で
足された章であり、初稿には無い。**したがって改訂版でしか成立しない指摘である。

#### 版を確かめる作業のほうで見つかったもの

**開示文を読んだので、こちらが一件見つけた。**査読の指摘ではない。

> No data, quotations, or sources were fabricated by the AI system in the course of this revision.

同じ段落が、照合そのものも AI がやったと述べている。

> verify the bibliographic citations listed in the References section against publicly available sources

**捏造が無かったことを確かめたのは AI であり、著者は原典に当たっていない**
（`autonomy` の `ERRATA` E6）。**この断言は AI 自身の報告以外に根拠を持たない。**

`autonomy` の `ERRATA` に **E7** として立て、二つの引用を機械で固定した（82 項目）。
登録簿は `PH-008`。

#### 査読が突かなかったこと

査読は開示文を読んだうえで、こう問うた。

> Given the declared AI assistance, are there specific passages where you worry voice or
> judgment might have been over-normalized …

**断言そのものには触れていない。**声が平準化されたかという問いは、それよりはるかに
柔らかい。**この循環は紙面の中だけで完結している** —— 三本の数学論文で欄の中で
完結している誤りを拾えなかったのと、同じ形である。登録簿の `EX-008`。

#### 当てたもの

| 指摘 | 判定 |
| --- | --- |
| Jünger の総動員が、反照性のみという制約と噛み合わない | **妥当。**紙面は第5節で修辞の危険を認めているが、この論点そのものは扱っていない |
| カントの目的の王国を、間主観から内心へ移すのに Korsgaard 等を踏まえていない | **妥当。**参考文献欄に Korsgaard・Frankfurt・Bratman は無い |
| 緊張を構造とすると言うが、一つの層が支配することを防げる理由を示していない | **妥当。**紙面は緊張が構成的であると述べるだけである |

**どれも紙面の誤りではない。**足りていないものの指摘である。哲学の論文に対する
査読としては、これが妥当な形だと思う。**数学の三本と違って、機械で当たれる指摘が
一つも無い。**

#### 総評について

`promising and original in framing, but not yet at the level of concreteness and
comparative engagement expected at a top-tier venue`。評点は記録しない。

---

### Stanford Agentic Reviewer — The Nobility and Exemplarity of the Celibate Individual

**五件目。版の同定から。**

#### 版の同定 —— v2 である

査読は「四つの反論を先取りしている」と述べ、括弧で内容を並べた。

| 査読が並べた順 | 紙面 |
| --- | --- |
| relational psychology | **Objection 1 (The Relational Objection)** |
| self-undermining universalization | **Objection 2 (The Self-Undermining Objection)** |
| parochialism | **Objection 3 (The Parochialism Objection)** |
| QOL subjectivity | **Objection 4 (The Subjectivity Objection)** |

**順番まで一致している。**表紙にも
`Original version: 21 October 2025 | Revised version (v2): 22 August 2026` と印字されている。

#### 当てたもの —— 紙面に無い語で確かめた

査読の問いを、紙面の語の有無で当たった。**三つとも一度も現れない。**

| 査読の問い | 紙面 | 記録 |
| --- | --- | --- |
| > Since **contraception** decouples sex from reproduction, how does your critique of "demographic necessity" translate into a critique of sexual activity per se | `contracept` **0 回** | **N5** |
| > How do you distinguish chosen celibacy from **involuntary** sexlessness, aromanticism, and **asexuality** | `involuntary` **0 回** / `asexual` **0 回** | **N6** |
| > Which contemporary population-ethics critiques of Benatar (**Parfit**, non-identity, **Arrhenius**) | いずれも **0 回** | 誤りではないので数えない |
| > capability theory (**Sen**, **Nussbaum**) | いずれも **0 回** | 同上 |

**N5 がいちばん重い。**否定的論証（第3節）は**生殖**の義務を撃ち、肯定的論証（第4節）は
**性行為そのもの**を撃つ。**避妊がその二つを切り離す。**したがって第4節は反出生主義から
の支えを受けずに単独で立たなければならないが、紙面はそこに触れていない。
論証が崩れるわけではない —— **二段の関係が、書かれているより弱いというだけである。**

#### 併せて確かめたこと —— E7 の範囲

M の `No data, quotations, or sources were fabricated` は、**M だけにある。**
N と F には無い。`E7` の範囲が M 限りであることを、機械で固定した。

#### 総評について

`with deeper engagement of alternative value theories, collective-duty considerations,
and cross-cultural breadth, it could mature into a compelling and field-shaping article`。
評点は記録しない。

**哲学二篇に共通していること。**指摘はどれも「足りていないもの」であり、
**紙面の誤りは一つも出ていない。**数学三本では E1・E5・E7 を見落としたが、
哲学では見落とす対象そのものが少ない —— **正誤が数値や引用の形で存在しないためである。**


---

## 出した先

評価を求めて出したものの記録である。**返ってきたかどうかとは別に書く。**
出したのに何も返らなかったことも、記録の一部である。

| 出した先 | 対象 | DOI | 状態 |
| --- | --- | --- | --- |
| 外部の公開レビューの場（名前は最初の評価が届いた時点で記す） | The Nobility and Exemplarity of the Celibate Individual | `10.2139/ssrn.7358779` | 受付済み。評価なし |
| 同上 | Manifesto of Imperial Selfhood | `10.2139/ssrn.7358818` | 受付済み。評価なし |

## 計測されているもの —— **これは評価ではない**

PlumX（Elsevier）が、SSRN 版の二篇について数を出している。

| 論文 | SSRN の DOI | PlumX |
| --- | --- | --- |
| Manifesto of Imperial Selfhood | `10.2139/ssrn.7358818` | https://plu.mx/plum/a/?ssrn_id=7358818 |
| The Nobility and Exemplarity of the Celibate Individual | `10.2139/ssrn.7358779` | https://plu.mx/plum/a/?ssrn_id=7358779 |

**PlumX が出すのは計測であって評価ではない。**閲覧・保存・言及・引用の数を
集めたものであり、**中身が正しいかについては何も言わない。**査読でもない。

### 数を書き写さない

**PlumX の数値は、この記録に転記しない。**理由は三つある。

1. **動く。**書き写した瞬間から古くなる
2. **確かめられない。**この作業環境から外に出られないので、書いた数が
   合っているかを機械で当たれない。散文に数を書いたら機械で確かめる、という
   決めごとを満たせない
3. **数が増えたことは、主張が正しいことの証拠にならない。**閲覧が増えても、
   証明が通るようになるわけではない

**確かめたい者は上のリンクを開く。**それが正である。

### バッジは置けない

公開サイトの Content-Security-Policy は `default-src 'none'` である。
外部へリクエストを出さない。**PlumX のバッジやウィジェットは、この方針では
置けない。**方針であると同時に、ブラウザが強制している。

---

### 経路が二つある

**DOI で受け付ける場と、PDF を直接受け付ける場では、出せる範囲が違う。**

**DOI で受け付ける場。**受け付けたのは SSRN の DOI だけだった。Zenodo の DOI は
対象外である。SSRN の DOI は Crossref、Zenodo の DOI は DataCite が発行している。
**どちらの登録機関を見ているかで、受け付ける範囲が変わる。**確かめたのは
「通ったかどうか」であって、相手の仕組みそのものは確かめていない。

SSRN 版があるのは二篇だけなので、この経路で出せるのは二篇である。

| 論文 | SSRN 版 | この経路 |
| --- | --- | --- |
| The Nobility and Exemplarity of the Celibate Individual | あり | **出せる** |
| Manifesto of Imperial Selfhood | あり | **出せる** |
| Fragmentarian Spiritual Individualism | 無い | 出せない |
| Trinity-Infinity Series I・II・III | 無い | 出せない |
| A Naval Gazette Entry for Lieutenant Otani Tsune | 無い | 出せない |

**PDF を直接受け付ける場。**識別子を要求しない。Stanford ML Group の
Agentic Reviewer（paperreview.ai）がこれで、PDF を上げるだけで構造化された批評が
返る。無料である。**DOI の登録機関の違いに縛られない。**

したがって、**上の表で「出せない」となっている六本も、この経路なら出せる。**
とりわけ Trinity-Infinity の三本は、この道具が得意とする領域（機械学習・計算機科学）に
最も近く、**初稿が言語モデルの生成であるという理由で最も評価を要するもの**である。

**確かめていないこと。**上の記述は、検索結果から起こしたものである。
paperreview.ai そのものには到達していない（作業環境の egress proxy が塞いでいる）。
無料であること・入力の制限・返る内容は、**使う前に本人が確かめること。**

### 生成物の権利が分からない

**この場が返す批評文の権利について、公開された記述が見つからない。**
プライバシー方針とデータ保持についての記載も無い、という指摘がある。

したがって、**丸写しはしない。**理由は「AI が書いたから」ではなく、
**再配布してよいかが分からないから**である。分かったら、この節を書き直す。

**上げるものについては実害が無い。**三本の PDF は Zenodo で公開済みの凍結物で、
上げて漏れるものが無い。未公開のデータを持つ者には効く警告だが、ここには効かない。

### 正本と評価の所在が割れている

[canonical-sources.md](canonical-sources.md) は「引用は Zenodo で」と固定している。
**DOI で受け付ける場の評価は、SSRN の DOI にしか付かない。**片方だけを見た読者は、
もう片方の存在に気づかない。PDF を直接受け付ける場には、そもそも識別子が残らない
——— 返ってきた批評を、こちらが記録しなければ、どこにも残らない。

これは隠すことではなく、書いておくことである。登録簿の `EX-001` に未解決として
立ててある。
