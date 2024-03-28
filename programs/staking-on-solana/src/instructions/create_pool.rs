use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Mint, TokenAccount, Transfer };
use anchor_lang::system_program;
// use spl_associated_token_account::{ get_associated_token_address, create_associated_token_account };

use crate::state::*;
use crate::error::*;

pub fn handler(
    ctx: Context<CreatePool>,
    pool_id: String,
    stake_fee: u16,
    unstake_fee: u16,
    initial_funding: u64,
    reward_per_slot: u64,
    duration: u16
) -> Result<()> {
    require!(stake_fee <= MAX_FEE, BrewStakingError::InvalidStakeFee);
    require!(unstake_fee <= MAX_FEE, BrewStakingError::InvalidUnstakeFee);

    let pool_config = &mut ctx.accounts.pool_config_account;
    pool_config.owner = ctx.accounts.creator.key();
    pool_config.pool_id = pool_id;
    pool_config.stake_fee = stake_fee;
    pool_config.unstake_fee = unstake_fee;
    pool_config.duration = duration;
    pool_config.reward_per_slot = reward_per_slot;

    pool_config.stake_mint = ctx.accounts.stake_mint.key();
    pool_config.reward_mint = ctx.accounts.reward_mint.key();
    pool_config.stake_mint_decimals = ctx.accounts.stake_mint.decimals;
    pool_config.reward_mint_decimals = ctx.accounts.reward_mint.decimals;
    pool_config.pool_reward_token_vault = ctx.accounts.pool_reward_token_vault.key();
    pool_config.pool_stake_token_vault = ctx.accounts.pool_stake_token_vault.key();
    pool_config.state_addr = ctx.accounts.pool_state_account.key();

    // Calculate start and end slot
    // let clock = Clock::get()?;
    // pool_config.start_slot = clock.slot + 10;
    // pool_config.end_slot = pool_config.start_slot + (duration as u64) * SLOTS_PER_DAY;

    // let creator_reward_token_vault = get_associated_token_address(
    //     &ctx.accounts.creator.key(),
    //     &ctx.accounts.reward_mint.key()
    // );

    // Transfer reward token from creator to pool account
    let cpi_accounts = Transfer {
        // from: creator_reward_token_vault.,
        from: ctx.accounts.creator_reward_token_vault.to_account_info(),
        to: ctx.accounts.pool_reward_token_vault.to_account_info(),
        authority: ctx.accounts.creator.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, initial_funding)?;

    let pool_state = &mut ctx.accounts.pool_state_account;
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
    pub pool_config_account: Box<Account<'info, PoolConfig>>,

    #[account(init, payer = creator, space = POOL_STATE_SIZE)]
    pub pool_state_account: Box<Account<'info, PoolState>>,

    pub platform: Box<Account<'info, PlatformInfo>>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(mut)]
    pub treasury: Signer<'info>,

    pub stake_mint: Box<Account<'info, Mint>>,

    pub reward_mint: Box<Account<'info, Mint>>,

    // #[account(
    //     init,
    //     payer = creator,
    //     token::mint = stake_mint,
    //     token::authority = pool_stake_token_vault, //the PDA address is both the vault account and the authority (and event the mint authority)
    //     seeds = [pool_config_account.key().as_ref(), stake_mint.key().as_ref()],
    //     bump
    // )]
    #[account(mut)]
    pub pool_stake_token_vault: Box<Account<'info, TokenAccount>>,

    // #[account(
    //     init,
    //     payer = creator,
    //     token::mint = reward_mint,
    //     token::authority = pool_reward_token_vault, //the PDA address is both the vault account and the authority (and event the mint authority)
    //     seeds = [pool_config_account.key().as_ref(), reward_mint.key().as_ref()],
    //     bump
    // )]
    #[account(mut)]
    pub pool_reward_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub creator_reward_token_vault: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,
}

// impl<'info> CreatePool<'info> {
//     fn transfer_reward_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
//         let cpi_accounts = Transfer {
//             from: self.creator_reward_token_vault.to_account_info(),
//             to: self.pool_reward_token_vault.to_account_info(),
//             authority: self.creator.to_account_info(),
//         };
//         CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
//     }
// }
