import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  MintLayout,
  createMint
} from "@solana/spl-token";

// Create a Random Wallet and airrop SOL
export async function createRandomWalletAndAirdrop(provider, airdropAmount) {
  const wallet = anchor.web3.Keypair.generate();

  const signature = await provider.connection.requestAirdrop(
    wallet.publicKey,
    airdropAmount * anchor.web3.LAMPORTS_PER_SOL
  );
  // Fetch the latest blockhash
  const { blockhash, lastValidBlockHeight } = await provider.connection.getLatestBlockhash();

  await provider.connection.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature
  }, 'finalized');

  //  const creator_balance = await provider.connection.getBalance(creator.publicKey)

  return wallet;
}

export async function createRandomMint(provider, decimals) {
  const mint = await createMint(
    provider.connection,
    provider.wallet.payer,
    provider.wallet.publicKey,
    null,
    decimals,
    undefined,
    undefined,
    TOKEN_PROGRAM_ID
  );

  return mint;
}

export async function getRandomNumber(min: number, max: number) {
  // Ensure min and max are valid numbers
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('Invalid input. Both min and max must be numbers.');
  }

  // Ensure min is less than max
  if (min >= max) {
    throw new Error('Invalid input. min must be less than max.');
  }

  // Generate a random number between min (inclusive) and max (exclusive)
  return Math.floor(Math.random() * (max - min)) + min;
}

export async function waitSeconds(seconds: number): Promise<void> {
  // Create a promise that resolves after the specified number of milliseconds
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}
