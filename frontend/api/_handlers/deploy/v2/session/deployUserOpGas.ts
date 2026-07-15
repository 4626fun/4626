/**
 * Fat deploy stages (esp. phase2 core CREATE2 fan-out) use ~10–16M execution gas.
 * Viem's default estimate path seeds callGasLimit=0, which reverts on these ops
 * before a real estimate can complete. Supplying all gas fields skips estimation.
 */
export const DEPLOY_SESSION_USEROP_GAS = {
  callGasLimit: 20_000_000n,
  verificationGasLimit: 3_000_000n,
  preVerificationGas: 2_000_000n,
  paymasterVerificationGasLimit: 500_000n,
  paymasterPostOpGasLimit: 250_000n,
} as const
