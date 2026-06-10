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
  /** Persisted tone preference (e.g. `clean`, `degen`, `pro`, …). */
  tone?: string | null
  /**
   * ISO timestamp of when the per-(room, sender) onboarding nudge was
   * last shown. Presence (any non-empty value) means "do not nudge
   * again". Absence means "nudge on next valid creative reply".
   */
  onboardedAt?: string | null
}

/**
 * Persistable Hermit preference keys. The AlfaClub control-plane
 * store accepts any `hermit.*` namespaced key generically, but the
 * type union below is the source of truth for which keys the
 * creative lane is allowed to write through `persistPreference`.
 */
export type HermitPreferenceKey =
  | 'hermit.spanish_dialect'
  | 'hermit.tone'
  | 'hermit.onboarded'

/**
 * Optional callback used by `executeHermitCommand` to persist a fresh
 * explicit signal (flag emoji / text hint), an explicit `/hermit
 * lang` / `/hermit tone` selection, or the one-time onboarding flag.
 *
 * Best-effort: returning false / throwing must not break the reply.
 * Implementations live in the AlfaClub lane (Vercel control plane).
 */
export type HermitPreferenceWriter = (params: {
  preferenceKey: HermitPreferenceKey
  preferenceValue: string
  updatedBy: string
}) => Promise<void> | void

/**
 * Optional read-back of every Hermit preference for the current
 * (room, sender). Used by `/hermit prefs` to render a snapshot.
 * Returns an empty array when persistence is unavailable.
 */
export type HermitPreferenceLister = () => Promise<
  Array<{
    preferenceKey: string
    preferenceValue: string | null
    updatedAt: string | null
  }>
>

/**
 * Optional bulk-clear used by `/hermit reset`. Clears every Hermit
 * preference (`hermit.*` prefix) for the current (room, sender).
 * Best-effort: returns true on success, false on DB unavailable.
 */
export type HermitPreferenceClearer = () => Promise<boolean>

export type HermitExecutionParams = {
  commandText: string
  senderAddress: `0x${string}`
  /** Caller is trusted to mutate room-level strategy controls. */
  isTrustedOperator?: boolean
  /**
   * Optional caller source identity (for routing guards), e.g.
   * `alfaclub-bridge-runner` or `openclaw-control-ui`.
   */
  sourceIdentity?: string | null
  /** AlfaClub room id (digits in prod). Undefined for non-room callers. */
  roomId?: string
  /** Resolved user preferences for this (room, sender). */
  userPreferences?: HermitUserPreferences | null
  /** Best-effort writer for explicit signals. Optional. */
  persistPreference?: HermitPreferenceWriter | null
  /** Best-effort lister for `/hermit prefs`. Optional. */
  listPreferences?: HermitPreferenceLister | null
  /** Best-effort bulk-clear for `/hermit reset`. Optional. */
  clearPreferences?: HermitPreferenceClearer | null

  // === Room 1659 specific market data ===
  /** Live hype, liquidation, and user position data (only for room 1659) */
  room1659Market?: import('../../commands/execute.js').HermitRoomContext['room1659Market']
}

export type HermitExecutionResult = {
  kind: HermitCommandKind
  reply: string
  meme?: HermitMeme
  imagePrompt?: string
  mediaAttachments?: HermitMediaAttachment[]
  provider: 'local' | 'hermit'
}
