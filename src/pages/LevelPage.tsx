import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Level, Run } from '../types'
import { calculateRuns } from '../lib/runCalc'
import { formatDate, parseQuickRun, pct, range, todayISO, uid, validateRun } from '../lib/format'
import { deleteLevel, deleteRun, removeVideo } from '../lib/data'
import { href, navigate } from '../router'
import { DifficultyBadge, DifficultyOrb } from '../components/DifficultyBadge'
import { NormalBar, RunBar, RunLanes, runColor } from '../components/ProgressBar'
import { RunFormModal } from '../components/RunFormModal'
import { VideoButton } from '../components/VideoModal'
import { BeatenModal, EditLevelModal } from '../components/LevelModals'

type Dialog = { type: 'log' } | { type: 'edit-run'; run: Run } | { type: 'beaten' } | { type: 'edit-level' } | null

export function LevelPage({ id }: { id: string }) {
  // undefined = still loading, null = not found
  const level = useLiveQuery(async () => (await db.levels.get(id)) ?? null, [id])
  const runs = useLiveQuery(() => db.runs.where('levelId').equals(id).toArray(), [id])
  const [dialog, setDialog] = useState<Dialog>(null)

  const calc = useMemo(() => calculateRuns(runs ?? []), [runs])

  if (level === undefined || runs === undefined) return <div className="loading outlined">Loading…</div>
  if (level === null) {
    return (
      <div className="page">
        <div className="panel empty">
          <h2 className="outlined">Level not found</h2>
          <a className="gd-btn green" href={href.library}>
            Back to levels
          </a>
        </div>
      </div>
    )
  }

  const chainIndex = new Map(calc.chain.map((r, i) => [r.id, i]))
  const history = [...runs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const close = () => setDialog(null)

  const onDeleteLevel = async () => {
    if (!confirm(`Delete "${level.name}" and all ${runs.length} of its runs? This can't be undone.`)) return
    await deleteLevel(level)
    navigate(href.library)
  }

  const onUnbeat = async () => {
    if (!confirm('Move this level back to In Progress? Its completion date and video will be removed.')) return
    await removeVideo(level.completionVideo)
    await db.levels.update(level.id, { beaten: false, beatenDate: undefined, completionVideo: undefined })
  }

  return (
    <div className="page">
      <a className="back-link outlined" href={href.library}>
        ‹ Levels
      </a>

      <header className="panel level-header">
        <DifficultyOrb difficulty={level.difficulty} size={84} />
        <div className="level-header-info">
          <h1 className="outlined">{level.name}</h1>
          <p className="muted">
            by {level.creator}
            {level.gdLevelId && <> · ID {level.gdLevelId}</>}
          </p>
          <DifficultyBadge difficulty={level.difficulty} />
        </div>
        <div className="level-header-actions">
          {level.beaten ? (
            <button className="gd-btn gray small" onClick={onUnbeat}>
              Unmark beaten
            </button>
          ) : (
            <button className="gd-btn gold" onClick={() => setDialog({ type: 'beaten' })}>
              ★ Mark Beaten
            </button>
          )}
          <button className="gd-btn blue small" onClick={() => setDialog({ type: 'edit-level' })}>
            Edit
          </button>
          <button className="gd-btn red small" onClick={onDeleteLevel}>
            Delete
          </button>
        </div>
      </header>

      {level.beaten && <CompletionPanel level={level} onEdit={() => setDialog({ type: 'beaten' })} />}

      <section className="panel hero">
        <div className="hero-count">
          {calc.complete ? (
            <>
              <span className="count-num outlined">{calc.chain.length}</span>
              <span className="count-label outlined">{calc.chain.length === 1 ? 'RUN' : 'RUNS'}</span>
            </>
          ) : (
            <>
              <span className="count-num outlined dim">?</span>
              <span className="count-label outlined">{runs.length ? 'NO CHAIN YET' : 'NO RUNS YET'}</span>
            </>
          )}
        </div>
        <div className="hero-bars">
          <RunBar calc={calc} />
          <p className="hero-summary">
            {calc.complete
              ? calc.chain.length === 1
                ? 'You have a full 0–100 run!'
                : `You have it in ${calc.chain.length} runs: ${calc.chain.map((r) => range(r.start, r.end)).join(' → ')}`
              : runs.length
                ? `Chained to ${pct(calc.reach)}. Missing ${range(calc.gap!.from, calc.gap!.to)}.`
                : 'Log your first run below.'}
          </p>
          <RunLanes calc={calc} />
          <div className="best-zero">
            <span className="field-label">Best from 0</span>
            <NormalBar value={calc.bestFromZero?.end ?? 0} />
          </div>
        </div>
      </section>

      <section className="panel runs-panel">
        <div className="runs-head">
          <h2 className="outlined">
            Runs <span className="count">{runs.length}</span>
          </h2>
          <QuickAdd levelId={level.id} />
          <button className="gd-btn green" onClick={() => setDialog({ type: 'log' })}>
            + Log Run
          </button>
        </div>

        {history.length === 0 ? (
          <p className="muted">No runs logged yet.</p>
        ) : (
          <ul className="run-list">
            {history.map((r) => {
              const ci = chainIndex.get(r.id)
              return (
                <li key={r.id} className={`run-row ${ci !== undefined ? 'in-chain' : ''}`}>
                  <span className="run-range outlined" style={ci !== undefined ? { color: runColor(ci) } : undefined}>
                    {range(r.start, r.end)}
                  </span>
                  <div className="run-mini">
                    <div
                      style={{
                        left: `${r.start}%`,
                        width: `${r.end - r.start}%`,
                        background: ci !== undefined ? runColor(ci) : undefined,
                      }}
                    />
                  </div>
                  <span className="run-date muted">{formatDate(r.date)}</span>
                  <span className="run-note">{r.note}</span>
                  <span className="run-actions">
                    {ci !== undefined && <span className="chip chain-chip">Run {ci + 1}</span>}
                    {r.video && <VideoButton video={r.video} title={`${level.name}: ${range(r.start, r.end)}`} />}
                    <button className="icon-btn" title="Edit run" onClick={() => setDialog({ type: 'edit-run', run: r })}>
                      ✎
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete run"
                      onClick={() => confirm(`Delete the ${range(r.start, r.end)} run?`) && deleteRun(r)}
                    >
                      🗑
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {level.notes && (
        <section className="panel notes">
          <h2 className="outlined">Notes</h2>
          <p>{level.notes}</p>
        </section>
      )}

      {dialog?.type === 'log' && <RunFormModal levelId={level.id} onClose={close} />}
      {dialog?.type === 'edit-run' && <RunFormModal levelId={level.id} run={dialog.run} onClose={close} />}
      {dialog?.type === 'beaten' && <BeatenModal level={level} onClose={close} />}
      {dialog?.type === 'edit-level' && <EditLevelModal level={level} onClose={close} />}
    </div>
  )
}

/** Type "25-75" and press Enter to log a run for today without opening the form. */
function QuickAdd({ levelId }: { levelId: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseQuickRun(text)
    if (!parsed) return setError('Type a run like 25-75')
    const err = validateRun(parsed.start, parsed.end)
    if (err) return setError(err)
    await db.runs.add({ id: uid(), levelId, ...parsed, date: todayISO(), createdAt: Date.now() })
    setText('')
    setError('')
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError('')
        }}
        placeholder="Quick add: 25-75"
        aria-label="Quick add run"
      />
      {error && <span className="quick-error">{error}</span>}
    </form>
  )
}

function CompletionPanel({ level, onEdit }: { level: Level; onEdit: () => void }) {
  return (
    <section className="panel completion">
      <span className="completion-star">★</span>
      <div>
        <h2 className="outlined gold">LEVEL COMPLETE!</h2>
        <p className="muted">{level.beatenDate ? `Beaten ${formatDate(level.beatenDate)}` : 'Beaten'}</p>
      </div>
      <div className="completion-actions">
        {level.completionVideo && <VideoButton video={level.completionVideo} title={`${level.name}: completion`} />}
        <button className="gd-btn blue small" onClick={onEdit}>
          Edit
        </button>
      </div>
    </section>
  )
}
