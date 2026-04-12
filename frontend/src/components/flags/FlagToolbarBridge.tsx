import { useMemo } from 'react'
import { FlagValues, FlagDefinitions } from 'flags/react'

import { resolveAllFlagValues, buildFlagDefinitions } from '@/lib/featureFlags'

/**
 * Renders the Vercel Flags SDK script tags so the Flags Explorer
 * (Vercel Toolbar) can discover and display flag state.
 *
 * Mount once near the root of the app shell. The component is pure
 * render — no side effects, no providers, no state.
 */
export function FlagToolbarBridge() {
  const values = useMemo(() => resolveAllFlagValues(), [])
  const definitions = useMemo(() => buildFlagDefinitions(), [])

  return (
    <>
      <FlagValues values={values} />
      <FlagDefinitions definitions={definitions} />
    </>
  )
}
