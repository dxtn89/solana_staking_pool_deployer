use anchor_lang::prelude::*;

#[account]
pub struct PoolState {
    pub reward_amount: u64,
    pub total_staked: u64,
}
