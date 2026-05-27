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
