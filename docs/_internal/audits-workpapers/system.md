# 1. Executive Summary

The system is **partially coherent** as probability-budget governance (not emissions governance), and the architecture mostly enforces that distinction: `VaultGaugeVoting` routes a bounded PPM budget, `CreatorLotteryManager` applies probability boosts then caps final odds, and `CreatorGaugeController` routes fee value separately from probability. That said, there are material docs-vs-code drifts and some control-plane centralization that make the economic surface less predictable than intended.

The biggest **economic risk** is concentration from combined levers (ve boost + lock-duration additive boost + gauge-directed boost + bribes) under a hard cap, plus a key denominator distortion in boost computation (`ve4626.getTotalVotingPower()` using non-decaying minted supply). This can skew fairness and push outcomes toward governance/cartel advantage even if payout sizing is separate.

The biggest **governance risk** is admin concentration over whitelist/registry/toggles and `emergencyResetAllVotes()`, which can force effective zero-vote conditions and route probability via fallback mechanics. In a probability system, this is equivalent to steering win-likelihood, not just policy preference.

The biggest **lottery/VRF risk** is trust-surface concentration around authorized callers/integrators/sponsorship controls, including owner-set VRF path selection (`useLocalVRF`, trusted integrator sets) and deferred settlement while paused. Non-blocking cross-chain handling is strong, but control abuse and economic griefing remain realistic.

# 2. Scope and Evidence Quality

| Component | Evidence source (code/docs/both) | Confidence | Key unknowns |
|---|---|---|---|
| `VaultGaugeVoting.sol` | both | High | Live deployment params/governance process not shown |
| `ve4626.sol` | both | High | Whether any external module relies on ERC20Votes checkpoints directly |
| `ve4626BoostManager.sol` | both | High | Intended denominator semantics for total voting power |
| `VoterRewardsDistributor.sol` | both | High | Ops controls around reward-token repair authority |
| `BribeDepot.sol` | both | High | Production token allowlist policy (if any) |
| `CreatorGaugeController.sol` | both | High | Real-world treasury/operator key management |
| `CreatorLotteryManager.sol` | both | High | AMOE path parity with source; deployed ABI drift |
| `CreatorVRFConsumerV2_5.sol` | both | High | Cross-chain ops policy for relayers and fee funding |
| `ChainlinkVRFIntegratorV2_5.sol` | both | High | Budget policy for sponsored callers in production |
| `CreatorRegistry` + interfaces | code | Medium-High | Runtime integrity/upgrade controls outside scope |
| Oracle interfaces and usage | both | Medium-High | Oracle governance and monitoring tooling |
| AMOE docs/frontend path | both | Medium | On-chain parity in currently deployed manager unknown |

Additional evidence: Foundry suite executed successfully (433 passing tests), which raises implementation confidence but does not eliminate economic/game-theory risks.

# 3. System Architecture

- **Contract map:** `ve4626` (lock power) -> `VaultGaugeVoting` (epoch vault weights) -> `VoterRewardsDistributor` and `BribeDepot` (historical entitlement), while `CreatorGaugeController` routes fee value and `CreatorLotteryManager` computes/settles lottery outcomes via local/cross-chain VRF (`CreatorVRFConsumerV2_5`, `ChainlinkVRFIntegratorV2_5`).
- **Trust boundaries:** owner/admin keys, registry, authorized swap contracts, authorized local VRF callers, authorized relayers, sponsored caller lists, LayerZero peers, oracle feeds, treasury/distributor endpoints.
- **Weekly/epoch lifecycle:** users lock and vote in current epoch -> fees are distributed to jackpot/burn/voter rewards -> bribes accumulate per epoch -> claims/rollovers/sweeps use ended-epoch snapshots -> lottery entries happen continuously and consume current config/weights.
- **Value-flow split:** fee routing and payout value are separate from probability routing; governance can raise/lower win-likelihood for a vault without directly changing payout amount from all vault reserves.

