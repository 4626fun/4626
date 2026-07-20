// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {IAllowanceTransfer} from "lib/universal-router/lib/permit2/src/interfaces/IAllowanceTransfer.sol";
import {IERC1155} from "lib/sudoswap-lssvm2/lib/openzeppelin-contracts/contracts/token/ERC1155/IERC1155.sol";
import {ERC20} from "lib/sudoswap-lssvm2/lib/solmate/src/tokens/ERC20.sol";

import {LSSVMRouter} from "sudoswap/LSSVMRouter.sol";
import {LSSVMPair} from "sudoswap/LSSVMPair.sol";
import {LSSVMPairFactory} from "sudoswap/LSSVMPairFactory.sol";
import {VeryFastRouter} from "sudoswap/VeryFastRouter.sol";
import {RoyaltyEngine} from "sudoswap/RoyaltyEngine.sol";
import {XykCurve} from "sudoswap/bonding-curves/XykCurve.sol";
import {CurveErrorCodes} from "sudoswap/bonding-curves/CurveErrorCodes.sol";
import {LSSVMPairERC1155ERC20} from "sudoswap/erc1155/LSSVMPairERC1155ERC20.sol";

import {AlfaClubCommands} from "contracts/other/alfaclub/universal-router/AlfaClubCommands.sol";
import {AlfaClubSudoswapAdapter} from "contracts/other/alfaclub/universal-router/AlfaClubSudoswapAdapter.sol";
import {AlfaClubUniversalRouter} from "contracts/other/alfaclub/universal-router/AlfaClubUniversalRouter.sol";

import {DeploySudoswapV2Base} from "alfaclub/contracts/script/DeploySudoswapV2Base.s.sol";
import {DeployAlfaClubUniversalRouterBase} from "alfaclub/contracts/script/DeployAlfaClubUniversalRouterBase.s.sol";

interface ICanonicalCoinbaseSmartWallet {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    function executeBatch(Call[] calldata calls) external payable;

    function isOwnerAddress(address account) external view returns (bool);
}

interface ISudoswapPairOwnership {
    function transferOwnership(address newOwner, bytes calldata data) external payable;
}

contract CanonicalCswForkSafe {
    error CallFailed(bytes reason);

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        (bool success, bytes memory output) = target.call(data);
        if (!success) revert CallFailed(output);
        return output;
    }
}

contract CanonicalCswForkSudoswapDeployHarness is DeploySudoswapV2Base {
    function runWithConfig(DeployConfig calldata config)
        external
        returns (
            RoyaltyEngine royaltyEngine,
            LSSVMPairFactory factory,
            XykCurve xykCurve,
            VeryFastRouter veryFastRouter
        )
    {
        return _run(config);
    }
}

contract CanonicalCswForkRouterDeployHarness is DeployAlfaClubUniversalRouterBase {
    function runWithConfig(DeployConfig calldata config) external returns (Deployment memory deployment) {
        deployment = _run(config);
    }
}

/**
 * @notice Fork-only proof that the real canonical CSW can seed Room 1659 from
 * its current live FriendKey/AKITA balances, revoke temporary approvals, hand the pair
 * to contract administration, and support both custom Universal Router swap
 * directions against the real production token contracts.
 * @dev Nothing is broadcast. The Sudoswap and router stack exists only inside
 * the ephemeral Base fork.
 */
