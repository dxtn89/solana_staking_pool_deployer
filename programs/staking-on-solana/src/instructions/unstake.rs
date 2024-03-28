use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

use crate::state::*;
use crate::utils::*;
use crate::error::*;
use crate::events::*;

pub fn handler(ctx: Context<Unstake>, unstake_amount: u64) -> Result<()> {
    let pool_config = &ctx.accounts.pool_config_account;
    let pool_state = &mut ctx.accounts.pool_state_account;
    let user_info = &mut ctx.accounts.user_info;

    require!(unstake_amount > 0, BrewStakingError::UnstakeAmountTooSmall);
    require!(user_info.staked_amount > unstake_amount, BrewStakingError::UnstakeAmountTooHigh);

    let _ = update_pool(pool_config, pool_state);

    let precision_factor = get_precision_factor(pool_config);

    // If user already staked before
    if user_info.staked_amount > 0 {
        // Transfer the user his reward so far
        let pending =
            (user_info.staked_amount * pool_state.acc_token_per_share) / precision_factor -
            user_info.reward_debt;

        if pending > 0 {
            require!(
                available_reward_tokens(pool_config, pool_state) >= pending,
                BrewStakingError::InsufficientReward
            );

            let cpi_accounts = Transfer {
                from: ctx.accounts.pool_reward_token_vault.to_account_info(),
                to: ctx.accounts.user_reward_token_vault.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, pending)?;

            pool_state.reward_amount -= pending;

            pool_state.total_earned = if pool_state.total_earned > pending {
                pool_state.total_earned - pending
            } else {
                0
            };
            pool_state.paid_rewards += pending;

            emit!(RewardClaim {
                claimer: ctx.accounts.user.key(),
                amount: pending,
            });
        }
    }

    let mut real_amount = unstake_amount;
    if user_info.staked_amount < unstake_amount {
        real_amount = user_info.staked_amount;
    }
    // Transfer unstake fee from pool to treasury
    let unstake_fee = (real_amount * (pool_config.unstake_fee as u64)) / PERCENT_PRECISION;

    let cpi_accounts = Transfer {
        from: ctx.accounts.pool_stake_token_vault.to_account_info(),
        to: ctx.accounts.creator_stake_token_vault.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, unstake_fee)?;

    // Transfer unstake amount from pool to user
    let cpi_accounts = Transfer {
        from: ctx.accounts.pool_stake_token_vault.to_account_info(),
        to: ctx.accounts.user_stake_token_vault.to_account_info(),
        authority: ctx.accounts.admin.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, real_amount - unstake_fee)?;

    // Update user and pool info
    user_info.staked_amount -= real_amount;
    user_info.reward_debt =
        (user_info.staked_amount * pool_state.acc_token_per_share) / precision_factor;

    pool_state.total_staked -= real_amount;

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

    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    pub platform: Account<'info, PlatformInfo>,

    #[account(mut)]
    pub user_info: Account<'info, UserInfo>,

    #[account(mut)]
    pub user_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_stake_token_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, token::Token>,

    pub system_program: Program<'info, System>,
}
