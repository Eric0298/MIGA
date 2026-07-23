import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BarChart3, CalendarDays, Clock, GraduationCap, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { useLiveGoal } from './hooks/use-goal'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useExamAttemptsByGoal } from '@/features/exams/hooks/use-exam-attempts-by-goal'
import { deleteSession } from '@/lib/db/sessions.repository'
import {
  filterCompletedByGoal,
  filterFinishedExamsByGoal,
  groupCompletedMsByDay,
  groupExamMsByDay,
  sumElapsedMs,
  sumExamElapsedMs,
  toLocalIsoDay,
} from '@/lib/stats/sessions-stats'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import GoalProgress from './components/GoalProgress'
import GoalCalendarView from './components/GoalCalendarView'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'
import { Plus } from 'lucide-react'
import { useMaterialsByGoal } from '@/features/materials/hooks/use-materials-by-goal'
import { useGoalVideoWatchedMs } from '@/features/materials/hooks/use-goal-video-watched-ms'
import MaterialForm from '@/features/materials/components/MaterialForm'
import MaterialCard from '@/features/materials/components/MaterialCard'
import NotesPanel from '@/features/notes/components/NotesPanel'

const GoalProgressChart = lazy(() => import('./components/GoalProgressChart'))

type View = 'calendar' | 'chart'