| Primitive | Source of truth | Main consumer |
|---|---|---|
| A. Voting power | `ve4626.getVotingPower()` | `VaultGaugeVoting.vote()` |
| B. Personal boost | `ve4626BoostManager.calculateBoost()` | `CreatorLotteryManager._applyBoost()` |
| C. Lock-duration boost | `ve4626BoostManager.getTotalProbabilityBoost()` | `CreatorLotteryManager._applyBoost()` |
| D. Vault-directed gauge boost | `VaultGaugeVoting.getVaultGaugeProbabilityBoostPPM()` | `CreatorLotteryManager._applyBoost()` |
| E. Voter reward entitlement | `getUserVoteWeightAtEpoch()/getVaultWeightAtEpoch()` | `VoterRewardsDistributor._claim()` |
| F. Bribe eligibility | same historical vote weight calls | `BribeDepot.claim()` |
| G. Jackpot probability | `calculateWinChance()` + `_applyBoost()` + cap | lottery entry settlement |
| H. Jackpot payout amount | `rewardPercentage` + each gauge reserve | `_payoutLocalJackpot()` / `payJackpot()` |
| I. Fee routing | `CreatorGaugeController._distributeVaultShares()` | burn/lottery/creator/voter reward paths |
| J. Randomness settlement | VRF request/response lifecycle | lottery finalization callbacks |

# 4. Probability-Budget Governance Review

- **Q19:** Epoch accounting is mostly correct (`EPOCH_DURATION = 7 days`, epoch-indexed maps), but truncation in normalized weight math and owner reset powers create manipulation edges.
- **Q20:** Votes do **not** persist across epochs in source; this reduces stale-vote persistence but increases dependence on active weekly participation and fallback behavior.
- **Q21:** Zero-vote equal split exists (`TOTAL_GAUGE_PROBABILITY_PPM / whitelistedCount`) and is exploitable as a strategic state, especially in low-participation weeks.
- **Q22:** Yes, suppression is feasible via coordinated abstention or owner-triggered `emergencyResetAllVotes()` in current epoch.
- **Q23:** The implemented bounded budget is fixed at `69_420 PPM` (694.2 bps), not docs-style creator-count curve; economically this is more aggressive than `100–300 bps` expectations.
- **Q24:** Creator count does not currently determine budget in source, so that specific sybil vector is absent in source but still present as docs/model drift risk.
- **Q25:** Registry/manual whitelist controls can be abused to change competition set and fallback denominator.
- **Q26:** `MAX_VAULTS_PER_VOTE=10` and array/zero guards are enforced; lock expiry before epoch end is checked; checkpoint is idempotent; historical queries are available; emergency reset is the largest edge.
- **Q27:** Epoch boundary timing can still be gamed via last-minute vote shifts/bribes and immediate current-epoch effects.
- **Q28:** `minVaultWeightBps` is not present in current source; this is a major docs/deployment-parity gap requiring bytecode/ABI verification.
- **Q29:** The documented formula is not exact implementation. Actual path: base PPM -> coverage-scaled multiplicative personal boost -> coverage-scaled additive lock boost -> swap-size-scaled additive gauge boost -> cap at `maxWinChance`.
- **Q30:** Internal coherence is acceptable, but only with explicit awareness of scaling layers and cap clipping.
- **Q31:** Units are mostly consistent: boosts in BPS, probabilities in PPM, lock boost converted (`bps * 100`), gauge already PPM.
- **Q32:** Yes, mixed additive/multiplicative composition plus coverage and cap creates nonlinear cliff effects.
- **Q33:** High-ve + high-gauge users can dominate toward cap, especially with concentrated participation.
- **Q34:** On-chain floor logic (`minVaultWeightBps`) is absent in source; practical floor in source is zero-vote equal split only.
- **Q35:** System can become pay-to-win-like via coordinated bribes + whale lock power + selective swap activity, though hard cap limits absolute dominance.
- **Q36:** There is a hard cap (`maxWinChance`, bounded by config setter to <= `200_000 PPM`), which helps but does not remove governance concentration effects.

# 5. ve4626 and Boost Review

- **Q4:** ve token is practically non-transferable (`transfer`, `transferFrom`, `approve` revert), but delegation APIs still exist as ERC20Votes surface.
- **Q5:** No obvious vote duplication path in direct governance flow, but ERC20Votes checkpoint semantics can diverge from decayed lock power if external systems consume `getVotes`.
- **Q6:** Lock consistency is imperfect: minted ve balance and `_totalVotingSupply` are not continuously decayed; dynamic power uses lock math while total supply is minted/burn-based.
- **Q7:** Boundary cases are mixed: duration guards are strong; extend-after-expiry can occur; unlock/relock cadence can be timed around epochs; checkpoint mismatch risk exists for ERC20Votes consumers.
- **Q8:** `_getUnderlyingValue` relies on `IVault.previewRedeem` fallback semantics and is trust-assumption metadata if `vault` is set.
- **Q9:** Boost notifications can be silently skipped (`try/catch`), risking monitoring blind spots.
- **Q10:** `vote right before / unlock after` is partially mitigated by `LockExpiresBeforeEpochEnd`, but short-term weekly capture remains possible with minimum valid lock horizon.
- **Q11:** 2.5x model is not fully safe as implemented because `calculateBoostWithProtection` divides by `getTotalVotingPower()` that may include non-decayed/expired minted supply.
- **Q12:** `MIN_HOLDING_BLOCKS = 10` is only a light friction layer; it does not address broader strategic timing.
- **Q13:** `updateBalanceTracking` itself is restricted to `ve4626`, but users can still game timing around when they alter lock state.
- **Q14:** `calculateBoost`/`calculateBoostWithProtection`: global share-based multiplier (`baseBoost..maxBoost`), protection via block delay; `getTotalProbabilityBoost`: linear additive lock-duration boost up to `690 bps`.
- **Q15:** Combined boosts can exceed intuitive sub-cap expectations; final cap prevents unbounded values but does not prevent concentration near cap.
- **Q16:** No direct recursion loop found, but there is cross-contract coupling (`ve4626` total-power semantics affecting lottery boosts).
- **Q17:** `setBoostParameters` is truly one-way lock (`boostParametersLocked`), immutable after first set.
- **Q18:** Yes, governance can permanently lock bad parameters; there is no built-in recovery path except contract migration.

