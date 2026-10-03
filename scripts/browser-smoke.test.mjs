import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createStaticServer, resolveStaticFile } from './browser-smoke.mjs'

describe('workbench smoke server path handling', () => {
  it('resolves assets inside the workbench build', () => {
    expect(resolveStaticFile(resolve('D:/workbench/dist'), '/index.html')).toBe(resolve('D:/workbench/dist/index.html'))
  })

  it('rejects assets outside the workbench build', () => {
    expect(resolveStaticFile(resolve('D:/workbench/dist'), '/../../secret.txt')).toBeNull()
  })

  it('returns 404 for missing files and keeps serving requests', async () => {
    const dist = mkdtempSync(resolve(tmpdir(), 'fixatdl-smoke-'))
    writeFileSync(resolve(dist, 'index.html'), 'ok')
    const server = createStaticServer(dist)
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected an HTTP address')
    try {
      const missing = await fetch(`http://127.0.0.1:${address.port}/missing.html`)
      expect(missing.status).toBe(404)
      const existing = await fetch(`http://127.0.0.1:${address.port}/index.html`)
      expect(await existing.text()).toBe('ok')
    } finally {
      await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
      rmSync(dist, { recursive: true, force: true })
    }
  })
})
