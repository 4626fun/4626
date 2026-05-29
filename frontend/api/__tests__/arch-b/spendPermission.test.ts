/**
 * Architecture B Phase 5 — SpendPermission encoding helpers.
 *
 * These tests lock down the shape of the multicall preamble
 * (`buildSpendPermissionCalls`) and the EIP-712 hash computation
 * (`hashSpendPermission`). No RPC required — pure encoding.
 */

import { describe, expect, it } from 'vitest'
import { encodeFunctionData, hashTypedData } from 'viem'

import type { SpendPermissionPayload } from '@4626/server-core'
import {
  NATIVE_TOKEN_SENTINEL,
  SPEND_PERMISSION_EIP712_DOMAIN,
  SPEND_PERMISSION_MANAGER_BASE,
  SPEND_PERMISSION_TYPES,
  buildSpendPermissionCalls,
  encodeSpendPermissionSpendCall,
  hashSpendPermission,
  spendPermissionManagerAbi,
} from '../../../server/_lib/wallet/spendPermission.js'

const PARENT = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as `0x${string}`
const SUB = '0xcafecafecafecafecafecafecafecafecafecafe' as `0x${string}`

const PAYLOAD: SpendPermissionPayload = {
  account: PARENT,
  spender: SUB,
  token: NATIVE_TOKEN_SENTINEL,
  allowance: '500000000000000000',
  period: 86_400,
  start: 1_700_000_000,
  end: 4_700_000_000,
  salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
  extraData: '0x',
}

const SIGNATURE = '0x1122' as `0x${string}`

describe('SPEND_PERMISSION_MANAGER_BASE', () => {
  it('matches the Base mainnet singleton address', () => {
    expect(SPEND_PERMISSION_MANAGER_BASE.toLowerCase()).toBe(
      '0xf85210b21cc50302f477ba56686d2019dc9b67ad',
    )
  })
})

describe('NATIVE_TOKEN_SENTINEL', () => {
  it('matches the canonical native-ETH sentinel', () => {
    expect(NATIVE_TOKEN_SENTINEL.toLowerCase()).toBe(
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    )
  })
})

describe('SPEND_PERMISSION_EIP712_DOMAIN', () => {
  it('returns manager name/version + verifyingContract for the given chain', () => {
    const domain = SPEND_PERMISSION_EIP712_DOMAIN(8453)
    expect(domain.name).toBe('Spend Permission Manager')
    expect(domain.version).toBe('1')
    expect(domain.chainId).toBe(8453)
    expect(domain.verifyingContract.toLowerCase()).toBe(
      '0xf85210b21cc50302f477ba56686d2019dc9b67ad',
    )
  })
})

