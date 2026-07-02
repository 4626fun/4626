// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CreatorGaugeController} from "../contracts/governance/CreatorGaugeController.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockShareOFT is IERC20 {
    string public name = "Share";
    string public symbol = "SHR";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract MockVaultShares is MockShareOFT {}

contract GaugeJackpotHarness is CreatorGaugeController {
    using SafeERC20 for IERC20;

    constructor(address shareOft, address creatorTreasury, address protocolTreasury, address owner_)
        CreatorGaugeController(shareOft, creatorTreasury, protocolTreasury, owner_)
    {}

    function testFundJackpot(uint256 shares) external {
        vaultShares.safeTransferFrom(msg.sender, address(this), shares);
        jackpotReserve += shares;
    }
}

/// @notice AUDIT-2026-07-01-M02 — lottery sizing uses availableJackpotReserve; payJackpot is fail-closed.
contract CreatorGaugeControllerJackpotReservationTest is Test {
    GaugeJackpotHarness internal gauge;
    MockVaultShares internal vaultShares;
    MockShareOFT internal shareOFT;

    address internal lottery = makeAddr("lottery");
    address internal winner = makeAddr("winner");
    address internal winner2 = makeAddr("winner2");
    address internal treasury = makeAddr("treasury");
    address internal protocol = makeAddr("protocol");

    function setUp() public {
        vm.chainId(8453);

        shareOFT = new MockShareOFT();
        vaultShares = new MockVaultShares();
        gauge = new GaugeJackpotHarness(address(shareOFT), treasury, protocol, address(this));
        gauge.setVault(address(vaultShares));
        gauge.setLotteryManager(lottery);

        vaultShares.mint(address(this), 1_000 ether);
        vaultShares.approve(address(gauge), type(uint256).max);
        gauge.testFundJackpot(500 ether);
    }

    function test_availableJackpotReserve_matchesReserve() public view {
        assertEq(gauge.availableJackpotReserve(), gauge.jackpotReserve());
    }

    function test_payJackpot_decrementsReserve() public {
        vm.prank(lottery);
        gauge.payJackpot(winner, 100 ether);

        assertEq(gauge.jackpotReserve(), 400 ether);
        assertEq(vaultShares.balanceOf(winner), 100 ether);
    }

    function test_secondPayout_revertsWhenReserveInsufficient() public {
        vm.startPrank(lottery);
        gauge.payJackpot(winner, 300 ether);
        vm.expectRevert(CreatorGaugeController.InsufficientJackpot.selector);
        gauge.payJackpot(winner2, 300 ether);
        vm.stopPrank();
    }
}
