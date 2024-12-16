import { PublicKey } from '@solana/web3.js';

export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

export interface DCAOrder {
  id: string;
  owner: PublicKey;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: number;
  frequency: 'hourly' | 'daily' | 'weekly';
  nextExecutionTime: Date;
  totalExecutions: number;
  remainingExecutions: number;
  status: 'active' | 'completed' | 'cancelled';
  averagePrice?: number;
}

export interface DCASummary {
  totalOrders: number;
  activeOrders: number;
  totalVolume: number;
  averageOrderSize: number;
}

export interface ChartDataPoint {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
}

export interface TokenSummary {
  buyOrders: number;
  sellOrders: number;
  buyVolume: number;
  sellVolume: number;
  buyVolumeUSDC: number;
  sellVolumeUSDC: number;
  price: number;
}

export type Position = {
  id: string;
  token: string;
  type: "BUY" | "SELL";
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  totalAmount: number;
  amountPerCycle: number;
  remainingCycles: number;
  cycleFrequency: number;
  lastUpdate: number;
  publicKey: string;
  targetPrice: number;
  currentPrice: number;
  priceToken: string;
  estimatedOutput?: number;
  totalCycles: number;
  completedCycles: number;
  isActive: boolean;
  executionPrice: number;
  // Price limits
  maxPrice?: number | "No limit";  // Allow either a number or "No limit"
  minPrice?: number;
  remainingAmount: number;
  estimatedTokens: number;
  remainingInCycle: number;  // Amount remaining in current cycle
  cycleProgress?: {
    total: number;
    used: number;
    remaining: number;
    percentComplete: number;
  };
}; 