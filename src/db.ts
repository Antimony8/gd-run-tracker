import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { Level, Run, Setting, StoredVideo } from './types'
import { DEXIE_CLOUD_URL } from './syncConfig'

export const db = new Dexie('gd-run-tracker', { addons: [dexieCloud] }) as Dexie & {
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

if (DEXIE_CLOUD_URL) {
  db.cloud.configure({
    databaseUrl: DEXIE_CLOUD_URL,
    // Signing in is optional; the app works fully offline without it.
    requireAuth: false,
    // Keep the existing local database name so data from before sync is kept (and uploaded on first sign-in).
    nameSuffix: false,
    // Video files are too big for the free tier and settings are per device; links in runs still sync.
    unsyncedTables: ['videos', 'settings'],
    // The app has its own service worker for offline use.
    tryUseServiceWorker: false,
  })
}
