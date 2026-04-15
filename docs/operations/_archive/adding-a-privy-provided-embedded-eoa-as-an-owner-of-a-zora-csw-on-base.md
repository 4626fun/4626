Adding a Privy‑provided Embedded EOA as an Owner of a Zora Contract‑Smart‑Wallet (CSW) on Base
This guide walks you through the complete flow for a user who:

Signs up / logs in with Privy (email → embedded EOA).

Logs into Zora (SIWE) to obtain the address of their Zora‑controlled CSW.

Adds that embedded EOA as an owner/signer of the CSW.

It also covers the case where your Base‑app may have already deployed a CSW for the same user and that address happens to be identical to the Zora CSW address – in that situation you only need to perform the owner‑addition once.

Table of Contents
Prerequisites

Step 1 – Get the Privy embedded EOA

Step 2 – Log in to Zora and retrieve the CSW address

Step 3 – Determine if Base‑app CSW = Zora CSW

Step 4 – Verify that the caller is an existing owner of the CSW

Step 5 – Add the embedded EOA as an owner

Optional – Use EIP‑7702 to delegate execution without changing ownership

Security & Best‑Practice Checklist

Full Example Code (React/TypeScript)

References

<a name="prerequisites"></a>

Prerequisites
Item	Why you need it	Reference
Privy Account (appId)	Provides embedded wallets & EIP‑7702 support.	Privy Docs – Smart wallets 
Viem / Wagmi (or Ethers)	Low‑level Ethereum calls (getCode, send transaction).	Privy EIP‑7702 guide 
@gnosis.pm/safe-react-sdk / @gnosis.pm/safe-core-sdk	Interact with a Gnosis Safe‑style CSW (read owners, addOwner).	Safe – Managing owners 
Zora SDK (or SIWE + subgraph)	Log in to Zora and fetch the user’s wallet address.	Zora wallet docs 
Base RPC endpoint (Alchemy, Infura, or public)	Needed for read/write calls on Base.	Any provider; Alchemy used in Privy EIP‑7702 example 
Optional: Paymaster (if you want to sponsor gas)	Lets users transact without holding ETH in the EOA.	Privy gas sponsorship 
Install the core packages (example with npm):

bash
npm i @privy-io/react-auth viem wagmi \
      @gnosis.pm/safe-react-sdk @gnosis.pm/safe-core-sdk \
      @zoralabs/zora-sdk   # or however you prefer to talk to Zora
<a name="step-1---get-the-privy-embedded-eoa"></a>

Step 1 – Get the Privy embedded EOA
After the user logs in with <PrivyProvider>, pull the embedded wallet (the EOA) from Privy’s useWallets() hook.

tsx
import { useWallets } from '@privy-io/react-auth';

export function usePrivyEmbeddedEOA() {
  const { wallets } = useWallets();
  const embedded = wallets.find(w => w.walletClientType === 'privy');
  if (!embedded) throw new Error('No Privy embedded wallet found');
  return embedded; // contains .address, .getEthereumProvider(), etc.
}
Why: Privy’s embedded wallet is an EOA whose key is sharded between the user’s device and Privy’s servers . The address returned here is the exact EOA you will later use to transact with the CSW.

<a name="step-2---log-in-to-zora-and-retrieve-the-csw-address"></a>

Step 2 – Log in to Zora and retrieve the CSW address
Zora uses SIWE (Sign‑In with Ethereum) and a GraphQL endpoint that maps a Zora profile to its wallet address.

2.1 SIWE login (example with siwe + wagmi)
tsx
import { SiweMessage } from 'siwe';
import { useAccount, useSignMessage } from 'wagmi';

export async function signInWithZora() {
  const { address: privyAddress } = usePrivyEmbeddedEOA(); // from Step 1
  const { signMessage } = useSignMessage();
  const { address: userAddress } = useAccount(); // will equal privyAddress after Privy login

  // Build SIWE message for Zora
  const message = new SiweMessage({
    domain: 'zora.co',
    address: userAddress,
    statement: 'Sign in to Zora to link your wallet',
    uri: 'https://zora.co',
    version: '1',
    chainId: 8453,          // Base Mainnet (use 84532 for Sepolia if you test)
    nonce: await fetchZoraNonce(), // implement this to get a nonce from Zora’s auth endpoint
    issuedAt: new Date().toISOString(),
  });

  const signature = await signMessage(message.prepareMessage());

  // Send to Zora’s SIWE endpoint (adjust if Zora uses a different path)
  const authRes = await fetch('https://api.zora.co/auth/siwe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message.prepareMessage(),
      signature,
    }),
  });
  const { accessToken } = await authRes.json();
  return { accessToken, userAddress };
}
Reference: Zora’s self‑custodial wallet docs describe the SIWE flow .

