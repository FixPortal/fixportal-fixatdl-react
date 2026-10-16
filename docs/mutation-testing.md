# Scoped mutation testing

Run `npm run test:mutation`, then `node scripts/assert-mutation-report.mjs`.
The weekly/manual `Scoped mutation` workflow runs both commands, has a 30-minute
job cap, and retains HTML, JSON and the status-count summary even on failure.
It does not run mutation testing in the pull-request lane.

The scope is four pure value/state modules: `decimalValue.ts`, `atdlValue.ts`,
`StateRuleEvaluator.ts` and `stateTransitions.ts`. This is not a whole-library,
React rendering, packaging or external-producer adequacy score. The TypeScript
checker rejects mutants that cannot compile; those are reported separately from
tests that catch a compiling regression. Vitest uses per-test coverage and related
tests, with concurrency two shared between the checker and test runner.

## First measured baseline

On 16 October 2026, Stryker JS 10.0.0, its Vitest runner and TypeScript checker
completed in 25m26s on an isolated Node 24 guest with four CPUs and 6 GiB memory.
The 518-test dry run passed. The measured source was `6c2dbed`; the subsequent
shared-corpus change in `aaf5d68` changes none of the four modules or their tests.

| Result        | Count |
| ------------- | ----: |
| Killed        |   416 |
| Timeout       |     3 |
| Survived      |   302 |
| No coverage   |     6 |
| Compile error |   341 |
| Runtime error |     0 |

There were 727 valid mutants and 1,068 generated mutants. Stryker's score was
57.63%, including timeouts as detected; killed alone accounts for 57.22% of valid
mutants. All three timeout reasons were hit-limit detections in mutated temporal
trimming loops. Compile errors remain outside the valid-mutant denominator.

The initial break floor is 55, with low 55 and high 80. This leaves 2.63 percentage
points below the observed score. It prevents a measured regression without claiming
that the current tests are adequate. The 302 survivors and six uncovered mutants
are inspection candidates; equivalent mutations and existing policy must be checked
before adding tests. Do not suppress compile errors to inflate a score or quote this
baseline after changing its scope, tests, checker or runner.

The report guard rejects missing results, zero valid mutants, unknown/incomplete
statuses, runtime errors, invalid threshold ordering and a score below the floor.
Thresholds must be finite numbers, and report paths must exactly match the four
configured targets. Eight new negative cases failed against the initial guard
and passed after these checks; all 20 CLI/workflow cases now pass.
Its CLI tests exercise these failures and pin its invocation after Stryker in the
actual bounded workflow. Removing the zero-result check, runtime-error check or
workflow invocation independently fails those assertions. The real baseline report
fails at a temporary floor of 58 and passes again at 55.

## Integration validation and limits

The final package gate passed 723 tests with zero skips, unchanged source coverage
floors, typecheck, build, package dry-run and all five distribution checks. ESLint
reported zero errors and 116 existing warnings. The first post-mutation lint attempt
also scanned retained generated mutants; `.stryker-tmp` and mutation reports are now
explicitly ignored by Git, formatting and linting. Application source coverage and
lint scope are unchanged.

The tools add development dependencies only. Existing locked package versions are
unchanged. A `qs` 6.16.0 override fixes the advisories introduced by the mutation
tool's new transitive dependency; it is not a runtime package dependency.

The first local measurement does not establish hosted runtime or scheduled-run
history. Retain each hosted result with its commit, statuses and duration before
making either claim. A manual hosted run is not scheduled evidence.

## Temporary Stryker 10 / Vitest 5 compatibility guard

`npm run test:mutation` explicitly checks the project-local installed versions and
full hashes of both Stryker Vitest runner name collectors, applies a narrow fix,
and runs a real nested-test mutation canary before the unchanged four-module run.
Required Node 22 and Node 24 CI also run this canary. No install hook is used.

Vitest 5 matches test names joined with `>`; Stryker 10.0.0 joins nested names
with spaces. This can silently skip nested assertions during per-test mutation
runs ([Vitest migration guide](https://vitest.dev/guide/migration/#testnamepattern-matches-the-joined-full-name),
[upstream issue 6210](https://github.com/stryker-mutator/stryker-js/issues/6210),
[upstream fix 6214](https://github.com/stryker-mutator/stryker-js/pull/6214)).
The canary requires its known false-condition mutant to be killed by the nested
literal assertion, with an active-mutant/hit/failure witness. A successful tool
exit alone is insufficient. Unknown versions, hashes or mixed patch states fail
closed before running mutation tests.

The historical manual run 38849487101 (57.63411279229711%, 727 valid mutants)
remains a raw measurement made with this compatibility limitation. It does not
establish a corrected score. The existing 55 floor, production mutation scope and
30-minute scheduled job cap are unchanged; a full corrected measurement remains
a separate qualification.

This mutation entrypoint currently requires **Linux** for bounded process-group
cleanup; Windows mutation execution is not qualified. Ordinary package tests
retain their existing platform support. Remove the temporary shim after an
official released runner passes the same real canary **without patching**, then
qualify the production scope. Version or hash changes require explicit review,
not a silent fallback or automatic installation.
