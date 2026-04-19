const TEST_AUTH_SESSION_SECRET = 'test-auth-session-secret-0123456789abcdef'

if ((process.env.AUTH_SESSION_SECRET ?? '').trim().length < 32) {
  process.env.AUTH_SESSION_SECRET = TEST_AUTH_SESSION_SECRET
}

if ((process.env.AUTH_HANDOFF_SECRET ?? '').trim().length < 32) {
  process.env.AUTH_HANDOFF_SECRET = process.env.AUTH_SESSION_SECRET
}
