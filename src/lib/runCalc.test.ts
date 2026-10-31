import { describe, expect, it } from 'vitest'
import { calculateRuns } from './runCalc'

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
