# 4626 - Deployment Registry

> Multi-chain deployment documentation for the 4626 omnichain protocol.

## 📁 Directory Structure

```
deployments/
├── ethereum/          # Ethereum Mainnet (Chain ID: 1)
├── base/              # Base Network (Chain ID: 8453)
├── arbitrum/          # Arbitrum One (Chain ID: 42161)
├── bsc/               # BNB Smart Chain (Chain ID: 56)
├── avalanche/         # Avalanche C-Chain (Chain ID: 43114)
├── monad/             # Monad (Chain ID: 143)
├── sonic/             # Sonic (Chain ID: 146)
└── hyperevm/          # HyperEVM (Chain ID: 999)
```

## 📋 File Naming Convention

| File Pattern | Description | Example |
|-------------|-------------|---------|
| `{chain}.json` | Primary deployment manifest | `ethereum.json` |
| `{chain}-config.json` | Network configuration | `base-config.json` |
| `{chain}-registry.json` | Cross-chain registry | `arbitrum-registry.json` |

## 🌐 Target Networks

| Network | Chain ID | LZ EID | Status |
|---------|----------|--------|--------|
| Ethereum | 1 | 30101 | ⏳ Pending |
| Base | 8453 | 30184 | ⏳ Pending |
| Arbitrum | 42161 | 30110 | ⏳ Pending |
| BSC | 56 | 30102 | ⏳ Pending |
| Avalanche | 43114 | 30106 | ⏳ Pending |
| Monad | 10143 | 30390 | ⏳ Pending |
| Sonic | 146 | 30332 | ⏳ Pending |
| HyperEVM | 999 | 30275 | ⏳ Pending |

## 🔧 LayerZero V2 Endpoints

```json
{
  "ethereum": { "eid": 30101, "endpoint": "0x1a44076050125825900e736c501f859c50fE728c" },
  "base": { "eid": 30184, "endpoint": "0x1a44076050125825900e736c501f859c50fE728c" },
  "arbitrum": { "eid": 30110, "endpoint": "0x1a44076050125825900e736c501f859c50fE728c" },
  "bsc": { "eid": 30102, "endpoint": "0x1a44076050125825900e736c501f859c50fE728c" },
  "avalanche": { "eid": 30106, "endpoint": "0x1a44076050125825900e736c501f859c50fE728c" },
  "monad": { "eid": 30390, "endpoint": "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B" },
  "sonic": { "eid": 30332, "endpoint": "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B" },
  "hyperevm": { "eid": 30275, "endpoint": "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B" }
}
```

## 🚀 Deployment Procedure

### Prerequisites
- Foundry/Forge installed
- LayerZero CLI configured
- Private key with sufficient funds
- Environment variables set

### Commands

```bash
# Deploy to network
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --broadcast

# Verify contracts
forge verify-contract <ADDRESS> <CONTRACT> --chain <CHAIN_ID>
```

### Post-Deployment Checklist
- [ ] Contract verification on block explorer
- [ ] LayerZero endpoint configuration
- [ ] Cross-chain peer setup
- [ ] Registry integration
- [ ] Frontend configuration update

---

**Status:** No deployments yet
