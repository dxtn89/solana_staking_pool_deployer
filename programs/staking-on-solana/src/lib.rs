use anchor_lang::prelude::*;

use instructions::*;

mod instructions;
mod state;

declare_id!("5d9bF2TaopGL8AM8tCkhKKxSP6e6K4CPF6eQxrspG8Wi");

#[program]
pub mod staking_on_solana {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        pool_id: String,
        pool_fee: u8,
        reward_amount: u64,
        start_slot: u64,
        end_slot: u64
    ) -> Result<()> {
        instructions::initialize_pool::handler(
            ctx,
            pool_id,
            pool_fee,
            reward_amount,
            start_slot,
            end_slot
        )
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake::handler(ctx, amount)
    }

    // pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
    //     let pool = &mut ctx.accounts.pool;
    //     pool.total_staked = 0;
    //     Ok(())
    // }
}

// #[derive(Accounts)]
// pub struct InitializePool<'info> {
//     #[account(init, payer = user, space = 8 + 8)]
//     pub pool: Account<'info, PoolState>,
//     #[account(mut)]
//     pub user: Signer<'info>,
//     pub system_program: Program<'info, System>,
// }
