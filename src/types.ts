export const DIFFICULTIES = [
  'Unrated',
  'Auto',
  'Easy',
  'Normal',
  'Hard',
  'Harder',
  'Insane',
  'Easy Demon',
  'Medium Demon',
  'Hard Demon',
  'Insane Demon',
  'Extreme Demon',
] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

/** A video attached to a run or a completion: either an uploaded file (stored in the videos table) or an external link. */
export type VideoRef =
  | { kind: 'upload'; videoId: string; name: string }
  | { kind: 'link'; url: string }

export interface Level {
  id: string
  gdLevelId?: string
  name: string
  creator: string
  difficulty: Difficulty
  dateAdded: string // ISO timestamp
  beaten: boolean
  beatenDate?: string // YYYY-MM-DD
  completionVideo?: VideoRef
  notes?: string
}

export interface Run {
  id: string
  levelId: string
  start: number // 0–100, up to 2 decimals
  end: number
  date: string // YYYY-MM-DD
  createdAt: number // ms timestamp, for stable ordering and future stats
  note?: string
  video?: VideoRef
}

export interface StoredVideo {
  id: string
  blob: Blob
  name: string
  type: string
  size: number
  createdAt: number
}
