use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

use crate::state::*;
use crate::utils::*;
// use crate::error::*;
use crate::events::*;

pub fn handler(ctx: Context<StopReward>) -> Result<()> {
    let pool_config = &mut ctx.accounts.pool_config_account;
    let pool_state = &mut ctx.accounts.pool_state_account;

    let _ = update_pool(pool_config, pool_state);

    let mut remain_rewards =
        available_reward_tokens(pool_config, pool_state) + pool_state.paid_rewards;

    if remain_rewards > pool_state.should_total_paid {
        remain_rewards = remain_rewards - pool_state.should_total_paid;
        // transfer remaining reward to deployer
        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_reward_token_vault.to_account_info(),
            to: ctx.accounts.deployer_reward_token_vault.to_account_info(),
            authority: ctx.accounts.deployer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, remain_rewards)?;

        if pool_state.total_earned > remain_rewards {
            pool_state.total_earned -= remain_rewards;
        } else {
            pool_state.total_earned = 0;
        }
    }

    let clock = Clock::get()?;
    pool_config.end_slot = clock.slot;

    emit!(RewardsStop {
        end_slot: pool_config.end_slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct StopReward<'info> {
    /// CHECK:
    #[account(mut)]
    pub deployer: AccountInfo<'info>,

    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub deployer_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    pub token_program: Program<'info, token::Token>,
}
