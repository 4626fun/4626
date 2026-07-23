/**
 * Create one pre-generated Token-2022 mint with zero-fee TransferFeeConfig and
 * the canonical creator-share TransferHook.
 *
 * Dry-run (default):
 *   SOLANA_CLUSTER=mainnet-beta \
 *   SOLANA_RPC_URL=https://... \
 *   SOLANA_B2_MINT_KEYPAIR_PATH=/secure/path/akita-b2-mint.json \
 *   pnpm -C kpr solana:create-token-2022-mint
 *
 * Mutation (requires immediate explicit approval):
 *   ... pnpm -C kpr solana:create-token-2022-mint -- --execute approve
 *
 * Required env:
 *   SOLANA_CLUSTER                 devnet or mainnet-beta
 *   SOLANA_RPC_URL                 explicit RPC for the selected cluster
 *   SOLANA_KEEPER_KEYPAIR(S)       payer + initial mint/config authority
 *   SOLANA_B2_MINT_KEYPAIR_PATH    retained mint account keypair JSON/base58
 *
 * This script creates only the mint account. It does not initialize hook PDAs,
 * create an OFT Store, transfer mint authority, create a Meteora pool, or seed
 * liquidity.
 */

import { readFileSync } from 'node:fs'

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  getMint,
  getMintLen,
  getTransferFeeConfig,
  getTransferHook,
} from '@solana/spl-token'

import { CHAINS } from '../../../config.js'
import { loadKeeperKeypair, parseKeypair } from '../../../utils/solana.js'

const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
const EXECUTE_FEE_BUFFER_LAMPORTS = 20_000n

type Cluster = 'devnet' | 'mainnet-beta'

function requireEnv(name: string): string {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error(`missing_required_env:${name}`)
  return value
}

function readCluster(): Cluster {
  const raw = requireEnv('SOLANA_CLUSTER').toLowerCase()
  if (raw !== 'devnet' && raw !== 'mainnet-beta') {
    throw new Error('SOLANA_CLUSTER_must_be_devnet_or_mainnet-beta')
  }
  return raw
}

function readExecute(): boolean {
  const index = process.argv.indexOf('--execute')
  if (index === -1) return false
  if (process.argv[index + 1] !== 'approve') {
    throw new Error('mutation_requires_exact_--execute_approve')
  }
  return true
}

function loadMintKeypair() {
  const path = requireEnv('SOLANA_B2_MINT_KEYPAIR_PATH')
  let raw: string
  try {
    raw = readFileSync(path, 'utf8').trim()
  } catch {
    throw new Error(`unable_to_read_SOLANA_B2_MINT_KEYPAIR_PATH:${path}`)
  }
  if (!raw) throw new Error('SOLANA_B2_MINT_KEYPAIR_PATH_empty')
  return { path, keypair: parseKeypair(raw) }
}

async function verifyExistingMint(params: {
  connection: Connection
  mint: PublicKey
  payer: PublicKey
  hookProgram: PublicKey
  decimals: number
}): Promise<void> {
  const state = await getMint(
    params.connection,
    params.mint,
    'finalized',
    TOKEN_2022_PROGRAM_ID,
  )
  const hook = getTransferHook(state)
  const fees = getTransferFeeConfig(state)
  if (state.decimals !== params.decimals) throw new Error('existing_mint_decimals_mismatch')
  if (!state.mintAuthority?.equals(params.payer)) throw new Error('existing_mint_authority_mismatch')
  if (!hook?.programId.equals(params.hookProgram)) throw new Error('existing_mint_transfer_hook_mismatch')
  if (
    !fees ||
    fees.olderTransferFee.transferFeeBasisPoints !== 0 ||
    fees.newerTransferFee.transferFeeBasisPoints !== 0
  ) {
    throw new Error('existing_mint_transfer_fee_not_zero')
  }
}

