import { useMemo } from 'react'

import { debugLogsFlag } from '@/lib/flags/featureFlags'
import { ExploreCopyButton } from '@/components/explore/ExploreUiPrimitives'
import { Tooltip } from '@/components/ui/Tooltip'

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
  const showDebugControl = import.meta.env.DEV || debugLogsFlag()

  if (!showDebugControl || !debugUrl) return null

  const rootClassName = `inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] text-zinc-500 ${className}`.trim()
  return (
    <div data-screenshot-hide="true" className={rootClassName}>
      <span className="uppercase tracking-[0.16em] text-zinc-500">QA</span>
      <Tooltip content={<span className="font-mono text-[10px] break-all">{tooltipText}</span>} placement="bottom">
        <div className="inline-flex items-center">
          <ExploreCopyButton
            text={debugUrl}
            title={label}
            className="rounded-md p-1 hover:bg-white/8"
          />
        </div>
      </Tooltip>
    </div>
  )
}
