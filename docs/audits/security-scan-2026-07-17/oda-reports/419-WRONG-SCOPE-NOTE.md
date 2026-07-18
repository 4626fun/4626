# Job 419 — wrong scope

One Dollar Audit could not access private `github.com/wenakita/4626` (HTTP 404)
and fell back to public legacy `github.com/wenakita/CreatorVault` @ `971da642`
(`contracts/vault/CreatorOVault.sol`, Jan 2026).

That is **not** the live 4626 monorepo layout (`contracts/creator/vault/...` +
module split). Do not treat 419 findings as applying to current production code
without re-mapping. Recommissioned with pasted source bundles (see jobs table).
