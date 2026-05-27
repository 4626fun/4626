export function collectWaitlistGroupIdCandidates(input: {
  groupId: string | null | undefined
  envGroupId?: string | null | undefined
  vaultGroupId?: string | null | undefined
}): string[] {
  const ids: string[] = []
  const add = (value: string | null | undefined) => {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return
    if (!ids.some((id) => id.toLowerCase() === trimmed.toLowerCase())) {
      ids.push(trimmed)
    }
  }

  add(input.groupId)
  add(input.vaultGroupId)
  add(input.envGroupId)
  return ids
}

export function findWaitlistGroupConversation<T extends { id: string; type: string }>(
  conversations: T[],
  groupIds: readonly string[],
): T | null {
  if (groupIds.length === 0) return null
  const normalizedTargets = new Set(groupIds.map((id) => id.trim().toLowerCase()))
  return (
    conversations.find(
      (conversation) =>
        conversation.type === 'group' && normalizedTargets.has(conversation.id.trim().toLowerCase()),
    ) ?? null
  )
}
