import { rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createSecureEphemeralKeypairFile,
  parseCostProbeArgs,
  preflightHookMutationInputs,
} from '../scripts/solana/cost-probe-devnet.js'

const emptyConnection = { getAccountInfo: vi.fn(async () => null) }

afterEach(() => {
  vi.unstubAllEnvs()
  emptyConnection.getAccountInfo.mockClear()
})

describe('Solana devnet cost-probe CLI gate', () => {
  it('writes ephemeral key material to an unpredictable mode-0600 file', () => {
    const path = createSecureEphemeralKeypairFile(new Uint8Array([1, 2, 3]))
    try {
      expect(path).not.toBe('/tmp/4626-devnet-cost-probe.json')
      expect(statSync(path).mode & 0o777).toBe(0o600)
      expect(statSync(dirname(path)).mode & 0o777).toBe(0o700)
    } finally {
      rmSync(dirname(path), { recursive: true, force: true })
    }
  })

  it('treats help as non-mutating and does not imply execution', () => {
    expect(parseCostProbeArgs(['--help'])).toEqual({ help: true, execute: false, unknown: [] })
  })

  it('requires the explicit execution flag', () => {
    expect(parseCostProbeArgs([])).toEqual({ help: false, execute: false, unknown: [] })
    expect(parseCostProbeArgs(['--execute'])).toEqual({ help: false, execute: true, unknown: [] })
    expect(parseCostProbeArgs(['--live-devnet'])).toEqual({ help: false, execute: true, unknown: [] })
  })

  it('rejects unknown arguments instead of falling through to a live probe', () => {
    expect(parseCostProbeArgs(['--helpp'])).toEqual({ help: false, execute: false, unknown: ['--helpp'] })
  })

  it('fails before any funding or transaction when the selected hook keypair is absent', async () => {
    vi.stubEnv('SKIP_HOOK', '')
    vi.stubEnv('SKIP_HOOK_DEPLOY', '')
    vi.stubEnv('COST_PROBE_HOOK_PROGRAM_KEYPAIR', '')
    await expect(preflightHookMutationInputs(emptyConnection as any)).rejects.toThrow(
      'hook_program_missing_keypair_required',
    )
    expect(emptyConnection.getAccountInfo).toHaveBeenCalledTimes(1)
  })

  it('rejects a keypair that does not derive the canonical hook program id', async () => {
    vi.stubEnv('SKIP_HOOK', '')
    vi.stubEnv('SKIP_HOOK_DEPLOY', '')
    vi.stubEnv(
      'COST_PROBE_HOOK_PROGRAM_KEYPAIR',
      `${process.cwd()}/../programs/creator-share-hook/target/deploy/creator_share_hook-keypair.json`,
    )
    await expect(preflightHookMutationInputs(emptyConnection as any)).rejects.toThrow(
      'hook_program_keypair_mismatch',
    )
  })
})
