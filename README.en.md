<div align="center">

# Takuya Nemoto / 根本卓哉

**A record of studying computer science and artificial intelligence**

[![ORCID](https://img.shields.io/badge/ORCID-0009--0000--1406--0547-A6CE39?style=for-the-badge)](https://orcid.org/0009-0000-1406-0547)

[![Checks](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/actions/workflows/verify.yml/badge.svg)](https://github.com/cpsbvbng26-dotcom/cpsbvbng26-dotcom/actions/workflows/verify.yml)

[Site](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/index.en.html)

**English** ｜ [日本語](README.md)

</div>

---

<!-- 自己紹介:ここから -->

## About me

I am enrolled at ZEN University — 知能情報社会学部 知能情報社会学科 — in its first autumn-entry cohort. The programme spans the humanities and the sciences.

My coursework is mainly **philosophy** and **business practice**. **Mathematics** is on offer as well. The courses I have credit for are listed in the [CV](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/cv.html) (in Japanese). What this place holds is my study of computer science and artificial intelligence.

**Two aims**

- To take over the business my father is planning to found
- To teach at an online university after a doctorate

### Education

| | | Credits earned |
| --- | --- | --- |
| Tochigi Prefectural Tochigi High School | left partway through |  |
| Upper Secondary School Equivalency Examination | passed |  |
| Jiyugaoka Sanno College, Business Management course | two years, then withdrew | 1 course, 2 credits (as of 9 September 2026) |
| ZEN University — 知能情報社会学部 知能情報社会学科 | enrolled (first autumn-entry cohort) | 11 courses, 22 credits — 14 required, 4 required elective, 4 elective (as of 9 September 2026) |

### Courses I have credit for

**Jiyugaoka Sanno College, Business Management course**

| Course | Category | Credits |
| --- | --- | --- |
| Instructional Design (仕事の上手な教え方) | in-person session | 2 |

**1 course, 2 credits (as of 9 September 2026)**

**ZEN University — 知能情報社会学部 知能情報社会学科** — more to come.

| Course | Category | Credits |
| --- | --- | --- |
| Introduction to the Humanities and Social Sciences | required | 2 |
| IT Literacy | required | 2 |
| Academic Literacy | required | 2 |
| Using Digital Tools | required | 2 |
| Multilingual IT Communication | required | 2 |
| Applied Practice in Artificial Intelligence | required | 2 |
| Introduction to Economics | required | 2 |
| Introduction to Information Security | required elective | 2 |
| History of Mathematics | required elective | 2 |
| Introduction to Publishing on the Internet | elective | 2 |
| Internet Culture through the History of Derivative Works | elective | 2 |

**11 courses, 22 credits — 14 required, 4 required elective, 4 elective (as of 9 September 2026)**

<!-- 自己紹介:ここまで -->
---

## In 30 seconds

Someone studying computer science and artificial intelligence, who writes and publishes **preprints that have not been peer reviewed**.

**The current claim.** Trinity-Infinity Series I–III — which I wrote — assume the operator norm `‖DQ‖₂ < 1` as the condition under which the iteration `x ← DQx + (I−D)p` converges. That condition is sufficient, not necessary. Convergence is governed by the spectral radius instead: `ρ(DQ) < 1` is necessary and sufficient. In the region where the two come apart (`ρ < 1 ≤ ‖DQ‖₂`) the iteration still converges, but the error grows before it decays. In the papers' own setting the operator is normal, so `ρ = ‖DQ‖₂` holds and the distinction never surfaced. This is not new mathematics — transient growth in non-normal operators, and `ρ < 1` as the convergence condition, are standard facts of numerical linear algebra. The claim is one thing only: **the assumption the three papers made is stronger than it needs to be.**

**To refute it.** Produce either one of these. (1) An `A` and `b` with `ρ(A) < 1` for which some starting point does not converge. (2) An `A` and `b` with `ρ(A) ≥ 1` that converges to a unique point from every starting point. Type either into [the operator page](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html) and it will tell you (the page is in Japanese; the matrix fields are not).

### Proven / only an analogy / withdrawn

| | |
| --- | --- |
| **Proven** | An operator composing a permutation of coordinates with integration toward a fixed anchor is a contraction, and therefore converges geometrically to a unique fixed point. Series I proves it for three elements and a uniform blend, II shows it survives a per-coordinate blend, and III shows **three elements were never required** (it holds for every n ≥ 2). The correction above is added to this |
| **Only an analogy** | Everything else. The connections to game theory, logic and engineering are either correct calculations of results already known in those fields, or things explicitly marked as analogy or unproven conjecture. The one respect in which n = 3 is distinguished is that it is the smallest n for which the cyclic permutation is not its own inverse — and Series III explicitly denies that this justifies any cultural or philosophical significance of "three" |
| **Withdrawn** | The original convergence theorem (its natural reading gives no unique fixed point), "confirmed in 98.7% of trials" (no reproducible code, seed or stopping rule), a three-player payoff table (four cells cannot represent 2³ outcomes), the application of Lyapunov derivatives and LaSalle's principle, and the applications to AI alignment, climate policy and governance. **The verification scripts each paper claims to ship do not exist** (confirmed with the author; [ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md), item E3). **None of this has been deleted.** One thing outside the papers was: the trade ebook 『グランドセオリーというロマン —— トリニティインフィニティフレームワーク』 (Kindle) was withdrawn from sale by the author. **It is the one thing in this record that was deleted, and no third party can now check what it claimed** ([BK-001](https://github.com/cpsbvbng26-dotcom/self-correction/blob/main/REGISTER.md)) |

The three philosophical papers are not refutable in this shape, and they have not been peer reviewed either. Reading them and arguing back is the only route, and that seems right to me.

### If you read three more things

1. **[trinity-infinity / ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md)** — what is wrong in the three papers and what was withdrawn. One error sends readers to the wrong edition
2. **[trinity-operator / README.md](https://github.com/cpsbvbng26-dotcom/trinity-operator/blob/main/README.md)** — the implementation of the claim above, and the counterexample. 29 checks, fixed seed
3. **[trinity-infinity / pdf/trinity-infinity-series-iii.pdf](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/pdf/trinity-infinity-series-iii.pdf)** — the series' own retrospective on what it established and what it withdrew

**The objections to this work that land are written out first, in [docs/objections.md](docs/objections.md) (in Japanese).** All three are kept in the words they were raised in. What each one gets right is stated before the answer, and every answer carries the one thing that would defeat it.

> **Nothing published here has been peer reviewed.** None of it has gone through a journal or a conference. Having a DOI does not mean a work was reviewed.

The front page of the site shows this core and nothing else. The three philosophical papers, the source note, the certificates and the external profiles have been moved — not deleted — to [Notes](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/notes/index.en.html).

The front pages (`index.html` / `index.en.html`) and `cv.html` are generated by [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile), my own tool. Do not edit them by hand — edit `site.json` / `site.en.json` / `cv.json` there and run `node build.js`.

The listings follow. Read on if you are not in a hurry.

---

✴︎Papers✴︎

All are preprints and have not been peer-reviewed. Full text and PDFs for the three philosophical papers are in [autonomy-and-self-cultivation](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation); the three Trinity-Infinity papers are in [trinity-infinity](https://github.com/cpsbvbng26-dotcom/trinity-infinity). Where a work carries more than one DOI, **the Zenodo DOI is the one to cite.**

| Paper | Summary | Version | DOI |
| --- | --- | --- | --- |
| [The Nobility and Exemplarity of the Celibate Individual](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/celibate-individual.md) | Argues that the demographic-necessity case for treating sexual activity as obligatory does not survive the antinatalist critique, and defends celibacy as a form of self-cultivation grounded in self-sustaining well-being | v2 — Aug 2026 | [10.5281/zenodo.22058254](https://doi.org/10.5281/zenodo.22058254)<br>SSRN [10.2139/ssrn.7358779](https://doi.org/10.2139/ssrn.7358779)<br>PhilArchive [NEMTNA](https://philarchive.org/rec/NEMTNA) |
| [Manifesto of Imperial Selfhood](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/imperial-selfhood.md) | Assembles a reflexive account of self-integration from Kantian legislation, Nietzschean revaluation and Jüngerian mobilisation, treating the tension between them as the substance of the structure | Revised — Aug 2026 | [10.5281/zenodo.22057583](https://doi.org/10.5281/zenodo.22057583)<br>SSRN [10.2139/ssrn.7358818](https://doi.org/10.2139/ssrn.7358818)<br>PhilArchive [NEMMOI](https://philarchive.org/rec/NEMMOI) |
| [Fragmentarian Spiritual Individualism](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation/blob/main/papers/fragmentarian-spiritual-individualism.md) | Treats life, faith, society, thought and finitude as discrete fragments rather than one continuous story, and builds a discipline for inhabiting fragmentation rather than repairing it | Aug 2026 | [10.5281/zenodo.22064241](https://doi.org/10.5281/zenodo.22064241)<br>PhilArchive [NEMFSI](https://philarchive.org/rec/NEMFSI) |
| [A Naval Gazette Entry for Lieutenant Otani Tsune (大谷恒)](https://doi.org/10.5281/zenodo.22055709) | Transcribes a single investiture entry for an Imperial Japanese Navy lieutenant from a gazette held by JACAR, and separates what the document establishes from what it does not | — | [10.5281/zenodo.22055709](https://doi.org/10.5281/zenodo.22055709)<br>Knowledge Commons [record](https://works.hcommons.org/records/q36z2-98e12) |
| [Trinity-Infinity Framework, Series I](https://doi.org/10.5281/zenodo.22058624) | Proves that a triadic recursion operator converges geometrically to a unique fixed point, and separates throughout what is proven from what is borrowed from other fields and what is only an analogy | Revised — Aug 2026 | [10.5281/zenodo.22058624](https://doi.org/10.5281/zenodo.22058624) |
| [Trinity-Infinity Framework, Series II](https://doi.org/10.5281/zenodo.22058777) | Generalises the blend to vary by coordinate without losing uniqueness, and adds a characterisation of the sustainable payoff set and a fully worked spring-network example | Revised — Aug 2026 | [10.5281/zenodo.22058777](https://doi.org/10.5281/zenodo.22058777) |
| [Trinity-Infinity Framework, Series III](https://doi.org/10.5281/zenodo.22058964) | Shows the convergence result never required three elements — it holds for every n ≥ 2 — and gives a retrospective on what the series established and what it withdrew | Aug 2026 | [10.5281/zenodo.22058964](https://doi.org/10.5281/zenodo.22058964) |

> **Note on Series I.** Series II and Series III cite the revised Series I with `10.5281/zenodo.17173703`, which is the DOI of the **2025 original that this series corrects**. The revised edition is `10.5281/zenodo.22058624`. See [ERRATA.md](https://github.com/cpsbvbng26-dotcom/trinity-infinity/blob/main/ERRATA.md). **Nothing withdrawn has been deleted.**

---

✴︎Works✴︎

| Repository | Content | Licence | DOI |
| --- | --- | --- | --- |
| [Iterating the operator](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/trinity.html) | Runs the operator from the three Trinity-Infinity papers in the browser. **Reports the spectral radius and the operator norm separately**, judging convergence and monotone decay as two different conditions. Eigenvalues, singular values and the linear solve are implemented without any external library, and checked against 728 recorded NumPy results. A page on this site (in Japanese) | MIT | — |
| [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile) | A tool that generates a static researcher profile site from a single configuration file | MIT | [10.5281/zenodo.22335692](https://doi.org/10.5281/zenodo.22335692) |
| [justice-and-algorithms](https://github.com/cpsbvbng26-dotcom/justice-and-algorithms) | A resource mapping the debate on algorithmic decision-making onto theories of justice in political philosophy | CC BY 4.0 | [10.5281/zenodo.22335676](https://doi.org/10.5281/zenodo.22335676) |
| [autonomy-and-self-cultivation](https://github.com/cpsbvbng26-dotcom/autonomy-and-self-cultivation) | Full text, PDFs and citation metadata for the three philosophical papers, with a generator for the reading site | CC BY 4.0 | — |
| [trinity-infinity](https://github.com/cpsbvbng26-dotcom/trinity-infinity) | **The framework did not survive.** What remains is one fact about one operator — for `Q` an n-cycle and `D` diagonal, `(DQ)ⁿ = (∏ᵢ aᵢ)·I` exactly, so convergence is governed by the geometric mean of the coefficients. **The fact is correct, machine-checked, and at the level of a second- or third-year undergraduate exercise.** The error is the confusion that course sets on its exam. Only the tool used to repair it belongs to **graduate linear systems and matrix analysis**. The closest department is linear systems and control. The three papers, with 238 verification checks (15 on the theorems, 32 on the printed numerics, 83 on the errata, 108 on the route), an errata record, and an account of what the series established and what it withdrew | CC BY 4.0 | — |
| [trinity-operator](https://github.com/cpsbvbng26-dotcom/trinity-operator) | The operator of those three papers, implemented without their restriction to a permutation and a uniform blend. Convergence is governed by the spectral radius; the operator-norm condition the papers assume is stronger than it needs to be. 172 checks | MIT | — |
| [errata-check](https://github.com/cpsbvbng26-dotcom/errata-check) | **Audits an errata document against a frozen, already-published artifact.** A DOI'd PDF cannot be revised; only the errata can, so the errata drifts. Checks that every quotation appears verbatim, that occurrences are not undercounted, that an item declared unresolvable has not been quietly resolved, and that the artifact itself has not been swapped. **No inference is used in the judgement** | MIT | [10.5281/zenodo.22649899](https://doi.org/10.5281/zenodo.22649899) |
| [self-correction](https://github.com/cpsbvbng26-dotcom/self-correction) | **Every claim I have published that turned out to be wrong, was withdrawn, or cannot be fixed — recorded one by one and never deleted.** 68 entries. Standing claims must carry a refutation route; unresolvable ones must say why. **Identifiers can never be removed** — the check walks the git history and fails if any entry that was ever published has since disappeared | MIT | — |
| [naval-gazette-notes](https://github.com/cpsbvbng26-dotcom/naval-gazette-notes) | The transcription from the source note, made machine-readable. Ranks repeated by a ditto mark in the original are expanded per row, with a column separating what was printed from what was carried down | CC BY 4.0 | — |

---

✴︎Credentials✴︎

<details>
<summary>Seven certificates and open badges (each links to the issuer's verification page)</summary>

**edX** (4)

[![CC0201EN: Introduction to Containers, Kubernetes and OpenShift](https://img.shields.io/badge/edX-CC0201EN%20Containers%2C%20Kubernetes%20%26%20OpenShift-02262B?style=for-the-badge)](https://courses.edx.org/certificates/09bd51313ed94fdd8b694164f6745316)

[![CS50AI: Introduction to Artificial Intelligence with Python](https://img.shields.io/badge/edX-CS50AI%20Artificial%20Intelligence%20with%20Python-02262B?style=for-the-badge)](https://courses.edx.org/certificates/a746620b6d7d45b583cb41b125e5f807)

[![CS50x: Introduction to Computer Science](https://img.shields.io/badge/edX-CS50x%20Introduction%20to%20Computer%20Science-02262B?style=for-the-badge)](https://courses.edx.org/certificates/eac0a01d3d424a32a00114c487288fbc)

[![ER22.1x: Justice](https://img.shields.io/badge/edX-ER22.1x%20Justice-02262B?style=for-the-badge)](https://courses.edx.org/certificates/7584800e9d0048fd94d5d6b1720256b3)

**Tohoku University MOOC / Open Badges** (3)

[![Tohoku University MOOC: Radiation Safety](https://img.shields.io/badge/Tohoku%20University%20MOOC-Radiation%20Safety-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/N3dGdVhFTUFNaDd5Z1ZhT2VxYWVaZz09)

[![Tohoku University MOOC: Disaster Science](https://img.shields.io/badge/Tohoku%20University%20MOOC-Disaster%20Science-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/NElCQ3c1Nng0L0JZYlNNSFZ2aVNPUT09)

[![Tohoku University MOOC: Mystery of Aurora](https://img.shields.io/badge/Tohoku%20University%20MOOC-Mystery%20of%20Aurora-8B0000?style=for-the-badge)](https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/cDB4elE1ejd1UDBLZGx6d1NWV2Y5Zz09)

</details>

---

✴︎Areas✴︎

| Area | Content |
| --- | --- |
| Computer science | C and Python, algorithms and data structures, reasoning about complexity |
| Artificial intelligence | Search, knowledge representation, probabilistic inference, optimisation, machine learning, neural networks, natural language processing |
| Container platforms | Core concepts and operation of Docker, Kubernetes and OpenShift |
| Web development | Implementation in HTML, CSS and JavaScript; publishing and operating sites on GitHub Pages |
| Domain knowledge | Radiation safety, disaster science, political philosophy |

---

✴︎Links✴︎

<details>
<summary>External profiles and writing (ORCID and Zenodo are the authoritative ones)</summary>

- researchmap — [profile](https://researchmap.jp/takuyanemoto) / [research blog](https://researchmap.jp/takuyanemoto/research_blogs)
- PhilPeople — [philosophy profile](https://philpeople.org/profiles/takuyanemoto)
- HAL — [researcher profile](https://cv.hal.science/nemoto-takuya)
- Knowledge Commons — [humanities profile](https://profile.hcommons.org/members/nemoto200101/)
- J-GLOBAL — [researcher database](https://jglobal.jst.go.jp/detail?JGLOBAL_ID=202601016349119335)
- ORCID — [0009-0000-1406-0547](https://orcid.org/0009-0000-1406-0547)
- Google Scholar — [publications](https://scholar.google.com/citations?user=_HEl3dYAAAAJ&hl=ja)
- SSRN — [author page](https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=8730280)
- LinkedIn — [professional profile](https://jp.linkedin.com/in/%E5%8D%93%E5%93%89-%E6%A0%B9%E6%9C%AC-62b9093a0)
- Wantedly — [career profile](https://www.wantedly.com/id/takuya_nemoto_q)
- Medium — [articles](https://medium.com/@heaven_livid_frog_333/lists)
- Lancers — [freelance profile](https://www.lancers.jp/profile/Itizyou)
- Coconala — [freelance profile](https://coconala.com/users/4974247)
- This site — [English](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/index.en.html) ｜ [日本語](https://cpsbvbng26-dotcom.github.io/cpsbvbng26-dotcom/)

</details>

---

✴︎Verification✴︎

**Every push runs 506 checks.** There are no dependencies to install.

```
node verification/check_text.js      # miscoversions and badge markup
node verification/check_contrast.js  # colour contrast, 119 checks
node verification/check_site.js      # site structure, 297 checks
node verification/check_trinity.js   # operator numerics, 90 checks
```

**`check_site.js`** catches the kind of drift that looks fixed but isn't: broken internal links, a subresource that would fetch from a third party on load, a JSON-LD `hasPart` pointing at a work that is not in the graph, a sitemap entry with no file behind it, a card count that differs between the Japanese and English pages, and a link left behind to a page that has been removed.

**"No external requests" is enforced by a Content-Security-Policy, not merely stated.** A policy written in a README cannot stop one injected line.

```
default-src 'none'; script-src 'self' 'sha256-…'; style-src 'sha256-…';
img-src 'self' data:; connect-src <the six lookup hosts>; form-action 'none'; base-uri 'none'
```

**No `unsafe-inline`.** Inline `<style>` and `<script>` are allowed by SHA-256 hash. Editing them changes the hash, so it has to be reissued with `verification/update_csp.js` — forget, and the checks fail and the browser refuses to run the script. Blocking was verified against simulated injection: external scripts, injected inline scripts, `fetch` to a non-allowlisted host, tracking images and injected inline styles are all refused; the allowlisted API host is not.

The check that earns its place is **"the DOIs on the paper cards match the DOIs in the analyse-all link."** Adding a paper and forgetting to update the link is the most likely way this page quietly goes wrong, so a machine holds it.

**`check_trinity.js`** exercises the operator page's numerics without starting a browser, against 728 recorded NumPy results and 23 recorded contraction certificates.

**The checks were confirmed not to be vacuous.** Five deliberate breakages — a changed DOI on a card, an injected external script, a link to a page that does not exist, an inconsistent `hasPart`, a stale sitemap entry — produced five failures.

**Some things are not checked.** How the DOI analyzer renders a *successful* response from Crossref, DataCite, OpenAlex, Semantic Scholar or ORCID has only been exercised against recorded response shapes, because those APIs are unreachable from the environment the page was built in. **If a real response differs, the display may break.** The failure path — reporting the reason and restoring the button — is verified.

---

✴︎License✴︎

This repository holds two kinds of thing, so it carries two licences.

| | Licence | |
| --- | --- | --- |
| **Prose and structured data** — the profile text, the paper and work descriptions, `README.md`, `README.en.md`, the JSON-LD | [CC BY 4.0](LICENSE) | Free to use, including modification, with attribution |
| **Site implementation** — the markup, styles and scripts in `index.html` / `index.en.html` / `research.html` / `trinity.html` / `trinity.js` / `404.html` / `theme.js` / `cv.html` / `notes/` / `papers/`, and the check scripts in `verification/` | [MIT](LICENSE-CODE) | Derived from [researcher-profile](https://github.com/cpsbvbng26-dotcom/researcher-profile) (MIT) |

© 2026 Takuya Nemoto (根本卓哉)

**The linked repositories and preprints carry their own licences.** See the ✴︎Works✴︎ table above and the `LICENSE` file in each repository.

---

✴︎The Keep✴︎

<details>
<summary>The nine repositories mapped onto the parts of a Japanese castle</summary>

A metaphor, not a blueprint. It is included because mapping the parts makes the weak
points fall out in the same shape.

### Inside the walls (GitHub)

| Part | What it is | Why |
| --- | --- | --- |
| Keep (天守閣) | `cpsbvbng26-dotcom` | The tower one sees from outside. It is not where fighting happens; the stonework and the loopholes do that. It carries the lookout (the cross-repository check) |
| Inner citadel (本丸) | `trinity-infinity` | The core. Theorems, errata, route. If this falls, everything falls |
| Stone base (石垣) | `self-correction` | Invisible from outside. Everything rests on it. git collects every id from every past revision, so it cannot be torn down |
| Forward bastion (出丸) | `trinity-operator` | The enclosure that juts out past the wall — where the exchange of fire happens. The operator-norm / spectral-radius counterexample lives here |
| Armoury (武具蔵) | `errata-check` | Where the weapon is forged. Copies are issued to three enclosures |
| Works office (作事方) | `researcher-profile` | The drawing vault. The keep, the CV, the notes and the paper pages are all its output |
| Second enclosure (二の丸) | `autonomy-and-self-cultivation` | Three philosophy papers, with their own errata and their own guardhouse |
| Third enclosure (三の丸) | `naval-gazette-notes` / `justice-and-algorithms` | A source note and an issue survey, both declared not to be the core |

### Fittings

| Part | What it is |
| --- | --- |
| Moat (堀) | CSP `default-src 'none'`. Nothing crosses. Not a policy — the browser enforces it |
| Loopholes (狭間) | The check scripts in each repository |
| Lookout tower (物見櫓) | `verification/check_ecosystem.js`, run daily on a schedule |
| Guardhouse (番所) | Each repository's `verify.yml`, run on every push |
| Main gate (大手門) | The top page |
| Rear gate (搦手) | `sitemap.xml` and DOI resolution. More arrivals come from behind than from the front |
| Bent entrance (虎口) | The per-paper pages — the first turn a reader takes after a DOI |
| Notice board (高札場) | `ERRATA.md`. What was got wrong is posted where anyone can read it |
| Land register (検地帳) | [`docs/doi-index.md`](docs/doi-index.md) |
| Castle map (城絵図) | [`docs/canonical-sources.md`](docs/canonical-sources.md). Which source is canonical when several exist |

### Outside (not the author's ground)

| What it is | |
| --- | --- |
| The authority that grants the seal | Zenodo. It cannot be rewritten from here, which is why the artifacts are frozen |
| Crest and seal | ORCID. The only thing that separates the author from a namesake |
| Outposts | SSRN / PhilArchive / Knowledge Commons / researchmap / HAL. Entrances, not canonical records |
| Another house's inspectors | External review and metrics. Records outside the author's control. The frozen papers are run through the **Stanford Agentic Reviewer** (`paperreview.ai`, built by Yixing Jiang and Andrew Ng); every point it raises is checked one by one and recorded in [`docs/external-evaluations.md`](docs/external-evaluations.md) (in Japanese). What it got right and what it got wrong are both kept. **It is not peer review.** It grounds its reviews in arXiv, which puts these papers on the side where its accuracy is lower — that caveat is recorded with the reviews |

### The field camp is not inside the castle

The field camp is the working session. It is a temporary structure outside the walls, and
it is reclaimed when left alone. What survives is only what was pushed — not the
conversation, not the output of the checks, not the working tree.

The castle does not fall when the camp does. The reverse is the risk: whatever was built
in the camp and not brought inside never happened.

### What the map shows

The stone base carries no seal. Every enclosure points at `self-correction` as the
canonical record of corrections, and it has no DOI. A foundation with no citable
identifier.

The lookout watches nine repositories, and nine is all there are — which was verified
only after the author pointed out that one of them should not exist. Until then this map
carried a repository that is not there. The only ground for it was a clone left in the
working environment; the remote was never checked. Recorded as `WS-003` in the register.

The keep is not built for fighting. That is the design, not a defect. The stonework and
the loopholes do the defending. The castle keeps working if the keep burns — the Markdown
is readable even when Pages is not.

</details>

✴︎Tools & Disclosure✴︎

This repository is written with [Claude Code](https://claude.com/claude-code). [Grok](https://grok.com) was used for auditing.

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-D97757?style=for-the-badge)](https://claude.com/claude-code)
[![Assisted by Grok](https://img.shields.io/badge/Assisted%20by-Grok-4B5563?style=for-the-badge)](https://grok.com)

The site implementation in this repository (`index.html` / `index.en.html` / `research.html` / `trinity.html` / `trinity.js` / `404.html` / `theme.js` / `cv.html` / `notes/` / `papers/`) was built with **Claude Code** (Anthropic). **Grok** (xAI) was asked for wording suggestions on text that appears publicly. Design decisions, review of content, and final judgement rest with the author, Takuya Nemoto. **AI is not an author.**

**The record of how it was made** is not only a claim — it can be checked against the repository history itself.

| What can be checked | How |
| --- | --- |
| Commits assisted by Claude | `git log --author=Claude` |
| Which working session | the `Claude-Session:` trailer at the end of the commit message |
| Commits assisted by Grok | the `Assisted-by: Grok` trailer |
| Co-authorship | the `Co-authored-by:` trailer |
| Intent and verification for a change | the body of each pull request |

Commit authorship, trailers and pull request bodies are all fixed in the history. They cannot be tidied up after the fact to look different from what happened.
