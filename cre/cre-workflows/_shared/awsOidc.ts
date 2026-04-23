/**
 * awsOidc.ts — H-09 (4626-301) remediation.
 *
 * Replaces long-lived AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY secrets
 * with short-lived credentials obtained via AWS STS
 * AssumeRoleWithWebIdentity. The CRE runtime is given an OIDC ID token
 * (JWT) as a secret; at workflow invocation time we exchange that token
 * for a temporary {AccessKeyId, SecretAccessKey, SessionToken} triple
 * that expires within ~1 hour.
 *
 * Flow:
 *   1. Runtime supplies a fresh OIDC_TOKEN via secret.
 *   2. This module calls STS AssumeRoleWithWebIdentity with RoleArn +
 *      RoleSessionName + WebIdentityToken. STS returns temporary
 *      credentials scoped by the role's trust & permission policies.
 *   3. kvState.ts SigV4-signs S3 requests with the temporary creds and
 *      sends X-Amz-Security-Token on every request.
 *
 * Blast-radius reduction vs. long-lived IAM user keys:
 *   - Credentials expire (max 1h by default; role policy may allow up
 *     to 12h).
 *   - Role trust policy constrains which OIDC issuer + audience + sub
 *     can assume the role, so a leaked workflow-level OIDC token alone
 *     cannot mint credentials for unrelated roles.
 *   - Role permission policy can pin bucket + key prefix tightly so an
 *     overbroad config cannot exfiltrate unrelated objects.
 *
 * See docs/operations/aws-oidc-setup.md for the matching infra.
 */

import { HTTPClient, type NodeRuntime } from "@chainlink/cre-sdk"

export type OidcCredentials = {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  /** Unix seconds at which STS says these credentials expire. */
  expiration: number
}

export type OidcRuntimeConfig = {
  aws_region: string
  /** Full ARN of the IAM role to assume, e.g. arn:aws:iam::123:role/cre-kv-writer */
  aws_role_arn: string
  /** Role session name — must match the trust-policy condition if set. */
  aws_role_session_name: string
  /** Max duration (seconds) for the returned credentials. AWS clamps to role max. */
  aws_session_duration_seconds?: number
}

const DEFAULT_SESSION_DURATION = 900 // 15 minutes; safest lower bound.
const STS_REGIONAL_HOST = (region: string): string => `sts.${region}.amazonaws.com`

function readTag(xml: string, tag: string): string | null {
  // Deliberately simple — STS responses are flat and well-formed. We do
  // NOT attempt a general-purpose XML parser here because this runs
  // inside the deterministic CRE runtime and must be side-effect-free.
  const open = `<${tag}>`
  const close = `</${tag}>`
  const start = xml.indexOf(open)
  if (start < 0) return null
  const from = start + open.length
  const end = xml.indexOf(close, from)
  if (end < 0) return null
  return xml.slice(from, end).trim()
}

function parseStsDatetime(value: string): number {
  // STS returns ISO-8601 like 2026-04-23T01:15:00Z.
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) {
    throw new Error("oidc_sts_bad_expiration")
  }
  return Math.floor(ms / 1000)
}

/**
 * Exchanges an OIDC ID token for short-lived AWS credentials.
 *
 * Throws on any non-2xx response — callers must treat missing or
 * expired tokens as a hard failure rather than silently falling back
 * to long-lived keys.
 */
export function assumeRoleWithWebIdentity<Config extends OidcRuntimeConfig>(
  nodeRuntime: NodeRuntime<Config>,
  httpClient: HTTPClient,
  webIdentityToken: string,
): OidcCredentials {
  if (!webIdentityToken || webIdentityToken.trim().length === 0) {
    throw new Error("oidc_token_missing")
  }
  const { aws_region, aws_role_arn, aws_role_session_name } = nodeRuntime.config
  if (!aws_region || !aws_role_arn || !aws_role_session_name) {
    throw new Error("oidc_config_incomplete")
  }
  const durationSeconds = nodeRuntime.config.aws_session_duration_seconds ?? DEFAULT_SESSION_DURATION

  const host = STS_REGIONAL_HOST(aws_region)
  const body = new URLSearchParams({
    Action: "AssumeRoleWithWebIdentity",
    Version: "2011-06-15",
    RoleArn: aws_role_arn,
    RoleSessionName: aws_role_session_name,
    WebIdentityToken: webIdentityToken,
    DurationSeconds: String(durationSeconds),
  }).toString()

  const response = httpClient.sendRequest(nodeRuntime, {
    url: `https://${host}/`,
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(body.length),
    },
    // Body is passed verbatim; the STS endpoint is regional so this
    // avoids the global endpoint deprecation and any cross-region
    // latency surprises for CRE nodes in the same region as S3.
    body: body,
    cacheSettings: { store: false, maxAge: "0s" },
  }).result()

  if (response.statusCode < 200 || response.statusCode >= 300) {
    // STS error envelope (e.g. AccessDenied, ExpiredTokenException,
    // InvalidIdentityToken) arrives as XML with <Error><Code>…</Code>
    // <Message>…</Message></Error>. Surface the code in the error
    // message so operators can distinguish rotation failures from
    // permanent trust-policy rejections without exposing the raw
    // token in logs.
    const raw = new TextDecoder().decode(response.body)
    const code = readTag(raw, "Code") ?? `http_${response.statusCode}`
    throw new Error(`oidc_sts_rejected_${code}`)
  }

  const xml = new TextDecoder().decode(response.body)
  const accessKeyId = readTag(xml, "AccessKeyId")
  const secretAccessKey = readTag(xml, "SecretAccessKey")
  const sessionToken = readTag(xml, "SessionToken")
  const expirationRaw = readTag(xml, "Expiration")
  if (!accessKeyId || !secretAccessKey || !sessionToken || !expirationRaw) {
    throw new Error("oidc_sts_response_malformed")
  }
  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    expiration: parseStsDatetime(expirationRaw),
  }
}

/**
 * Returns true if the credentials are still valid with `marginSeconds`
 * of slack before expiration. Call sites should re-assume when false.
 */
export function credentialsStillFresh(creds: OidcCredentials, nowSeconds: number, marginSeconds = 60): boolean {
  return creds.expiration - marginSeconds > nowSeconds
}
