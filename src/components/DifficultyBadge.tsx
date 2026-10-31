import type { CSSProperties } from 'react'
import type { Difficulty } from '../types'
import { type DemonTier, type DemonTierId, tierRange } from '../lib/demonTier'
import grandpa from '../assets/demons/grandpa.png'
import infinite from '../assets/demons/infinite.png'
import mythical from '../assets/demons/mythical.png'
import legendary from '../assets/demons/legendary.png'
import ultimate from '../assets/demons/ultimate.png'
import supreme from '../assets/demons/supreme.png'

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Unrated: '#9aa3b5',
  Auto: '#f5c542',
  Easy: '#4fc3f7',
  Normal: '#5be05b',
  Hard: '#ffb43a',
  Harder: '#ff6b4a',
  Insane: '#ff5fc8',
  'Easy Demon': '#c084fc',
  'Medium Demon': '#fb923c',
  'Hard Demon': '#ef4444',
  'Insane Demon': '#d946ef',
  'Extreme Demon': '#b91c1c',
}

// Demon faces from the Grandpa Demon mod's sprite sheet.
const TIER_FACES: Record<DemonTierId, string> = { grandpa, infinite, mythical, legendary, ultimate, supreme }

const SHORT: Record<Difficulty, string> = {
  Unrated: '?',
  Auto: 'A',
  Easy: 'E',
  Normal: 'N',
  Hard: 'H',
  Harder: 'H+',
  Insane: 'I',
  'Easy Demon': 'ED',
  'Medium Demon': 'MD',
  'Hard Demon': 'HD',
  'Insane Demon': 'ID',
  'Extreme Demon': 'XD',
}

export const isDemon = (d: Difficulty) => d.endsWith('Demon')

interface Props {
  difficulty: Difficulty
  /** Grandpa Demon tier, shown instead of the plain difficulty when set. */
  tier?: DemonTier | null
}

/** Round "difficulty orb" — demons get little horns. Tiered extreme demons show their demon face. */
export function DifficultyOrb({ difficulty, tier, size = 56 }: Props & { size?: number }) {
  if (tier) {
    return (
      <div className={`demon-face tier-${tier.id}`} style={{ '--size': `${size}px` } as CSSProperties} title={tier.name}>
        <img src={TIER_FACES[tier.id]} alt={tier.name} draggable={false} />
      </div>
    )
  }
  return (
    <div
      className={`diff-orb ${isDemon(difficulty) ? 'demon' : ''}`}
      style={{ '--diff': DIFFICULTY_COLORS[difficulty], '--size': `${size}px` } as CSSProperties}
      title={difficulty}
    >
      <span className="outlined">{SHORT[difficulty]}</span>
    </div>
  )
}

export function DifficultyBadge({ difficulty, tier }: Props) {
  return (
    <span
      className={`diff-badge ${tier ? `tier-badge tier-${tier.id}` : ''}`}
      style={{ '--diff': tier?.color ?? DIFFICULTY_COLORS[difficulty] } as CSSProperties}
      title={tier ? `${tierRange(tier)} (Grandpa Demon scale)` : undefined}
    >
      {tier?.name ?? difficulty}
    </span>
  )
}
