#!/usr/bin/env python3
"""Probe RPC endpoints for Shovel-style workloads (headers + getLogs).

Shovel's sync path needs:
  1. eth_blockNumber
  2. eth_getLogs over a small window
  3. batched eth_getBlockByNumber header fetches (Shovel loads N block headers per batch)

The small cast probe in sync-env-from-frontend.sh is not enough — Alchemy can pass
tiny getLogs yet fail 500-block header batches.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Iterable
from urllib.parse import urlparse

DEFAULT_PROBE_BLOCK = 48_345_250
DEFAULT_BATCHER = "0x02D7abC547F8B1e7E2D7a919D8D1005918361750"
DEFAULT_HEADER_BATCH = 200
DEFAULT_LOGS_SPAN = 6


def rpc_call(url: str, method: str, params: list, timeout: float = 20.0) -> object:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.load(resp)
    if "error" in payload:
        err = payload["error"]
        code = err.get("code") if isinstance(err, dict) else err
        msg = err.get("message") if isinstance(err, dict) else str(err)
        raise RuntimeError(f"{method} error {code}: {msg}")
    return payload["result"]


def rpc_batch(url: str, calls: list[tuple[str, list]], timeout: float = 45.0) -> list:
    body = json.dumps(
        [
            {"jsonrpc": "2.0", "id": i, "method": method, "params": params}
            for i, (method, params) in enumerate(calls)
        ]
    ).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.load(resp)
    if not isinstance(payload, list):
        raise RuntimeError("batch response is not a JSON array")
    for item in payload:
        if "error" in item:
            err = item["error"]
            code = err.get("code") if isinstance(err, dict) else err
            msg = err.get("message") if isinstance(err, dict) else str(err)
            raise RuntimeError(f"batch error {code}: {msg}")
        if item.get("result") is None:
            raise RuntimeError("batch returned null header")
    return payload


def host_label(url: str) -> str:
    return urlparse(url).hostname or "?"


def probe_url(
    url: str,
    *,
    probe_block: int,
    batcher: str,
    header_batch: int,
    logs_span: int,
) -> tuple[bool, str]:
    try:
        tip_hex = rpc_call(url, "eth_blockNumber", [])
        tip = int(tip_hex, 16)
        from_block = max(probe_block, tip - 10_000)
        to_block = from_block + logs_span

        rpc_call(
            url,
            "eth_getLogs",
            [
                {
                    "fromBlock": hex(from_block),
                    "toBlock": hex(to_block),
                    "address": batcher,
                }
            ],
        )

        header_calls = [
            ("eth_getBlockByNumber", [hex(from_block + i), False]) for i in range(header_batch)
        ]
        rpc_batch(url, header_calls)
        return True, "ok"
    except urllib.error.HTTPError as exc:
        return False, f"http {exc.code}"
    except Exception as exc:  # noqa: BLE001 — probe surfaces provider errors to stderr
        return False, str(exc)


def iter_candidates(explicit: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in explicit:
        value = (item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def env_candidates() -> list[str]:
    return iter_candidates(
        [
            os.environ.get("BASE_LOGS_RPC_URL", ""),
            os.environ.get("BASE_READ_RPC_URL", ""),
            os.environ.get("BASE_RPC_URL", ""),
        ]
    )


def pick_rpc(
    candidates: list[str],
    *,
    probe_block: int,
    batcher: str,
    header_batch: int,
    logs_span: int,
) -> tuple[str | None, list[str]]:
    failures: list[str] = []
    for url in candidates:
        ok, reason = probe_url(
            url,
            probe_block=probe_block,
            batcher=batcher,
            header_batch=header_batch,
            logs_span=logs_span,
        )
        if ok:
            return url, failures
        failures.append(f"{host_label(url)}: {reason}")
    return None, failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe RPC URLs for Shovel indexing")
    parser.add_argument("urls", nargs="*", help="Candidate RPC URLs (default: env chain)")
    parser.add_argument("--probe-block", type=int, default=int(os.environ.get("SHOVEL_BASE_START_BLOCK", DEFAULT_PROBE_BLOCK)))
    parser.add_argument("--batcher", default=os.environ.get("DEPLOYMENT_BATCHER", DEFAULT_BATCHER))
    parser.add_argument("--header-batch", type=int, default=int(os.environ.get("SHOVEL_PROBE_HEADER_BATCH", DEFAULT_HEADER_BATCH)))
    parser.add_argument("--logs-span", type=int, default=DEFAULT_LOGS_SPAN)
    parser.add_argument("--json", action="store_true", help="Print JSON result")
    parser.add_argument("--export", action="store_true", help="Print shell export lines")
    args = parser.parse_args()

    candidates = iter_candidates(args.urls) if args.urls else env_candidates()
    if not candidates:
        print("No RPC candidates", file=sys.stderr)
        return 1

    selected, failures = pick_rpc(
        candidates,
        probe_block=args.probe_block,
        batcher=args.batcher,
        header_batch=args.header_batch,
        logs_span=args.logs_span,
    )

    if not selected:
        for line in failures:
            print(f"RPC probe failed: {line}", file=sys.stderr)
        return 1

    batch_size = str(args.header_batch)
    if args.json:
        print(
            json.dumps(
                {
                    "url": selected,
                    "host": host_label(selected),
                    "batch_size": int(batch_size),
                    "failures": failures,
                }
            )
        )
    elif args.export:
        print(f"BASE_LOGS_RPC_URL={selected}")
        print(f"SHOVEL_BATCH_SIZE={batch_size}")
    else:
        print(selected)
        for line in failures:
            print(f"skipped: {line}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
