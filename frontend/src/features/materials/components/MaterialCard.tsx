import { useState } from 'react'
import { Link as LinkIcon, Play, PlaySquare, StickyNote, Unlink } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { Material } from '@/lib/db/schema'
import { detachMaterialFromGoal } from '@/lib/db/materials.repository'
import { formatShortDuration } from '@/features/timer/utils'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import { useMaterialWatchedMs } from '../hooks/use-material-watched-ms'

type MaterialCardProps = {
  material: Material
  goalId: string
}

function MaterialCard({ material, goalId }: MaterialCardProps) {
  const { t } = useT()
  const [expandedNote, setExpandedNote] = useState(false)
  const watchedMs = useMaterialWatchedMs(
    material.kind === 'video-youtube' ? material.id : null,
  )

  const handleDetach = async () => {
    try {
      await detachMaterialFromGoal(material.id, goalId)
      toast.success(t.materials.detached)
    } catch {
      toast.error(t.materials.cannotDetach)
    }
  }

  if (material.kind === 'video-youtube') {
    const durationMs = (material.metadata?.durationSeconds ?? 0) * 1000
    const watchedLabel =
      watchedMs > 0
        ? durationMs > 0
          ? tpl(t.materials.videoWatchedFull, {
              watched: formatShortDuration(watchedMs),
              total: formatShortDuration(durationMs),
            })
          : tpl(t.materials.videoWatched, { time: formatShortDuration(watchedMs) })
        : null

    return (
      <li className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="flex gap-3">
          {material.metadata?.thumbnailUrl ? (
            <img
              src={material.metadata.thumbnailUrl}
              alt=""
              width={112}
              height={63}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-[63px] w-[112px] shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="inline-flex h-[63px] w-[112px] shrink-0 items-center justify-center rounded-lg bg-peach text-charcoal">
              <PlaySquare size={22} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold text-charcoal">
              {material.title}
            </h3>
            <p className="mt-1 truncate text-xs text-[color:var(--color-text-muted)]">
              {material.metadata?.author}
              {(material.metadata?.durationSeconds ?? 0) > 0 && (
                <>
                  {material.metadata?.author ? ' · ' : ''}
                  {formatShortDuration((material.metadata!.durationSeconds ?? 0) * 1000)}
                </>
              )}
            </p>
            {watchedLabel && (
              <p className="mt-0.5 truncate text-xs font-medium text-pistachio">
                {watchedLabel}
              </p>
            )}
            {material.url && (
              <a
                href={material.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-[color:var(--color-text-muted)] underline decoration-dotted underline-offset-2"
              >
                {t.materials.openInYouTube}
              </a>
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
        <Link
          to="/app/timer"
          state={{ goalId, materialId: material.id }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          <Play size={16} aria-hidden="true" />
          {t.materials.startWithMaterial}
        </Link>
      </li>
    )
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