# 6. Voter Rewards and Bribes Review

- **Q37:** The 9.61% lane is mechanically aligned with voting history by vault+epoch, not wallet balance snapshots alone.
- **Q38:** Entitlement is based on historical vote weight (`getUserVoteWeightAtEpoch` / `getVaultWeightAtEpoch`), not pure ve balance.
- **Q39:** Last-minute vote capture remains possible if users can shift vote near epoch end.
- **Q40:** Strategic zero-vote epochs are possible and can later be swept/rolled by rules.
- **Q41:** 4-epoch grace is reasonable operationally but is a governance policy lever, not a hard fairness guarantee.
- **Q42:** Reward-token mismatch is guarded at notify-time; owner can repair mapping; `claimMany` can be user gas-griefed; zero-vote sweep timing is explicit.
- **Q43:** Misconfigured token/vault mapping can lock flows or redirect unexpectedly until owner repair.
- **Q44:** Bribing is compatible mechanically but increases routing centralization pressure in a probability market.
- **Q45:** Yes, `BribeDepot` can cheaply buy routing pressure when participation is thin.
- **Q46:** Claim eligibility is historical epoch participation, not current vote state.
- **Q47:** This reduces retroactive mutation risk but keeps boundary-sniping risk.
- **Q48:** Zero-vote rollover is mostly safe because no eligible claimants exist by definition.
- **Q49:** Expired rollover can be gamed by intentionally not claiming to shift leftovers into later epochs.
- **Q50:** `claimedAmount` tracks computed entitlement amounts; with atypical token mechanics this may diverge from recipient net.
- **Q51:** Worthless/rebasing/hook/deflationary tokens are a grief surface; transfer safety avoids silent underflow but not economic junk token spam.
- **Q52:** Yes, bribes should be constrained by token policy/allowlist for production safety.

# 7. Curve-Style Risk Adaptation Review

- **Q53 vote buying / bribery concentration:** More severe than emissions in short windows because it directly changes win odds.
- **Q54 last-minute vote flipping:** Similar mechanism, but immediate perceived fairness impact is higher for lottery users.
- **Q55 stale-vote persistence:** Less severe in source since votes are epoch-local; replaced by participation/fallback risk.
- **Q56 governance cartel formation:** Comparable severity; cartel can route probability rather than yield.
- **Q57 whale dominance:** More visible/user-sensitive because whales affect who wins, not just APR spread.
- **Q58 lock-duration gaming:** Similar to ve systems, but lock timing now influences consumer-facing win rates.
- **Q59 reward capture without alignment:** Still possible through boundary voting and bribes.
- **Q60 epoch-boundary sniping:** High in both models; here it can alter odds in near-real time.
- **Q61 admin gauge-list abuse:** Potentially more severe because whitelist determines who can receive probability routing.
- **Q62 treasury sweep abuse:** Medium; affects rewards/bribes economics and governance trust.
- **Q63 misconfigured reward token leakage:** Medium-high accounting/composability risk.
- **Q64 double-dipping (boost + rewards):** Real: same governance action can improve both reward claims and lottery odds.
- **Q65 creator self-dealing via controlled vaults/bribes/AMOE:** Real and materially higher concern in probability systems with user-facing fairness constraints.

# 8. Lottery Manager Review

