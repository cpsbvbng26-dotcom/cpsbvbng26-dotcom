# DOI の一覧

**この一覧は、リポジトリ内部の記述から起こしたものである。**作業環境から
`zenodo.org` にも `doi.org` にも DataCite にも届かないため、**Zenodo 側の実体は
確かめていない。**確かめていないものは「未確認」と書く。番号を当てにいかない。

`check_ecosystem.js` が、この一覧と実際にリポジトリに出てくる番号を突き合わせる。
片方にしか無い番号があれば落ちる。

---

## 著者自身の Zenodo DOI

| # | DOI | 何か | 状態 |
| --- | --- | --- | --- |
| 1 | `10.5281/zenodo.17173703` | Trinity-Infinity 初版（2025年10月） | **引用してはいけない。**この系列が訂正の対象としているもの。レコードは生きたまま |
| 2 | `10.5281/zenodo.22055709` | A Naval Gazette Entry for Lieutenant Otani Tsune | 現行。史料ノートであり論文ではない |
| 3 | `10.5281/zenodo.22057583` | Manifesto of Imperial Selfhood | 現行（改訂版 2026年8月） |
| 4 | `10.5281/zenodo.22058254` | The Nobility and Exemplarity of the Celibate Individual | 現行（v2 2026年8月） |
| 5 | `10.5281/zenodo.22058624` | Trinity-Infinity Series I 改訂版 | **現行。Series I はこの番号で引く** |
| 6 | `10.5281/zenodo.22058777` | Trinity-Infinity Series II 改訂版 | 現行 |
| 7 | `10.5281/zenodo.22058964` | Trinity-Infinity Series III | 現行 |
| 8 | `10.5281/zenodo.22064241` | Fragmentarian Spiritual Individualism | 現行 |
| 9 | `10.5281/zenodo.22335676` | 正義論とアルゴリズム | 現行。論点の整理であり研究成果ではない |
| 10 | `10.5281/zenodo.22335691` | **未確認** | 下の「未確認の番号」を見ること |
| 11 | `10.5281/zenodo.22335692` | researcher-profile v1.0.0 | 現行 |
| 12 | `10.5281/zenodo.22649054` | errata-check v0.1.0 | 旧版。**だが消してはいけない**（下記） |
| 13 | `10.5281/zenodo.22649899` | errata-check v0.2.0 | 現行 |

## 一括置換してはいけない二つ

**`17173703` を消さない。**この番号は「訂正の対象」として指すために置いてある。
消すと、何を訂正したのかが分からなくなる。Series II と III の参考文献欄は、
改訂版を指すつもりでこの番号を印字している（`trinity-infinity/ERRATA.md` の E1）。
紙面は直せない。

**`22649054` を `22649899` に置換しない。**`trinity-infinity/verification/errata_check.py`
は v0.1.0 を写したものである。番号だけ新しくすると、写した実物と食い違う。
`check_ecosystem.js` が、写した版と書いてある DOI の対応を当たっている。

## 未確認の番号

`10.5281/zenodo.22335691` は `researcher-profile/README.md` の Software Heritage
リンクの中に一度だけ出る。他の六箇所は `22335692` である。

Zenodo が概念 DOI と版 DOI に連番を振ることがあるため、`...691` が
researcher-profile の概念 DOI である可能性はある。**確かめていない。**
Zenodo に到達できるようになったら、次のどちらかにする。

- 概念 DOI であれば、その旨を一語添える
- そうでなければ誤記なので直す

**推測で直さない。**

## 別の所在にある同一本文

正本は Zenodo である。片方だけを直すと食い違う。

| 論文 | 正 | 別の所在 |
| --- | --- | --- |
| The Nobility and Exemplarity of the Celibate Individual | `10.5281/zenodo.22058254` | SSRN `10.2139/ssrn.7358779`、PhilArchive `NEMTNA` |
| Manifesto of Imperial Selfhood | `10.5281/zenodo.22057583` | SSRN `10.2139/ssrn.7358818`、PhilArchive `NEMMOI` |

## 実在しない番号

道具の見本と試験に使っている。検索に拾われても中身は無い。

| DOI | 所在 |
| --- | --- |
| `10.5281/zenodo.00000001` | `errata-check/examples/minimal/` |
| `10.5281/zenodo.00000002` | 同上、および `errata-check/README.md` |
| `10.5281/zenodo.99999999` | `errata-check/tests/check_tool.py` |

## DOI を持たないもの

| リポジトリ | 状態 |
| --- | --- |
| `self-correction` | **無い。**訂正の記録の正本として全リポジトリから指されているのに、引用できる識別子を持っていない |
| `trinity-infinity` | 無い。三本の論文の DOI を参照する容れ物である |
| `autonomy-and-self-cultivation` | 同上 |
| `naval-gazette-notes` | 同上 |
| `trinity-operator` | 無い |
| `cpsbvbng26-dotcom` | 無い |

DOI を付けるには Zenodo での操作が要る。**それは利用者が行う。**
DOI が付くまでの間、恒久的な識別子が要るなら Software Heritage の SWHID がある
（アカウント不要、費用なし）。

---

**関連** —— どれを正とするかは [canonical-sources.md](canonical-sources.md) に固定してある。
