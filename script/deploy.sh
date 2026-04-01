#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
#                    4626 Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./script/deploy.sh infrastructure    - Deploy all core contracts
#   ./script/deploy.sh infra-v2          - Deploy phased infra + seed bytecode store
#
# Environment:
#   PRIVATE_KEY         - Deployer private key
#   RPC_URL             - Base RPC URL (default: https://mainnet.base.org)
#   BASE_RPC_URL        - Base RPC URL for v2 deployer (Alchemy recommended)
#   ETHERSCAN_API_KEY   - For contract verification
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default RPC
RPC_URL=${RPC_URL:-"https://mainnet.base.org"}

# Print banner
print_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║     ██████╗██████╗ ███████╗ █████╗ ████████╗ ██████╗ ██████╗   ║${NC}"
    echo -e "${BLUE}║    ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗  ║${NC}"
    echo -e "${BLUE}║    ██║     ██████╔╝█████╗  ███████║   ██║   ██║   ██║██████╔╝  ║${NC}"
    echo -e "${BLUE}║    ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██╗  ║${NC}"
    echo -e "${BLUE}║    ╚██████╗██║  ██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║  ║${NC}"
    echo -e "${BLUE}║     ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝  ║${NC}"
    echo -e "${BLUE}║                         VAULT                                  ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Print usage
print_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./script/deploy.sh infrastructure         Deploy all core contracts"
    echo "  ./script/deploy.sh infra-v2               Deploy v2 infra and seed bytecode store"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./script/deploy.sh infrastructure"
    echo "  ./script/deploy.sh infra-v2"
    echo ""
    echo -e "${YELLOW}Environment Variables:${NC}"
    echo "  PRIVATE_KEY         - Your deployer private key"
    echo "  RPC_URL             - Base RPC URL (default: mainnet.base.org)"
    echo "  BASE_RPC_URL        - Base RPC URL for v2 deployer"
    echo "  ETHERSCAN_API_KEY   - For contract verification"
    echo ""
    echo -e "${YELLOW}Note:${NC}"
    echo "  Legacy per-token deploy entrypoints are retired."
    echo "  Use the app deploy-session flow at /deploy for creator vault launches."
    echo ""
}

# Check prerequisites
check_prereqs() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo -e "${RED}Error: PRIVATE_KEY environment variable not set${NC}"
        exit 1
    fi
    
    if ! command -v forge &> /dev/null; then
        echo -e "${RED}Error: Foundry not installed. Install from https://getfoundry.sh${NC}"
        exit 1
    fi
}

# Deploy infrastructure
deploy_infrastructure() {
    echo -e "${GREEN}Deploying 4626 infrastructure...${NC}"
    echo ""
    
    forge script script/DeployInfrastructure.s.sol:DeployInfrastructure \
        --rpc-url "$RPC_URL" \
        --broadcast \
        --verify \
        -vvvv
    
    echo ""
    echo -e "${GREEN}✓ Infrastructure deployed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Copy contract addresses to .env file"
    echo "2. Add contracts to Coinbase Paymaster allowlist"
    echo "3. Launch creator vaults via the app deploy-session flow (/deploy)"
}

