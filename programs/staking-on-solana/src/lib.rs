use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

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

    // pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
    //     let pool = &mut ctx.accounts.pool;
    //     pool.total_staked = 0;
    //     Ok(())
    // }

    // pub fn stake_token(ctx: Context<StakeToken>, amount: u64) -> Result<()> {
    //     // let staker = &ctx.accounts.staker;
    //     // let staker_token_account = &ctx.accounts.staker_token_account;
    //     // let pool_token_account = &ctx.accounts.pool_token_account;

    //     // Transfer Token from staker to pool account
    //     token::transfer(ctx.accounts.into_transfer_to_pool_context(), amount)?;

    //     let pool = &mut ctx.accounts.pool;
    //     pool.total_staked += amount;

    //     let pool_config = &mut ctx.accounts.pool_config;
    //     msg!("pool address in stake {}", pool_config.pool_id);
    //     msg!("pool fee in stake {}", pool_config.pool_fee);

    //     Ok(())
    // }
}

// #[derive(Accounts)]
// #[instruction(pool_id: String)]
// pub struct InitializePool<'info> {
//     #[account(
//         // init_if_needed,
//         init,
//         payer = creator,
//         space = 500,
//         seeds = [pool_id.as_bytes().as_ref(), creator.key().as_ref()],
//         bump
//     )]
//     pub pool_config: Account<'info, PoolConfig>,

//     #[account(init, payer = creator, space = 100)]
//     pub pool_state: Account<'info, PoolState>,

//     #[account(mut)]
//     pub creator: Signer<'info>,

//     pub stake_mint: Account<'info, Mint>,

//     pub reward_mint: Account<'info, Mint>,

//     #[account(mut)]
//     pub pool_stake_account: Account<'info, TokenAccount>,

//     #[account(mut)]
//     pub pool_reward_account: Account<'info, TokenAccount>,

//     #[account(mut)]
//     pub creator_reward_account: Account<'info, TokenAccount>,

//     pub system_program: Program<'info, System>,

//     pub token_program: Program<'info, token::Token>,
// }

// #[derive(Accounts)]
// pub struct InitializePool<'info> {
//     #[account(init, payer = user, space = 8 + 8)]
//     pub pool: Account<'info, PoolState>,
//     #[account(mut)]
//     pub user: Signer<'info>,
//     pub system_program: Program<'info, System>,
// }

// #[derive(Accounts)]
// pub struct StakeToken<'info> {
//     #[account(mut)]
//     pub staker: Signer<'info>,
//     #[account(mut)]
//     pub staker_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub pool_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub pool: Account<'info, PoolState>,
//     pub pool_config: Account<'info, PoolConfig>,
//     pub token_program: Program<'info, token::Token>,
// }

// impl<'info> InitializePool<'info> {
//     fn transfer_reward_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.creator_reward_account.to_account_info(),
//             to: self.pool_reward_account.to_account_info(),
//             authority: self.creator.to_account_info(),
//         };
//         CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
//     }
// }

// impl<'info> StakeToken<'info> {
//     fn into_transfer_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.staker_token_account.to_account_info(),
//             to: self.pool_token_account.to_account_info(),
//             authority: self.staker.to_account_info(),
//         };
//         CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
//     }
// }
