import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { devNull, tmpdir } from 'node:os'
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
    const git = (...args) => execFileSync('git', args, {
      cwd: dir,
      stdio: 'pipe',
      env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : devNull, GIT_CONFIG_NOSYSTEM: '1' },
    })
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    writeFileSync(join(dir, 'a.txt'), '1')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    const base = git('rev-parse', 'HEAD').toString().trim()
    writeFileSync(join(dir, 'a.txt'), '2')
    git('add', '.')
    git('commit', '-q', '-m', 'release commit, merged into main')
    git('branch', '-q', 'release', 'main')
    writeFileSync(join(dir, 'a.txt'), '3')
    git('add', '.')
    git('commit', '-q', '-m', 'main advances after release')
    git('checkout', '-q', '-b', 'side', base)
    writeFileSync(join(dir, 'b.txt'), '1')
    git('add', '.')
    git('commit', '-q', '-m', 'side commit, diverged from main')
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns true when the release commit is an ancestor of main (release cut from main)', () => {
    // Same (ref, ofRef) order the production call uses: isAncestor(cwd, 'HEAD', 'FETCH_HEAD').
    expect(isAncestor(dir, 'release', 'main')).toBe(true)
  })

  it('returns false when the ref diverged from main (release cut from a side branch)', () => {
    expect(isAncestor(dir, 'side', 'main')).toBe(false)
  })

  it('throws on an unresolvable ref rather than reporting "not an ancestor"', () => {
    expect(() => isAncestor(dir, 'does-not-exist', 'main')).toThrow()
  })
})