describe('hashSpendPermission', () => {
  it('produces a deterministic 0x-hex hash', () => {
    const hash1 = hashSpendPermission(PAYLOAD, 8453)
    const hash2 = hashSpendPermission(PAYLOAD, 8453)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('differs between chain ids', () => {
    const a = hashSpendPermission(PAYLOAD, 8453)
    const b = hashSpendPermission(PAYLOAD, 1)
    expect(a).not.toBe(b)
  })

  it('matches a direct viem hashTypedData call over the same message', () => {
    const expected = hashTypedData({
      domain: SPEND_PERMISSION_EIP712_DOMAIN(8453),
      types: SPEND_PERMISSION_TYPES,
      primaryType: 'SpendPermission',
      message: {
        account: PAYLOAD.account,
        spender: PAYLOAD.spender,
        token: PAYLOAD.token,
        allowance: BigInt(PAYLOAD.allowance),
        period: PAYLOAD.period,
        start: PAYLOAD.start,
        end: PAYLOAD.end,
        salt: BigInt(PAYLOAD.salt),
        extraData: PAYLOAD.extraData as `0x${string}`,
      },
    })
    expect(hashSpendPermission(PAYLOAD, 8453)).toBe(expected)
  })
})

describe('buildSpendPermissionCalls', () => {
  it('returns [approveWithSignature, spend] when not approved on-chain', () => {
    const calls = buildSpendPermissionCalls({
      permission: PAYLOAD,
      signature: SIGNATURE,
      amountWei: 1_000_000n,
      isApprovedOnChain: false,
    })
    expect(calls).toHaveLength(2)
    expect(calls[0].to).toBe(SPEND_PERMISSION_MANAGER_BASE)
    expect(calls[0].value).toBe(0n)
    expect(calls[1].to).toBe(SPEND_PERMISSION_MANAGER_BASE)
    expect(calls[1].value).toBe(0n)

    const expectedApproveData = encodeFunctionData({
      abi: spendPermissionManagerAbi,
      functionName: 'approveWithSignature',
      args: [
        {
          account: PAYLOAD.account,
          spender: PAYLOAD.spender,
          token: PAYLOAD.token,
          allowance: BigInt(PAYLOAD.allowance),
          period: PAYLOAD.period,
          start: PAYLOAD.start,
          end: PAYLOAD.end,
          salt: BigInt(PAYLOAD.salt),
          extraData: PAYLOAD.extraData as `0x${string}`,
        },
        SIGNATURE,
      ],
    })
    expect(calls[0].data).toBe(expectedApproveData)

    const expectedSpendData = encodeFunctionData({
      abi: spendPermissionManagerAbi,
      functionName: 'spend',
      args: [
        {
          account: PAYLOAD.account,
          spender: PAYLOAD.spender,
          token: PAYLOAD.token,
          allowance: BigInt(PAYLOAD.allowance),
          period: PAYLOAD.period,
          start: PAYLOAD.start,
          end: PAYLOAD.end,
          salt: BigInt(PAYLOAD.salt),
          extraData: PAYLOAD.extraData as `0x${string}`,
        },
        1_000_000n,
      ],
    })
    expect(calls[1].data).toBe(expectedSpendData)
  })

  it('returns only [spend] when already approved on-chain', () => {
    const calls = buildSpendPermissionCalls({
      permission: PAYLOAD,
      signature: SIGNATURE,
      amountWei: 1_000_000n,
      isApprovedOnChain: true,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].to).toBe(SPEND_PERMISSION_MANAGER_BASE)
  })

  it('returns only [approveWithSignature] when amountWei is 0 and not approved', () => {
    const calls = buildSpendPermissionCalls({
      permission: PAYLOAD,
      signature: SIGNATURE,
      amountWei: 0n,
      isApprovedOnChain: false,
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].to).toBe(SPEND_PERMISSION_MANAGER_BASE)
    const expectedApproveData = encodeFunctionData({
      abi: spendPermissionManagerAbi,
      functionName: 'approveWithSignature',
      args: [
        {
          account: PAYLOAD.account,
          spender: PAYLOAD.spender,
          token: PAYLOAD.token,
          allowance: BigInt(PAYLOAD.allowance),
          period: PAYLOAD.period,
          start: PAYLOAD.start,
          end: PAYLOAD.end,
          salt: BigInt(PAYLOAD.salt),
          extraData: PAYLOAD.extraData as `0x${string}`,
        },
        SIGNATURE,
      ],
    })
    expect(calls[0].data).toBe(expectedApproveData)
  })

  it('returns an empty array when amountWei is 0 and already approved', () => {
    const calls = buildSpendPermissionCalls({
      permission: PAYLOAD,
      signature: SIGNATURE,
      amountWei: 0n,
      isApprovedOnChain: true,
    })
    expect(calls).toEqual([])
  })
})

describe('encodeSpendPermissionSpendCall', () => {
  it('encodes a spend-only call targeting the given manager', () => {
    const call = encodeSpendPermissionSpendCall({
      manager: SPEND_PERMISSION_MANAGER_BASE,
      permission: PAYLOAD,
      signature: SIGNATURE,
      amountWei: 42n,
    })
    expect(call.to).toBe(SPEND_PERMISSION_MANAGER_BASE)
    expect(call.value).toBe(0n)
    expect(call.data).toMatch(/^0x/)
  })
})
