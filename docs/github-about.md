# GitHub の About に入れるテキスト

公開リポジトリ **9 件**分の description・topics・Website・ピン留め順です。
**まだ適用していません。**GitHub の設定画面からの手作業になります（API での書き換えは
このセッションの権限では通りません）。

description は英語 1 本にしてください。**GitHub の description は 1 つしか持てません。**
学術の読者は英語で探します。日本語は README の先頭が担っています。

適用の手順は末尾にあります。

---

## 1. `cpsbvbng26-dotcom` —— プロフィールサイト（入口）

**description**

```
Profile site. One claim: a published artifact cannot be revised, only its errata — so errata drift from their sources, and the drift is machine-detectable without inference.
```

> 参考訳: プロフィールサイト。主張は一つ —— 公開された成果物は直せず、直せるのは正誤表のほうだから、正誤表は元の資料からずれていく。そのずれは推論を使わずに機械で落とせる。

**topics**

```
research-integrity  self-correction  errata  post-publication  reproducible-research
static-site  content-security-policy  json-ld  orcid  preprint
```

**Website**

```
https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/
```

> ⚠️ **前回確認した時点では `https://cpsbvbng26-dotcom.vercel.app` が入っていました。**
> サイトの全ページの `canonical` は GitHub Pages を正としています。ここだけが
> 別の配信先を指している状態です。

---

## 2. `errata-check` —— 監査の道具（DOI つき）

**description**

```
Deterministic auditing of errata against frozen, already-published artifacts. Quotations verbatim, no undercounting, nothing quietly resolved, digests pinned. No LLM, no similarity scores.
```

> 参考訳: 凍結された公開物に対して、正誤表のほうを決定的に監査する。引用は一字一句、数え落としなし、こっそり解決しない、ダイジェストで固定。LLM も類似度も使わない。

**topics**

```
research-integrity  errata  corrigendum  post-publication  reproducibility
continuous-integration  self-correction  scholarly-communication  deterministic-verification  python
```

**Website**

```
https://doi.org/10.5281/zenodo.22649899
```

---

## 3. `self-correction` —— 訂正の記録

**description**

```
Every claim I published that turned out wrong, was withdrawn, or cannot be fixed — recorded one by one, machine-readable, and impossible to delete.
```

> 参考訳: 公開した主張のうち、誤っていたもの・撤回したもの・直せないものを、一件ずつ機械可読で記録する。消せない作りにしてある。

**topics**

```
self-correction  research-integrity  errata  retraction  post-publication
meta-research  machine-readable  provenance  transparency  python
```

**Website**

```
https://github.com/cpsbvbng26-dotcom/errata-check
```

---

## 4. `trinity-infinity` —— 三篇と、その監査

**description**

```
Three preprints on a contraction operator, 95 verification checks, and a record of what the series established, what it withdrew, and what can no longer be fixed.
```

> 参考訳: 縮小作用素をめぐる三篇のプレプリントと、検証 95 項目。何が確立され、何が撤回され、何がもう直せないかの記録。

**topics**

```
trinity-infinity  fixed-point-theorem  banach-fixed-point  contraction-mapping  preprint
reproducible-research  research-integrity  self-correction  errata  numerical-verification  python
```

**Website**

```
https://doi.org/10.5281/zenodo.22058624
```

---

## 5. `trinity-operator` —— 仮定の外まで実装した作用素

**description**

```
The operator from those papers, implemented outside their assumptions. Convergence is governed by the spectral radius, not the operator norm — and the Banach argument that breaks there is rebuilt.
```

> 参考訳: 三篇の作用素を、その仮定の外まで実装したもの。収束を決めるのはスペクトル半径であって作用素ノルムではない。そこで壊れる Banach の議論を組み直してある。

**topics**

```
spectral-radius  operator-norm  non-normal-matrices  transient-growth  lyapunov-equation
joint-spectral-radius  fixed-point-theorem  numerical-linear-algebra  numpy  python
```

**Website**

```
https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html
```

---

## 6. `autonomy-and-self-cultivation` —— 哲学の三篇

