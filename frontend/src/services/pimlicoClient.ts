/**
 * Pimlico client for getting gas price estimations
 * Uses HTTP RPC calls directly without external permissionless library
 * Falls back to public RPC if Pimlico is unavailable
 */

import { CHAIN_PARAMS } from "@/config/networks";

const pimlicoKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "test";

interface GasPriceResponse {
  jsonrpc: string;
  id: number;
  result?: {
    slow: {
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
    standard: {
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
    fast: {
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
    };
  };
  error?: {
    code: number;
    message: string;
  };
}

interface GasPriceTier {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

interface GasPrices {
  slow: GasPriceTier;
  standard: GasPriceTier;
  fast: GasPriceTier;
}

/**
 * Fallback: Get gas prices from public RPC using eth_gasPrice
 */
async function getFallbackGasPrice(chainId: number): Promise<GasPrices> {
  console.log("⚠️ Using fallback gas price estimation from public RPC...");

  const chainParams = CHAIN_PARAMS[chainId];
  const rpcUrl = chainParams?.rpcUrls?.[0];

  if (!rpcUrl) {
    console.warn(`No RPC URL for chainId ${chainId}, using default gas prices`);
    // Return reasonable defaults for testnets
    const defaultGas = 2000000000n; // 2 gwei
    const defaultPriority = 1000000000n; // 1 gwei
    return {
      slow: { maxFeePerGas: defaultGas, maxPriorityFeePerGas: defaultPriority },
      standard: { maxFeePerGas: defaultGas * 2n, maxPriorityFeePerGas: defaultPriority * 2n },
      fast: { maxFeePerGas: defaultGas * 3n, maxPriorityFeePerGas: defaultPriority * 3n },
    };
  }

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
    });

    const data = await response.json();
    const gasPrice = data.result ? BigInt(data.result) : 2000000000n;

    // Create tiered gas prices based on eth_gasPrice
    // Priority fee is typically 1/10 of base fee
    const priorityFee = gasPrice / 10n;

    console.log(`✅ Fallback gas price: ${gasPrice.toString()} wei`);

    return {
      slow: {
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: priorityFee,
      },
      standard: {
        maxFeePerGas: (gasPrice * 12n) / 10n, // 1.2x
        maxPriorityFeePerGas: (priorityFee * 15n) / 10n, // 1.5x
      },
      fast: {
        maxFeePerGas: (gasPrice * 15n) / 10n, // 1.5x
        maxPriorityFeePerGas: priorityFee * 2n, // 2x
      },
    };
  } catch (error) {
    console.error("Fallback gas price fetch failed:", error);
    // Return reasonable defaults
    const defaultGas = 5000000000n; // 5 gwei
    const defaultPriority = 2000000000n; // 2 gwei
    return {
      slow: { maxFeePerGas: defaultGas, maxPriorityFeePerGas: defaultPriority },
      standard: { maxFeePerGas: defaultGas * 2n, maxPriorityFeePerGas: defaultPriority * 2n },
      fast: { maxFeePerGas: defaultGas * 3n, maxPriorityFeePerGas: defaultPriority * 3n },
    };
  }
}

export const pimlicoClient = (chainId: number) => {
  const rpcUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoKey}`;

  return {
    /**
     * Get user operation gas price estimation from Pimlico
     * Falls back to public RPC if Pimlico is unavailable
     */
    getUserOperationGasPrice: async (): Promise<GasPrices> => {
      try {
        console.log(`⛽ Fetching gas prices from Pimlico for chainId ${chainId}...`);

        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "pimlico_getUserOperationGasPrice",
            params: [],
            id: 1,
          }),
        });

        if (!response.ok) {
          console.warn(`Pimlico API returned status ${response.status}, using fallback`);
          return getFallbackGasPrice(chainId);
        }

        const data: GasPriceResponse = await response.json();

        // Check for API error response
        if (data.error) {
          console.warn(`Pimlico API error: ${data.error.message} (code: ${data.error.code})`);
          return getFallbackGasPrice(chainId);
        }

        if (data.result) {
          console.log("✅ Got gas prices from Pimlico");
          return {
            slow: {
              maxFeePerGas: BigInt(data.result.slow.maxFeePerGas),
              maxPriorityFeePerGas: BigInt(data.result.slow.maxPriorityFeePerGas),
            },
            standard: {
              maxFeePerGas: BigInt(data.result.standard.maxFeePerGas),
              maxPriorityFeePerGas: BigInt(data.result.standard.maxPriorityFeePerGas),
            },
            fast: {
              maxFeePerGas: BigInt(data.result.fast.maxFeePerGas),
              maxPriorityFeePerGas: BigInt(data.result.fast.maxPriorityFeePerGas),
            },
          };
        }

        // No result, use fallback
        console.warn("Pimlico returned empty result, using fallback");
        return getFallbackGasPrice(chainId);
      } catch (error) {
        console.error("Error getting gas prices from Pimlico:", error);
        // Use fallback instead of throwing
        return getFallbackGasPrice(chainId);
      }
    },
  };
};
