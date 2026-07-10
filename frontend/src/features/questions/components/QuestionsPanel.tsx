import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'
import { useQuestionsByGoal } from '../hooks/use-questions-by-goal'
import QuestionCard from './QuestionCard'
import QuestionEditor from './QuestionEditor'

type QuestionsPanelProps = {
  goalId: string
}

type PanelMode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; questionId: string }

function QuestionsPanel({ goalId }: QuestionsPanelProps) {
  const { t } = useT()
  const questions = useQuestionsByGoal(goalId) ?? []
  const [mode, setMode] = useState<PanelMode>({ kind: 'list' })

  const backToList = () => setMode({ kind: 'list' })
  const openCreate = () => setMode({ kind: 'create' })
  const openEdit = (questionId: string) => setMode({ kind: 'edit', questionId })

  const editingId = mode.kind === 'edit' ? mode.questionId : undefined
  const isEditor = mode.kind !== 'list'

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-charcoal">
          {t.questions.sectionTitle}
          {questions.length > 0 && (
            <span className="ml-2 text-xs font-normal text-[color:var(--color-text-muted)]">
              ({questions.length})
            </span>
          )}
        </h3>
        {mode.kind === 'list' && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
          >
            <Plus size={14} aria-hidden="true" />
            {t.questions.new}
          </button>
        )}
      </div>

      {mode.kind === 'list' && questions.length === 0 && (
        <p className="text-xs text-[color:var(--color-text-muted)]">{t.questions.empty}</p>
      )}

      {mode.kind === 'list' && questions.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {questions.map((question) => (
            <li key={question.id}>
              <QuestionCard
                question={question}
                onClick={() => openEdit(question.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {isEditor && (
        <QuestionEditor
          goalId={goalId}
          existingQuestionId={editingId}
          onDone={backToList}
          onCancel={backToList}
        />
      )}
    </section>
  )
}

export default QuestionsPanel
