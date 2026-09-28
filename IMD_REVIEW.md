# IMD governance review snapshot

This branch carries a scoped 4626 governance source and test snapshot. The runnable project is the Base64-encoded ZIP in [IMD_REVIEW_ARCHIVE.b64](./IMD_REVIEW_ARCHIVE.b64), not the older public contracts tree inherited from main.

Source: private `wenakita/4626` merge commit `df0a8791cde7101713ac0a4bc11a05ffc2ad8537` (PR #1727). `SOURCE_MANIFEST.json` inside the archive records individual source hashes. Expected archive SHA-256: `b4c71c33cee9cb3974b74ba6815af30821cf3e0676cd013c895c0150ac334c15`.

```sh
base64 -d IMD_REVIEW_ARCHIVE.b64 > 4626-IMD-review-package.zip
sha256sum 4626-IMD-review-package.zip
unzip 4626-IMD-review-package.zip
cd 4626-imd-review
npm ci
git clone https://github.com/foundry-rs/forge-std.git lib/forge-std
git -C lib/forge-std checkout 7117c90c8cf6c68e5acce4f09a6b24715cea4de6
node_modules/.bin/forge test -vv
```

Read the unpacked `README.md`, `submission/BRIEF.md`, governance design docs, and `validation/RESULTS.md`. The baseline passed 160 tests in its preparation environment; independently rerun it and report any differences. Work on this snapshot under `4626-imd-review/`, add new tests only under `4626-imd-review/test/imd/`, and deliver the named report at repository-root `artifacts/imd-governance-review.md`. Do not alter production contracts, existing tests, or live deployments.

The `submission/REQUEST.template.json` inside the archive is an earlier draft with a placeholder. A paid request must pin this branch's current 40-character commit and keep named outputs under repository-root `artifacts/`. Set `github: false` when findings should be delivered through the job result without automatic GitHub publication. IMD job details and accepted report artifacts are publicly readable through its job APIs, so treat findings as public. The source and scope here do not cover the full live protocol; this is an additional review, not a certification.
