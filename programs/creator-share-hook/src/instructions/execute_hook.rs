use anchor_lang::prelude::*;
use anchor_spl::token_2022;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{transfer_hook::TransferHookAccount, BaseStateWithExtensions, StateWithExtensions},
    state::Account as SplTokenAccount,
};

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

fn is_allowlisted_buy(config: &CreatorConfig, authority: &Pubkey, source_owner: &Pubkey) -> bool {
    config.is_known_amm(authority) && authority == source_owner
}

/// Prove the account is a live Token-2022 token account of the hooked mint
/// that is *currently mid-transfer*.
///
/// Token-2022 sets the `TransferHookAccount.transferring` flag on both source
/// and destination immediately before CPI-ing into the hook and clears it
/// after, and no other program can set it. Requiring it (plus the mint
/// binding) means lottery entries can only be recorded during a genuine
/// transfer of this share mint — direct invocations of `transfer_hook` or the
/// raw SPL `execute` discriminator with fabricated accounts fail here
/// (audit C-01 / H2-06).
fn require_transferring_token_account(
    account_info: &AccountInfo,
    expected_mint: &Pubkey,
) -> Result<Pubkey> {
    let data = account_info.try_borrow_data()?;
    let state = StateWithExtensions::<SplTokenAccount>::unpack(&data)
        .map_err(|_| CreatorShareHookError::InvalidTokenAccount)?;
    require_keys_eq!(
        state.base.mint,
        *expected_mint,
        CreatorShareHookError::MintMismatch
    );
    let hook_ext = state
        .get_extension::<TransferHookAccount>()
        .map_err(|_| CreatorShareHookError::TransferNotInProgress)?;
    require!(
        bool::from(hook_ext.transferring),
        CreatorShareHookError::TransferNotInProgress
    );
    Ok(state.base.owner)
}

pub fn handler(mut ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    process_transfer_hook(&mut ctx.accounts, amount)
}

/// Resolve a lottery-eligible buyer for one TransferHook invocation.
///
/// Returns `Ok(Some(buyer))` when this call must emit exactly one
/// `LotteryEntryRecorded`. Returns `Ok(None)` for non-buys / lottery-off
/// (silent no-op). Errors on forged token accounts (audit C-01 / H2-06).
///
/// One qualifying buy transfer ⇒ one authentic eligibility event (SOL-P0-04).
/// Two qualifying instructions in one transaction each call this once ⇒ two
/// events with distinct instruction indices for durable source identity.
pub(crate) fn resolve_lottery_buy_buyer(
    config: &CreatorConfig,
    authority: &Pubkey,
    mint: &Pubkey,
    source_token_account: &AccountInfo,
    destination_token_account: &AccountInfo,
) -> Result<Option<Pubkey>> {
    if !config.lottery_enabled {
        return Ok(None);
    }
    if !config.is_known_amm(authority) {
        return Ok(None);
    }

    let source_owner = require_transferring_token_account(source_token_account, mint)?;
    if !is_allowlisted_buy(config, authority, &source_owner) {
        return Ok(None);
    }

    let buyer = require_transferring_token_account(destination_token_account, mint)?;
    if buyer == Pubkey::default() {
        return Ok(None);
    }
    Ok(Some(buyer))
}

