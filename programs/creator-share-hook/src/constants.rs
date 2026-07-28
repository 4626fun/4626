/// Default fee in basis points (6.9% = 690 bps).
/// Collected via SPL Token-2022 TransferFeeConfig, NOT by this hook.
pub const DEFAULT_FEE_BPS: u16 = 690;

/// Maximum number of entries in the PendingEntries ring buffer.
/// Each LotteryEntry is 48 bytes; 256 * 48 = 12,288 bytes.
pub const MAX_PENDING_ENTRIES: usize = 256;

/// Emergency relay threshold — 80% of MAX_PENDING_ENTRIES.
/// When the buffer exceeds this, Keepr triggers an immediate relay cycle.
pub const EMERGENCY_RELAY_THRESHOLD: usize = (MAX_PENDING_ENTRIES * 8) / 10;

/// Seed prefixes for PDA derivation.
pub const CREATOR_CONFIG_SEED: &[u8] = b"creator_config";
pub const PENDING_ENTRIES_SEED: &[u8] = b"pending_entries";
pub const WINNER_RECORD_SEED: &[u8] = b"winner_record";
/// M2-12 — per-win replay-protection PDA seed.
pub const WIN_ID_SEED: &[u8] = b"win_id";
pub const EXTRA_ACCOUNT_META_LIST_SEED: &[u8] = b"extra-account-metas";

/// Maximum number of known AMM programs per creator config.
pub const MAX_AMM_PROGRAMS: usize = 8;

/// Default settlement threshold in token units (smallest denomination).
/// Fees below this threshold are accumulated until the next settlement.
pub const DEFAULT_SETTLEMENT_THRESHOLD: u64 = 0;

/// Solana runtime cap for account data created or grown via CPI in one step (10 KiB).
/// `PendingEntries::LEN` exceeds this, so `initialize_creator` CPI-creates at this
/// size; `finalize_pending_entries` grows to the full ring-buffer length in a
/// second top-level instruction.
pub const MAX_CPI_ACCOUNT_DATA_LEN: usize = 10 * 1024;
