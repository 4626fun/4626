#!/usr/bin/env bash
# Init only the Foundry-relevant git submodules for CI.
#
# Skips non-Solidity top-level modules (skills, acp-cli, dgclaw-skill) that
# checkout@submodules:recursive would otherwise clone on every forge job.
# Rewrites nested git@ / ssh://github.com URLs to HTTPS so runners without
# SSH keys can clone (Uniswap/liquidity-launcher nests OpenZeppelin via SSH).
set -euo pipefail

# Quoting matters: `url.https://github.com/.insteadOf` without quotes is parsed
# incorrectly and the rewrite never applies (then nested git@ clones fail).
git config --global --replace-all url."https://github.com/".insteadOf "git@github.com:"
git config --global --add url."https://github.com/".insteadOf "ssh://git@github.com/"

# Also pass -c so this top-level invocation cannot miss the rewrite.
git -c url."https://github.com/".insteadOf="git@github.com:" \
    -c url."https://github.com/".insteadOf="ssh://git@github.com/" \
    submodule update --init --recursive --jobs 8 -- \
      lib/forge-std \
      lib/liquidity-launcher \
      lib/continuous-clearing-auction \
      lib/sudoswap-lssvm2 \
      lib/universal-router
