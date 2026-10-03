// Asserts the optional stylesheet published as `@fix-portal/fixatdl-react/styles.css`
// is present, reachable through the exports map, complete, and still minding its own
// business. Runs after `npm run build`, next to the other dist gates.
//
// Three distinct failures are in scope, and none of them is visible in a diff:
//
//  1. THE SCANNER STOPPED SEEING A CONTROL. Tailwind emits only the utilities it
//     finds by scanning source. If the `@source` path in styles/index.css drifts, or
//     a control starts composing a class name instead of writing it literally, the
//     utility silently disappears from the output and that control renders unstyled
//     for every host relying on this file. So the check is derived from the source
//     rather than hardcoded: every literal class name in src/**/*.tsx must have a
//     rule in the compiled CSS.
//
//  2. PREFLIGHT CAME BACK. `@import "tailwindcss"` pulls in Tailwind's base reset. A
//     library stylesheet that resets the host's margins, headings and form elements
//     is not optional in any useful sense, and the regression is one character of
//     edit away in styles/index.css.
//
//  3. THE EXPORTS ENTRY BROKE. `dist/styles.css` existing says nothing about whether
//     `@fix-portal/fixatdl-react/styles.css` resolves to it.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const cssPath = new URL('dist/styles.css', root)
const problems = []

if (!existsSync(cssPath)) {
  problems.push('dist/styles.css is missing - run npm run build first')
  report()
}

const css = readFileSync(cssPath, 'utf8')

// --- 1. every token the README documents as the contract -------------------
const TOKENS = [
  'text', 'muted', 'card', 'border-base', 'brand', 'brand-soft',
  'bad-text', 'bad-border', 'warn-bg', 'warn-border',
]
for (const token of TOKENS) {
  if (!css.includes(`--color-${token}:`)) {
    problems.push(`no default value for the documented token --color-${token}`)
  }
}

// --- 2. every class the controls actually emit -----------------------------
// Only literal className strings are collected. A class assembled at runtime from
// fragments would not be found by this scan OR by Tailwind's, which is the point:
// both see the same literals, so agreement here means agreement in the browser.
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`
    if (statSync(path).isDirectory()) yield* walk(path)
    else yield path
  }
}

const used = new Set()
for (const path of walk(fileURLToPath(new URL('src', root)))) {
  if (!path.endsWith('.tsx') || /\.(test|spec)\.tsx$/.test(path)) continue
  const source = readFileSync(path, 'utf8')
  // className="..." and the `const base = '...'` / template fragments beside it.
  for (const match of source.matchAll(/(?:className=|=\s*)(?:"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`)/g)) {
    const literal = match[1] ?? match[2] ?? match[3] ?? ''
    for (const candidate of literal.split(/[\s`]+/)) {
      // Skip template holes and anything that cannot be a utility.
      if (!candidate || candidate.includes('${') || !/^[a-z]/.test(candidate)) continue
      if (!/^[a-z0-9:[\]/.\-_]+$/.test(candidate)) continue
      used.add(candidate)
    }
  }
}

// A class only counts as "emitted by a control" when Tailwind recognises it at all;
// words like `button` or `submit` are caught by the literal scan and are not
// utilities. Checking membership against what Tailwind DID emit for the same source
// would be circular, so the assertion is narrowed to the utility families the
// controls are built from - the ones whose absence is a visible regression.
const REQUIRED_PREFIXES = [
  'space-y-', 'flex', 'items-', 'gap-', 'text-', 'border', 'rounded', 'px-', 'py-',
  'min-w-', 'accent-', 'bg-', 'outline', 'focus:', 'disabled:', 'cursor-', 'select-',
  'font-', 'block', 'w-full', 'ml-', 'mb-', 'p-',
]
const escapeClass = name => '.' + name.replace(/[[\]/.:]/g, ch => `\\${ch}`)
const missing = []
for (const candidate of [...used].sort()) {
  if (!REQUIRED_PREFIXES.some(prefix => candidate.startsWith(prefix))) continue
  if (!css.includes(escapeClass(candidate))) missing.push(candidate)
}
if (missing.length > 0) {
  problems.push(`src emits ${missing.length} class name(s) with no rule in dist/styles.css: ${missing.join(', ')}`)
}

// --- 3. no base reset ------------------------------------------------------
if (/@layer\s+base\s*\{/.test(css)) {
  problems.push('dist/styles.css contains a base layer - Tailwind preflight would reset the host page')
}

// --- 4. the exports entry resolves ----------------------------------------
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const entry = manifest.exports?.['./styles.css']
if (entry !== './dist/styles.css') {
  problems.push(`package.json exports["./styles.css"] is ${JSON.stringify(entry)}, expected "./dist/styles.css"`)
}
if (!(manifest.files ?? []).includes('dist')) {
  problems.push('package.json files does not include dist, so the stylesheet would not be packed')
}
// A published CSS entry point and `sideEffects: false` are incompatible: importing a
// stylesheet exports nothing, so webpack treats the import as dead code and drops it -
// the file resolves and applies no styles, with no error anywhere. The field has to
// keep exempting CSS, and nothing else in the repo would notice if it stopped.
if (manifest.sideEffects === false || !(manifest.sideEffects ?? []).some(pattern => pattern.endsWith('.css'))) {
  problems.push(`package.json sideEffects is ${JSON.stringify(manifest.sideEffects)}, which does not exempt CSS - a bundler may prune the stylesheet import`)
}

report()

function report() {
  if (problems.length > 0) {
    console.error(problems.map(problem => `FAIL dist/styles.css: ${problem}`).join('\n'))
    process.exit(1)
  }
  console.log(`OK dist/styles.css carries ${TOKENS.length} tokens and every emitted utility, with no preflight`)
}
