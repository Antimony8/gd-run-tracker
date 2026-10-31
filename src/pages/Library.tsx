import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Level, Run } from '../types'
import { calculateRuns } from '../lib/runCalc'
import { countdown, daysUntil, formatDate, pct } from '../lib/format'
import { listRank } from '../lib/levelInfo'
import { moveInQueue, removeFromQueue } from '../lib/data'
import { useShortcut } from '../lib/shortcuts'
import { useThumbBackground } from '../lib/levelThumbnail'
import { BackupReminder } from '../components/BackupReminder'
import { DifficultyBadge, DifficultyOrb } from '../components/DifficultyBadge'
import { compareHardest, demonTier } from '../lib/demonTier'
import { AddLevelModal } from '../components/AddLevelModal'
import { href } from '../router'

type Sort = 'recent' | 'runs' | 'difficulty' | 'list' | 'name'

interface Entry {
  level: Level
  runCount: number | null // null = no full chain yet
  reach: number
  totalRuns: number
  lastActivity: number
}

export function Library() {
  const levels = useLiveQuery(() => db.levels.toArray())
  const runs = useLiveQuery(() => db.runs.toArray())
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const searchRef = useRef<HTMLInputElement>(null)
  useShortcut('/', () => searchRef.current?.focus())
  useShortcut('a', () => setAdding(true))

  const entries = useMemo(() => {
    if (!levels || !runs) return null
    const byLevel = new Map<string, Run[]>()
    for (const r of runs) byLevel.set(r.levelId, [...(byLevel.get(r.levelId) ?? []), r])
    return levels.map((level): Entry => {
      const lr = byLevel.get(level.id) ?? []
      const calc = calculateRuns(lr)
      return {
        level,
        runCount: calc.complete ? calc.chain.length : null,
        reach: calc.reach,
        totalRuns: lr.length,
        lastActivity: Math.max(Date.parse(level.dateAdded), ...lr.map((r) => r.createdAt)),
      }
    })
  }, [levels, runs])

  if (!entries) return <div className="loading outlined">Loading…</div>

  const q = search.trim().toLowerCase()
  const filtered = entries
    .filter((e) => !q || e.level.name.toLowerCase().includes(q) || e.level.creator.toLowerCase().includes(q))
    .sort(sorter(sort))

  const nextUp = filtered
    .filter((e) => !e.level.beaten && e.level.queuePos !== undefined)
    .sort((a, b) => a.level.queuePos! - b.level.queuePos!)
  const inProgress = filtered.filter((e) => !e.level.beaten && e.level.queuePos === undefined)
  const completed = filtered.filter((e) => e.level.beaten)

  return (
    <div className="page">
      <header className="top-bar">
        <h1 className="logo outlined">
          RUN <span>TRACKER</span>
        </h1>
        <div className="top-actions">
          <a className="gd-btn gray small" href={href.settings}>
            ⚙ Settings
          </a>
          <button className="gd-btn green" onClick={() => setAdding(true)} title="Shortcut: A">
            + Add Level
          </button>
        </div>
      </header>

      {entries.length > 0 && <BackupReminder />}

      {entries.length === 0 ? (
        <div className="panel empty">
          <h2 className="outlined">No levels yet</h2>
          <p>Add the level you're grinding, log your start-pos runs, and see how many runs you have it in.</p>
          <button className="gd-btn green big" onClick={() => setAdding(true)}>
            + Add your first level
          </button>
          <p>
            Already tracking in a spreadsheet? <a className="text-link" href={href.settings}>Import it in Settings</a>.
          </p>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              ref={searchRef}
              className="search"
              placeholder="Search levels or creators…  ( / )"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort levels">
              <option value="recent">Recently played</option>
              <option value="runs">Fewest runs</option>
              <option value="difficulty">Hardest first</option>
              <option value="list">Demon list rank</option>
              <option value="name">Name</option>
            </select>
          </div>

          <QueueSection entries={nextUp} searching={!!q} />
          <Section title="In Progress" entries={inProgress} empty="Nothing in progress. Time to find a new level!" />
          <Section title="Completed" entries={completed} empty="No completions yet. You've got this." />
        </>
      )}

      {adding && <AddLevelModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function sorter(sort: Sort) {
  return (a: Entry, b: Entry) => {
    switch (sort) {
      case 'runs':
        // Full chains first (fewest runs), then by how far the chain reaches.
        return (a.runCount ?? 999) - (b.runCount ?? 999) || b.reach - a.reach
      case 'difficulty':
        return compareHardest(a.level, b.level)
      case 'list':
        // Ranked levels by position, then everything else hardest first.
        return (listRank(a.level.listRanks) ?? Infinity) - (listRank(b.level.listRanks) ?? Infinity) || compareHardest(a.level, b.level)
      case 'name':
        return a.level.name.localeCompare(b.level.name)
      default:
        return b.lastActivity - a.lastActivity
    }
  }
}

function Section({ title, entries, empty }: { title: string; entries: Entry[]; empty: string }) {
  return (
    <section className="section">
      <h2 className="section-title outlined">
        {title} <span className="count">{entries.length}</span>
      </h2>
      {entries.length === 0 ? (
        <p className="muted section-empty">{empty}</p>
      ) : (
        <div className="level-grid">
          {entries.map((e) => (
            <LevelCard key={e.level.id} entry={e} />
          ))}
        </div>
      )}
    </section>
  )
}

/** The "Next Up" queue: levels you plan to play next, in order. */
function QueueSection({ entries, searching }: { entries: Entry[]; searching: boolean }) {
  if (searching && entries.length === 0) return null
  return (
    <section className="section">
      <h2 className="section-title outlined">
        Next Up <span className="count">{entries.length}</span>
      </h2>
      {entries.length === 0 ? (
        <p className="muted section-empty">Queue up what you'll play next with the "+ Next Up" button on a level's page.</p>
      ) : (
        <ol className="queue">
          {entries.map((e, i) => (
            <li key={e.level.id} className="queue-item">
              <span className="queue-num outlined">{i + 1}</span>
              <LevelCard entry={e} />
              <div className="queue-controls">
                <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => moveInQueue(e.level, -1)}>
                  ▲
                </button>
                <button
                  className="icon-btn"
                  title="Move down"
                  disabled={i === entries.length - 1}
                  onClick={() => moveInQueue(e.level, 1)}
                >
                  ▼
                </button>
                <button className="icon-btn danger" title="Remove from Next Up" onClick={() => removeFromQueue(e.level)}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function LevelCard({ entry }: { entry: Entry }) {
  const { level, runCount, reach, totalRuns } = entry
  const rank = listRank(level.listRanks)
  const tier = demonTier(level)
  const days = !level.beaten && level.targetDate ? daysUntil(level.targetDate) : null
  const thumb = useThumbBackground(level)
  return (
    <a
      className={`level-card panel ${level.beaten ? 'beaten' : ''} ${thumb.className}`}
      href={href.level(level.id)}
      style={thumb.style}
    >
      <DifficultyOrb difficulty={level.difficulty} tier={tier} />
      <div className="level-card-body">
        <h3 className="outlined">{level.name}</h3>
        <p className="muted">by {level.creator}</p>
        <div className="badge-row">
          <DifficultyBadge difficulty={level.difficulty} tier={tier} />
          {rank !== null && <span className="chip rank-chip">#{rank}</span>}
          {days !== null && (
            <span className={`chip goal-chip ${days < 0 ? 'overdue' : ''}`} title={level.goal}>
              ⚑ {countdown(days)}
            </span>
          )}
        </div>
      </div>
      <div className="level-card-stat">
        {level.beaten ? (
          <>
            <span className="stat-big outlined gold">✔</span>
            <span className="stat-label">{level.beatenDate ? formatDate(level.beatenDate) : 'Beaten'}</span>
          </>
        ) : runCount !== null ? (
          <>
            <span className="stat-big outlined">{runCount}</span>
            <span className="stat-label">{runCount === 1 ? 'run' : 'runs'}</span>
          </>
        ) : (
          <>
            <span className="stat-big outlined dim">{totalRuns ? pct(reach) : '–'}</span>
            <span className="stat-label">{totalRuns ? 'chained' : 'no runs'}</span>
          </>
        )}
      </div>
      <div className="mini-bar">
        <div style={{ width: `${level.beaten ? 100 : reach}%` }} />
      </div>
    </a>
  )
}
