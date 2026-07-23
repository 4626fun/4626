#!/usr/bin/env node
/**
 * One-shot: approvePhaseModuleCodehash + setPhase1Module on the live split batcher
 * via the protocol treasury Safe (1-of-N owner key).
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/execute-set-phase1-module-safe.ts \
 *     --phase1-module 0x... \
 *     --manifest ../deployments/base/v1.19.3-bytecode-manifest.json \
 *     --approve-code-keys CreatorOVault,CreatorOVaultWrapper,CreatorShareOFT
 *
 * The default is read-only. Add `--execute approve` only after reviewing the
 * printed module/codeId plan and obtaining the mutation-boundary approval.
 *
 * Loads `frontend/.env` when present.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Safe from "@safe-global/protocol-kit";
import { OperationType } from "@safe-global/types-kit";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import { SPLIT_PHASE1_DEPLOYMENT_BATCHER } from "../../src/config/contracts.defaults.js";
import { resolveProtocolTreasuryAddress } from "../../server/_lib/wallet/protocolTreasurySafe.js";
import { DEPLOY_CONSUMED_MANIFEST_KEYS } from "./releaseBytecodeKeys.js";

function loadFrontendEnvFile(): void {
  const envPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../.env",
  );
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadFrontendEnvFile();

declare const process: {
  argv: string[];
  cwd: () => string;
  env: Record<string, string | undefined>;
  exit: (code?: number) => void;
  stdout: { write: (chunk: string) => void };
  stderr: { write: (chunk: string) => void };
};

const SET_PHASE1_MODULE_ABI = [
  {
    type: "function",
    name: "setPhase1Module",
    stateMutability: "nonpayable",
    inputs: [{ name: "_phase1Module", type: "address" }],
    outputs: [],
  },
] as const;

const APPROVE_PHASE_MODULE_CODEHASH_ABI = [
  {
    type: "function",
    name: "approvePhaseModuleCodehash",
    stateMutability: "nonpayable",
    inputs: [
      { name: "module", type: "address" },
      { name: "codehash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

const SET_APPROVED_CODE_IDS_ABI = [
  {
    type: "function",
    name: "setApprovedCodeIds",
    stateMutability: "nonpayable",
    inputs: [
      { name: "codeIds", type: "bytes32[]" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const MODULE_IDENTITY_ABI = [
  {
    type: "function",
    name: "batcher",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "agentVaultCoreModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "vaultCoreModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const BATCHER_PHASE1_MODULE_ABI = [
  {
    type: "function",
    name: "phase1Module",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "approvedPhaseModuleCodehashes",
    stateMutability: "view",
    inputs: [{ name: "module", type: "address" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "approvedCodeIds",
    stateMutability: "view",
    inputs: [{ name: "codeId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

type Manifest = {
  release: string;
  contracts: Record<string, { codeId: Hex }>;
};

type CodeIdApproval = {
  key: string;
  codeId: Hex;
  alreadyApproved: boolean;
};

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function executeApproved(): boolean {
  return getArg("--execute") === "approve";
}

function resolveCodeIdApprovals(): Array<{ key: string; codeId: Hex }> {
  const rawKeys = String(getArg("--approve-code-keys") ?? "").trim();
  if (!rawKeys) return [];
  const manifestRaw = String(getArg("--manifest") ?? "").trim();
  if (!manifestRaw)
    throw new Error("--manifest is required with --approve-code-keys");
  const manifestPath = resolve(process.cwd(), manifestRaw);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  const allowedKeys = new Set<string>(DEPLOY_CONSUMED_MANIFEST_KEYS);
  const keys = [
    ...new Set(
      rawKeys
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (keys.length === 0)
    throw new Error("--approve-code-keys did not contain any keys");

  return keys.map((key) => {
    if (!allowedKeys.has(key))
      throw new Error(`CodeId key is not deploy-consumed: ${key}`);
    const codeId = manifest.contracts[key]?.codeId;
    if (!codeId || !/^0x[0-9a-fA-F]{64}$/.test(codeId)) {
      throw new Error(
        `Manifest ${manifest.release} is missing a valid codeId for ${key}`,
      );
    }
    return { key, codeId };
  });
}

function resolveOwnerKey(): `0x${string}` {
  const candidates = [
    process.env.PROTOCOL_TREASURY_SAFE_OWNER_PK,
    process.env.SAFE_OWNER_PRIVATE_KEY,
    process.env.PRIVATE_KEY,
  ];
  for (const raw of candidates) {
    const key = String(raw ?? "").trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(key)) return key as `0x${string}`;
  }
  throw new Error(
    "Missing Safe owner private key (PROTOCOL_TREASURY_SAFE_OWNER_PK / PRIVATE_KEY)",
  );
}

function rpcUrl(): string {
  const raw = String(process.env.BASE_RPC_URL ?? "").trim();
  if (!raw) throw new Error("BASE_RPC_URL required");
  return raw.replace("wss://", "https://").replace("/ws/", "/rpc/");
}

async function main(): Promise<void> {
  const phase1Raw = getArg("--phase1-module");
  if (!phase1Raw || !isAddress(phase1Raw)) {
    throw new Error("--phase1-module <address> required");
  }
  const phase1Module = getAddress(phase1Raw);
  const batcher = getAddress(
    getArg("--batcher") ?? SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  );
  const safeAddress = resolveProtocolTreasuryAddress();
  const privateKey = resolveOwnerKey();
  const signerAddress = getAddress(privateKeyToAccount(privateKey).address);
  const rpc = rpcUrl();
  const execute = executeApproved();
  const requestedCodeIds = resolveCodeIdApprovals();

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpc),
  });

  const moduleBatcher = await publicClient.readContract({
    address: phase1Module,
    abi: MODULE_IDENTITY_ABI,
    functionName: "batcher",
  });
  if (getAddress(moduleBatcher) !== batcher) {
    throw new Error(
      `module.batcher() = ${moduleBatcher} does not match target batcher ${batcher}`,
    );
  }

  const agentCore = await publicClient.readContract({
    address: phase1Module,
    abi: MODULE_IDENTITY_ABI,
    functionName: "agentVaultCoreModule",
  });
  const creatorCore = await publicClient.readContract({
    address: phase1Module,
    abi: MODULE_IDENTITY_ABI,
    functionName: "vaultCoreModule",
  });
  if (getAddress(agentCore) === getAddress(creatorCore)) {
    process.stdout.write(
      `warn: agentVaultCoreModule === vaultCoreModule (${agentCore}); agent lane will not diverge\n`,
    );
  }

  const runtimeBytecode = await publicClient.getBytecode({
    address: phase1Module,
  });
  if (!runtimeBytecode || runtimeBytecode === "0x") {
    throw new Error(
      `No runtime bytecode at replacement module ${phase1Module}`,
    );
  }
  const runtimeCodehash = keccak256(runtimeBytecode as Hex);

  const codeIdApprovals: CodeIdApproval[] = await Promise.all(
    requestedCodeIds.map(async ({ key, codeId }) => ({
      key,
      codeId,
      alreadyApproved: await publicClient.readContract({
        address: batcher,
        abi: BATCHER_PHASE1_MODULE_ABI,
        functionName: "approvedCodeIds",
        args: [codeId],
      }),
    })),
  );
  const missingCodeIds = codeIdApprovals.filter(
    (entry) => !entry.alreadyApproved,
  );

  const approveData = encodeFunctionData({
    abi: APPROVE_PHASE_MODULE_CODEHASH_ABI,
    functionName: "approvePhaseModuleCodehash",
    args: [phase1Module, runtimeCodehash],
  });
  const setModuleData = encodeFunctionData({
    abi: SET_PHASE1_MODULE_ABI,
    functionName: "setPhase1Module",
    args: [phase1Module],
  });

  const transactions: Array<{
    to: Address;
    value: string;
    data: Hex;
    operation: OperationType;
  }> = [];
  if (missingCodeIds.length > 0) {
    transactions.push({
      to: batcher,
      value: "0",
      data: encodeFunctionData({
        abi: SET_APPROVED_CODE_IDS_ABI,
        functionName: "setApprovedCodeIds",
        args: [missingCodeIds.map((entry) => entry.codeId), true],
      }),
      operation: OperationType.Call,
    });
  }
  transactions.push(
    {
      to: batcher,
      value: "0",
      data: approveData,
      operation: OperationType.Call,
    },
    {
      to: batcher,
      value: "0",
      data: setModuleData,
      operation: OperationType.Call,
    },
  );

  process.stdout.write(
    `${execute ? "EXECUTE" : "DRY-RUN"}: atomically approving ${runtimeCodehash} and setting phase1 module ${phase1Module} on batcher ${batcher} via Safe ${safeAddress} signer ${signerAddress}\n`,
  );
  process.stdout.write(
    `  agentVaultCoreModule=${agentCore}\n  vaultCoreModule=${creatorCore}\n`,
  );
  for (const entry of codeIdApprovals) {
    process.stdout.write(
      `  codeId ${entry.key}=${entry.codeId} approved=${entry.alreadyApproved ? "already" : "pending"}\n`,
    );
  }

  if (!execute) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          batcher,
          currentPhase1Module: await publicClient.readContract({
            address: batcher,
            abi: BATCHER_PHASE1_MODULE_ABI,
            functionName: "phase1Module",
          }),
          replacementPhase1Module: phase1Module,
          agentVaultCoreModule: agentCore,
          vaultCoreModule: creatorCore,
          runtimeCodehash,
          safeAddress,
          signerAddress,
          codeIdApprovals,
          transactionCount: transactions.length,
          executeCommandGuard: "--execute approve",
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  const protocolKit = await Safe.init({
    provider: rpc,
    signer: privateKey,
    safeAddress,
  });

  const safeTransaction = await protocolKit.createTransaction({
    transactions,
  });

  const executeResponse = await protocolKit.executeTransaction(safeTransaction);
  const txHash =
    executeResponse.hash ??
    (executeResponse as { transactionResponse?: { hash?: `0x${string}` } })
      .transactionResponse?.hash;

  if (!txHash) throw new Error("Safe execute returned no tx hash");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 120_000,
  });
  if (receipt.status !== "success")
    throw new Error(`Safe tx reverted: ${txHash}`);

  const wired = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_PHASE1_MODULE_ABI,
    functionName: "phase1Module",
  });
  if (getAddress(wired) !== phase1Module) {
    throw new Error(
      `post-swap verify failed: batcher.phase1Module() = ${wired}`,
    );
  }
  const approvedCodehash = await publicClient.readContract({
    address: batcher,
    abi: BATCHER_PHASE1_MODULE_ABI,
    functionName: "approvedPhaseModuleCodehashes",
    args: [phase1Module],
  });
  if (approvedCodehash.toLowerCase() !== runtimeCodehash.toLowerCase()) {
    throw new Error(
      `post-swap codehash verify failed: approved=${approvedCodehash} runtime=${runtimeCodehash}`,
    );
  }
  const missingAfter = (
    await Promise.all(
      codeIdApprovals.map(async (entry) => ({
        ...entry,
        approved: await publicClient.readContract({
          address: batcher,
          abi: BATCHER_PHASE1_MODULE_ABI,
          functionName: "approvedCodeIds",
          args: [entry.codeId],
        }),
      })),
    )
  ).filter((entry) => !entry.approved);
  if (missingAfter.length > 0) {
    throw new Error(
      `post-swap codeId approval missing: ${missingAfter[0]?.key ?? "unknown"}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        txHash,
        batcher,
        phase1Module,
        agentVaultCoreModule: agentCore,
        vaultCoreModule: creatorCore,
        runtimeCodehash,
        safeAddress,
        approvedCodeIds: codeIdApprovals.map(({ key, codeId }) => ({
          key,
          codeId,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
