declare const process: { env: Record<string, string | undefined> }

const TWITTER_BEARER_ENV_KEYS = [
  'X_BEARER_TOKEN',
  'TWITTER_BEARER_TOKEN',
  'HERMIT_TWITTER_BEARER_TOKEN',
] as const

const TWITTER_OAUTH1_ENV_KEYS = {
  apiKey: ['X_API_KEY', 'HERMIT_TWITTER_API_KEY', 'TWITTER_API_KEY'],
  apiSecret: ['X_API_SECRET', 'HERMIT_TWITTER_API_SECRET', 'TWITTER_API_SECRET'],
  accessToken: ['X_ACCESS_TOKEN', 'HERMIT_TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN'],
  accessSecret: ['X_ACCESS_SECRET', 'HERMIT_TWITTER_ACCESS_SECRET', 'TWITTER_ACCESS_SECRET'],
} as const

function readFirstEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = String(process.env[name] ?? '').trim()
    if (value) return value
  }
  return ''
}

export function readTwitterBearerToken(): string | null {
  const token = readFirstEnv(TWITTER_BEARER_ENV_KEYS)
  return token.length > 0 ? token : null
}

export function isHermitTwitterStrictModeEnabled(): boolean {
  const raw = String(process.env.HERMIT_TWITTER_STRICT ?? '')
    .trim()
    .toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export type TwitterOauth1Credentials = {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

function oauth1KeysForField(
  field: keyof typeof TWITTER_OAUTH1_ENV_KEYS,
  strictHermitOnly: boolean,
): readonly string[] {
  const keys = TWITTER_OAUTH1_ENV_KEYS[field]
  if (!strictHermitOnly) return keys
  return keys.filter((key) => key.startsWith('HERMIT_'))
}

export function readTwitterOauth1Credentials(
  options: { strictHermitOnly?: boolean } = {},
): TwitterOauth1Credentials {
  const strictHermitOnly = options.strictHermitOnly ?? isHermitTwitterStrictModeEnabled()
  return {
    apiKey: readFirstEnv(oauth1KeysForField('apiKey', strictHermitOnly)),
    apiSecret: readFirstEnv(oauth1KeysForField('apiSecret', strictHermitOnly)),
    accessToken: readFirstEnv(oauth1KeysForField('accessToken', strictHermitOnly)),
    accessSecret: readFirstEnv(oauth1KeysForField('accessSecret', strictHermitOnly)),
  }
}

export function missingTwitterOauth1EnvKeys(
  creds: TwitterOauth1Credentials,
  strictHermitOnly: boolean,
): string[] {
  const fieldToEnv: Array<[keyof TwitterOauth1Credentials, string]> = [
    ['apiKey', strictHermitOnly ? 'HERMIT_TWITTER_API_KEY' : 'X_API_KEY'],
    ['apiSecret', strictHermitOnly ? 'HERMIT_TWITTER_API_SECRET' : 'X_API_SECRET'],
    ['accessToken', strictHermitOnly ? 'HERMIT_TWITTER_ACCESS_TOKEN' : 'X_ACCESS_TOKEN'],
    ['accessSecret', strictHermitOnly ? 'HERMIT_TWITTER_ACCESS_SECRET' : 'X_ACCESS_SECRET'],
  ]
  return fieldToEnv.filter(([field]) => creds[field].length === 0).map(([, label]) => label)
}
