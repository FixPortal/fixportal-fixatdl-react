// Compiles a fresh ESM consumer against the BUILT package, the way an outside
// project sees it: `import type { AtdlStrategyDto } from '@fix-portal/fixatdl-react'`
// resolved through package.json `exports` to dist/*.d.ts. It assigns, with no cast,
// the JSON FixPortal.FixAtdl.Contracts actually emits (null members omitted) and the
// non-.NET example in docs/getting-a-strategy.md. Runs under NodeNext and bundler
// resolution, because extensionless relative specifiers in the declarations pass
// bundler and fail NodeNext. Runs after `npm run build`, locally and in CI.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
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
  const program = ts.createProgram([file], { ...options, strict: true, noEmit: true, skipLibCheck: true, types: [] })
  for (const d of ts.getPreEmitDiagnostics(program)) {
    problems.push(`[${mode}] ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
  }
}
rmSync(dir, { recursive: true, force: true })

if (problems.length > 0) {
  console.error(problems.map(p => `FAIL consumer types: ${p}`).join('\n'))
  process.exit(1)
}
console.log('OK built declarations accept Contracts JSON and the docs example, uncast, under NodeNext and bundler')
