// Asserts a release tag names exactly the version in package.json, so a tag can
// never publish a different version to the public registry. Extracted from an
// inline `node -e` one-liner in ci.yml's publish job: inline, it was untestable,
// and a publish to npm cannot be undone.
//
// The sibling guard in that job -- `git merge-base --is-ancestor HEAD FETCH_HEAD`,
// which requires the release to sit on main -- is deliberately NOT extracted.
// Testing it meaningfully needs a real repository with fabricated ancestor and
// non-ancestor refs, which is a large harness for a guard whose failure mode is
// "you tagged off a side branch". This check is a pure function of two strings and
// is the likelier of the two to be broken by a typo, so it is the one worth pinning.
import { readFileSync } from 'node:fs'

/**
 * Pure comparison so the rule is testable without a tag, a checkout, or a registry.
 * Returns null when the tag is valid, or the reason it is not.
 */
export function tagVersionMismatch(ref, version) {
  if (typeof ref !== 'string' || ref === '') {
    return 'no tag name was supplied (GITHUB_REF_NAME is empty) - refusing to publish'
  }
  if (typeof version !== 'string' || version === '') {
    return 'package.json has no version - refusing to publish'
  }
  const expected = `v${version}`
  if (ref !== expected) {
    return `tag ${ref} does not match package version ${version} (expected ${expected})`
  }
  return null
}

// Only run the check when invoked as a script, so the test can import the pure
// function without the module reading package.json or calling process.exit.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('assert-tag-matches-version.mjs')) {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const problem = tagVersionMismatch(process.env.GITHUB_REF_NAME, manifest.version)
  if (problem) {
    console.error(`FAIL release tag: ${problem}`)
    process.exit(1)
  }
  console.log(`OK release tag ${process.env.GITHUB_REF_NAME} matches package version ${manifest.version}`)
}
