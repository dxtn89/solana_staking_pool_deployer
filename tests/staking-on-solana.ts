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
  before(async () => {
  });

  async function init_pool(poolId: string, startSlot: BN, endSlot: BN, initialFunding, rewardRate, poolFee) {
    // Create staker wallet and airdrop    
    const creator = await createRandomWalletAndAirdrop(provider, 2)
    // Create a new mint for mock stake token
    const stakeMint = await createRandomMint(provider, 6)
    // Create a new mint for mock reward token
    const rewardMint = await createRandomMint(provider, 6)

    // Create a reward token account for the pool creator
    const creatorRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      creator.publicKey
    );

    // Mint some mock reward token to the pool creator's account
    await mintTo(
      provider.connection,
      admin.payer,
      rewardMint,
      creatorRewardTokenVault.address,
      admin.publicKey,
      BigInt(initialFunding)
    );

    // Create a reward token account for the pool creator
    const poolRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      rewardMint,
      program.programId
    );

    // Create a token account for the pool to receive staked token
    const poolStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      stakeMint,
      program.programId
    );

    // Fetch the PDA of pool config account
    const [POOL_CONFIG_PDA] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from(poolId), creator.publicKey.toBuffer()],
      program.programId
    );

    console.log(`Pool PDA: ${POOL_CONFIG_PDA.toString()}`);

    // Pool State Account
    const poolStateAccount = web3.Keypair.generate();

    const tx = await program.methods
      .initializePool(
        poolId,
        poolFee,
        initialFunding,
        rewardRate,
        startSlot,
        endSlot
      )
      .accounts({
        poolState: poolStateAccount.publicKey,
        poolConfig: POOL_CONFIG_PDA,
        creator: creator.publicKey,
        stakeMint: stakeMint,
        rewardMint: rewardMint,
        poolStakeTokenVault: poolStakeTokenVault.address,
        creatorRewardTokenVault: creatorRewardTokenVault.address,
        poolRewardTokenVault: poolRewardTokenVault.address,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([creator, poolStateAccount])
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

  it("create pool_config account", async () => {
    const start_slot = new BN(1);
    const end_slot = new BN(1e10);
    const initialFunding = new BN(9000000); // 99 tokens of mock reward with 6 decimals
    const rewardRate = new BN(10);
    const poolFee = 5;

    const res = await init_pool("0", start_slot, end_slot, initialFunding, rewardRate, poolFee);

    // Fetch the pool config account and log results
    const pool_config = await program.account.poolConfig.fetch(res.POOL_CONFIG_PDA);

    console.log(`pool owner: `, pool_config.owner.toString());
    console.log(`pool id: `, pool_config.poolId);
    console.log(`pool fee: `, pool_config.poolFee);
    console.log(`pool start_slot: `, pool_config.startSlot);
    console.log(`pool end_slot: `, pool_config.endSlot);
    console.log(`pool reward rate: `, pool_config.rewardRate);
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
      initialFunding.toString(),
      "The pool reward token account should match the initial funding amount"
    );
    // Fetch the pool state account and assert results
    const pool_state = await program.account.poolState.fetch(pool_config.stateAddr)

    assert.equal(
      pool_state.rewardAmount.toString(),
      initialFunding.toString(),
      "The pool state for initial funding is not set correctly."
    );
  });

  it("create another pool_config account and read all", async () => {
    const start_slot = new BN(1);
    const end_slot = new BN(1e10);
    const initialFunding = new BN(11000000); // 11 tokens of mock reward with 6 decimals
    const rewardRate = (22);
    const poolFee = 10;

    await init_pool("1", start_slot, end_slot, initialFunding, rewardRate, poolFee);

    const pools = await program.account.poolConfig.all();

    pools.forEach((pool, index) => {
      console.log(`pool pda: `, pool.publicKey.toString());
      console.log(`pool owner: `, pool.account.owner.toString());
      console.log(`pool id: `, pool.account.poolId);
    });
  });


  it("Stakes token into the pool and verifies balances, with paramters from certain config account", async () => {
    // Create staker wallet and airdrop SOL
    const staker = await createRandomWalletAndAirdrop(provider, 2)

    // Get pool config list and select one
    const pools = await program.account.poolConfig.all();
    const selected_pool = pools[0]

    console.log("Selected Pool Config PDA: ", selected_pool.publicKey)

    // Get a stake token account for the pool user
    const stakerStakeTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      staker.publicKey
    );

    const stakerInitialAmount = new BN(8000000); // 8 of stake token
    // Mint some mock stake token to the staker's account
    await mintTo(
      provider.connection,
      admin.payer,
      selected_pool.account.stakeMint,
      stakerStakeTokenVault.address,
      admin.publicKey,
      BigInt(stakerInitialAmount) // 20 tokens of mock USDC
    );

    // Create a reward token account for the pool user
    const stakerRewardTokenVault = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      selected_pool.account.rewardMint,
      staker.publicKey
    );

    const stakeAmount = new BN(5000000); // 5 of stake token

    // Fetch the PDA of pool config account
    const [userInfoPDA] = await web3.PublicKey.findProgramAddressSync(
      [selected_pool.publicKey.toBuffer(), staker.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
        admin: admin.publicKey,
        userInfo: userInfoPDA,
        stakerStakeTokenVault: stakerStakeTokenVault.address,
        stakerRewardTokenVault: stakerRewardTokenVault.address,
        poolStakeTokenVault: selected_pool.account.poolStakeTokenVault,
        poolRewardTokenVault: selected_pool.account.poolRewardTokenVault,
        poolConfigAccount: selected_pool.publicKey,
        poolStateAccount: selected_pool.account.stateAddr,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([staker])
      .rpc();

    // Assert staker remaining stake token amount
    const stakerStakeInfo = await provider.connection.getTokenAccountBalance(stakerStakeTokenVault.address)
    assert.equal(
      stakerStakeInfo.value.amount.toString(),
      (stakerInitialAmount - stakeAmount).toString(),
      "The creator reward token account should be empty"
    );

    // Assert pool stake token amount
    const poolStakeInfo = await provider.connection.getTokenAccountBalance(selected_pool.account.poolStakeTokenVault)
    assert.equal(
      poolStakeInfo.value.amount.toString(),
      stakeAmount.toString(),
      "The pool reward token account should match the staked amount"
    );

    // Fetch the updated user info account
    const user_info = await program.account.userInfo.fetch(userInfoPDA);

    assert.equal(
      user_info.stakedAmount.toString(),
      stakeAmount.toString(),
      "The user info stakedAmount should match the staked amount"
    );

    console.log("user stacked slot", user_info.depositSlot)
    /*
    
        // Verify the pool's total staked amount has increased
        console.log()
        assert.equal(
          pool.totalStaked.toString(),
          (stakerInitialAmount - stakeAmount).toString(),
          "The total staked amount in the pool should match the stake amount."
        );
    
        // Verify balances after staking
        const [stakerUsdcAccountInfo, poolUsdcAccountInfo] = await Promise.all([
          getAccount(provider.connection, stakerUsdcAccount.address),
          getAccount(provider.connection, poolUsdcAccount.address),
        ]);
    
        const { amount: stakerUsdcBalance } = stakerUsdcAccountInfo;
        const { amount: poolUsdcBalance } = poolUsdcAccountInfo;
    
        assert.equal(
          stakerUsdcBalance.toString(),
          "15000000",
          "The staker's USDC balance is incorrect"
        );
    
        assert.equal(
          poolUsdcBalance.toString(),
          "5000000",
          "The staker's USDC balance is incorrect"
        );
        */
  });


});
