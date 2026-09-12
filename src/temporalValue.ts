/** Canonical FIX date/time comparison; a time-only operand uses the other's date. */
export function compareTemporal(left: unknown, right: unknown): number | null {
  const a = parseTemporal(left)
  const b = parseTemporal(right)
  if (!a || !b) return null
  const x = `${a.date ?? b.date ?? '00010101'}-${a.time}`
  const y = `${b.date ?? a.date ?? '00010101'}-${b.time}`
  if (x === y) return 0
  return x < y ? -1 : 1
}

export function parseTemporal(value: unknown): { date: string | null; time: string } | null {
  if (typeof value !== 'string') return null
  const dateMatch = /^(\d{4})-?(\d{2})-?(\d{2})(?:[T-](.+))?$/.exec(value)
  let date: string | null = null
  if (dateMatch) {
    date = dateMatch[1] + dateMatch[2] + dateMatch[3]
    const probe = new Date(0)
    probe.setUTCFullYear(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
    if (probe.getUTCFullYear() < 1 || probe.toISOString().slice(0, 10).replaceAll('-', '') !== date) return null
  }
  const rawTime = dateMatch ? dateMatch[4] ?? '00:00:00' : value
  const time = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/.exec(rawTime)
  if (!time || Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3] ?? 0) > 59) return null
  return { date, time: `${time[1]}:${time[2]}:${time[3] ?? '00'}.${(time[4] ?? '').padEnd(7, '0')}` }
}


/** Tenor ordering follows core's nominal day magnitudes for different units. */
export function compareTenor(left: unknown, right: unknown): number | null {
  const a = parseTenor(left)
  const b = parseTenor(right)
  if (!a || !b) return null
  const days: Record<string, number> = { D: 1, W: 7, M: 30, Y: 365 }
  return a.offset * days[a.unit] - b.offset * days[b.unit]
}

export function normalizeTenor(value: unknown): string | null {
  const parsed = parseTenor(value)
  return parsed ? `${parsed.unit}${parsed.offset}` : null
}

function parseTenor(value: unknown): { unit: string; offset: number } | null {
  if (typeof value !== 'string') return null
  const match = /^([DWMY])\s*\+?(\d+)\s*$/.exec(value)
  if (!match) return null
  const offset = Number(match[2])
  return Number.isInteger(offset) && offset > 0 && offset <= 2147483647 ? { unit: match[1], offset } : null
}

/** Core orders mixed MonthYear suffixes by ordinal, then day/week presence. */
export function compareMonthYear(left: unknown, right: unknown): number | null {
  const a = parseMonthYear(left)
  const b = parseMonthYear(right)
  if (!a || !b) return null
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

export function normalizeMonthYear(value: unknown): string | null {
  return parseMonthYear(value) && typeof value === 'string' ? value : null
}

function parseMonthYear(value: unknown): number[] | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})(\d{2})(?:(\d{2})|w([1-5]))?$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = match[3] ? Number(match[3]) : null
  const week = match[4] ? Number(match[4]) : null
  if (month < 1 || month > 12) return null
  if (day !== null && (day < 1 || day > 31)) return null
  if (day !== null && year > 0) {
    const probe = new Date(0)
    probe.setUTCFullYear(year, month - 1, day)
    if (probe.getUTCMonth() !== month - 1) return null
  }
  return [year, month, day ?? (week ?? 0) * 7, day ?? -1, week ?? -1]
}

/** Normalizes a FIX timezone offset to a UTC wire value without reading now. */
export function normalizeTzTemporal(value: unknown, type?: string): string | null {
  if (typeof value !== 'string') return null
  const match = /^(.*)(Z|[+-]\d{2}(?::\d{2})?)$/.exec(value)
  if (!match && !/\d{2}:\d{2}:\d{2}/.test(value)) return null
  const parsed = parseTemporal(match?.[1] ?? value)
  if (!parsed) return null
  if (type === 'TZTimestamp_t' && !parsed.date) return null
  if (type === 'TZTimeOnly_t' && parsed.date) return null
  const offset = tzOffsetMinutes(match?.[2] ?? 'Z')
  if (offset === null) return null
  const date = parsed.date ?? '20000102'
  const probe = new Date(0)
  probe.setUTCFullYear(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)))
  probe.setUTCHours(Number(parsed.time.slice(0, 2)), Number(parsed.time.slice(3, 5)) - offset, Number(parsed.time.slice(6, 8)), 0)
  if (probe.getUTCFullYear() < 1 || probe.getUTCFullYear() > 9999) return null
  const iso = probe.toISOString()
  let fraction = parsed.time.slice(9)
  while (fraction.endsWith('0')) fraction = fraction.slice(0, -1)
  const time = iso.slice(11, 19) + (fraction ? `.${fraction}` : '')
  const prefix = parsed.date ? `${iso.slice(0, 10).replaceAll('-', '')}-` : ''
  return `${prefix}${time}Z`
}

function tzOffsetMinutes(value: string): number | null {
  if (value === 'Z') return 0
  const hour = Number(value.slice(1, 3))
  const minute = Number(value.slice(4) || 0)
  if (hour > 14 || minute > 59 || (hour === 14 && minute !== 0)) return null
  return (hour * 60 + minute) * (value[0] === '-' ? -1 : 1)
}

export function compareTzTemporal(left: unknown, right: unknown): number | null {
  const a = normalizeTzTemporal(left)
  const b = normalizeTzTemporal(right)
  return a && b ? compareTemporal(a.slice(0, -1), b.slice(0, -1)) : null
}
