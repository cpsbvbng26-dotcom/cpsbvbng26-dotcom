# 手を入れるときに

Issue も pull request も歓迎します。**登録は要らない**（閲覧・issue の作成・変更の提案の
いずれにも、承認や支払いを求めない）。

## 何を知らせてほしいか

<https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/issues> に立てる。

1. **事実の誤り**。引いた数、書誌、日付。**出典を添えてほしい**
2. **検査の偽陽性**。落ちるべきでないところで落ちている場合
3. **配色や辿りやすさの不備**。どの頁の、どの部分か

**偽陽性はとくに知らせてほしい**。検査は継続的インテグレーションの門として使っており、
誤って落ちることは、落ちないことより悪い。

## 手で編集してはいけないもの

**生成物があります**。もとの設定を直して生成し直します。どれが生成物かは
[CLAUDE.md](CLAUDE.md) の表にあります。

| 生成物 | 源 |
| --- | --- |
| `index.html` ほか五言語、`cv.html`、`notes/*.html` | `researcher-profile` の各 json |
| `README.md` / `README.en.md` の学歴と科目 | 同上（`courses.json`）→ `node verification/update_readme_courses.js` |
| `sitemap.xml` | `node verification/update_sitemap.js` |
| CSP の `<meta>` | `node verification/update_csp.js` |

**生成物への pull request は、そのままでは受けられません**。次の生成で消えるためです。

## 変更を出す

```
node verification/check_text.js        # 誤変換・使わないと決めた語
node verification/check_contrast.js    # 配色（WCAG の比）
node verification/check_site.js        # サイトの構造
node verification/check_trinity.js     # 作用素の頁の数値
node verification/check_guards.js      # 検査そのものを壊して確かめる
node verification/check_ecosystem.js   # 10 リポジトリ横断（兄弟ディレクトリが要る）
```

**通ってから出します**。依存パッケージは要りません。`check_keyboard.js` だけ Chromium を使います。

## 検査を足すときは、壊す試験も一緒に足す

**通ることでは信用できません**。新しい検査を書いたら、**通る状態を壊して、その検査が
ちょうど落ちること**を確かめる。壊しても落ちない検査は、何も見ていません。

**そして、名乗っている数を直します**。検査の項目数は README・ワークフローの仕事の名前・
五言語の頁が名乗っており、ずれると検査自身が落ちます。

## 通らない変更

- **検査の期待値や乱数種を、通すために変えること**。落ちたら中身を直す
- **公開済みの論文 PDF の改変・再生成**。凍結された成果物である
- **推測で埋めた DOI**。確かめていない番号は「確かめていない」と書く
- **外部へのリクエストを増やすこと**。`default-src 'none'`、`'unsafe-inline'` は使わない
- **ライセンスの変更**。散文と論文は CC BY 4.0、実装は MIT

## 支えの範囲と、これからの見込み

- **維持しているのは著者一人である**（根本卓哉）。組織の後ろ盾は無い
- issue への返答は**数日から一週間**を目安とします。約束ではない
- **範囲**。この場所の頁と、10 リポジトリ横断の検査に限ります。各リポジトリの中身は、
  それぞれのリポジトリで扱う
- **後方互換**。`verification/*.js` は依存パッケージを持たない方針を変えない

## ライセンス

散文は [CC BY 4.0](LICENSE)、実装は [MIT](LICENSE-CODE)。手を入れたぶんも同じ条件で扱われます。

## 突き合わせの受付 / Checked intake

2026-12-01 から、誤りの知らせ（`error-report.yml`）は「突き合わせの受付」で確かめる。
人が嘘をつくこと一般は、仕組みでは止められない。受けるのは、申し立てた人がその場で書けない出どころと突き合わせられる申し立てだけで、通らないものと確かめられないものは自動で退ける。
確かめるのは一つだけである。「書いてあること」の語が、「どこか」の欄に書いた所（このリポジトリのファイル、配っている頁、このリポジトリが写しを持つ DOI の PDF か翻刻）に、そのとおりにあること。空白の違いと文字の幅は見ない。頁や節は確かめず、文書の全体を探す。
あればラベル「quote verified」を付ける。それが誤りかどうかは、人が読んで決める。なければ、ラベル「not verified」と決まった文のコメントを付け、その申し立ては受け付けない。本文を直すか、新しい issue で出し直せば、もう一度確かめる。
突き合わせの受付は、どの issue も閉じず、鍵も掛けない。どの issue も人が読む。言葉の並びでは、法令が受けて扱うことを求める求め（削除・権利・個人の情報・人についての記述・同意の撤回。どの言語でも）を、誤りの知らせと見分けきれないためである（2026-11-15）。
そう読める語を含む issue には、ラベル「needs a person」も付ける。人への目印で、これに頼って何かを決めることはない。
持ち主が開き直したり直したりしたときは、何もしない。
コメントと実行の記録は、決まった語と issue の番号だけを書き、issue に書かれたことを写さない。
道具は `.github/checked-intake/verify.js`、確かめる先は `.github/checked-intake/config.json` にある。

From 2026-12-01, error reports (`error-report.yml`) are checked by the checked intake.
No system can stop a person from lying in general. Only claims that can be checked against a source that the claimant does not write at the moment of claiming are accepted; a claim that fails, or cannot be checked, is turned away automatically.
One thing is checked: that the words under "What it says" occur, as written, at the location under "Where" (a file of this repository, a page that it serves, or the PDF or transcription of a DOI of which it holds a copy). Differences of white space and character width are ignored. The page or section is not checked; the whole document is searched.
If they occur, the label "quote verified" is added, and whether it is an error is decided by a person. If they do not, the label "not verified" and a fixed comment are added, and the claim is not accepted; editing the issue, or opening a new one, runs the check again.
The checked intake never closes or locks an issue; a person reads every one. No list of words can tell every request that the law requires the operator to receive (removal, rights, personal data, statements about a person, the withdrawal of a consent, in any language) from an error report (2026-11-15).
An issue with words that read as such a request also gets the label "needs a person": a signal for the person, never relied on.
When the owner of the repository reopens or edits an issue, nothing is done.
Comments and logs carry only fixed words and the issue number, never what the issue says.
The script is `.github/checked-intake/verify.js`; what it checks against is in `.github/checked-intake/config.json`.
