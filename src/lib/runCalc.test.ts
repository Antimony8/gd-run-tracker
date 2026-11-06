import { describe, expect, it } from 'vitest'
import { calculateRuns, groupRuns } from './runCalc'

const r = (start: number, end: number) => ({ start, end })
const spans = (chain: { start: number; end: number }[]) => chain.map((c) => [c.start, c.end])

describe('calculateRuns', () => {
  it('chains touching runs: 0-50, 50-100 is 2 runs', () => {
    const res = calculateRuns([r(0, 50), r(50, 100)])
    expect(res.complete).toBe(true)
    expect(spans(res.chain)).toEqual([[0, 50], [50, 100]])
  })

  it('chains overlapping runs: 0-30, 25-75, 55-100 is 3 runs', () => {
    const res = calculateRuns([r(55, 100), r(0, 30), r(25, 75)])
    expect(res.complete).toBe(true)
    expect(spans(res.chain)).toEqual([[0, 30], [25, 75], [55, 100]])
  })

  it('reports the gap when there is no full chain', () => {
    const res = calculateRuns([r(0, 40), r(60, 100)])
    expect(res.complete).toBe(false)
    expect(res.gap).toEqual({ from: 40, to: 60 })
    expect(res.reach).toBe(40)
    expect(spans(res.chain)).toEqual([[0, 40]])
  })

  it('treats a 0-100 run as 1 run', () => {
    const res = calculateRuns([r(0, 100), r(0, 50), r(50, 100)])
    expect(res.complete).toBe(true)
    expect(res.chain).toHaveLength(1)
  })

  it('ignores redundant runs', () => {
    const res = calculateRuns([r(0, 30), r(0, 60), r(50, 100)])
    expect(spans(res.chain)).toEqual([[0, 60], [50, 100]])
  })

  it('picks the fewest runs, not the first ones found', () => {
    const res = calculateRuns([r(0, 20), r(10, 40), r(15, 90), r(35, 60), r(85, 100)])
    expect(spans(res.chain)).toEqual([[0, 20], [15, 90], [85, 100]])
  })

  it('handles decimals', () => {
    const res = calculateRuns([r(0, 47.3), r(47.3, 82.15), r(82.14, 100)])
    expect(res.complete).toBe(true)
    expect(res.chain).toHaveLength(3)

    const broken = calculateRuns([r(0, 47.29), r(47.3, 100)])
    expect(broken.complete).toBe(false)
    expect(broken.gap).toEqual({ from: 47.29, to: 47.3 })
  })

  it('handles duplicate runs', () => {
    const res = calculateRuns([r(0, 50), r(0, 50), r(50, 100), r(50, 100)])
    expect(res.chain).toHaveLength(2)
  })

  it('reports a gap from 0 when no run starts at 0', () => {
    const res = calculateRuns([r(20, 100)])
    expect(res.complete).toBe(false)
    expect(res.gap).toEqual({ from: 0, to: 20 })
    expect(res.bestFromZero).toBeNull()
  })

  it('reports a gap to 100 when nothing reaches the end', () => {
    const res = calculateRuns([r(0, 60), r(30, 50)])
    expect(res.gap).toEqual({ from: 60, to: 100 })
  })

  it('handles no runs', () => {
    const res = calculateRuns([])
    expect(res.complete).toBe(false)
    expect(res.gap).toEqual({ from: 0, to: 100 })
    expect(res.chain).toEqual([])
  })

  it('finds the best run from 0', () => {
    const res = calculateRuns([r(0, 30), r(0, 72.5), r(10, 100)])
    expect(res.bestFromZero).toEqual(r(0, 72.5))
  })
})

describe('groupRuns', () => {
  it('splits runs into connected, other and obsolete', () => {
    const runs = [r(0, 50), r(40, 100), r(50, 100), r(10, 30), r(45, 100), r(0, 50)]
    const { chain } = calculateRuns(runs)
    const g = groupRuns(runs, chain)
    expect(spans(g.connected)).toEqual([[0, 50], [40, 100]])
    // 50-100 and 45-100 sit inside 40-100, 10-30 inside 0-50, and the duplicate 0-50 is covered too.
    expect(spans(g.obsolete)).toEqual([[50, 100], [10, 30], [45, 100], [0, 50]])
    expect(g.other).toEqual([])
  })

  it('keeps runs past a gap as other', () => {
    const runs = [r(0, 30), r(10, 20), r(60, 100), r(70, 90)]
    const { chain } = calculateRuns(runs)
    const g = groupRuns(runs, chain)
    expect(spans(g.connected)).toEqual([[0, 30]])
    expect(spans(g.obsolete)).toEqual([[10, 20]])
    // Not covered by the chain, so they stay visible even though 70-90 sits inside 60-100.
    expect(spans(g.other)).toEqual([[60, 100], [70, 90]])
  })
})
