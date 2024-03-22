use anchor_lang::prelude::*;

#[account]
pub struct PlatformInfo {
    pub deploy_fee: u64,
    pub performance_fee: u64,
    pub treasury: Pubkey,
}

pub const PLATFORM_INFO_SIZE: usize = 8 + 8 + 8 + 32;
