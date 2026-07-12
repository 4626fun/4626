import { describe, expect, it, vi } from 'vitest'

import type {
  ActivationStatusResponse,
  ProvisionAutomationOwnerResponse,
} from './activationApi'
import { executeOneSignatureActivation } from './executeActivation'

const CSW = '0x1111111111111111111111111111111111111111'
const EMBEDDED = '0x2222222222222222222222222222222222222222'
const SERVER = '0x3333333333333333333333333333333333333333'

function status(
  overrides: Partial<ActivationStatusResponse> = {},
): ActivationStatusResponse {
  return {
    parentCswAddress: CSW,
    embeddedEoaAddress: EMBEDDED,
    serverWalletAddress: SERVER,
    embeddedOwnerConfirmed: false,
    serverOwnerConfirmed: false,
    xmtpProvisioned: false,
    ...overrides,
  }
}

function provisioned(
  overrides: Partial<ProvisionAutomationOwnerResponse> = {},
): ProvisionAutomationOwnerResponse {
  return {
    alreadyOwner: false,
    agentWalletAddress: SERVER,
    embeddedOwnerConfirmed: true,
    activationToken: 'activation-token',
    txRequest: {
      chainId: 8453,
      to: CSW,
      data: '0x7065cb480000000000000000000000003333333333333333333333333333333333333333',
      value: '0x0',
    },
    ...overrides,
  }
}

