#!/usr/bin/env node
/**
 * Reproduce the May 5 Relay two-leg addOwner flow for the Privy embedded EOA.
 *
 * Modes:
 *   --mode self-auth   Quote with CSW as Relay user (Base App deposit pattern)
 *   --mode eoa-funder  Quote with an existing CSW EOA owner as funder (+ optional --execute)
 *
 * Example (quote only, CSW self-auth like May 5):
 *   pnpm -C frontend exec tsx scripts/relay-add-embedded-owner.ts --mode self-auth
 *
 * Example (quote + execute via existing EOA owner key):
 *   pnpm -C frontend exec tsx --env-file=.env scripts/relay-add-embedded-owner.ts \\
 *     --mode eoa-funder --funder 0x5e1a0afa913ad95aa3762b18ea9add73d31313cf --execute
 */

import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

import { buildOwnerMutationRelayFlow } from '../server/_lib/relay/buildOwnerMutationRelayFlow.js'
import { prepareAddOwnerTx } from '../server/_lib/wallet/coinbaseSmartWalletOwner.js'
import {
  ADD_OWNER_ADDRESS_SELECTOR,
  CSW_OWNER_READ_ABI,
  EXECUTE_WITHOUT_CHAIN_ID_SELECTOR,
  RELAY_MULTICALL_SELECTOR,
} from '../src/lib/wallet/cswOwnerAbi.js'
import {
  extractRelayExecutionTxHash,
  pollRelayStatusEndpoint,
  resolveRelayStatusRequestId,
} from '../src/lib/removeOwner/removeOwnerHelpers.js'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const DEFAULT_CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'
const DEFAULT_EMBEDDED = '0x1b77A85C5dCf6302FF60265F615F99030b5Bc475'
const DEFAULT_RPC = process.env.BASE_RPC_URL?.trim() || 'https://mainnet.base.org'

