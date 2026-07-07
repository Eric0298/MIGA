import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import BottomNav from './BottomNav'

function renderNav(initialPath = '/app') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('renders the five main sections', () => {
    renderNav()
    for (const label of ['Inicio', 'Timer', 'Metas', 'Sesiones', 'Más']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the active section based on the current route', () => {
    renderNav('/app/metas')
    const metas = screen.getByRole('link', { name: /Metas/i })
    expect(metas).toHaveAttribute('aria-current', 'page')
  })
})
