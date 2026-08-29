# agent-tasks whitepaper
#
#   make          build main.pdf
#   make watch    rebuild on change
#   make arxiv    produce arxiv.tar.gz ready for upload (includes .bbl)
#   make clean    remove build artefacts

MAIN := main

.PHONY: all watch arxiv clean check

all: $(MAIN).pdf

$(MAIN).pdf: $(MAIN).tex sections/*.tex refs.bib
	latexmk -pdf -interaction=nonstopmode -halt-on-error $(MAIN).tex

watch:
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
	@echo "Before uploading: comment out the \\todo and \\note definitions in $(MAIN).tex"

# Catch drafting aids left in the text
check:
	@! grep -rn '\\todo{\|\\note{' sections/ || \
	  { echo; echo "Drafting markers remain (above). Resolve before submission."; exit 1; }

clean:
	latexmk -C
	rm -rf arxiv-build arxiv.tar.gz $(MAIN).bbl
