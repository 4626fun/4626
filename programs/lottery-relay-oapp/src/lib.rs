mod instructions;
mod message;
mod state;

use anchor_lang::prelude::*;
use instructions::*;
use solana_helper::program_id_from_env;
use state::*;

// Every deployable artifact is independently checked for these resolved bytes;
// changing LOTTERY_RELAY_OAPP_ID must force a fresh program-crate compilation.
declare_id!(anchor_lang::solana_program::pubkey::Pubkey::new_from_array(program_id_from_env!(
    "LOTTERY_RELAY_OAPP_ID",
    "8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC"
)));

pub const STORE_SEED: &[u8] = b"Store";
pub const PEER_SEED: &[u8] = b"Peer";
/// Base mainnet. The default production artifact is permanently bound here.
#[cfg(not(feature = "test-route"))]
pub const BASE_EID: u32 = 30_184;
/// Base Sepolia. The test-route feature is compiled into a separately
/// deployed, non-production program ID for the end-to-end rehearsal only.
#[cfg(feature = "test-route")]
pub const BASE_EID: u32 = 40_245;
pub const CANONICAL_BASE_LOTTERY_MANAGER: [u8; 20] = [
    0xb4, 0x5e, 0x68, 0xa5, 0x86, 0x79, 0x35, 0xa5, 0x73, 0x4e,
    0x41, 0x85, 0x97, 0x7f, 0x81, 0xc5, 0x28, 0x00, 0x66, 0x50,
];

pub fn canonical_base_peer() -> [u8; 32] {
    let mut peer = [0u8; 32];
    peer[12..].copy_from_slice(&CANONICAL_BASE_LOTTERY_MANAGER);
    peer
}

/// Production accepts exactly the canonical Base LotteryManager. The test-only
/// build accepts one EVM-shaped peer supplied by its test deployment: twelve
/// leading zero bytes and a nonzero 20-byte receiver. This preserves the
/// address binding in production while allowing a separately deployed test
/// receiver to prove the transport without ever targeting Base mainnet.
pub fn is_allowed_destination_peer(peer: &[u8; 32]) -> bool {
    #[cfg(not(feature = "test-route"))]
    {
        peer == &canonical_base_peer()
    }

    #[cfg(feature = "test-route")]
    {
        peer[..12] == [0u8; 12] && peer[12..].iter().any(|byte| *byte != 0)
    }
}

#[program]
pub mod lottery_relay_oapp {
    use super::*;

    pub fn init_store(mut ctx: Context<InitStore>, params: InitStoreParams) -> Result<()> {
        InitStore::apply(&mut ctx, &params)
    }

    pub fn set_base_peer(
        mut ctx: Context<SetBasePeer>,
        params: SetBasePeerParams,
    ) -> Result<()> {
        SetBasePeer::apply(&mut ctx, &params)
    }

    pub fn set_operator(mut ctx: Context<SetOperator>, params: SetOperatorParams) -> Result<()> {
        SetOperator::apply(&mut ctx, &params)
    }

    pub fn quote_send(
        ctx: Context<QuoteSend>,
        params: QuoteSendParams,
    ) -> Result<LotteryMessagingFee> {
        QuoteSend::apply(&ctx, &params)
    }

    pub fn send_lottery_entry(
        mut ctx: Context<SendLotteryEntry>,
        params: SendLotteryEntryParams,
    ) -> Result<()> {
        SendLotteryEntry::apply(&mut ctx, &params)
    }
}

#[cfg(test)]
mod tests {
    use super::{canonical_base_peer, is_allowed_destination_peer, CANONICAL_BASE_LOTTERY_MANAGER};

    #[test]
    fn canonical_peer_is_left_padded_base_lottery_manager() {
        let peer = canonical_base_peer();
        assert_eq!(&peer[..12], &[0u8; 12]);
        assert_eq!(&peer[12..], &CANONICAL_BASE_LOTTERY_MANAGER);
    }

    #[cfg(not(feature = "test-route"))]
    #[test]
    fn production_route_accepts_only_the_canonical_base_peer() {
        assert!(is_allowed_destination_peer(&canonical_base_peer()));
        assert!(!is_allowed_destination_peer(&[0u8; 32]));
        assert!(!is_allowed_destination_peer(&[1u8; 32]));
    }

    #[cfg(feature = "test-route")]
    #[test]
    fn test_route_accepts_only_a_nonzero_left_padded_evm_receiver() {
        let mut receiver = [0u8; 32];
        receiver[31] = 1;
        assert!(is_allowed_destination_peer(&receiver));
        assert!(!is_allowed_destination_peer(&[0u8; 32]));
        assert!(!is_allowed_destination_peer(&[1u8; 32]));
    }
}
