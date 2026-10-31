import { DIFFICULTIES, type Level } from '../types'

export type DemonTierId = 'grandpa' | 'infinite' | 'mythical' | 'legendary' | 'ultimate' | 'supreme'

export interface DemonTier {
  id: DemonTierId
  name: string
  /** Lowest AREDL position that still counts for this tier. */
  maxRank: number
  color: string
}

/**
 * Extra difficulties above Extreme Demon, from the Grandpa Demon mod by ItzKiba.
 * A level gets the hardest tier its AREDL position fits in. Hardest first.
 */
export const DEMON_TIERS: DemonTier[] = [
  { id: 'grandpa', name: 'Grandpa Demon', maxRank: 1, color: '#6b3fa0' },
  { id: 'infinite', name: 'Infinite Demon', maxRank: 25, color: '#4a3d1c' },
  { id: 'mythical', name: 'Mythical Demon', maxRank: 75, color: '#4b1aa0' },
  { id: 'legendary', name: 'Legendary Demon', maxRank: 150, color: '#7a2ee0' },
  { id: 'ultimate', name: 'Ultimate Demon', maxRank: 250, color: '#b0157f' },
  { id: 'supreme', name: 'Supreme Demon', maxRank: 500, color: '#d06a10' },
]

export function tierForRank(rank: number | null | undefined): DemonTier | null {
  if (rank == null || rank < 1) return null
  return DEMON_TIERS.find((t) => rank <= t.maxRank) ?? null
}

/** The level's Grandpa Demon tier, based on its AREDL position. null below the top 500 or when unknown. */
export const demonTier = (level: Pick<Level, 'listRanks'>) => tierForRank(level.listRanks?.aredl)

/** "Top 25 on the AREDL" style description of a tier's range. */
export function tierRange(tier: DemonTier): string {
  return tier.maxRank === 1 ? '#1 on the AREDL' : `Top ${tier.maxRank} on the AREDL`
}

/** Sort comparator: hardest difficulty first, then higher AREDL placement, then unranked. */
export function compareHardest(a: Pick<Level, 'difficulty' | 'listRanks'>, b: Pick<Level, 'difficulty' | 'listRanks'>): number {
  return (
    DIFFICULTIES.indexOf(b.difficulty) - DIFFICULTIES.indexOf(a.difficulty) ||
    (a.listRanks?.aredl ?? Infinity) - (b.listRanks?.aredl ?? Infinity)
  )
}
