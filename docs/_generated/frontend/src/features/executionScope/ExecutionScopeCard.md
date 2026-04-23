[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/executionScope/ExecutionScopeCard

# src/features/executionScope/ExecutionScopeCard

## Functions

### ExecutionScopeCard()

> **ExecutionScopeCard**(): `Element` \| `null`

Defined in: [src/features/executionScope/ExecutionScopeCard.tsx:28](https://github.com/wenakita/4626/blob/main/frontend/src/features/executionScope/ExecutionScopeCard.tsx#L28)

`/accounts` "Execution scopes" card.

Surfaces the Arch B sub-account that the 4626 backend uses to execute
in-chat commands (`/coin buy`, `/coin sell`, `/keepr send`,
`/coin trend reserve`) on behalf of the creator. The sub-account is
funded by the parent CSW via a signed SpendPermission with per-tx +
per-period caps enforced by the SpendPermissionManager contract.

This PR ships the read-only surface only. Revoke and re-provision
actions land in PR 2 (see `docs/design/sub-account-lifecycle-spec.md`).

Design rationale: execution scopes are a TECHNICAL concept (an
app-scoped spend budget), not an IDENTITY concept. Keeping them on
`/accounts` and off the nav header preserves the "who am I" focus of
the header identity card while giving users an auditable surface for
bot-initiated spending consent.

#### Returns

`Element` \| `null`
