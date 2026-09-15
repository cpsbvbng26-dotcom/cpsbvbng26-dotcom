# 手を入れるときに

Issue も pull request も歓迎する。**登録は要らない**（閲覧・issue の作成・変更の提案の
いずれにも、承認や支払いを求めない）。

## 何を知らせてほしいか

<https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/issues> に立てる。

1. **事実の誤り。**引いた数、書誌、日付。**出典を添えてほしい**
2. **検査の偽陽性。**落ちるべきでないところで落ちている場合
3. **配色や辿りやすさの不備。**どの頁の、どの部分か

**偽陽性はとくに知らせてほしい。**検査は継続的インテグレーションの門として使っており、
**誤って落ちることは、落ちないことより悪い。**

## 手で編集してはいけないもの

**生成物がある。**もとの設定を直して生成し直す。どれが生成物かは
[CLAUDE.md](CLAUDE.md) の表にある。

| 生成物 | 源 |
| --- | --- |
| `index.html` ほか五言語、`cv.html`、`notes/*.html` | `researcher-profile` の各 json |
| `README.md` / `README.en.md` の学歴と科目 | 同上（`courses.json`）→ `node verification/update_readme_courses.js` |
| `sitemap.xml` | `node verification/update_sitemap.js` |
| CSP の `<meta>` | `node verification/update_csp.js` |

**生成物への pull request は、そのままでは受けられない。**次の生成で消えるためである。

## 変更を出す

```
node verification/check_text.js        # 誤変換・使わないと決めた語
node verification/check_contrast.js    # 配色（WCAG の比）
node verification/check_site.js        # サイトの構造
node verification/check_trinity.js     # 作用素の頁の数値
node verification/check_guards.js      # 検査そのものを壊して確かめる
node verification/check_ecosystem.js   # 10 リポジトリ横断（兄弟ディレクトリが要る）
```

**通ってから出す。**依存パッケージは要らない。`check_keyboard.js` だけ Chromium を使う。

## 検査を足すときは、壊す試験も一緒に足す

**通ることでは信用できない。**新しい検査を書いたら、**通る状態を壊して、その検査が
ちょうど落ちること**を確かめる。壊しても落ちない検査は、何も見ていない。

**そして、名乗っている数を直す。**検査の項目数は README・ワークフローの仕事の名前・
五言語の頁が名乗っており、**ずれると検査自身が落ちる。**

## 通らない変更

- **検査の期待値や乱数種を、通すために変えること。**落ちたら中身を直す
- **公開済みの論文 PDF の改変・再生成。**凍結された成果物である
- **推測で埋めた DOI。**確かめていない番号は「確かめていない」と書く
- **外部へのリクエストを増やすこと。**`default-src 'none'`、`'unsafe-inline'` は使わない
- **ライセンスの変更。**散文と論文は CC BY 4.0、実装は MIT

## 支えの範囲と、これからの見込み

- **維持しているのは著者一人である**（根本卓哉）。組織の後ろ盾は無い
- issue への返答は**数日から一週間**を目安とする。約束ではない
- **範囲。**この場所の頁と、10 リポジトリ横断の検査に限る。各リポジトリの中身は、
  それぞれのリポジトリで扱う
- **後方互換。**`verification/*.js` は依存パッケージを持たない方針を変えない

## ライセンス

散文は [CC BY 4.0](LICENSE)、実装は [MIT](LICENSE-CODE)。手を入れたぶんも同じ条件で扱われる。
