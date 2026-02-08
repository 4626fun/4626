use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct UpdateConfigParams {
    /// New fee_bps (None = keep current).
    pub fee_bps: Option<u16>,
    /// New flush_threshold (None = keep current).
    pub flush_threshold: Option<u64>,
    /// New lottery_enabled (None = keep current).
    pub lottery_enabled: Option<bool>,
}

/// Admin accounts — authority must match `creator_config.authority`.
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    /// The config authority (must sign).
    pub authority: Signer<'info>,

    /// The Token-2022 mint (used for PDA derivation).
    /// CHECK: Only used as a seed.
    pub creator_mint: UncheckedAccount<'info>,

    /// CreatorConfig PDA — mutable for updates.
    #[account(
        mut,
        seeds = [CREATOR_CONFIG_SEED, creator_mint.key().as_ref()],
        bump = creator_config.bump,
        constraint = creator_config.authority == authority.key() @ CreatorShareHookError::UnauthorizedAuthority,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,
}

pub fn update_config_handler(
    ctx: Context<UpdateConfig>,
    params: UpdateConfigParams,
) -> Result<()> {
    let config = &mut ctx.accounts.creator_config;

    if let Some(fee_bps) = params.fee_bps {
        if fee_bps > 10_000 {
            return err!(CreatorShareHookError::InvalidFeeBps);
        }
        config.fee_bps = fee_bps;
    }

    if let Some(flush_threshold) = params.flush_threshold {
        config.flush_threshold = flush_threshold;
    }

    if let Some(lottery_enabled) = params.lottery_enabled {
        config.lottery_enabled = lottery_enabled;
    }

    Ok(())
}

pub fn add_amm_program_handler(ctx: Context<UpdateConfig>, program_id: Pubkey) -> Result<()> {
    ctx.accounts.creator_config.add_amm_program(program_id)
}

pub fn remove_amm_program_handler(ctx: Context<UpdateConfig>, program_id: &Pubkey) -> Result<()> {
    ctx.accounts.creator_config.remove_amm_program(program_id)
}

pub fn rotate_keeper_handler(ctx: Context<UpdateConfig>, new_keeper: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.creator_config;
    let old_keeper = config.keeper_authority;

    config.keeper_authority = new_keeper;

    emit!(KeeperRotated {
        creator_mint: config.creator_mint,
        old_keeper,
        new_keeper,
    });

    Ok(())
}
