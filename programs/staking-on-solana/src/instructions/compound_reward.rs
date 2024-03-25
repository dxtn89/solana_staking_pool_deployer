use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

use crate::state::*;
use crate::utils::*;
use crate::error::*;
use crate::events::*;

pub fn handler(ctx: Context<CompoundReward>) -> Result<()> {
    let pool_config = &mut ctx.accounts.pool_config_account;
    let pool_state = &mut ctx.accounts.pool_state_account;
    let user_info = &mut ctx.accounts.user_info;

    let clock = Clock::get()?;

    msg!("current slot {}", clock.slot);
    msg!("pool_config.start_slot {}", pool_config.start_slot);
    msg!("pool_config.end_slot {}", pool_config.end_slot);

    require!(
        pool_config.start_slot > 0 && pool_config.start_slot < clock.slot,
        BrewStakingError::PoolNotStarted
    );

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

            pool_state.total_earned = if pool_state.total_earned > pending {
                pool_state.total_earned - pending
            } else {
                0
            };
            pool_state.paid_rewards += pending;

            emit!(RewardClaim {
                claimer: ctx.accounts.staker.key(),
                amount: pending,
            });
        }
    }

    // Transfer Token from staker to pool account
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_stake_token_vault.to_account_info(),
        to: ctx.accounts.pool_stake_token_vault.to_account_info(),
        authority: ctx.accounts.staker.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    // token::transfer(cpi_ctx, stake_amount)?;

    // // Transfer stake fee from pool to treasury
    // let stake_fee = (stake_amount * (pool_config.stake_fee as u64)) / PERCENT_PRECISION;

    // let cpi_accounts = Transfer {
    //     from: ctx.accounts.pool_stake_token_vault.to_account_info(),
    //     to: ctx.accounts.treasury_stake_token_vault.to_account_info(),
    //     authority: ctx.accounts.admin.to_account_info(),
    // };
    // let cpi_program = ctx.accounts.token_program.to_account_info();
    // let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    // token::transfer(cpi_ctx, stake_fee)?;

    // Update user and pool info
    // let real_amount = stake_amount - stake_fee;

    // user_info.staked_amount += real_amount;
    // user_info.reward_debt =
    //     (user_info.staked_amount * pool_state.acc_token_per_share) / precision_factor;

    // pool_state.total_staked += real_amount;

    Ok(())
}

#[derive(Accounts)]
pub struct CompoundReward<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub admin: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = staker,
        space = USER_INFO_SIZE,
        seeds = [pool_config_account.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub user_info: Account<'info, UserInfo>,

    pub platform: Account<'info, PlatformInfo>,

    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    #[account(mut)]
    pub user_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_stake_token_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}
