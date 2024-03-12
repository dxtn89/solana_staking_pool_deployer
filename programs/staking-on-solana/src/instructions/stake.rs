use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, TokenAccount, Transfer };

use crate::state::*;

pub fn handler(ctx: Context<Stake>, amount: u64) -> Result<()> {
    // msg!("Instruction: Stake");

    // let pool_config = &ctx.accounts.pool_config;
    // let pool_state = &ctx.accounts.pool_state;

    // let staker = &ctx.accounts.staker;
    // let staker_token_account = &ctx.accounts.staker_stake_account;

    // let clock = Clock::get()?;
    // // Transfer Token from staker to pool account
    // token::transfer(ctx.accounts.into_transfer_to_pool_context(), amount)?;

    // let pool = &mut ctx.accounts.pool_state;
    // pool.total_staked += amount;

    // let pool_config = &mut ctx.accounts.pool_config;
    // msg!("pool address in stake {}", pool_config.pool_id);
    // msg!("pool fee in stake {}", pool_config.pool_fee);

    Ok(())
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    #[account(init_if_needed, payer = staker, space = 100)]
    pub user_info: Account<'info, UserInfo>,

    #[account(mut)]
    pub staker_stake_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_stake_account: Account<'info, TokenAccount>,

    pub pool_config: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state: Account<'info, PoolState>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}

impl<'info> Stake<'info> {
    fn into_transfer_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.staker_stake_account.to_account_info(),
            to: self.pool_stake_account.to_account_info(),
            authority: self.staker.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
