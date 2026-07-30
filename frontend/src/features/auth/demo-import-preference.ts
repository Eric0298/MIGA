const STORAGE_KEY = 'miga.demo-import-preference.v1'
const PREFERENCE_TTL_MS = 30 * 60 * 1_000
const WORKSPACE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type StoredDemoImportPreference = {
  version: 1
  workspaceId: string
  importDemoData: true
  expiresAt: number
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function removeIfUnchanged(target: Storage, raw: string): void {
  try {
    if (target.getItem(STORAGE_KEY) === raw) target.removeItem(STORAGE_KEY)
  } catch {
    // Storage is optional. Confirmation remains safe and defaults to no import.
  }
}

export function rememberDemoImportPreference(
  workspaceId: string,
  importDemoData: boolean,
  now = Date.now(),
): void {
  const target = storage()
  if (!target) return

  try {
    if (!importDemoData || !WORKSPACE_ID_PATTERN.test(workspaceId)) {
      target.removeItem(STORAGE_KEY)
      return
    }

    const value: StoredDemoImportPreference = {
      version: 1,
      workspaceId,
      importDemoData: true,
      expiresAt: now + PREFERENCE_TTL_MS,
    }
    target.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // A blocked/full localStorage must never block registration or confirmation.
  }
}

export function readDemoImportPreference(workspaceId: string, now = Date.now()): boolean {
  const target = storage()
  if (!target || !WORKSPACE_ID_PATTERN.test(workspaceId)) return false

  let raw: string | null
  try {
    raw = target.getItem(STORAGE_KEY)
  } catch {
    return false
  }
  if (!raw) return false

  try {
    const value = JSON.parse(raw) as Partial<StoredDemoImportPreference>
    const valid =
      value.version === 1 &&
      value.workspaceId === workspaceId &&
      value.importDemoData === true &&
      typeof value.expiresAt === 'number' &&
      Number.isFinite(value.expiresAt) &&
      value.expiresAt > now &&
      value.expiresAt <= now + PREFERENCE_TTL_MS

    if (!valid) removeIfUnchanged(target, raw)
    return valid
  } catch {
    removeIfUnchanged(target, raw)
    return false
  }
}

export function clearDemoImportPreference(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Storage is optional.
  }
}
