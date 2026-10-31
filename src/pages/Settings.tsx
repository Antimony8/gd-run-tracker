import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatBytes } from '../lib/format'
import { isPersisted, requestPersistence, storageEstimate } from '../lib/storage'
import { downloadBackup, importBackup } from '../lib/backup'
import { clearAll, refreshListRanks } from '../lib/data'
import { setSetting, useSetting } from '../lib/settings'
import { DEFAULT_THEME } from '../lib/theme'
import { useInstallPrompt } from '../lib/pwa'
import { ColorSwatches } from '../components/LookPickers'
import { href } from '../router'

export function Settings() {
  const counts = useLiveQuery(async () => ({
    levels: await db.levels.count(),
    runs: await db.runs.count(),
    videos: await db.videos.count(),
  }))
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'good' | 'warn'; text: string } | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const theme = useSetting('theme')
  const lastBackup = useSetting('lastBackupAt')
  const install = useInstallPrompt()

  const refresh = async () => {
    setEstimate(await storageEstimate())
    setPersisted(await isPersisted())
  }

  useEffect(() => {
    refresh()
  }, [counts])

  const onPersist = async () => {
    const ok = await requestPersistence()
    setPersisted(ok)
    setMessage(
      ok
        ? { type: 'good', text: 'Storage is now persistent.' }
        : { type: 'warn', text: 'The browser declined. Bookmarking the site or using it more often can help it say yes.' },
    )
  }

  const onExport = async () => {
    setBusy('Building backup… 0%')
    setMessage(null)
    try {
      const size = await downloadBackup((p) => setBusy(`Building backup… ${Math.round(p)}%`))
      setMessage({ type: 'good', text: `Backup saved (${formatBytes(size)}).` })
    } catch {
      setMessage({ type: 'warn', text: 'The backup failed. If you have a lot of video, try freeing up memory and retry.' })
    } finally {
      setBusy(null)
    }
  }

  const onImport = async () => {
    if (!importFile) return
    if (mode === 'replace' && !confirm('Replace ALL current levels, runs and videos with this backup?')) return
    setBusy('Restoring backup…')
    setMessage(null)
    try {
      const res = await importBackup(importFile, mode)
      setMessage({ type: 'good', text: `Restored ${res.levels} levels, ${res.runs} runs and ${res.videos} videos.` })
      setImportFile(null)
    } catch (err) {
      setMessage({ type: 'warn', text: err instanceof Error ? err.message : 'Restoring failed.' })
    } finally {
      setBusy(null)
    }
  }

  const onRefreshRanks = async () => {
    const levels = (await db.levels.toArray()).filter((l) => l.gdLevelId)
    if (levels.length === 0) {
      setMessage({ type: 'warn', text: 'None of your levels have an in-game ID yet. Add one with Edit on the level page.' })
      return
    }
    setMessage(null)
    let done = 0
    let failed = 0
    for (const level of levels) {
      setBusy(`Checking demon lists… ${done}/${levels.length}`)
      try {
        await refreshListRanks(level)
      } catch {
        failed++
      }
      done++
    }
    setBusy(null)
    setMessage(
      failed
        ? { type: 'warn', text: `Updated ${done - failed} of ${levels.length} levels. Some lookups failed, try again later.` }
        : { type: 'good', text: `Updated list ranks for ${levels.length} levels.` },
    )
  }

  const onClear = async () => {
    if (!confirm('Delete every level, run and video? This cannot be undone.')) return
    if (!confirm('Last chance. Did you make a backup first?')) return
    await clearAll()
    setMessage({ type: 'good', text: 'All data deleted.' })
  }

  const usedPct = estimate && estimate.quota ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0

  return (
    <div className="page narrow">
      <a className="back-link outlined" href={href.library}>
        ‹ Levels
      </a>
      <h1 className="page-title outlined">Settings</h1>

      {message && <p className={`banner ${message.type}`}>{message.text}</p>}
      {busy && <p className="banner">{busy}</p>}

      <section className="panel settings-card">
        <h2 className="outlined">Storage</h2>
        {counts && (
          <p>
            {counts.levels} levels · {counts.runs} runs · {counts.videos} uploaded videos
          </p>
        )}
        {estimate ? (
          <>
            <div className="storage-bar">
              <div style={{ width: `${Math.max(usedPct, 1)}%` }} />
            </div>
            <p className="muted">
              Using {formatBytes(estimate.usage)} of about {formatBytes(estimate.quota)} available
            </p>
          </>
        ) : (
          <p className="muted">This browser doesn't report storage usage.</p>
        )}
        <div className="row spaced">
          <span>
            Persistent storage:{' '}
            <strong className={persisted ? 'good' : 'warn'}>{persisted === null ? '…' : persisted ? 'On' : 'Off'}</strong>
          </span>
          {persisted === false && (
            <button className="gd-btn blue small" onClick={onPersist}>
              Turn on
            </button>
          )}
        </div>
        <p className="hint">
          Everything is saved in this browser only. Clearing site data or switching browsers loses it, so make backups.
        </p>
      </section>

      <section className="panel settings-card">
        <h2 className="outlined">Theme</h2>
        <p>Pick the background color. Levels can have their own color too (Edit on a level's page).</p>
        <ColorSwatches value={theme ?? DEFAULT_THEME} onChange={(c) => setSetting('theme', c)} />
      </section>

      <section className="panel settings-card">
        <h2 className="outlined">App</h2>
        {install.installed ? (
          <p>You're using the installed app. It works offline.</p>
        ) : install.canInstall ? (
          <>
            <p>Install Run Tracker to your desktop or home screen. It opens in its own window and works offline.</p>
            <button className="gd-btn green" onClick={install.prompt}>
              ⊕ Install App
            </button>
          </>
        ) : (
          <p>
            You can install Run Tracker so it works offline. On iPhone or iPad, tap Share then <strong>Add to Home Screen</strong>. In
            other browsers, look for an install icon in the address bar or the browser menu.
          </p>
        )}
        <div className="row spaced">
          <span>Demon list ranks come from Pointercrate and the AREDL.</span>
          <button className="gd-btn blue small" onClick={onRefreshRanks} disabled={!!busy}>
            ↻ Refresh all ranks
          </button>
        </div>
        <p className="hint">Press ? anywhere to see keyboard shortcuts.</p>
      </section>

      <section className="panel settings-card">
        <h2 className="outlined">Backup</h2>
        <p>Download everything, videos included, as one .zip file.</p>
        <p className="muted">
          {lastBackup ? `Last backup: ${new Date(lastBackup).toLocaleString()}` : 'No backups downloaded from this browser yet.'}
        </p>
        <button className="gd-btn green" onClick={onExport} disabled={!!busy}>
          ⬇ Download Backup
        </button>
      </section>

      <section className="panel settings-card">
        <h2 className="outlined">Restore</h2>
        <label className="file-drop">
          <input type="file" accept=".zip,application/zip" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          <span>{importFile ? `📦 ${importFile.name} (${formatBytes(importFile.size)})` : 'Click to choose a backup .zip'}</span>
        </label>
        <div className="seg-tabs">
          <button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>
            Merge
          </button>
          <button className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>
            Replace
          </button>
        </div>
        <p className="hint">
          {mode === 'merge'
            ? 'Adds the backup to what you have now. Items that exist in both are overwritten by the backup.'
            : 'Deletes everything you have now and restores the backup exactly.'}
        </p>
        <button className="gd-btn blue" onClick={onImport} disabled={!importFile || !!busy}>
          ⬆ Restore Backup
        </button>
      </section>

      <section className="panel settings-card danger-zone">
        <h2 className="outlined">Danger Zone</h2>
        <button className="gd-btn red" onClick={onClear} disabled={!!busy}>
          Delete all data
        </button>
      </section>
    </div>
  )
}
