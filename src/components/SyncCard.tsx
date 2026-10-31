import { useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import { db } from '../db'
import { DEXIE_CLOUD_URL } from '../syncConfig'
import type { SyncState } from 'dexie-cloud-addon'
import { driveEnabled } from '../lib/googleDrive'

function describe(state: SyncState | undefined): { text: string; tone: 'good' | 'warn' | '' } {
  if (!state) return { text: 'Starting…', tone: '' }
  if (state.license && state.license !== 'ok') return { text: 'The sync service account needs attention (license expired).', tone: 'warn' }
  switch (state.phase) {
    case 'in-sync':
      return { text: 'Up to date', tone: 'good' }
    case 'pushing':
    case 'pulling':
      return { text: 'Syncing…', tone: '' }
    case 'offline':
      return { text: "Offline. Changes will sync when you're back online.", tone: 'warn' }
    case 'error':
      return { text: `Sync error${state.error ? `: ${state.error.message}` : ''}`, tone: 'warn' }
    default:
      return { text: 'Waiting to sync…', tone: '' }
  }
}

/** Settings card for signing in and syncing between devices through Dexie Cloud. */
export function SyncCard() {
  const user = useObservable(db.cloud.currentUser)
  const state = useObservable(db.cloud.syncState)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      // Closing the sign-in dialog or cancelling sign-out isn't an error worth showing.
      const msg = err instanceof Error ? err.message : String(err)
      if (!/cancel/i.test(msg)) setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (!DEXIE_CLOUD_URL) {
    return (
      <section className="panel settings-card">
        <h2 className="outlined">Sync</h2>
        <p className="muted">Sync between devices isn't set up yet. Everything is saved on this device only.</p>
      </section>
    )
  }

  const status = describe(state)
  return (
    <section className="panel settings-card">
      <h2 className="outlined">Sync</h2>
      {user?.isLoggedIn ? (
        <>
          <p>
            Signed in as <strong>{user.email ?? user.name ?? user.userId}</strong>. Levels and runs sync between every device
            you sign in on.
          </p>
          <p className={status.tone}>{status.text}</p>
          <div className="row">
            <button className="gd-btn blue small" onClick={() => run(() => db.cloud.sync())} disabled={busy}>
              ↻ Sync now
            </button>
            <button
              className="gd-btn gray small"
              disabled={busy}
              onClick={() =>
                confirm(
                  'Signing out removes your levels, runs and uploaded videos from THIS device. Synced data stays in your account, but uploaded video files only live here. Download a backup first if you want to keep them. Sign out?',
                ) && run(() => db.cloud.logout())
              }
            >
              Sign out
            </button>
          </div>
          <p className="hint">
            {driveEnabled
              ? 'Videos sync when you tick "Save to my Google Drive" while adding them. Video links always sync.'
              : 'Uploaded video files stay on the device you added them on. Video links sync.'}
          </p>
        </>
      ) : (
        <>
          <p>
            Sign in with your email to sync your levels and runs between your phone and computer. Use the same email on each
            device. Anything already on this device is uploaded the first time you sign in.
          </p>
          <button className="gd-btn green" onClick={() => run(() => db.cloud.login())} disabled={busy}>
            ☁ Sign in to sync
          </button>
          <p className="hint">You'll get a one-time code by email. No password needed.</p>
        </>
      )}
      {error && <p className="hint warn">{error}</p>}
    </section>
  )
}
