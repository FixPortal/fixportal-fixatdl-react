import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  boundedRun,
  ensureCompatibility,
  ownedDirectory,
  sha,
  targets,
} from './assert-stryker-compat.mjs'

const originals = targets.map(([name, original]) => {
  const text = fs
    .readFileSync(`node_modules/@stryker-mutator/vitest-runner/dist/src/${name}`, 'utf8')
    .replace(
      "return nameParts.filter((part) => part !== '').join(' > ').trim();",
      "return nameParts.join(' ').trim();",
    )
  if (sha(text) !== original) throw new Error('Unknown installed test input')
  return text
})
const owned = []
afterEach(() => {
  for (const root of owned.splice(0)) {
    if (
      !path.basename(root).startsWith('owned-stryker-guard-') ||
      path.dirname(root) !== fs.realpathSync(os.tmpdir())
    )
      throw new Error('Cleanup ownership mismatch')
    console.log(`Removing current-test fixture: ${root}`)
    fs.rmSync(root, { recursive: true })
  }
})
function fixture() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'owned-stryker-guard-'))
  owned.push(root)
  for (const [name, version] of Object.entries({
    '@stryker-mutator/core': '10.0.0',
    '@stryker-mutator/vitest-runner': '10.0.0',
    '@stryker-mutator/typescript-checker': '10.0.0',
    vitest: '5.0.3',
    typescript: '6.0.3',
  })) {
    const dir = path.join(root, 'node_modules', name)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }))
  }
  const files = targets.map(([name], index) => {
    const file = path.join(root, 'node_modules/@stryker-mutator/vitest-runner/dist/src', name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, originals[index])
    return file
  })
  return { root, files }
}
describe('guarded runner compatibility', () => {
  it('patches both exact files and is idempotent', () => {
    const { root, files } = fixture()
    ensureCompatibility(root)
    expect(files.map((file) => sha(fs.readFileSync(file)))).toEqual(
      targets.map((target) => target[2]),
    )
    expect(ensureCompatibility(root)).toHaveLength(2)
  })
  it('rejects an unknown second file before writing the first', () => {
    const { root, files } = fixture()
    fs.appendFileSync(files[1], '// unknown')
    expect(() => ensureCompatibility(root)).toThrow('Unknown runner hash')
    expect(sha(fs.readFileSync(files[0]))).toBe(targets[0][1])
  })
  it.each([0, 1])('rejects mixed state with patched copy %s', (index) => {
    const { root, files } = fixture()
    ensureCompatibility(root)
    fs.writeFileSync(files[1 - index], originals[1 - index])
    expect(() => ensureCompatibility(root)).toThrow('Mixed runner patch state')
    expect(sha(fs.readFileSync(files[1 - index]))).toBe(targets[1 - index][1])
  })
  it('rejects unsupported versions without writing', () => {
    const { root, files } = fixture()
    fs.writeFileSync(path.join(root, 'node_modules/vitest/package.json'), '{"version":"5.0.4"}')
    expect(() => ensureCompatibility(root)).toThrow('Unsupported vitest')
    expect(sha(fs.readFileSync(files[0]))).toBe(targets[0][1])
  })
  it.each(['.mutation-canary-tmp', 'reports'])(
    'rejects a symlink escape through %s before creating children',
    (parent) => {
      const { root } = fixture()
      const outside = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), 'owned-stryker-guard-'),
      )
      owned.push(outside)
      fs.symlinkSync(outside, path.join(root, parent), 'dir')
      expect(() => ownedDirectory(root, `${parent}/child`)).toThrow('Path escapes project')
      expect(fs.readdirSync(outside)).toEqual([])
    },
  )
  it('rejects a package file escaping project-local modules', () => {
    const { root, files } = fixture()
    const outside = path.join(root, 'outside.js')
    fs.writeFileSync(outside, originals[0])
    fs.unlinkSync(files[0])
    fs.symlinkSync(outside, files[0])
    expect(() => ensureCompatibility(root)).toThrow('Path escapes project')
    expect(sha(fs.readFileSync(files[1]))).toBe(targets[1][1])
  })
})

it('requires the real canary in both supported Node jobs and mutation entrypoint', () => {
  const workflow = parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'))
  for (const job of ['package', 'package-node22']) {
    const steps = workflow.jobs[job].steps
    const install = steps.findIndex((step) => step.run === 'npm ci')
    const canaries = steps.filter(
      (step) => step.run === 'node scripts/assert-stryker-compat.mjs --canary',
    )
    expect(install).toBeGreaterThanOrEqual(0)
    expect(workflow.jobs[job].if).toBeUndefined()
    expect(workflow.jobs[job]['continue-on-error']).toBeUndefined()
    expect(canaries).toHaveLength(1)
    expect(steps.indexOf(canaries[0])).toBeGreaterThan(install)
    expect(canaries[0].if).toBeUndefined()
    expect(canaries[0]['continue-on-error']).toBeUndefined()
    expect(workflow.jobs['ci-gate'].needs).toContain(job)
  }
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  expect(manifest.scripts['test:mutation']).toBe('node scripts/assert-stryker-compat.mjs --run')
  const mutation = parse(fs.readFileSync('.github/workflows/mutation.yml', 'utf8'))
  expect(
    Object.values(mutation.jobs).some(
      (job) =>
        job['timeout-minutes'] === 30 &&
        job.steps.some((step) => step.run === 'npm run test:mutation'),
    ),
  ).toBe(true)
})

for (const [label, body, expected] of [
  ['zero', 'process.exitCode = 0', 0],
  ['nonzero', 'process.exitCode = 7', 7],
  ['signal', "process.kill(process.pid, 'SIGTERM')", 1],
]) {
  it(`propagates actual full-run ${label} child exit`, async () => {
    const { root } = fixture()
    const cli = path.join(root, 'owned-cli.mjs')
    const driver = path.join(root, 'owned-driver.mjs')
    fs.writeFileSync(cli, body)
    const production = pathToFileURL(path.resolve('scripts/assert-stryker-compat.mjs')).href
    fs.writeFileSync(
      driver,
      `import { runMutation } from ${JSON.stringify(production)};
process.exitCode = await runMutation(${JSON.stringify(root)}, ${JSON.stringify(cli)});
`,
    )
    const result = await boundedRun([driver], process.cwd(), process.env, 5_000)
    assert.equal(result.code, expected, result.output.toString('utf8'))
  })
}
