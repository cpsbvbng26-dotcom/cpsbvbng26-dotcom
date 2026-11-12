# The castle map

Moved here from the README on 12 November 2026. The ten repositories, mapped onto the parts of a Japanese castle.

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
| Land register (検地帳) | [`docs/doi-index.md`](doi-index.md) |
| Castle map (城絵図) | [`docs/canonical-sources.md`](canonical-sources.md). Which source is canonical when several exist |

### Outside (not the author's ground)

| What it is | |
| --- | --- |
| The authority that grants the seal | Zenodo. It cannot be rewritten from here, which is why the artifacts are frozen |
| Crest and seal | ORCID. The only thing that separates the author from a namesake |
| Outposts | SSRN / PhilArchive / Knowledge Commons / researchmap / HAL. Entrances, not canonical records |
| Another house's inspectors | External review and metrics. Records outside the author's control. The frozen papers are run through the **Stanford Agentic Reviewer** (`paperreview.ai`, built by Yixing Jiang and Andrew Ng); every point it raises is checked one by one and recorded in [`docs/external-evaluations.md`](external-evaluations.md) (in Japanese). What it got right and what it got wrong are both kept. **It is not peer review.** It grounds its reviews in arXiv, which puts these papers on the side where its accuracy is lower — that caveat is recorded with the reviews |

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

The lookout watches ten repositories, and ten is all there are — which was verified
only after the author pointed out that one of them should not exist. Until then this map
carried a repository that is not there. The only ground for it was a clone left in the
working environment; the remote was never checked. Recorded as `WS-003` in the register.

The keep is not built for fighting. That is the design, not a defect. The stonework and
the loopholes do the defending. The castle keeps working if the keep burns — the Markdown
is readable even when Pages is not.
