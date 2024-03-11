use anchor_lang::prelude::*;

#[account]
pub struct PoolConfig {
    pub owner: Pubkey,
    pub pool_id: String,
    pub pool_fee: u8,
    pub stake_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub pool_stake_account: Pubkey,
    pub pool_reward_account: Pubkey,
}
