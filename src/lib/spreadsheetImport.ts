import { db } from '../db'
import { DIFFICULTIES, type Difficulty, type Level, type ListRanks, type Run } from '../types'
import type { CellValue, Sheet } from './sheetReader'
import { parseQuickRun, round2, todayISO, uid, validateRun } from './format'

export type ImportAs = 'completed' | 'progress' | 'nextup' | 'skip'

export const IMPORT_AS_LABELS: Record<ImportAs, string> = {
  completed: 'Completed',
  progress: 'In Progress',
  nextup: 'Next Up',
  skip: "Don't import",
}

export interface ImportRow {
  key: string
  sheet: string
  name: string
  as: ImportAs
  /** The row's status or section heading in the spreadsheet, e.g. "Plan to Play". */
  status?: string
  gdLevelId?: string
  creator?: string
  difficulty?: Difficulty
  aredl?: number
  pointercrate?: number
  beatenDate?: string
  goal?: string
  targetDate?: string
  attempts?: number
  runs: { start: number; end: number }[]
  notes: string[]
}

type Field =
  | 'name'
  | 'id'
  | 'creator'
  | 'difficulty'
  | 'aredl'
  | 'pointercrate'
  | 'status'
  | 'beatenDate'
  | 'bestFromZero'
  | 'runs'
  | 'goal'
  | 'targetDate'
  | 'attempts'
  | 'notes'

// Header text -> field. First match wins; anything unmatched is kept as a "Header: value" note.
const HEADERS: [Field, RegExp][] = [
  ['name', /^(level|level name|name|demon|title)$/i],
  ['id', /^(level )?id$|^id$/i],
  ['creator', /creator|author|publisher|made by/i],
  ['difficulty', /^difficulty$/i],
  ['aredl', /aredl/i],
  ['pointercrate', /pointercrate|demon ?list (rank|position)/i],
  ['status', /^(status|state)$/i],
  ['beatenDate', /\b(date|when)\b.*\b(beat|complet|finish)|\b(beat(en)?|complet(ed|ion)?|finish(ed)?)\b.*\b(date|on|when)\b/i],
  ['bestFromZero', /best.*(from|0)|^best( %)?$/i],
  ['runs', /^(best )?runs$|start ?pos|^runs?$/i],
  ['goal', /^goal$/i],
  ['targetDate', /target|deadline/i],
  ['attempts', /^(total )?(attempts|atts?)$/i],
  ['notes', /notes?|comments?|focus|why/i],
]

/** What a status or section label means for the tracker, or null if it isn't one. */
export function statusToImportAs(text: string): ImportAs | null {
  const t = text.trim().toLowerCase()
  if (!t || t.length > 30) return null
  if (/complet|beat|done|finish|verif|victor/.test(t)) return 'completed'
  // Checked before "play" so "Plan to Play" and "Considering Playing" count as planned.
  if (/consider|plan|next|queue|backlog|wish|maybe|to ?do/.test(t)) return 'nextup'
  if (/play|progress|grind|current|drop|pause|hold|quit/.test(t)) return 'progress'
  return null
}

const text = (v: CellValue) => (v === null || v === undefined ? '' : String(v).trim())

/** Finds the first row that looks like column headings (has a level-name column). */
function findHeader(rows: CellValue[][]): { index: number; fields: (Field | null)[]; labels: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const labels = (rows[i] ?? []).map(text)
    const fields = labels.map((l) => (l ? (HEADERS.find(([, re]) => re.test(l))?.[0] ?? null) : null))
    if (fields.includes('name') && labels.filter(Boolean).length >= 2) return { index: i, fields, labels }
  }
  return null
}

