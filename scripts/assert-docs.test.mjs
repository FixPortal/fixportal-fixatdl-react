import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkDocumentation, localLinkProblems } from './assert-docs.mjs'

describe('public documentation contract', () => {
  it('matches the package version, public exports, registry count, and local links', () => {
    expect(checkDocumentation()).toEqual([])
  })

  it('checks Markdown local links with titles, angle brackets, references, and root paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'fixatdl-docs-'))
    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(join(root, 'docs', 'api.md'), 'ok')
    try {
      const markdown = '[angle](<docs/api.md>) [title](docs/api.md "Title") [root](/docs/api.md)\n[ref]: docs/api.md\n[bad](%ZZ)'
      expect(localLinkProblems(root, 'README.md', markdown)).toEqual(['README.md -> %ZZ'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
