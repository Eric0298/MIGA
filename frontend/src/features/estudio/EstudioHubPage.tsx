import { Link } from 'react-router'
import { Brain, Clock, ClipboardCheck, StickyNote } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'
import ActiveExamAttemptsBanner from '@/features/exams/components/ActiveExamAttemptsBanner'
import PendingGradeExamsBanner from '@/features/exams/components/PendingGradeExamsBanner'

type Tile = {
  to: string
  labelKey: 'sessions' | 'notes' | 'review' | 'exams'
  descriptionKey:
    | 'sessionsDesc'
    | 'notesDesc'
    | 'reviewDesc'
    | 'examsDesc'
  icon: typeof Clock
}

const tiles: Tile[] = [
  { to: '/app/sesiones', labelKey: 'sessions', descriptionKey: 'sessionsDesc', icon: Clock },
  { to: '/app/apuntes', labelKey: 'notes', descriptionKey: 'notesDesc', icon: StickyNote },
  { to: '/app/repaso', labelKey: 'review', descriptionKey: 'reviewDesc', icon: Brain },
  {
    to: '/app/examenes',
    labelKey: 'exams',
    descriptionKey: 'examsDesc',
    icon: ClipboardCheck,
  },
]

function EstudioHubPage() {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">{t.estudio.title}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{t.estudio.subtitle}</p>
      </header>

      <ActiveExamAttemptsBanner />
      <PendingGradeExamsBanner />

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ to, labelKey, descriptionKey, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-peach text-charcoal">
              <Icon size={22} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-charcoal">
                {t.estudio.tiles[labelKey]}
              </span>
              <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
                {t.estudio.tiles[descriptionKey]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default EstudioHubPage
