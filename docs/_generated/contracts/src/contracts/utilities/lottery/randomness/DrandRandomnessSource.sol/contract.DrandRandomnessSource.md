# DrandRandomnessSource
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/randomness/DrandRandomnessSource.sol)

**Inherits:**
[IRandomnessSource](/contracts/utilities/lottery/randomness/IRandomnessSource.sol/interface.IRandomnessSource.md)

**Title:**
DrandRandomnessSource

Pull-style randomness source backed by the drand "League of Entropy"
beacon (BLS12-381). Pinned to the **quicknet** chain
`52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971`
which uses scheme `bls-unchained-g1-rfc9380`.

quicknet specifics
------------------
- Group public key  pk    ∈ G2  (96 bytes compressed → 256 bytes EIP-2537)
- Round signature   σ     ∈ G1  (48 bytes compressed → 128 bytes EIP-2537)
- Message hash      H(r)  ∈ G1  (RFC 9380 hash-to-curve, BLS12-381 G1,
domain "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_")
- period            3 seconds
- genesis_time      1692803367
Verification equation: e(H(r), pk) == e(σ, g2_generator)
Rearranged for one-shot pairing:
e(H(r), pk) * e(σ, -g2_generator) == 1
Pairing input (EIP-2537 layout: each pair = G1 (128 bytes) || G2 (256 bytes)):
pair 0:  H(r)  (G1, 128)  ||  pk            (G2, 256)
pair 1:  σ     (G1, 128)  ||  -g2_generator (G2, 256)
RFC 9380 hash-to-curve (G1) has no precompile and is prohibitively
expensive in pure Solidity, so the off-chain relayer (running zkMetal
`BLS12381Engine.hashToCurveG1`) computes `H(round)` and submits it
alongside the signature. We bind (round, hashedRoundG1) via a keccak
commitment and recompute it on-chain so a malicious relayer can't
substitute an attacker-chosen message hash.
Costs (Pectra-era pricing per EIP-2537):
pairing-check(2 pairs) = 37_700 + 2 * 32_600 = 102_900 gas
total submitRound ≈ ~135k gas (incl. calldata + bookkeeping)

**Note:**
precompile: BLS12-381 pairing precompile address: 0x0f (post-Pectra,
per EIP-2537 — NOT 0x10, that's MAP_FP_TO_G1)


## Constants
### chainHash
drand chain hash this contract is pinned to (quicknet).


```solidity
bytes32 public immutable chainHash
```


### genesisTime
drand `genesis_time` (unix seconds).


```solidity
uint64 public immutable genesisTime
```


### period
drand `period` (seconds between rounds; 3 for quicknet).


```solidity
uint32 public immutable period
```


## State Variables
### groupPubKey
drand group public key in **G2**. EIP-2537 encoding: 256 bytes
(Fp2 x_c0 || x_c1 || Fp2 y_c0 || y_c1; each Fp = 64-byte BE,
padded from the 48-byte BLS12-381 base field).


```solidity
bytes public groupPubKey
```


### owner
Owner can rotate the relayer / publisher.


```solidity
address public owner
```


### isRelayer
Address allowed to submit rounds. Multiple keepers can be
authorized to avoid single-point-of-failure on liveness.


```solidity
mapping(address => bool) public isRelayer
```


### randomWordOf
round => uint256 random word = keccak256(sig)


```solidity
mapping(uint256 => uint256) public randomWordOf
```


### roundFulfilled
round => fulfilled flag


```solidity
mapping(uint256 => bool) public roundFulfilled
```


## Functions
### constructor


```solidity
constructor(address _owner, bytes32 _chainHash, uint64 _genesisTime, uint32 _period, bytes memory _groupPubKey) ;
```

### onlyOwner


```solidity
modifier onlyOwner() ;
```

### setOwner


```solidity
function setOwner(address _owner) external onlyOwner;
```

### setRelayer


```solidity
function setRelayer(address relayer, bool authorized) external onlyOwner;
```

### setGroupPubKey

Allow rotating the drand group pubkey if the network rolls over.


```solidity
function setGroupPubKey(bytes calldata _groupPubKey) external onlyOwner;
```

### mode


```solidity
function mode() external pure returns (SourceMode);
```

### isReady


```solidity
function isReady(uint256 key) external view returns (bool);
```

### randomWord


```solidity
function randomWord(uint256 key) external view returns (uint256);
```

### submitRound

Submit a drand round.


```solidity
function submitRound(uint64 round, bytes calldata sigG1, bytes calldata hashedRoundG1, bytes32 hashedRoundCommit)
    external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`round`|`uint64`|             Round number (>= 1).|
|`sigG1`|`bytes`|             128-byte EIP-2537 G1 encoding of the round signature σ (Fp x || Fp y, each 64 bytes).|
|`hashedRoundG1`|`bytes`|     128-byte EIP-2537 G1 encoding of H(round). Computed off-chain by the relayer (zkMetal `BLS12381Engine.hashToCurveG1` with drand DST `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`).|
|`hashedRoundCommit`|`bytes32`| Keccak256 commitment that binds round->H(round). Recomputed on-chain to prevent the relayer from substituting an attacker-chosen message hash.|


### _negatedG2Generator

EIP-2537 encoding of -G2_generator (BLS12-381). 256 bytes:
Fp2 x = (x_c0 || x_c1), Fp2 y = (y_c0 || y_c1). Each Fp element is
64-byte big-endian, padded from the 48-byte BLS12-381 field.
Generator G2 (per EIP-2537 / IETF BLS):
x = 0x024aa2b2f08f0a91260805272dc51051c6e47ad4fa403b02b4510b647ae3d1770bac0326a805bbefd48056c8c121bdb8
+ 0x13e02b6052719f607dacd3a088274f65596bd0d09920b61ab5da61bbdc7f5049334cf11213945d57e5ac7d055d042b7e * u
y = 0x0ce5d527727d6e118cc9cdc6da2e351aadfd9baa8cbdd3a76d429a695160d12c923ac9cc3baca289e193548608b82801
+ 0x0606c4a02ea734cc32acd2b02bc28b99cb3e287e85a763af267492ab572e99ab3f370d275cec1da1aaa9075ff05f79be * u
-y = (p - y_c0, p - y_c1) where p is the BLS12-381 base field modulus.
Computed offline and hard-coded.


```solidity
function _negatedG2Generator() internal pure returns (bytes memory);
```

### roundAt

Convenience: convert a unix timestamp to the drand round number.


```solidity
function roundAt(uint64 unixTime) external view returns (uint64);
```

## Events
### OwnerUpdated

```solidity
event OwnerUpdated(address indexed previous, address indexed current);
```

### RelayerUpdated

```solidity
event RelayerUpdated(address indexed relayer, bool authorized);
```

### GroupPubKeyUpdated

```solidity
event GroupPubKeyUpdated(bytes pubKey);
```

### RoundSubmitted

```solidity
event RoundSubmitted(uint64 indexed round, uint256 randomWord, address relayer);
```

## Errors
### NotOwner

```solidity
error NotOwner();
```

### NotRelayer

```solidity
error NotRelayer();
```

### AlreadyFulfilled

```solidity
error AlreadyFulfilled();
```

### InvalidPairing

```solidity
error InvalidPairing();
```

### InvalidRoundCommit

```solidity
error InvalidRoundCommit();
```

### PrecompileFailed

```solidity
error PrecompileFailed();
```

### InvalidLength

```solidity
error InvalidLength();
```

