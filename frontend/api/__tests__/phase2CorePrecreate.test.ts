import { encodeFunctionData, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import {
  SELECTOR_DEPLOY_PHASE2_CORE,
  SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY,
  decodePhase2CoreCreateArgs,
  findPhase2CoreCall,
  isPhase2CoreCalldata,
  readPrecreatePrivateKey,
} from '../_handlers/deploy/v2/session/phase2CorePrecreate.js'

const PHASE2_PARAMS = {
  creatorToken: '0x1111111111111111111111111111111111111111' as const,
  owner: '0x2222222222222222222222222222222222222222' as const,
  creatorTreasury: '0x3333333333333333333333333333333333333333' as const,
  payoutRecipient: '0x4444444444444444444444444444444444444444' as const,
  vault: '0x5555555555555555555555555555555555555555' as const,
  wrapper: '0x6666666666666666666666666666666666666666' as const,
  shareOFT: '0x7777777777777777777777777777777777777777' as const,
  shareSymbol: 'TEST',
  version: 'v1.19.1-phase2-source',
  floorPriceQ96: 1n,
}

const PHASE2_CODE_IDS = {
  vault: `0x${'11'.repeat(32)}` as Hex,
  wrapper: `0x${'22'.repeat(32)}` as Hex,
  shareOFT: `0x${'33'.repeat(32)}` as Hex,
  gauge: `0x${'44'.repeat(32)}` as Hex,
  cca: `0x${'55'.repeat(32)}` as Hex,
  oracle: `0x${'66'.repeat(32)}` as Hex,
  oftBootstrap: `0x${'77'.repeat(32)}` as Hex,
}

const PHASE2_PARAMS_COMPONENTS = [
  { name: 'creatorToken', type: 'address' },
  { name: 'owner', type: 'address' },
  { name: 'creatorTreasury', type: 'address' },
  { name: 'payoutRecipient', type: 'address' },
  { name: 'vault', type: 'address' },
  { name: 'wrapper', type: 'address' },
  { name: 'shareOFT', type: 'address' },
  { name: 'shareSymbol', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'floorPriceQ96', type: 'uint256' },
] as const

const PHASE2_CODE_IDS_COMPONENTS = [
  { name: 'vault', type: 'bytes32' },
  { name: 'wrapper', type: 'bytes32' },
  { name: 'shareOFT', type: 'bytes32' },
  { name: 'gauge', type: 'bytes32' },
  { name: 'cca', type: 'bytes32' },
  { name: 'oracle', type: 'bytes32' },
  { name: 'oftBootstrap', type: 'bytes32' },
] as const

const DEPLOY_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE2_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE2_CODE_IDS_COMPONENTS },
    ],
    outputs: [],
  },
] as const

const DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI = [
  {
    type: 'function',
    name: 'deployPhase2CoreWithRolePolicy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'params', type: 'tuple', components: PHASE2_PARAMS_COMPONENTS },
      { name: 'codeIds', type: 'tuple', components: PHASE2_CODE_IDS_COMPONENTS },
      { name: 'rolePolicyId', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const SET_PENDING_INIT_CODE_HASHES_ABI = [
  {
    type: 'function',
    name: 'setPendingInitCodeHashes',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'salts', type: 'bytes32[3]' },
      { name: 'hashes', type: 'bytes32[3]' },
    ],
    outputs: [],
  },
] as const

describe('phase2CorePrecreate selectors', () => {
  it('recognizes both deployPhase2Core selectors', () => {
    expect(SELECTOR_DEPLOY_PHASE2_CORE).toBe('0xf9344d88')
    expect(SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY).toBe('0x6004df9c')
    expect(isPhase2CoreCalldata(SELECTOR_DEPLOY_PHASE2_CORE)).toBe(true)
    expect(isPhase2CoreCalldata(SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY)).toBe(true)
    expect(isPhase2CoreCalldata('0xdeadbeef')).toBe(false)
  })

  it('finds WithRolePolicy calldata after role-policy rewrite', () => {
    const data = encodeFunctionData({
      abi: DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
      functionName: 'deployPhase2CoreWithRolePolicy',
      args: [PHASE2_PARAMS, PHASE2_CODE_IDS, 7n],
    })
    expect(data.slice(0, 10).toLowerCase()).toBe(SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY)

    const found = findPhase2CoreCall([
      { to: '0xa18169caf37fa0347285B16aAFC2B09eCB43F145', data },
    ])
    expect(found).not.toBeNull()
    const decoded = decodePhase2CoreCreateArgs(found!.data)
    expect(decoded?.variant).toBe('deployPhase2CoreWithRolePolicy')
    expect(decoded?.rolePolicyId).toBe(7n)
    expect(decoded?.params.creatorToken.toLowerCase()).toBe(PHASE2_PARAMS.creatorToken)
    expect(decoded?.codeIds.gauge).toBe(PHASE2_CODE_IDS.gauge)
  })

  it('encodes/decodes deployPhase2Core without init-code hash fields', () => {
    const data = encodeFunctionData({
      abi: DEPLOY_PHASE2_CORE_ABI,
      functionName: 'deployPhase2Core',
      args: [PHASE2_PARAMS, PHASE2_CODE_IDS],
    })
    expect(data.slice(0, 10).toLowerCase()).toBe(SELECTOR_DEPLOY_PHASE2_CORE)
    const decoded = decodePhase2CoreCreateArgs(data)
    expect(decoded?.variant).toBe('deployPhase2Core')
    expect(decoded?.codeIds.oracle).toBe(PHASE2_CODE_IDS.oracle)
    expect(decoded?.params.shareSymbol).toBe(PHASE2_PARAMS.shareSymbol)
    expect(decoded?.params).not.toHaveProperty('gaugeInitCodeHash')
    expect(decoded?.params).not.toHaveProperty('ccaInitCodeHash')
    expect(decoded?.params).not.toHaveProperty('oracleInitCodeHash')
  })

  it('encodes setPendingInitCodeHashes(bytes32[3], bytes32[3])', () => {
    const salts = [
      `0x${'11'.repeat(32)}` as Hex,
      `0x${'22'.repeat(32)}` as Hex,
      `0x${'33'.repeat(32)}` as Hex,
    ] as const
    const hashes = [
      `0x${'aa'.repeat(32)}` as Hex,
      `0x${'bb'.repeat(32)}` as Hex,
      `0x${'cc'.repeat(32)}` as Hex,
    ] as const
    const data = encodeFunctionData({
      abi: SET_PENDING_INIT_CODE_HASHES_ABI,
      functionName: 'setPendingInitCodeHashes',
      args: [salts, hashes],
    })
    expect(data.slice(0, 10)).toMatch(/^0x[0-9a-f]{8}$/)
    // selector (10) + 3 salts + 3 hashes (64 hex chars each)
    expect(data.length).toBe(10 + 64 * 6)
    expect(data).toContain(salts[0].slice(2))
    expect(data).toContain(hashes[2].slice(2))
  })
})

describe('phase2CorePrecreate key policy', () => {
  it('requires DEPLOY_SESSION_PHASE2_PRECREATE_PRIVATE_KEY only', () => {
    const pk = `0x${'ab'.repeat(32)}`
    expect(
      readPrecreatePrivateKey({
        PRIVATE_KEY: pk,
        KPR_PRIVATE_KEY: pk,
        DEPLOY_SESSION_SELF_BUNDLE_PRIVATE_KEY: pk,
      }),
    ).toBeNull()
    expect(
      readPrecreatePrivateKey({
        DEPLOY_SESSION_PHASE2_PRECREATE_PRIVATE_KEY: pk,
      }),
    ).toBe(pk)
  })
})
