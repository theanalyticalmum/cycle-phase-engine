/** The four canonical menstrual cycle phases. */
export type PhaseLabel = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

/**
 * Cycle configuration. Every field except the shape itself is optional and
 * falls back to a clinically typical default (see DEFAULTS). Out-of-range values
 * are clamped rather than rejected, so a bad `cycleLength: 3` becomes the
 * minimum supported cycle instead of producing nonsense phases.
 */
export interface CycleConfig {
  /** Total cycle length in days, start-of-period to start-of-next-period. Default 28. */
  cycleLength?: number
  /** Bleeding days at the start of the cycle. Default 5. */
  periodLength?: number
  /**
   * Luteal phase length in days. This is the *stable* part of the cycle
   * (~14 days) and is what anchors ovulation to the NEXT period rather than the
   * last one. Default 14.
   */
  lutealLength?: number
  /** Width of the ovulatory marker window centered on estimated ovulation. Default 3. */
  ovulatoryWindow?: number
}

/** Config plus the start date of the current cycle (cycle day 1 = first day of bleeding). */
export interface CycleInput extends CycleConfig {
  /** First day of the most recent period. ISO 'YYYY-MM-DD' string or a Date. */
  cycleStartDate: string | Date
}

/** A phase and the inclusive cycle-day range it occupies. */
export interface PhaseRange {
  phase: PhaseLabel
  /** First cycle day of this phase (1-based, inclusive). */
  start: number
  /** Last cycle day of this phase (inclusive). */
  end: number
}

/** The result of classifying a cycle day. */
export interface PhaseResult {
  phase: PhaseLabel
  /** The cycle day that was classified (1-based). May exceed `cycleLength` if overdue. */
  day: number
  /** The (normalized) cycle length used for the calculation. */
  cycleLength: number
  /** Human-readable range, e.g. "Days 16–28". */
  description: string
  /** The inclusive day range of the returned phase. */
  range: { start: number; end: number }
  /**
   * True when `day` ran past `cycleLength` with no new period logged. The phase
   * is reported as `luteal` (the cycle's final phase) rather than inventing a
   * new cycle — see the README on why we never assume an unlogged event.
   */
  overdue: boolean
}
