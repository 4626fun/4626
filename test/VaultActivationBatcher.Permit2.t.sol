// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VaultActivationBatcher} from "../contracts/helpers/batchers/VaultActivationBatcher.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

contract MockERC20Mintable is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPermit2 is ISignatureTransfer {
    address internal immutable expectedToken;

    address public lastOwner;
    address public lastTo;
    uint256 public lastRequestedAmount;
    bytes public lastSignature;

    constructor(address token_) {
        expectedToken = token_;
    }

    function DOMAIN_SEPARATOR() external pure override returns (bytes32) {
        return bytes32(uint256(1));
    }

    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external override {
        require(permit.permitted.token == expectedToken, "unexpected token");
        require(transferDetails.requestedAmount <= permit.permitted.amount, "amount exceeds permit");

        lastOwner = owner;
        lastTo = transferDetails.to;
        lastRequestedAmount = transferDetails.requestedAmount;
        lastSignature = signature;

        IERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    function permitWitnessTransferFrom(
        PermitTransferFrom calldata,
        SignatureTransferDetails calldata,
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external pure override {
        revert("unused");
    }

    function permitTransferFrom(
        PermitBatchTransferFrom calldata,
        SignatureTransferDetails[] calldata,
        address,
        bytes calldata
    ) external pure override {
        revert("unused");
    }

    function permitWitnessTransferFrom(
        PermitBatchTransferFrom calldata,
        SignatureTransferDetails[] calldata,
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external pure override {
        revert("unused");
    }

    function invalidateUnorderedNonces(uint256, uint256) external pure override {
        revert("unused");
    }

    function nonceBitmap(address, uint256) external pure override returns (uint256) {
        return 0;
    }
}

contract MockVault is ERC20 {
    IERC20 internal immutable creatorToken;
    address internal immutable vaultOwner;
    mapping(address => mapping(uint256 => bool)) internal operatorPermissions;

    constructor(address creatorToken_, address owner_) ERC20("Mock Vault Share", "ovMOCK") {
        creatorToken = IERC20(creatorToken_);
        vaultOwner = owner_;
    }

    function owner() external view returns (address) {
        return vaultOwner;
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        creatorToken.transferFrom(msg.sender, address(this), assets);
        _mint(receiver, assets);
        return assets;
    }

    function setAuthorizedOperator(address operator, uint256 perm, bool allowed) external {
        operatorPermissions[operator][perm] = allowed;
    }

    function isAuthorizedOperator(address exec, uint256 perm) external view returns (bool) {
        return operatorPermissions[exec][perm];
    }
}

contract MockWrapper {
    IERC20 internal immutable vaultShares;
    MockERC20Mintable internal immutable wrappedShares;

    constructor(address vaultShares_, address wrappedShares_) {
        vaultShares = IERC20(vaultShares_);
        wrappedShares = MockERC20Mintable(wrappedShares_);
    }

    function wrap(uint256 amount) external returns (uint256 shareTokens) {
        vaultShares.transferFrom(msg.sender, address(this), amount);
        wrappedShares.mint(msg.sender, amount);
        return amount;
    }

    function shareOFT() external view returns (address) {
        return address(wrappedShares);
    }
}

contract MockCCAStrategy {
    IERC20 internal immutable shareToken;
    uint128 public lastRequiredRaise;
    uint256 public constant DEFAULT_FLOOR_PRICE = 1e15;

    constructor(address shareToken_) {
        shareToken = IERC20(shareToken_);
    }

    function defaultFloorPrice() external pure returns (uint256) {
        return DEFAULT_FLOOR_PRICE;
    }

    function launchAuctionSimple(uint256 amount, uint128 requiredRaise) external returns (address auction) {
        lastRequiredRaise = requiredRaise;
        shareToken.transferFrom(msg.sender, address(this), amount);
        return address(this);
    }

    function launchAuction(uint256 amount, uint256, uint128 requiredRaise, bytes calldata) external returns (address auction) {
        lastRequiredRaise = requiredRaise;
        shareToken.transferFrom(msg.sender, address(this), amount);
        return address(this);
    }
}

contract VaultActivationBatcherPermit2Test is Test {
    uint256 internal constant OP_ACTIVATE = 1 << 2;

    address internal identity = makeAddr("identity");
    address internal operator = makeAddr("operator");

    MockERC20Mintable internal creatorToken;
    MockERC20Mintable internal shareToken;
    MockVault internal vault;
    MockWrapper internal wrapper;
    MockCCAStrategy internal strategy;
    MockPermit2 internal permit2;
    VaultActivationBatcher internal batcher;

    function setUp() public {
        creatorToken = new MockERC20Mintable("Creator Coin", "CR8R");
        shareToken = new MockERC20Mintable("Wrapped Share", "wSHARE");
        vault = new MockVault(address(creatorToken), identity);
        wrapper = new MockWrapper(address(vault), address(shareToken));
        strategy = new MockCCAStrategy(address(shareToken));
        permit2 = new MockPermit2(address(creatorToken));
        batcher = new VaultActivationBatcher(address(permit2));

        creatorToken.mint(identity, 1_000_000e18);
        creatorToken.mint(operator, 1_000_000e18);

        vm.prank(identity);
        creatorToken.approve(address(permit2), type(uint256).max);
        vm.prank(operator);
        creatorToken.approve(address(permit2), type(uint256).max);
    }

    function test_batchActivateWithPermit2For_pullsIdentityFunds_and_returnsRemainderToIdentity() external {
        uint256 depositAmount = 100e18;
        uint8 auctionPercent = 25;
        uint128 requiredRaise = 2 ether;

        ISignatureTransfer.PermitTransferFrom memory permit = _permit(address(creatorToken), depositAmount);

        vm.prank(identity);
        address auction = batcher.batchActivateWithPermit2For(
            identity,
            address(creatorToken),
            address(vault),
            address(wrapper),
            address(strategy),
            depositAmount,
            auctionPercent,
            requiredRaise,
            permit,
            hex"1234"
        );

        assertEq(auction, address(strategy));
        assertEq(creatorToken.balanceOf(address(vault)), depositAmount);
        assertEq(shareToken.balanceOf(identity), 75e18);
        assertEq(shareToken.balanceOf(address(strategy)), 25e18);
        assertEq(shareToken.balanceOf(address(batcher)), 0);
        assertEq(permit2.lastOwner(), identity);
        assertEq(permit2.lastTo(), address(batcher));
        assertEq(permit2.lastRequestedAmount(), depositAmount);
        assertEq(strategy.lastRequiredRaise(), requiredRaise);
    }

    function test_batchActivateWithPermit2For_reverts_whenPermitTokenMismatchesCreatorToken() external {
        uint256 depositAmount = 100e18;
        ISignatureTransfer.PermitTransferFrom memory permit = _permit(makeAddr("wrong-token"), depositAmount);

        vm.prank(identity);
        vm.expectRevert(VaultActivationBatcher.PermitTokenMismatch.selector);
        batcher.batchActivateWithPermit2For(
            identity,
            address(creatorToken),
            address(vault),
            address(wrapper),
            address(strategy),
            depositAmount,
            10,
            1 ether,
            permit,
            hex"1234"
        );
    }

    function test_batchActivateWithPermit2For_reverts_whenPermitAmountBelowDepositAmount() external {
        uint256 depositAmount = 100e18;
        ISignatureTransfer.PermitTransferFrom memory permit = _permit(address(creatorToken), depositAmount - 1);

        vm.prank(identity);
        vm.expectRevert(VaultActivationBatcher.PermitAmountTooLow.selector);
        batcher.batchActivateWithPermit2For(
            identity,
            address(creatorToken),
            address(vault),
            address(wrapper),
            address(strategy),
            depositAmount,
            10,
            1 ether,
            permit,
            hex"1234"
        );
    }

    function test_batchActivateWithPermit2For_reverts_whenOperatorNotAuthorized() external {
        uint256 depositAmount = 100e18;
        ISignatureTransfer.PermitTransferFrom memory permit = _permit(address(creatorToken), depositAmount);

        vm.prank(operator);
        vm.expectRevert(VaultActivationBatcher.NotAuthorizedOperator.selector);
        batcher.batchActivateWithPermit2For(
            identity,
            address(creatorToken),
            address(vault),
            address(wrapper),
            address(strategy),
            depositAmount,
            10,
            1 ether,
            permit,
            hex"1234"
        );
    }

    function test_batchActivateWithPermit2For_allowsAuthorizedOperator_and_returnsSharesToIdentity() external {
        uint256 depositAmount = 80e18;
        ISignatureTransfer.PermitTransferFrom memory permit = _permit(address(creatorToken), depositAmount);

        vault.setAuthorizedOperator(operator, OP_ACTIVATE, true);

        vm.prank(operator);
        batcher.batchActivateWithPermit2For(
            identity,
            address(creatorToken),
            address(vault),
            address(wrapper),
            address(strategy),
            depositAmount,
            0,
            0,
            permit,
            hex"5678"
        );

        assertEq(shareToken.balanceOf(identity), depositAmount);
        assertEq(shareToken.balanceOf(operator), 0);
        assertEq(permit2.lastOwner(), identity);
    }

    function test_batchActivateWithPermit2FromOperatorWithReserve_reverts_whenReserveRecipientNotIdentity() external {
        uint256 depositAmount = 80e18;
        ISignatureTransfer.PermitTransferFrom memory permit = _permit(address(creatorToken), depositAmount);
        vault.setAuthorizedOperator(operator, OP_ACTIVATE, true);

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultActivationBatcher.InvalidReserveRecipient.selector, identity, operator
            )
        );
        batcher.batchActivateWithPermit2FromOperatorWithReserve(
            identity,
            address(creatorToken),
            address(vault),
            address(wrapper),
            address(strategy),
            depositAmount,
            25,
            25,
            operator,
            1 ether,
            permit,
            hex"9999"
        );
    }

    function _permit(address token, uint256 amount)
        internal
        view
        returns (ISignatureTransfer.PermitTransferFrom memory permit)
    {
        permit.permitted = ISignatureTransfer.TokenPermissions({token: token, amount: amount});
        permit.nonce = 1;
        permit.deadline = block.timestamp + 1 days;
    }
}
