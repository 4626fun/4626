import { useCallback, useState } from 'react'

import { ChatAvailabilityRail } from './ChatAvailabilityRail'
import { ChatWidget } from './ChatWidget'

export function ChatSurface() {
  const [availabilityRailExpanded, setAvailabilityRailExpanded] = useState(false)
  const handleAvailabilityRailExpandedChange = useCallback((expanded: boolean) => {
    setAvailabilityRailExpanded(expanded)
  }, [])

  return (
    <>
      <ChatAvailabilityRail onExpandedChange={handleAvailabilityRailExpandedChange} />
      <ChatWidget initiallyActivated availabilityRailExpanded={availabilityRailExpanded} />
    </>
  )
}
