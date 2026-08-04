// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import {IRegistry4626} from "@4626/shared/IRegistry4626.sol";
import {IFriendKeyOERC1155} from "@4626/interfaces/IFriendKeyOERC1155.sol";
import {FriendKeyMsgCodec} from "@4626/omnichain/FriendKeyMsgCodec.sol";

/**
 * @title FriendKeyOERC1155
 * @notice CREATE2-parity omnichain wrap for AlfaClub FriendKey (multi-id collection).
 * @dev Hub (Base): escrows allowlisted underlying ids; does not mint a Base-side user token.
 *      Spoke: mints/burns representation ERC-1155 at the same CREATE2 address (same token ids).
 *      `underlying` is immutable so explorers can prove the wrap points at FriendKey.
 *      Constructor args stay chain-stable for CREATE2 parity (registry, owner, underlying).
 *      Set `uri` / `contractURI` after deploy (not in constructor) for metadata.
 */
contract FriendKeyOERC1155 is OApp, ReentrancyGuard, ERC1155, IERC1155Receiver, IFriendKeyOERC1155 {
    address public immutable registry;
    address public immutable underlying;

    bool public isHub;
    bool public uriFrozen;
    string private _contractURI;
    mapping(uint256 => bool) public tokenAllowed;

    error ZeroAddress();
    error HubAlreadyConfigured();
    error InvalidAmount();
    error InsufficientBalance();
    error TokenNotAllowed();
    error UriFrozen();
    error LzTokenFeeUnsupported();

    event HubConfigured(address indexed underlyingFriendKey);
    event TokenAllowlistUpdated(uint256 indexed tokenId, bool allowed);
    event ContractURIUpdated(string contractURI);
    event URIFrozen();
    event Sent(
        uint32 indexed dstEid,
        address indexed from,
        address indexed to,
        uint256 tokenId,
        uint256 amount,
        bytes32 guid
    );
    event Received(uint32 indexed srcEid, address indexed to, uint256 tokenId, uint256 amount, bytes32 guid);

    constructor(address registry_, address owner_, address underlying_)
        OApp(IRegistry4626(registry_).getLayerZeroEndpoint(block.chainid), owner_)
        Ownable(owner_)
        ERC1155("")
    {
        if (registry_ == address(0) || owner_ == address(0) || underlying_ == address(0)) revert ZeroAddress();
        registry = registry_;
        underlying = underlying_;
    }

    /// @notice Sticky Base-only hub flag. Underlying is immutable from construction.
    function setHub() external onlyOwner {
        if (isHub) revert HubAlreadyConfigured();
        isHub = true;
        emit HubConfigured(underlying);
    }

    function setTokenAllowed(uint256 tokenId, bool allowed) external onlyOwner {
        tokenAllowed[tokenId] = allowed;
        emit TokenAllowlistUpdated(tokenId, allowed);
    }

    function setURI(string calldata newuri) external onlyOwner {
        if (uriFrozen) revert UriFrozen();
        _setURI(newuri);
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        if (uriFrozen) revert UriFrozen();
        _contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }

    function freezeURI() external onlyOwner {
        if (uriFrozen) revert UriFrozen();
        uriFrozen = true;
        emit URIFrozen();
    }

    function contractURI() external view returns (string memory) {
        return _contractURI;
    }

    /**
     * @notice Quote native-fee send cost. LZ-token fee mode is unsupported (matches `send`).
     */
    function quoteSend(
        uint32 dstEid,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata options,
        bool payInLzToken
    ) external view returns (MessagingFee memory fee) {
        if (payInLzToken) revert LzTokenFeeUnsupported();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (!tokenAllowed[tokenId]) revert TokenNotAllowed();
        bytes memory message = FriendKeyMsgCodec.encode(to, tokenId, amount);
        return _quote(dstEid, message, options, false);
    }

    /**
     * @notice Bridge keys to `to` on `dstEid`. Pays LayerZero fees in native gas only.
     * @dev Hub: escrows underlying from msg.sender. Spoke: burns representation from msg.sender.
     */
    function send(
        uint32 dstEid,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata options,
        address refundAddress
    ) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        if (to == address(0) || refundAddress == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (!tokenAllowed[tokenId]) revert TokenNotAllowed();

        if (isHub) {
            IERC1155(underlying).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        } else {
            uint256 bal = balanceOf(msg.sender, tokenId);
            if (bal < amount) revert InsufficientBalance();
            _burn(msg.sender, tokenId, amount);
        }

        bytes memory message = FriendKeyMsgCodec.encode(to, tokenId, amount);
        // Native fee only — `quoteSend(..., payInLzToken=true)` reverts.
        receipt = _lzSend(dstEid, message, options, MessagingFee(msg.value, 0), refundAddress);
        emit Sent(dstEid, msg.sender, to, tokenId, amount, receipt.guid);
    }

    function _lzReceive(Origin calldata origin, bytes32 guid, bytes calldata payload, address, bytes calldata)
        internal
        override
    {
        (address to, uint256 tokenId, uint256 amount) = FriendKeyMsgCodec.decode(payload);
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (!tokenAllowed[tokenId]) revert TokenNotAllowed();

        if (isHub) {
            IERC1155(underlying).safeTransferFrom(address(this), to, tokenId, amount, "");
        } else {
            _mint(to, tokenId, amount, "");
        }
        emit Received(origin.srcEid, to, tokenId, amount, guid);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }
}
