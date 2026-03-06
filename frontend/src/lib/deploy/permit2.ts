import type { Address } from 'viem'

type Permit2TokenPermissions = {
  token: Address
  amount: bigint
}

type Permit2TransferPermit = {
  permitted: Permit2TokenPermissions
  nonce: bigint
  deadline: bigint
}

type Permit2TypedData = {
  domain: {
    name: 'Permit2'
    chainId: number
    verifyingContract: Address
  }
  types: {
    TokenPermissions: Array<{ name: 'token' | 'amount'; type: 'address' | 'uint256' }>
    PermitTransferFrom: Array<
      | { name: 'permitted'; type: 'TokenPermissions' }
      | { name: 'spender'; type: 'address' }
      | { name: 'nonce'; type: 'uint256' }
      | { name: 'deadline'; type: 'uint256' }
    >
  }
  primaryType: 'PermitTransferFrom'
  message: {
    permitted: Permit2TokenPermissions
    spender: Address
    nonce: bigint
    deadline: bigint
  }
}

export function createPermit2Nonce(nowMs: number = Date.now()): bigint {
  return BigInt(nowMs)
}

export function createPermit2Deadline(params?: { nowSeconds?: number; ttlSeconds?: number }): bigint {
  const nowSeconds = params?.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ttlSeconds = params?.ttlSeconds ?? 24 * 60 * 60
  return BigInt(nowSeconds + ttlSeconds)
}

export function buildPermit2SignatureTransfer(args: {
  chainId: number
  permit2: Address
  token: Address
  amount: bigint
  spender: Address
  nonce: bigint
  deadline: bigint
}): {
  permit: Permit2TransferPermit
  typedData: Permit2TypedData
} {
  const permit: Permit2TransferPermit = {
    permitted: {
      token: args.token,
      amount: args.amount,
    },
    nonce: args.nonce,
    deadline: args.deadline,
  }

  return {
    permit,
    typedData: {
      domain: {
        name: 'Permit2',
        chainId: args.chainId,
        verifyingContract: args.permit2,
      },
      types: {
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        PermitTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'PermitTransferFrom',
      message: {
        permitted: permit.permitted,
        spender: args.spender,
        nonce: permit.nonce,
        deadline: permit.deadline,
      },
    },
  }
}

export type { Permit2TransferPermit, Permit2TypedData }
