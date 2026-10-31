import type { CSSProperties } from 'react'
import type { Difficulty } from '../types'
import { type DemonTier, type DemonTierId, tierRange } from '../lib/demonTier'
import grandpa from '../assets/demons/grandpa.png'
import infinite from '../assets/demons/infinite.png'
import mythical from '../assets/demons/mythical.png'
import legendary from '../assets/demons/legendary.png'
import ultimate from '../assets/demons/ultimate.png'
import supreme from '../assets/demons/supreme.png'
import easyDemon from '../assets/demons/easy.png'
import mediumDemon from '../assets/demons/medium.png'
import hardDemon from '../assets/demons/hard.png'
import insaneDemon from '../assets/demons/insane.png'
import extremeDemon from '../assets/demons/extreme.png'
import easyFace from '../assets/faces/easy.png'
import normalFace from '../assets/faces/normal.png'
import hardFace from '../assets/faces/hard.png'
import harderFace from '../assets/faces/harder.png'
import insaneFace from '../assets/faces/insane.png'

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

// The game's own difficulty faces. Unrated and Auto keep the plain orb.
const DIFFICULTY_FACES: Partial<Record<Difficulty, string>> = {
  Easy: easyFace,
  Normal: normalFace,
  Hard: hardFace,
  Harder: harderFace,
  Insane: insaneFace,
  'Easy Demon': easyDemon,
  'Medium Demon': mediumDemon,
  'Hard Demon': hardDemon,
  'Insane Demon': insaneDemon,
  'Extreme Demon': extremeDemon,
}

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

interface Props {
  difficulty: Difficulty
  /** Grandpa Demon tier, shown instead of the plain difficulty when set. */
  tier?: DemonTier | null
}

/** The level's difficulty face from the game (tiered extremes get their tier's face), or a plain orb for Unrated and Auto. */
export function DifficultyOrb({ difficulty, tier, size = 56 }: Props & { size?: number }) {
  const face = tier ? TIER_FACES[tier.id] : DIFFICULTY_FACES[difficulty]
  if (face) {
    const name = tier?.name ?? difficulty
    return (
      <div className={`demon-face ${tier ? `tier-${tier.id}` : difficulty.endsWith('Demon') ? '' : 'round-face'}`} style={{ '--size': `${size}px` } as CSSProperties} title={name}>
        <img src={face} alt={name} draggable={false} />
      </div>
    )
  }
  return (
    <div
      className="diff-orb"
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
