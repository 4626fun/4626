# VRF Cross-Chain Hardening Rollout (Hub + Spokes)

This rollout note covers deploying and wiring the hardened VRF hub (`CreatorVRFConsumerV2_5`) and spoke integrators (`ChainlinkVRFIntegratorV2_5`) after the cross-chain hardening changes:

- Spoke VRF requests are permissioned (including payable variants)
- Hub request keys are scoped by `(srcEid, sequence)` and `_lzReceive` is idempotent (no revert on duplicate)
- Remote price piggybacking is disabled by default and aggregation staleness uses oracle timestamps
- Hub relayer/view APIs now take `(srcEid, sequence)`

## Deploy: Spoke Integrator

Run on each spoke chain:

```bash
export PRIVATE_KEY=...
export LZ_ENDPOINT=0x...
export HUB_EID=30184
export HUB_VRF_CONSUMER=0x...   # hub CreatorVRFConsumerV2_5 address
export AUTHORIZED_CALLER=0x...  # optional: protocol contract allowed to request VRF

forge script script/DeployVRFIntegratorSpoke.s.sol:DeployVRFIntegratorSpoke \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vvvv
```

## Wire: Hub VRF Consumer for a Spoke

Run on Base (hub) for each spoke:

```bash
export PRIVATE_KEY=...
export VRF_CONSUMER=0x...        # hub CreatorVRFConsumerV2_5 address
export REMOTE_EID=30110          # spoke eid
export REMOTE_INTEGRATOR=0x...   # spoke ChainlinkVRFIntegratorV2_5 address
export REMOTE_GAS_LIMIT=200000   # optional
export MAX_REQUESTS_PER_WINDOW=10 # optional

forge script script/WireVRFHubForSpoke.s.sol:WireVRFHubForSpoke \
  --rpc-url base \
  --broadcast \
  -vvvv
```

## Verify: Read-only Checks

### Hub

```bash
cast call --rpc-url $BASE_RPC $VRF_CONSUMER "remotePriceReportingEnabled()(bool)"
cast call --rpc-url $BASE_RPC $VRF_CONSUMER "defaultMaxRequestsPerWindow()(uint64)"
cast call --rpc-url $BASE_RPC $VRF_CONSUMER "rateLimitWindowSeconds()(uint64)"
cast call --rpc-url $BASE_RPC $VRF_CONSUMER "supportedChains(uint32)(bool)" $REMOTE_EID
cast call --rpc-url $BASE_RPC $VRF_CONSUMER "peers(uint32)(bytes32)" $REMOTE_EID
```

### Spoke

```bash
cast call --rpc-url $SPOKE_RPC $INTEGRATOR "hubEid()(uint32)"
cast call --rpc-url $SPOKE_RPC $INTEGRATOR "peers(uint32)(bytes32)" $HUB_EID
cast call --rpc-url $SPOKE_RPC $INTEGRATOR "authorizedSponsoredCallers(address)(bool)" $AUTHORIZED_CALLER
```

## Verify: Economic/Spam Protections

### Spoke payable request is permissioned

From an unauthorized address, `requestRandomWordsPayable` must revert with `UnauthorizedSponsoredCaller()`:

```bash
cast send --rpc-url $SPOKE_RPC --private-key $UNAUTHORIZED_PK \
  $INTEGRATOR "requestRandomWordsPayable(uint32)" $HUB_EID \
  --value 0.01ether
```

### Hub relayer calls include srcEid

When a cross-chain request is fulfilled, the hub queues `pendingResponses(srcEid, sequence) = true`.

Relay requires `(srcEid, sequence)` and the exact quoted fee:

```bash
cast call --rpc-url $BASE_RPC $VRF_CONSUMER \
  "quotePendingResponseFee(uint32,uint64)(uint256,bool)" $SRC_EID $SEQUENCE

cast send --rpc-url $BASE_RPC --private-key $RELAYER_PK \
  $VRF_CONSUMER "relayPendingResponse(uint32,uint64)" $SRC_EID $SEQUENCE \
  --value <nativeFee>
```

## Rollback / Emergency Mitigation

If a spoke is misbehaving (buggy caller, compromised contract, or unexpected traffic), on the hub:

- Disable it: `setSupportedChain(remoteEid, false, 0)` (or set its rate limit to `0`)
- Optionally clear peer and/or set a very low `setChainRateLimit(remoteEid, 1)`

If price piggybacking is ever enabled, it can be turned off immediately via `setRemotePriceReportingEnabled(false)`.
