import Dexie, { type EntityTable } from 'dexie'
import type { Level, Run, Setting, StoredVideo } from './types'

export const db = new Dexie('gd-run-tracker') as Dexie & {
  levels: EntityTable<Level, 'id'>
  runs: EntityTable<Run, 'id'>
  videos: EntityTable<StoredVideo, 'id'>
  settings: EntityTable<Setting, 'key'>
}

// Video blobs live in their own table so loading runs never pulls in video data.
db.version(1).stores({
  levels: 'id, dateAdded',
  runs: 'id, levelId, date',
  videos: 'id',
})

db.version(2).stores({
  settings: 'key',
})

// Attempts used to be imported into notes as an "Attempts: 1,234" line; give them their own field.
const ATTEMPTS_NOTE = /^Attempts: ([\d,]+)$/m

db.version(3).upgrade((tx) =>
  tx
    .table('levels')
    .toCollection()
    .modify((level: Level) => {
      const m = level.notes?.match(ATTEMPTS_NOTE)
      if (!m || level.attempts !== undefined) return
      level.attempts = Number(m[1].replace(/,/g, ''))
      level.notes = level.notes!.replace(ATTEMPTS_NOTE, '').replace(/\n{2,}/g, '\n').trim() || undefined
    }),
)
