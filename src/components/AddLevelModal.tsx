import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { db } from '../db'
import { DIFFICULTIES, type Difficulty, type Level, type ListRanks } from '../types'
import { lookupLevel } from '../lib/levelInfo'
import { uid } from '../lib/format'
import { refreshListRanks } from '../lib/data'
import { tierForRank } from '../lib/demonTier'
import { navigate, href } from '../router'

export function AddLevelModal({ onClose }: { onClose: () => void }) {
  const [gdId, setGdId] = useState('')
  const [name, setName] = useState('')
  const [creator, setCreator] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('Unrated')
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({ type: 'idle' })
  const [error, setError] = useState('')
  // Ranks from the last lookup, kept only while the ID box still matches.
  const [ranks, setRanks] = useState<{ id: string; ranks: ListRanks } | null>(null)

  const lookup = async () => {
    const id = gdId.trim()
    if (!/^\d+$/.test(id)) {
      setStatus({ type: 'error', msg: "Level IDs are numbers only. You can find it on the level's info page in-game." })
      return
    }
    setStatus({ type: 'loading' })
    try {
      const res = await lookupLevel(id)
      setRanks({ id, ranks: res.ranks })
      if (!res.info) {
        setStatus({
          type: 'error',
          msg: "Couldn't find that level. The lookup services may be down, so fill in the details yourself below.",
        })
        return
      }
      setName(res.info.name)
      setCreator(res.info.creator)
      setDifficulty(res.info.difficulty)
      const rank = res.ranks.aredl ?? res.ranks.pointercrate
      const tier = tierForRank(res.ranks.aredl)
      setStatus({
        type: 'ok',
        msg: `Found it on ${res.source}!${rank ? ` It's #${rank} on the demon list${tier ? ` (${tier.name})` : ''}.` : ''} Check the details below.`,
      })
    } catch {
      setStatus({ type: 'error', msg: "Couldn't look that level up. Fill in the details yourself below." })
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give the level a name.')
      return
    }
    const id = uid()
    const gdLevelId = gdId.trim() || undefined
    if (gdLevelId && !/^\d+$/.test(gdLevelId)) return setError('Level IDs are numbers only.')
    const knownRanks = ranks && ranks.id === gdLevelId ? ranks.ranks : undefined
    await db.levels.add({
      id,
      gdLevelId,
      listRanks: knownRanks,
      name: name.trim(),
      creator: creator.trim() || 'Unknown',
      difficulty,
      dateAdded: new Date().toISOString(),
      beaten: false,
    })
    onClose()
    navigate(href.level(id))
    // If they skipped the lookup, check the demon lists in the background.
    if (gdLevelId && !knownRanks) refreshListRanks({ id, gdLevelId } as Level)
  }

  return (
    <Modal title="Add Level" onClose={onClose}>
      <form onSubmit={save} className="form">
        <div className="field">
          <span className="field-label">Level ID (optional)</span>
          <div className="row">
            <input
              inputMode="numeric"
              placeholder="e.g. 128"
              value={gdId}
              onChange={(e) => setGdId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  lookup()
                }
              }}
            />
            <button type="button" className="gd-btn blue small" onClick={lookup} disabled={status.type === 'loading'}>
              {status.type === 'loading' ? 'Looking…' : 'Look up'}
            </button>
          </div>
          {status.msg && <p className={`hint ${status.type === 'error' ? 'warn' : 'good'}`}>{status.msg}</p>}
        </div>

        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Level name" />
        </label>

        <div className="row two">
          <label className="field">
            <span className="field-label">Creator</span>
            <input value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="Creator" />
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

        {error && <p className="hint warn">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="gd-btn gray" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="gd-btn green">
            Add Level
          </button>
        </div>
      </form>
    </Modal>
  )
}
