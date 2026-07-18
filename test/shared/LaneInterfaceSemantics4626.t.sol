// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {AgentGaugeController} from "@4626/agent/revenue/AgentGaugeController.sol";
import {CreatorGaugeController} from "@4626/creator/revenue/CreatorGaugeController.sol";
import {CreatorShareOFT} from "@4626/creator/vault/CreatorShareOFT.sol";
import {AgentShareOFT} from "@4626/agent/vault/AgentShareOFT.sol";
import {CreatorPayoutRouter} from "@4626/creator/revenue/CreatorPayoutRouter.sol";
import {IShareOFT4626} from "@4626/shared/interfaces/vault/IShareOFT4626.sol";
import {ITradeFeeCollector4626} from
    "@4626/shared/interfaces/revenue/ITradeFeeCollector4626.sol";

contract MockShareOftToken is ERC20 {
    constructor() ERC20("Mock Share", unicode"m■") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockLzEndpoint {
    function setDelegate(address) external {}
    function delegate() external view returns (address) {
        return address(0);
    }
}

contract MockShareOftRegistry {
    address public immutable endpoint;
    address public immutable lotteryManager;

    constructor(address endpoint_, address lotteryManager_) {
        endpoint = endpoint_;
        lotteryManager = lotteryManager_;
    }

    function getLayerZeroEndpoint(uint256) external view returns (address) {
        return endpoint;
    }

    function getEidForChainId(uint256) external pure returns (uint32) {
        return 30_184;
    }

    function getLotteryManager() external view returns (address) {
        return lotteryManager;
    }
}

contract LaneInterfaceSemantics4626Test is Test {
    address internal constant OWNER = address(0xB17C4);
    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    function setUp() public {
        vm.chainId(8453);
        vm.etch(LZ_ENDPOINT, address(new MockLzEndpoint()).code);
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(OWNER));
    }

    function _deployShareOfts() internal returns (CreatorShareOFT creatorOft, AgentShareOFT agentOft) {
        MockShareOftRegistry registry = new MockShareOftRegistry(LZ_ENDPOINT, address(0x1077));
        vm.prank(OWNER);
        creatorOft = new CreatorShareOFT("Creator Shares", unicode"■TEST", address(registry), OWNER);
        vm.prank(OWNER);
        agentOft = new AgentShareOFT("Agent Shares", unicode"◆TEST", address(registry), OWNER);
    }

    function testTradeFeeCollectorFallsBackToOwnerBeforeGaugeWiring() public {
        (CreatorShareOFT creatorOft, AgentShareOFT agentOft) = _deployShareOfts();

        assertEq(IShareOFT4626(address(creatorOft)).tradeFeeCollector(), OWNER);
        assertEq(IShareOFT4626(address(agentOft)).tradeFeeCollector(), OWNER);

        address gauge = address(0x6A6E);
        vm.startPrank(OWNER);
        creatorOft.setGaugeController(gauge);
        agentOft.setGaugeController(gauge);
        vm.stopPrank();

        assertEq(IShareOFT4626(address(creatorOft)).tradeFeeCollector(), gauge);
        assertEq(IShareOFT4626(address(agentOft)).tradeFeeCollector(), gauge);
    }

    function testSetHubConfigThirdArgIsHubGaugeReceiver() public {
        (CreatorShareOFT creatorOft, AgentShareOFT agentOft) = _deployShareOfts();

        address hubGauge = address(0xA11CE);
        vm.startPrank(OWNER);
        // On Base the ShareOFT must remain hub; the third arg still stores hubGaugeReceiver.
        creatorOft.setHubConfig(true, 0, hubGauge);
        agentOft.setHubConfig(true, 0, hubGauge);
        vm.stopPrank();

        assertEq(creatorOft.hubGaugeReceiver(), hubGauge);
        assertEq(agentOft.hubGaugeReceiver(), hubGauge);
        assertTrue(creatorOft.isHub());
        assertTrue(agentOft.isHub());
    }

    function testLotteryManagerUpdatesAreTimelockedAfterFirstSet_BothLanes() public {
        MockShareOftToken share = new MockShareOftToken();
        AgentGaugeController agentGauge =
            new AgentGaugeController(address(share), address(0), address(this), address(this));
        CreatorGaugeController creatorGauge =
            new CreatorGaugeController(address(share), address(0), address(this), address(this));

        address firstManager = address(0x1111);
        address secondManager = address(0x2222);

        ITradeFeeCollector4626(address(agentGauge)).setLotteryManager(firstManager);
        ITradeFeeCollector4626(address(creatorGauge)).setLotteryManager(firstManager);
        assertEq(address(agentGauge.lotteryManager()), firstManager);
        assertEq(address(creatorGauge.lotteryManager()), firstManager);

        // ODA-424-M2: Creator matches Agent — reassignment queues, does not apply instantly.
        ITradeFeeCollector4626(address(creatorGauge)).setLotteryManager(secondManager);
        assertEq(address(creatorGauge.lotteryManager()), firstManager);
        assertEq(address(creatorGauge.pendingLotteryManager()), secondManager);
        assertGt(creatorGauge.pendingLotteryManagerAt(), block.timestamp);

        ITradeFeeCollector4626(address(agentGauge)).setLotteryManager(secondManager);
        assertEq(address(agentGauge.lotteryManager()), firstManager);
        assertEq(address(agentGauge.pendingLotteryManager()), secondManager);
        assertGt(agentGauge.pendingLotteryManagerAt(), block.timestamp);

        vm.warp(agentGauge.pendingLotteryManagerAt());
        agentGauge.executeLotteryManagerUpdate();
        creatorGauge.executeLotteryManagerUpdate();
        assertEq(address(agentGauge.lotteryManager()), secondManager);
        assertEq(address(creatorGauge.lotteryManager()), secondManager);
    }

    function testCreatorRouterKeepsSpendCapSurfaceAgentDoesNot() public pure {
        assertTrue(CreatorPayoutRouter.setKeeperExternalSpendCap.selector != bytes4(0));
        assertTrue(
            bytes4(keccak256("setKeeperExternalSpendCap(address,uint256,uint64)"))
                == CreatorPayoutRouter.setKeeperExternalSpendCap.selector
        );
    }
}
