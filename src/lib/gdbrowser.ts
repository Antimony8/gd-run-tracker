import { DIFFICULTIES, type Difficulty } from '../types'

export interface GDLevelInfo {
  name: string
  creator: string
  difficulty: Difficulty
}

/** Looks up a level by its in-game ID using GDBrowser's public API. Throws if it can't be found. */
export async function fetchLevel(id: string): Promise<GDLevelInfo> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`https://gdbrowser.com/api/level/${encodeURIComponent(id)}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`GDBrowser returned ${res.status}`)
    const data = await res.json()
    // GDBrowser returns -1 for levels that don't exist.
    if (!data || data === -1 || !data.name) throw new Error('Level not found')
    return {
      name: String(data.name),
      creator: String(data.author ?? 'Unknown'),
      difficulty: toDifficulty(data.difficulty),
    }
  } finally {
    clearTimeout(timer)
  }
}

function toDifficulty(value: unknown): Difficulty {
  const v = String(value ?? '').toLowerCase()
  return DIFFICULTIES.find((d) => d.toLowerCase() === v) ?? 'Unrated'
}
