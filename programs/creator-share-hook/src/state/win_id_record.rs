use anchor_lang::prelude::*;

/// Replay-protection PDA for a single Base lottery win (M2-12).
///
/// Seeds: `[WIN_ID_SEED, creator_mint.key(), win_id]`
///
/// Created once per unique `win_id`. A second `record_winner` with the same
/// `win_id` fails account init (`already in use`) / explicit `DuplicateWinId`.
#[account]
#[derive(Debug)]
pub struct WinIdRecord {
    /// Creator mint this win belongs to.
    pub creator_mint: Pubkey,
    /// Opaque Base-side win identity (event digest / block:log hash).
    pub win_id: [u8; 32],
    /// Winner Solana pubkey recorded for this win.
    pub winner: Pubkey,
    /// Shares paid (Base units).
    pub shares_paid: u64,
    /// Unix timestamp when recorded.
    pub timestamp: i64,
    pub bump: u8,
}

impl WinIdRecord {
    /// 8 disc + 32 mint + 32 win_id + 32 winner + 8 shares + 8 ts + 1 bump = 121
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1;
}
