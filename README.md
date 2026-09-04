<div align="center">

# 厨二病ジェネレーター

**技名・二つ名・詠唱を量産する**

[![Demo](https://img.shields.io/badge/Demo-Open-7C3AED?style=for-the-badge&logo=githubpages)](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/chuuni.html)

</div>

---

✴︎Overview✴︎

技名・二つ名・組織名・詠唱・キャラクター設定書を、一度に最大 300 件まとめて生成する静的 Web アプリです。

漢字にカタカナルビ、その下にラテン表記を添えた形で出力します。厨二力レベルを上げるほど修飾が増え、`【】` や `†`、位階の表記が付きます。

**デモ** → [cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/chuuni.html](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/chuuni.html)

---

✴︎Features✴︎

| 種別 | 出力例 |
| --- | --- |
| 技名 | 蒼焔を喰らいし讃歌（アズールフレイムアンセム） |
| 二つ名 | 冥闇を焼き尽くす放浪者（ネザーワンダラー） |
| 組織名 | 第拾参雷霆騎士団（トニトルスオーダー） |
| 詠唱 | 真名の宣言から封印解除、顕現までの数行構成 |
| 設定書 | 真名・異名・所属・起源・権能・制約・禁忌・口癖の 8 項目 |

- 厨二力レベル 1〜5。上げるほど字数と装飾が増え、ラテン表記が大文字になる
- 一度に最大 300 件を生成し、一括コピー / `.txt` / `.json` 書き出しに対応
- 技名の最長パターンだけで約 55 万通りの組み合わせ

---

✴︎Technical Notes✴︎

- 素の JavaScript のみで実装。外部ライブラリ・CDN への依存はゼロ
- FNV-1a ハッシュ + mulberry32 による疑似乱数で、同じシードから同じ結果を再現
- 生成条件は URL ハッシュに保存され、そのまま共有・ブックマークできる
- 独自のマーカー記法から `<ruby>` とプレーンテキストを描き分け
- 生成はすべてブラウザ内で完結し、通信も保存も行わない

| ファイル | 役割 |
| --- | --- |
| `index.html` | トップページ |
| `chuuni.html` | 生成 UI |
| `chuuni.js` | 語彙辞書と生成エンジン |

生成結果は自由に利用できます。ごくまれに既存の作品名・商標と偶然一致する場合があるため、商用利用の前にご確認ください。

---

✴︎Honors & Digital Credentials✴︎

修了証・オープンバッジ 計 7 件。各バッジは発行機関の検証ページにリンクしています。

**edX**（4 件）

[![CC0201EN: Introduction to Containers, Kubernetes and OpenShift](https://img.shields.io/badge/edX-CC0201EN%20Containers%2C%20Kubernetes%20%26%20OpenShift-02262B?style=for-the-badge&logo=edx)](https://courses.edx.org/certificates/09bd51313ed94fdd8b694164f6745316)

[![CS50AI: Introduction to Artificial Intelligence with Python](https://img.shields.io/badge/edX-CS50AI%20Artificial%20Intelligence%20with%20Python-02262B?style=for-the-badge&logo=edx)](https://courses.edx.org/certificates/a746620b6d7d45b583cb41b125e5f807)

[![CS50x: Introduction to Computer Science](https://img.shields.io/badge/edX-CS50x%20Introduction%20to%20Computer%20Science-02262B?style=for-the-badge&logo=edx)](https://courses.edx.org/certificates/eac0a01d3d424a32a00114c487288fbc)

[![ER22.1x: Justice](https://img.shields.io/badge/edX-ER22.1x%20Justice-02262B?style=for-the-badge&logo=edx)](https://courses.edx.org/certificates/7584800e9d0048fd94d5d6b1720256b3)

**東北大学 MOOC / オープンバッジ**（3 件）

[![Tohoku University MOOC: Radiation Safety](https://img.shields.io/badge/Tohoku%20University%20MOOC-Radiation%20Safety-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/N3dGdVhFTUFNaDd5Z1ZhT2VxYWVaZz09)

[![Tohoku University MOOC: Disaster Science](https://img.shields.io/badge/Tohoku%20University%20MOOC-Disaster%20Science-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/NElCQ3c1Nng0L0JZYlNNSFZ2aVNPUT09)

[![Tohoku University MOOC: Mystery of Aurora](https://img.shields.io/badge/Tohoku%20University%20MOOC-Mystery%20of%20Aurora-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/cDB4elE1ejd1UDBLZGx6d1NWV2Y5Zz09)

<!-- 新しい修了証を追加するときは、上のいずれかのグループに 1 行足してください。
     [![講座名](https://img.shields.io/badge/発行元-講座名-色?style=for-the-badge)](検証ページのURL) -->

---

✴︎Tools & Disclosure✴︎

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?style=for-the-badge)](https://claude.com/claude-code)

本リポジトリの実装（`index.html` / `chuuni.html` / `chuuni.js`）は、AIコーディング支援ツール **Claude Code**（Anthropic）を使用して制作しています。設計・内容の確認および最終的な判断は制作者本人が行っています。
