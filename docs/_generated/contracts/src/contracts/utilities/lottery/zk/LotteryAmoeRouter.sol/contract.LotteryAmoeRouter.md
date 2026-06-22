# LotteryAmoeRouter
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/lottery/zk/LotteryAmoeRouter.sol)


## Constants
### MIN_DEADLINE_BUFFER
Minimum buffer (in seconds) between `block.timestamp` and a
relayer-supplied `deadline` for `submitAmoeEntry`.

Why this floor exists (audit §4.2, finding `timestamp`):
Solidity's `block.timestamp` can be drifted by miners by up
to ~15 seconds without violating consensus. AMOE deadlines
are denominated in minutes / hours, not seconds, so any
legitimately-issued entry will have a deadline far in the
future relative to that drift. The 60s floor below rejects
relayer-supplied deadlines that fall inside the miner-drift
tolerance window, so a benign timestamp jiggle can never
turn a valid entry into a `DeadlineExpired` revert at the
block boundary. Sixty seconds is well above worst-case
observed L1 / L2 timestamp slack.


```solidity
uint256 public constant MIN_DEADLINE_BUFFER = 60
```


### MAX_POINTS_AS_USD
Defense-in-depth ceiling on `pointsBurnedAsUSD`. AMOE max is
1_000_000 points × 10_000 = 10^10 1e6 units = $10,000. A
buggy server or a malformed proof witness that produces a
value above this cap is rejected before it can reach the
manager. The circuit independently range-checks the value to
uint64; this ceiling is a tighter, semantic limit.


```solidity
uint256 public constant MAX_POINTS_AS_USD = 10_000 * 1_000_000
```


## State Variables
### owner
Owner can update verifier address, allowlist roots, and consumer.


```solidity
address public owner
```


### allowlistPublisher
Address allowed to publish daily allowlist roots (server signer).


```solidity
address public allowlistPublisher
```


### pointsLedgerPublisher
Address allowed to publish daily points-burn ledger roots.

Mirrors `allowlistPublisher` but for the v2 points-burn anchor.
Same KMS-protected scoped key class.


```solidity
address public pointsLedgerPublisher
```


### verifier
PLONK verifier for the AMOE eligibility circuit (v2).

Migrated from per-circuit Groth16 → PLONK to avoid the
per-circuit trusted-setup ceremony. PLONK uses the universal
Hermez powersOfTau (pot17) SRS. Public-input layout is
unchanged; the on-chain proof shape is now a flat
`uint256[24]` instead of `(a,b,c)`. See `IAmoePlonkVerifier`.


```solidity
IAmoePlonkVerifier public verifier
```


### consumer
Optional downstream legacy consumer (event broadcaster).

Receives the truncated `(buyer, coin, epoch, entryId)` shape.
Production should prefer `manager` for points-bound fan-out.


```solidity
ILotteryAmoeConsumer public consumer
```


### manager
CreatorLotteryManager-shaped fan-out target. When non-zero, the
router calls `manager.processAmoeEntry(buyer, coin,
pointsBurnedAsUSD)` after a successful ZK submission, with the
value taken directly from `pubInputs[5]`.


```solidity
IAmoeManager public manager
```


### allowlistRootOf
Daily allowlist roots, keyed by epoch.


```solidity
mapping(uint64 => bytes32) public allowlistRootOf
```


### pointsLedgerRootOf
Daily points-burn ledger roots, keyed by epoch (one-shot).


```solidity
mapping(uint64 => bytes32) public pointsLedgerRootOf
```


### usedNonceCommit
Replay guard: nonce commitments already consumed.


```solidity
mapping(bytes32 => bool) public usedNonceCommit
```


### usedWalletCommit
Replay guard: walletAddrCommits already consumed in an epoch.

walletAddrCommit binds (wallet, twitterCreditNullifier), so a single
twitter credit can only be used once per epoch even if the wallet
reuses different nonces.


```solidity
mapping(uint64 => mapping(bytes32 => bool)) public usedWalletCommit
```


### usedPointsBurnNullifier
GLOBAL replay guard for points-burn nullifiers. Once a spend
row is consumed by an AMOE entry, it can never back another
entry, in any epoch, ever. This matches the off-chain semantic
that one `(signup_id, source='amoe_entry_spend', source_id)`
points row backs exactly one AMOE entry.


```solidity
mapping(bytes32 => bool) public usedPointsBurnNullifier
```


### nextEntryId
Monotonic entry id counter.


```solidity
uint256 public nextEntryId
```


## Functions
### constructor


```solidity
constructor(address _owner, address _allowlistPublisher, address _verifier) ;
```

### onlyOwner


```solidity
modifier onlyOwner() ;
```

### setOwner


```solidity
function setOwner(address _owner) external onlyOwner;
```

### setAllowlistPublisher


```solidity
function setAllowlistPublisher(address _publisher) external onlyOwner;
```

### setPointsLedgerPublisher

Set the publisher key for the points-burn ledger Merkle root.
Mirrors `setAllowlistPublisher`. Same scoped-KMS class.


```solidity
function setPointsLedgerPublisher(address _publisher) external onlyOwner;
```

### setVerifier


```solidity
function setVerifier(address _verifier) external onlyOwner;
```

### setConsumer


```solidity
function setConsumer(address _consumer) external onlyOwner;
```

### setManager

Set the lottery-manager fan-out target. When non-zero, the
router calls `manager.processAmoeEntry(buyer, coin,
pointsBurnedAsUSD)` after each successful ZK entry.

