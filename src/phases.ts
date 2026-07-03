import type { CycleConfig, CycleInput, PhaseRange, PhaseResult } from './types'
import { normalizeConfig, type NormalizedConfig } from './validators'

/** Parse an ISO 'YYYY-MM-DD' string or Date to a UTC-midnight epoch (ms). */
function toUTCms(d: string | Date): number {
  if (d instanceof Date) {
    if (Number.isNaN(d.getTime())) throw new RangeError('Invalid Date')
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (!m) throw new RangeError(`Invalid date string: "${d}" (expected YYYY-MM-DD)`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Whole calendar days from `from` to `to`. DST-safe (uses UTC midnights). */
export function daysBetween(from: string | Date, to: string | Date): number {
  return Math.round((toUTCms(to) - toUTCms(from)) / 86_400_000)
}

/**
 * The 1-based cycle day for `asOf`, given the cycle start date. Day 1 is the
 * start date itself. Throws if `asOf` precedes the start.
 */
export function cycleDayFor(cycleStartDate: string | Date, asOf: string | Date): number {
  const diff = daysBetween(cycleStartDate, asOf)
  if (diff < 0) throw new RangeError('asOf is before cycleStartDate')
  return diff + 1
}

/**
 * Split a cycle into ordered, non-overlapping day ranges using LUTEAL-ANCHORED
 * math: ovulation is placed `lutealLength` days before the *next* period, not a
 * fixed fraction of the cycle. This is the physiologically correct model — the
 * luteal phase is near-constant (~14 days) while the follicular phase absorbs
 * cycle-length variation.
 *
 * Contract: returns ranges in cycle-day order, covering 1..cycleLength with no
 * gaps or overlaps. `follicular` (and, for pathological inputs, `luteal`) may be
 * omitted when the cycle is too short to contain them.
 */
export function derivePhaseRanges(config: CycleConfig = {}): PhaseRange[] {
  const cfg: NormalizedConfig = normalizeConfig(config)
  const { cycleLength, lutealLength, ovulatoryWindow } = cfg

  // Ovulation ~ lutealLength days before the next cycle starts.
  const ovulationDay = Math.max(2, cycleLength - lutealLength)

  const half = Math.floor(ovulatoryWindow / 2)
  let ovStart = Math.max(2, ovulationDay - half)
  const ovEnd = Math.min(cycleLength - 1, ovStart + ovulatoryWindow - 1)
  ovStart = Math.max(2, ovEnd - ovulatoryWindow + 1)

  // Bleeding can never overrun the ovulatory window.
  const periodEnd = Math.min(cfg.periodLength, ovStart - 1)

  const ranges: PhaseRange[] = [{ phase: 'menstrual', start: 1, end: periodEnd }]

  if (ovStart > periodEnd + 1) {
    ranges.push({ phase: 'follicular', start: periodEnd + 1, end: ovStart - 1 })
  }

  ranges.push({ phase: 'ovulatory', start: ovStart, end: ovEnd })

  if (cycleLength > ovEnd) {
    ranges.push({ phase: 'luteal', start: ovEnd + 1, end: cycleLength })
  }

  return ranges
}

function toResult(range: PhaseRange, day: number, cycleLength: number, overdue: boolean): PhaseResult {
  return {
    phase: range.phase,
    day,
    cycleLength,
    description: `Days ${range.start}–${range.end}`,
    range: { start: range.start, end: range.end },
    overdue,
  }
}

/**
 * Classify an explicit cycle day (1-based) into its phase.
 *
 * Days beyond `cycleLength` are reported as the final phase (`luteal`) with
 * `overdue: true` — we do NOT roll over into an assumed next cycle, because an
 * unlogged period is unknown, not zero. (Assuming the opposite is exactly the
 * bug this library was extracted to fix.)
 *
 * @throws RangeError if `day < 1`.
 */
export function getPhaseForDay(day: number, config: CycleConfig = {}): PhaseResult {
  if (!Number.isFinite(day) || day < 1) {
    throw new RangeError(`cycle day must be >= 1, got ${day}`)
  }
  const cfg = normalizeConfig(config)
  const ranges = derivePhaseRanges(config)
  const rounded = Math.round(day)
  const overdue = rounded > cfg.cycleLength
  const lookup = overdue ? cfg.cycleLength : rounded
  // ranges always contains at least menstrual + ovulatory, so last is defined.
  const range =
    ranges.find((r) => lookup >= r.start && lookup <= r.end) ?? ranges[ranges.length - 1]!
  return toResult(range, rounded, cfg.cycleLength, overdue)
}

/**
 * Classify the phase for a date, given the current cycle's start date.
 *
 * @param asOf The date to evaluate. Defaults to today. Pass an explicit date in
 *             tests or server code for deterministic results.
 * @throws RangeError if `asOf` precedes `cycleStartDate`.
 */
export function getCurrentPhase(input: CycleInput, asOf: string | Date = new Date()): PhaseResult {
  const day = cycleDayFor(input.cycleStartDate, asOf)
  return getPhaseForDay(day, input)
}
