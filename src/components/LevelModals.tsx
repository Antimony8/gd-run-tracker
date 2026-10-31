import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { VideoPicker, choiceError, initialChoice, type VideoChoice } from './VideoPicker'
import { db } from '../db'
import { DIFFICULTIES, type Difficulty, type Level } from '../types'
import { todayISO } from '../lib/format'
import { applyVideoChoice } from '../lib/data'

export function BeatenModal({ level, onClose }: { level: Level; onClose: () => void }) {
  const [date, setDate] = useState(level.beatenDate ?? todayISO())
  const [video, setVideo] = useState<VideoChoice>(initialChoice(level.completionVideo))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const err = choiceError(video)
    if (err) return setError(err)
    setSaving(true)
    try {
      const completionVideo = await applyVideoChoice(video, level.completionVideo)
      await db.levels.update(level.id, { beaten: true, beatenDate: date || todayISO(), completionVideo })
      onClose()
    } catch {
      setError('Saving failed. Your browser storage may be full.')
      setSaving(false)
    }
  }

  return (
    <Modal title={level.beaten ? 'Edit Completion' : 'Level Complete!'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        {!level.beaten && <p className="complete-banner outlined">GG on {level.name}!</p>}
        <label className="field">
          <span className="field-label">Date beaten</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <VideoPicker value={video} onChange={setVideo} existing={level.completionVideo} />
        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="gd-btn gold" disabled={saving}>
            {saving ? 'Saving…' : level.beaten ? 'Save' : 'Mark Beaten'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function EditLevelModal({ level, onClose }: { level: Level; onClose: () => void }) {
  const [name, setName] = useState(level.name)
  const [creator, setCreator] = useState(level.creator)
  const [difficulty, setDifficulty] = useState<Difficulty>(level.difficulty)
  const [gdId, setGdId] = useState(level.gdLevelId ?? '')
  const [notes, setNotes] = useState(level.notes ?? '')
  const [error, setError] = useState('')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the level a name.')
    await db.levels.update(level.id, {
      name: name.trim(),
      creator: creator.trim() || 'Unknown',
      difficulty,
      gdLevelId: gdId.trim() || undefined,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal title="Edit Level" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="row two">
          <label className="field">
            <span className="field-label">Creator</span>
            <input value={creator} onChange={(e) => setCreator(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Difficulty</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Level ID</span>
          <input inputMode="numeric" value={gdId} onChange={(e) => setGdId(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Notes</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hard parts, settings, goals…" />
        </label>
        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="gd-btn green">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}
