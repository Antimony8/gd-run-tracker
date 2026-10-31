import { db } from '../db'
import { GOOGLE_CLIENT_ID } from '../syncConfig'

/**
 * Video storage in the user's own Google Drive. Uses the drive.file scope, so the app can only
 * see files it created itself. Tokens come from Google Identity Services and live in memory only.
 */
export const driveEnabled = !!GOOGLE_CLIENT_ID

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FOLDER_NAME = 'Run Tracker videos'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

// Minimal types for the parts of Google Identity Services used here.
interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
  callback: (resp: TokenResponse) => void
  error_callback?: (err: { type?: string; message?: string }) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let token: { value: string; expires: number } | null = null
let client: TokenClient | null = null
let loading: Promise<void> | null = null

/** Loads Google's sign-in script ahead of time so a later tap can open the sign-in popup right away. */
export function preloadDrive(): Promise<void> {
  if (!driveEnabled) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      client = window.google!.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: SCOPE, callback: () => {} })
      resolve()
    }
    script.onerror = () => {
      loading = null
      reject(new Error("Couldn't load Google sign-in. Check your connection."))
    }
    document.head.appendChild(script)
  })
  return loading
}

export const hasDriveAccess = () => !!token && token.expires > Date.now() + 60_000

/**
 * Gets a Drive access token, opening Google's sign-in popup if needed. Call this straight from a
 * tap or click (before any other await), because browsers only allow popups from user actions.
 */
export function ensureDriveAccess(): Promise<string> {
  if (hasDriveAccess()) return Promise.resolve(token!.value)
  if (!client) {
    return preloadDrive().then(() => {
      throw new Error('Google sign-in is ready now. Tap the button again.')
    })
  }
  return new Promise((resolve, reject) => {
    client!.callback = (resp) => {
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error_description || "Google sign-in didn't finish."))
        return
      }
      token = { value: resp.access_token, expires: Date.now() + (resp.expires_in ?? 3600) * 1000 }
      resolve(token.value)
    }
    client!.error_callback = (err) =>
      reject(new Error(err.type === 'popup_closed' ? 'Google sign-in was closed.' : err.message || "Google sign-in didn't finish."))
    client!.requestAccessToken({ prompt: '' })
  })
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  if (!hasDriveAccess()) throw new Error('Sign in to Google again to continue.')
  const res = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token!.value}` } })
  if (res.status === 401) token = null
  return res
}

let folderId: string | null = null

/** The "Run Tracker videos" folder in the user's Drive, created on first use. */
async function folder(): Promise<string> {
  if (folderId) return folderId
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const found = await api(`${API}/files?q=${q}&fields=files(id)&spaces=drive`)
  if (!found.ok) throw new Error(`Google Drive error (${found.status}).`)
  const existing = (await found.json()).files?.[0]?.id as string | undefined
  if (existing) return (folderId = existing)
  const made = await api(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  if (!made.ok) throw new Error(`Couldn't create the Drive folder (${made.status}).`)
  return (folderId = (await made.json()).id)
}

/** Uploads a video to the Run Tracker folder in Drive and returns its file ID. Resumable, with progress. */
export async function uploadToDrive(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const parent = await folder()
  const start = await api(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': file.type || 'video/mp4',
      'X-Upload-Content-Length': String(file.size),
    },
    body: JSON.stringify({ name: file.name, parents: [parent] }),
  })
  const session = start.headers.get('Location')
  if (!start.ok || !session) throw new Error(`Couldn't start the upload to Google Drive (${start.status}).`)

  // XMLHttpRequest rather than fetch, for upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', session)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) resolve(JSON.parse(xhr.responseText).id)
      else reject(new Error(`The upload to Google Drive failed (${xhr.status}).`))
    }
    xhr.onerror = () => reject(new Error('The upload to Google Drive was interrupted. Check your connection.'))
    xhr.send(file)
  })
}

/** Local copies of Drive videos live in the videos table under this ID, so they play offline after the first time. */
export const driveCacheId = (fileId: string) => `drive:${fileId}`

/** Downloads a Drive video (with progress) and keeps a local copy. */
export async function downloadFromDrive(fileId: string, name: string, onProgress?: (fraction: number) => void): Promise<Blob> {
  const res = await api(`${API}/files/${encodeURIComponent(fileId)}?alt=media`)
  if (res.status === 404) throw new Error('This video is no longer in your Google Drive.')
  if (!res.ok || !res.body) throw new Error(`Couldn't download the video from Google Drive (${res.status}).`)

  const total = Number(res.headers.get('Content-Length')) || 0
  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    if (total) onProgress?.(loaded / total)
  }
  const type = res.headers.get('Content-Type') || 'video/mp4'
  const blob = new Blob(chunks, { type })
  await db.videos.put({ id: driveCacheId(fileId), blob, name, type, size: blob.size, createdAt: Date.now() })
  return blob
}
