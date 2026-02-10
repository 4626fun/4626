use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct InitializeCreatorParams {
    /// The authorized keeper pubkey for this creator.
    pub keeper_authority: Pubkey,
    /// Hub Creator Coin address (Base) encoded as bytes32.
    pub hub_creator_coin: [u8; 32],
    /// Hub ShareOFT address (Base) encoded as bytes32.
    pub hub_share_oft: [u8; 32],
    /// Fee in basis points (informational, enforced by TransferFeeConfig).
    pub fee_bps: u16,
    /// Minimum withheld fee amount before flush_fees will execute.
    pub flush_threshold: u64,
    /// Whether lottery entry recording is enabled.
    pub lottery_enabled: bool,
    /// Initial known AMM programs for buy detection.
    pub known_amm_programs: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeCreator<'info> {
    /// The authority creating this config (must sign).
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The Token-2022 mint for this creator's share token.
    /// CHECK: We only store its key; no deserialization needed.
    pub creator_mint: UncheckedAccount<'info>,

    /// CreatorConfig PDA — initialized here.
    #[account(
        init,
        payer = authority,
        space = CreatorConfig::LEN,
        seeds = [CREATOR_CONFIG_SEED, creator_mint.key().as_ref()],
        bump,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// PendingEntries PDA — initialized here.
    #[account(
        init,
        payer = authority,
        space = PendingEntries::LEN,
        seeds = [PENDING_ENTRIES_SEED, creator_mint.key().as_ref()],
        bump,
    )]
    pub pending_entries: Box<Account<'info, PendingEntries>>,

    /// WinnerRecord PDA — initialized here.
    #[account(
        init,
        payer = authority,
        space = WinnerRecord::LEN,
        seeds = [WINNER_RECORD_SEED, creator_mint.key().as_ref()],
        bump,
    )]
    pub winner_record: Box<Account<'info, WinnerRecord>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeCreator>, params: InitializeCreatorParams) -> Result<()> {
    if params.fee_bps > 10_000 {
        return err!(CreatorShareHookError::InvalidFeeBps);
    }
    if params.known_amm_programs.len() > MAX_AMM_PROGRAMS {
        return err!(CreatorShareHookError::AmmListFull);
    }

    // Initialize CreatorConfig.
    let config = &mut ctx.accounts.creator_config;
    config.creator_mint = ctx.accounts.creator_mint.key();
    config.authority = ctx.accounts.authority.key();
    config.keeper_authority = params.keeper_authority;
    config.hub_creator_coin = params.hub_creator_coin;
    config.hub_share_oft = params.hub_share_oft;
    config.fee_bps = params.fee_bps;
    config.flush_threshold = params.flush_threshold;
    config.lottery_enabled = params.lottery_enabled;
    config.amm_program_count = params.known_amm_programs.len() as u8;
    config.bump = ctx.bumps.creator_config;
    config._reserved = [0u8; 64];

    for (i, amm) in params.known_amm_programs.iter().enumerate() {
        config.known_amm_programs[i] = *amm;
    }

    // Initialize PendingEntries.
    let entries = &mut ctx.accounts.pending_entries;
    entries.creator_mint = ctx.accounts.creator_mint.key();
    entries.head = 0;
    entries.count = 0;
    entries.overflow_count = 0;
    entries.bump = ctx.bumps.pending_entries;

    // Initialize WinnerRecord.
    let winner = &mut ctx.accounts.winner_record;
    winner.creator_mint = ctx.accounts.creator_mint.key();
    winner.winner = Pubkey::default();
    winner.shares_paid = 0;
    winner.timestamp = 0;
    winner.bump = ctx.bumps.winner_record;

    Ok(())
}
