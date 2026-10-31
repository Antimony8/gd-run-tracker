import { db } from '../db'
import type { Level, Run, StoredVideo, VideoRef } from '../types'
import { uid } from './format'
import { fetchListRanks } from './levelInfo'
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

export interface DeletedRun {
  run: Run
  video?: StoredVideo
}

/** Deletes a run and its uploaded video, returning what's needed to undo it. */
export async function deleteRun(run: Run): Promise<DeletedRun> {
  return db.transaction('rw', db.runs, db.videos, async () => {
    const video = run.video?.kind === 'upload' ? await db.videos.get(run.video.videoId) : undefined
    await removeVideo(run.video)
    await db.runs.delete(run.id)
    return { run, video }
  })
}

export async function restoreRun({ run, video }: DeletedRun) {
  await db.transaction('rw', db.runs, db.videos, async () => {
    if (video) await db.videos.put(video)
    await db.runs.put(run)
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
  await db.transaction('rw', [db.levels, db.runs, db.videos, db.settings], async () => {
    await Promise.all([db.levels.clear(), db.runs.clear(), db.videos.clear(), db.settings.clear()])
  })
}

/** Puts a level at the end of the Next Up queue. */
export async function addToQueue(level: Level) {
  const queued = await db.levels.filter((l) => l.queuePos !== undefined).toArray()
  const last = Math.max(0, ...queued.map((l) => l.queuePos!))
  await db.levels.update(level.id, { queuePos: last + 1 })
}

export async function removeFromQueue(level: Level) {
  await db.levels.update(level.id, { queuePos: undefined })
}

/** Swaps a queued level with its neighbor. dir -1 moves it earlier, 1 later. */
export async function moveInQueue(level: Level, dir: -1 | 1) {
  await db.transaction('rw', db.levels, async () => {
    const queue = (await db.levels.filter((l) => l.queuePos !== undefined).toArray()).sort(
      (a, b) => a.queuePos! - b.queuePos!,
    )
    const i = queue.findIndex((l) => l.id === level.id)
    const other = queue[i + dir]
    if (i < 0 || !other) return
    // Renumber so positions stay unique even if older data had ties.
    queue[i] = other
    queue[i + dir] = level
    await Promise.all(queue.map((l, n) => db.levels.update(l.id, { queuePos: n + 1 })))
  })
}

/** Re-checks a level's demon list positions. Returns false if it has no in-game ID. */
export async function refreshListRanks(level: Level): Promise<boolean> {
  if (!level.gdLevelId) return false
  const listRanks = await fetchListRanks(level.gdLevelId, level.listRanks)
  await db.levels.update(level.id, { listRanks })
  return true
}
