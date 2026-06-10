import { afterEach, describe, expect, it } from 'vitest'

import {
  readTwitterBearerToken,
  readTwitterOauth1Credentials,
} from './twitterEnv.js'

describe('twitterEnv', () => {
  const prior = { ...process.env }

  afterEach(() => {
    process.env = { ...prior }
  })

  it('prefers X_BEARER_TOKEN over legacy names', () => {
    process.env.X_BEARER_TOKEN = 'x-bearer'
    process.env.TWITTER_BEARER_TOKEN = 'legacy-bearer'
    expect(readTwitterBearerToken()).toBe('x-bearer')
  })

  it('reads X_* OAuth 1.0 credentials', () => {
    process.env.X_API_KEY = 'key'
    process.env.X_API_SECRET = 'secret'
    process.env.X_ACCESS_TOKEN = 'token'
    process.env.X_ACCESS_SECRET = 'token-secret'
    expect(readTwitterOauth1Credentials()).toEqual({
      apiKey: 'key',
      apiSecret: 'secret',
      accessToken: 'token',
      accessSecret: 'token-secret',
    })
  })

  it('falls back to HERMIT_TWITTER_* when X_* is unset', () => {
    process.env.HERMIT_TWITTER_API_KEY = 'hermit-key'
    process.env.HERMIT_TWITTER_API_SECRET = 'hermit-secret'
    process.env.HERMIT_TWITTER_ACCESS_TOKEN = 'hermit-token'
    process.env.HERMIT_TWITTER_ACCESS_SECRET = 'hermit-secret'
    expect(readTwitterOauth1Credentials()).toEqual({
      apiKey: 'hermit-key',
      apiSecret: 'hermit-secret',
      accessToken: 'hermit-token',
      accessSecret: 'hermit-secret',
    })
  })
})
