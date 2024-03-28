use anchor_lang::prelude::*;

use crate::state::*;
use crate::utils::*;
// use crate::error::*;
// use crate::events::*;

pub fn handler(ctx: Context<PendingReward>) -> Result<u64> {
    let pool_config = &ctx.accounts.pool_config_account;
    let pool_state = &mut ctx.accounts.pool_state_account;
    let user_info = &mut ctx.accounts.user_info;

    let mut adjusted_token_per_share = pool_state.acc_token_per_share;

    let clock = Clock::get()?;
    let precision_factor = get_precision_factor(pool_config);

    if
        clock.slot > pool_state.last_reward_slot &&
        pool_state.total_staked != 0 &&
        pool_state.last_reward_slot > 0
    {
        let multiplier = get_multiplier(
            pool_state.last_reward_slot,
            clock.slot,
            pool_config.end_slot
        );
        let reward = multiplier * pool_config.reward_per_slot;

        adjusted_token_per_share =
            pool_state.acc_token_per_share + (reward * precision_factor) / pool_state.total_staked;
    }

    let pending_reward =
        (user_info.staked_amount * adjusted_token_per_share) / precision_factor -
        user_info.reward_debt;

    Ok(pending_reward)
}

#[derive(Accounts)]
pub struct PendingReward<'info> {
    pub user_info: Account<'info, UserInfo>,

    pub pool_config_account: Account<'info, PoolConfig>,

    pub pool_state_account: Account<'info, PoolState>,
}
