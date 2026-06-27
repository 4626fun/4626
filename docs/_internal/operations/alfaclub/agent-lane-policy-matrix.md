# Agent Lane Policy Matrix

Canonical operating model for how 4626 splits **creative routing** (Hermit skill
router) from **generation** (Hermit draft endpoint), and how XMTP / Eliza /
Virtuals / counter-trade lanes should consume model capacity.

## Core principle

- **Hermit skill router** (`creativePolicy.ts` + `skillRouter.ts`) owns creative
  route/tier/timeout/token/retry policy for `/hermit`, `/meme`, `/gmeow`.
- **Hermit draft endpoint** (`POST /api/hermit/draft`) owns text generation and
  honors per-request `hints` from the router.
- **ElizaOS** owns XMTP primary agent orchestration (tools, protocol actions) —
  not Hermit creative command routing.
- High-trust action lanes should stay deterministic or advisory-only.

## Lane ownership

| Lane | Owner runtime | Primary purpose | Model policy |
| --- | --- | --- | --- |
| Hermit creative (`/hermit`, `/meme`, `/gmeow`) | Vercel bridge + Hermit skill router | Creative copy generation | Tiered policy (`fast_default` vs `creative_premium`) via `creativePolicy.ts`; hints → `_draft.ts`; deterministic local fallback always available |
| XMTP primary agent | Railway `4626-keepr-agent` (Eliza primary) | Long-lived conversation + protocol actions | Tool-first; one primary ops model + one fallback only |
| Virtuals ACP plugin | Eliza plugin lane (`plugins/virtuals`) | ACP job-room tool decisions | Single decision model, hard budget clamps (`VIRTUALS_ACP_*`) |
| InverseAKITA counter-trade | Railway `4626-inverseakita-agent` | Strategy execution + defense | Deterministic execution path; optional advisory model may veto/downsize only |

## Hermit creative policy (implemented)

`frontend/server/_lib/hermit/creativePolicy.ts` is the server-side source of
truth for:

- route classification (`gmeow`, `meme`, `hermit_*`)
- tier selection (`fast_default` vs `creative_premium`)
- timeout budget (caller-side HTTP abort)
- output-token budget
- retry budget (caller-side transient HTTP retries)
- model hint forwarding (`hints.model`)

`skillRouter.ts` resolves policy before each draft call and POSTs
`{ prompt, hints }` to `HERMIT_AGENT_CHAT_ENDPOINT` (default
`POST /api/hermit/draft`).

`frontend/api/_handlers/hermit/_draft.ts` consumes hints with precedence
**hints → env fallback**:

- `hints.model` → `HERMIT_AGENT_MODEL` → default `openai/gpt-4.1-mini`
- `hints.maxOutputTokens` → `HERMIT_AGENT_MAX_OUTPUT_TOKENS`
- `hints.timeoutMs` capped by `HERMIT_AGENT_DRAFT_TIMEOUT_MS` on the server

Provider selection is per request: `nousresearch/*` hints use the OpenAI-compatible
path (OpenRouter/Hermes); other provider/model strings use the AI Gateway path.
This allows fast-tier gateway models and premium-tier Hermes on the same endpoint
without flipping global `HERMIT_AGENT_PROVIDER`.

### Timeout and retry ownership

| Layer | Control |
| --- | --- |
| Caller (`creativePolicy` + `skillRouter`) | `timeoutMs = min(route, HERMIT_AGENT_HTTP_TIMEOUT_MS)`; retries transient HTTP failures only (502/503/504, network, timeout, empty body) with short backoff |
| Server (`_draft.ts`) | `AbortSignal.timeout(min(hints.timeoutMs, HERMIT_AGENT_DRAFT_TIMEOUT_MS))`; `maxRetries: 0` (caller owns retry) |

Env key quirk: route `hermit_announce` maps to `HERMIT_HERMIT_ANNOUNCE_*` (double
`HERMIT_` prefix). See `creativePolicyEnvKey()` in `creativePolicy.ts`.

## Recommended model-count budget per lane

| Lane | Recommended active models |
| --- | --- |
| Hermit creative | 2 active tiers + deterministic fallback |
| XMTP primary | 1 primary + 1 fallback |
| Virtuals ACP | 1 decision model (optional fallback if explicitly needed) |
| Counter-trade | 0 execution models (or 1 advisory model only) |

## Anti-patterns

- Multiple models co-owning the same action-execution pathway.
- Hidden route logic spread across handlers + env + provider defaults.
- Using creative generation lane for privileged mutation decisions.
- Allowing fallback loops to silently change behavior without observability.
- Server-side SDK retries while the caller also retries HTTP (double spend).

## Minimum observability

**Caller** (`runPinataDraft` in `skillRouter.ts`): route, tier, modelHint,
timeoutMs, maxOutputTokens, retryCount, attempts, ok, lastFailureClass, latencyMs;
per-attempt log on failure with failureClass and retryable flag.

**Server** (`_draft.ts`): route, tier, modelHint, maxOutputTokens, timeoutMs,
providerKind, ok, latencyMs.
