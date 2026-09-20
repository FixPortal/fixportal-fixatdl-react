import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { resolveStaticFile } from './browser-smoke.mjs'

describe('workbench smoke server path handling', () => {
  it('resolves assets inside the workbench build', () => {
    expect(resolveStaticFile(resolve('D:/workbench/dist'), '/index.html')).toBe(resolve('D:/workbench/dist/index.html'))
  })

  it('rejects assets outside the workbench build', () => {
    expect(resolveStaticFile(resolve('D:/workbench/dist'), '/../../secret.txt')).toBeNull()
  })
})
