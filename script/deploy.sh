#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
#                    4626 Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./script/deploy.sh infrastructure    - Deploy all core contracts
#   ./script/deploy.sh infra-v2          - Deploy phased infra + seed bytecode store
#   ./script/deploy.sh release           - Canonical Base v1.8.3 full release rollout
#   ./script/deploy.sh full-release      - Same as release
#
# Environment:
#   PRIVATE_KEY         - Deployer private key
#   RPC_URL             - Base RPC URL (default: https://mainnet.base.org)
#   BASE_RPC_URL        - Base RPC URL for v2 deployer (Alchemy recommended)
#   ETHERSCAN_API_KEY   - For contract verification
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
    echo "  ./script/deploy.sh release                Deploy fresh shared/global + deterministic v2 infra"
    echo "  ./script/deploy.sh full-release           Same as release"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./script/deploy.sh infrastructure"
    echo "  ./script/deploy.sh infra-v2"
    echo "  ./script/deploy.sh release"
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
    bash "$ROOT_DIR/script/deploy-infra-v2.sh"
}

# Canonical Base release wrapper
deploy_base_full_release() {
    bash "$ROOT_DIR/script/deploy-base-full-release.sh"
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
        "release"|"base-release"|"full-release")
            check_prereqs
            deploy_base_full_release
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
