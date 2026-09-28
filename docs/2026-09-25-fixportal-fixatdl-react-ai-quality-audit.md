---
project: fixportal-fixatdl-react
review-type: ai-quality-audit
run-id: 20260925T213439Z
date: 2026-09-25
commit: 6f99f743bc20cbaf1c436a276c5a3a75d48724eb
corpus: ai-code-quality v5
corpus-age-days: 7.1
seats-reporting: 3 of 3
findings: 20
unclaimed-findings: 13
anchors-checked: 20
anchors-marked: 4
disposition: reported
tags:
  - audit/ai-quality
  - project/fixportal-fixatdl-react
---

# fixportal-fixatdl-react - AI quality audit

3 models audited `fixportal-fixatdl-react` at commit `6f99f743bc20` against 15 specific published criticisms of AI-written code, taken from corpus `ai-code-quality` v5. For each criticism the question was simply: does this repository do the thing the criticism describes?

## Verdict

No overall verdict: 11 of 15 published criticisms were not fully examined (10 partial, 1 unexamined). 3 apply outright and 1 are contested.

0 clean, 3 exhibited, 1 contested, 10 partial, 1 not examined by any seat.

What applies, and what it is:

- **C04** (asserted) - AI assistance increases duplicated code and reduces refactoring and code reuse.
- **C10** (asserted) - AI-generated code can appear to work while breaking core functionality, revealed only by thorough testing.
- **C16** (asserted) - LLM-generated unit tests carry test smells -- design flaws that undermine readability and maintainability -- beyond what compilability or coverage reveals.
- **C09** (contested) - This repository's own tests are too few or too weak to falsify the code they cover: they exercise the happy path, assert loosely, or draw inputs from a pool that cannot reach the failing case.

The panel raised 20 findings in total: 7 matching a published criticism, and 13 matching none of them. The second group is the more interesting one -- the corpus was written about AI-generated code in general, not about this repository. 

## What was found

20 findings, each anchored to a file and line. A finding marked "failed - demonstrated" is covered by a probe that ran and showed the defect. A seat emits ONE probe and names the CLAIM it demonstrates, not a single finding -- so where that seat raised several findings under the same claim, the cell marks each of them, and the probe count in Evidence quality is the number of probes rather than the number of rows. "not probed" means this seat's probe addressed a different claim; one marked "passed - unsubstantiated" is the seat's assertion with no executable evidence behind it. "failed - not attributable" means the probe command exited non-zero in a clean room that could not run this repository's tests in the first place, so the exit says nothing about the finding. The Role column separates an independent issue from a second reviewer's account of the same one: several seats landing on one file and line is CORROBORATION, and a flat table renders it as volume instead. The strongest account of a location is marked independent and names the seats that corroborated it; the rest are marked supporting and point at it. Nothing is merged -- each seat's own wording is evidence about that seat, and folding them would discard the independence a cross-vendor panel exists to buy.


By declared severity: 5 medium, 15 low. 20 findings sit at 20 distinct file and line positions, each raised by a single seat.

### Matching a published criticism

