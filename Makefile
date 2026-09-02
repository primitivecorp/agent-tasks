# agent-tasks build targets.
#
# CI runs `make verify`. Change a check here, never in the workflow, so local
# runs and CI run the same commands (.github/workflows/go-ci.yml).
#
# Tool versions have one home: the variables below. The Go version lives in
# go.mod; CI reads it from there.

GO ?= go
LOCALBIN := $(CURDIR)/bin
GOLANGCI_LINT_VERSION ?= v2.13.2
GOLANGCI_LINT := $(LOCALBIN)/golangci-lint

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

## verify-manifests: generated files match the tree. Meaningful once manifests generates.
verify-manifests: manifests
	git diff --exit-code

## golangci-lint-version: print the pin so CI can key a cache on it.
golangci-lint-version:
	@echo $(GOLANGCI_LINT_VERSION)

$(GOLANGCI_LINT):
	GOBIN=$(LOCALBIN) $(GO) install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_LINT_VERSION)
