use anchor_lang::prelude::*;

#[account]
pub struct PlatformInfo {
    pub deploy_fee: u64,
    pub stake_fee: u16,
    pub claim_fee: u16,
    pub treasury: Pubkey,
}

pub const PLATFORM_INFO_SIZE: usize = 8 + 8 + 2 + 2 + 32;
