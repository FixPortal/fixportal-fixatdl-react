import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const script = resolve('scripts/assert-mutation-report.mjs')
function run(statuses, thresholds = { high: 80, low: 55, break: 55 }, mutate = ['src/example.ts']) {
  const cwd = mkdtempSync(join(tmpdir(), 'mutation-report-contract-'))
  try {
    mkdirSync(join(cwd, 'reports/mutation'), { recursive: true })
    writeFileSync(join(cwd, 'stryker.config.json'), JSON.stringify({ thresholds, mutate }))
    writeFileSync(
      join(cwd, 'reports/mutation/mutation.json'),
      JSON.stringify({
        files: { 'src/example.ts': { mutants: statuses.map((status) => ({ status })) } },
      }),
    )
    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' })
    return {
      ...result,
      summary:
        result.status === 0
          ? JSON.parse(readFileSync(join(cwd, 'reports/mutation/summary.json'), 'utf8'))
          : null,
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}

describe('actual mutation report CLI', () => {
  it('runs the report guard after Stryker in the actual bounded weekly/manual workflow', () => {
    const workflow = parse(readFileSync('.github/workflows/mutation.yml', 'utf8'))
    expect(workflow.on).toHaveProperty('schedule')
    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(workflow.jobs.mutation['timeout-minutes']).toBe(30)
    const steps = workflow.jobs.mutation.steps
    const mutation = steps.findIndex((step) => step.run === 'npm run test:mutation')
    const guard = steps.findIndex((step) => step.run === 'node scripts/assert-mutation-report.mjs')
    expect(mutation).toBeGreaterThanOrEqual(0)
    expect(guard).toBeGreaterThan(mutation)
    expect(steps[guard]['continue-on-error']).not.toBe(true)
    const artifact = steps.find((step) => step.uses === 'actions/upload-artifact@v7')
    expect(artifact.if).toBe('always()')
    expect(artifact.with.path).toBe('reports/mutation/')
    expect(artifact.with['if-no-files-found']).toBe('error')
  })
  it('keeps compile errors and timeouts separate from ordinary kills', () => {
    const result = run(['Killed', 'Killed', 'Timeout', 'Survived', 'CompileError', 'Ignored'])
    expect(result.status).toBe(0)
    expect(result.summary).toMatchObject({
      valid: 4,
      score: 75,
      killedOnlyScore: 50,
      counts: { Killed: 2, Timeout: 1, CompileError: 1, Ignored: 1 },
    })
  })
  it.each([[], ['CompileError'], ['Ignored'], ['CompileError', 'Ignored']])(
    'rejects zero tested valid mutants: %j',
    (...statuses) => {
      const result = run(statuses)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('No valid mutants were tested')
    },
  )
  it('rejects an execution error even alongside killed mutants', () => {
    const result = run(['Killed', 'RuntimeError'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Mutation runner errors')
  })
  it.each(['Pending', 'NotRun', 'unknown'])('rejects inconclusive status %s', (status) => {
    const result = run(['Killed', status])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Inconclusive mutant status')
  })
  it('rejects a conclusive score below the measured floor', () => {
    const result = run(['Killed', 'Survived'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('below floor 55')
  })
  it('rejects a break threshold above low', () => {
    const result = run(['Killed'], { high: 80, low: 50, break: 55 })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Mutation thresholds must satisfy')
  })
  it.each([
    ['break', null],
    ['break', '55'],
    ['low', '55'],
    ['high', '80'],
    ['break', false],
  ])('rejects a nonnumeric %s threshold (%j)', (name, value) => {
    const result = run(['Killed'], { high: 80, low: 55, break: 55, [name]: value })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('Mutation thresholds must satisfy')
  })
  it.each([['src/example.ts', 'src/missing.ts'], ['src/other.ts'], []])(
    'rejects a report outside the configured scope: %j',
    (...mutate) => {
      const result = run(['Killed'], undefined, mutate)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('configured mutation scope')
    },
  )
})
