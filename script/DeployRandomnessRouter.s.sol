// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";

import {IRandomnessSource} from "../contracts/utilities/lottery/randomness/IRandomnessSource.sol";
import {RandomnessRouter} from "../contracts/utilities/lottery/randomness/RandomnessRouter.sol";
import {ChainlinkVRFAdapter, IChainlinkVRFConsumerLike}
    from "../contracts/utilities/lottery/randomness/ChainlinkVRFAdapter.sol";

/// @notice Local-caller authorization view of `CreatorVRFConsumerV2_5`.
///         The consumer's `_requestRandomWordsLocal()` reverts unless
///         `authorizedLocalCallers[msg.sender]` is true; only `owner()` can
///         flip that bit. We use this view to (a) check whether the adapter
///         is already authorized and (b) authorize it in the same broadcast
///         when the deployer happens to be the consumer's owner.
interface IChainlinkVRFConsumerAuth {
    function owner() external view returns (address);
    function authorizedLocalCallers(address) external view returns (bool);
    function setLocalCallerAuthorization(address caller, bool authorized) external;
}

/**
 * @title DeployRandomnessRouter
 * @notice Deploy `ChainlinkVRFAdapter` (wrapping the existing
 *         `CreatorVRFConsumerV2_5`) plus the `RandomnessRouter`, with the
 *         Chainlink adapter as the default source. New creator coins can
 *         later be moved to drand via `router.setSourceFor(coin, drand)`.
 *
 * @dev    Required env vars:
 *         - PRIVATE_KEY:        deployer
 *         - ROUTER_OWNER:       owner of the router (rotates default + per-coin)
 *         - CHAINLINK_CONSUMER: deployed `CreatorVRFConsumerV2_5` address.
 *
 * @dev    Optional env vars:
 *         - ALLOW_UNAUTHORIZED_ADAPTER: set to "1" to deploy even when the
 *           deployer is NOT the consumer's owner and the adapter therefore
 *           cannot be authorized in this broadcast. Default behavior is to
 *           revert, because a router whose default source is an unauthorized
 *           adapter will fail every `acquireRequest` call until the consumer's
 *           owner runs `setLocalCallerAuthorization(adapter, true)`. Use this
 *           flag only when you intend to schedule that authorization as a
 *           follow-up multisig transaction and have the calldata staged.
 *
 * @dev    Why deploy the adapter even when Chainlink VRF is the default
 *         today: the router speaks `IRandomnessSource`, and we want every
 *         coin to flow through the same shape so swapping in drand later
 *         (or any new source) is a one-line `setSourceFor` call rather
 *         than a contract redeploy.
 *
 * @dev    Usage:
 *         forge script script/DeployRandomnessRouter.s.sol:DeployRandomnessRouter \
 *             --rpc-url $BASE_RPC_URL \
 *             --broadcast \
 *             -vvvv
 */
contract DeployRandomnessRouter is Script {
    function run()
        external
        returns (ChainlinkVRFAdapter adapter, RandomnessRouter router)
    {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        address owner = vm.envAddress("ROUTER_OWNER");
        address chainlinkConsumer = vm.envAddress("CHAINLINK_CONSUMER");
        require(chainlinkConsumer != address(0), "CHAINLINK_CONSUMER not set");

        console.log("Chain ID:           ", block.chainid);
        console.log("Deployer:           ", deployer);
        console.log("Owner:              ", owner);
        console.log("Chainlink consumer: ", chainlinkConsumer);

        vm.startBroadcast(privateKey);

        adapter = new ChainlinkVRFAdapter(IChainlinkVRFConsumerLike(chainlinkConsumer));
        console.log("ChainlinkVRFAdapter:", address(adapter));

        // -------------------------------------------------------------
        // Authorize the adapter as a local caller on the VRF consumer.
        //
        // CreatorVRFConsumerV2_5.requestRandomWords() ->
        //   _requestRandomWordsLocal() reverts with `Unauthorized()` unless
        //   `authorizedLocalCallers[msg.sender]` is true. The router will
        //   call `adapter.request()` -> `consumer.requestRandomWords()` with
        //   `msg.sender == adapter`, so without this step the very first
        //   `RandomnessRouter.acquireRequest()` reverts with `request() failed`.
        //
        // Only `consumer.owner()` can flip that bit, so we can only do it
        // here when the deployer is also the consumer's owner. Otherwise we
        // either revert (default, safe) or print the exact follow-up call
        // the consumer's owner needs to make (when ALLOW_UNAUTHORIZED_ADAPTER=1).
        // -------------------------------------------------------------
        IChainlinkVRFConsumerAuth consumerAuth =
            IChainlinkVRFConsumerAuth(chainlinkConsumer);
        address consumerOwner = consumerAuth.owner();
        console.log("Consumer owner:     ", consumerOwner);

        if (consumerOwner == deployer) {
            consumerAuth.setLocalCallerAuthorization(address(adapter), true);
            console.log(
                "Authorized adapter on consumer (setLocalCallerAuthorization=true)"
            );
        } else {
            bool allowUnauthorized =
                vm.envOr("ALLOW_UNAUTHORIZED_ADAPTER", uint256(0)) == 1;
            console.log("WARNING: deployer is NOT consumer.owner().");
            console.log(
                "WARNING: adapter cannot be authorized in this broadcast."
            );
            console.log(
                "WARNING: consumer.owner() must call, on the deployed consumer:"
            );
            console.log(
                "  setLocalCallerAuthorization(<adapter>, true)"
            );
            console.log("  selector: 0x77531b2c");
            console.log("  adapter argument:", address(adapter));
            require(
                allowUnauthorized,
                "deployer != consumer.owner(); cannot authorize adapter. Set ALLOW_UNAUTHORIZED_ADAPTER=1 to deploy anyway and follow up with a multisig tx."
            );
        }

        router = new RandomnessRouter(owner, IRandomnessSource(address(adapter)));
        console.log("RandomnessRouter:   ", address(router));

        vm.stopBroadcast();

        // Post-broadcast assertion. With ALLOW_UNAUTHORIZED_ADAPTER=1 the
        // adapter may still be unauthorized; we already warned above. With
        // the default flow (deployer == consumer.owner) this must hold.
        if (consumerOwner == deployer) {
            require(
                consumerAuth.authorizedLocalCallers(address(adapter)),
                "post-deploy invariant: adapter not authorized"
            );
        }
    }
}