pub fn process_transfer_hook(accounts: &mut TransferHook, amount: u64) -> Result<()> {
    let config = &accounts.creator_config;
    let authority = accounts.authority.key();
    let mint_key = accounts.mint.key();

    let Some(buyer) = resolve_lottery_buy_buyer(
        config,
        &authority,
        &mint_key,
        &accounts.source_token_account,
        &accounts.destination_token_account,
    )?
    else {
        return Ok(());
    };

    let clock = Clock::get()?;
    let entry = LotteryEntry {
        buyer,
        amount,
        slot: clock.slot,
    };

    let mut pending = accounts.pending_entries.load_mut()?;
    let overflowed = pending.push(entry);

    if overflowed {
        emit!(EntryOverflow {
            creator_mint: config.creator_mint,
            total_overflow_count: pending.overflow_count,
        });
    }

    // Exactly one LotteryEntryRecorded per qualifying TransferHook call.
    emit!(LotteryEntryRecorded {
        creator_mint: config.creator_mint,
        buyer,
        amount,
        slot: clock.slot,
        buffer_count: pending.count,
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::MAX_AMM_PROGRAMS;

    fn config_with_known_amm(amm: Pubkey) -> CreatorConfig {
        let mut known_amm_programs = [Pubkey::default(); MAX_AMM_PROGRAMS];
        known_amm_programs[0] = amm;
        CreatorConfig {
            creator_mint: Pubkey::default(),
            authority: Pubkey::default(),
            keeper_authority: Pubkey::default(),
            hub_creator_coin: [0u8; 32],
            hub_share_oft: [0u8; 32],
            fee_bps: 0,
            settlement_threshold: 0,
            lottery_enabled: true,
            amm_program_count: 1,
            known_amm_programs,
            bump: 0,
            _reserved: [0u8; 64],
        }
    }

    #[test]
    fn allowlisted_buy_requires_authority_match() {
        let amm = Pubkey::new_unique();
        let config = config_with_known_amm(amm);
        let spoofed_source_owner = amm;
        let untrusted_authority = Pubkey::new_unique();

        assert!(!is_allowlisted_buy(
            &config,
            &untrusted_authority,
            &spoofed_source_owner
        ));
    }

    #[test]
    fn allowlisted_buy_accepts_matching_authority_and_source_owner() {
        let amm = Pubkey::new_unique();
        let config = config_with_known_amm(amm);

        assert!(is_allowlisted_buy(&config, &amm, &amm));
    }

    // ── Adversarial tests for require_transferring_token_account (C-01/H2-06) ──

    use anchor_spl::token_2022::spl_token_2022::{
        extension::{BaseStateWithExtensionsMut, ExtensionType, StateWithExtensionsMut},
        state::AccountState,
    };

    fn make_token_account_data(
        mint: &Pubkey,
        owner: &Pubkey,
        transferring: Option<bool>,
    ) -> Vec<u8> {
        let extensions: Vec<ExtensionType> = if transferring.is_some() {
            vec![ExtensionType::TransferHookAccount]
        } else {
            vec![]
        };
        let len =
            ExtensionType::try_calculate_account_len::<SplTokenAccount>(&extensions).unwrap();
        let mut data = vec![0u8; len];
        let mut state =
            StateWithExtensionsMut::<SplTokenAccount>::unpack_uninitialized(&mut data).unwrap();
        if let Some(is_transferring) = transferring {
            let ext = state.init_extension::<TransferHookAccount>(true).unwrap();
            ext.transferring = is_transferring.into();
        }
        state.base.mint = *mint;
        state.base.owner = *owner;
        state.base.state = AccountState::Initialized;
        state.pack_base();
        state.init_account_type().unwrap();
        data
    }

    fn check_account(
        mint: &Pubkey,
        owner: &Pubkey,
        transferring: Option<bool>,
        expected_mint: &Pubkey,
    ) -> Result<Pubkey> {
        let key = Pubkey::new_unique();
        let program_owner = token_2022::ID;
        let mut lamports = 1_000_000u64;
        let mut data = make_token_account_data(mint, owner, transferring);
        let account_info = AccountInfo::new(
            &key,
            false,
            false,
            &mut lamports,
            &mut data,
            &program_owner,
            false,
        );
        require_transferring_token_account(&account_info, expected_mint)
    }

    #[test]
    fn accepts_mid_transfer_account_of_hooked_mint() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let resolved = check_account(&mint, &owner, Some(true), &mint).unwrap();
        assert_eq!(resolved, owner);
    }

    #[test]
    fn rejects_account_of_wrong_mint() {
        let mint = Pubkey::new_unique();
        let other_mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let err = check_account(&other_mint, &owner, Some(true), &mint).unwrap_err();
        assert_eq!(err, CreatorShareHookError::MintMismatch.into());
    }

    #[test]
    fn rejects_account_not_mid_transfer() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let err = check_account(&mint, &owner, Some(false), &mint).unwrap_err();
        assert_eq!(err, CreatorShareHookError::TransferNotInProgress.into());
    }

    #[test]
    fn rejects_account_without_transfer_hook_extension() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let err = check_account(&mint, &owner, None, &mint).unwrap_err();
        assert_eq!(err, CreatorShareHookError::TransferNotInProgress.into());
    }

    #[test]
    fn rejects_garbage_account_data() {
        let key = Pubkey::new_unique();
        let program_owner = token_2022::ID;
        let mut lamports = 1_000_000u64;
        let mut data = vec![0u8; 64]; // fabricated blob mimicking mint+owner bytes only
        let mint = Pubkey::new_unique();
        data[0..32].copy_from_slice(mint.as_ref());
        let account_info = AccountInfo::new(
            &key,
            false,
            false,
            &mut lamports,
            &mut data,
            &program_owner,
            false,
        );
        let err = require_transferring_token_account(&account_info, &mint).unwrap_err();
        assert_eq!(err, CreatorShareHookError::InvalidTokenAccount.into());
    }

    // ── SOL-P0-04: one qualifying buy ⇒ one authentic eligibility event ──

    fn account_info_from_data<'a>(
        key: &'a Pubkey,
        lamports: &'a mut u64,
        data: &'a mut [u8],
        owner: &'a Pubkey,
    ) -> AccountInfo<'a> {
        AccountInfo::new(key, false, false, lamports, data, owner, false)
    }

    #[test]
    fn qualifying_buy_resolves_exactly_one_buyer() {
        let amm = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let buyer = Pubkey::new_unique();
        let config = config_with_known_amm(amm);

        let src_key = Pubkey::new_unique();
        let dst_key = Pubkey::new_unique();
        let program_owner = token_2022::ID;
        let mut src_lamports = 1_000_000u64;
        let mut dst_lamports = 1_000_000u64;
        let mut src_data = make_token_account_data(&mint, &amm, Some(true));
        let mut dst_data = make_token_account_data(&mint, &buyer, Some(true));
        let src = account_info_from_data(&src_key, &mut src_lamports, &mut src_data, &program_owner);
        let dst = account_info_from_data(&dst_key, &mut dst_lamports, &mut dst_data, &program_owner);

        let resolved =
            resolve_lottery_buy_buyer(&config, &amm, &mint, &src, &dst).unwrap();
        assert_eq!(resolved, Some(buyer));
    }

    #[test]
    fn non_amm_authority_records_zero_events() {
        let amm = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let buyer = Pubkey::new_unique();
        let other = Pubkey::new_unique();
        let config = config_with_known_amm(amm);

        let src_key = Pubkey::new_unique();
        let dst_key = Pubkey::new_unique();
        let program_owner = token_2022::ID;
        let mut src_lamports = 1_000_000u64;
        let mut dst_lamports = 1_000_000u64;
        let mut src_data = make_token_account_data(&mint, &other, Some(true));
        let mut dst_data = make_token_account_data(&mint, &buyer, Some(true));
        let src = account_info_from_data(&src_key, &mut src_lamports, &mut src_data, &program_owner);
        let dst = account_info_from_data(&dst_key, &mut dst_lamports, &mut dst_data, &program_owner);

        let resolved =
            resolve_lottery_buy_buyer(&config, &other, &mint, &src, &dst).unwrap();
        assert_eq!(resolved, None);
    }

    #[test]
    fn lottery_disabled_records_zero_events() {
        let amm = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let buyer = Pubkey::new_unique();
        let mut config = config_with_known_amm(amm);
        config.lottery_enabled = false;

        let src_key = Pubkey::new_unique();
        let dst_key = Pubkey::new_unique();
        let program_owner = token_2022::ID;
        let mut src_lamports = 1_000_000u64;
        let mut dst_lamports = 1_000_000u64;
        let mut src_data = make_token_account_data(&mint, &amm, Some(true));
        let mut dst_data = make_token_account_data(&mint, &buyer, Some(true));
        let src = account_info_from_data(&src_key, &mut src_lamports, &mut src_data, &program_owner);
        let dst = account_info_from_data(&dst_key, &mut dst_lamports, &mut dst_data, &program_owner);

        let resolved =
            resolve_lottery_buy_buyer(&config, &amm, &mint, &src, &dst).unwrap();
        assert_eq!(resolved, None);
    }

    #[test]
    fn forged_not_transferring_rejects_buy_path() {
        let amm = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let buyer = Pubkey::new_unique();
        let config = config_with_known_amm(amm);

        let src_key = Pubkey::new_unique();
        let dst_key = Pubkey::new_unique();
        let program_owner = token_2022::ID;
        let mut src_lamports = 1_000_000u64;
        let mut dst_lamports = 1_000_000u64;
        let mut src_data = make_token_account_data(&mint, &amm, Some(false));
        let mut dst_data = make_token_account_data(&mint, &buyer, Some(true));
        let src = account_info_from_data(&src_key, &mut src_lamports, &mut src_data, &program_owner);
        let dst = account_info_from_data(&dst_key, &mut dst_lamports, &mut dst_data, &program_owner);

        let err = resolve_lottery_buy_buyer(&config, &amm, &mint, &src, &dst).unwrap_err();
        assert_eq!(err, CreatorShareHookError::TransferNotInProgress.into());
    }

    #[test]
    fn two_qualifying_ixs_yield_two_independent_buyers() {
        // Two TransferHook CPIs in one tx each resolve once — durable identity
        // distinguishes them via instruction_index, not buyer/amount/slot alone.
        let amm = Pubkey::new_unique();
        let mint = Pubkey::new_unique();
        let buyer_a = Pubkey::new_unique();
        let buyer_b = Pubkey::new_unique();
        let config = config_with_known_amm(amm);
        let program_owner = token_2022::ID;

        let src_key = Pubkey::new_unique();
        let dst_a_key = Pubkey::new_unique();
        let dst_b_key = Pubkey::new_unique();
        let mut src_lamports = 1_000_000u64;
        let mut dst_a_lamports = 1_000_000u64;
        let mut dst_b_lamports = 1_000_000u64;
        let mut src_data = make_token_account_data(&mint, &amm, Some(true));
        let mut dst_a_data = make_token_account_data(&mint, &buyer_a, Some(true));
        let mut dst_b_data = make_token_account_data(&mint, &buyer_b, Some(true));

        let src = account_info_from_data(&src_key, &mut src_lamports, &mut src_data, &program_owner);
        let dst_a =
            account_info_from_data(&dst_a_key, &mut dst_a_lamports, &mut dst_a_data, &program_owner);
        let dst_b =
            account_info_from_data(&dst_b_key, &mut dst_b_lamports, &mut dst_b_data, &program_owner);

        let first = resolve_lottery_buy_buyer(&config, &amm, &mint, &src, &dst_a).unwrap();
        let second = resolve_lottery_buy_buyer(&config, &amm, &mint, &src, &dst_b).unwrap();
        assert_eq!(first, Some(buyer_a));
        assert_eq!(second, Some(buyer_b));
        assert_ne!(first, second);
    }
}
