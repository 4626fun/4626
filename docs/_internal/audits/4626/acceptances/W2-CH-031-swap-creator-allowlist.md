# W2 CH-031 Swap Creator Allowlist

Date: 2026-07-22
Status: accept-risk

## Summary
- This wave hardens paymaster sponsorship around custom-owner tokens, Swap Proxy decoding, nested router allowlists, and Permit2 validation.
- The separate request to require a creator allowlist on sponsored swap paths remains a product decision rather than a confirmed minimal-diff security fix for this pass.
- Adding that gate here would change existing sponsorship eligibility behavior and needs explicit product policy, especially for legitimate non-creator swap/setup flows.

## Mitigation
- Preserve the new router/payload/token validation added in Wave W2.
- If product decides to require creator allowlisting for sponsored swaps, implement it as a dedicated policy change with explicit UX and eligibility coverage.
