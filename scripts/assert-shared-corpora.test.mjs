// @vitest-environment node
import path from 'node:path'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { withGuardFixture } from './guardFixture.test-utils.mjs'

const guard = new URL('./assert-shared-corpora.mjs', import.meta.url)
const corpora = [
  ['contracts/state-rule-cases.json', 'contracts/state-rule-cases.json'],
  [
    'contracts/state-transitions.json',
    'tests/FixPortal.FixAtdl.Tests/Fixtures/Conformance/state-transitions.json',
  ],
]

function withCorpora(inspect) {
  withGuardFixture(guard, (fixture) => {
    for (const [consumer, producer] of corpora) {
      fixture.write(consumer, '{"cases":[{"name":"case","expected":false}]}')
      fixture.write(`producer/${producer}`, '{"cases":[{"expected":false,"name":"case"}]}')
    }
    inspect({
      ...fixture,
      check: () =>
        fixture.run({ env: { FIXATDL_SOURCE_ROOT: path.join(fixture.root, 'producer') } }),
    })
  })
}

describe('shared producer corpora CLI', () => {
  it('requires the producer entry to execute the guard unconditionally before its build', () => {
    const entry = ts.createSourceFile(
      'test-producer-contract.mjs',
      readFileSync(new URL('./test-producer-contract.mjs', import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    )
    const first = entry.statements.find(ts.isTryStatement)?.tryBlock.statements[0]
    expect(first?.kind).toBe(ts.SyntaxKind.ExpressionStatement)
    const call = first.expression
    expect(call.kind).toBe(ts.SyntaxKind.CallExpression)
    expect(call.expression.getText(entry)).toBe('run')
    expect(call.arguments[0].getText(entry)).toBe('process.execPath')
    expect(call.arguments[1].kind).toBe(ts.SyntaxKind.ArrayLiteralExpression)
    expect(call.arguments[1].elements.map((element) => element.text)).toEqual([
      'scripts/assert-shared-corpora.mjs',
    ])
  })

  it('accepts both matching corpora despite JSON formatting and object key order', () => {
    withCorpora((fixture) => {
      const result = fixture.check()
      expect(result.status).toBe(0)
      for (const [consumer] of corpora) expect(result.stdout).toContain(consumer)
    })
  })

  it.each(corpora)('rejects consumer semantic drift in %s', (consumer) => {
    withCorpora((fixture) => {
      fixture.write(consumer, '{"cases":[{"name":"case","expected":true}]}')
      const result = fixture.check()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`Shared corpus differs from pinned producer: ${consumer}`)
    })
  })

  it.each(corpora)('rejects producer semantic drift for %s', (consumer, producer) => {
    withCorpora((fixture) => {
      fixture.write(`producer/${producer}`, '{"cases":[{"name":"case","expected":true}]}')
      const result = fixture.check()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`Shared corpus differs from pinned producer: ${consumer}`)
    })
  })

  it.each(corpora)('rejects malformed consumer JSON in %s', (consumer) => {
    withCorpora((fixture) => {
      fixture.write(consumer, '{')
      const result = fixture.check()
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`Cannot read shared corpus ${consumer}`)
    })
  })

  it('requires an explicit pinned producer checkout', () => {
    withCorpora((fixture) => {
      const result = fixture.run({ env: { FIXATDL_SOURCE_ROOT: '' } })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('FIXATDL_SOURCE_ROOT must name the pinned producer checkout')
    })
  })
})
