import { clsx } from 'clsx'
import { useMaterialsByGoal } from '@/features/materials/hooks/use-materials-by-goal'
import { useT } from '@/i18n/i18n-context'

type MaterialPickerProps = {
  goalId: string | null
  value: string | null
  onChange: (materialId: string | null) => void
}

function MaterialPicker({ goalId, value, onChange }: MaterialPickerProps) {
  const { t } = useT()
  const materials = useMaterialsByGoal(goalId ?? undefined)
  const videoMaterials = materials?.filter((m) => m.kind === 'video-youtube') ?? []

  if (goalId === null || videoMaterials.length === 0) {
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
      <button
        type="button"
        onClick={() => onChange(null)}
        className={clsx(
          'w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors',
          value === null
            ? 'bg-apricot text-white'
            : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
        )}
      >
        {t.timer.withoutMaterial}
      </button>
      {videoMaterials.map((material) => (
        <button
          key={material.id}
          type="button"
          onClick={() => onChange(material.id)}
          className={clsx(
            'flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors',
            value === material.id
              ? 'bg-apricot text-white'
              : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
          )}
        >
          {material.metadata?.thumbnailUrl && (
            <img
              src={material.metadata.thumbnailUrl}
              alt=""
              width={72}
              height={40}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-10 w-[72px] shrink-0 rounded-md object-cover"
            />
          )}
          <span className="line-clamp-2 flex-1 text-xs font-medium">{material.title}</span>
        </button>
      ))}
    </div>
  )
}

export default MaterialPicker
