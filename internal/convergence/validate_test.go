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
	"strings"
	"testing"
	"time"
)

// pyMinimal is the standard fixture plan of section 11.7.1.
func pyMinimal() Plan {
	return Plan{
		Driver: "implement",
		Steps: []Step{
			{Name: "implement", Kind: Action},
			{
				Name:          "lint",
				Kind:          Gate,
				Blocking:      true,
				InvalidatedBy: []string{"**/*.py"},
				FixAction:     &Step{Name: "lint@fix", Kind: Action},
			},
			{Name: "unit", Kind: Gate, Blocking: true, InvalidatedBy: []string{"**"}},
			{
				Name:          "integrity@policy",
				Kind:          Gate,
				Blocking:      true,
				InvalidatedBy: []string{"**"},
				Injected:      true,
			},
		},
	}
}

// defaultBudgets is the fixture budget of section 11.7.1.
func defaultBudgets() Budgets {
	return Budgets{
		Tokens:             1_000_000,
		WallClock:          20 * time.Minute,
		MaxDriverRuns:      3,
		FixAttemptsPerGate: 2,
		InfraRetries:       2,
	}
}

// step returns a pointer to the named step so a test can mutate the fixture
// without depending on declaration order.
func step(p *Plan, name string) *Step {
	for i := range p.Steps {
		if p.Steps[i].Name == name {
			return &p.Steps[i]
		}
	}
	panic("fixture has no step " + name)
}

func TestPlanValidate_PyMinimalIsValid(t *testing.T) {
	if err := pyMinimal().Validate(); err != nil {
		t.Fatalf("pyMinimal must validate, got: %v", err)
	}
}

func TestPlanValidate_RejectsZeroOrMultipleActions(t *testing.T) {
	none := pyMinimal()
	none.Steps = none.Steps[1:]
	assertInvalidPlan(t, none, "action")

	two := pyMinimal()
	two.Steps = append(two.Steps, Step{Name: "second", Kind: Action})
	assertInvalidPlan(t, two, "action")
}

func TestPlanValidate_RejectsUnknownKind(t *testing.T) {
	p := pyMinimal()
	step(&p, "unit").Kind = "Verb"
	assertInvalidPlan(t, p, "kind")
}

func TestPlanValidate_RejectsDriverNotNamingTheAction(t *testing.T) {
	p := pyMinimal()
	p.Driver = "lint"
	assertInvalidPlan(t, p, "driver")

	p.Driver = ""
	assertInvalidPlan(t, p, "driver")
}

func TestPlanValidate_RejectsBadGlob(t *testing.T) {
	cases := map[string][]string{
		"unbalanced bracket": {"src/[a"},
		"leading slash":      {"/src/**"},
		"leading dot slash":  {"./src/**"},
		"parent directory":   {"../src/**"},
		"doubled slash":      {"src//**"},
		"trailing slash":     {"src/"},
		"empty pattern":      {""},
		"no patterns":        {},
	}
	for name, globs := range cases {
		t.Run(name, func(t *testing.T) {
			p := pyMinimal()
			step(&p, "unit").InvalidatedBy = globs
			assertInvalidPlan(t, p, "invalidatedBy")
		})
	}
}

func TestPlanValidate_RejectsAtSignOutsideSynthesizedNames(t *testing.T) {
	cases := map[string]func(*Plan){
		"authored gate with @fix":  func(p *Plan) { step(p, "unit").Name = "unit@fix" },
		"@policy without injected": func(p *Plan) { step(p, "integrity@policy").Injected = false },
		"injected without @policy": func(p *Plan) { step(p, "integrity@policy").Name = "integrity" },
		"upper case":               func(p *Plan) { step(p, "unit").Name = "Unit" },
		"duplicate step name":      func(p *Plan) { step(p, "unit").Name = "lint" },
		"authored action with @policy": func(p *Plan) {
			p.Driver = "implement@policy"
			step(p, "implement").Name = "implement@policy"
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			p := pyMinimal()
			mutate(&p)
			assertInvalidPlan(t, p, "name")
		})
	}
}

func TestPlanValidate_RejectsFixActionNameOrKindMismatch(t *testing.T) {
	cases := map[string]func(*Plan){
		"wrong name": func(p *Plan) { step(p, "lint").FixAction = &Step{Name: "lint-fix", Kind: Action} },
		"wrong kind": func(p *Plan) { step(p, "lint").FixAction = &Step{Name: "lint@fix", Kind: Gate} },
		"nested fix": func(p *Plan) {
			step(p, "lint").FixAction = &Step{
				Name:      "lint@fix",
				Kind:      Action,
				FixAction: &Step{Name: "lint@fix@fix", Kind: Action},
			}
		},
		"on the action": func(p *Plan) { step(p, "implement").FixAction = &Step{Name: "implement@fix", Kind: Action} },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			p := pyMinimal()
			mutate(&p)
			assertInvalidPlan(t, p, "fixAction")
		})
	}
}

