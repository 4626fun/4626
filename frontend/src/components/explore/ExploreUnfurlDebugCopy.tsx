import { useMemo } from 'react'

import { ExploreCopyButton } from '@/components/explore/ExploreUiPrimitives'

const DEFAULT_SOCIAL_BOT_USER_AGENT = 'Twitterbot/1.0'

function normalizePreviewPath(rawPath: string): string {
  const trimmed = String(rawPath ?? '').trim()
  if (!trimmed) return '/'

  try {
    const asUrl = new URL(trimmed)
    return `${asUrl.pathname}${asUrl.search}`
  } catch {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }
}

function buildDebugUrl(path: string, userAgent: string): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL('/api/social-preview-debug', window.location.origin)
  url.searchParams.set('path', normalizePreviewPath(path))
  url.searchParams.set('userAgent', userAgent)
  return url.toString()
}

function getCurrentPathFromWindow(): string {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}`
}

type ExploreUnfurlDebugCopyProps = {
  path?: string
  className?: string
  label?: string
  userAgent?: string
}

export function ExploreUnfurlDebugCopy({
  path,
  className = '',
  label = 'Copy unfurl debug URL',
  userAgent = DEFAULT_SOCIAL_BOT_USER_AGENT,
}: ExploreUnfurlDebugCopyProps) {
  const currentPath = getCurrentPathFromWindow()
  const sourcePath = path ?? currentPath
  const previewPath = useMemo(() => normalizePreviewPath(sourcePath), [sourcePath])
  const tooltipText = `path=${previewPath} | userAgent=${userAgent}`
  const debugUrl = useMemo(() => buildDebugUrl(sourcePath, userAgent), [sourcePath, userAgent])
  const showDebugControl = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true'

  if (!showDebugControl || !debugUrl) return null

  const rootClassName = `inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] text-zinc-500 ${className}`.trim()
  return (
    <div data-screenshot-hide="true" className={rootClassName}>
      <span className="uppercase tracking-[0.16em] text-zinc-500">QA</span>
      <div className="group relative inline-flex items-center">
        <ExploreCopyButton
          text={debugUrl}
          title={label}
          className="rounded-md p-1 hover:bg-white/8"
        />
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[min(94vw,680px)] -translate-x-1/2 rounded-md border border-white/12 bg-black/92 px-2 py-1 text-[10px] text-zinc-300 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
          <span className="font-mono break-all">{tooltipText}</span>
        </div>
      </div>
    </div>
  )
}
