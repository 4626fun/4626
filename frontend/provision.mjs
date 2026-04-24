// Profile 1 sub-account provisioning.
//
// Loads a local .env file (pass its path via --env <path>, or set ENV_FILE).
// Falls back to process.env if --env not passed.
//
// Required env vars:
//   PROD_URL              (default: https://4626.fun)
//   ADMIN_API_TOKEN       (required)
//   SIGNER_PRIVATE_KEY or PRIVATE_KEY    (required; must be for 0xB05C..0FDD)
//   BASE_RPC              (optional, default https://mainnet.base.org)
//
// Usage:
//   node provision.mjs                       # reads current shell env
//   node provision.mjs --env /path/to/.env    # reads dotenv file
//   ENV_FILE=/path/to/.env node provision.mjs # same via env var

import { readFileSync, existsSync } from 'node:fs'
import { createPublicClient, http, parseAbi, keccak256, toHex } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// --- Lightweight dotenv loader (no deps) ---
function loadDotenv(path) {
  if (!existsSync(path)) { console.error('env file not found: ' + path); process.exit(1) }
  const text = readFileSync(path, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val  // don't override existing shell env
  }
  console.log('Loaded env from ' + path)
}

const argEnvIdx = process.argv.indexOf('--env')
const envPath = argEnvIdx >= 0 ? process.argv[argEnvIdx + 1] : process.env.ENV_FILE
if (envPath) loadDotenv(envPath)

const PROD_URL      = process.env.PROD_URL      || 'https://4626.fun'
const ADMIN_TOKEN   = process.env.ADMIN_API_TOKEN
const PRIVATE_KEY   = process.env.SIGNER_PRIVATE_KEY || process.env.PRIVATE_KEY  // for 0xB05C..0FDD
const RPC           = process.env.BASE_RPC || 'https://mainnet.base.org'

if (!ADMIN_TOKEN) { console.error('ADMIN_API_TOKEN not set'); process.exit(1) }
if (!PRIVATE_KEY) { console.error('SIGNER_PRIVATE_KEY not set'); process.exit(1) }

const PROFILE_ID    = 1
// Canonical CSW — migrated 2026-04-23. See src/wallet/canonicalWalletPolicy.ts.
const PARENT_CSW    = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
const OWNER_EOA     = '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9'  // privy embedded, on-chain owner slot 18 of PARENT_CSW; becomes sub-account owner index 1
const PRIVY_WALLET  = 'l8pocg69pnk3djdrp6t4lm0n'
const FACTORY       = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a'
const SPM           = '0xf85210B21cC50302F477BA56686d2019dC9b67Ad'
const NATIVE        = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

const PER_TX_CAP    = 100_000_000_000_000_000n  // 0.1 ETH
const DAILY_CAP     = 500_000_000_000_000_000n  // 0.5 ETH
const PERIOD        = 86_400
const START         = Math.floor(Date.now() / 1000)
const END           = START + 100 * 365 * 24 * 60 * 60  // 100 years

const account = privateKeyToAccount(PRIVATE_KEY)
if (account.address.toLowerCase() !== '0xb05cf01231cf2ff99499682e64d3780d57c80fdd') {
  console.error('SIGNER_PRIVATE_KEY does not match 0xB05C..0FDD (got ' + account.address + ')')
  process.exit(1)
}

const client = createPublicClient({ chain: base, transport: http(RPC) })

// 1. Compute sub-account address deterministically via factory view.
// Owners array: [parentCsw, ownerEoa] -- each abi.encode(address) -> 32 bytes.
const factoryAbi = parseAbi([
  'function getAddress(bytes[] owners, uint256 nonce) view returns (address)',
])
const encodeOwner = (addr) => '0x' + '0'.repeat(24) + addr.slice(2).toLowerCase()
const owners = [encodeOwner(PARENT_CSW), encodeOwner(OWNER_EOA)]

// Salt = keccak256("4626:subacct:v1:" + profileId + ":" + parentCsw.toLowerCase())
const saltPreimage = toHex(new TextEncoder().encode(
  `4626:subacct:v1:${PROFILE_ID}:${PARENT_CSW.toLowerCase()}`
))
const salt = keccak256(saltPreimage)
const nonce = BigInt(salt)

const subAccount = await client.readContract({
  address: FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [owners, nonce],
})

console.log('Sub-account address:', subAccount)

// 2. Build SpendPermission payload.
const permission = {
  account: PARENT_CSW,
  spender: subAccount,
  token: NATIVE,
  allowance: DAILY_CAP.toString(),
  period: PERIOD,
  start: START,
  end: END,
  salt: '0x' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
  extraData: '0x',
}

// 3. Sign EIP-712.
const domain = {
  name: 'Spend Permission Manager',
  version: '1',
  chainId: 8453,
  verifyingContract: SPM,
}
const types = {
  SpendPermission: [
    { name: 'account',    type: 'address' },
    { name: 'spender',    type: 'address' },
    { name: 'token',      type: 'address' },
    { name: 'allowance',  type: 'uint160' },
    { name: 'period',     type: 'uint48' },
    { name: 'start',      type: 'uint48' },
    { name: 'end',        type: 'uint48' },
    { name: 'salt',       type: 'uint256' },
    { name: 'extraData',  type: 'bytes' },
  ],
}

const signature = await account.signTypedData({
  domain, types, primaryType: 'SpendPermission',
  message: {
    ...permission,
    allowance: BigInt(permission.allowance),
    period: permission.period,
    start: permission.start,
    end: permission.end,
    salt: BigInt(permission.salt),
  },
})

console.log('Signature:', signature.slice(0, 20) + '...')

// 4. POST to admin endpoint.
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

console.log('\n-- Request body preview --')
console.log(JSON.stringify(body, null, 2))
console.log('\n-- Posting to ' + PROD_URL + '/api/admin/arch-b/sub-account/provision --')

const res = await fetch(PROD_URL + '/api/admin/arch-b/sub-account/provision', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'authorization': `Bearer ${ADMIN_TOKEN}`,
  },
  body: JSON.stringify(body),
})

const text = await res.text()
console.log('Status:', res.status)
console.log('Response:', text)
if (!res.ok) process.exit(1)