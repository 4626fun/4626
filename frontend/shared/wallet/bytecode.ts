export function hasContractBytecode(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim().toLowerCase()
  return trimmed !== '' && trimmed !== '0x'
}
