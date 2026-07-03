import { describe, it, expect } from 'vitest'
import {
  getCurrentPhase,
  getPhaseForDay,
  derivePhaseRanges,
  cycleDayFor,
  daysBetween,
} from '../src/index'

describe('derivePhaseRanges — standard 28-day cycle', () => {
  const ranges = derivePhaseRanges({ cycleLength: 28, periodLength: 5, lutealLength: 14 })
  const byPhase = Object.fromEntries(ranges.map((r) => [r.phase, r]))

  it('covers 1..cycleLength with no gaps or overlaps', () => {
    let cursor = 1
    for (const r of ranges) {
      expect(r.start).toBe(cursor)
      expect(r.end).toBeGreaterThanOrEqual(r.start)
      cursor = r.end + 1
    }
    expect(cursor - 1).toBe(28)
  })

  it('places the four phases where clinicians expect them', () => {
    expect(byPhase.menstrual).toMatchObject({ start: 1, end: 5 })
    expect(byPhase.follicular).toMatchObject({ start: 6, end: 12 })
    expect(byPhase.ovulatory).toMatchObject({ start: 13, end: 15 })
    expect(byPhase.luteal).toMatchObject({ start: 16, end: 28 })
  })
})

describe('getPhaseForDay — 28-day cycle', () => {
  const cfg = { cycleLength: 28, periodLength: 5, lutealLength: 14 }
  const cases: Array<[number, string]> = [
    [1, 'menstrual'],
    [5, 'menstrual'],
    [6, 'follicular'],
    [12, 'follicular'],
    [14, 'ovulatory'],
    [16, 'luteal'],
    [28, 'luteal'],
  ]
  for (const [day, phase] of cases) {
    it(`day ${day} → ${phase}`, () => {
      expect(getPhaseForDay(day, cfg).phase).toBe(phase)
    })
  }

  it('returns a human-readable description and range', () => {
    const r = getPhaseForDay(18, cfg)
    expect(r.phase).toBe('luteal')
    expect(r.range).toEqual({ start: 16, end: 28 })
    expect(r.description).toBe('Days 16–28')
    expect(r.overdue).toBe(false)
  })
})

describe('getCurrentPhase — from dates', () => {
  it('computes the cycle day from start date and asOf', () => {
    // start 2026-06-15, asOf 2026-07-01 → day 17 → luteal
    const r = getCurrentPhase(
      { cycleStartDate: '2026-06-15', periodLength: 5, cycleLength: 28 },
      '2026-07-01',
    )
    expect(r.day).toBe(17)
    expect(r.phase).toBe('luteal')
  })

  it('treats the start date itself as day 1 (menstrual)', () => {
    const r = getCurrentPhase({ cycleStartDate: '2026-06-15' }, '2026-06-15')
    expect(r.day).toBe(1)
    expect(r.phase).toBe('menstrual')
  })

  it('accepts Date objects and ISO strings interchangeably', () => {
    const fromString = getCurrentPhase({ cycleStartDate: '2026-06-15' }, '2026-06-25')
    const fromDate = getCurrentPhase(
      { cycleStartDate: new Date(2026, 5, 15) },
      new Date(2026, 5, 25),
    )
    expect(fromDate.day).toBe(fromString.day)
    expect(fromDate.phase).toBe(fromString.phase)
  })
})

describe('date helpers', () => {
  it('daysBetween counts whole calendar days', () => {
    expect(daysBetween('2026-06-15', '2026-06-25')).toBe(10)
    expect(daysBetween('2026-06-25', '2026-06-15')).toBe(-10)
  })

  it('cycleDayFor is 1-based', () => {
    expect(cycleDayFor('2026-06-15', '2026-06-15')).toBe(1)
    expect(cycleDayFor('2026-06-15', '2026-06-20')).toBe(6)
  })
})
