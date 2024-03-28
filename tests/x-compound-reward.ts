// import { PublicKey } from '@solana/web3.js';
// import {
//   web3,
//   workspace,
//   AnchorProvider,
//   getProvider,
//   setProvider,
//   Wallet,
//   BN,
//   Program,
// } from "@coral-xyz/anchor";
// import {
//   Account,
//   getAccount,
//   getOrCreateAssociatedTokenAccount,
//   createMint,
//   mintTo,
//   TOKEN_PROGRAM_ID,
// } from "@solana/spl-token";
// import { createWithSeedSync } from "@coral-xyz/anchor/dist/cjs/utils/pubkey";
// import { assert } from "chai";
// import { StakingOnSolana } from "../target/types/staking_on_solana";
// import { createRandomMint, createRandomWalletAndAirdrop, getRandomNumber, waitSeconds, getAssociatedPoolKeys, getMarket } from "./utils";

// // Configure the client to use the local cluster.
// const provider = AnchorProvider.env();
// setProvider(provider);

// // @ts-ignore
// let admin = getProvider().wallet;

// const program = workspace.StakingOnSolana as Program<StakingOnSolana>;

// const marketInfo = {
//   serumDexProgram: new web3.PublicKey("DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY"),
//   ammProgram: new web3.PublicKey("9rpQHSyFVM1dkkHFQ2TtTzPEW7DVmEyPmN8wVniqJtuC"),
//   serumMarket: new web3.Keypair(),
// }

// describe("compound-reward", () => {
//   let treasury;
//   let deployer1;
//   let deployer2;
//   let user1;
//   let user2;
//   const deploy_fee = new BN(0.8 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports
//   const performance_fee = new BN(0.05 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports
//   const serumMarketId = marketInfo.serumMarket.publicKey.toString()

//   before(async () => {
//     /*
//         const market = await getMarket(provider.connection, serumMarketId, marketInfo.serumDexProgram.toString())
    
//         const poolKeys = await getAssociatedPoolKeys({
//           programId: marketInfo.ammProgram,
//           serumProgramId: marketInfo.serumDexProgram,
//           marketId: market.address,
//           baseMint: market.baseMint,
//           quoteMint: market.quoteMint
//         })
    
//     */

//     it("compound rewards", async () => {
//       const raydiumSwapParams = {
//         id: new PublicKey('rtbamRPBDBmuxYgKe2wthSAU1fL5zRWyHwFaoM7wLD4'),
//         baseMint: new PublicKey('24WVen8yYhYw5oF3ywJRzfVkKhfdp4KaCAeQaQz4gT5m'),
//         quoteMint: new PublicKey('So11111111111111111111111111111111111111112'),
//         lpMint: new PublicKey('AKLwVGVRC7M98mtRUdRXuY9LWWM9yfmcQfwcxqjRYhDT'),
//         baseDecimals: 9,
//         quoteDecimals: 9,
//         lpDecimals: 9,
//         version: 4,
//         programId: new PublicKey('HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8'),
//         authority: new PublicKey('DbQqP6ehDYmeYjcBaMRuA8tAJY1EjDUz9DpwSLjaQqfC'),
//         openOrders: new PublicKey('7KGNb6TaAabjQyJvdjgwmZVDo3oWZg1y3EXaZYv4ivqM'),
//         targetOrders: new PublicKey('4y3GVwePxnAVenHsDCFvVpEUpxafcpCQQ3SFP72wSFS8'),
//         baseVault: new PublicKey('2T3HwxBKcSic46Ngg33oRhg8wZm8CwNVY2VS25AyZ9at'),
//         quoteVault: new PublicKey('7XBYrvwkckuRiv9v9a1XAecn7fJNd3dp32yRjaZZdka4'),
//         withdrawQueue: new PublicKey('11111111111111111111111111111111'),
//         lpVault: new PublicKey('11111111111111111111111111111111'),
//         marketVersion: 3,
//         marketProgramId: new PublicKey('EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj'),
//         marketId: new PublicKey('DkKp42dX39RD99rTQmigyEVi9MF4m6aBhd6t1inueW8T'),
//         marketAuthority: new PublicKey('FG4Y8ibr2hXtiPT7GieNQ9MSw4Y24LsBzXaBryHkjhm'),
//         marketBaseVault: new PublicKey('dqPtSd2nP4jYVdhtp5J1ToTD7UrKoXs9FA6Dkg72NfG'),
//         marketQuoteVault: new PublicKey('DhLSHFsfbPdRbeSSJCWrv5wkKMLN9BpybyRkrci6NMg5'),
//         marketBids: new PublicKey('CjhdwQjfSpByVnGqQyMC4xgaVTaBuWLHZKmeHD98Q2U6'),
//         marketAsks: new PublicKey('8uQsnhNX8WaL6axL2ukw2ppUy87UapbcPm6YjYvCHTFC'),
//         marketEventQueue: new PublicKey('FC8t344oqdADyYfLaVYhDf7QdqsbzYPBrtWeLVxWMZep'),
//         lookupTableAccount: new PublicKey('11111111111111111111111111111111')
//       };

//       // Get pool config list and select one
//       const pools = await program.account.poolConfig.all();
//       const selected_pool = pools[0]

//       console.log("Compound Pool Config PDA: ", selected_pool.publicKey);


//           await program.methods
//             .compoundReward()
//             .accounts({
//               staker: user.publicKey,
//               admin: admin.publicKey,
//               platform: platform_info_pda,
//               userInfo: userInfoPDA,
//               userStakeTokenVault: userStakeTokenVault.address,
//               userRewardTokenVault: userRewardTokenVault.address,
//               poolStakeTokenVault: pool_config.account.poolStakeTokenVault,
//               poolRewardTokenVault: pool_config.account.poolRewardTokenVault,
//               treasuryStakeTokenVault: treasuryStakeTokenVault.address,
//               poolConfigAccount: pool_config.publicKey,
//               poolStateAccount: pool_config.account.stateAddr,
//               tokenProgram: TOKEN_PROGRAM_ID,
//               // raydium swap
//               ammProgram: marketInfo.ammProgram,
//               amm: poolKeys.id,
//               ammAuthority: poolKeys.authority,
//               ammOpenOrders: poolKeys.openOrders,
//               ammTargetOrders: poolKeys.targetOrders,
//               poolCoinTokenAccount: poolKeys.baseVault,
//               poolPcTokenAccount: poolKeys.quoteVault,
//               serumProgram: marketInfo.serumDexProgram,
//               serumMarket: serumMarketId,
//               serumBids: market.bids,
//               serumAsks: market.asks,
//               serumEventQueue: market.eventQueue,
//               serumCoinVaultAccount: market.baseVault,
//               serumPcVaultAccount: market.quoteVault,
//               serumVaultSigner: vaultOwner,
//               userSourceTokenAccount: userCoinTokenAccount,
//               userDestinationTokenAccount: userPcTokenAccount,
//               userSourceOwner: provider.wallet.publicKey,
//               splTokenProgram: TOKEN_PROGRAM_ID,
//             })
//             .signers([user])
//             .rpc();
//       */
//     });
//   });

// });
