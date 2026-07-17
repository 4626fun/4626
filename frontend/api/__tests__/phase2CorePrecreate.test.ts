import { encodeFunctionData, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import {
  SELECTOR_DEPLOY_PHASE2_CORE,
  SELECTOR_DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY,
  decodePhase2CoreCreateArgs,
  findPhase2CoreCall,
  injectPhase2CoreInitCodeHashes,
  isPhase2CoreCalldata,
  readPrecreatePrivateKey,
} from '../_handlers/deploy/v2/session/phase2CorePrecreate.js'

const ZERO_BYTES32 = `0x${'00'.repeat(32)}` as Hex

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
  gaugeInitCodeHash: ZERO_BYTES32,
  ccaInitCodeHash: ZERO_BYTES32,
  oracleInitCodeHash: ZERO_BYTES32,
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
  { name: 'gaugeInitCodeHash', type: 'bytes32' },
  { name: 'ccaInitCodeHash', type: 'bytes32' },
  { name: 'oracleInitCodeHash', type: 'bytes32' },
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

describe('phase2CorePrecreate selectors', () => {
  it('recognizes both deployPhase2Core selectors', () => {
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

  it('still decodes plain deployPhase2Core', () => {
    const data = encodeFunctionData({
      abi: DEPLOY_PHASE2_CORE_ABI,
      functionName: 'deployPhase2Core',
      args: [PHASE2_PARAMS, PHASE2_CODE_IDS],
    })
    expect(data.slice(0, 10).toLowerCase()).toBe(SELECTOR_DEPLOY_PHASE2_CORE)
    const decoded = decodePhase2CoreCreateArgs(data)
    expect(decoded?.variant).toBe('deployPhase2Core')
    expect(decoded?.codeIds.oracle).toBe(PHASE2_CODE_IDS.oracle)
  })
})

describe('phase2CorePrecreate init-code hash injection', () => {
  const hashes = {
    gauge: `0x${'aa'.repeat(32)}` as Hex,
    cca: `0x${'bb'.repeat(32)}` as Hex,
    oracle: `0x${'cc'.repeat(32)}` as Hex,
  }

  it('rewrites deployPhase2Core params with non-zero hashes', () => {
    const data = encodeFunctionData({
      abi: DEPLOY_PHASE2_CORE_ABI,
      functionName: 'deployPhase2Core',
      args: [PHASE2_PARAMS, PHASE2_CODE_IDS],
    })
    const { calls, injected } = injectPhase2CoreInitCodeHashes(
      [{ to: '0xa18169caf37fa0347285B16aAFC2B09eCB43F145', data }],
      hashes,
    )
    expect(injected).toBe(true)
    const decoded = decodePhase2CoreCreateArgs(calls[0]!.data as Hex)
    expect(decoded?.params.gaugeInitCodeHash).toBe(hashes.gauge)
    expect(decoded?.params.ccaInitCodeHash).toBe(hashes.cca)
    expect(decoded?.params.oracleInitCodeHash).toBe(hashes.oracle)
    expect(decoded?.params.creatorToken.toLowerCase()).toBe(PHASE2_PARAMS.creatorToken)
  })

  it('preserves rolePolicyId on WithRolePolicy rewrite', () => {
    const data = encodeFunctionData({
      abi: DEPLOY_PHASE2_CORE_WITH_ROLE_POLICY_ABI,
      functionName: 'deployPhase2CoreWithRolePolicy',
      args: [PHASE2_PARAMS, PHASE2_CODE_IDS, 42n],
    })
    const { calls, injected } = injectPhase2CoreInitCodeHashes(
      [
        { to: '0x1111111111111111111111111111111111111111', data: '0xdeadbeef' },
        { to: '0xa18169caf37fa0347285B16aAFC2B09eCB43F145', data },
      ],
      hashes,
    )
    expect(injected).toBe(true)
    expect(calls[0]!.data).toBe('0xdeadbeef')
    const decoded = decodePhase2CoreCreateArgs(calls[1]!.data as Hex)
    expect(decoded?.variant).toBe('deployPhase2CoreWithRolePolicy')
    expect(decoded?.rolePolicyId).toBe(42n)
    expect(decoded?.params.oracleInitCodeHash).toBe(hashes.oracle)
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
