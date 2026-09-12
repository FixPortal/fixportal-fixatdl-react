/** Compare decimal text without rounding through JavaScript's binary number type. */
export function compareDecimals(left: unknown, right: unknown): number | null {
  const a = decimal(left)
  const b = decimal(right)
  if (!a || !b) return null
  const scale = Math.max(a.scale, b.scale)
  const x = a.coefficient * 10n ** BigInt(scale - a.scale)
  const y = b.coefficient * 10n ** BigInt(scale - b.scale)
  return x < y ? -1 : x > y ? 1 : 0
}

export function decimalInputValue(text: string): number | string | null {
  if (text === '') return null
  const number = Number(text)
  return compareDecimals(text, number) === 0 ? number : text
}

export function addDecimals(value: unknown, increment: unknown): string | null {
  const a = decimal(value)
  const b = decimal(increment)
  if (!a || !b) return null
  const scale = Math.max(a.scale, b.scale)
  const coefficient = a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale)
  return formatDecimal(String(coefficient), null, scale)
}

export function formatDecimal(value: unknown, precision?: number | null, shift = 0): string | null {
  const parsed = decimal(value)
  if (!parsed) return null
  let { coefficient, scale } = parsed
  scale += shift
  if (precision != null && Number.isInteger(precision) && precision >= 0 && precision <= 28 && scale > precision) {
    const divisor = 10n ** BigInt(scale - precision)
    const remainder = coefficient % divisor
    coefficient /= divisor
    if ((remainder < 0n ? -remainder : remainder) * 2n >= divisor) coefficient += remainder < 0n ? -1n : 1n
    scale = precision
  }
  if (scale < 0) return String(coefficient * 10n ** BigInt(-scale))
  const sign = coefficient < 0n ? '-' : ''
  const digits = String(coefficient < 0n ? -coefficient : coefficient).padStart(scale + 1, '0')
  return sign + (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits)
}

function decimal(value: unknown): { coefficient: bigint; scale: number } | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim()
  // Bound work at the payload boundary; .NET decimal has at most 29 significant digits.
  if (text.length > 128) return null
  const match = /^([+-]?)(\d+(?:,\d+)*|)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text)
  if (!match) return null
  const fraction = match[3] ?? ''
  if (!match[2] && !fraction) return null
  const exponent = Number(match[4] ?? 0)
  if (Math.abs(exponent) > 100) return null
  return { coefficient: BigInt(`${match[1]}${match[2].replaceAll(',', '')}${fraction}`), scale: fraction.length - exponent }
}
