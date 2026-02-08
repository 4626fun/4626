/**
 * Standalone Vercel Serverless Function for /api/keepr/actions/execute
 *
 * Deployed independently from the catch-all API bundle because it loads
 * XMTP node bindings at runtime.
 */
export { default } from '../../_handlers/keepr/actions/_execute.js'

