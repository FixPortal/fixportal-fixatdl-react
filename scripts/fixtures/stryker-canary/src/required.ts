export function isUnfilledAtdlValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    // Keep the independently checked null/undefined branch separate from empty containers.
    isEmptyOptionalValue(value)
  )
}

export function requiredErrors(value: unknown): string[] {
  return isUnfilledAtdlValue(value) ? ['This field is required.'] : []
}

function isEmptyOptionalValue(value: unknown): boolean {
  return value === '' || (Array.isArray(value) && value.length === 0)
}
