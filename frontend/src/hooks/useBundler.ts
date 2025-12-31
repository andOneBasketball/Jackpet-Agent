"use client";

import { useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  createPublicClient,
  http,
  Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { getContractAddress } from "@/config/contract";
import { bundlerClient } from "@/services/bundlerClient";
import { pimlicoClient } from "@/services/pimlicoClient";
import { useSessionAccount } from "@/providers/SessionAccountProvider";

export interface SessionData {
  permissionContext: {
    context: string;
    signerMeta: {
      delegationManager: string;
    };
  };
  userAddress: string;
  expiry: number;
}

export function useBundler() {
  const chainId = useChainId();
  const { sessionAccount } = useSessionAccount();  // Get the session account created in SessionAccountProvider

  /**
   * Submit a transaction using bundler RPC with ERC-7710 delegation
   * Now uses native ETH transfer (receive function) instead of calldata
   */
  const submitWithBundler = useCallback(
    async (
      session: SessionData,
      ticketRate: number,
      ticketFee: bigint,
      chainId: number
    ) => {
      try {
        console.log(`🚀 Submitting native transfer via bundler with ERC-7710 delegation`);

        // Validate session account exists
        if (!sessionAccount) {
          const errorMsg = "Session account not found. Please create a session account first.";
          console.error(errorMsg);
          return {
            success: false,
            error: errorMsg,
          };
        }

        // Extract delegation data from session
        const context = session.permissionContext.context;
        const delegationManager = session.permissionContext.signerMeta.delegationManager;
        const sessionUserAddress = session.userAddress;

        // Validate required parameters
        if (!context) throw new Error("Permission context is missing");
        if (!delegationManager || delegationManager === "0x") {
          throw new Error("Delegation manager is missing or invalid");
        }
        if (!sessionUserAddress) throw new Error("Session user address is missing");

        console.log("📋 Parameters validated:", {
          context: context.slice(0, 20) + "...",
          delegationManager,
          sessionUserAddress,
        });

        // Get contract address
        const contractAddress = getContractAddress(chainId);
        if (!contractAddress) throw new Error("Contract address not found");

        // Calculate fee based on ticket rate (native transfer to contract's receive function)
        const fee = (ticketFee * BigInt(ticketRate)) / 100n;

        console.log("📦 Transfer details:", {
          contractAddress: contractAddress,
          to: contractAddress,
          value: fee.toString(),
          data: "0x (native transfer)",
          ticketRate: ticketRate,
        });

        // Create public client for verification
        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http("https://api.zan.top/eth-sepolia"),
        });

        console.log("✅ SmartAccount created:", sessionAccount?.address);
        console.log("📝 Using session account from SessionAccountProvider");

        // Step 1: Get gas price estimation from Pimlico
        console.log("⛽ Fetching gas prices from Pimlico...");
        const { fast: txFee } = await pimlicoClient(chainId).getUserOperationGasPrice();

        // Step 2: Send UserOp with delegation using bundler client
        // Native ETH transfer triggers contract's receive() function automatically
        console.log("📤 Sending UserOp with ERC-7710 delegation (native transfer)...");
        console.log("Using permissionsContext from authorization:", context.slice(0, 20) + "...");
        console.log("Delegating to manager:", delegationManager);

        const userOpHash = await bundlerClient(chainId).sendUserOperationWithDelegation({
          publicClient,
          account: sessionAccount,
          calls: [
            {
              to: contractAddress as `0x${string}`,
              data: "0x" as Hex,  // ✅ Empty data for native transfer
              value: fee,
              permissionsContext: context as Hex,
              delegationManager: delegationManager as `0x${string}`,
            },
          ],
          ...txFee,
        });

        console.log("✅ UserOp submitted:", userOpHash);

        // Step 3: Wait for receipt
        console.log("⏳ Waiting for UserOp receipt...");
        const { receipt } = await bundlerClient(chainId).waitForUserOperationReceipt({
          hash: userOpHash,
        });

        console.log("✅ Transaction confirmed:", {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
        });

        return {
          success: true,
          userOpHash,
          txHash: receipt.transactionHash,
        };
      } catch (error: any) {
        console.error("❌ Bundler submission failed:", error);
        console.error("Error message:", error?.message);
        console.error("Error code:", error?.code);

        // Enhanced error analysis
        const errorMsg = error?.message?.toLowerCase() || "";

        if (errorMsg.includes("execution reverted")) {
          console.error("\n⚠️ UserOperation Execution Reverted");
          console.error("Possible causes:");
          console.error("1. Permission context is invalid or expired");
          console.error("2. SmartAccount not deployed or not funded");
          console.error("3. Delegation validation failed");
          console.error("4. Native transfer failed (check contract receive function)");
          console.error("5. Insufficient gas estimation");
        } else if (errorMsg.includes("aa23")) {
          console.error("\n⚠️ AA23 Error - SmartAccount validateUserOp failed");
          console.error("Likely cause: Insufficient balance in SmartAccount");
          console.error("Action: Fund the SmartAccount with ETH");
        } else if (errorMsg.includes("delegation")) {
          console.error("\n⚠️ Delegation Error");
          console.error("Check that:");
          console.error("- delegationManager address is correct");
          console.error("- permission context is fresh and valid");
          console.error("- permission hasn't expired");
        }

        return {
          success: false,
          error: String(error?.message || error),
        };
      }
    },
    [sessionAccount]  // Update dependency to use sessionAccount from hook
  );

  return {
    submitWithBundler,
  };
}

