import { Link } from 'react-router'
import { Brain, ChevronRight, Clock, ClipboardCheck, StickyNote } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import ActiveExamAttemptsBanner from '@/features/exams/components/ActiveExamAttemptsBanner'
import PendingGradeExamsBanner from '@/features/exams/components/PendingGradeExamsBanner'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useAllExamAttempts } from '@/features/exams/hooks/use-all-exam-attempts'
import { db } from '@/lib/db/miga-db'
import type { Messages } from '@/i18n/messages/es'

type Tile = {
  to: string
  labelKey: 'sessions' | 'notes' | 'review' | 'exams'
  descriptionKey: 'sessionsDesc' | 'notesDesc' | 'reviewDesc' | 'examsDesc'
  icon: typeof Clock
  count: number | undefined
  countLabel: (t: Messages, count: number) => string
}

function EstudioHubPage() {
  const { t } = useT()
  const sessions = useCompletedSessions()
  const examAttempts = useAllExamAttempts()
  const notesCount = useLiveQuery(() => db.notes.count(), [])
  const questionsCount = useLiveQuery(() => db.questions.count(), [])

  const tiles: Tile[] = [
    {
      to: '/app/sesiones',
      labelKey: 'sessions',
      descriptionKey: 'sessionsDesc',
      icon: Clock,
      count: sessions?.length,
      countLabel: (t, count) =>
        tpl(
          count === 1 ? t.estudio.tiles.sessionsCountOne : t.estudio.tiles.sessionsCountOther,
          { count },
        ),
    },
    {
      to: '/app/notas',
      labelKey: 'notes',
      descriptionKey: 'notesDesc',
      icon: StickyNote,
      count: notesCount,
      countLabel: (t, count) =>
        tpl(
          count === 1 ? t.estudio.tiles.notesCountOne : t.estudio.tiles.notesCountOther,
          { count },
        ),
    },
    {
      to: '/app/repaso',
      labelKey: 'review',
      descriptionKey: 'reviewDesc',
      icon: Brain,
      count: questionsCount,
      countLabel: (t, count) =>
        tpl(
          count === 1
            ? t.estudio.tiles.questionsCountOne
            : t.estudio.tiles.questionsCountOther,
          { count },
        ),
    },
    {
      to: '/app/examenes',
      labelKey: 'exams',
      descriptionKey: 'examsDesc',
      icon: ClipboardCheck,
      count: examAttempts?.length,
      countLabel: (t, count) =>
        tpl(
          count === 1
            ? t.estudio.tiles.attemptsCountOne
            : t.estudio.tiles.attemptsCountOther,
          { count },
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">{t.estudio.title}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{t.estudio.subtitle}</p>
      </header>

      <ActiveExamAttemptsBanner />
      <PendingGradeExamsBanner />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {tiles.map(({ to, labelKey, descriptionKey, icon: Icon, count, countLabel }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] hover:ring-apricot md:min-h-[12rem] md:justify-between"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-peach text-charcoal md:h-12 md:w-12">
                <Icon size={22} aria-hidden="true" />
              </span>
              {count !== undefined && (
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] tabular-nums">
                  {countLabel(t, count)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-charcoal md:text-lg">
                {t.estudio.tiles[labelKey]}
              </span>
              <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
                {t.estudio.tiles[descriptionKey]}
              </span>
            </div>
            <span
              aria-hidden="true"
              className="hidden items-center justify-end text-apricot transition-transform md:inline-flex md:group-hover:translate-x-1"
            >
              <ChevronRight size={18} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default EstudioHubPage
