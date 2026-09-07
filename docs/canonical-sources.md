# 正本の優先順位

同じ内容が複数の場所にあるとき、**どれを正とするか**を固定します。
新しい順位を作るのではなく、**すでにそう運用しているもの**を書き留めるだけです。

---

## 種類ごとの正本

| 対象 | 正本 | 理由 |
|---|---|---|
| **論文の PDF と書誌** | **Zenodo** | DOI が付き、版が固定される。GitHub 上の PDF は同じものの控え |
| **実装と版管理** | **GitHub** | 履歴・差分・CI がある。Zenodo のアーカイブは特定時点の写し |
| **著者の識別子** | **ORCID** `0009-0000-1406-0547` | 同姓同名と区別できる唯一の識別子 |
| **公開の入口** | **GitHub Pages** `https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/` | 核の主張・撤回・全成果への導線が一枚にある |
| **撤回と正誤** | **`trinity-infinity/ERRATA.md`** | 何が撤回されたかは、ここだけが正 |

---

## 論文に DOI が複数あるとき

**Zenodo を引用してください。**

| 論文 | 正（Zenodo） | 別の DOI |
|---|---|---|
| The Nobility and Exemplarity of the Celibate Individual | `10.5281/zenodo.22058254` | SSRN `10.2139/ssrn.7358779` |
| Manifesto of Imperial Selfhood | `10.5281/zenodo.22057583` | SSRN `10.2139/ssrn.7358818` |
| A Naval Gazette Entry for Lieutenant Otani Tsune | `10.5281/zenodo.22055709` | Knowledge Commons [レコード](https://works.hcommons.org/records/q36z2-98e12) |

SSRN 版は同一本文です。片方だけを直すと食い違うため、**Zenodo を正**とします。

Knowledge Commons のレコードも同一論文の別の所在です。**このレコードが DOI を
持つかどうかは未確認です**（外部への接続が遮断されているため、この環境から
確かめられません）。持っているなら、URL ではなく DOI を書いてください。

### 引用してはいけない DOI

| DOI | 理由 |
|---|---|
| `10.5281/zenodo.17173703` | Trinity-Infinity Series I の**初版（2025年）**。この系列が訂正の対象としているもの。改訂版は `10.5281/zenodo.22058624` |

Series II・III の参考文献欄は、改訂版を指すつもりでこの初版の番号を書いています。
**印刷された PDF は直しません。**代わりに `ERRATA.md` の E1 に記録してあります。
どちらが正かの判断は、**PDF ではなく ERRATA.md を見てください。**

---

## 外部プロフィールの位置づけ

いずれも**正本ではありません。**正本を指すための入口です。

| 場所 | 役割 |
|---|---|
| researchmap | 日本国内向けの登録。内容は Zenodo と ORCID の写し |
| HAL | 欧州向けの登録。同上 |
| PhilPeople | 哲学分野の登録。同上 |
| Google Scholar | 自動収集。**こちらから内容を管理していません** |
| SSRN | 二篇の別 DOI の置き場。Zenodo が正 |
| ランサーズ / ココナラ | 受注のプロフィール。**研究成果とは別種** |

これらに食い違いが見つかったときは、**Zenodo と ORCID に合わせて外部側を直します。**
逆はしません。

---

## 配信先

**GitHub Pages が唯一の正です。**

`https://cpsbvbng26-dotcom.vercel.app` は使いません。サイトの内容と検証スクリプトは
すべて `github.io` を指しており、`check_site.js` の「別の配信先を指す URL が無い」が
これを強制しています。

> **未処理:** プロフィールリポジトリの About → Website が Vercel を指したままです。
> リポジトリ設定は検証スクリプトの範囲外なので、手作業で直す必要があります。

---

## この文書が扱わないこと

- 新しい優先順位の発明。ここにあるのは既存運用の記述だけです
- DOI の推測。未取得のものは「無し」と書きます
- 外部サービスの内容の保証。こちらから管理できるのは GitHub・Zenodo・ORCID だけです
