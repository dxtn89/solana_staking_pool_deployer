use anchor_lang::prelude::*;

#[account]
pub struct UserInfo {
    pub staked_amount: u64,
    pub reward_debt: u64,
    pub deposit_slot: u64,
}

pub const USER_INFO_SIZE: usize = 8 + 8 + 8 + 8;