function toNumber(v: CellValue): number | undefined {
  if (typeof v === 'number') return v
  const m = text(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : undefined
}

function toISODate(v: CellValue): string | undefined {
  const t = text(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const ms = Date.parse(t)
  if (!t || Number.isNaN(ms)) return undefined
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Extreme Demon", or just "Extreme". */
function toDifficulty(v: CellValue): Difficulty | undefined {
  const t = text(v).toLowerCase()
  return DIFFICULTIES.find((d) => d.toLowerCase() === t || d.toLowerCase() === `${t} demon`)
}

// Statuses that the import choice already says everything about, so they don't need a note.
const PLAIN_STATUS = /^(completed?|beaten|done|playing|in progress|next up)$/i

/** "Playtime: 3 months", "Best Before Completion: 94%" */
function noteFor(label: string, v: CellValue): string {
  let value = typeof v === 'number' ? v.toLocaleString() : text(v)
  if (typeof v === 'number' && /best|%|percent/i.test(label) && v <= 100) value += '%'
  return `${label}: ${value}`
}

/** Turns spreadsheet sheets into level rows, guessing what each column and section means. */
export function parseSheets(sheets: Sheet[]): ImportRow[] {
  const out: ImportRow[] = []
  for (const sheet of sheets) {
    const header = findHeader(sheet.rows)
    if (!header) continue
    const nameCol = header.fields.indexOf('name')
    const sheetDefault: ImportAs = /complet|beat|done|victor/i.test(sheet.name) ? 'completed' : 'progress'
    let section: { label: string; as: ImportAs } | null = null

    for (let r = header.index + 1; r < sheet.rows.length; r++) {
      const cells = sheet.rows[r] ?? []
      const name = text(cells[nameCol])
      if (!name) continue
      const filled = cells.filter((c, i) => i !== nameCol && text(c)).length

      if (filled === 0) {
        // A lone label is either a section heading ("Next Up") or a footnote; neither is a level.
        const as = statusToImportAs(name)
        if (as) {
          section = { label: name, as }
          continue
        }
        if (name.length > 40 || /[:;.!]$|: /.test(name)) continue
      }

      const row: ImportRow = { key: `${sheet.name}:${r}`, sheet: sheet.name, name, as: section?.as ?? sheetDefault, runs: [], notes: [] }
      if (section) row.status = section.label
      let best: number | undefined

      header.fields.forEach((field, c) => {
        const v = cells[c]
        if (c === nameCol || !text(v)) return
        switch (field) {
          case 'id':
            if (/^\d+$/.test(text(v))) row.gdLevelId = text(v)
            break
          case 'creator':
            row.creator = text(v)
            break
          case 'difficulty':
            row.difficulty = toDifficulty(v)
            if (!row.difficulty) row.notes.push(noteFor(header.labels[c], v))
            break
          case 'aredl':
            row.aredl = toNumber(v)
            break
          case 'pointercrate':
            row.pointercrate = toNumber(v)
            break
          case 'status': {
            row.status = text(v)
            const as = statusToImportAs(text(v))
            if (as) row.as = as
            break
          }
          case 'beatenDate':
            row.beatenDate = toISODate(v)
            break
          case 'bestFromZero':
            best = toNumber(v)
            break
          case 'runs':
            for (const part of text(v).split(/[,;\n]|\s{2,}/)) {
              const run = parseQuickRun(part)
              if (run && !validateRun(run.start, run.end)) row.runs.push(run)
            }
            break
          case 'goal':
            row.goal = text(v)
            break
          case 'targetDate':
            row.targetDate = toISODate(v)
            break
          case 'attempts':
            row.attempts = toNumber(v)
            break
          case 'notes':
            row.notes.push(text(v))
            break
          default:
            row.notes.push(noteFor(header.labels[c], v))
        }
      })

      if (best !== undefined && best > 0 && best < 100 && !row.runs.some((x) => x.start === 0 && x.end >= best!)) {
        row.runs.unshift({ start: 0, end: round2(best) })
      }
      if (row.status && !PLAIN_STATUS.test(row.status)) row.notes.unshift(`Status: ${row.status}`)
      if (row.beatenDate) row.as = 'completed'
      out.push(row)
    }
  }
  return out
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface ImportPlan {
  row: ImportRow
  /** The level already in the tracker that this row will update, if any. */
  existing?: Level
}

/** Matches rows to levels already in the tracker. A level listed twice is only imported the first time. */
export function planImport(rows: ImportRow[], levels: Level[]): ImportPlan[] {
  const seen = new Set<string>()
  return rows.map((row) => {
    const key = norm(row.name)
    const duplicate = seen.has(key)
    seen.add(key)
    return {
      row: duplicate ? { ...row, as: 'skip' } : row,
      existing: levels.find((l) => (row.gdLevelId && l.gdLevelId === row.gdLevelId) || norm(l.name) === key),
    }
  })
}

export interface ImportSummary {
  added: number
  updated: number
  runs: number
}

/** Saves the chosen rows. New levels are added; levels already in the tracker are filled in, never overwritten. */
export async function applyImport(plans: ImportPlan[], defaultDifficulty: Difficulty): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, updated: 0, runs: 0 }
  const now = Date.now()

  await db.transaction('rw', db.levels, db.runs, async () => {
    const queued = await db.levels.filter((l) => l.queuePos !== undefined).toArray()
    let nextQueuePos = Math.max(0, ...queued.map((l) => l.queuePos!)) + 1
    const runsToAdd: Run[] = []

    for (const [i, { row, existing }] of plans.entries()) {
      if (row.as === 'skip') continue
      const ranks: ListRanks | undefined =
        row.aredl !== undefined || row.pointercrate !== undefined
          ? { aredl: row.aredl, pointercrate: row.pointercrate, checkedAt: now }
          : undefined
      const beaten = row.as === 'completed'
      const notes = row.notes.join('\n')

      let levelId: string
      let existingRuns: Run[] = []
      if (existing) {
        levelId = existing.id
        existingRuns = await db.runs.where('levelId').equals(existing.id).toArray()
        const extraNotes = row.notes.filter((n) => !existing.notes?.includes(n)).join('\n')
        await db.levels.update(existing.id, {
          gdLevelId: existing.gdLevelId ?? row.gdLevelId,
          creator: existing.creator === 'Unknown' && row.creator ? row.creator : existing.creator,
          listRanks: ranks ? { ...existing.listRanks, ...ranks } : existing.listRanks,
          notes: [existing.notes, extraNotes].filter(Boolean).join('\n') || undefined,
          goal: existing.goal ?? row.goal,
          attempts: row.attempts ?? existing.attempts,
          targetDate: existing.targetDate ?? row.targetDate,
          ...(beaten && !existing.beaten ? { beaten: true, beatenDate: row.beatenDate, queuePos: undefined } : {}),
          ...(row.as === 'nextup' && existing.queuePos === undefined && !existing.beaten ? { queuePos: nextQueuePos++ } : {}),
        })
        summary.updated++
      } else {
        levelId = uid()
        await db.levels.add({
          id: levelId,
          gdLevelId: row.gdLevelId,
          name: row.name,
          creator: row.creator || 'Unknown',
          difficulty: row.difficulty ?? (row.aredl !== undefined || row.pointercrate !== undefined ? 'Extreme Demon' : defaultDifficulty),
          // Keep the spreadsheet's order when sorting by "recently played".
          dateAdded: new Date(now - i).toISOString(),
          beaten,
          beatenDate: beaten ? row.beatenDate : undefined,
          notes: notes || undefined,
          goal: row.goal,
          targetDate: row.targetDate,
          attempts: row.attempts,
          listRanks: ranks,
          queuePos: row.as === 'nextup' ? nextQueuePos++ : undefined,
        })
        summary.added++
      }

      for (const run of row.runs) {
        if (existingRuns.some((r) => r.start === run.start && r.end === run.end)) continue
        runsToAdd.push({
          id: uid(),
          levelId,
          ...run,
          date: todayISO(),
          createdAt: now + runsToAdd.length,
          note: 'Imported from spreadsheet',
        })
      }
    }
    await db.runs.bulkAdd(runsToAdd)
    summary.runs = runsToAdd.length
  })
  return summary
}
