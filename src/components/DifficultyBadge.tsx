import type { CSSProperties } from 'react'
import type { Difficulty } from '../types'

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

/** Round "difficulty orb" — demons get little horns. */
export function DifficultyOrb({ difficulty, size = 56 }: { difficulty: Difficulty; size?: number }) {
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

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className="diff-badge" style={{ '--diff': DIFFICULTY_COLORS[difficulty] } as CSSProperties}>
      {difficulty}
    </span>
  )
}
