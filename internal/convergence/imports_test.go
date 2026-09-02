/*
Copyright 2026 Primitive Instruments Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package convergence

import (
	"go/build"
	"slices"
	"strings"
	"testing"
)

// allowedModules is the dependency budget of section 11.8: the standard
// library plus doublestar. Nothing else, and never anything from k8s.io.
// The depguard rule in .golangci.yml states the same budget for the linter;
// this test is the backstop that runs wherever `go test` runs.
var allowedModules = []string{"github.com/bmatcuk/doublestar/v4"}

// TestImportBudget enforces section 11.1 rule 1 and section 11.8's
// dependency budget over the package and its tests. `go test` runs with the
// package directory as the working directory.
func TestImportBudget(t *testing.T) {
	pkg, err := build.ImportDir(".", 0)
	if err != nil {
		t.Fatalf("ImportDir: %v", err)
	}

	var offending []string
	for _, imp := range slices.Concat(pkg.Imports, pkg.TestImports, pkg.XTestImports) {
		if isStdlib(imp) || slices.Contains(allowedModules, imp) {
			continue
		}
		offending = append(offending, imp)
	}
	if len(offending) > 0 {
		t.Fatalf("imports outside the section 11.8 budget: %s", strings.Join(offending, ", "))
	}
}

// isStdlib reports whether an import path belongs to the standard library.
// A standard-library path has no dot in its first element, the same rule the
// go tool applies.
func isStdlib(path string) bool {
	first, _, _ := strings.Cut(path, "/")
	return !strings.Contains(first, ".")
}
