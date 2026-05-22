export type SubAccountOwnerInstallOutcome = {
  registered: boolean
  alreadyOwner?: boolean
  onChainOwnerInstalled?: boolean
  onChainOwnerWarning?: string | null
}

export function isSubAccountOwnerInstallSucceeded(
  result: SubAccountOwnerInstallOutcome | null | undefined,
): boolean {
  if (!result?.registered) return false
  return result.alreadyOwner === true || result.onChainOwnerInstalled === true
}
