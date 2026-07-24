const HEX_CREDENTIAL_PATTERN = /\b0x[a-fA-F0-9]{40,}\b/g
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi

export function credentialPresence(value: string, valid = true): string {
  if (!value) return '(missing)'
  return valid ? '(set)' : '(invalid)'
}

/** Remove configured credential values and address/key-shaped stable fragments. */
export function redactDoctorDetail(detail: unknown, credentials: readonly string[]): string {
  let output = detail instanceof Error ? detail.message : String(detail)
  for (const credential of credentials) {
    if (!credential) continue
    output = output.split(credential).join('[redacted]')
  }
  return output
    .replace(HEX_CREDENTIAL_PATTERN, '[redacted-credential]')
    .replace(BEARER_PATTERN, 'Bearer [redacted]')
}
