use anchor_lang::prelude::*;

#[error_code]
pub enum CreatorShareHookError {
    #[msg("Unauthorized: caller is not the keeper authority")]
    UnauthorizedKeeper,

    #[msg("Unauthorized: caller is not the config authority")]
    UnauthorizedAuthority,

    #[msg("AMM program list is full (max 8)")]
    AmmListFull,

    #[msg("AMM program not found in allowlist")]
    AmmNotFound,

    #[msg("AMM program already in allowlist")]
    AmmAlreadyExists,

    #[msg("Lottery is not enabled for this creator")]
    LotteryDisabled,

    #[msg("No pending entries to relay")]
    NoEntriesToRelay,

    #[msg("Invalid mint — does not match config")]
    InvalidMint,

    #[msg("PendingEntries buffer overflow counter mismatch")]
    OverflowCounterMismatch,

    #[msg("Invalid fee BPS — must be <= 10000")]
    InvalidFeeBps,

    #[msg("Extra account meta list already initialized")]
    MetaListAlreadyInitialized,

    #[msg("Token account could not be unpacked as a Token-2022 account")]
    InvalidTokenAccount,

    #[msg("Token account mint does not match the hooked mint")]
    MintMismatch,

    #[msg("No Token-2022 transfer in progress — hook invoked outside a real transfer")]
    TransferNotInProgress,

    /// M2-12 — win_id must be non-zero.
    #[msg("Invalid win_id — zero win_id is not allowed")]
    InvalidWinId,

    /// M2-12 — same Base win cannot be recorded twice.
    #[msg("Duplicate win_id — this Base win was already recorded")]
    DuplicateWinId,

    /// M2-13 — withheld fees below configured settlement threshold.
    #[msg("Withheld fees below settlement_threshold")]
    BelowSettlementThreshold,

    /// M2-13 — keeper is not the mint TransferFeeConfig withdraw_withheld_authority.
    #[msg("Keeper is not the TransferFeeConfig withdraw_withheld_authority")]
    UnauthorizedWithdrawAuthority,

    /// M2-13 — mint is missing TransferFeeConfig extension.
    #[msg("Mint is missing TransferFeeConfig extension")]
    MissingTransferFeeConfig,
}
