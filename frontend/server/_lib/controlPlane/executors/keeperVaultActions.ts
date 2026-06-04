import { createPublicClient, createWalletClient, http, type Abi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

const VAULT_TEND_ABI = [
  { type: 'function', name: 'tend', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const

const VAULT_REPORT_ABI = [
  {
    type: 'function',
    name: 'report',
    inputs: [],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

export class KeeperVaultActionError extends Error {
  code: string
  retryable: boolean

  constructor(message: string, params?: { code?: string; retryable?: boolean }) {
    super(message)
    this.code = params?.code ?? 'keeper_vault_action_failed'
    this.retryable = params?.retryable ?? true
  }
}

function collectErrorText(error: unknown): string {
  const visited = new Set<unknown>()
  const stack: unknown[] = [error]
  const text: string[] = []
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || visited.has(current)) continue
    visited.add(current)
    if (typeof current === 'string') {
      text.push(current)
      continue
    }
    if (current instanceof Error) {
      text.push(current.message)
      stack.push((current as Error & { cause?: unknown }).cause)
      continue
    }
    if (typeof current === 'object') {
      const candidate = current as { message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown }
      text.push(String(candidate.message ?? ''))
      text.push(String(candidate.shortMessage ?? ''))
      text.push(String(candidate.details ?? ''))
      stack.push(candidate.cause)
    }
  }
  return text.join(' ').toLowerCase()
}

function isKnownRebalanceGasRejection(error: unknown): boolean {
  const message = collectErrorText(error)
  return (
    message.includes('gas required exceeds allowance (0)') ||
    message.includes('insufficient funds for gas') ||
    message.includes('estimate gas execution reverted') ||
    message.includes('insufficient funds') ||
    message.includes('intrinsic gas too low')
  )
}

function isKnownRebalanceAuthorizationRejection(error: unknown): boolean {
  const message = collectErrorText(error)
  return message.includes('0x82b42900') || message.includes('unauthorized()')
}

function isKnownRebalanceNoStrategiesRejection(error: unknown): boolean {
  const message = collectErrorText(error)
  return message.includes('0x56de3055') || message.includes('nostrategies()')
}

function isAddressEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function getKeeperClients() {
  const keeperPk = process.env.KPR_PRIVATE_KEY
  if (!keeperPk) {
    throw new KeeperVaultActionError('KPR_PRIVATE_KEY not configured', { code: 'keeper_not_configured', retryable: false })
  }
  const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  const account = privateKeyToAccount(keeperPk as `0x${string}`)
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 30_000 }) }) as any
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl, { timeout: 30_000 }) })
  return { account, publicClient, walletClient }
}

function normalizeVaultAddress(value: string): `0x${string}` {
  const normalized = String(value || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new KeeperVaultActionError('Invalid vaultAddress', { code: 'invalid_vault_address', retryable: false })
  }
  return normalized as `0x${string}`
}