- **Q66:** Authorized swap-contract gating is a hard trust boundary; compromise/censorship at this layer directly affects entries and boost inputs.
- **Q67:** AMOE anti-replay cannot be verified on-chain in current source because expected AMOE functions are absent.
- **Q68:** `Materially usable` AMOE fairness cannot be concluded from contracts here; appears off-chain/attestation-driven.
- **Q69:** Current source does not demonstrate complete on-chain trade + no-purchase parity path.
- **Q70:** Pause/defer pattern is technically safe for preserving randomness, but changes liveness semantics.
- **Q71:** Yes, pause can be used to delay jackpot outflows until manual unpause + pending processing.
- **Q72:** Oracle staleness/deviation checks and sponsorship controls are present; `minVaultWeightBps` floor is not present in source.
- **Q73:** Operators can influence admission/sponsorship/trust config via admin controls; some controls are tightly permissioned but still centralized.
- **Q74:** Multi-vault payout path is resilient to partial failures (`try/catch` per gauge), but this can create uneven winner payout outcomes across vaults.

# 9. VRF / Cross-Chain Randomness Review

- **Q75:** Local vs cross-chain selection is explicit and owner-controlled; request path differs by `useLocalVRF` and source context.
- **Q76:** Yes, toggles and trusted-integrator config can regress trust assumptions if governance/ops are weak.
- **Q77:** Lifecycle handling is robust for duplicates/invalid payloads/late responses/non-blocking callbacks; wrong-provider and stale states are mostly ignored safely.
- **Q78:** `(srcEid, sequence)` scoping in `CreatorVRFConsumerV2_5` correctly mitigates global-sequence collision risk.
- **Q79:** Expired requests are mostly liveness/economic nuisance, not direct randomness forgery.
- **Q80:** Expired cleanup is not an obvious hard DoS in current integrator, but can still create operational complexity.
- **Q81:** Sponsorship/rate limits can be griefed by permitted callers to consume budgets/slots.
- **Q82:** Authorized sponsored callers can abuse integrator spend unless tightly permissioned/monitored.
- **Q83:** Callback sponsorship can become a hidden fee sink or delivery bottleneck under stress.

# 10. Cross-Contract Interaction Review

- **Q84:** Yes, vote weight, boost power, and reward entitlement can disagree temporally (real-time boost vs historical claims).
- **Q85:** Registry changes can desync routing/eligibility paths across voting, rewards, and payout loops.
- **Q86:** Creator-count budget scaling manipulation is not present in current source but remains a docs/deployment parity risk.
- **Q87:** A creator/cartel can combine ve locks + bribes + trading volume to reinforce probability dominance.
- **Q88:** Circular loop exists: probability routing -> attention/volume -> fees/bribes -> more governance influence.
- **Q89:** Without stronger anti-concentration controls, loop tends toward destabilizing cartel dynamics rather than healthy competition.

# 11. Attack / Failure Scenarios

