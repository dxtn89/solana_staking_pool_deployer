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
import { createRandomMint, createRandomWalletAndAirdrop, getRandomNumber, waitSeconds } from "./utils";

// Configure the client to use the local cluster.
const provider = AnchorProvider.env();
setProvider(provider);

// @ts-ignore
let admin = getProvider().wallet;

const program = workspace.StakingOnSolana as Program<StakingOnSolana>;

describe("staking-on-solana", () => {
  let treasury;
  let deployer1;
  let deployer2;
  let user1;
  let user2;
  const deploy_fee = new BN(0.8 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports
  const performance_fee = new BN(0.05 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports

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
        performance_fee
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
    user1 = await createRandomWalletAndAirdrop(provider, 2)
    user2 = await createRandomWalletAndAirdrop(provider, 2)
    deployer1 = await createRandomWalletAndAirdrop(provider, 2)
    deployer2 = await createRandomWalletAndAirdrop(provider, 2)

    //setup logging event listeners
    program.addEventListener('NewStartAndEndSlots', (event, slot) => {
      console.log('Event NewStartAndEndSlots in slot : ', slot);
      console.log('start slot : ', event.startSlot.toString());
      console.log('end slot : ', event.endSlot.toString());
    });

    program.addEventListener('RewardClaim', (event, slot) => {
      console.log('Event RewardClaim in slot : ', slot);
      console.log('claimer : ', event.claimer.toString());
      console.log('amount : ', event.amount.toString());
    });
  });

  it("create pool_config account", async () => {
    const duration = 30;
    const stakeDecimals = 6;
    const rewardDecimals = 8;
    const initialFunding = 14; // 14 tokens of mock reward with 6 decimals
    const rewardPerSlot = new BN(15000);
    const stakeFee = 200; // Percent * 100
    const unstakeFee = 200; // Percent * 100

    const treasuryLamportsBefore = await provider.connection.getBalance(treasury.publicKey);

    const res = await init_pool(deployer1, duration, stakeFee, unstakeFee, initialFunding, rewardPerSlot, stakeDecimals, rewardDecimals);

    // Fetch the pool config account and log results
    const pool_config = await program.account.poolConfig.fetch(res.POOL_CONFIG_PDA);

    console.log(`pool owner: `, pool_config.owner.toString());
    console.log(`pool id: `, pool_config.poolId);
    console.log(`pool stakeFee: `, pool_config.stakeFee);
    console.log(`pool unstakeFee: `, pool_config.unstakeFee);
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
    const stakeFee = 300; // Percent * 100
    const unstakeFee = 300; // Percent * 100

    await init_pool(deployer2, duration, stakeFee, unstakeFee, initialFunding, rewardPerSlot, stakeDecimals, rewardDecimals);

    const pools = await program.account.poolConfig.all();

    pools.forEach((pool, index) => {
      console.log(`pool pda: `, pool.publicKey.toString());
      console.log(`pool owner: `, pool.account.owner.toString());
      console.log(`pool id: `, pool.account.poolId);
    });
  });

  it("start the pool and check start and end slots", async () => {
    // Get pool config list and select one
    let pools = await program.account.poolConfig.all();

    pools.forEach(async (pool, index) => {
      let deployer = deployer1;
      if (pool.account.owner.toString() == deployer1.publicKey.toString()) {
        deployer = deployer1;
      }
      if (pool.account.owner.toString() == deployer2.publicKey.toString()) {
        deployer = deployer2;
      }

      await program.methods
        .startReward()
        .accounts({
          deployer: deployer.publicKey,
          poolConfigAccount: pool.publicKey,
          poolStateAccount: pool.account.stateAddr,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([deployer])
        .rpc();

      console.log("start slot", pool.account.startSlot.toString())
      console.log("end slot", pool.account.endSlot.toString())
    });

    // Wait some seconds after starting the pool
    console.log("wait 10 seconds...")
    await waitSeconds(10);
    console.log("wait ended...")
  });

  it("Stakes token into the pool and verifies balances, with paramters from certain config account", async () => {
    // Get pool config list and select one
    const pools = await program.account.poolConfig.all();
    const selected_pool = pools[0]

    console.log("Selected Staking Pool Config PDA: ", selected_pool.publicKey)

    const stakeTokens = getRandomNumber(1, 10);

    const stakeResponse = await stake_pool(selected_pool, user1, stakeTokens)

    // Assert staker remaining stake token amount
    const userStakeInfo = await provider.connection.getTokenAccountBalance(stakeResponse.userStakeTokenVault.address)
    assert.equal(
      userStakeInfo.value.amount.toString(),
      (stakeResponse.userInitialAmount - stakeResponse.stakeAmount).toString(),
      "Remaining user stake token amount is not right"
    );

    // Assert treasury has received correct stake fee
    const treasuryStakeInfo = await provider.connection.getTokenAccountBalance(stakeResponse.treasuryStakeTokenVault.address)
    const stakeFee = stakeResponse.stakeAmount * selected_pool.account.stakeFee / 10000
    assert.equal(
      treasuryStakeInfo.value.amount.toString(),
      stakeFee.toString(),
      "Remaining user stake token amount is not right"
    );

    // Assert pool stake token amount
    const poolStakeInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolStakeTokenVault)
    assert.equal(
      poolStakeInfo.value.amount.toString(),
      (stakeResponse.stakeAmount - stakeFee).toString(),
      "The pool stake token account should match the staked amount"
    );
  });

  it("perform stake by another user with delayed time", async () => {
    // Get pool config list and select one
    const pools = await program.account.poolConfig.all();
    const selected_pool = pools[0];

    console.log("Selected Staking Pool Config PDA: ", selected_pool.publicKey)

    let stakeTokens = getRandomNumber(1, 10);
    const stakeResponse = await stake_pool(selected_pool, user2, stakeTokens)

    // Wait some seconds after staked
    console.log("wait 5 seconds...")
    await waitSeconds(5);
    console.log("wait ended...")
    // stake by user1
    stakeTokens = getRandomNumber(1, 10);
    await stake_pool(selected_pool, user1, stakeTokens)

    // Wait some seconds after staked
    console.log("wait 5 seconds...")
    await waitSeconds(5);
    console.log("wait ended...")
    // stake by user2
    stakeTokens = getRandomNumber(1, 10);
    await stake_pool(selected_pool, user2, stakeTokens)
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
      user1.publicKey
    );

    // Create a reward token account for the pool user
    const userRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.rewardMint,
      user1.publicKey
    );

    // Fetch the PDA of user info account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [selected_pool.publicKey.toBuffer(), user1.publicKey.toBuffer()],
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

    const unstakeAmount = new BN(1000000);

    await program.methods
      .unstake(unstakeAmount)
      .accounts({
        user: user1.publicKey,
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
      user1.publicKey
    );

    // Fetch the PDA of user info account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [selected_pool.publicKey.toBuffer(), user1.publicKey.toBuffer()],
      program.programId
    );

    // Check pool reward amount before claim
    let poolRewardInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolRewardTokenVault);
    console.log("pool reward before claim: ", poolRewardInfo.value.amount.toString())

    await program.methods
      .claimReward()
      .accounts({
        claimer: user1.publicKey,
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


  async function init_pool(deployer, duration, stakeFee, unstakeFee, initialFunding, rewardPerSlot, stakeDecimals, rewardDecimals) {
    // Create a new mint for mock stake token
    const stakeMint = await createRandomMint(provider, stakeDecimals)
    // Create a new mint for mock reward token
    const rewardMint = await createRandomMint(provider, rewardDecimals)

    // Create a reward token account for the pool creator
    const creatorRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      deployer.publicKey
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

    const poolId = "0"
    // Fetch the PDA of pool config account
    const [POOL_CONFIG_PDA] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from(poolId), deployer.publicKey.toBuffer()],
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
        stakeFee,
        unstakeFee,
        fundingAmount,
        rewardPerSlot,
        duration
      )
      .accounts({
        platform: platform_info_pda,
        poolState: poolStateAccount.publicKey,
        poolConfig: POOL_CONFIG_PDA,
        creator: deployer.publicKey,
        treasury: treasury.publicKey,
        stakeMint: stakeMint,
        rewardMint: rewardMint,
        poolStakeTokenVault: poolStakeTokenVault.address,
        creatorRewardTokenVault: creatorRewardTokenVault.address,
        poolRewardTokenVault: poolRewardTokenVault.address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([deployer, treasury, poolStateAccount])
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

  async function stake_pool(pool_config, user, stakeTokens) {

    // Get a stake token account for the pool user
    const userStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      pool_config.account.stakeMint,
      user.publicKey
    );

    const userInitialAmount = new BN(10 ** pool_config.account.stakeDecimals * (stakeTokens + 1)); // Mint bit more than the staking amount
    // Mint some mock stake token to the staker's account
    await mintTo(
      provider.connection,
      admin.payer,
      pool_config.account.stakeMint,
      userStakeTokenVault.address,
      admin.publicKey,
      BigInt(userInitialAmount) // 20 tokens of mock USDC
    );

    // Create a reward token account for the pool user
    const userRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      pool_config.account.rewardMint,
      user.publicKey
    );

    const stakeAmount = new BN(10 ** pool_config.account.stakeDecimals * stakeTokens);

    // Fetch the PDA of pool config account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [pool_config.publicKey.toBuffer(), user.publicKey.toBuffer()],
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
      pool_config.account.stakeMint,
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
        poolStakeTokenVault: pool_config.account.poolStakeTokenVault,
        poolRewardTokenVault: pool_config.account.poolRewardTokenVault,
        treasuryStakeTokenVault: treasuryStakeTokenVault.address,
        poolConfigAccount: pool_config.publicKey,
        poolStateAccount: pool_config.account.stateAddr,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    return {
      userStakeTokenVault,
      treasuryStakeTokenVault,
      userInitialAmount,
      stakeAmount
    }

  }


});
