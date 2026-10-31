export const uid = () => crypto.randomUUID()

/** Rounds to at most 2 decimal places. */
export const round2 = (n: number) => Math.round(n * 100) / 100

/** 47 -> "47%", 47.3 -> "47.3%", 47.25 -> "47.25%" */
export const pct = (n: number) => `${round2(n)}%`

export const range = (start: number, end: number) => `${round2(start)}–${round2(end)}%`

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Whole days from today until a YYYY-MM-DD date (negative once it's passed). */
export function daysUntil(iso: string, today = todayISO()): number {
  const toDay = (d: string) => {
    const [y, m, day] = d.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, day) / 86_400_000
  }
  return Math.round(toDay(iso) - toDay(today))
}

/** 3 -> "3 days left", 0 -> "due today", -1 -> "1 day overdue" */
export function countdown(days: number): string {
  if (days === 0) return 'due today'
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} overdue`
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let n = bytes / 1024
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`
}

/** Validates a start/end pair. Returns an error message, or null if valid. */
export function validateRun(start: number, end: number): string | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Enter both percentages.'
  if (start < 0 || end > 100) return 'Percentages must be between 0 and 100.'
  if (start >= end) return 'The end % has to be higher than the start %.'
  return null
}

/** Parses quick-entry text like "25-75", "25.5 - 80", "0 to 50%". */
export function parseQuickRun(text: string): { start: number; end: number } | null {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*%?$/i)
  if (!m) return null
  return { start: round2(Number(m[1])), end: round2(Number(m[2])) }
}
