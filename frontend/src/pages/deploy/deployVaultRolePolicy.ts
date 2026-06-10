// Role-policy display helpers extracted from DeployVault.tsx (mechanical move, no behavior change).

export type RolePolicyRuleLabel = 'any' | 'must_equal_owner' | 'must_be_allowlisted' | 'unknown'
export type RolePolicySourceLabel = 'request' | 'creator_default' | 'global_default' | 'none'

export function renderRolePolicyRuleLabel(rule: RolePolicyRuleLabel): string {
  switch (rule) {
    case 'any':
      return 'Any'
    case 'must_equal_owner':
      return 'Must equal owner'
    case 'must_be_allowlisted':
      return 'Must be allowlisted'
    default:
      return 'Unknown'
  }
}

export function renderRolePolicySourceLabel(source: RolePolicySourceLabel): string {
  switch (source) {
    case 'request':
      return 'Request override'
    case 'creator_default':
      return 'Creator default'
    case 'global_default':
      return 'Global default'
    default:
      return 'No policy selected'
  }
}

export function parseRolePolicyOverrideInput(raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: null, error: null }
  if (!/^\d+$/.test(trimmed)) {
    return { value: null, error: 'Role policy override must be a whole number (0-65535).' }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    return { value: null, error: 'Role policy override must be between 0 and 65535.' }
  }
  return { value: parsed, error: null }
}
