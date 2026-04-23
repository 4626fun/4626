/**
 * `usePayWithX402` — React hook that turns the x402 HTTP 402 flow into
 * a single awaitable `pay(...)` call backed by the user's connected
 * wallet.
 *
 * Under the hood:
 *   1. POST /api/creator/strategy/x402-activate (no X-PAYMENT header)
 *      → expects 402 with `{ accepts: [{ pay_to, asset, max_amount_required, ... }] }`
 *   2. Build an EIP-3009 `TransferWithAuthorization` typed-data payload
 *      against Base USDC (`0x833589fc…02913`)
 *   3. `walletClient.signTypedData(...)` — produces a 65-byte compact
 *      v/r/s signature. Wallets that support EIP-3009 natively (Coinbase
 *      Wallet, Rainbow) sign without showing a "contract interaction"
 *      warning; wallets that don't (older MetaMask) will also still sign
 *      the typed data, but the UX is worse.
 *   4. Base64-encode `{scheme, network, x402_version, payload: {authorization, signature}}`
 *      into the `X-PAYMENT` request header and re-POST.
 *   5. Server's `settleX402Payment` broadcasts `usdc.transferWithAuthorization(...)`
 *      from its relayer EOA (pays Base gas), the activation row is created,
 *      200 response.
 *
 * Gasless for the creator: the relayer account pays the Base gas to
 * broadcast the signed authorization; the creator only signs off-chain.
 */

import { useCallback, useState } from 'react'
import {
  getAddress,
  toHex,
  type Address,
  type Hex,
} from 'viem'
import { useAccount, useWalletClient } from 'wagmi'

/**
 * EIP-712 domain for the canonical Circle-issued USDC contract on Base.
 * `name` + `version` are on-chain constants; changing them breaks
 * EIP-3009 signature verification.
 */
const USDC_EIP712_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

export type X402PaymentRequirements = {
  x402_version: 1
  accepts: {
    scheme: 'exact'
    network: 'base'
    asset: Address
    pay_to: Address
    max_amount_required: string
    max_timeout_seconds: number
    mime_type: 'application/json'
    description?: string
    resource?: string
  }[]
  error?: string
}

export type PayWithX402Input = {
  creatorToken: Address
  featureKey: string
  /** Defaults to `/api/creator/strategy/x402-activate` at the current origin. */
  endpoint?: string
}

export type PayWithX402Status =
  | { phase: 'idle' }
  | { phase: 'requesting_402' }
  | { phase: 'signing' }
  | { phase: 'settling'; txHash?: Hex }
  | { phase: 'success'; txHash: Hex; activationId: number | null }
  | { phase: 'error'; reason: string; message: string }

function random32ByteHex(): Hex {
  // 32 random bytes for EIP-3009 nonce. Uses crypto.getRandomValues so
  // the nonce is unguessable (replay protection).
  const buf = new Uint8Array(32)
  ;(globalThis.crypto ?? (globalThis as any).msCrypto).getRandomValues(buf)
  // Prefix with 0x, lowercase — matches what our server's isHex32 check accepts.
  return toHex(buf)
}

