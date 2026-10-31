import { dismissToast, useToasts } from '../lib/toast'

export function Toasts() {
  const toasts = useToasts()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast panel">
          <span>{t.text}</span>
          {t.action && (
            <button
              className="gd-btn blue small"
              onClick={async () => {
                dismissToast(t.id)
                await t.action!.run()
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
