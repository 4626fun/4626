# Acceptance: L-26 — vanity targets file contains future v1.9.2 addresses

- **Finding ID:** L-26
- **Linear:** 4626-374
- **Severity (reported):** Low
- **Confidence (reported):** Confirmed
- **Status:** Accepted — claim no longer matches the tree
- **Source:** Phase 7 DOC-013

## Reported issue

The finding claims
`deployments/base/shared-global-vanity-targets.json` contains addresses
labeled `v1.9.2` (a version that had not been deployed at audit time),
creating confusion between deployed and planned addresses.

## Current state of the repository

`deployments/base/shared-global-vanity-targets.json` now declares:

```
  "recommendedEpochTag": "v1.8.1",
  "recommendedManifestPath": "deployments/base/v1.8.1-vanity-manifest.json",
  "historicalReferenceEpochTag": "v1.7.1",
```

A grep for `1.9.2` inside the file returns zero matches. The file
points to `v1.8.1-vanity-manifest.json` as the canonical current set.

The `v1.9.2-bytecode-manifest.json` file exists alongside it as a
separate, version-scoped artifact used by the bytecode-verification
pipeline. That is **exactly the separation the finding recommended**:
planned-version addresses are kept in their own version-tagged manifest
rather than being inlined into the shared/global registry. The current
tree already matches the remediation recommendation.

## Controls preventing regression

1. Each release tag gets its own
   `v<major.minor.patch>-bytecode-manifest.json`. The shared-global
   registry points at a single `recommendedManifestPath` and never
   enumerates multi-version address sets.
2. `package.json` declares the current app version
   (`version: 1.8.1`), matching the recommended epoch tag in the
   vanity-targets file. A future v1.9.2 production deploy will also
   bump `recommendedEpochTag` in the same PR.

## Decision

Closed as acceptance. The registry currently points to v1.8.1; no
v1.9.2 labels live inside the canonical file. The version-scoped
manifest at `deployments/base/v1.9.2-bytecode-manifest.json` is the
correct location for pre-release bytecode pinning and does not blur
the deployed-vs-planned boundary.

## References

- Phase 7 DOC-013
- `deployments/base/shared-global-vanity-targets.json`
- `deployments/base/v1.8.1-vanity-manifest.json` (currently canonical)
- `deployments/base/v1.9.2-bytecode-manifest.json` (planned release,
  scoped to its own file as the finding recommended)
