// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {Base64} from "solady/utils/Base64.sol";
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
    string internal constant JSON_DATA_URI_PREFIX = "data:application/json;base64,";
    string internal constant API_BASE_URL = "https://api.4626.fun";

    address internal owner = address(0xA11CE);

    CreatorShareOFT internal shareOFT;

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        MockRegistryForShareOFTContractURI registry = new MockRegistryForShareOFTContractURI(LZ_ENDPOINT);
        vm.prank(owner);
        shareOFT = new CreatorShareOFT("Dog Share", "DOGE", address(registry), owner);
    }

    function test_contractURI_returnsDataURIWhenUnset() public view {
        string memory uri = shareOFT.contractURI();
        assertTrue(LibString.startsWith(uri, JSON_DATA_URI_PREFIX), "expected base64 JSON data URI");
    }

    function test_contractURI_jsonIncludesCanonicalImageUrl() public view {
        string memory json = _decodeContractJson();
        string memory image = vm.parseJsonString(json, ".image");
        assertEq(image, _expectedImageUrl("png"), "expected canonical PNG renderer url");
    }

    function test_contractURI_jsonIncludesCanonicalAnimationUrl() public view {
        string memory json = _decodeContractJson();
        string memory animationUrl = vm.parseJsonString(json, ".animation_url");
        assertEq(animationUrl, _expectedImageUrl("svg"), "expected canonical SVG renderer url");
    }

    function test_contractURI_usesCustomURIWhenSet() public {
        string memory custom = "https://api.4626.fun/v1/token/0xdeadbeef/metadata";

        vm.prank(owner);
        shareOFT.setContractURI(custom);

        assertEq(shareOFT.contractURI(), custom);
    }

    function test_contractURI_propertiesIncludeVaultAndAssetWhenAvailable() public {
        address expectedAsset = address(0xBEEF);
        MockVaultWithAsset vault = new MockVaultWithAsset(expectedAsset);

        vm.prank(owner);
        shareOFT.setVault(address(vault));

        string memory json = _decodeContractJson();

        address parsedVault = vm.parseJsonAddress(json, ".properties.vault");
        address parsedAsset = vm.parseJsonAddress(json, ".properties.asset");
        assertEq(parsedVault, address(vault), "vault property mismatch");
        assertEq(parsedAsset, expectedAsset, "asset property mismatch");
    }

    function _decodeContractJson() internal view returns (string memory) {
        string memory uri = shareOFT.contractURI();
        assertTrue(LibString.startsWith(uri, JSON_DATA_URI_PREFIX), "contractURI prefix mismatch");
        string memory base64Part = LibString.slice(uri, bytes(JSON_DATA_URI_PREFIX).length);
        return string(Base64.decode(base64Part));
    }

    function _expectedImageUrl(string memory format) internal view returns (string memory) {
        return string.concat(
            API_BASE_URL,
            "/v1/token/",
            Strings.toHexString(address(shareOFT)),
            "/image?chain=",
            Strings.toString(block.chainid),
            "&format=",
            format
        );
    }
}
