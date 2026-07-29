// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

interface ICreatorOracleBroadcast {
    function broadcastAssetPriceWithFees(uint32[] calldata dstEids, bytes calldata options, uint256[] calldata fees)
        external
        payable;
    function assetPriceUSD() external view returns (int256);
    function assetPriceTimestamp() external view returns (uint256);
    function endpoint() external view returns (address);
    function peers(uint32 eid) external view returns (bytes32);
}

interface ILayerZeroEndpointV2Quote {
    struct MessagingParams {
        uint32 dstEid;
        bytes32 receiver;
        bytes message;
        bytes options;
        bool payInLzToken;
    }

    struct MessagingFee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }

    function quote(MessagingParams calldata _params, address _sender) external view returns (MessagingFee memory fee);
}

/**
 * @title BroadcastCreatorOracleAssetPrice
 * @notice From Base hub CreatorOracle, quote + broadcast asset USD price to spoke EIDs.
 *
 * @dev Does **not** use sync lzRead inside launchAuction — hub push / keeper path only.
 *      Hub `assetPriceUSD` must already be set (TWAP / updater / initialize).
 *
 * Required env:
 * - PRIVATE_KEY (oracle owner or isPriceUpdater)
 * - HUB_ORACLE
 * - DST_EIDS — comma-separated uint32 list (e.g. "30101,30110,30320,30416")
 *
 * Optional env:
 * - LZ_RECEIVE_GAS (default 200000)
 * - EXPECTED_CHAIN_ID (default 8453 Base)
 *
 * Usage:
 *   DST_EIDS=30110,30320 forge script script/BroadcastCreatorOracleAssetPrice.s.sol \
 *     --rpc-url $BASE_RPC_URL --broadcast -vvvv
 */
contract BroadcastCreatorOracleAssetPrice is Script {
    using OptionsBuilder for bytes;

    uint256 internal constant DEFAULT_BASE_CHAIN_ID = 8453;
    uint128 internal constant DEFAULT_LZ_RECEIVE_GAS = 200_000;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address hubOracle = vm.envAddress("HUB_ORACLE");
        string memory dstEidsRaw = vm.envString("DST_EIDS");
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", DEFAULT_BASE_CHAIN_ID);
        uint128 lzReceiveGas = uint128(vm.envOr("LZ_RECEIVE_GAS", uint256(DEFAULT_LZ_RECEIVE_GAS)));

        require(block.chainid == expectedChainId, "Unexpected chain id for hub broadcast");
        require(hubOracle != address(0), "HUB_ORACLE required");

        uint32[] memory dstEids = _parseEids(dstEidsRaw);
        require(dstEids.length > 0, "DST_EIDS empty");

        ICreatorOracleBroadcast o = ICreatorOracleBroadcast(hubOracle);
        int256 price = o.assetPriceUSD();
        require(price > 0, "Hub assetPriceUSD unset/invalid - seed price before broadcast");

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(lzReceiveGas, 0);
        bytes memory payload = abi.encode(price, o.assetPriceTimestamp(), _readAssetSymbol(hubOracle));

        uint256[] memory fees = new uint256[](dstEids.length);
        uint256 totalFees;
        address endpoint = o.endpoint();

        console.log("Hub oracle:     ", hubOracle);
        console.log("assetPriceUSD:  ", uint256(price));
        console.log("Destinations:   ", dstEids.length);

        for (uint256 i = 0; i < dstEids.length; i++) {
            bytes32 peer = o.peers(dstEids[i]);
            require(peer != bytes32(0), "Missing hub peer for dst EID - WireCreatorOracleHubSpokePeers first");

            ILayerZeroEndpointV2Quote.MessagingFee memory fee = ILayerZeroEndpointV2Quote(endpoint).quote(
                ILayerZeroEndpointV2Quote.MessagingParams({
                    dstEid: dstEids[i],
                    receiver: peer,
                    message: payload,
                    options: options,
                    payInLzToken: false
                }),
                hubOracle
            );
            require(fee.nativeFee > 0, "Quoted native fee is zero");
            fees[i] = fee.nativeFee;
            totalFees += fee.nativeFee;
            console.log("  eid", dstEids[i]);
            console.log("  fee", fee.nativeFee);
        }

        vm.startBroadcast(privateKey);
        // MessagingReceipt[] return type differs across LZ versions; discard via low-level call.
        (bool ok, bytes memory ret) = hubOracle.call{value: totalFees}(
            abi.encodeWithSelector(
                ICreatorOracleBroadcast.broadcastAssetPriceWithFees.selector, dstEids, options, fees
            )
        );
        require(ok, string(ret.length > 0 ? ret : bytes("broadcastAssetPriceWithFees failed")));
        vm.stopBroadcast();

        console.log("Broadcast sent. totalFees wei:", totalFees);
    }

    function _parseEids(string memory raw) internal pure returns (uint32[] memory out) {
        bytes memory b = bytes(raw);
        if (b.length == 0) return out;

        uint256 count = 1;
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] == ",") count++;
        }
        out = new uint32[](count);

        uint256 idx;
        uint256 acc;
        bool inNum;
        for (uint256 i = 0; i <= b.length; i++) {
            bytes1 c = i < b.length ? b[i] : bytes1(",");
            if (c >= "0" && c <= "9") {
                acc = acc * 10 + (uint8(c) - 48);
                inNum = true;
            } else if (c == "," || c == " " || i == b.length) {
                if (inNum) {
                    out[idx] = uint32(acc);
                    idx++;
                    acc = 0;
                    inNum = false;
                }
            } else {
                revert("Invalid DST_EIDS char");
            }
        }
        // Shrink if trailing commas produced empty slots (idx < count).
        if (idx != count) {
            uint32[] memory trimmed = new uint32[](idx);
            for (uint256 j = 0; j < idx; j++) {
                trimmed[j] = out[j];
            }
            out = trimmed;
        }
    }

    /// @dev assetSymbol is a public string; read via staticcall to avoid interface churn.
    function _readAssetSymbol(address oracle) internal view returns (string memory symbol) {
        (bool ok, bytes memory data) = oracle.staticcall(abi.encodeWithSignature("assetSymbol()"));
        require(ok && data.length >= 64, "assetSymbol() failed");
        symbol = abi.decode(data, (string));
    }
}
