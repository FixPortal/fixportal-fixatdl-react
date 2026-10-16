// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import ts from 'typescript'
import { parseDocument } from 'yaml'

it('requires fresh emission inputs/output on the actual producer invocation', () => {
  const entry = ts.createSourceFile(
    'test-producer-contract.mjs',
    readFileSync(new URL('./test-producer-contract.mjs', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  )
  const statements = entry.statements.find(ts.isTryStatement).tryBlock.statements
  const invocation = statements
    .filter(ts.isExpressionStatement)
    .map((statement) => statement.expression)
    .find(
      (call) =>
        ts.isCallExpression(call) &&
        call.expression.getText(entry) === 'run' &&
        call.arguments[0].text === 'dotnet',
    )
  expect(invocation).toBeDefined()
  const args = invocation.arguments[1]
  expect(ts.isArrayLiteralExpression(args)).toBe(true)
  expect(args.elements.slice(-3).map((element) => element.getText(entry))).toEqual([
    'output',
    "path.resolve('contract-tests/emission-cases.json')",
    'emissionOutput',
  ])
  const environment = []
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(entry) === 'PRODUCER_EMISSION_JSON') {
      environment.push(node.initializer.getText(entry))
    }
    ts.forEachChild(node, visit)
  }
  visit(entry)
  expect(environment).toEqual(['emissionOutput'])
})

it('keeps emitter parity in the required ten-minute pinned producer lane', () => {
  const workflow = parseDocument(
    readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
    { uniqueKeys: true },
  )
  expect(workflow.errors).toEqual([])
  const ci = workflow.toJS()
  const job = ci.jobs['producer-contract']
  expect(job['timeout-minutes']).toBe(10)
  expect(job.if).toBeUndefined()
  expect(job['continue-on-error']).toBeUndefined()
  expect(ci.jobs['ci-gate'].needs).toContain('producer-contract')
  const runs = job.steps.filter((step) => step.run === 'npm run test:producer-contract')
  expect(runs).toHaveLength(1)
  expect(runs[0].if).toBeUndefined()
  expect(runs[0]['continue-on-error']).toBeUndefined()
  expect(runs[0].env.FIXATDL_SOURCE_ROOT).toBe('${{ github.workspace }}/producer')
  const checkout = job.steps.find((step) => step.with?.repository === 'FixPortal/fixportal-fixatdl')
  expect(checkout.with.ref).toBe('5411d52998b5b05621f2edb72fd0050c9729a91e')
  const config = ts.createSourceFile(
    'producer-contract.config.ts',
    readFileSync(new URL('../producer-contract.config.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const includes = []
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(config) === 'include') {
      includes.push(node.initializer.elements.map((element) => element.text))
    }
    ts.forEachChild(node, visit)
  }
  visit(config)
  expect(includes).toEqual([['contract-tests/*.test.tsx']])
  const policy = JSON.parse(
    readFileSync(new URL('../.claude/review-policy.json', import.meta.url), 'utf8'),
  )
  expect(policy.high).toContain('contract-tests/producer/Program.cs')
})
