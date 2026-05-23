/**
 * getQuote.ts
 *
 * Server-side helper for fetching a Relay quote for a same-chain (or cross-chain)
 * call-execution flow. Centralizes the upstream call to api.relay.link/quote/v2
 * so both the dapp-facing /api/relay/quote proxy AND the owner-mutation preview
 * handler can share the same parsing + error-handling.
 *
 * Why this exists (2026-05-11):
 *
 * The May 5 owner[3] add (UserOp 0xa9a06340…9a36, bundle 0x34edd28…2aadf) was a
 * two-part Relay **same-chain intent** (originChainId = destinationChainId = 8453)
 * that landed in block 45,600,637:
 *   PART 1 — CSW UserOp → executeBatch → RelayDepository.depositNative(self, id=0x8cc5…797a)
 *   PART 2 — CSW.executeWithoutChainIdValidation → addOwnerAddress(...)
 *
 * Relay's explorer may still label Part 1 as a "same chain cross chain transaction"
 * (~0.000019 ETH on Base). That is intent-settlement UI, not an L2 bridge.
 *
 * The depository orderId 0x8cc5…797a is produced by Relay's solver as part of a
 * /quote response (steps[].requestId OR protocol.v2.orderId, depending on
 * protocol version). To re-create that flow tonight we have to fetch the same
 * kind of quote with our `removeOwnerAtIndex` calldata in `txs[]`.
 *
 * No api key needed for read-only quotes, but we forward RELAY_API_KEY if
 * present (Vercel env) to avoid being rate-limited.
 */

import { logger } from '../../../packages/server-core/src/index.js'
import { RELAY_DEPOSITORY_BASE } from '../../../src/lib/wallet/cswOwnerAbi.js'

const RELAY_QUOTE_URL = 'https://api.relay.link/quote/v2'
const NATIVE_CURRENCY = '0x0000000000000000000000000000000000000000'

export type RelayDestinationCall = {
  to: `0x${string}`
  data: `0x${string}`
  /** Decimal-string wei amount to send with the destination call. Defaults to "0". */
  value?: string
}

export type GetRelayQuoteParams = {
  /** Depositor on origin chain. For owner mutations this is the CSW itself. */
  user: `0x${string}`
  /** Recipient of destination call. For self-mutations this is also the CSW. */
  recipient?: `0x${string}`
  /** Origin chain id. For same-chain Base flows this is 8453. */
  originChainId: number
  /** Destination chain id. For same-chain Base flows this is 8453. */
  destinationChainId: number
  /**
   * Swap base amount in wei. For owner-mutation EXACT_OUTPUT quotes this should
   * match `txs[0].value` (typically `"0"`). Relay prices the Part 1 deposit in
   * `protocol.v2.paymentDetails.amount` — that response field is authoritative.
   */
  amount: string
  /**
   * Owner mutations use `EXACT_OUTPUT` with zero destination value so Relay
   * computes the native deposit for the wrapped CSW mutation call.
   */
  tradeType?: 'EXACT_INPUT' | 'EXACT_OUTPUT'
  /** Array of destination calls. For owner mutations this is the one mutation call. */
  txs: RelayDestinationCall[]
  /**
   * Total gas limit Relay should assume for the destination call(s). When
   * omitted, Relay estimates. For the multicall+handleOps pattern Base App's
   * solver uses, ~250k is sufficient for a removeOwner mutation.
   */
  txsGasLimit?: number
  /** Relay dashboard source tag for attribution (optional). */
  source?: string
}

/**
 * One on-chain transaction the user must submit. Comes from
 * steps[].items[].data in the Relay /quote response. For same-chain native
 * call-execution flows this is a single tx to RelayRouterV3 whose calldata
 * embeds:
 *   1. RelayDepository.depositNative(user, requestId)  (the pre-fund)
 *   2. cleanupNative  (Relay router housekeeping)
 *
 * The destination call (e.g. our removeOwnerAtIndex) is NOT in this calldata.
 * Relay's solver pre-signs and submits the destination UserOp from its own
 * infrastructure when it sees the requestId deposit event land on-chain.
 * Both transactions end up in the same Base block (see May 5 reference flow
 * documented in 4626_csw_owner_mutation_compiled.html).
 */
export type RelayUserTransaction = {
  to: `0x${string}`
  data: `0x${string}`
  /** Decimal-string wei amount. */
  value: string
  chainId: number
}

export type RelayPaymentDetails = {
  chainId: number | null
  depository: `0x${string}` | null
  currency: `0x${string}` | null
  amount: string | null
}

