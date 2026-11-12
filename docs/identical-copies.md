# Zenodo と SSRN の同一本文のつなぎ

Zenodo の記録と、同じ本文の SSRN の写しとのつなぎ（IsIdenticalTo）の記録です。
組は [doi-index.md](doi-index.md) の「別の所在にある同一本文」の表から取りました。
`check_ecosystem.js` が、この表の組と doi-index の表の組を突き合わせます。

| Zenodo | SSRN | 題 | 2026-11-12 の DataCite |
| --- | --- | --- | --- |
| `10.5281/zenodo.22058254` | `10.2139/ssrn.7358779` | The Nobility and Exemplarity of the Celibate Individual | つないである |
| `10.5281/zenodo.22057583` | `10.2139/ssrn.7358818` | Manifesto of Imperial Selfhood | つないである |
| `10.5281/zenodo.22058777` | `10.2139/ssrn.7446961` | Trinity-Infinity Series II 改訂版 | つないである |
| `10.5281/zenodo.22055709` | `10.2139/ssrn.7449338` | A Naval Gazette Entry for Lieutenant Otani Tsune | つないである |

2026-11-12 に DataCite の記録を読むと、4 組とも Zenodo の記録に IsIdenticalTo の関係が入っていました。
足すものはありません。

これからは deposit-check が見張ります。
同じ本文の写しがあるのに IsIdenticalTo でつないでいない記録を、identical-unlinked の規則で知らせます。

同じ記録には、PhilArchive と Knowledge Commons の写しと、Sophaxis の記録の頁も、IsIdenticalTo の関係で URL として入っています。
こちらは DOI ではないので、上の表には入れていません。

新しく SSRN に載った本文があれば、doi-index の表とこの表に同じ組を足します。
