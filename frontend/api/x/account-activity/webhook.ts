/**
 * Vercel entry for /api/x/account-activity/webhook (X Account Activity CRC + events).
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

export { default } from '../../_handlers/x/_accountActivityWebhook.js'