The manager must be configured to accept this router as its
`authorizedAmoeRelayer` for the call to succeed. That is a
one-way ops handoff (see `docs/security/amoe-pr4-handoff.md`).


```solidity
function setManager(address _manager) external onlyOwner;
```

### setAllowlistRoot

Publish the allowlist Merkle root for an epoch. One-shot per
epoch — re-publishing reverts. The publisher is expected to be
the same off-chain key that today signs AMOE messages in
`lotteryAmoe.ts`.


```solidity
function setAllowlistRoot(uint64 epoch, bytes32 root) external;
```

### setPointsLedgerRoot

Publish the points-burn ledger Merkle root for an epoch.
One-shot per epoch — re-publishing reverts. Mirrors the
allowlist publisher pattern.


```solidity
function setPointsLedgerRoot(uint64 epoch, bytes32 root) external;
```

### submitAmoeEntryZK

Submit an AMOE entry backed by a PLONK proof.

`pubInputs` MUST be in the same order as the v2 circuit's
`public [...]` declaration:
[0] walletAddrCommit
[1] creatorCoinAddr (uint160 cast)
[2] nonceCommit
[3] epoch
[4] allowlistRoot
[5] pointsBurnedAsUSD       (v2)
[6] pointsLedgerRoot        (v2)
[7] pointsBurnNullifier     (v2)
`proof` is the flat 24-element PLONK proof emitted by
`snarkjs zkey export soliditycalldata`.


```solidity
function submitAmoeEntryZK(
    address buyer,
    address creatorCoin,
    uint64 epoch,
    uint256[24] calldata proof,
    uint256[8] calldata pubInputs
) external returns (uint256 entryId);
```

### submitAmoeEntry

Settle an ECDSA / EIP-1271 verified AMOE entry. Caller MUST be
the trusted relayer (today: same key as `allowlistPublisher`).


```solidity
function submitAmoeEntry(
    address buyer,
    address creatorCoin,
    bytes32 nonce,
    uint256 deadline,
    bytes calldata /* signature */
)
    external
    returns (uint256 entryId);
```

## Events
### OwnerUpdated

```solidity
event OwnerUpdated(address indexed previous, address indexed current);
```

### AllowlistPublisherUpdated

```solidity
event AllowlistPublisherUpdated(address indexed previous, address indexed current);
```

### PointsLedgerPublisherUpdated

```solidity
event PointsLedgerPublisherUpdated(address indexed previous, address indexed current);
```

### VerifierUpdated

```solidity
event VerifierUpdated(address indexed previous, address indexed current);
```

### ConsumerUpdated

```solidity
event ConsumerUpdated(address indexed previous, address indexed current);
```

### ManagerUpdated

```solidity
event ManagerUpdated(address indexed previous, address indexed current);
```

### AllowlistRootSet

```solidity
event AllowlistRootSet(uint64 indexed epoch, bytes32 root);
```

### PointsLedgerRootSet

```solidity
event PointsLedgerRootSet(uint64 indexed epoch, bytes32 root);
```

### AmoeEntryRecorded

```solidity
event AmoeEntryRecorded(
    uint256 indexed entryId,
    address indexed buyer,
    address indexed creatorCoin,
    uint64 epoch,
    bytes32 nonceCommit,
    bytes32 walletAddrCommit,
    EntryPath path
);
```

### AmoeEntrySettled
Emitted when the router successfully fans out a ZK entry to the
lottery manager. `pointsBurnedAsUSD` is the value bound into
the PLONK proof; `managerEntryId` is the VRF id returned by
the manager (0 if the manager silently skipped).


```solidity
event AmoeEntrySettled(
    uint256 indexed entryId, bytes32 indexed pointsBurnNullifier, uint256 pointsBurnedAsUSD, uint256 managerEntryId
);
```

## Errors
### NotOwner

```solidity
error NotOwner();
```

### NotPublisher

```solidity
error NotPublisher();
```

### NotPointsLedgerPublisher

```solidity
error NotPointsLedgerPublisher();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### VerifierNotSet

```solidity
error VerifierNotSet();
```

### UnknownEpoch

```solidity
error UnknownEpoch();
```

### RootMismatch

```solidity
error RootMismatch();
```

### InvalidProof

```solidity
error InvalidProof();
```

### NonceReplayed

```solidity
error NonceReplayed();
```

### WalletCreditReplayed

```solidity
error WalletCreditReplayed();
```

### PointsBurnReplayed

```solidity
error PointsBurnReplayed();
```

### PointsLedgerEpochNotPublished

```solidity
error PointsLedgerEpochNotPublished();
```

### PointsLedgerRootMismatch

```solidity
error PointsLedgerRootMismatch();
```

### PointsLedgerEpochAlreadyPublished

```solidity
error PointsLedgerEpochAlreadyPublished();
```

### PointsValueOutOfRange

```solidity
error PointsValueOutOfRange();
```

### EpochAlreadyPublished

```solidity
error EpochAlreadyPublished();
```

### ZeroRoot

```solidity
error ZeroRoot();
```

### ManagerDeclinedEntry

```solidity
error ManagerDeclinedEntry();
```

### DeadlineExpired

```solidity
error DeadlineExpired();
```

### DeadlineTooSoon

```solidity
error DeadlineTooSoon();
```

## Enums
### EntryPath

```solidity
enum EntryPath {
    ECDSA,
    ZK
}
```

