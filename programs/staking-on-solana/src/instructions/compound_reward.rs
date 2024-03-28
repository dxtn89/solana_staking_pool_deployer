use anchor_lang::{ prelude::*, solana_program };
use anchor_spl::token::{ self, TokenAccount };
use raydium_contract_instructions::amm_instruction;

use crate::state::*;
use crate::utils::*;
use crate::error::*;
use crate::events::*;

pub fn handler(ctx: Context<CompoundReward>) -> Result<()> {
    let pool_config = &mut ctx.accounts.pool_config_account;
    let pool_state = &mut ctx.accounts.pool_state_account;
    let user_info = &mut ctx.accounts.user_info;

    let clock = Clock::get()?;

    msg!("current slot {}", clock.slot);
    msg!("pool_config.start_slot {}", pool_config.start_slot);
    msg!("pool_config.end_slot {}", pool_config.end_slot);

    let _ = update_pool(pool_config, pool_state);

    if user_info.staked_amount == 0 {
        return Ok(());
    }

    let precision_factor = get_precision_factor(pool_config);

    // Transfer the user his reward so far
    let mut pending =
        (user_info.staked_amount * pool_state.acc_token_per_share) / precision_factor -
        user_info.reward_debt;

    if pending > 0 {
        require!(
            available_reward_tokens(pool_config, pool_state) >= pending,
            BrewStakingError::InsufficientReward
        );

        if pool_state.total_earned > pending {
            pool_state.total_earned -= pending;
        } else {
            pool_state.total_earned = 0;
        }

        pool_state.paid_rewards += pending;

        emit!(Compound {
            compounder: ctx.accounts.user.key(),
            amount: pending,
        });

        // swap stake token to reward token
        if pool_config.stake_mint != pool_config.reward_mint {
            pending = 0;
            let minimum_amount_out = 1;
            let ix = amm_instruction::swap_base_in(
                &amm_instruction::ID,
                ctx.accounts.amm.key,
                ctx.accounts.amm_authority.key,
                ctx.accounts.amm_open_orders.key,
                ctx.accounts.amm_target_orders.key,
                ctx.accounts.pool_coin_token_account.key,
                ctx.accounts.pool_pc_token_account.key,
                ctx.accounts.serum_program.key,
                ctx.accounts.serum_market.key,
                ctx.accounts.serum_bids.key,
                ctx.accounts.serum_asks.key,
                ctx.accounts.serum_event_queue.key,
                ctx.accounts.serum_coin_vault_account.key,
                ctx.accounts.serum_pc_vault_account.key,
                ctx.accounts.serum_vault_signer.key,
                &ctx.accounts.pool_reward_token_vault.key(),
                &ctx.accounts.pool_stake_token_vault.key(),
                ctx.accounts.user_source_owner.key,
                pending,
                minimum_amount_out
            )?;
            solana_program::program::invoke_signed(
                &ix,
                // &ToAccountInfos::to_account_infos(&ctx),
                &[
                    ctx.accounts.amm.clone(),
                    ctx.accounts.amm_authority.clone(),
                    ctx.accounts.amm_open_orders.clone(),
                    ctx.accounts.amm_target_orders.clone(),
                    ctx.accounts.pool_coin_token_account.clone(),
                    ctx.accounts.pool_pc_token_account.clone(),
                    ctx.accounts.serum_program.clone(),
                    ctx.accounts.serum_market.clone(),
                    ctx.accounts.serum_bids.clone(),
                    ctx.accounts.serum_asks.clone(),
                    ctx.accounts.serum_event_queue.clone(),
                    ctx.accounts.serum_coin_vault_account.clone(),
                    ctx.accounts.serum_pc_vault_account.clone(),
                    ctx.accounts.serum_vault_signer.clone(),
                    ctx.accounts.pool_reward_token_vault.to_account_info(),
                    ctx.accounts.pool_stake_token_vault.to_account_info(),
                    ctx.accounts.user_source_owner.clone(),
                    ctx.accounts.spl_token_program.clone(),
                ],
                &[&[ctx.accounts.user.key.as_ref()]]
                // ctx.bumps.
            )?;
        }

        pool_state.total_staked += pending;
        user_info.staked_amount += pending;

        emit!(Deposit {
            staker: ctx.accounts.user.key(),
            amount: pending,
        });
    }

    user_info.reward_debt =
        (user_info.staked_amount * pool_state.acc_token_per_share) / precision_factor;
    Ok(())
}

#[derive(Accounts)]
pub struct CompoundReward<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK:
    #[account(mut)]
    pub admin: AccountInfo<'info>,

    #[account(mut)]
    pub user_info: Box<Account<'info, UserInfo>>,

    pub pool_config_account: Box<Account<'info, PoolConfig>>,

    #[account(mut)]
    pub pool_state_account: Box<Account<'info, PoolState>>,

    #[account(mut)]
    pub pool_stake_token_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub pool_reward_token_vault: Box<Account<'info, TokenAccount>>,

    // #[account(mut)]
    // pub treasury_stake_token_vault: Box<Account<'info, TokenAccount>>,

    // pub system_program: Program<'info, System>,

    pub token_program: Program<'info, token::Token>,

    // Raydium Swap Accounts
    /// CHECK: Safe. amm Account
    #[account(mut)]
    pub amm: AccountInfo<'info>,
    /// CHECK: Safe. Amm authority Account
    pub amm_authority: AccountInfo<'info>,
    /// CHECK: Safe. amm open_orders Account
    #[account(mut)]
    pub amm_open_orders: AccountInfo<'info>,
    /// CHECK: Safe. amm target_orders Account
    #[account(mut)]
    pub amm_target_orders: AccountInfo<'info>,
    /// CHECK: Safe. pool_token_coin Amm Account to swap FROM or To,
    #[account(mut)]
    pub pool_coin_token_account: AccountInfo<'info>,
    /// CHECK: Safe. pool_token_pc Amm Account to swap FROM or To,
    #[account(mut)]
    pub pool_pc_token_account: AccountInfo<'info>,
    /// CHECK: Safe. serum dex program id
    pub serum_program: AccountInfo<'info>,
    /// CHECK: Safe. serum market Account. serum_dex program is the owner.
    #[account(mut)]
    pub serum_market: AccountInfo<'info>,
    /// CHECK: Safe. bids Account
    #[account(mut)]
    pub serum_bids: AccountInfo<'info>,
    /// CHECK: Safe. asks Account
    #[account(mut)]
    pub serum_asks: AccountInfo<'info>,
    /// CHECK: Safe. event_q Account
    #[account(mut)]
    pub serum_event_queue: AccountInfo<'info>,
    /// CHECK: Safe. coin_vault Account
    #[account(mut)]
    pub serum_coin_vault_account: AccountInfo<'info>,
    /// CHECK: Safe. pc_vault Account
    #[account(mut)]
    pub serum_pc_vault_account: AccountInfo<'info>,
    /// CHECK: Safe. vault_signer Account
    #[account(mut)]
    pub serum_vault_signer: AccountInfo<'info>,
    /// CHECK: Safe. user source token Account. user Account to swap from.
    // #[account(mut)]
    // pub user_source_token_account: AccountInfo<'info>,
    // /// CHECK: Safe. user destination token Account. user Account to swap to.
    // #[account(mut)]
    // pub user_destination_token_account: AccountInfo<'info>,
    /// CHECK: Safe. user owner Account
    #[account(signer)]
    pub user_source_owner: AccountInfo<'info>,
    /// CHECK: Safe. The spl token program
    #[account(address = spl_token::ID)]
    pub spl_token_program: AccountInfo<'info>,
}
