use anchor_lang::prelude::*;

#[account]
pub struct PoolConfig {
    pub owner: Pubkey,
    pub pool_id: String,
    pub duration: u16,
    pub start_slot: u64,
    pub end_slot: u64,
    pub reward_per_slot: u64,
    pub stake_fee: u16,
    pub unstake_fee: u16,
    pub stake_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub stake_mint_decimals: u8,
    pub reward_mint_decimals: u8,
    pub pool_stake_token_vault: Pubkey,
    pub pool_reward_token_vault: Pubkey,
    pub state_addr: Pubkey,
}

pub const POOL_CONFIG_SIZE: usize =
    8 + 32 + (4 + 2) + 2 + 8 + 8 + 8 + 2 + 2 + 32 + 32 + 1 + 1 + 32 + 32 + 32;
