#!/usr/bin/env python3
"""docs/library.toml と哲学三篇の書棚から、docs/library.bib を作る。

    python3 verification/build_library.py          # 作り直す
    python3 verification/build_library.py --check  # 作り直したものと一致するかだけ見る

library.bib は Zotero などに読み込ませるための生成物で、手では直さない（決めごと 3）。
構造化した典拠は library.toml から書く。哲学三篇の典拠は、兄弟ディレクトリの
autonomy-and-self-cultivation/verification/references.toml から、紙面の文字列のまま
@misc として書く。書誌を補えば、確かめていない書誌を作ることになるからである。

各項目の note に、どこまで確かめたか（status）を書く。読み込んだあとも消えない。
"""

import io
import os
import sys
import tomllib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "library.toml")
SHELF = os.path.join(os.path.dirname(ROOT), "autonomy-and-self-cultivation",
                     "verification", "references.toml")
OUT = os.path.join(ROOT, "docs", "library.bib")

FIELDS = ["author", "title", "journal", "booktitle", "howpublished", "edition",
          "publisher", "volume", "number", "pages", "year", "doi"]


def braced(value):
    """BibTeX の値。& は LaTeX で特別な字なので \\& にする。"""
    return "{" + value.replace("\\&", "&").replace("&", "\\&") + "}"


def entry(kind, key, fields):
    lines = ["@%s{%s," % (kind, key)]
    width = max(len(k) for k, _ in fields)
    for k, v in fields:
        lines.append("  %s = %s," % (k.ljust(width), braced(v)))
    lines[-1] = lines[-1].rstrip(",")
    lines.append("}")
    return "\n".join(lines)


def build():
    with open(SRC, "rb") as fh:
        lib = tomllib.load(fh)
    out = ["% 生成物です。手で直さない。直すのは docs/library.toml と、",
           "% autonomy-and-self-cultivation/verification/references.toml です。",
           "% python3 verification/build_library.py で作り直す。",
           ""]
    for e in sorted(lib["entry"], key=lambda e: e["key"]):
        fields = [(k, str(e[k])) for k in FIELDS if e.get(k)]
        note = "確かめた度合: %s。使った場所: %s" % (e["status"], e["used_in"])
        if e.get("note"):
            note += "。" + e["note"]
        fields.append(("note", note))
        out.append(entry(e["type"], e["key"], fields))
        out.append("")
    if os.path.exists(SHELF):
        with open(SHELF, "rb") as fh:
            shelf = tomllib.load(fh)
        for r in sorted(shelf["reference"], key=lambda r: r["id"]):
            note = ("哲学三篇の参考文献欄の文字列のまま。確かめた度合: 原典未確認。"
                    "論文 %s。支えている主張: %s" % (r["paper"], r["supports"]))
            if r.get("locus"):
                note += "。箇所: " + r["locus"]
            out.append(entry("misc", r["id"], [("title", r["bib"]), ("note", note)]))
            out.append("")
    return "\n".join(out)


def main():
    if not os.path.exists(SHELF):
        sys.exit("兄弟ディレクトリの %s が無い。哲学三篇の書棚を読めない" % SHELF)
    text = build()
    if "--check" in sys.argv:
        with io.open(OUT, encoding="utf-8") as fh:
            same = fh.read() == text
        print("library.bib は生成元と%s" % ("一致しています。" if same else "食い違っています。"))
        sys.exit(0 if same else 1)
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print("書きました: docs/library.bib（%d 件）" % text.count("\n@"))


if __name__ == "__main__":
    main()
