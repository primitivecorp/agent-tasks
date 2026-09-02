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

// Package convergence is the pure core of the agent-tasks operator.
//
// Two functions do the work. Fold applies one finished execution to the
// task's gate-state view. Decide reads the view and returns the single next
// step, an escalation, or Done. The controller is a thin shell around them.
// The normative contract is implementation.md section 11.
//
// The package obeys four rules (section 11.1):
//
//  1. Zero Kubernetes imports. The controller maps API types to and from
//     this package's types at its own boundary. A test enforces the import
//     budget: the standard library and doublestar/v4, nothing else.
//  2. No I/O, no clock, no randomness. Wall-clock spend arrives as a value
//     the caller maintains in Spend.ActiveRuntime.
//  3. Determinism. Identical inputs produce identical outputs. Every walk
//     iterates Plan.Steps, a slice in topological order, never a Go map.
//  4. Value semantics. Fold returns a new View and never mutates its
//     argument, so the controller can re-fold the same terminal execution
//     after a crashed status write and get the same view.
//
// One signature differs from the spec's prose. Section 11.1 writes
// Fold(v View, r ExecutionResult), but section 11.4 needs the plan: the
// invalidation globs live on the gate steps, DriverRuns needs the driver's
// name, and ErrUnknownStep needs the step set. View carries none of that,
// and a hidden plan reference inside View would break the controller's
// status round-trip. So the package exposes:
//
//	func Fold(p Plan, v View, r ExecutionResult) (View, error)
//
// symmetric with Decide(p, v, b). The spec gains an Appendix A row for this
// change with the Fold implementation.
//
// Two smaller deviations, each written down at the declaration: the
// execution statuses carry an Exec prefix (see ExecStatus) because section
// 11.2 names both a GateResult and an ExecStatus "Errored"; and the sentinel
// set adds ErrInvalidPlan and ErrInvalidBudgets, which section 11.8 omits
// although it asks for Plan.Validate and Budgets.Validate.
//
// Every function in the package expects a Plan that has passed Validate.
package convergence
