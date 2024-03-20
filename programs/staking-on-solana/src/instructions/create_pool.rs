use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, TokenAccount, Transfer };
use anchor_lang::system_program;

use crate::state::*;

pub fn handler(
    ctx: Context<CreatePool>,
    pool_id: String,
    pool_fee: u8,
    initial_funding: u64,
    reward_per_slot: u64,
    start_slot: u64,
    end_slot: u64
) -> Result<()> {
    let pool_config = &mut ctx.accounts.pool_config;
    pool_config.owner = ctx.accounts.creator.key();
    pool_config.pool_id = pool_id;
    pool_config.pool_fee = pool_fee;
    pool_config.start_slot = start_slot;
    pool_config.end_slot = end_slot;
    pool_config.reward_per_slot = reward_per_slot;

    pool_config.stake_mint = ctx.accounts.stake_mint.key();
    pool_config.reward_mint = ctx.accounts.reward_mint.key();
    pool_config.stake_mint_decimals = ctx.accounts.stake_mint.decimals;
    pool_config.reward_mint_decimals = ctx.accounts.reward_mint.decimals;
    pool_config.pool_reward_token_vault = ctx.accounts.pool_reward_token_vault.key();
    pool_config.pool_stake_token_vault = ctx.accounts.pool_stake_token_vault.key();
    pool_config.state_addr = ctx.accounts.pool_state.key();

    // Transfer reward token from creator to pool account
    token::transfer(ctx.accounts.transfer_reward_to_pool_context(), initial_funding)?;

    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.reward_amount = initial_funding;
    pool_state.total_staked = 0;

    // Trasfer deploy fee from creator to platform treasury
    let platform = &ctx.accounts.platform;

    let cpi_program = ctx.accounts.system_program.to_account_info();
    let cpi_accounts = system_program::Transfer {
        from: ctx.accounts.creator.to_account_info(),
        to: ctx.accounts.treasury.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    system_program::transfer(cpi_ctx, platform.deploy_fee)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(pool_id: String)]
pub struct CreatePool<'info> {
    #[account(
        // init_if_needed,
        init,
        payer = creator,
        space = POOL_CONFIG_SIZE,
        seeds = [pool_id.as_bytes().as_ref(), creator.key().as_ref()],
        bump
    )]
    pub pool_config: Account<'info, PoolConfig>,

    #[account(init, payer = creator, space = POOL_STATE_SIZE)]
    pub pool_state: Account<'info, PoolState>,

    pub platform: Account<'info, PlatformInfo>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub treasury: Signer<'info>,

    pub stake_mint: Account<'info, Mint>,

    pub reward_mint: Account<'info, Mint>,

    #[account(mut)]
    pub pool_stake_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_reward_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator_reward_token_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}

impl<'info> CreatePool<'info> {
    fn transfer_reward_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.creator_reward_token_vault.to_account_info(),
            to: self.pool_reward_token_vault.to_account_info(),
            authority: self.creator.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}
