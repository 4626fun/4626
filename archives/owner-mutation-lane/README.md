# Archived: user owner-mutation client lane

Retired **2026-05-25** alongside `/add-owner`, `/remove-owner`, and `/csw-funding`.

## What lived here

Shared client-side infrastructure for user-initiated CSW owner mutations (add/remove owner, Relay Part 1, prepared calls, self-built UserOps):

- **`onboardingWallet*.ts`** — prepared-tx submission ladder, confirm-owner polling, delegation helpers re-export surface
- **`cswSendCalls.ts`** — EIP-5792 `wallet_sendCalls` wrapper for Relay Part 1 deposits
- **`cswOwnerMutationEncode.ts`** — `executeWithoutChainIdValidation` calldata wrapper
- **`useEmbeddedOwnerOnCsw.ts` / `useWaitlistSigningStepComplete.ts`** — waitlist step-2 on-chain owner probes
- **Ops scripts** — prolink generator, Tenderly signature matrix, CSW owner link backfill

## Related archives

- `archives/add-owner/` — add-owner page, preview API, prepare-add-* wallet handlers
- `archives/remove-owner/` — remove-owner page, Relay proxy routes, owner-mutation execution
- `archives/csw-funding/` — `/csw-funding` diagnostics and top-up UI

## Still live (not archived)

- **`onboardingWalletDelegation.ts`** — bootstrap delegation flag parsing for waitlist/account setup
- **`coinbaseSignatureWrapper.ts`** — signature wrapper parsing still used by sponsored UserOps (`coinbaseErc4337.ts`)
- **`cswOwnerAbi.ts` / `cswOwnerRead.ts`** — read-only CSW owner checks for swap/deploy gating
- **`lib/base/prolink.ts`** — deploy-session and admin agent owner-add prolinks
- **Server agent** — `preview-agent-owner`, `provision-agent-owner`
- **Deploy automation** — deploy-session temporary owner add/remove in v2 session handlers
