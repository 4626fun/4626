// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {LibString} from "solady/utils/LibString.sol";
import {CreatorShareOFT} from "../contracts/utilities/messaging/CreatorShareOFT.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract MockRegistryForShareOFTContractURI {
    address public immutable endpoint;

    constructor(address _endpoint) {
        endpoint = _endpoint;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getLotteryManager(uint256) external pure returns (address) {
        return address(0);
    }
}

contract MockVaultWithAsset {
    address public immutable asset;

    constructor(address _asset) {
        asset = _asset;
    }
}

contract CreatorShareOFTContractURITest is Test {
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    string internal constant API_BASE = "https://api.4626.fun/v1/token/";

    address internal owner = address(0xA11CE);

    CreatorShareOFT internal shareOFT;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockRegistryForShareOFTContractURI registry = new MockRegistryForShareOFTContractURI(LZ_ENDPOINT);
        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Dog Share", "DOGE", address(registry), owner);
    }

    // Default contractURI must be a fetchable HTTPS URL so that Uniswap, DEX
    // aggregators, and wallet token-list services can resolve token metadata.
    // A `data:application/json;base64,...` blob is NOT sufficient because those
    // clients treat contractURI as a URL to fetch, not inline data to decode.
    function test_contractURI_defaultIsHttpsUrl() public view {
        string memory uri = shareOFT.contractURI();
        assertTrue(LibString.startsWith(uri, "https://"), "contractURI must start with https://");
    }

    function test_contractURI_defaultIncludesTokenAddress() public view {
        string memory uri = shareOFT.contractURI();
        string memory expected = string.concat(API_BASE, Strings.toHexString(address(shareOFT)));
        assertTrue(LibString.startsWith(uri, expected), "contractURI must embed token address");
    }

    function test_contractURI_defaultIncludesChainId() public view {
        string memory uri = shareOFT.contractURI();
        string memory chainFragment = string.concat("?chain=", Strings.toString(block.chainid));
        assertTrue(LibString.contains(uri, chainFragment), "contractURI must include chain id");
    }

    function test_contractURI_defaultPointsToMetadataEndpoint() public view {
        string memory uri = shareOFT.contractURI();
        assertTrue(LibString.contains(uri, "/metadata"), "contractURI must point to /metadata endpoint");
    }

    function test_contractURI_usesCustomURIWhenSet() public {
        string memory custom = "https://api.4626.fun/v1/token/0xdeadbeef/metadata";

        vm.prank(owner);
        shareOFT.setContractURI(custom);

        assertEq(shareOFT.contractURI(), custom);
    }

    function test_contractURI_customURIOverridesDefault() public {
        string memory before = shareOFT.contractURI();
        string memory custom = "ipfs://QmCustomMetadata";

        vm.prank(owner);
        shareOFT.setContractURI(custom);

        assertEq(shareOFT.contractURI(), custom);
        assertTrue(
            keccak256(bytes(before)) != keccak256(bytes(custom)),
            "custom URI must differ from default"
        );
    }
}
