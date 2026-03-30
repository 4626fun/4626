# GitHub supply chain setup (4626)

Repo workflows that rely on GitHub’s **Dependency graph** and **Dependency review**:

- [.github/workflows/dependency-review.yml](../../.github/workflows/dependency-review.yml)

## 1. Dependency graph

So PRs get an accurate dependency diff, ensure the graph is on for this repository:

1. GitHub → **Settings** → **Code security and analysis**
2. Under **Supply chain**, enable **Dependency graph** (and, if offered, **Dependabot alerts** for visibility).

Public repositories usually have the graph available. **Private** repositories need **GitHub Advanced Security** (organization setting) for Dependency review to run end-to-end.

Docs: [About the dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-the-dependency-graph)

This repo commits **`pnpm-lock.yaml`** / **`package-lock.yaml`** / **`bun.lock`** files; GitHub ingests them for supported ecosystems when the graph is enabled.

## 2. Branch protection (optional)

To **require** a green Dependency Review before merge:

1. **Settings** → **Branches** → branch protection rule for `main` (and `master` if used)
2. Enable **Require status checks to pass before merging**
3. Add the check named **`dependency-review`** (or the exact job name shown in Actions)

Docs: [Require status checks before merging](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)

## 3. Current policy (workflow)

| Setting | Value |
|--------|--------|
| `fail-on-severity` | `high` (blocks high + critical) |
| `fail-on-scopes` | `runtime`, `development` |
| `license-check` | `true` |

Tune in [.github/workflows/dependency-review.yml](../../.github/workflows/dependency-review.yml) if the team wants stricter (`moderate`) or looser (`critical`-only) gates.
