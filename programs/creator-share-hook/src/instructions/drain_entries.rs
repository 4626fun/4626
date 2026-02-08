use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::events::*;
use crate::state::*;

/// Keeper-only: read and clear all pending lottery entries.
///
/// The keeper calls this to drain the PendingEntries ring buffer, then
/// relays the entries to Base via `SolanaBridgeAdapter.processLotteryEntryFromSolana()`.
///
/// Entries are emitted as an Anchor event for the keeper to read from
/// the transaction logs. The buffer is reset after draining.
#[derive(Accounts)]
pub struct DrainEntries<'info> {
    /// The keeper authority (must match `creator_config.keeper_authority`).
    pub keeper: Signer<'info>,

    /// CreatorConfig PDA — used to verify keeper authority.
    #[account(
        seeds = [CREATOR_CONFIG_SEED, creator_mint.key().as_ref()],
        bump = creator_config.bump,
        constraint = creator_config.keeper_authority == keeper.key() @ CreatorShareHookError::UnauthorizedKeeper,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// The Token-2022 mint (used for PDA derivation).
    /// CHECK: Only used as a seed — validated via PDA constraints.
    pub creator_mint: UncheckedAccount<'info>,

    /// PendingEntries PDA — mutable to drain entries.
    #[account(
        mut,
        seeds = [PENDING_ENTRIES_SEED, creator_mint.key().as_ref()],
        bump = pending_entries.bump,
    )]
    pub pending_entries: Box<Account<'info, PendingEntries>>,
}

pub fn handler(ctx: Context<DrainEntries>) -> Result<()> {
    let pending = &mut ctx.accounts.pending_entries;

    if pending.count == 0 {
        return err!(CreatorShareHookError::NoPendingEntries);
    }

    let count = pending.count;
    let head = pending.head as usize;
    let max = MAX_PENDING_ENTRIES;

    // Calculate start index (oldest entry).
    let start = if (count as usize) < max { 0 } else { head };

    // Emit each entry individually to avoid allocating a Vec on the stack.
    for i in 0..(count as usize) {
        let idx = (start + i) % max;
        let entry = &pending.entries[idx];
        emit!(LotteryEntryRecorded {
            creator_mint: ctx.accounts.creator_config.creator_mint,
            buyer: entry.buyer,
            amount: entry.amount,
            slot: entry.slot,
            buffer_count: 0, // Already drained
        });
    }

    let overflow_count = pending.overflow_count;

    // Reset the buffer.
    pending.head = 0;
    pending.count = 0;
    // Note: overflow_count is preserved; entries are not zeroed.

    // Emit summary event.
    emit!(EntriesDrained {
        creator_mint: ctx.accounts.creator_config.creator_mint,
        count,
        overflow_count,
    });

    Ok(())
}
