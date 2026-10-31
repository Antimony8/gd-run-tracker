import { describe, expect, it } from 'vitest'
import { compareCompleted } from './completedSort'
import type { Level } from '../types'

const lvl = (name: string, extra: Partial<Level> = {}): Level => ({
  id: name,
  name,
  creator: 'x',
  difficulty: 'Extreme Demon',
  dateAdded: '2026-01-01T00:00:00Z',
  beaten: true,
  ...extra,
})

const levels = [
  lvl('Acu', { listRanks: { aredl: 1499, checkedAt: 0 }, attempts: 29000, beatenDate: '2025-01-10' }),
  lvl('Stalemate Redux', { listRanks: { aredl: 494, checkedAt: 0 }, attempts: 33418, beatenDate: '2026-09-01' }),
  lvl('Bloodbath', { listRanks: { aredl: 795, checkedAt: 0 }, beatenDate: '2025-06-02' }),
  lvl('Cataclysm', { listRanks: { aredl: 1412, checkedAt: 0 }, attempts: 6500 }),
  lvl('easy one', { difficulty: 'Hard Demon', attempts: 900, beatenDate: '2024-03-03' }),
]
const names = (sort: Parameters<typeof compareCompleted>[0], seed?: number) =>
  [...levels].sort(compareCompleted(sort, seed)).map((l) => l.name)

describe('compareCompleted', () => {
  it('sorts by difficulty and AREDL position both ways', () => {
    expect(names('hardest')).toEqual(['Stalemate Redux', 'Bloodbath', 'Cataclysm', 'Acu', 'easy one'])
    expect(names('easiest')).toEqual(['easy one', 'Acu', 'Cataclysm', 'Bloodbath', 'Stalemate Redux'])
  })

  it('sorts by attempts, putting levels without a count last', () => {
    expect(names('attempts-most')).toEqual(['Stalemate Redux', 'Acu', 'Cataclysm', 'easy one', 'Bloodbath'])
    expect(names('attempts-least')).toEqual(['easy one', 'Cataclysm', 'Acu', 'Stalemate Redux', 'Bloodbath'])
  })

  it('sorts by name, ignoring case', () => {
    expect(names('name')).toEqual(['Acu', 'Bloodbath', 'Cataclysm', 'easy one', 'Stalemate Redux'])
  })

  it('sorts by completion date', () => {
    expect(names('recent')[0]).toBe('Stalemate Redux')
  })

  it('shuffles the same way for the same seed and differently for another', () => {
    expect(names('random', 1)).toEqual(names('random', 1))
    const orders = new Set([1, 2, 3, 4, 5, 6].map((s) => names('random', s).join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})
