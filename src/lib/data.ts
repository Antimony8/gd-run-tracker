import { db } from '../db'
import type { Level, Run, VideoRef } from '../types'
import { uid } from './format'
import type { VideoChoice } from '../components/VideoPicker'

/** Saves an uploaded file to the videos table and returns a reference to it. */
export async function storeVideoFile(file: File): Promise<VideoRef> {
  const id = uid()
  await db.videos.add({ id, blob: file, name: file.name, type: file.type, size: file.size, createdAt: Date.now() })
  return { kind: 'upload', videoId: id, name: file.name }
}

/** Removes the stored file behind a video reference (links have nothing to remove). */
export async function removeVideo(ref?: VideoRef) {
  if (ref?.kind === 'upload') await db.videos.delete(ref.videoId)
}

/**
 * Turns the user's video choice into the reference to save, storing a new upload
 * and cleaning up the previous file if it was replaced or removed.
 */
export async function applyVideoChoice(choice: VideoChoice, previous?: VideoRef): Promise<VideoRef | undefined> {
  if (choice.mode === 'existing') return choice.ref
  let next: VideoRef | undefined
  if (choice.mode === 'upload' && choice.file) next = await storeVideoFile(choice.file)
  if (choice.mode === 'link') next = { kind: 'link', url: choice.url.trim() }
  await removeVideo(previous)
  return next
}

export async function deleteRun(run: Run) {
  await db.transaction('rw', db.runs, db.videos, async () => {
    await removeVideo(run.video)
    await db.runs.delete(run.id)
  })
}

export async function deleteLevel(level: Level) {
  await db.transaction('rw', db.levels, db.runs, db.videos, async () => {
    const runs = await db.runs.where('levelId').equals(level.id).toArray()
    for (const r of runs) await removeVideo(r.video)
    await db.runs.where('levelId').equals(level.id).delete()
    await removeVideo(level.completionVideo)
    await db.levels.delete(level.id)
  })
}

export async function clearAll() {
  await db.transaction('rw', db.levels, db.runs, db.videos, async () => {
    await Promise.all([db.levels.clear(), db.runs.clear(), db.videos.clear()])
  })
}