func TestPlanValidate_RejectsGateFieldsOnAction(t *testing.T) {
	cases := map[string]func(*Step){
		"blocking":      func(s *Step) { s.Blocking = true },
		"invalidatedBy": func(s *Step) { s.InvalidatedBy = []string{"**"} },
		"injected":      func(s *Step) { s.Injected = true },
	}
	for field, mutate := range cases {
		t.Run(field, func(t *testing.T) {
			p := pyMinimal()
			mutate(step(&p, "implement"))
			assertInvalidPlan(t, p, field)
		})
	}
}

func TestPlanValidate_RejectsWeakenedInjectedGate(t *testing.T) {
	cases := map[string]func(*Step){
		"not blocking":    func(s *Step) { s.Blocking = false },
		"narrowed globs":  func(s *Step) { s.InvalidatedBy = []string{"**/*.py"} },
		"with fix action": func(s *Step) { s.FixAction = &Step{Name: "integrity@policy@fix", Kind: Action} },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			p := pyMinimal()
			mutate(step(&p, "integrity@policy"))
			assertInvalidPlan(t, p, "injected")
		})
	}
}

func TestR6_BudgetsValidateRejectsNonPositive(t *testing.T) {
	cases := map[string]func(*Budgets){
		"tokens":             func(b *Budgets) { b.Tokens = 0 },
		"wallClock":          func(b *Budgets) { b.WallClock = 0 },
		"maxDriverRuns":      func(b *Budgets) { b.MaxDriverRuns = 0 },
		"fixAttemptsPerGate": func(b *Budgets) { b.FixAttemptsPerGate = 0 },
		"infraRetries":       func(b *Budgets) { b.InfraRetries = 0 },
		"negative":           func(b *Budgets) { b.MaxDriverRuns = -1 },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			b := defaultBudgets()
			mutate(&b)
			if err := b.Validate(); !errors.Is(err, ErrInvalidBudgets) {
				t.Fatalf("want ErrInvalidBudgets, got %v", err)
			}
		})
	}
}

func TestBudgetsValidate_AcceptsDefaults(t *testing.T) {
	if err := defaultBudgets().Validate(); err != nil {
		t.Fatalf("default budgets must validate, got: %v", err)
	}
}

func TestNewView_SeedsLineageAndZeroState(t *testing.T) {
	v := NewView("h0", pyMinimal())

	if v.CurrentSnapshot != "h0" {
		t.Fatalf("CurrentSnapshot = %q, want h0", v.CurrentSnapshot)
	}
	if len(v.Lineage) != 1 || v.Lineage[0].Snapshot != "h0" || v.Lineage[0].Parent != "" {
		t.Fatalf("Lineage = %+v, want one seeded record for h0", v.Lineage)
	}
	if v.Oscillation || v.DriverRuns != 0 || v.Spend != (Spend{}) {
		t.Fatalf("view is not at zero: %+v", v)
	}

	wantGates := []string{"lint", "unit", "integrity@policy"}
	if len(v.Gates) != len(wantGates) {
		t.Fatalf("Gates has %d entries, want %d", len(v.Gates), len(wantGates))
	}
	for _, g := range wantGates {
		if st := v.Gates[g]; st != (GateState{Result: Unknown}) {
			t.Fatalf("gate %q = %+v, want Unknown at zero", g, st)
		}
	}

	wantActions := []string{"implement", "lint@fix"}
	if len(v.Actions) != len(wantActions) {
		t.Fatalf("Actions has %d entries, want %d", len(v.Actions), len(wantActions))
	}
	for _, a := range wantActions {
		if _, ok := v.Actions[a]; !ok {
			t.Fatalf("action %q missing", a)
		}
		if st := v.Actions[a]; st != (ActionState{}) {
			t.Fatalf("action %q = %+v, want zero", a, st)
		}
	}
}

// assertInvalidPlan requires Validate to fail with ErrInvalidPlan and to
// name the offending field in its message.
func assertInvalidPlan(t *testing.T, p Plan, field string) {
	t.Helper()
	err := p.Validate()
	if !errors.Is(err, ErrInvalidPlan) {
		t.Fatalf("want ErrInvalidPlan, got %v", err)
	}
	if !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(field)) {
		t.Fatalf("error must name %q, got: %v", field, err)
	}
}
