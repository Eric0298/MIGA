import { FileText, ImageIcon, Mic, StickyNote } from 'lucide-react'
import { format } from 'date-fns'
import type { Goal, Note, NoteKind } from '@/lib/db/schema'

type NoteCardProps = {
  note: Note
  onClick?: () => void
  /** When provided, the card shows small chips with each goal name. Used by
   *  the global notes hub where notes can span more than one goal. */
  goals?: Goal[]
}

function NoteCard({ note, onClick, goals }: NoteCardProps) {
  const preview =
    note.kind === 'text' && note.text
      ? note.text.replace(/\s+/g, ' ').slice(0, 140)
      : note.kind === 'voice'
        ? note.metadata?.durationSeconds
          ? `${Math.round(note.metadata.durationSeconds)} s`
          : ''
        : note.kind === 'image'
          ? note.metadata?.originalFilename ?? ''
          : note.metadata?.originalFilename ?? ''

  const timestamp = format(new Date(note.updatedAt), 'd LLL')

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl bg-cream px-3 py-3 text-left ring-1 ring-[color:var(--color-border)] transition-colors hover:bg-peach"
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-peach text-charcoal">
        {kindIcon(note.kind)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-charcoal">{note.title}</p>
          <span className="shrink-0 text-[11px] font-medium text-[color:var(--color-text-muted)]">
            {timestamp}
          </span>
        </div>
        {preview && (
          <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--color-text-muted)]">
            {preview}
          </p>
        )}
        {goals && goals.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {goals.map((g) => (
              <li
                key={g.id}
                className="inline-flex max-w-[10rem] items-center rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-charcoal ring-1 ring-[color:var(--color-border)]"
              >
                <span className="truncate">{g.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </button>
  )
}

function kindIcon(kind: NoteKind) {
  switch (kind) {
    case 'voice':
      return <Mic size={16} aria-hidden="true" />
    case 'document':
      return <FileText size={16} aria-hidden="true" />
    case 'image':
      return <ImageIcon size={16} aria-hidden="true" />
    case 'text':
    default:
      return <StickyNote size={16} aria-hidden="true" />
  }
}

export default NoteCard
