import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { downloadBackup } from '../lib/backup'
import { formatBytes } from '../lib/format'
import { setSetting, useSetting } from '../lib/settings'
import { showToast } from '../lib/toast'

const DAY = 86_400_000
const REMIND_AFTER = 7 * DAY
const SNOOZE = 2 * DAY

/** Nudges you to download a backup when the last one is more than a week old. */
export function BackupReminder() {
  const lastBackup = useSetting('lastBackupAt')
  const snoozeUntil = useSetting('backupSnoozeUntil')
  // Without a backup yet, count from when the oldest level was added.
  const firstAdded = useLiveQuery(async () => (await db.levels.orderBy('dateAdded').first())?.dateAdded)
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())

  const since = lastBackup ?? (firstAdded ? Date.parse(firstAdded) : undefined)
  if (since === undefined || now - since < REMIND_AFTER || (snoozeUntil && now < snoozeUntil)) return null

  const days = Math.floor((now - since) / DAY)
  const backUp = async () => {
    setBusy(true)
    try {
      const size = await downloadBackup()
      showToast(`Backup saved (${formatBytes(size)}).`)
    } catch {
      showToast('The backup failed. Try again from Settings.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="banner warn reminder">
      <span>
        {lastBackup ? `It's been ${days} days since your last backup.` : "You haven't made a backup yet."} Your data only
        lives in this browser.
      </span>
      <div className="reminder-actions">
        <button className="gd-btn green small" onClick={backUp} disabled={busy}>
          {busy ? 'Saving…' : '⬇ Back up now'}
        </button>
        <button className="gd-btn gray small" onClick={() => setSetting('backupSnoozeUntil', Date.now() + SNOOZE)}>
          Later
        </button>
      </div>
    </div>
  )
}
