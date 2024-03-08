import {
  AnchorProvider,
  BN,
  Program,
  Wallet,
  getProvider,
  setProvider,
  web3,
  workspace,
} from "@coral-xyz/anchor";
import {
  Account,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

import { StakingOnSolana } from "../target/types/staking_on_solana";
import { createWithSeedSync } from "@coral-xyz/anchor/dist/cjs/utils/pubkey";

describe("staking-on-solana", () => {
  let usdcMint: web3.PublicKey;
  let stakeMint: web3.PublicKey;
  let rewardMint: web3.PublicKey;
  let creatorRewardAccount: Account;
  let poolRewardAccount: Account;
  let poolStakeAccount: Account;
  let poolUsdcAccount: Account;
  let stakerUsdcAccount: Account;
  let poolAccount: web3.Keypair;

  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env();
  setProvider(provider);

  // @ts-ignore
  let wallet = getProvider().wallet;

  const program = workspace.StakingOnSolana as Program<StakingOnSolana>;

  before(async () => {
    // Create a new mint for mock USDC
    usdcMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6, // Assuming 6 decimal places for USDC
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create a token account for the pool to receive USDC
    poolUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      program.programId
    );

    // Create a token account for the staker
    stakerUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    // Mint some mock USDC to the staker's account
    let signature = await mintTo(
      provider.connection,
      wallet.payer,
      usdcMint,
      stakerUsdcAccount.address,
      wallet.publicKey,
      BigInt(20000000) // 20 tokens of mock USDC
    );
    // console.log("mint tx:", signature);

    // Use the provider to create a Keypair for the pool account.
    poolAccount = web3.Keypair.generate();

    // Call the initialize_pool function.
    await program.methods
      .initializePool()
      .accounts({
        pool: poolAccount.publicKey,
        // poolList: poolListAccount,
        user: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([poolAccount])
      .rpc();
  });


  it("create pool_config account", async () => {
    // Create a new mint for mock stake token
    stakeMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create a new mint for mock reward token
    rewardMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    );

    // Create a reward token account for the pool creator
    creatorRewardAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      rewardMint,
      wallet.publicKey
    );

    // Mint some mock reward token to the pool creator's account
    await mintTo(
      provider.connection,
      wallet.payer,
      rewardMint,
      creatorRewardAccount.address,
      wallet.publicKey,
      BigInt(20000000) // 20 tokens of mock USDC
    );

    // Create a reward token account for the pool creator
    poolRewardAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      rewardMint,
      program.programId
    );

    // Create a token account for the pool to receive staked token
    poolStakeAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      stakeMint,
      program.programId
    );

    const POOL_ID = "1";
    const POOL_FEE = 5;

    // Step 2 - Fetch the PDA of our Review account
    const [POOL_CONFIG_PDA] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_ID), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    console.log(`owner: ${provider.wallet.publicKey.toString()}`);
    console.log(`Pool PDA: ${POOL_CONFIG_PDA.toString()}`);

    const rewardAmount = new BN(5000000); // 5 tokens of mock USDC

    // Step 4 - Send and Confirm the Transaction
    const tx = await program.methods
      .createPoolConfig(
        POOL_ID,
        POOL_FEE,
        rewardAmount
      )
      .accounts({
        poolConfig: POOL_CONFIG_PDA,
        creator: wallet.publicKey,
        stakeMint: stakeMint,
        rewardMint: rewardMint,
        creatorRewardAccount: creatorRewardAccount.address,
        poolRewardAccount: poolRewardAccount.address,
        poolStakeAccount: poolStakeAccount.address,
      })
      .rpc();

    // console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Step 5 - Fetch the data account and log results
    const data = await program.account.poolConfig.fetch(POOL_CONFIG_PDA);
    console.log(`pool onwer: `, data.owner);
    console.log(`pool id: `, data.poolId);
    console.log(`pool fee: `, data.poolFee);
    console.log(`pool stakeMint: `, data.stakeMint);
    console.log(`pool rewardMint: `, data.rewardMint);
    console.log(`pool creatorRewardAccount: `, data.creatorRewardAccount);
    console.log(`pool poolStakeAccount: `, data.poolStakeAccount);
  });

  it("create another pool_config account and read all", async () => {
    const POOL_ADDRESS = "POOL_ADDRESS1";
    const POOL_FEE = 3;

    // Step 2 - Fetch the PDA of our Review account
    const [POOL_CONFIG_PDA] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from(POOL_ADDRESS), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    console.log(`owner: ${provider.wallet.publicKey.toString()}`);
    console.log(`Pool PDA: ${POOL_CONFIG_PDA.toString()}`);

    // Step 4 - Send and Confirm the Transaction
    const tx = await program.methods
      .createPoolConfig(
        POOL_ADDRESS,
        POOL_FEE
      )
      .accounts({ poolConfig: POOL_CONFIG_PDA })
      .rpc();

    // console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    const data = await program.account.poolConfig.all();

    data.forEach((item, index) => {
      console.log(index)
      console.log(`pool adress: `, item.account.poolAddr);
      console.log(`pool fee: `, item.account.poolFee);
    });
  });

  it("Initializes the staking pool", async () => {
    // Fetch the pool account from the chain.
    const pool = await program.account.pool.fetch(poolAccount.publicKey);

    // Verify the pool's state.
    assert.equal(
      pool.totalStaked.toNumber(),
      0,
      "The pool was not initialized correctly"
    );
  });

  it("Stakes token into the pool and verifies balances, with paramters from certain config account", async () => {
    const data = await program.account.poolConfig.all();

    const selectedConfig = data[0]

    console.log("Selected Pool Config")
    console.log("Pool Address: ", selectedConfig.account.poolAddr)
    console.log("Pool Fee: ", selectedConfig.account.poolFee)

    const stakeAmount = new BN(5000000); // 5 tokens of mock USDC

    await program.methods
      .stakeToken(stakeAmount)
      .accounts({
        staker: wallet.publicKey,
        stakerTokenAccount: stakerUsdcAccount.address,
        poolTokenAccount: poolUsdcAccount.address,
        pool: poolAccount.publicKey,
        poolConfig: selectedConfig.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Fetch the updated pool account
    const pool = await program.account.pool.fetch(poolAccount.publicKey);

    // Verify the pool's total staked amount has increased
    assert.equal(
      pool.totalStaked.toString(),
      stakeAmount.toString(),
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
  });


});
