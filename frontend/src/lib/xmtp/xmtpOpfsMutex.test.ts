import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { acquireXmtpOpfsMutex, resetXmtpOpfsMutexForTests } from './xmtpOpfsMutex'

describe('acquireXmtpOpfsMutex', () => {
  beforeEach(() => {
    resetXmtpOpfsMutexForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('serializes overlapping acquisitions in FIFO order', async () => {
    const order: string[] = []

    const first = await acquireXmtpOpfsMutex()
    expect(first.ok).toBe(true)
    if (!first.ok) return
    order.push('acquired-1')

    const secondAcquire = acquireXmtpOpfsMutex().then((result) => {
      expect(result.ok).toBe(true)
      if (result.ok) order.push('acquired-2')
      return result
    })

    // Give the second acquisition a chance to run its microtasks; it must
    // NOT resolve while the first holder still holds the lock.
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['acquired-1'])

    first.release()
    const second = await secondAcquire
    expect(order).toEqual(['acquired-1', 'acquired-2'])
    if (second.ok) second.release()
  })

  it('lets a fresh acquisition proceed immediately when no one holds the lock', async () => {
    const result = await acquireXmtpOpfsMutex()
    expect(result).toMatchObject({ ok: true })
    if (result.ok) result.release()
  })

  it('is idempotent — calling release twice does not double-unlock', async () => {
    const first = await acquireXmtpOpfsMutex()
    expect(first.ok).toBe(true)
    if (!first.ok) return
    first.release()
    first.release() // should be a no-op, not throw or corrupt the chain

    const second = await acquireXmtpOpfsMutex()
    expect(second.ok).toBe(true)
    if (second.ok) second.release()
  })

  it('fails closed on timeout instead of proceeding concurrently', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()

    // First holder never releases (simulates an abandoned/hung connect()).
    const first = await acquireXmtpOpfsMutex()
    expect(first.ok).toBe(true)

    const secondAcquirePromise = acquireXmtpOpfsMutex(onTimeout, 1_000)
    await vi.advanceTimersByTimeAsync(1_000)
    const second = await secondAcquirePromise

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(second).toEqual({ ok: false, reason: 'timeout' })

    // Timed-out waiter abandoned its queue slot: a later attempt can acquire
    // once the original holder releases.
    if (first.ok) first.release()
    const third = await acquireXmtpOpfsMutex()
    expect(third.ok).toBe(true)
    if (third.ok) third.release()
  })
})
