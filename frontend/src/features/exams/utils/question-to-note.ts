import { NOTE_LIMITS } from '@/lib/db/schema'
import type { ExamResponse, NoteInput, Question } from '@/lib/db/schema'

const TITLE_MAX = 80
const PROMPT_TITLE_MAX = 66

export type QuestionNoteLabels = {
  /** Prefix used to build the note title, e.g. "Repaso" → "Repaso · {prompt}". */
  titlePrefix: string
  /** Section header for the list of correct answers. */
  correctHeader: string
  /** Section header for the answer(s) the user picked. */
  yourAnswerHeader: string
  /** Placeholder shown when the user submitted no answer. */
  yourAnswerEmpty: string
  /** Attribution line prefixing the exam title, e.g. "From exam". */
  fromExam: string
}

function truncate(source: string, max: number): string {
  const trimmed = source.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trimEnd()}…`
}

/**
 * Turns a graded exam question into the input fields for a text note.
 * Pure and locale-agnostic: caller passes translated labels. The returned
 * fields respect Note schema limits (title ≤ 80 chars, text ≤ NOTE_LIMITS.text.maxChars).
 */
export function buildQuestionNoteFields(params: {
  goalId: string
  question: Question
  response: ExamResponse | undefined
  examTitle: string
  labels: QuestionNoteLabels
}): NoteInput {
  const { goalId, question, response, examTitle, labels } = params

  const promptExcerpt = truncate(question.prompt, PROMPT_TITLE_MAX)
  const rawTitle = `${labels.titlePrefix} · ${promptExcerpt}`
  const title = truncate(rawTitle, TITLE_MAX)

  const correctAnswers = question.answers.filter((a) => a.isCorrect)
  const chosenIds = new Set(response?.chosenAnswerIds ?? [])
  const chosenAnswers = question.answers.filter((a) => chosenIds.has(a.id))

  const lines: string[] = [question.prompt.trim(), '']

  lines.push(`${labels.correctHeader}:`)
  for (const a of correctAnswers) lines.push(`· ${a.text}`)
  lines.push('')

  lines.push(`${labels.yourAnswerHeader}:`)
  if (chosenAnswers.length === 0) {
    lines.push(`· ${labels.yourAnswerEmpty}`)
  } else {
    for (const a of chosenAnswers) lines.push(`· ${a.text}`)
  }
  lines.push('')

  lines.push(`— ${labels.fromExam}: ${examTitle.trim()}`)

  const text = lines.join('\n').slice(0, NOTE_LIMITS.text.maxChars)

  return {
    goalId,
    kind: 'text',
    title,
    text,
  }
}
