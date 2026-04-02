# Security Policy

The canonical security policy for this repository is maintained at the root:

- [`SECURITY.md`](../SECURITY.md)

Use the root policy for disclosure channels, scope, timelines, and safe-harbor terms.
# Security Policy

Thank you for helping keep **4626 (CreatorVault)** secure.

4626 combines smart contracts, cross-chain messaging, Chainlink-powered randomness and automation, wallet/account-abstraction flows, and a frontend/API surface. Because the protocol is non-custodial and some onchain components may be immutable after deployment, please report suspected vulnerabilities **privately** and do **not** open public GitHub issues for security matters.

## Supported Versions

This repository does not currently publish tagged GitHub releases. Until versioned releases are introduced, security fixes are provided for the latest reviewed code on the `main` branch only.

| Version | Supported |
| ------- | --------- |
| `main` (current) | :white_check_mark: |
| Deployment configs and addresses derived from current `main` | :white_check_mark: |
| Feature branches / pull-request branches | :x: |
| Historical commits, forks, and unpublished snapshots | :x: |

If and when semver releases are introduced, this table will be updated to track supported release lines.

## What Is In Scope

Please report vulnerabilities that could affect user funds, protocol accounting, privileges, signing, cross-chain integrity, or sensitive data, including issues in:

- `contracts/`
- `deployments/`
- `script/`
- `frontend/` (including `frontend/api/` and `frontend/server/`)
- `cre/` automation workflows and keeper logic
- `supabase/` and `frontend/db/migrations/`
- wallet, paymaster, bundler, or account-abstraction integration logic
- oracle, randomness, automation, or provisioner integrations
- access control, ownership, emergency controls, or deployment configuration

Examples of high-priority findings include:

- theft, permanent loss, or freezing of user funds
- ERC-4626 share-accounting or vault-inflation bugs
- access-control failures or privilege escalation
- reentrancy, replay, initialization, or upgrade issues
- oracle manipulation with practical economic impact
- fee-routing, payout-routing, or lottery-accounting errors
- LayerZero / cross-chain messaging inconsistencies or message-forgery paths
- signing, session, or user-operation bugs that let one actor act for another
- secret leakage, auth bypass, or sensitive backend misconfiguration

## Out of Scope

The following are generally out of scope unless they directly enable a practical exploit:

- best-practice suggestions without a concrete security impact
- low-severity UI, copy, styling, or analytics issues
- third-party outages or bugs in external services unless caused by this repository's integration logic
- attacks requiring access to private keys, seed phrases, or privileged credentials that were not obtained through a vulnerability in the supported code
- reports that cannot be reproduced on supported code or current deployments
- social engineering, phishing, spam, or physical attacks

## How to Report a Vulnerability

Please email **keepr@4626.fun** with the subject line:

`[SECURITY] short description`

If GitHub Private Vulnerability Reporting is enabled for this repository, you may use that channel instead of email.

For issues that put live users or funds at immediate risk, use:

`[CRITICAL] short description`

Please include as much of the following as possible:

- a clear summary of the issue and why it matters
- affected component(s), file path(s), commit hash, and environment
- chain ID(s), contract address(es), transaction hash(es), and relevant configuration
- prerequisites, assumptions, and attacker model
- step-by-step reproduction instructions or a proof of concept
- estimated impact (funds at risk, privileges gained, data exposed, etc.)
- any logs, screenshots, failing tests, or suggested mitigation
- whether you want public credit after disclosure

Please **do not**:

- open a public issue or pull request for an unpatched vulnerability
- test in a way that puts real user funds, private data, or production availability at risk
- access, modify, or exfiltrate data that does not belong to you

If you discover an issue that could move or seize funds, stop after the minimum proof needed to demonstrate impact and report it immediately.

## What To Expect After You Report

- We will try to acknowledge receipt within **72 hours**.
- We will triage the report and may ask follow-up questions or request additional reproduction detail.
- We will try to provide a status update at least every **7 days** until the report is resolved or closed.
- If the report is accepted, we will work on a fix, mitigation, or migration plan and coordinate disclosure with you.
- If the report is declined or considered out of scope, we will share a brief explanation when possible.

## Remediation Notes for Onchain Systems

For immutable or already-deployed contracts, a "fix" may involve one or more of the following instead of patching the original bytecode:

- pausing or emergency-shutting down an affected component
- disabling an integration, route, or privileged role
- rotating operational keys or revoking permissions
- migrating to patched contracts or new deployment addresses
- coordinating mitigations with infrastructure or integration partners

## Disclosure Policy

Please give us a reasonable opportunity to investigate and remediate the issue before any public disclosure. We will aim for coordinated disclosure once users are no longer at risk and a mitigation, patch, or migration path is available.

## Safe Harbor

We support good-faith security research conducted to improve the safety of the protocol and its users. We will not pursue action against researchers who:

- act in good faith
- avoid privacy violations, destructive testing, and service disruption
- do not exploit findings beyond what is minimally necessary to prove impact
- promptly report the issue privately and give us time to remediate

By submitting a report, you agree to follow this policy and all applicable laws.
