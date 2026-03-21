import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as web3 from '@solana/web3.js'

const {
  getBlockNumberMock,
  getLogsMock,
  alertInfoMock,
  alertWarningMock,
  alertCriticalMock,
  loadKeeperKeypairMock,
  sendAndConfirmTransactionMock,
} = vi.hoisted(() => ({
  getBlockNumberMock: vi.fn(),
  getLogsMock: vi.fn(),
  alertInfoMock: vi.fn(async () => {}),
  alertWarningMock: vi.fn(async () => {}),
  alertCriticalMock: vi.fn(async () => {}),
  loadKeeperKeypairMock: vi.fn(),
  sendAndConfirmTransactionMock: vi.fn(async () => 'solana-sig'),
}))

vi.mock('../utils/onchain.js', () => ({
  getPublicClient: () => ({
    getBlockNumber: getBlockNumberMock,
    getLogs: getLogsMock,
  }),
}))

vi.mock('../utils/alerts.js', () => ({
  alertInfo: alertInfoMock,
  alertWarning: alertWarningMock,
  alertCritical: alertCriticalMock,
}))

vi.mock('../utils/solana.js', () => ({
  loadKeeperKeypair: loadKeeperKeypairMock,
  sendConfirmedSolanaTransaction: sendAndConfirmTransactionMock,
}))

import { executeSolanaWinnerRelay } from '../actions/keepr-solana-winner-relay.action.js'

const ENV_KEYS = [
  'LOTTERY_MANAGER',
  'SOLANA_RPC_URL',
  'SOLANA_PROGRAM_ID',
  'SOLANA_KEEPER_KEYPAIR',
  'SOLANA_WINNER_RELAY_STATE_FILE',
  'SOLANA_CREATOR_COIN_TO_MINT_MAPPING',
  'SOLANA_TWIN_TO_PUBKEY_MAPPING',
  'SOLANA_CREATOR_COIN_TO_MINT_MAPPING_FILE',
  'SOLANA_TWIN_TO_PUBKEY_MAPPING_FILE',
] as const

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as Record<string, string | undefined>

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}

const EVENT_LOG = {
  args: {
    winner: '0x1111111111111111111111111111111111111111',
    creatorCoin: '0x2222222222222222222222222222222222222222',
    sharesPaid: 42n,
  },
  blockNumber: 150n,
  logIndex: 2,
}

describe('keepr solana winner relay', () => {
  let tempDir: string
  let keeperKeypairMock: web3.Keypair
  let mintPubkeyMock: string
  let winnerPubkeyMock: string

  beforeEach(async () => {
    vi.clearAllMocks()
    tempDir = await mkdtemp(join(tmpdir(), '4626-winner-relay-'))
    keeperKeypairMock = web3.Keypair.generate()
    mintPubkeyMock = web3.Keypair.generate().publicKey.toBase58()
    winnerPubkeyMock = web3.Keypair.generate().publicKey.toBase58()
    setEnv('LOTTERY_MANAGER', '0x3333333333333333333333333333333333333333')
    setEnv('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
    setEnv('SOLANA_PROGRAM_ID', 'EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU')
    setEnv('SOLANA_KEEPER_KEYPAIR', '[1,2,3]')
    setEnv('SOLANA_WINNER_RELAY_STATE_FILE', join(tempDir, 'winner-relay.json'))
    setEnv(
      'SOLANA_CREATOR_COIN_TO_MINT_MAPPING',
      `{"0x2222222222222222222222222222222222222222":"${mintPubkeyMock}"}`,
    )
    setEnv(
      'SOLANA_TWIN_TO_PUBKEY_MAPPING',
      `{"0x1111111111111111111111111111111111111111":"${winnerPubkeyMock}"}`,
    )
    setEnv('SOLANA_CREATOR_COIN_TO_MINT_MAPPING_FILE', undefined)
    setEnv('SOLANA_TWIN_TO_PUBKEY_MAPPING_FILE', undefined)

    getBlockNumberMock.mockResolvedValue(200n)
    getLogsMock.mockResolvedValue([EVENT_LOG])
    loadKeeperKeypairMock.mockReturnValue(keeperKeypairMock)
  })

  afterEach(async () => {
    for (const key of ENV_KEYS) {
      setEnv(key, ORIGINAL_ENV[key])
    }
    await rm(tempDir, { recursive: true, force: true })
  })

  it('persists checkpoint progress and does not replay already-recorded events', async () => {
    const first = await executeSolanaWinnerRelay()
    expect(first.eventsProcessed).toBe(1)
    expect(first.winnersRecorded).toBe(1)
    expect(sendAndConfirmTransactionMock).toHaveBeenCalledTimes(1)

    const second = await executeSolanaWinnerRelay()
    expect(second.eventsProcessed).toBe(0)
    expect(second.winnersRecorded).toBe(0)
    expect(sendAndConfirmTransactionMock).toHaveBeenCalledTimes(1)
  })

  it('supports file-backed creator/twin mappings', async () => {
    const creatorMapFile = join(tempDir, 'creator-map.json')
    const twinMapFile = join(tempDir, 'twin-map.json')
    await writeFile(
      creatorMapFile,
      `{"0x2222222222222222222222222222222222222222":"${mintPubkeyMock}"}\n`,
      'utf8',
    )
    await writeFile(
      twinMapFile,
      `{"0x1111111111111111111111111111111111111111":"${winnerPubkeyMock}"}\n`,
      'utf8',
    )
    setEnv('SOLANA_CREATOR_COIN_TO_MINT_MAPPING', undefined)
    setEnv('SOLANA_TWIN_TO_PUBKEY_MAPPING', undefined)
    setEnv('SOLANA_CREATOR_COIN_TO_MINT_MAPPING_FILE', creatorMapFile)
    setEnv('SOLANA_TWIN_TO_PUBKEY_MAPPING_FILE', twinMapFile)

    const result = await executeSolanaWinnerRelay()
    expect(result.winnersRecorded).toBe(1)
    expect(sendAndConfirmTransactionMock).toHaveBeenCalledTimes(1)
  })
})
