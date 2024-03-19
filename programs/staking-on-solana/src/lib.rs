use anchor_lang::prelude::*;

use instructions::*;

mod instructions;
mod state;
mod utils;

declare_id!("Ek66VEcmgipM8Npz3o5iF4Ct5swHGp6k9snfPKqmupzk");

#[program]
pub mod staking_on_solana {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        deploy_fee: u64,
        stake_fee: u16,
        claim_fee: u16
    ) -> Result<()> {
        instructions::initialize::handler(ctx, deploy_fee, stake_fee, claim_fee)
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        pool_id: String,
        pool_fee: u8,
        initial_funding: u64,
        reward_rate: u8,
        start_slot: u64,
        end_slot: u64
    ) -> Result<()> {
        instructions::create_pool::handler(
            ctx,
            pool_id,
            pool_fee,
            initial_funding,
            reward_rate,
            start_slot,
            end_slot
        )
    }

    pub fn stake(ctx: Context<Stake>, stake_amount: u64) -> Result<()> {
        instructions::stake::handler(ctx, stake_amount)
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        instructions::unstake::handler(ctx)
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(ctx)
    }
}
