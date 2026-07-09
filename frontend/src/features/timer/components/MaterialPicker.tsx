import { clsx } from 'clsx'
import { FileText, Film, Link as LinkIcon, PlaySquare, StickyNote } from 'lucide-react'
import { useMaterialsByGoal } from '@/features/materials/hooks/use-materials-by-goal'
import { useT } from '@/i18n/i18n-context'
import type { MaterialKind } from '@/lib/db/schema'

type MaterialPickerProps = {
  goalId: string | null
  values: string[]
  onToggle: (materialId: string) => void
}

function MaterialPicker({ goalId, values, onToggle }: MaterialPickerProps) {
  const { t } = useT()
  const materials = useMaterialsByGoal(goalId ?? undefined) ?? []

  if (goalId === null || materials.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium text-charcoal">{t.timer.chooseMaterial}</p>
        <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
          {t.timer.chooseMaterialHint}
        </p>
      </div>
      {materials.map((material) => {
        const selected = values.includes(material.id)
        return (
          <button
            key={material.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(material.id)}
            className={clsx(
              'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors',
              selected
                ? 'bg-apricot text-white'
                : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
            )}
          >
            {material.kind === 'video-youtube' && material.metadata?.thumbnailUrl ? (
              <img
                src={material.metadata.thumbnailUrl}
                alt=""
                width={72}
                height={40}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-10 w-[72px] shrink-0 rounded-md object-cover"
              />
            ) : (
              <span
                className={clsx(
                  'inline-flex h-10 w-[72px] shrink-0 items-center justify-center rounded-md',
                  selected ? 'bg-white/20 text-white' : 'bg-peach text-charcoal',
                )}
              >
                {kindIcon(material.kind)}
              </span>
            )}
            <span className="line-clamp-2 flex-1 text-xs font-medium">{material.title}</span>
          </button>
        )
      })}
    </div>
  )
}

function kindIcon(kind: MaterialKind) {
  switch (kind) {
    case 'link':
      return <LinkIcon size={16} aria-hidden="true" />
    case 'note':
      return <StickyNote size={16} aria-hidden="true" />
    case 'video-youtube':
      return <PlaySquare size={16} aria-hidden="true" />
    case 'video-upload':
      return <Film size={16} aria-hidden="true" />
    case 'pdf':
      return <FileText size={16} aria-hidden="true" />
    default:
      return <StickyNote size={16} aria-hidden="true" />
  }
}

export default MaterialPicker
