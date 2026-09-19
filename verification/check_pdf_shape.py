#!/usr/bin/env python3
"""三篇の PDF の形を数え直す。

    python3 verification/check_pdf_shape.py

`docs/external-evaluations.md` の「紙面を測った」の表は、SSRN が Series II だけを
受け付けた件について立てた見当の材料である。散文に数を置いたので、その数を
紙面から数え直す（決めごと 5）。

数えているのは形だけである。内容の価値でも、受け付けの理由でもない。
選別した側は理由を述べていないので、この表はどの仮説の証拠にもならない。
そのことも散文に書いてあり、この検査が書いてあるかを見る。

PDF は兄弟ディレクトリの trinity-infinity にある。無ければ飛ばす。
"""

from __future__ import annotations

import io
import os
import re
import sys
import types

# cryptography はこの作業環境で panic する。pypdf が要るのは暗号化 PDF のときだけで、
# ここで読む三篇は暗号化されていない。**panic を避けるために空の module を置く。**
for _m in ("cryptography", "cryptography.hazmat", "cryptography.exceptions"):
    sys.modules.setdefault(_m, types.ModuleType(_m))

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ECO = os.environ.get("ECOSYSTEM_ROOT") or os.path.dirname(ROOT)
PDF_DIR = os.path.join(ECO, "trinity-infinity", "pdf")
DOC = os.path.join(ROOT, "docs", "external-evaluations.md")

PAPERS = [
    ("I 改訂版（落ちた）", "trinity-infinity-series-i-revised.pdf"),
    ("II 改訂版（載った）", "trinity-infinity-series-ii-revised.pdf"),
    ("III（落ちた）", "trinity-infinity-series-iii.pdf"),
]

passed = 0
failures = []


def check(label, ok, detail=""):
    global passed
    if ok:
        passed += 1
        print("  通  " + label + ("  " + detail if detail else ""))
    else:
        failures.append(label)
        print("  落  " + label + ("  " + detail if detail else ""))


def text_of(path):
    from pypdf import PdfReader
    reader = PdfReader(path)
    pages = reader.pages
    return len(pages), "\n".join(p.extract_text() or "" for p in pages)


def measure(path):
    n_pages, t = text_of(path)
    tail_at = t.rfind("References")
    tail = t[tail_at:] if tail_at >= 0 else ""
    gov = len(re.findall(r"governance", t, re.I))
    ali = len(re.findall(r"alignment", t, re.I))
    cli = len(re.findall(r"climate", t, re.I))
    return {
        "頁": n_pages,
        "語": len(t.split()),
        "`Theorem`": len(re.findall(r"\bTheorem\b", t)),
        "`Table`": len(re.findall(r"\bTable\b", t)),
        "小数": len(re.findall(r"\d+\.\d+", t)),
        "参考文献の項目": len(re.findall(r"\(\d{4}[a-z]?\)", tail)),
        "`governance`": gov,
        "`alignment`": ali,
        "`climate`": cli,
        "社会の領域の語（上の三つの合計）": gov + ali + cli,
    }


def row_of(doc, label):
    """散文の表から、その行の三つの数を取る。太字は外す。"""
    m = re.search(r"^\| " + re.escape(label) + r" \|(.+)\|\s*$", doc, re.M)
    if not m:
        return None
    cells = [c.strip().replace("**", "") for c in m.group(1).split("|")]
    if len(cells) != 3:
        return None
    try:
        return [int(c) for c in cells]
    except ValueError:
        return None


def main():
    if not os.path.isdir(PDF_DIR):
        print("trinity-infinity/pdf が見つからないので飛ばす: " + PDF_DIR)
        return 0
    doc = io.open(DOC, encoding="utf-8").read()

    # 表の見出しが、紙面の並びと同じ順であること。**並べ替えたら数がずれる。**
    head = "| 測ったもの | " + " | ".join(n for n, _ in PAPERS) + " |"
    check("表の見出しが三篇の並びと同じ", head in doc, head)

    got = []
    for _, fn in PAPERS:
        p = os.path.join(PDF_DIR, fn)
        if not os.path.exists(p):
            check("PDF がある  " + fn, False, "無い")
            return 1
        got.append(measure(p))

    for key in got[0].keys():
        actual = [g[key] for g in got]
        claimed = row_of(doc, key)
        check("表の「" + key + "」が紙面と合う", claimed == actual,
              "散文 " + str(claimed) + " / 紙面 " + str(actual))

    # **最大の欄の数を、散文が名乗っている。**数え直す。
    most = sum(1 for key in got[0].keys()
               if key != "社会の領域の語（上の三つの合計）"
               and got[1][key] == max(g[key] for g in got)
               and got[1][key] > min(g[key] for g in got))
    m = re.search(r"載った一篇は、(.)つの欄で最大です", doc)
    kanji = "〇一二三四五六七八九十"
    check("最大の欄の数が、散文の名乗りと合う",
          m is not None and kanji.index(m.group(1)) == most,
          "実際 " + str(most) + " / 名乗り " + (m.group(1) if m else "無し"))

    # **数だけでなく、どの欄かも名乗らせる。**数だけなら、どれが最大か伏せられる。
    名 = [key for key in got[0].keys()
         if key != "社会の領域の語（上の三つの合計）"
         and got[1][key] == max(g[key] for g in got)
         and got[1][key] > min(g[key] for g in got)]
    欠け = [key for key in 名 if key.replace("`", "") not in doc.split("八つの欄で最大です")[-1][:200]]
    check("最大の欄の名が、散文に全部あがっている", not 欠け,
          " / ".join(欠け) if 欠け else str(len(名)) + " 欄とも書いてある")

    # **0 の欄を伏せない。**最大の欄だけ並べると、都合のよい側だけが残る。
    最小 = [key for key in got[0].keys()
           if got[1][key] == min(g[key] for g in got)
           and got[1][key] < max(g[key] for g in got)]
    check("最小の欄も散文にあがっている",
          all(key.replace("`", "") in doc for key in 最小),
          " / ".join(最小) if 最小 else "無し")

    # **理由ではないという断りを消さない。**消えれば、この表は推定の証拠に読める。
    check("理由の説明ではないと書いてある",
          "理由の説明ではありません" in doc
          and "下の表はどの仮説の証拠にもなりません" in doc
          and "SSRN は理由を述べていません" in doc)

    # **前に書いて再現しなかった数を、消さずに残す。**
    check("再現しなかった前の数を残してある",
          "前に書いた数を一つ直します" in doc
          and "上の数え方では再現しません" in doc
          and "分からないので、前の数は使いません" in doc)

    print("\n" + "-" * 58)
    if failures:
        print("%d 件が通り、%d 件が通りませんでした。" % (passed, len(failures)))
        for f in failures:
            print("  - " + f)
        return 1
    print("%d 件すべて通りました。" % passed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
