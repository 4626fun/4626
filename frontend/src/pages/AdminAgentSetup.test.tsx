import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const CREATOR_ADDRESS = '0x1111111111111111111111111111111111111111'
const CANONICAL_CSW_ADDRESS = '0x2222222222222222222222222222222222222222'
const EMBEDDED_EOA_ADDRESS = '0x3333333333333333333333333333333333333333'
const VAULT_ADDRESS = '0x4444444444444444444444444444444444444444'
const CREATOR_TOKEN_ADDRESS = '0x5555555555555555555555555555555555555555'
const WRAPPER_ADDRESS = '0x6666666666666666666666666666666666666666'
const SHARE_OFT_ADDRESS = '0x7777777777777777777777777777777777777777'
const NEXT_VAULT_ADDRESS = '0x8888888888888888888888888888888888888888'
const PRIVY_SMART_WALLET_ADDRESS = '0x9999999999999999999999999999999999999999'
const PRIVY_WALLET_ID = 'privy-wallet-123'
const PRIVY_SMART_WALLET_ID = 'privy-smart-wallet-456'
type ButtonElement = React.ReactElement<{ onClick?: () => void }>

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement) => boolean,
): React.ReactElement | null {
  if (!React.isValidElement(node)) return null
  if (predicate(node)) return node

  const props = node.props as { children?: React.ReactNode }
  for (const child of React.Children.toArray(props.children)) {
    const match = findElement(child, predicate)
    if (match) return match
  }

  return null
}

