import Dexie, { type EntityTable } from 'dexie'
import type { Level, Run, StoredVideo } from './types'

export const db = new Dexie('gd-run-tracker') as Dexie & {
  levels: EntityTable<Level, 'id'>
  runs: EntityTable<Run, 'id'>
  videos: EntityTable<StoredVideo, 'id'>
}

// Video blobs live in their own table so loading runs never pulls in video data.
db.version(1).stores({
  levels: 'id, dateAdded',
  runs: 'id, levelId, date',
  videos: 'id',
})
