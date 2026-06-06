/**
 * Stable marker for Base App session-key signer mismatches.
 *
 * Keep this in a tiny standalone module so UI guards can import it without
 * pulling in heavy relay execution code (which can be mid-edit during HMR).
 */
export const BASE_APP_SUBSTITUTED_SIGNER_ERROR = 'base app substituted signer not in csw owner array'
