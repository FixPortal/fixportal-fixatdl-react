import { describe, it, expect } from 'vitest'
import { tagVersionMismatch } from './assert-tag-matches-version.mjs'

// WHY these cases: each one is a way the inline `node -e` version of this check
// could have been typo'd into passing. A publish to the public registry cannot be
// undone, so the guard's own failure modes are the thing worth pinning.
describe('release tag must name the package version exactly', () => {
  it('accepts the exact v-prefixed version', () => {
    expect(tagVersionMismatch('v0.2.0', '0.2.0')).toBeNull()
  })

  it.each([
    ['v0.2.1', '0.2.0', 'a different patch'],
    ['v0.3.0', '0.2.0', 'a different minor'],
    ['v1.0.0', '0.2.0', 'a different major'],
    ['v0.2.0-rc.1', '0.2.0', 'a prerelease tag against a release version'],
    ['v0.2', '0.2.0', 'a truncated version'],
    ['v0.2.0.0', '0.2.0', 'an over-long version'],
  ])('rejects %s against %s (%s)', (ref, version) => {
    expect(tagVersionMismatch(ref, version)).not.toBeNull()
  })

  it('rejects a tag missing the v prefix', () => {
    // The ref filter in ci.yml only admits refs/tags/v*, so this should be
    // unreachable in practice - it is pinned because the comparison, not the
    // filter, is what guarantees it.
    expect(tagVersionMismatch('0.2.0', '0.2.0')).not.toBeNull()
  })

  it.each([undefined, '', null])('refuses to publish when the tag name is %s', ref => {
    // An unset GITHUB_REF_NAME must FAIL, never pass by comparing undefined to
    // undefined. This is the regression that would let any ref publish.
    expect(tagVersionMismatch(ref, '0.2.0')).not.toBeNull()
  })

  it.each([undefined, ''])('refuses to publish when package.json has version %s', version => {
    expect(tagVersionMismatch('v0.2.0', version)).not.toBeNull()
  })

  it('names both sides in the failure message so CI output is actionable', () => {
    const problem = tagVersionMismatch('v9.9.9', '0.2.0')
    expect(problem).toContain('v9.9.9')
    expect(problem).toContain('0.2.0')
  })
})
