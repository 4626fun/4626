/**
 * Standalone Vercel Serverless Function for /api/agent/process
 *
 * Deployed as its own function to isolate the heavy @xmtp/node-bindings
 * (~214 MB with all platform binaries) from the main catch-all bundle.
 * Kept as a separate on-demand API surface; production XMTP consumption runs
 * on the Railway primary, not from a Vercel cron.
 */
export { default } from '../_handlers/agent/_process.js'
