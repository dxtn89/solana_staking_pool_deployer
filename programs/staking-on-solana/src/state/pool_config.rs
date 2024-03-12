use anchor_lang::prelude::*;

#[account]
pub struct PoolConfig {
    pub owner: Pubkey,
    pub pool_id: String,
    pub start_slot: u64,
    pub end_slot: u64,
    pub pool_fee: u8,
    // pub reward_rate: u8,
    pub stake_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub pool_stake_account: Pubkey,
    pub pool_reward_account: Pubkey,
    pub state_addr: Pubkey,
}
