// @vitest-environment node
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Resolve from the real consumer, so this checks the scoped override's native
// binding and glob translation together, rather than a substitute matcher.
// Tailwind 4.3.3 pins watcher 2.5.1, whose micromatch/braces chain carries
// GHSA-vfj7-8cjw-p6xm. Watcher 2.6.0 uses picomatch; keep the override scoped
// to Tailwind and qualify its supported ignore path/glob array contract here.
const require = createRequire(import.meta.url)
const tailwindRequire = createRequire(require.resolve('@tailwindcss/cli/package.json'))
const watcher = tailwindRequire('@parcel/watcher')

describe('Tailwind native watcher ignore compatibility', () => {
  it.each([
    ['no ignore', [], ['keep.css', 'skip.css', '.hidden.css', 'nested/keep.css', 'nested/skip.txt']],
    ['literal file', ['skip.css'], ['keep.css', '.hidden.css', 'nested/keep.css', 'nested/skip.txt']],
    ['literal directory', ['nested'], ['keep.css', 'skip.css', '.hidden.css']],
    ['recursive glob', ['**/*.css'], ['nested/skip.txt']],
    ['brace glob', ['**/*.{css,txt}'], []],
    ['dotfile glob', ['**/.*'], ['keep.css', 'skip.css', 'nested/keep.css', 'nested/skip.txt']],
    ['mixed array', ['skip.css', 'nested/**'], ['keep.css', '.hidden.css']],
  ])('%s', async (_name, ignore, expected) => {
    const root = await mkdtemp(join(tmpdir(), 'fixatdl-watcher-compat-'))
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith('fixatdl-watcher-compat-')) {
      throw new Error('Refusing cleanup outside the owned watcher fixture')
    }
    const watched = join(root, 'watched')
    const snapshot = join(root, 'snapshot')
    try {
      await mkdir(join(watched, 'nested'), { recursive: true })
      const options = { backend: 'brute-force', ignore }
      await watcher.writeSnapshot(watched, snapshot, options)
      for (const name of ['keep.css', 'skip.css', '.hidden.css', 'nested/keep.css', 'nested/skip.txt']) {
        await writeFile(join(watched, name), 'synthetic fixture')
      }
      const events = await watcher.getEventsSince(watched, snapshot, options)
      const files = events.filter(event => event.type === 'create' && !event.path.endsWith('nested'))
        .map(event => relative(watched, event.path).replaceAll('\\', '/')).sort()
      expect(files).toEqual([...expected].sort())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
