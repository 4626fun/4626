#[cfg(test)]
mod tests {
    use super::super::pending_entries::*;
    use crate::constants::*;
    use anchor_lang::prelude::Pubkey;

    fn make_entry(buyer_seed: u8, amount: u64, slot: u64) -> LotteryEntry {
        let mut buyer_bytes = [0u8; 32];
        buyer_bytes[0] = buyer_seed;
        LotteryEntry {
            buyer: Pubkey::new_from_array(buyer_bytes),
            amount,
            slot,
        }
    }

    fn new_pending_entries() -> PendingEntries {
        PendingEntries {
            creator_mint: Pubkey::default(),
            head: 0,
            count: 0,
            overflow_count: 0,
            bump: 0,
            entries: [LotteryEntry::default(); MAX_PENDING_ENTRIES],
        }
    }

    #[test]
    fn test_push_single() {
        let mut pe = new_pending_entries();
        let entry = make_entry(1, 1000, 100);
        let was_full = pe.push(entry);

        assert!(!was_full);
        assert_eq!(pe.count, 1);
        assert_eq!(pe.head, 1);
        assert_eq!(pe.overflow_count, 0);
        assert_eq!(pe.entries[0].amount, 1000);
    }

    #[test]
    fn test_push_fills_buffer() {
        let mut pe = new_pending_entries();

        for i in 0..MAX_PENDING_ENTRIES {
            let was_full = pe.push(make_entry(i as u8, (i + 1) as u64 * 100, i as u64));
            assert!(!was_full, "Should not be full at index {}", i);
        }

        assert_eq!(pe.count as usize, MAX_PENDING_ENTRIES);
        assert_eq!(pe.head, 0); // wraps around
        assert_eq!(pe.overflow_count, 0);
    }

    #[test]
    fn test_push_overflow_drops_oldest() {
        let mut pe = new_pending_entries();

        // Fill buffer
        for i in 0..MAX_PENDING_ENTRIES {
            pe.push(make_entry(i as u8, (i + 1) as u64 * 100, i as u64));
        }

        // Push one more — should overflow
        let was_full = pe.push(make_entry(255, 99999, 999));
        assert!(was_full, "Should be full (overflow)");
        assert_eq!(pe.count as usize, MAX_PENDING_ENTRIES);
        assert_eq!(pe.overflow_count, 1);
        assert_eq!(pe.head, 1); // advanced past slot 0

        // Verify the newest entry overwrote slot 0
        assert_eq!(pe.entries[0].amount, 99999);
    }

    #[test]
    fn test_push_multiple_overflows() {
        let mut pe = new_pending_entries();

        // Fill buffer
        for i in 0..MAX_PENDING_ENTRIES {
            pe.push(make_entry(i as u8, 100, i as u64));
        }

        // Overflow 10 times
        for i in 0..10u64 {
            let was_full = pe.push(make_entry(0, i + 1, 1000 + i));
            assert!(was_full);
        }

        assert_eq!(pe.overflow_count, 10);
        assert_eq!(pe.count as usize, MAX_PENDING_ENTRIES);
    }

    #[test]
    fn test_drain_all_empty() {
        let mut pe = new_pending_entries();
        let drained = pe.drain_all();
        assert!(drained.is_empty());
    }

    #[test]
    fn test_drain_all_partial() {
        let mut pe = new_pending_entries();

        pe.push(make_entry(1, 100, 1));
        pe.push(make_entry(2, 200, 2));
        pe.push(make_entry(3, 300, 3));

        let drained = pe.drain_all();
        assert_eq!(drained.len(), 3);
        assert_eq!(drained[0].amount, 100);
        assert_eq!(drained[1].amount, 200);
        assert_eq!(drained[2].amount, 300);

        // Buffer should be empty after drain
        assert_eq!(pe.count, 0);
        assert_eq!(pe.head, 0);
    }

    #[test]
    fn test_drain_all_full_preserves_order() {
        let mut pe = new_pending_entries();

        // Fill buffer completely
        for i in 0..MAX_PENDING_ENTRIES {
            pe.push(make_entry(i as u8, (i + 1) as u64 * 100, i as u64));
        }

        let drained = pe.drain_all();
        assert_eq!(drained.len(), MAX_PENDING_ENTRIES);

        // Entries should be in insertion order (oldest first)
        for (i, entry) in drained.iter().enumerate() {
            assert_eq!(entry.amount, (i + 1) as u64 * 100);
        }
    }

    #[test]
    fn test_drain_after_overflow_gives_correct_order() {
        let mut pe = new_pending_entries();

        // Fill buffer
        for i in 0..MAX_PENDING_ENTRIES {
            pe.push(make_entry(i as u8, (i + 1) as u64, i as u64));
        }

        // Overflow 3 times
        pe.push(make_entry(0, 1001, 500));
        pe.push(make_entry(0, 1002, 501));
        pe.push(make_entry(0, 1003, 502));

        assert_eq!(pe.overflow_count, 3);

        let drained = pe.drain_all();
        assert_eq!(drained.len(), MAX_PENDING_ENTRIES);

        // The oldest 3 entries were overwritten, so the first entry should be
        // the 4th original entry (index 3, amount = 4)
        assert_eq!(drained[0].amount, 4);

        // The last 3 entries should be the overflow entries
        let last = drained.len();
        assert_eq!(drained[last - 3].amount, 1001);
        assert_eq!(drained[last - 2].amount, 1002);
        assert_eq!(drained[last - 1].amount, 1003);
    }

    #[test]
    fn test_drain_preserves_overflow_count() {
        let mut pe = new_pending_entries();

        for i in 0..MAX_PENDING_ENTRIES {
            pe.push(make_entry(i as u8, 100, i as u64));
        }
        pe.push(make_entry(0, 200, 999)); // overflow
        assert_eq!(pe.overflow_count, 1);

        pe.drain_all();

        // overflow_count is preserved
        assert_eq!(pe.overflow_count, 1);
        assert_eq!(pe.count, 0);
        assert_eq!(pe.head, 0);
    }

    #[test]
    fn test_needs_emergency_drain() {
        let mut pe = new_pending_entries();

        // Below threshold
        for i in 0..(EMERGENCY_DRAIN_THRESHOLD - 1) {
            pe.push(make_entry(i as u8, 100, i as u64));
        }
        assert!(!pe.needs_emergency_drain());

        // At threshold
        pe.push(make_entry(0, 100, 999));
        assert!(pe.needs_emergency_drain());
    }

    #[test]
    fn test_push_then_drain_then_push_again() {
        let mut pe = new_pending_entries();

        pe.push(make_entry(1, 100, 1));
        pe.push(make_entry(2, 200, 2));

        let drained = pe.drain_all();
        assert_eq!(drained.len(), 2);

        // Push again after drain
        pe.push(make_entry(3, 300, 3));
        assert_eq!(pe.count, 1);
        assert_eq!(pe.head, 1);
        assert_eq!(pe.entries[0].amount, 300);
    }
}
