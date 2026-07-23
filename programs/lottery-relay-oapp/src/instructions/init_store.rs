use crate::*;
use crate::program::LotteryRelayOapp;
use anchor_lang::prelude::*;
use oapp::endpoint::{instructions::RegisterOAppParams, ID as ENDPOINT_ID};

#[derive(Accounts)]
pub struct InitStore<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub upgrade_authority: Signer<'info>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key())
    )]
    pub program: Program<'info, LotteryRelayOapp>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(upgrade_authority.key())
            @ ErrorCode::ConstraintOwner
    )]
    pub program_data: Account<'info, ProgramData>,
    #[account(
        init,
        payer = payer,
        space = 8 + Store::INIT_SPACE,
        seeds = [STORE_SEED],
        bump
    )]
    pub store: Account<'info, Store>,
    pub system_program: Program<'info, System>,
}

impl InitStore<'_> {
    pub fn apply(ctx: &mut Context<InitStore>, params: &InitStoreParams) -> Result<()> {
        require_keys_eq!(params.endpoint, ENDPOINT_ID, ErrorCode::ConstraintAddress);
        require!(params.admin != Pubkey::default(), ErrorCode::ConstraintAddress);
        require!(params.operator != Pubkey::default(), ErrorCode::ConstraintAddress);
        ctx.accounts.store.admin = params.admin;
        ctx.accounts.store.operator = params.operator;
        ctx.accounts.store.endpoint_program = ENDPOINT_ID;
        ctx.accounts.store.bump = ctx.bumps.store;

        let seeds: &[&[u8]] = &[STORE_SEED, &[ctx.accounts.store.bump]];
        oapp::endpoint_cpi::register_oapp(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            seeds,
            RegisterOAppParams { delegate: params.admin },
        )
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InitStoreParams {
    pub admin: Pubkey,
    pub operator: Pubkey,
    pub endpoint: Pubkey,
}
