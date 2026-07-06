#!/usr/bin/env tsx
/**
 * Wire grandfathered AKITA strategy automation to the hot protocol automation Safe.
 *
 * - Charm Alpha vault: `setManager(PROTOCOL_AUTOMATION_SAFE)` via current manager (treasury Safe)
 * - AjnaVaultAuth (when present): `transferAdmin` via current admin, then `acceptAdmin` via hot Safe
 *
 * Usage:
 *   pnpm -C frontend ops:wire-akita-hot-automation -- --dry-run
 *   pnpm -C frontend ops:wire-akita-hot-automation -- --execute
 */

import { createPublicClient, encodeFunctionData, getAddress, http, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'

import { AKITA_DEFAULTS } from '../../src/config/contracts.defaults.js'
import { scanVaultStrategyDetails } from '../../server/_lib/onchain/vaultStrategyOnchain.js'
import {
  executeViaProtocolAutomationSafe,
  executeViaProtocolTreasurySafe,
  resolveProtocolAutomationAddress,
  resolveProtocolTreasuryAddress,
} from '../../server/_lib/wallet/protocolTreasurySafe.js'

const CHARM_AUTH_ABI = [
  {
    type: 'function',
    name: 'manager',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'pendingManager',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'setManager',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nextManager', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'acceptManager',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const AJNA_AUTH_ABI = [
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'pendingAdmin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'transferAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nextAdmin', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'acceptAdmin',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

type PlannedStep =
  | {
      kind: 'charm_set_manager'
      charmVault: Address
      currentManager: Address
      nextManager: Address
    }
  | {
      kind: 'charm_accept_manager'
      charmVault: Address
      pendingManager: Address
      currentManager: Address
    }
  | {
      kind: 'ajna_transfer_admin'
      auth: Address
      currentAdmin: Address
      nextAdmin: Address
    }
  | {
      kind: 'ajna_accept_admin'
      auth: Address
      pendingAdmin: Address
    }

function parseArgs(): { dryRun: boolean; execute: boolean } {
  const execute = process.argv.includes('--execute')
  return { dryRun: process.argv.includes('--dry-run') || !execute, execute }
}

async function main(): Promise<void> {
  const args = parseArgs()
  const rpcUrl = (process.env.BASE_RPC_URL ?? process.env.VITE_BASE_RPC_URL ?? 'https://mainnet.base.org').trim()
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const vault = getAddress(AKITA_DEFAULTS.vault)
  const hotSafe = resolveProtocolAutomationAddress()
  if (!hotSafe) throw new Error('protocol_automation_safe_not_configured')

  const treasurySafe = resolveProtocolTreasuryAddress()
  const scans = await scanVaultStrategyDetails({ client: publicClient, vault })
  const steps: PlannedStep[] = []

  for (const scan of scans) {
    if (scan.charmVault) {
      const [currentManager, pendingManager] = await Promise.all([
        publicClient.readContract({
          address: scan.charmVault,
          abi: CHARM_AUTH_ABI,
          functionName: 'manager',
        }),
        publicClient
          .readContract({
            address: scan.charmVault,
            abi: CHARM_AUTH_ABI,
            functionName: 'pendingManager',
          })
          .catch(() => '0x0000000000000000000000000000000000000000' as Address),
      ])
      const managerAddr = getAddress(currentManager)
      const pendingAddr = getAddress(pendingManager)

      if (
        pendingAddr.toLowerCase() === hotSafe.toLowerCase() &&
        managerAddr.toLowerCase() !== hotSafe.toLowerCase()
      ) {
        steps.push({
          kind: 'charm_accept_manager',
          charmVault: scan.charmVault,
          pendingManager: pendingAddr,
          currentManager: managerAddr,
        })
      } else if (
        managerAddr.toLowerCase() !== hotSafe.toLowerCase() &&
        pendingAddr.toLowerCase() !== hotSafe.toLowerCase()
      ) {
        steps.push({
          kind: 'charm_set_manager',
          charmVault: scan.charmVault,
          currentManager: managerAddr,
          nextManager: hotSafe,
        })
      }
    }

    const auth = scan.ajna.auth
    if (auth) {
      const [currentAdmin, pendingAdmin] = await Promise.all([
        publicClient.readContract({ address: auth, abi: AJNA_AUTH_ABI, functionName: 'admin' }),
        publicClient.readContract({ address: auth, abi: AJNA_AUTH_ABI, functionName: 'pendingAdmin' }),
      ])
      const adminAddr = getAddress(currentAdmin)
      const pendingAddr = getAddress(pendingAdmin)

      if (adminAddr.toLowerCase() === hotSafe.toLowerCase()) {
        continue
      }

      if (
        pendingAddr.toLowerCase() === hotSafe.toLowerCase() &&
        adminAddr.toLowerCase() !== hotSafe.toLowerCase()
      ) {
        steps.push({
          kind: 'ajna_accept_admin',
          auth,
          pendingAdmin: pendingAddr,
        })
        continue
      }

      if (pendingAddr === '0x0000000000000000000000000000000000000000') {
        steps.push({
          kind: 'ajna_transfer_admin',
          auth,
          currentAdmin: adminAddr,
          nextAdmin: hotSafe,
        })
      }
    }
  }

  console.log('=== AKITA hot automation Safe wiring plan ===')
  console.log(`Vault:              ${vault}`)
  console.log(`Hot automation Safe:  ${hotSafe}`)
  console.log(`Treasury Safe:        ${treasurySafe}`)
  console.log(`Steps planned:        ${steps.length}`)

  for (const step of steps) {
    if (step.kind === 'charm_set_manager') {
      console.log(
        `- charm_set_manager vault=${step.charmVault} manager ${step.currentManager} -> pending ${step.nextManager}`,
      )
    } else if (step.kind === 'charm_accept_manager') {
      console.log(
        `- charm_accept_manager vault=${step.charmVault} pending ${step.pendingManager} (current manager ${step.currentManager})`,
      )
    } else if (step.kind === 'ajna_transfer_admin') {
      console.log(
        `- ajna_transfer_admin auth=${step.auth} admin ${step.currentAdmin} -> ${step.nextAdmin}`,
      )
    } else {
      console.log(`- ajna_accept_admin auth=${step.auth} pending=${step.pendingAdmin}`)
    }
  }

  if (steps.length === 0) {
    console.log('\nNothing to wire — AKITA already uses hot automation Safe where applicable.')
    return
  }

  if (args.dryRun) {
    console.log('\nDry run only. Re-run with --execute to broadcast.')
    return
  }

  for (const step of steps) {
    if (step.kind === 'charm_set_manager') {
      const data = encodeFunctionData({
        abi: CHARM_AUTH_ABI,
        functionName: 'setManager',
        args: [step.nextManager],
      }) as Hex

      const lane =
        step.currentManager.toLowerCase() === treasurySafe.toLowerCase()
          ? 'treasury_safe'
          : step.currentManager.toLowerCase() === hotSafe.toLowerCase()
            ? 'automation_safe'
            : null
      if (!lane) {
        throw new Error(`charm_manager_unsupported_lane:${step.currentManager}`)
      }

      const exec =
        lane === 'treasury_safe'
          ? await executeViaProtocolTreasurySafe({
              publicClient,
              rpcUrl,
              to: step.charmVault,
              data,
            })
          : await executeViaProtocolAutomationSafe({
              publicClient,
              rpcUrl,
              to: step.charmVault,
              data,
            })

      console.log(`\nCharm setManager tx: ${exec.txHash}`)
      console.log(`https://basescan.org/tx/${exec.txHash}`)
      continue
    }

    if (step.kind === 'charm_accept_manager') {
      const data = encodeFunctionData({
        abi: CHARM_AUTH_ABI,
        functionName: 'acceptManager',
        args: [],
      }) as Hex
      const exec = await executeViaProtocolAutomationSafe({
        publicClient,
        rpcUrl,
        to: step.charmVault,
        data,
      })
      console.log(`\nCharm acceptManager tx: ${exec.txHash}`)
      console.log(`https://basescan.org/tx/${exec.txHash}`)
      continue
    }

    if (step.kind === 'ajna_transfer_admin') {
      const data = encodeFunctionData({
        abi: AJNA_AUTH_ABI,
        functionName: 'transferAdmin',
        args: [step.nextAdmin],
      }) as Hex

      const lane = step.currentAdmin.toLowerCase() === treasurySafe.toLowerCase()
        ? 'treasury_safe'
        : step.currentAdmin.toLowerCase() === hotSafe.toLowerCase()
          ? 'automation_safe'
          : null
      if (!lane) {
        throw new Error(`ajna_admin_unsupported_lane:${step.currentAdmin}`)
      }

      const exec =
        lane === 'treasury_safe'
          ? await executeViaProtocolTreasurySafe({ publicClient, rpcUrl, to: step.auth, data })
          : await executeViaProtocolAutomationSafe({ publicClient, rpcUrl, to: step.auth, data })

      console.log(`\nAjna transferAdmin tx: ${exec.txHash}`)
      console.log(`https://basescan.org/tx/${exec.txHash}`)
      continue
    }

    const data = encodeFunctionData({
      abi: AJNA_AUTH_ABI,
      functionName: 'acceptAdmin',
      args: [],
    }) as Hex
    const exec = await executeViaProtocolAutomationSafe({
      publicClient,
      rpcUrl,
      to: step.auth,
      data,
    })
    console.log(`\nAjna acceptAdmin tx: ${exec.txHash}`)
    console.log(`https://basescan.org/tx/${exec.txHash}`)
  }

  console.log('\nAKITA hot automation wiring complete.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
