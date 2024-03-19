use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

use crate::state::*;

pub fn handler(ctx: Context<Unstake>) -> Result<()> {
    // let pool_config = &ctx.accounts.pool_config_account;

    let user_info = &mut ctx.accounts.user_info;
    let user_staked_amount = user_info.staked_amount;

    // Transfer Token from staker to pool account
    let cpi_accounts = Transfer {
        from: ctx.accounts.pool_stake_token_vault.to_account_info(),
        to: ctx.accounts.user_stake_token_vault.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, user_staked_amount)?;

    let pool_state = &mut ctx.accounts.pool_state_account;
    pool_state.total_staked -= user_staked_amount;

    // Update the user info
    user_info.staked_amount = 0;

    Ok(())
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    /// CHECK:
    #[account(mut)]
    pub user: AccountInfo<'info>,
    /// CHECK:
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub user_stake_token_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_stake_token_vault: Account<'info, TokenAccount>,

    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    #[account(mut)]
    pub user_info: Account<'info, UserInfo>,

    pub token_program: Program<'info, token::Token>,

    pub system_program: Program<'info, System>,
}
