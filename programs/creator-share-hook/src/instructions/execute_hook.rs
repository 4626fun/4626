use anchor_lang::prelude::*;
use anchor_spl::token_2022;

use crate::constants::*;
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
    pub source_token_account: UncheckedAccount<'info>,

    /// The Token-2022 mint.
    /// CHECK: Validated by the Transfer Hook runtime.
    pub mint: UncheckedAccount<'info>,

    /// Destination token account (tokens flow TO here).
    /// CHECK: Validated by the Transfer Hook runtime.
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
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// PendingEntries PDA — writable to record buy entries.
    #[account(
        mut,
        seeds = [PENDING_ENTRIES_SEED, mint.key().as_ref()],
        bump = pending_entries.bump,
    )]
    pub pending_entries: Box<Account<'info, PendingEntries>>,
}

pub fn handler(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.creator_config;

    // If lottery is disabled, exit early. The hook still "executes" (which
    // is required by the runtime) but doesn't record anything.
    if !config.lottery_enabled {
        return Ok(());
    }

    // Detect if this is a "buy" by checking the source token account owner.
    // A buy = tokens flowing from an AMM pool to a user wallet.
    //
    // We deserialize the source token account to get its owner.
    let source_data = ctx.accounts.source_token_account.try_borrow_data()?;

    // Token-2022 account layout: owner is at bytes 32..64
    if source_data.len() < 64 {
        // Not a valid token account — skip silently.
        return Ok(());
    }
    let source_owner = Pubkey::try_from(&source_data[32..64]).unwrap_or_default();

    // Check if source owner is a known AMM program.
    if !config.is_known_amm(&source_owner) {
        // Not a buy (could be a sell, wallet-to-wallet, or LP operation).
        return Ok(());
    }

    // This is a buy! Record the lottery entry.
    // Buyer = destination token account owner.
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

    let pending = &mut ctx.accounts.pending_entries;
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
