import { db } from '../db'
import { LEGACY_SOURCE } from '../db'
import type { DeathSource, DeathStats, Level, Run } from '../types'
import { uid, todayISO } from './format'

/**
 * Reads save data from the Death Tracker Geode mod (elohmrow.death_tracker). Each level has a
 * folder named by its key ("123456", "1-local", "5-editor", "123-daily"...) holding:
 *   metadata    JSON: levelName, attempts (GD's counter), ...
 *   general.dt  JSON: deaths {"percent": count} from 0, runs {"start-end": count}, playtime in ns
 *   sessions/   one .dt file per session
 */

export interface DTRun {
  start: number
  end: number
  count: number
}

export interface DTLevel {
  key: string
  /** Online level ID, when the key belongs to an online level. */
  gdLevelId?: string
  /** Saved in the editor, e.g. a start-pos copy of a level. */
  editor: boolean
  name: string
  attempts: number
  deaths: Record<string, number>
  runs: DTRun[]
  playtimeMs: number
  sessions: number
}

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** "123456" or "123456-daily" -> "123456". Main-game and editor levels have no online ID. */
export function onlineId(key: string): string | undefined {
  return key.match(/^(\d+)(?:-daily|-gauntlet)*$/)?.[1]
}

function counts(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (isObj(v)) for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && n > 0) out[k] = n
  return out
}

/** Playtime pairs are { playtimeF0, playtimeRuns } in nanoseconds. */
function playtimeMs(v: unknown): number {
  if (!isObj(v)) return 0
  return ((Number(v.playtimeF0) || 0) + (Number(v.playtimeRuns) || 0)) / 1e6
}

/** Builds one level's stats from its parsed files. Returns null if there's nothing useful. */
export function parseDTLevel(key: string, metadata: unknown, general: unknown, sessions = 0): DTLevel | null {
  const meta = isObj(metadata) ? metadata : {}
  const gen = isObj(general) ? general : {}
  const deaths = counts(gen.deaths)
  const runs: DTRun[] = []
  for (const [range, count] of Object.entries(counts(gen.runs))) {
    const m = range.match(/^(\d+)-(\d+)$/)
    if (!m) continue
    const start = Number(m[1])
    const end = Math.min(100, Number(m[2]))
    if (end > start) runs.push({ start, end, count })
  }
  const attempts = Number(meta.attempts) || 0
  if (!attempts && !Object.keys(deaths).length && !runs.length) return null
  return {
    key,
    gdLevelId: onlineId(key),
    editor: key.endsWith('-editor'),
    name: typeof meta.levelName === 'string' && meta.levelName.trim() ? meta.levelName.trim() : `Level ${key}`,
    attempts,
    deaths,
    runs,
    playtimeMs: playtimeMs(gen.playtimeGeneral),
    sessions,
  }
}

/** Reads the files from a picked folder (the mod's "levels" folder, or the mod folder around it). */
export async function readDeathTrackerFolder(files: File[]): Promise<DTLevel[]> {
  const byKey = new Map<string, { metadata?: File; general?: File; sessions: number }>()
  for (const file of files) {
    const parts = (file.webkitRelativePath || file.name).split('/')
    // Backups hold older copies; skip them.
    if (parts.includes('backups')) continue
    const name = parts[parts.length - 1]
    if (parts[parts.length - 2] === 'sessions' && name.endsWith('.dt')) {
      const key = parts[parts.length - 3]
      if (key) byKey.set(key, { ...(byKey.get(key) ?? { sessions: 0 }), sessions: (byKey.get(key)?.sessions ?? 0) + 1 })
      continue
    }
    if (name !== 'metadata' && name !== 'general.dt') continue
    const key = parts[parts.length - 2]
    if (!key) continue
    const entry = byKey.get(key) ?? { sessions: 0 }
    if (name === 'metadata') entry.metadata = file
    else entry.general = file
    byKey.set(key, entry)
  }

  const readJson = async (f?: File) => {
    if (!f) return undefined
    try {
      return JSON.parse(await f.text())
    } catch {
      return undefined
    }
  }
  const levels: DTLevel[] = []
  for (const [key, entry] of byKey) {
    if (!entry.metadata && !entry.general) continue
    const level = parseDTLevel(key, await readJson(entry.metadata), await readJson(entry.general), entry.sessions)
    if (level) levels.push(level)
  }
  return levels
}

/** Drops runs that another run fully covers, since they can't help a chain. Keeps the most-played first. */
export function bestRuns(runs: DTRun[]): DTRun[] {
  return runs.filter(
    (r, i) =>
      !runs.some(
        (o, j) => j !== i && o.start <= r.start && o.end >= r.end && (o.start < r.start || o.end > r.end || j < i),
      ),
  )
}

