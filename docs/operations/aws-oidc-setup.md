---
title: AWS OIDC Setup for CRE Workflows
sidebar_position: 21
---

# AWS OIDC Setup for CRE Workflows (H-09 remediation)

This document is the **infra contract** for audit finding H-09
(4626-301). The repository code (`cre/cre-workflows/_shared/awsOidc.ts`,
`kvState.ts`, `runtime-orchestrator/main.ts`) assumes this setup is in
place. Until the infra side lands in your AWS account, the runtime
will fail fast with `oidc_sts_rejected_*` on every invocation — which
is the intended safety behavior.

## Why

Before H-09, the CRE runtime signed S3 SigV4 requests with a
long-lived IAM user's access key pair, stored as CRE secrets:

```yaml
# cre/cre-workflows/secrets.yaml (before)
AWS_ACCESS_KEY_ID:
  - AWS_ACCESS_KEY_ID_VALUE
AWS_SECRET_ACCESS_KEY:
  - AWS_SECRET_ACCESS_KEY_VALUE
```

A compromise of the CRE secret store (or a misrouted `cre workflow
simulate` against a real secret) would leak static credentials with
the full permission scope of the underlying IAM user. There was no
rotation schedule, no IAM-side bucket/prefix constraint, and no audit
trail tying individual workflow runs to specific credentials.

## After H-09 (code already landed)

```yaml
# cre/cre-workflows/secrets.yaml (now)
AWS_OIDC_TOKEN:
  - AWS_OIDC_TOKEN_VALUE
```

At every workflow run, the orchestrator:

1. Reads `AWS_OIDC_TOKEN` (a short-lived JWT).
2. Calls `sts:AssumeRoleWithWebIdentity` on the regional STS endpoint
   with that JWT + `aws_role_arn` + `aws_role_session_name` from
   workflow config.
3. Uses the returned temporary `{AccessKeyId, SecretAccessKey,
   SessionToken}` for the duration of that single orchestration.
4. Enforces `s3_bucket_allowlist` + `s3_key_prefix_allowlist` in code
   **before** the network call (defense in depth on top of IAM).

## What the operator must still do (one-time per AWS account)

### 1. Create an OIDC identity provider in IAM

The provider URL should be the issuer of the JWT that is injected into
`AWS_OIDC_TOKEN`. If you are using GitHub Actions to mint tokens:

```
token.actions.githubusercontent.com
```

Audience: `sts.amazonaws.com`. Thumbprint: per AWS docs (AWS verifies
GitHub's root CA automatically as of 2023).

If you are using a private OIDC provider to mint CRE workflow tokens,
use its issuer URL and its TLS root cert thumbprint. The OIDC provider
**must not** be shared with unrelated AWS workloads — the audit scope
is that this issuer is used solely to authenticate CRE workflows.

### 2. Create the IAM role (per workflow × environment)

Example for `runtime-orchestrator` in production. Replace
`REPLACE_ACCOUNT_ID`, `<issuer>`, and `<subject>`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::REPLACE_ACCOUNT_ID:oidc-provider/<issuer>"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "<issuer>:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "<issuer>:sub": "<subject-pattern-matching-cre-runtime-orchestrator>"
        }
      }
    }
  ]
}
```

Permission policy — **pin it tightly**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": [
        "arn:aws:s3:::your-production-runtime-checkpoints/runtime-orchestrator/*"
      ]
    }
  ]
}
```

Set `MaxSessionDuration` to the minimum that still covers your slowest
legitimate run. 15 minutes (900s) matches the default
`aws_session_duration_seconds` in `config.production.json`.

### 3. Wire the role ARN into `config.*.json`

Replace each `REPLACE_ACCOUNT_ID` with your AWS account ID in:

- `cre/cre-workflows/runtime-orchestrator/config.production.json`
- `cre/cre-workflows/runtime-orchestrator/config.staging.json`

A CI grep for `REPLACE_ACCOUNT_ID` will fail the build if this step is
skipped, so it cannot regress silently.

### 4. Token rotation

Operators populate `AWS_OIDC_TOKEN_VALUE` with a fresh JWT before the
token's `exp` claim. Two supported patterns:

- **Push**: a scheduled job mints a new JWT from the OIDC provider and
  calls the CRE secret-rotation API.
- **Pull**: the CRE runtime reads the token from a token-mint endpoint
  at workflow startup (out of scope for this PR; requires the CRE
  `HTTPCapability` binding a new secret provider).

The recommended default is **push** with a rotation period under the
JWT's lifetime — e.g. 5-minute JWTs rotated every 4 minutes.

### 5. Ongoing hardening checklist

- [ ] OIDC provider thumbprint pinned in IAM (AWS's automatic
      verification for `token.actions.githubusercontent.com` is fine;
      self-hosted providers must keep thumbprints current).
- [ ] Role trust policy `StringLike` `sub` condition is **as narrow as
      possible** (e.g. `repo:wenakita/4626:environment:production`).
- [ ] CloudTrail alert on `AssumeRoleWithWebIdentity` failures above
      baseline — both an attacker probing and a broken rotation pipe
      produce these.
- [ ] CloudTrail alert on any `GetObject`/`PutObject` to the
      checkpoint bucket outside the `runtime-orchestrator/` prefix.
- [ ] The old IAM user that owned `AWS_ACCESS_KEY_ID_VALUE` is
      deleted, not just deactivated.

## Testing checklist (pre-merge)

1. `cre workflow simulate --target local-simulation` still passes
   (uses `kvDisabled: true`, so no AWS call is made).
2. In a staging account, set `AWS_OIDC_TOKEN_VALUE` to a real JWT
   and `aws_role_arn` to the matching role. Run one orchestration and
   verify:
   - STS `AssumeRoleWithWebIdentity` succeeds.
   - A GET + PUT to the checkpoint key succeeds.
   - Setting `s3_key` to `runtime-orchestrator/../foo` makes the
     orchestration revert with `kv_key_prefix_not_allowed` **before**
     any STS or S3 request is issued (inspect CloudTrail to confirm no
     S3 call attempt).

## References

- Audit finding: `findings/phase-3-cre.md` — H-09
- Linear: [4626-301](https://linear.app/4626fun/issue/4626-301)
- AWS docs: [AssumeRoleWithWebIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)
- AWS docs: [Creating OIDC identity providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
