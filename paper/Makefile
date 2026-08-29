# agent-tasks whitepaper
#
#   make setup      install the toolchain (Debian/Ubuntu or macOS)
#   make            build main.pdf
#   make watch      rebuild on change
#   make lint       run chktex over the sources
#   make fmt        reformat the sources in place with latexindent
#   make fmt-check  fail if any source is unformatted (does not modify)
#   make check      fail if \todo or \note markers remain
#   make verify     lint + fmt-check + build (what CI should run)
#   make arxiv      produce arxiv.tar.gz ready for upload (includes .bbl)
#   make clean      remove build artefacts

MAIN := main
SRC  := $(MAIN).tex $(wildcard sections/*.tex)

# TeX Live subset covering this document's preamble (algorithmicx and cleveref
# are the ones a minimal install typically lacks), plus the lint and format
# tools. latexindent needs those three Perl modules, which
# --no-install-recommends would otherwise skip.
TEXPKGS := texlive-latex-base texlive-latex-recommended texlive-latex-extra \
           texlive-fonts-recommended texlive-science latexmk lmodern \
           chktex texlive-extra-utils \
           libyaml-tiny-perl libfile-homedir-perl libunicode-linebreak-perl

# latexindent writes a log and .bak files; keep them out of the source tree.
CRUFT       := .latexindent-cruft
INDENTFLAGS := -l=.latexindent.yaml -c=$(CRUFT)

SUDO := $(shell [ "$$(id -u)" -eq 0 ] || echo sudo)

.PHONY: all setup tools dev-tools lint fmt fmt-check verify watch arxiv clean check

all: $(MAIN).pdf

# ---------------------------------------------------------------------------
# Toolchain
# ---------------------------------------------------------------------------

setup:
ifeq ($(shell uname -s),Darwin)
	brew install --cask mactex-no-gui
else
	$(SUDO) apt-get update
	$(SUDO) DEBIAN_FRONTEND=noninteractive apt-get install -y \
	   --no-install-recommends $(TEXPKGS)
endif
	@$(MAKE) --no-print-directory tools dev-tools
	@echo "Toolchain ready."

# Guards, so a missing tool fails with a pointer instead of command-not-found.
tools:
	@command -v latexmk  >/dev/null || { echo "ERROR: latexmk not found.  Run: make setup"; exit 1; }
	@command -v pdflatex >/dev/null || { echo "ERROR: pdflatex not found. Run: make setup"; exit 1; }

dev-tools:
	@command -v chktex      >/dev/null || { echo "ERROR: chktex not found.      Run: make setup"; exit 1; }
	@command -v latexindent >/dev/null || { echo "ERROR: latexindent not found. Run: make setup"; exit 1; }

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

$(MAIN).pdf: $(MAIN).tex sections/*.tex refs.bib | tools
	latexmk -pdf -interaction=nonstopmode -halt-on-error $(MAIN).tex

watch: | tools
	latexmk -pdf -pvc -interaction=nonstopmode $(MAIN).tex

# ---------------------------------------------------------------------------
# Lint and format
# ---------------------------------------------------------------------------

# Project-specific exceptions live in .chktexrc; one-off exceptions go inline
# as `% chktex NN`. We test for empty output rather than chktex's exit status,
# which is a warning count and so wraps to 0 at a multiple of 256.
lint: dev-tools
	@out=$$(chktex -q $(SRC) 2>&1); \
		  if [ -n "$$out" ]; then \
		    echo "$$out"; \
		    echo "chktex reported issues. Fix them, or record a justified exception"; \
		    echo "in .chktexrc or inline with a '% chktex NN' comment."; \
		    exit 1; \
		  fi
	@echo "chktex: clean"

fmt: dev-tools
	@mkdir -p $(CRUFT)
	@for f in $(SRC); do latexindent -w -s $(INDENTFLAGS) "$$f" || exit 1; done
	@echo "latexindent: formatted $(words $(SRC)) files"

fmt-check: dev-tools
	@mkdir -p $(CRUFT)
	@fail=0; \
		 for f in $(SRC); do \
		   latexindent -k -s $(INDENTFLAGS) "$$f" >/dev/null 2>&1 || { echo "  unformatted: $$f"; fail=1; }; \
		 done; \
		 if [ $$fail -ne 0 ]; then echo; echo "Run: make fmt"; exit 1; fi
	@echo "latexindent: all files formatted"

# What CI should run. `check` is deliberately excluded: drafting markers are
# expected while the paper is in progress.
verify: lint fmt-check all

# Catch drafting aids left in the text
check:
	@! grep -rn '\\todo{\|\\note{' sections/ || \
		  { echo; echo "Drafting markers remain (above). Resolve before submission."; exit 1; }

# ---------------------------------------------------------------------------
# Packaging
# ---------------------------------------------------------------------------

# arXiv does NOT run bibtex. The .bbl must be uploaded with the sources.
arxiv: $(MAIN).pdf
	@test -f $(MAIN).bbl || { echo "ERROR: $(MAIN).bbl missing. Run make first."; exit 1; }
	@rm -rf arxiv-build arxiv.tar.gz
	@mkdir -p arxiv-build/sections arxiv-build/figures
	@cp $(MAIN).tex $(MAIN).bbl arxiv-build/
	@cp sections/*.tex arxiv-build/sections/
	@cp figures/* arxiv-build/figures/ 2>/dev/null || true
	@cd arxiv-build && tar czf ../arxiv.tar.gz .
	@rm -rf arxiv-build
	@echo "Wrote arxiv.tar.gz"
	@printf 'Before uploading: comment out the \\todo and \\note definitions in %s\n' "$(MAIN).tex"

clean:
	latexmk -C
	rm -rf arxiv-build arxiv.tar.gz $(MAIN).bbl $(CRUFT)
