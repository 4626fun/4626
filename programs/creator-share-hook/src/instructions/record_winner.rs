use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::events::*;
use crate::state::*;

/// Keeper-only: record a lottery winner on Solana.
///
/// Called by the Keepr `keepr-solana-winner-relay` workflow after a win
/// is detected on Base via the `LotteryWinnerNotification` event.
///
/// M2-12: `win_id` is a non-zero Base-side digest (e.g. keccak of
/// blockNumber‖logIndex‖creatorCoin‖winner). A unique PDA is created per
/// `win_id` so replays are rejected. `WinnerRecord` still holds the latest
/// winner for frontend "You won!" UX.
///
/// L2-06: `creator_mint` is cross-checked against both config and winner PDAs.
#[derive(Accounts)]
#[instruction(winner: Pubkey, shares_paid: u64, win_id: [u8; 32])]
pub struct RecordWinner<'info> {
    /// The keeper authority (must match `creator_config.keeper_authority`).
    /// Pays rent for the one-shot win_id PDA.
    #[account(mut)]
    pub keeper: Signer<'info>,

    /// CreatorConfig PDA — used to verify keeper authority.
    #[account(
        seeds = [CREATOR_CONFIG_SEED, creator_mint.key().as_ref()],
        bump = creator_config.bump,
        constraint = creator_config.keeper_authority == keeper.key() @ CreatorShareHookError::UnauthorizedKeeper,
        constraint = creator_config.creator_mint == creator_mint.key() @ CreatorShareHookError::InvalidMint,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// The Token-2022 mint (used for PDA derivation).
    /// CHECK: Cross-constrained against creator_config / winner_record mints.
    pub creator_mint: UncheckedAccount<'info>,

    /// WinnerRecord PDA — mutable to update with latest winner (display).
    #[account(
        mut,
        seeds = [WINNER_RECORD_SEED, creator_mint.key().as_ref()],
        bump = winner_record.bump,
        constraint = winner_record.creator_mint == creator_mint.key() @ CreatorShareHookError::InvalidMint,
    )]
    pub winner_record: Box<Account<'info, WinnerRecord>>,

    /// M2-12 — one-shot PDA keyed by win_id. Init fails if the win was already recorded.
    #[account(
        init,
        payer = keeper,
        space = WinIdRecord::LEN,
        seeds = [WIN_ID_SEED, creator_mint.key().as_ref(), win_id.as_ref()],
        bump,
    )]
    pub win_id_record: Box<Account<'info, WinIdRecord>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RecordWinner>,
    winner: Pubkey,
    shares_paid: u64,
    win_id: [u8; 32],
) -> Result<()> {
    // M2-12: reject zero win_id (would collapse all unset digests).
    if win_id == [0u8; 32] {
        return err!(CreatorShareHookError::InvalidWinId);
    }

    let clock = Clock::get()?;

    // Persist one-shot win identity (PDA init already enforces uniqueness).
    let win_rec = &mut ctx.accounts.win_id_record;
    win_rec.creator_mint = ctx.accounts.creator_mint.key();
    win_rec.win_id = win_id;
    win_rec.winner = winner;
    win_rec.shares_paid = shares_paid;
    win_rec.timestamp = clock.unix_timestamp;
    win_rec.bump = ctx.bumps.win_id_record;

    // Latest-winner display surface (overwrites previous).
    let record = &mut ctx.accounts.winner_record;
    record.winner = winner;
    record.shares_paid = shares_paid;
    record.timestamp = clock.unix_timestamp;

    emit!(WinnerNotified {
        creator_mint: ctx.accounts.creator_config.creator_mint,
        winner,
        shares_paid,
        timestamp: clock.unix_timestamp,
        win_id,
    });

    Ok(())
}
