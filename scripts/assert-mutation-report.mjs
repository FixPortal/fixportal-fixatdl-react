import { readFileSync, writeFileSync } from 'node:fs'

const report = JSON.parse(readFileSync(process.argv[2] ?? 'reports/mutation/mutation.json', 'utf8'))
const config = JSON.parse(readFileSync('stryker.config.json', 'utf8'))
const { high, low, break: floor } = config.thresholds
if (
  ![floor, low, high].every(Number.isFinite) ||
  !(0 <= floor && floor <= low && low <= high && high <= 100)
) {
  throw new Error('Mutation thresholds must satisfy 0 <= break <= low <= high <= 100')
}
const counts = {
  Killed: 0,
  Timeout: 0,
  Survived: 0,
  NoCoverage: 0,
  CompileError: 0,
  RuntimeError: 0,
  Ignored: 0,
}
if (!report.files || typeof report.files !== 'object') throw new Error('Missing mutation files')
if (!Array.isArray(config.mutate) || config.mutate.length === 0) {
  throw new Error('Missing configured mutation scope')
}
const reported = Object.keys(report.files).sort()
const configured = [...config.mutate].sort()
if (
  reported.length !== configured.length ||
  reported.some((path, index) => path !== configured[index])
) {
  throw new Error('Report files do not match the configured mutation scope')
}
for (const file of Object.values(report.files)) {
  if (!Array.isArray(file.mutants)) throw new Error('Missing mutant results')
  for (const mutant of file.mutants) {
    if (!Object.hasOwn(counts, mutant.status)) {
      throw new Error(`Inconclusive mutant status: ${String(mutant.status)}`)
    }
    counts[mutant.status]++
  }
}
const valid = counts.Killed + counts.Timeout + counts.Survived + counts.NoCoverage
if (valid === 0) throw new Error('No valid mutants were tested')
if (counts.RuntimeError > 0) throw new Error('Mutation runner errors make this run inconclusive')
const score = ((counts.Killed + counts.Timeout) / valid) * 100
const summary = { valid, score, killedOnlyScore: (counts.Killed / valid) * 100, floor, counts }
writeFileSync('reports/mutation/summary.json', `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary))
if (score < floor) throw new Error(`Mutation score ${score.toFixed(2)} is below floor ${floor}`)