export type RelayQuoteExtract = {
  /**
   * The Relay request id. Used by Relay's solver to match the deposit event
   * to the queued destination call. We surface it for diagnostics + status
   * polling (Relay's /intents/status?requestId=... endpoint).
   */
  requestId: `0x${string}` | null
  /** Protocol v2 order id (same semantic id as requestId when present). */
  orderId: `0x${string}` | null
  /** Protocol v2 payment details used for request-bound deposits. */
  paymentDetails: RelayPaymentDetails | null
  /**
   * The single on-chain transaction the user must submit (Part 1). Sending
   * this via wallet_sendCalls executes the deposit; Relay's solver handles
   * the rest. May be null if Relay returned no transaction step.
   */
  userTransaction: RelayUserTransaction | null
  /** ETH gas-fee component as USD decimals (Relay's quoted fee). */
  feeUsd: string | null
  /** The raw Relay response in full, for diagnostics + downstream parsing. */
  raw: unknown
}

export type GetRelayQuoteResult =
  | { ok: true; extract: RelayQuoteExtract; status: number }
  | { ok: false; status: number; error: string; raw?: unknown }

function resolveRelayApiKey(): string | null {
  const candidates = ['RELAY_API_KEY', 'VITE_RELAY_API_KEY', 'RELAY_LINK_API_KEY']
  for (const key of candidates) {
    const raw = (globalThis as any)?.process?.env?.[key]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
  }
  return null
}

function asHex32(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  return /^0x[0-9a-fA-F]{64}$/.test(value) ? (value as `0x${string}`) : null
}

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as `0x${string}`) : null
}

function asDecimalString(value: unknown): string | null {
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return value
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value).toString(10)
  }
  return null
}

function asHexString(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  return /^0x[0-9a-fA-F]*$/.test(value) && value.length % 2 === 0
    ? (value as `0x${string}`)
    : null
}

function collectCandidateObjects(root: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const seen = new Set<unknown>()
  const stack: unknown[] = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    const obj = current as Record<string, unknown>
    out.push(obj)
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object') stack.push(value)
    }
  }
  return out
}

function normalizePaymentDetailsCandidate(
  candidate: Record<string, unknown> | null | undefined,
): RelayPaymentDetails | null {
  if (!candidate) return null
  const depository = asAddress(
    candidate.depository ??
      candidate.depositoryAddress ??
      candidate.depositAddress ??
      candidate.to ??
      null,
  )
  const currency = asAddress(candidate.currency ?? candidate.token ?? null)
  const amount = asDecimalString(candidate.amount)
  const chainCandidate = candidate.chainId ?? candidate.chain ?? candidate.destinationChainId
  const chainId =
    typeof chainCandidate === 'number' && Number.isFinite(chainCandidate)
      ? chainCandidate
      : typeof chainCandidate === 'string' && chainCandidate.trim()
        ? Number(chainCandidate)
        : null
  if (!depository && !amount) return null
  return {
    chainId: Number.isFinite(chainId as number) ? (chainId as number) : null,
    depository,
    currency,
    amount,
  }
}

function findPaymentDetailsInRaw(raw: unknown): RelayPaymentDetails | null {
  if (!raw || typeof raw !== 'object') return null
  const objects = collectCandidateObjects(raw)
  for (const obj of objects) {
    const keyHit = Object.keys(obj).some((k) =>
      ['paymentdetails', 'depository', 'depositaddress'].includes(k.toLowerCase()),
    )
    if (!keyHit) continue
    const normalized = normalizePaymentDetailsCandidate(obj)
    if (normalized?.amount && normalized.depository) return normalized
  }
  return null
}

/**
 * Extracts the fields we care about from a Relay /quote/v2 response:
 *   - requestId (for status polling and matching)
 *   - the single user transaction (the deposit tx the wallet must submit)
 *   - fee info for display
 *
 * The user transaction comes from steps[0].items[0].data when Relay returns a
 * router multicall for EOA funders. CSW self-auth Part 1 ignores that step and
 * builds Depository.depositNative from protocol.v2 paymentDetails instead.
 */
