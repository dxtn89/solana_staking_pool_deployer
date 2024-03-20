use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

use crate::state::*;
use crate::utils::*;

pub fn handler(ctx: Context<ClaimReward>) -> Result<()> {
    msg!("Instruction: Claim Reward");

    let pool_config = &ctx.accounts.pool_config_account;

    let user_info = &mut ctx.accounts.user_info;
    let clock = Clock::get()?;

    let current_reward = calculate_reward(pool_config, user_info, clock.slot);

    let cpi_accounts = Transfer {
        from: ctx.accounts.pool_reward_token_vault.to_account_info(),
        to: ctx.accounts.user_reward_token_vault.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, current_reward)?;

    user_info.reward_debt += current_reward;
    user_info.deposit_slot = clock.slot;
    let pool_state = &mut ctx.accounts.pool_state_account;

    pool_state.reward_amount -= current_reward;

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// CHECK:
    #[account(mut)]
    pub claimer: AccountInfo<'info>,

    /// CHECK:
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub user_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_info: Account<'info, UserInfo>,

    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    pub token_program: Program<'info, token::Token>,
}
