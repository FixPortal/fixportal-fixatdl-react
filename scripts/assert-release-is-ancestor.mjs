// Asserts the commit being released sits on main, so a tag cut from a side branch
// can never publish. Extracted from the inline `git merge-base --is-ancestor HEAD
// FETCH_HEAD` step in ci.yml's publish job, so the check is covered by an automated
// test rather than only ever exercised by a real release.
//
// G1 (2026-09-25 test audit) overrides the note this file used to carry, which said
// this check was deliberately NOT extracted because testing it meaningfully needs a
// real repository with fabricated ancestor and non-ancestor refs. That is exactly
// what assert-release-is-ancestor.test.mjs now builds: a temp git repo, one commit
// off main (ancestor) and one commit off a diverged branch (non-ancestor), asserting
// the real `git merge-base --is-ancestor` exit code.
import { execFileSync } from 'node:child_process'

/**
 * True when `ref` is an ancestor of `ofRef` (i.e. `ref`'s history is reachable from
 * `ofRef`), using the real `git merge-base --is-ancestor` exit code: 0 = ancestor,
 * 1 = not an ancestor. Any other exit code (bad refs, not a repo, etc.) is a real
 * error and is rethrown rather than swallowed as "not an ancestor".
 */
export function isAncestor(cwd, ref, ofRef) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ref, ofRef], { cwd, stdio: 'pipe' })
    return true
  } catch (error) {
    if (error.status === 1) {
      return false
    }
    throw error
  }
}

// Only run the check when invoked as a script, so the test can import the pure
// wrapper without needing HEAD/FETCH_HEAD to exist.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('assert-release-is-ancestor.mjs')) {
  if (!isAncestor(process.cwd(), 'HEAD', 'FETCH_HEAD')) {
    console.error('FAIL release: HEAD is not an ancestor of origin/main (release must be cut from main)')
    process.exit(1)
  }
  console.log('OK release: HEAD is an ancestor of origin/main')
}
