import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '@/i18n/i18n-context'
import BottomNav from './BottomNav'

function renderNav(initialPath = '/app') {
  return render(
    <I18nProvider initialLang="es">
      <MemoryRouter initialEntries={[initialPath]}>
        <BottomNav />
      </MemoryRouter>
    </I18nProvider>,
  )
}

describe('BottomNav', () => {
  it('renders the five main sections', () => {
    renderNav()
    for (const label of ['Inicio', 'Timer', 'Metas', 'Estudio', 'Más']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the active section based on the current route', () => {
    renderNav('/app/metas')
    const metas = screen.getByRole('link', { name: /Metas/i })
    expect(metas).toHaveAttribute('aria-current', 'page')
  })
})
