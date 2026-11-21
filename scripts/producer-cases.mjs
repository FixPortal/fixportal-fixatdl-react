// An empty corpus would make the producer type step compile a bare type import and
// pass; fail early with the cause named instead of a later TypeError.
export function assertProducerCases(cases) {
  if (!Array.isArray(cases) || cases.length === 0)
    throw new Error('Producer emitted no samples; the type step would check nothing')
  for (const sample of cases) {
    if (!sample.contract?.strategies?.length)
      throw new Error(`Producer sample ${sample.source} has no strategies`)
  }
}
