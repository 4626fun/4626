#!/usr/bin/env python3
"""Compare the LotteryAmoe forge-test failure set against an explicit
allowlist of known-baseline failures.

Why this file exists
--------------------
The previous CI guard for this suite gated only on a failure *count*
(`> 1`). The chatgpt-codex-connector bot pointed out that this is too
permissive (PR #410, discussion r3155849944): if the known baseline
failure gets fixed AND a different test starts failing in the same
push, the count stays at 1 and CI silently passes a real regression.

This script fixes that by comparing the actual failure set to an
explicit `ALLOWED_FAILURES` allowlist. Two failure modes:

  * NEW REGRESSION   actual \ allowed  ->  hard fail
  * FIXED BASELINE   allowed \ actual  ->  hard fail (allowlist must be
                                           kept tight; a permanently
                                           dead allowlist entry weakens
                                           the guard)

Usage
-----
  forge test --match-contract LotteryAmoe --json > /tmp/forge_result.json
  ALLOWED_FAILURES='<suite>::<test>(...)' \
      python3 tools/ci/check_lottery_amoe_failures.py /tmp/forge_result.json

`ALLOWED_FAILURES` is one entry per line. Each entry is
  <suite_path>:<contract>::<test_name>(...)
matching what `forge test --json` emits as the JSON object key.

Exit codes
----------
  0  failure set exactly equals allowlist
  1  new regression OR baseline silently fixed (with diff printed)
  2  parse error / file missing
"""

from __future__ import annotations

import json
import os
import sys


def collect_failures(forge_json_path: str) -> set[str]:
    try:
        with open(forge_json_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: forge json not found at {forge_json_path}", file=sys.stderr)
        sys.exit(2)
    except json.JSONDecodeError as e:
        print(f"ERROR: invalid JSON in {forge_json_path}: {e}", file=sys.stderr)
        sys.exit(2)

    failures: set[str] = set()
    for suite_path, suite in data.items():
        for test_name, result in (suite.get("test_results") or {}).items():
            if (result or {}).get("status") == "Failure":
                failures.add(f"{suite_path}::{test_name}")
    return failures


def parse_allowlist(env_value: str) -> set[str]:
    return {line.strip() for line in env_value.splitlines() if line.strip()}


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <forge-json-path>", file=sys.stderr)
        return 2

    actual = collect_failures(sys.argv[1])
    allowed = parse_allowlist(os.environ.get("ALLOWED_FAILURES", ""))

    new_regressions = sorted(actual - allowed)
    fixed_baselines = sorted(allowed - actual)

    if new_regressions:
        print("ERROR: new test failures not in the allowlist:")
        for f in new_regressions:
            print(f"  - {f}")
        print("")
        print("If this is a legitimate new known-failure, add it to")
        print("ALLOWED_FAILURES in .github/workflows/zk-pipeline-guards.yml")
        print("with a comment explaining why. Otherwise fix the test.")
        return 1

    if fixed_baselines:
        print("ERROR: tests in the allowlist are now passing (good!) but the")
        print("allowlist still references them. A stale allowlist weakens the")
        print("guard — remove these entries from ALLOWED_FAILURES so the next")
        print("regression in any of them is caught:")
        for f in fixed_baselines:
            print(f"  - {f}")
        return 1

    print(f"OK: {len(actual)} known baseline failure(s), no new regressions.")
    for f in sorted(actual):
        print(f"  - {f}  (allowlisted)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