| Scenario | Preconditions | Failure path | User effect | Economic effect | Severity | Mitigation |
|---|---|---|---|---|---|---|
| 90. whale lock dominates personal boost | Large lock holder | Dominates boost share toward cap | Perceived unfair odds | Concentrated wins | High | Decayed total-power accounting, anti-whale curve |
| 91. vote cartel redirects bounded probability budget | Coordinated voters/bribe market | Cartel allocates vault weights | Reduced neutrality | Cartel captures odds edge | High | Anti-cartel caps, quorum/participation guards |
| 92. creator sybil-vault inflation enlarges total probability budget | If dynamic budget logic exists in deploy | Inflate creator/vault count | Diluted honest outcomes | Inflation of odds budget | Medium | Use activity-weighted budget, anti-sybil registry checks |
| 93. zero-vote equal-split exploitation | Low participation | Suppress votes, trigger fallback | Odds detached from voter intent | Arbitrage on fallback state | High | Participation threshold before fallback or carry-forward |
| 94. bribe epoch rollover gaming | Low claimant participation | Delay claims, roll leftovers | Timing advantage | Bribe value shifted strategically | Medium | Stricter rollover rules, claimant windows |
| 95. stale vote capture in rewards | Late vote movement | End-epoch sniping for claims | Fairness complaints | Rent extraction | Medium | Vote lock-in window before epoch close |
| 96. zero-vote reward sweep abuse | Owner control | Sweep to treasury after grace | User trust loss | Value redirected from expected claimants | Medium | Timelock + onchain justification + DAO approval |
| 97. reward token mapping mistake | Misconfiguration | Wrong token locked in mapping | Claims fail or surprise token | Accounting disruption | Medium | Two-step token changes + delay + monitoring |
| 98. emergencyResetAllVotes abuse | Owner key compromise/malice | Reset current epoch to zero | Governance nullified | Probability routing forced by fallback | High | Remove/reset guard behind timelock + emergency council |
| 99. pause-to-defer-jackpot abuse | Owner control | Pause during/after randomness | Delayed payouts | Temporal extraction/censorship risk | High | Max pause window + auto-process pending on unpause |
| 100. AMOE spam/replay/signer compromise | Off-chain signer model | Forged/replayed attestations | Entry fairness failure | Odds inflation / legal risk | High | On-chain nonce/deadline verification in manager + signer rotation |
| 101. authorized swap contract abuse | Trusted swap compromised | Fake entry inputs / censor users | Unfair admission and boosts | Distorted lottery outcomes | High | Tight allowlist, attestable onchain inputs, audits |
| 102. trusted VRF integrator compromise | Integrator trust path enabled | Malicious callback/randomness flow | Winner integrity doubts | Severe trust break | High | Multi-sig + immutable peer checks + fail-safe disable |
| 103. authorized relayer abuse | Relayer compromise | Delay/selective relay | Cross-chain liveness issues | Callback timing manipulation | High | Redundant relayers + strict SLO + slashing/monitoring |
| 104. expired-request cleanup abuse | Heavy expired backlog | Operational churn, selective cleanup | Delayed finalization | Throughput degradation | Medium | Deterministic cleanup policy + keeper automation |
| 105. cross-chain callback censorship | Fee starvation/budget limits | Winner callbacks not delivered | Poor UX, delayed notice | Confidence and volume loss | Medium | Guaranteed callback reserve + retry lanes |
| 106. double-count/double-claim across epochs | Snapshot bugs or replay | Claim state mismatch | Incorrect rewards/bribes | Leakage/overpayment risk | Medium | Strong invariants, epoch-close proofs, replay tests |
| 107. final probability exceeds intended bounds | Misconfig or formula bug | Boost accumulation overflows cap | Extreme unfairness | Jackpot skew | Low (current source) | Keep hard cap + invariant tests |
| 108. 2.5x boost model produces unfair concentration | High ve concentration + gauge edge | Combined boosts approach cap repeatedly | Perceived rigging | Retention and trust loss | High | Diminishing returns curve, per-user/per-vault dampening |

# 12. Documentation vs Code Gaps

| Assumption | Docs claim | Verified? | Why it matters |
|---|---|---|---|
| Probability budget scaling | Creator-count-based 100–300 bps examples | **No** in current source (`69_420 PPM` fixed) | Core economics and anti-sybil assumptions differ |
| `minVaultWeightBps` floor | Documented as lottery floor control | **No** in current source; appears in deployment ABI artifact | Fairness floor behavior unclear across environments |
| AMOE on-chain path | `CreatorLotteryManager` processes AMOE entries | **No** in current source (`submitAmoeEntry`/`getAmoeMessageHash` absent) | Compliance/fairness model may be off-chain and unverifiable here |
| Gauge boost shape | Docs formula implies flat additive vault boost | **Partial**; source scales gauge boost by swap size | Effective user odds differ from docs expectations |
| Bribe marketplace status | `In progress` language | **Code indicates active BribeDepot mechanics** | Product/ops messaging may understate live incentive surfaces |
| Vote persistence narrative | Docs language can imply ve-style persistence | **No** in source (epoch-local votes) | Participation strategy and fallback behavior differ materially |

# 13. Findings

## Critical

- No critical code-execution or direct funds-drain primitive was confirmed from the audited source and tests; principal risks are economic fairness, governance centralization, and docs/deployment parity.

## High

- **Title:** Non-decaying total voting supply distorts personal boost fairness.  
  **Severity:** High.  
  **Affected component:** `ve4626`, `ve4626BoostManager`.  
  **Evidence:** `getVotingPower(user)` decays by time, but `getTotalVotingPower()` returns minted `_totalVotingSupply`; `calculateBoostWithProtection()` divides by that total.  
  **Why it matters:** expired/inactive locks can keep denominator inflated and suppress everyone’s boost.  
  **Exploitability / misconfiguration path:** large lockers can leave expired locks un-unlocked, reducing competitors’ effective boost share.  
  **Recommended fix:** implement active decayed total-power accounting (slope/bias or epoch checkpoints) and use that denominator.

- **Title:** Admin can nullify active governance with `emergencyResetAllVotes`.  
  **Severity:** High.  
  **Affected component:** `VaultGaugeVoting`.  
  **Evidence:** owner-only `emergencyResetAllVotes()` zeros epoch totals and vault weights.  
  **Why it matters:** directly rewrites win-probability routing in active epoch.  
  **Exploitability / misconfiguration path:** compromised owner key or abusive intervention can force fallback regime.  
  **Recommended fix:** timelock/2-step emergency actions, bounded scope, mandatory event reasoning, or removal in favor of epoch-delayed resets.

