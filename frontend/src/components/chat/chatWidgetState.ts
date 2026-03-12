export type OpenWindow = {
  id: string
  name: string
  type: 'dm' | 'group'
  peerInboxId?: string
  peerAddress?: string
  imageUrl?: string
  minimized: boolean
  seedCommandId?: string | null
}

export function rekeyOpenWindows(
  windows: OpenWindow[],
  oldConversationId: string,
  newConversationId: string,
): OpenWindow[] {
  const oldId = oldConversationId.trim()
  const newId = newConversationId.trim()
  if (!oldId || !newId || oldId === newId) return windows
  if (!windows.some((windowItem) => windowItem.id === oldId)) return windows

  const remapped = windows.map((windowItem) =>
    windowItem.id === oldId
      ? { ...windowItem, id: newId, minimized: false }
      : windowItem,
  )

  const deduped: OpenWindow[] = []
  for (const windowItem of remapped) {
    const existingIndex = deduped.findIndex((candidate) => candidate.id === windowItem.id)
    if (existingIndex === -1) {
      deduped.push(windowItem)
      continue
    }
    const existing = deduped[existingIndex]
    deduped[existingIndex] = {
      ...existing,
      ...windowItem,
      minimized: false,
      seedCommandId: windowItem.seedCommandId ?? existing.seedCommandId ?? null,
    }
  }
  return deduped
}
