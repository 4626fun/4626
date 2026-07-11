/**
 * Dedicated Vercel entry so Stripe signatures are verified against the exact
 * request bytes rather than a JSON re-serialization from the catch-all route.
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

export { default } from '../../../_handlers/creator/strategy/stripe/_webhook.js'
