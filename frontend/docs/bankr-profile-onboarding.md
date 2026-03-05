# Bankr Agents Onboarding (Canonical CSW)

This runbook is for getting 4626 onto [bankr.bot/agents](https://bankr.bot/agents) without violating canonical wallet invariants.

## Guardrails

- Canonical account remains the Zora Coinbase Smart Wallet (CSW).
- Bankr write actions are blocked unless Bankr EVM wallet identity matches canonical CSW.
- All mutating profile operations require explicit `confirmed=true` and admin authorization.

## Step 1: Verify Wallet Compatibility

Call:

- `GET /api/bankr/status`

Expected:

- `probe.walletMatch === true`

If false:

- Stop all write operations.
- Resolve Bankr wallet identity mismatch before proceeding.

## Step 2: Probe Eligibility

Call:

- `GET /api/bankr/profile`
- Optional candidates: `GET /api/bankr/profile?tokens=0xTokenA,0xTokenB`

This returns:

- current profile presence/approval state
- candidate token set
- recommended next runbook steps

## Step 3: Create or Update Profile

Call:

- `POST /api/bankr/profile`

Body:

```json
{
  "action": "createOrUpdate",
  "confirmed": true,
  "profile": {
    "projectName": "4626",
    "description": "AI-powered creator vault protocol",
    "tokenAddress": "0x...",
    "tokenChainId": "base"
  }
}
```

## Step 4: Add Timeline Updates

Call:

- `POST /api/bankr/profile`

Body:

```json
{
  "action": "addUpdate",
  "confirmed": true,
  "update": {
    "title": "Feature release",
    "content": "Shipped Bankr + CSW hard gate integration."
  }
}
```

## Step 5: If Not Eligible Yet

Per Bankr profile rules, account must be associated with:

- a token deployed through Bankr, or
- a token where the account is the fee beneficiary.

If current tokens are not eligible:

1. Deploy or configure a Bankr token path.
2. Ensure fee beneficiary resolves to canonical CSW.
3. Re-run eligibility probe and profile creation.

## Step 6: Listing Visibility

Profiles are not immediately public after creation. Bankr admin approval is required before listing appears on `/agents`.
