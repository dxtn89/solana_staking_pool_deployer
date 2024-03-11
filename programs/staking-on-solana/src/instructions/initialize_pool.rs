use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, TokenAccount, Transfer };

use crate::state::*;

pub fn handler(
    ctx: Context<InitializePool>,
    pool_id: String,
    pool_fee: u8,
    initial_funding: u64,
    start_slot: u64,
    end_slot: u64
) -> Result<()> {
    let pool_config = &mut ctx.accounts.pool_config;
    pool_config.owner = ctx.accounts.creator.key();
    pool_config.pool_id = pool_id;
    pool_config.pool_fee = pool_fee;
    pool_config.start_slot = start_slot;
    pool_config.end_slot = end_slot;
    pool_config.stake_mint = ctx.accounts.stake_mint.key();
    pool_config.reward_mint = ctx.accounts.reward_mint.key();
    pool_config.pool_reward_account = ctx.accounts.pool_reward_account.key();
    pool_config.pool_stake_account = ctx.accounts.pool_stake_account.key();
    pool_config.state_addr = ctx.accounts.pool_state.key();

    // Transfer Token from staker to pool account
    token::transfer(ctx.accounts.transfer_reward_to_pool_context(), initial_funding)?;

    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.reward_amount = initial_funding;
    pool_state.total_staked = 0;

    Ok(())
}

#[derive(Accounts)]
#[instruction(pool_id: String)]
pub struct InitializePool<'info> {
    #[account(
        // init_if_needed,
        init,
        payer = creator,
        space = 500,
        seeds = [pool_id.as_bytes().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    #[account(init, payer = creator, space = 100)]
    pub pool_state: Account<'info, PoolState>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub stake_mint: Account<'info, Mint>,

    pub reward_mint: Account<'info, Mint>,

    #[account(mut)]
    pub pool_stake_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_reward_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator_reward_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}

impl<'info> InitializePool<'info> {
    fn transfer_reward_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.creator_reward_account.to_account_info(),
            to: self.pool_reward_account.to_account_info(),
            authority: self.creator.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
