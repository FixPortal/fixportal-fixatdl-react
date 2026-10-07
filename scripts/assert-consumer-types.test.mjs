import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { scopedTypeDiagnostics } from './assert-consumer-types.mjs'

const nodeNext = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext }

function fixture(importSpecifier) {
  const root = mkdtempSync(join(tmpdir(), 'fixatdl-consumer-types-'))
  mkdirSync(join(root, 'dist'))
  writeFileSync(join(root, 'package.json'), '{ "type": "module" }\n')
  writeFileSync(join(root, 'dist', 'types.d.ts'), 'export interface AtdlStrategyDto { name: string }\n')
  writeFileSync(join(root, 'dist', 'FormRenderer.d.ts'), `import type { AtdlStrategyDto } from '${importSpecifier}'\nexport interface FormRendererProps { strategy: AtdlStrategyDto }\n`)
  writeFileSync(join(root, 'consumer.ts'), 'import type { FormRendererProps } from \'./dist/FormRenderer.js\'\nexport const marker: FormRendererProps | null = null\n')
  return root
}

describe('consumer declaration resolution', () => {
  // A cold TypeScript compile on a busy CI runner has exceeded the 5s default.
  it('reports an extensionless relative import under NodeNext', () => {
    const root = fixture('./types')
    try {
      const problems = scopedTypeDiagnostics(root, [join(root, 'consumer.ts')], nodeNext)
      expect(problems.join('\n')).toMatch(/explicit file extensions/i)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)

  it('accepts the same import once it ends in .js', () => {
    const root = fixture('./types.js')
    try {
      expect(scopedTypeDiagnostics(root, [join(root, 'consumer.ts')], nodeNext)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 30_000)
})
