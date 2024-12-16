import { DCA, Network } from '@jup-ag/dca-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import type { TokenSummary, ChartDataPoint } from '../types/dca';
import { Position as BasePosition } from '../types/dca';

const LOGOS_MINT = 'HJUfqXoYjC653f2p33i84zdCC3jc4EuVnbruSe5kpump';
const CHAOS_MINT = '8SgNwESovnbG1oNEaPVhg6CR9mTMSK7jPvcYRe3wpump';

interface DCAAccountType {
  publicKey: PublicKey;
  account: {
    user: PublicKey;
    inputMint: PublicKey;
    outputMint: PublicKey;
    idx: BN;
    nextCycleAt: BN;
    inDeposited: BN;
    inWithdrawn: BN;
    outWithdrawn: BN;
    inUsed: BN;
    inAmountPerCycle: BN;
    cycleFrequency: BN;
    bump: number;
    minOutAmount?: BN;
    maxOutAmount?: BN;
  };
}

interface Position extends BasePosition {
  minPrice?: number;
  maxPrice?: number | "No limit";
  remainingAmount: number;
  estimatedTokens: number;
  remainingInCycle: number;
}

class JupiterDCAAPI {
  private dca!: DCA;
  private connection: Connection;
  private jupiterApiUrl = 'https://api.jup.ag/price/v2';

  constructor() {
    this.connection = new Connection(import.meta.env.VITE_HELIUS_RPC_URL);
    this.initDCA();
  }

  private async initDCA() {
    try {
      this.dca = new DCA(this.connection, Network.MAINNET);
    } catch (error) {
      console.error('Failed to initialize DCA:', error);
      // Try to reconnect using Helius
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.connection = new Connection(import.meta.env.VITE_HELIUS_RPC_URL);
      this.initDCA();
    }
  }

