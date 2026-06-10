# AMOE PLONK prover assets

Bundled circuit artifacts for `proveAmoeEntryPlonk`:

- `amoe_eligibility.wasm` — compiled witness generator
- `amoe_plonk_final.zkey` — PLONK proving key

These ship with Vercel Functions via `includeFiles` on `api/[...path].ts`.

## Regenerate

From repo root:

```bash
cd amoe/circuits && npm init -y && npm install --no-save circomlib
SNARKJS_CLI="$(npm root -g)/snarkjs/build/cli.cjs" bash amoe/tools/zk/regen_amoe_plonk_verifier.sh
cp amoe/circuits/build/plonk_fresh/amoe_eligibility_js/amoe_eligibility.wasm \
   frontend/server/_lib/lottery/amoe-zk-assets/
cp amoe/circuits/build/plonk_fresh/amoe_plonk_final.zkey \
   frontend/server/_lib/lottery/amoe-zk-assets/
```

Override paths in production with `AMOE_ZK_WASM_PATH` / `AMOE_ZK_ZKEY_PATH` if hosted elsewhere.
