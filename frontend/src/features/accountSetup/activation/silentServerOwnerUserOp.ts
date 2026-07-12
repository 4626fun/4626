import { getAddress, type Address, type Hex } from 'viem'

import { assertAddOwnerSelfCallShape } from '@/lib/wallet/addOwnerCallShape'
import type { PreparedOwnerTxRequest } from '@/lib/wallet/zoraAddOwnerApi'

export type SilentServerOwnerUserOp = {
  smartWallet: Address
  ownerAddress: Address
  calls: [{ to: Address; data: Hex; value: 0n }]
}

export function buildSilentServerOwnerUserOp(params: {
  parentCsw: string
  embeddedEoa: string
  expectedServerWallet: string
  txRequest: PreparedOwnerTxRequest
}): SilentServerOwnerUserOp {
  const parentCsw = getAddress(params.parentCsw)
  const embeddedEoa = getAddress(params.embeddedEoa)
  const expectedServerWallet = getAddress(params.expectedServerWallet)
  assertAddOwnerSelfCallShape({
    csw: parentCsw,
    txRequest: params.txRequest,
    expectedOwnerToAdd: expectedServerWallet,
  })
  return {
    smartWallet: parentCsw,
    ownerAddress: embeddedEoa,
    calls: [{
      to: parentCsw,
      data: params.txRequest.data,
      value: 0n,
    }],
  }
}
