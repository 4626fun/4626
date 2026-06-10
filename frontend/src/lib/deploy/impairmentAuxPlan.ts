import {
  concatHex,
  encodeAbiParameters,
  encodePacked,
  getCreate2Address,
  keccak256,
  type Address,
  type Hex,
} from 'viem'
// Relative import (not `@/`) so server-side consumers (paymaster) can resolve this
// module through `frontend/shared/deploy/impairmentAuxPlan.ts` without Vite aliases.
import { DEPLOY_BYTECODE } from '../../deploy/bytecode.generated.js'

/**
 * Canonical permissionless CREATE2 deployer (Arachnid deterministic-deployment-proxy).
 * Deployed at the same address on Base mainnet and every major EVM chain.
 * Calldata shape: 32-byte salt ++ initcode; deploys via CREATE2 from any caller.
 *
 * We use it (instead of UniversalCreate2DeployerFromStore) for the per-vault
 * impairment aux pair because creator CSWs are intentionally NOT authorized on
 * the ACL-gated store deployer, and this pair is tiny, vault-scoped, and
 * deployed from the creator's own Phase 3 batch.
 */
export const PERMISSIONLESS_CREATE2_DEPLOYER: Address = '0x4e59b44847b379578588920cA78FbF26c0B4956C'

const CLAIMS_SALT_DOMAIN = '4626.impairment.claims.v1'
const ESCROW_SALT_DOMAIN = '4626.impairment.escrow.v1'

export interface ImpairmentAuxContractPlan {
  /** Predicted CREATE2 address for this aux contract. */
  address: Address
  /** CREATE2 salt (domain-separated, bound to the target vault). */
  salt: Hex
  /** Creation bytecode + abi-encoded constructor args. */
  initCode: Hex
  /** Raw calldata for the permissionless CREATE2 deployer (salt ++ initcode). */
  deployCallData: Hex
}

export interface ImpairmentAuxPlan {
  claims: ImpairmentAuxContractPlan
  escrow: ImpairmentAuxContractPlan
}

function buildContractPlan(creationCode: Hex, saltDomain: string, vault: Address, initialOwner: Address): ImpairmentAuxContractPlan {
  const constructorArgs = encodeAbiParameters([{ type: 'address' }], [initialOwner])
  const initCode = concatHex([creationCode, constructorArgs])
  const salt = keccak256(encodePacked(['string', 'address'], [saltDomain, vault]))
  const address = getCreate2Address({
    from: PERMISSIONLESS_CREATE2_DEPLOYER,
    salt,
    bytecode: initCode,
  })
  return {
    address,
    salt,
    initCode,
    deployCallData: concatHex([salt, initCode]),
  }
}

/**
 * Per-vault impairment aux pair (CreatorOImpairmentClaims + CreatorORecoveryEscrow).
 *
 * Both contracts are deployed fresh per vault with `initialOwner` = the deploy owner
 * (creator CSW) so the same Phase 3 batch can call `setVault(...)`, then ownership
 * is transferred to the protocol treasury for ongoing monitoring/custody of the
 * emergency-safety levers.
 */
export function buildImpairmentAuxPlan(params: { vault: Address; initialOwner: Address }): ImpairmentAuxPlan {
  return {
    claims: buildContractPlan(
      DEPLOY_BYTECODE.CreatorOImpairmentClaims as Hex,
      CLAIMS_SALT_DOMAIN,
      params.vault,
      params.initialOwner,
    ),
    escrow: buildContractPlan(
      DEPLOY_BYTECODE.CreatorORecoveryEscrow as Hex,
      ESCROW_SALT_DOMAIN,
      params.vault,
      params.initialOwner,
    ),
  }
}
