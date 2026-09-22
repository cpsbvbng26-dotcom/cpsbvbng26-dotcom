# DOI の一覧

**この一覧は、リポジトリ内部の記述から起こしたものです**。作業環境から
`zenodo.org` にも `doi.org` にも DataCite にも届きません。

**番号の存在は疑っていません**。登録したのは著者本人であり、番号は Zenodo が発行した
ものを著者が読み取って渡しています。**確かめられないのは、書き写しが合っているかと、
どのレコードを指すかです**。決まらないものは「未確認」と書きます。番号を当てにいきません。

`check_ecosystem.js` が、この一覧と実際にリポジトリに出てくる番号を突き合わせます。
片方にしか無い番号があれば落ちます。

---

## 著者自身の Zenodo DOI

| # | DOI | 何か | 状態 |
| --- | --- | --- | --- |
| 1 | `10.5281/zenodo.17173703` | Trinity-Infinity 初版（2025年10月） | **引用してはいけない**。この系列が訂正の対象としているもの。レコードは生きたまま |
| 2 | `10.5281/zenodo.22055709` | A Naval Gazette Entry for Lieutenant Otani Tsune | 現行。史料ノートであり論文ではない |
| 3 | `10.5281/zenodo.22057583` | Manifesto of Imperial Selfhood | 現行（改訂版 2026年8月） |
| 4 | `10.5281/zenodo.22058254` | The Nobility and Exemplarity of the Celibate Individual | 現行（v2 2026年8月） |
| 5 | `10.5281/zenodo.22058624` | Trinity-Infinity Series I 改訂版 | 現行。Series I はこの番号で引く |
| 6 | `10.5281/zenodo.22058777` | Trinity-Infinity Series II 改訂版 | 現行 |
| 7 | `10.5281/zenodo.22058964` | Trinity-Infinity Series III | 現行 |
| 8 | `10.5281/zenodo.22064241` | Fragmentarian Spiritual Individualism | 現行 |
| 9 | `10.5281/zenodo.22335676` | 正義論とアルゴリズム | 現行。論点の整理であり研究成果ではない |
| 10 | `10.5281/zenodo.22335691` | researcher-profile —— **一部だけ確認した** | 下の「未確認の番号」を見ること |
| 11 | `10.5281/zenodo.22335692` | researcher-profile v1.0.0 | 現行 |
| 12 | `10.5281/zenodo.22649054` | errata-check v0.1.0 | 旧版。**だが消してはいけない**（下記） |
| 13 | `10.5281/zenodo.22649899` | errata-check v0.2.0 | 旧版。**だが消してはいけない**（下記） |
| 14 | `10.5281/zenodo.22685687` | errata-check v0.3.0 | 現行 |
| 15 | `10.5281/zenodo.22765695` | solitary-school —— **概念か版かを確かめていない** | 現行。下の「未確認の番号」を見ること |

## 一括置換してはいけない二つ

**`17173703` を消しません**。この番号は「訂正の対象」として指すために置いてあります。
消すと、何を訂正したのかが分からなくなります。Series II と III の参考文献欄は、
改訂版を指すつもりでこの番号を印字している（`trinity-infinity/ERRATA.md` の E1）。
紙面は直せません。

**`22649054` と `22649899` を `22685687` に置換しません**。写して使っている側は、
それぞれ v0.1.0（`trinity-infinity`）と v0.2.0（`autonomy-and-self-cultivation`、
`naval-gazette-notes`）を写したものです。番号だけ新しくすると、写した実物と
食い違います。`check_ecosystem.js` が、写した版と書いてある DOI の対応を当たっています。

新しい番号を足したのは、道具そのものの現行版が v0.3.0 になったからです。
`CITATION.cff` と README の記章がこれを指します。写しの側は動きません。

## 未確認の番号

`10.5281/zenodo.22335691` は `researcher-profile/README.md` の Software Heritage
リンクの中に一度だけ出ます。他の六箇所は `22335692` です。

**誤記ではないところまでは分かった**。Software Heritage がこの DOI を origin として
持っており、その snapshot `83f09cc8…` に researcher-profile の版があります。木の名前は
`cpsbvbng26-dotcom-researcher-profile-65b3622` です。