async function main(): Promise<void> {
  const execute = readExecute()
  const cluster = readCluster()
  const rpcUrl = requireEnv('SOLANA_RPC_URL')
  const { path: mintKeypairPath, keypair: mintKeypair } = loadMintKeypair()
  const payer = loadKeeperKeypair()
  const connection = new Connection(rpcUrl, 'finalized')

  const expectedGenesis = cluster === 'mainnet-beta' ? MAINNET_GENESIS_HASH : DEVNET_GENESIS_HASH
  const genesis = await connection.getGenesisHash()
  if (genesis !== expectedGenesis) {
    throw new Error(`solana_cluster_genesis_mismatch:${cluster}:${genesis}`)
  }

  const hookProgram = new PublicKey(
    String(process.env.SOLANA_PROGRAM_ID ?? CHAINS.solana.programId).trim(),
  )
  const hookAccount = await connection.getAccountInfo(hookProgram, 'finalized')
  if (!hookAccount?.executable) throw new Error('creator_share_hook_program_not_executable')

  const decimals = Number(process.env.TOKEN_DECIMALS ?? '9')
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error('TOKEN_DECIMALS_must_be_integer_0_to_9')
  }
  const feeBps = Number(process.env.TRANSFER_FEE_BPS ?? '0')
  const maxFee = BigInt(process.env.MAX_FEE ?? '0')
  if (feeBps !== 0 || maxFee !== 0n) {
    throw new Error('B2_OVault_mint_requires_zero_transfer_fee_and_zero_max_fee')
  }
  const adapterMode = String(process.env.SOLANA_OVAULT_ADAPTER_MODE ?? 'regular-oft')
    .trim()
    .toLowerCase()
  if (adapterMode !== 'regular-oft') {
    throw new Error('TransferHook_mints_require_regular-oft_mode')
  }

  const mintAccount = await connection.getAccountInfo(mintKeypair.publicKey, 'finalized')
  if (mintAccount) {
    if (!mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      throw new Error('existing_mint_account_wrong_owner')
    }
    await verifyExistingMint({
      connection,
      mint: mintKeypair.publicKey,
      payer: payer.publicKey,
      hookProgram,
      decimals,
    })
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          mode: 'already_verified',
          cluster,
          payer: payer.publicKey.toBase58(),
          mint: mintKeypair.publicKey.toBase58(),
          mintKeypairPath,
          hookProgram: hookProgram.toBase58(),
          transactionSubmitted: false,
        },
        null,
        2,
      )}\n`,
    )
    return
  }

  const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook]
  const mintLen = getMintLen(extensions)
  const rentLamports = BigInt(await connection.getMinimumBalanceForRentExemption(mintLen))
  const payerBalanceLamports = BigInt(await connection.getBalance(payer.publicKey, 'finalized'))
  const requiredLamports = rentLamports + EXECUTE_FEE_BUFFER_LAMPORTS
  if (payerBalanceLamports < requiredLamports) {
    throw new Error(`payer_balance_insufficient:${payerBalanceLamports}:${requiredLamports}`)
  }

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports: Number(rentLamports),
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      payer.publicKey,
      payer.publicKey,
      0,
      0n,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeTransferHookInstruction(
      mintKeypair.publicKey,
      payer.publicKey,
      hookProgram,
      TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID,
    ),
  )

  const summary = {
    ok: true,
    mode: execute ? 'execute' : 'dry_run',
    cluster,
    payer: payer.publicKey.toBase58(),
    payerBalanceLamports: payerBalanceLamports.toString(),
    mint: mintKeypair.publicKey.toBase58(),
    mintKeypairPath,
    hookProgram: hookProgram.toBase58(),
    tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    decimals,
    mintAccountBytes: mintLen,
    rentLamports: rentLamports.toString(),
    feeBufferLamports: EXECUTE_FEE_BUFFER_LAMPORTS.toString(),
    adapterMode,
    transactionSubmitted: false,
  }

  if (!execute) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    return
  }

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, mintKeypair],
    { commitment: 'finalized', preflightCommitment: 'confirmed' },
  )
  await verifyExistingMint({
    connection,
    mint: mintKeypair.publicKey,
    payer: payer.publicKey,
    hookProgram,
    decimals,
  })
  process.stdout.write(
    `${JSON.stringify(
      { ...summary, mode: 'executed', transactionSubmitted: true, signature },
      null,
      2,
    )}\n`,
  )
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
