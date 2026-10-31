import { describe, expect, it } from 'vitest'
import { compareHardest, demonTier } from './demonTier'
import type { Level } from '../types'

const at = (aredl: number | null | undefined) => ({ listRanks: { aredl, checkedAt: 0 } })

describe('demonTier', () => {
  it('follows the Grandpa Demon scale', () => {
    const tiers = [1, 2, 25, 26, 75, 76, 150, 151, 250, 251, 500].map((r) => demonTier(at(r))?.id)
    expect(tiers).toEqual([
      'grandpa',
      'infinite',
      'infinite',
      'mythical',
      'mythical',
      'legendary',
      'legendary',
      'ultimate',
      'ultimate',
      'supreme',
      'supreme',
    ])
  })

  it('has no tier outside the top 500 or off the list', () => {
    expect(demonTier(at(501))).toBeNull()
    expect(demonTier(at(null))).toBeNull()
    expect(demonTier(at(undefined))).toBeNull()
    expect(demonTier({})).toBeNull()
  })
})

describe('compareHardest', () => {
  const lvl = (difficulty: Level['difficulty'], aredl?: number) => ({ difficulty, ...at(aredl) }) as Level

  it('puts higher AREDL extremes first', () => {
    const sorted = [lvl('Insane Demon'), lvl('Extreme Demon', 300), lvl('Extreme Demon'), lvl('Extreme Demon', 4)].sort(
      compareHardest,
    )
    expect(sorted.map((l) => [l.difficulty, l.listRanks?.aredl])).toEqual([
      ['Extreme Demon', 4],
      ['Extreme Demon', 300],
      ['Extreme Demon', undefined],
      ['Insane Demon', undefined],
    ])
  })
})
