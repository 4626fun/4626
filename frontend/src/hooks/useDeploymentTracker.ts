import { useCallback, useMemo } from 'react'
import type { Address } from 'viem'

/**
 * Deployment record stored in localStorage.
 * Tracks a single deployment per owner address per deployment version.
 */
export interface DeploymentRecord {
  /** The creator token (Zora coin) address deployed for */
  creatorToken: Address
  /** The owner address (canonical Zora Coinbase Smart Wallet) */
  owner: Address
  /** Deployment version from VITE_DEPLOYMENT_VERSION */
  version: string
  /** Unix timestamp (ms) when deployment completed */
  deployedAt: number
  /** Deployed contract addresses */
  contracts: {
    vault: Address
    wrapper: Address
    shareOFT: Address
    gaugeController?: Address
    ccaStrategy?: Address
    burnStream?: Address
    payoutRouter?: Address
    oracle?: Address
  }
  /** Transaction hashes for each phase */
  txHashes?: {
    phase1?: string
    phase2?: string
    phase3?: string
    phase4?: string
  }
}

const STORAGE_KEY_PREFIX = 'cv:deployment:'

function getStorageKey(owner: Address, version: string): string {
  return `${STORAGE_KEY_PREFIX}${owner.toLowerCase()}:${version}`
}

function getAllDeploymentsKey(): string {
  return 'cv:deployments:all'
}

/**
 * Retrieves all deployments for a given owner across all versions.
 */
export function getDeploymentsForOwner(owner: Address): DeploymentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const allDeploymentsRaw = localStorage.getItem(getAllDeploymentsKey())
    if (!allDeploymentsRaw) return []
    const allDeployments = JSON.parse(allDeploymentsRaw) as DeploymentRecord[]
    return allDeployments.filter((d) => d.owner.toLowerCase() === owner.toLowerCase())
  } catch {
    return []
  }
}

/**
 * Retrieves deployment for a specific owner and version.
 */
export function getDeploymentForOwnerVersion(owner: Address, version: string): DeploymentRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(owner, version)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as DeploymentRecord
  } catch {
    return null
  }
}

/**
 * Saves a deployment record.
 */
function saveDeployment(record: DeploymentRecord): void {
  if (typeof window === 'undefined') return
  try {
    // Save individual record
    const key = getStorageKey(record.owner, record.version)
    localStorage.setItem(key, JSON.stringify(record))

    // Update the all-deployments index
    const allDeploymentsRaw = localStorage.getItem(getAllDeploymentsKey())
    const allDeployments: DeploymentRecord[] = allDeploymentsRaw ? JSON.parse(allDeploymentsRaw) : []
    
    // Remove any existing record for this owner+version
    const filtered = allDeployments.filter(
      (d) => !(d.owner.toLowerCase() === record.owner.toLowerCase() && d.version === record.version)
    )
    filtered.push(record)
    
    localStorage.setItem(getAllDeploymentsKey(), JSON.stringify(filtered))
  } catch (e) {
    console.warn('[useDeploymentTracker] Failed to save deployment record:', e)
  }
}

/**
 * Hook to track deployments per owner address per version.
 * Enforces 1 deployment per owner per VITE_DEPLOYMENT_VERSION.
 */
export function useDeploymentTracker(owner: Address | null, version: string) {
  const existingDeployment = useMemo(() => {
    if (!owner) return null
    return getDeploymentForOwnerVersion(owner, version)
  }, [owner, version])

  const hasDeployed = useMemo(() => {
    return existingDeployment !== null
  }, [existingDeployment])

  const allDeployments = useMemo(() => {
    if (!owner) return []
    return getDeploymentsForOwner(owner)
  }, [owner])

  const recordDeployment = useCallback(
    (params: {
      creatorToken: Address
      contracts: DeploymentRecord['contracts']
      txHashes?: DeploymentRecord['txHashes']
    }): DeploymentRecord | null => {
      if (!owner) return null
      
      const record: DeploymentRecord = {
        creatorToken: params.creatorToken,
        owner,
        version,
        deployedAt: Date.now(),
        contracts: params.contracts,
        txHashes: params.txHashes,
      }
      
      saveDeployment(record)
      return record
    },
    [owner, version]
  )

  return {
    /** Whether the owner has already deployed in this version */
    hasDeployed,
    /** The existing deployment record (if any) */
    existingDeployment,
    /** All deployments for this owner across all versions */
    allDeployments,
    /** Record a new deployment */
    recordDeployment,
  }
}

/**
 * Utility to get the current deployment version from env.
 */
export function getDeploymentVersion(): string {
  const raw = (import.meta.env.VITE_DEPLOYMENT_VERSION as string | undefined) ?? 'v1.2.38'
  const v = String(raw).trim()
  return v.length > 0 ? v : 'v1.2.38'
}
