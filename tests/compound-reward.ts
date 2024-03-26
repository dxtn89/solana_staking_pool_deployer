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
import { createRandomMint, createRandomWalletAndAirdrop, getRandomNumber, waitSeconds, getAssociatedPoolKeys, getMarket } from "./utils";

// Configure the client to use the local cluster.
const provider = AnchorProvider.env();
setProvider(provider);

// @ts-ignore
let admin = getProvider().wallet;

const program = workspace.StakingOnSolana as Program<StakingOnSolana>;

const marketInfo = {
  serumDexProgram: new web3.PublicKey("DESVgJVGajEgKGXhb6XmqDHGz3VjdgP7rEVESBgxmroY"),
  ammProgram: new web3.PublicKey("9rpQHSyFVM1dkkHFQ2TtTzPEW7DVmEyPmN8wVniqJtuC"),
  serumMarket: new web3.Keypair(),
}

describe("compound-reward", () => {
  let treasury;
  let deployer1;
  let deployer2;
  let user1;
  let user2;
  const deploy_fee = new BN(0.8 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports
  const performance_fee = new BN(0.05 * web3.LAMPORTS_PER_SOL); // Fixed SOL in lamports
  const serumMarketId = marketInfo.serumMarket.publicKey.toString()

  before(async () => {
    /*
        const market = await getMarket(provider.connection, serumMarketId, marketInfo.serumDexProgram.toString())
    
        const poolKeys = await getAssociatedPoolKeys({
          programId: marketInfo.ammProgram,
          serumProgramId: marketInfo.serumDexProgram,
          marketId: market.address,
          baseMint: market.baseMint,
          quoteMint: market.quoteMint
        })
    
    */

    it("compound rewards", async () => {
      /*
          await program.methods
            .compoundReward()
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
              ammProgram: marketInfo.ammProgram,
              amm: poolKeys.id,
              ammAuthority: poolKeys.authority,
              ammOpenOrders: poolKeys.openOrders,
              ammTargetOrders: poolKeys.targetOrders,
              poolCoinTokenAccount: poolKeys.baseVault,
              poolPcTokenAccount: poolKeys.quoteVault,
              serumProgram: marketInfo.serumDexProgram,
              serumMarket: serumMarketId,
              serumBids: market.bids,
              serumAsks: market.asks,
              serumEventQueue: market.eventQueue,
              serumCoinVaultAccount: market.baseVault,
              serumPcVaultAccount: market.quoteVault,
              serumVaultSigner: vaultOwner,
              userSourceTokenAccount: userCoinTokenAccount,
              userDestinationTokenAccount: userPcTokenAccount,
              userSourceOwner: provider.wallet.publicKey,
              splTokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([user])
            .rpc();
      */
    });
  });

});
