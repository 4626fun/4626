/**
 * Profile 1 sub-account provisioning helper.
 *
 * Reads env:
 * - ADMIN_API_TOKEN (or BASE_ADMIN_API_TOKEN)
 * - PRIVATE_KEY (or SIGNER_PRIVATE_KEY)
 * - BASE_RPC (or BASE_RPC_URL)
 * - PROVISION_BASE_URL (optional override)
 *
 * Usage:
 *   node frontend/provision-sub-account.mjs --staging --dry-run
 *   node frontend/provision-sub-account.mjs --prod --confirm-prod
 */
import { randomBytes } from 'node:crypto'
import { createPublicClient, http, parseAbi, keccak256, toHex } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const DEFAULT_PROD_URL = 'https://app.akita.llc'
const DEFAULT_STAGING_URL = 'https://staging.akita.llc'

const PROFILE_ID = 1
const PARENT_CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'
const OWNER_EOA = '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' // privy embedded, owner index 1
const PRIVY_WALLET = 'l8pocg69pnk3djdrp6t4lm0n'
const FACTORY = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a'
const SPM = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad'
const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const EXPECTED_SIGNER = '0xb05cf01231cf2ff99499682e64d3780d57c80fdd'

const PER_TX_CAP = 100_000_000_000_000_000n // 0.1 ETH
const DAILY_CAP = 500_000_000_000_000_000n // 0.5 ETH
const PERIOD = 86_400
const START = Math.floor(Date.now() / 1000)
const END = START + 100 * 365 * 24 * 60 * 60 // 100 years

const args = new Set(process.argv.slice(2))

function usage(exitCode = 0) {
  const msg = `
Usage:
  node frontend/provision-sub-account.mjs --staging [--dry-run]
  node frontend/provision-sub-account.mjs --prod --confirm-prod [--dry-run]

Flags:
  --staging      Target staging (default URL: ${DEFAULT_STAGING_URL})
  --prod         Target production (default URL: ${DEFAULT_PROD_URL})
  --confirm-prod Required when using --prod
  --dry-run      Print payload and exit without POST
  --help         Show help

Env:
  ADMIN_API_TOKEN (or BASE_ADMIN_API_TOKEN)
  PRIVATE_KEY (or SIGNER_PRIVATE_KEY)
  BASE_RPC (or BASE_RPC_URL; default https://mainnet.base.org)
  PROVISION_BASE_URL (optional override)
`
  console.log(msg.trim())
  process.exit(exitCode)
}

if (args.has('--help') || args.has('-h')) usage(0)

const isProd = args.has('--prod')
const isStaging = args.has('--staging')
if (isProd === isStaging) {
  console.error('Exactly one target flag is required: --staging or --prod')
  usage(1)
}
if (isProd && !args.has('--confirm-prod')) {
  console.error('Refusing production call without --confirm-prod')
  usage(1)
}
const isDryRun = args.has('--dry-run')

const ADMIN_TOKEN = (process.env.ADMIN_API_TOKEN ?? process.env.BASE_ADMIN_API_TOKEN ?? '').trim()
const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? process.env.SIGNER_PRIVATE_KEY ?? '').trim()
const RPC = (process.env.BASE_RPC ?? process.env.BASE_RPC_URL ?? 'https://mainnet.base.org')
  .split(',')[0]
  .trim()
const targetBaseUrl =
  (process.env.PROVISION_BASE_URL ?? '').trim() ||
  (isProd ? DEFAULT_PROD_URL : DEFAULT_STAGING_URL)

if (!ADMIN_TOKEN) {
  console.error('Missing ADMIN_API_TOKEN (or BASE_ADMIN_API_TOKEN)')
  process.exit(1)
}
if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error('Missing or invalid PRIVATE_KEY (or SIGNER_PRIVATE_KEY)')
  process.exit(1)
}
if (!/^https?:\/\/.+/.test(targetBaseUrl)) {
  console.error('Invalid PROVISION_BASE_URL (must be absolute http/https URL)')
  process.exit(1)
}

const account = privateKeyToAccount(PRIVATE_KEY)
if (account.address.toLowerCase() !== EXPECTED_SIGNER) {
  console.error(`PRIVATE_KEY does not match expected signer ${EXPECTED_SIGNER} (got ${account.address})`)
  process.exit(1)
}

const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 10_000 }) })
const endpoint = `${targetBaseUrl}/api/admin/arch-b/sub-account/provision`

// 1) Compute sub-account address deterministically via factory getAddress.
const factoryAbi = parseAbi(['function getAddress(bytes[] owners, uint256 nonce) view returns (address)'])
const encodeOwner = (addr) => `0x${'0'.repeat(24)}${addr.slice(2).toLowerCase()}`
const owners = [encodeOwner(PARENT_CSW), encodeOwner(OWNER_EOA)]
const saltPreimage = toHex(new TextEncoder().encode(`4626:subacct:v1:${PROFILE_ID}:${PARENT_CSW.toLowerCase()}`))
const nonce = BigInt(keccak256(saltPreimage))

const subAccount = await client.readContract({
  address: FACTORY,
  abi: factoryAbi,
  functionName: 'getAddress',
  args: [owners, nonce],
})

// 2) Build permission payload and sign typed data.
const permission = {
  account: PARENT_CSW,
  spender: subAccount,
  token: NATIVE,
  allowance: DAILY_CAP.toString(),
  period: PERIOD,
  start: START,
  end: END,
  salt: `0x${randomBytes(32).toString('hex')}`,
  extraData: '0x',
}

const signature = await account.signTypedData({
  domain: {
    name: 'Spend Permission Manager',
    version: '1',
    chainId: 8453,
    verifyingContract: SPM,
  },
  types: {
    SpendPermission: [
      { name: 'account', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'allowance', type: 'uint160' },
      { name: 'period', type: 'uint48' },
      { name: 'start', type: 'uint48' },
      { name: 'end', type: 'uint48' },
      { name: 'salt', type: 'uint256' },
      { name: 'extraData', type: 'bytes' },
    ],
  },
  primaryType: 'SpendPermission',
  message: {
    ...permission,
    allowance: BigInt(permission.allowance),
    salt: BigInt(permission.salt),
  },
})

const body = {
  profileId: PROFILE_ID,
  parentCswAddress: PARENT_CSW,
  ownerEoaAddress: OWNER_EOA,
  permission,
  signature,
  perTxCapWei: PER_TX_CAP.toString(),
  dailyCapWei: DAILY_CAP.toString(),
  privyOwnerWalletId: PRIVY_WALLET,
}

console.log(`Target: ${targetBaseUrl}`)
console.log(`Mode: ${isProd ? 'production' : 'staging'}`)
console.log(`RPC: ${RPC}`)
console.log(`Sub-account address: ${subAccount}`)
console.log(`Signature: ${signature.slice(0, 20)}...`)
console.log('\n-- Request body preview --')
console.log(JSON.stringify(body, null, 2))

if (isDryRun) {
  console.log('\nDry run enabled, skipping POST.')
  process.exit(0)
}

console.log(`\n-- Posting to ${endpoint} --`)
const res = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${ADMIN_TOKEN}`,
  },
  body: JSON.stringify(body),
})
const text = await res.text()
console.log(`Status: ${res.status}`)
console.log('Response:', text)
if (!res.ok) process.exit(1)
