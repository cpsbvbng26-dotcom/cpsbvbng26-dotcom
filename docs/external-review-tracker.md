# 外部の評価の指摘と対応

外部の評価で挙がった指摘を、一つの行に一つずつ並べた表です。
評価そのものの記録は [external-evaluations.md](external-evaluations.md) にあります。
こちらは、指摘ごとに何をしたかと、いまどうなっているかだけを追います。

いま、評価 10 件から、指摘 44 件です。
`check_ecosystem.js` が、表の行の数と評価の数をこの文と突き合わせます。
external-evaluations.md の「受けた評価」の表にある評価は、すべてこの表に行を持ちます。

状態は五つのどれかです。

- 対応済み：正誤表・登録簿・紙面の外の記録・検査のどれかに入れました。
- 対応中：手を付けましたが、終わっていません。
- 未対応：まだ何もしていません。
- 採らない：当たっていても、紙面の誤りではないなどの理由で入れません。
- 外れ：指摘が当たっていません。

外部の評価は査読ではありません。
機械の出した評価も、人の評価と同じ表に並べます。種別は external-evaluations.md にあります。

| # | 評価 | 指摘 | 対応 | 状態 |
| --- | --- | --- | --- | --- |
| 1 | Grok — 記録群全体 | 電子書籍を、現行の普及版として扱った | 販売停止を示し、Grok が評価を撤回した | 外れ |
| 2 | Grok — 記録群全体 | 外したこと自体が、販売停止が登録簿の奥にしか無いことを示した | `BK-001` の題名を五つの面に出し、横断の検査で固定した | 対応済み |
| 3 | Grok — 記録群全体 | 削除が検証の道を狭める | `BK-001` に前から書いてあった | 対応済み |
| 4 | Grok — 記録群全体 | 実験なら、仮説・手続き・失敗条件が先に要る | objections.md の反論 4 に立てた | 対応済み |
| 5 | Stanford Agentic Reviewer — Series III | Banach の不動点定理と標準の文献を引いていない | `ERRATA` の E6 | 対応済み |
| 6 | Stanford Agentic Reviewer — Series III | 記号の崩れ（`P_n` の印、`10-16`） | `ERRATA` の N5 | 対応済み |
| 7 | Stanford Agentic Reviewer — Series III | `exact for n=2,3` の書き方 | `ERRATA` の N6 と `claims_audit.py` | 対応済み |
| 8 | Stanford Agentic Reviewer — Series III | 異方性版の一般の式、ノルム、等号、`isometry error` の定義 | `ERRATA` の N7 | 対応済み |
| 9 | Stanford Agentic Reviewer — Series III | 任意の直交行列へ広げられる | 紙面の誤りではないので、正誤表に入れない | 採らない |
| 10 | Stanford Agentic Reviewer — Series III | `isometry error` の 0 は丸めではないか | 置換行列なので厳密に 0 である | 外れ |
| 11 | Stanford Agentic Reviewer — Series I | 部分ゲーム完全性の確かめが詳しくない | `ERRATA` の N8 ① | 対応済み |
| 12 | Stanford Agentic Reviewer — Series I | Neumann 級数などの標準の文献を引いていない | `ERRATA` の E6 の一部 | 対応済み |
| 13 | Stanford Agentic Reviewer — Series I | `I − αP` が逆を持つ理由を書いていない | `ERRATA` の N8 ② | 対応済み |
| 14 | Stanford Agentic Reviewer — Series I | 一般の ℓᵖ への拡張、自己言及版の代数での書き方、題が射程より広い | 紙面の誤りではない。凍結した題は変えない | 採らない |
| 15 | Stanford Agentic Reviewer — Series I | 「a」と「α」の誤植がある | そのような箇所は無い。登録簿の `EX-005` | 外れ |
| 16 | Stanford Agentic Reviewer — Series II | `(DP)³ = (∏aᵢ)I` で、漸近の率は幾何平均である | `ERRATA` の N9 と `independent_check.py` | 対応済み |
| 17 | Stanford Agentic Reviewer — Series II | 凸包を実現できる集合とするには、公開の乱択か時間平均が要る | `ERRATA` の N10 | 対応済み |
| 18 | Stanford Agentic Reviewer — Series II | `V(x)` の添字と、級数の `+☐` が読めない | 抽出の崩れか紙面の崩れか区別できない。登録簿の `TI-011` | 対応中 |
| 19 | Stanford Agentic Reviewer — Series II | 利得表の自己完結、閉形式、`d` 次元への拡張 | 紙面の誤りではない。`d` 次元は Series III が扱う | 採らない |
| 20 | Stanford Agentic Reviewer — Manifesto of Imperial Selfhood | Jünger の総動員が、反照性だけという制約と噛み合わない | 妥当。足りないものの指摘で、紙面の誤りではない | 採らない |
| 21 | Stanford Agentic Reviewer — Manifesto of Imperial Selfhood | 目的の王国を内心へ移すのに、Korsgaard らを踏まえていない | 妥当。参考文献欄に無いことを確かめた。紙面は直さない | 採らない |
| 22 | Stanford Agentic Reviewer — Manifesto of Imperial Selfhood | 一つの層の支配を防ぐ理由を示していない | 妥当。紙面は直さない | 採らない |
| 23 | Stanford Agentic Reviewer — The Nobility and Exemplarity of the Celibate Individual | 避妊が、生殖と性行為を切り離す | `ERRATA` の N5 | 対応済み |
| 24 | Stanford Agentic Reviewer — The Nobility and Exemplarity of the Celibate Individual | 選んだ独身と、望まない無性や無性愛を分けていない | `ERRATA` の N6 | 対応済み |
| 25 | Stanford Agentic Reviewer — The Nobility and Exemplarity of the Celibate Individual | 人口倫理と潜在能力の議論（Parfit、Arrhenius、Sen、Nussbaum）を踏まえていない | 紙面の誤りではないので数えない | 採らない |
| 26 | Stanford Agentic Reviewer — Fragmentarian Spiritual Individualism | 物語的自己の論の相手（Strawson、Ricœur、MacIntyre、Taylor など）を挙げていない | `ERRATA` の N8。無いことは `audit.toml` が確かめる | 対応済み |
| 27 | Stanford Agentic Reviewer — Fragmentarian Spiritual Individualism | 武士道の歴史性にもっと踏み込め | 紙面は踏み込んでいる。周りを当たって `ERRATA` の E9 を出した | 外れ |
| 28 | Stanford Agentic Reviewer — Fragmentarian Spiritual Individualism | arXiv の七つの番号を引け | 分野の外で、こちらから確かめられない。引かない | 採らない |
| 29 | Stanford Agentic Reviewer — Fragmentarian Spiritual Individualism | 実験による確かめが要る | 概念の論文には当たらない | 外れ |
| 30 | Stanford Agentic Reviewer — 海軍公報の史料ノート | 四等を二通りに訳している | `ERRATA` の E4 | 対応済み |
| 31 | Stanford Agentic Reviewer — 海軍公報の史料ノート | 読みが立たないと述べながら、表題が読みを与えている | `ERRATA` の E5 | 対応済み |
| 32 | Stanford Agentic Reviewer — 海軍公報の史料ノート | `(通牒各)` に訳を添えていない | `ERRATA` の E6 | 対応済み |
| 33 | Stanford Agentic Reviewer — 海軍公報の史料ノート | 影印、IIIF、第二の転写者、前後の号で裏を取れ | 規則・人・届かないの理由ごとに `ERRATA` の N4 に置いた | 採らない |
| 34 | Stanford Agentic Reviewer — 海軍公報の史料ノート | 記録連結やくずし字の研究と比べよ | 原資料は 20 世紀の活字で、当たらない | 外れ |
| 35 | Grok — 先祖の頁の違法性の点検 | 頁が「戸籍等では突合していない」と書いている | 古い版を読んでいる | 外れ |
| 36 | Grok — 先祖の頁の違法性の点検 | 別の媒体と、続柄・階級の確度が食い違う | canonical-sources.md に媒体間の節を足し、登録簿の `ST-004` に開いたまま置いた | 対応中 |
| 37 | Grok — 先祖の頁の違法性の点検 | 今後足してはいけないものの一覧（戸籍、本籍、存命の親族の情報など） | 決めごと 9 と重ねて扱う | 対応済み |
| 38 | ChatGPT — Sophaxis（2026-11-12） | 運営が一人に頼っている。助言者と後を継ぐ人が要る | Sophaxis の側で、助言者の案と、運営者が動けないときの手順を用意している | 対応中 |
| 39 | ChatGPT — Sophaxis（2026-11-12） | 運営者以外の著者がまだいない | まだ何もしていない | 未対応 |
| 40 | ChatGPT — Sophaxis（2026-11-12） | モデレーションは品質の保証ではない。寄託・掲載・査読を分けて見せる | Sophaxis の #211 で分けて見せた | 対応済み |
| 41 | ChatGPT — Sophaxis（2026-11-12） | 認知が限られる。ROAR と OAD には載り、DOAPR と PhilPapers は待ち | DOAPR は月に一度の索引の調べが申請の issue を見る。PhilPapers は利用者が確かめる | 対応中 |
| 42 | ChatGPT — Sophaxis（2026-11-12） | 長期の保存 | まだ何もしていない | 未対応 |
| 43 | ChatGPT — Sophaxis（2026-11-12） | 外の仕組みとのつなぎ | まだ何もしていない | 未対応 |
| 44 | ChatGPT — Sophaxis（2026-11-12） | 運営の数を出していない | まだ何もしていない | 未対応 |

ChatGPT の評価は、外からの評価の一つとして載せています。推薦ではありません。
この評価は Sophaxis についてのもので、評価の記録は Sophaxis の側に置きます。
external-evaluations.md の「受けた評価」の表には入れていません。
