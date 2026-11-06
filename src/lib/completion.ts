import { db } from '../db'
import type { Level, Run } from '../types'
import { todayISO } from './format'

/** One fixed ID per level, so every synced device writes the same completion run instead of adding its own. */
export const completionRunId = (levelId: string) => `completion-${levelId}`

function completionRun(level: Level, existing?: Run): Run {
  return {
    id: completionRunId(level.id),
    levelId: level.id,
    start: 0,
    end: 100,
    date: level.beatenDate ?? existing?.date ?? todayISO(),
    createdAt: existing?.createdAt ?? Date.now(),
    note: 'Completion',
    completion: true,
  }
}

/**
 * Keeps completion runs in step with each level's beaten state: beaten levels get a 0–100 run dated
 * on their completion, and levels that aren't beaten lose it. Writes nothing when everything matches.
 */
export async function reconcileCompletionRuns(): Promise<void> {
  await db.transaction('rw', db.levels, db.runs, async () => {
    const [levels, completions] = await Promise.all([db.levels.toArray(), db.runs.filter((r) => !!r.completion).toArray()])
    const byLevel = new Map(completions.map((r) => [r.levelId, r]))
    const put: Run[] = []
    const remove: string[] = []
    for (const level of levels) {
      const run = byLevel.get(level.id)
      byLevel.delete(level.id)
      if (level.beaten) {
        const want = completionRun(level, run)
        if (!run || run.date !== want.date || run.id !== want.id) {
          if (run && run.id !== want.id) remove.push(run.id)
          put.push(want)
        }
      } else if (run) {
        remove.push(run.id)
      }
    }
    // Completion runs whose level was deleted.
    for (const run of byLevel.values()) remove.push(run.id)
    if (put.length) await db.runs.bulkPut(put)
    if (remove.length) await db.runs.bulkDelete(remove)
  })
}
