use crate::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SetBasePeer<'info> {
    #[account(mut, address = store.admin)]
    pub admin: Signer<'info>,
    #[account(seeds = [STORE_SEED], bump = store.bump)]
    pub store: Account<'info, Store>,
    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + PeerConfig::INIT_SPACE,
        seeds = [PEER_SEED, store.key().as_ref(), &BASE_EID.to_be_bytes()],
        bump
    )]
    pub peer: Account<'info, PeerConfig>,
    pub system_program: Program<'info, System>,
}

impl SetBasePeer<'_> {
    pub fn apply(ctx: &mut Context<SetBasePeer>, params: &SetBasePeerParams) -> Result<()> {
        require!(is_allowed_destination_peer(&params.peer_address), ErrorCode::ConstraintAddress);
        oapp::options::assert_type_3(&params.enforced_options)?;
        ctx.accounts.peer.peer_address = params.peer_address;
        ctx.accounts.peer.enforced_options = params.enforced_options.clone();
        ctx.accounts.peer.bump = ctx.bumps.peer;
        Ok(())
    }
}

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SetBasePeerParams {
    pub peer_address: [u8; 32],
    pub enforced_options: Vec<u8>,
}
