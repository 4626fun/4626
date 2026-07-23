use crate::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetOperator<'info> {
    #[account(address = store.admin)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
}

impl SetOperator<'_> {
    pub fn apply(ctx: &mut Context<SetOperator>, params: &SetOperatorParams) -> Result<()> {
        require!(params.operator != Pubkey::default(), ErrorCode::ConstraintAddress);
        ctx.accounts.store.operator = params.operator;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetOperatorParams {
    pub operator: Pubkey,
}
