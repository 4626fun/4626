# Codex Security Triage — 2026-07-22

Sources: dual Codex CSV exports in this directory.

Deduped clusters: **672**

## Disposition counts

| Disposition | Count |
|---|---:|
| confirm-fix | 88 |
| already-mitigated | 17 |
| accept-risk | 7 |
| false-positive | 3 |
| defer | 557 |
| pending | 0 |

## Critical / High

| ID | Wave | Sev | Disposition | Title |
|---|---|---|---|---|
| CH-001 | W0 | critical | confirm-fix | Public adminModuleCall exposes jackpot payout delegatecall |
| CH-002 | W0 | high | confirm-fix | Unauthenticated VRF request path enables subscription draining |
| CH-003 | W0 | high | confirm-fix | Unrestricted randomness requests can drain Chainlink VRF funds |
| CH-004 | W1 | high | confirm-fix | Client email hint can verify or steal waitlist accounts |
| CH-005 | W1 | high | confirm-fix | Client email hint enables waitlist account takeover |
| CH-006 | W1 | high | confirm-fix | Email rebind leaves stale Privy aliases active |
| CH-007 | W1 | high | accept-risk | Privy proxy leaks parent-domain session cookie |
| CH-008 | W1 | high | confirm-fix | Privy signing key synced to non-production Vercel envs |
| CH-009 | W1 | high | confirm-fix | Unverified waitlist email hints can rebind accounts |
| CH-010 | W1 | high | confirm-fix | Waitlist collision adoption can rebind victim accounts |
| CH-011 | W1 | high | confirm-fix | Wallet-first waitlist login trusts spoofable email hints |
| CH-012 | W2 | high | confirm-fix | Arch B /coin sell trusts Zora quote for CSW calls |
| CH-013 | W2 | high | confirm-fix | Arch B /coin sell uses unvalidated Zora quote calls |
| CH-014 | W2 | high | confirm-fix | CSW Permit2 signing trusts unvalidated quote permit data |
| CH-015 | W2 | high | confirm-fix | Client exposes direct CDP paymaster endpoint |
| CH-016 | W2 | high | confirm-fix | Client-exposed direct CDP paymaster bypasses proxy checks |
| CH-017 | W2 | high | confirm-fix | Custom owner token bypasses paymaster sender ownership checks |
| CH-018 | W2 | high | confirm-fix | Direct public CDP paymaster URL bypasses proxy policy |
| CH-019 | W2 | high | confirm-fix | EOA owner lane trusts tamperable add-owner previews |
| CH-020 | W2 | high | confirm-fix | EOA owner signs unverified prepared UserOp hash |
| CH-021 | W2 | high | already-mitigated | External EOA fallback can bypass swap paymaster policy |
| CH-022 | W2 | high | already-mitigated | Historical embedded EOA re-enabled for CSW execution |
| CH-023 | W2 | high | already-mitigated | Paymaster accepts phase-2 code IDs for wrong vault lane |
| CH-024 | W2 | high | confirm-fix | Paymaster accepts under-validated Swap Proxy calls |
| CH-025 | W2 | high | already-mitigated | Paymaster can sponsor irreversible AgentToken ownership transfer |
| CH-026 | W2 | high | confirm-fix | Paymaster swap path bypasses allowlist and swap checks |
| CH-027 | W2 | high | confirm-fix | Public Vite paymaster URL bypasses sponsorship proxy |
| CH-028 | W2 | high | already-mitigated | Self-bundled deploys donate withdrawable EntryPoint deposits |
| CH-029 | W2 | high | already-mitigated | Self-bundled deploys overfund user-withdrawable deposits |
| CH-030 | W2 | high | accept-risk | Stale CSWs can be rebound to unauthorized profiles |
| CH-031 | W2 | high | accept-risk | Swap sponsorship bypasses creator allowlist |
| CH-032 | W2 | high | confirm-fix | Unauthenticated Relay quote proxy exposes subsidized arbitrary intents |
| CH-033 | W2 | high | confirm-fix | Unpaid Stripe bundle row grants deploy entitlements |
| CH-034 | W2 | high | confirm-fix | Untrusted Zora wallet can become canonical CSW |
| CH-035 | W2 | high | confirm-fix | Untrusted forwarded host used as canonical origin |
| CH-036 | W2 | high | confirm-fix | Unvalidated Permit2 CSW signatures can drain wallet tokens |
| CH-037 | W2 | high | confirm-fix | Unvalidated Zora permits can authorize arbitrary CSW spenders |
| CH-038 | W3 | high | confirm-fix | Auto-discovered rooms can trigger strategy trades |
| CH-039 | W3 | high | confirm-fix | Auto-keep media enables SSRF and secret exfiltration |
| CH-040 | W3 | high | confirm-fix | CI changes weaken secret protection |
| CH-041 | W3 | high | confirm-fix | CRE shadow-mode can be bypassed by authenticated callers |
| CH-042 | W3 | high | confirm-fix | CRON_SECRET can now overwrite AlfaClub auth tokens |
| CH-043 | W3 | high | confirm-fix | Chip username spoof bypasses staker trade gate |
| CH-044 | W3 | high | confirm-fix | Counter-trade opt-in can trade the room default Arena wallet |
| CH-045 | W3 | high | confirm-fix | Cross-room stake gate allows shared-wallet trade control |
| CH-046 | W3 | high | confirm-fix | Cross-room stake grants shared executor trade authority |
| CH-047 | W3 | high | confirm-fix | Default auto-keep can SSRF and pin internal responses |
| CH-048 | W3 | high | already-mitigated | Dust fills can trigger oversized rebalance dip orders |
| CH-049 | W3 | high | confirm-fix | Dynamic room discovery can let unapproved rooms trigger trades |
| CH-050 | W3 | high | confirm-fix | Hermit DMs expose privileged command executor |
| CH-051 | W3 | high | confirm-fix | Hermit Telegram token can mint Mini App sessions |
| CH-052 | W3 | high | confirm-fix | Hermit image pulls mutable third-party code at build time |
| CH-053 | W3 | high | already-mitigated | KPR rename makes keeper zone guards fail open on legacy envs |
| CH-054 | W3 | high | confirm-fix | Keeper control-plane endpoint bypasses queued policy checks |
| CH-055 | W3 | high | confirm-fix | Keeper cron can leak KEEPR_API_KEY via derived base URL |
| CH-056 | W3 | high | confirm-fix | Keepers can directly move Ajna vault assets without caps |
| CH-057 | W3 | high | confirm-fix | New room polling can replay stale AlfaClub commands |
| CH-058 | W3 | high | confirm-fix | OApp sender can leak the global keeper API key |
| CH-059 | W3 | high | confirm-fix | Public Hermit DMs execute as AlfaClub room commands |
| CH-060 | W3 | high | confirm-fix | SSRF in Hermit /keep media pinning |
| CH-061 | W3 | high | confirm-fix | Same-origin IPFS rewrite enables XSS on 4626.fun |
| CH-062 | W3 | high | confirm-fix | Settled truth gate trusts client-supplied authority |
| CH-063 | W3 | high | confirm-fix | Staker pilot access can overwrite Arena agent identity |
| CH-064 | W3 | high | accept-risk | Submodule retargets executable skill to personal fork |
| CH-065 | W3 | high | confirm-fix | Telegram relay commands execute as relay wallet |
| CH-066 | W3 | high | confirm-fix | Unpinned Wrangler action can exfiltrate deploy secrets |
| CH-067 | W3 | high | confirm-fix | Unpinned deploy actions can expose Cloudflare secrets |
| CH-068 | W3 | high | confirm-fix | Unpinned external CLI and skill code in production image |
| CH-069 | W3 | high | confirm-fix | Unrestricted /keep media fetch enables SSRF exfiltration |
| CH-070 | W3 | high | confirm-fix | Unrestricted manual deploy can bypass review |
| CH-071 | W3 | high | confirm-fix | Untrusted users can opt into room-default trading identity |
| CH-072 | W3 | high | confirm-fix | Unverified Solana mint mapping can hijack keeper routing |
| CH-073 | W3 | high | confirm-fix | User HL API key leaks to arena child processes |
| CH-074 | W3 | high | confirm-fix | Workflow dispatch can leak the cron secret via branch code |
| CH-075 | W3 | high | already-mitigated | `/h arena` bypasses Hermit operator authorization |
| CH-076 | W3 | high | accept-risk | dgclaw submodule retargeted to untrusted fork |
| CH-077 | W3 | high | confirm-fix | trade-completed payload can spoof chat reaction author |
| CH-078 | W4 | high | confirm-fix | Ajna limit index buffer moves in wrong direction |
| CH-079 | W4 | high | confirm-fix | Allowlist bypass via untrusted creator token parties |
| CH-080 | W4 | high | confirm-fix | Batcher can hijack uninitialized registry entries |
| CH-081 | W4 | high | confirm-fix | Batcher finalize can hijack creator registry entries |
| CH-082 | W4 | high | confirm-fix | Bootstrap helper can overwrite Solana peer bindings |
| CH-083 | W4 | high | confirm-fix | Keeper can move Ajna vault buffer into risky buckets |
| CH-084 | W4 | high | confirm-fix | Per-call role policy override bypasses deploy policy |
| CH-085 | W4 | high | confirm-fix | Role-policy override bypasses vault deployment checks |
| CH-086 | W4 | high | confirm-fix | Safe helper wire script trusts unvalidated RPC helper slots |
| CH-087 | W4 | high | confirm-fix | Safe wire script trusts RPC for privileged helper addresses |
| CH-088 | W4 | high | confirm-fix | Weak agent-token checks can bypass deploy access gates |
| CH-089 | W5 | high | confirm-fix | Workflow dispatch input allows secret-bearing shell injection |
| CH-090 | W5 | high | confirm-fix | Workflow input command injection can expose ACP secrets |
| CH-091 | W6 | high | confirm-fix | AMOE retries relay entries without charging credits |
| CH-092 | W6 | high | confirm-fix | Devnet probe spills SOLANA_PRIVATE_KEY to /tmp |
| CH-093 | W6 | high | confirm-fix | Embedded owner install signs unverified prepared userOps |
| CH-094 | W6 | high | confirm-fix | First LP seed can use a manipulated V4 pool price |
| CH-095 | W6 | high | confirm-fix | GS026 fallback can sign unverified Safe service transactions |
| CH-096 | W6 | high | confirm-fix | IPFS rewrite exposes untrusted content on trusted 4626.fun origin |
| CH-097 | W6 | high | confirm-fix | Launch script exposes production secrets to build tooling |
| CH-098 | W6 | high | confirm-fix | Missing RLS on condensed sensitive Supabase tables |
| CH-099 | W6 | high | confirm-fix | Safe owner private key can be sent as a Safe tx hash |
| CH-100 | W6 | high | confirm-fix | Seed script preserves known placeholder API key |
| CH-101 | W6 | high | already-mitigated | Shared impairment escrow can be reassigned and drained |
| CH-102 | W6 | high | accept-risk | Stale CSW recovery can bypass wallet unlinking |
| CH-103 | W6 | high | accept-risk | Strategy caps can underprice shares and dilute incumbents |
| CH-104 | W6 | high | confirm-fix | Telegram webhook accepts lower-privilege link API secret |
| CH-105 | W6 | high | confirm-fix | Untrusted quote output sets external swap min-out |

