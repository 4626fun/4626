use anchor_lang::prelude::*;

pub const MAX_ENFORCED_OPTIONS_LEN: usize = 512;

#[account]
#[derive(InitSpace)]
pub struct Store {
    pub admin: Pubkey,
    pub operator: Pubkey,
    pub endpoint_program: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PeerConfig {
    pub peer_address: [u8; 32],
    #[max_len(MAX_ENFORCED_OPTIONS_LEN)]
    pub enforced_options: Vec<u8>,
    pub bump: u8,
}
