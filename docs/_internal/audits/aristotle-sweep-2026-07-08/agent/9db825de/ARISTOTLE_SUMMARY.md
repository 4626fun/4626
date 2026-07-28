# Summary of changes for run 37c0211d-edd0-45ff-9f06-8a5e335dcba6
Completed the requested cross-check audit of AgentTokenV4 lane dependencies across the agent surface (vault/revenue/oracles/interfaces). Findings are written to `AUDIT_AgentTokenV4_lane_dependencies.md` (committed and pushed). This is a Solidity code review; no Lean proof obligation was present in the request.

I mapped every place the agent token is consumed and how each treats transfers, then reported issues by severity:

HIGH
- H-1 (measured/oracle assumption): `AgentGaugeController._calculateMinOutput` gates the WETH→agent-token swap on `oracle.isPriceFresh()` (which only reflects the LZ-broadcast USD price) while deriving `minOut` from a fully independent V4-pool TWAP (`getAssetEthTWAP`/`getTWAPTick`) that has no recency bound and silently shortens its window when under-sampled. The freshness gate does not cover the feed that sets the slippage floor → manipulable minOut / MEV despite `useOracleSlippage`.
- H-2 (privileged path): `AgentShareOFT` hardcodes `REMOTE_PROTOCOL_WIRE_AUTHORITY`, an unrotatable single key that can set LayerZero peers / hub config on all remote lanes, i.e. controls bridge trust for fee-flush and winner-callback message handling.

MEDIUM
- M-1 (lane-parity drift / measured-transfer): `AgentOVaultWrapper.deposit*` forwards the nominal `amount` to `vault.deposit` instead of what it actually received, so for genuinely fee-on-transfer agent tokens the main UX deposit path reverts (DoS) and otherwise double-taxes — even though the vault core module is purpose-built for measured FOT. The router and gauge deposit paths are correct (they consume the vault's returned share count); the wrapper is the outlier.
- M-2 (privileged/cooperation): the whole revenue lane depends on the protocol owning/authorizing the external AgentTokenV4 (`setProjectTaxRecipient`/tax-hook require token owner). If held, that is a strong control path to disclose; if not, the lane silently never receives tax, with no on-chain read-back assertion.
- M-3: swap executes on a separately-configured Uniswap V3 pool while `minOut`/`sqrtPriceLimitX96` come from the oracle's V4 pool; venue/orientation divergence weakens protection.

LOW/INFO: tax adapter trusts caller-reported amounts (spoofable analytics), sequencer check fails open when unset, `getTWAPTick` lacks a minimum window, ShareOFT buy-only fee plane is classification-dependent, and owner price escape hatches should sit behind a multisig. The report also lists the paths that check out (measured deposit math, router/gauge returned-share usage, wiring validation, LZ origin pinning, callback dedup).

Each finding includes file/function locations and a concrete recommendation.