function GoalDetailPage() {
  const { t, locale } = useT()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const sessions = useCompletedSessions()
  const examAttempts = useExamAttemptsByGoal(goal?.id)
  const materials = useMaterialsByGoal(goal?.id)
  const goalVideoWatchedMs = useGoalVideoWatchedMs(goal?.id)
  const [view, setView] = useState<View>('calendar')
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const todayIsoStr = toLocalIsoDay(Date.now())

  const isLoading = goal === undefined || sessions === undefined
  const goalSessions = useMemo(
    () => (goal && sessions ? filterCompletedByGoal(sessions, goal.id) : []),
    [goal, sessions],
  )
  const goalExams = useMemo(
    () => (goal && examAttempts ? filterFinishedExamsByGoal(examAttempts, goal.id) : []),
    [goal, examAttempts],
  )
  const currentMs = sumElapsedMs(goalSessions) + sumExamElapsedMs(goalExams)
  const workedDays = useMemo(() => {
    const sessionDays = groupCompletedMsByDay(goalSessions)
    const examDays = groupExamMsByDay(goalExams)
    return new Set<string>([...sessionDays.keys(), ...examDays.keys()])
  }, [goalSessions, goalExams])
  const gradedExams = useMemo(
    () =>
      goalExams.filter(
        (a) =>
          (a.status === 'graded' || a.status === 'completed') &&
          a.score !== null &&
          a.maxScore !== null &&
          a.maxScore > 0,
      ),
    [goalExams],
  )
  const avgExamPercent = useMemo(() => {
    if (gradedExams.length === 0) return null
    const total = gradedExams.reduce(
      (sum, a) => sum + (a.score as number) / (a.maxScore as number),
      0,
    )
    return Math.round((total / gradedExams.length) * 100)
  }, [gradedExams])
  const scheduledDays = useMemo(() => new Set(goal?.scheduledDays ?? []), [goal?.scheduledDays])

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      toast.success(t.sessions.deleted)
    } catch {
      toast.error(t.sessions.cannotDelete)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/metas"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.common.back}
        </Link>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {!isLoading && goal === null && (
        <EmptyState
          title={t.goalDetail.notFoundTitle}
          description={t.goalDetail.notFoundDescription}
          action={
            <Link
              to="/app/metas"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              {t.goalDetail.backToGoals}
            </Link>
          }
        />
      )}

      {!isLoading && goal && (
        <>
          <section className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">{goal.name}</h1>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {goal.scheduledDays.length === 1
                ? tpl(t.goalDetail.plannedDayOne, { count: goal.scheduledDays.length })
                : tpl(t.goalDetail.plannedDayOther, { count: goal.scheduledDays.length })}{' '}
              ·{' '}
              {workedDays.size === 1
                ? tpl(t.goalDetail.workedDayOne, { count: workedDays.size })
                : tpl(t.goalDetail.workedDayOther, { count: workedDays.size })}
            </p>
            <GoalProgress currentMs={currentMs} targetMinutes={goal.targetMinutes} />
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
            <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-charcoal">{t.goalDetail.progress}</h2>
              <div
                role="tablist"
                aria-label={t.goalDetail.progressViewLabel}
                className="inline-flex rounded-xl bg-cream p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'calendar'}
                  onClick={() => setView('calendar')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'calendar'
                      ? 'bg-surface text-charcoal'
                      : 'text-[color:var(--color-text-muted)]',
                  )}
                >
                  <CalendarDays size={14} aria-hidden="true" />
                  {t.goalDetail.calendar}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'chart'}
                  onClick={() => setView('chart')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'chart'
                      ? 'bg-surface text-charcoal'
                      : 'text-[color:var(--color-text-muted)]',
                  )}
                >
                  <BarChart3 size={14} aria-hidden="true" />
                  {t.goalDetail.chart}
                </button>
              </div>
            </div>
            {view === 'calendar' ? (
              <GoalCalendarView scheduledDays={scheduledDays} workedDays={workedDays} />
            ) : (
              <Suspense fallback={<Loading />}>
                <GoalProgressChart
                  goal={goal}
                  sessions={sessions ?? []}
                  examAttempts={examAttempts ?? []}
                  todayIso={todayIsoStr}
                />
              </Suspense>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-charcoal">{t.goalDetail.sessions}</h2>
            {goalSessions.length === 0 ? (
              <EmptyState
                icon={<Clock size={20} aria-hidden="true" />}
                title={t.goalDetail.noSessionsTitle}
                description={t.goalDetail.noSessionsDescription}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {goalSessions.map((s) => {
                  const label = s.endedAt
                    ? format(new Date(s.endedAt), "d 'de' LLL · HH:mm", { locale })
                    : ''
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-charcoal tabular-nums">
                          {formatShortDuration(getElapsedMs(s))}
                        </p>
                        <p className="text-xs text-[color:var(--color-text-muted)]">{label}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        aria-label={t.sessions.deleteAria}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
            </div>

            <div className="flex flex-col gap-6">
          {goalExams.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-charcoal">
                  {t.goalDetail.examSection}
                </h2>
                <Link
                  to={`/app/examenes/${goal.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cream px-3 py-1.5 text-xs font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
                >
                  <GraduationCap size={14} aria-hidden="true" />
                  {t.goalDetail.examOpen}
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface p-4">
                <div className="flex flex-col items-center gap-0.5">
                  <p className="text-lg font-bold text-charcoal tabular-nums">
                    {goalExams.length}
                  </p>
                  <p className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                    {t.goalDetail.examAttempts}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <p className="text-lg font-bold text-charcoal tabular-nums">
                    {formatShortDuration(sumExamElapsedMs(goalExams))}
                  </p>
                  <p className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                    {t.goalDetail.examTime}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <p className="text-lg font-bold text-charcoal tabular-nums">
                    {avgExamPercent !== null ? `${avgExamPercent}%` : '—'}
                  </p>
                  <p className="text-[10px] font-medium text-[color:var(--color-text-muted)]">
                    {t.goalDetail.examAverage}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-charcoal">{t.materials.sectionTitle}</h2>
                {goalVideoWatchedMs > 0 && (
                  <span className="inline-flex items-center rounded-full bg-peach px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                    {tpl(t.materials.videoWatched, {
                      time: formatShortDuration(goalVideoWatchedMs),
                    })}
                  </span>
                )}
              </div>
              {!showMaterialForm && (
                <button
                  type="button"
                  onClick={() => setShowMaterialForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                >
                  <Plus size={14} aria-hidden="true" />
                  {t.materials.add}
                </button>
              )}
            </div>
            {showMaterialForm && (
              <MaterialForm
                goalId={goal.id}
                onCreated={() => setShowMaterialForm(false)}
                onCancel={() => setShowMaterialForm(false)}
              />
            )}
            {!showMaterialForm && (materials?.length ?? 0) === 0 && (
              <EmptyState
                title={t.materials.emptyTitle}
                description={t.materials.emptyDescription}
              />
            )}
            {(materials?.length ?? 0) > 0 && (
              <ul className="flex flex-col gap-2">
                {materials?.map((m) => (
                  <MaterialCard key={m.id} material={m} goalId={goal.id} />
                ))}
              </ul>
            )}
          </section>

          <NotesPanel goalId={goal.id} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default GoalDetailPage