| Severity | Finding | Seat | Role | Claim | Anchor | Probe | Summary |
|---|---|---|---|---|---|---|---|
| medium | F1 | X | independent | [C10](#c10) | `src/StateRuleEvaluator.ts:116` OK | failed - the probe exited non-zero but its output contains no failing test; a non-zero exit is not by itself evidence | Malformed UTC temporal ordering returns false, so NOT turns an invalid rule into a satisfied rule. Throw InvalidRule for malformed temporal operands, consistently with temporal equality. |
| low | F2 | C | independent | [C04](#c04) | `src/atdlClock.ts:53` OK | not probed | FIX timezone-offset parsing is duplicated between atdlClock.parseClock and temporalValue.tzOffsetMinutes, so the two can diverge on what counts as a valid offset. |
| low | F5 | C | independent | [C04](#c04) | `src/output/fixPreviewEmitter.ts:121` OK | not probed | The FIX type-code inverse table is a hand-maintained duplicate of the typeToFixCode switch ('keep the two in sync') instead of being derived from one table. |
| low | F1 | K | independent | [C04](#c04) | `src/controls/TextFieldControl.tsx:53` RECOVERED (quote at line 52) | not probed | The label+asterisk JSX block and the per-control error <ul> block are verbatim-duplicated across the five labelled controls instead of a shared field-shell component. |
| low | F2 | K | independent | [C16](#c16) | `src/controls/CheckBoxControl.test.tsx:56` RECOVERED (quote at line 55) | not probed | CheckBoxControl.test.tsx registers a top-level it.each outside any describe block, and the per-control test files each redeclare near-identical BASE_CONTROL/ENABLED fixtures. |
| low | F4 | K | independent | [C09](#c09) | `examples/workbench/src/App.tsx:50` OK | passed - unsubstantiated | toRows reads tags[i+1]/tags[i+2] without bounds or tag-number (959/960) checks; a truncated or reordered 957-960 sequence throws TypeError inside the sample render, uncaught at the call site - exactly the class of defect the change's zero tests cannot reach. |
| low | F3 | X | independent | [C09](#c09) | `src/StateRuleEvaluator.test.ts:95` OK | not probed | Malformed UTC tests exercise equality while the shared corpus exercises only valid timestamp ordering, leaving the reproduced negation defect uncovered. Parameterize malformed temporal comparisons across ordering operators and NOT wrappers. |

### Not named by any criticism in the corpus

The corpus was written about AI-generated code in general, not about this repository. These findings map to none of its claims, which is where the corpus stops bounding the audit.

| Severity | Finding | Seat | Role | Claim | Anchor | Probe | Summary |
|---|---|---|---|---|---|---|---|
| medium | F1 | C | independent | - | `docs/getting-a-strategy.md:190` OK | not probed | The docs say a parameter with fixTag null is 'local to the form, never emitted', but emitStrategyParametersGrp emits every parameter regardless of fixTag, so a host that follows the docs can send form-only data on the wire in 958/960. |
| medium | F1b | C | independent | - | `src/output/fixPreviewEmitter.ts:36` OK | not probed | The emitter loop never checks p.fixTag, so the fixture's 'Notes' parameter (fixTag null) is emitted whenever it is filled. |
| medium | F1 | C | independent | - | `.claude/review-policy.json:3` OK | not probed | review-tier.yml is the privileged pull_request_target workflow that applies the HIGH label, but it is missing from the policy's high list and from the guard's required list, so a PR that guts it is tiered NORMAL. |
| medium | F1 | K | independent | - | `.claude/review-policy.json:6` OK | not probed | .claude/review-policy.json declares 8 of 13 HIGH-tier globs matching no file in this change (.github/workflows/ci.yml, .github/workflows/review-policy-guard.yml, .github/scripts/assert_gate_coverage.py, .github/scripts/assert_workflow_hygiene.py, .github/dependabot.yml, src/StateRuleEvaluator.ts, src/useAtdlFormState.ts, src/output/fixPreviewEmitter.ts), so the HIGH tier silently never applies to those paths. |
| low | F3 | C | independent | - | `.github/workflows/ci.yml:150` OK | not probed | The publish job rebuilds from source through prepack instead of publishing the *.tgz that passed the dist gates (React-external, public d.ts, side effects, styles, tarball smoke), so the artefact published to npm is not the one that was verified. |
| low | F2 | C | independent | - | `CHANGELOG.md:26` OK | not probed | CHANGELOG order is broken: [0.3.0] sits above [0.3.1], [Unreleased] sits below both, 0.3.1 has no link reference, and the [Unreleased] compare base is still v0.3.0. The 0.3.0 entries also repeat fixes already listed under 0.2.1. |
| low | F3 | C | independent | - | `styles/index.css:22` OK | not probed | The stylesheet header says the workbench 'adds no other CSS of its own'. examples/workbench/src/workbench.css ships about 250 lines of page chrome. |
| low | F4 | C | independent | - | `examples/workbench/src/theme.ts:27` OK | not probed | Two stacked doc blocks both attach to seedTheme, so the exported useTheme hook ends up with no documentation. |
| low | F3 | K | independent | - | `src/controls/EditableDropDownControl.tsx:51` RECOVERED (quote at line 50) | not probed | EditableDropDownControl sets aria-label unconditionally, diverging from the labelled-control contract used by TextField/Clock/DropDown/NumericField controls (aria-label only when control.label == null). |
| low | F4 | K | independent | - | `docs/diagrams/strategy-dataflow.html:8` RECOVERED (quote at line 7) | not probed | docs/diagrams/strategy-dataflow.html is described in docs/api.md as self-contained but loads Google Fonts from fonts.googleapis.com, so it is not self-contained and leaks a request to a third-party CDN when opened. |
| low | F2 | K | independent | - | `CHANGELOG.md:110` OK | not probed | CHANGELOG [Unreleased] link compares v0.3.0...HEAD although 0.3.1 is the latest release, so the Unreleased diff wrongly includes 0.3.1; release sections are also ordered 0.3.0 before 0.3.1 with [Unreleased] third, contrary to Keep a Changelog. |
| low | F3 | K | independent | - | `examples/workbench/src/theme.ts:17` OK | not probed | examples/workbench/src/theme.ts carries two stacked JSDoc blocks above seedTheme(); the first block describes useTheme (data-theme writing) and attaches to nothing, leaving useTheme undocumented and seedTheme doubly documented. |
| low | F2 | X | independent | - | `scripts/browser-smoke.mjs:59` OK | not probed | runBrowserSmoke leaves its HTTP server listening when chromium.launch rejects, leaking a resource for callers that catch the rejection; failure injection reproduced one remaining listener. Put browser launch inside the server cleanup scope and guarantee server closure even if browser cleanup fails. |

## Coverage: every criticism, and what each seat said

One row per published criticism. The verdict column means:

- **confirmed** - a seat found it AND a probe demonstrated it
- **asserted** - a seat found it, with no probe evidence
- **contested** - the seats disagreed; the disagreement is preserved, never averaged
- **clean** - every seat checked it and none found it
- **clean (partial)** - everyone who checked said no, but not everyone checked
- **not assessed** - no seat examined it. This is not a weaker "clean".

The **Looked** column counts how many reporting seats actually examined that criticism. A verdict backed by one seat is weaker evidence than the same verdict backed by all of them, and a bare matrix hides the difference.

| # | Criticism | X | C | K | Looked | Verdict |
|---|---|---|---|---|---|---|
| C02 | AI-generated code reproduces exploitable defects because it was trained on unvetted, buggy code. | not assessed | clean | clean | 2 of 3 | clean (partial) |
| C04 | AI assistance increases duplicated code and reduces refactoring and code reuse. | clean (partial) | exhibits | exhibits | 3 of 3 | asserted |
| C05 | AI-generated C# ignores nullable reference type annotations: it omits null checks and assigns possibly-null results to non-nullable targets. | not assessed | clean (partial) | clean | 2 of 3 | clean (partial) |
| C06 | AI-generated .NET code neglects disposal of resources, reaches for generic exception types, and applies null-checking inconsistently. | not assessed | clean (partial) | clean | 2 of 3 | clean (partial) |
| C07 | AI-generated tests assert general outcomes rather than specific values, and omit coverage for new public methods. | not assessed | clean | clean (partial) | 2 of 3 | clean (partial) |
| C08 | AI-generated code references packages that do not exist, creating a supply-chain attack surface. | not assessed | clean | clean | 2 of 3 | clean (partial) |
| C09 | This repository's own tests are too few or too weak to falsify the code they cover: they exercise the happy path, assert loosely, or draw inputs from a pool that cannot reach the failing case. | exhibits | clean | exhibits | 3 of 3 | contested |
| C10 | AI-generated code can appear to work while breaking core functionality, revealed only by thorough testing. | exhibits | not assessed | clean (partial) | 2 of 3 | asserted |
| C11 | AI-generated code solves the immediate task but misses long-term maintainability and architectural fit. | clean (partial) | clean (partial) | clean | 3 of 3 | clean (partial) |
| C12 | AI-generated code introduces security flaws at a high rate across major languages, C# included. | not assessed | clean | clean | 2 of 3 | clean (partial) |
| C13 | LLM-generated code carries recurring bug patterns that differ from human-written defects. | not assessed | not assessed | clean | 1 of 3 | clean (partial) |
| C14 | Generated tests run and pass while asserting weakly: they are executable without meaningfully constraining behaviour, so coverage overstates what they verify. | clean (partial) | clean | clean (partial) | 3 of 3 | clean (partial) |
| C15 | Coverage and mutation adequacy do not catch the faults LLM-generated code actually contains, because the test oracles fail to capture the faulty behaviour. | not assessed | not assessed | clean (partial) | 1 of 3 | clean (partial) |
| C16 | LLM-generated unit tests carry test smells -- design flaws that undermine readability and maintainability -- beyond what compilability or coverage reveals. | clean (partial) | clean (partial) | exhibits | 3 of 3 | asserted |
| C17 | Benchmarks reporting only functional correctness hide the trade-off against maintainability, efficiency and style -- the qualities that decide whether .NET code survives contact with a team. | not assessed | not assessed | not assessed | 0 of 3 | not assessed |

## Practice: disciplines the corpus argues for

These are not allegations against this repository. The corpus carries them because they say why a control exists, and the question is whether this repository follows the discipline - so they are counted nowhere in the verdict above.

- **follows** - the repository demonstrably does this
- **does not follow** - it does not, which is not by itself a defect
- **not assessed** - no seat could tell from source alone

| # | Practice | X | C | K | Looked | Verdict |
|---|---|---|---|---|---|---|
| C20 | Red-green TDD is the working discipline for agent-written code: the agent is given the test command first and made to drive the change from a failing test. | not assessed | not assessed | not assessed | 0 of 3 | not assessed |
| C22 | Static analysis and test feedback fed back into generation measurably improves the code produced, which is the argument for treating analyzers as build-blocking rather than advisory. | follows | follows | follows | 3 of 3 | follows |

### What the matrix does not mean

Every seat audited against the same corpus. That is deliberate - it makes divergence attributable to the model rather than to what each one happened to read - and it means agreement across seats is a **control, not reassurance**. A shared frame produces shared conclusions, so a row of "clean" is evidence about the panel before it is evidence about the code.

## Evidence quality

probe baseline: `npm test` ran green in the clean room, so a probe failure is attributable to its finding

probes: 6 emitted, 6 ran, 2 substantiated, 0 timed out

anchor-validation: 20 checked, 4 marked, 0 not checked (retained, never dropped)

Anchors are checked mechanically: the file must exist at that path, the line must be in range, and any quoted code must match at that line. A finding whose anchor fails is marked in the tables above and kept - deleting it would discard the evidence that settled it.

## How this was produced

### Panel

- **X** (openai) - resolved to `gpt-6-astra` at dispatch
- **C** (anthropic) - resolved to `claude-opus-5-5` at dispatch
- **K** (moonshot) - resolved to `kimi-code/kimi-for-coding` at dispatch

### Clean room

The panel audited an ephemeral git worktree at this commit, not this checkout. Nothing needed deleting from it: this repository carries no previous audit output and no findings ledger, so there was nothing a seat could have read and restated as fresh analysis.

## Sources

Every criticism and practice above is quoted from published work, not from the panel's own opinion. These are the sources the claims in this report rest on. The corpus holds 74 accepted sources in total; the other 53 back no claim used here and are listed for provenance in the run record.

#### C02
AI-generated code reproduces exploitable defects because it was trained on unvetted, buggy code.
- Asleep at the Keyboard? Assessing the Security of GitHub Copilot's Code Contributions <https://arxiv.org/abs/2108.09293>
- A Survey of Bugs in AI-Generated Code <https://arxiv.org/abs/2512.05239>

#### C04
AI assistance increases duplicated code and reduces refactoring and code reuse.
- AI Copilot Code Quality: 2025 Data Suggests Growth in Code Clones <https://www.gitclear.com/ai_assistant_code_quality_2025_research>

#### C05
AI-generated C# ignores nullable reference type annotations: it omits null checks and assigns possibly-null results to non-nullable targets.
- GitHub Copilot unaware of nullable types in C#? <https://github.com/orgs/community/discussions/120409>

#### C06
AI-generated .NET code neglects disposal of resources, reaches for generic exception types, and applies null-checking inconsistently.
- Reviewing AI-Generated Code in .NET <https://devblogs.microsoft.com/dotnet/developer-and-ai-code-reviewer-reviewing-ai-generated-code-in-dotnet/>

#### C07
AI-generated tests assert general outcomes rather than specific values, and omit coverage for new public methods.
- Reviewing AI-Generated Code in .NET <https://devblogs.microsoft.com/dotnet/developer-and-ai-code-reviewer-reviewing-ai-generated-code-in-dotnet/>

#### C08
AI-generated code references packages that do not exist, creating a supply-chain attack surface.
- We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs <https://arxiv.org/abs/2406.10279>

#### C09
This repository's own tests are too few or too weak to falsify the code they cover: they exercise the happy path, assert loosely, or draw inputs from a pool that cannot reach the failing case.
- Is Your Code Generated by ChatGPT Really Correct? Rigorous Evaluation of LLMs for Code Generation <https://arxiv.org/abs/2305.01210>

#### C10
AI-generated code can appear to work while breaking core functionality, revealed only by thorough testing.
- Can chatbots craft correct code? <https://blog.trailofbits.com/2025/12/19/can-chatbots-craft-correct-code/>

#### C11
AI-generated code solves the immediate task but misses long-term maintainability and architectural fit.
- Reviewing AI-Generated Code in .NET <https://devblogs.microsoft.com/dotnet/developer-and-ai-code-reviewer-reviewing-ai-generated-code-in-dotnet/>

#### C12
AI-generated code introduces security flaws at a high rate across major languages, C# included.
- Assessing the Quality and Security of AI-Generated Code: A Quantitative Analysis <https://arxiv.org/abs/2508.14727>
- Security Weaknesses of Copilot-Generated Code in GitHub Projects <https://arxiv.org/abs/2310.02059>

#### C13
LLM-generated code carries recurring bug patterns that differ from human-written defects.
- Bugs in Large Language Models Generated Code: An Empirical Study <https://arxiv.org/abs/2403.08937>

#### C14
Generated tests run and pass while asserting weakly: they are executable without meaningfully constraining behaviour, so coverage overstates what they verify.
- VibeCheck: Assessing the Quality of LLM-Generated Unit Tests <https://arxiv.org/abs/2609.05978>

#### C15
Coverage and mutation adequacy do not catch the faults LLM-generated code actually contains, because the test oracles fail to capture the faulty behaviour.
- How effective are traditional test criteria at detecting bugs in LLM-generated code? <https://arxiv.org/abs/2609.09315>

#### C16
LLM-generated unit tests carry test smells -- design flaws that undermine readability and maintainability -- beyond what compilability or coverage reveals.
- On the Diffusion of Test Smells in LLM-Generated Unit Tests <https://arxiv.org/abs/2410.10628>

#### C17
Benchmarks reporting only functional correctness hide the trade-off against maintainability, efficiency and style -- the qualities that decide whether .NET code survives contact with a team.
- Benchmarking the Titans: LLM Code Generation Quality in the .NET Ecosystem <https://arxiv.org/abs/2608.22529>

#### C20
Red-green TDD is the working discipline for agent-written code: the agent is given the test command first and made to drive the change from a failing test.
- Engineering practices that make coding agents work (Simon Willison) <https://simonwillison.net/2026/Mar/14/pragmatic-summit/>

#### C22
Static analysis and test feedback fed back into generation measurably improves the code produced, which is the argument for treating analyzers as build-blocking rather than advisory.
- Helping LLMs Improve Code Generation Using Feedback from Testing and Static Analysis <https://arxiv.org/abs/2412.14841>

#### C23
Measured across public repositories rather than purpose-generated samples, the large majority of AI-generated code carries no identifiable CWE-mapped vulnerability at all.
- Security Vulnerabilities in AI-Generated Code: 7,703 public GitHub files (87.9% carry no CWE) <https://arxiv.org/abs/2510.26103>

#### C24
The studies raising the alarm on AI code security largely analysed code generated for the study itself, which leaves their realism open to question.
- WildCode Revisited: prior alarm studies used purpose-generated code <https://arxiv.org/abs/2512.04259>

#### C25
A controlled study of subsequent evolution found no significant difference in completion time or code quality between AI-co-developed and human-written code.
- Echoes of AI: Downstream Effects of AI Assistants on Software Maintainability <https://arxiv.org/abs/2507.00788>

#### C26
Comparing like for like, human-written code showed a greater variety of security problems than GPT-4 code; the generated code differed by containing more severe outliers, not more defects.
- Comparing Human and LLM Generated Code: The Jury is Still Out! <https://arxiv.org/abs/2501.16857>


Each claim carries a verbatim quote from its source in the corpus manifest, and every source is pinned by sha256 against the bytes that were scraped, so a claim can be checked against what was actually published rather than against a paraphrase of it.
