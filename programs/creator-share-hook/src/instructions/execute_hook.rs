use anchor_lang::prelude::*;
use anchor_spl::token_2022;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::events::*;
use crate::state::*;

/// Transfer Hook execute — fires on every SPL Token-2022 transfer.
///
/// Detects buys by checking if the source token account owner is a known AMM
/// program. If so, records a lottery entry using the destination token
/// account owner as the buyer.
///
/// This instruction follows the Transfer Hook Interface specification:
/// accounts[0] = source token account
/// accounts[1] = mint
/// accounts[2] = destination token account
/// accounts[3] = source authority / owner
/// accounts[4..] = extra account metas (CreatorConfig, PendingEntries)
#[derive(Accounts)]
pub struct TransferHook<'info> {
    /// Source token account (tokens flow FROM here).
    /// CHECK: Validated by the Transfer Hook runtime.
    #[account(owner = token_2022::ID)]
    pub source_token_account: UncheckedAccount<'info>,

    /// The Token-2022 mint.
    /// CHECK: Validated by the Transfer Hook runtime.
    #[account(owner = token_2022::ID)]
    pub mint: UncheckedAccount<'info>,

    /// Destination token account (tokens flow TO here).
    /// CHECK: Validated by the Transfer Hook runtime.
    #[account(owner = token_2022::ID)]
    pub destination_token_account: UncheckedAccount<'info>,

    /// Source authority (owner or delegate that signed the transfer).
    /// CHECK: Validated by the Transfer Hook runtime.
    pub authority: UncheckedAccount<'info>,

    /// Extra account meta list PDA (required by the interface).
    /// CHECK: Validated by the Transfer Hook runtime via seeds.
    #[account(
        seeds = [EXTRA_ACCOUNT_META_LIST_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_meta_list: UncheckedAccount<'info>,

    /// CreatorConfig PDA — read-only for AMM detection.
    #[account(
        seeds = [CREATOR_CONFIG_SEED, mint.key().as_ref()],
        bump = creator_config.bump,
        constraint = creator_config.creator_mint == mint.key() @ CreatorShareHookError::InvalidMint,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// PendingEntries PDA — zero-copy, writable to record buy entries.
    #[account(
        mut,
        seeds = [PENDING_ENTRIES_SEED, mint.key().as_ref()],
        bump,
        constraint = pending_entries.load()?.creator_mint == mint.key() @ CreatorShareHookError::InvalidMint,
    )]
    pub pending_entries: AccountLoader<'info, PendingEntries>,
}

pub fn handler(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.creator_config;

    if !config.lottery_enabled {
        return Ok(());
    }

    let source_data = ctx.accounts.source_token_account.try_borrow_data()?;

    if source_data.len() < 64 {
        return Ok(());
    }
    let source_owner = Pubkey::try_from(&source_data[32..64]).unwrap_or_default();

    if !config.is_known_amm(&source_owner) {
        return Ok(());
    }

    let dest_data = ctx.accounts.destination_token_account.try_borrow_data()?;
    if dest_data.len() < 64 {
        return Ok(());
    }
    let buyer = Pubkey::try_from(&dest_data[32..64]).unwrap_or_default();

    let clock = Clock::get()?;
    let entry = LotteryEntry {
        buyer,
        amount,
        slot: clock.slot,
    };

    let mut pending = ctx.accounts.pending_entries.load_mut()?;
    let overflowed = pending.push(entry);

    if overflowed {
        emit!(EntryOverflow {
            creator_mint: config.creator_mint,
            total_overflow_count: pending.overflow_count,
        });
    }

    emit!(LotteryEntryRecorded {
        creator_mint: config.creator_mint,
        buyer,
        amount,
        slot: clock.slot,
        buffer_count: pending.count,
    });

    Ok(())
}