2.2 Fetch the CSW address from Zora (GraphQL)
tsx
export async function getZoraCSWAddress(accessToken: string) {
  const res = await fetch('https://api.zora.co/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          viewer {
            wallet {
              address
            }
          }
        }
      `,
    }),
  });
  const { data } = await res.json();
  return data.viewer.wallet.address; // this is the CSW contract address
}
Why: Zora wallets are self‑custodial smart‑contract wallets created via Privy; the address returned is the on‑chain CSW .

<a name="step-3---determine-if-base-app-csw--zora-csw"></a>

Step 3 – Determine if Base‑app CSW = Zora CSW
If your Base app already knows the CSW address it created for the user (e.g., stored in your DB or derived deterministically), compare it to the Zora address.

tsx
function addressesEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Example usage:
const baseAppCSW = await getBaseAppCSWForUser(userId); // your own logic
const zoraCSW    = await getZoraCSWAddress(accessToken);
const sameContract = addressesEqual(baseAppCSW, zoraCSW);
If sameContract is true → you have one CSW to work with.
If false → you have two distinct contracts; you can still add the EOA as owner to both (repeat the owner‑addition steps for each address) or choose whichever contract you want to control.

<a name="step-4---verify-that-the-caller-is-an-existing-owner-of-the-csw"></a>

Step 4 – Verify that the caller is an existing owner of the CSW
Before you can call addOwner, you must confirm that the transaction sender (either the embedded EOA or the current owner) is already an owner. For a Gnosis Safe you can query the list of owners.

tsx
import { usePublicClient } from 'wagmi';
import { Safe } from '@gnosis.pm/safe-core-sdk';

export async function getSafeOwners(safeAddress: `0x${string}`) {
  const publicClient = usePublicClient(); // viem client configured to Base
  const safe = await Safe.create({
    ethAdapter: {
      getSigner: () => undefined, // read‑only
      provider: publicClient.transport,
    },
    safeAddress,
  });
  const owners = await safe.getOwners();
  return owners.map(o => o.toLowerCase());
}
Then:

tsx
const owners = await getSafeOwners(cswAddress as `0x${string}`);
const isOwner = owners.includes(privyEOAAddress.toLowerCase());
// If false, you need an existing owner to sign & submit the addOwner tx.
Reference: Managing Safe owners & signatures  explains that only current owners may propose a new owner.

<a name="step-5---add-the-embedded-eoa-as-an-owner"></a>

Step 5 – Add the embedded EOA as an owner
Two common patterns:

5.1 Pattern A – The embedded EOA itself sends the addOwner transaction (requires it to already be an owner)
tsx
import { useWalletClient } from 'wagmi';
import { Safe } from '@gnosis.pm/safe-core-sdk';
import { encodeFunctionData } from 'viem';

export async function addOwnerViaEOA(
  safeAddress: `0x${string}`,
  newOwnerAddress: `0x${string}`, // the Privy EOA
  threshold: bigint = 1n
) {
  const { data: walletClient } = useWalletClient(); // signer from Privy
  const safe = await Safe.create({
    ethAdapter: {
      getSigner: () => walletClient,
      provider: walletClient.transport,
    },
    safeAddress,
  });

  const callData = encodeFunctionData({
    abi: ["function addOwner(address owner, uint256 threshold)"],
    functionName: 'addOwner',
    args: [newOwnerAddress, threshold],
  });

  const tx = await walletClient.sendTransaction({
    to: safeAddress,
    data: callData,
    value: 0n,
  });
  await walletClient.waitForTransactionReceipt({ hash: tx.hash });
  return tx.hash;
}
Reference: The Polymarket/privy‑safe‑builder‑example shows the Privy EOA used to interact with a Safe .

5.2 Pattern B – Existing owner signs & submits (more common when the EOA is not yet an owner)
Encode the transaction data (same as above).

Have the existing owner sign using their wallet (MetaMask, WalletConnect, or another Privy wallet they control).

Broadcast the signed transaction – any relayer can submit it; the CSW will execute if enough signatures are present.

tsx
// 1. Encode call data (reuse from above)
const callData = encodeFunctionData({
  abi: ["function addOwner(address owner, uint256 threshold)"],
  functionName: 'addOwner',
  args: [privyEOAAddress as `0x${string}`, 1n],
});

// 2. Existing owner signs (example with wagmi walletClient)
const { data: ownerWallet } = useWalletClient(); // this is the existing owner's signer
const { hash } = await ownerWallet.sendTransaction({
  to: cswAddress as `0x${string}`,
  data: callData,
  value: 0n,
});
await ownerWallet.waitForTransactionReceipt({ hash });
If the CSW requires multiple signatures (e.g., 2‑of‑2), use the Safe SDK’s multisig helpers:

tsx
const safeTx = await safe.createMultisigTransaction({
  to: cswAddress,
  value: 0n,
  data: callData,
  operation: 0, // CALL
});
const safeTxHash = await safe.getTransactionHash(safeTx);
// Existing owner signs:
await safe.approveTransactionHash(safeTxHash);
// You (or another owner) also sign:
await safe.approveTransactionHash(safeTxHash);
// Finally execute:
await safe.executeTransaction(safeTx);
Reference: Safe multisig transaction flow .

<a name="optional---use-eip-7702-to-delegate-execution-without-changing-ownership"></a>

Optional – Use EIP‑7702 to delegate execution without changing ownership
If you prefer not to modify the CSW’s owner list, you can enable EIP‑7702 on the Privy embedded wallet so the EOA can delegate execution to the CSW (or any smart contract) while keeping the same address.

Enable EIP‑7702 in Privy config (see Privy’s EIP‑7702 guide) .

Create a SmartAccountSigner that wraps the Privy signer and can sign 7702 authorizations.

Use a smart‑account client (e.g., Alchemy’s ModularAccountV2Client) to send transactions; the client will automatically attach a 7702 authorization that points to a delegated contract (your CSW or a wrapper).

The code for steps 2‑3 is already in the Privy EIP‑7702 guide  (see the “Create a SmartAccountSigner instance” and “Upgrade to smart accounts and send sponsored transactions” sections). After you have the SmartAccountSigner, you can call any contract—including your CSW—just like a regular wallet, but you gain gas sponsorship, batching, etc.

Why you might choose this: Avoids an on‑chain addOwner transaction (saves gas) and lets you revoke delegation later by clearing the 7702 authorization.

<a name="security--best-practice-checklist"></a>

Security & Best‑Practice Checklist
Concern	Mitigation
Private‑key exposure	Never expose the raw private key; Privy keeps it sharded and only uses it via the Privy provider 
.
Replay attacks (EIP‑7702)	Authorizations include a nonce and chain‑id; verify on‑chain if you use 7702 
.
Threshold mismatch	After adding an owner, consider updating the threshold if you want the new owner to participate in quorum.
Gas sponsorship abuse	If you enable a paymaster, set sensible limits (max gas per tx, daily cap) in the Privy dashboard 
.
Zora account linking	Verify the user truly owns the Zora account before accepting the returned CSW address; ask them to sign a message with the Zora‑linked wallet.
Upgradeable CSW	If your CSW uses a proxy, always call through the proxy address; the implementation may change, but owner‑management logic stays at the proxy.
Front‑end CSRF	Ensure SIWE messages include a nonce and timestamp; reject old messages.
<a name="full-example-code-reacttypescript"></a>

Full Example Code (React/TypeScript)
The following snippet puts everything together. It assumes you have already wrapped your app with <PrivyProvider> and that you are using Base Mainnet (switch chainId to 84532 for Sepolia testing).

tsx
/* ---------- Privy setup (wrap your app) ---------- */
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID}
  config={{
    embeddedWallets: { showWalletUIs: false, createOnLogin: 'all-users' },
    defaultChain: mainnet, // viem/chains mainnet (Base)
    supportedChains: [mainnet],
  }}
>
  {/* Your app */}
</PrivyProvider>

/* ---------- Hook: get Privy embedded EOA ---------- */
function usePrivyEmbeddedEOA() {
  const { wallets } = useWallets();
  const embedded = wallets.find(w => w.walletClientType === 'privy');
  if (!embedded) throw new Error('No Privy embedded wallet');
  return embedded;
}

/* ---------- SIWE login to Zora ---------- */
async function signInWithZora() {
  const { address: privyAddress } = usePrivyEmbeddedEOA();
  const { signMessage } = useSignMessage();
  const { address: userAddress } = useAccount(); // equals privyAddress after Privy login

  const message = new SiweMessage({
    domain: 'zora.co',
    address: userAddress,
    statement: 'Sign in to Zora to link your wallet',
    uri: 'https://zora.co',
    version: '1',
    chainId: 8453, // Base Mainnet
    nonce: await fetchZoraNonce(), // implement this to fetch a nonce from Zora auth endpoint
    issuedAt: new Date().toISOString(),
  });

  const signature = await signMessage(message.prepareMessage());

  const authRes = await fetch('https://api.zora.co/auth/siwe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message.prepareMessage(), signature }),
  });
  const { accessToken } = await authRes.json();
  return { accessToken, userAddress };
}

/* ---------- Get Zora CSW address ---------- */
async function getZoraCSWAddress(accessToken: string) {
  const res = await fetch('https://api.zora.co/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          viewer {
            wallet { address }
          }
        }
      `,
    }),
  });
  const { data } = await res.json();
  return data.viewer.wallet.address;
}

