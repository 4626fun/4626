# IMD governance review snapshot

This branch carries the scoped 4626 governance source and tests for an independent IMD review. The runnable project is packaged as the Base64-encoded ZIP in [`IMD_REVIEW_ARCHIVE.b64`](./IMD_REVIEW_ARCHIVE.b64), not in the older public `contracts/` tree inherited from `main`.

Source: private `wenakita/4626` merge commit `df0a8791cde7101713ac0a4bc11a05ffc2ad8537` (PR #1727). `SOURCE_MANIFEST.json` inside the archive records the individual source hashes. The archive SHA-256 is `b4c71c33cee9cb3974b74ba6815af30821cf3e0676cd013c895c0150ac334c15`.

```sh
base64 -d IMD_REVIEW_ARCHIVE.b64 > 4626-IMD-review-package.zip
sha256sum 4626-IMD-review-package.zip
unzip 4626-IMD-review-package.zip
cd 4626-imd-review
npm ci
forge test
```

Read `README.md`, `submission/BRIEF.md`, the governance design docs, and `validation/RESULTS.md` inside the unpacked project. The supplied baseline passed 160 tests in its preparation environment; independently rerun it and report any differences. Work in `4626-imd-review/`; add tests only under `test/imd/` there and write the review to `artifacts/imd-governance-review.md` there. Do not alter production contracts or existing tests. The source snapshot and review scope are in the archive; inherited public-main contracts are not the target of this review.

The submission's `REQUEST.template.json` contains a placeholder for this public branch's final commit. Replace it with the exact published commit when opening an IMD job. No live protocol deployment is part of this review.