/** Furthest percent reached from 0 without completing (the "best from 0"). */
export function bestFromZero(deaths: Record<string, number>): number {
  return Math.max(0, ...Object.keys(deaths).map(Number).filter((p) => p > 0 && p < 100))
}

export const completedFromZero = (deaths: Record<string, number>) => (deaths['100'] ?? 0) > 0

/** The percents where you died most, highest first. */
export function topDeaths(deaths: Record<string, number>, n = 3): { percent: number; count: number }[] {
  return Object.entries(deaths)
    .map(([p, count]) => ({ percent: Number(p), count }))
    .filter((d) => d.percent < 100)
    .sort((a, b) => b.count - a.count || a.percent - b.percent)
    .slice(0, n)
}

/** Runs to add for a level: the best from 0 and every start-pos run that isn't covered by another. */
export function runsToImport(dt: DTLevel): DTRun[] {
  const fromZero = bestFromZero(dt.deaths)
  const all = fromZero ? [{ start: 0, end: fromZero, count: dt.deaths[String(fromZero)] ?? 1 }, ...dt.runs] : dt.runs
  return bestRuns(all)
}

/** Where a Death Tracker level's data goes: a tracker level's ID, a new level, or nowhere. */
export type DTTarget = string | 'new' | 'skip'

export interface DTPlan {
  dt: DTLevel
  /** The tracker level this would most likely belong to, and why. */
  suggested?: { levelId: string; reason: 'id' | 'linked' | 'name' }
  target: DTTarget
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Words people add to practice copies: "Bloodbath start pos", "bloodbath copy 2", "BB (SP)"...
const COPY_WORDS = /\b(start ?pos(?:es)?|startpos|sp|copy|copies|practice|prac|verify|verification|ver|edit|editor|nerf(?:ed)?|buff(?:ed)?|ldm|lowdetail|low detail|no ?lag|unlisted|wip|v\d+)\b/gi

/** A level name with copy words, brackets and trailing numbers removed, for matching copies to levels. */
export function baseName(name: string): string {
  return norm(name.replace(/[([{].*?[)\]}]/g, ' ').replace(COPY_WORDS, ' ').replace(/\b\d+\s*$/, ' '))
}

/** Finds the tracker level a Death Tracker level belongs to: same ID, linked before, or a matching name. */
export function suggestTarget(dt: DTLevel, levels: Level[]): DTPlan['suggested'] {
  const byId = dt.gdLevelId && levels.find((l) => l.gdLevelId === dt.gdLevelId)
  if (byId) return { levelId: byId.id, reason: 'id' }
  const linked = levels.find((l) => l.deathStats?.sources[dt.key])
  if (linked) return { levelId: linked.id, reason: 'linked' }

  const full = norm(dt.name)
  const base = baseName(dt.name)
  // Exact names first, then copy names, then the longest tracker name the copy's name starts with.
  const exact = levels.find((l) => norm(l.name) === full)
  if (exact) return { levelId: exact.id, reason: 'name' }
  const same = levels.find((l) => base && baseName(l.name) === base)
  if (same) return { levelId: same.id, reason: 'name' }
  const prefix = levels
    .filter((l) => norm(l.name).length >= 4 && full.startsWith(norm(l.name)))
    .sort((a, b) => norm(b.name).length - norm(a.name).length)[0]
  return prefix ? { levelId: prefix.id, reason: 'name' } : undefined
}

/** Suggests where each Death Tracker level goes. Only suggested matches are imported unless you choose otherwise. */
export function planDeathTrackerImport(dtLevels: DTLevel[], levels: Level[]): DTPlan[] {
  return dtLevels
    .map((dt): DTPlan => {
      const suggested = suggestTarget(dt, levels)
      return { dt, suggested, target: suggested?.levelId ?? 'skip' }
    })
    .sort((a, b) => Number(!!b.suggested) - Number(!!a.suggested) || b.dt.attempts - a.dt.attempts)
}

/** Totals across all of a level's sources (its online version and any editor copies). */
export function combineSources(stats: DeathStats): Omit<DeathSource, 'name' | 'editor'> {
  const out = { deaths: {} as Record<string, number>, attempts: 0, playtimeMs: 0, sessions: 0 }
  for (const s of Object.values(stats.sources)) {
    for (const [p, n] of Object.entries(s.deaths)) out.deaths[p] = (out.deaths[p] ?? 0) + n
    out.attempts += s.attempts
    out.playtimeMs += s.playtimeMs
    out.sessions += s.sessions
  }
  return out
}

const toSource = (dt: DTLevel): DeathSource => ({
  name: dt.name,
  editor: dt.editor,
  deaths: dt.deaths,
  attempts: dt.attempts,
  playtimeMs: dt.playtimeMs,
  sessions: dt.sessions,
})

export interface DTSummary {
  updated: number
  added: number
  runs: number
}

/**
 * Saves the chosen links. Each level keeps one entry per source, so re-importing replaces that source's
 * numbers instead of adding them again. Attempts are never lowered; new runs and from-0 completions are added.
 */
export async function applyDeathTrackerImport(plans: DTPlan[]): Promise<DTSummary> {
  const summary: DTSummary = { updated: 0, added: 0, runs: 0 }
  const now = Date.now()
  // Several sources (a level and its copies) can feed one tracker level.
  const byTarget = new Map<string, DTLevel[]>()
  for (const { dt, target } of plans) {
    if (target === 'skip') continue
    const key = target === 'new' ? `new:${dt.key}` : target
    byTarget.set(key, [...(byTarget.get(key) ?? []), dt])
  }

  await db.transaction('rw', db.levels, db.runs, async () => {
    const newRuns: Run[] = []
    for (const [target, dts] of byTarget) {
      const existing = target.startsWith('new:') ? undefined : await db.levels.get(target)
      const sources: Record<string, DeathSource> = { ...existing?.deathStats?.sources }
      // Numbers from before sources were tracked would be counted twice next to fresh ones.
      delete sources[LEGACY_SOURCE]
      for (const dt of dts) sources[dt.key] = toSource(dt)
      const stats: DeathStats = { sources, importedAt: now }
      const total = combineSources(stats)
      const beaten = completedFromZero(total.deaths)

      let levelId: string
      let have: Run[] = []
      if (existing) {
        levelId = existing.id
        have = await db.runs.where('levelId').equals(levelId).toArray()
        const online = dts.find((d) => d.gdLevelId && !d.editor)
        await db.levels.update(levelId, {
          deathStats: stats,
          attempts: Math.max(existing.attempts ?? 0, total.attempts) || undefined,
          gdLevelId: existing.gdLevelId ?? online?.gdLevelId,
          ...(beaten && !existing.beaten ? { beaten: true, queuePos: undefined } : {}),
        })
        summary.updated++
      } else {
        const dt = dts[0]
        levelId = uid()
        await db.levels.add({
          id: levelId,
          gdLevelId: dt.editor ? undefined : dt.gdLevelId,
          name: dt.editor ? baseNameDisplay(dt.name) : dt.name,
          creator: 'Unknown',
          difficulty: 'Unrated',
          dateAdded: new Date(now).toISOString(),
          beaten,
          attempts: total.attempts || undefined,
          deathStats: stats,
        })
        summary.added++
      }
      // Pick runs across all sources together, so a copy's shorter runs don't pile up under a longer one.
      for (const { run, from } of levelRuns(dts, total.deaths)) {
        if (have.some((r) => r.start === run.start && r.end === run.end)) continue
        newRuns.push({
          id: uid(),
          levelId,
          start: run.start,
          end: run.end,
          date: todayISO(),
          createdAt: now + newRuns.length,
          note: `From Death Tracker${from.editor ? ` (${from.name})` : ''}${run.count > 1 ? ` ×${run.count}` : ''}`,
        })
      }
    }
    await db.runs.bulkAdd(newRuns)
    summary.runs = newRuns.length
  })
  return summary
}

/** Runs worth adding for a level fed by several sources: the combined best from 0 plus uncovered start-pos runs. */
export function levelRuns(dts: DTLevel[], combinedDeaths: Record<string, number>): { run: DTRun; from: DTLevel }[] {
  const candidates: { run: DTRun; from: DTLevel }[] = []
  const best = bestFromZero(combinedDeaths)
  if (best) {
    const from = dts.find((d) => (d.deaths[String(best)] ?? 0) > 0) ?? dts[0]
    candidates.push({ run: { start: 0, end: best, count: combinedDeaths[String(best)] ?? 1 }, from })
  }
  for (const dt of dts) for (const run of dt.runs) candidates.push({ run, from: dt })
  const kept = new Set(bestRuns(candidates.map((c) => c.run)))
  return candidates.filter((c) => kept.has(c.run))
}

/** "Bloodbath Start Pos" -> "Bloodbath", for naming a new level made from an editor copy. */
function baseNameDisplay(name: string): string {
  const cleaned = name.replace(/[([{].*?[)\]}]/g, ' ').replace(COPY_WORDS, ' ').replace(/\s+\d+\s*$/, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || name
}
