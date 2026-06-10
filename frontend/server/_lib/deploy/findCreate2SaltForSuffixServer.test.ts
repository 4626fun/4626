import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getCreate2Address, keccak256, toHex, type Address, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import { MAX_UINT256 } from '../../../src/pages/deploy/deployVaultHelpers.js'
import { findCreate2SaltForSuffixOnServer } from './findCreate2SaltForSuffixServer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WASM_CANDIDATES = [
  path.resolve(__dirname, '../../../public/vanity/vanity_salt_grinder.wasm'),
  path.resolve(__dirname, '../../../src/lib/vanity/vanity_salt_grinder.wasm'),
]

function resolveWasmPath(): string | null {
  for (const candidate of WASM_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function findSaltTypescript(params: {
  create2Deployer: Address
  initCodeHash: Hex
  suffix: string
  maxTries: number
  startAt: bigint
}): Hex | null {
  for (let i = 0; i < params.maxTries; i += 1) {
    const salt = toHex((params.startAt + BigInt(i)) & MAX_UINT256, { size: 32 }) as Hex
    const addr = getCreate2Address({ from: params.create2Deployer, salt, bytecodeHash: params.initCodeHash })
    if (addr.slice(-params.suffix.length).toLowerCase() === params.suffix) return salt
  }
  return null
}

describe('findCreate2SaltForSuffixOnServer', () => {
  it('matches the linear typescript scan when wasm is available', async () => {
    const wasmPath = resolveWasmPath()
    if (!wasmPath) return

    process.env.DEPLOY_VANITY_WASM_PATH = wasmPath

    const create2Deployer = '0x4e59b44847b379578588920cA78FbF26c0B4956C' as Address
    const initCodeHash = keccak256('0x1234')
    const startAt = BigInt(keccak256('0xseed'))
    const suffix = '26'

    const tsSalt = findSaltTypescript({
      create2Deployer,
      initCodeHash,
      suffix,
      maxTries: 100_000,
      startAt,
    })
    expect(tsSalt).toBeTruthy()

    const wasmResult = await findCreate2SaltForSuffixOnServer({
      create2Deployer,
      initCodeHash,
      startAt: toHex(startAt & MAX_UINT256, { size: 32 }),
      suffix,
      maxAttempts: 100_000,
    })

    expect(wasmResult?.salt).toBe(tsSalt)
    expect(wasmResult?.predictedAddress.toLowerCase().endsWith(suffix)).toBe(true)
  })
})