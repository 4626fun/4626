/**
 * Server gate for Track C2 Base App sub-account waitlist/onboarding.
 * Must stay in sync with `waitlistSubAccountFlowFlag` (client) and
 * `WAITLIST_SUBACCOUNT_FLOW_ENABLED` in `.env.example`.
 *
 * Strict: only the literal `"1"` enables the path (not `"true"`).
 */
export function isWaitlistSubaccountFlowEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return String(env.WAITLIST_SUBACCOUNT_FLOW_ENABLED ?? '').trim() === '1'
}
