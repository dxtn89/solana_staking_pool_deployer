import { web3 } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  MintLayout,
  createMint,
} from "@solana/spl-token";
import { DexInstructions, Market as MarketSerum, TokenInstructions, } from '@project-serum/serum';
import { Liquidity, Market as raydiumSerum, Spl, SPL_MINT_LAYOUT } from "@raydium-io/raydium-sdk";
import { LiquidityAssociatedPoolKeys } from "@raydium-io/raydium-sdk/src/liquidity"

// Create a Random Wallet and airrop SOL
export async function createRandomWalletAndAirdrop(provider, airdropAmount) {
  const wallet = web3.Keypair.generate();

  const signature = await provider.connection.requestAirdrop(
    wallet.publicKey,
    airdropAmount * web3.LAMPORTS_PER_SOL
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

export async function getAssociatedPoolKeys({
  programId,
  serumProgramId,
  marketId,
  baseMint,
  quoteMint,
}: {
  programId: web3.PublicKey;
  serumProgramId: web3.PublicKey;
  marketId: web3.PublicKey;
  baseMint: web3.PublicKey;
  quoteMint: web3.PublicKey;
}): Promise<LiquidityAssociatedPoolKeys> {

  const id = await Liquidity.getAssociatedId({ programId, marketId });
  const lpMint = await Liquidity.getAssociatedLpMint({ programId, marketId });
  const { publicKey: authority, nonce } = await Liquidity.getAssociatedAuthority({ programId });
  const baseVault = await Liquidity.getAssociatedBaseVault({ programId, marketId });
  const quoteVault = await Liquidity.getAssociatedQuoteVault({ programId, marketId });
  const lpVault = await Liquidity.getAssociatedLpVault({ programId, marketId });
  const openOrders = await Liquidity.getAssociatedOpenOrders({ programId, marketId });
  const targetOrders = await Liquidity.getAssociatedTargetOrders({ programId, marketId });
  const withdrawQueue = await Liquidity.getAssociatedWithdrawQueue({ programId, marketId });

  const { publicKey: marketAuthority } = await raydiumSerum.getAssociatedAuthority({
    programId: serumProgramId,
    marketId,
  });

  return {
    // base
    id,
    baseMint,
    quoteMint,
    lpMint,
    // version
    version: 4,
    programId,
    // keys
    authority,
    nonce,
    baseVault,
    quoteVault,
    lpVault,
    openOrders,
    targetOrders,
    withdrawQueue,
    // market version
    marketVersion: 4,
    marketProgramId: serumProgramId,
    // market keys
    marketId,
    marketAuthority,
  };
}

export async function getMarket(conn: any, marketAddress: string, serumProgramId: string): Promise<Market> {
  try {
    const marketAddressPubKey = new web3.PublicKey(marketAddress)
    const market = await Market.load(conn, marketAddressPubKey, undefined, new web3.PublicKey(serumProgramId))
    return market
  } catch (error: any) {
    console.log("get market err: ", error)
    throw error;
  }
}

export class Market extends MarketSerum {
  public baseVault: web3.PublicKey | null = null
  public quoteVault: web3.PublicKey | null = null
  public requestQueue: web3.PublicKey | null = null
  public eventQueue: web3.PublicKey | null = null
  public bids: web3.PublicKey | null = null
  public asks: web3.PublicKey | null = null
  public baseLotSize: number = 0
  public quoteLotSize: number = 0
  // private _decoded: any
  public quoteMint: web3.PublicKey | null = null
  public baseMint: web3.PublicKey | null = null
  public vaultSignerNonce: Number | null = null

  static async load(connection: web3.Connection, address: web3.PublicKey, options: any = {}, programId: web3.PublicKey) {
    const { owner, data } = throwIfNull(await connection.getAccountInfo(address), 'Market not found')
    if (!owner.equals(programId)) {
      throw new Error('Address not owned by program: ' + owner.toBase58())
    }
    const decoded = this.getLayout(programId).decode(data)
    if (!decoded.accountFlags.initialized || !decoded.accountFlags.market || !decoded.ownAddress.equals(address)) {
      throw new Error('Invalid market')
    }
    const [baseMintDecimals, quoteMintDecimals] = await Promise.all([
      getMintDecimals(connection, decoded.baseMint),
      getMintDecimals(connection, decoded.quoteMint)
    ])

    const market = new Market(decoded, baseMintDecimals, quoteMintDecimals, options, programId)
    // market._decoded = decoded
    market.baseLotSize = decoded.baseLotSize
    market.quoteLotSize = decoded.quoteLotSize
    market.baseVault = decoded.baseVault
    market.quoteVault = decoded.quoteVault
    market.requestQueue = decoded.requestQueue
    market.eventQueue = decoded.eventQueue
    market.bids = decoded.bids
    market.asks = decoded.asks
    market.quoteMint = decoded.quoteMint
    market.baseMint = decoded.baseMint
    market.vaultSignerNonce = decoded.vaultSignerNonce
    return market
  }
}

export async function getMintDecimals(connection: web3.Connection, mint: web3.PublicKey): Promise<number> {
  const { data } = throwIfNull(await connection.getAccountInfo(mint), 'mint not found')
  const { decimals } = SPL_MINT_LAYOUT.decode(data)
  return decimals
}

function throwIfNull<T>(value: T | null, message = 'account not found'): T {
  if (value === null) {
    throw new Error(message)
  }
  return value
}