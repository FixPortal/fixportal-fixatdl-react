// @vitest-environment node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseDocument } from 'yaml'
import { withGuardFixture } from './guardFixture.test-utils.mjs'

const tagGuard = new URL('./assert-tag-matches-version.mjs', import.meta.url)
const ancestorGuard = new URL('./assert-release-is-ancestor.mjs', import.meta.url)
const manifest = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
const version = JSON.parse(manifest).version

function assertChild(result, status, message) {
  expect(result.error).toBeUndefined()
  expect(result.signal).toBeNull()
  expect(result.status).toBe(status)
  expect(status === 0 ? result.stdout : result.stderr).toContain(message)
  expect(result.stderr).not.toMatch(/SyntaxError|ReferenceError|ENOENT/)
}

describe('actual release guard CLI entry points', () => {
  it.each([
    { ref: `v${version}`, status: 0, message: `OK release tag v${version}` },
    { ref: 'v0.0.0-audit-mismatch', status: 1, message: 'FAIL release tag: tag' },
    { ref: '', status: 1, message: 'GITHUB_REF_NAME is empty' },
  ])('tag $ref exits $status with a diagnostic', ({ ref, status, message }) => {
    withGuardFixture(tagGuard, ({ write, run }) => {
      write('package.json', manifest)
      assertChild(run({ env: { GITHUB_REF_NAME: ref } }), status, message)
    })
  })

  it.each([
    { branch: 'main', status: 0, message: 'OK release: HEAD is an ancestor' },
    { branch: 'release', status: 0, message: 'OK release: HEAD is an ancestor' },
    { branch: 'side', status: 1, message: 'FAIL release: HEAD is not an ancestor' },
  ])('ancestor CLI checks $branch against a real FETCH_HEAD', ({ branch, status, message }) => {
    withGuardFixture(ancestorGuard, ({ root, write, run }) => {
      write('empty-git-config', '')
      write('empty-hooks/.owner', 'fixture')
      const env = {
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: join(root, 'empty-git-config'),
      }
      const git = (...args) =>
        execFileSync(
          'git',
          [
            '-c',
            'user.name=Release guard fixture',
            '-c',
            'user.email=fixture@example.invalid',
            '-c',
            'commit.gpgsign=false',
            '-c',
            `core.hooksPath=${join(root, 'empty-hooks')}`,
            '-c',
            'protocol.file.allow=always',
            ...args,
          ],
          {
            cwd: root,
            env: { ...process.env, ...env },
            encoding: 'utf8',
            timeout: 15_000,
            stdio: 'pipe',
          },
        )
      git('init', '-q', '-b', 'main')
      write('history.txt', 'base')
      git('add', 'history.txt')
      git('commit', '-q', '-m', 'base')
      git('branch', 'release')
      write('history.txt', 'main advance')
      git('add', 'history.txt')
      git('commit', '-q', '-m', 'main advances')
      // Fetch only from this owned local fixture. The CLI must see a real FETCH_HEAD.
      git('fetch', '-q', root, 'main')
      if (branch === 'side') {
        git('checkout', '-q', '-b', 'side', 'release')
        write('side.txt', 'not on main')
        git('add', 'side.txt')
        git('commit', '-q', '-m', 'diverged side')
      } else {
        git('checkout', '-q', branch)
      }
      assertChild(run({ env }), status, message)
    })
  })
})

function parseWorkflow(text) {
  const document = parseDocument(text, { uniqueKeys: true })
  assert.equal(document.errors.length, 0, 'workflow must parse without YAML errors')
  return document.toJS()
}

function assertPublishContract(workflow) {
  const gate = workflow.jobs['ci-gate']
  const publish = workflow.jobs.publish
  const dependencies = (value) => (Array.isArray(value) ? value : [value])
  assert.ok(dependencies(publish.needs).includes('ci-gate'), 'publish must depend on CI Gate')
  for (const job of ['package', 'package-node22', 'gate-coverage']) {
    assert.ok(dependencies(gate.needs).includes(job), `CI Gate must depend on ${job}`)
  }
  assert.match(publish.if, /github\.event_name\s*==\s*'push'/, 'publish must require a push')
  assert.match(
    publish.if,
    /startsWith\(github\.ref,\s*'refs\/tags\/v'\)/,
    'publish must require a version tag',
  )
  const steps = publish.steps
  const commandIndex = (command) => {
    const matches = steps.flatMap((step, index) =>
      typeof step.run === 'string' && step.run.split('\n').some((line) => line.trim() === command)
        ? [index]
        : [],
    )
    assert.equal(matches.length, 1, `exactly one executable step must call ${command}`)
    const step = steps[matches[0]]
    assert.equal(step.if, undefined, `${command} must not be conditionally skipped`)
    assert.notEqual(step['continue-on-error'], true, `${command} must fail closed`)
    return matches[0]
  }
  const fetch = commandIndex('git fetch --no-tags origin main')
  const ancestor = commandIndex('node scripts/assert-release-is-ancestor.mjs')
  const tag = commandIndex('node scripts/assert-tag-matches-version.mjs')
  const publishing = commandIndex('npm publish --access public --provenance')
  assert.ok(fetch < ancestor, 'main must be fetched before the ancestry guard')
  assert.ok(ancestor < publishing && tag < publishing, 'both guards must precede npm publish')
}

const workflowText = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

describe('parsed publish workflow calls the actual fail-closed gates', () => {
  it('retains dependencies, fetch and guard calls before publishing', () => {
    assertPublishContract(parseWorkflow(workflowText))
  })
})
