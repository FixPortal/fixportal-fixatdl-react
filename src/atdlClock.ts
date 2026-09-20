import type { AtdlControlDto } from './types'

/** Keeps a loaded instant intact when a displayed clock crosses a DST overlap. */
export interface ClockValue {
  kind: 'atdl-clock'
  instant: string
  localDateTime: string
}

function isClockValue(value: unknown): value is ClockValue {
  if (typeof value !== 'object' || value === null) return false
  if (!('kind' in value) || value.kind !== 'atdl-clock') return false
  if (!('instant' in value) || typeof value.instant !== 'string') return false
  return 'localDateTime' in value && typeof value.localDateTime === 'string'
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0')

function utcText(milliseconds: number, fraction?: string): string {
  const date = new Date(milliseconds)
  const suffix = fraction ?? (date.getUTCMilliseconds() ? `.${pad(date.getUTCMilliseconds(), 3)}` : '')
  return `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}${suffix}`
}

function utcEpoch(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond = 0): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, millisecond)
  return date.getTime()
}

function zoneEpoch(milliseconds: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(milliseconds))
  const part = (name: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === name)?.value)
  return utcEpoch(part('year'), part('month'), part('day'), part('hour'), part('minute'), part('second')) +
    ((milliseconds % 1000) + 1000) % 1000
}

function parseClock(raw: string, date?: string): { epoch: number; fraction: string; offsetMinutes?: number } {
  const suffix = /(Z|[+-]\d{2}(?::\d{2})?)$/.exec(raw)?.[1]
  let offsetMinutes: number | undefined
  let input = raw
  if (suffix && raw.slice(0, -suffix.length).includes(':')) {
    input = raw.slice(0, -suffix.length)
    offsetMinutes = 0
    if (suffix !== 'Z') {
      const hours = Number(suffix.slice(1, 3))
      const minutes = Number(suffix.slice(4, 6) || 0)
      if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) throw new Error(`Invalid clock timezone offset: ${suffix}`)
      offsetMinutes = (hours * 60 + minutes) * (suffix[0] === '-' ? -1 : 1)
    }
  }
  const canonicalInput = input.replace(/^(\d{4})-(\d{2})-(\d{2})T/, '$1$2$3-')
  const match = /^(?:(\d{4})(\d{2})(\d{2})-)?(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,7})?)?$/.exec(canonicalInput)
  if (!match) throw new Error(`Invalid FIXatdl clock value: ${raw}`)
  const day = match[1] ? `${match[1]}${match[2]}${match[3]}` : date
  if (!day) throw new Error('A host clock is required to resolve a time-only clock value.')
  const fraction = match[7] ?? ''
  const epoch = utcEpoch(Number(day.slice(0, 4)), Number(day.slice(4, 6)), Number(day.slice(6, 8)),
    Number(match[4]), Number(match[5]), Number(match[6] ?? 0), Number(`${fraction.slice(1)}000`.slice(0, 3)))
  const canonical = `${day}-${match[4]}:${match[5]}:${match[6] ?? '00'}${fraction}`
  if (!Number.isFinite(epoch) || utcText(epoch, fraction) !== canonical) throw new Error(`Invalid FIXatdl clock value: ${raw}`)
  return { epoch, fraction, offsetMinutes }
}

function marketZone(control: AtdlControlDto, source: 'init' | 'wire'): string {
  const zone = control.localMktTz
  if (!zone && source === 'init') throw new Error('Clock initValue requires localMktTz.')
  return zone ?? 'UTC'
}

function fromInstant(epoch: number, zone: string, fraction?: string, original?: string): ClockValue {
  return { kind: 'atdl-clock', instant: original ?? utcText(epoch, fraction), localDateTime: utcText(zoneEpoch(epoch, zone), fraction) }
}

function resolveLocal(localEpoch: number, zone: string): number {
  // Sample both sides of a timezone transition, then verify candidate wall times.
  const offsets = new Set([-36, 0, 36].map(hours => {
    const sample = localEpoch + hours * 3_600_000
    return zoneEpoch(sample, zone) - sample
  }))
  const candidates = [...offsets].map(offset => localEpoch - offset).sort((a, b) => a - b)
  const exact = candidates.find(candidate => zoneEpoch(candidate, zone) === localEpoch)
  if (exact !== undefined) return exact // NodaTime lenient overlap: earlier instant.
  const afterGap = candidates.find(candidate => zoneEpoch(candidate, zone) > localEpoch)
  if (afterGap !== undefined) return afterGap // Lenient gap: shift forward by the skipped interval.
  throw new Error(`Cannot resolve clock value in timezone ${zone}.`)
}

export function createClockValue(
  control: AtdlControlDto, raw: unknown, now?: Date, source: 'init' | 'wire' = 'init',
): ClockValue | null {
  if (raw == null || raw === '' || raw === '{NULL}') return null
  if (isClockValue(raw)) return raw
  if (typeof raw !== 'string') throw new Error('Clock values must be FIX time strings.')
  const zone = marketZone(control, source)
  let date: string | undefined
  if (now) {
    const dateEpoch = source === 'wire' ? now.getTime() : zoneEpoch(now.getTime(), zone)
    date = utcText(dateEpoch).slice(0, 8)
  }
  const parsed = parseClock(raw, date)
  if (source === 'wire') {
    const epoch = parsed.epoch - (parsed.offsetMinutes ?? 0) * 60_000
    return fromInstant(epoch, zone, parsed.fraction, utcText(epoch, parsed.fraction))
  }
  if (parsed.offsetMinutes !== undefined) throw new Error('Clock initValue must use local market wall time and localMktTz, without an explicit offset.')
  const mode = control.initValueMode ?? 0
  if (mode !== 0 && mode !== 1) throw new Error(`Unsupported Clock initValueMode: ${mode}`)
  const instant = resolveLocal(parsed.epoch, zone)
  if (mode === 1) {
    if (!now) throw new Error('A host clock is required for initValueMode=1.')
    if (now.getTime() > instant) return fromInstant(now.getTime(), zone)
  }
  return fromInstant(instant, zone, parsed.fraction)
}

export function editClockValue(control: AtdlControlDto, current: unknown, rawTime: string, now?: Date): ClockValue | null {
  if (rawTime === '' || rawTime === '{NULL}') return null
  const hasDate = /^\d{4}(?:\d{4}-|-\d{2}-\d{2}T)/.test(rawTime)
  const raw = isClockValue(current) && !hasDate ? `${current.localDateTime.slice(0, 8)}-${rawTime}` : rawTime
  return createClockValue({ ...control, initValueMode: 0, localMktTz: control.localMktTz ?? 'UTC' }, raw, now)
}

export function clockDisplayValue(value: unknown): string {
  const raw = isClockValue(value) ? value.localDateTime : typeof value === 'string' ? value : ''
  return raw.replace(/^\d{8}-/, '').replace(/(\.\d{3})\d+$/, '$1')
}

export function clockRuleValue(value: unknown): unknown {
  return isClockValue(value) ? value.localDateTime : value
}

export function clockWireValue(value: unknown, parameterType = 'UTCTimestamp_t'): unknown {
  if (!isClockValue(value)) return value
  switch (parameterType) {
    case 'LocalMktDate_t': return value.localDateTime.slice(0, 8)
    case 'UTCDateOnly_t': return value.instant.slice(0, 8)
    case 'UTCTimeOnly_t': return value.instant.slice(9)
    case 'TZTimeOnly_t': return `${value.instant.slice(9)}Z`
    case 'TZTimestamp_t': return `${value.instant}Z`
    default: return value.instant
  }
}
