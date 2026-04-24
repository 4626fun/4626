// One-off: DM yourself an XMTP `walletSendCalls` tx card that, when
// approved in Base App, adds 0xfB11…1A4b as an owner of the canonical
// CSW 0x4beab…04ef.
//
// Why this script exists:
//   The Base Account SDK third-party test app refuses to send admin
//   self-calls (addOwner / removeOwner / upgradeTo) as a security
//   measure — "error generating transaction / insufficient funds"
//   even when the wallet has plenty of ETH. Base App, on the other
//   hand, will happily render an XMTP `walletSendCalls` message as
//   an approve/deny tx card and execute it against the connected
//   Base Account's passkey. This script delivers the exact same
//   calldata through that approved channel.
//
// How it works:
//   1. Uses XMTP_AGENT_PRIVATE_KEY as a throwaway XMTP sender
//      identity (ephemeral SQLite DB, no persistence needed).
//   2. Opens a DM with the TARGET_INBOX_ADDRESS (the user's Base
//      Account address — where their passkey can sign).
//   3. Sends a `xmtp.org/walletSendCalls:1.0` content-type message
//      with the addOwnerAddress(newOwner) calldata pointed at the
//      canonical CSW.
//
//   The user opens Base App → sees the tx card → taps Confirm →
//   passkey signs → tx lands on-chain → Privy wallet becomes owner
//   at next nextOwnerIndex slot.
//
// Run:
//   XMTP_AGENT_PRIVATE_KEY=0x... \
//   TARGET_INBOX_ADDRESS=0x4beab… \
//   CANONICAL_CSW=0x4beab… \
//   NEW_OWNER=0xfB11… \
//   pnpm tsx src/sendAddOwnerTxToSelf.ts
//
// The ENV defaults below are the 4626-specific values from the
// 2026-04-23 recovery session — safe to override for other wallets.

import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  Client,
  type Signer,
  type WalletSendCalls,
} from "@xmtp/node-sdk";
import { encodeFunctionData, type Hex, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const IDENTIFIER_KIND_ETHEREUM = 0;

const PRIVATE_KEY = (process.env.XMTP_AGENT_PRIVATE_KEY ?? "").trim() as Hex;
if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error("XMTP_AGENT_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key");
  process.exit(1);
}

const TARGET_INBOX_ADDRESS = (
  process.env.TARGET_INBOX_ADDRESS ??
  "0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef"
).toLowerCase();

const CANONICAL_CSW = (
  process.env.CANONICAL_CSW ?? "0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef"
) as Hex;

const NEW_OWNER = (
  process.env.NEW_OWNER ?? "0xfB11237C0D82520832fc0Dc52Feb8eb5E2e81A4b"
) as Hex;

// Coinbase Smart Wallet MultiOwnable.addOwnerAddress(address)
const ADD_OWNER_ABI = [
  {
    type: "function",
    name: "addOwnerAddress",
    stateMutability: "nonpayable",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [],
  },
] as const;

const calldata = encodeFunctionData({
  abi: ADD_OWNER_ABI,
  functionName: "addOwnerAddress",
  args: [NEW_OWNER],
});

function hexToUint8(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IDENTIFIER_KIND_ETHEREUM,
    }),
    signMessage: async (m: string) => {
      const sig = await account.signMessage({ message: m });
      return hexToUint8(sig);
    },
  };

  // Ephemeral XMTP DB. This script runs once and exits; no reason to
  // persist a DB on disk.
  const dbDir = mkdtempSync(`${tmpdir()}/xmtp-addowner-`);
  const dbKey = new Uint8Array(randomBytes(32));

  const client = await Client.create(signer, {
    env: "production",
    dbPath: `${dbDir}/db.sqlite`,
    dbEncryptionKey: dbKey,
  });

  console.log(`\nSender inbox id:   ${client.inboxId}`);
  console.log(`Sender address:    ${account.address}`);
  console.log(`Target address:    ${TARGET_INBOX_ADDRESS}`);
  console.log(`Canonical CSW:     ${CANONICAL_CSW}`);
  console.log(`New owner:         ${NEW_OWNER}`);
  console.log(`Calldata:          ${calldata}`);

  // Verify the target can receive XMTP messages before burning an
  // installation slot.
  const reach = await client.canMessage([
    {
      identifier: TARGET_INBOX_ADDRESS,
      identifierKind: IDENTIFIER_KIND_ETHEREUM,
    },
  ]);
  const canReach = reach.get(TARGET_INBOX_ADDRESS);
  if (!canReach) {
    console.error(
      `\nTarget ${TARGET_INBOX_ADDRESS} is NOT XMTP-reachable. ` +
        `They need to open Base App (or another XMTP client) to initialise ` +
        `their inbox before this DM can land.`,
    );
    process.exit(1);
  }
  console.log(`Target reachable:  yes`);

  const dm = await client.conversations.createDmWithIdentifier({
    identifier: TARGET_INBOX_ADDRESS,
    identifierKind: IDENTIFIER_KIND_ETHEREUM,
  });

  const walletSendCalls: WalletSendCalls = {
    version: "1.0",
    // EIP-155 chainId in hex. Base mainnet = 8453.
    chainId: toHex(8453),
    // `from` is the wallet that will execute the call. Base App will
    // route this to the connected Base Account's signer.
    from: CANONICAL_CSW,
    calls: [
      {
        to: CANONICAL_CSW,
        value: "0x0",
        data: calldata,
        metadata: {
          description: `Add ${NEW_OWNER} as an authorized owner of your Coinbase Smart Wallet (${CANONICAL_CSW}).`,
          transactionType: "addOwnerAddress",
        },
      },
    ],
  };

  // Friendly preamble so the card has context next to the tx button
  // in Base App (some clients render the most recent text turn above
  // the tx card).
  await dm.sendText(
    `Self-requested admin op — adds ${NEW_OWNER} as an owner of ${CANONICAL_CSW}. ` +
      `Tap "Confirm" below to approve.`,
  );

  await dm.sendWalletSendCalls(walletSendCalls);

  console.log(`\n✅ walletSendCalls tx card delivered.`);
  console.log(`   Conversation id: ${dm.id}`);
  console.log(
    `\nNext step: open Base App → Messages → accept the request from ` +
      `${account.address} → tap Confirm on the tx card.`,
  );
  console.log(
    `\nExpected outcome: ${NEW_OWNER} becomes owner at the next ` +
      `nextOwnerIndex slot of ${CANONICAL_CSW}. Verify with:\n` +
      `  cast call ${CANONICAL_CSW} "isOwnerAddress(address)" ${NEW_OWNER} --rpc-url https://mainnet.base.org`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
