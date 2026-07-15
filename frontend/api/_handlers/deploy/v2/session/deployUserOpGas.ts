/**
 * Fat deploy stages (esp. phase2 core CREATE2 fan-out) use ~10–16M execution gas.
 * Viem's default estimate path seeds callGasLimit=0, which reverts on these ops
 * before a real estimate can complete.
 *
 * Coinbase Smart Wallet uses EntryPoint 0.6. Do not attach EP0.7-only
 * paymasterVerificationGasLimit / paymasterPostOpGasLimit — CDP rejects them on
 * pm_getPaymasterData. Do not pass gas into sendUserOperation args either:
 * pm_getPaymasterStubData runs before gas fill and expects zeroish gas.
 *
 * Keep verification/preVerification close to normal sponsored sizes so total
 * UserOp gas stays under CDP bundler caps (oversized totals return
 * "Missing or invalid parameters" on eth_sendUserOperation).
 *
 * Attach via account.userOperation.estimateGas so stub stays zeroish and the
 * EP0.6 gas trio skips the failing zero-seed estimate.
 */
export const DEPLOY_SESSION_USEROP_GAS = {
  // ~16.4M observed on phase2 executeBatch; leave a small buffer.
  callGasLimit: 16_750_000n,
  verificationGasLimit: 800_000n,
  preVerificationGas: 200_000n,
} as const

type AccountWithUserOpGas = {
  userOperation?: {
    estimateGas?: (userOperation: unknown) => Promise<Record<string, bigint>> | Record<string, bigint>
    [key: string]: unknown
  }
  [key: string]: unknown
}

export function withDeploySessionUserOpGas<T extends AccountWithUserOpGas>(account: T): T {
  const previous = account.userOperation
  return {
    ...account,
    userOperation: {
      ...previous,
      estimateGas: async (userOperation: unknown) => {
        if (typeof previous?.estimateGas === 'function') {
          const estimated = await previous.estimateGas(userOperation)
          return { ...estimated, ...DEPLOY_SESSION_USEROP_GAS }
        }
        return { ...DEPLOY_SESSION_USEROP_GAS }
      },
    },
  }
}
