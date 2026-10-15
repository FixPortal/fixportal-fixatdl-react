# Test audit: decimal bounds, prototype boundaries and release gates

Original Critical A8, B3 and G6 now have 25 additional tests. Decimal cases pin valid 128/129-character inputs, exponent ±100/±101 and precision 28/29. Prototype cases use ordinary objects with inherited left/right fields, comparer names and control values, plus own-property controls.

Release tests spawn byte-identical copies of actual CLI guards against valid, mismatched and empty tags and real local Git histories/FETCH_HEAD. Parsed actual CI YAML must retain package lanes, gate dependencies, fetch, executable guard calls, ordering and fail-closed behavior before publishing. No release is performed.

Eighteen deliberate guest-only mutations each failed intended assertions. Restored full suite: 43 files, 694 passed, zero failures/skips. Coverage: 94.53% statements, 89.55% branches, 99.48% functions, 95.8% lines; floors unchanged. Typecheck, lint, build, pack dry-run, all five distribution guards and formatting passed. Full lint retains 116 existing advisories; changed files have none.

YAML is now a direct development dependency at its existing locked 2.9.1 version. Existing lock entries are unchanged. Production code and workflows are byte-identical. Tests ran in an owned Node 22 guest without host mounts or credentials. Original F4 cross-runtime producer coverage remains open.
