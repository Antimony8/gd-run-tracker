import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { applyDeathTrackerImport, completedFromZero, runsToImport, type DTPlan, type DTTarget } from '../lib/deathTracker'
import { runLabel } from '../lib/format'
import { showToast } from '../lib/toast'
import { href, navigate } from '../router'
import type { Level } from '../types'

const REASONS = { id: 'same level ID', linked: 'linked before', name: 'name matches' } as const

interface Props {
  plans: DTPlan[]
  levels: Level[]
  onClose: () => void
}

/**
 * Preview of a Death Tracker import. Every mod level can feed any tracker level, so a level's
 * online version and its editor copies (start-pos copies and so on) can be combined into one.
 */
export function DeathTrackerModal({ plans: initial, levels, onClose }: Props) {
  const [plans, setPlans] = useState(initial)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sortedLevels = useMemo(() => [...levels].sort((a, b) => a.name.localeCompare(b.name)), [levels])
  const nameOf = (id: string) => levels.find((l) => l.id === id)?.name ?? 'level'
  const chosen = plans.filter((p) => p.target !== 'skip')
  const suggested = plans.filter((p) => p.suggested)
  const others = plans.filter((p) => !p.suggested)
  const visible = showAll ? plans : suggested

  const setTarget = (key: string, target: DTTarget) =>
    setPlans((ps) => ps.map((p) => (p.dt.key === key ? { ...p, target } : p)))

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await applyDeathTrackerImport(plans)
      showToast(
        `Death Tracker: updated ${res.updated} level${res.updated === 1 ? '' : 's'}` +
          `${res.added ? `, added ${res.added}` : ''}${res.runs ? `, ${res.runs} new run${res.runs === 1 ? '' : 's'}` : ''}.`,
      )
      onClose()
      navigate(href.library)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Import from Death Tracker" onClose={onClose} wide>
      <div className="form">
        <p>
          Found <strong>{plans.length}</strong> levels in Death Tracker. <strong>{suggested.length}</strong> look like levels in your
          tracker, including editor copies with matching names (like "Bloodbath start pos"). Choose where each one's deaths,
          attempts and runs should go; several can add to the same level.
        </p>

        <ul className="import-list">
          {visible.map(({ dt, suggested: s, target }) => {
            const runs = runsToImport(dt)
            return (
              <li key={dt.key} className={`import-row ${target === 'skip' ? 'skipped' : ''}`}>
                <div className="import-name">
                  <strong>{dt.name}</strong>
                  <span className="muted">
                    {dt.editor ? 'Editor level' : dt.gdLevelId ? `ID ${dt.gdLevelId}` : dt.key}
                    {dt.editor && <span className="chip import-existing">Copy</span>}
                    {completedFromZero(dt.deaths) && <span className="chip import-existing">Beaten</span>}
                  </span>
                </div>
                <div className="import-details muted">
                  <span>{dt.attempts.toLocaleString()} attempts</span>
                  {runs.length > 0 && (
                    <span title={runs.map((r) => runLabel(r.start, r.end)).join(', ')}>
                      {runs.length} run{runs.length === 1 ? '' : 's'}
                    </span>
                  )}
                  {s && (
                    <span>
                      → {nameOf(s.levelId)} ({REASONS[s.reason]})
                    </span>
                  )}
                </div>
                <select value={target} onChange={(e) => setTarget(dt.key, e.target.value)} aria-label={`Where ${dt.name} goes`}>
                  <option value="skip">Don't import</option>
                  <option value="new">New level</option>
                  <optgroup label="Add to…">
                    {sortedLevels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.id === s?.levelId ? '★ ' : ''}
                        {l.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </li>
            )
          })}
        </ul>
        {others.length > 0 && (
          <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Hide' : 'Show'} {others.length} other Death Tracker level{others.length === 1 ? '' : 's'}
          </button>
        )}

        <p className="hint">
          Combines deaths, attempts (never lowering yours), playtime and runs from every source you link to a level. Re-importing
          replaces each source's numbers instead of adding them twice, and remembers your links. Nothing is deleted.
        </p>
        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="gd-btn green" onClick={save} disabled={busy || chosen.length === 0}>
            {busy ? 'Importing…' : `Import ${chosen.length} source${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