contract AlfaClubSudoswapCanonicalCswBaseForkTest is Test {
    // Dedicated deterministic fork-only EOAs. The former tiny fixture keys now
    // resolve to addresses with live Base code and correctly fail deployment.
    uint256 private constant SUDOSWAP_DEPLOYER_KEY = 0xA11CE1659;
    uint256 private constant ROUTER_DEPLOYER_KEY = 0xB0B1659;

    address private constant FRIEND_KEY = 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F;
    address private constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address private constant CANONICAL_CSW = 0xAb6d5C10b03300326CD7fAb7267Ae192842967b5;
    address private constant PRIVY_OWNER = 0x858c01556EC5a8531fA4118d595430AC7fD0baF0;
    address private constant PAYER = address(0xBEEF);

    uint256 private constant ROOM_TOKEN_ID = 1659;
    // This fork proof intentionally consumes only the CSW's current live key
    // inventory. Never deal or assume historical seed balances here.
    uint256 private constant INITIAL_KEYS = 1;
    uint256 private constant INITIAL_AKITA = 50_000_000 ether;
    uint128 private constant VIRTUAL_KEY_RESERVE = 100;
    uint128 private constant VIRTUAL_AKITA_RESERVE = 200_000_000 ether;
    uint96 private constant PAIR_FEE = 0.069e18;
    uint256 private constant PAYER_AKITA = 3_000_000 ether;

    bytes32 private constant NEW_ERC1155_PAIR_TOPIC = keccak256("NewERC1155Pair(address,uint256)");

    bool private forkConfigured;
    CanonicalCswForkSafe private safe;
    LSSVMPairFactory private factory;
    XykCurve private xykCurve;
    AlfaClubSudoswapAdapter private adapter;
    AlfaClubUniversalRouter private router;
    LSSVMPairERC1155ERC20 private pair;
    IERC1155 private friendKey;
    ERC20 private akita;
    IAllowanceTransfer private permit2;

    function setUp() public {
        string memory rpcUrl = vm.envOr("BASE_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;
        vm.createSelectFork(rpcUrl);
        forkConfigured = true;

        safe = new CanonicalCswForkSafe();
        friendKey = IERC1155(FRIEND_KEY);
        akita = ERC20(AKITA);

        assertTrue(ICanonicalCoinbaseSmartWallet(CANONICAL_CSW).isOwnerAddress(PRIVY_OWNER), "live CSW owner");
        assertGe(friendKey.balanceOf(CANONICAL_CSW, ROOM_TOKEN_ID), INITIAL_KEYS, "live key supports proof");
        assertGe(akita.balanceOf(CANONICAL_CSW), INITIAL_AKITA + PAYER_AKITA, "live AKITA supports proof");

        _deployForkOnlyStack();
        _seedFromCanonicalCsw();
        _configureMarket();
        _fundAndApprovePayer();
    }

    function testCanonicalCswAssetsExecuteRealRoom1659BuyAndSell() public {
        if (!forkConfigured) return;

        assertEq(factory.owner(), address(safe), "contract owns factory");
        assertEq(adapter.owner(), address(safe), "contract owns adapter");
        assertEq(pair.owner(), address(safe), "contract owns pair");
        assertTrue(factory.isValidPair(address(pair)), "official fork pair");
        assertEq(friendKey.balanceOf(address(pair), ROOM_TOKEN_ID), INITIAL_KEYS, "real keys seeded");
        assertEq(akita.balanceOf(address(pair)), INITIAL_AKITA, "real AKITA seeded");
        assertFalse(friendKey.isApprovedForAll(CANONICAL_CSW, address(factory)), "key approval revoked");
        assertEq(akita.allowance(CANONICAL_CSW, address(factory)), 0, "AKITA approval revoked");
        assertEq(friendKey.balanceOf(CANONICAL_CSW, ROOM_TOKEN_ID), 0, "live key moved into fork pair");

        (CurveErrorCodes.Error buyError,,, uint256 buyInput,,) = pair.getBuyNFTQuote(ROOM_TOKEN_ID, 1);
        assertEq(uint256(buyError), uint256(CurveErrorCodes.Error.OK), "buy quote");
        assertGt(buyInput, 0, "positive buy input");
        assertLe(buyInput, PAYER_AKITA, "payer can afford canary buy");

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(address(pair), PAYER, 1, buyInput, true);
        vm.prank(PAYER);
        router.execute(bytes.concat(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_BUY))), inputs, block.timestamp + 1);

        assertEq(friendKey.balanceOf(PAYER, ROOM_TOKEN_ID), 1, "real Room 1659 key bought");

        (CurveErrorCodes.Error sellError,,, uint256 sellOutput,,) = pair.getSellNFTQuote(ROOM_TOKEN_ID, 1);
        assertEq(uint256(sellError), uint256(CurveErrorCodes.Error.OK), "sell quote");
        assertGt(sellOutput, 0, "positive sell output");

        uint256 payerAkitaBeforeSell = akita.balanceOf(PAYER);
        inputs[0] = abi.encode(address(pair), PAYER, 1, sellOutput, true);
        vm.prank(PAYER);
        router.execute(bytes.concat(bytes1(uint8(AlfaClubCommands.SUDOSWAP_ERC1155_SELL))), inputs, block.timestamp + 1);

        assertEq(friendKey.balanceOf(PAYER, ROOM_TOKEN_ID), 0, "real Room 1659 key sold");
        assertEq(akita.balanceOf(PAYER), payerAkitaBeforeSell + sellOutput, "real AKITA received");
    }

    function _deployForkOnlyStack() private {
        vm.deal(vm.addr(SUDOSWAP_DEPLOYER_KEY), 100 ether);
        vm.deal(vm.addr(ROUTER_DEPLOYER_KEY), 100 ether);

        CanonicalCswForkSudoswapDeployHarness sudoswapScript = new CanonicalCswForkSudoswapDeployHarness();
        (, factory, xykCurve,) = sudoswapScript.runWithConfig(
            DeploySudoswapV2Base.DeployConfig({
                privateKey: SUDOSWAP_DEPLOYER_KEY,
                factoryOwner: address(safe),
                protocolFeeRecipient: payable(address(safe)),
                protocolFeeMultiplier: 0,
                allowNonBase: false
            })
        );

        CanonicalCswForkRouterDeployHarness routerScript = new CanonicalCswForkRouterDeployHarness();
        address routerDeployer = vm.addr(ROUTER_DEPLOYER_KEY);
        DeployAlfaClubUniversalRouterBase.Deployment memory deployment = routerScript.runWithConfig(
            DeployAlfaClubUniversalRouterBase.DeployConfig({
                privateKey: ROUTER_DEPLOYER_KEY,
                expectedDeployerNonce: vm.getNonce(routerDeployer),
                factory: factory,
                xykCurve: xykCurve,
                adapterOwner: address(safe)
            })
        );
        adapter = deployment.adapter;
        router = deployment.router;
        permit2 = IAllowanceTransfer(routerScript.BASE_PERMIT2());
    }

    function _seedFromCanonicalCsw() private {
        ICanonicalCoinbaseSmartWallet.Call[] memory calls = new ICanonicalCoinbaseSmartWallet.Call[](5);
        calls[0] = _call(FRIEND_KEY, abi.encodeCall(IERC1155.setApprovalForAll, (address(factory), true)));
        calls[1] = _call(AKITA, abi.encodeCall(ERC20.approve, (address(factory), INITIAL_AKITA)));
        calls[2] = _call(
            address(factory),
            abi.encodeCall(
                LSSVMPairFactory.createPairERC1155ERC20,
                (LSSVMPairFactory.CreateERC1155ERC20PairParams({
                        token: akita,
                        nft: friendKey,
                        bondingCurve: xykCurve,
                        assetRecipient: payable(address(0)),
                        poolType: LSSVMPair.PoolType.TRADE,
                        delta: VIRTUAL_KEY_RESERVE,
                        fee: PAIR_FEE,
                        spotPrice: VIRTUAL_AKITA_RESERVE,
                        nftId: ROOM_TOKEN_ID,
                        initialNFTBalance: INITIAL_KEYS,
                        initialTokenBalance: INITIAL_AKITA
                    }))
            )
        );
        calls[3] = _call(FRIEND_KEY, abi.encodeCall(IERC1155.setApprovalForAll, (address(factory), false)));
        calls[4] = _call(AKITA, abi.encodeCall(ERC20.approve, (address(factory), 0)));

        vm.recordLogs();
        vm.prank(PRIVY_OWNER);
        ICanonicalCoinbaseSmartWallet(CANONICAL_CSW).executeBatch(calls);
        pair = LSSVMPairERC1155ERC20(payable(_pairFromLogs(vm.getRecordedLogs())));

        ICanonicalCoinbaseSmartWallet.Call[] memory transferCalls = new ICanonicalCoinbaseSmartWallet.Call[](2);
        transferCalls[0] =
            _call(address(pair), abi.encodeCall(ISudoswapPairOwnership.transferOwnership, (address(safe), bytes(""))));
        transferCalls[1] = _call(AKITA, abi.encodeCall(ERC20.transfer, (PAYER, PAYER_AKITA)));
        vm.prank(PRIVY_OWNER);
        ICanonicalCoinbaseSmartWallet(CANONICAL_CSW).executeBatch(transferCalls);
    }

    function _configureMarket() private {
        safe.execute(
            address(adapter),
            abi.encodeCall(AlfaClubSudoswapAdapter.setMarket, (address(pair), AKITA, ROOM_TOKEN_ID, true))
        );
        (bool adapterAllowed,) = factory.routerStatus(LSSVMRouter(payable(address(adapter))));
        assertFalse(adapterAllowed, "direct path does not require factory router allowlist");
    }

    function _fundAndApprovePayer() private {
        vm.startPrank(PAYER);
        assertTrue(akita.approve(address(permit2), type(uint256).max), "approve Permit2");
        permit2.approve(AKITA, address(adapter), type(uint160).max, type(uint48).max);
        friendKey.setApprovalForAll(address(adapter), true);
        vm.stopPrank();
    }

    function _call(address target, bytes memory data)
        private
        pure
        returns (ICanonicalCoinbaseSmartWallet.Call memory call_)
    {
        call_ = ICanonicalCoinbaseSmartWallet.Call({target: target, value: 0, data: data});
    }

    function _pairFromLogs(Vm.Log[] memory entries) private view returns (address pairAddress) {
        for (uint256 i; i < entries.length; ++i) {
            if (
                entries[i].emitter == address(factory) && entries[i].topics.length == 2
                    && entries[i].topics[0] == NEW_ERC1155_PAIR_TOPIC
            ) {
                pairAddress = address(uint160(uint256(entries[i].topics[1])));
                break;
            }
        }
        assertNotEq(pairAddress, address(0), "NewERC1155Pair emitted");
    }
}
