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

    const release1 = await acquireXmtpOpfsMutex()
    order.push('acquired-1')

    const secondAcquire = acquireXmtpOpfsMutex().then((release) => {
      order.push('acquired-2')
      return release
    })

    // Give the second acquisition a chance to run its microtasks; it must
    // NOT resolve while the first holder still holds the lock.
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual(['acquired-1'])

    release1()
    const release2 = await secondAcquire
    expect(order).toEqual(['acquired-1', 'acquired-2'])
    release2()
  })

  it('lets a fresh acquisition proceed immediately when no one holds the lock', async () => {
    const release = await acquireXmtpOpfsMutex()
    expect(typeof release).toBe('function')
    release()
  })

  it('is idempotent — calling release twice does not double-unlock', async () => {
    const release1 = await acquireXmtpOpfsMutex()
    release1()
    release1() // should be a no-op, not throw or corrupt the chain

    const release2 = await acquireXmtpOpfsMutex()
    release2()
  })

  it('times out and proceeds anyway when a holder never releases, invoking onTimeout', async () => {
    vi.useFakeTimers()
    const onTimeout = vi.fn()

    // First holder never releases (simulates an abandoned/hung connect()).
    await acquireXmtpOpfsMutex()

    const secondAcquirePromise = acquireXmtpOpfsMutex(onTimeout, 1_000)
    await vi.advanceTimersByTimeAsync(1_000)
    const release2 = await secondAcquirePromise

    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(typeof release2).toBe('function')
    release2()
  })
})
