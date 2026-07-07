import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="Sin sesiones" description="Aún no hay datos registrados." />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sin sesiones')
    expect(screen.getByText(/Aún no hay datos registrados\./)).toBeInTheDocument()
  })
})
