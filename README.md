# cycle-phase-engine

**Every period tracker calculates menstrual cycle phases. Most get the edge cases wrong.**

A tiny, framework-free TypeScript utility that turns a period start date into a cycle phase — with the physiology and the ugly edge cases handled correctly. No React, no dependencies, pure functions, fully tested.

```ts
import { getCurrentPhase } from 'cycle-phase-engine'

getCurrentPhase({ cycleStartDate: '2026-06-15', periodLength: 5, cycleLength: 28 }, '2026-07-01')
// → { phase: 'luteal', day: 17, cycleLength: 28, description: 'Days 16–28',
//     range: { start: 16, end: 28 }, overdue: false }
```

## Why this exists

Most apps write cycle math inline and never extract it, so the same bugs get reinvented everywhere:

- **The never-ending period.** A period is started but never marked "ended," so the app reports *menstrual* forever. A tester on day 18 of a 28-day cycle was shown "Day 18 · Menstrual Phase." Everything downstream that keys off phase was then wrong.
- **Fixed-fraction ovulation.** Splitting the cycle by percentages (`ovulation ≈ 57% of the cycle`) breaks on long or short cycles. Physiologically, the **luteal phase is the stable one (~14 days)** and ovulation is anchored to the *next* period, not the last. The follicular phase is what stretches.
- **Overdue cycles.** When no new period is logged, is it "day 2 of a new cycle" or "day 30, overdue"? Assuming the former invents an event that never happened.

This library takes the honest position on all three.

## Install

```bash
npm install cycle-phase-engine
```

## API

### `getCurrentPhase(input, asOf?)`

Phase for a date, given the current cycle's start date. `asOf` defaults to today; pass an explicit date for deterministic server/test behavior.

```ts
getCurrentPhase({ cycleStartDate: '2026-06-15' })                 // uses defaults + today
getCurrentPhase({ cycleStartDate: '2026-06-15', cycleLength: 31 }, '2026-06-30')
```

### `getPhaseForDay(day, config?)`

Classify an explicit 1-based cycle day. Pure — no dates involved.

```ts
getPhaseForDay(18, { cycleLength: 28 })   // → luteal
getPhaseForDay(18, { cycleLength: 35 })   // → follicular  (luteal-anchored)
getPhaseForDay(40, { cycleLength: 28 })   // → luteal, overdue: true
```

### `derivePhaseRanges(config?)`

The full phase map for a cycle — ordered, contiguous, non-overlapping ranges covering `1..cycleLength`. Handy for rendering a cycle wheel or timeline.

```ts
derivePhaseRanges({ cycleLength: 28 })
// [ { phase: 'menstrual',  start: 1,  end: 5  },
//   { phase: 'follicular', start: 6,  end: 12 },
//   { phase: 'ovulatory',  start: 13, end: 15 },
//   { phase: 'luteal',     start: 16, end: 28 } ]
```

### Helpers

`cycleDayFor(startDate, asOf)` → 1-based cycle day. `daysBetween(from, to)` → DST-safe whole-day difference. `normalizeConfig(config)` → the clamped, internally-consistent config actually used.

## Config

| Field             | Default | Notes                                                              |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `cycleLength`     | `28`    | Start-of-period to start-of-next. Clamped to 15–60.                |
| `periodLength`    | `5`     | Bleeding days. Never allowed to overrun the ovulatory window.      |
| `lutealLength`    | `14`    | The stable phase; anchors ovulation to the next period. Clamped 7–20. |
| `ovulatoryWindow` | `3`     | Marker window centered on estimated ovulation. Clamped 1–7.        |

**Out-of-range input is clamped, never thrown.** `cycleLength: 3` becomes the minimum supported cycle; a `periodLength` longer than the cycle is capped so phases stay well-ordered. The only things that throw are a cycle `day < 1` and an `asOf` before the cycle start.

## Edge cases, explicitly

- **Never-ended period** → menstrual is bounded by `periodLength`, not the whole cycle.
- **Overdue cycle** → days past `cycleLength` return the final phase (`luteal`) with `overdue: true`. No rollover into an assumed next cycle.
- **Irregular length** → ovulation shifts with the cycle because the luteal phase is fixed; the follicular phase absorbs the variance.
- **First cycle / sparse data** → works from a single start date and sensible defaults.
- **Day-1 ambiguity** → day 1 is the first day of bleeding, i.e. the cycle start date.

All covered in [`tests/edge-cases.test.ts`](./tests/edge-cases.test.ts), including a fuzz over every cycle length 15–60 asserting the ranges stay contiguous.

## Scope and disclaimer

This is a **phase-of-record** calculator for cycle-aware apps and analytics. It is **not** a contraceptive or fertility-prediction tool, and it does not model hormonal data, temperature, or LH. Ovulation timing is an estimate. Not medical advice.

## Origin

Extracted from [MyHadaa](https://myhadaa.com), an app that correlates diet and cycle with skin. The "Day 18 · Menstrual Phase" bug above was real; fixing it correctly is what motivated pulling this out as a standalone, tested utility.

## License

MIT
