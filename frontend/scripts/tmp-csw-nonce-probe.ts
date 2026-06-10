import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { entryPoint06Address } from 'viem/account-abstraction'

import { findCoinbaseSmartWalletOwnerIndex } from '../src/lib/aa/coinbaseErc4337Owners'
import { CSW_OWNER_READ_ABI } from '../src/lib/wallet/cswOwnerAbi'

const CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const
const EMB = '0xcECa13F2686ed061c57620Ecdf67E1b8C0F285e9' as const

async function main() {
  const rpc =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.VITE_BASE_RPC?.trim() ||
    'https://mainnet.base.org'
  const client = createPublicClient({ chain: base, transport: http(rpc) })
  const lookup = await findCoinbaseSmartWalletOwnerIndex({
    publicClient: client,
    smartWallet: CSW,
    ownerAddress: EMB,
    useCache: false,
  })
  console.log('embedded owner lookup', lookup)

  const isOwner = await client.readContract({
    address: CSW,
    abi: CSW_OWNER_READ_ABI,
    functionName: 'isOwnerAddress',
    args: [EMB],
  })
  console.log('isOwnerAddress embedded', isOwner)

  if (lookup.ownerIndex !== null) {
    const nonce = (await client.readContract({
      address: entryPoint06Address,
      abi: [
        {
          type: 'function',
          name: 'getNonce',
          inputs: [
            { type: 'address' },
            { type: 'uint192' },
          ],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'getNonce',
      args: [CSW, BigInt(lookup.ownerIndex)],
    })) as bigint
    console.log('entryPoint nonce for ownerIndex key', lookup.ownerIndex, nonce.toString())
    console.log('sequence', (nonce & ((1n << 64n) - 1n)).toString())
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