const CCA_SWEEP_ABI = [
  { type: 'function', name: 'sweepCurrency', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const

export async function executeVaultSweep(params: {
  ccaStrategyAddress: string
}): Promise<{ txHash: string; status: string }> {
  const strategy = normalizeVaultAddress(params.ccaStrategyAddress)
  const { account, publicClient, walletClient } = getKeeperClients()
  const txHash = await walletClient.writeContract({
    address: strategy,
    abi: CCA_SWEEP_ABI as unknown as Abi,
    functionName: 'sweepCurrency',
    chain: base,
    account,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new KeeperVaultActionError('sweepCurrency() reverted', { code: 'sweep_reverted', retryable: false })
  }
  return { txHash, status: 'success' }
}

export async function executeVaultTend(vaultAddress: string): Promise<{ txHash: string; status: string }> {
  const address = normalizeVaultAddress(vaultAddress)
  const { account, publicClient, walletClient } = getKeeperClients()
  const txHash = await walletClient.writeContract({
    address,
    abi: VAULT_TEND_ABI as unknown as Abi,
    functionName: 'tend',
    chain: base,
    account,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new KeeperVaultActionError('tend() reverted', { code: 'tend_reverted', retryable: false })
  }
  return { txHash, status: 'success' }
}

const VAULT_REBALANCE_ABI = [
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'NoStrategies', inputs: [] },
  { type: 'error', name: 'InvalidWeight', inputs: [] },
  {
    type: 'function',
    name: 'keeper',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'management',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalStrategyWeight',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rebalanceStrategies',
    inputs: [{ name: 'minDeviationBps', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

export async function executeVaultRebalanceStrategies(
  vaultAddress: string,
  minDeviationBps: bigint,
): Promise<{ txHash: string; status: string }> {
  const address = normalizeVaultAddress(vaultAddress)
  const { account, publicClient, walletClient } = getKeeperClients()
  try {
    const [keeperAddress, managementAddress, ownerAddress, totalStrategyWeight] = await Promise.all([
      publicClient.readContract({
        address,
        abi: VAULT_REBALANCE_ABI as unknown as Abi,
        functionName: 'keeper',
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address,
        abi: VAULT_REBALANCE_ABI as unknown as Abi,
        functionName: 'management',
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address,
        abi: VAULT_REBALANCE_ABI as unknown as Abi,
        functionName: 'owner',
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address,
        abi: VAULT_REBALANCE_ABI as unknown as Abi,
        functionName: 'totalStrategyWeight',
      }) as Promise<bigint>,
    ])

    if (totalStrategyWeight <= 0n) {
      throw new KeeperVaultActionError('rebalanceStrategies skipped: no active strategy weight', {
        code: 'rebalance_strategies_no_strategies',
        retryable: false,
      })
    }

    const caller = account.address.toLowerCase()
    const authorized = [keeperAddress, managementAddress, ownerAddress].some((candidate) =>
      isAddressEqual(candidate, caller),
    )
    if (!authorized) {
      throw new KeeperVaultActionError('rebalanceStrategies skipped: keeper wallet is not authorized for vault', {
        code: 'rebalance_strategies_unauthorized',
        retryable: false,
      })
    }
  } catch (error) {
    if (error instanceof KeeperVaultActionError) throw error
  }

  try {
    const txHash = await walletClient.writeContract({
      address,
      abi: VAULT_REBALANCE_ABI as unknown as Abi,
      functionName: 'rebalanceStrategies',
      args: [minDeviationBps],
      chain: base,
      account,
    })
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
    if (receipt.status !== 'success') {
      throw new KeeperVaultActionError('rebalanceStrategies() reverted', {
        code: 'rebalance_strategies_reverted',
        retryable: false,
      })
    }
    return { txHash, status: 'success' }
  } catch (error) {
    if (error instanceof KeeperVaultActionError) throw error
    if (isKnownRebalanceAuthorizationRejection(error)) {
      throw new KeeperVaultActionError('rebalanceStrategies() unauthorized', {
        code: 'rebalance_strategies_unauthorized',
        retryable: false,
      })
    }
    if (isKnownRebalanceNoStrategiesRejection(error)) {
      throw new KeeperVaultActionError('rebalanceStrategies() skipped: no active strategies', {
        code: 'rebalance_strategies_no_strategies',
        retryable: false,
      })
    }
    if (isKnownRebalanceGasRejection(error)) {
      throw new KeeperVaultActionError('rebalanceStrategies() gas rejected', {
        code: 'rebalance_strategies_gas_rejected',
        retryable: false,
      })
    }
    throw error
  }
}

export async function executeVaultReport(vaultAddress: string): Promise<{ txHash: string; status: string }> {
  const address = normalizeVaultAddress(vaultAddress)
  const { account, publicClient, walletClient } = getKeeperClients()
  const txHash = await walletClient.writeContract({
    address,
    abi: VAULT_REPORT_ABI as unknown as Abi,
    functionName: 'report',
    chain: base,
    account,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 })
  if (receipt.status !== 'success') {
    throw new KeeperVaultActionError('report() reverted', { code: 'report_reverted', retryable: false })
  }
  return { txHash, status: 'success' }
}
