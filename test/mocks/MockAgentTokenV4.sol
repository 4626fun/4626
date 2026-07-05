// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentTokenV4} from "@4626/interfaces/agent/IAgentTokenV4.sol";

/**
 * @title MockAgentTokenV4
 * @notice Configurable AgentTokenV4-style mock for unit and integration tests.
 */
contract MockAgentTokenV4 is ERC20, Ownable, IAgentTokenV4 {
    uint16 public buyTaxBps;
    uint16 public sellTaxBps;
    address public override vault;
    address public override projectTaxRecipient;
    address public override taxAccountingAdapter;
    address public override pairToken;
    address public override uniswapV2Pair;

    mapping(address => bool) public override isLiquidityPool;
    address[] internal _liquidityPools;
    mapping(address => bool) public blacklisted;

    uint256 public taxBalance;
    uint256 public override projectTaxPendingSwap;

    constructor(
        string memory name_,
        string memory symbol_,
        uint16 buyTaxBps_,
        uint16 sellTaxBps_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(buyTaxBps_ < 10_000 && sellTaxBps_ < 10_000, "tax too high");
        buyTaxBps = buyTaxBps_;
        sellTaxBps = sellTaxBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBuyTaxBps(uint16 bps) external onlyOwner {
        require(bps < 10_000, "tax too high");
        buyTaxBps = bps;
    }

    function setSellTaxBps(uint16 bps) external onlyOwner {
        require(bps < 10_000, "tax too high");
        sellTaxBps = bps;
    }

    function setVault(address v) external onlyOwner {
        vault = v;
    }

    function setProjectTaxRecipient(address recipient) external override onlyOwner {
        projectTaxRecipient = recipient;
    }

    function setTaxAccountingAdapter(address adapter) external override onlyOwner {
        taxAccountingAdapter = adapter;
    }

    function setPairToken(address token) external onlyOwner {
        pairToken = token;
    }

    function setUniswapV2Pair(address pair) external onlyOwner {
        uniswapV2Pair = pair;
    }

    function registerLiquidityPool(address pool, bool enabled) external onlyOwner {
        if (enabled && !isLiquidityPool[pool]) {
            _liquidityPools.push(pool);
        }
        isLiquidityPool[pool] = enabled;
    }

    function liquidityPools(uint256 index) external view override returns (address) {
        return _liquidityPools[index];
    }

    function setBlacklisted(address account, bool blocked) external onlyOwner {
        blacklisted[account] = blocked;
    }

    function creditTaxBalance(uint256 amount) external {
        taxBalance += amount;
        projectTaxPendingSwap = taxBalance;
    }

    function distributeTaxTokens() external override {
        require(taxBalance > 0, "no tax");
        if (projectTaxRecipient != address(0) && pairToken != address(0)) {
            _mint(projectTaxRecipient, taxBalance);
        }
        taxBalance = 0;
        projectTaxPendingSwap = 0;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && blacklisted[from]) revert("blacklisted");
        if (to != address(0) && blacklisted[to]) revert("blacklisted");

        if (from != address(0) && to != address(0) && value > 0) {
            uint16 taxBps = _effectiveTaxBps(from, to);
            if (taxBps > 0) {
                uint256 fee = (value * taxBps) / 10_000;
                uint256 sendAmount = value - fee;
                super._update(from, to, sendAmount);
                if (fee > 0) {
                    super._update(from, address(0), fee);
                    taxBalance += fee;
                    projectTaxPendingSwap = taxBalance;
                }
                return;
            }
        }

        super._update(from, to, value);
    }

    function _effectiveTaxBps(address from, address to) internal view returns (uint16) {
        if (isLiquidityPool[from]) return sellTaxBps;
        if (isLiquidityPool[to]) return buyTaxBps;
        return buyTaxBps > sellTaxBps ? buyTaxBps : sellTaxBps;
    }
}
