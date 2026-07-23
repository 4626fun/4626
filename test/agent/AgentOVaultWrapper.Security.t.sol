// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {AgentOVaultWrapper} from "@4626/agent/vault/AgentOVaultWrapper.sol";

contract MockTaxedAgentTokenForWrapper is ERC20 {
    uint256 internal constant TAX_BPS = 1_000;

    constructor() ERC20("Taxed Agent", "TAGENT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * TAX_BPS) / 10_000;
        super._update(from, to, value - fee);
        if (fee != 0) super._update(from, address(0), fee);
    }
}

contract MockAgentVaultForWrapper is ERC20 {
    ERC20 public immutable assetToken;
    uint256 public lastDepositAssets;

    constructor(address asset_) ERC20("Agent Vault Share", "avTAGENT") {
        assetToken = ERC20(asset_);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        lastDepositAssets = assets;
        assetToken.transferFrom(msg.sender, address(this), assets);
        shares = assets;
        _mint(receiver, shares);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);
        _burn(owner, shares);
        assetToken.transfer(receiver, shares);
        return shares;
    }
}

contract MockAgentShareOFTForWrapper is ERC20 {
    constructor() ERC20("Agent Share OFT", "ASOFT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

contract AgentOVaultWrapperSecurityTest is Test {
    function test_depositUsesMeasuredWrapperReceiptForTaxedToken() public {
        address alice = makeAddr("alice");
        MockTaxedAgentTokenForWrapper token = new MockTaxedAgentTokenForWrapper();
        MockAgentVaultForWrapper vault = new MockAgentVaultForWrapper(address(token));
        MockAgentShareOFTForWrapper share = new MockAgentShareOFTForWrapper();
        AgentOVaultWrapper wrapper = new AgentOVaultWrapper(address(token), address(vault), address(this));
        wrapper.setShareOFT(address(share));

        token.mint(alice, 10_000);
        vm.startPrank(alice);
        token.approve(address(wrapper), type(uint256).max);
        uint256 shareOut = wrapper.deposit(10_000, 9);
        vm.stopPrank();

        // The wrapper receives 9,000 after the first tax and must ask the vault
        // to pull exactly that amount, never the caller's nominal 10,000.
        assertEq(vault.lastDepositAssets(), 9_000);
        assertEq(token.balanceOf(address(wrapper)), 0, "wrapper surplus must not subsidize a depositor");
        assertEq(shareOut, 9);
        assertEq(share.balanceOf(alice), 9);
    }
}
