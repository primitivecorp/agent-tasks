# agent-tasks whitepaper
#
#   make setup    install the TeX toolchain (Debian/Ubuntu or macOS)
#   make          build main.pdf
#   make watch    rebuild on change
#   make check    fail if \todo or \note markers remain
#   make arxiv    produce arxiv.tar.gz ready for upload (includes .bbl)
#   make clean    remove build artefacts

MAIN := main

# TeX Live subset covering this document's preamble (algorithmicx and cleveref
# are the ones a minimal install typically lacks). Verified against TeX Live
# 2023 on Ubuntu 24.04.
TEXPKGS := texlive-latex-base texlive-latex-recommended texlive-latex-extra \
           texlive-fonts-recommended texlive-science latexmk lmodern

SUDO := $(shell [ "$$(id -u)" -eq 0 ] || echo sudo)

.PHONY: all setup tools watch arxiv clean check

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
	@$(MAKE) --no-print-directory tools
	@echo "Toolchain ready."

# Guard the build with a pointer to setup. Order-only, so it gates the build
# without forcing a rebuild.
tools:
	@command -v latexmk  >/dev/null || { echo "ERROR: latexmk not found.  Run: make setup"; exit 1; }
	@command -v pdflatex >/dev/null || { echo "ERROR: pdflatex not found. Run: make setup"; exit 1; }

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

$(MAIN).pdf: $(MAIN).tex sections/*.tex refs.bib | tools
	latexmk -pdf -interaction=nonstopmode -halt-on-error $(MAIN).tex

watch: | tools
	latexmk -pdf -pvc -interaction=nonstopmode $(MAIN).tex

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

# Catch drafting aids left in the text
check:
	@! grep -rn '\\todo{\|\\note{' sections/ || \
		  { echo; echo "Drafting markers remain (above). Resolve before submission."; exit 1; }

clean:
	latexmk -C
	rm -rf arxiv-build arxiv.tar.gz $(MAIN).bbl
