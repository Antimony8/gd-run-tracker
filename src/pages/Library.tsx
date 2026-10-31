import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Level, Run } from '../types'
import { calculateRuns } from '../lib/runCalc'
import { formatDate, pct } from '../lib/format'
import { DIFFICULTIES } from '../types'
import { DifficultyBadge, DifficultyOrb } from '../components/DifficultyBadge'
import { AddLevelModal } from '../components/AddLevelModal'
import { href } from '../router'

type Sort = 'recent' | 'runs' | 'difficulty' | 'name'

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

  const inProgress = filtered.filter((e) => !e.level.beaten)
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
          <button className="gd-btn green" onClick={() => setAdding(true)}>
            + Add Level
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <div className="panel empty">
          <h2 className="outlined">No levels yet</h2>
          <p>Add the level you're grinding, log your start-pos runs, and see how many runs you have it in.</p>
          <button className="gd-btn green big" onClick={() => setAdding(true)}>
            + Add your first level
          </button>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Search levels or creators…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort levels">
              <option value="recent">Recently played</option>
              <option value="runs">Fewest runs</option>
              <option value="difficulty">Hardest first</option>
              <option value="name">Name</option>
            </select>
          </div>

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
        return DIFFICULTIES.indexOf(b.level.difficulty) - DIFFICULTIES.indexOf(a.level.difficulty)
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

function LevelCard({ entry }: { entry: Entry }) {
  const { level, runCount, reach, totalRuns } = entry
  return (
    <a className={`level-card panel ${level.beaten ? 'beaten' : ''}`} href={href.level(level.id)}>
      <DifficultyOrb difficulty={level.difficulty} />
      <div className="level-card-body">
        <h3 className="outlined">{level.name}</h3>
        <p className="muted">by {level.creator}</p>
        <DifficultyBadge difficulty={level.difficulty} />
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
