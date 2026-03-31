import { startTransition, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { hasChatDeepLinkSearch } from './chatActivation'

export function useChatActivation(props: { initiallyActivated?: boolean } = {}) {
  const location = useLocation()
  const hasDeepLinkActivation = hasChatDeepLinkSearch(location.search)
  const initiallyActivated = props.initiallyActivated === true
  const [chatActivated, setChatActivated] = useState(() => initiallyActivated || hasDeepLinkActivation)

  useEffect(() => {
    if (!hasDeepLinkActivation) return
    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        setChatActivated(true)
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [hasDeepLinkActivation])

  return { chatActivated, setChatActivated }
}
