export interface Span {
  start: number
  end: number
}

export interface RunCalcResult<T extends Span> {
  /** True when the chosen runs chain all the way from 0 to 100. */
  complete: boolean
  /** The fewest runs that chain from 0, in order. When incomplete, this is the chain up to the gap. */
  chain: T[]
  /** Furthest % reached by chaining from 0. */
  reach: number
  /** The first uncovered stretch, or null when complete. */
  gap: { from: number; to: number } | null
  /** The run from 0 that goes the furthest. */
  bestFromZero: T | null
}

/**
 * Greedy interval cover. A run connects to the previous one when
 * run.start <= previous.end (touching endpoints count).
 * From the current point, take the run that reaches furthest, and repeat.
 */
export function calculateRuns<T extends Span>(runs: readonly T[]): RunCalcResult<T> {
  const sorted = [...runs].sort((a, b) => a.start - b.start || b.end - a.end)

  let bestFromZero: T | null = null
  for (const r of sorted) {
    if (r.start === 0 && (!bestFromZero || r.end > bestFromZero.end)) bestFromZero = r
  }

  const chain: T[] = []
  let reach = 0
  let i = 0
  let gap: { from: number; to: number } | null = null

  while (reach < 100) {
    // Every run that starts within what's covered so far is a candidate.
    let best: T | null = null
    while (i < sorted.length && sorted[i].start <= reach) {
      if (!best || sorted[i].end > best.end) best = sorted[i]
      i++
    }

    if (!best || best.end <= reach) {
      // Nothing extends the chain. The gap runs to the next run's start, or to 100.
      const next = i < sorted.length ? sorted[i].start : 100
      gap = { from: reach, to: next }
      break
    }

    chain.push(best)
    reach = best.end
  }

  return { complete: gap === null, chain, reach, gap, bestFromZero }
}
