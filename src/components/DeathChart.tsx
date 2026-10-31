import { useState } from 'react'
import type { DeathStats } from '../types'
import { bestFromZero, combineSources, completedFromZero, topDeaths } from '../lib/deathTracker'

const PERCENTS = Array.from({ length: 100 }, (_, i) => i)

function formatPlaytime(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** "Where you die" panel: deaths from 0 at each percent, from the Death Tracker mod. */
export function DeathChart({ stats: all }: { stats: DeathStats }) {
  const [hover, setHover] = useState<number | null>(null)
  // The online level and any editor copies, added together.
  const stats = combineSources(all)
  const sources = Object.values(all.sources)
  const max = Math.max(1, ...PERCENTS.map((p) => stats.deaths[p] ?? 0))
  const total = PERCENTS.reduce((sum, p) => sum + (stats.deaths[p] ?? 0), 0)
  const top = topDeaths(stats.deaths)
  const best = bestFromZero(stats.deaths)
  const shown = hover ?? top[0]?.percent ?? null

  return (
    <section className="panel death-panel">
      <div className="death-head">
        <h2 className="outlined">Where You Die</h2>
        <span className="muted death-source">from Death Tracker</span>
      </div>

      <div className="death-stats">
        <Stat label="Attempts" value={stats.attempts.toLocaleString()} />
        <Stat label="Deaths from 0" value={total.toLocaleString()} />
        <Stat label="Best from 0" value={completedFromZero(stats.deaths) ? '100%' : `${best}%`} />
        {stats.playtimeMs > 0 && <Stat label="Playtime" value={formatPlaytime(stats.playtimeMs)} />}
        {stats.sessions > 0 && <Stat label="Sessions" value={stats.sessions.toLocaleString()} />}
      </div>

      {total > 0 ? (
        <>
          <p className="death-readout" aria-live="polite">
            {shown === null ? (
              ' '
            ) : (
              <>
                <strong>{shown}%</strong>: {(stats.deaths[shown] ?? 0).toLocaleString()}{' '}
                {(stats.deaths[shown] ?? 0) === 1 ? 'death' : 'deaths'}
                {hover === null && ' (your worst spot)'}
              </>
            )}
          </p>
          <div className="death-chart" role="img" aria-label={`Deaths from 0 by percent. Most at ${top.map((t) => `${t.percent}%`).join(', ')}.`}>
            {PERCENTS.map((p) => {
              const n = stats.deaths[p] ?? 0
              return (
                <div
                  key={p}
                  className={`death-col ${hover === p ? 'active' : ''}`}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === p ? null : p)}
                  title={`${p}%: ${n.toLocaleString()} ${n === 1 ? 'death' : 'deaths'}`}
                >
                  {n > 0 && <div className="death-bar" style={{ height: `${Math.max(2, (n / max) * 100)}%` }} />}
                </div>
              )
            })}
          </div>
          <div className="death-axis" aria-hidden="true">
            {[0, 25, 50, 75, 100].map((t) => (
              <span key={t} style={{ left: `${t}%` }}>
                {t}%
              </span>
            ))}
          </div>
          {top.length > 0 && (
            <ol className="death-top">
              {top.map((t, i) => (
                <li key={t.percent}>
                  <span className="death-rank">#{i + 1}</span>
                  <strong>{t.percent}%</strong>
                  <span className="muted">
                    {t.count.toLocaleString()} {t.count === 1 ? 'death' : 'deaths'} ({Math.round((t.count / total) * 100)}%)
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="muted">No deaths from 0 recorded yet.</p>
      )}
      <p className="hint">
        {sources.length > 1
          ? `Combined from ${sources.map((s) => (s.editor ? `${s.name} (editor copy)` : s.name)).join(', ')}. `
          : sources[0]?.editor
            ? `From your editor copy "${sources[0].name}". `
            : ''}
        Updated {new Date(all.importedAt).toLocaleDateString()}. Re-import in Settings to refresh.
      </p>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="death-stat">
      <span className="death-stat-value outlined">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
