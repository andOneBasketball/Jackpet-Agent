/**
 * Pimlico client for getting gas price estimations
 * Uses HTTP RPC calls directly without external permissionless library
 */

const pimlicoKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "test";

interface GasPriceResponse {
  jsonrpc: string;
  id: number;
  result: {
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
}

export const pimlicoClient = (chainId: number) => {
  const rpcUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoKey}`;

  return {
    /**
     * Get user operation gas price estimation from Pimlico
     */
    getUserOperationGasPrice: async () => {
      try {
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

        const data: GasPriceResponse = await response.json();

        if (data.result) {
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

        throw new Error("Failed to get gas prices from Pimlico");
      } catch (error) {
        console.error("Error getting gas prices:", error);
        throw error;
      }
    },
  };
};
