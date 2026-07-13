// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createMock, closeMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  closeMock: vi.fn(),
}))

vi.mock('@xmtp/browser-sdk', () => ({
  Client: {
    create: createMock,
  },
  ConsentState: {
    Unknown: 0,
    Allowed: 1,
    Denied: 2,
  },
}))

import {
  registerBuiltClientInboxViaCreate,
  resolveRestoredRegistrationDbPath,
} from './xmtpBuiltClientRegistration'

function makeSigner(type: 'SCW' | 'EOA' = 'SCW') {
  return {
    type,
    getIdentifier: () => ({
      identifier: '0xAb6d5C10b03300326cd7fab7267ae192842967b5',
      identifierKind: 0,
    }),
    signMessage: async () => new Uint8Array(65),
  } as any
}

function makeBuiltClient(input: {
  inboxId: string
  installationId: string
  registered: boolean
}) {
  return {
    inboxId: input.inboxId,
    installationId: input.installationId,
    isRegistered: async () => input.registered,
    close: closeMock,
  } as any
}

describe('resolveRestoredRegistrationDbPath', () => {
  it('accepts a dbPath that targets the restored inbox id', () => {
    expect(
      resolveRestoredRegistrationDbPath({
        restoreDbPath: 'xmtp-production-inbox-1.db3',
        inboxId: 'inbox-1',
      }),
    ).toBe('xmtp-production-inbox-1.db3')
  })

  it('rejects missing dbPath', () => {
    expect(() =>
      resolveRestoredRegistrationDbPath({
        restoreDbPath: undefined,
        inboxId: 'inbox-1',
      }),
    ).toThrow(/dbPath/)
  })

  it('rejects dbPath that does not match the restored inbox id', () => {
    expect(() =>
      resolveRestoredRegistrationDbPath({
        restoreDbPath: 'xmtp-production-other-inbox.db3',
        inboxId: 'inbox-1',
      }),
    ).toThrow(/does not match restored inbox id/)
  })
})

describe('registerBuiltClientInboxViaCreate', () => {
  afterEach(() => {
    createMock.mockReset()
    closeMock.mockReset()
  })

  it('returns the built client without Client.create when already registered', async () => {
    const buildClient = makeBuiltClient({
      inboxId: 'inbox-1',
      installationId: 'install-1',
      registered: true,
    })
    const signer = makeSigner()

    const result = await registerBuiltClientInboxViaCreate({
      buildClient,
      signers: [signer],
      restoreOptions: { env: 'production', dbPath: 'xmtp-production-inbox-1.db3' },
      peerReleaseWaitMs: 0,
    })

    expect(result.client).toBe(buildClient)
    expect(result.signer).toBe(signer)
    expect(createMock).not.toHaveBeenCalled()
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('registers via Client.create on the exact restored dbPath once', async () => {
    const buildClient = makeBuiltClient({
      inboxId: 'inbox-1',
      installationId: 'local-install',
      registered: false,
    })
    const createdClient = makeBuiltClient({
      inboxId: 'inbox-1',
      installationId: 'network-install',
      registered: true,
    })
    createMock.mockResolvedValueOnce(createdClient)
    const signer = makeSigner('SCW')
    const restoreOptions = {
      env: 'production',
      dbPath: 'xmtp-production-inbox-1.db3',
      dbEncryptionKey: new Uint8Array(32),
    }

    const result = await registerBuiltClientInboxViaCreate({
      buildClient,
      signers: [signer, makeSigner('EOA')],
      restoreOptions,
      peerReleaseWaitMs: 0,
    })

    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock).toHaveBeenCalledWith(
      signer,
      expect.objectContaining({
        dbPath: 'xmtp-production-inbox-1.db3',
        disableAutoRegister: false,
      }),
    )
    expect(result.client).toBe(createdClient)
    expect(result.client.installationId).toBe('network-install')
  })

  it('refuses registration when restoreOptions omit dbPath', async () => {
    const buildClient = makeBuiltClient({
      inboxId: 'inbox-1',
      installationId: 'local-install',
      registered: false,
    })

    await expect(
      registerBuiltClientInboxViaCreate({
        buildClient,
        signers: [makeSigner()],
        restoreOptions: { env: 'production' },
        peerReleaseWaitMs: 0,
      }),
    ).rejects.toThrow(/dbPath/)

    expect(createMock).not.toHaveBeenCalled()
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('refuses registration when dbPath targets a different inbox', async () => {
    const buildClient = makeBuiltClient({
      inboxId: 'inbox-1',
      installationId: 'local-install',
      registered: false,
    })

    await expect(
      registerBuiltClientInboxViaCreate({
        buildClient,
        signers: [makeSigner()],
        restoreOptions: { env: 'production', dbPath: 'xmtp-production-inbox-2.db3' },
        peerReleaseWaitMs: 0,
      }),
    ).rejects.toThrow(/does not match restored inbox id/)

    expect(createMock).not.toHaveBeenCalled()
    expect(closeMock).not.toHaveBeenCalled()
  })

  it('waits for OPFS peer release between close and Client.create', async () => {
    vi.useFakeTimers()
    try {
      const buildClient = makeBuiltClient({
        inboxId: 'inbox-1',
        installationId: 'local-install',
        registered: false,
      })
      const createdClient = makeBuiltClient({
        inboxId: 'inbox-1',
        installationId: 'network-install',
        registered: true,
      })
      createMock.mockResolvedValueOnce(createdClient)

      const pending = registerBuiltClientInboxViaCreate({
        buildClient,
        signers: [makeSigner()],
        restoreOptions: { env: 'production', dbPath: 'xmtp-production-inbox-1.db3' },
        peerReleaseWaitMs: 250,
      })

      await Promise.resolve()
      expect(closeMock).toHaveBeenCalledTimes(1)
      expect(createMock).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(250)
      const result = await pending
      expect(createMock).toHaveBeenCalledTimes(1)
      expect(result.client.installationId).toBe('network-install')
    } finally {
      vi.useRealTimers()
    }
  })
})