**description**

```
Three papers in philosophy: full text, PDFs, citation metadata, a reading site, and an errata audited word by word against the frozen PDFs.
```

> 参考訳: 哲学の三篇。全文・PDF・引用情報・読むためのサイトと、凍結された PDF に対して一語ずつ突き合わせた正誤表。

**topics**

```
philosophy  antinatalism  asceticism  autonomy  individualism
preprint  open-access  errata  self-correction  reproducible-research
```

**Website**

```
https://doi.org/10.5281/zenodo.22058254
```

---

## 7. `naval-gazette-notes` —— 海軍公報の史料ノート

**description**

```
A single 1943 Naval Gazette investiture entry, transcribed and documented — stating what the source does not establish as plainly as what it does.
```

> 参考訳: 1943 年の海軍公報の叙勲記載一件を、翻刻して記録した。**その史料が確立しないこと**を、確立することと同じだけはっきり書いてある。

**topics**

```
archival-research  primary-sources  japanese-history  transcription  jacar
open-data  provenance  errata  self-correction  preprint
```

**Website**

```
https://doi.org/10.5281/zenodo.22055709
```

---

## 8. `researcher-profile` —— 静的サイト生成器

**description**

```
Generates a static researcher profile site from a single configuration file. No dependencies, and the generated pages make no outbound requests.
```

> 参考訳: 設定ファイル 1 つから研究者プロフィールの静的サイトを生成する。依存なし。生成されたページは外部へ一切リクエストを出さない。

**topics**

```
static-site-generator  researcher-profile  orcid  github-pages  zero-dependencies
content-security-policy  json-ld  accessibility  nodejs  javascript
```

**Website**

```
https://doi.org/10.5281/zenodo.22335692
```

---

## 9. `justice-and-algorithms` —— 正義論とアルゴリズム

**description**

```
A resource mapping the debate on algorithmic decision-making onto theories of justice in political philosophy.
```

> 参考訳: アルゴリズムによる決定をめぐる論点を、政治哲学の正義論に接続して整理した資料。

**topics**

```
political-philosophy  theories-of-justice  algorithmic-fairness  ai-ethics  rawls
open-educational-resources  japanese  static-site  nodejs  javascript
```

**Website**

```
https://doi.org/10.5281/zenodo.22335676
```

---

## ピン留め順（最大 6）

**核を方法に入れ替えたので、順序も入れ替えています。**上から順に「何をしている
場所か」が伝わるようにしました。

| 順 | リポジトリ | 理由 |
|---|---|---|
| 1 | `cpsbvbng26-dotcom` | 入口。核の主張と、その限界に 1 クリックで着く |
| 2 | `errata-check` | 核の道具。唯一 DOI が付いた新規のもの |
| 3 | `self-correction` | 核の記録。23 件、消せない |
| 4 | `trinity-infinity` | 監査の対象（論文と、撤回の記録） |
| 5 | `trinity-operator` | 監査の対象（訂正と、その反例） |
| 6 | `autonomy-and-self-cultivation` | 監査の対象（哲学三篇） |

`naval-gazette-notes`・`researcher-profile`・`justice-and-algorithms` は 7〜9 番目に
なります。6 枠しかないため外れますが、プロフィールサイトから辿れます。

---

## 適用の手順

1. リポジトリのページを開く
2. 右側の **About** の**歯車 ⚙️**
3. Description・Website・Topics を貼る
4. **Save changes**

スマートフォンでは About 欄の編集ができません。Safari なら
「デスクトップ用Webサイトを表示」に切り替えてください。

## 注意

- description は **英語 1 本**。二言語を詰め込むと途中で切れます
- topics は**小文字とハイフンのみ**。日本語は使えません
- **「査読済み」と読める語を入れないでください**
- **引用数・スター数は入れません。**実測していないものは書かない方針です
- **自称の肩書きは書きません。**使わないと決めた語は各リポジトリの
  `verification/check_text.js` の `FORBIDDEN` に列挙してあり、CI が止めます
  （凍結した紙面には印字されていますが、いま書く文章では使いません）
