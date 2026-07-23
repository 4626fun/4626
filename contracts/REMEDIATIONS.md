# Remediations vs `audit/oda-2026-07-22` (`423e0e3`)

Published 2026-07-23 as pin `audit/oda-2026-07-23-remediated`.

Source: private monorepo slice after ODA 480/481 P0 closes + Codex/Bugbot follow-ups
([wenakita/4626#757](https://github.com/wenakita/4626/pull/757)).

The prior pin is **frozen**. Use this branch/tag for any new review that should include fixes below.

## High-signal deltas in this slim slice

| Area | Change |
| --- | --- |
| CreatorOVault / CoreModule | Impairment bond refund soft-fails (no longer bricks `clearStaleImpairmentTrip`); withdraw cooldown refresh for self-deposits and first-time (zero-balance) receivers only |
| CreatorShareOFT / Wrapper | Lottery-entry classifier hardened; cooldown max-propagation retained (pre-seed cannot bypass) |
| LotteryManager pricing | Oracle deviation enforced inside window; **re-bootstrap** allowed after window elapses (no permanent quiet-lane deadlock) |
| DeploymentBatcher | Non-Ownable creator-token control proof checks represented `owner_`, not intermediary `msg.sender` |
| Charm / Ajna / Registry / LM / gauges | Includes concurrent private-tree remediations present on the same review tip (not only 480/481) |

## Explicit non-goals

- Agent-lane ShareOFT / wrapper remediations are **not** in this slim public slice (same omission as the prior pin).
- Live Base addresses above are unchanged; this pin is source for review, not a redeploy announcement.
