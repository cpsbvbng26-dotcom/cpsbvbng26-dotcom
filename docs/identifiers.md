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
