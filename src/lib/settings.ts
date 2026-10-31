import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { CompletedSort } from './completedSort'

export interface SettingValues {
  /** App background color (hex). */
  theme: string
  /** ms timestamp of the last downloaded backup. */
  lastBackupAt: number
  /** ms timestamp before which the backup reminder stays hidden. */
  backupSnoozeUntil: number
  /** Whether the Next Up section on the levels page is expanded. */
  nextUpOpen: boolean
  /** How the Completed section is ordered. */
  completedSort: CompletedSort
}

export type SettingKey = keyof SettingValues

/** Settings that travel with a backup. Bookkeeping like backup dates stays per-browser. */
export const BACKED_UP_SETTINGS: SettingKey[] = ['theme']

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValues[K] | undefined> {
  return (await db.settings.get(key))?.value as SettingValues[K] | undefined
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValues[K] | undefined) {
  if (value === undefined) await db.settings.delete(key)
  else await db.settings.put({ key, value })
}

/** Live value of a setting. undefined while loading or when unset. */
export function useSetting<K extends SettingKey>(key: K): SettingValues[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key])
}
