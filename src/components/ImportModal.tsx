import { useMemo, useState } from 'react'
import { Modal } from './Modal'
import { DIFFICULTIES, type Difficulty, type Level } from '../types'
import { IMPORT_AS_LABELS, applyImport, planImport, type ImportAs, type ImportRow } from '../lib/spreadsheetImport'
import { findOnAredlByName } from '../lib/levelInfo'
import { runLabel } from '../lib/format'
import { showToast } from '../lib/toast'
import { href, navigate } from '../router'

interface Props {
  fileName: string
  rows: ImportRow[]
  levels: Level[]
  onClose: () => void
}

/** Preview of a spreadsheet import: choose how each row comes in, then save. */
export function ImportModal({ fileName, rows: initialRows, levels, onClose }: Props) {
  const [rows, setRows] = useState(initialRows)
  const [lookup, setLookup] = useState(true)
  const [difficulty, setDifficulty] = useState<Difficulty>('Extreme Demon')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const plans = useMemo(() => planImport(rows, levels), [rows, levels])
  const chosen = plans.filter((p) => p.row.as !== 'skip')
  const counts = (as: ImportAs) => chosen.filter((p) => p.row.as === as).length

  const setAs = (key: string, as: ImportAs) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, as } : r)))

  const save = async () => {
    setError('')
    let toSave = plans
    let lookupNote = ''
    try {
      const missing = chosen.filter((p) => !p.row.gdLevelId && !p.existing?.gdLevelId).map((p) => p.row.name)
      if (lookup && missing.length) {
        setBusy('Looking levels up on the AREDL…')
        try {
          const found = await findOnAredlByName(missing)
          // Use the live AREDL position too, since spreadsheet ranks are snapshots.
          toSave = plans.map((p) => {
            const hit = found.get(p.row.name)
            return hit ? { ...p, row: { ...p.row, gdLevelId: hit.gdLevelId, aredl: hit.position } } : p
          })
          lookupNote = ` Found ${found.size} of ${missing.length} on the AREDL.`
        } catch {
          lookupNote = " Couldn't reach the AREDL, so the spreadsheet's ranks were used."
        }
      }
      setBusy('Importing…')
      const res = await applyImport(toSave, difficulty)
      showToast(
        `Imported ${res.added} new level${res.added === 1 ? '' : 's'}${res.updated ? `, updated ${res.updated}` : ''}` +
          `${res.runs ? ` and ${res.runs} run${res.runs === 1 ? '' : 's'}` : ''}.${lookupNote}`,
      )
      onClose()
      navigate(href.library)
    } catch (err) {
      setError(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed.')
      setBusy(null)
    }
  }

  return (
    <Modal title="Import Spreadsheet" onClose={onClose} wide>
      <div className="form">
        <p>
          Found <strong>{rows.length}</strong> levels in <strong>{fileName}</strong>. Check how each one should come in.
          Levels already in your tracker are filled in, never overwritten.
        </p>

        <ul className="import-list">
          {plans.map(({ row, existing }) => (
            <li key={row.key} className={`import-row ${row.as === 'skip' ? 'skipped' : ''}`}>
              <div className="import-name">
                <strong>{row.name}</strong>
                <span className="muted">
                  {[row.sheet, row.status].filter(Boolean).join(' · ')}
                  {existing && <span className="chip import-existing">Already added: will update</span>}
                </span>
              </div>
              <div className="import-details muted">
                {row.aredl !== undefined && <span>AREDL #{row.aredl}</span>}
                {row.runs.length > 0 && <span>Runs: {row.runs.map((r) => runLabel(r.start, r.end)).join(', ')}</span>}
                {row.notes.length > 0 && <span title={row.notes.join('\n')}>{row.notes.length} notes</span>}
              </div>
              <select value={row.as} onChange={(e) => setAs(row.key, e.target.value as ImportAs)} aria-label={`Import ${row.name} as`}>
                {Object.entries(IMPORT_AS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        <label className="check-row">
          <input type="checkbox" checked={lookup} onChange={(e) => setLookup(e.target.checked)} />
          <span>Look up level IDs and current ranks on the AREDL (needs internet)</span>
        </label>
        <label className="field">
          <span className="field-label">Difficulty for levels without a rank or difficulty</span>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>

        <p className="hint">
          {counts('completed')} completed · {counts('progress')} in progress · {counts('nextup')} next up ·{' '}
          {plans.length - chosen.length} skipped. Download a backup in Settings first if you want an easy way back.
        </p>
        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose} disabled={!!busy}>
            Cancel
          </button>
          <button type="button" className="gd-btn green" onClick={save} disabled={!!busy || chosen.length === 0}>
            {busy ?? `Import ${chosen.length} level${chosen.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