- **Title:** Probability-budget model drift from docs (fixed 694.2 bps vs documented dynamic curve).  
  **Severity:** High.  
  **Affected component:** `VaultGaugeVoting` + system economics.  
  **Evidence:** `TOTAL_GAUGE_PROBABILITY_PPM` hard-coded to `69_420`; docs discuss creator-count scaling examples.  
  **Why it matters:** operator and user assumptions on fairness/competition are misaligned.  
  **Exploitability / misconfiguration path:** governance and market actors optimize against implementation, not documentation.  
  **Recommended fix:** either implement documented dynamic curve or update docs and monitoring dashboards to exact source behavior.

- **Title:** AMOE/min-floor parity gap between docs/frontend/deployment artifact and source manager.  
  **Severity:** High.  
  **Affected component:** `CreatorLotteryManager` ecosystem.  
  **Evidence:** source has no `submitAmoeEntry`, `getAmoeMessageHash`, or `minVaultWeightBps`; frontend/library/docs reference AMOE attestation and deployment artifact exposes floor getter.  
  **Why it matters:** fairness/compliance and threat model cannot be validated end-to-end from source.  
  **Exploitability / misconfiguration path:** off-chain signer compromise/replay or unverified alternate deployment code.  
  **Recommended fix:** publish canonical deployed bytecode+ABI, align source, and move AMOE critical checks on-chain.

- **Title:** Authorized swap contracts can influence boost inputs.  
  **Severity:** High.  
  **Affected component:** `CreatorLotteryManager`.  
  **Evidence:** `processSwapLottery(..., buyerCurrentShareBalance)` relies on authorized caller-provided balance input used in coverage scaling.  
  **Why it matters:** compromised/buggy authorized caller can inflate odds inputs or censor entries.  
  **Exploitability / misconfiguration path:** malicious or incorrect swap contract in allowlist.  
  **Recommended fix:** derive balances on-chain where possible or require verifiable attestations/proofs from canonical token contracts.

- **Title:** VRF trust-path centralization via owner-set integrator/toggle.  
  **Severity:** High.  
  **Affected component:** `CreatorLotteryManager`, VRF stack.  
  **Evidence:** owner controls `setVRFIntegrator`, `setUseLocalVRF`, trust lists.  
  **Why it matters:** randomness trust model can change quickly.  
  **Exploitability / misconfiguration path:** admin compromise or rushed ops changes.  
  **Recommended fix:** timelocked config, multi-sig-only, immutable trusted peer constraints, and runtime alerts.

## Medium

- **Title:** Equal-split fallback denominator includes manually whitelisted vault set, not effective registry-eligible set.  
  **Severity:** Medium.  
  **Affected component:** `VaultGaugeVoting`.  
  **Evidence:** zero-vote branch uses `_whitelistedVaults.length()` while eligibility check is per target vault.  
  **Why it matters:** budget can dilute unexpectedly when whitelisted-but-ineligible vaults exist.  
  **Exploitability / misconfiguration path:** governance can pad whitelist and alter fallback economics.  
  **Recommended fix:** compute denominator from effective `_isVaultWhitelisted` set for current epoch.

- **Title:** Silent `try/catch` in boost/gauge retrieval hides failures.  
  **Severity:** Medium.  
  **Affected component:** `CreatorLotteryManager._applyBoost`.  
  **Evidence:** failed external calls degrade to base behavior without hard signals except absence of boost effect.  
  **Why it matters:** fairness regressions can go unnoticed in production.  
  **Exploitability / misconfiguration path:** intermittent dependency failures causing implicit deboost.  
  **Recommended fix:** emit explicit failure events and enforce fail-open/fail-closed policy per source.

- **Title:** Last-minute vote sniping remains for rewards/bribes.  
  **Severity:** Medium.  
  **Affected component:** `VaultGaugeVoting`, `VoterRewardsDistributor`, `BribeDepot`.  
  **Evidence:** entitlement is epoch snapshot with no anti-sniping lock window.  
  **Why it matters:** governance intent can be front-run near epoch close.  
  **Exploitability / misconfiguration path:** bribe-informed final-block reallocation.  
  **Recommended fix:** introduce vote cutoff period before epoch end.

