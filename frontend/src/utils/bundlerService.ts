import { encodeFunctionData } from "viem";
import { getContractAddress, CONTRACT_ABI } from "@/config/contract";

export interface UserOpRequest {
  to: string;
  data: string;
  value: string;
}

export interface SubmitUserOpsOptions {
  sessionContext: string;
  delegationManager: string;
  userAddress: string;
  chainId: number;
  gasPrice?: {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
}

export interface BundlerSubmitResult {
  success: boolean;
  userOpHash?: string;
  error?: string;
}

export interface BatchSubmissionConfig {
  totalOps: number;
  intervalMs: number;
  opsPerBatch?: number; // Operations per batch submission (default 1)
  timeout?: number; // Overall timeout in ms
}

class BundlerService {
  private bundlerUrl: string;
  private isInitialized = false;

  constructor() {
    this.bundlerUrl = process.env.NEXT_PUBLIC_BUNDLER_URL || "";
  }

  /**
   * Initialize bundler service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (!this.bundlerUrl) {
      throw new Error("NEXT_PUBLIC_BUNDLER_URL not configured");
    }

    try {
      // Test connection by getting gas prices
      await this.getGasPrices();
      this.isInitialized = true;
      console.log("✅ Bundler service initialized");
    } catch (err) {
      console.error("Failed to initialize bundler service:", err);
      throw err;
    }
  }

  /**
   * Get gas prices from Pimlico
   */
  async getGasPrices(): Promise<{ maxFeePerGas: string; maxPriorityFeePerGas: string }> {
    if (!this.bundlerUrl) {
      throw new Error("Bundler URL not configured");
    }

    try {
      const response = await fetch(this.bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pimlico_getUserOperationGasPrice",
          params: [],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return {
        maxFeePerGas: data.result.fast.maxFeePerGas,
        maxPriorityFeePerGas: data.result.fast.maxPriorityFeePerGas,
      };
    } catch (err) {
      console.error("Failed to get gas prices:", err);
      throw err;
    }
  }

  /**
   * Submit a single user operation to bundler via RPC
   */
  async submitUserOp(
    userOpRequest: UserOpRequest,
    options: SubmitUserOpsOptions
  ): Promise<BundlerSubmitResult> {
    try {
      if (!this.bundlerUrl) {
        throw new Error("Bundler not initialized");
      }

      // Get gas prices if not provided
      const gasPrice = options.gasPrice || (await this.getGasPrices());

      // Prepare UserOp for submission
      // Note: This is a simplified submission - actual structure depends on your bundler
      const userOp = {
        sender: options.userAddress,
        nonce: "0x0",
        initCode: "0x",
        callData: userOpRequest.data,
        callGasLimit: "0x5208", // 21000 gas minimum
        verificationGasLimit: "0x0",
        preVerificationGas: "0x0",
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "0x",
      };

      // Submit via RPC eth_sendUserOperation (or bundler-specific RPC)
      const response = await fetch(this.bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_sendUserOperation",
          params: [userOp, options.userAddress],
          id: Math.random(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        // If eth_sendUserOperation fails, try alternative RPC method
        return await this.submitUserOpAlternative(userOpRequest, options, gasPrice);
      }

      const userOpHash = data.result;
      console.log("✅ UserOp submitted:", userOpHash);
      return { success: true, userOpHash };
    } catch (err) {
      console.error("Failed to submit UserOp:", err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Alternative submission method using standard transaction RPC
   */
  private async submitUserOpAlternative(
    userOpRequest: UserOpRequest,
    options: SubmitUserOpsOptions,
    gasPrice: { maxFeePerGas: string; maxPriorityFeePerGas: string }
  ): Promise<BundlerSubmitResult> {
    try {
      // Fallback: submit as standard transaction via eth_sendTransaction
      // In a real bundler scenario, this would be converted to UserOp format
      const response = await fetch(this.bundlerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_sendTransaction",
          params: [
            {
              from: options.userAddress,
              to: userOpRequest.to,
              data: userOpRequest.data,
              value: userOpRequest.value,
              maxFeePerGas: gasPrice.maxFeePerGas,
              maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
            },
          ],
          id: Math.random(),
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      const txHash = data.result;
      console.log("✅ Transaction submitted:", txHash);
      return { success: true, userOpHash: txHash };
    } catch (err) {
      console.error("Alternative submission also failed:", err);
      return { success: false, error: String(err) };
    }
  }

  /**
   * Batch submit multiple user operations over time
   * Submits operations at specified intervals to bundler
   */
  async batchSubmitUserOps(
    generateUserOp: () => UserOpRequest,
    options: SubmitUserOpsOptions,
    config: BatchSubmissionConfig
  ): Promise<BundlerSubmitResult[]> {
    await this.initialize();

    const results: BundlerSubmitResult[] = [];
    const startTime = Date.now();
    let submitted = 0;
    let batch = 0;

    console.log(
      `🚀 Starting batch submission: ${config.totalOps} ops, interval: ${config.intervalMs}ms`
    );

    while (submitted < config.totalOps) {
      // Check timeout
      if (config.timeout && Date.now() - startTime > config.timeout) {
        console.warn("⏰ Batch submission timeout reached");
        break;
      }

      const opsInBatch = Math.min(
        config.opsPerBatch || 1,
        config.totalOps - submitted
      );

      // Submit batch of operations
      for (let i = 0; i < opsInBatch; i++) {
        try {
          const userOp = generateUserOp();
          const result = await this.submitUserOp(userOp, options);
          results.push(result);
          submitted++;

          if (result.success) {
            console.log(
              `✅ [${batch}:${i}] UserOp ${submitted}/${config.totalOps} submitted`
            );
          } else {
            console.warn(
              `⚠️ [${batch}:${i}] UserOp ${submitted}/${config.totalOps} failed: ${result.error}`
            );
          }
        } catch (err) {
          console.error(`❌ Error submitting UserOp ${submitted}:`, err);
          results.push({ success: false, error: String(err) });
          submitted++;
        }
      }

      batch++;

      // Wait for next batch interval (except after last submission)
      if (submitted < config.totalOps) {
        console.log(`⏳ Waiting ${config.intervalMs}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, config.intervalMs));
      }
    }

    console.log(
      `✅ Batch submission complete: ${results.filter((r) => r.success).length}/${results.length} successful`
    );
    return results;
  }

  /**
   * Create a play operation user request
   */
  createPlayUserOp(
    contractAddress: string,
    ticketRate: number,
    feeWei: bigint
  ): UserOpRequest {
    const data = encodeFunctionData({
      abi: CONTRACT_ABI,
      functionName: "play",
      args: [ticketRate],
    });

    return {
      to: contractAddress,
      data,
      value: feeWei.toString(),
    };
  }

  /**
   * Reset initialization state (useful for testing)
   */
  reset(): void {
    this.isInitialized = false;
  }
}

// Export singleton instance
export const bundlerService = new BundlerService();

