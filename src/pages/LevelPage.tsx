import { useMemo, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Level, Run } from '../types'
import { calculateRuns } from '../lib/runCalc'
import { formatDate, parseQuickRun, pct, range, runLabel, todayISO, uid, validateRun } from '../lib/format'
import { addToQueue, deleteLevel, deleteRun, refreshListRanks, removeFromQueue, removeVideo, restoreRun } from '../lib/data'
import { pointercrateSection } from '../lib/levelInfo'
import { useShortcut } from '../lib/shortcuts'
import { useThumbBackground } from '../lib/levelThumbnail'
import { showToast } from '../lib/toast'
import { countdown, daysUntil } from '../lib/format'
import { href, navigate } from '../router'
import { DifficultyBadge, DifficultyOrb } from '../components/DifficultyBadge'
import { demonTier } from '../lib/demonTier'
import { NormalBar, RunBar, RunLanes, runColor } from '../components/ProgressBar'
import { RunFormModal } from '../components/RunFormModal'
import { DeathChart } from '../components/DeathChart'
import { VideoButton } from '../components/VideoModal'
import { BeatenModal, EditLevelModal } from '../components/LevelModals'

// Stand-in while the level loads, so hooks run in the same order every render.
const NO_LEVEL = { thumbnail: { kind: 'none' } } as Level

type Dialog = { type: 'log' } | { type: 'edit-run'; run: Run } | { type: 'beaten' } | { type: 'edit-level' } | null

export function LevelPage({ id }: { id: string }) {
  // undefined = still loading, null = not found
  const level = useLiveQuery(async () => (await db.levels.get(id)) ?? null, [id])
  const runs = useLiveQuery(() => db.runs.where('levelId').equals(id).toArray(), [id])
  const [dialog, setDialog] = useState<Dialog>(null)

  const calc = useMemo(() => calculateRuns(runs ?? []), [runs])
  const thumb = useThumbBackground(level ?? NO_LEVEL, 'medium')
  useShortcut('n', () => setDialog({ type: 'log' }), !!level)

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

  const tier = demonTier(level)
  const chainIndex = new Map(calc.chain.map((r, i) => [r.id, i]))
  const history = [...runs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const close = () => setDialog(null)

  const onDeleteLevel = async () => {
    if (!confirm(`Delete "${level.name}" and all ${runs.length} of its runs? This can't be undone.`)) return
    await deleteLevel(level)
    navigate(href.library)
  }

  const onDeleteRun = async (run: Run) => {
    const deleted = await deleteRun(run)
    showToast(`Deleted the ${runLabel(run.start, run.end)} run.`, { label: 'Undo', run: () => restoreRun(deleted) })
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

      <header className={`panel level-header ${thumb.className}`} style={thumb.style}>
        <DifficultyOrb difficulty={level.difficulty} tier={tier} size={84} />
        <div className="level-header-info">
          <h1 className="outlined">{level.name}</h1>
          <p className="muted">
            by {level.creator}
            {level.gdLevelId && <> · ID {level.gdLevelId}</>}
            {level.attempts !== undefined && <> · {level.attempts.toLocaleString()} attempts</>}
          </p>
          <div className="badge-row">
            <DifficultyBadge difficulty={level.difficulty} tier={tier} />
            <ListRankChips level={level} />
          </div>
        </div>
        <div className="level-header-actions">
          {!level.beaten &&
            (level.queuePos === undefined ? (
              <button className="gd-btn blue small" onClick={() => addToQueue(level)}>
                + Next Up
              </button>
            ) : (
              <button className="gd-btn gray small" onClick={() => removeFromQueue(level)}>
                ✓ In Next Up
              </button>
            ))}
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
      {!level.beaten && (level.goal || level.targetDate) && (
        <GoalPanel level={level} onEdit={() => setDialog({ type: 'edit-level' })} />
      )}

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
                : `You have it in ${calc.chain.length} runs: ${calc.chain.map((r) => runLabel(r.start, r.end)).join(' → ')}`
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
          <button className="gd-btn green" onClick={() => setDialog({ type: 'log' })} title="Shortcut: N">
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
                    {runLabel(r.start, r.end)}
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
                    {r.video && <VideoButton video={r.video} title={`${level.name}: ${runLabel(r.start, r.end)}`} />}
                    <button className="icon-btn" title="Edit run" onClick={() => setDialog({ type: 'edit-run', run: r })}>
                      ✎
                    </button>
                    <button
                      className="icon-btn danger"
                      title="Delete run"
                      onClick={() => onDeleteRun(r)}
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

      {level.deathStats && <DeathChart stats={level.deathStats} />}

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

function GoalPanel({ level, onEdit }: { level: Level; onEdit: () => void }) {
  const days = level.targetDate ? daysUntil(level.targetDate) : null
  return (
    <section className="panel goal-panel">
      <span className="goal-icon" aria-hidden="true">
        ⚑
      </span>
      <div className="goal-body">
        <h2 className="outlined">{level.goal ?? 'Goal'}</h2>
        {level.targetDate && days !== null && (
          <p className={days < 0 ? 'warn' : 'muted'}>
            Target {formatDate(level.targetDate)} · {countdown(days)}
          </p>
        )}
      </div>
      <button className="gd-btn blue small" onClick={onEdit}>
        Edit
      </button>
    </section>
  )
}

function ListRankChips({ level }: { level: Level }) {
  const [checking, setChecking] = useState(false)
  if (!level.gdLevelId) return null
  const { pointercrate, aredl } = level.listRanks ?? {}

  const refresh = async () => {
    setChecking(true)
    try {
      await refreshListRanks(level)
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      {aredl != null && (
        <a className="chip rank-chip" href="https://aredl.net" target="_blank" rel="noreferrer" title="All Rated Extreme Demons List">
          AREDL #{aredl}
        </a>
      )}
      {pointercrate != null && (
        <a className="chip rank-chip" href="https://pointercrate.com/demonlist/" target="_blank" rel="noreferrer" title="Pointercrate Demonlist">
          Pointercrate #{pointercrate} · {pointercrateSection(pointercrate)}
        </a>
      )}
      <button className="chip" onClick={refresh} disabled={checking} title="Check the demon lists for this level's position">
        {checking ? 'Checking…' : level.listRanks ? '↻ List rank' : 'Check list rank'}
      </button>
    </>
  )
}
