import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  BookmarkCheck,
  BookmarkPlus,
  Maximize2,
  Minus,
  Plus,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
// Vite ?url import returns the built worker as a URL string. This keeps the
// large worker in its own chunk and loaded on demand.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getBlob } from '@/lib/db/blobs.repository'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const ZOOM_STEP = 1.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 3
const THUMBNAIL_WIDTH = 160
const MOBILE_QUERY = '(max-width: 767px)'

type PdfViewerProps = {
  blobId: string
  onPageRead?: (page: number) => void
  onDocumentReady?: (totalPages: number) => void
  onError?: (code: number) => void
  fullscreenLabel?: string
  zoomInLabel?: string
  zoomOutLabel?: string
  markReadLabel?: string
  timesReadLabel?: (times: number) => string
  pagesReadLabel?: (read: number, total: number) => string
  initialPagesReadCounts?: Record<number, number>
}

function PdfViewer({
  blobId,
  onPageRead,
  onDocumentReady,
  onError,
  fullscreenLabel = 'Fullscreen',
  zoomInLabel = 'Zoom in',
  zoomOutLabel = 'Zoom out',
  markReadLabel = 'Mark as read',
  timesReadLabel = (n) => `${n}×`,
  pagesReadLabel = (read, total) => `${read} / ${total} read`,
  initialPagesReadCounts,
}: PdfViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pagesScrollRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const mainViewerRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [totalPages, setTotalPages] = useState(0)
  const [firstPageAspect, setFirstPageAspect] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [visiblePage, setVisiblePage] = useState(1)
  const [selectedPage, setSelectedPage] = useState(1)
  const [pagesReadCounts, setPagesReadCounts] = useState<Record<number, number>>(
    () => ({ ...(initialPagesReadCounts ?? {}) }),
  )

  const onPageReadRef = useRef(onPageRead)
  const onDocumentReadyRef = useRef(onDocumentReady)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onPageReadRef.current = onPageRead
    onDocumentReadyRef.current = onDocumentReady
    onErrorRef.current = onError
  })

  // Track viewport width to decide between sidebar layout (desktop
  // fullscreen) and continuous vertical scroll (everything else).
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const handler = () => setIsMobile(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    ;(async () => {
      try {
        const record = await getBlob(blobId)
        if (cancelled) return
        if (!record) {
          setStatus('error')
          onErrorRef.current?.(404)
          return
        }
        const buffer = await record.blob.arrayBuffer()
        if (cancelled) return
        const loadingTask = pdfjsLib.getDocument({ data: buffer })
        const pdf = await loadingTask.promise
        if (cancelled) {
          pdf.destroy()
          return
        }
        docRef.current = pdf
        setTotalPages(pdf.numPages)
        setVisiblePage(1)
        setSelectedPage(1)
        try {
          const first = await pdf.getPage(1)
          const vp = first.getViewport({ scale: 1 })
          if (!cancelled) setFirstPageAspect(vp.width / vp.height)
        } catch {
          // ignore
        }
        setStatus('ready')
        onDocumentReadyRef.current?.(pdf.numPages)
      } catch {
        if (!cancelled) {
          setStatus('error')
          onErrorRef.current?.(500)
        }
      }
    })()
    return () => {
      cancelled = true
      docRef.current?.destroy().catch(() => undefined)
      docRef.current = null
    }
  }, [blobId])

  const goZoomOut = useCallback(() => setZoom((z) => Math.max(ZOOM_MIN, z / ZOOM_STEP)), [])
  const goZoomIn = useCallback(() => setZoom((z) => Math.min(ZOOM_MAX, z * ZOOM_STEP)), [])

  const handleMarkRead = useCallback((page: number) => {
    setPagesReadCounts((prev) => ({
      ...prev,
      [page]: (prev[page] ?? 0) + 1,
    }))
    onPageReadRef.current?.(page)
  }, [])

  const handleVisiblePage = useCallback((page: number) => {
    setVisiblePage(page)
  }, [])

  const handleFullscreen = () => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    if (document.fullscreenElement === wrapper) {
      document.exitFullscreen().catch(() => undefined)
    } else {
      wrapper.requestFullscreen?.().catch(() => undefined)
    }
  }

  const uniquePagesRead = Object.keys(pagesReadCounts).length
  const useSidebarLayout = isFullscreen && !isMobile
  const displayedPage = useSidebarLayout ? selectedPage : visiblePage

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages],
  )

  return (
    <div
      ref={wrapperRef}
      className={clsx(
        'relative flex flex-col gap-2 rounded-2xl bg-surface p-3',
        isFullscreen && 'h-screen w-screen',
      )}
    >
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-cream px-3 py-2">
        <span className="text-sm font-semibold text-charcoal tabular-nums">
          {status === 'ready' ? `${displayedPage} / ${totalPages}` : '—'}
        </span>
        <span className="hidden text-xs font-medium text-[color:var(--color-text-muted)] sm:inline">
          {status === 'ready' ? pagesReadLabel(uniquePagesRead, totalPages) : ''}
        </span>
        <div className="inline-flex items-center gap-1">
          {useSidebarLayout && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={goZoomOut}
                disabled={status !== 'ready' || zoom <= ZOOM_MIN + 1e-3}
                aria-label={zoomOutLabel}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] disabled:opacity-40"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="w-12 text-center text-xs font-semibold tabular-nums text-charcoal">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={goZoomIn}
                disabled={status !== 'ready' || zoom >= ZOOM_MAX - 1e-3}
                aria-label={zoomInLabel}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] disabled:opacity-40"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label={fullscreenLabel}
            title={fullscreenLabel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-charcoal ring-1 ring-[color:var(--color-border)] transition-colors"
          >
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <span className="text-xs font-medium text-[color:var(--color-text-muted)] sm:hidden">
        {status === 'ready' ? pagesReadLabel(uniquePagesRead, totalPages) : ''}
      </span>

      {status === 'error' && (
        <div className="flex items-center justify-center py-16 text-center text-xs text-[color:var(--color-text-muted)]">
          <span>PDF unavailable</span>
        </div>
      )}

      {status === 'ready' && docRef.current && useSidebarLayout && (
        <div className="flex flex-1 gap-2 overflow-hidden">
          <div
            ref={sidebarRef}
            className="w-[220px] shrink-0 overflow-y-auto rounded-xl bg-charcoal/5 p-2"
          >
            {pageNumbers.map((pageNumber) => (
              <PdfPageThumbnail
                key={pageNumber}
                pdf={docRef.current!}
                pageNumber={pageNumber}
                aspectRatio={firstPageAspect}
                selected={selectedPage === pageNumber}
                readCount={pagesReadCounts[pageNumber] ?? 0}
                scrollRoot={sidebarRef.current}
                markReadLabel={markReadLabel}
                timesReadLabel={timesReadLabel}
                onSelect={setSelectedPage}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
          <div
            ref={mainViewerRef}
            className="flex-1 overflow-auto rounded-xl bg-charcoal/5 p-4"
          >
            <PdfPageMain
              pdf={docRef.current!}
              pageNumber={selectedPage}
              zoom={zoom}
              containerRef={mainViewerRef}
            />
          </div>
        </div>
      )}

      {status === 'ready' && docRef.current && !useSidebarLayout && (
        <div
          ref={pagesScrollRef}
          className={clsx(
            'flex flex-col gap-4 overflow-y-auto rounded-xl bg-charcoal/5 p-3',
            isFullscreen ? 'flex-1' : 'max-h-[70vh]',
          )}
        >
          {pageNumbers.map((pageNumber) => (
            <PdfPageCard
              key={pageNumber}
              pdf={docRef.current!}
              pageNumber={pageNumber}
              aspectRatio={firstPageAspect}
              readCount={pagesReadCounts[pageNumber] ?? 0}
              scrollRoot={pagesScrollRef.current}
              markReadLabel={markReadLabel}
              timesReadLabel={timesReadLabel}
              onMarkRead={handleMarkRead}
              onVisible={handleVisiblePage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Continuous scroll card (mobile + desktop non-fullscreen) ----------

type PdfPageCardProps = {
  pdf: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  aspectRatio: number
  readCount: number
  scrollRoot: HTMLElement | null
  markReadLabel: string
  timesReadLabel: (times: number) => string
  onMarkRead: (page: number) => void
  onVisible: (page: number) => void
}

function PdfPageCard({
  pdf,
  pageNumber,
  aspectRatio,
  readCount,
  scrollRoot,
  markReadLabel,
  timesReadLabel,
  onMarkRead,
  onVisible,
}: PdfPageCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [inViewport, setInViewport] = useState(false)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInViewport(true)
            if (entry.intersectionRatio >= 0.5) onVisible(pageNumber)
          }
        }
      },
      { root: scrollRoot, threshold: [0, 0.5, 0.9] },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRoot, pageNumber, onVisible])

  useEffect(() => {
    if (!inViewport) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy['render']> | null = null
    ;(async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const containerWidth = canvasScrollRef.current?.clientWidth ?? 640
        const baseViewport = page.getViewport({ scale: 1 })
        const fitScale = containerWidth / baseViewport.width
        const viewport = page.getViewport({ scale: fitScale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        renderTask = page.render({ canvasContext: ctx, viewport })
        await renderTask.promise
        if (!cancelled) setRendered(true)
      } catch {
        // ignore aborts on unmount / rerender
      }
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, pageNumber, inViewport])

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-[1fr_auto] items-start gap-2 md:gap-3"
    >
      <div
        ref={canvasScrollRef}
        className="relative overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-black/5"
        style={rendered ? undefined : { aspectRatio, minHeight: 120 }}
      >
        <canvas ref={canvasRef} className="block" />
      </div>
      <button
        type="button"
        onClick={() => onMarkRead(pageNumber)}
        aria-label={markReadLabel}
        className={clsx(
          'sticky top-2 inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold transition active:scale-[0.98]',
          readCount > 0
            ? 'bg-pistachio text-charcoal'
            : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
        )}
      >
        {readCount > 0 ? (
          <>
            <BookmarkCheck size={14} aria-hidden="true" />
            <span className="tabular-nums">{timesReadLabel(readCount)}</span>
          </>
        ) : (
          <>
            <BookmarkPlus size={14} aria-hidden="true" />
            <span className="hidden md:inline">{markReadLabel}</span>
          </>
        )}
      </button>
    </div>
  )
}

// ---------- Sidebar thumbnail (desktop fullscreen) ----------

type PdfPageThumbnailProps = {
  pdf: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  aspectRatio: number
  selected: boolean
  readCount: number
  scrollRoot: HTMLElement | null
  markReadLabel: string
  timesReadLabel: (times: number) => string
  onSelect: (page: number) => void
  onMarkRead: (page: number) => void
}

function PdfPageThumbnail({
  pdf,
  pageNumber,
  aspectRatio,
  selected,
  readCount,
  scrollRoot,
  markReadLabel,
  timesReadLabel,
  onSelect,
  onMarkRead,
}: PdfPageThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [inViewport, setInViewport] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setInViewport(true)
        }
      },
      { root: scrollRoot, rootMargin: '200px 0px', threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    if (!inViewport) return
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy['render']> | null = null
    ;(async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const baseViewport = page.getViewport({ scale: 1 })
        const scale = THUMBNAIL_WIDTH / baseViewport.width
        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        renderTask = page.render({ canvasContext: ctx, viewport })
        await renderTask.promise
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, pageNumber, inViewport])

  return (
    <div ref={containerRef} className="mb-3 flex items-start gap-2">
      <button
        type="button"
        onClick={() => onSelect(pageNumber)}
        className={clsx(
          'flex flex-col overflow-hidden rounded-md ring-2 transition-colors',
          selected ? 'ring-apricot' : 'ring-transparent hover:ring-charcoal/20',
        )}
        style={{ width: THUMBNAIL_WIDTH }}
      >
        <div
          className="bg-white"
          style={{ aspectRatio, width: THUMBNAIL_WIDTH }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>
        <span className="bg-charcoal/10 py-1 text-center text-xs font-semibold text-charcoal tabular-nums">
          {pageNumber}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onMarkRead(pageNumber)}
        aria-label={markReadLabel}
        className={clsx(
          'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition active:scale-[0.98]',
          readCount > 0
            ? 'bg-pistachio text-charcoal'
            : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
        )}
      >
        {readCount > 0 ? (
          <>
            <BookmarkCheck size={12} aria-hidden="true" />
            <span className="tabular-nums">{timesReadLabel(readCount)}</span>
          </>
        ) : (
          <BookmarkPlus size={12} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

// ---------- Main viewer (desktop fullscreen right pane) ----------

type PdfPageMainProps = {
  pdf: pdfjsLib.PDFDocumentProxy
  pageNumber: number
  zoom: number
  containerRef: React.RefObject<HTMLElement | null>
}

function PdfPageMain({ pdf, pageNumber, zoom, containerRef }: PdfPageMainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy['render']> | null = null
    ;(async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const containerWidth = containerRef.current?.clientWidth ?? 640
        const baseViewport = page.getViewport({ scale: 1 })
        // Reserve some padding room and cap the fit so the page never sits
        // completely edge-to-edge inside the main pane.
        const fitScale = (containerWidth - 32) / baseViewport.width
        const clampedZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
        const viewport = page.getViewport({ scale: fitScale * clampedZoom })
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        renderTask = page.render({ canvasContext: ctx, viewport })
        await renderTask.promise
      } catch {
        // ignore render aborts
      }
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [pdf, pageNumber, zoom, containerRef])

  return (
    <div className="flex justify-center">
      <canvas ref={canvasRef} className="block bg-white shadow-md ring-1 ring-black/10" />
    </div>
  )
}

export default PdfViewer
