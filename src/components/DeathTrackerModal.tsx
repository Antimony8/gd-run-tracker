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
 * Preview of a Death Tracker import, split into levels on the GD servers and editor levels (like
 * start-pos copies). Every mod level can feed any tracker level, so a level and its copies combine.
 */
export function DeathTrackerModal({ plans: initial, levels, onClose }: Props) {
  const [plans, setPlans] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sortedLevels = useMemo(() => [...levels].sort((a, b) => a.name.localeCompare(b.name)), [levels])
  const chosen = plans.filter((p) => p.target !== 'skip')

  const setTarget = (key: string, target: DTTarget) =>
    setPlans((ps) => ps.map((p) => (p.dt.key === key ? { ...p, target } : p)))
  /** Sets every plan in one group: skip all, or back to its suggestion. */
  const setGroup = (editor: boolean, to: 'skip' | 'suggested') =>
    setPlans((ps) =>
      ps.map((p) => (p.dt.editor !== editor ? p : { ...p, target: to === 'skip' ? 'skip' : (p.suggested?.levelId ?? 'skip') })),
    )

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

  const group = (editor: boolean) => plans.filter((p) => p.dt.editor === editor)

  return (
    <Modal title="Import from Death Tracker" onClose={onClose} wide>
      <div className="form">
        <p>
          Found <strong>{plans.length}</strong> levels in Death Tracker. Choose where each one's deaths, attempts and runs go;
          several can add to the same level, so editor copies (like "Bloodbath start pos") combine with the real level.
        </p>

        {[false, true].map((editor) => (
          <PlanGroup
            key={String(editor)}
            title={editor ? 'Editor levels' : 'Levels on the servers'}
            hint={editor ? 'Your copies, like start-pos or practice copies' : 'Online and main-game levels'}
            plans={group(editor)}
            levels={levels}
            sortedLevels={sortedLevels}
            onTarget={setTarget}
            onUnselectAll={() => setGroup(editor, 'skip')}
            onSelectMatches={() => setGroup(editor, 'suggested')}
          />
        ))}

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

interface GroupProps {
  title: string
  hint: string
  plans: DTPlan[]
  levels: Level[]
  sortedLevels: Level[]
  onTarget: (key: string, target: DTTarget) => void
  onUnselectAll: () => void
  onSelectMatches: () => void
}

function PlanGroup({ title, hint, plans, levels, sortedLevels, onTarget, onUnselectAll, onSelectMatches }: GroupProps) {
  const [showAll, setShowAll] = useState(false)
  if (plans.length === 0) return null

  const selected = plans.filter((p) => p.target !== 'skip').length
  const others = plans.filter((p) => !p.suggested && p.target === 'skip')
  // Unmatched, unselected levels stay tucked away until asked for.
  const visible = showAll ? plans : plans.filter((p) => p.suggested || p.target !== 'skip')
  const nameOf = (id: string) => levels.find((l) => l.id === id)?.name ?? 'level'

  return (
    <section className="dt-group">
      <div className="dt-group-head">
        <div>
          <h3 className="outlined">
            {title} <span className="count">{selected}/{plans.length}</span>
          </h3>
          <p className="muted dt-group-hint">{hint}</p>
        </div>
        <div className="dt-group-actions">
          <button type="button" className="gd-btn gray small" onClick={onUnselectAll} disabled={selected === 0}>
            Unselect all
          </button>
          <button type="button" className="gd-btn blue small" onClick={onSelectMatches}>
            Select matches
          </button>
        </div>
      </div>

      {visible.length > 0 ? (
        <ul className="import-list dt-list">
          {visible.map(({ dt, suggested: s, target }) => {
            const runs = runsToImport(dt)
            return (
              <li key={dt.key} className={`import-row ${target === 'skip' ? 'skipped' : ''}`}>
                <div className="import-name">
                  <strong>{dt.name}</strong>
                  <span className="muted">
                    {dt.editor ? 'Editor level' : dt.gdLevelId ? `ID ${dt.gdLevelId}` : 'Main level'}
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
                <select value={target} onChange={(e) => onTarget(dt.key, e.target.value)} aria-label={`Where ${dt.name} goes`}>
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
      ) : (
        <p className="muted">None of these match levels in your tracker.</p>
      )}
      {others.length > 0 && (
        <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Hide' : 'Show'} {others.length} unmatched level{others.length === 1 ? '' : 's'}
        </button>
      )}
    </section>
  )
}
