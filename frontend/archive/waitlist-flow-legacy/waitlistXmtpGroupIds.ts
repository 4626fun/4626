export function collectWaitlistGroupIdCandidates(input: {
  groupId: string | null | undefined
  envGroupId?: string | null | undefined
  vaultGroupId?: string | null | undefined
  groupIdMismatch?: boolean
}): string[] {
  const ids: string[] = []
  const add = (value: string | null | undefined) => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return
    if (!ids.some((id) => id.toLowerCase() === trimmed.toLowerCase())) {
      ids.push(trimmed)
    }
  }

  if (input.groupIdMismatch) {
    add(input.vaultGroupId ?? input.groupId)
    return ids
  }

  add(input.groupId)
  add(input.vaultGroupId)
  add(input.envGroupId)
  return ids
}

export function findWaitlistGroupConversation<T extends { id: string; type: string; name?: string }>(
  conversations: T[],
  groupIds: readonly string[],
  options?: { groupName?: string | null },
): T | null {
  if (groupIds.length > 0) {
    const normalizedTargets = new Set(groupIds.map((id) => id.trim().toLowerCase()))
    const byId = conversations.find((conversation) =>
      normalizedTargets.has(conversation.id.trim().toLowerCase()),
    )
    if (byId) return byId
    const byIdAndType = conversations.find(
      (conversation) =>
        conversation.type === 'group' && normalizedTargets.has(conversation.id.trim().toLowerCase()),
    )
    if (byIdAndType) return byIdAndType
  }

  const normalizedName = String(options?.groupName ?? '').trim().toLowerCase()
  if (!normalizedName) return null

  return (
    conversations.find(
      (conversation) =>
        conversation.type === 'group' && conversation.name?.trim().toLowerCase() === normalizedName,
    ) ?? null
  )
}
