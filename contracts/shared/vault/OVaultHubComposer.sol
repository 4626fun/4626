// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {IOVaultComposer} from "@4626/shared/interfaces/vault/IOVaultComposer.sol";
import {ILayerZeroComposer} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";

interface IOVaultWrapperComposer {
    function vault() external view returns (address);
    function shareOFT() external view returns (address);
    function depositFor(uint256 amount, uint256 minOut, address beneficiary) external returns (uint256 shareOFTOut);
    function withdrawFor(uint256 amount, uint256 minOut, address beneficiary) external returns (uint256 assetOut);
    // FIX: C-1 — expose operator check so configureTokenMesh can verify
    function isBeneficiaryOperator(address operator) external view returns (bool);
}

interface IERC4626AssetLike {
    function asset() external view returns (address);
}

/**
 * @title OVaultHubComposer
 * @notice Base-side LayerZero compose receiver for cross-chain deposit/redeem intents.
 * @dev The destination OFT credits tokens to this contract first, then EndpointV2 calls
 *      `lzCompose`. This contract executes wrapper deposit/withdraw and enforces strict
 *      balance-delta invariants so a compose packet can never spend or mint more than
 *      the packet-provided OFT amount.
 */
contract OVaultHubComposer is ILayerZeroComposer, IOVaultComposer, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20;

    uint8 public constant ACTION_DEPOSIT = 1;
    uint8 public constant ACTION_REDEEM = 2;

    IRegistry4626 public immutable registry;
    address public immutable endpoint;

    struct TokenMesh {
        address vault;
        address assetMeshToken;
        address shareMeshToken;
        uint32 solanaEid;
        bytes32 solanaAssetPeer;
        bytes32 solanaSharePeer;
        bool paused;
    }

    mapping(address => TokenMesh) internal tokenMeshes;
    mapping(address => bool) public allowedComposeSenders;

    event ComposeSenderAllowed(address indexed sender, bool allowed);
    event TokenMeshConfigured(
        address indexed token,
        address indexed vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer
    );
    event TokenMeshPaused(address indexed token, bool paused);
    event DepositComposed(
        bytes32 indexed guid,
        address indexed sourceOft,
        address indexed receiver,
        address token,
        address wrapper,
        uint256 assetsIn,
        uint256 sharesOut,
        uint32 srcEid,
        address composeFrom
    );
    event RedeemComposed(
        bytes32 indexed guid,
        address indexed sourceOft,
        address indexed receiver,
        address token,
        address wrapper,
        uint256 sharesIn,
        uint256 assetsOut,
        uint32 srcEid,
        address composeFrom
    );

    error OnlyEndpoint();
    error ZeroAddress();
    error ZeroAmount();
    error SenderNotAllowed(address sender);
    error UnknownAction(uint8 action);
    error SourceOftMismatch(address expected, address actual);
    error CanonicalShareOftMismatch(address expected, address actual);
    error WrapperMismatch(address expected, address actual);
    error WrapperTokenMismatch(address expected, address actual);
    error WrapperShareOftMismatch(address expected, address actual);
    error TokenMeshPausedError(address token);
    error TokenMeshVaultMismatch(address expected, address actual);
    error TokenMeshAssetTokenMismatch(address expected, address actual);
    error TokenMeshShareTokenMismatch(address expected, address actual);
    error TokenMeshSrcEidMismatch(uint32 expected, uint32 actual);
    error TokenMeshPeerMismatch(bytes32 expected, bytes32 actual);
    // FIX: C-1 — require composer is registered as beneficiary operator on wrapper
    error ComposerNotBeneficiaryOperator(address composer, address wrapper);
    // FIX: C-2 — require mesh configuration before allowing compose
    error TokenMeshNotConfigured(address token);
    // FIX: L-7 — prevent receiver == address(this) locking shares in composer
    error ReceiverIsComposer();
    error InsufficientComposerBalance(address token, uint256 available, uint256 requiredAmount);
    error InputSpendInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance, uint256 expectedSpend);
    error OutputMintInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance, uint256 expectedMint);
    error ResidualBalanceInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance);
    // FIX: OZ-Critical — ETH rescue error
    error ETHTransferFailed();
    error ComposeRescueDisabled();
    error RescueExceedsReservedBalance(address token, uint256 freeBalance, uint256 requested);

    /// @dev FIX: AUDIT-2026-07-01-M12 — owner rescue only when explicitly enabled and
    ///      cannot withdraw tokens reserved for tracked compose liabilities.
    bool public composeRescueEnabled;
    mapping(address => uint256) public composeReservedBalances;

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_registry == address(0) || _owner == address(0)) revert ZeroAddress();
        registry = IRegistry4626(_registry);
        address resolvedEndpoint = IRegistry4626(_registry).getLayerZeroEndpoint(block.chainid);
        if (resolvedEndpoint == address(0)) revert ZeroAddress();
        endpoint = resolvedEndpoint;
    }

    /// @notice Rescue ETH trapped in the composer from payable lzCompose calls.
    /// @dev lzCompose is payable per ILayerZeroComposer interface; ETH sent with compose
    ///      messages accumulates here with no other withdrawal path.
    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert ETHTransferFailed();
    }

    /// @notice Rescue ERC-20 tokens stuck after a failed compose delivery.
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        if (!composeRescueEnabled) revert ComposeRescueDisabled();
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 reserved = composeReservedBalances[token];
        uint256 freeBalance = balance > reserved ? balance - reserved : 0;
        if (amount > freeBalance) revert RescueExceedsReservedBalance(token, freeBalance, amount);
        IERC20(token).safeTransfer(to, amount);
    }

    function setComposeRescueEnabled(bool enabled) external onlyOwner {
        composeRescueEnabled = enabled;
    }

    /// @notice Record compose liability after a failed/stuck delivery is identified operationally.
    function setComposeReservedBalance(address token, uint256 amount) external onlyOwner {
        composeReservedBalances[token] = amount;
    }

    function setAllowedComposeSender(address sender, bool allowed) external onlyOwner {
        if (sender == address(0)) revert ZeroAddress();
        allowedComposeSenders[sender] = allowed;
        emit ComposeSenderAllowed(sender, allowed);
    }

    function configureTokenMesh(
        address token,
        address vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer
    ) external override onlyOwner {
        if (
            token == address(0) || vault == address(0) || assetMeshToken == address(0) || shareMeshToken == address(0)
        ) {
            revert ZeroAddress();
        }
        if (solanaAssetPeer == bytes32(0) || solanaSharePeer == bytes32(0)) revert ZeroAddress();
        // FIX: C-1 — verify composer is registered as beneficiary operator on the wrapper
        // before allowing mesh configuration; prevents permanent compose DoS
        address wrapper = registry.getWrapperForToken(token);
        if (wrapper != address(0) && !IOVaultWrapperComposer(wrapper).isBeneficiaryOperator(address(this))) {
            revert ComposerNotBeneficiaryOperator(address(this), wrapper);
        }
        tokenMeshes[token] = TokenMesh({
            vault: vault,
            assetMeshToken: assetMeshToken,
            shareMeshToken: shareMeshToken,
            solanaEid: solanaEid,
            solanaAssetPeer: solanaAssetPeer,
            solanaSharePeer: solanaSharePeer,
            paused: false
        });
        emit TokenMeshConfigured(
            token, vault, assetMeshToken, shareMeshToken, solanaEid, solanaAssetPeer, solanaSharePeer
        );
    }

    function pauseTokenMesh(address token, bool paused) external override onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        tokenMeshes[token].paused = paused;
        emit TokenMeshPaused(token, paused);
    }

    function tokenMesh(address token)
        external
        view
        override
        returns (
            address vault,
            address assetMeshToken,
            address shareMeshToken,
            uint32 solanaEid,
            bytes32 solanaAssetPeer,
            bytes32 solanaSharePeer,
            bool paused
        )
    {
        TokenMesh memory mesh = tokenMeshes[token];
        return (
            mesh.vault,
            mesh.assetMeshToken,
            mesh.shareMeshToken,
            mesh.solanaEid,
            mesh.solanaAssetPeer,
            mesh.solanaSharePeer,
            mesh.paused
        );
    }

    function lzCompose(
        address _from,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable override nonReentrant {
        (_executor, _extraData); // executor metadata is intentionally unused in this composer.

        if (msg.sender != endpoint) revert OnlyEndpoint();
        if (!allowedComposeSenders[_from]) revert SenderNotAllowed(_from);

        uint256 amountIn = OFTComposeMsgCodec.amountLD(_message);
        if (amountIn == 0) revert ZeroAmount();

        bytes memory composeMsg = OFTComposeMsgCodec.composeMsg(_message);
        (uint8 action, address token, address wrapper, address receiver, address sourceOft, uint256 minOut) =
            abi.decode(composeMsg, (uint8, address, address, address, address, uint256));

        if (token == address(0) || wrapper == address(0) || receiver == address(0) || sourceOft == address(0)) {
            revert ZeroAddress();
        }
        // FIX: L-7 — prevent shares/assets from being locked in the composer
        if (receiver == address(this)) revert ReceiverIsComposer();
        // FIX: M-2 — reject zero minOut to prevent sandwich attacks on cross-chain deposits/redeems
        if (minOut == 0) revert ZeroAmount();
        if (sourceOft != _from) revert SourceOftMismatch(sourceOft, _from);

        address shareOft = _validateTokenBindings(token, wrapper);
        bytes32 composeFromBytes32 = OFTComposeMsgCodec.composeFrom(_message);
        address composeFrom = OFTComposeMsgCodec.bytes32ToAddress(composeFromBytes32);
        uint32 srcEid = OFTComposeMsgCodec.srcEid(_message);
        _enforceMeshInvariants({
            action: action,
            token: token,
            sourceOft: _from,
            srcEid: srcEid,
            composeFrom: composeFromBytes32
        });

        if (action == ACTION_DEPOSIT) {
            uint256 sharesOut = _composeDeposit(token, shareOft, wrapper, receiver, amountIn, minOut);
            emit DepositComposed(
                _guid, _from, receiver, token, wrapper, amountIn, sharesOut, srcEid, composeFrom
            );
            return;
        }

        if (action == ACTION_REDEEM) {
            if (_from != shareOft) revert CanonicalShareOftMismatch(shareOft, _from);
            uint256 assetsOut = _composeRedeem(token, shareOft, wrapper, receiver, amountIn, minOut);
            emit RedeemComposed(
                _guid, _from, receiver, token, wrapper, amountIn, assetsOut, srcEid, composeFrom
            );
            return;
        }

        revert UnknownAction(action);
    }

    function _composeDeposit(
        address token,
        address shareOft,
        address wrapper,
        address receiver,
        uint256 amountIn,
        uint256 minSharesOut
    ) internal returns (uint256 sharesOut) {
        IERC20 asset = IERC20(token);
        IERC20 share = IERC20(shareOft);

        uint256 assetBefore = asset.balanceOf(address(this));
        if (assetBefore < amountIn) {
            revert InsufficientComposerBalance(token, assetBefore, amountIn);
        }
        uint256 shareBefore = share.balanceOf(address(this));

        asset.forceApprove(wrapper, amountIn);
        sharesOut = IOVaultWrapperComposer(wrapper).depositFor(amountIn, minSharesOut, receiver);
        asset.forceApprove(wrapper, 0);

        uint256 assetAfter = asset.balanceOf(address(this));
        if (assetAfter + amountIn != assetBefore) {
            revert InputSpendInvariantFailed(token, assetBefore, assetAfter, amountIn);
        }

        uint256 shareAfterMint = share.balanceOf(address(this));
        if (shareBefore + sharesOut != shareAfterMint) {
            revert OutputMintInvariantFailed(shareOft, shareBefore, shareAfterMint, sharesOut);
        }

        share.safeTransfer(receiver, sharesOut);
        uint256 shareAfterTransfer = share.balanceOf(address(this));
        if (shareAfterTransfer != shareBefore) {
            revert ResidualBalanceInvariantFailed(shareOft, shareBefore, shareAfterTransfer);
        }
    }

    function _composeRedeem(
        address token,
        address shareOft,
        address wrapper,
        address receiver,
        uint256 amountIn,
        uint256 minAssetsOut
    ) internal returns (uint256 assetsOut) {
        IERC20 asset = IERC20(token);
        IERC20 share = IERC20(shareOft);

        uint256 shareBefore = share.balanceOf(address(this));
        if (shareBefore < amountIn) {
            revert InsufficientComposerBalance(shareOft, shareBefore, amountIn);
        }
        uint256 assetBefore = asset.balanceOf(address(this));

        share.forceApprove(wrapper, amountIn);
        assetsOut = IOVaultWrapperComposer(wrapper).withdrawFor(amountIn, minAssetsOut, receiver);
        share.forceApprove(wrapper, 0);

        uint256 shareAfterBurn = share.balanceOf(address(this));
        if (shareAfterBurn + amountIn != shareBefore) {
            revert InputSpendInvariantFailed(shareOft, shareBefore, shareAfterBurn, amountIn);
        }

        uint256 assetAfterMint = asset.balanceOf(address(this));
        if (assetBefore + assetsOut != assetAfterMint) {
            revert OutputMintInvariantFailed(token, assetBefore, assetAfterMint, assetsOut);
        }

        asset.safeTransfer(receiver, assetsOut);
        uint256 assetAfterTransfer = asset.balanceOf(address(this));
        if (assetAfterTransfer != assetBefore) {
            revert ResidualBalanceInvariantFailed(token, assetBefore, assetAfterTransfer);
        }
    }

    function _validateTokenBindings(address token, address wrapper) internal view returns (address shareOft) {
        address expectedWrapper = registry.getWrapperForToken(token);
        if (expectedWrapper != wrapper) revert WrapperMismatch(expectedWrapper, wrapper);

        // Lane-neutral: resolve the wrapper's deposit token via its vault's ERC-4626 asset()
        // (works for both CreatorOVaultWrapper.creatorCoin and AgentOVaultWrapper.agentToken).
        address wrapperAsset = IERC4626AssetLike(IOVaultWrapperComposer(wrapper).vault()).asset();
        if (wrapperAsset != token) revert WrapperTokenMismatch(token, wrapperAsset);

        shareOft = registry.getShareOFTForToken(token);
        address wrapperShare = IOVaultWrapperComposer(wrapper).shareOFT();
        if (wrapperShare != shareOft) revert WrapperShareOftMismatch(shareOft, wrapperShare);
    }

    function _enforceMeshInvariants(
        uint8 action,
        address token,
        address sourceOft,
        uint32 srcEid,
        bytes32 composeFrom
    ) internal view {
        TokenMesh memory mesh = tokenMeshes[token];
        // FIX: C-2 — require explicit mesh config; legacy bypass allowed unconfigured tokens
        // to skip ALL security invariants (source EID, vault, peer validation)
        if (mesh.vault == address(0)) revert TokenMeshNotConfigured(token);

        if (mesh.paused) revert TokenMeshPausedError(token);
        // FIX: I-5 — always enforce source EID check; a misconfigured solanaEid=0 previously
        // allowed messages from any source chain to be accepted
        if (srcEid != mesh.solanaEid) revert TokenMeshSrcEidMismatch(mesh.solanaEid, srcEid);

        address expectedVault = registry.getVaultForToken(token);
        if (expectedVault != mesh.vault) revert TokenMeshVaultMismatch(mesh.vault, expectedVault);

        if (action == ACTION_DEPOSIT) {
            if (sourceOft != mesh.assetMeshToken) revert TokenMeshAssetTokenMismatch(mesh.assetMeshToken, sourceOft);
            if (composeFrom != mesh.solanaAssetPeer) {
                revert TokenMeshPeerMismatch(mesh.solanaAssetPeer, composeFrom);
            }
            return;
        }

        if (action == ACTION_REDEEM) {
            if (sourceOft != mesh.shareMeshToken) revert TokenMeshShareTokenMismatch(mesh.shareMeshToken, sourceOft);
            if (composeFrom != mesh.solanaSharePeer) {
                revert TokenMeshPeerMismatch(mesh.solanaSharePeer, composeFrom);
            }
            return;
        }
    }
}