- **Title:** Arbitrary bribe token acceptance enables junk-token griefing.  
  **Severity:** Medium.  
  **Affected component:** `BribeDepot`.  
  **Evidence:** no token allowlist in `bribe()`.  
  **Why it matters:** UX and claim-value quality degrade; potential malicious-token operational issues.  
  **Exploitability / misconfiguration path:** spam bribes with low-quality tokens.  
  **Recommended fix:** allowlist by governance with emergency blocklist.

- **Title:** Pause + deferred randomness creates operator-dependent liveness debt.  
  **Severity:** Medium.  
  **Affected component:** `CreatorLotteryManager`.  
  **Evidence:** paused callbacks store randomness and require explicit post-unpause processing.  
  **Why it matters:** payout timing can become discretionary.  
  **Exploitability / misconfiguration path:** prolonged pause or delayed pending processing.  
  **Recommended fix:** max pause SLA and automated pending-result drain.

## Low

- **Title:** ERC20Votes checkpoint semantics may be misused by future modules.  
  **Severity:** Low.  
  **Affected component:** `ve4626`.  
  **Evidence:** non-transferable token still exposes delegation/checkpoints while governance uses separate dynamic power path.  
  **Why it matters:** future integrations may read wrong power notion.  
  **Exploitability / misconfiguration path:** accidental use of checkpoint votes for decisions.  
  **Recommended fix:** document and gate approved power source interfaces.

- **Title:** One-way boost parameter lock increases governance mistake blast radius.  
  **Severity:** Low.  
  **Affected component:** `ve4626BoostManager`.  
  **Evidence:** `setBoostParameters` permanently locks on first set.  
  **Why it matters:** no recovery for mis-set values.  
  **Exploitability / misconfiguration path:** operator error at initialization.  
  **Recommended fix:** staged locking with delayed finalization and explicit acceptance.

- **Title:** `claimMany` is user-gas sensitive.  
  **Severity:** Low.  
  **Affected component:** `VoterRewardsDistributor`.  
  **Evidence:** unbounded user-provided vault array loop.  
  **Why it matters:** self-DoS/noisy UX.  
  **Exploitability / misconfiguration path:** oversized claim calls fail.  
  **Recommended fix:** recommended batch size and helper pagination.

## Informational

- **Title:** Bribe flow appears production-ready in source despite `in progress` docs language.  
  **Severity:** Informational.  
  **Affected component:** docs/product alignment.  
  **Evidence:** full `BribeDepot` claim/rollover logic and tests are present.  
  **Why it matters:** operator expectations and external communications may be inconsistent.  
  **Exploitability / misconfiguration path:** policy misunderstanding.  
  **Recommended fix:** align docs/status with deployment reality.

- **Title:** VRF non-blocking receive logic is materially hardened.  
  **Severity:** Informational.  
  **Affected component:** VRF stack.  
  **Evidence:** invalid payload/duplicate/late handling emits and returns rather than lane-blocking revert.  
  **Why it matters:** strong liveness posture.  
  **Exploitability / misconfiguration path:** mostly operational, not fatal.  
  **Recommended fix:** keep this invariant under upgrades.

- **Title:** Multi-vault payout design tolerates partial gauge failures.  
  **Severity:** Informational.  
  **Affected component:** `CreatorLotteryManager` payout loop.  
  **Evidence:** per-vault `try/catch` in jackpot payout loop.  
  **Why it matters:** improves liveness but can produce uneven winner outcomes.  
  **Exploitability / misconfiguration path:** failing gauges reduce realized payout.  
  **Recommended fix:** add transparency metrics and retry policies.

# 14. Production Readiness Verdict

| Dimension | Score (1-10) | Notes |
|---|---:|---|
| governance soundness | 5 | Mechanically functional but centralization and fallback edges are significant |
| anti-cartel resilience | 4 | Bribes + concentration + boundary timing remain strong |
| whale resistance | 4 | Hard cap helps, but combined levers still favor large actors |
| bribe-market safety | 5 | Core accounting works; token quality/policy controls are thin |
| reward-accounting integrity | 7 | Epoch snapshots and checks are solid overall |
| lottery fairness | 5 | Cap and guards exist, but trust/config surfaces remain heavy |
| VRF robustness | 7 | Non-blocking cross-chain handling is strong |
| cross-chain robustness | 6 | Good design, still ops-heavy and sponsor-budget sensitive |
| overall deployability | 5 | Deployable with strict governance/ops controls, not trust-minimized |

