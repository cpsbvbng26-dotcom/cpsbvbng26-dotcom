# GitHub の About に入れるテキスト

公開リポジトリ **7 件**分の description・topics・Website・ピン留め順です。
**まだ適用していません。** GitHub UI か API での反映は手作業です。

現状、**7 件すべてで description と topics が空**です。ここを埋めるのが、
発見可能性の面でいちばん効果の大きい変更です。

記法は次のとおりです。description は英語 1 行と日本語 1 行を併記しますが、
**GitHub の description は 1 つしか持てません。**英語を入れてください。
学術リポジトリの読者は英語で検索します。日本語は README の先頭が担います。

---

## 1. `cpsbvbng26-dotcom` — プロフィールサイト

**description（英語・123 字）**

> Profile site and its verification. One claim: the operator-norm condition in my own papers is sufficient but not necessary.

**description（日本語・参考）**

> プロフィールサイトとその検証。主張は一つ —— 自分の論文が置いた作用素ノルムの条件は十分だが必要ではない。

**topics（10）**

`research-profile` `preprint` `reproducible-research` `spectral-radius`
`fixed-point-theorem` `static-site` `content-security-policy` `json-ld`
`self-correction` `orcid`

**Website**

`https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/`

> ⚠️ **現在 `https://cpsbvbng26-dotcom.vercel.app` が設定されています。**
> サイトの内容 67 箇所と検証スクリプトは GitHub Pages を正としています。
> 正本が二つある状態なので、ここを直すのが最優先です。

---

## 2. `trinity-infinity` — 三篇と検証の記録

**description（英語・136 字）**

> Three preprints on a contraction operator, with 72 verification checks and a record of what the series established and what it withdrew.

**description（日本語・参考）**

> 縮小作用素をめぐる三篇のプレプリントと、検証 72 項目。何が確立され、何が撤回されたかの記録。

**topics（11）**

`trinity-infinity` `fixed-point-theorem` `banach-fixed-point`
`contraction-mapping` `preprint` `reproducible-research` `research-integrity`
`self-correction` `errata` `numerical-verification` `python`

**Website**

`https://doi.org/10.5281/zenodo.22058624`（Series I 改訂版）

---

## 3. `trinity-operator` — 仮定の外まで実装した作用素

**description（英語・141 字）**

> The operator from those papers, implemented outside their assumptions. Convergence is governed by the spectral radius, not the operator norm.

**description（日本語・参考）**

> 上の三篇の作用素を、仮定の外まで実装したもの。収束を決めるのはスペクトル半径であって、作用素ノルムではない。

**topics（10）**

`spectral-radius` `operator-norm` `non-normal-matrices` `transient-growth`
`fixed-point-theorem` `contraction-mapping` `numerical-linear-algebra`
`reproducible-research` `self-correction` `python`

**Website**

`https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html`

> 反例をその場で打ち込めるページです。Zenodo DOI はまだありません。
> 取得したら、この欄を DOI に差し替えるかどうかを判断してください。

---

## 4. `autonomy-and-self-cultivation` — 哲学三篇

**description（英語・134 字）**

> Full text, PDFs and citation metadata for three preprints in philosophy. Normative arguments, not empirical papers. Not peer reviewed.

**description（日本語・参考）**

> 哲学の三篇の全文・PDF・引用情報。規範的主張であり、実証論文ではありません。査読前です。

**topics（10）**

`philosophy` `political-philosophy` `ethics` `autonomy` `antinatalism`
`self-cultivation` `preprint` `open-access` `static-site` `markdown`

**Website**

`https://doi.org/10.5281/zenodo.22058254`（第一篇）

> Pages が有効になっています（`has_pages: true`）。生成サイトが配信されているなら
> そちらを優先してください。**未確認のため断定していません。**

---

## 5. `justice-and-algorithms` — 正義論とアルゴリズム

**description（英語・128 字）**

> A resource mapping the debate on algorithmic decision-making onto theories of justice. It does not adjudicate between positions.

**description（日本語・参考）**

> アルゴリズムによる判断をめぐる論点を、正義論に接続して整理した資料。立場の裁定はしません。

**topics（10）**

`political-philosophy` `algorithmic-fairness` `ai-ethics` `theories-of-justice`
`rawls` `preprint` `open-access` `static-site` `japanese` `reference`

**Website**

`https://doi.org/10.5281/zenodo.22335676`

> **この資料はアルゴリズムの実装ではありません。**
> description と README の両方に、その旨を残してください。

---

## 6. `naval-gazette-notes` — 海軍公報の史料ノート

**description（英語・128 字）**

> A transcription from a 1943 naval gazette, made machine-readable. Separates what the document establishes from what it does not.

**description（日本語・参考）**

> 1943 年の海軍公報からの翻刻を機械可読にしたもの。史料で確定できることと、できないことを分けています。

**topics（10）**

`naval-history` `archival-transcription` `jacar` `prosopography`
`imperial-japanese-navy` `open-data` `csv` `preprint` `japanese-history`
`reproducible-research`

**Website**

`https://doi.org/10.5281/zenodo.22055709`

> `has_pages: false` です。Pages 前提の記述が README にあれば直してください。

---

## 7. `researcher-profile` — 静的サイト生成器

**description（英語・125 字）**

> Generates a researcher profile site from one configuration file. No dependencies, no external requests in the generated page.

**description（日本語・参考）**

> 設定ファイル 1 つから研究者プロフィールのサイトを生成します。依存パッケージなし、生成物は外部リクエストを出しません。

**topics（10）**

`static-site-generator` `research-profile` `zero-dependency` `nodejs`
`json-config` `content-security-policy` `github-pages` `orcid`
`academic` `no-build-tools`

**Website**

`https://doi.org/10.5281/zenodo.22335692`

---

## ピン留め順（最大 6）

上から順に「何をしている場所か」が伝わる順序にしています。

| 順 | リポジトリ | 理由 |
|---|---|---|
| 1 | `cpsbvbng26-dotcom` | 入口。核の主張と撤回に 1 クリックで着く |
| 2 | `trinity-infinity` | 核の論文と、撤回の記録 |
| 3 | `trinity-operator` | 核の訂正と、その反例 |
| 4 | `autonomy-and-self-cultivation` | もう一方の系列（哲学三篇） |
| 5 | `researcher-profile` | 唯一の再利用可能なツール。DOI つき |
| 6 | `naval-gazette-notes` | 一次史料の扱い方を示す |

`justice-and-algorithms` は 7 番目になります。6 枠しかないため外れますが、
プロフィールサイトの `notes/` から辿れます。

---

## 適用するときの注意

- description は**英語 1 本**にしてください。二言語を詰め込むと途中で切れます
- topics は小文字とハイフンのみです。日本語は使えません
- **description に「査読済み」と読める語を入れないでください**
- 数値（引用数・スター数）は入れません。実測していないものは書かない方針です
