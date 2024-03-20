use anchor_lang::prelude::*;

#[account]
pub struct PoolState {
    pub reward_amount: u64,
    pub total_staked: u64,
    pub last_reward_slot: u64,
    pub acc_token_per_share: u64,
    pub should_total_paid: u64,
}

pub const POOL_STATE_SIZE: usize = 8 + 8 + 8 + 8 + 8 + 8;
