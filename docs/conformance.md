# Conformance corpora — `@fix-portal/fixatdl-react`

> Shared cross-language evidence with the headless core and the WPF
> adapter. These files prove agreement on the listed cases; they are
> not FIXatdl certification. The assessed surface and remaining limits
> live in the
> [core conformance record](https://github.com/FixPortal/fixportal-fixatdl/blob/main/docs/conformance.md).

| File                                                                      | Count | Also consumed by                                                                                                                                                                                                                       | What it pins                                                                                                                                                       |
| ------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`contracts/state-rule-cases.json`](../contracts/state-rule-cases.json)   | 101   | `FixPortal.FixAtdl.Contracts` evaluator tests; this file is a copy of the canonical [`contracts/state-rule-cases.json`](https://github.com/FixPortal/fixportal-fixatdl/blob/main/contracts/state-rule-cases.json) in fixportal-fixatdl | Edit evaluator: typed compares, XOR exactly-one, `{NULL}`, Boolean literals, missing values.                                                                       |
| [`contracts/state-transitions.json`](../contracts/state-transitions.json) | 7     | WPF `EditViewModel` tests, core fixture copy                                                                                                                                                                                           | Value-rule machine: initial false enabled/visible inversion, `{NULL}` clear/restore, ordinary transitions, cascades, cycle rejection, same-effect rule precedence. |

The seven transition scenarios, by their names in the file, are:

1. `initial-false-inverts-enabled-and-visible`
2. `null-rule-clears-and-restores-latest-value`
3. `initial-null-rule-restores-initial-value`
4. `reverse-document-order-cascade-settles-in-one-edit`
5. `ordinary-value-rule-does-not-restore-on-false`
6. `cyclic-null-rule-blocks-submission` - must surface as a form error
7. `same-effect-rules-active-rule-wins` - an active rule decides `enabled` or
   `visible`; an inactive rule's inverse applies only while no rule with the
   same effect is active

Browser validation does not replace XML schema validation, current ISO
code lists, or host-side validation before order submission.
