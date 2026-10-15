import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'

// These guards locate inputs beside import.meta.url. Copy their actual bytes into
// an owned tree, so assertions exercise the CLI rather than a rewritten predicate.
export function withGuardFixture(guardUrl, inspect) {
  const parent = realpathSync(tmpdir())
  const root = mkdtempSync(join(parent, 'fixatdl-guard-'))
  const witness = join(root, '.fixture-owner')
  const owner = randomUUID()
  // If this first write fails, leave the unverified directory alone.
  writeFileSync(witness, owner)

  function ownedPath(relative) {
    const path = resolve(root, relative)
    if (!path.startsWith(root + sep)) throw new Error('Fixture path escapes its owned root')
    return path
  }

  function write(relative, content) {
    const path = ownedPath(relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }

  let result
  let failure
  let failed = false
  try {
    const guard = ownedPath(`scripts/${basename(guardUrl.pathname)}`)
    mkdirSync(dirname(guard), { recursive: true })
    copyFileSync(guardUrl, guard)
    if (!readFileSync(guardUrl).equals(readFileSync(guard))) {
      throw new Error('The fixture must run an unchanged copy of the actual guard')
    }
    result = inspect({
      write,
      run: () =>
        spawnSync(process.execPath, [guard], {
          cwd: root,
          encoding: 'utf8',
          timeout: 15_000,
        }),
    })
  } catch (error) {
    failed = true
    failure = error
  }

  try {
    if (
      dirname(root) !== parent ||
      !basename(root).startsWith('fixatdl-guard-') ||
      lstatSync(root).isSymbolicLink() ||
      realpathSync(root) !== root ||
      !lstatSync(witness).isFile() ||
      lstatSync(witness).isSymbolicLink() ||
      readFileSync(witness, 'utf8') !== owner
    ) {
      throw new Error(`Refusing cleanup without positive fixture ownership: ${root}`)
    }
    console.info(`Removing owned guard fixture: ${root}`)
    rmSync(root, { recursive: true, force: false })
  } catch (cleanupError) {
    if (failed) {
      throw new AggregateError([failure, cleanupError], 'Fixture and cleanup both failed', {
        cause: cleanupError,
      })
    }
    throw cleanupError
  }
  if (failed) throw failure
  return result
}
