import { FileText, Mic, StickyNote } from 'lucide-react'
import { format } from 'date-fns'
import type { Note, NoteKind } from '@/lib/db/schema'

type NoteCardProps = {
  note: Note
  onClick?: () => void
}

function NoteCard({ note, onClick }: NoteCardProps) {
  const preview =
    note.kind === 'text' && note.text
      ? note.text.replace(/\s+/g, ' ').slice(0, 140)
      : note.kind === 'voice'
        ? note.metadata?.durationSeconds
          ? `${Math.round(note.metadata.durationSeconds)} s`
          : ''
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
    case 'text':
    default:
      return <StickyNote size={16} aria-hidden="true" />
  }
}

export default NoteCard
