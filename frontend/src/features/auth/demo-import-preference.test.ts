import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDemoImportPreference,
  readDemoImportPreference,
  rememberDemoImportPreference,
} from './demo-import-preference'

const WORKSPACE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WORKSPACE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW = 1_785_408_000_000

beforeEach(() => {
  localStorage.clear()
})

describe('demo import preference', () => {
  it('stores only a short-lived, non-secret choice bound to one workspace', () => {
    rememberDemoImportPreference(WORKSPACE_A, true, NOW)

    const stored = JSON.parse(localStorage.getItem('miga.demo-import-preference.v1')!)
    expect(stored).toEqual({
      version: 1,
      workspaceId: WORKSPACE_A,
      importDemoData: true,
      expiresAt: NOW + 30 * 60 * 1_000,
    })
    expect(JSON.stringify(stored)).not.toMatch(/email|token|password/i)
    expect(readDemoImportPreference(WORKSPACE_A, NOW + 1)).toBe(true)
  })

  it('rejects and clears expired or workspace-mismatched preferences', () => {
    rememberDemoImportPreference(WORKSPACE_A, true, NOW)

    expect(readDemoImportPreference(WORKSPACE_B, NOW + 1)).toBe(false)
    expect(localStorage.length).toBe(0)

    rememberDemoImportPreference(WORKSPACE_A, true, NOW)
    expect(readDemoImportPreference(WORKSPACE_A, NOW + 30 * 60 * 1_000)).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  it('clears the preference when import is declined or confirmation completes', () => {
    rememberDemoImportPreference(WORKSPACE_A, true, NOW)
    rememberDemoImportPreference(WORKSPACE_A, false, NOW)
    expect(localStorage.length).toBe(0)

    rememberDemoImportPreference(WORKSPACE_A, true, NOW)
    clearDemoImportPreference()
    expect(localStorage.length).toBe(0)
  })
})