function usage(): void {
  process.stdout.write(`Usage:
  pnpm -C frontend exec tsx scripts/relay-add-embedded-owner.ts [options]

Options:
  --mode self-auth|eoa-funder     Relay funder lane (default: self-auth)
  --csw <address>                 Canonical CSW (default probe ${DEFAULT_CSW})
  --embedded-eoa <address>        Privy embedded EOA to add (default ${DEFAULT_EMBEDDED})
  --funder <address>              EOA funder for eoa-funder mode
  --execute                       Submit Relay deposit tx (eoa-funder only; needs key)
  --signer-private-key <hex>      Funder private key (default PRIVATE_KEY / SIGNER_PRIVATE_KEY)
  --rpc <url>                     Base RPC (default BASE_RPC_URL)
  --check-only                    Skip Relay quote; only print on-chain preflight
`)
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

function getArg(name: string, fallback = ''): string {
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return fallback
  return String(next).trim()
}

function requireAddress(label: string, value: string): Address {
  if (!isAddress(value)) throw new Error(`Invalid ${label}: ${value}`)
  return getAddress(value)
}

async function main(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    usage()
    return
  }

  const mode = getArg('--mode', 'self-auth')
  if (mode !== 'self-auth' && mode !== 'eoa-funder') {
    throw new Error('--mode must be self-auth or eoa-funder')
  }

  const csw = requireAddress('csw', getArg('--csw', DEFAULT_CSW))
  const embedded = requireAddress('embedded-eoa', getArg('--embedded-eoa', DEFAULT_EMBEDDED))
  const rpc = getArg('--rpc', DEFAULT_RPC)
  const funderArg = getArg('--funder', '0x5e1a0afa913ad95aa3762b18ea9add73d31313cf')
  const funder = mode === 'self-auth' ? csw : requireAddress('funder', funderArg)

  const publicClient = createPublicClient({ chain: base, transport: http(rpc) })

  const alreadyOwner = await publicClient.readContract({
    address: csw,
    abi: CSW_OWNER_READ_ABI,
    functionName: 'isOwnerAddress',
    args: [embedded],
  })
  const nextOwnerIndex = await publicClient.readContract({
    address: csw,
    abi: CSW_OWNER_READ_ABI,
    functionName: 'nextOwnerIndex',
  })

  const txRequest = prepareAddOwnerTx(csw, embedded)
  if (txRequest.data.slice(0, 10).toLowerCase() !== ADD_OWNER_ADDRESS_SELECTOR) {
    throw new Error('Prepared calldata is not addOwnerAddress')
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        preflight: {
          csw,
          embeddedEoa: embedded,
          alreadyOwner,
          nextOwnerIndex: nextOwnerIndex.toString(),
          mutationSelector: txRequest.data.slice(0, 10),
          mutationCalldata: txRequest.data,
        },
      },
      null,
      2,
    )}\n`,
  )

  if (alreadyOwner) {
    process.stdout.write('[relay-add-owner] Embedded EOA is already an owner — nothing to do.\n')
    return
  }

  if (hasFlag('--check-only')) return

  try {
    await publicClient.call({
      account: csw,
      to: csw,
      data: txRequest.data,
    })
    process.stdout.write('[relay-add-owner] mutation simulation=ok\n')
  } catch (simError: unknown) {
    const message = simError instanceof Error ? simError.message : String(simError)
    throw new Error(`Mutation simulation failed: ${message}`)
  }

  const relayQuote = await buildOwnerMutationRelayFlow({
    publicClient,
    cswAddress: csw,
    relayQuoteUser: funder,
    mutationCalldata: txRequest.data,
    relayQuoteOutputWeiEnvKey: 'RELAY_ADD_OWNER_QUOTE_OUTPUT_WEI',
  })

  if (!relayQuote.ok) {
    throw new Error(`Relay quote failed: ${relayQuote.error}`)
  }

  const relay = relayQuote.relay
  process.stdout.write(
    `${JSON.stringify(
      {
        relay: {
          mode,
          funder,
          requestId: relay.requestId,
          orderId: relay.orderId,
          userCall: relay.userCall,
          feeUsd: relay.feeUsd,
          paymentDetails: relay.paymentDetails,
        },
      },
      null,
      2,
    )}\n`,
  )

  if (mode === 'self-auth') {
    process.stdout.write(
      `[relay-add-owner] Self-auth lane (May 5 pattern): open Base App with CSW connected, then submit wallet_sendCalls with the quoted userCall above, or use /add-owner in a CSW self-auth browser session.\n`,
    )
    return
  }

  if (!hasFlag('--execute')) {
    process.stdout.write(
      `[relay-add-owner] Quote ready. Re-run with --execute and --signer-private-key for funder ${funder} to submit the deposit tx.\n`,
    )
    return
  }

  const pkRaw = getArg('--signer-private-key', process.env.SIGNER_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? '')
  if (!/^0x[0-9a-fA-F]{64}$/.test(pkRaw)) {
    throw new Error('Missing --signer-private-key (or PRIVATE_KEY) for --execute')
  }

  const account = privateKeyToAccount(pkRaw as Hex)
  if (account.address.toLowerCase() !== funder.toLowerCase()) {
    throw new Error(`Signer ${account.address} does not match --funder ${funder}`)
  }

  const funderIsOwner = await publicClient.readContract({
    address: csw,
    abi: CSW_OWNER_READ_ABI,
    functionName: 'isOwnerAddress',
    args: [account.address],
  })
  if (!funderIsOwner) {
    throw new Error(`Funder ${account.address} is not an on-chain CSW owner`)
  }

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(rpc),
  })

  const depositValue = BigInt(relay.userCall.value)
  process.stdout.write(
    `[relay-add-owner] Submitting Relay deposit tx to ${relay.userCall.to} value=${depositValue.toString()} wei\n`,
  )

  const depositTxHash = await walletClient.sendTransaction({
    account,
    chain: base,
    to: relay.userCall.to,
    data: relay.userCall.data,
    value: depositValue,
  })
  process.stdout.write(`[relay-add-owner] deposit_tx=${depositTxHash}\n`)

  const statusRequestId = resolveRelayStatusRequestId(relay)
  const statusEndpoint = `https://api.relay.link/intents/status/v3?requestId=${encodeURIComponent(statusRequestId)}`
  process.stdout.write(`[relay-add-owner] status_request_id=${statusRequestId}\n`)
  const verifyOwnerInstalled = async (): Promise<boolean> =>
    (await publicClient.readContract({
      address: csw,
      abi: CSW_OWNER_READ_ABI,
      functionName: 'isOwnerAddress',
      args: [embedded],
    })) as boolean

  let status = await pollRelayStatusEndpoint({
    statusEndpoint,
    timeoutMs: 120_000,
    intervalMs: 2_000,
    shouldShortCircuitSuccess: verifyOwnerInstalled,
    onTick: (message) => process.stdout.write(`[relay-add-owner] status.${message}\n`),
  })

  if (!status.done || !status.success) {
    if (await verifyOwnerInstalled()) {
      process.stdout.write('[relay-add-owner] status=skipped_on_chain_verified\n')
    } else {
      throw new Error(`Relay status incomplete: ${JSON.stringify(status.raw)}`)
    }
  }

  const fillTxHash = status.txHash ?? extractRelayExecutionTxHash(status.raw) ?? null
  if (!fillTxHash) {
    throw new Error('Relay reported success but no fill tx hash was returned')
  }

  process.stdout.write(`[relay-add-owner] fill_tx=${fillTxHash}\n`)

  const fillTx = await publicClient.getTransaction({ hash: fillTxHash })
  const fillInput = String(fillTx.input ?? '').toLowerCase()
  if (!fillInput.startsWith(RELAY_MULTICALL_SELECTOR)) {
    throw new Error(`Fill tx selector mismatch (expected ${RELAY_MULTICALL_SELECTOR})`)
  }
  if (!fillInput.includes(EXECUTE_WITHOUT_CHAIN_ID_SELECTOR.slice(2))) {
    throw new Error('Fill tx missing executeWithoutChainIdValidation wrapper')
  }
  if (!fillInput.includes(ADD_OWNER_ADDRESS_SELECTOR.slice(2))) {
    throw new Error('Fill tx missing addOwnerAddress selector')
  }
  if (!fillInput.includes(embedded.slice(2).toLowerCase())) {
    throw new Error('Fill tx missing embedded EOA argument')
  }

  const ownerInstalled = await publicClient.readContract({
    address: csw,
    abi: CSW_OWNER_READ_ABI,
    functionName: 'isOwnerAddress',
    args: [embedded],
  })

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: ownerInstalled,
        depositTxHash,
        fillTxHash,
        embeddedEoa: embedded,
        isOwnerAddress: ownerInstalled,
        nextOwnerIndex: (
          await publicClient.readContract({
            address: csw,
            abi: CSW_OWNER_READ_ABI,
            functionName: 'nextOwnerIndex',
          })
        ).toString(),
      },
      null,
      2,
    )}\n`,
  )

  if (!ownerInstalled) {
    process.exit(1)
  }
}

main().catch((error) => {
  process.stderr.write(
    `[relay-add-owner] ${error instanceof Error ? error.message : String(error)}\n`,
  )
  process.exit(1)
})
