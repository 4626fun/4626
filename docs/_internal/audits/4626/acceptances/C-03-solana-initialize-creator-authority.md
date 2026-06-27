# C-03 (4626-367): Solana `initialize_creator` restricted to mint authority

**Status:** Closed — already enforced in code
**Linear:** 4626-367
**Sprint:** 7 (verification-only closure)

## Finding

From `docs/audits/4626/reconciliation/C-03-second-pass-P1-reconciliation.md`
row 9:

> "Solana hook config can be initialized by any signer — Fix: add
> mint-authority / registry-admin constraint in `initialize_creator.rs`.
> Cross-listed with M-29 closure which handled the EVM side."

## Verification

`programs/creator-share-hook/src/instructions/initialize_creator.rs`
handler lines 81–90:

```rust
// Only the Token-2022 mint authority can initialize creator config for this mint.
let mint_data = ctx.accounts.creator_mint.try_borrow_data()?;
let mint_state = Token2022Mint::unpack(&mint_data)
    .map_err(|_| error!(CreatorShareHookError::InvalidMint))?;
let mint_authority = match mint_state.mint_authority {
    COption::Some(authority) => authority,
    COption::None => return err!(CreatorShareHookError::UnauthorizedAuthority),
};
if mint_authority != ctx.accounts.authority.key() {
    return err!(CreatorShareHookError::UnauthorizedAuthority);
}
```

This means the `authority: Signer` on `InitializeCreator` must
match the Token-2022 mint authority of the `creator_mint` account.
Any other signer receives `UnauthorizedAuthority`. A mint whose
authority has been burned (set to `COption::None`) can never be
bound to a `CreatorConfig` PDA, which is the intended behaviour —
the config must be bound before the mint authority is frozen.

The `creator_mint` account constraint `owner = token_2022::ID`
prevents attackers from passing a fake SPL Token (v1) account or
any program-owned lookalike.

## Residual risk

- The check is enforced at config creation only. Mint-authority
  rotation after the fact does not invalidate an existing
  `CreatorConfig`. This is acceptable for the current design —
  mint authority is expected to be burned to the PDA shortly
  after initialization. Rotation scenarios should be handled by
  a separate admin-only `transfer_creator_authority` instruction
  if the economic model changes.

Fixes: 4626-367 (C-03 P1 #9)
