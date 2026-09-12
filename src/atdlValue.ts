/**
 * A FIXatdl control value counts as "unfilled" when it is null, undefined, an
 * empty string, OR an empty array (an emptied multi-select). The array case is
 * easy to miss: without it a required multi-select passes validation once
 * emptied, and the FIX preview emitter writes a spurious empty 958/959/960
 * triplet. Kept in one place so validation and emission agree.
 */
export function isUnfilledAtdlValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}