  private async withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        console.log(`Attempt ${i + 1} failed:`, error);
        lastError = error;
        // Wait longer between each retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw lastError;
  }

  private async getCurrentPrice(mint: string): Promise<{ price: number; mint: string }> {
    try {
      console.log(`Fetching price for ${mint} from ${this.jupiterApiUrl}`);
      const response = await fetch(
        `${this.jupiterApiUrl}?ids=${mint}`
      );
      const data = await response.json();
      
      const price = data.data?.[mint]?.price || 0;
      console.log(`Price fetched for ${mint}:`, {
        rawData: data,
        parsedPrice: price,
        finalPrice: Number(price)
      });
      return {
        price: Number(price),
        mint
      };
    } catch (error) {
      console.error('Error fetching price:', error);
      return { price: 0, mint };
    }
  }

  // Convert SDK account format to our Position type
  private async convertDCAAccount(account: DCAAccountType, price: number, token: string, type: "BUY" | "SELL"): Promise<Position> {
    // Add transaction history check
    const transactions = await this.getDCATransactions(account.publicKey.toString());
    console.log('DCA Transactions:', {
      accountKey: account.publicKey.toString(),
      transactions,
      raw: {
        inUsed: account.account.inUsed.toString(),        // 10319629629 (17 cycles worth)
        inAmountPerCycle: account.account.inAmountPerCycle.toString(),  // 607037037 per cycle
        inDeposited: account.account.inDeposited.toString()
      }
    });

    // Add precision debugging
    console.log('Precision Analysis:', {
      publicKey: account.publicKey.toString(),
      rawInUsed: account.account.inUsed.toNumber(),
      rawAmountPerCycle: account.account.inAmountPerCycle.toNumber(),
      rawCompletedCycles: account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber(),
      flooredCompletedCycles: Math.floor(account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber()),
      difference: (account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber()) - 
        Math.floor(account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber()),
      // Also show the BN values for comparison
      bnInUsed: account.account.inUsed.toString(),
      bnAmountPerCycle: account.account.inAmountPerCycle.toString()
    });

    // Only log when completed cycles is greater than total cycles
    if (account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber() > Math.ceil(account.account.inDeposited.toNumber() / account.account.inAmountPerCycle.toNumber())) {
      console.log('Precision Issue Detected:', {
        publicKey: account.publicKey.toString(),
        totalCycles: Math.ceil(account.account.inDeposited.toNumber() / account.account.inAmountPerCycle.toNumber()),
        rawCompletedCycles: account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber(),
        rawInUsed: account.account.inUsed.toNumber(),
        rawAmountPerCycle: account.account.inAmountPerCycle.toNumber(),
        // Raw BN values
        bnInUsed: account.account.inUsed.toString(),
        bnAmountPerCycle: account.account.inAmountPerCycle.toString(),
        // Calculated values
        inUsedDecimal: account.account.inUsed.toNumber() / Math.pow(10, 6),
        amountPerCycleDecimal: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)
      });
    }

    // Add comprehensive logging
    console.log('Detailed DCA Account Analysis:', {
      // Basic Info
      type,
      token,
      
      // Amounts
      inDeposited: account.account.inDeposited.toString(),
      inWithdrawn: account.account.inWithdrawn.toString(),
      inUsed: account.account.inUsed.toString(),
      outWithdrawn: account.account.outWithdrawn.toString(),
      inAmountPerCycle: account.account.inAmountPerCycle.toString(),
      
      // Calculated Values
      totalAmount: account.account.inDeposited.toNumber() / Math.pow(10, 6),
      remainingAmount: account.account.inDeposited.sub(account.account.inWithdrawn).toNumber() / Math.pow(10, 6),
      usedAmount: account.account.inUsed.toNumber() / Math.pow(10, 6),
      
      // Cycle Information
      totalCycles: Math.ceil(account.account.inDeposited.toNumber() / account.account.inAmountPerCycle.toNumber()),
      completedCycles: account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber(),
      cycleFrequency: account.account.cycleFrequency.toNumber(),
      nextCycleAt: new Date(account.account.nextCycleAt.toNumber() * 1000),
      
      // Completion Checks
      isFullyWithdrawn: account.account.inDeposited.eq(account.account.inWithdrawn),
      hasOutstandingBalance: account.account.inDeposited.gt(account.account.inWithdrawn),
      allCyclesExecuted: (account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber()) >= 
        Math.ceil(account.account.inDeposited.toNumber() / account.account.inAmountPerCycle.toNumber())
    });

    console.log('Converting account:', {
      inputMint: account.account.inputMint.toString(),
      outputMint: account.account.outputMint.toString()
    });

    // Calculate remaining cycles and completion status
    const totalCycles = Math.ceil(account.account.inDeposited.toNumber() / account.account.inAmountPerCycle.toNumber());
    const completedFullCycles = Math.floor(account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber());
    const currentCycleUsed = (account.account.inUsed.toNumber() % account.account.inAmountPerCycle.toNumber()) / account.account.inAmountPerCycle.toNumber();

    const remainingCycles = totalCycles - completedFullCycles - currentCycleUsed;

    console.log('Cycles calculation:', {
      totalCycles,
      rawCompletedCycles: account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber(),
      completedCycles: account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber(),
      inUsed: account.account.inUsed.toString(),
      inAmountPerCycle: account.account.inAmountPerCycle.toString(),
      raw: account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber()
    });

    // Calculate actual execution price from used amounts
    const executionPrice = account.account.inUsed.toNumber() > 0
      ? account.account.outWithdrawn.toNumber() / account.account.inUsed.toNumber()
      : price; // Use current price as fallback

    const remainingValue = remainingCycles * (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6));

    // Calculate max/min prices first
    const maxPrice = type === "BUY" 
      ? (account.account.maxOutAmount 
        ? (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)) / (account.account.maxOutAmount.toNumber() / Math.pow(10, 6))
        : "No limit")
      : undefined;

    const minPrice = type === "SELL"
      ? (account.account.minOutAmount 
        ? (account.account.minOutAmount.toNumber() / Math.pow(10, 6)) / (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6))
        : undefined)
      : undefined;

    // Calculate remaining in cycle using BN.js
    const usedInCurrentCycle = account.account.inUsed.mod(account.account.inAmountPerCycle);
    const remainingInCycle = (account.account.inAmountPerCycle.sub(usedInCurrentCycle)).toNumber() / Math.pow(10, 6);

    console.log('Raw cycle calculation:', {
      inUsed: account.account.inUsed.toString(),
      amountPerCycle: account.account.inAmountPerCycle.toString(),
      usedInCurrentCycle: usedInCurrentCycle.toString(),
      remainingInCycle,
      rawCalc: {
        modulo: usedInCurrentCycle.toString(),
        division: account.account.inUsed.div(account.account.inAmountPerCycle).toNumber()
      }
    });

    console.log('DCA Order Analysis:', {
      publicKey: account.publicKey.toString(),
      raw: {
        inUsed: account.account.inUsed.toString(),
        inAmountPerCycle: account.account.inAmountPerCycle.toString(),
        inDeposited: account.account.inDeposited.toString(),
        outWithdrawn: account.account.outWithdrawn.toString(),
      },
      calculated: {
        totalCycles: totalCycles,
        completedCycles: Math.floor(account.account.inUsed.toNumber() / account.account.inAmountPerCycle.toNumber()),
        currentCycleUsed: account.account.inUsed.toNumber() % account.account.inAmountPerCycle.toNumber(),
        amountPerCycle: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6),
        totalUsed: account.account.inUsed.toNumber() / Math.pow(10, 6),
        totalReceived: account.account.outWithdrawn.toNumber() / Math.pow(10, 6)
      }
    });

    const txHash = await this.getRecentTransactionForAccount(account.publicKey.toString());
    const response = await fetch(
      `${import.meta.env.VITE_HELIUS_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getTransaction',
        params: [
          txHash,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
        ],
      }),
    });
    const txDetails = await response.json();
    
    const amounts = this.parseTransactionAmounts(txDetails);
    
    console.log('=== CHAOS BUY ORDER DETAILS ===');
    console.log('Account:', account.publicKey.toString());
    console.log('Transaction Amounts:', amounts);
    console.log('Cycle Progress:', {
      cycleAmount: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6),
      currentCycleUsed: amounts?.usdcPaid || 0,
      remainingInCycle: (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)) - (amounts?.usdcPaid || 0)
    });
    console.log('=== END CHAOS BUY ORDER ===');

    // Add cycle progress to the position
    const cycleAmount = account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6);
    const cycleUsed = amounts?.usdcPaid || 0;
    
    return {
      id: account.publicKey.toString(),
      token,
      type,
      inputToken: type === "BUY" ? "USDC" : token,
      outputToken: type === "BUY" ? token : "USDC",
      inputAmount: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6),
      totalAmount: account.account.inDeposited.sub(account.account.inWithdrawn).toNumber() / Math.pow(10, 6),
      amountPerCycle: account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6),
      remainingCycles: account.account.cycleFrequency.toNumber(),
      cycleFrequency: account.account.cycleFrequency.toNumber(),
      lastUpdate: account.account.nextCycleAt.toNumber() * 1000,
      publicKey: account.publicKey.toString(),
      targetPrice: executionPrice,
      currentPrice: price,
      priceToken: "USDC",
      estimatedOutput: type === "SELL" ? 
        (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)) * executionPrice : undefined,
      totalCycles,
      completedCycles: completedFullCycles + currentCycleUsed,
      isActive: remainingCycles > 0 && !account.account.inUsed.eq(account.account.inDeposited),
      executionPrice: executionPrice / Math.pow(10, 6),
      maxPrice,
      minPrice,
      remainingAmount: remainingCycles * (account.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)),
      estimatedTokens: type === "BUY"
        ? typeof maxPrice === 'number'
          ? remainingValue / maxPrice
          : remainingValue / price
        : remainingValue * ((account.account.minOutAmount ? account.account.minOutAmount.toNumber() / Math.pow(10, 6) : price)),
      remainingInCycle,
      cycleProgress: {
        total: cycleAmount,
        used: cycleUsed,
        remaining: cycleAmount - cycleUsed,
        percentComplete: (cycleUsed / cycleAmount) * 100
      }
    };
  }

  async getDCAAccounts(): Promise<{
    positions: Position[],
    summary: Record<string, TokenSummary>,
    chartData: Record<string, ChartDataPoint[]>
  }> {
    try {
      if (!this.dca) {
        throw new Error('DCA SDK not initialized');
      }

      // Wrap the fetch in retry logic
      const allAccounts = await this.withRetry(async () => {
        const accounts = await this.dca.getAll();
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts returned');
        }
        return accounts;
      });

      // After getting allAccounts
      console.log('Account details:', allAccounts.map(acc => ({
        input: acc.account.inputMint.toString(),
        output: acc.account.outputMint.toString(),
        isLogosInput: acc.account.inputMint.equals(new PublicKey(LOGOS_MINT)),
        isLogosOutput: acc.account.outputMint.equals(new PublicKey(LOGOS_MINT))
      })));

      // 2. Initial categorization
      const accountsByToken = {
        LOGOS: {
          buys: allAccounts.filter(acc => acc.account.outputMint.equals(new PublicKey(LOGOS_MINT))),
          sells: allAccounts.filter(acc => acc.account.inputMint.equals(new PublicKey(LOGOS_MINT)))
        },
        CHAOS: {
          buys: allAccounts.filter(acc => acc.account.outputMint.equals(new PublicKey(CHAOS_MINT))),
          sells: allAccounts.filter(acc => acc.account.inputMint.equals(new PublicKey(CHAOS_MINT)))
        }
      };

      // After categorization
      console.log('LOGOS Accounts:', {
        buys: accountsByToken.LOGOS.buys.map(acc => ({
          input: acc.account.inputMint.toString(),
          output: acc.account.outputMint.toString()
        })),
        sells: accountsByToken.LOGOS.sells.map(acc => ({
          input: acc.account.inputMint.toString(),
          output: acc.account.outputMint.toString()
        }))
      });

      console.log('Accounts by token:', {
        LOGOS: {
          buys: accountsByToken.LOGOS.buys.length,
          sells: accountsByToken.LOGOS.sells.length
        },
        CHAOS: {
          buys: accountsByToken.CHAOS.buys.length,
          sells: accountsByToken.CHAOS.sells.length
        }
      });

      // Add debug logging for BUY orders
      console.log('LOGOS BUY orders:', accountsByToken.LOGOS.buys.map(acc => ({
        inputMint: acc.account.inputMint.toString(),
        outputMint: acc.account.outputMint.toString(),
        inDeposited: acc.account.inDeposited.toString(),
        inWithdrawn: acc.account.inWithdrawn.toString(),
        inUsed: acc.account.inUsed.toString(),
        inAmountPerCycle: acc.account.inAmountPerCycle.toString(),
        outWithdrawn: acc.account.outWithdrawn.toString(),
      })));

      // Add debug logging for SELL orders
      console.log('LOGOS SELL orders:', accountsByToken.LOGOS.sells.map(acc => ({
        inputMint: acc.account.inputMint.toString(),
        outputMint: acc.account.outputMint.toString(),
        inDeposited: acc.account.inDeposited.toString(),
        inWithdrawn: acc.account.inWithdrawn.toString(),
        inUsed: acc.account.inUsed.toString(),
        inAmountPerCycle: acc.account.inAmountPerCycle.toString(),
        outWithdrawn: acc.account.outWithdrawn.toString(),
      })));

      // Get prices before calculating summary
      const [logosPrice, chaosPrice] = await Promise.all([
        this.getCurrentPrice(LOGOS_MINT),
        this.getCurrentPrice(CHAOS_MINT)
      ]);

      // Calculate summary with prices (using original accountsByToken)
      const summary = this.calculateSummaryFromRawAccounts(accountsByToken, {
        LOGOS: logosPrice.price,
        CHAOS: chaosPrice.price
      });

      // Process individual positions (using original accountsByToken)
      const positions = await Promise.all([
        ...accountsByToken.LOGOS.buys
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, logosPrice.price, "LOGOS", "BUY")),
        ...accountsByToken.LOGOS.sells
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, logosPrice.price, "LOGOS", "SELL")),
        ...accountsByToken.CHAOS.buys
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, chaosPrice.price, "CHAOS", "BUY")),
        ...accountsByToken.CHAOS.sells
          .filter(acc => this.isOrderActive(acc))
          .map(acc => this.convertDCAAccount(acc, chaosPrice.price, "CHAOS", "SELL"))
      ]);

      // 5. Update prices and positions
      const positionsWithPrices = positions.map(pos => ({
        ...pos,
        currentPrice: pos.token === 'LOGOS' ? logosPrice.price : chaosPrice.price
      }));

      // Add the return statement
      const chartData = {
        LOGOS: [{
          timestamp: Date.now(),
          buyVolume: summary.LOGOS.buyVolume,
          sellVolume: summary.LOGOS.sellVolume,
          buyOrders: summary.LOGOS.buyOrders,
          sellOrders: summary.LOGOS.sellOrders
        }],
        CHAOS: [{
          timestamp: Date.now(),
          buyVolume: summary.CHAOS.buyVolume,
          sellVolume: summary.CHAOS.sellVolume,
          buyOrders: summary.CHAOS.buyOrders,
          sellOrders: summary.CHAOS.sellOrders
        }]
      };

      return { 
        positions: positionsWithPrices, 
        summary, 
        chartData 
      };
    } catch (error) {
      console.error('Error fetching DCA accounts:', error);
      throw error;
    }
  }

  private calculateSummaryFromRawAccounts(
    accountsByToken: {
      LOGOS: { buys: DCAAccountType[], sells: DCAAccountType[] },
      CHAOS: { buys: DCAAccountType[], sells: DCAAccountType[] }
    },
    prices: { LOGOS: number, CHAOS: number }
  ): Record<string, TokenSummary> {
    console.log('Calculating summary with prices:', {
      LOGOS: prices.LOGOS,
      CHAOS: prices.CHAOS
    });
    
    const logosSellVolumeUSDC = Math.round(accountsByToken.LOGOS.sells.reduce((sum, acc) => {
      const volume = acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6);
      const usdcValue = volume * prices.LOGOS;
      console.log('LOGOS sell position calculation:', {
        rawDeposited: acc.account.inDeposited.toString(),
        rawWithdrawn: acc.account.inWithdrawn.toString(),
        volume,
        price: prices.LOGOS,
        usdcValue,
        runningTotal: sum + usdcValue
      });
      return sum + usdcValue;
    }, 0));

    console.log('Final summary calculation:', {
      logosSellVolumeUSDC,
      logosPrice: prices.LOGOS,
      totalSellVolume: accountsByToken.LOGOS.sells.reduce((sum, acc) => 
        sum + acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6), 0)
    });

    const summary: Record<string, TokenSummary> = {
      LOGOS: {
        buyOrders: accountsByToken.LOGOS.buys.filter(acc => this.isOrderActive(acc)).length,
        sellOrders: accountsByToken.LOGOS.sells.filter(acc => this.isOrderActive(acc)).length,
        buyVolume: Math.round(accountsByToken.LOGOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            const remainingUSDC = remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6));
            return sum + (remainingUSDC / prices.LOGOS);
          }, 0)),
        sellVolume: accountsByToken.LOGOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6), 0),
        buyVolumeUSDC: Math.round(accountsByToken.LOGOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            return sum + (remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)));
          }, 0)),
        sellVolumeUSDC: Math.round(accountsByToken.LOGOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + (acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6)) * prices.LOGOS, 0)),
        price: prices.LOGOS
      },
      CHAOS: {
        buyOrders: accountsByToken.CHAOS.buys.filter(acc => this.isOrderActive(acc)).length,
        sellOrders: accountsByToken.CHAOS.sells.filter(acc => this.isOrderActive(acc)).length,
        buyVolume: Math.round(accountsByToken.CHAOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            const remainingUSDC = remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6));
            return sum + (remainingUSDC / prices.CHAOS);
          }, 0)),
        sellVolume: accountsByToken.CHAOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6), 0),
        buyVolumeUSDC: Math.round(accountsByToken.CHAOS.buys
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => {
            const totalCycles = Math.ceil(acc.account.inDeposited.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const completedCycles = Math.floor(acc.account.inUsed.toNumber() / acc.account.inAmountPerCycle.toNumber());
            const remainingCycles = totalCycles - completedCycles;
            return sum + (remainingCycles * (acc.account.inAmountPerCycle.toNumber() / Math.pow(10, 6)));
          }, 0)),
        sellVolumeUSDC: Math.round(accountsByToken.CHAOS.sells
          .filter(acc => this.isOrderActive(acc))
          .reduce((sum, acc) => sum + (acc.account.inDeposited.sub(acc.account.inWithdrawn).toNumber() / Math.pow(10, 6)) * prices.CHAOS, 0)),
        price: prices.CHAOS
      }
    };

    return summary;
  }

  private isOrderActive(account: DCAAccountType): boolean {
    return !account.account.inUsed.eq(account.account.inDeposited);
  }

  private async getDCATransactions(dcaAccountKey: string) {
    const response = await fetch(
      `${import.meta.env.VITE_HELIUS_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getSignaturesForAddress',
        params: [
          dcaAccountKey,  // The DCA order account
          { limit: 20 }   // Just get recent transactions
        ],
      }),
    });
    return await response.json();
  }

  public async getDCATransactionDetails(dcaAccountKey: string) {
    // First get recent signatures
    const sigResponse = await fetch(
      `${import.meta.env.VITE_HELIUS_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getSignaturesForAddress',
        params: [
          dcaAccountKey,
          { limit: 5 }  // Just get last few transactions
        ],
      }),
    });
    const sigData = await sigResponse.json();

    // Then get details for each transaction
    const txPromises = sigData.result.map(async (sig: any) => {
      const txResponse = await fetch(
        `${import.meta.env.VITE_HELIUS_RPC_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getTransaction',
          params: [
            sig.signature,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
          ],
        }),
      });
      return await txResponse.json();
    });

    const txDetails = await Promise.all(txPromises);
    return txDetails;
  }

  private parseTransactionAmounts(tx: any) {
    try {
      // Look for token transfers in innerInstructions
      const transfers = tx.result.meta.innerInstructions
        .flatMap((inner: any) => inner.instructions)
        .filter((inst: any) => inst.parsed?.type === 'transfer');

      // Find CHAOS received (largest transfer)
      const chaosAmount = Math.max(...transfers
        .map((t: any) => Number(t.parsed.info.amount)));

      // Find USDC paid (usually last transfer)
      const usdcAmount = transfers
        .find((t: any) => t.parsed.info.destination === '6zAcFYmxkaH25qWZW5ek4dk4SyQNpSza3ydSoUxjTudD')
        ?.parsed.info.amount;

      return {
        chaosReceived: chaosAmount / Math.pow(10, 9),  // CHAOS decimals
        usdcPaid: Number(usdcAmount) / Math.pow(10, 6) // USDC decimals
      };
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return null;
    }
  }

  private async getRecentTransactionForAccount(accountKey: string): Promise<string> {
    // Get recent signatures
    const sigResponse = await fetch(
      `${import.meta.env.VITE_HELIUS_RPC_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getSignaturesForAddress',
        params: [
          accountKey,
          { limit: 1 }  // Just get most recent transaction
        ],
      }),
    });
    const sigData = await sigResponse.json();

    // Return the most recent transaction signature
    return sigData.result?.[0]?.signature || '';
  }

  // ... rest of the code
}

export const jupiterDCA = new JupiterDCAAPI(); 