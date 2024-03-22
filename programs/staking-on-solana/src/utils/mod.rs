use anchor_lang::{ prelude::*, solana_program::clock };
// use anchor_spl::token::{ self, Transfer };
// use anchor_spl::token_interface::TokenAccount;

use crate::state::*;

// Update reward variables of the given pool to be up-to-date.
pub fn update_pool<'info>(
    pool_config: &Account<'info, PoolConfig>,
    pool_state: &mut Account<'info, PoolState>
) -> Result<()> {
    let clock = Clock::get()?;
    msg!("millisecons slot {}", clock::DEFAULT_MS_PER_SLOT);

    if clock.slot <= pool_state.last_reward_slot || pool_state.last_reward_slot == 0 {
        return Ok(());
    }

    if pool_state.total_staked == 0 {
        pool_state.last_reward_slot = clock.slot;
        return Ok(());
    }

    let multiplier = get_multiplier(pool_state.last_reward_slot, clock.slot, pool_config.end_slot);
    let reward = multiplier * pool_config.reward_per_slot;
    let precision_factor = get_precision_factor(pool_config);

    pool_state.acc_token_per_share += (reward * precision_factor) / pool_state.total_staked;

    pool_state.last_reward_slot = clock.slot;
    pool_state.should_total_paid += reward;

    msg!("current slot {}", clock.slot);
    msg!("pool_state.last_reward_slot {}", pool_state.last_reward_slot);
    msg!("pool_config.end_slot {}", pool_config.end_slot);
    msg!("multiplier {}", multiplier);
    msg!("pool_config.reward_per_slot {}", pool_config.reward_per_slot);
    msg!("reward {}", reward);
    msg!("precision_factor {}", precision_factor);
    msg!("pool_state.total_staked {}", pool_state.total_staked);
    msg!("pool_state.acc_token_per_share {}", pool_state.acc_token_per_share);
    msg!("pool_state.last_reward_slot {}", pool_state.last_reward_slot);
    msg!("pool_state.should_total_paide {}", pool_state.should_total_paid);

    Ok(())
}

pub fn get_multiplier(from_slot: u64, to_slot: u64, pool_end_slot: u64) -> u64 {
    if to_slot <= pool_end_slot {
        return to_slot - from_slot;
    } else if from_slot >= pool_end_slot {
        return 0;
    } else {
        return pool_end_slot - from_slot;
    }
}

pub fn get_precision_factor(pool_config: &Account<PoolConfig>) -> u64 {
    let base: u64 = 10;
    let precision_decimals = 9 - pool_config.reward_mint_decimals;
    let precision_factor = base.pow(precision_decimals as u32);
    precision_factor
}

pub fn insufficient_rewards(
    pool_config: &Account<PoolConfig>,
    pool_state: &mut Account<PoolState>
) -> u64 {
    let mut adjusted_should_total_paid = pool_state.should_total_paid;
    let remain_rewards = available_reward_tokens(pool_config, pool_state) + pool_state.paid_rewards;

    if pool_config.start_slot == 0 {
        adjusted_should_total_paid +=
            pool_config.reward_per_slot * (pool_config.duration as u64) * SLOTS_PER_DAY;
    } else {
        let remain_blocks = get_multiplier(
            pool_state.last_reward_slot,
            pool_config.end_slot,
            pool_config.end_slot
        );
        adjusted_should_total_paid += pool_config.reward_per_slot * remain_blocks;
    }

    if remain_rewards >= adjusted_should_total_paid {
        return 0;
    }

    return adjusted_should_total_paid - remain_rewards;
}

pub fn available_reward_tokens(
    pool_config: &Account<PoolConfig>,
    pool_state: &mut Account<PoolState>
) -> u64 {
    let amount = pool_state.reward_amount;
    if pool_config.reward_mint == pool_config.stake_mint {
        if amount < pool_state.total_staked {
            return 0;
        }
        return amount - pool_state.total_staked;
    }
    return amount;
}

#[macro_export]
macro_rules! require_lte {
    ($value1:expr, $value2:expr, $error_code:expr $(,)?) => {
        if $value1 > $value2 {
            return Err(error!($error_code).with_values(($value1, $value2)));
        }
    };
}

