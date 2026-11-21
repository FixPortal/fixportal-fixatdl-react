import { realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname } from 'node:path'

// Same check as assert-stryker-compat.test.mjs: the name prefix and the parent must
// match what the test's own mkdtempSync produced before anything is deleted. A target
// that was never assigned (failed setup) is skipped, never deleted.
export function removeOwnedTemp(dir, prefix) {
  if (!dir) return
  if (!basename(dir).startsWith(prefix) || realpathSync(dirname(dir)) !== realpathSync(tmpdir()))
    throw new Error(`Cleanup ownership mismatch: ${dir}`)
  console.info(`Removing current-test fixture: ${dir}`)
  rmSync(dir, { recursive: true, force: false })
}
