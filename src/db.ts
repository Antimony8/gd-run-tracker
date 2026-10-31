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
