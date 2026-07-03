import type { CycleConfig } from './types'

/** Clinically typical defaults used when a field is omitted. */
export const DEFAULTS = {
  cycleLength: 28,
  periodLength: 5,
  lutealLength: 14,
  ovulatoryWindow: 3,
} as const

/** Supported bounds. Values outside these are clamped, not rejected. */
export const BOUNDS = {
  cycleLength: { min: 15, max: 60 },
  lutealLength: { min: 7, max: 20 },
  ovulatoryWindow: { min: 1, max: 7 },
} as const

export interface NormalizedConfig {
  cycleLength: number
  periodLength: number
  lutealLength: number
  ovulatoryWindow: number
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.max(min, Math.min(max, n))
}

/**
 * Coerce arbitrary user input into a valid, internally-consistent config.
 *
 * The ordering matters: `lutealLength` is clamped relative to `cycleLength` so
 * that there is always room for at least a menstrual and an ovulatory phase, and
 * `periodLength` is clamped so bleeding can never spill past the start of the
 * ovulatory window. This is what makes every downstream phase range well-formed
 * regardless of how nonsensical the raw input was.
 */
export function normalizeConfig(input: CycleConfig = {}): NormalizedConfig {
  const cycleLength = clampInt(
    input.cycleLength,
    DEFAULTS.cycleLength,
    BOUNDS.cycleLength.min,
    BOUNDS.cycleLength.max,
  )

  // Leave at least 3 days ahead of ovulation for menstrual + ovulatory marker.
  const lutealLength = clampInt(
    input.lutealLength,
    DEFAULTS.lutealLength,
    BOUNDS.lutealLength.min,
    Math.min(BOUNDS.lutealLength.max, cycleLength - 3),
  )

  const ovulatoryWindow = clampInt(
    input.ovulatoryWindow,
    DEFAULTS.ovulatoryWindow,
    BOUNDS.ovulatoryWindow.min,
    BOUNDS.ovulatoryWindow.max,
  )

  const periodLength = clampInt(
    input.periodLength,
    DEFAULTS.periodLength,
    1,
    cycleLength - 1,
  )

  return { cycleLength, periodLength, lutealLength, ovulatoryWindow }
}
