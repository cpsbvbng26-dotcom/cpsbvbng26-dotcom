# 査読の型

**同じ問いを、複数の言語モデルに投げるための固定文である。**

専用の査読サービスは研究の試作であり、生きているかどうかが運に左右される。
一方、汎用の言語モデルはいつでも動く。**両者の差の大半は、モデルの特殊性ではなく
問いの立て方にある。**だから問いのほうを固定する。

固定すると、記録の性質が変わる。**同じ文を同じ論文に当てれば、第三者が
同じことをやり直せる。**一つの評価は著者の証言にしかならないが、
**再現できる手順の出力は、そこから一歩出る。**

---

## 使い方

1. PDF を上げるか、本文を貼る
2. 下の英文をそのまま貼る（**改変しない。**改変したら別の手順になる）
3. 返ってきたものを丸ごと保存する。**都合の悪い部分を落とさない**
4. [external-evaluations.md](external-evaluations.md) に一行足す

## 目を塞ぐ

**この体系が既に知っていることを、査読の側に教えない。**

`ERRATA.md` を読ませれば、そこに書いてあることをそのまま返してくる。
それは確認ではなく反響である。**紙面だけを渡す。**正誤表も、経路の記録も、
登録簿も渡さない。

**返ってきたものが `ERRATA` の項目を独立に言い当てたなら、それは強い。**
教えてから言わせたのでは、何の証拠にもならない。

---

## 型 A —— 会議の査読

```
You are reviewing this paper for a peer-reviewed venue. You have not seen
any errata, corrections, or commentary from the author. Judge only what is
printed in the PDF.

Write your review under these headings, in this order:

1. SUMMARY. What does the paper claim to establish? Two or three sentences.

2. PRIOR ART. For each substantive result, state whether it is new or
   already standard. If it is standard, give the standard name for it and
   a specific reference (author, year, and where possible the section or
   theorem number). Be concrete: "this is the Banach fixed-point theorem"
   is useful; "this resembles known results" is not. If you are unsure
   whether something is standard, say so explicitly rather than guessing.

3. SOUNDNESS. Does each proof establish what it claims, as written? Not
   "in spirit", not "after an obvious repair" — as written. Quote the
   specific step that fails, if one does. If a hypothesis is stated but
   never used, say which. If a conclusion needs a hypothesis that is not
   stated, say which.

4. NUMBERS. Are the printed numerical values consistent with the
   definitions given in the paper? Name any value you cannot reproduce
   from the text, and say what you get instead.

5. OVERCLAIMING. Identify every place where the stated scope of a result
   exceeds what is proved. Applications, generalisations, and abstract
   claims count.

6. PRESENTATION. Errors in citation, numbering, cross-reference, or
   notation. Include bibliography entries that point to the wrong item.

7. QUESTIONS FOR THE AUTHOR. Things you cannot decide from the text alone.

8. VERDICT. One paragraph. Then a single line:
   RECOMMENDATION: accept / weak accept / borderline / weak reject / reject

Rules for the whole review:

- Be specific. A finding I cannot check is not a finding.
- Prefer one concrete defect over five general impressions.
- If you believe the paper contains no new mathematics, say so plainly and
  say what it is a rederivation of.
- Do not soften. Do not open with praise. Do not pad.
```

## 型 B —— 反証を試す

結論そのものを崩しにいかせる型である。README は
「**残った事実に、既存の文献に無いものは一つも無い**」と書き、
「**五行のどれか一つについて既存の文献に無いと示せば覆る。一件で覆る**」と
覆し方を置いている。それを他人にやらせる。

```
The author of this paper claims that it contains NO new mathematics — that
every surviving result is a rediscovery or a rederivation of something
already in the literature.

Your task is to try to refute that claim.

Find one result in this paper that is NOT already in the standard
literature. One is enough. For any candidate you propose:

- state the result precisely as the paper gives it
- state what you searched for and why you believe it is absent
- state your confidence, and what would settle it

If you cannot refute the claim, say so, and then do the opposite job: for
each substantive result, name the standard result it duplicates, with a
reference. Say which of these is the strongest match and which is the
weakest — the weakest is where the author's claim is most exposed.

Do not be agreeable. The author has already conceded the negative case.
Agreeing costs nothing and tells them nothing.
```

## 型 C —— 来歴

**紙面に印字されていないことがある。**そこに気づくかを見る。

```
Read this paper as a reviewer concerned with research integrity.

- What does the paper disclose about how it was produced? Quote the
  disclosure statements verbatim, if any.
- Is anything about the paper's origin left unstated that a reader would
  need in order to evaluate it?
- Does the bibliography cite the correct version of every work referenced?
  Check each DOI or identifier against the described content.
- Are there claims of accompanying materials — code, data, scripts — and
  does the paper make clear where they are?

Report only what you can support from the document itself. Do not
speculate about the author.
```

---

## 記録の仕方

三つの型を、複数のモデルに当てる。**表には一行ずつ入れる。**
どの型をどのモデルに当てたかを `場` の欄に書く。

**一致した指摘を先に当たる。**独立した複数の出力が同じ箇所を指したなら、
それは道具のくせではなく紙面の側の問題である可能性が高い。
**一つだけが指摘したものは、その道具のくせかもしれない。**

**三つとも褒めたことは、何も意味しない。**独立していないだけかもしれない。
