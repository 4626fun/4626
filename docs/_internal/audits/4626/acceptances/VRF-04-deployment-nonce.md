# VRF-04 — ChainlinkVRFIntegratorV2_5 Deployment-Nonce Entropy

- **Linear:** [4626-441](https://linear.app/4626fun/issue/4626-441) · prior work [4626-354 (L-06)](https://linear.app/4626fun/issue/4626-354)
- **Severity:** Low
- **File:** `contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol` constructor

## Status: Fixed — entropy sources extended with `block.prevrandao` + `msg.sender`

### Evolution

| Version | Derivation | Deploy-band entropy | Notes |
|---------|------------|---------------------|-------|
| Pre-L-06 | `uint16(block.number)` | 16 bits | ~50% collision after 256 deploys (birthday); recurs every ~2.7 days on Base |
| L-06 fix ([4626-354](https://linear.app/4626fun/issue/4626-354)) | `keccak(block.number, chainid, this)` truncated to 64 bits | 48 bits (high) | Collision probability ~2⁻³² for 65k deploys |
| L-06 review follow-up | Same, but `requestCounter = nonce & 0xFFFFFFFFFFFF0000` | 48 bits (high) preserved into counter | Fixed the `<< 48` regression that silently collapsed the band back to 16 bits |
| **VRF-04 (this PR)** | `keccak(block.number, block.prevrandao, chainid, this, msg.sender)` truncated to 64 bits | 48 bits + **RANDAO + deployer** | Adds post-merge PoS randomness and deployer identity; strictly broader than every prior version |

### Why add `block.prevrandao` and `msg.sender`?

**`block.prevrandao`** (post-merge RANDAO beacon value in the PREVRANDAO opcode) adds constructor-time randomness that no attacker can predict more than one epoch ahead. Even an adversary who can time the deploy tx into a specific block (via MEV / private bundles) cannot choose the RANDAO value. On non-merge EVM chains the opcode degrades to `block.difficulty`, which is non-zero on every chain this contract targets; no additional branch needed.

**`msg.sender`** captures the deploying EOA (or factory contract) address. This closes a narrow residual: a CREATE2 factory deployed by a known owner could be predicted ahead of time. Mixing `msg.sender` makes the derivation depend on who is actually calling the constructor, not just the final deployed address.

Neither input is load-bearing — the L-06 / review fix already made the 48-bit deploy band collision-safe at realistic cadences. These inputs are defense-in-depth, same class as the S-H05 dual-defense pattern shipped in [4626-440](https://linear.app/4626fun/issue/4626-440).

### What shipped

1. **Constructor derivation widened** — see contract L104-133.
2. **`// FIX` comment replaced** — the long historical narrative moved here; contract carries a short tag pointing to this doc.
3. **New test file** — `test/ChainlinkVRFIntegrator.NonceEntropy.t.sol`:
   - Fuzz: same block, same deployer, different `prevrandao` → different nonce.
   - Fuzz: same block, same `prevrandao`, different deployer → different nonce.
   - Isolated keccak tests asserting each added input on its own perturbs the hash.
   - Pinning test computing the derivation off-chain and asserting equality with on-chain `deploymentNonce`.
4. **Existing test preserved** — `test/ChainlinkVRFIntegratorV2_5.DeploymentNonce.t.sol` continues to pass because the deploy-band mask and high-48-bit invariants are unchanged.

### Acceptance

- [x] `block.prevrandao` mixed into the derivation.
- [x] `msg.sender` mixed into the derivation.
- [x] `FIX: VRF-04` comment rewritten; historical narrative moved here.
- [x] New fuzz test covers prevrandao + deployer variants.
- [x] Existing deployment-nonce test still green (no changes to deploy-band mask / high-48-bit split).

### Risk notes

- **Same-tx redeploys**: `msg.sender` within a single tx is the same for every CREATE from the same caller, but the deployed-address (`address(this)`) still differs per CREATE, so per-tx same-deployer redeploys remain band-distinct.
- **CREATE2 with attacker-controlled salt**: an attacker who can pick the salt can force `address(this)` to a chosen value, but they cannot pick `block.prevrandao` and the deploy band is now unpredictable even with that control.
- **Cross-chain collisions**: `block.chainid` remains in the derivation, so two chains with identical block numbers cannot collide.

## Tracking

PR linked to [4626-441](https://linear.app/4626fun/issue/4626-441) and parent [4626-422](https://linear.app/4626fun/issue/4626-422). When the PR merges, move this document to `docs/audits/4626/closed/`.
