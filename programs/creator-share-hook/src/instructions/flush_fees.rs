use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::Mint as MintInterface;
use anchor_lang::solana_program::program::invoke;
use spl_token_2022::extension::StateWithExtensions;
use spl_token_2022::extension::transfer_fee::instruction as token_instruction;
use spl_token_2022::state::Account as TokenAccount;

use crate::constants::*;
use crate::errors::CreatorShareHookError;
use crate::events::*;
use crate::state::*;

/// Keeper-only: harvest withheld TransferFeeConfig fees from the mint
/// into a designated fee vault token account.
///
/// After this instruction, the keeper bridges the collected fees to Base
/// via `SolanaBridgeAdapter.receiveFeeFromSolana()`.
#[derive(Accounts)]
pub struct FlushFees<'info> {
    /// The keeper authority (must match `creator_config.keeper_authority`).
    pub keeper: Signer<'info>,

    /// CreatorConfig PDA — used to verify keeper authority.
    #[account(
        seeds = [CREATOR_CONFIG_SEED, mint.key().as_ref()],
        bump = creator_config.bump,
        constraint = creator_config.keeper_authority == keeper.key() @ CreatorShareHookError::UnauthorizedKeeper,
    )]
    pub creator_config: Box<Account<'info, CreatorConfig>>,

    /// The Token-2022 mint with TransferFeeConfig extension.
    #[account(mut)]
    pub mint: InterfaceAccount<'info, MintInterface>,

    /// The destination token account to receive harvested fees.
    /// Typically owned by the keeper or a fee collection wallet.
    /// CHECK: Must be a valid Token-2022 token account for this mint.
    #[account(mut)]
    pub fee_vault: UncheckedAccount<'info>,

    /// Token-2022 program.
    pub token_program: Program<'info, Token2022>,
}

pub fn handler<'info>(ctx: Context<'_, '_, 'info, 'info, FlushFees<'info>>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();

    // Validate fee_vault is a Token-2022 account for this mint.
    let fee_vault_info = ctx.accounts.fee_vault.to_account_info();
    let fee_vault_data = fee_vault_info.try_borrow_data()?;
    let fee_vault_state = StateWithExtensions::<TokenAccount>::unpack(&fee_vault_data)?;
    if fee_vault_state.base.mint != mint_key {
        return err!(CreatorShareHookError::InvalidMint);
    }

    let amount_before = fee_vault_state.base.amount;
    drop(fee_vault_data);

    // Step 1: Harvest withheld fees from token accounts to the mint.
    // The token accounts are provided as remaining_accounts.
    if !ctx.remaining_accounts.is_empty() {
        let sources: Vec<&Pubkey> = ctx
            .remaining_accounts
            .iter()
            .map(|a| a.key)
            .collect();
        let harvest_ix = token_instruction::harvest_withheld_tokens_to_mint(
            &ctx.accounts.token_program.key(),
            &mint_key,
            &sources,
        )?;

        let mut harvest_accounts = Vec::with_capacity(1 + ctx.remaining_accounts.len());
        harvest_accounts.push(ctx.accounts.mint.to_account_info());
        harvest_accounts.extend(ctx.remaining_accounts.iter().map(|a| a.to_account_info()));

        invoke(&harvest_ix, &harvest_accounts)?;
    }

    // Step 2: Withdraw all withheld tokens from the mint into fee_vault.
    let withdraw_ix = token_instruction::withdraw_withheld_tokens_from_mint(
        &ctx.accounts.token_program.key(),
        &mint_key,
        fee_vault_info.key,
        &ctx.accounts.keeper.key(),
        &[],
    )?;

    invoke(
        &withdraw_ix,
        &[
            ctx.accounts.mint.to_account_info(),
            fee_vault_info.clone(),
            ctx.accounts.keeper.to_account_info(),
        ],
    )?;

    // Re-read fee_vault to compute actual withdrawn amount.
    let fee_vault_data_after = fee_vault_info.try_borrow_data()?;
    let fee_vault_state_after = StateWithExtensions::<TokenAccount>::unpack(&fee_vault_data_after)?;
    let amount_after = fee_vault_state_after.base.amount;
    let delta = amount_after.saturating_sub(amount_before);

    emit!(FeesFlushed {
        creator_mint: ctx.accounts.creator_config.creator_mint,
        amount: delta,
    });

    Ok(())
}
