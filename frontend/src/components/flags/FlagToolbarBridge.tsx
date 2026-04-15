import { useMemo } from 'react'
import { FlagValues, FlagDefinitions } from 'flags/react'

import { resolveAllFlagValues, buildFlagDefinitions } from '@/lib/flags/featureFlags'
import { useRemoteFlagsInit } from '@/hooks/useRemoteFlags'

/**
 * Renders the Vercel Flags SDK script tags so the Flags Explorer
 * (Vercel Toolbar) can discover and display flag state.
 *
 * Also bootstraps the remote flags fetch for Vercel-managed (ui) flags.
 * Mount once near the root of the app shell.
 */
export function FlagToolbarBridge() {
  useRemoteFlagsInit()

  const values = useMemo(() => resolveAllFlagValues(), [])
  const definitions = useMemo(() => buildFlagDefinitions(), [])

  return (
    <>
      <FlagValues values={values} />
      <FlagDefinitions definitions={definitions} />
    </>
  )
}