/* ---------- Get owners of a Gnosis Safe ---------- */
async function getSafeOwners(safeAddress: `0x${string}`) {
  const publicClient = usePublicClient(); // viem client to Base
  const safe = await Safe.create({
    ethAdapter: {
      getSigner: () => undefined,
      provider: publicClient.transport,
    },
    safeAddress,
  });
  const owners = await safe.getOwners();
  return owners.map(o => o.toLowerCase());
}

/* ---------- Add owner via the Privy EOA (if it is already an owner) ---------- */
async function addOwnerViaEOA(
  safeAddress: `0x${string}`,
  newOwnerAddress: `0x${string}`,
  threshold: bigint = 1n
) {
  const { data: walletClient } = useWalletClient(); // signer from Privy
  const safe = await Safe.create({
    ethAdapter: {
      getSigner: () => walletClient,
      provider: walletClient.transport,
    },
    safeAddress,
  });

  const callData = encodeFunctionData({
    abi: ["function addOwner(address owner, uint256 threshold)"],
    functionName: 'addOwner',
    args: [newOwnerAddress, threshold],
  });

  const tx = await walletClient.sendTransaction({
    to: safeAddress,
    data: callData,
    value: 0n,
  });
  await walletClient.waitForTransactionReceipt({ hash: tx.hash });
  return tx.hash;
}

