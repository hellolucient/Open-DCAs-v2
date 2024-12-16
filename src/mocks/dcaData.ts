import type { Position } from '../types/dca';

// Chart data with timestamps
export const mockChartData = {
  LOGOS: Array.from({ length: 24 }, (_, i) => ({
    timestamp: Date.now() - (23 - i) * 3600000, // Last 24 hours
    buyVolume: 1000 + Math.random() * 500,
    sellVolume: Math.random() * 200
  })),
  CHAOS: Array.from({ length: 24 }, (_, i) => ({
    timestamp: Date.now() - (23 - i) * 3600000,
    buyVolume: 5000 + Math.random() * 2000,
    sellVolume: Math.random() * 1000
  }))
};

// Summary data
export const mockSummaryData = {
  LOGOS: {
    buyOrders: 3,
    sellOrders: 0,
    buyVolume: 4961,
    sellVolume: 0,
    buyVolumeUSDC: 4961 * 0.98, // Assuming USDC price
    sellVolumeUSDC: 0
  },
  CHAOS: {
    buyOrders: 8,
    sellOrders: 2,
    buyVolume: 76868,
    sellVolume: 1200,
    buyVolumeUSDC: 76868 * 1.23, // Assuming USDC price
    sellVolumeUSDC: 1200 * 1.23
  }
};

// Position data
export const mockPositions: Position[] = [
  {
    id: "logos1",
    token: "LOGOS",
    type: "BUY" as const,
    inputToken: "USDC",
    outputToken: "LOGOS",
    inputAmount: 10,
    totalAmount: 300,
    amountPerCycle: 10,
    remainingCycles: 25,
    cycleFrequency: 86400,
    lastUpdate: Date.now(),
    publicKey: "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH",
    priceToken: "USDC",
    targetPrice: 0.019,
    currentPrice: 0.018,
    estimatedOutput: 526.32
  },
  {
    id: "chaos1",
    token: "CHAOS",
    type: "BUY" as const,
    inputToken: "USDC",
    outputToken: "CHAOS",
    inputAmount: 50,
    totalAmount: 600,
    amountPerCycle: 50,
    remainingCycles: 8,
    cycleFrequency: 604800,
    lastUpdate: Date.now(),
    publicKey: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    priceToken: "USDC",
    targetPrice: 0.021,
    currentPrice: 0.0185,
    estimatedOutput: 2380.95
  }
]; 