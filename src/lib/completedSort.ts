import type { Level } from '../types'
import { compareHardest } from './demonTier'

export type CompletedSort = 'hardest' | 'easiest' | 'recent' | 'attempts-most' | 'attempts-least' | 'name' | 'random'

export const COMPLETED_SORTS: { value: CompletedSort; label: string }[] = [
  { value: 'hardest', label: 'Hardest first' },
  { value: 'easiest', label: 'Easiest first' },
  { value: 'recent', label: 'Recently beaten' },
  { value: 'attempts-most', label: 'Most attempts' },
  { value: 'attempts-least', label: 'Fewest attempts' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'random', label: 'Random' },
]

/** A stable pseudo-random number for an ID, so a shuffle stays put until it's reshuffled. */
function shuffleKey(id: string, seed: number): number {
  let h = 2166136261 ^ seed
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

const byName = (a: Level, b: Level) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
const beatenOn = (l: Level) => l.beatenDate ?? l.dateAdded.slice(0, 10)

/** Orders completed levels. Levels missing what's being sorted on (no attempts logged) go last. */
export function compareCompleted(sort: CompletedSort, seed = 0) {
  return (a: Level, b: Level): number => {
    switch (sort) {
      case 'easiest':
        return compareHardest(b, a) || byName(a, b)
      case 'recent':
        return beatenOn(b).localeCompare(beatenOn(a)) || byName(a, b)
      case 'attempts-most':
      case 'attempts-least': {
        if (a.attempts === undefined || b.attempts === undefined) {
          return (a.attempts === undefined ? 1 : 0) - (b.attempts === undefined ? 1 : 0) || byName(a, b)
        }
        const diff = a.attempts - b.attempts
        return (sort === 'attempts-most' ? -diff : diff) || byName(a, b)
      }
      case 'name':
        return byName(a, b)
      case 'random':
        return shuffleKey(a.id, seed) - shuffleKey(b.id, seed)
      default:
        return compareHardest(a, b) || byName(a, b)
    }
  }
}
