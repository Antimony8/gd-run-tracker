import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { VideoPicker, choiceError, initialChoice, type VideoChoice } from './VideoPicker'
import { db } from '../db'
import type { Run } from '../types'
import { round2, todayISO, uid, validateRun } from '../lib/format'
import { applyVideoChoice, needsDrive, saveErrorMessage } from '../lib/data'
import { ensureDriveAccess } from '../lib/googleDrive'

interface Props {
  levelId: string
  run?: Run // editing when set
  onClose: () => void
}

export function RunFormModal({ levelId, run, onClose }: Props) {
  const [start, setStart] = useState(run ? String(run.start) : '')
  const [end, setEnd] = useState(run ? String(run.end) : '')
  const [date, setDate] = useState(run?.date ?? todayISO())
  const [note, setNote] = useState(run?.note ?? '')
  const [video, setVideo] = useState<VideoChoice>(initialChoice(run?.video))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const s = round2(Number(start))
    const en = round2(Number(end))
    const err = (start === '' || end === '' ? 'Enter both percentages.' : validateRun(s, en)) ?? choiceError(video)
    if (err) return setError(err)

    setSaving(true)
    try {
      // Ask for Google access first, while this still counts as the user's tap.
      if (needsDrive(video)) await ensureDriveAccess()
      const videoRef = await applyVideoChoice(video, run?.video, setStatus)
      const data: Run = {
        id: run?.id ?? uid(),
        levelId,
        start: s,
        end: en,
        date: date || todayISO(),
        createdAt: run?.createdAt ?? Date.now(),
        note: note.trim() || undefined,
        video: videoRef,
      }
      await db.runs.put(data)
      onClose()
    } catch (err) {
      setError(saveErrorMessage(err))
      setSaving(false)
      setStatus('')
    }
  }

  return (
    <Modal title={run ? 'Edit Run' : 'Log Run'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="row two">
          <label className="field">
            <span className="field-label">Start %</span>
            <input type="number" min={0} max={100} step={0.01} value={start} onChange={(e) => setStart(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span className="field-label">End %</span>
            <input type="number" min={0} max={100} step={0.01} value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. choked the wave at 82" />
        </label>
        <VideoPicker value={video} onChange={setVideo} existing={run?.video} />
        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="gd-btn green" disabled={saving}>
            {saving ? status || 'Saving…' : run ? 'Save' : 'Log Run'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
