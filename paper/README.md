# agent-tasks whitepaper

LaTeX source for the agent-tasks paper, targeting arXiv.

## Build

```bash
make setup      # install the TeX toolchain (first time only)
make            # main.pdf
make watch      # rebuild on save
make check      # fail if \todo or \note markers remain
make arxiv      # arxiv.tar.gz, including the .bbl
```

`make setup` installs a TeX Live subset via `apt` on Debian/Ubuntu, or MacTeX
via Homebrew on macOS. On any other platform, install TeX Live yourself — the
build needs `latexmk`, `pdflatex`, and `bibtex`. The build targets fail early
with a pointer to `make setup` when the toolchain is missing.

Verified against TeX Live 2023 on Ubuntu 24.04.

## Layout

```
main.tex                 preamble, macros, section includes
sections/*.tex           one file per section; stubs carry drafting notes
refs.bib                 bibliography — EVERY ENTRY NEEDS VERIFICATION
figures/                 diagrams
```

## Drafting order

Sections are numbered by final position, not by writing order. Write in this
sequence — each depends on the one before it:

1. `02-thesis` — the load-bearing framing. Everything else is instrumental.
2. `06-ledger-model` — the core contribution. If this is not crisp, nothing is.
3. `09-threat-model` — the most original material.
4. `03-motivation` — much easier once 2 and 6 exist.
5. `08-architecture`, `07-workflow-spec`, `12-validation-loop`
6. `04-related-work` — mandatory; write once the contribution is settled.
7. `13-evaluation` — after the AWS run.
8. `01-introduction`, `00-abstract`, `15-conclusion` — last, always.

## Before submission

- [ ] Verify every `refs.bib` entry against DBLP or the publisher
- [ ] `make check` passes (no `\todo` / `\note` left)
- [ ] Comment out the `\todo` and `\note` definitions in `main.tex`
- [ ] Confirm author list, affiliations, ORCIDs
- [ ] Fill the cost table in §8.6 and §13 from real measurements
- [ ] Secure an arXiv endorsement for `cs.DC` if this is a first submission
- [ ] Categories: `cs.DC` primary; cross-list `cs.SE`, `cs.AI`, and `cs.CR`
- [ ] Confirm §16 repository URL and license statement

## Note on format

Drafted single-column in the `article` class deliberately. Converting to a
venue template (`acmart`, USENIX) at submission time is mechanical; drafting
inside a two-column template means fighting float placement for weeks.