/* ---------- Main orchestration ---------- */
export async function linkPrivyEOAToZoraCSW() {
  // 1. Get Privy embedded EOA
  const privyEmbedded = usePrivyEmbeddedEOA();
  const privyAddr = privyEmbedded.address as `0x${string}`;

  // 2. Log into Zora and fetch its CSW address
  const { accessToken } = await signInWithZora();
  const zoraCSW = await getZoraCSWAddress(accessToken) as `0x${string}`;

  // 3. (Optional) Get your Base‑app CSW address and check equality
  const baseAppCSW = await getBaseAppCSWForUser(/* userId */); // your own logic
  const same = baseAppCSW.toLowerCase() === zoraCSW.toLowerCase();
  const cswAddress = same ? baseAppCSW : zoraCSW; // work with whichever you need

  // 4. Verify current ownership (skip if you know the EOA is already an owner)
  const owners = await getSafeOwners(cswAddress);
  const isOwner = owners.includes(privyAddr.toLowerCase());

  // 5. Add owner
  if (isOwner) {
    // The EOA can send the tx itself
    const hash = await addOwnerViaEOA(cswAddress, privyAddr);
    console.log('Owner added via EOA tx:', hash);
  } else {
    // Existing owner must sign & submit; here we just throw for clarity.
    // In production, you would collect a signature from an existing owner
    // and then broadcast the encoded transaction.
    throw new Error(
      'Privy EOA is not yet an owner of the CSW. Have an existing owner sign and submit the addOwner transaction.'
    );
  }
}
Replace getBaseAppCSWForUser, fetchZoraNonce, and any wallet‑client hooks with your actual implementations.

<a name="references"></a>

References
Privy Docs – Smart wallets

Privy Docs – Integrating with EIP‑7702

Gnosis Safe – Managing Safe Owners and Signatures

Zora Support – How Wallets Created on Zora Work

Polymarket/privy‑safe‑builder‑example (Privy → Safe)

base/base-account‑privy (Privy + Base Accoununt)

Gauntlet – Multisig transactions with Gnosis Safe