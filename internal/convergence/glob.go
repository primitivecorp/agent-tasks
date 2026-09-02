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
	"errors"
	"fmt"
	"strings"

	"github.com/bmatcuk/doublestar/v4"
)

// The glob dialect of section 11.6, pinned to doublestar/v4: a pattern
// matches the whole repository-relative path, "/"-separated, no leading
// "./", case-sensitive. "**" spans separators; "*" does not. Executors
// deliver paths in this normalized form. This file owns both sides of the
// dialect: validation here, matching when Fold lands.

// defaultGlob is the closed default of section 2.2. Injected gates must
// carry exactly this so a required gate can never carry forward.
const defaultGlob = "**"

// validatePattern rejects a pattern that cannot match a normalized path or
// that does not compile. Every "/"-separated segment must be non-empty and
// must not be "." or "..", which rules out a leading "/", a leading "./",
// a trailing "/", a doubled "/", and any "..".
func validatePattern(pattern string) error {
	if pattern == "" {
		return errors.New("empty")
	}
	for _, segment := range strings.Split(pattern, "/") {
		switch segment {
		case "":
			return errors.New("empty path segment; patterns are repository-relative with single \"/\"")
		case ".", "..":
			return fmt.Errorf("segment %q; patterns are repository-relative", segment)
		}
	}
	if !doublestar.ValidatePattern(pattern) {
		return errors.New("does not compile")
	}
	return nil
}
