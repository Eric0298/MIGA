import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, type InitialEntry } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import { ApiError } from '@/lib/api/http'
import VerifyEmailPage from './VerifyEmailPage'
import { rememberDemoImportPreference } from './demo-import-preference'

const DEMO_WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const auth = vi.hoisted(() => ({
  confirmEmail: vi.fn(),
  resendConfirmation: vi.fn(),
  demoActive: false,
  demoWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    status: 'ready',
    session: auth.demoActive
      ? {
          authenticated: true,
          accountType: 'demo',
          workspaceId: auth.demoWorkspaceId,
          email: null,
          emailConfirmed: false,
          expiresAtUtc: '2026-07-24T00:00:00.000Z',
        }
      : { authenticated: false, accountType: null },
    confirmEmail: auth.confirmEmail,
    resendConfirmation: auth.resendConfirmation,
  }),
}))

function renderVerification(state?: Record<string, unknown>) {
  const entry: InitialEntry = {
    pathname: '/verificar-email',
    hash: '#userId=11111111-1111-4111-8111-111111111111&token=secret',
    state,
  }
  return render(
    <I18nProvider initialLang="en">
      <MemoryRouter initialEntries={[entry]}>
        <VerifyEmailPage />
      </MemoryRouter>
    </I18nProvider>,
  )
}

async function completeConfirmationForm() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^New password/), 'a-long-unique-password')
  await user.type(screen.getByLabelText('Repeat password'), 'a-long-unique-password')
  await user.click(screen.getByLabelText(/I have read and accept/))
  await user.click(screen.getByRole('button', { name: 'Verify email' }))
  return user
}

describe('email confirmation', () => {
  beforeEach(() => {
    auth.confirmEmail.mockReset()
    auth.confirmEmail.mockResolvedValue({ authenticated: false, accountType: null })
    auth.resendConfirmation.mockReset()
    auth.demoActive = false
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an active demo as an explicit unchecked opt-in for a state-less email link', async () => {
    auth.demoActive = true
    const confirm = vi.spyOn(window, 'confirm')
    renderVerification()

    const importCheckbox = screen.getByLabelText(/Copy this demo data/)
    expect(importCheckbox).toBeVisible()
    expect(importCheckbox).not.toBeChecked()

    await completeConfirmationForm()

    expect(auth.confirmEmail).toHaveBeenCalledExactlyOnceWith({
      userId: '11111111-1111-4111-8111-111111111111',
      token: 'secret',
      newPassword: 'a-long-unique-password',
      privacyPolicyVersion: '2026-07-23',
      importDemoData: false,
      continueWithoutDemoData: true,
    })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('preserves the immediate registration choice through navigation state', async () => {
    auth.demoActive = true
    renderVerification({ importDemoData: true })

    expect(screen.getByLabelText(/Copy this demo data/)).toBeChecked()
    await completeConfirmationForm()

    expect(auth.confirmEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        importDemoData: true,
        continueWithoutDemoData: false,
      }),
    )
  })

  it('does not import or show a fallback dialog after the preserved choice is unchecked', async () => {
    auth.demoActive = true
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    renderVerification({ importDemoData: true })

    await user.click(screen.getByLabelText(/Copy this demo data/))
    expect(screen.getByLabelText(/Copy this demo data/)).not.toBeChecked()
    await completeConfirmationForm()

    expect(auth.confirmEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        importDemoData: false,
        continueWithoutDemoData: true,
      }),
    )
    expect(confirm).not.toHaveBeenCalled()
  })

  it('restores a recent choice only for the exact active demo workspace', () => {
    auth.demoActive = true
    rememberDemoImportPreference(DEMO_WORKSPACE_ID, true)

    renderVerification()

    expect(screen.getByLabelText(/Copy this demo data/)).toBeChecked()
  })

  it('retries a failed import only with explicit, non-contradictory flags', async () => {
    auth.demoActive = true
    auth.confirmEmail
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: 'demo_conversion_unavailable',
        }),
      )
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderVerification({ importDemoData: true })

    await completeConfirmationForm()

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('without importing'))
    expect(auth.confirmEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        importDemoData: true,
        continueWithoutDemoData: false,
      }),
    )
    expect(auth.confirmEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        importDemoData: false,
        continueWithoutDemoData: true,
      }),
    )
    for (const [input] of auth.confirmEmail.mock.calls) {
      expect(input.importDemoData && input.continueWithoutDemoData).toBe(false)
    }
  })
})
