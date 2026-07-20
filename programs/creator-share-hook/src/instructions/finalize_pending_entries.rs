use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::Discriminator;
use bytemuck::from_bytes_mut;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::state::*;

/// Grow the PendingEntries PDA from the CPI create shell (10 KiB) to the full
/// zero-copy layout and initialize ring-buffer fields.
///
/// Must run after `initialize_creator` and before any transfer-hook writes.
/// Safe to bundle in the same transaction as a second top-level instruction.
#[derive(Accounts)]
pub struct FinalizePendingEntries<'info> {
    /// Config / mint authority (payer for any additional rent).
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Seed only; must match CreatorConfig.creator_mint.
    pub creator_mint: UncheckedAccount<'info>,

    #[account(
        seeds = [CREATOR_CONFIG_SEED, creator_mint.key().as_ref()],
        bump = creator_config.bump,
        has_one = authority @ CreatorShareHookError::UnauthorizedAuthority,
        constraint = creator_config.creator_mint == creator_mint.key() @ CreatorShareHookError::InvalidMint,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// CHECK: PDA shell from `initialize_creator`; resized and typed here.
    #[account(
        mut,
        seeds = [PENDING_ENTRIES_SEED, creator_mint.key().as_ref()],
        bump,
    )]
    pub pending_entries: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<FinalizePendingEntries>) -> Result<()> {
    let pending_info = ctx.accounts.pending_entries.to_account_info();
    let current_len = pending_info.data_len();
    let target_len = PendingEntries::LEN;

    // Already finalized (idempotent success).
    if current_len == target_len {
        let data = pending_info.try_borrow_data()?;
        if data.len() >= 8 && data[..8] == *PendingEntries::DISCRIMINATOR {
            return Ok(());
        }
        return err!(CreatorShareHookError::PendingEntriesResizeFailed);
    }

    // Expected preimage: CPI shell from initialize_creator.
    if current_len != MAX_CPI_ACCOUNT_DATA_LEN {
        return err!(CreatorShareHookError::PendingEntriesResizeFailed);
    }

    let growth = target_len - current_len;
    if growth > MAX_CPI_ACCOUNT_DATA_LEN {
        return err!(CreatorShareHookError::PendingEntriesResizeFailed);
    }

    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(target_len);
    let current_lamports = pending_info.lamports();
    if required_lamports > current_lamports {
        let diff = required_lamports - current_lamports;
        invoke(
            &system_instruction::transfer(
                ctx.accounts.authority.key,
                pending_info.key,
                diff,
            ),
            &[
                ctx.accounts.authority.to_account_info(),
                pending_info.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    pending_info
        .resize(target_len)
        .map_err(|_| error!(CreatorShareHookError::PendingEntriesResizeFailed))?;

    {
        let mut data = pending_info.try_borrow_mut_data()?;
        if data.len() != target_len {
            return err!(CreatorShareHookError::PendingEntriesResizeFailed);
        }
        // Shell must still be zeroed (no discriminator yet).
        if data.iter().any(|b| *b != 0) {
            return err!(CreatorShareHookError::PendingEntriesResizeFailed);
        }
        data[..8].copy_from_slice(PendingEntries::DISCRIMINATOR);
        let entries: &mut PendingEntries = from_bytes_mut(&mut data[8..]);
        entries.creator_mint = ctx.accounts.creator_mint.key();
        entries.head = 0;
        entries.count = 0;
        entries.overflow_count = 0;
        entries.bump = ctx.bumps.pending_entries;
        entries._padding = [0u8; 7];
    }

    Ok(())
}