# Deploy v2 bytecode store + deployer + DeploymentBatcher, then seed store
deploy_infra_v2() {
    if [ -z "$BASE_RPC_URL" ]; then
        echo -e "${RED}Error: BASE_RPC_URL environment variable not set${NC}"
        exit 1
    fi

    if [ -n "${DEPLOYMENT_EPOCH_TAG:-}" ]; then
        : "${INFRA_STORE_SALT_TAG:=4626:UniversalBytecodeStore:${DEPLOYMENT_EPOCH_TAG}}"
        : "${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:=4626:UniversalCreate2DeployerFromStore:${DEPLOYMENT_EPOCH_TAG}}"
        : "${INFRA_VAULT_CORE_MODULE_SALT_TAG:=4626:CreatorOVaultCoreModule:${DEPLOYMENT_EPOCH_TAG}}"
        : "${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:=4626:CreatorOVaultStrategiesModule:${DEPLOYMENT_EPOCH_TAG}}"
        : "${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:=4626:CreatorOVaultAdminModule:${DEPLOYMENT_EPOCH_TAG}}"
        : "${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:=4626:DeploymentBatcher:${DEPLOYMENT_EPOCH_TAG}}"
        export INFRA_STORE_SALT_TAG
        export INFRA_DEPLOYER_FROM_STORE_SALT_TAG
        export INFRA_VAULT_CORE_MODULE_SALT_TAG
        export INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG
        export INFRA_VAULT_ADMIN_MODULE_SALT_TAG
        export INFRA_DEPLOYMENT_BATCHER_SALT_TAG
    fi

    echo -e "${GREEN}Deploying v2 bytecode store + deployer...${NC}"
    echo ""
    echo -e "${YELLOW}Infra Salt Configuration:${NC}"
    echo "  DEPLOYMENT_EPOCH_TAG=${DEPLOYMENT_EPOCH_TAG:-[not set]}"
    echo "  INFRA_STORE_SALT=${INFRA_STORE_SALT:-[auto by tag/default]}"
    echo "  INFRA_STORE_SALT_TAG=${INFRA_STORE_SALT_TAG:-4626:UniversalBytecodeStore:v1.7.1 (default)}"
    echo "  INFRA_DEPLOYER_FROM_STORE_SALT=${INFRA_DEPLOYER_FROM_STORE_SALT:-[auto by tag/default]}"
    echo "  INFRA_DEPLOYER_FROM_STORE_SALT_TAG=${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:-4626:UniversalCreate2DeployerFromStore:v1.7.1 (default)}"
    echo "  INFRA_VAULT_CORE_MODULE_SALT=${INFRA_VAULT_CORE_MODULE_SALT:-[auto by tag/default]}"
    echo "  INFRA_VAULT_CORE_MODULE_SALT_TAG=${INFRA_VAULT_CORE_MODULE_SALT_TAG:-4626:CreatorOVaultCoreModule:v1.7.1 (default)}"
    echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT=${INFRA_VAULT_STRATEGIES_MODULE_SALT:-[auto by tag/default]}"
    echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:-4626:CreatorOVaultStrategiesModule:v1.7.1 (default)}"
    echo "  INFRA_VAULT_ADMIN_MODULE_SALT=${INFRA_VAULT_ADMIN_MODULE_SALT:-[auto by tag/default]}"
    echo "  INFRA_VAULT_ADMIN_MODULE_SALT_TAG=${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:-4626:CreatorOVaultAdminModule:v1.7.1 (default)}"
    echo "  INFRA_DEPLOYMENT_BATCHER_SALT=${INFRA_DEPLOYMENT_BATCHER_SALT:-[auto by tag/default]}"
    echo "  INFRA_DEPLOYMENT_BATCHER_SALT_TAG=${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:-4626:DeploymentBatcher:v1.7.1 (default)}"
    echo ""

    forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
        --rpc-url "$BASE_RPC_URL" \
        --broadcast \
        --verify

    if [ -n "${SOLANA_BRIDGE_ADAPTER:-}" ] && [ -n "${SOLANA_DESTINATION:-}" ]; then
        echo ""
        echo -e "${GREEN}Configuring Solana routing on deployment batcher (DeploymentBatcher)...${NC}"
        forge script script/ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana \
            --rpc-url "$BASE_RPC_URL" \
            --broadcast
    else
        echo ""
        echo -e "${YELLOW}Skipping Solana config (set SOLANA_BRIDGE_ADAPTER + SOLANA_DESTINATION to enable).${NC}"
    fi

    echo ""
    echo -e "${GREEN}Seeding v2 bytecode store (idempotent)...${NC}"
    forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
        --rpc-url "$BASE_RPC_URL" \
        --broadcast

    echo ""
    echo -e "${GREEN}✓ v2 infra deployed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Update frontend defaults with new addresses:"
    echo "   - frontend/src/config/contracts.defaults.ts"
    echo "   - universalBytecodeStore"
    echo "   - universalCreate2DeployerFromStore"
    echo "   - creatorVaultBatcher"
    echo "2. If Solana is enabled, ensure adapter is authorized on LotteryManager"
}

# Deploy vault for creator coin
deploy_vault() {
    echo -e "${RED}Error: ./script/deploy.sh vault is retired.${NC}"
    echo "Use the app deploy-session flow at /deploy."
    exit 1
}

# Deploy via ERC-4337
deploy_aa() {
    echo -e "${RED}Error: ./script/deploy.sh aa is retired.${NC}"
    echo "Use the app deploy-session flow at /deploy."
    exit 1
}

# Main
main() {
    print_banner
    
    local command=$1
    shift
    
    case $command in
        "infrastructure"|"infra")
            check_prereqs
            deploy_infrastructure
            ;;
        "infra-v2"|"deployer-v2"|"v2")
            check_prereqs
            deploy_infra_v2
            ;;
        "vault")
            check_prereqs
            deploy_vault "$@"
            ;;
        "aa"|"4337")
            deploy_aa "$@"
            ;;
        "help"|"-h"|"--help"|"")
            print_usage
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            print_usage
            exit 1
            ;;
    esac
}

main "$@"
