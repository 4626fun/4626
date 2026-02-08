/**
 * Standalone Vercel Serverless Function for /api/agent/process
 *
 * Deployed as its own function to isolate the heavy @xmtp/node-bindings
 * (~214 MB with all platform binaries) from the main catch-all bundle.
 *
 * Vercel Cron calls this endpoint every minute.
 */
export { default } from '../_handlers/agent/_process.js'
