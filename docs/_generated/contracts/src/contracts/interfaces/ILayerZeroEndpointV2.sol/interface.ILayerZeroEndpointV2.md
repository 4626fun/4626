# ILayerZeroEndpointV2
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/interfaces/ILayerZeroEndpointV2.sol)


## Functions
### getSendLibrary

Get the send library for an OApp and destination endpoint


```solidity
function getSendLibrary(address _sender, uint32 _dstEid) external view returns (address lib);
```

### getReceiveLibrary

Get the receive library for an OApp and source endpoint


```solidity
function getReceiveLibrary(address _receiver, uint32 _srcEid) external view returns (address lib);
```

### getConfig

Get configuration for a specific config type


```solidity
function getConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType)
    external
    view
    returns (bytes memory config);
```

### setSendLibrary

Set send library for an OApp


```solidity
function setSendLibrary(address _oapp, uint32 _dstEid, address _sendLib) external;
```

### setReceiveLibrary

Set receive library for an OApp


```solidity
function setReceiveLibrary(address _oapp, uint32 _srcEid, address _receiveLib, uint256 _gracePeriod) external;
```

### setConfig

Set configuration for an OApp


```solidity
function setConfig(address _oapp, address _lib, uint32 _eid, uint32 _configType, bytes calldata _config) external;
```

### delegates

Get the delegate for an OApp


```solidity
function delegates(address _oapp) external view returns (address delegate);
```

### setDelegate

Set delegate for an OApp


```solidity
function setDelegate(address _delegate) external;
```

### initializable

Check if a pathway can be initialized


```solidity
function initializable(Origin calldata _origin, address _receiver) external view returns (bool);
```

### send

Send a message cross-chain


```solidity
function send(MessagingParams calldata _params, address _refundAddress)
    external
    payable
    returns (MessagingFee memory fee, bytes32 guid);
```

### quote

Quote the fee for sending a message


```solidity
function quote(MessagingParams calldata _params, address _sender) external view returns (MessagingFee memory fee);
```

### verify

Verify a message


```solidity
function verify(Origin calldata _origin, address _receiver, bytes32 _payloadHash) external;
```

### verifiable

Check if a message is verifiable


```solidity
function verifiable(Origin calldata _origin, address _receiver) external view returns (bool);
```

### lzReceive

Execute a verified message


```solidity
function lzReceive(
    Origin calldata _origin,
    address _receiver,
    bytes32 _guid,
    bytes calldata _message,
    bytes calldata _extraData
) external payable;
```

