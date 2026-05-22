import { ChatAvailabilityRail } from './ChatAvailabilityRail'
import { ChatWidget } from './ChatWidget'

export function ChatSurface() {
  return (
    <>
      <ChatAvailabilityRail />
      <ChatWidget initiallyActivated />
    </>
  )
}
