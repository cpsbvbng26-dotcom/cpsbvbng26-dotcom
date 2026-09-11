<div align="center">

# 根本卓哉 / Takuya Nemoto

**コンピュータサイエンス・人工知能の学習記録**

[![ORCID](https://img.shields.io/badge/ORCID-0009--0000--1406--0547-A6CE39?style=for-the-badge)](https://orcid.org/0009-0000-1406-0547)

[![検査](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/actions/workflows/verify.yml/badge.svg)](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/actions/workflows/verify.yml)

[サイト](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/)

[日本語](README.md) ｜ **English** は [README.en.md](README.en.md)

</div>

---

<!-- 自己紹介:ここから -->

## 自己紹介

ZEN大学 知能情報社会学部 知能情報社会学科に在籍しています（秋入学一期生）。文理を横断する課程です。

大学では主に**哲学**と**実務**を学んでいます。**数学**も履修できます。修得した科目は [CV](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/cv.html) に並べてあります。この場所に置いているのは、コンピュータサイエンスと人工知能の学習です。

**これからの二つ**

- 事業を承継すること
- 博士号を取得したのち、オンライン大学で教えること

### 経歴

| | | 修得 |
| --- | --- | --- |
| 栃木県立栃木高等学校 | 中途退学 |  |
| 高等学校卒業程度認定試験規則による認定試験 | 合格 |  |
| 自由が丘産能短期大学 能率科 経営管理コース | 二年間在籍後、自主退学 | 1 科目 2 単位（2026年9月9日現在） |
| ZEN大学 知能情報社会学部 知能情報社会学科 | 在籍（秋入学一期生） | 11 科目 22 単位 —— 必修 14・選択必修 4・選択 4（2026年9月9日現在） |

### 修得した科目

**自由が丘産能短期大学 能率科 経営管理コース**

| 科目 | 区分 | 単位 |
| --- | --- | --- |
| 仕事の上手な教え方（Instructional Design） | スクーリング | 2 |

**1 科目 2 単位（2026年9月9日現在）**

**ZEN大学 知能情報社会学部 知能情報社会学科** —— これから増える。

| 科目 | 区分 | 単位 |
| --- | --- | --- |
| 人文社会入門 | 必修 | 2 |
| IT リテラシー | 必修 | 2 |
| アカデミックリテラシー | 必修 | 2 |
| デジタルツールの使い方 | 必修 | 2 |
| 多言語 IT コミュニケーション | 必修 | 2 |
| 人工知能活用実践 | 必修 | 2 |
| 経済入門 | 必修 | 2 |
| 情報セキュリティ概論 | 選択必修 | 2 |
| 数学史 | 選択必修 | 2 |
| ネット情報発信概論 | 選択 | 2 |
| 二次創作の歴史から見るネット文化 | 選択 | 2 |

**11 科目 22 単位 —— 必修 14・選択必修 4・選択 4（2026年9月9日現在）**

<!-- 自己紹介:ここまで -->
---

## 30 秒で

コンピュータサイエンスと人工知能を学びながら、査読を受けていないプレプリントを書いて公開している。

いま一番の主張。公開された成果物は、もう直せない。直せるのは訂正のほうである。だから訂正は、時間とともに元の資料からずれていく。引用が一字変わり、箇所を数え落とし、未解決と決めた項目が「解決済み」に書き換わる。そのずれは、推論を使わずに機械で落とせる。LLM も類似度も使わない。あるか、無いか、一致するか、しないか。だから出力を人が確かめ直す必要が無い。

先に道具を作って論文に当てたのではない。自分の三篇を監査したら出てきた。三篇が検証スクリプトの同梱を謳っている箇所を、三箇所だと思っていた。数え直すと六箇所あった。見つけたのは目視ではなく機械である。

覆すには。(1) この検査を通ったのに、正誤表が一次資料とずれている例が一つ出れば覆る。(2) あるいは、宣言どおりに壊しても落ちない検査が一つ示されれば覆る。どちらも一件でよい。宣言の書き方と壊し方は [errata-check](https://github.com/cpsbvbng26-dotcom/errata-check)（[10.5281/zenodo.22649899](https://doi.org/10.5281/zenodo.22649899)）にある。

言っておくこと。検証の量は、検証される中身の価値について何も言わない。この体系には、それを判定できる検査が存在しない。数がいくら増えても、「これは価値が無い」とは出ない。主張の水準では反証可能であり、意義の水準では構造的に反証不可能である。[未解決のまま記録している](https://github.com/cpsbvbng26-dotcom/self-correction)（ST-002）。

### 監査の対象 —— Trinity-Infinity Series I–III

自分で書いた三篇である。反復 `x ← DQx + (I−D)p` が収束する条件として作用素ノルム `‖DQ‖₂ < 1` を置いたが、これは十分条件であって必要条件ではない。決めているのはスペクトル半径のほうで、`ρ(DQ) < 1` が必要十分である。[作用素のページ](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html)で、行列を打ち込めばその場で判定が出る。

### 証明できたこと / 類推に過ぎないこと / 撤回したこと

| | |
| --- | --- |
| **証明できたこと** | 座標の置換と固定基準点への統合を合成した作用素は縮小写像であり、唯一の不動点へ幾何的に収束する。Series I が三要素・一様な混合率で証明し、II が混合率を座標ごとに変えても成り立つことを示し、III が**そもそも三要素である必要がなかった**こと（任意の n ≥ 2）を示した。これに、上の訂正が加わる |
| **類推に過ぎないこと** | 上記以外のすべて。ゲーム理論・論理学・工学への接続は、他分野の既知の結果を正しく計算した実例か、類推・未証明の推測として明示的に印をつけたもののどちらかである。n = 3 が区別されるのは「巡回置換がそれ自身の逆写像にならない最小の n」という一点だけで、Series III はそれが「三」の文化的・哲学的な含意を正当化しないことを明示的に否定している |
| **撤回したこと** | 収束定理の原型（不動点が一意にならない読みだった）、「98.7% の試行で確認」（再現できるコードも乱数種もない）、三人ゲームの利得表（4 セルでは 2³ 通りを表現できない）、リアプノフ微分と LaSalle の原理の適用、AI アライメント・気候政策・ガバナンスへの応用。**各論文が同梱を謳う検証スクリプトは存在しない**（三篇で合計六箇所述べている。著者確認済み。[ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md) の E3）。**どれも消していない。**ただし論文の外に一つある —— 一般向けの電子書籍『グランドセオリーというロマン —— トリニティインフィニティフレームワーク』（Kindle）を、著者が販売停止にした。**この記録で唯一「消した」ものであり、何を主張していたかを第三者が確かめられない**（[BK-001](https://github.com/cpsbvbng26-dotcom/self-correction/blob/main/REGISTER.md)） |

哲学の三篇はこの形で反証できる種類のものではない。査読も受けていない。読んで反論する以外の道はなく、それでよいと考えている。

### 次に読むなら、この 3 つ

1. **[trinity-infinity / ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md)** —— 三篇の何が誤っていて、何が撤回されたか。読者が誤った版に辿り着く誤りが 1 件ある
2. **[trinity-operator / README.md](https://github.com/cpsbvbng26-dotcom/trinity-operator/blob/main/README.md)** —— 上の主張の実装と反例。検査 29 項目、乱数種は固定
3. **[trinity-infinity / pdf/trinity-infinity-series-iii.pdf](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/pdf/trinity-infinity-series-iii.pdf)** —— 系列が自分で何を確立し、何を撤回したかを書いた回顧

**向けられる反論のうち、当たっているものは [docs/objections.md](docs/objections.md) に先に書き出してある。**三つとも実際に受けた形のまま置いてある。認めるところを先に書き、答えごとに、それを崩す方法を添えてある。

> **公開しているものは、すべて査読を受けていない。** 学術誌にも会議にも通していない。DOI があることは、査読を受けたことを意味しない。

このサイトのトップも、この核だけが見えるようにしてある。哲学の三篇・史料ノート・修了証・外部プロフィールは、消さずに [ノート](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/notes/index.html) に移してある。

トップ（`index.html` / `index.en.html`）と `cv.html` は、自作の生成器 [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile) の出力である。手で編集せず、あちらの `site.json` / `site.en.json` / `cv.json` を直して `node build.js` を回すこと。

以下は一覧である。急がないなら読むこと。

---

✴︎Papers✴︎

いずれも査読前のプレプリントである。哲学の三篇は全文と PDF を [autonomy-and-self-cultivation](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation) に、Trinity-Infinity の三篇は [trinity-infinity](https://github.com/cpsbvbng26-dotcom/trinity-infinity) に置いている。史料ノートを含め、DOI のあるものは Zenodo が正である。

| 論文 | 内容 | 版 | DOI |
| --- | --- | --- | --- |
| [The Nobility and Exemplarity of the Celibate Individual](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/celibate-individual.md) | 性的活動を倫理的な義務とみなす通説を反出生主義の側から検討し、自足的な幸福という観点から独身を自己陶冶の型として擁護する | v2 — 2026年8月 | [10.5281/zenodo.22058254](https://doi.org/10.5281/zenodo.22058254)<br>SSRN [10.2139/ssrn.7358779](https://doi.org/10.2139/ssrn.7358779)<br>PhilArchive [NEMTNA](https://philarchive.org/rec/NEMTNA) |
| [Manifesto of Imperial Selfhood](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/imperial-selfhood.md) | 断片化した自己の統合を、カントの立法・ニーチェの価値転換・ユンガーの動員という三層で捉える | 改訂版 — 2026年8月 | [10.5281/zenodo.22057583](https://doi.org/10.5281/zenodo.22057583)<br>SSRN [10.2139/ssrn.7358818](https://doi.org/10.2139/ssrn.7358818)<br>PhilArchive [NEMMOI](https://philarchive.org/rec/NEMMOI) |
| [Fragmentarian Spiritual Individualism](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/fragmentarian-spiritual-individualism.md) | 断片化を修復すべき傷とみなさず、そこに住まうための規律を組み立てる | 2026年8月 | [10.5281/zenodo.22064241](https://doi.org/10.5281/zenodo.22064241)<br>PhilArchive [NEMFSI](https://philarchive.org/rec/NEMFSI) |
| [A Naval Gazette Entry for Lieutenant Otani Tsune（大谷恒）](https://doi.org/10.5281/zenodo.22055709) | アジア歴史資料センターが公開する海軍公報から叙勲記録一件を翻刻し、史料で確定できることとできないことを切り分ける | — | [10.5281/zenodo.22055709](https://doi.org/10.5281/zenodo.22055709)<br>Knowledge Commons [レコード](https://works.hcommons.org/records/q36z2-98e12) |
| [Trinity-Infinity Framework, Series I](https://doi.org/10.5281/zenodo.22058624) | 三要素の再帰作用素が一意の不動点へ幾何収束することを証明し、ゲーム理論・論理学・工学への接続を、証明済みの結果・既知の結果・類推に区別して示す。 | 改訂版 — 2026年8月 | [10.5281/zenodo.22058624](https://doi.org/10.5281/zenodo.22058624) |
| [Trinity-Infinity Framework, Series II](https://doi.org/10.5281/zenodo.22058777) | 混合率を座標ごとに変えても不動点の一意性が保たれることを示し、均衡利得集合の特徴づけとばね系の完全な計算例を加える。 | 改訂版 — 2026年8月 | [10.5281/zenodo.22058777](https://doi.org/10.5281/zenodo.22058777) |
| [Trinity-Infinity Framework, Series III](https://doi.org/10.5281/zenodo.22058964) | 収束定理が三要素を必要としないこと（任意の n ≥ 2 で成立）を示し、この系列が何を確立し、何を撤回したかを回顧する。 | 2026年8月 | [10.5281/zenodo.22058964](https://doi.org/10.5281/zenodo.22058964) |

> **Series I についての注記。** Series II と III は、改訂版の Series I を指すつもりで `10.5281/zenodo.17173703` を引いている。これは**この系列が訂正した 2025 年の初版**の DOI である。改訂版は `10.5281/zenodo.22058624` である。[ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md) を見ること。**撤回した内容は消していない。**

---

✴︎Works✴︎

| リポジトリ | 内容 | ライセンス | DOI |
| --- | --- | --- | --- |
| [作用素を回す](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html) | Trinity-Infinity の三篇が扱う作用素を、ブラウザの中だけで反復する。**スペクトル半径と作用素ノルムを別々に出し、収束の可否と単調減衰を分けて判定する**。固有値・特異値・連立一次方程式を外部ライブラリなしで解いている。NumPy の値と 728 件突き合わせ済み。このサイト内のページ | MIT | — |
| [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile) | 設定ファイル 1 つから研究者プロフィールの静的サイトを生成するツール | MIT | [10.5281/zenodo.22335692](https://doi.org/10.5281/zenodo.22335692) |
| [justice-and-algorithms](https://github.com/cpsbvbng26-dotcom/justice-and-algorithms) | アルゴリズムをめぐる論点を政治哲学の正義論に接続して整理する資料 | CC BY 4.0 | [10.5281/zenodo.22335676](https://doi.org/10.5281/zenodo.22335676) |
| [autonomy-and-self-cultivation](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation) | 哲学の三篇の全文・PDF・引用情報と、読むためのサイトの生成 | CC BY 4.0 | — |
| [trinity-infinity](https://github.com/cpsbvbng26-dotcom/trinity-infinity) | **枠組みは残らなかった。**残ったのは一つの作用素についての一つの事実 —— `Q` が n 巡回置換で `D` が対角のとき `(DQ)ⁿ = (∏ᵢ aᵢ)·I` がちょうど成り立ち、収束を決めているのは係数の相乗平均である。**この事実は正しく、機械で確かめられ、そして学部 2〜3 年の演習問題の水準である。**犯した誤りは、その講義が試験で問う取り違えである。直しに使った道具だけが**大学院の線形システム論と行列解析**に属する。いちばん近い学科は線形システム論・現代制御である。三篇と、その検証 238 項目（定理 15・印字された数値 32・正誤表の監査 83・経路 108）。何が確立され何が撤回されたかの記録と正誤 | CC BY 4.0 | — |
| [trinity-operator](https://github.com/cpsbvbng26-dotcom/trinity-operator) | 上の三篇の作用素を、置換にも一様な係数にも限らずに実装。収束を決めるのはスペクトル半径であり、三篇の作用素ノルム条件は必要以上に強い。**壊れた Banach の議論を組み直す構成**と、仮定を外していったときに何が残るかの展望。検査 172 項目 | MIT | — |
| [errata-check](https://github.com/cpsbvbng26-dotcom/errata-check) | **凍結された公開物に対して、正誤表のほうを機械で監査する。**DOI が付いた PDF は直せない。直せるのは正誤表のほうで、だからずれていく。引用が一字一句あるか、数え落としが無いか、未解決の項目が「解決済み」に書き換わっていないか、一次資料が差し替わっていないか。**判定に推論を使わない** | MIT | [10.5281/zenodo.22649899](https://doi.org/10.5281/zenodo.22649899) |
| [self-correction](https://github.com/cpsbvbng26-dotcom/self-correction) | **自分が公開した主張のうち、誤っていたもの・撤回したもの・直せないものを、一件ずつ消さずに記録する。**いま 71 件。いま立っている主張には覆し方を、直せない項目には理由を書くことを検査で強制する。**識別子は永久に消せない** —— git の履歴を遡り、過去に一度でも載った項目が消えていれば落ちる | MIT | — |
| [naval-gazette-notes](https://github.com/cpsbvbng26-dotcom/naval-gazette-notes) | 史料ノートの翻刻を機械可読にしたデータ。「同」で繰り返された階級を、書かれていたものと引き継いだもので区別している | CC BY 4.0 | — |

---

✴︎Credentials✴︎

<details>
<summary>修了証・オープンバッジ 計 7 件（各バッジは発行機関の検証ページに繋がる）</summary>

**edX**（4 件）

[![CC0201EN: Introduction to Containers, Kubernetes and OpenShift](https://img.shields.io/badge/edX-CC0201EN%20Containers%2C%20Kubernetes%20%26%20OpenShift-02262B?style=for-the-badge)](https://courses.edx.org/certificates/09bd51313ed94fdd8b694164f6745316)

[![CS50AI: Introduction to Artificial Intelligence with Python](https://img.shields.io/badge/edX-CS50AI%20Artificial%20Intelligence%20with%20Python-02262B?style=for-the-badge)](https://courses.edx.org/certificates/a746620b6d7d45b583cb41b125e5f807)

[![CS50x: Introduction to Computer Science](https://img.shields.io/badge/edX-CS50x%20Introduction%20to%20Computer%20Science-02262B?style=for-the-badge)](https://courses.edx.org/certificates/eac0a01d3d424a32a00114c487288fbc)

[![ER22.1x: Justice](https://img.shields.io/badge/edX-ER22.1x%20Justice-02262B?style=for-the-badge)](https://courses.edx.org/certificates/7584800e9d0048fd94d5d6b1720256b3)

**東北大学 MOOC / オープンバッジ**（3 件）

[![Tohoku University MOOC: Radiation Safety](https://img.shields.io/badge/Tohoku%20University%20MOOC-Radiation%20Safety-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/N3dGdVhFTUFNaDd5Z1ZhT2VxYWVaZz09)

[![Tohoku University MOOC: Disaster Science](https://img.shields.io/badge/Tohoku%20University%20MOOC-Disaster%20Science-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/NElCQ3c1Nng0L0JZYlNNSFZ2aVNPUT09)

[![Tohoku University MOOC: Mystery of Aurora](https://img.shields.io/badge/Tohoku%20University%20MOOC-Mystery%20of%20Aurora-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/cDB4elE1ejd1UDBLZGx6d1NWV2Y5Zz09)

<!-- 新しい修了証を追加するときは、上のいずれかのグループに 1 行足すこと。
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
<summary>外部のプロフィールと記事（正は ORCID と Zenodo である）</summary>

- researchmap — [プロフィール](https://researchmap.jp/takuyanemoto) / [研究ブログ](https://researchmap.jp/takuyanemoto/research_blogs)
- PhilPeople — [哲学者プロフィール](https://philpeople.org/profiles/takuyanemoto)
- HAL — [欧州拠点研究者プロフィール](https://cv.hal.science/nemoto-takuya)
- Knowledge Commons — [人文学のプロフィール](https://profile.hcommons.org/members/nemoto200101/)
- J-GLOBAL — [研究者データベース](https://jglobal.jst.go.jp/detail?JGLOBAL_ID=202601016349119335)
- ORCID — [0009-0000-1406-0547](https://orcid.org/0009-0000-1406-0547)
- Google Scholar — [論文データベース](https://scholar.google.com/citations?user=_HEl3dYAAAAJ&hl=ja)
- SSRN — [論文リポジトリ](https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=8730280)
- LinkedIn — [職務プロフィール](https://jp.linkedin.com/in/%E5%8D%93%E5%93%89-%E6%A0%B9%E6%9C%AC-62b9093a0)
- Wantedly — [職務プロフィール](https://www.wantedly.com/id/takuya_nemoto_q)
- Medium — [記事一覧](https://medium.com/@heaven_livid_frog_333/lists)
- ランサーズ — [受注プロフィール](https://www.lancers.jp/profile/Itizyou)
- ココナラ — [受注プロフィール](https://coconala.com/users/4974247)
- このサイト — [cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/)

</details>

---

✴︎Verification✴︎

このリポジトリは、**push のたびに 1052 項目の検査を通す。** 依存パッケージはない。

```
node verification/check_text.js      # 誤変換とバッジ記法
node verification/check_contrast.js  # 配色の読みやすさ 431 項目
node verification/check_site.js      # サイトの構造 531 項目
node verification/check_trinity.js   # 作用素の数値 90 項目
```

**キーボードで辿れるかは、字面からは出ない。**焦点がどこに置かれ、そのとき何が
見えているかは、祖先から掛かる不透明度と登場演出の時間で決まる。そこだけは
Chromium を起こして測る。playwright と Chromium が要るので、上の並びには入れていない。

```
node verification/check_keyboard.js  # Tab で辿って測る 184 項目（要: Chromium）
```

26 ページを Tab で辿り、焦点の罠、透けたまま焦点を受ける要素、焦点の枠が出ない要素、
大きさの無い要素、辿る順と読む順のずれを見る。**道具が無ければ 1 を返して止まる。**
走らなかった検査は、通った検査ではない。

**リポジトリをまたぐずれは、これだけでは捕まらない。**各リポジトリの検査は自分の中しか見ないので、`errata-check` が 63 項目になったのにこのサイトが 60 のまま、が起きる（実際に起きた）。そこで 9 つを並べて隙間だけを見る検査を別に置いている。

```
node verification/check_all.js        # 9 リポジトリの検査を全部（33 本）
node verification/check_ecosystem.js  # 9 リポジトリ横断 223 項目
node verification/check_guards.js     # 検査そのものを壊して確かめる 24 項目
```

**`check_guards.js`** は、検査そのものを検査する。**検査の道具は、通ることでは信用できない** ——
何も見ていなくても全部通るからである。リポジトリを複製し、通る状態を**壊す先は 20 通り**あって、
壊したところがちょうど落ちることを確かめる。sitemap の日付を古くする、CSP のハッシュを変える、
核の頁に置かないと決めた語を入れる、先祖の頁で階級を断定する、JS 無しで本文を隠す、
暗い側の指定を食い違わせる、内部リンクを壊す、本文の色を薄くする、照合用の数値をずらす、
焦点の枠を消す、見出しの階層を飛ばす、など。
**落ちなければ、その検査は何も見ていない。**

**`check_ecosystem.js`** が見るのは三つである。散文が名乗る数（「道具自身 74」「登録簿 71 件」「壊す先 28 通り」など）が**実際に走らせた数と一致するか**。足し算で名乗っている数（正誤表の監査 132 = 51 + 50 + 31）が**足した結果と一致するか**。そして写した `errata_check.py` の版と、そのリポジトリが書いている DOI が**対応しているか**（`trinity-infinity` だけ v0.1.0 を写しているので、DOI も別の番号になる）。

宣言は [`verification/ecosystem.json`](verification/ecosystem.json) にある。どちらも兄弟ディレクトリに 9 つ並んでいることを前提にする（CI は 9 つを checkout してから回す）。

各リポジトリの `CLAUDE.md` の共通部分が**一字一句同じか**も、ここで見ている。一つだけ直すと落ちる。

**`check_site.js`** が拾うのは、直したつもりで直っていない類の食い違いである。内部リンクの切れ、読み込み時に外部を取りに行く要素の混入、JSON-LD の `hasPart` が存在しない資料を指すこと、sitemap と実ファイルのずれ、日本語版と英語版のカード数や README の食い違い、消したページへのリンクが残っていること。

いちばん効くのは **「本文が名乗っている数値と、実際に走らせた結果が一致すること」** である。検査を足したのに文章の数字だけ古い、が最も起きやすい破綻なので、そこを機械で押さえている（実際に一度起きた）。

**外部リクエストを出さないことは、CSP でブラウザに強制させている。** 「そう書いてある」だけでは、注入された 1 行を止められない。

```
default-src 'none'; script-src 'self' 'sha256-…'; style-src 'sha256-…';
img-src 'self' data:; connect-src <照会先 6 ホスト>; form-action 'none'; base-uri 'none'
```

**`unsafe-inline` は使っていない。** インラインの `<style>` と `<script>` は SHA-256 のハッシュで名指しして許している。中身を書き換えるとハッシュが変わるので、[`verification/update_csp.js`](verification/update_csp.js) で入れ直す。**入れ忘れると検査が落ち、ブラウザもそのスクリプトの実行を拒む。**

ページを足したり作り直したりしたときは、`node verification/update_sitemap.js` で `sitemap.xml` も入れ直す。`lastmod` は git の記録から入るので、手で書いて古くなることがない（実際に 2 ページぶん古くなっていたので、こうした）。**ページの変更と `sitemap.xml` は同じコミットに入れること。**

実際に何が止まるかは、攻撃を模して確かめた。

| | |
| --- | --- |
| 外部スクリプトの読み込み | 止まる |
| 注入したインラインスクリプトの実行 | 止まる |
| 許可していないホストへの `fetch` | 止まる |
| 外部画像（追跡用）の読み込み | 止まる |
| 注入したインライン `style` | 止まる |
| 許可したホスト（`api.crossref.org`） | 通る |

**正の URL がひとつであること**も見ている。このサイトの正は GitHub Pages である。別の配信先を指す URL が混ざると、検索エンジンにも読者にも二つの版があるように見える。`canonical` と `og:url` の食い違いも落とす。

**`check_trinity.js`** は作用素のページの数値を、ブラウザを起こさずに検査する。記録した NumPy の値 728 件と、縮小になる距離の証書 23 件との突き合わせ。

**空振りでないことは確認済みである。** 論文カードの DOI 書き換え、外部 script の混入、存在しないページへのリンク、`hasPart` の不整合、sitemap のずれ —— 五通り壊して五通りとも落ちた。

---

✴︎License✴︎

このリポジトリは二種類のものを含んでいるので、ライセンスも二つに分けている。

| | ライセンス | |
| --- | --- | --- |
| **文章・構造化データ** —— プロフィールの本文、論文と制作物の説明、`README.md` と `README.en.md`、JSON-LD | [CC BY 4.0](LICENSE) | 出典を示せば、改変も含めて自由に使える |
| **サイトの実装** —— `index.html` / `index.en.html` / `research.html` / `trinity.html` / `trinity.js` / `404.html` / `theme.js` / `cv.html` / `notes/` / `papers/` のマークアップ・スタイル・スクリプト、および `verification/` の検査スクリプト | [MIT](LICENSE-CODE) | [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile)（MIT）から起こしたものである |

© 2026 根本卓哉（Takuya Nemoto）

**リンク先の各リポジトリと各プレプリントは、それぞれのライセンスに従う。**
一覧の ✴︎Works✴︎ 欄と、各リポジトリの `LICENSE` を参照すること。

---

✴︎The Keep✴︎

<details>
<summary>城の縄張りに喩えると、どれがどれに相当するか</summary>

九つのリポジトリと、その外側の関係を、城の部位に当てて並べる。
喩えであって設計図ではない。ただし当てはめると、弱点の位置が同じ形で出てくる。

### 城内（GitHub）

| 城の部位 | 相当するもの | なぜ |
| --- | --- | --- |
| 天守閣 | `cpsbvbng26-dotcom` | 外から見える塔である。実戦では使わない。防御は石垣と狭間がやっている。最上階に望楼がある（横断検査） |
| 本丸 | `trinity-infinity` | 核である。定理・正誤表・経路。ここが落ちれば全部落ちる |
| 石垣 | `self-correction` | 外からは見えない。全部これに載っている。git が全版から id を集めるので崩せない |
| 出丸 | `trinity-operator` | 本丸の外に突き出た曲輪である。実際に撃ち合う場所。作用素ノルムとスペクトル半径の反例はここにある |
| 武具蔵 | `errata-check` | 武器を打つ場所である。三つの曲輪に写しを配っている |
| 作事方 | `researcher-profile` | 図面蔵である。天守も CV もノートも論文ページも、建物はここの出力である |
| 二の丸 | `autonomy-and-self-cultivation` | 哲学三篇。独立した曲輪で、独自の正誤表と番所を持つ |
| 三の丸 | `naval-gazette-notes` / `justice-and-algorithms` | 記録所と論点整理である。核ではないと明示してある |

### 城の設備

| 部位 | 相当するもの |
| --- | --- |
| 堀 | CSP `default-src 'none'`。何も渡らない。方針ではなくブラウザが強制している |
| 狭間 | 各リポジトリの検査 |
| 物見櫓 | `verification/check_ecosystem.js`。日次で自動で回る |
| 番所 | 各リポジトリの `verify.yml`。push ごとに動く |
| 大手門 | トップページ |
| 搦手 | `sitemap.xml` と DOI の解決。裏から入ってくる者のほうが多い |
| 虎口 | 論文ごとの単独ページ。DOI から来た者が最初に折れる場所 |
| 高札場 | `ERRATA.md`。誰でも読める所に、何を間違えたかを貼ってある |
| 検地帳 | [`docs/doi-index.md`](docs/doi-index.md) |
| 城絵図 | [`docs/canonical-sources.md`](docs/canonical-sources.md)。どれを正とするかの縄張り図 |

### 城外（自分の領地ではない）

| 相当するもの | |
| --- | --- |
| 墨付を出す側 | Zenodo。こちらから書き換えられない。だから凍結される |
| 家紋・印判 | ORCID。同名の者と区別する唯一のものである |
| 飛び地・陣屋 | SSRN / PhilArchive / Knowledge Commons / researchmap / HAL。正本ではない。入口である |
| 他家の目付 | 外部の評価と計測。こちらの支配下に無い記録である。凍結済みの論文を **Stanford Agentic Reviewer**（`paperreview.ai`、開発 Yixing Jiang・Andrew Ng）に掛け、返ってきた指摘を一つずつ当たって [`docs/external-evaluations.md`](docs/external-evaluations.md) に記録している。当てたものも外したものも残す。**査読ではない。**arXiv に接地する作りなので、ここで出している論文は精度が落ちる側に当たる —— その前提ごと書いてある |

### 本陣は城の中に無い

本陣は作業のセッションである。城外の仮設であり、放置すれば回収される。
残るのは push したものだけである。会話も、検査の出力も、作業ツリーも残らない。

本陣が落ちても城は落ちない。逆に、本陣で作ったものを城に入れないまま陣を払えば、
それは無かったことになる。

### 縄張りから見える弱点

石垣に墨付が無い。`self-correction` は全曲輪が訂正の正本として指しているのに、
DOI を持っていない。引用できる識別子の無い石垣である。

望楼が見ているのは九つである。**九つで全部である** —— そう確かめたのは、
利用者から「無いはずだ」と指摘されたあとである。それまで、この縄張りには
存在しないリポジトリが一つ載っていた。根拠はこの作業環境に残っていた
クローンだけで、リモートを確かめていなかった。登録簿の `WS-003` にある。

天守は実戦向きではない。これは弱点ではなく設計である。防御は石垣と狭間がやっている。
天守が焼けても城は機能する。Pages が止まっても Markdown は読める。

</details>

✴︎Tools & Disclosure✴︎

このリポジトリは [Claude Code](https://claude.com/claude-code) を使って書いている。監査には [Grok](https://grok.com) を使った。

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?style=for-the-badge)](https://claude.com/claude-code)
[![Assisted by Grok](https://img.shields.io/badge/Assisted%20by-Grok-4B5563?style=for-the-badge)](https://grok.com)

本リポジトリのサイト実装（`index.html` / `index.en.html` / `research.html` / `trinity.html` / `trinity.js` / `404.html` / `theme.js` / `cv.html` / `notes/` / `papers/`）は、AIコーディング支援ツール **Claude Code**（Anthropic）を使用して制作している。公開する文章の言い回しについて、**Grok**（xAI）に候補を出させた。設計・内容の確認および最終的な判断は、著者・根本卓哉（Takuya Nemoto）が行っている。AI は著作者ではない。

**制作過程の記録** — 表明だけではなく、リポジトリの履歴そのものから確認できる。

| 確認できること | 方法 |
| --- | --- |
| Claude による支援コミット | `git log --author=Claude` |
| Claude の作業セッション | コミットメッセージ末尾の `Claude-Session:` トレーラ |
| Grok による支援コミット | コミットメッセージ末尾の `Assisted-by: Grok` トレーラ |
| 共同作成の記録 | コミットメッセージ末尾の `Co-authored-by:` トレーラ |
| 変更の意図と検証内容 | 各プルリクエストの本文（何を確認したかを記載） |

コミットの著者名・トレーラ・プルリクエストの本文はいずれも履歴に固定されており、あとから表示だけを取り繕うことはできない。
