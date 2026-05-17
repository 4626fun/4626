export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildFallbackHistoryBlock(state: Record<string, unknown>): string {
  const recent = Array.isArray((state as any).recentMessages)
    ? ((state as any).recentMessages as Array<any>)
    : []
  const entries = recent
    .map((entry) => {
      const role = String(entry?.role ?? 'user')
      const text = String(entry?.text ?? '').replace(/\s+/g, ' ').trim()
      const createdAt = Number(entry?.createdAt ?? Date.now())
      const ts = Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString()
      return `<turn role="${xmlEscape(role)}" ts="${ts}">${xmlEscape(text)}</turn>`
    })
    .join('\n')
  return `<history>\n${entries}\n</history>`
}

export function buildContinuityContextBlock(state: Record<string, unknown>): string {
  const historyBlock =
    typeof (state as any).historyBlock === 'string' && (state as any).historyBlock.trim()
      ? String((state as any).historyBlock)
      : buildFallbackHistoryBlock(state)
  const snapshotBlock =
    typeof (state as any).memorySnapshotBlock === 'string' && (state as any).memorySnapshotBlock.trim()
      ? String((state as any).memorySnapshotBlock)
      : '<memory_snapshot />'
  const factCardsBlock =
    typeof (state as any).factCardsBlock === 'string' && (state as any).factCardsBlock.trim()
      ? String((state as any).factCardsBlock)
      : '<fact_cards />'
  const openTasksBlock =
    typeof (state as any).openTasksBlock === 'string' && (state as any).openTasksBlock.trim()
      ? String((state as any).openTasksBlock)
      : '<open_tasks />'

  return [historyBlock, snapshotBlock, factCardsBlock, openTasksBlock].join('\n\n').trim()
}
