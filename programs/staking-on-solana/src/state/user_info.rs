use anchor_lang::prelude::*;

#[account]
pub struct UserInfo {
    pub amount: u64,
    pub reward_debt: u64,
    pub deposit_slot: u64,
}
