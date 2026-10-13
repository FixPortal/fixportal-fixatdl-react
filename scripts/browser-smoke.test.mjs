import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createStaticServer, resolveStaticFile } from './browser-smoke.mjs'

describe('workbench smoke server path handling', () => {
  const dist = resolve(tmpdir(), 'fixatdl-smoke-dist')

  it('resolves assets inside the workbench build', () => {
    expect(resolveStaticFile(dist, '/index.html')).toBe(resolve(dist, 'index.html'))
  })

  it('rejects assets outside the workbench build', () => {
    expect(resolveStaticFile(dist, '/../../secret.txt')).toBeNull()
  })

  it.each(['/%E0%A4%A', '/%2e%2e/secret.txt', '/..%2fsecret.txt'])('rejects malformed or encoded traversal %s', pathname => {
    expect(resolveStaticFile(dist, pathname)).toBeNull()
  })

  it('answers 403 for a rejected path and keeps serving', async () => {
    const root = mkdtempSync(resolve(tmpdir(), 'fixatdl-smoke-'))
    writeFileSync(resolve(root, 'index.html'), 'ok')
    const server = createStaticServer(root)
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected an HTTP address')
    try {
      expect((await fetch(`http://127.0.0.1:${address.port}/%E0%A4%A`)).status).toBe(403)
      expect((await fetch(`http://127.0.0.1:${address.port}/index.html`)).status).toBe(200)
    } finally {
      await new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
      rmSync(root, { recursive: true, force: true })
    }
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
