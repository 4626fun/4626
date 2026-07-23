use crate::*;
use anchor_lang::prelude::*;
use oapp::endpoint::{
    instructions::QuoteParams,
    state::EndpointSettings,
    ENDPOINT_SEED,
    ID as ENDPOINT_ID,
};

#[derive(Accounts)]
pub struct QuoteSend<'info> {
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

impl QuoteSend<'_> {
    pub fn apply(
        ctx: &Context<QuoteSend>,
        params: &QuoteSendParams,
    ) -> Result<LotteryMessagingFee> {
        require!(is_allowed_destination_peer(&ctx.accounts.peer.peer_address), ErrorCode::ConstraintAddress);
        crate::message::validate_lottery_entry_message(&params.message)?;
        let options = oapp::options::combine_options(
            ctx.accounts.peer.enforced_options.clone(),
            &params.extra_options,
        )?;
        let fee = oapp::endpoint_cpi::quote(
            ENDPOINT_ID,
            ctx.remaining_accounts,
            QuoteParams {
                sender: ctx.accounts.store.key(),
                dst_eid: BASE_EID,
                receiver: ctx.accounts.peer.peer_address,
                message: params.message.clone(),
                pay_in_lz_token: false,
                options,
            },
        )?;
        Ok(LotteryMessagingFee {
            native_fee: fee.native_fee,
            lz_token_fee: fee.lz_token_fee,
        })
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct QuoteSendParams {
    pub message: Vec<u8>,
    pub extra_options: Vec<u8>,
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct LotteryMessagingFee {
    pub native_fee: u64,
    pub lz_token_fee: u64,
}
