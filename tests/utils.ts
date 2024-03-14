import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  Token,
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

export async function mintToAccount(
  provider,
  mint,
  destination,
  amount
) {
  const tx = new anchor.web3.Transaction();
  tx.add(
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      destination,
      provider.wallet.publicKey,
      [],
      amount
    )
  );
  await provider.sendAndConfirm(tx);
}

export async function sendLamports(
  provider,
  destination,
  amount
) {
  const tx = new anchor.web3.Transaction();
  tx.add(
    anchor.web3.SystemProgram.transfer(
      {
        fromPubkey: provider.wallet.publicKey,
        lamports: amount,
        toPubkey: destination
      }
    )
  );
  await provider.sendAndConfirm(tx);
}

// export async function createMint(
//   mintAccount,
//   provider,
//   mintAuthority,
//   freezeAuthority,
//   decimals,
//   programId,
// ) {
//   const token = new Token(
//     provider.connection,
//     mintAccount.publicKey,
//     programId,
//     provider.wallet.payer,
//   );

//   // Allocate memory for the account
//   const balanceNeeded = await Token.getMinBalanceRentForExemptMint(
//     provider.connection,
//   );

//   const transaction = new anchor.web3.Transaction();
//   transaction.add(
//     anchor.web3.SystemProgram.createAccount({
//       fromPubkey: provider.wallet.payer.publicKey,
//       newAccountPubkey: mintAccount.publicKey,
//       lamports: balanceNeeded,
//       space: MintLayout.span,
//       programId,
//     }),
//   );

//   transaction.add(
//     Token.createInitMintInstruction(
//       programId,
//       mintAccount.publicKey,
//       decimals,
//       mintAuthority,
//       freezeAuthority,
//     ),
//   );

//   await provider.sendAndConfirm(transaction, [mintAccount]);
//   return token;
// }
