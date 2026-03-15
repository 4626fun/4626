import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { readServerEnvVar, resetServerEnvCacheForTests } from './serverEnv.js'

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'SERVER_ENV_FILE_FALLBACK',
  'SERVER_ENV_FILE_FALLBACK_FORCE',
  'SERVER_ENV_FILE_FALLBACK_FILES',
] as const

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key]
    if (typeof value === 'string') process.env[key] = value
    else delete process.env[key]
  }
  resetServerEnvCacheForTests()
}

afterEach(() => {
  restoreEnv()
})

describe('server env fallback', () => {
  it('prefers process env values over fallback files', () => {
    process.env.OPENAI_API_KEY = 'sk-live-direct'
    process.env.SERVER_ENV_FILE_FALLBACK_FORCE = '1'
    process.env.SERVER_ENV_FILE_FALLBACK_FILES = '/tmp/does-not-matter.env'

    expect(readServerEnvVar('OPENAI_API_KEY')).toBe('sk-live-direct')
  })

  it('reads keys from configured fallback env files when forced', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-env-test-'))
    const envPath = path.join(tmpDir, '.env')
    fs.writeFileSync(envPath, 'OPENAI_API_KEY=sk-fallback-123\n', 'utf8')

    delete process.env.OPENAI_API_KEY
    process.env.SERVER_ENV_FILE_FALLBACK_FORCE = '1'
    process.env.SERVER_ENV_FILE_FALLBACK_FILES = envPath

    expect(readServerEnvVar('OPENAI_API_KEY')).toBe('sk-fallback-123')
  })

  it('returns empty when fallback is explicitly disabled', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'server-env-test-'))
    const envPath = path.join(tmpDir, '.env')
    fs.writeFileSync(envPath, 'OPENAI_API_KEY=sk-fallback-123\n', 'utf8')

    delete process.env.OPENAI_API_KEY
    process.env.SERVER_ENV_FILE_FALLBACK = '0'
    process.env.SERVER_ENV_FILE_FALLBACK_FILES = envPath

    expect(readServerEnvVar('OPENAI_API_KEY')).toBe('')
  })
})
