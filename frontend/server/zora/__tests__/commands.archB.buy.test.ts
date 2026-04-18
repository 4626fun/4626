/**
 * Regression tests for handleBuyViaArchB (ARCH_B_COIN_BUY_VIA_USEROP).
 *
 * Verifies:
 *  - issuer not provisioned -> typed refusal (not_provisioned branch)
 *  - issuer revoked -> typed refusal (revoked branch)
 *  - issuer db_unavailable -> typed refusal (db_unavailable branch)
 *  - TEE attestation denied -> typed refusal
 *  - router target NOT on allowlist, mode=observe -> allows, logs warning
 *  - router target NOT on allowlist, mode=enforce -> typed refusal
 *  - caps exceeded (submitUserOpOrRefuse returns ok:false) -> refusal surfaces
 *  - happy path -> ok:true with txHash, userOpHash, buyer=CSW, action zora.coin.bought + routing arch-b-userop
 *  - invalid coin address -> usage error
 *  - out-of-range ETH amount -> error
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

// Feature flag must be set before module import so commands.ts takes the Arch B branch.
process.env.ARCH_B_COIN_BUY_VIA_USEROP = '1'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const resolveContextMock = vi.fn()
const attestationGateMock = vi.fn()
const submitUserOpMock = vi.fn()
const warnMock = vi.fn()
const checkRouterTargetMock = vi.fn()
const walletRpcMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('../../_lib/wallet/commandIssuerContext.js', () => ({
	resolveCommandIssuerContextByAddress: (...args: unknown[]) => resolveContextMock(...args),
	isExecutionReady: (resolution: { status: string }) => resolution.status === 'ready',
}))

vi.mock('../../_lib/wallet/userOperationSubmitter.js', () => ({
	isArchBCoinBuyViaUserOpEnabled: () => true,
	submitUserOpOrRefuse: (...args: unknown[]) => submitUserOpMock(...args),
}))

vi.mock('../../_lib/agent/teeAttestationGate.js', () => ({
	assertTeeAttestationOrThrow: (...args: unknown[]) => attestationGateMock(...args),
}))

vi.mock('../routerAllowlist.js', () => ({
	checkRouterTarget: (...args: unknown[]) => checkRouterTargetMock(...args),
}))

vi.mock('../../_lib/infra/logger.js', () => ({
	logger: {
		info: vi.fn(),
		warn: (...args: unknown[]) => warnMock(...args),
		error: vi.fn(),
	},
}))

// Stub the legacy agent-wallet path -- should never be reached under Arch B.
vi.mock('../../_lib/wallet/privyWalletApi.js', () => ({
	walletRpc: (...args: unknown[]) => walletRpcMock(...args),
	BASE_CAIP2: 'eip155:8453',
}))

vi.mock('../../_lib/wallet/walletBalancePreflight.js', () => ({
	buildInsufficientFundsRefusal: () => 'friendly',
	checkWalletBalancePreflight: vi.fn(),
	getBasePreflightPublicClient: vi.fn(),
	isInsufficientFundsError: () => false,
}))

vi.mock('../../_lib/wallet/creatorAgentWallets.js', () => ({
	getOrCreateCreatorAgentWallet: vi.fn().mockResolvedValue({ walletId: 'legacy', address: '0x0' }),
}))

vi.mock('@zoralabs/coins-sdk', () => ({
	getTradeQuote: vi.fn(),
	getCoin: vi.fn(),
	createCoinCall: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SENDER = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')
const CSW    = getAddress('0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
const COIN   = getAddress('0x1234567890123456789012345678901234567890')
const VAULT  = {
	vaultAddress: getAddress('0x2222222222222222222222222222222222222222'),
	creatorCoinAddress: COIN,
} as any

const READY_CONTEXT = {
	profileId: 7,
	smartWallet: CSW,
	privyOwnerWalletId: 'privy-xyz',
	ownerEoa: getAddress('0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3'),
	ownerIndex: 0,
	paymasterPolicy: 'cdp_default',
	capsVersion: 1,
	perTxCapWei: 10_000_000_000_000_000n,
	dailyCapWei: 50_000_000_000_000_000n,
	provisionedAt: new Date(),
	revokedAt: null,
}

// Fake Zora Quote API response body.
const MOCK_CALL = {
	target: '0x6ff5693b99212da76ad316178a184ab56d299b43',
	data: '0xdeadbeef',
	value: '1000000000000000',
}

function mockQuoteResponse() {
	fetchMock.mockResolvedValue({
		ok: true,
		json: async () => ({ call: MOCK_CALL }),
		text: async () => '',
	})
}

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

const { handleCoinCommand } = await import('../commands.js')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Auto-incrementing group id to avoid rate-limit collisions between tests.
let _groupCounter = 0

/** Build a handleCoinCommand call for /coin buy <coin> <amount>. */
function callBuy(overrides: { coin?: string; amount?: string; groupId?: string; role?: string } = {}) {
	const coin   = overrides.coin   ?? COIN
	const amount = overrides.amount ?? '0.001'
	const groupId = overrides.groupId ?? `g-test-${++_groupCounter}`
	return handleCoinCommand({
		groupId,
		senderWallet: SENDER,
		text: `/coin buy ${coin} ${amount}`,
		role: (overrides.role ?? 'ADMIN') as any,
		vault: VAULT,
	})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleCoinCommand -- /coin buy via Architecture B', () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Patch global fetch so getTradeQuoteWithReferrer is controlled.
		vi.stubGlobal('fetch', fetchMock)

		// Default: attestation passes, router check allowed.
		attestationGateMock.mockResolvedValue(undefined)
		checkRouterTargetMock.mockReturnValue({ allowed: true })
		mockQuoteResponse()

		delete process.env.ARCH_B_ROUTER_ALLOWLIST_MODE
	})

	// -----------------------------------------------------------------------
	// Issuer readiness branches
	// -----------------------------------------------------------------------

	it('hard-fails with friendly refusal when issuer is not provisioned', async () => {
		resolveContextMock.mockResolvedValue({ status: 'not_provisioned', profileId: null })

		const result = await callBuy()

		expect(result.ok).toBe(false)
		expect(result.response).toContain("isn't provisioned")
		expect(submitUserOpMock).not.toHaveBeenCalled()
		expect(walletRpcMock).not.toHaveBeenCalled()
	})

	it('hard-fails with revoked-context refusal when issuer is revoked', async () => {
		resolveContextMock.mockResolvedValue({
			status: 'revoked',
			profileId: 7,
			revokedAt: new Date(),
			reason: 'key_compromise',
		})

		const result = await callBuy()

		expect(result.ok).toBe(false)
		expect(result.response).toContain('revoked')
		expect(submitUserOpMock).not.toHaveBeenCalled()
	})

	it('hard-fails with db_unavailable refusal when DB is down', async () => {
		resolveContextMock.mockResolvedValue({ status: 'db_unavailable' })

		const result = await callBuy()

		expect(result.ok).toBe(false)
		expect(result.response).toContain('temporarily unavailable')
		expect(submitUserOpMock).not.toHaveBeenCalled()
	})

	// -----------------------------------------------------------------------
	// TEE attestation gate
	// -----------------------------------------------------------------------

	it('returns typed refusal when TEE attestation gate throws', async () => {
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
		attestationGateMock.mockRejectedValue(new Error('TEE offline'))

		const result = await callBuy()

		expect(result.ok).toBe(false)
		expect(result.response).toContain('attestation')
		expect(submitUserOpMock).not.toHaveBeenCalled()
	})

	// -----------------------------------------------------------------------
	// Router allowlist -- observe mode
	// -----------------------------------------------------------------------

	it('allows trade when unknown router target appears in observe mode', async () => {
		process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'observe'
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
		checkRouterTargetMock.mockReturnValue({ allowed: true, observed: true })
		submitUserOpMock.mockResolvedValue({
			ok: true,
			userOpHash: '0xuop1',
			txHash: '0xtx1',
			smartWallet: CSW,
		})

		const result = await callBuy()

		expect(result.ok).toBe(true)
		expect(submitUserOpMock).toHaveBeenCalledTimes(1)
	})

	// -----------------------------------------------------------------------
	// Router allowlist -- enforce mode
	// -----------------------------------------------------------------------

	it('blocks trade and returns typed refusal when router target blocked (enforce mode)', async () => {
		process.env.ARCH_B_ROUTER_ALLOWLIST_MODE = 'enforce'
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
		checkRouterTargetMock.mockReturnValue({
			allowed: false,
			reason: 'Router target 0xbad... is not on the allowlist.',
		})

		const result = await callBuy()

		expect(result.ok).toBe(false)
		expect(result.response).toMatch(/blocked|approved list/)
		expect(submitUserOpMock).not.toHaveBeenCalled()
	})

	// -----------------------------------------------------------------------
	// Caps exceeded
	// -----------------------------------------------------------------------

	it('surfaces submitter refusal when caps exceeded', async () => {
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
		submitUserOpMock.mockResolvedValue({
			ok: false,
			code: 'cap_exceeded',
			scope: 'per_tx',
			limitWei: READY_CONTEXT.perTxCapWei,
			requestedWei: READY_CONTEXT.perTxCapWei + 1n,
			alreadySpentWei: 0n,
			response: "This trade can't be executed right now -- per-transaction cap exceeded.",
		})

		const result = await callBuy()

		expect(result.ok).toBe(false)
		expect(result.response).toContain('per-transaction cap')
	})

	// -----------------------------------------------------------------------
	// Happy path
	// -----------------------------------------------------------------------

	it('returns ok:true with txHash, userOpHash, buyer=CSW, and correct action on success', async () => {
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
		submitUserOpMock.mockResolvedValue({
			ok: true,
			userOpHash: '0xuophappy',
			txHash: '0xtxhappy',
			smartWallet: CSW,
		})

		const result = await callBuy()

		expect(result.ok).toBe(true)
		expect(result.response).toContain('Coin purchased')
		expect(result.response).toContain('0xtxhappy')
		expect(result.response.toLowerCase()).toContain(CSW.toLowerCase())

		const action = (result as any).action
		expect(action.action).toBe('zora.coin.bought')
		expect(action.routing).toBe('arch-b-userop')
		expect(action.txHash).toBe('0xtxhappy')
		expect(action.userOpHash).toBe('0xuophappy')
		expect(action.buyer.toLowerCase()).toBe(CSW.toLowerCase())
		expect(action.coinAddress.toLowerCase()).toBe(COIN.toLowerCase())

		expect(walletRpcMock).not.toHaveBeenCalled()
	})

	it('passes the correct correlationId and issuer context to submitUserOpOrRefuse', async () => {
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })
		submitUserOpMock.mockResolvedValue({
			ok: true,
			userOpHash: '0xuop',
			txHash: '0xtx',
			smartWallet: CSW,
		})

		await callBuy({ groupId: 'g-correlate' })

		expect(submitUserOpMock).toHaveBeenCalledTimes(1)
		const arg = submitUserOpMock.mock.calls[0][0]
		expect(arg.correlationId).toBe('coin/buy/arch-b:g-correlate')
		expect(arg.issuer).toBe(READY_CONTEXT)
		expect(arg.calls).toHaveLength(1)
		expect(arg.idempotencyKey).toBeUndefined()
	})

	// -----------------------------------------------------------------------
	// Invalid args
	// -----------------------------------------------------------------------

	it('returns usage error for invalid coin address', async () => {
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })

		const result = await callBuy({ coin: 'not-an-address' })

		expect(result.ok).toBe(false)
		expect(result.response).toContain('Usage:')
		expect(submitUserOpMock).not.toHaveBeenCalled()
	})

	it('returns error for out-of-range ETH amount', async () => {
		resolveContextMock.mockResolvedValue({ status: 'ready', context: READY_CONTEXT })

		const result = await callBuy({ amount: '999' })

		expect(result.ok).toBe(false)
		expect(result.response).toContain('Invalid amount')
		expect(submitUserOpMock).not.toHaveBeenCalled()
	})
})
