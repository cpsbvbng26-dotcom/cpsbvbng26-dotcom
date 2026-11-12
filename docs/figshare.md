# Figshare に出すものの水準

Figshare に何を出し、何を出さないかの決まりです。
もとは CLAUDE.md の決めごと 15 です。2026-10-13 に決めました。
Figshare に出すのは、researchmap の MISC に載せられる水準のものに限ります。

## 出すもの

次のすべてを満たすものだけを出します。

- 一つの稿として完結していること。題、著者、要旨、本文、参考文献があります。
- researchmap の MISC の欄に、題・著者・公開した日・DOI を書いて載せられること。
- 学部一年次の成果か、その続きか、その修正であること。黄金比の窓の予想の続きは、これに入ります。新しい主題は出しません。
- 著者に ORCID iD が付いていること。
- 言語モデルの使い方を、紙面か記録の欄に開示していること。Claude を著者にしません。
- ライセンスが CC BY 4.0 であること。コードを添えるなら MIT です。

## 出さないもの

- 作業の途中の覚書、検査の結果の表、データだけの束。これらは GitHub に置き、版を Zenodo に保存します。
- 同じ本文がすでに Zenodo にあるもの。正本が二つになり、片方だけ直すと食い違います。
- 費用が掛かる出し方。掲載料・投稿料・有料の機能を使いません（決めごと 14）。

## いま Figshare にあるもの

| 稿 | DOI | 出した日 |
| --- | --- | --- |
| Repeated Games through a Cyclic Operator: A Golden-Ratio Threshold, Fractal Payoff Sets, and the Golden-Window Conjecture | `10.6084/m9.figshare.34419198` | 2026-10-13 |

trinity-operator の games のノートを、英語の論文の形にしたものです。
ノートのほうは GitHub にあり、DOI を持ちません。
この稿の正本は Figshare です（[canonical-sources.md](canonical-sources.md)）。
`check_ecosystem.js` が、この表の DOI と [doi-index.md](doi-index.md) の Figshare の番号を突き合わせます。

## 出す前に確かめること

1. 上の「出すもの」の条件を、一つずつ確かめます。
2. 同じ本文が Zenodo やほかの置き場に無いことを、[doi-index.md](doi-index.md) で確かめます。
3. 出したら、受け取った DOI を doi-index.md の表と、この頁の表に足します。番号を推測して書きません。
