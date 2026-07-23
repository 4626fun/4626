/** Shell-safe canonical shape for a Solana public key argument. */
export function isSolanaMintArgument(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
}

export function requireSolanaMintArgument(value: string): string {
  if (!isSolanaMintArgument(value)) throw new Error(`Invalid --mint: ${value}`)
  return value
}