describe('AdminAgentSetup Ajna automation', () => {
  it('shows explicit canonical-CSW opt-in copy and submits creator-owned wallet context', async () => {
    const { AjnaAutomationOptInCard } = await import('./AdminAgentSetup')
    expect(typeof AjnaAutomationOptInCard).toBe('function')

    const onEnable = vi.fn()
    const tree = AjnaAutomationOptInCard({
      vaultAddress: VAULT_ADDRESS,
      canonicalCswAddress: CANONICAL_CSW_ADDRESS,
      embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
      privyWalletId: PRIVY_WALLET_ID,
      status: null,
      isSubmitting: false,
      isRevoking: false,
      onEnable,
      onRevoke: vi.fn(),
    })

    const html = renderToStaticMarkup(tree)
    expect(html).toContain('Opt in to Ajna automation')
    expect(html).toContain('Authorize canonical Ajna automation with your creator-owned Coinbase Smart Wallet')
    expect(html).toContain('Canonical CSW')
    expect(html).toContain(CANONICAL_CSW_ADDRESS)
    expect(html).not.toContain('Keepr signer')
    expect(html).not.toContain('Add Owner')

    const enableButton = findElement(
      tree,
      (element) =>
        element.type === 'button' &&
        (element.props as { 'aria-label'?: string })['aria-label'] === 'Enable Ajna automation',
    ) as ButtonElement | null
    expect(enableButton).not.toBeNull()

    enableButton?.props.onClick?.()

    expect(onEnable).toHaveBeenCalledWith({
      vaultAddress: VAULT_ADDRESS,
      cswAddress: CANONICAL_CSW_ADDRESS,
      embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
      privyWalletId: PRIVY_WALLET_ID,
    })
  }, 20_000)

  it('shows revoke and debug details for an enabled vault', async () => {
    const { AjnaAutomationOptInCard } = await import('./AdminAgentSetup')
    expect(typeof AjnaAutomationOptInCard).toBe('function')

    const onRevoke = vi.fn()
    const tree = AjnaAutomationOptInCard({
      vaultAddress: VAULT_ADDRESS,
      canonicalCswAddress: CANONICAL_CSW_ADDRESS,
      embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
      privyWalletId: PRIVY_WALLET_ID,
      status: {
        vaultAddress: VAULT_ADDRESS,
        automationEnabled: true,
        automationScope: 'ajna_min_bucket_only',
        canonicalCswAddress: CANONICAL_CSW_ADDRESS,
        embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
        privyWalletId: PRIVY_WALLET_ID,
        lastOwnerCheckAt: '2026-03-10T00:00:00.000Z',
        revokedAt: null,
        updatedAt: '2026-03-10T00:00:00.000Z',
      },
      isSubmitting: false,
      isRevoking: false,
      onEnable: vi.fn(),
      onRevoke,
    })

    const html = renderToStaticMarkup(tree)
    expect(html).toContain('Ajna automation is enabled')
    expect(html).toContain('Canonical CSW')
    expect(html).toContain('Embedded EOA')
    expect(html).toContain('Privy Wallet')
    expect(html).toContain('On file')
    expect(html).not.toContain(PRIVY_WALLET_ID)

    const revokeButton = findElement(
      tree,
      (element) =>
        element.type === 'button' &&
        (element.props as { 'aria-label'?: string })['aria-label'] === 'Revoke Ajna automation',
    ) as ButtonElement | null
    expect(revokeButton).not.toBeNull()

    revokeButton?.props.onClick?.()

    expect(onRevoke).toHaveBeenCalledWith(VAULT_ADDRESS)
  })

  it('shows a status-unavailable error path when Ajna status hydration fails', async () => {
    const { AjnaAutomationOptInCard } = await import('./AdminAgentSetup')
    expect(typeof AjnaAutomationOptInCard).toBe('function')

    const tree = AjnaAutomationOptInCard({
      vaultAddress: VAULT_ADDRESS,
      canonicalCswAddress: CANONICAL_CSW_ADDRESS,
      embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
      privyWalletId: PRIVY_WALLET_ID,
      status: null,
      statusUnavailable: true,
      errorMessage: 'Failed to load Ajna automation status',
      isSubmitting: false,
      isRevoking: false,
      onEnable: vi.fn(),
      onRevoke: vi.fn(),
    })

    const html = renderToStaticMarkup(tree)
    expect(html).toContain('Ajna automation status unavailable')
    expect(html).toContain('Status unavailable')
    expect(html).toContain('Failed to load Ajna automation status')
    expect(html).not.toContain('Off by default')
  })

  it('ignores stale Ajna mutation state when the selected vault changes', async () => {
    const { selectAjnaAutomationViewState } = await import('./AdminAgentSetup')
    expect(typeof selectAjnaAutomationViewState).toBe('function')

    const currentVaultStatus = {
      vaultAddress: NEXT_VAULT_ADDRESS,
      automationEnabled: false,
      automationScope: 'ajna_min_bucket_only',
    }

    const result = selectAjnaAutomationViewState({
      normalizedVaultAddress: NEXT_VAULT_ADDRESS.toLowerCase(),
      queryStatus: currentVaultStatus,
      enableMutation: {
        data: {
          vaultAddress: VAULT_ADDRESS,
          automationEnabled: true,
          automationScope: 'ajna_min_bucket_only',
        },
        error: new Error('Vault A failed'),
        variables: {
          vaultAddress: VAULT_ADDRESS,
          cswAddress: CANONICAL_CSW_ADDRESS,
          embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
          privyWalletId: PRIVY_WALLET_ID,
        },
      },
      revokeMutation: {
        data: null,
        error: null,
        variables: undefined,
      },
    })

    expect(result.status).toEqual(currentVaultStatus)
    expect(result.errorMessage).toBeNull()
  })

  it('keeps query-backed status canonical after same-vault enable then revoke/refetch', async () => {
    const { selectAjnaAutomationViewState } = await import('./AdminAgentSetup')
    expect(typeof selectAjnaAutomationViewState).toBe('function')

    const revokedVaultStatus = {
      vaultAddress: VAULT_ADDRESS,
      automationEnabled: false,
      automationScope: 'ajna_min_bucket_only',
      revokedAt: '2026-03-10T01:00:00.000Z',
    }

    const result = selectAjnaAutomationViewState({
      normalizedVaultAddress: VAULT_ADDRESS.toLowerCase(),
      queryStatus: revokedVaultStatus,
      enableMutation: {
        data: {
          vaultAddress: VAULT_ADDRESS,
          automationEnabled: true,
          automationScope: 'ajna_min_bucket_only',
        },
        error: null,
        variables: {
          vaultAddress: VAULT_ADDRESS,
          cswAddress: CANONICAL_CSW_ADDRESS,
          embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
          privyWalletId: PRIVY_WALLET_ID,
        },
      },
      revokeMutation: {
        data: revokedVaultStatus,
        error: null,
        variables: VAULT_ADDRESS,
      },
    })

    expect(result.status).toEqual(revokedVaultStatus)
    expect(result.errorMessage).toBeNull()
  })

  it('surfaces current-vault query failures as status-unavailable', async () => {
    const { selectAjnaAutomationViewState } = await import('./AdminAgentSetup')
    expect(typeof selectAjnaAutomationViewState).toBe('function')

    const result = selectAjnaAutomationViewState({
      normalizedVaultAddress: VAULT_ADDRESS.toLowerCase(),
      queryStatus: null,
      queryError: new Error('Failed to load Ajna automation status'),
      enableMutation: {
        error: null,
        variables: undefined,
      },
      revokeMutation: {
        data: null,
        error: null,
        variables: undefined,
      },
    })

    expect(result.status).toBeNull()
    expect(result.statusUnavailable).toBe(true)
    expect(result.errorMessage).toBe('Failed to load Ajna automation status')
  })

  it('shows current-vault mutation errors without overriding query-backed status', async () => {
    const { selectAjnaAutomationViewState } = await import('./AdminAgentSetup')
    expect(typeof selectAjnaAutomationViewState).toBe('function')

    const currentVaultStatus = {
      vaultAddress: VAULT_ADDRESS,
      automationEnabled: true,
      automationScope: 'ajna_min_bucket_only',
    }

    const result = selectAjnaAutomationViewState({
      normalizedVaultAddress: VAULT_ADDRESS.toLowerCase(),
      queryStatus: currentVaultStatus,
      enableMutation: {
        error: null,
        variables: undefined,
      },
      revokeMutation: {
        data: null,
        error: new Error('Revoke failed'),
        variables: VAULT_ADDRESS,
      },
    })

    expect(result.status).toEqual(currentVaultStatus)
    expect(result.errorMessage).toBe('Revoke failed')
  })

  it('uses the embedded Privy EOA even when a Privy smart wallet entry appears first', async () => {
    vi.resetModules()

    const capturedAjnaCardProps: Array<Record<string, unknown>> = []

    vi.doMock('@tanstack/react-query', () => ({
      useQuery: vi.fn((options: { queryKey: unknown[] }) => {
        const queryKey = Array.isArray(options.queryKey) ? options.queryKey : []

        if (queryKey[0] === 'admin' && queryKey[1] === 'waitlist-me') {
          return { data: { cswAddress: CANONICAL_CSW_ADDRESS }, isLoading: false, error: null, isError: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'agent') {
          return { data: null, isLoading: false, error: null, isError: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'serverWallet') {
          return { data: null, isLoading: false, error: null, isError: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'isOwner') {
          return { data: false, isLoading: false, error: null, isError: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'ajna-automation') {
          return { data: null, isLoading: false, error: null, isError: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'farcaster') {
          return { data: null, isLoading: false, error: null, isError: false }
        }

        return { data: null, isLoading: false, error: null, isError: false }
      }),
      useMutation: vi.fn(() => ({
        data: null,
        error: null,
        isPending: false,
        isSuccess: false,
        isError: false,
        variables: undefined,
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      })),
      useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn(),
        setQueryData: vi.fn(),
      })),
    }))
    vi.doMock('@privy-io/react-auth', () => ({
      useWallets: () => ({
        wallets: [
          { address: PRIVY_SMART_WALLET_ADDRESS, id: PRIVY_SMART_WALLET_ID, walletClientType: 'privy-smart-wallet' },
          { address: EMBEDDED_EOA_ADDRESS, id: PRIVY_WALLET_ID, walletClientType: 'privy' },
        ],
      }),
    }))
    vi.doMock('wagmi', () => ({
      useAccount: () => ({ address: CREATOR_ADDRESS }),
      usePublicClient: () => null,
      useWalletClient: () => ({ data: null }),
    }))
    vi.doMock('@/hooks/useSiweAuth', () => ({
      useSiweAuth: () => ({ authAddress: CREATOR_ADDRESS }),
    }))
    vi.doMock('@/hooks/useDeploymentTracker', () => ({
      getDeploymentsForOwner: () => [],
    }))
    vi.doMock('@/lib/zora/referrals', () => ({
      buildZoraHandoffUrl: () => 'https://zora.co/handoff',
    }))
    vi.doMock('@/components/DeploymentSuccess', () => ({
      AjnaAutomationOptInCard: (props: Record<string, unknown>) => {
        capturedAjnaCardProps.push(props)
        return React.createElement('div', { 'data-testid': 'ajna-automation-card' })
      },
    }))

    const { AdminAgentSetup } = await import('./AdminAgentSetup')
    renderToStaticMarkup(React.createElement(AdminAgentSetup))

    expect(capturedAjnaCardProps).toHaveLength(1)
    expect(capturedAjnaCardProps[0]?.embeddedEoaAddress).toBe(EMBEDDED_EOA_ADDRESS)
    expect(capturedAjnaCardProps[0]?.privyWalletId).toBe(PRIVY_WALLET_ID)
    expect(capturedAjnaCardProps[0]?.embeddedEoaAddress).not.toBe(PRIVY_SMART_WALLET_ADDRESS)
    expect(capturedAjnaCardProps[0]?.privyWalletId).not.toBe(PRIVY_SMART_WALLET_ID)
  })

  it('shared embedded-wallet picker rejects smart-wallet-like entries before the embedded EOA', async () => {
    const { pickPrivyEmbeddedEoaWallet } = await import('./AdminAgentSetup')
    expect(typeof pickPrivyEmbeddedEoaWallet).toBe('function')

    const pickedWallet = pickPrivyEmbeddedEoaWallet(
      [
        {
          address: PRIVY_SMART_WALLET_ADDRESS,
          id: PRIVY_SMART_WALLET_ID,
          walletClientType: 'privy-smart-wallet',
        },
        {
          address: EMBEDDED_EOA_ADDRESS,
          id: PRIVY_WALLET_ID,
          walletClientType: 'privy',
        },
      ],
      CANONICAL_CSW_ADDRESS,
    )

    expect(pickedWallet?.address).toBe(EMBEDDED_EOA_ADDRESS)
    expect(pickedWallet?.id).toBe(PRIVY_WALLET_ID)
  })

  it('hydrates Ajna status for already-launched vaults using the canonical CSW deployment record', async () => {
    vi.resetModules()

    const capturedAjnaCardProps: Array<Record<string, unknown>> = []
    const getDeploymentsForOwner = vi.fn((owner: string) => {
      if (owner.toLowerCase() !== CANONICAL_CSW_ADDRESS.toLowerCase()) return []
      return [
        {
          creatorToken: CREATOR_TOKEN_ADDRESS,
          owner: CANONICAL_CSW_ADDRESS,
          version: 'v1.4.3',
          deployedAt: Date.now(),
          contracts: {
            vault: VAULT_ADDRESS,
            wrapper: WRAPPER_ADDRESS,
            shareOFT: SHARE_OFT_ADDRESS,
          },
        },
      ]
    })
    const queryKeys: unknown[][] = []
    const enabledAjnaStatus = {
      vaultAddress: VAULT_ADDRESS,
      automationEnabled: true,
      automationScope: 'ajna_min_bucket_only',
      canonicalCswAddress: CANONICAL_CSW_ADDRESS,
      embeddedEoaAddress: EMBEDDED_EOA_ADDRESS,
      privyWalletId: PRIVY_WALLET_ID,
      lastOwnerCheckAt: '2026-03-10T00:00:00.000Z',
      revokedAt: null,
      updatedAt: '2026-03-10T00:00:00.000Z',
    }

    vi.doMock('@tanstack/react-query', () => ({
      useQuery: vi.fn((options: { queryKey: unknown[] }) => {
        const queryKey = Array.isArray(options.queryKey) ? options.queryKey : []
        queryKeys.push(queryKey)

        if (queryKey[0] === 'admin' && queryKey[1] === 'waitlist-me') {
          return { data: { cswAddress: CANONICAL_CSW_ADDRESS }, isLoading: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'agent') {
          return { data: null, isLoading: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'serverWallet') {
          return { data: null, isLoading: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'isOwner') {
          return { data: false, isLoading: false }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'ajna-automation') {
          return {
            data: queryKey[2] === VAULT_ADDRESS.toLowerCase() ? enabledAjnaStatus : null,
            isLoading: false,
          }
        }
        if (queryKey[0] === 'admin' && queryKey[1] === 'farcaster') {
          return { data: null, isLoading: false }
        }

        return { data: null, isLoading: false }
      }),
      useMutation: vi.fn(() => ({
        data: null,
        error: null,
        isPending: false,
        isSuccess: false,
        isError: false,
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      })),
      useQueryClient: vi.fn(() => ({
        invalidateQueries: vi.fn(),
      })),
    }))
    vi.doMock('@privy-io/react-auth', () => ({
      useWallets: () => ({
        wallets: [{ address: EMBEDDED_EOA_ADDRESS, id: PRIVY_WALLET_ID, walletClientType: 'privy' }],
      }),
    }))
    vi.doMock('wagmi', () => ({
      useAccount: () => ({ address: CREATOR_ADDRESS }),
      usePublicClient: () => null,
      useWalletClient: () => ({ data: null }),
    }))
    vi.doMock('@/hooks/useSiweAuth', () => ({
      useSiweAuth: () => ({ authAddress: CREATOR_ADDRESS }),
    }))
    vi.doMock('@/hooks/useDeploymentTracker', () => ({
      getDeploymentsForOwner,
    }))
    vi.doMock('@/lib/zora/referrals', () => ({
      buildZoraHandoffUrl: () => 'https://zora.co/handoff',
    }))
    vi.doMock('@/components/DeploymentSuccess', () => ({
      AjnaAutomationOptInCard: (props: Record<string, unknown>) => {
        capturedAjnaCardProps.push(props)
        return React.createElement('div', {
          'data-testid': 'ajna-automation-card',
          'data-vault-address': String(props.vaultAddress ?? ''),
          'data-status-enabled': String(
            (props.status as { automationEnabled?: boolean } | null | undefined)?.automationEnabled ?? false,
          ),
        })
      },
    }))

    const { AdminAgentSetup } = await import('./AdminAgentSetup')
    const html = renderToStaticMarkup(React.createElement(AdminAgentSetup))

    expect(getDeploymentsForOwner).toHaveBeenCalledWith(CANONICAL_CSW_ADDRESS)
    expect(getDeploymentsForOwner).not.toHaveBeenCalledWith(CREATOR_ADDRESS)
    expect(capturedAjnaCardProps).toHaveLength(1)
    expect(capturedAjnaCardProps[0]?.vaultAddress).toBe(VAULT_ADDRESS)
    expect(
      (capturedAjnaCardProps[0]?.status as { automationEnabled?: boolean } | null | undefined)?.automationEnabled,
    ).toBe(true)
    expect(queryKeys).toContainEqual(['admin', 'ajna-automation', VAULT_ADDRESS.toLowerCase()])
    expect(html).toContain(`data-vault-address="${VAULT_ADDRESS}"`)
    expect(html).toContain('data-status-enabled="true"')
  })
})
