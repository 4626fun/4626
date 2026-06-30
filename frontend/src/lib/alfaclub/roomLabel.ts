export type AlfaClubRoomLabelInput = {
  roomId: string
  roomName?: string | null
  creatorHandle?: string | null
}

function normalizeHandle(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/^@+/, '')
}

function normalizeRoomName(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ')
}

function isGenericRoomName(name: string, roomId: string): boolean {
  if (!name) return true
  if (name === roomId) return true
  return /^room\s*#?\s*\d+$/i.test(name)
}

/** e.g. "AKITA by wenakita" instead of "Room #1659". */
export function formatAlfaClubRoomLabel(input: AlfaClubRoomLabelInput): string {
  const roomId = input.roomId.trim()
  const handle = normalizeHandle(input.creatorHandle)
  const rawName = normalizeRoomName(input.roomName)
  const roomTitle = rawName && !isGenericRoomName(rawName, roomId) ? rawName : null

  if (roomTitle && handle) {
    if (roomTitle.toLowerCase() === handle.toLowerCase()) return roomTitle
    if (roomTitle.toLowerCase().includes(handle.toLowerCase())) return roomTitle
    return `${roomTitle} by ${handle}`
  }
  if (roomTitle) return roomTitle
  if (handle) return handle
  return `Room #${roomId}`
}

export function formatAlfaClubRoomOptionLabel(
  input: AlfaClubRoomLabelInput & { keySupply?: number | null; displayLabel?: string | null },
): string {
  const base = input.displayLabel?.trim() || formatAlfaClubRoomLabel(input)
  const keys = input.keySupply
  if (keys != null && keys > 0) return `${base} · ${keys.toLocaleString()} keys`
  return base
}
