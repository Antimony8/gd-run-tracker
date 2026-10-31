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
  /** Position in the "Next Up" queue (lower comes first). Unset = not queued. */
  queuePos?: number
  /** Free-text goal, e.g. "Get it in 3 runs". */
  goal?: string
  targetDate?: string // YYYY-MM-DD
  thumbnail?: Thumbnail
  /** Background color used while viewing this level. Unset = the app theme. */
  theme?: string
  listRanks?: ListRanks
}

/** Card art: a solid color or a small image (stored as a downscaled data URL). */
export type Thumbnail = { kind: 'color'; color: string } | { kind: 'image'; dataUrl: string }

/** Positions on community demon lists. null = checked and not on that list. */
export interface ListRanks {
  pointercrate?: number | null
  aredl?: number | null
  checkedAt: number
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

/** App-wide preferences and bookkeeping, stored one row per key. */
export interface Setting {
  key: string
  value: unknown
}
