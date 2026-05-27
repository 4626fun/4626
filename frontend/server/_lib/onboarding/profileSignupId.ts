/** Strict positive integer profile id (`profiles.id` / `points.signup_id`). */
export function assertValidSignupId(signupId: unknown): number {
  const n = typeof signupId === 'number' ? signupId : Number(signupId)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('invalid_signup_id')
  }
  return n
}
