<div align="center">

# 根本卓哉 / Takuya Nemoto

**コンピュータサイエンス・人工知能の学習記録**

[![ORCID](https://img.shields.io/badge/ORCID-0009--0000--1406--0547-A6CE39?style=for-the-badge)](https://orcid.org/0009-0000-1406-0547)

[![検査](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/actions/workflows/verify.yml/badge.svg)](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/actions/workflows/verify.yml)

[サイト](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/)

[日本語](README.md) ｜ **English** は [README.en.md](README.en.md)

</div>

---

## 30 秒で

コンピュータサイエンスと人工知能を学びながら、**査読を受けていないプレプリント**を書いて公開している者です。

**いま一番の主張。** 自分で書いた Trinity-Infinity Series I–III は、反復 `x ← DQx + (I−D)p` が収束する条件として作用素ノルム `‖DQ‖₂ < 1` を置きました。これは十分条件であって、必要条件ではありません。収束を決めているのはスペクトル半径のほうで、`ρ(DQ) < 1` が必要十分条件です。両者が離れる領域（`ρ < 1 ≤ ‖DQ‖₂`）では収束はするものの、誤差はいったん増えてから減ります。三篇の設定では作用素が正規行列になり `ρ = ‖DQ‖₂` が成り立つため、この区別が表に出ませんでした。新しい数学ではありません —— 非正規行列の過渡的増幅も、収束条件が `ρ < 1` であることも、数値線形代数の標準的な事実です。主張は一点だけです。**三篇が置いた仮定は、必要以上に強い。**

**覆すには。** 次のどちらか一つを出してください。(1) `ρ(A) < 1` なのに、ある初期値から収束しない `A` と `b`。(2) `ρ(A) ≥ 1` なのに、すべての初期値から一意の点に収束する `A` と `b`。[作用素のページ](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html)に打ち込めば、その場で判定が出ます。

### 証明できたこと / 類推に過ぎないこと / 撤回したこと

| | |
| --- | --- |
| **証明できたこと** | 座標の置換と固定基準点への統合を合成した作用素は縮小写像であり、唯一の不動点へ幾何的に収束する。Series I が三要素・一様な混合率で証明し、II が混合率を座標ごとに変えても成り立つことを示し、III が**そもそも三要素である必要がなかった**こと（任意の n ≥ 2）を示した。これに、上の訂正が加わる |
| **類推に過ぎないこと** | 上記以外のすべて。ゲーム理論・論理学・工学への接続は、他分野の既知の結果を正しく計算した実例か、類推・未証明の推測として明示的に印をつけたもののどちらかである。n = 3 が区別されるのは「巡回置換がそれ自身の逆写像にならない最小の n」という一点だけで、Series III はそれが「三」の文化的・哲学的な含意を正当化しないことを明示的に否定している |
| **撤回したこと** | 収束定理の原型（不動点が一意にならない読みだった）、「98.7% の試行で確認」（再現できるコードも乱数種もない）、三人ゲームの利得表（4 セルでは 2³ 通りを表現できない）、リアプノフ微分と LaSalle の原理の適用、AI アライメント・気候政策・ガバナンスへの応用。**各論文が同梱を謳う検証スクリプトは存在しない**（著者確認済み。[ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md) の E3）。**どれも消していません** |

哲学の三篇はこの形で反証できる種類のものではありません。査読も受けていません。読んで反論する以外の道はなく、それでよいと考えています。

### 次に読むなら、この 3 つ

1. **[trinity-infinity / ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md)** —— 三篇の何が誤っていて、何が撤回されたか。読者が誤った版に辿り着く誤りが 1 件ある
2. **[trinity-operator / README.md](https://github.com/cpsbvbng26-dotcom/trinity-operator/blob/main/README.md)** —— 上の主張の実装と反例。検査 22 項目、乱数種は固定
3. **[trinity-infinity / pdf/trinity-infinity-series-iii.pdf](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/pdf/trinity-infinity-series-iii.pdf)** —— 系列が自分で何を確立し、何を撤回したかを書いた回顧

> **公開しているものは、すべて査読を受けていません。** 学術誌にも会議にも通していません。DOI があることは、査読を受けたことを意味しません。

このサイトのトップも、この核だけが見えるようにしてあります。哲学の三篇・史料ノート・修了証・外部プロフィールは、消さずに [ノート](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/notes/index.html) に移してあります。

以下は一覧です。急がないなら読んでください。

---

✴︎Papers✴︎

いずれも査読前のプレプリントです。哲学の三篇は全文と PDF を [autonomy-and-self-cultivation](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation) に、Trinity-Infinity の三篇は [trinity-infinity](https://github.com/cpsbvbng26-dotcom/trinity-infinity) に置いています。史料ノートを含め、DOI のあるものは Zenodo が正です。

| 論文 | 内容 | 版 | DOI |
| --- | --- | --- | --- |
| [The Nobility and Exemplarity of the Celibate Individual](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/celibate-individual.md) | 性的活動を倫理的な義務とみなす通説を反出生主義の側から検討し、自足的な幸福という観点から独身を自己陶冶の型として擁護する | v2 — 2026年8月 | [10.5281/zenodo.22058254](https://doi.org/10.5281/zenodo.22058254)<br>SSRN [10.2139/ssrn.7358779](https://doi.org/10.2139/ssrn.7358779) |
| [Manifesto of Imperial Selfhood](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/imperial-selfhood.md) | 断片化した自己の統合を、カントの立法・ニーチェの価値転換・ユンガーの動員という三層で捉える | 改訂版 — 2026年8月 | [10.5281/zenodo.22057583](https://doi.org/10.5281/zenodo.22057583)<br>SSRN [10.2139/ssrn.7358818](https://doi.org/10.2139/ssrn.7358818) |
| [Fragmentarian Spiritual Individualism](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/fragmentarian-spiritual-individualism.md) | 断片化を修復すべき傷とみなさず、そこに住まうための規律を組み立てる | 2026年8月 | [10.5281/zenodo.22064241](https://doi.org/10.5281/zenodo.22064241) |
| [A Naval Gazette Entry for Lieutenant Otani Tsune（大谷恒）](https://doi.org/10.5281/zenodo.22055709) | アジア歴史資料センターが公開する海軍公報から叙勲記録一件を翻刻し、史料で確定できることとできないことを切り分ける | — | [10.5281/zenodo.22055709](https://doi.org/10.5281/zenodo.22055709) |
| [Trinity-Infinity Framework, Series I](https://doi.org/10.5281/zenodo.22058624) | 三要素の再帰作用素が一意の不動点へ幾何収束することを証明し、ゲーム理論・論理学・工学への接続を、証明済みの結果・既知の結果・類推に区別して示す。 | 改訂版 — 2026年8月 | [10.5281/zenodo.22058624](https://doi.org/10.5281/zenodo.22058624) |
| [Trinity-Infinity Framework, Series II](https://doi.org/10.5281/zenodo.22058777) | 混合率を座標ごとに変えても不動点の一意性が保たれることを示し、均衡利得集合の特徴づけとばね系の完全な計算例を加える。 | 改訂版 — 2026年8月 | [10.5281/zenodo.22058777](https://doi.org/10.5281/zenodo.22058777) |
| [Trinity-Infinity Framework, Series III](https://doi.org/10.5281/zenodo.22058964) | 収束定理が三要素を必要としないこと（任意の n ≥ 2 で成立）を示し、この系列が何を確立し、何を撤回したかを回顧する。 | 2026年8月 | [10.5281/zenodo.22058964](https://doi.org/10.5281/zenodo.22058964) |

> **Series I についての注記。** Series II と III は、改訂版の Series I を指すつもりで `10.5281/zenodo.17173703` を引いています。これは**この系列が訂正した 2025 年の初版**の DOI です。改訂版は `10.5281/zenodo.22058624` です。[ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md) を見てください。**撤回した内容は消していません。**

---

✴︎Works✴︎

| リポジトリ | 内容 | ライセンス | DOI |
| --- | --- | --- | --- |
| [DOI アナライザー](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/doi.html) | DOI の書式検証、接頭辞からの登録者の推定、**索引先の一覧（索引 / 発見 / API に分けて 20 件）**、CrossRef / DataCite への照会、**ORCID iD の検査と業績の読み込み**、BibTeX などへの書き出し。**大小の別・百分率符号化・URL の素片を解いて同一視し、`<` `>` を含む DOI も正しい解決 URL にする**。このサイト内のページ | MIT | — |
| [作用素を回す](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html) | Trinity-Infinity の三篇が扱う作用素を、ブラウザの中だけで反復する。**スペクトル半径と作用素ノルムを別々に出し、収束の可否と単調減衰を分けて判定する**。固有値・特異値・連立一次方程式を外部ライブラリなしで解いている。NumPy の値と 728 件突き合わせ済み。このサイト内のページ | MIT | — |
| [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile) | 設定ファイル 1 つから研究者プロフィールの静的サイトを生成するツール | MIT | [10.5281/zenodo.22335692](https://doi.org/10.5281/zenodo.22335692) |
| [justice-and-algorithms](https://github.com/cpsbvbng26-dotcom/justice-and-algorithms) | アルゴリズムをめぐる論点を政治哲学の正義論に接続して整理する資料 | CC BY 4.0 | [10.5281/zenodo.22335676](https://doi.org/10.5281/zenodo.22335676) |
| [autonomy-and-self-cultivation](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation) | 哲学の三篇の全文・PDF・引用情報と、読むためのサイトの生成 | CC BY 4.0 | — |
| [trinity-infinity](https://github.com/cpsbvbng26-dotcom/trinity-infinity) | Trinity-Infinity の三篇と、その検証 44 項目。何が確立され何が撤回されたかの記録と正誤 | CC BY 4.0 | — |
| [trinity-operator](https://github.com/cpsbvbng26-dotcom/trinity-operator) | 上の三篇の作用素を、置換にも一様な係数にも限らずに実装。収束を決めるのはスペクトル半径であり、三篇の作用素ノルム条件は必要以上に強い。検査 22 項目 | MIT | — |
| [naval-gazette-notes](https://github.com/cpsbvbng26-dotcom/naval-gazette-notes) | 史料ノートの翻刻を機械可読にしたデータ。「同」で繰り返された階級を、書かれていたものと引き継いだもので区別している | CC BY 4.0 | — |

---

✴︎Credentials✴︎

<details>
<summary>修了証・オープンバッジ 計 7 件（各バッジは発行機関の検証ページに繋がります）</summary>

**edX**（4 件）

[![CC0201EN: Introduction to Containers, Kubernetes and OpenShift](https://img.shields.io/badge/edX-CC0201EN%20Containers%2C%20Kubernetes%20%26%20OpenShift-02262B?style=for-the-badge)](https://courses.edx.org/certificates/09bd51313ed94fdd8b694164f6745316)

[![CS50AI: Introduction to Artificial Intelligence with Python](https://img.shields.io/badge/edX-CS50AI%20Artificial%20Intelligence%20with%20Python-02262B?style=for-the-badge)](https://courses.edx.org/certificates/a746620b6d7d45b583cb41b125e5f807)

[![CS50x: Introduction to Computer Science](https://img.shields.io/badge/edX-CS50x%20Introduction%20to%20Computer%20Science-02262B?style=for-the-badge)](https://courses.edx.org/certificates/eac0a01d3d424a32a00114c487288fbc)

[![ER22.1x: Justice](https://img.shields.io/badge/edX-ER22.1x%20Justice-02262B?style=for-the-badge)](https://courses.edx.org/certificates/7584800e9d0048fd94d5d6b1720256b3)

**東北大学 MOOC / オープンバッジ**（3 件）

[![Tohoku University MOOC: Radiation Safety](https://img.shields.io/badge/Tohoku%20University%20MOOC-Radiation%20Safety-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/N3dGdVhFTUFNaDd5Z1ZhT2VxYWVaZz09)

[![Tohoku University MOOC: Disaster Science](https://img.shields.io/badge/Tohoku%20University%20MOOC-Disaster%20Science-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/NElCQ3c1Nng0L0JZYlNNSFZ2aVNPUT09)

[![Tohoku University MOOC: Mystery of Aurora](https://img.shields.io/badge/Tohoku%20University%20MOOC-Mystery%20of%20Aurora-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/cDB4elE1ejd1UDBLZGx6d1NWV2Y5Zz09)

<!-- 新しい修了証を追加するときは、上のいずれかのグループに 1 行足してください。
     [![講座名](https://img.shields.io/badge/発行元-講座名-色?style=for-the-badge)](検証ページのURL) -->

</details>

---

✴︎Areas✴︎

| 領域 | 内容 |
| --- | --- |
| コンピュータサイエンス | C / Python、アルゴリズムとデータ構造、計算量の考え方 |
| 人工知能 | 探索、知識表現、確率推論、最適化、機械学習、ニューラルネットワーク、自然言語処理 |
| コンテナ基盤 | Docker、Kubernetes、OpenShift の基本概念と操作 |
| Web 開発 | HTML / CSS / JavaScript による実装、GitHub Pages での公開と運用 |
| 領域知識 | 放射線安全、災害科学、政治哲学 |

---

✴︎Links✴︎

<details>
<summary>外部のプロフィールと記事（正は ORCID と Zenodo です）</summary>

- ホームページ — [nemoto200101.com](https://www.nemoto200101.com/)
- researchmap — [プロフィール](https://researchmap.jp/takuyanemoto) / [研究ブログ](https://researchmap.jp/takuyanemoto/research_blogs)
- PhilPeople — [哲学者プロフィール](https://philpeople.org/profiles/takuyanemoto)
- HAL — [欧州拠点研究者プロフィール](https://cv.hal.science/nemoto-takuya)
- acadmc — [アカデミックプロフィール](https://acadmc.com/takuyanemoto)
- J-GLOBAL — [研究者データベース](https://jglobal.jst.go.jp/detail?JGLOBAL_ID=202601016349119335)
- ORCID — [0009-0000-1406-0547](https://orcid.org/0009-0000-1406-0547)
- Google Scholar — [論文データベース](https://scholar.google.com/citations?user=_HEl3dYAAAAJ&hl=ja)
- SSRN — [論文リポジトリ](https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=8730280)
- LinkedIn — [職務プロフィール](https://jp.linkedin.com/in/%E5%8D%93%E5%93%89-%E6%A0%B9%E6%9C%AC-62b9093a0)
- Medium — [記事一覧](https://medium.com/@heaven_livid_frog_333/lists)
- このサイト — [cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/)

</details>

---

✴︎Verification✴︎

このリポジトリは、**push のたびに 111 項目の検査を通します。** 依存パッケージはありません。

```
node verification/check_site.js   # サイトの構造 35 項目
node verification/check_doi.js    # DOI アナライザー 76 項目
```

**`check_site.js`** が拾うのは、直したつもりで直っていない類の食い違いです。内部リンクの切れ、読み込み時に外部を取りに行く要素の混入、JSON-LD の `hasPart` が存在しない資料を指すこと、sitemap と実ファイルのずれ、日本語版と英語版のカード数や README の食い違い、`doi.js` が既知以外のホストへ通信すること。

いちばん効くのは **「論文カードの DOI と、まとめて解析リンクの DOI が一致すること」** です。論文を足してリンクを直し忘れる、が最も起きやすい破綻なので、そこを機械で押さえています。

**外部リクエストを出さないことは、CSP でブラウザに強制させています。** 「そう書いてある」だけでは、注入された 1 行を止められません。

```
default-src 'none'; script-src 'self' 'sha256-…'; style-src 'sha256-…';
img-src 'self' data:; connect-src <照会先 6 ホスト>; form-action 'none'; base-uri 'none'
```

**`unsafe-inline` は使っていません。** インラインの `<style>` と `<script>` は SHA-256 のハッシュで名指しして許しています。中身を書き換えるとハッシュが変わるので、[`verification/update_csp.js`](verification/update_csp.js) で入れ直します。**入れ忘れると検査が落ち、ブラウザもそのスクリプトの実行を拒みます。**

実際に何が止まるかは、攻撃を模して確かめました。

| | |
| --- | --- |
| 外部スクリプトの読み込み | 止まる |
| 注入したインラインスクリプトの実行 | 止まる |
| 許可していないホストへの `fetch` | 止まる |
| 外部画像（追跡用）の読み込み | 止まる |
| 注入したインライン `style` | 止まる |
| 許可したホスト（`api.crossref.org`） | 通る |

**正の URL がひとつであること**も見ています。このサイトの正は GitHub Pages です。別の配信先を指す URL が混ざると、検索エンジンにも読者にも二つの版があるように見えます。`canonical` と `og:url` の食い違いも落とします。

**`check_doi.js`** は DOI アナライザーの純粋な関数を、ブラウザを起こさずに検査します。正規化・抽出・ORCID のチェックディジット（ISO 7064 MOD 11-2）・掲載元 URL の組み立て・API 応答の解釈。応答の解釈は、記録した形の JSON を流し込んで確かめています。

**空振りでないことは確認済みです。** 論文カードの DOI 書き換え、外部 script の混入、存在しないページへのリンク、`hasPart` の不整合、sitemap のずれ —— 五通り壊して五通りとも落ちました。

**検査していないものもあります。** DOI アナライザーが CrossRef・DataCite・OpenAlex・Semantic Scholar・ORCID に照会したときの、**応答が返ってきた場合の表示**です。制作環境からこれらの API に到達できないため、記録した形の JSON を流し込む形でしか確かめていません。**実際の応答とずれていれば、表示が崩れます。** 通信できなかった場合の動作（理由を表示してボタンが戻る）は確認済みです。

---

✴︎License✴︎

このリポジトリは二種類のものを含んでいるので、ライセンスも二つに分けています。

| | ライセンス | |
| --- | --- | --- |
| **文章・構造化データ** —— プロフィールの本文、論文と制作物の説明、`README.md` と `README.en.md`、JSON-LD | [CC BY 4.0](LICENSE) | 出典を示せば、改変も含めて自由に使えます |
| **サイトの実装** —— `index.html` / `index.en.html` / `research.html` / `doi.html` / `doi.js` / `404.html` / `theme.js` のマークアップ・スタイル・スクリプト、および `verification/` の検査スクリプト | [MIT](LICENSE-CODE) | [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile)（MIT）から起こしたものです |

© 2026 根本卓哉（Takuya Nemoto）

**リンク先の各リポジトリと各プレプリントは、それぞれのライセンスに従います。**
一覧の ✴︎Works✴︎ 欄と、各リポジトリの `LICENSE` を参照してください。

---

✴︎Tools & Disclosure✴︎

このリポジトリは [Claude Code](https://claude.com/claude-code) を使って書いています。監査には [Grok](https://grok.com) を使いました。

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?style=for-the-badge)](https://claude.com/claude-code)
[![Assisted by Grok](https://img.shields.io/badge/Assisted%20by-Grok-4B5563?style=for-the-badge)](https://grok.com)

本リポジトリのサイト実装（`index.html` / `index.en.html` / `research.html` / `doi.html` / `doi.js` / `404.html` / `theme.js`）は、AIコーディング支援ツール **Claude Code**（Anthropic）を使用して制作しています。公開する文章の言い回しについて、**Grok**（xAI）に候補を出させました。設計・内容の確認および最終的な判断は、著者・根本卓哉（Takuya Nemoto）が行っています。AI は著作者ではありません。

**制作過程の記録** — 表明だけではなく、リポジトリの履歴そのものから確認できます。

| 確認できること | 方法 |
| --- | --- |
| Claude による支援コミット | `git log --author=Claude` |
| Claude の作業セッション | コミットメッセージ末尾の `Claude-Session:` トレーラ |
| Grok による支援コミット | コミットメッセージ末尾の `Assisted-by: Grok` トレーラ |
| 共同作成の記録 | コミットメッセージ末尾の `Co-authored-by:` トレーラ |
| 変更の意図と検証内容 | 各プルリクエストの本文（何を確認したかを記載） |

コミットの著者名・トレーラ・プルリクエストの本文はいずれも履歴に固定されており、あとから表示だけを取り繕うことはできません。
