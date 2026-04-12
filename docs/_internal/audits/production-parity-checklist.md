# Production parity checklist (4626)

Use before a major release, investor diligence, or after large contract/API changes. Record evidence (tx links, screenshot, artifact hash) in your runbook—not in this repo if it contains non-public data.

| # | Check | Evidence / notes |
|---|--------|------------------|
| 1 | **Tagged commit** matches the build used for deploy | Git tag ↔ Vercel/build SHA |
| 2 | **Contract bytecode** for upgraded/proxied contracts matches `forge build` artifacts from that tag | `cast code` / block explorer “verify” |
| 3 | **Proxy / implementation** addresses documented in runbooks match chain state | |
| 4 | **Env:** `APP_ORIGIN`, `MARKETING_ORIGIN`, `CANONICAL_ORIGIN`, cron `CRON_SECRET`, RPC URLs | Vercel / Railway env snapshot |
| 5 | **LayerZero / OFT** peers and endpoints match intended topology | Onchain reads + [AGENTS.md](https://github.com/wenakita/4626/blob/main/AGENTS.md) references |
| 6 | **VRF** coordinator, subscription, key hash, authorized callers | Onchain + ops docs |
| 7 | **Keys:** protocol Safe, adapter owner, `KEEPR_API_KEY`, Solana deployer / program upgrade authority | Access review only—do not paste secrets here |
| 8 | **AGENTS.md constants** (e.g. Solana program ID, batcher/adapter addresses) still match mainnet | Explorer |
| 9 | **Git submodules** (`lib/*`) SHAs match the release build | `git submodule status` |
|10 | **Submodule integrity** | Same as internal audit §2 |

Cross-check economic/governance assumptions against [system.md](./system.md) and open items there.
