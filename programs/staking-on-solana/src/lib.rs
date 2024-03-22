use anchor_lang::prelude::*;

use instructions::*;

mod instructions;
mod state;
mod utils;
mod error;
mod events;

declare_id!("Ek66VEcmgipM8Npz3o5iF4Ct5swHGp6k9snfPKqmupzk");

#[program]
pub mod staking_on_solana {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        deploy_fee: u64,
        stake_fee: u16,
        unstake_fee: u16
    ) -> Result<()> {
        instructions::initialize::handler(ctx, deploy_fee, stake_fee, unstake_fee)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        pool_id: String,
        pool_fee: u8,
        initial_funding: u64,
        reward_per_slot: u64,
        duration: u16
    ) -> Result<()> {
        instructions::create_pool::handler(
            ctx,
            pool_id,
            pool_fee,
            initial_funding,
            reward_per_slot,
            duration
        )
    }

    pub fn stake(ctx: Context<Stake>, stake_amount: u64) -> Result<()> {
        instructions::stake::handler(ctx, stake_amount)
    }

    pub fn unstake(ctx: Context<Unstake>, unstake_amount: u64) -> Result<()> {
        instructions::unstake::handler(ctx, unstake_amount)
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(ctx)
    }

    pub fn start_reward(ctx: Context<StartReward>) -> Result<()> {
        instructions::start_reward::handler(ctx)
    }

    pub fn stop_reward(ctx: Context<StopReward>) -> Result<()> {
        instructions::stop_reward::handler(ctx)
    }
}