export function extractFromRelayQuoteResponse(raw: unknown): RelayQuoteExtract {
  const extract: RelayQuoteExtract = {
    requestId: null,
    orderId: null,
    paymentDetails: null,
    userTransaction: null,
    feeUsd: null,
    raw,
  }
  if (!raw || typeof raw !== 'object') return extract
  const obj = raw as Record<string, unknown>

  const steps = Array.isArray(obj.steps) ? obj.steps : []
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue
    const stepObj = step as Record<string, unknown>

    if (!extract.requestId) {
      const candidate = asHex32(stepObj.requestId)
      if (candidate) extract.requestId = candidate
    }

    if (extract.userTransaction) continue
    if (stepObj.kind !== 'transaction') continue
    const items = Array.isArray(stepObj.items) ? stepObj.items : []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const data = (item as Record<string, unknown>).data
      if (!data || typeof data !== 'object') continue
      const d = data as Record<string, unknown>
      const to = asAddress(d.to)
      const calldata = asHexString(d.data)
      const value = asDecimalString(d.value) ?? '0'
      const chainId =
        typeof d.chainId === 'number' && Number.isFinite(d.chainId)
          ? d.chainId
          : Number(d.chainId)
      if (to && calldata && Number.isFinite(chainId)) {
        extract.userTransaction = { to, data: calldata, value, chainId }
        break
      }
    }
  }

  // Fallback: protocol.v2.orderId. Older quote shapes used this instead of
  // steps[].requestId; carry it through as the requestId for diagnostics.
  if (!extract.requestId || !extract.orderId || !extract.paymentDetails) {
    const protocol = obj.protocol as Record<string, unknown> | undefined
    const v2 = protocol?.v2 as Record<string, unknown> | undefined
    if (v2) {
      const v2OrderId = asHex32(v2.orderId)
      if (v2OrderId) {
        if (!extract.requestId) extract.requestId = v2OrderId
        extract.orderId = v2OrderId
      }

      const paymentRaw = v2.paymentDetails as Record<string, unknown> | undefined
      const normalized = normalizePaymentDetailsCandidate(paymentRaw)
      if (normalized) {
        extract.paymentDetails = normalized
      }
    }
  }

  if (!extract.paymentDetails) {
    const fromRaw = findPaymentDetailsInRaw(raw)
    if (fromRaw) {
      extract.paymentDetails = fromRaw
    }
  }

  // Some quote shapes expose only details.currencyIn.amount (no explicit
  // paymentDetails block). Use that amount as a conservative fallback so
  // request-bound submissions can still surface required funding in UI.
  if (!extract.paymentDetails?.amount) {
    const details = obj.details as Record<string, unknown> | undefined
    const currencyIn = details?.currencyIn as Record<string, unknown> | undefined
    const currencyInObj = currencyIn?.currency as Record<string, unknown> | undefined
    const currencyInAddress = asAddress(currencyInObj?.address ?? null)
    const amountFromCurrencyIn = asDecimalString(currencyIn?.amount)
    if (
      amountFromCurrencyIn &&
      currencyInAddress &&
      currencyInAddress.toLowerCase() === NATIVE_CURRENCY.toLowerCase()
    ) {
      extract.paymentDetails = {
        chainId: extract.paymentDetails?.chainId ?? 8453,
        depository: extract.paymentDetails?.depository ?? RELAY_DEPOSITORY_BASE,
        currency: extract.paymentDetails?.currency ?? currencyInAddress,
        amount: amountFromCurrencyIn,
      }
    }
  }

  if (extract.paymentDetails?.amount && !extract.paymentDetails.depository) {
    extract.paymentDetails = {
      ...extract.paymentDetails,
      chainId: extract.paymentDetails.chainId ?? 8453,
      depository: RELAY_DEPOSITORY_BASE,
    }
  }

  // Quoted gas-fee in USD decimal (informational only).
  const fees = obj.fees as Record<string, unknown> | undefined
  const gas = fees?.gas as Record<string, unknown> | undefined
  if (gas) {
    const amountUsd = gas.amountUsd
    if (typeof amountUsd === 'string' || typeof amountUsd === 'number') {
      extract.feeUsd = String(amountUsd)
    }
  }

  return extract
}

export async function getRelayQuote(
  params: GetRelayQuoteParams,
): Promise<GetRelayQuoteResult> {
  const payload = {
    user: params.user,
    recipient: params.recipient ?? params.user,
    originChainId: params.originChainId,
    destinationChainId: params.destinationChainId,
    originCurrency: NATIVE_CURRENCY,
    destinationCurrency: NATIVE_CURRENCY,
    amount: params.amount,
    tradeType: params.tradeType ?? 'EXACT_OUTPUT',
    // CSW / smart-wallet deposits require explicit depository flow (Relay v2).
    explicitDeposit: true,
    // Match relay-kit owner-mutation examples: sponsor solver fees where configured.
    subsidizeFees: true,
    originGasOverhead: 300_000,
    ...(params.source ? { source: params.source } : {}),
    txs: params.txs.map((tx) => ({
      to: tx.to,
      data: tx.data,
      value: tx.value ?? '0',
    })),
    ...(typeof params.txsGasLimit === 'number'
      ? { txsGasLimit: params.txsGasLimit }
      : {}),
  }

  const apiKey = resolveRelayApiKey()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['x-api-key'] = apiKey

  let upstream: Response
  try {
    upstream = await fetch(RELAY_QUOTE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch (error) {
    logger.warn('[relay/getQuote] upstream fetch failed', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    })
    return {
      ok: false,
      status: 502,
      error: 'Failed to reach Relay /quote/v2',
    }
  }

  const text = await upstream.text().catch(() => '')
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!upstream.ok) {
    const message =
      body && typeof body === 'object'
        ? String(
            (body as Record<string, unknown>).message ??
              (body as Record<string, unknown>).error ??
              '',
          )
        : String(body ?? '')
    logger.warn('[relay/getQuote] upstream rejected', {
      status: upstream.status,
      message,
    })
    return {
      ok: false,
      status: upstream.status,
      error: message
        ? `Relay /quote/v2 (${upstream.status}): ${message}`
        : `Relay /quote/v2 failed with status ${upstream.status}`,
      raw: body,
    }
  }

  return {
    ok: true,
    status: 200,
    extract: extractFromRelayQuoteResponse(body),
  }
}
