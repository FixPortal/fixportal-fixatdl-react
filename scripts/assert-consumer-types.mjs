// Compiles a fresh ESM consumer against the BUILT package, the way an outside
// project sees it: `import type { AtdlStrategyDto } from '@fix-portal/fixatdl-react'`
// resolved through package.json `exports` to dist/*.d.ts. It assigns, with no cast,
// the JSON FixPortal.FixAtdl.Contracts actually emits (null members omitted) and the
// non-.NET example in docs/getting-a-strategy.md. Runs under NodeNext and bundler
// resolution, because extensionless relative specifiers in the declarations pass
// bundler and fail NodeNext. Runs after `npm run build`, locally and in CI.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

// skipLibCheck would hide an extensionless relative import inside dist/*.d.ts.
// Diagnostics outside the consumer file and this package's dist are ignored so
// checking our declarations does not fail the gate on React's own types.
export function scopedTypeDiagnostics(rootDir, files, compilerOptions) {
  const program = ts.createProgram(files, { strict: true, noEmit: true, skipLibCheck: false, types: [], ...compilerOptions })
  const distPrefix = path.resolve(rootDir, 'dist') + path.sep
  const owned = new Set(files.map(file => path.resolve(file)))
  const problems = []
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const fileName = diagnostic.file?.fileName
    if (!fileName) continue
    const resolved = path.resolve(fileName)
    if (!owned.has(resolved) && !resolved.startsWith(distPrefix)) continue
    const where = path.relative(rootDir, resolved)
    problems.push(`${where}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  }
  return problems
}

function checkBuiltConsumerTypes() {
  const root = new URL('../', import.meta.url)
  const read = relativePath => readFileSync(new URL(relativePath, root), 'utf8')
  const problems = []

  if (!existsSync(new URL('dist/index.d.ts', root))) {
    console.error('FAIL consumer types: dist/index.d.ts is missing - run npm run build first')
    process.exit(1)
  }

  const docs = read('docs/getting-a-strategy.md')
  const docsExample = docs.slice(docs.indexOf('## Hosts that are not .NET')).match(/```json\n([\s\S]*?)\n```/)?.[1]
  if (!docsExample) problems.push('docs/getting-a-strategy.md has no ```json example under "Hosts that are not .NET"')

  const samples = {
    contractsPov: read('src/__fixtures__/contracts-pov-strategy.json'),
    docsExample: docsExample ?? '{}',
  }
  const consumer = [
    "import type { AtdlStrategyDto } from '@fix-portal/fixatdl-react'",
    ...Object.entries(samples).map(([name, json]) => `export const ${name}: AtdlStrategyDto = ${json.trim()}`),
  ].join('\n')

  // Inside node_modules so `@fix-portal/fixatdl-react` resolves through the workspace
  // link to this package, exactly as a dependency would.
  const dir = new URL('node_modules/.cache/consumer-types/', root)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  writeFileSync(new URL('package.json', dir), '{ "type": "module" }\n')
  const file = fileURLToPath(new URL('consumer.ts', dir))
  writeFileSync(file, consumer)

  const modes = {
    NodeNext: { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext },
    bundler: { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler },
  }
  for (const [mode, options] of Object.entries(modes)) {
    for (const message of scopedTypeDiagnostics(fileURLToPath(root), [file], options)) problems.push(`[${mode}] ${message}`)
  }
  rmSync(dir, { recursive: true, force: true })

  if (problems.length > 0) {
    console.error(problems.map(problem => `FAIL consumer types: ${problem}`).join('\n'))
    process.exit(1)
  }
  console.log('OK built declarations accept Contracts JSON and the docs example, uncast, under NodeNext and bundler')
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('assert-consumer-types.mjs')) {
  checkBuiltConsumerTypes()
}
