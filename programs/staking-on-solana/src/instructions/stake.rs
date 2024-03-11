use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, TokenAccount, Transfer };

use crate::state::*;

pub fn handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    // let staker = &ctx.accounts.staker;
    // let staker_token_account = &ctx.accounts.staker_token_account;
    // let pool_token_account = &ctx.accounts.pool_token_account;

    // Transfer Token from staker to pool account
    token::transfer(ctx.accounts.into_transfer_to_pool_context(), amount)?;

    let pool = &mut ctx.accounts.pool;
    pool.total_staked += amount;

    let pool_config = &mut ctx.accounts.pool_config;
    msg!("pool address in stake {}", pool_config.pool_id);
    msg!("pool fee in stake {}", pool_config.pool_fee);

    Ok(())
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(mut)]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool: Account<'info, PoolState>,
    pub pool_config: Account<'info, PoolConfig>,
    pub token_program: Program<'info, token::Token>,
}

impl<'info> Stake<'info> {
    fn into_transfer_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.staker_token_account.to_account_info(),
            to: self.pool_token_account.to_account_info(),
            authority: self.staker.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
