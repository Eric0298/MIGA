import { useMemo, useState } from 'react'
import {
  BarChart3,
  Flame,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Sparkles,
  Timer,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import EmptyState from '@/components/ui/EmptyState'
import { formatShortDuration } from '@/features/timer/utils'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useAllExamAttempts } from '@/features/exams/hooks/use-all-exam-attempts'
import { useAllQuestions } from '@/features/questions/hooks/use-all-questions'
import { toLocalIsoDay } from '@/lib/stats/sessions-stats'
import { getCurrentStreakDays } from '@/lib/stats/weekly-stats'
import {
  dailyMinutesInRange,
  examScoresInRange,
  filterExamsInRange,
  filterSessionsInRange,
  getBestStreakDays,
  getPeriodRange,
  getPreviousPeriodRange,
  percentDelta,
  questionStats,
  sumSessionsMs,
  timePerGoal,
  type PeriodKey,
} from '@/lib/stats/period-stats'
import EvolutionChart from './components/EvolutionChart'
import GoalsBarChart from './components/GoalsBarChart'
import DistributionDonut from './components/DistributionDonut'
import ExamsEvolutionChart from './components/ExamsEvolutionChart'
import GoalsHeatmap from './components/GoalsHeatmap'
import type { Messages } from '@/i18n/messages/es'

type Tab = { key: PeriodKey; label: string }

