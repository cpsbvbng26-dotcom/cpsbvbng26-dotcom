# JOSS に出す —— 九つの状態

**直近の目標は、Journal of Open Source Software（JOSS。ISSN `2475-9066`）に通すことである。**
**出すのは九つ全部である。**この文書は、九つのそれぞれが、いまどの門に届いていないかを並べる。

**明文は `openjournals/joss` の `docs/` から写している。**リンクと強調の記法だけ外してある。
**`joss.theoj.org` にはこの作業環境から届かない。**照合したのは、その公開リポジトリの中身である。

## 門は四つある

査読に入る前に、四つの門がある。**一つでも欠ければ、査読に入らずに返される**
（`will receive a desk rejection`）。**返されることは「まだ」であって「二度と」ではない**と
場の側が書いている（`A desk rejection on these grounds may be a "not yet," rather than a "never."`）。

| | 門 | 明文 |
| --- | --- | --- |
| 1 | 公開の期間 | `The repository must have been public for more than six months prior to submission, with active development spanning that period` |
| 2 | 研究に使われている証拠 | `There must be evidence that the software is being used for research` |
| 3 | 開かれた開発の実践 | 単独の著者なら、複数の指標が同時に要る |
| 4 | 反復した開発 | `The development history must show ongoing iteration, not a single burst of commits` |

## 九つの状態

| リポジトリ | 種別 | OSI のライセンス | 公開したタグ | CONTRIBUTING | 最初のコミット | 門 1 に届く最短 |
| --- | --- | --- | --- | --- | --- | --- |
| cpsbvbng26-dotcom | 場所と横断の検査 | `LICENSE-CODE` が MIT | **無い** | **無い** | 2026-06-12 | 2026-12-13 |
| researcher-profile | 道具 | `LICENSE` が MIT | **1 件** | **無い** | 2026-09-05 | 2027-03-06 |
| trinity-infinity | 論文 | `LICENSE-CODE` が MIT | **無い** | **無い** | 2026-09-05 | 2027-03-06 |
| autonomy-and-self-cultivation | 論文 | `LICENSE-CODE` が MIT | **無い** | **無い** | 2026-09-05 | 2027-03-06 |
| justice-and-algorithms | 論文 | `LICENSE-CODE` が MIT | **1 件** | ある | 2026-09-05 | 2027-03-06 |
| naval-gazette-notes | 史料ノート | `LICENSE-CODE` が MIT | **無い** | **無い** | 2026-09-05 | 2027-03-06 |
| trinity-operator | 道具 | `LICENSE` が MIT | **無い** | **無い** | 2026-09-06 | 2027-03-07 |
| errata-check | 道具 | `LICENSE` が MIT | **3 件** | ある | 2026-09-07 | 2027-03-08 |
| self-correction | 記録と道具 | `LICENSE` が MIT | **無い** | **無い** | 2026-09-07 | 2027-03-08 |

**「門 1 に届く最短」は、最初のコミットの日から公開されていた場合の日付である。**
**公開に切り替えた日は、最初のコミットと同じとは限らない。こちらでは確かめていない。**
遅れていれば、その分だけ後ろにずれる。

## 門 1 —— 九つとも届いていない

**いちばん早いものでも、六か月を超えていない。**
最初のコミットで数えて、最も早いのが 2026-06-12 である。
**道具の側は、いちばん早いもので 2026-09-05 である。**

## 門 2 —— 証拠の側に、一つだけ材料がある

**九つとも、著者以外に使われた記録が無い。**
ただし場の側は、著者自身の研究利用でも最低限は足りると書いている
（`at minimum by the developers themselves, and ideally by others`）。

**ここで論文の側と道具の側が繋がっている。**
哲学三篇の正誤表は、`errata-check` が実際に監査している。
Trinity-Infinity の三篇も同じ道具で監査している。
**道具が、自分の外にある公開物に対して使われている。**

**それが証拠として足りるかは、編集側の判断である。こちらでは決まらない。**
そして、場の側は釘を刺している —— `Aspirational statements about future use are not sufficient`。

## 門 3 —— タグが一つのリポジトリにしか無い

単独の著者の場合、複数の指標が同時に要る ——
公開された履歴、タグ付きの版または変更履歴、試験と CI、文書、`CONTRIBUTING`、支援の方針である。
**九つとも、試験と CI と文書は揃っている。**

**タグを公開しているのは三つである。**`errata-check`（**3 件**）、`researcher-profile`（**1 件**）、
`justice-and-algorithms`（**1 件**）である。**残る六つは一つも公開していない。**
**理由は環境にある** —— この作業環境からタグを push すると 403 で返る。
**利用者の手作業にしか置き換えられない。**

**ローカルのタグと、公開されたタグは別である。**数え直すまで、こちらは一つだけだと書いていた。
手元に残っているタグを数えていたためである。**検査は `git ls-remote` のほうを見る。**

**`CONTRIBUTING` があるのは二つだけである。**`errata-check` と `justice-and-algorithms` である。

## 門 4 —— 九つとも、作業が数週間に集中している

**`not a single burst of commits` の逆をやっている。**
これは足して直せるものではない。**時間しか効かない。**

## 種別で分かれるもの

**論文と史料ノートは、そもそも software ではない。**
`LICENSE` が CC BY 4.0 で、MIT は `LICENSE-CODE` のほうにある（決めごと 7）。
JOSS が受けるのは research software であって、論文そのものではない。
**この四つを出すなら、出せるのは同梱の検査の側だけである。**
**そこは、まだ切り出していない。**

## 覆し方

**(1)** 九つのいずれかについて、この表より早く門 1 を満たせる公開日を示す。
**(2)** あるいは、表が「無い」と書いたリポジトリに公開されたタグがあることを示す。
どちらも一件で覆る。表の数は `check_ecosystem.js` が git から数え直している。
