// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withGuardFixture } from './guardFixture.test-utils.mjs'

const guard = new URL('./assert-no-side-effects.mjs', import.meta.url)

function runBundle(source, inspect) {
  withGuardFixture(guard, (fixture) => {
    fixture.write('package.json', '{ "type": "module" }\n')
    fixture.write('dist/index.js', source)
    const result = fixture.run()
    expect(result.error).toBeUndefined()
    expect(result.signal).toBeNull()
    inspect(result)
  })
}

describe('the actual import side-effect guard', () => {
  it('accepts an import-clean ESM bundle', () => {
    runBundle('export const answer = 42\n', (result) => {
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('imports with no console output and no global mutations')
      expect(result.stderr).toBe('')
    })
  })

  // Removing the real writes assertion must let these invalid bundles through,
  // making the expected non-zero exit fail. Each intercepted method is observable.
  it.each(['log', 'info', 'warn', 'error', 'debug'])(
    'rejects module-level console.%s',
    (method) => {
      runBundle(`console.${method}('fixture-output')\n`, (result) => {
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('module-level console output during import')
        expect(result.stderr).toContain(`${method}: fixture-output`)
      })
    },
  )

  it('rejects a global added while importing the bundle', () => {
    runBundle('globalThis.fixatdlFixtureLeak = true\n', (result) => {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('module-level global mutations during import')
      expect(result.stderr).toContain('fixatdlFixtureLeak')
    })
  })

  it('rejects an ESM bundle that throws during import', () => {
    runBundle("throw new Error('fixture-import-failed')\n", (result) => {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('dist/index.js threw on import')
      expect(result.stderr).toContain('fixture-import-failed')
    })
  })
})