**その版は、機械で確かめました**。commit `65b3622`（`Add Zenodo and citation metadata`、
2026-09-05）は researcher-profile の履歴に実在します。`check_ecosystem.js` が当たっています。

**残っているのは、概念 DOI か、もう一つの版 DOI かの区別です**。Zenodo が概念 DOI と
版 DOI に連番を振ることがあるので、`...691` が概念 DOI である可能性は高い。だが
Zenodo にも Software Heritage にもこの作業環境から出られないので、そこは確かめていません。
上の Software Heritage の中身は、利用者から受け取ったものです（`証言`）。

到達できるようになったら、次のどちらかにします。

- 概念 DOI であれば、その旨を一語添える
- 版 DOI であれば、どの版かを書く

推測で直しません。

`10.5281/zenodo.22765695` も同じ形で未確認です。`solitary-school` の番号として
利用者から受け取りました。**概念 DOI か版 DOI かは確かめていません**。Zenodo へ出られません。

同じ日に `10.5281/zenodo.22765621` も作られ、利用者が消しました。消えたことも確かめていません。
この一覧には載せません。載せれば、実在する番号として引かれる余地が残ります。

## 別の所在にある同一本文

正本は Zenodo です。片方だけを直すと食い違います。

| 論文 | 正 | 別の所在 |
| --- | --- | --- |
| The Nobility and Exemplarity of the Celibate Individual | `10.5281/zenodo.22058254` | SSRN `10.2139/ssrn.7358779`、PhilArchive `NEMTNA`、HAL `hal-05758942` |
| Manifesto of Imperial Selfhood | `10.5281/zenodo.22057583` | SSRN `10.2139/ssrn.7358818`、PhilArchive `NEMMOI`、HAL `hal-05758968` |
| Fragmentarian Spiritual Individualism | `10.5281/zenodo.22064241` | PhilArchive `NEMFSI` |
| Trinity-Infinity Series II 改訂版 | `10.5281/zenodo.22058777` | SSRN `10.2139/ssrn.7446961`、HAL `hal-05759064` |
| A Naval Gazette Entry for Lieutenant Otani Tsune | `10.5281/zenodo.22055709` | SSRN `10.2139/ssrn.7449338`、Knowledge Commons `q36z2-98e12`、HAL `hal-05759080` |

## 第三者の SSRN DOI

著者のものではありません。引用している他人の論文です。書き換えません。

| DOI | 文献 | 所在 |
| --- | --- | --- |
| `10.2139/ssrn.2477899` | Barocas & Selbst, "Big Data's Disparate Impact" (2016) | `justice-and-algorithms/docs/issues/disparate-impact.md` |
| `10.2139/ssrn.3063289` | Wachter, Mittelstadt & Russell, "Counterfactual Explanations without Opening the Black Box" (2018) | `justice-and-algorithms/docs/issues/explainability.md` |

## 実在しない番号

道具の見本と試験に使っています。検索に拾われても中身はありません。

| DOI | 所在 |
| --- | --- |
| `10.5281/zenodo.00000001` | `errata-check/examples/minimal/` |
| `10.5281/zenodo.00000002` | 同上、および `errata-check/README.md` |
| `10.5281/zenodo.99999999` | `errata-check/tests/check_tool.py` |
| `10.5281/zenodo.1` | `doi-index-check/verification/check_tool.js`。DOI の斜線を潰さないことを見る |

## DOI を持たないもの

| リポジトリ | 状態 |
| --- | --- |
| `self-correction` | **無い**。訂正の記録の正本として全リポジトリから指されているのに、引用できる識別子を持っていない |
| `trinity-infinity` | 無い。三本の論文の DOI を参照する容れ物である |
| `autonomy-and-self-cultivation` | 同上 |
| `naval-gazette-notes` | 同上 |
| `trinity-operator` | 無い |
| `cpsbvbng26-dotcom` | 無い |

DOI を付けるには Zenodo での操作が要ります。それは利用者が行います。
DOI が付くまでの間、恒久的な識別子が要るなら Software Heritage の SWHID がある
（アカウント不要、費用なし）。

---

**関連** —— どれを正とするかは [canonical-sources.md](canonical-sources.md) に固定してあります。
