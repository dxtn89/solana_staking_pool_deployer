use anchor_lang::prelude::*;
use anchor_spl::token::{ self };

use crate::state::*;
use crate::utils::*;
use crate::error::*;
use crate::events::*;

pub fn handler(ctx: Context<StartReward>) -> Result<()> {
    msg!("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx");

    let pool_config = &mut ctx.accounts.pool_config_account;
    let pool_state = &mut ctx.accounts.pool_state_account;

    require!(pool_config.start_slot == 0, BrewStakingError::PoolAlreadyStarted);
    // require!(
    //     insufficient_rewards(pool_config, pool_state) == 0,
    //     BrewStakingError::RewardNotDeposited
    // );
    let clock = Clock::get()?;
    // CHECK
    // Calculate start and end slot
    pool_config.start_slot = clock.slot + 10;
    pool_config.end_slot = pool_config.start_slot + (pool_config.duration as u64) * SLOTS_PER_DAY;

    pool_state.last_reward_slot = pool_config.start_slot;

    msg!("current slot {}", clock.slot);
    msg!("pool_config.start_slot {}", pool_config.start_slot);
    msg!("pool_config.end_slot {}", pool_config.end_slot);

    emit!(NewStartAndEndSlots {
        start_slot: pool_config.start_slot,
        end_slot: pool_config.end_slot,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct StartReward<'info> {
    /// CHECK:
    #[account(mut)]
    pub deployer: Signer<'info>,

    #[account(mut)]
    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    pub token_program: Program<'info, token::Token>,
}
