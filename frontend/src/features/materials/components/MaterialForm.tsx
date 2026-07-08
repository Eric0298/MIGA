import { useState } from 'react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { createMaterial } from '@/lib/db/materials.repository'
import { materialInputSchema, type MaterialKind } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import type { Messages } from '@/i18n/messages/es'

type MaterialFormProps = {
  goalId: string
  onCreated?: () => void
  onCancel?: () => void
}

type FormKind = 'link' | 'note'

function translateError(key: string, errors: Messages['materials']['errors']): string {
  if (key in errors) return errors[key as keyof Messages['materials']['errors']]
  return key
}

function MaterialForm({ goalId, onCreated, onCancel }: MaterialFormProps) {
  const { t } = useT()
  const [kind, setKind] = useState<FormKind>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const payload = {
      kind: kind as MaterialKind,
      title,
      url: kind === 'link' ? url.trim() : undefined,
      notes: kind === 'note' ? notes : undefined,
      metadata: {},
    }

    const parsed = materialInputSchema.safeParse(payload)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'title')
        next[field] = translateError(issue.message, t.materials.errors)
      }
      setErrors(next)
      return
    }

    try {
      setSubmitting(true)
      await createMaterial(parsed.data, [goalId])
      toast.success(t.materials.created)
      onCreated?.()
    } catch {
      toast.error(t.materials.cannotCreate)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl bg-surface p-5"
      noValidate
    >
      <div>
        <p className="text-sm font-medium text-charcoal">{t.materials.kindLabel}</p>
        <div role="tablist" aria-label={t.materials.kindLabel} className="mt-2 flex gap-2">
          <KindTab
            active={kind === 'link'}
            label={t.materials.kindLink}
            onClick={() => setKind('link')}
          />
          <KindTab
            active={kind === 'note'}
            label={t.materials.kindNote}
            onClick={() => setKind('note')}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="material-title" className="text-sm font-medium text-charcoal">
          {t.materials.title}
        </label>
        <input
          id="material-title"
          type="text"
          autoComplete="off"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
          placeholder={t.materials.titlePlaceholder}
        />
        {errors.title && <p className="text-xs text-apricot">{errors.title}</p>}
      </div>

      {kind === 'link' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="material-url" className="text-sm font-medium text-charcoal">
            {t.materials.url}
          </label>
          <input
            id="material-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            placeholder={t.materials.urlPlaceholder}
          />
          {errors.url && <p className="text-xs text-apricot">{errors.url}</p>}
        </div>
      )}

      {kind === 'note' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="material-notes" className="text-sm font-medium text-charcoal">
            {t.materials.notes}
          </label>
          <textarea
            id="material-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className="resize-none rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            placeholder={t.materials.notesPlaceholder}
          />
          {errors.notes && <p className="text-xs text-apricot">{errors.notes}</p>}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {t.materials.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-cream px-5 py-3 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          {t.materials.cancel}
        </button>
      </div>
    </form>
  )
}

type KindTabProps = {
  active: boolean
  label: string
  onClick: () => void
}

function KindTab({ active, label, onClick }: KindTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'bg-charcoal text-white'
          : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
      )}
    >
      {label}
    </button>
  )
}

export default MaterialForm
