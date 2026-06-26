# AMOE Mainnet Deploy Evidence - 2026-05-01

## Summary

AMOE on-chain contracts were deployed to Base mainnet with production Vercel configuration installed, while all AMOE enable flags remained off. The manager trust handoff was intentionally deferred: `CreatorLotteryManager.setAuthorizedAmoeRelayer(<router>)` was not called in this session.

## Role Addresses

- Chain: Base mainnet (`8453`)
- Deployer EOA: `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD`
- Router owner Safe: `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3`
- Allowlist publisher: `0xAb6d5C10b03300326CD7fAb7267Ae192842967b5`
- Points-ledger publisher: `0xdE4858778BB09534A9097C074200d903C81aBB33`
- CreatorLotteryManager: `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3`

## Abandoned First Deployment

The first router deployment used the canonical CSW as `AMOE_OWNER`. That address had no deployed owner-execution path available from this deploy session, so the router was abandoned before any production wiring.

- Abandoned verifier: `0xd9bDFf55A886bADb011A12c447D72D174fD15964`
- Abandoned verifier tx: `0xe47c7743c0d0f0abdd4d7ad5bbc16c665e10ed577b8fcfbb70df624fa0ba4289`
- Abandoned router: `0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F`
- Abandoned router tx: `0xef7654e2d8c73550f7eb884517d885ad51f9afec4a8e7c09d4fd496706a5f6d4`
- Abandoned router owner: `0x6C0Ea422AA7bB7e1e17C5257f7023C8f05dDf9b3`
- Abandonment reads: `nextEntryId = 0`, `pointsLedgerPublisher = 0x0000000000000000000000000000000000000000`, `manager = 0x0000000000000000000000000000000000000000`

## Replacement Deployment

Replacement deployment used the deployed Base Safe as router owner.

- Verifier: `0xA39A71a388816d657300EFffF1857F938AEF65D1`
- Verifier tx: `0xd406a9f1dc2d73a179bdd57d61911968f5f8b741f99eb171d3c9bf46ff6ed295`
- Router: `0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759`
- Router tx: `0xc84b58c038a858cefe53aaed2c354af8df6a1968d0ae30ca7bce9e051b9a2712`
- Basescan verification: both replacement contracts verified

Constructor / initial reads:

```text
owner                    0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3
allowlistPublisher       0xAb6d5C10b03300326CD7fAb7267Ae192842967b5
verifier                 0xA39A71a388816d657300EFffF1857F938AEF65D1
pointsLedgerPublisher    0x0000000000000000000000000000000000000000
consumer                 0x0000000000000000000000000000000000000000
manager                  0x0000000000000000000000000000000000000000
```

## Router Owner Wiring

Safe inspection before wiring:

```text
safe                     0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3
threshold                1
owners                   0x4bEabD0AfbCC2F0440CDEF1c3c745D43fAe704EF
                         0xB05Cf01231cF2fF99499682E64D3780d57c80FdD
                         0xAb6d5C10b03300326CD7fAb7267Ae192842967b5
deployer is owner        true
```

Executed one Safe transaction containing:

- `LotteryAmoeRouter.setPointsLedgerPublisher(0xdE4858778BB09534A9097C074200d903C81aBB33)`
- `LotteryAmoeRouter.setManager(0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3)`

Safe execution:

- Safe tx hash: `0x8e250fd131ed9ed5ca8ae1e393d5fc1221a718b8ab1d4e89f30d151fd45d05a5`
- Execution tx hash: `0xd22700b76add4fedbe215788617101c8f4b7bcba93262188f9e5440728fa285c`
- Receipt status: `success`

Post-wiring reads:

```text
router.owner                    0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3
router.pointsLedgerPublisher    0xdE4858778BB09534A9097C074200d903C81aBB33
router.manager                  0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3
router.consumer                 0x0000000000000000000000000000000000000000
manager.owner                   0xB05Cf01231cF2fF99499682E64D3780d57c80FdD
manager.authorizedAmoeRelayer   0x0000000000000000000000000000000000000000
```

The deployed manager's direct `authorizedAmoeRelayer()` selector reverted, so the relayer value was verified from the compiled storage layout: `authorizedAmoeRelayer` is slot `57`, and Base storage slot `57` was zero. No manager relayer handoff occurred.

## Production Environment

Vercel project link verified as `akita-llc/4626`.

Production env vars set:

- `LOTTERY_AMOE_ROUTER`
- `BASE_RPC_URL`
- `AMOE_LEDGER_PUBLISHER_PRIVATE_KEY`
- `AMOE_LEDGER_PUBLISHER_SMART_WALLET`

Production enable flags remained unset/off:

- No `AMOE_*_ENABLED` entries appeared in `vercel env list production`.

## Production Deploy

- Deployment id: `dpl_98P9rRc7YPCYuge7PHZm21LjNCuG`
- Deployment URL: `https://4626-pp3n8c8cs-akita-llc.vercel.app`
- Production alias: `https://4626.fun`
- Inspector URL: `https://vercel.com/akita-llc/4626/98P9rRc7YPCYuge7PHZm21LjNCuG`
- Ready state: `READY`

Vercel build emitted a TypeScript diagnostic for missing `snarkjs` type declarations in `server/_lib/lottery/proveAmoeEntryPlonk.ts`, but the deployment completed and was aliased to production.

## Production Smoke Check

All five AMOE endpoints still returned the expected disabled `503` responses after production deploy:

```text
submit-zk              HTTP 503  {"success":false,"error":"zk_path_disabled"}
burn-credits           HTTP 503  {"success":false,"error":"burn_credits_disabled"}
publish-cron           HTTP 503  {"ok":false,"error":"zk_path_disabled"}
burn-refund-cron       HTTP 503  {"ok":false,"error":"zk_path_disabled"}
retry-cron             HTTP 503  {"ok":false,"error":"zk_path_disabled"}
```

## Deferred Step

The final trust handoff remains pending for the later counsel-gated soak step:

```text
CreatorLotteryManager.setAuthorizedAmoeRelayer(0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759)
```

Until that call is executed in a separate step, the deployed router is configured but not authorized as the manager AMOE relayer.
