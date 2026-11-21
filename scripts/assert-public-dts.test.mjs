// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { withGuardFixture } from './guardFixture.test-utils.mjs'

const guard = new URL('./assert-public-dts.mjs', import.meta.url)
const dtoNames = [
  'AtdlStrategyDto',
  'AtdlStrategyEditDto',
  'AtdlParameterDto',
  'AtdlEnumPairDto',
  'AtdlListItemDto',
  'AtdlControlDto',
  'AtdlPanelDto',
  'AtdlPanelChildDto',
  'AtdlStateRuleDto',
  'StateRuleAstNodeDto',
]
const typesDeclaration = (names) => names.map((name) => `export interface ${name} {}`).join('\n')

function runDts({ types = typesDeclaration(dtoNames), files = {} }, inspect) {
  withGuardFixture(guard, (fixture) => {
    fixture.write('dist/index.d.ts', "export type * from './types.js';\n")
    fixture.write('dist/types.d.ts', types)
    for (const [name, content] of Object.entries(files)) fixture.write(name, content)
    const result = fixture.run()
    expect(result.error).toBeUndefined()
    expect(result.signal).toBeNull()
    inspect(result)
  })
}

describe('the actual public declaration guard', () => {
  it('pins the DTO names re-exported through export type *', () => {
    runDts({ types: typesDeclaration(dtoNames) }, (result) => {
      expect(result.stderr).not.toContain('AtdlStrategyDto')
    })
  })

  it('fails when a DTO type disappears from the wildcard re-export', () => {
    runDts(
      { types: typesDeclaration(dtoNames.filter((name) => name !== 'AtdlParameterDto')) },
      (result) => {
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('dist/index.d.ts does not export AtdlParameterDto')
      },
    )
  })

  it('reports a leaked fixture declaration by its path relative to dist', () => {
    runDts({ files: { 'dist/__fixtures__/leak.d.ts': 'export {}\n' } }, (result) => {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('leaked into the build: __fixtures__/leak.d.ts\n')
    })
  })

  it('fails when an unintended type is added through the wildcard re-export', () => {
    runDts({ types: typesDeclaration([...dtoNames, 'InternalLeak']) }, (result) => {
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('exports InternalLeak, which is not in the intended')
    })
  })
})
