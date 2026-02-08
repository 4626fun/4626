use anchor_lang::prelude::*;

use crate::constants::*;

/// A single lottery entry recorded by the Transfer Hook on a buy.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
pub struct LotteryEntry {
    /// The buyer's wallet pubkey (destination token account owner).
    pub buyer: Pubkey,
    /// Amount of tokens transferred (in mint's smallest denomination).
    pub amount: u64,
    /// Solana slot at which the buy occurred.
    pub slot: u64,
}

impl LotteryEntry {
    pub const LEN: usize = 32 + 8 + 8; // 48 bytes
}

/// Ring buffer of pending lottery entries for a creator mint.
///
/// Seeds: `[PENDING_ENTRIES_SEED, creator_mint.key()]`
///
/// The keeper drains this buffer periodically and relays entries to Base.
/// Overflow policy: drop-oldest (head advances, oldest overwritten).
#[account]
#[derive(Debug)]
pub struct PendingEntries {
    /// The creator mint this buffer belongs to.
    pub creator_mint: Pubkey,

    /// Write pointer — next slot to write into.
    pub head: u32,

    /// Number of entries currently in the buffer (0..=MAX_PENDING_ENTRIES).
    pub count: u32,

    /// Total number of entries dropped due to overflow.
    /// Keepr monitors this counter between polls.
    pub overflow_count: u64,

    /// Bump seed for PDA derivation.
    pub bump: u8,

    /// The ring buffer itself.
    pub entries: [LotteryEntry; MAX_PENDING_ENTRIES],
}

impl PendingEntries {
    /// Account discriminator (8) + fields.
    /// 32 + 4 + 4 + 8 + 1 + (48 * 256) = 32 + 4 + 4 + 8 + 1 + 12288 = 12337
    /// Total with discriminator: 8 + 12337 = 12345
    pub const LEN: usize = 8 + 32 + 4 + 4 + 8 + 1 + (LotteryEntry::LEN * MAX_PENDING_ENTRIES);

    /// Push a new entry into the ring buffer.
    /// If the buffer is full, the oldest entry is overwritten (drop-oldest).
    pub fn push(&mut self, entry: LotteryEntry) -> bool {
        let idx = self.head as usize;
        let was_full = self.count as usize >= MAX_PENDING_ENTRIES;

        self.entries[idx] = entry;
        self.head = ((idx + 1) % MAX_PENDING_ENTRIES) as u32;

        if was_full {
            self.overflow_count += 1;
            // count stays at MAX — we overwrote the oldest
        } else {
            self.count += 1;
        }

        was_full
    }

    /// Drain all entries from the buffer, returning them as a Vec.
    /// Resets head and count to 0. Preserves overflow_count.
    pub fn drain_all(&mut self) -> Vec<LotteryEntry> {
        let count = self.count as usize;
        if count == 0 {
            return Vec::new();
        }

        let max = MAX_PENDING_ENTRIES;
        let head = self.head as usize;

        // Calculate start index (oldest entry).
        let start = if count < max { 0 } else { head };

        let mut result = Vec::with_capacity(count);
        for i in 0..count {
            let idx = (start + i) % max;
            result.push(self.entries[idx]);
        }

        // Reset the buffer.
        self.head = 0;
        self.count = 0;
        // Note: we do NOT zero entries — they'll be overwritten on next push.

        result
    }

    /// Returns true if the buffer has exceeded the emergency drain threshold.
    pub fn needs_emergency_drain(&self) -> bool {
        self.count as usize >= EMERGENCY_DRAIN_THRESHOLD
    }
}
