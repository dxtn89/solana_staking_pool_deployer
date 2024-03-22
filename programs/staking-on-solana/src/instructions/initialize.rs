use anchor_lang::prelude::*;
use anchor_spl::token::{ self };

use crate::state::*;

pub fn handler(ctx: Context<Initialize>, deploy_fee: u64, performance_fee: u64) -> Result<()> {
    let platform = &mut ctx.accounts.platform;

    platform.treasury = ctx.accounts.treasury.key();
    platform.deploy_fee = deploy_fee;
    platform.performance_fee = performance_fee;

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        // init,
        payer = admin,
        space = PLATFORM_INFO_SIZE,
        seeds = [treasury.key().as_ref()],
        bump
    )]
    pub platform: Account<'info, PlatformInfo>,

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub treasury: Signer<'info>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}
