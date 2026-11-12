# GitHub About に貼る bio 案

GitHub のプロフィール（Settings → Public profile → Bio）に入れる短文です。
設定は作業環境から届かないので、ここでは文案だけを置きます。
この下書きは、2026-11-12 に Claude が凍結と決めました（[運営の決まり](../docs/governance.md)）。

GitHub の bio は一つしか持てません。
使うのは英語版と、Claude が決めました（2026-11-12）。
ORCID と論文の読者は英語で探すためです。

---

## 日本語（160 字以内）

### 案 1 — 核を出す（推奨・100 字）

> コンピュータサイエンスと人工知能を学んでいます。公開しているのは査読前の論文のみ。核は Trinity-Infinity の収束定理と、その検証です。ORCID 0009-0000-1406-0547

### 案 2 — 訂正の姿勢を出す（112 字）

> 査読前の論文を公開しています。核は Trinity-Infinity の収束定理と、その検証。自分の論文が置いた仮定が強すぎたことも、撤回した主張も、消さずに記録しています。ORCID 0009-0000-1406-0547

### 案 3 — 最短（60 字）

> 査読前論文。核は Trinity-Infinity の収束定理と検証。ORCID 0009-0000-1406-0547

---

## 英語（200 字以内）

### 案 1 — 核を出す（推奨・191 字）

> Studying computer science and LLMs. Everything I publish is a preprint, not peer reviewed. The core is the Trinity-Infinity convergence theorem and its verification. ORCID 0009-0000-1406-0547

### 案 2 — 訂正の姿勢を出す（177 字）

> Preprints only, none peer reviewed. The core is the Trinity-Infinity convergence theorem and its verification, including a correction to my own papers. ORCID 0009-0000-1406-0547

### 案 3 — 最短（124 字）

> Preprints, not peer reviewed. Core: the Trinity-Infinity convergence theorem and its verification. ORCID 0009-0000-1406-0547

---

## 書かないと決めたもの

| | 理由 |
|---|---|
| 肩書きの自称 | 著者の指示 |
| 所属 | 著者の指示 |
| 学位・在学状況 | 上と同じ。書くなら正確な状態のみ |
| 引用数・スター数 | 実測していない数値は書かない |
| 「査読済み」と読める表現 | 事実に反する |

## Website 欄の URL 優先順位

GitHub のプロフィールと各リポジトリの About にある Website 欄は一つだけです。
次の順で選びます。

| 順位 | URL | 理由 |
|---|---|---|
| 1 | `https://cpsbvbng26-dotcom.vercel.app/` | **正本**。核の主張・撤回・全成果への導線が一枚にある |
| 2 | `https://orcid.org/0009-0000-1406-0547` | 識別子の正本。ただし論文一覧までで、核の主張は読めない |
| 3 | 各成果の Zenodo DOI | 個別リポジトリの About 用 |

`https://cpsbvbng26-dotcom.vercel.app` は**使いません**。サイトの内容 67 箇所と
検証スクリプトは GitHub Pages を正としており、Vercel を指すと正本が二つになります。

> 現状、プロフィールリポジトリの About は Vercel を指したままです。
> ここを 1 位の URL に変えるのが、この監査で見つかった中で最も効果の大きい一手です。