## Medium / Low / Informational

| ID | Sev | Disposition | Title |
|---|---|---|---|
| MLI-001 | medium | defer | 1659 doctor prints production secrets to logs |
| MLI-002 | medium | defer | 403 room denial now fails open to live chat processing |
| MLI-003 | medium | defer | ACP refresh tokens exposed in process arguments |
| MLI-004 | medium | defer | ACP session owner can be caller-controlled during Arena create |
| MLI-005 | medium | defer | ACP_BIN is interpolated into shell commands |
| MLI-006 | medium | defer | AMOE ZK UI burns credits before a non-retriable submit |
| MLI-007 | medium | defer | AMOE ZK UI burns credits before submit is ready |
| MLI-008 | medium | defer | AMOE cutover script can leave temporary root publisher active |
| MLI-009 | medium | defer | AMOE cutover script grants publisher role to deprecated CSW |
| MLI-010 | medium | defer | AMOE cutover script keeps deprecated publisher key |
| MLI-011 | medium | defer | AMOE eligibility now trusts spoofable profile email flags |
| MLI-012 | medium | defer | AMOE guard leaks RPC secrets and checks stale selectors |
| MLI-013 | medium | defer | AMOE path trusts relayer input for entry value and eligibility |
| MLI-014 | medium | defer | AMOE relay falls back to generic keeper CSW credentials |
| MLI-015 | medium | defer | AMOE relayer can mint arbitrary lottery entries without proof |
| MLI-016 | medium | defer | AMOE tweet proof is not bound to the credited wallet |
| MLI-017 | medium | defer | AMOE waitlist points inflate spendable lottery credits |
| MLI-018 | medium | defer | Activation token bypasses paymaster sponsorship limits |
| MLI-019 | medium | defer | Admin deploy sessions bypass fresh Privy reauthentication |
| MLI-020 | medium | defer | Admin keeper tick can leak KPR key via Host header |
| MLI-021 | medium | defer | Agent ShareOFT skips cooldown propagation via DEX addresses |
| MLI-022 | medium | defer | Agent wrapper over-pulls taxed deposits |
| MLI-023 | medium | defer | Ajna control now trusts stale registry owner |
| MLI-024 | medium | defer | AlfaClub /gmeow bypasses X posting authorization |
| MLI-025 | medium | defer | AlfaClub digests leak chat usernames for wallets |
| MLI-026 | medium | defer | AlfaClub proxy allows all /api/room endpoints |
| MLI-027 | medium | defer | AlfaClub read flag bypass exposes leaderboard data |
| MLI-028 | medium | defer | Allowlist blocks risk-reducing closes for existing positions |
| MLI-029 | medium | defer | Ambiguous oil chat can trigger live trades |
| MLI-030 | medium | defer | Arena backtest bypasses disable flag and can exhaust resources |
| MLI-031 | medium | defer | Arena command resolution fails open to fallback binaries |
| MLI-032 | medium | defer | Arena dgclaw fallback bypasses configured command path |
| MLI-033 | medium | defer | Arena identity cache can outlive DB revocation |
| MLI-034 | medium | defer | Arena onboarding diagnostics can leak command secrets |
| MLI-035 | medium | defer | Arena onboarding failures can leak subprocess output to chat |
| MLI-036 | medium | defer | Audit script sources env files as shell code |
| MLI-037 | medium | defer | Auth handoff URL auto-redeem enables login CSRF |
| MLI-038 | medium | defer | Auth resolver ignores merged profile tombstones |
| MLI-039 | medium | defer | Auth state changes no longer refresh account data |
| MLI-040 | medium | defer | Authenticated vanity endpoint allows CPU exhaustion |
| MLI-041 | medium | defer | Authenticated vanity endpoint enables CPU DoS |
| MLI-042 | medium | defer | Auto Zora swaps now allow 10% slippage by default |
| MLI-043 | medium | already-mitigated | Bare /gmeow now calls Pinata by default |
| MLI-044 | medium | defer | Batched swap estimate failures can be bypassed |
| MLI-045 | medium | defer | Bribe claims can drain later epoch token balances |
| MLI-046 | medium | defer | Broad gitleaks allowlist hides generic env secrets |
| MLI-047 | medium | defer | CCA workflow bypasses canonical settlement gate |
| MLI-048 | medium | defer | CF challenge path disables AlfaClub live fallback |
| MLI-049 | medium | defer | CRE automation dependency audit removed from CI |
| MLI-050 | medium | defer | CRE dependency audit removed from security CI |
| MLI-051 | medium | defer | CSRF guard weakened by trusting marketing origin/header bypass |
| MLI-052 | medium | defer | CSW Zora swaps silently force 5% slippage |
| MLI-053 | medium | defer | Caller can bypass vault role policy with policy id 0 |
| MLI-054 | medium | defer | Canary verifier ignores unsafe jackpot and VRF state |
| MLI-055 | medium | defer | Canonical swaps clear pending UserOp state too early |
| MLI-056 | medium | defer | Canonical swaps refresh quote after user confirmation |
| MLI-057 | medium | defer | Ceremony setup script skips ptau checksum verification |
| MLI-058 | medium | defer | Charm delegate CSW automation can be falsely rejected |
| MLI-059 | medium | defer | Charm factory deployment leaves vault governance external |
| MLI-060 | medium | defer | Charm strategy withdrawal can be DoSed by swap failure |
| MLI-061 | medium | defer | Chat Ethos badges leak private DM peer addresses |
| MLI-062 | medium | defer | Chat fallback names treated as verified Basenames |
| MLI-063 | medium | defer | Chat score hydration leaks XMTP peer addresses |
| MLI-064 | medium | defer | Child process stderr is echoed into public chat |
| MLI-065 | medium | defer | Chip trade cards can be mis-attributed to stakers |
| MLI-066 | medium | defer | Chip username spoofing suppresses chat bridge fan-out |
| MLI-067 | medium | defer | Client aborts can trip the shared LLM provider circuit |
| MLI-068 | medium | already-mitigated | Client-controlled forceWrite bypasses CRE shadow mode |
| MLI-069 | medium | defer | Client-controlled settledAt authority bypasses sweep gate |
| MLI-070 | medium | defer | Control-plane operator endpoint bypasses zone auth |
| MLI-071 | medium | defer | Cooldown propagation bypass for established ShareOFT holders |
| MLI-072 | medium | defer | Cost probe copies operator keypair to predictable /tmp file |
| MLI-073 | medium | defer | Cost probe leaks supplied Solana private key to /tmp |
| MLI-074 | medium | defer | Counter-trade harvest endpoint leaks bot wallet PnL |
| MLI-075 | medium | defer | Cron history cap enables AlfaClub command suppression |
| MLI-076 | medium | defer | Cron secret compared with timing-leaky equality |
| MLI-077 | medium | defer | Cron smoke can leak CRON_SECRET to arbitrary origins |
| MLI-078 | medium | defer | Cutover script exposes treasury private key in process args |
| MLI-079 | medium | defer | Cutover scripts can sync deprecated v1.18 infra |
| MLI-080 | medium | defer | DB error diagnostics can leak AlfaClub tokens to logs |
| MLI-081 | medium | defer | DM fallback names can spoof verified chat identity |
| MLI-082 | medium | defer | Daily brief cron disables AlfaClub room access policies |
| MLI-083 | medium | defer | Daily brief leaks room links from chat activity |
| MLI-084 | medium | defer | Daily brief sync disables AlfaClub room gates |
| MLI-085 | medium | defer | Daily spend cap can be bypassed by concurrent UserOps |
| MLI-086 | medium | defer | Deferred VRF lottery results became owner-selective |
| MLI-087 | medium | defer | Delayed remote lottery entry allows price‑timing manipulation |
| MLI-088 | medium | defer | Deploy UI exposes role-policy bypass override |
| MLI-089 | medium | defer | Deploy self-bundling can abuse privileged fallback keys |
| MLI-090 | medium | defer | Deployment handoff file is sourced as shell code |
| MLI-091 | medium | defer | Devnet deploy script leaks Solana private keys |
| MLI-092 | medium | defer | Devnet deploy script writes private key to repo file |
| MLI-093 | medium | defer | Docs Vercel previews can run unreviewed code |
| MLI-094 | medium | defer | Doctor command prints live secrets to stdout |
| MLI-095 | medium | defer | Doctor script prints live service secrets |
| MLI-096 | medium | defer | Doctor script prints production secrets to stdout |
| MLI-097 | medium | defer | Dry-run vault keeper can execute live writes via HTTP bridge |
| MLI-098 | medium | defer | ERC-8004 paid review fetch allows DNS-rebinding SSRF |
| MLI-099 | medium | defer | Embedded EOA can execute from canonical CSW |
| MLI-100 | medium | defer | Explore API can be forced into costly sparkline fan-out |
| MLI-101 | medium | defer | Explore backfill lacks a durable run lock |
| MLI-102 | medium | defer | External swap allows keeper to redirect swap output to attacker |
| MLI-103 | medium | defer | External swap path lets keeper drain router token balances |
| MLI-104 | medium | defer | Fail-open sub-account owner check enables unverified installs |
| MLI-105 | medium | defer | Forwarded EVM lottery entries are rejected |
| MLI-106 | medium | defer | Gitleaks allowlist hides generic secrets in *.example.env |
| MLI-107 | medium | defer | Global MCP config exposes 4626 ops tools cross-workspace |
| MLI-108 | medium | defer | Grandfather fallback accepts mismatched share tokens |
| MLI-109 | medium | defer | Grandfathered vault fallback weakens KPR registry checks |
| MLI-110 | medium | defer | Hard-coded automation Safe blocks emergency rotation |
| MLI-111 | medium | defer | Hardcoded paid RPC auth token in ops script |
| MLI-112 | medium | defer | Harvest status leaks bot wallet trading summaries |
| MLI-113 | medium | defer | Hermit X media upload can fetch untrusted large URLs |
| MLI-114 | medium | defer | Hermit agent now runs as root in Dockerfile.agent |
| MLI-115 | medium | defer | Hermit container now runs the service as root |
| MLI-116 | medium | defer | Hermit media replies bypass X posting authorization |
| MLI-117 | medium | defer | Hermit meme list exposes room data to any authenticated user |
| MLI-118 | medium | defer | Internal audit findings published under public docs |
| MLI-119 | medium | defer | KPR payout monitor loses payout-router safety checks |
| MLI-120 | medium | defer | Keeper env sync writes production secrets world-readable |
| MLI-121 | medium | defer | Keeper registry fallback accepts spoofed grandfathered vaults |
| MLI-122 | medium | defer | Keeper timeout can retry in-flight on-chain jobs |
| MLI-123 | medium | defer | Keepr execute skips trust-zone auth when env secret missing |
| MLI-124 | medium | defer | Keepr trust zone auth bypass if zone key env unset |
| MLI-125 | medium | defer | Key safety ignores raids by existing majority holders |
| MLI-126 | medium | defer | LLM classifier runs before chat author eligibility check |
| MLI-127 | medium | defer | LP reserve sweep can be triggered before sweep window |
| MLI-128 | medium | defer | Leaderboard auto-pagination can overload the API |
| MLI-129 | medium | defer | Leaderboard pagination can amplify DB load |
| MLI-130 | medium | defer | Legacy salt selectors bypass vanity entitlement check |
| MLI-131 | medium | defer | Live AlfaClub fallback misroutes commands across rooms |
| MLI-132 | medium | defer | Live fallback can execute commands in the wrong AlfaClub room |
| MLI-133 | medium | defer | Long spendRefId makes AMOE burns unprojectable |
| MLI-134 | medium | defer | Lottery cutover can strand jackpot payouts |
| MLI-135 | medium | defer | Manual docs deploy can publish unreviewed refs |
| MLI-136 | medium | defer | Manual health workflow can leak the cron secret |
| MLI-137 | medium | defer | Meteora pool provisioning trusts unverified share mints |
| MLI-138 | medium | defer | Mirrored exits can close unrelated bot positions |
| MLI-139 | medium | defer | Nested Uniswap quote bypasses swap policy checks |
| MLI-140 | medium | defer | Non-atomic daily spend cap reservation |
| MLI-141 | medium | defer | On-chain owner fallback bypasses profile linkage revocation |
| MLI-142 | medium | defer | Open /signal command can exhaust bot and data APIs |
| MLI-143 | medium | defer | Operator can sweep LP reserve before auction launch |
| MLI-144 | medium | defer | Ops script disables TLS verification for secret fetch |
| MLI-145 | medium | defer | Ops script exposes PRIVATE_KEY in child process args |
| MLI-146 | medium | defer | Orchestrator API key exposed via process arguments |
| MLI-147 | medium | defer | Orphan address guard misses no-0x runtime defaults |
| MLI-148 | medium | defer | Overbroad AlfaClub proxy room API allowlist |
| MLI-149 | medium | defer | Partial close can silently become a full close |
| MLI-150 | medium | defer | Partial defense closes can execute as full closes |
| MLI-151 | medium | defer | Paymaster accepts unvalidated Universal Router calldata |
| MLI-152 | medium | defer | Paymaster allowlist bypass for deploy-session selfcalls |
| MLI-153 | medium | defer | Paymaster allowlist not updated for Phase 1 ABI change |
| MLI-154 | medium | defer | Paymaster omits Zora min-output check server-side |
| MLI-155 | medium | defer | Payout recipient invariant fails open on read errors |
| MLI-156 | medium | defer | Paywall bypass via Stripe checkout pending activation |
| MLI-157 | medium | already-mitigated | Permit2 match lets arbitrary Zora swaps get sponsorship |
| MLI-158 | medium | already-mitigated | Permit2 needle can bypass Zora paymaster swap policy |
| MLI-159 | medium | defer | Persisted canonical wallet mapping blocks revocation |
| MLI-160 | medium | defer | Phase boundary check permits smuggled batcher calls |
| MLI-161 | medium | defer | Phase1 paymaster decode lacks codeId/vaultKind checks |
| MLI-162 | medium | defer | Phase1 sponsorship lacks vaultKind/codeId validation |
| MLI-163 | medium | defer | Phase2 module hot-swap permits arbitrary delegatecall logic |
| MLI-164 | medium | defer | Phase2 paymaster skips vault provenance checks |
| MLI-165 | medium | defer | Phase2 provenance bypass enables paymaster gas abuse |
| MLI-166 | medium | defer | Phase3 deploy gating accepts unpaid pending feature activations |
| MLI-167 | medium | already-mitigated | Pinata token persisted in Git remote URL |
| MLI-168 | medium | defer | Policy checks in swap_5792/7702 can be bypassed by extra quotes |
| MLI-169 | medium | defer | Pool-level BEGIN causes cross-request DB transaction races |
| MLI-170 | medium | defer | Pooled BEGIN/COMMIT corrupts account transaction isolation |
| MLI-171 | medium | defer | Pre-signed UserOp sender is not bound to current CSW |
| MLI-172 | medium | defer | Preset changes can orphan subaccount exit trades |
| MLI-173 | medium | defer | Private DM flag bypasses Telegram chat allowlist |
| MLI-174 | medium | defer | Privy bridge auto-provisions wallets before email proof |
| MLI-175 | medium | defer | Privy proxy leaks 4626 session cookies upstream |
| MLI-176 | medium | defer | Protocol automation Safe is 1-of-1 hot keeper controlled |
| MLI-177 | medium | defer | Public AMOE credits endpoint leaks verified Privy accounts |
| MLI-178 | medium | defer | Public Dune route can drain API quota |
| MLI-179 | medium | defer | Public Ethos diagnostics views expose DB query telemetry |
| MLI-180 | medium | defer | Public Ethos explore path can force full-table ranking |
| MLI-181 | medium | defer | Public Ethos explore path enables DB/API amplification DoS |
| MLI-182 | medium | defer | Public Ethos maintenance RPCs bypass admin auth |
| MLI-183 | medium | defer | Public Supabase views bypass RLS-protected indexer tables |
| MLI-184 | medium | defer | Public backtest audit endpoint leaks server-side data |
| MLI-185 | medium | defer | Public cache stores session-specific chat access state |
| MLI-186 | medium | defer | Public deploy flow can overwrite registry vault-kind metadata |
| MLI-187 | medium | defer | Public docs expose raw/internal audit transcripts |
| MLI-188 | medium | defer | Public explore API amplifies Zora API calls |
| MLI-189 | medium | defer | Public key-safety API leaks wallet balance data |
| MLI-190 | medium | defer | Public key-safety API proxies arbitrary wallet balances |
| MLI-191 | medium | defer | Public leaderboard discloses linked social identity |
| MLI-192 | medium | defer | Public leaderboard exposes linked wallet identities |
| MLI-193 | medium | defer | Public leaderboard leaks external wallet addresses |
| MLI-194 | medium | defer | Public room timeline leaks counter-trade ledger actions |
| MLI-195 | medium | defer | Public sparkline endpoint can poison Base trend cache |
| MLI-196 | medium | defer | Public stats leaks recent waitlist member identities |
| MLI-197 | medium | defer | Public waitlist endpoint leaks and rewrites lead records |
| MLI-198 | medium | defer | RLS dropped from public schema bootstrap migrations |
| MLI-199 | medium | defer | RPC auth token can leak through keeper startup alerts |
| MLI-200 | medium | defer | Raw market symbols added to LLM prompt allow prompt injection |
| MLI-201 | medium | defer | Raw trade failure output is posted back to chat |
| MLI-202 | medium | defer | Raw wallet hydration errors exposed by /accounts/me |
| MLI-203 | medium | defer | Recent Chip speaker fallback lets non-stakers suppress fades |
| MLI-204 | medium | defer | Recent non-stakers can suppress Chip fade attribution |
| MLI-205 | medium | defer | Refund cron can refund burns that may still settle |
| MLI-206 | medium | defer | Refund cron restores credits for in-flight AMOE burns |
| MLI-207 | medium | defer | Remote OFT messages can forge lottery entries |
| MLI-208 | medium | defer | Remote lottery forwarder drops existing OFT entries |
| MLI-209 | medium | defer | Repair script can leave Privy token dumps on failure |
| MLI-210 | medium | defer | Reverting challenger can block impairment root recovery |
| MLI-211 | medium | defer | Room alerts can leak shared wallet risk to stale subscribers |
| MLI-212 | medium | defer | Runbook may leak decrypted Vercel production secrets |
| MLI-213 | medium | defer | Runbook wires share mesh to untracked MyOFT |
| MLI-214 | medium | defer | SSRF bypass via IPv4-mapped IPv6 in ERC8004 review |
| MLI-215 | medium | defer | Safe ops script can leak signer private key as tx hash |
| MLI-216 | medium | defer | Safe tx GS026 fallback can execute the wrong Safe payload |
| MLI-217 | medium | defer | Salt override can bypass paid share vanity gating |
| MLI-218 | medium | defer | Salt override entitlement can be bypassed |
| MLI-219 | medium | defer | Sampling disables keeper replay checkpoints |
| MLI-220 | medium | defer | Security CI gates downgraded to non-blocking |
| MLI-221 | medium | defer | Self-bundling can spend privileged server keys |
| MLI-222 | medium | defer | Session cookies widened to parent domain enable subdomain theft |
| MLI-223 | medium | defer | Share-mesh LP manager wiring always reverts |
| MLI-224 | medium | defer | Shared AMOE debit helper marks legacy burns refundable |
| MLI-225 | medium | defer | Shared waitlist query key corrupts access and wallet state |
| MLI-226 | medium | defer | Solana fallback reconciles only once per day |
| MLI-227 | medium | defer | Solana lottery amount scaling is missing |
| MLI-228 | medium | defer | Solana reconcile fallback checkpoints only once per day |
| MLI-229 | medium | defer | Sponsored non-owner deposits donate pool assets |
| MLI-230 | medium | defer | Spoofable rate limit on new DeBank portfolio API |
| MLI-231 | medium | defer | Spoofable rate limit on tray portfolio proxy |
| MLI-232 | medium | defer | Spoofable rate limit protects new RPC fan-out |
| MLI-233 | medium | defer | Spoofable tray portfolio rate limit enables quota abuse |
| MLI-234 | medium | defer | Spot sweep can move the wrong wallet's USDC |
| MLI-235 | medium | defer | Stale in-memory Arena identities bypass DB revocation |
| MLI-236 | medium | defer | Stale registry owner authorizes Ajna automation control |
| MLI-237 | medium | defer | Standalone AMOE route bypasses trusted-origin guard |
| MLI-238 | medium | defer | Strategy status auto-provisions Arena identities |
| MLI-239 | medium | defer | Stripe checkout pending rows bypass strategy paywall gating |
| MLI-240 | medium | defer | Swap retry can exceed manual slippage cap |
| MLI-241 | medium | defer | Telegram Mini App trusts AlfaClub relay bot token |
| MLI-242 | medium | defer | Telemetry sampling breaks keeper idempotency state |
| MLI-243 | medium | defer | Terminal control-plane jobs can still execute |
| MLI-244 | medium | defer | Trend reserve UserOps bypass spend caps for zero-value calls |
| MLI-245 | medium | defer | Trusted-setup script skips phase-1 ptau integrity verification |
| MLI-246 | medium | defer | URL swap tokens are auto-marked verified |
| MLI-247 | medium | defer | Unauthenticated /alfa status leaks bridge auth health |
| MLI-248 | medium | defer | Unauthenticated /ready endpoint can block indexer health |
| MLI-249 | medium | defer | Unauthenticated Hermit health leaks runtime state |
| MLI-250 | medium | defer | Unauthenticated Relay quote proxy can sponsor arbitrary calls |
| MLI-251 | medium | defer | Unauthenticated backtest audit file disclosure |
| MLI-252 | medium | defer | Unauthenticated chat command can force-post digests |
| MLI-253 | medium | defer | Unauthenticated refresh bypass causes expensive RPC scans |
| MLI-254 | medium | defer | Unauthenticated refresh bypass enables RPC scan DoS |
| MLI-255 | medium | defer | Unauthenticated requests can exhaust keeper job rate limits |
| MLI-256 | medium | defer | Unauthenticated status polling can exhaust approval DB |
| MLI-257 | medium | defer | Unauthenticated waitlist upsert enables data tampering |
| MLI-258 | medium | defer | Unbounded Ethos dedupe query enables API DoS |
| MLI-259 | medium | defer | Unbounded Relay fee seed can overcharge owner mutations |
| MLI-260 | medium | defer | Unbounded avatar render cache enables memory DoS |
| MLI-261 | medium | defer | Unbounded command-claim cache enables bridge memory DoS |
| MLI-262 | medium | defer | Unbounded error-body read can hang AlfaClub bridge |
| MLI-263 | medium | defer | Unbounded identity lookups can DoS AlfaClub digests |
| MLI-264 | medium | defer | Unbounded waitlist leaderboard cache enables memory DoS |
| MLI-265 | medium | defer | Unescaped mint argument enables Vultr SSH command injection |
| MLI-266 | medium | defer | Ungated chat LLM calls allow API-cost DoS |
| MLI-267 | medium | defer | Unknown XMTP groups bypass chat consent filtering |
| MLI-268 | medium | defer | Unquoted RPC export is evaled by Shovel startup scripts |
| MLI-269 | medium | defer | Unsanitized DB error details can leak AlfaClub tokens |
| MLI-270 | medium | defer | Unthrottled X verification burns paid API quota |
| MLI-271 | medium | defer | Unthrottled XMTP test uses protocol signer |
| MLI-272 | medium | defer | Untrusted deploy payload can overwrite Solana mint mappings |
| MLI-273 | medium | defer | Untrusted forwarded host controls server-side origin |
| MLI-274 | medium | defer | Unvalidated Relay paymentDetails now override quote transaction |
| MLI-275 | medium | defer | Unverified session limiter enables DB write amplification |
| MLI-276 | medium | defer | Unverified share mint can drive Solana pool provisioning |
| MLI-277 | medium | defer | Unverified trading wallet can skew vigilante rankings |
| MLI-278 | medium | defer | Unverified wallet hints can skew AlfaClub scoring |
| MLI-279 | medium | already-mitigated | User prompts can persistently poison Hermit memory |
| MLI-280 | medium | defer | Vault keeper dry-run can execute live writes |
| MLI-281 | medium | defer | Vercel preview builds re-enabled for unreviewed docs code |
| MLI-282 | medium | defer | WETH fee distribution is bricked by same-block share wrapping |
| MLI-283 | medium | defer | WETH fee wrapping leaks lottery dust to voters |
| MLI-284 | medium | defer | WSL dry-run exposes Vite API server on all interfaces |
| MLI-285 | medium | defer | WSL dry-run exposes local API server on the LAN |
| MLI-286 | medium | defer | WSL dry-run exposes secret-backed dev API to LAN |
| MLI-287 | medium | defer | Waitlist bootstrap leaks canonical email on wallet collision |
| MLI-288 | medium | defer | Wallet edit flow enables waitlist point farming |
| MLI-289 | medium | defer | Weak v3 swap token check bypasses paymaster swap policy |
| MLI-290 | medium | defer | Webhook raw-body hardening is bypassed by Vercel catch-all |
| MLI-291 | medium | defer | X verifier trusts user-writable linked identities |
| MLI-292 | medium | defer | XMTP DB key persisted in localStorage |
| MLI-293 | medium | defer | XMTP Unknown-consent chats are exposed and auto-allowed |
| MLI-294 | medium | defer | XMTP agent exposes OpenClaw intel tools without auth |
| MLI-295 | medium | defer | XMTP telemetry leaks user and conversation identifiers |
| MLI-296 | medium | defer | Zora handles can spoof X Ethos scores |
| MLI-297 | medium | defer | Zora retry can submit reduced swap amounts without consent |
| MLI-298 | medium | defer | Zora swaps can exceed user slippage limits |
| MLI-299 | medium | defer | payoutRecipient invariant can be bypassed by reverting reads |
| MLI-300 | low | defer | /bridge alias reaches write-capable AlfaClub subcommands |
| MLI-301 | low | defer | /gmeow logs provider auth error text |
| MLI-302 | low | defer | AMOE ZK assets moved to shadowed Vercel function |
| MLI-303 | low | defer | AMOE refund rollout doc uses nonexistent TTL flag |
| MLI-304 | low | defer | AMOE tx-hash matches are dropped by address normalizer |
| MLI-305 | low | defer | API router allows prototype path to crash handler |
| MLI-306 | low | defer | Admin control-plane audit attribution can be spoofed |
| MLI-307 | low | defer | Airdropped Zora holdings bypass custom-token warning |
| MLI-308 | low | defer | Alert test leaks linked Telegram chat ID |
| MLI-309 | low | defer | AlfaClub /alfa bypasses read and kill-switch flags |
| MLI-310 | low | defer | AlfaClub avatar bypasses image proxy |
| MLI-311 | low | defer | Arch B caps bypassed for ERC20 /send transfers |
| MLI-312 | low | defer | Arch B daily cap check is race-prone, enabling cap bypass |
| MLI-313 | low | defer | Arena trade failures leak raw command details to chat |
| MLI-314 | low | defer | Auth health flags new Privy refresh writers as anomalous |
| MLI-315 | low | defer | Auth-failure path suppresses its own WebSocket fallback |
| MLI-316 | low | defer | Blank HERMIT env can override legacy relay disable |
| MLI-317 | low | defer | Bootstrap preflight can skip RLS hardening |
| MLI-318 | low | defer | Broad fallback regex can free valid referral codes |
| MLI-319 | low | defer | CSV export script allows spreadsheet formula injection |
| MLI-320 | low | defer | CSV formula injection in new top-creators export |
| MLI-321 | low | defer | Charm auth helper allows mismatched delegate-only vaults |
| MLI-322 | low | defer | Charm auth helper allows non-keeper delegate fallthrough |
| MLI-323 | low | defer | Charm factory vaults leave governance under external control |
| MLI-324 | low | defer | Chart tweets bypass Telegram preview-only confirmation |
| MLI-325 | low | defer | Chat bridge fallback can replay historical commands |
| MLI-326 | low | defer | Chat display name truncation enables ENS/Basename spoofing |
| MLI-327 | low | defer | Chat runtime now logs full conversation IDs |
| MLI-328 | low | defer | Control-plane writes fail open without audit locks |
| MLI-329 | low | defer | Deploy config endpoint no longer enforces admin-only access |
| MLI-330 | low | defer | Deploy v2 status/resume endpoints lack rate limiting |
| MLI-331 | low | defer | Dev dry-run logs may expose upstream Base RPC secret |
| MLI-332 | low | defer | Dev loopback redirect can become an open redirect |
| MLI-333 | low | defer | Docs build downgrades gray-matter YAML parser |
| MLI-334 | low | defer | Docs build reintroduces vulnerable js-yaml parser |
| MLI-335 | low | defer | Documentation leaks production provisioner host details |
| MLI-336 | low | defer | Enroll endpoint leaks RPC error details to authenticated callers |
| MLI-337 | low | defer | Enroll endpoint leaks RPC internals on CSW probe failure |
| MLI-338 | low | defer | Future-dated XMTP messages can poison agent checkpoints |
| MLI-339 | low | defer | Gitleaks allowlist masks 0x40-hex secrets globally |
| MLI-340 | low | defer | Global alert cooldown can suppress other users' risk alerts |
| MLI-341 | low | defer | Healthcheck leaks risk watcher wallet and liveness |
| MLI-342 | low | defer | Hermit X posts can fall back to shared Twitter creds |
| MLI-343 | low | defer | Hermit swallows fatal exceptions and stays ready |
| MLI-344 | low | defer | Host chat markers can be spoofed by message volume |
| MLI-345 | low | defer | Host header injection in social-preview OG metadata |
| MLI-346 | low | defer | Inline edit postMessage enables cross-origin screenshot exfiltration |
| MLI-347 | low | defer | Inline wallet script makes window.ethereum writable early |
| MLI-348 | low | defer | Internal wallet and Railway identifiers committed |
| MLI-349 | low | defer | Keeper listing accepts mismatched share token bindings |
| MLI-350 | low | defer | Keepr /ai command now usable without vault configuration |
| MLI-351 | low | defer | Key-safety calculator misses zero-buy hostile holder raids |
| MLI-352 | low | defer | Keyboard token selector can choose a different token |
| MLI-353 | low | defer | Malformed fill time can abort LLM-gated trades |
| MLI-354 | low | defer | Most-active chat sender is mislabeled as room host |
| MLI-355 | low | defer | OVault delegate guard misses whitespace delegate calls |
| MLI-356 | low | defer | On-chain owner fallback bypasses DB-linked ownership checks |
| MLI-357 | low | defer | On-chain strategy deployment bypasses paid feature enforcement |
| MLI-358 | low | defer | Orphan-address sweep now passes while scanning only amoe |
| MLI-359 | low | defer | Owner approval debug tags expose paymaster error details |
| MLI-360 | low | defer | Paymaster debug info exposed in owner approval errors |
| MLI-361 | low | already-mitigated | Pinata production secret IDs exposed in runbook |
| MLI-362 | low | defer | Post-upgrade hook verification accepts partial bytecode |
| MLI-363 | low | defer | Production /story page ships iframe screenshot debug hook |
| MLI-364 | low | defer | Public cache can leak denied viewer wallet addresses |
| MLI-365 | low | defer | Public docs expose unresolved critical audit findings |
| MLI-366 | low | defer | Public docs publish internal audit findings |
| MLI-367 | low | defer | Public metrics requests now run schema ALTERs |
| MLI-368 | low | defer | Public monitoring views bypass RLS privacy |
| MLI-369 | low | defer | Public page exposes counter-trade internals |
| MLI-370 | low | defer | Public referrer lookup enables referral-code enumeration |
| MLI-371 | low | defer | Public route exposes counter-trade operational inventory |
| MLI-372 | low | defer | RPC proxy IP rate limits bypassable via spoofed headers |
| MLI-373 | low | defer | Railway production IDs exposed in operator runbook |
| MLI-374 | low | defer | Raw paymaster/bundler errors now returned in user responses |
| MLI-375 | low | defer | Referrer lookup leaks data for non-public waitlist profiles |
| MLI-376 | low | defer | Risk watcher now crashes from undeclared state variables |
| MLI-377 | low | false-positive | Room ID ignored after pools redirect |
| MLI-378 | low | defer | Room avatars bypass external image proxy safeguards |
| MLI-379 | low | defer | Route token logos can spoof core assets by symbol |
| MLI-380 | low | defer | SMART_WALLET mode bypasses owner-check fallback for XMTP |
| MLI-381 | low | defer | Sampled Telegram action tokens become unredeemable |
| MLI-382 | low | defer | Sampling makes Telegram action tokens unusable |
| MLI-383 | low | defer | Stale /api/accounts/me cache can leak prior user CSW |
| MLI-384 | low | defer | Static tray points cache can leak prior account data |
| MLI-385 | low | defer | Swap token discovery marks unvetted creator coins as verified |
| MLI-386 | low | defer | Swap token selector trusts uncurated API coins as verified |
| MLI-387 | low | defer | Telegram alert test leaks linked chat ID in room replies |
| MLI-388 | low | defer | Telegram miniapp link no longer checks shared API secret |
| MLI-389 | low | defer | Timelock state getter is unreachable on main and reads wrong storage |
| MLI-390 | low | defer | Unauthenticated healthcheck leaks live trading risk |
| MLI-391 | low | defer | Unbounded ENS profile cache allows memory DoS via API calls |
| MLI-392 | low | defer | Unbounded in-memory reply-claim cache enables DoS |
| MLI-393 | low | defer | Unbounded on-chain identity cache enables memory DoS via public API |
| MLI-394 | low | defer | Unhandled body_too_large errors in deploy handlers |
| MLI-395 | low | defer | Uniswap route allowlist can be bypassed via body.routing |
| MLI-396 | low | defer | Unredacted conversation IDs now logged in AI chat runtime |
| MLI-397 | low | defer | Unsafe Twitter media URL fetch enables SSRF and DoS |
| MLI-398 | low | defer | User prompts can trigger persistent agent file edits |
| MLI-399 | low | defer | User-silo alert cooldown is shared across wallets |
| MLI-400 | low | defer | Wallet noise script unlocks window.ethereum for overrides |
| MLI-401 | low | defer | X-Forwarded-For fallback enables IP rate-limit spoofing |
| MLI-402 | low | defer | XMTP commands can abuse OpenClaw API keys without auth |
| MLI-403 | low | defer | XMTP test path can revoke the protocol agent inbox |
| MLI-404 | low | defer | useAccountMe cache can leak prior CSW after logout |
| MLI-405 | low | defer | useAccountMe cache persists across auth changes, leaking data |
| MLI-406 | low | defer | x402 activation nonce never persisted, enabling replay gas drain |
| MLI-407 | informational | defer | 1659 keeper risk monitor integration is nonfunctional |
| MLI-408 | informational | defer | AMOE daily credits reduced below entry cost |
| MLI-409 | informational | defer | AMOE rollout docs use wrong refund TTL flag |
| MLI-410 | informational | defer | Access-token staleness check reads wrong env var |
| MLI-411 | informational | defer | Account setup no longer reloads after Privy login |
| MLI-412 | informational | defer | Activation UserOps rejected by session binding mismatch |
| MLI-413 | informational | defer | Agent canary plans predict the wrong ShareOFT address |
| MLI-414 | informational | defer | Backfill script ignores documented numeric defaults |
| MLI-415 | informational | defer | Backfill script loads .env too late for The Graph key |
| MLI-416 | informational | defer | Bootstrap /healthz masks failed Hermit startup |
| MLI-417 | informational | defer | Bootstrap health check can mask fatal Hermit startup failure |
| MLI-418 | informational | defer | Broken audit summary runbook link |
| MLI-419 | informational | defer | Broken keeper risk watcher can start runaway polling |
| MLI-420 | informational | defer | Bytecode store verifier is misconfigured |
| MLI-421 | informational | defer | Cached CSW owner lookups return stale owner counts |
| MLI-422 | informational | defer | Canonical AlfaClub key routes get stuck on loader |
| MLI-423 | informational | defer | Canonical AlfaClub key routes render a blank loader |
| MLI-424 | informational | defer | Canonical CSW owner checks gain unintended RPC fallback |
| MLI-425 | informational | defer | Catch-all routing breaks social preview debug path |
| MLI-426 | informational | defer | Charm keeper rebalance authorization regression |
| MLI-427 | informational | defer | Chat menu clicks also minimize desktop chat |
| MLI-428 | informational | defer | Chat provider crashes on app routes without PrivyProvider |
| MLI-429 | informational | defer | Coinbase Wallet in-app is misclassified as Base App |
| MLI-430 | informational | defer | Command reply ledger is not bootstrapped by the bridge |
| MLI-431 | informational | defer | Counter-trade signals misread price ratios as percents |
| MLI-432 | informational | defer | Cron masks enrichment failures as success |
| MLI-433 | informational | defer | Cursor sandbox config drops outbound network restrictions |
| MLI-434 | informational | defer | Custom telemetry rate envs are ignored |
| MLI-435 | informational | defer | Custom telemetry sample-rate prefix is ignored |
| MLI-436 | informational | defer | DOM XSS in AlfaClub chart via unsanitized coin symbol |
| MLI-437 | informational | defer | Daily Ethos snapshots can retain stale scores |
| MLI-438 | informational | false-positive | Decision panel typo causes runtime crash in simulator |
| MLI-439 | informational | defer | Deleted Groth16 verifier breaks stale CI check |
| MLI-440 | informational | defer | Deploy route can render smart-wallet hook without provider |
| MLI-441 | informational | defer | Deploy submissions can be blocked after runtime version updates |
| MLI-442 | informational | defer | Deploy version check now blocks after runtime config updates |
| MLI-443 | informational | defer | Deployment gas budget now underfunds phase2 UserOps |
| MLI-444 | informational | defer | Desktop chat menu clicks now minimize the chat |
| MLI-445 | informational | defer | Deterministic sampling can drop whole telemetry event classes |
| MLI-446 | informational | defer | Direct room images are blocked by production CSP |
| MLI-447 | informational | defer | Docs build imports undeclared remark dependency |
| MLI-448 | informational | defer | Docs fallback error does not fail production builds |
| MLI-449 | informational | defer | Docs repo links are pinned to main |
| MLI-450 | informational | defer | Drand relay submission path is hard-disabled at runtime |
| MLI-451 | informational | defer | Dropped Ethos refresh function leaves pg_cron jobs failing |
| MLI-452 | informational | defer | Dry-run RPC unauthenticated fallback is unreachable |
| MLI-453 | informational | defer | EOA-owner lane rejects real personal_sign signatures |
| MLI-454 | informational | defer | Eliza /bridge alias is not dispatched |
| MLI-455 | informational | defer | Eliza bootstrap masks failed main module startup |
| MLI-456 | informational | defer | Enrichment failures are reported as successful refreshes |
| MLI-457 | informational | defer | Ethos cron can hang when DB acquisition rejects |
| MLI-458 | informational | defer | Ethos filter is applied after paginated creator fetches |
| MLI-459 | informational | defer | Ethos filter is applied after pagination |
| MLI-460 | informational | defer | Ethos sync cron can hang on DB acquisition failure |
| MLI-461 | informational | defer | External EOA fallback can be blocked by wrong session check |
| MLI-462 | informational | defer | Failed UserOps can be reported as confirmed swaps |
| MLI-463 | informational | defer | Finalize uses invalid AccountInfo resize API |
| MLI-464 | informational | defer | Frontend test placement guard fails on new chart test |
| MLI-465 | informational | defer | Generated contract SUMMARY links are broken |
| MLI-466 | informational | defer | Generic swap failures can trigger high-slippage retries |
| MLI-467 | informational | defer | Hermit X cross-post captions are no longer uniquified |
| MLI-468 | informational | defer | Hermit now swallows fatal process exceptions |
| MLI-469 | informational | defer | Hermit setup falsely confirms unsaved preferences |
| MLI-470 | informational | defer | Hermit setup falsely reports failed preference saves as successful |
| MLI-471 | informational | defer | Hook provisioning sends wrong address encoding |
| MLI-472 | informational | defer | Hot sync handler can hang after early tick rejection |
| MLI-473 | informational | defer | InvalidWeight mapping is shadowed by generic revert handling |
| MLI-474 | informational | defer | InvalidWeight reverts are still classified as generic reverts |
| MLI-475 | informational | defer | Keeper env loader can crash on supported Node 20 |
| MLI-476 | informational | defer | Keepr bootstrap masks startup failures |
| MLI-477 | informational | defer | Leaderboard now ignores profiles beyond first 1000 entries |
| MLI-478 | informational | defer | Lean win-chance target uses unscaled USD inputs |
| MLI-479 | informational | defer | Legacy Safari can break mobile scroll-story initialization |
| MLI-480 | informational | defer | Legacy batcher monitoring query points to wrong file |
| MLI-481 | informational | defer | MediaQueryList listener can break immersive scroll story |
| MLI-482 | informational | defer | Metrics exactness ignores explore backfill state |
| MLI-483 | informational | false-positive | Migration comments overloaded function without signature |
| MLI-484 | informational | defer | Miniapp URL fix is lost during HTML generation |
| MLI-485 | informational | defer | Multi-chain swap requests blocked by Base-only allowlist |
| MLI-486 | informational | defer | New frontend test violates placement guard |
| MLI-487 | informational | defer | Non-BaseApp EOA owner install path disabled |
| MLI-488 | informational | defer | Non-security explore loader rendering regression |
| MLI-489 | informational | defer | Non-security waitlist hook type regression |
| MLI-490 | informational | defer | Owner-install pending state clears before completion |
| MLI-491 | informational | defer | Package scripts still reference archived ops files |
| MLI-492 | informational | defer | Partial digest delivery is permanently skipped |
| MLI-493 | informational | defer | Partial digest posts suppress retries to missed rooms |
| MLI-494 | informational | defer | Passive EIP-6963 discovery may break wallet selection |
| MLI-495 | informational | defer | Payout harvest kill switch misses standalone workflow |
| MLI-496 | informational | defer | Premium v2 hero clearance result is never composited |
| MLI-497 | informational | defer | Preseed normalization defeats fresh deploy namespaces |
| MLI-498 | informational | defer | Privy refresh failures masked as cron success |
| MLI-499 | informational | defer | Probe can claim welcomes before validating send |
| MLI-500 | informational | defer | Production docs source requirement does not fail build |
| MLI-501 | informational | defer | Protocol CSW default blocks EOA-only agent startup |
| MLI-502 | informational | defer | Public Dune endpoint can exhaust API credits |
| MLI-503 | informational | defer | RPC fallback is not exercised on request failures |
| MLI-504 | informational | defer | Railway watcher Docker build misses source file |
| MLI-505 | informational | defer | Rate-limit retries can skip large log ranges |
| MLI-506 | informational | defer | Readiness probe can report ready with zero running agents |
| MLI-507 | informational | defer | Recovery decoder crashes due to missing viem dependency |
| MLI-508 | informational | defer | ReferenceError in new decision panel breaks chart rendering |
| MLI-509 | informational | defer | Regression: /hermitimg removed instead of aliased to /meme |
| MLI-510 | informational | defer | Retired Ethos functions leave callers broken |
| MLI-511 | informational | defer | Risk watcher state declarations accidentally removed |
| MLI-512 | informational | defer | Room-history network failures now return successful ticks |
| MLI-513 | informational | defer | Rotated Privy token write failures are hidden |
| MLI-514 | informational | defer | Rotated Privy tokens can be silently left stale |
| MLI-515 | informational | defer | SBF build check misses settle_fees validation |
| MLI-516 | informational | defer | SBF build checks can miss legacy strings under pipefail |
| MLI-517 | informational | defer | Safe rejection list mode requires a private key |
| MLI-518 | informational | defer | Self-auth owner probing can skip a valid slot 0 |
| MLI-519 | informational | defer | Share-mesh cutover uses an ABI not in the codebase |
| MLI-520 | informational | defer | Share-mesh keeper loses legacy batcher fallback |
| MLI-521 | informational | defer | Shared trust nav drops Risks link from updated pages |
| MLI-522 | informational | defer | Skip-vanity flag exports ignored zero CREATE2 salts |
| MLI-523 | informational | defer | Skip-vanity mode does not force zero salts |
| MLI-524 | informational | defer | Skipped rebalance responses are retried as failures |
| MLI-525 | informational | defer | Solana hook setup passes incompatible address format |
| MLI-526 | informational | defer | Stale CSW gas assessment can be reused for a different wallet |
| MLI-527 | informational | defer | Stale CSW owner refresh can overwrite current owner state |
| MLI-528 | informational | defer | Stale explore sparklines bypass cache TTL |
| MLI-529 | informational | defer | Stale sub-account owner check can mark setup complete |
| MLI-530 | informational | defer | Stale token reset skipped when invalid token is non-null |
| MLI-531 | informational | defer | Stale websocket events poison reconnect backoff |
| MLI-532 | informational | defer | Subgraph key loaded too late in backfill script |
| MLI-533 | informational | defer | Swap auto-reconnect bypasses provider-collision guard |
| MLI-534 | informational | defer | Swap canonical session auto-refresh now only runs once |
| MLI-535 | informational | defer | Tamago ERC4626 writes deposit state after token call |
| MLI-536 | informational | defer | Telegram @handle relay sources never match incoming chats |
| MLI-537 | informational | defer | Telegram DM send failures are no longer detected by callers |
| MLI-538 | informational | defer | Telemetry retention migration is nonfunctional |
| MLI-539 | informational | defer | Thread fallback duplicates daily brief parent posts |
| MLI-540 | informational | defer | Three.js vendor rename breaks /story page |
| MLI-541 | informational | defer | Token rotation docs use ignored AlfaClub env vars |
| MLI-542 | informational | defer | Token rotation runbook uses wrong Privy env vars |
| MLI-543 | informational | defer | Trade lifecycle connectors ignore flip/add starts |
| MLI-544 | informational | defer | Unbounded Solana ingest pagination enables relay DoS |
| MLI-545 | informational | defer | Unchecked ERC4626 math lets huge-share mint drain vault |
| MLI-546 | informational | defer | Undeclared remark dependency can break docs builds |
| MLI-547 | informational | defer | Unescaped Zora token symbol enables DOM XSS in chart doc |
| MLI-548 | informational | defer | Unquoted glob breaks validate:contracts script |
| MLI-549 | informational | defer | Unset backfill env vars ignore documented defaults |
| MLI-550 | informational | defer | Unthrottled public Dune API execution endpoint |
| MLI-551 | informational | defer | V2 breakout hero clearance is computed but not rendered |
| MLI-552 | informational | defer | Vault deploy predictions ignore ShareOFT salt override |
| MLI-553 | informational | defer | Vercel env sync aborts after valid new env additions |
| MLI-554 | informational | defer | Vercel env sync fails on newly added aliases |
| MLI-555 | informational | defer | Waitlist email signup calls auth/privy before bootstrap |
| MLI-556 | informational | defer | Waitlist sub-account chat eligibility removed |
| MLI-557 | informational | defer | Welcome probe mutates ledger before confirming send |
| MLI-558 | informational | defer | Wire-gas UserOps no longer self-bundle or use paymaster |
| MLI-559 | informational | defer | XMTP reaction history is dropped when loading chats |
| MLI-560 | informational | defer | Zora owner-install uses wagmi config with no connectors |
| MLI-561 | informational | defer | Zora quote helper rejects valid quote responses |
| MLI-562 | informational | defer | Zora swaps hard-fail on preflight RPC errors |
| MLI-563 | informational | defer | server-core dist build leaves missing runtime imports |
| MLI-564 | informational | defer | shareTokenLogo now disables creator token avatars |
| MLI-565 | informational | defer | skipLocalFork can still route Base reads to the fork |
| MLI-566 | informational | defer | v1.17 manifest omits impairment aux bytecode |
| MLI-567 | informational | defer | “/meme alias” commit removes legacy /hermitimg command |
