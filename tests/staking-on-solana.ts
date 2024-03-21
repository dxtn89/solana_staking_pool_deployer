import {
  web3,
  workspace,
  AnchorProvider,
  getProvider,
  setProvider,
  Wallet,
  BN,
  Program,
} from "@coral-xyz/anchor";
import {
  Account,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createWithSeedSync } from "@coral-xyz/anchor/dist/cjs/utils/pubkey";
import { assert } from "chai";
import { StakingOnSolana } from "../target/types/staking_on_solana";
import { createRandomMint, createRandomWalletAndAirdrop } from "./utils";

// Configure the client to use the local cluster.
const provider = AnchorProvider.env();
setProvider(provider);

// @ts-ignore
let admin = getProvider().wallet;

const program = workspace.StakingOnSolana as Program<StakingOnSolana>;

describe("staking-on-solana", () => {
  let user;
  let treasury;
  const deploy_fee = new BN(0.8 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports
  const stake_fee = 200; // Percent * 100
  const unstake_fee = 200; // Percent * 100

  before(async () => {
    // Create treasury wallet
    treasury = await createRandomWalletAndAirdrop(provider, 2)

    // Fetch the PDA of platform info account
    const [platform_info_pda] = await web3.PublicKey.findProgramAddressSync(
      [treasury.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .initialize(
        deploy_fee,
        stake_fee,
        unstake_fee
      )
      .accounts({
        platform: platform_info_pda,
        treasury: treasury.publicKey,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([treasury])
      .rpc();

    // Create staker wallet and airdrop SOL
    user = await createRandomWalletAndAirdrop(provider, 2)
  });


  it("create pool_config account", async () => {
    const duration = 30;
    const stakeDecimals = 6;
    const rewardDecimals = 8;
    const initialFunding = 14; // 14 tokens of mock reward with 6 decimals
    const rewardPerSlot = new BN(15000);
    const poolFee = 5;

    const treasuryLamportsBefore = await provider.connection.getBalance(treasury.publicKey);

    const res = await init_pool("0", duration, stakeDecimals, rewardDecimals, initialFunding, rewardPerSlot, poolFee);

    // Fetch the pool config account and log results
    const pool_config = await program.account.poolConfig.fetch(res.POOL_CONFIG_PDA);

    console.log(`pool owner: `, pool_config.owner.toString());
    console.log(`pool id: `, pool_config.poolId);
    console.log(`pool fee: `, pool_config.poolFee);
    console.log(`pool start_slot: `, pool_config.startSlot);
    console.log(`pool end_slot: `, pool_config.endSlot);
    console.log(`pool reward rate: `, pool_config.rewardPerSlot);
    console.log(`pool stakeMint: `, pool_config.stakeMint.toString());
    console.log(`pool rewardMint: `, pool_config.rewardMint.toString());
    console.log(`pool poolStakeTokenVault: `, pool_config.poolStakeTokenVault.toString());
    console.log(`pool poolRewardTokenVault: `, pool_config.poolRewardTokenVault.toString());

    // Assert initial funding transfer
    const creatorRewardInfo = await provider.connection.getTokenAccountBalance(res.creatorRewardTokenVault.address)
    assert.equal(
      creatorRewardInfo.value.amount.toString(),
      '0',
      "The creator reward token account should be empty"
    );

    const poolInitialInfo = await provider.connection.getTokenAccountBalance(res.poolRewardTokenVault.address)
    assert.equal(
      poolInitialInfo.value.amount.toString(),
      new BN(10 ** stakeDecimals * initialFunding).toString(),
      "The pool reward token account should match the initial funding amount"
    );

    // Assert Treasury has right amount added
    const treasuryLamportsAfter = await provider.connection.getBalance(treasury.publicKey);
    assert.equal(
      (treasuryLamportsAfter - treasuryLamportsBefore).toString(),
      deploy_fee.toString(),
      "Treasury don't have the correct deploye fee transferded"
    );
  });

  it("create another pool_config account and read all", async () => {
    const duration = 365;
    const stakeDecimals = 9;
    const rewardDecimals = 6;
    const initialFunding = 11; // 11 tokens of mock reward with 6 decimals
    const rewardPerSlot = new BN(20000);
    const poolFee = 10;

    await init_pool("1", duration, stakeDecimals, rewardDecimals, initialFunding, rewardPerSlot, poolFee);

    const pools = await program.account.poolConfig.all();

    pools.forEach((pool, index) => {
      console.log(`pool pda: `, pool.publicKey.toString());
      console.log(`pool owner: `, pool.account.owner.toString());
      console.log(`pool id: `, pool.account.poolId);
    });
  });

  it("Stakes token into the pool and verifies balances, with paramters from certain config account", async () => {
    // Get pool config list and select one
    const pools = await program.account.poolConfig.all();
    const selected_pool = pools[0]

    console.log("Selected Staking Pool Config PDA: ", selected_pool.publicKey)

    // Get a stake token account for the pool user
    const userStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      user.publicKey
    );

    const userInitialAmount = new BN(8000000); // 8 of stake token
    // Mint some mock stake token to the staker's account
    await mintTo(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      userStakeTokenVault.address,
      admin.publicKey,
      BigInt(userInitialAmount) // 20 tokens of mock USDC
    );

    // Create a reward token account for the pool user
    const userRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.rewardMint,
      user.publicKey
    );

    const stakeAmount = new BN(5000000); // 5 of stake token

    // Fetch the PDA of pool config account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [selected_pool.publicKey.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    // Fetch the PDA of platform info account
    const [platform_info_pda] = await web3.PublicKey.findProgramAddressSync(
      [treasury.publicKey.toBuffer()],
      program.programId
    );

    // Get a stake token account for the treasury
    const treasuryStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      treasury.publicKey
    );

    await program.methods
      .stake(stakeAmount)
      .accounts({
        staker: user.publicKey,
        admin: admin.publicKey,
        platform: platform_info_pda,
        userInfo: userInfoPDA,
        userStakeTokenVault: userStakeTokenVault.address,
        userRewardTokenVault: userRewardTokenVault.address,
        poolStakeTokenVault: selected_pool.account.poolStakeTokenVault,
        poolRewardTokenVault: selected_pool.account.poolRewardTokenVault,
        treasuryStakeTokenVault: treasuryStakeTokenVault.address,
        poolConfigAccount: selected_pool.publicKey,
        poolStateAccount: selected_pool.account.stateAddr,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    // Assert staker remaining stake token amount
    const userStakeInfo = await provider.connection.getTokenAccountBalance(userStakeTokenVault.address)
    assert.equal(
      userStakeInfo.value.amount.toString(),
      (userInitialAmount - stakeAmount).toString(),
      "Remaining user stake token amount is not right"
    );

    // Assert treasury has received correct stake fee
    const platform = await program.account.platformInfo.fetch(platform_info_pda);
    const treasuryStakeInfo = await provider.connection.getTokenAccountBalance(treasuryStakeTokenVault.address)
    const stakeFee = stakeAmount * platform.stakeFee / 10000
    assert.equal(
      treasuryStakeInfo.value.amount.toString(),
      stakeFee.toString(),
      "Remaining user stake token amount is not right"
    );

    // Assert pool stake token amount
    const poolStakeInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolStakeTokenVault)
    assert.equal(
      poolStakeInfo.value.amount.toString(),
      (stakeAmount - stakeFee).toString(),
      "The pool stake token account should match the staked amount"
    );

  });

  it("User claims his reward, and assert reward transfer", async () => {
    // Get pool config list and select one
    const pools = await program.account.poolConfig.all();
    const selected_pool = pools[0]

    console.log("Selected Claim Pool Config PDA: ", selected_pool.publicKey)

    // Create a reward token account for the pool user
    const userRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.rewardMint,
      user.publicKey
    );

    // Fetch the PDA of user info account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [selected_pool.publicKey.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    // Check pool reward amount before claim
    let poolRewardInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolRewardTokenVault);
    console.log("pool reward before claim: ", poolRewardInfo.value.amount.toString())

    await program.methods
      .claimReward()
      .accounts({
        claimer: user.publicKey,
        admin: admin.publicKey,
        userRewardTokenVault: userRewardTokenVault.address,
        poolRewardTokenVault: selected_pool.account.poolRewardTokenVault,
        userInfo: userInfoPDA,
        poolConfigAccount: selected_pool.publicKey,
        poolStateAccount: selected_pool.account.stateAddr,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      // .signers([admin.payer])
      .rpc();


    // Check pool reward amount after claim
    poolRewardInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolRewardTokenVault);
    console.log("pool reward after claim: ", poolRewardInfo.value.amount.toString())

    // Assert pool has correct reward amount as in pool state

    const pool_state = await program.account.poolState.fetch(selected_pool.account.stateAddr)

    assert.equal(
      poolRewardInfo.value.amount.toString(),
      pool_state.rewardAmount.toString(),
      "The creator reward token account should be empty"
    );
  });

  it("User unstakes from the pool, and assert the results", async () => {
    // Get pool config list and select one
    const pools = await program.account.poolConfig.all();
    const selected_pool = pools[0]

    console.log("Selected Unstake Pool Config PDA: ", selected_pool.publicKey)

    // Create a reward token account for the pool user
    const userStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      user.publicKey
    );

    // Create a reward token account for the pool user
    const userRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.rewardMint,
      user.publicKey
    );

    // Fetch the PDA of user info account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [selected_pool.publicKey.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );
    const user_info = await program.account.userInfo.fetch(userInfoPDA)

    // Check pool stake amount before unstake
    let poolStakeInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolStakeTokenVault);
    const poolUnstakeBefore = poolStakeInfo.value.amount;

    // Fetch the PDA of platform info account
    const [platform_info_pda] = await web3.PublicKey.findProgramAddressSync(
      [treasury.publicKey.toBuffer()],
      program.programId
    );

    // Get a stake token account for the treasury
    const treasuryStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      treasury.publicKey
    );

    const unstakeAmount = new BN(3000000);

    await program.methods
      .unstake(unstakeAmount)
      .accounts({
        user: user.publicKey,
        admin: admin.publicKey,
        poolConfigAccount: selected_pool.publicKey,
        poolStateAccount: selected_pool.account.stateAddr,
        platform: platform_info_pda,
        userInfo: userInfoPDA,
        userStakeTokenVault: userStakeTokenVault.address,
        userRewardTokenVault: userRewardTokenVault.address,
        poolStakeTokenVault: selected_pool.account.poolStakeTokenVault,
        poolRewardTokenVault: selected_pool.account.poolRewardTokenVault,
        treasuryStakeTokenVault: treasuryStakeTokenVault.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      // .signers([admin.payer])
      .rpc();

    poolStakeInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolStakeTokenVault);
    const poolUnstakeAfter = poolStakeInfo.value.amount;

    // Assert pool has correct reward amount as in pool state

    assert.equal(
      unstakeAmount.toString(),
      (poolUnstakeBefore - poolUnstakeAfter).toString(),
      "pool stake amount difference should match user staked amount"
    );

  });

  async function init_pool(poolId: string, duration, stakeDecimals, rewardDecimals, initialFunding, rewardPerSlot, poolFee) {
    // Create staker wallet and airdrop    
    const creator = await createRandomWalletAndAirdrop(provider, 2)
    // Create a new mint for mock stake token
    const stakeMint = await createRandomMint(provider, stakeDecimals)
    // Create a new mint for mock reward token
    const rewardMint = await createRandomMint(provider, rewardDecimals)

    // Create a reward token account for the pool creator
    const creatorRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      creator.publicKey
    );

    const fundingAmount = new BN(10 ** stakeDecimals * initialFunding)

    // Mint some mock reward token to the pool creator's account
    await mintTo(
      provider.connection,
      admin.payer,
      rewardMint,
      creatorRewardTokenVault.address,
      admin.publicKey,
      BigInt(fundingAmount)
    );

    // Create a reward token account for the pool creator
    const poolRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      admin.publicKey
    );

    // Create a token account for the pool to receive staked token
    const poolStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      stakeMint,
      admin.publicKey
    );

    // Fetch the PDA of pool config account
    const [POOL_CONFIG_PDA] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from(poolId), creator.publicKey.toBuffer()],
      program.programId
    );

    console.log(`Pool PDA: ${POOL_CONFIG_PDA.toString()}`);

    // Pool State Account
    const poolStateAccount = web3.Keypair.generate();

    // Fetch the PDA of platform info account
    const [platform_info_pda] = await web3.PublicKey.findProgramAddressSync(
      [treasury.publicKey.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .createPool(
        poolId,
        poolFee,
        fundingAmount,
        rewardPerSlot,
        duration
      )
      .accounts({
        platform: platform_info_pda,
        poolState: poolStateAccount.publicKey,
        poolConfig: POOL_CONFIG_PDA,
        creator: creator.publicKey,
        treasury: treasury.publicKey,
        stakeMint: stakeMint,
        rewardMint: rewardMint,
        poolStakeTokenVault: poolStakeTokenVault.address,
        creatorRewardTokenVault: creatorRewardTokenVault.address,
        poolRewardTokenVault: poolRewardTokenVault.address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([creator, treasury, poolStateAccount])
      .rpc();

    console.log(`Pool Init Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    return {
      POOL_CONFIG_PDA,
      stakeMint,
      rewardMint,
      creatorRewardTokenVault,
      poolRewardTokenVault,
      poolStakeTokenVault,
      poolStateAccount,
      initialFunding
    };
  }


});