export function usePayWithX402() {
  const { address: connectedAddress } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [status, setStatus] = useState<PayWithX402Status>({ phase: 'idle' })

  const pay = useCallback(
    async (input: PayWithX402Input): Promise<PayWithX402Status> => {
      const finish = (s: PayWithX402Status): PayWithX402Status => {
        setStatus(s)
        return s
      }

      if (!connectedAddress) {
        return finish({
          phase: 'error',
          reason: 'wallet_not_connected',
          message: 'No wallet connected. Connect a wallet that supports EIP-3009 signing (Coinbase Wallet, Rainbow).',
        })
      }
      if (!walletClient) {
        return finish({
          phase: 'error',
          reason: 'wallet_client_unavailable',
          message: 'Wallet client not ready yet — try again in a moment.',
        })
      }

      const endpoint = input.endpoint ?? '/api/creator/strategy/x402-activate'

      // ─── 1. Ask the server for payment requirements. ───
      setStatus({ phase: 'requesting_402' })
      let requirements: X402PaymentRequirements
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            creatorToken: input.creatorToken,
            featureKey: input.featureKey,
          }),
        })
        if (res.status !== 402) {
          const text = await res.text().catch(() => '')
          return finish({
            phase: 'error',
            reason: 'unexpected_status',
            message: `Expected 402 Payment Required, got ${res.status}. ${text.slice(0, 200)}`,
          })
        }
        requirements = (await res.json()) as X402PaymentRequirements
      } catch (err) {
        return finish({
          phase: 'error',
          reason: 'requirements_fetch_failed',
          message: err instanceof Error ? err.message : String(err),
        })
      }

      const req = requirements.accepts?.[0]
      if (!req) {
        return finish({
          phase: 'error',
          reason: 'no_accepts_entry',
          message: '402 response had no `accepts` entries',
        })
      }
      if (req.scheme !== 'exact' || req.network !== 'base') {
        return finish({
          phase: 'error',
          reason: 'unsupported_scheme_or_network',
          message: `Unsupported scheme/network: ${req.scheme}/${req.network}`,
        })
      }

      // ─── 2. Build EIP-3009 TransferWithAuthorization typed data. ───
      const nowSec = BigInt(Math.floor(Date.now() / 1000))
      const validAfter = 0n
      // Server's default timeout is 300s; pad to 280s to give the client
      // a window for signing + network hops.
      const validBefore = nowSec + BigInt(Math.max(60, (req.max_timeout_seconds ?? 300) - 20))

      const authorization = {
        from: getAddress(connectedAddress as Address),
        to: getAddress(req.pay_to),
        value: BigInt(req.max_amount_required),
        validAfter,
        validBefore,
        nonce: random32ByteHex(),
      }

      // ─── 3. Ask the wallet to sign. ───
      setStatus({ phase: 'signing' })
      let signature: Hex
      try {
        signature = await walletClient.signTypedData({
          account: connectedAddress as Address,
          domain: USDC_EIP712_DOMAIN,
          types: EIP3009_TYPES,
          primaryType: 'TransferWithAuthorization',
          message: authorization,
        })
      } catch (err) {
        return finish({
          phase: 'error',
          reason: 'signing_rejected',
          message: err instanceof Error ? err.message : String(err),
        })
      }

      // ─── 4. Base64-encode the payload into X-PAYMENT and re-POST. ───
      const xPayment = {
        scheme: 'exact' as const,
        network: 'base' as const,
        x402_version: 1 as const,
        payload: {
          authorization: {
            from: authorization.from,
            to: authorization.to,
            value: authorization.value.toString(),
            validAfter: authorization.validAfter.toString(),
            validBefore: authorization.validBefore.toString(),
            nonce: authorization.nonce,
          },
          signature,
        },
      }
      const xPaymentHeader = toBase64(JSON.stringify(xPayment))

      setStatus({ phase: 'settling' })
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            'x-payment': xPaymentHeader,
          },
          body: JSON.stringify({
            creatorToken: input.creatorToken,
            featureKey: input.featureKey,
          }),
        })
        const json = (await res.json().catch(() => null)) as
          | { success: boolean; data?: { activation?: { id?: number }; x402?: { txHash?: Hex } }; error?: string }
          | null
        if (!res.ok || !json?.success) {
          return finish({
            phase: 'error',
            reason: 'settle_failed',
            message: json?.error ?? `HTTP ${res.status}`,
          })
        }
        const txHash = (json.data?.x402?.txHash ?? '0x') as Hex
        const activationId = json.data?.activation?.id ?? null
        return finish({
          phase: 'success',
          txHash,
          activationId,
        })
      } catch (err) {
        return finish({
          phase: 'error',
          reason: 'settle_network_error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [connectedAddress, walletClient],
  )

  return { pay, status, reset: () => setStatus({ phase: 'idle' }) }
}

/**
 * Browser-safe base64 encode. Using `btoa` trips up on non-ASCII
 * content, but our JSON payload is strictly ASCII (hex + decimal strings
 * + fixed scheme labels), so `btoa` is correct here and avoids pulling
 * in a polyfill.
 */
function toBase64(input: string): string {
  if (typeof btoa === 'function') return btoa(input)
  // Node fallback for SSR / tests.
  return (globalThis as any).Buffer.from(input, 'utf8').toString('base64')
}
