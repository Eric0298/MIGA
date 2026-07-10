import { Check, ImageIcon, Mic } from 'lucide-react'
import type { Question } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'

type QuestionCardProps = {
  question: Question
  onClick?: () => void
}

function QuestionCard({ question, onClick }: QuestionCardProps) {
  const { t } = useT()
  const correctCount = question.answers.filter((a) => a.isCorrect).length
  const totalAnswers = question.answers.length
  const promptPreview = question.prompt.replace(/\s+/g, ' ').slice(0, 160)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-xl bg-cream px-3 py-3 text-left ring-1 ring-[color:var(--color-border)] transition-colors hover:bg-peach"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-charcoal">{promptPreview}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[color:var(--color-text-muted)]">
          {question.imageBlobKey && <ImageIcon size={14} aria-hidden="true" />}
          {question.audioBlobKey && <Mic size={14} aria-hidden="true" />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1 rounded-full bg-peach px-2 py-0.5 text-charcoal">
          {tpl(t.questions.answersBadge, { total: totalAnswers, correct: correctCount })}
        </span>
        {question.reviewState.timesSeen > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-charcoal/10 px-2 py-0.5 text-charcoal">
            <Check size={11} aria-hidden="true" />
            {tpl(t.questions.reviewStats, {
              correct: question.reviewState.timesCorrect,
              seen: question.reviewState.timesSeen,
            })}
          </span>
        )}
      </div>
    </button>
  )
}

export default QuestionCard
