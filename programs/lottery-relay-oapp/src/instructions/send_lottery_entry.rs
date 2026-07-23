use crate::*;
use anchor_lang::prelude::*;
use oapp::endpoint::{
    instructions::SendParams,
    state::EndpointSettings,
    ENDPOINT_SEED,
    ID as ENDPOINT_ID,
};

#[derive(Accounts)]
pub struct SendLotteryEntry<'info> {
    #[account(mut, address = store.operator @ ErrorCode::ConstraintAddress)]
    pub payer: Signer<'info>,
    #[account(seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(
        seeds = [PEER_SEED, store.key().as_ref(), &BASE_EID.to_be_bytes()],
        bump = peer.bump
    )]
    pub peer: Account<'info, PeerConfig>,
    #[account(seeds = [ENDPOINT_SEED], bump = endpoint.bump, seeds::program = ENDPOINT_ID)]
    pub endpoint: Account<'info, EndpointSettings>,
}

impl SendLotteryEntry<'_> {
    pub fn apply(
        ctx: &mut Context<SendLotteryEntry>,
        params: &SendLotteryEntryParams,
    ) -> Result<()> {
        require!(is_allowed_destination_peer(&ctx.accounts.peer.peer_address), ErrorCode::ConstraintAddress);
        crate::message::validate_lottery_entry_message(&params.message)?;
        let options = oapp::options::combine_options(
            ctx.accounts.peer.enforced_options.clone(),
            &params.extra_options,
        )?;
        let seeds: &[&[u8]] = &[STORE_SEED, &[ctx.accounts.store.bump]];
        oapp::endpoint_cpi::send(
            ENDPOINT_ID,
            ctx.accounts.store.key(),
            ctx.remaining_accounts,
            seeds,
            SendParams {
                dst_eid: BASE_EID,
                receiver: ctx.accounts.peer.peer_address,
                message: params.message.clone(),
                options,
                native_fee: params.native_fee,
                lz_token_fee: 0,
            },
        )?;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SendLotteryEntryParams {
    pub message: Vec<u8>,
    pub extra_options: Vec<u8>,
    pub native_fee: u64,
}
