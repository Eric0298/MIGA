import { render, screen, waitFor } from '@testing-library/react'
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

function renderVerification(state?: Record<string, unknown>, entryOverride?: InitialEntry) {
  const entry: InitialEntry = entryOverride ?? {
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

  it('never renders password inputs and confirms automatically for a state-less link', async () => {
    renderVerification()

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    await waitFor(() => expect(auth.confirmEmail).toHaveBeenCalledOnce())
    expect(auth.confirmEmail).toHaveBeenCalledWith({
      userId: '11111111-1111-4111-8111-111111111111',
      token: 'secret',
      importDemoData: false,
      continueWithoutDemoData: false,
    })
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeVisible()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled()
  })

  it('imports the active demo when navigation state opted in', async () => {
    auth.demoActive = true
    renderVerification({ importDemoData: true })

    await waitFor(() => expect(auth.confirmEmail).toHaveBeenCalledOnce())
    expect(auth.confirmEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        importDemoData: true,
        continueWithoutDemoData: false,
      }),
    )
  })

  it('skips the active demo when the user explicitly opted out via nav state', async () => {
    auth.demoActive = true
    renderVerification({ importDemoData: false })

    await waitFor(() => expect(auth.confirmEmail).toHaveBeenCalledOnce())
    expect(auth.confirmEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        importDemoData: false,
        continueWithoutDemoData: true,
      }),
    )
  })

  it('falls back to explicit skip when the demo cannot be imported', async () => {
    auth.demoActive = true
    auth.confirmEmail
      .mockRejectedValueOnce(new ApiError(409, { code: 'demo_conversion_unavailable' }))
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
    renderVerification({ importDemoData: true })

    await waitFor(() => expect(auth.confirmEmail).toHaveBeenCalledTimes(2))
    expect(auth.confirmEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ importDemoData: true, continueWithoutDemoData: false }),
    )
    expect(auth.confirmEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ importDemoData: false, continueWithoutDemoData: true }),
    )
    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeVisible()
  })

  it('restores the remembered demo choice for the active workspace', async () => {
    auth.demoActive = true
    rememberDemoImportPreference(DEMO_WORKSPACE_ID, true)

    renderVerification()

    await waitFor(() => expect(auth.confirmEmail).toHaveBeenCalledOnce())
    expect(auth.confirmEmail).toHaveBeenCalledWith(
      expect.objectContaining({ importDemoData: true, continueWithoutDemoData: false }),
    )
  })

  it('shows the resend form and no auto-confirmation when the link lacks parameters', async () => {
    renderVerification(undefined, { pathname: '/verificar-email' })

    expect(auth.confirmEmail).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/open the complete link/i)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'student@example.test')
    await user.click(screen.getByRole('button', { name: /resend/i }))
    expect(auth.resendConfirmation).toHaveBeenCalledExactlyOnceWith('student@example.test')
  })

  it('surfaces a recoverable error when the automatic confirmation fails', async () => {
    auth.confirmEmail.mockReset()
    auth.confirmEmail.mockRejectedValue(new ApiError(400, { code: 'invalid_or_expired_token' }))
    renderVerification()

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not verify/i)
    expect(screen.getByRole('button', { name: /resend/i })).toBeVisible()
  })
})
