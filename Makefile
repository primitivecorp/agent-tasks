# agent-tasks build targets.
#
# CI runs `make verify`. Change a check here, never in the workflow, so local
# runs and CI run the same commands (.github/workflows/go-ci.yml).
#
# Tool versions have one home: the variables below. The Go version lives in
# go.mod; CI reads it from there. golangci-lint is a prebuilt release binary
# fetched by its official, checksum-verifying install script, so it does not
# depend on the project's Go toolchain (its own go.mod moves faster than ours).

GO ?= go
LOCALBIN := $(CURDIR)/bin
GOLANGCI_LINT_VERSION ?= v2.13.2
GOLANGCI_LINT := $(LOCALBIN)/golangci-lint
GOLANGCI_LINT_INSTALLER := https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh

.PHONY: verify vet lint test manifests verify-manifests golangci-lint-version

## verify: every check CI runs, in CI order.
verify: lint test verify-manifests

## vet: go vet alone, for a quick local check. lint runs the same analyzers.
vet:
	$(GO) vet ./...

## lint: golangci-lint (formatting, vet analyzers, license headers, import budget).
lint: $(GOLANGCI_LINT)
	$(GOLANGCI_LINT) run ./...

## test: unit tests with the race detector and shuffled order.
test:
	$(GO) test -race -shuffle=on -count=1 ./...

## manifests: no-op until the kubebuilder scaffold lands (ENG-1771).
manifests:
	@echo "manifests: nothing to generate until the kubebuilder scaffold lands (ENG-1771)"

## verify-manifests: running manifests changes nothing, new files included.
## Compares the tree before and after, so it also works on a dirty local tree.
verify-manifests:
	@before="$$( { git status --porcelain; git diff; } )"; \
	$(MAKE) -s manifests; \
	after="$$( { git status --porcelain; git diff; } )"; \
	if [ "$$before" != "$$after" ]; then \
		echo "manifests changed the tree; commit the generated files:"; \
		git status --porcelain; exit 1; \
	fi

## golangci-lint-version: print the pin so CI can key a cache on it.
golangci-lint-version:
	@echo $(GOLANGCI_LINT_VERSION)

$(GOLANGCI_LINT):
	mkdir -p $(LOCALBIN)
	curl -sSfL $(GOLANGCI_LINT_INSTALLER) | sh -s -- -b $(LOCALBIN) $(GOLANGCI_LINT_VERSION)