describe('executeOneSignatureActivation', () => {
  it('submits exactly one visible approval before one silent owner install', async () => {
    const visible = vi.fn(async () => true)
    const silent = vi.fn(async () => undefined)
    const stages: string[] = []
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce(status())
      .mockResolvedValueOnce(status({ embeddedOwnerConfirmed: true }))
      .mockResolvedValueOnce(
        status({ embeddedOwnerConfirmed: true, serverOwnerConfirmed: true }),
      )
      .mockResolvedValueOnce(
        status({
          embeddedOwnerConfirmed: true,
          serverOwnerConfirmed: true,
          xmtpProvisioned: true,
        }),
      )

    await executeOneSignatureActivation({
      readStatus,
      submitVisibleEmbeddedOwnerInstall: visible,
      provisionServerOwner: async () => provisioned(),
      submitSilentServerOwnerInstall: silent,
      completeXmtpProvisioning: async () => undefined,
      onStage: (stage) => stages.push(stage),
    })

    expect(visible).toHaveBeenCalledTimes(1)
    expect(silent).toHaveBeenCalledTimes(1)
    expect(stages.indexOf('embedded_owner_confirmed')).toBeLessThan(
      stages.indexOf('silent_server_owner_install'),
    )
  })

  it('never starts silent installation before embedded ownership is confirmed', async () => {
    const silent = vi.fn(async () => undefined)
    await expect(
      executeOneSignatureActivation({
        readStatus: vi
          .fn()
          .mockResolvedValueOnce(status())
          .mockResolvedValueOnce(status()),
        submitVisibleEmbeddedOwnerInstall: async () => true,
        provisionServerOwner: async () => provisioned(),
        submitSilentServerOwnerInstall: silent,
        completeXmtpProvisioning: async () => undefined,
      }),
    ).rejects.toThrow('embedded_owner_not_confirmed')
    expect(silent).not.toHaveBeenCalled()
  })

  it('skips the visible stage when embedded owner already exists', async () => {
    const visible = vi.fn(async () => true)
    const readStatus = vi
      .fn()
      .mockResolvedValueOnce(status({ embeddedOwnerConfirmed: true }))
      .mockResolvedValueOnce(
        status({ embeddedOwnerConfirmed: true, serverOwnerConfirmed: true }),
      )
      .mockResolvedValueOnce(
        status({
          embeddedOwnerConfirmed: true,
          serverOwnerConfirmed: true,
          xmtpProvisioned: true,
        }),
      )
    await executeOneSignatureActivation({
      readStatus,
      submitVisibleEmbeddedOwnerInstall: visible,
      provisionServerOwner: async () => provisioned(),
      submitSilentServerOwnerInstall: async () => undefined,
      completeXmtpProvisioning: async () => undefined,
    })
    expect(visible).not.toHaveBeenCalled()
  })

  it('skips silent installation when server owner already exists', async () => {
    const silent = vi.fn(async () => undefined)
    const readyStatus = status({
      embeddedOwnerConfirmed: true,
      serverOwnerConfirmed: true,
      xmtpProvisioned: true,
    })
    await executeOneSignatureActivation({
      readStatus: vi.fn(async () => readyStatus),
      submitVisibleEmbeddedOwnerInstall: async () => true,
      provisionServerOwner: async () => provisioned({ alreadyOwner: true }),
      submitSilentServerOwnerInstall: silent,
      completeXmtpProvisioning: async () => undefined,
    })
    expect(silent).not.toHaveBeenCalled()
  })

  it('does not treat pending server ownership as complete and retries without passkey', async () => {
    const visible = vi.fn(async () => true)
    const silent = vi.fn(async () => undefined)
    await expect(
      executeOneSignatureActivation({
        readStatus: vi
          .fn()
          .mockResolvedValueOnce(status({ embeddedOwnerConfirmed: true }))
          .mockResolvedValueOnce(status({ embeddedOwnerConfirmed: true })),
        submitVisibleEmbeddedOwnerInstall: visible,
        provisionServerOwner: async () => provisioned(),
        submitSilentServerOwnerInstall: silent,
        completeXmtpProvisioning: async () => undefined,
      }),
    ).rejects.toThrow('server_owner_not_confirmed')

    expect(visible).not.toHaveBeenCalled()
    expect(silent).toHaveBeenCalledTimes(1)
  })

  it('fails closed when XMTP persistence does not land after both owners confirm', async () => {
    const completeXmtp = vi.fn(async () => undefined)
    await expect(
      executeOneSignatureActivation({
        readStatus: vi
          .fn()
          .mockResolvedValueOnce(status({ embeddedOwnerConfirmed: true }))
          .mockResolvedValueOnce(
            status({ embeddedOwnerConfirmed: true, serverOwnerConfirmed: true }),
          )
          .mockResolvedValueOnce(
            status({ embeddedOwnerConfirmed: true, serverOwnerConfirmed: true }),
          ),
        submitVisibleEmbeddedOwnerInstall: async () => true,
        provisionServerOwner: async () => provisioned({ alreadyOwner: true }),
        submitSilentServerOwnerInstall: async () => undefined,
        completeXmtpProvisioning: completeXmtp,
      }),
    ).rejects.toThrow('xmtp_not_provisioned')
    expect(completeXmtp).toHaveBeenCalledTimes(1)
  })

  it('does not provision automation when visible install reports submitted=false', async () => {
    const provision = vi.fn(async () => provisioned())
    const silent = vi.fn(async () => undefined)
    await expect(
      executeOneSignatureActivation({
        readStatus: vi.fn(async () => status()),
        submitVisibleEmbeddedOwnerInstall: async () => false,
        provisionServerOwner: provision,
        submitSilentServerOwnerInstall: silent,
        completeXmtpProvisioning: async () => undefined,
      }),
    ).rejects.toThrow('visible_owner_install_not_submitted')
    expect(provision).not.toHaveBeenCalled()
    expect(silent).not.toHaveBeenCalled()
  })

  it('refuses silent install when provision claims embedded owner is not confirmed', async () => {
    const silent = vi.fn(async () => undefined)
    await expect(
      executeOneSignatureActivation({
        readStatus: vi.fn(async () => status({ embeddedOwnerConfirmed: true })),
        submitVisibleEmbeddedOwnerInstall: async () => true,
        provisionServerOwner: async () =>
          ({
            ...provisioned(),
            embeddedOwnerConfirmed: false,
          }) as unknown as ProvisionAutomationOwnerResponse,
        submitSilentServerOwnerInstall: silent,
        completeXmtpProvisioning: async () => undefined,
      }),
    ).rejects.toThrow('embedded_owner_not_confirmed')
    expect(silent).not.toHaveBeenCalled()
  })
})
