// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";
import {ICreatorOVaultComposer} from "../../interfaces/ovault/ICreatorOVaultComposer.sol";
import {ILayerZeroComposer} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/oft-evm/contracts/libs/OFTComposeMsgCodec.sol";

interface ICreatorOVaultWrapperComposer {
    function creatorCoin() external view returns (address);
    function shareOFT() external view returns (address);
    function depositFor(uint256 amount, uint256 minOut, address beneficiary) external returns (uint256 shareOFTOut);
    function withdrawFor(uint256 amount, uint256 minOut, address beneficiary) external returns (uint256 creatorCoinOut);
    // FIX: C-1 — expose operator check so configureCreatorMesh can verify
    function isBeneficiaryOperator(address operator) external view returns (bool);
}

/**
 * @title OVaultHubComposer
 * @notice Base-side LayerZero compose receiver for cross-chain deposit/redeem intents.
 * @dev The destination OFT credits tokens to this contract first, then EndpointV2 calls
 *      `lzCompose`. This contract executes wrapper deposit/withdraw and enforces strict
 *      balance-delta invariants so a compose packet can never spend or mint more than
 *      the packet-provided OFT amount.
 */
contract OVaultHubComposer is ILayerZeroComposer, ICreatorOVaultComposer, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant ACTION_DEPOSIT = 1;
    uint8 public constant ACTION_REDEEM = 2;

    ICreatorRegistry public immutable registry;
    address public immutable endpoint;

    struct CreatorMesh {
        address vault;
        address assetMeshToken;
        address shareMeshToken;
        uint32 solanaEid;
        bytes32 solanaAssetPeer;
        bytes32 solanaSharePeer;
        bool paused;
    }

    mapping(address => CreatorMesh) internal creatorMeshes;
    mapping(address => bool) public allowedComposeSenders;

    event ComposeSenderAllowed(address indexed sender, bool allowed);
    event CreatorMeshConfigured(
        address indexed creatorToken,
        address indexed vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer
    );
    event CreatorMeshPaused(address indexed creatorToken, bool paused);
    event DepositComposed(
        bytes32 indexed guid,
        address indexed sourceOft,
        address indexed receiver,
        address creatorToken,
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
        address creatorToken,
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
    error WrapperCreatorTokenMismatch(address expected, address actual);
    error WrapperShareOftMismatch(address expected, address actual);
    error CreatorMeshPausedError(address creatorToken);
    error CreatorMeshVaultMismatch(address expected, address actual);
    error CreatorMeshAssetTokenMismatch(address expected, address actual);
    error CreatorMeshShareTokenMismatch(address expected, address actual);
    error CreatorMeshSrcEidMismatch(uint32 expected, uint32 actual);
    error CreatorMeshPeerMismatch(bytes32 expected, bytes32 actual);
    // FIX: C-1 — require composer is registered as beneficiary operator on wrapper
    error ComposerNotBeneficiaryOperator(address composer, address wrapper);
    // FIX: C-2 — require mesh configuration before allowing compose
    error CreatorMeshNotConfigured(address creatorToken);
    // FIX: L-7 — prevent receiver == address(this) locking shares in composer
    error ReceiverIsComposer();
    error InsufficientComposerBalance(address token, uint256 available, uint256 requiredAmount);
    error InputSpendInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance, uint256 expectedSpend);
    error OutputMintInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance, uint256 expectedMint);
    error ResidualBalanceInvariantFailed(address token, uint256 beforeBalance, uint256 afterBalance);

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_registry == address(0) || _owner == address(0)) revert ZeroAddress();
        registry = ICreatorRegistry(_registry);
        address resolvedEndpoint = ICreatorRegistry(_registry).getLayerZeroEndpoint(block.chainid);
        if (resolvedEndpoint == address(0)) revert ZeroAddress();
        endpoint = resolvedEndpoint;
    }

    function setAllowedComposeSender(address sender, bool allowed) external onlyOwner {
        if (sender == address(0)) revert ZeroAddress();
        allowedComposeSenders[sender] = allowed;
        emit ComposeSenderAllowed(sender, allowed);
    }

    function configureCreatorMesh(
        address creatorToken,
        address vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer
    ) external override onlyOwner {
        if (
            creatorToken == address(0) || vault == address(0) || assetMeshToken == address(0) || shareMeshToken == address(0)
        ) {
            revert ZeroAddress();
        }
        // FIX: C-1 — verify composer is registered as beneficiary operator on the wrapper
        // before allowing mesh configuration; prevents permanent compose DoS
        address wrapper = registry.getWrapperForToken(creatorToken);
        if (wrapper != address(0) && !ICreatorOVaultWrapperComposer(wrapper).isBeneficiaryOperator(address(this))) {
            revert ComposerNotBeneficiaryOperator(address(this), wrapper);
        }
        creatorMeshes[creatorToken] = CreatorMesh({
            vault: vault,
            assetMeshToken: assetMeshToken,
            shareMeshToken: shareMeshToken,
            solanaEid: solanaEid,
            solanaAssetPeer: solanaAssetPeer,
            solanaSharePeer: solanaSharePeer,
            paused: false
        });
        emit CreatorMeshConfigured(
            creatorToken, vault, assetMeshToken, shareMeshToken, solanaEid, solanaAssetPeer, solanaSharePeer
        );
    }

    function pauseCreatorMesh(address creatorToken, bool paused) external override onlyOwner {
        if (creatorToken == address(0)) revert ZeroAddress();
        creatorMeshes[creatorToken].paused = paused;
        emit CreatorMeshPaused(creatorToken, paused);
    }

    function creatorMesh(address creatorToken)
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
        CreatorMesh memory mesh = creatorMeshes[creatorToken];
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
        (uint8 action, address creatorToken, address wrapper, address receiver, address sourceOft, uint256 minOut) =
            abi.decode(composeMsg, (uint8, address, address, address, address, uint256));

        if (creatorToken == address(0) || wrapper == address(0) || receiver == address(0) || sourceOft == address(0)) {
            revert ZeroAddress();
        }
        // FIX: L-7 — prevent shares/assets from being locked in the composer
        if (receiver == address(this)) revert ReceiverIsComposer();
        // FIX: M-2 — reject zero minOut to prevent sandwich attacks on cross-chain deposits/redeems
        if (minOut == 0) revert ZeroAmount();
        if (sourceOft != _from) revert SourceOftMismatch(sourceOft, _from);

        address shareOft = _validateCreatorBindings(creatorToken, wrapper);
        bytes32 composeFromBytes32 = OFTComposeMsgCodec.composeFrom(_message);
        address composeFrom = OFTComposeMsgCodec.bytes32ToAddress(composeFromBytes32);
        uint32 srcEid = OFTComposeMsgCodec.srcEid(_message);
        _enforceMeshInvariants({
            action: action,
            creatorToken: creatorToken,
            sourceOft: _from,
            srcEid: srcEid,
            composeFrom: composeFromBytes32
        });

        if (action == ACTION_DEPOSIT) {
            uint256 sharesOut = _composeDeposit(creatorToken, shareOft, wrapper, receiver, amountIn, minOut);
            emit DepositComposed(
                _guid, _from, receiver, creatorToken, wrapper, amountIn, sharesOut, srcEid, composeFrom
            );
            return;
        }

        if (action == ACTION_REDEEM) {
            if (_from != shareOft) revert CanonicalShareOftMismatch(shareOft, _from);
            uint256 assetsOut = _composeRedeem(creatorToken, shareOft, wrapper, receiver, amountIn, minOut);
            emit RedeemComposed(
                _guid, _from, receiver, creatorToken, wrapper, amountIn, assetsOut, srcEid, composeFrom
            );
            return;
        }

        revert UnknownAction(action);
    }

    function _composeDeposit(
        address creatorToken,
        address shareOft,
        address wrapper,
        address receiver,
        uint256 amountIn,
        uint256 minSharesOut
    ) internal returns (uint256 sharesOut) {
        IERC20 creator = IERC20(creatorToken);
        IERC20 share = IERC20(shareOft);

        uint256 creatorBefore = creator.balanceOf(address(this));
        if (creatorBefore < amountIn) {
            revert InsufficientComposerBalance(creatorToken, creatorBefore, amountIn);
        }
        uint256 shareBefore = share.balanceOf(address(this));

        creator.forceApprove(wrapper, amountIn);
        sharesOut = ICreatorOVaultWrapperComposer(wrapper).depositFor(amountIn, minSharesOut, receiver);
        creator.forceApprove(wrapper, 0);

        uint256 creatorAfter = creator.balanceOf(address(this));
        if (creatorAfter + amountIn != creatorBefore) {
            revert InputSpendInvariantFailed(creatorToken, creatorBefore, creatorAfter, amountIn);
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
        address creatorToken,
        address shareOft,
        address wrapper,
        address receiver,
        uint256 amountIn,
        uint256 minAssetsOut
    ) internal returns (uint256 assetsOut) {
        IERC20 creator = IERC20(creatorToken);
        IERC20 share = IERC20(shareOft);

        uint256 shareBefore = share.balanceOf(address(this));
        if (shareBefore < amountIn) {
            revert InsufficientComposerBalance(shareOft, shareBefore, amountIn);
        }
        uint256 creatorBefore = creator.balanceOf(address(this));

        share.forceApprove(wrapper, amountIn);
        assetsOut = ICreatorOVaultWrapperComposer(wrapper).withdrawFor(amountIn, minAssetsOut, receiver);
        share.forceApprove(wrapper, 0);

        uint256 shareAfterBurn = share.balanceOf(address(this));
        if (shareAfterBurn + amountIn != shareBefore) {
            revert InputSpendInvariantFailed(shareOft, shareBefore, shareAfterBurn, amountIn);
        }

        uint256 creatorAfterMint = creator.balanceOf(address(this));
        if (creatorBefore + assetsOut != creatorAfterMint) {
            revert OutputMintInvariantFailed(creatorToken, creatorBefore, creatorAfterMint, assetsOut);
        }

        creator.safeTransfer(receiver, assetsOut);
        uint256 creatorAfterTransfer = creator.balanceOf(address(this));
        if (creatorAfterTransfer != creatorBefore) {
            revert ResidualBalanceInvariantFailed(creatorToken, creatorBefore, creatorAfterTransfer);
        }
    }

    function _validateCreatorBindings(address creatorToken, address wrapper) internal view returns (address shareOft) {
        address expectedWrapper = registry.getWrapperForToken(creatorToken);
        if (expectedWrapper != wrapper) revert WrapperMismatch(expectedWrapper, wrapper);

        address wrapperCreator = ICreatorOVaultWrapperComposer(wrapper).creatorCoin();
        if (wrapperCreator != creatorToken) revert WrapperCreatorTokenMismatch(creatorToken, wrapperCreator);

        shareOft = registry.getShareOFTForToken(creatorToken);
        address wrapperShare = ICreatorOVaultWrapperComposer(wrapper).shareOFT();
        if (wrapperShare != shareOft) revert WrapperShareOftMismatch(shareOft, wrapperShare);
    }

    function _enforceMeshInvariants(
        uint8 action,
        address creatorToken,
        address sourceOft,
        uint32 srcEid,
        bytes32 composeFrom
    ) internal view {
        CreatorMesh memory mesh = creatorMeshes[creatorToken];
        // FIX: C-2 — require explicit mesh config; legacy bypass allowed unconfigured tokens
        // to skip ALL security invariants (source EID, vault, peer validation)
        if (mesh.vault == address(0)) revert CreatorMeshNotConfigured(creatorToken);

        if (mesh.paused) revert CreatorMeshPausedError(creatorToken);
        // FIX: I-5 — always enforce source EID check; a misconfigured solanaEid=0 previously
        // allowed messages from any source chain to be accepted
        if (srcEid != mesh.solanaEid) revert CreatorMeshSrcEidMismatch(mesh.solanaEid, srcEid);

        address expectedVault = registry.getVaultForToken(creatorToken);
        if (expectedVault != mesh.vault) revert CreatorMeshVaultMismatch(mesh.vault, expectedVault);

        if (action == ACTION_DEPOSIT) {
            if (sourceOft != mesh.assetMeshToken) revert CreatorMeshAssetTokenMismatch(mesh.assetMeshToken, sourceOft);
            if (mesh.solanaAssetPeer != bytes32(0) && composeFrom != mesh.solanaAssetPeer) {
                revert CreatorMeshPeerMismatch(mesh.solanaAssetPeer, composeFrom);
            }
            return;
        }

        if (action == ACTION_REDEEM) {
            if (sourceOft != mesh.shareMeshToken) revert CreatorMeshShareTokenMismatch(mesh.shareMeshToken, sourceOft);
            if (mesh.solanaSharePeer != bytes32(0) && composeFrom != mesh.solanaSharePeer) {
                revert CreatorMeshPeerMismatch(mesh.solanaSharePeer, composeFrom);
            }
            return;
        }
    }
}
