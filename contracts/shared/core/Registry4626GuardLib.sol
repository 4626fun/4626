// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

/**
 * @title Registry4626GuardLib
 * @notice Fat external write helpers for `Registry4626` (EIP-170 headroom).
 * @dev Linked via DELEGATECALL. Tiny per-call-site stubs lose size — keep entrypoints fat.
 */
library Registry4626GuardLib {
    uint256 internal constant MAX_REMOTE_OFT_CHAINS_PER_TOKEN = 64;

    // BindingKind mirrors Registry4626 (Vault=0 … GaugeController=4).
    uint8 internal constant BINDING_VAULT = 0;
    uint8 internal constant BINDING_SHARE_OFT = 1;
    uint8 internal constant BINDING_WRAPPER = 2;
    uint8 internal constant BINDING_ORACLE = 3;
    uint8 internal constant BINDING_GAUGE = 4;

    error FactoryCodehashMismatch(address factory, bytes32 expected, bytes32 actual);
    error BindingAlreadySet(address token, address existing);
    error LiveRebindOwnerOnly();
    error RemoteOFTPeerFlavorConflict(address token, uint32 chainEid);
    error TokenNotRegistered(address token);
    error ZeroAddress();
    error ZeroBytes32();
    error InvalidChainEid();
    error TooManyRemoteOftChains();
    error ReverseMappingConflict(address key, address existingToken, address attemptedToken);
    error ReverseMappingBytes32Conflict(bytes32 key, address existingToken, address attemptedToken);

    event TokenBindingUpdated(address indexed token, bytes32 indexed field, address previous, address next);
    event TokenUpdated(address indexed token);
    event RemoteOFTPeerSet(address indexed token, uint32 indexed chainEid, address remoteOFT);
    event RemoteOFTPeerRemoved(address indexed token, uint32 indexed chainEid);
    event RemoteOFTPeerBytes32Set(address indexed token, uint32 indexed chainEid, bytes32 remoteOFT);
    event RemoteOFTPeerBytes32Removed(address indexed token, uint32 indexed chainEid);
    event FactoryAuthorized(address indexed factory, bool authorized);

    function requireFactoryCodehash(mapping(address => bytes32) storage pins, address factory) external view {
        _requireFactoryCodehash(pins, factory);
    }

    function authorizeFactory(
        mapping(address => bool) storage authorizedFactories,
        mapping(address => bytes32) storage pins,
        address factory,
        bool authorized
    ) external {
        if (factory == address(0)) revert ZeroAddress();
        if (authorized) {
            if (pins[factory] == bytes32(0)) {
                bytes32 live;
                assembly {
                    live := extcodehash(factory)
                }
                if (live == bytes32(0)) revert FactoryCodehashMismatch(factory, bytes32(uint256(1)), bytes32(0));
                pins[factory] = live;
            }
            _requireFactoryCodehash(pins, factory);
        }
        authorizedFactories[factory] = authorized;
        emit FactoryAuthorized(factory, authorized);
    }

    function setTokenBinding(
        mapping(address => IRegistry4626.TokenInfo) storage tokenInfos,
        mapping(address => address) storage vaultToToken,
        mapping(address => address) storage shareOFTToToken,
        mapping(address => address) storage wrapperToToken,
        mapping(address => address) storage oracleToToken,
        mapping(address => address) storage gaugeControllerToToken,
        bool globalLiveRebind,
        mapping(address => bool) storage perTokenLiveRebind,
        address owner,
        address sender,
        address token,
        address next,
        uint8 kind
    ) external {
        IRegistry4626.TokenInfo storage info = tokenInfos[token];
        if (info.token == address(0)) revert TokenNotRegistered(token);
        if (next == address(0)) revert ZeroAddress();

        address previous;
        bytes32 field;
        if (kind == BINDING_VAULT) {
            previous = info.vault;
            field = "vault";
        } else if (kind == BINDING_SHARE_OFT) {
            previous = info.shareOFT;
            field = "shareOFT";
        } else if (kind == BINDING_WRAPPER) {
            previous = info.wrapper;
            field = "wrapper";
        } else if (kind == BINDING_ORACLE) {
            previous = info.oracle;
            field = "oracle";
        } else {
            previous = info.gaugeController;
            field = "gaugeController";
        }

        _requireBindingWritable(globalLiveRebind, perTokenLiveRebind, token, previous, next, owner, sender);
        if (previous == next) return;

        address reverseOwner;
        if (kind == BINDING_VAULT) {
            reverseOwner = vaultToToken[next];
        } else if (kind == BINDING_SHARE_OFT) {
            reverseOwner = shareOFTToToken[next];
        } else if (kind == BINDING_WRAPPER) {
            reverseOwner = wrapperToToken[next];
        } else if (kind == BINDING_ORACLE) {
            reverseOwner = oracleToToken[next];
        } else {
            reverseOwner = gaugeControllerToToken[next];
        }
        if (reverseOwner != address(0) && reverseOwner != token) {
            revert ReverseMappingConflict(next, reverseOwner, token);
        }

        if (previous != address(0)) {
            if (kind == BINDING_VAULT) {
                delete vaultToToken[previous];
            } else if (kind == BINDING_SHARE_OFT) {
                delete shareOFTToToken[previous];
            } else if (kind == BINDING_WRAPPER) {
                delete wrapperToToken[previous];
            } else if (kind == BINDING_ORACLE) {
                delete oracleToToken[previous];
            } else {
                delete gaugeControllerToToken[previous];
            }
        }

        if (kind == BINDING_VAULT) {
            info.vault = next;
            vaultToToken[next] = token;
        } else if (kind == BINDING_SHARE_OFT) {
            info.shareOFT = next;
            shareOFTToToken[next] = token;
        } else if (kind == BINDING_WRAPPER) {
            info.wrapper = next;
            wrapperToToken[next] = token;
        } else if (kind == BINDING_ORACLE) {
            info.oracle = next;
            oracleToToken[next] = token;
        } else {
            info.gaugeController = next;
            gaugeControllerToToken[next] = token;
        }

        emit TokenBindingUpdated(token, field, previous, next);
        emit TokenUpdated(token);
    }

    function setRemoteOFTPeer(
        mapping(address => IRegistry4626.TokenInfo) storage tokenInfos,
        mapping(address => mapping(uint32 => address)) storage remoteOFTPeers,
        mapping(address => mapping(uint32 => bytes32)) storage remoteOFTPeersBytes32,
        mapping(address => uint32[]) storage remoteOFTChains,
        mapping(address => address) storage remoteOFTToToken,
        bool globalLiveRebind,
        mapping(address => bool) storage perTokenLiveRebind,
        address owner,
        address sender,
        address token,
        uint32 chainEid,
        address remoteOFT
    ) external {
        if (tokenInfos[token].token == address(0)) revert TokenNotRegistered(token);
        if (chainEid == 0) revert InvalidChainEid();
        if (remoteOFT == address(0)) revert ZeroAddress();
        if (remoteOFTPeersBytes32[token][chainEid] != bytes32(0)) {
            revert RemoteOFTPeerFlavorConflict(token, chainEid);
        }

        address oldRemoteOFT = remoteOFTPeers[token][chainEid];
        _requireBindingWritable(globalLiveRebind, perTokenLiveRebind, token, oldRemoteOFT, remoteOFT, owner, sender);
        if (oldRemoteOFT == remoteOFT) return;

        if (oldRemoteOFT != address(0)) {
            if (
                remoteOFTToToken[oldRemoteOFT] == token
                    && !_remoteOFTStillReferenced(remoteOFTPeers, remoteOFTChains, token, oldRemoteOFT, chainEid)
            ) {
                delete remoteOFTToToken[oldRemoteOFT];
            }
        } else {
            _trackRemoteOFTChain(remoteOFTChains[token], chainEid);
        }

        address reverseOwner = remoteOFTToToken[remoteOFT];
        if (reverseOwner != address(0) && reverseOwner != token) {
            revert ReverseMappingConflict(remoteOFT, reverseOwner, token);
        }

        remoteOFTPeers[token][chainEid] = remoteOFT;
        remoteOFTToToken[remoteOFT] = token;
        emit RemoteOFTPeerSet(token, chainEid, remoteOFT);
    }

    function removeRemoteOFTPeer(
        mapping(address => IRegistry4626.TokenInfo) storage tokenInfos,
        mapping(address => mapping(uint32 => address)) storage remoteOFTPeers,
        mapping(address => uint32[]) storage remoteOFTChains,
        mapping(address => address) storage remoteOFTToToken,
        address token,
        uint32 chainEid
    ) external {
        if (tokenInfos[token].token == address(0)) revert TokenNotRegistered(token);

        address remoteOFT = remoteOFTPeers[token][chainEid];
        if (remoteOFT == address(0)) return;

        delete remoteOFTPeers[token][chainEid];
        _untrackRemoteOFTChain(remoteOFTChains[token], chainEid);

        if (!_remoteOFTStillReferenced(remoteOFTPeers, remoteOFTChains, token, remoteOFT, 0)) {
            delete remoteOFTToToken[remoteOFT];
        }
        emit RemoteOFTPeerRemoved(token, chainEid);
    }

    function setRemoteOFTPeerBytes32(
        mapping(address => IRegistry4626.TokenInfo) storage tokenInfos,
        mapping(address => mapping(uint32 => address)) storage remoteOFTPeers,
        mapping(address => mapping(uint32 => bytes32)) storage remoteOFTPeersBytes32,
        mapping(address => uint32[]) storage remoteOFTChainsBytes32,
        mapping(bytes32 => address) storage remoteOFTBytes32ToToken,
        bool globalLiveRebind,
        mapping(address => bool) storage perTokenLiveRebind,
        address owner,
        address sender,
        address token,
        uint32 chainEid,
        bytes32 remoteOFT
    ) external {
        if (tokenInfos[token].token == address(0)) revert TokenNotRegistered(token);
        if (chainEid == 0) revert InvalidChainEid();
        if (remoteOFT == bytes32(0)) revert ZeroBytes32();
        if (remoteOFTPeers[token][chainEid] != address(0)) {
            revert RemoteOFTPeerFlavorConflict(token, chainEid);
        }

        bytes32 oldPeer = remoteOFTPeersBytes32[token][chainEid];
        // Compare full bytes32 identities — truncating to address would let two distinct
        // peers that share the low 160 bits bypass the one-shot latch (ODA-430-F8).
        if (oldPeer != bytes32(0) && oldPeer != remoteOFT) {
            if (!(globalLiveRebind || perTokenLiveRebind[token])) {
                revert BindingAlreadySet(token, address(uint160(uint256(oldPeer))));
            }
            if (sender != owner) revert LiveRebindOwnerOnly();
        }
        if (oldPeer == remoteOFT) return;

        if (oldPeer == bytes32(0)) {
            _trackRemoteOFTChain(remoteOFTChainsBytes32[token], chainEid);
        } else if (
            remoteOFTBytes32ToToken[oldPeer] == token
                && !_remoteOFTBytes32StillReferenced(
                    remoteOFTPeersBytes32, remoteOFTChainsBytes32, token, oldPeer, chainEid
                )
        ) {
            delete remoteOFTBytes32ToToken[oldPeer];
        }

        address reverseOwner = remoteOFTBytes32ToToken[remoteOFT];
        if (reverseOwner != address(0) && reverseOwner != token) {
            revert ReverseMappingBytes32Conflict(remoteOFT, reverseOwner, token);
        }

        remoteOFTPeersBytes32[token][chainEid] = remoteOFT;
        remoteOFTBytes32ToToken[remoteOFT] = token;
        emit RemoteOFTPeerBytes32Set(token, chainEid, remoteOFT);
    }

    function removeRemoteOFTPeerBytes32(
        mapping(address => IRegistry4626.TokenInfo) storage tokenInfos,
        mapping(address => mapping(uint32 => bytes32)) storage remoteOFTPeersBytes32,
        mapping(address => uint32[]) storage remoteOFTChainsBytes32,
        mapping(bytes32 => address) storage remoteOFTBytes32ToToken,
        address token,
        uint32 chainEid
    ) external {
        if (tokenInfos[token].token == address(0)) revert TokenNotRegistered(token);
        if (chainEid == 0) revert InvalidChainEid();

        bytes32 oldPeer = remoteOFTPeersBytes32[token][chainEid];
        if (oldPeer == bytes32(0)) return;

        delete remoteOFTPeersBytes32[token][chainEid];
        _untrackRemoteOFTChain(remoteOFTChainsBytes32[token], chainEid);

        if (
            !_remoteOFTBytes32StillReferenced(remoteOFTPeersBytes32, remoteOFTChainsBytes32, token, oldPeer, 0)
        ) {
            delete remoteOFTBytes32ToToken[oldPeer];
        }
        emit RemoteOFTPeerBytes32Removed(token, chainEid);
    }

    function _requireFactoryCodehash(mapping(address => bytes32) storage pins, address factory) private view {
        bytes32 expected = pins[factory];
        if (expected == bytes32(0)) revert FactoryCodehashMismatch(factory, bytes32(uint256(1)), bytes32(0));

        bytes32 actual;
        assembly {
            actual := extcodehash(factory)
        }
        if (actual != expected) revert FactoryCodehashMismatch(factory, expected, actual);
    }

    function _requireBindingWritable(
        bool globalLiveRebind,
        mapping(address => bool) storage perTokenLiveRebind,
        address token,
        address existing,
        address next,
        address owner,
        address sender
    ) private view {
        if (existing == address(0) || existing == next) return;
        if (!(globalLiveRebind || perTokenLiveRebind[token])) revert BindingAlreadySet(token, existing);
        if (sender != owner) revert LiveRebindOwnerOnly();
    }

    function _remoteOFTStillReferenced(
        mapping(address => mapping(uint32 => address)) storage remoteOFTPeers,
        mapping(address => uint32[]) storage remoteOFTChains,
        address token,
        address remoteOFT,
        uint32 skipEid
    ) private view returns (bool) {
        uint32[] storage chains = remoteOFTChains[token];
        for (uint256 i; i < chains.length;) {
            uint32 eid = chains[i];
            if (eid != skipEid && remoteOFTPeers[token][eid] == remoteOFT) return true;
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _remoteOFTBytes32StillReferenced(
        mapping(address => mapping(uint32 => bytes32)) storage remoteOFTPeersBytes32,
        mapping(address => uint32[]) storage remoteOFTChainsBytes32,
        address token,
        bytes32 remoteOFT,
        uint32 skipEid
    ) private view returns (bool) {
        uint32[] storage chains = remoteOFTChainsBytes32[token];
        for (uint256 i; i < chains.length;) {
            uint32 eid = chains[i];
            if (eid != skipEid && remoteOFTPeersBytes32[token][eid] == remoteOFT) return true;
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function _trackRemoteOFTChain(uint32[] storage chains, uint32 chainEid) private {
        if (chains.length >= MAX_REMOTE_OFT_CHAINS_PER_TOKEN) revert TooManyRemoteOftChains();
        chains.push(chainEid);
    }

    function _untrackRemoteOFTChain(uint32[] storage chains, uint32 chainEid) private {
        for (uint256 i; i < chains.length;) {
            if (chains[i] == chainEid) {
                chains[i] = chains[chains.length - 1];
                chains.pop();
                break;
            }
            unchecked {
                ++i;
            }
        }
    }
}
