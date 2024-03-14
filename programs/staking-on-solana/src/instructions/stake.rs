use anchor_lang::prelude::*;
use anchor_spl::token::{ self, TokenAccount, Transfer };

use crate::state::*;

pub fn handler(ctx: Context<Stake>, stake_amount: u64) -> Result<()> {
    msg!("Instruction: Stake");

    let pool_config = &ctx.accounts.pool_config_account;
    msg!("pool address in stake {}", pool_config.pool_id);
    msg!("pool fee in stake {}", pool_config.pool_fee);

    let user_info = &mut ctx.accounts.user_info;
    let clock = Clock::get()?;

    // If user already staked before
    if user_info.staked_amount > 0 {
        // Transfer the user his reward so far
        let current_reward =
            (clock.slot - user_info.deposit_slot) *
            user_info.staked_amount *
            (pool_config.reward_rate as u64);

        msg!("reward amount in stake {}", current_reward);

        let cpi_accounts = Transfer {
            from: ctx.accounts.pool_reward_token_vault.to_account_info(),
            to: ctx.accounts.staker_reward_token_vault.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, current_reward)?;
    }

    // Transfer Token from staker to pool account
    // token::transfer(ctx.accounts.into_transfer_to_pool_context(), amount)?;
    let cpi_accounts = Transfer {
        from: ctx.accounts.staker_stake_token_vault.to_account_info(),
        to: ctx.accounts.pool_stake_token_vault.to_account_info(),
        authority: ctx.accounts.staker.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, stake_amount)?;

    let pool_state = &mut ctx.accounts.pool_state_account;
    pool_state.total_staked += stake_amount;

    // Update the user info
    user_info.staked_amount += stake_amount;
    user_info.deposit_slot = clock.slot;

    Ok(())
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub admin: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = staker,
        space = 100,
        seeds = [pool_config_account.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub user_info: Account<'info, UserInfo>,

    #[account(mut)]
    pub staker_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub staker_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_reward_token_vault: Account<'info, TokenAccount>,

    pub pool_config_account: Account<'info, PoolConfig>,

    #[account(mut)]
    pub pool_state_account: Account<'info, PoolState>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}

impl<'info> Stake<'info> {
    fn into_transfer_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.staker_stake_token_vault.to_account_info(),
            to: self.pool_stake_token_vault.to_account_info(),
            authority: self.staker.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
