import JSZip from 'jszip'
import { db } from '../db'
import type { Level, Run, StoredVideo } from '../types'

const APP_ID = 'gd-run-tracker'
const FORMAT_VERSION = 1

interface VideoMeta extends Omit<StoredVideo, 'blob'> {
  file: string // path inside the zip
}

interface BackupData {
  app: typeof APP_ID
  version: number
  exportedAt: string
  levels: Level[]
  runs: Run[]
  videos: VideoMeta[]
}

function extension(v: Omit<StoredVideo, 'blob'>): string {
  const fromName = v.name.match(/\.[a-z0-9]{1,5}$/i)?.[0]
  if (fromName) return fromName.toLowerCase()
  const fromType = v.type.split('/')[1]
  return fromType ? `.${fromType}` : ''
}

/** Builds a .zip with data.json and every uploaded video in videos/. */
export async function exportBackup(onProgress?: (percent: number) => void): Promise<Blob> {
  const [levels, runs, videos] = await Promise.all([db.levels.toArray(), db.runs.toArray(), db.videos.toArray()])
  const zip = new JSZip()

  const videoMeta: VideoMeta[] = videos.map(({ blob, ...meta }) => {
    const file = `videos/${meta.id}${extension(meta)}`
    zip.file(file, blob)
    return { ...meta, file }
  })

  const data: BackupData = {
    app: APP_ID,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    levels,
    runs,
    videos: videoMeta,
  }
  zip.file('data.json', JSON.stringify(data, null, 2))

  // Videos are already compressed, so storing them as-is is much faster.
  return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => onProgress?.(m.percent))
}

export interface ImportResult {
  levels: number
  runs: number
  videos: number
}

/**
 * Restores a backup. "replace" wipes current data first; "merge" adds the backup's
 * items and overwrites any with the same ID.
 */
export async function importBackup(file: File, mode: 'replace' | 'merge'): Promise<ImportResult> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error("That file isn't a valid backup .zip.")
  }

  const json = await zip.file('data.json')?.async('string')
  if (!json) throw new Error('This zip has no data.json, so it is not a Run Tracker backup.')

  let data: BackupData
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('The backup data is damaged.')
  }
  if (data.app !== APP_ID || !Array.isArray(data.levels) || !Array.isArray(data.runs) || !Array.isArray(data.videos)) {
    throw new Error('This is not a Run Tracker backup.')
  }
  if (data.version > FORMAT_VERSION) throw new Error('This backup was made by a newer version of the app.')

  // Read the video files before opening the database transaction.
  const videos: StoredVideo[] = []
  for (const { file: path, ...meta } of data.videos) {
    const entry = zip.file(path)
    if (!entry) continue
    const blob = await entry.async('blob')
    videos.push({ ...meta, blob: new Blob([blob], { type: meta.type }) })
  }

  await db.transaction('rw', db.levels, db.runs, db.videos, async () => {
    if (mode === 'replace') {
      await Promise.all([db.levels.clear(), db.runs.clear(), db.videos.clear()])
    }
    await db.levels.bulkPut(data.levels)
    await db.runs.bulkPut(data.runs)
    await db.videos.bulkPut(videos)
  })

  return { levels: data.levels.length, runs: data.runs.length, videos: videos.length }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
