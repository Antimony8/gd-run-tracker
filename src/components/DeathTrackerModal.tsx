import { useState } from 'react'
import { Modal } from './Modal'
import { applyDeathTrackerImport, completedFromZero, runsToImport, type DTAction, type DTPlan } from '../lib/deathTracker'
import { runLabel } from '../lib/format'
import { showToast } from '../lib/toast'
import { href, navigate } from '../router'

const ACTION_LABELS: Record<DTAction, string> = { update: 'Update', add: 'Add as new level', skip: "Don't import" }

/** Preview of a Death Tracker import: matched levels update, others can be added. */
export function DeathTrackerModal({ plans: initial, onClose }: { plans: DTPlan[]; onClose: () => void }) {
  const [plans, setPlans] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chosen = plans.filter((p) => p.action !== 'skip')
  const unmatched = plans.filter((p) => !p.existing)

  const setAction = (key: string, action: DTAction) =>
    setPlans((ps) => ps.map((p) => (p.dt.key === key ? { ...p, action } : p)))

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
          Found <strong>{plans.length}</strong> levels. <strong>{plans.length - unmatched.length}</strong> match levels in your
          tracker and will be updated.{' '}
          {unmatched.length > 0 && (
            <>
              The other {unmatched.length} aren't in your tracker;{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => setPlans((ps) => ps.map((p) => (p.existing ? p : { ...p, action: 'add' })))}
              >
                add them all
              </button>{' '}
              or pick some below.
            </>
          )}
        </p>
        <ul className="import-list">
          {plans.map(({ dt, existing, action }) => {
            const runs = runsToImport(dt)
            return (
              <li key={dt.key} className={`import-row ${action === 'skip' ? 'skipped' : ''}`}>
                <div className="import-name">
                  <strong>{existing?.name ?? dt.name}</strong>
                  <span className="muted">
                    {dt.gdLevelId ? `ID ${dt.gdLevelId}` : dt.key}
                    {existing && <span className="chip import-existing">In your tracker</span>}
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
                </div>
                <select value={action} onChange={(e) => setAction(dt.key, e.target.value as DTAction)} aria-label={`Import ${dt.name} as`}>
                  {(existing ? (['update', 'skip'] as const) : (['add', 'skip'] as const)).map((a) => (
                    <option key={a} value={a}>
                      {ACTION_LABELS[a]}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
        <p className="hint">
          Imports attempts (never lowering yours), deaths by percent, playtime, your best from 0 and the start-pos runs that
          aren't covered by a longer one. Levels beaten from 0 are marked beaten. Nothing is deleted.
        </p>
        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="gd-btn green" onClick={save} disabled={busy || chosen.length === 0}>
            {busy ? 'Importing…' : `Import ${chosen.length} level${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
