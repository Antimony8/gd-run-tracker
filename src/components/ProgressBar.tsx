import type { CSSProperties } from 'react'
import type { RunCalcResult, Span } from '../lib/runCalc'
import { pct, range } from '../lib/format'

export const RUN_COLORS = ['#5ef55e', '#4dd8ff', '#ffd84d', '#ff7ad9', '#ff9a3d', '#a78bfa']
export const runColor = (i: number) => RUN_COLORS[i % RUN_COLORS.length]

const pos = (start: number, end: number): CSSProperties => ({ left: `${start}%`, width: `${end - start}%` })

/** The big GD-style bar: chained runs as colored segments, with the gap highlighted. */
export function RunBar<T extends Span>({ calc }: { calc: RunCalcResult<T> }) {
  return (
    <div className="gd-bar big">
      <div className="gd-bar-track">
        {calc.chain.map((r, i) => (
          <div key={i} className="gd-bar-seg" style={{ ...pos(r.start, r.end), '--seg': runColor(i) } as CSSProperties} />
        ))}
        {calc.gap && <div className="gd-bar-gap" style={pos(calc.gap.from, calc.gap.to)} />}
        {[25, 50, 75].map((t) => (
          <div key={t} className="gd-bar-tick" style={{ left: `${t}%` }} />
        ))}
      </div>
      <span className="gd-bar-label outlined">{calc.complete ? '100%' : pct(calc.reach)}</span>
    </div>
  )
}

/** One row per chained run, so overlaps are easy to see. */
export function RunLanes<T extends Span>({ calc }: { calc: RunCalcResult<T> }) {
  if (calc.chain.length === 0 && !calc.gap) return null
  return (
    <div className="lanes">
      {calc.chain.map((r, i) => (
        <div className="lane" key={i}>
          <span className="lane-name outlined" style={{ color: runColor(i) }}>
            Run {i + 1}
          </span>
          <div className="lane-track">
            <div className="lane-seg" style={{ ...pos(r.start, r.end), '--seg': runColor(i) } as CSSProperties} />
          </div>
          <span className="lane-range">{range(r.start, r.end)}</span>
        </div>
      ))}
      {calc.gap && (
        <div className="lane gap">
          <span className="lane-name outlined">Missing</span>
          <div className="lane-track">
            <div className="lane-seg gap" style={pos(calc.gap.from, calc.gap.to)} />
          </div>
          <span className="lane-range">{range(calc.gap.from, calc.gap.to)}</span>
        </div>
      )}
    </div>
  )
}

/** Small green "normal mode" style bar. */
export function NormalBar({ value }: { value: number }) {
  return (
    <div className="gd-bar small">
      <div className="gd-bar-track">
        <div className="gd-bar-seg normal" style={{ left: 0, width: `${value}%` }} />
      </div>
      <span className="gd-bar-label outlined">{pct(value)}</span>
    </div>
  )
}
