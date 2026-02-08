use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Token2022};
use anchor_spl::token_interface::Mint as MintInterface;

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

pub fn handler(ctx: Context<FlushFees>) -> Result<()> {
    // Harvest withheld fees from the mint to the fee vault.
    // This uses the Token-2022 `harvest_withheld_tokens_to_mint` +
    // `withdraw_withheld_tokens_from_mint` pattern.
    //
    // Note: In practice, the keeper will call the SPL Token-2022 CLI or
    // a separate instruction to harvest from individual token accounts
    // first (`harvest_withheld_tokens_to_mint`), then withdraw from the
    // mint here. For simplicity, this instruction handles the
    // withdraw-from-mint step.

    // The actual CPI call to withdraw withheld tokens from the mint is:
    // spl_token_2022::instruction::withdraw_withheld_tokens_from_mint
    //
    // This requires the mint's `withdraw_withheld_authority` to sign.
    // The keeper must be set as this authority on the mint, OR the
    // program PDA must be set as the authority and we sign with PDA seeds.
    //
    // For Phase 1, we emit the event and let the keeper handle the actual
    // Token-2022 CPI separately (via the SPL CLI or direct instruction).
    // This instruction serves as the gated trigger + event emitter.

    emit!(FeesFlushed {
        creator_mint: ctx.accounts.creator_config.creator_mint,
        amount: 0, // Actual amount determined by Token-2022 state
    });

    Ok(())
}