function EstadisticasPage() {
  const { t, locale } = useT()
  const sessions = useCompletedSessions()
  const goals = useLiveGoals()
  const exams = useAllExamAttempts()
  const questions = useAllQuestions()

  const [period, setPeriod] = useState<PeriodKey>('30d')

  const now = useMemo(() => new Date(), [])
  const range = useMemo(() => getPeriodRange(period, now), [period, now])
  const previousRange = useMemo(() => getPreviousPeriodRange(range), [range])
  const todayIso = toLocalIsoDay(now.getTime())

  const isLoading =
    sessions === undefined || goals === undefined || exams === undefined || questions === undefined

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Header t={t} />
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      </div>
    )
  }

  const allSessions = sessions ?? []
  const allExams = exams ?? []
  const allGoals = goals ?? []
  const allQuestions = questions ?? []

  const hasAnyData = allSessions.length > 0 || allExams.length > 0 || allQuestions.length > 0

  if (!hasAnyData) {
    return (
      <div className="flex flex-col gap-6">
        <Header t={t} />
        <EmptyState
          icon={<Sparkles size={20} aria-hidden="true" />}
          title={t.estadisticas.empty.title}
          description={t.estadisticas.empty.description}
        />
      </div>
    )
  }

  const rangeSessions = filterSessionsInRange(allSessions, range)
  const rangeExams = filterExamsInRange(allExams, range)
  const previousSessions = previousRange ? filterSessionsInRange(allSessions, previousRange) : []

  const totalMs = sumSessionsMs(rangeSessions)
  const previousTotalMs = sumSessionsMs(previousSessions)
  const sessionsCount = rangeSessions.length
  const previousSessionsCount = previousSessions.length
  const averageMs = sessionsCount === 0 ? 0 : Math.round(totalMs / sessionsCount)
  const currentStreak = getCurrentStreakDays(allSessions, todayIso, allExams)
  const bestStreak = getBestStreakDays(allSessions, allExams)

  const totalDelta = percentDelta(totalMs, previousTotalMs)
  const sessionsDelta = percentDelta(sessionsCount, previousSessionsCount)

  const perGoal = timePerGoal(allSessions, allGoals, range, t.common.freeSession)
  const daily = dailyMinutesInRange(allSessions, range)
  const scores = examScoresInRange(allExams, range)
  const rangeExamAttempts = rangeExams.length
  const gradedScores = scores.map((s) => s.percent)
  const averageScore =
    gradedScores.length === 0
      ? null
      : Math.round(gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length)
  const bestScore = gradedScores.length === 0 ? null : Math.max(...gradedScores)

  const qStats = questionStats(allQuestions, allGoals)
  const worstGoal = qStats.perGoal.find((g) => g.accuracy !== null && g.accuracy < 70)

  const insights = buildInsights({
    t,
    totalDelta,
    perGoal,
    daily,
    currentStreak,
    worstGoal,
    hasSessionsPeriod: sessionsCount > 0,
    hasPreviousRange: previousRange !== null,
  })

  const periodTabs: Tab[] = [
    { key: '7d', label: t.estadisticas.period.last7 },
    { key: '30d', label: t.estadisticas.period.last30 },
    { key: '90d', label: t.estadisticas.period.last90 },
    { key: 'all', label: t.estadisticas.period.all },
  ]

  return (
    <div className="flex flex-col gap-8">
      <Header t={t} />

      <div
        role="tablist"
        aria-label={t.estadisticas.period.label}
        className="inline-flex flex-wrap gap-2 rounded-full bg-cream p-1 self-start"
      >
        {periodTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={period === tab.key}
            onClick={() => setPeriod(tab.key)}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
              period === tab.key
                ? 'bg-surface text-charcoal shadow-sm'
                : 'text-[color:var(--color-text-muted)] hover:text-charcoal',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<Timer size={16} aria-hidden="true" />}
          label={t.estadisticas.kpi.totalTime}
          value={formatShortDuration(totalMs)}
          hint={previousRange ? formatDeltaHint(t, totalDelta) : t.estadisticas.kpi.vsPreviousNone}
          accent="apricot"
        />
        <KpiCard
          icon={<ListChecks size={16} aria-hidden="true" />}
          label={t.estadisticas.kpi.sessions}
          value={String(sessionsCount)}
          hint={previousRange ? formatDeltaHint(t, sessionsDelta) : t.estadisticas.kpi.sessionsHint}
        />
        <KpiCard
          icon={<BarChart3 size={16} aria-hidden="true" />}
          label={t.estadisticas.kpi.averageSession}
          value={sessionsCount === 0 ? '—' : formatShortDuration(averageMs)}
          hint={t.estadisticas.kpi.averageSessionHint}
        />
        <KpiCard
          icon={<Flame size={16} aria-hidden="true" />}
          label={t.estadisticas.kpi.currentStreak}
          value={currentStreak === 0 ? '—' : String(currentStreak)}
          hint={
            bestStreak > 0
              ? `${t.estadisticas.kpi.bestStreak}: ${bestStreak}`
              : t.estadisticas.kpi.currentStreakHint
          }
          accent={currentStreak > 0 ? 'apricot' : 'muted'}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-charcoal">
            {t.estadisticas.charts.evolutionTitle}
          </h2>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {t.estadisticas.charts.evolutionHint}
          </p>
        </div>
        <div className="rounded-2xl bg-surface p-3">
          {daily.length > 0 && totalMs > 0 ? (
            <EvolutionChart data={daily} locale={locale} />
          ) : (
            <p className="py-8 text-center text-sm text-[color:var(--color-text-muted)]">
              {t.estadisticas.charts.evolutionEmpty}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-charcoal">
            {t.estadisticas.charts.byGoalTitle}
          </h2>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {t.estadisticas.charts.byGoalHint}
          </p>
        </div>
        {perGoal.length === 0 ? (
          <div className="rounded-2xl bg-surface p-4">
            <p className="py-6 text-center text-sm text-[color:var(--color-text-muted)]">
              {t.estadisticas.charts.byGoalEmpty}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface p-4">
            <GoalsBarChart
              entries={perGoal}
              targetHintTemplate={t.estadisticas.charts.byGoalTargetHint}
            />
          </div>
        )}
      </section>

      {perGoal.length >= 2 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-charcoal">
              {t.estadisticas.charts.distributionTitle}
            </h2>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {t.estadisticas.charts.distributionHint}
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-4">
            <DistributionDonut entries={perGoal} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-charcoal">{t.estadisticas.exams.title}</h2>
        </div>
        {rangeExamAttempts === 0 && gradedScores.length === 0 ? (
          <div className="rounded-2xl bg-surface p-4">
            <p className="py-6 text-center text-sm text-[color:var(--color-text-muted)]">
              {t.estadisticas.exams.empty}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <KpiCard
                icon={<GraduationCap size={16} aria-hidden="true" />}
                label={t.estadisticas.exams.attempts}
                value={String(rangeExamAttempts)}
              />
              <KpiCard
                label={t.estadisticas.exams.average}
                value={averageScore === null ? '—' : `${averageScore}%`}
              />
              <KpiCard
                label={t.estadisticas.exams.best}
                value={bestScore === null ? '—' : `${bestScore}%`}
              />
            </div>
            {scores.length > 0 && (
              <div className="rounded-2xl bg-surface p-4">
                <p className="mb-2 text-sm font-medium text-charcoal">
                  {t.estadisticas.exams.evolution}
                </p>
                <ExamsEvolutionChart points={scores} locale={locale} />
              </div>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-charcoal">
            {t.estadisticas.questions.title}
          </h2>
        </div>
        {qStats.answered === 0 ? (
          <div className="rounded-2xl bg-surface p-4">
            <p className="py-6 text-center text-sm text-[color:var(--color-text-muted)]">
              {t.estadisticas.questions.empty}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label={t.estadisticas.questions.answered} value={String(qStats.answered)} />
              <KpiCard label={t.estadisticas.questions.correct} value={String(qStats.correct)} />
              <KpiCard
                label={t.estadisticas.questions.incorrect}
                value={String(qStats.incorrect)}
              />
              <KpiCard
                label={t.estadisticas.questions.accuracy}
                value={qStats.accuracy === null ? '—' : `${qStats.accuracy}%`}
                accent={qStats.accuracy !== null && qStats.accuracy >= 70 ? 'pistachio' : 'default'}
              />
            </div>
            {qStats.perGoal.length > 0 && (
              <div className="rounded-2xl bg-surface p-4">
                <p className="mb-2 text-sm font-medium text-charcoal">
                  {t.estadisticas.questions.needsReview}
                </p>
                <ul className="flex flex-col gap-2">
                  {qStats.perGoal.slice(0, 5).map((row) => (
                    <li
                      key={row.goalId}
                      className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2"
                    >
                      <span className="truncate text-sm font-medium text-charcoal">
                        {row.goalName}
                      </span>
                      <span className="shrink-0 text-xs text-[color:var(--color-text-muted)] tabular-nums">
                        {tpl(t.estadisticas.questions.needsReviewRow, {
                          correct: row.correct,
                          seen: row.seen,
                          accuracy: row.accuracy ?? 0,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {insights.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-apricot" aria-hidden="true" />
            <h2 className="text-base font-semibold text-charcoal">
              {t.estadisticas.insights.title}
            </h2>
          </div>
          <ul className="flex flex-col gap-2">
            {insights.map((insight, i) => (
              <li key={i} className="rounded-2xl bg-surface px-4 py-3 text-sm text-charcoal">
                {insight}
              </li>
            ))}
          </ul>
        </section>
      )}

      <GoalsHeatmap sessions={allSessions} exams={allExams} goals={allGoals} />
    </div>
  )
}

function Header({ t }: { t: Messages }) {
  return (
    <header>
      <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">{t.estadisticas.title}</h1>
      <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{t.estadisticas.subtitle}</p>
    </header>
  )
}

type KpiAccent = 'default' | 'apricot' | 'muted' | 'pistachio'

type KpiCardProps = {
  icon?: React.ReactNode
  label: string
  value: string
  hint?: string
  accent?: KpiAccent
}

function KpiCard({ icon, label, value, hint, accent = 'default' }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-surface p-4 lg:p-5">
      <div className="flex items-center gap-1.5">
        {icon && (
          <span
            className={clsx(
              'inline-flex h-6 w-6 items-center justify-center rounded-lg',
              accent === 'apricot'
                ? 'bg-apricot/15 text-apricot'
                : accent === 'pistachio'
                  ? 'bg-pistachio/25 text-charcoal'
                  : 'bg-peach text-charcoal',
            )}
          >
            {icon}
          </span>
        )}
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
          {label}
        </p>
      </div>
      <p
        className={clsx(
          'text-xl font-bold tabular-nums lg:text-2xl',
          accent === 'muted' ? 'text-[color:var(--color-text-muted)]' : 'text-charcoal',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-[color:var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}

function formatDeltaHint(
  t: Messages,
  delta: { kind: 'up' | 'down' | 'same' | 'none'; percent: number },
): string {
  if (delta.kind === 'none') return t.estadisticas.kpi.vsPreviousNone
  if (delta.kind === 'same') return t.estadisticas.kpi.vsPreviousSame
  if (delta.kind === 'up') {
    return tpl(t.estadisticas.kpi.vsPreviousUp, { percent: delta.percent })
  }
  return tpl(t.estadisticas.kpi.vsPreviousDown, { percent: delta.percent })
}

type InsightsInput = {
  t: Messages
  totalDelta: { kind: 'up' | 'down' | 'same' | 'none'; percent: number }
  perGoal: ReturnType<typeof timePerGoal>
  daily: Array<{ day: string; minutes: number; sessions: number }>
  currentStreak: number
  worstGoal:
    | { goalId: string; goalName: string; seen: number; correct: number; accuracy: number | null }
    | undefined
  hasSessionsPeriod: boolean
  hasPreviousRange: boolean
}

function buildInsights(input: InsightsInput): string[] {
  const insights: string[] = []
  const { t } = input
  if (input.hasSessionsPeriod && input.hasPreviousRange) {
    if (input.totalDelta.kind === 'up') {
      insights.push(
        tpl(t.estadisticas.insights.moreThanPrevious, { percent: input.totalDelta.percent }),
      )
    } else if (input.totalDelta.kind === 'down') {
      insights.push(
        tpl(t.estadisticas.insights.lessThanPrevious, {
          percent: Math.abs(input.totalDelta.percent),
        }),
      )
    } else if (input.totalDelta.kind === 'same') {
      insights.push(t.estadisticas.insights.sameAsPrevious)
    }
  }
  const topGoal = input.perGoal.find((g) => g.goalId !== null)
  if (topGoal) {
    insights.push(tpl(t.estadisticas.insights.topGoal, { goal: topGoal.goalName }))
  }
  if (input.currentStreak >= 3) {
    insights.push(tpl(t.estadisticas.insights.streakActive, { days: input.currentStreak }))
  }
  const last7 = input.daily.slice(-7)
  const activeInLast7 = last7.filter((d) => d.minutes > 0).length
  if (last7.length === 7 && activeInLast7 === 0) {
    insights.push(t.estadisticas.insights.noSessionsRecent)
  } else if (last7.length === 7 && activeInLast7 <= 2 && input.hasPreviousRange) {
    const prev7 = input.daily.slice(-14, -7)
    if (prev7.length === 7) {
      const previousActive = prev7.filter((d) => d.minutes > 0).length
      if (previousActive > activeInLast7 + 1) {
        insights.push(t.estadisticas.insights.constancyDrop)
      }
    }
  }
  if (input.worstGoal) {
    insights.push(
      tpl(t.estadisticas.insights.questionsToReview, { goal: input.worstGoal.goalName }),
    )
  }
  return insights
}

export default EstadisticasPage
