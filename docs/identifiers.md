# 識別子の使い分け

同じ作品に、いくつもの番号が付いています。
この頁は、どの番号が何を指し、何に使うかを並べたものです。
番号そのものの一覧は [doi-index.md](doi-index.md) にあります。
写しが食い違ったときにどれが勝つかは [canonical-sources.md](canonical-sources.md) が決めています。

| 識別子 | 指すもの | 使うところ |
| --- | --- | --- |
| Zenodo の版の DOI（`10.5281/zenodo.…`） | 作品か、リポジトリのある版 | 引用。論文は Zenodo の DOI で引きます |
| Zenodo の概念 DOI | 同じ作品のすべての版 | いちばん新しい版へ案内したいとき |
| OSF のプロジェクトの DOI（`10.17605/osf.io/…`） | ばらばらの置き場を束ねるプロジェクト | 入口として示すとき。論文の引用には使いません |
| SSRN の DOI（`10.2139/ssrn.…`） | Zenodo と同じ本文の写し | 写しの所在として示すとき |
| Figshare の DOI（`10.6084/m9.figshare.…`） | Zenodo に置いていない本文の正本 | その本文を引くとき |
| PhilArchive の記号（`NEM…`） | 写し。DOI ではありません | 写しの所在として示すとき |
| ORCID iD | 著者 | 著者を同姓同名の別人と分けるとき |
| Wikidata の項目（`Q…`） | 著者か作品の、Wikidata の項目 | 構造化データの `sameAs` で、同じ人や作品だと示すとき。引用には使いません |

## Zenodo

Zenodo の DOI は、版を固定した保存の記録を指します。
論文の PDF と書誌の正本は Zenodo です。
引用には、版の DOI を使います。
概念 DOI は、すべての版をまとめた番号で、いちばん新しい版へ案内します。

## OSF

OSF の DOI は、プロジェクトを指します。
プロジェクトは、論文・リポジトリ・記録を一つにまとめる入口です。
中身の版は固定しません。
論文を引くときに OSF の DOI を使いません。
計画は [osf.md](osf.md) にあります。

## SSRN・Figshare・PhilArchive

SSRN と PhilArchive にあるのは、Zenodo と同じ本文の写しです。
Zenodo の記録から、IsIdenticalTo の関係でつないであります（[identical-copies.md](identical-copies.md)）。
片方だけを直すと食い違うので、正本は Zenodo のままです。

Figshare にある本文は、Zenodo に置いていません。
その本文の正本は Figshare です。
Figshare に出すものの水準は [figshare.md](figshare.md) にあります。

どれが写しで、どれが正本かは [canonical-sources.md](canonical-sources.md) に固定してあります。

## Wikidata

Wikidata の項目は、人や作品についての記述の束です。
本文も版も持ちません。
引用には使いません。

サイトの構造化データは、2026-11-16 から Wikidata の項目を指しています。
2026-11-16 に利用者が求め、Claude が書きました。
人物の項目 `Q139590485` は、トップの頁の五つの言語の Person の `sameAs` にあります。
同じ項目は、CV の頁の研究者プロフィールの欄にも出ています。
作品の項目は、その作品の頁があるものだけを指しています。
独身論の項目 `Q142184034`、皇帝主義の項目 `Q142184151`、断章論の項目 `Q142184207` が、その作品の `sameAs` にあります。
置いた先は、ノートの頁、要点の頁、論文の頁の構造化データです。
Machine-mediated Rediscovery の項目 `Q142184237` は、このサイトに頁が無いので、どこにも置いていません。
生成もとは `researcher-profile` の設定で、`check_build.js` の 3h がこの置き方を固めています。
項目の中身は [name-disambiguation.md](name-disambiguation.md) の「Wikidata」の節にあります。