// pub fn transfer_tokens<'info>(
//     from: AccountInfo<'info>,
//     to: AccountInfo<'info>,
//     authority: &AccountInfo<'info>,
//     amount: u64,
//     token_program: AccountInfo<'info>
// ) -> Result<()> {
//     let cpi_accounts = Transfer {
//         from: from.to_account_info(),
//         to: to.to_account_info(),
//         authority: authority.to_account_info(),
//     };
//     let cpi_program = token_program.to_account_info();
//     let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
//     token::transfer(cpi_ctx, amount)
// }
/* 
pub fn initialize_mint<'info>(
    token_program: AccountInfo<'info>,
    x_mint: AccountInfo<'info>,
    rent: &Sysvar<'info, Rent>,
    mint_authority: &AccountInfo<'info>,
    decimals: u8
) -> Result<()> {
    let cpi_accounts = InitializeMint {
        mint: x_mint.to_account_info(),
        rent: rent.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(token_program, cpi_accounts);
    token::initialize_mint(cpi_ctx, decimals, mint_authority.key, None)
}

pub fn mint_x_tokens<'info>(
    token_program: AccountInfo<'info>,
    x_mint: AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    mint_authority: &AccountInfo<'info>,
    amount: u64
) -> Result<()> {
    let cpi_accounts = MintTo {
        mint: x_mint,
        to: destination.to_account_info(),
        authority: mint_authority.clone(),
    };
    let cpi_ctx = CpiContext::new(token_program, cpi_accounts);
    token::mint_to(cpi_ctx, amount)
}

pub fn burn_x_tokens<'info>(
    token_program: AccountInfo<'info>,
    x_mint: AccountInfo<'info>,
    source: AccountInfo<'info>,
    burn_authority: &AccountInfo<'info>,
    amount: u64
) -> Result<()> {
    let cpi_accounts = Burn {
        mint: x_mint,
        from: source,
        authority: burn_authority.clone(),
    };
    let cpi_ctx = CpiContext::new(token_program, cpi_accounts);
    token::burn(cpi_ctx, amount)
}

// TODO: do something similar to this, but that doesn't result in actual changes
// Something to fetch the current "virtual" pool size, as well as other stuff
pub fn crank<'info>(
    token_program: AccountInfo<'info>,
    vault_info: &Account<'info, VaultInfo>,
    vault_ata: &InterfaceAccount<'info, TokenAccount>,
    pool_info: &mut Account<'info, PoolInfo>,
    pool_ata: &InterfaceAccount<'info, TokenAccount>,
    platform_info: &Account<'info, PlatformInfo>,
    current_block: u64
) -> Result<()> {
    // Calculate the number of blocks since the last refill
    let blocks_since_last_refill = current_block.saturating_sub(pool_info.last_refill_block);

    // Calculate the amount to transfer based on the drain rate and blocks passed
    let mut amount_to_transfer = calculate_transfer_amount(
        vault_info.initial_fill,
        platform_info.drain_rate,
        blocks_since_last_refill
    )?;

    // Ensure the vault has enough balance for the transfer
    let vault_balance = vault_ata.amount;
    if amount_to_transfer > vault_balance {
        amount_to_transfer = vault_balance; // just drain everything at the end
    }

    // Perform the transfer from the vault to the pool
    let cpi_accounts = Transfer {
        from: vault_ata.to_account_info(),
        to: pool_ata.to_account_info(),
        authority: vault_ata.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(token_program, cpi_accounts);
    token::transfer(cpi_ctx, amount_to_transfer)?;

    // Update the last refill block to the current block
    pool_info.last_refill_block = current_block;

    Ok(())
}

fn calculate_transfer_amount(
    initial_fill: u64,
    drain_rate: f64,
    blocks_since_last_refill: u64
) -> Result<u64> {
    let blocks_per_day = 216000;
    let days_since_last_refill = (blocks_since_last_refill as f64) / (blocks_per_day as f64);
    let amount_to_transfer = ((initial_fill as f64) * drain_rate * days_since_last_refill) as u64;
    Ok(amount_to_transfer)
}

//TODO: this is for sure wrong
pub fn calculate_x_tokens_to_mint(
    user_stake: u64,
    total_pool_tokens: u64,
    total_x_tokens_minted: u64
) -> u64 {
    // Calculate the new total pool tokens after the user's stake is added
    let new_total_pool_tokens = total_pool_tokens + user_stake;

    // Calculate the proportion of the pool that the user's stake represents
    let user_stake_proportion = (user_stake as f64) / (new_total_pool_tokens as f64);

    // Calculate the number of xTokens to mint for the user based on their proportion of the pool
    let x_tokens_to_mint = user_stake_proportion * (total_x_tokens_minted as f64);

    x_tokens_to_mint.round() as u64 // Assuming rounding to the nearest whole number for simplicity
}

pub fn calculate_tokens_from_x_tokens(
    x_tokens_to_burn: u64,
    total_pool_tokens: u64,
    total_x_tokens_minted: u64
) -> Result<u64> {
    // Ensure that we do not divide by zero
    if total_x_tokens_minted == 0 {
        return Err(CustomError::DivisionByZero.into());
    }
    // Calculate the equivalent amount of tokens for the xTokens
    let tokens_to_transfer =
        ((x_tokens_to_burn as f64) / (total_x_tokens_minted as f64)) * (total_pool_tokens as f64);
    Ok(tokens_to_transfer.round() as u64)
}
*/
