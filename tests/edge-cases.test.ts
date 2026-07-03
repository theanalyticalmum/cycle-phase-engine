import { describe, it, expect } from 'vitest'
import { getPhaseForDay, getCurrentPhase, derivePhaseRanges } from '../src/index'

/**
 * These are the cases real period trackers get wrong. Each one is a bug that was
 * observed in the wild (or in the app this library was extracted from).
 */

describe('the never-ending period bug', () => {
  // The origin bug: a period is started but never marked as ended, so naive
  // implementations report "menstrual" forever. Here day 18 of a 28-day cycle
  // must be luteal, not menstrual.
  it('day 18 of a 28-day cycle is luteal, not menstrual', () => {
    expect(getPhaseForDay(18, { cycleLength: 28, periodLength: 5 }).phase).toBe('luteal')
  })

  it('menstrual is bounded by periodLength, never the whole cycle', () => {
    const r = getPhaseForDay(6, { cycleLength: 28, periodLength: 5 })
    expect(r.phase).not.toBe('menstrual')
  })
})

describe('overdue cycles (no new period logged)', () => {
  it('flags days past cycleLength as overdue and reports luteal', () => {
    const r = getPhaseForDay(40, { cycleLength: 28 })
    expect(r.overdue).toBe(true)
    expect(r.phase).toBe('luteal')
    expect(r.day).toBe(40)
  })

  it('does NOT roll over into an assumed next cycle', () => {
    // Day 30 of a 28-day cycle is not "day 2, menstrual" — we never invent an
    // unlogged period. It stays luteal + overdue.
    const r = getPhaseForDay(30, { cycleLength: 28, periodLength: 5 })
    expect(r.phase).toBe('luteal')
    expect(r.overdue).toBe(true)
  })
})

describe('luteal anchoring (the reason this library exists)', () => {
  // On a long cycle, ovulation shifts LATER because the luteal phase stays ~14
  // days. A fixed-fraction model (ovulation ≈ 57% of the cycle) would wrongly
  // call day 18 "ovulatory" on a 35-day cycle. Luteal-anchored math keeps it
  // follicular, because ovulation is ~day 21.
  it('day 18 of a 35-day cycle is follicular, not ovulatory', () => {
    const r = getPhaseForDay(18, { cycleLength: 35, periodLength: 5, lutealLength: 14 })
    expect(r.phase).toBe('follicular')
  })

  it('ovulation tracks the next period, not a fraction of the cycle', () => {
    const short = derivePhaseRanges({ cycleLength: 24, lutealLength: 14 })
    const long = derivePhaseRanges({ cycleLength: 35, lutealLength: 14 })
    const ovStart = (rs: typeof short) => rs.find((r) => r.phase === 'ovulatory')!.start
    // ~10 days apart in ovulation timing == the 11-day cycle-length gap, minus
    // the fixed luteal phase. Follicular absorbed the difference.
    expect(long.length && short.length).toBeTruthy()
    expect(ovStart(long) - ovStart(short)).toBe(35 - 24)
  })
})

describe('irregular and out-of-range input is clamped, not crashed', () => {
  it('absurd cycleLength is clamped into a supported range', () => {
    const tiny = getPhaseForDay(1, { cycleLength: 3 })
    expect(tiny.cycleLength).toBeGreaterThanOrEqual(15)
    expect(tiny.phase).toBe('menstrual')

    const huge = getPhaseForDay(1, { cycleLength: 900 })
    expect(huge.cycleLength).toBeLessThanOrEqual(60)
  })

  it('period longer than the cycle can never overrun ovulation', () => {
    const ranges = derivePhaseRanges({ cycleLength: 21, periodLength: 40 })
    const menstrual = ranges.find((r) => r.phase === 'menstrual')!
    const ovulatory = ranges.find((r) => r.phase === 'ovulatory')!
    expect(menstrual.end).toBeLessThan(ovulatory.start)
  })

  it('always yields ordered, contiguous ranges for a fuzz of inputs', () => {
    for (let cl = 15; cl <= 60; cl += 1) {
      for (const pl of [1, 3, 7, 12]) {
        for (const ll of [7, 10, 14, 18]) {
          const ranges = derivePhaseRanges({ cycleLength: cl, periodLength: pl, lutealLength: ll })
          let cursor = 1
          for (const r of ranges) {
            expect(r.start).toBe(cursor)
            expect(r.end).toBeGreaterThanOrEqual(r.start)
            cursor = r.end + 1
          }
          expect(cursor - 1).toBe(Math.max(15, Math.min(60, cl)))
        }
      }
    }
  })
})

describe('invalid arguments throw clearly', () => {
  it('rejects a cycle day below 1', () => {
    expect(() => getPhaseForDay(0)).toThrow(RangeError)
    expect(() => getPhaseForDay(-4)).toThrow(RangeError)
  })

  it('rejects an asOf before the cycle start', () => {
    expect(() =>
      getCurrentPhase({ cycleStartDate: '2026-06-15' }, '2026-06-01'),
    ).toThrow(RangeError)
  })

  it('rejects a malformed date string', () => {
    expect(() => getCurrentPhase({ cycleStartDate: 'yesterday' }, '2026-06-15')).toThrow(
      RangeError,
    )
  })
})
