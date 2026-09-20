import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Read a repository file relative to the project root. */
function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

/** Return the public names exported by the package entry point. */
function publicExportNames() {
  const index = read('src/index.ts')
  const names = new Set()

  for (const match of index.matchAll(/export(?: type)? \{([^}]+)\}/g)) {
    for (const name of match[1].split(',')) {
      const cleaned = name.trim().split(/\s+as\s+/)[0]
      if (cleaned) names.add(cleaned)
    }
  }

  if (index.includes("export type * from './types'")) {
    for (const match of read('src/types.ts').matchAll(/^export (?:interface|type)\s+(\w+)/gm)) {
      names.add(match[1])
    }
  }

  return [...names].sort()
}

/** Find broken relative Markdown links in one document. */
function localLinkProblems(relativePath, markdown) {
  const problems = []
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1].split('#')[0]
    if (!link || /^(?:https?:|mailto:|#)/.test(link)) continue
    const target = fileURLToPath(new URL(link, pathToFileURL(join(root, relativePath))))
    if (!existsSync(target)) problems.push(`${relativePath} -> ${link}`)
  }
  return problems
}

/** Check that the public documentation matches the package contract. */
export function checkDocumentation() {
  const problems = []
  const manifest = JSON.parse(read('package.json'))
  const api = read('docs/api.md')
  const readme = read('README.md')
  const docs = [
    ['README.md', readme],
    ['docs/api.md', api],
    ['docs/getting-a-strategy.md', read('docs/getting-a-strategy.md')],
    ['docs/conformance.md', read('docs/conformance.md')],
    ['CONTRIBUTING.md', read('CONTRIBUTING.md')],
    ['SECURITY.md', read('SECURITY.md')],
    ['CHANGELOG.md', read('CHANGELOG.md')],
  ]

  const versionParts = manifest.version.split('.')
  const documentedVersion = `package ${versionParts[0]}.${versionParts[1]}.x`
  if (!api.includes(documentedVersion)) {
    problems.push(`docs/api.md does not name ${documentedVersion}`)
  }

  for (const name of publicExportNames()) {
    if (!new RegExp(`\\b${name}\\b`).test(api)) problems.push(`docs/api.md is missing public export ${name}`)
  }

  const registryNames = [...read('src/controls/controlRegistry.ts').matchAll(/^\s{2}(\w+_t):/gm)].map(match => match[1])
  const countPattern = new RegExp(`\\b${registryNames.length}\\b`)
  if (!countPattern.test(readme.match(/registry handles[^\n]+/)?.[0] ?? '')) {
    problems.push(`README.md does not document ${registryNames.length} registered control types`)
  }
  if (!new RegExp(`\\b${registryNames.length}\\b[^\\n]+supported names`).test(api)) {
    problems.push(`docs/api.md does not document ${registryNames.length} registered control types`)
  }

  for (const [file, markdown] of docs) problems.push(...localLinkProblems(file, markdown))
  return problems
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('assert-docs.mjs')) {
  const problems = checkDocumentation()
  if (problems.length > 0) {
    console.error(['FAIL documentation contract:', ...problems.map(problem => `- ${problem}`)].join('\n'))
    process.exit(1)
  }
  console.log('OK documentation contract matches the package exports, version, registry, and local links')
}