- **Would I ship this with real users today?** Not in its current governance/ops posture for high-stakes production.
- **Under what strict conditions only?** Multi-sig + timelock on all sensitive setters, published canonical ABI/bytecode parity, AMOE path reconciliation, stronger swap-input attestations, and live monitoring with incident playbooks.
- **Top 10 blockers:**
  - Resolve `ve4626` total-power denominator distortion for boost fairness.
  - Harden/remove `emergencyResetAllVotes` immediate power.
  - Reconcile docs/source/deployment parity for AMOE and min-floor behavior.
  - Enforce timelocked governance over whitelist/registry/VRF toggles.
  - Add stricter validation for swap-provided balance/coverage inputs.
  - Add explicit fail telemetry for swallowed external-call failures in boost path.
  - Add vote cutoff window to reduce epoch sniping.
  - Add bribe token policy/allowlist.
  - Add pause duration limits and automatic pending VRF result draining.
  - Publish and verify live deployment bytecode against audited source.

# 15. Must-Inspect Code Checklist

- **`VaultGaugeVoting.sol`:** inspect `vote`, `_clearUserVotes`, `getVaultGaugeProbabilityBoostPPM`, `_isVaultWhitelisted`, `checkpoint`, `emergencyResetAllVotes`; verify state `_epochVaultVotes`, `_epochTotalVotes`, `_whitelistedVaults`; verify events `Voted`, `VotesReset`, `EpochCheckpointed`, `VaultWhitelisted`; verify errors `LockExpiresBeforeEpochEnd`, `VaultNotWhitelisted`.
- **`ve4626.sol`:** inspect `lock`, `extendLock`, `increaseLock`, `unlock`, `_calculateVotingPower`, `getVotingPower`, `getTotalVotingPower`, `votingPowerAt`, `_notifyBoostManager`; verify `_totalVotingSupply` behavior and lock lifecycle invariants; verify non-transferability overrides and ERC20Votes interactions.
- **`ve4626BoostManager.sol`:** inspect `calculateBoostWithProtection`, `getTotalProbabilityBoost`, `getCoverageBps`, `updateBalanceTracking`, `setBoostParameters`, `setMinVotingPower`; verify state `lastBalanceUpdateBlock`, `boostParametersLocked`.
- **`VoterRewardsDistributor.sol`:** inspect `notifyRewards`, `_claim`, `claimMany`, `previewClaim`, `sweepZeroVoteEpoch`, `recoverVaultRewardToken`; verify `epochVaultRewards`, `vaultRewardToken`, `hasClaimed`, `sweepGraceEpochs`.
- **`BribeDepot.sol`:** inspect `bribe`, `claim`, `rolloverZeroVoteEpoch`, `rolloverExpiredEpoch`; verify `totalBribes`, `claimedAmount`, `isClosed`, `rolloverGraceEpochs`; validate behavior on deflationary/rebasing tokens.
- **`CreatorGaugeController.sol`:** inspect `_distributeInternal`, `_distributeVaultShares`, `payJackpot`, `setFeeSplit`, `setLotteryManager`, `setVoterRewardsDistributor`, `emergencyWithdraw`; verify split invariants and fallback routing.
- **`CreatorLotteryManager.sol`:** inspect `processSwapLottery`, `_applyBoost`, `_scaleGaugeBoostBySwapSize`, `_processVRFResult`, `processPendingVrfResult`, `_payoutLocalJackpot`, `setAuthorizedSwapContract`, `setUseLocalVRF`, `setVRFIntegrator`, `setVrfSponsorshipPolicy`, `setCallbackSponsorshipPolicy`, `setSponsorshipRateLimits`; verify `vrfRequests`, `pendingRandomWord`, sponsorship budget state; explicitly verify presence/absence of `submitAmoeEntry`, `getAmoeMessageHash`, `minVaultWeightBps`.
- **`CreatorVRFConsumerV2_5.sol`:** inspect `_lzReceive`, `_consumeRateLimit`, `_relayResponse`, `relayResponse`, `rawFulfillRandomWords`, `setAuthorizedRelayer`, `setAuthorizedLocalCaller`; verify `sequenceToRequestId[srcEid][sequence]`, `pendingResponses`, and replay/ordering invariants.
- **`ChainlinkVRFIntegratorV2_5.sol`:** inspect `_lzReceive`, request creation paths, `cleanupExpiredRequests`, `setSponsoredCallerAuthorization`, `setRequestTimeout`; verify `s_requests`, `authorizedSponsoredCallers`, late-response handling.
- **Dependencies to verify in private repo/live deploy:** `CreatorRegistry` mapping correctness (`getVaultForToken`, `getGaugeControllerForToken`, `isCreatorCoinActive`, `getAllCreatorCoins`), oracle contracts feeding `getCreatorPrice`, LayerZero peer config and endpoint settings, and exact deployed `CreatorLotteryManager` bytecode/ABI parity against source.
