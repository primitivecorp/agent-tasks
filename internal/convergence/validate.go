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
	"regexp"
	"strings"
)

// Synthesized identities live in a reserved suffix space (section 3.3).
// An authored name is a DNS-1123 label, so it cannot contain "@", and the
// two synthesized shapes cannot collide with it by construction.
const (
	fixSuffix    = "@fix"
	policySuffix = "@policy"
)

// dns1123Label matches a Kubernetes DNS-1123 label: lowercase alphanumerics
// and hyphens, starting and ending with an alphanumeric, at most 63 bytes.
var dns1123Label = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$`)

// Validate re-checks what admission guarantees (section 11.8), so the
// package is safe against a buggy caller and tests can build plans without
// the controller. It does not check topological order: Step carries no
// `after`, so that check stays with admission.
func (p Plan) Validate() error {
	var errs []error
	var identities []string
	actions := 0
	actionName := ""

	for i, s := range p.Steps {
		identities = append(identities, s.Name)
		switch s.Kind {
		case Action:
			actions++
			actionName = s.Name
			errs = append(errs, validateActionStep(i, s)...)
		case Gate:
			errs = append(errs, validateGateStep(i, s)...)
			if s.FixAction != nil {
				identities = append(identities, s.FixAction.Name)
			}
		default:
			errs = append(errs, stepErr(i, s.Name, fmt.Sprintf("kind %q is not Action or Gate", s.Kind)))
		}
	}

	errs = append(errs, duplicateNames(identities)...)
	switch {
	case actions != 1:
		errs = append(errs, fmt.Errorf("plan must have exactly one Action step, found %d", actions))
	case p.Driver != actionName:
		errs = append(errs, fmt.Errorf("driver %q does not name the Action step %q", p.Driver, actionName))
	}

	if len(errs) == 0 {
		return nil
	}
	return fmt.Errorf("%w: %w", ErrInvalidPlan, errors.Join(errs...))
}

// stepErr prefixes a message with the step's position and name.
func stepErr(i int, name, msg string) error {
	return fmt.Errorf("step %d (%q): %s", i, name, msg)
}

// validateName applies the one naming rule: the part before any "@" is a
// DNS-1123 label, and the only suffix permitted is allowedSuffix. An empty
// allowedSuffix permits no suffix, which is the rule for authored names.
//
// The reserved space is one level deep (section 3.3), so a name never carries
// two suffixes. One consequence: an injected gate "<name>@policy" cannot own
// a fix action, because its identity "<name>@policy@fix" fails this rule.
func validateName(name, allowedSuffix string) error {
	base, suffix, hasSuffix := strings.Cut(name, "@")
	if hasSuffix {
		suffix = "@" + suffix
		if allowedSuffix == "" || suffix != allowedSuffix {
			return fmt.Errorf("name %q uses reserved suffix %q", name, suffix)
		}
	}
	if !dns1123Label.MatchString(base) {
		return fmt.Errorf("name %q is not a DNS-1123 label", name)
	}
	return nil
}

// duplicateNames reports every identity that appears more than once.
func duplicateNames(identities []string) []error {
	var errs []error
	seen := make(map[string]bool, len(identities))
	for _, name := range identities {
		if seen[name] {
			errs = append(errs, fmt.Errorf("duplicate name %q", name))
		}
		seen[name] = true
	}
	return errs
}

// gateOnlyFields names the gate-only fields that are set on a step.
func gateOnlyFields(s Step) []string {
	var set []string
	if s.Blocking {
		set = append(set, "blocking")
	}
	if len(s.InvalidatedBy) > 0 {
		set = append(set, "invalidatedBy")
	}
	if s.FixAction != nil {
		set = append(set, "fixAction")
	}
	if s.Injected {
		set = append(set, "injected")
	}
	return set
}

// validateActionStep requires an authored name and no gate-only fields.
func validateActionStep(i int, s Step) []error {
	var errs []error
	if err := validateName(s.Name, ""); err != nil {
		errs = append(errs, stepErr(i, s.Name, err.Error()))
	}
	for _, field := range gateOnlyFields(s) {
		errs = append(errs, stepErr(i, s.Name, field+" is set on an Action step"))
	}
	return errs
}

// validateGateStep checks the name against the injected flag, the
// injected-gate invariants, the patterns, and the synthesized fix action.
func validateGateStep(i int, s Step) []error {
	var errs []error
	at := func(msg string) { errs = append(errs, stepErr(i, s.Name, msg)) }

	if err := validateName(s.Name, policySuffix); err != nil {
		at(err.Error())
	}
	if strings.HasSuffix(s.Name, policySuffix) != s.Injected {
		at(fmt.Sprintf("name must carry %q exactly when the gate is injected", policySuffix))
	}

	if s.Injected {
		if !s.Blocking {
			at("injected gate must be blocking")
		}
		if len(s.InvalidatedBy) != 1 || s.InvalidatedBy[0] != defaultGlob {
			at(fmt.Sprintf("injected gate must be invalidatedBy [%q]", defaultGlob))
		}
	}

	if len(s.InvalidatedBy) == 0 {
		at(fmt.Sprintf("invalidatedBy is empty; admission defaults it to [%q]", defaultGlob))
	}
	for _, pattern := range s.InvalidatedBy {
		if err := validatePattern(pattern); err != nil {
			at(fmt.Sprintf("invalidatedBy pattern %q: %v", pattern, err))
		}
	}

	if fix := s.FixAction; fix != nil {
		for _, msg := range fixActionDefects(s.Name, *fix) {
			at("fixAction " + msg)
		}
	}
	return errs
}

// fixActionDefects checks the synthesized shape of section 4 step 5: an
// Action named "<gate>@fix" under the one naming rule, with no nested fix
// and no gate-only fields.
func fixActionDefects(gateName string, fix Step) []string {
	var defects []string
	if want := gateName + fixSuffix; fix.Name != want {
		defects = append(defects, fmt.Sprintf("name is %q, want %q", fix.Name, want))
	}
	if err := validateName(fix.Name, fixSuffix); err != nil {
		defects = append(defects, err.Error())
	}
	if fix.Kind != Action {
		defects = append(defects, fmt.Sprintf("kind is %q, want Action", fix.Kind))
	}
	for _, field := range gateOnlyFields(fix) {
		defects = append(defects, "carries gate-only field "+field)
	}
	return defects
}

// Validate requires every budget to be positive (R6). The package never
// interprets zero as infinite or as instant; the controller applies
// defaults at resolution.
func (b Budgets) Validate() error {
	var errs []error
	if b.Tokens <= 0 {
		errs = append(errs, fmt.Errorf("tokens must be positive, got %d", b.Tokens))
	}
	if b.WallClock <= 0 {
		errs = append(errs, fmt.Errorf("wallClock must be positive, got %s", b.WallClock))
	}
	if b.MaxDriverRuns <= 0 {
		errs = append(errs, fmt.Errorf("maxDriverRuns must be positive, got %d", b.MaxDriverRuns))
	}
	if b.FixAttemptsPerGate <= 0 {
		errs = append(errs, fmt.Errorf("fixAttemptsPerGate must be positive, got %d", b.FixAttemptsPerGate))
	}
	if b.InfraRetries <= 0 {
		errs = append(errs, fmt.Errorf("infraRetries must be positive, got %d", b.InfraRetries))
	}
	if len(errs) == 0 {
		return nil
	}
	return fmt.Errorf("%w: %w", ErrInvalidBudgets, errors.Join(errs...))
}
