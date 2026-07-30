import type { ExportPayload } from '@/lib/db/import-export'

function sortRecords<T extends { id: string }>(records: readonly T[]): T[] {
  return [...records].sort((left, right) => left.id.localeCompare(right.id))
}

function comparablePayload(payload: ExportPayload): Omit<ExportPayload, 'exportedAt'> {
  return {
    version: payload.version,
    goals: sortRecords(payload.goals),
    sessions: sortRecords(payload.sessions),
    materials: sortRecords(payload.materials),
    materialGoalLinks: sortRecords(payload.materialGoalLinks),
    materialProgress: sortRecords(payload.materialProgress),
    notes: sortRecords(payload.notes),
    questions: sortRecords(payload.questions),
    examAttempts: sortRecords(payload.examAttempts),
  }
}

export async function workspaceContentHash(payload: ExportPayload): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(comparablePayload(payload)))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
