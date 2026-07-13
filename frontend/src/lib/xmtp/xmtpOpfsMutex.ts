/**
 * Serializes the OPFS-touching span of `XmtpChatProvider.connect()`
 * (`probeOpfsDatabase` through `Client.build`/`Client.create`) across ALL
 * provider instances that exist in a tab — not just re-entrant calls on the
 * same instance.
 *
 * `connectInFlightRef` (a per-component ref in `provider.tsx`) already blocks
 * re-entrant `connect()` calls on the *same* provider instance, but it cannot
 * see a different instance's in-flight call. In dev, a Fast-Refresh remount
 * of the provider module can leave a prior instance's `connect()` promise
 * still running (its component tree is gone, but nothing cancelled the async
 * work) while a fresh instance immediately calls `connect()` again — both
 * then race to `createSyncAccessHandle` on the same OPFS file, which is
 * exactly the `NoModificationAllowedError` this guards against.
 *
 * Bounded by a timeout so an abandoned/hung holder cannot wedge every future
 * `connect()` call forever. On timeout the waiter **fails closed** (does not
 * proceed into OPFS) and abandons its queue slot so later attempts are not
 * permanently blocked.
 */

export const XMTP_OPFS_MUTEX_TIMEOUT_MS = 15_000

export type AcquireXmtpOpfsMutexResult =
  | { ok: true; release: () => void }
  | { ok: false; reason: 'timeout' }

let mutexTail: Promise<void> = Promise.resolve()

/** Test-only reset for module-level mutex state. */
export function resetXmtpOpfsMutexForTests(): void {
  mutexTail = Promise.resolve()
}

export async function acquireXmtpOpfsMutex(
  onTimeout?: () => void,
  timeoutMs: number = XMTP_OPFS_MUTEX_TIMEOUT_MS,
): Promise<AcquireXmtpOpfsMutexResult> {
  const waitForPrevious = mutexTail
  let releaseSelf!: () => void
  const selfDone = new Promise<void>((resolve) => {
    releaseSelf = resolve
  })
  mutexTail = waitForPrevious.then(() => selfDone).catch(() => selfDone)

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), timeoutMs)
  })

  const result = await Promise.race([
    waitForPrevious.catch(() => undefined).then(() => 'acquired' as const),
    timeoutPromise,
  ])

  if (timeoutId !== undefined) clearTimeout(timeoutId)

  if (result === 'timeout') {
    // Abandon our queue slot so later waiters are not wedged behind a timed-out
    // attempt that will never touch OPFS.
    releaseSelf()
    onTimeout?.()
    return { ok: false, reason: 'timeout' }
  }

  let released = false
  return {
    ok: true,
    release: () => {
      if (released) return
      released = true
      releaseSelf()
    },
  }
}
