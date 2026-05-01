export type HermitMeme = {
  id: string
  url: string
  caption: string
  tags: string[]
}

export type HermitMediaAttachment = {
  url: string
  type: string
  filename?: string
  mime_type?: string
}

export type HermitCommandKind = 'gmeow' | 'hermit' | 'meme'

/**
 * Per-user style preferences resolved from the AlfaClub control plane.
 *
 * Hermit (creative lane) does NOT read or write this directly — it is
 * passed in by the chat-bridge or HTTP handler. This keeps the
 * boundary tests on `skillRouter` happy: nothing in the Hermit lane
 * imports `alfaclub/*Store` symbols.
 */
export type HermitUserPreferences = {
  /** Persisted Spanish dialect, if any. Trumped by an explicit signal. */
  spanishDialect?: string | null
}

/**
 * Optional callback used by `executeHermitCommand` to persist a fresh
 * explicit signal (flag emoji / text hint) for the active sender.
 *
 * Best-effort: returning false / throwing must not break the reply.
 * Implementations live in the AlfaClub lane (Vercel control plane).
 */
export type HermitPreferenceWriter = (params: {
  preferenceKey: 'hermit.spanish_dialect'
  preferenceValue: string
  updatedBy: string
}) => Promise<void> | void

export type HermitExecutionParams = {
  commandText: string
  senderAddress: `0x${string}`
  /** AlfaClub room id (digits in prod). Undefined for non-room callers. */
  roomId?: string
  /** Resolved user preferences for this (room, sender). */
  userPreferences?: HermitUserPreferences | null
  /** Best-effort writer for explicit signals. Optional. */
  persistPreference?: HermitPreferenceWriter | null
}

export type HermitExecutionResult = {
  kind: HermitCommandKind
  reply: string
  meme?: HermitMeme
  imagePrompt?: string
  mediaAttachments?: HermitMediaAttachment[]
  provider: 'local' | 'pinata'
}
