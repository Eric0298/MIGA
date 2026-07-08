import { useState } from 'react'
import { Link as LinkIcon, StickyNote, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import type { Material } from '@/lib/db/schema'
import { detachMaterialFromGoal } from '@/lib/db/materials.repository'
import { useT } from '@/i18n/i18n-context'

type MaterialCardProps = {
  material: Material
  goalId: string
}

function MaterialCard({ material, goalId }: MaterialCardProps) {
  const { t } = useT()
  const [expandedNote, setExpandedNote] = useState(false)

  const handleDetach = async () => {
    try {
      await detachMaterialFromGoal(material.id, goalId)
      toast.success(t.materials.detached)
    } catch {
      toast.error(t.materials.cannotDetach)
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
          {material.kind === 'link' ? (
            <LinkIcon size={16} aria-hidden="true" />
          ) : (
            <StickyNote size={16} aria-hidden="true" />
          )}
        </span>
        <div className="flex-1 overflow-hidden">
          <h3 className="text-sm font-semibold text-charcoal">{material.title}</h3>
          {material.kind === 'link' && material.url && (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.materials.openLink}
              className="mt-1 block truncate text-xs text-[color:var(--color-text-muted)] underline decoration-dotted underline-offset-2"
            >
              {material.url}
            </a>
          )}
          {material.kind === 'note' && material.notes && (
            <button
              type="button"
              onClick={() => setExpandedNote((v) => !v)}
              className="mt-1 text-left text-xs text-[color:var(--color-text-muted)]"
            >
              {expandedNote
                ? material.notes
                : material.notes.length > 90
                  ? `${material.notes.slice(0, 90)}…`
                  : material.notes}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDetach}
          aria-label={t.materials.detach}
          title={t.materials.detach}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
        >
          <Unlink size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

export default MaterialCard
