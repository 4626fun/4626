# EIP2537Probe
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/randomness/EIP2537Probe.sol)

**Title:**
EIP2537Probe

Deploy-time / runtime helper that detects whether the BLS12-381
precompiles introduced by EIP-2537 (Pectra) are live on the chain
the contract is being deployed to.

Per EIP-2537 the relevant precompile addresses are:
- 0x0b: BLS12_G1ADD       (input 256 bytes, output 128 bytes, 375 gas)
- 0x0c: BLS12_G1MSM
- 0x0d: BLS12_G2ADD       (input 512 bytes, output 256 bytes, 600 gas)
- 0x0e: BLS12_G2MSM
- 0x0f: BLS12_PAIRING_CHECK
- 0x10: BLS12_MAP_FP_TO_G1
- 0x11: BLS12_MAP_FP2_TO_G2
Note 0x10 is MAP_FP_TO_G1, **NOT** the pairing-check (a common
confusion because the older proposed numbering had pairing at 0x10).
To detect availability we probe G1ADD with two points-at-infinity
(256 bytes of zero), which is a valid encoding per EIP-2537 and
must return 128 bytes of zero (the point at infinity in G1).
On a chain without EIP-2537 the staticcall to 0x0b succeeds against
the empty account but `returndatasize` is 0 \u2014 we use that to
distinguish.


## Constants
### G1ADD
BLS12-381 G1ADD precompile address per EIP-2537.


```solidity
address internal constant G1ADD = address(0x0b)
```


### PAIRING_CHECK
BLS12-381 pairing-check precompile address per EIP-2537.


```solidity
address internal constant PAIRING_CHECK = address(0x0f)
```


## Functions
### isAvailable

Probes G1ADD with two infinity points. Returns true iff the
precompile is live and returns 128 bytes (a single G1 point).


```solidity
function isAvailable() internal view returns (bool);
```

### requireAvailable

Reverts unless EIP-2537 is live. Use this in deploy scripts:
`EIP2537Probe.requireAvailable();` before `new DrandRandomnessSource(...)`.


```solidity
function requireAvailable() internal view;
```

