/**
 * Fat deploy stages (esp. phase2 core CREATE2 fan-out) use ~10–16M execution gas.
 * Viem's default estimate path seeds callGasLimit=0, which reverts on these ops
 * before a real estimate can complete.
 *
 * Do NOT pass these gas fields into sendUserOperation args: pm_getPaymasterStubData
 * runs before gas fill and Coinbase CDP rejects non-zero / EP0.7 paymaster gas on stub.
 * Attach via account.userOperation.estimateGas so stub stays zeroish and estimation is skipped.
 */
export const DEPLOY_SESSION_USEROP_GAS = {
  callGasLimit: 20_000_000n,
  verificationGasLimit: 3_000_000n,
  preVerificationGas: 2_000_000n,
  paymasterVerificationGasLimit: 500_000n,
  paymasterPostOpGasLimit: 250_000n,
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
