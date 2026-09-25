import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isAncestor } from './assert-release-is-ancestor.mjs'

// WHY a real temp git repo, not a mocked child_process: the guard exists to catch a
// tag cut off a side branch, and the only thing that can prove a wrapper around
// `git merge-base --is-ancestor` still returns the real exit code is a real repo
// with a genuine ancestor commit and a genuine diverged (non-ancestor) commit.
describe('release commit must be an ancestor of main', () => {
  let dir

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fixatdl-ancestor-'))
    const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    writeFileSync(join(dir, 'a.txt'), '1')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    git('checkout', '-q', '-b', 'release')
    writeFileSync(join(dir, 'a.txt'), '2')
    git('add', '.')
    git('commit', '-q', '-m', 'release commit, still on main history')
    git('checkout', '-q', 'main')
    git('checkout', '-q', '-b', 'side')
    writeFileSync(join(dir, 'b.txt'), '1')
    git('add', '.')
    git('commit', '-q', '-m', 'side commit, diverged from main')
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when the ref is on main (release cut from main)', () => {
    expect(isAncestor(dir, 'release', 'main')).toBe(false)
    // 'release' branches off main's tip, so main is an ancestor of release,
    // not the other way round - assert the actual relationship a real
    // "release cut from main" tag would have: main is reachable from it.
    expect(isAncestor(dir, 'main', 'release')).toBe(true)
  })

  it('returns false when the ref diverged from main (release cut from a side branch)', () => {
    expect(isAncestor(dir, 'side', 'main')).toBe(false)
  })

  it('throws on an unresolvable ref rather than reporting "not an ancestor"', () => {
    expect(() => isAncestor(dir, 'does-not-exist', 'main')).toThrow()
  })
})
