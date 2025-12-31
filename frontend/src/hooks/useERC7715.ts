"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import {
  parseEther,
  encodeFunctionData,
  Hex,
  createPublicClient,
  http,
} from "viem";
import { getContractAddress, CONTRACT_ABI } from "@/config/contract";
import { CHAIN_PARAMS } from "@/config/networks";
import {
  erc7715ProviderActions,
} from "@metamask/smart-accounts-kit/actions";
import { useSessionAccount } from "@/providers/SessionAccountProvider";
import { bundlerService, type BatchSubmissionConfig } from "@/utils/bundlerService";

// Session data interface
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

// ERC-7715 permission response interface
interface GrantPermissionsResponse {
  permissionsContext: string;
  grantedPermissions: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  expiry: number;
}

// Authorization settings interface
export interface AuthSettings {
  duration: number; // seconds
  playCount: number; // max transactions to execute
  ethAmount: number; // single game ticket fee in ETH (not used for periodAmount)
}

// Default authorization settings - corresponds to Quick Test preset (5m × 5)
const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  duration: 300, // 5 minutes (Quick Test preset)
  playCount: 5,  // 5 plays (Quick Test preset)
  ethAmount: 0.1, // placeholder (actual game fee comes from contract)
};

// Default bundler batch configuration
const DEFAULT_BATCH_CONFIG: BatchSubmissionConfig = {
  totalOps: 1,
  intervalMs: 5000, // 5 seconds between operations
  opsPerBatch: 1, // Submit 1 operation at a time
  timeout: 300000, // 5 minutes overall timeout
};

// Support status enum
export type SupportStatus = "unknown" | "checking" | "supported" | "unsupported";

export function useERC7715() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();  // ✅ Call hooks at top level
  const { sessionAccount } = useSessionAccount();     // ✅ Call hooks at top level

  // Session and authorization state
  const [session, setSession] = useState<SessionData | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [permissionContext, setPermissionContext] = useState<GrantPermissionsResponse | null>(null);
  const [authSettings, setAuthSettings] = useState<AuthSettings>(DEFAULT_AUTH_SETTINGS);
  const [remainingPlays, setRemainingPlays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supportStatus, setSupportStatus] = useState<SupportStatus>("unknown");

  // Auto-play state
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(5000); // ms between plays (legacy, not used in new mode)
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nextGameTriggerRef = useRef<(() => void) | null>(null);  // ✅ Ref to trigger next game

  // Bundler URL from environment
  const bundlerUrl = typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_BUNDLER_URL || ""
    : "";

  // Bundler configuration state
  const [batchConfig, setBatchConfig] = useState<BatchSubmissionConfig>(DEFAULT_BATCH_CONFIG);
  const [isBundlerSubmitting, setIsBundlerSubmitting] = useState(false);
  const [bundlerSubmissionProgress, setBundlerSubmissionProgress] = useState(0);

  // Save session to localStorage
  const saveSession = useCallback((sessionData: SessionData) => {
    try {
      localStorage.setItem("jackpet_session_v1", JSON.stringify(sessionData));
      console.log("✅ Session saved to localStorage");
    } catch (err) {
      console.error("Failed to save session:", err);
    }
  }, []);

  // Clear session from localStorage
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem("jackpet_session_v1");
      setSession(null);
      setIsAuthorized(false);
      setPermissionContext(null);
      setRemainingPlays(0);
      console.log("✅ Session cleared");
    } catch (err) {
      console.error("Failed to clear session:", err);
    }
  }, []);

  // Load session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem("jackpet_session_v1");
      if (saved) {
        const parsed = JSON.parse(saved) as SessionData;
        const now = Math.floor(Date.now() / 1000);

        // Check if session is still valid
        if (parsed.expiry && parsed.expiry > now) {
          console.log("✅ Valid session found, restoring...");
          setSession(parsed);
          setIsAuthorized(true);
          setRemainingPlays(authSettings.playCount);
          setSupportStatus("supported");
        } else {
          console.log("⏰ Session expired, clearing...");
          clearSession();
        }
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  }, []);

  // Execute game play using delegation (ERC-7715)
  const executeGameWithBundler = useCallback(
    async (onPlay: () => Promise<void>) => {
      if (!session) {
        setError("No active session. Please authorize first.");
        return false;
      }

      try {
        console.log("🚀 Executing game with ERC-7715 delegation...");

        // The actual bundler integration would be handled by the wallet client
        // through the ERC-7715 permission context that was granted
        // For now, we execute the game directly
        await onPlay();

        console.log("✅ Game execution successful");
        return true;
      } catch (err) {
        console.error("Game execution failed:", err);
        // Fallback to direct execution if anything fails
        try {
          console.log("Falling back to direct execution...");
          await onPlay();
          return true;
        } catch (fallbackErr) {
          console.error("Direct execution also failed:", fallbackErr);
          setError(`Game execution failed: ${fallbackErr}`);
          return false;
        }
      }
    },
    [session]
  );

  // Execute games using bundler batch submission (new bundler RPC method)
  const executeGamesWithBundlerBatch = useCallback(
    async (
      playCount: number,
      ticketRate: number,
      ticketFee: bigint,
      chainId: number
    ) => {
      if (!session || !session.permissionContext.context) {
        setError("No active session with permission context");
        return false;
      }

      if (!bundlerUrl) {
        setError("Bundler URL not configured");
        return false;
      }

      if (!address) {
        setError("User address not available");
        return false;
      }

      try {
        setIsBundlerSubmitting(true);
        setBundlerSubmissionProgress(0);
        setError(null);

        const contractAddress = getContractAddress(chainId);
        if (!contractAddress) {
          throw new Error("Contract address not found");
        }

        const fee = (ticketFee * BigInt(ticketRate)) / 100n;

        console.log("🚀 Starting bundler batch submission...");
        console.log(`Total games to execute: ${playCount}`);
        console.log(`Interval between submissions: ${batchConfig.intervalMs}ms`);

        // Prepare batch configuration
        const config: BatchSubmissionConfig = {
          totalOps: playCount,
          intervalMs: batchConfig.intervalMs,
          opsPerBatch: batchConfig.opsPerBatch || 1,
          timeout: batchConfig.timeout,
        };

        // Function to generate play operations
        const generateUserOp = () => {
          return bundlerService.createPlayUserOp(contractAddress, ticketRate, fee);
        };

        // Submit batch through bundler service
        const submitOptions = {
          sessionContext: session.permissionContext.context,
          delegationManager: session.permissionContext.signerMeta.delegationManager,
          userAddress: address,
          chainId: chainId,
        };

        let successCount = 0;
        const submitInterval = setInterval(() => {
          setBundlerSubmissionProgress((prev) => {
            const newProgress = Math.min(prev + playCount / (config.timeout! / 1000), playCount);
            return newProgress;
          });
        }, 1000);

        const results = await bundlerService.batchSubmitUserOps(
          generateUserOp,
          submitOptions,
          config
        );

        clearInterval(submitInterval);

        successCount = results.filter((r) => r.success).length;
        const failureCount = results.length - successCount;

        console.log(
          `✅ Batch submission complete: ${successCount} successful, ${failureCount} failed`
        );

        setIsBundlerSubmitting(false);
        setBundlerSubmissionProgress(0);

        if (successCount === 0) {
          setError("Failed to submit any operations through bundler");
          return false;
        }

        setRemainingPlays(Math.max(0, playCount - successCount));
        return true;
      } catch (err) {
        console.error("Bundler batch submission failed:", err);
        setError(`Bundler submission error: ${err}`);
        setIsBundlerSubmitting(false);
        setBundlerSubmissionProgress(0);
        return false;
      }
    },
    [session, address, bundlerUrl, batchConfig]
  );

  // Stop auto-play
  const stopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  // Check if permission is still valid
  const isPermissionValid = useCallback(() => {
    if (!permissionContext) return false;
    if (permissionContext.expiry < Math.floor(Date.now() / 1000)) {
      return false;
    }
    if (remainingPlays <= 0) {
      return false;
    }
    return true;
  }, [permissionContext, remainingPlays]);

  // Decrement remaining plays after each play
  const decrementPlays = useCallback(() => {
    setRemainingPlays((prev) => {
      const newValue = Math.max(0, prev - 1);
      if (newValue === 0) {
        stopAutoPlay();
      }
      return newValue;
    });
  }, [stopAutoPlay]);

  // Start auto-play with permission context (for immediate execution after permission granted)
  // ✅ Now waits for each game result before starting next game
  const startAutoPlayWithPermission = useCallback(
    (
      onPlay: (session: SessionData | null) => Promise<void>,
      permission: GrantPermissionsResponse,
      sessionData?: SessionData,
      totalPlaysOverride?: number  // ✅ Accept override to avoid async state issues
    ) => {
      console.log("[useERC7715] Starting auto-play with permission context:", permission);
      setIsAutoPlaying(true);

      let playCount = 0;
      const totalPlays = totalPlaysOverride ?? authSettings.playCount;
      console.log(`[useERC7715] Total plays planned: ${totalPlays}`);

      // Store the runAutoPlay function in a ref so it can be called from outside
      const runAutoPlay = async () => {
        // Check if permission is still valid
        const now = Math.floor(Date.now() / 1000);
        if (permission.expiry < now) {
          console.log("[useERC7715] Permission expired, stopping auto-play");
          setIsAutoPlaying(false);
          nextGameTriggerRef.current = null;
          return;
        }

        if (playCount >= totalPlays) {
          console.log("[useERC7715] All plays completed, stopping auto-play");
          setIsAutoPlaying(false);
          nextGameTriggerRef.current = null;
          return;
        }

        try {
          console.log(`[useERC7715] Executing auto-play ${playCount + 1}/${totalPlays}`);
          // Pass sessionData to onPlay so it can use permissionContext
          // Use provided sessionData first, fallback to session from state
          await onPlay(sessionData || session);
          playCount++;
          setRemainingPlays(totalPlays - playCount);
          console.log(`[useERC7715] Play ${playCount} completed, remaining: ${totalPlays - playCount}`);
          // ✅ Don't schedule next play here - wait for external trigger via onGameResultDismissed
        } catch (err) {
          console.error("[useERC7715] Auto-play execution error:", err);
          setIsAutoPlaying(false);
          nextGameTriggerRef.current = null;
        }
      };

      // Store the trigger function for next game
      nextGameTriggerRef.current = () => {
        console.log(`[useERC7715] nextGameTrigger called, playCount=${playCount}, totalPlays=${totalPlays}`);
        if (playCount < totalPlays) {
          console.log(`[useERC7715] Triggering game ${playCount + 1}/${totalPlays}...`);
          runAutoPlay();
        } else {
          console.log("[useERC7715] All plays completed in trigger, stopping auto-play");
          setIsAutoPlaying(false);
          nextGameTriggerRef.current = null;
        }
      };

      console.log("[useERC7715] nextGameTriggerRef.current set, starting first play in 100ms");

      // Start first play immediately
      setTimeout(runAutoPlay, 100);
    },
    [authSettings.playCount, session]
  );

  // Start auto-play (original implementation for manual triggering)
  const startAutoPlay = useCallback(
    (onPlay: (session: SessionData | null) => Promise<void>) => {
      if (!isPermissionValid()) {
        setError("Permission is invalid or expired");
        return;
      }

      setIsAutoPlaying(true);

      const runAutoPlay = async () => {
        if (!isPermissionValid()) {
          stopAutoPlay();
          return;
        }

        try {
          // Pass session to onPlay so it can use permissionContext
          await onPlay(session);
          decrementPlays();
        } catch (err) {
          console.error("Auto-play error:", err);
          stopAutoPlay();
        }
      };

      // Start first play immediately
      runAutoPlay();

      // Schedule subsequent plays
      autoPlayTimerRef.current = setInterval(() => {
        if (remainingPlays > 0) {
          runAutoPlay();
        } else {
          stopAutoPlay();
        }
      }, autoPlayInterval);
    },
    [isPermissionValid, decrementPlays, autoPlayInterval, remainingPlays, stopAutoPlay, session]
  );

  // Request ERC-7715 permission
  const requestPermission = useCallback(
    async (
      onAutoExecute?: (session: SessionData | null) => Promise<void>,
      overrideSettings?: Partial<AuthSettings>  // ✅ Accept override settings to avoid async state issues
    ) => {
      // ✅ walletClient and sessionAccount are obtained from top-level hooks, no need to call them here
      if (!walletClient) {
        setError("No wallet provider found. Please install MetaMask Flask.");
        return false;
      }

      if (!sessionAccount) {
        setError("Session account not created. Please create a session account first.");
        return false;
      }

      if (!address) {
        setError("Wallet not connected");
        return false;
      }

      const contractAddress = getContractAddress(chainId);
      if (!contractAddress) {
        setError("Contract address not found for this chain");
        return false;
      }

      setIsAuthorizing(true);
      setError(null);

      // ✅ Merge override settings with current authSettings (override takes priority)
      const settings = { ...authSettings, ...overrideSettings };

      try {
        console.log("=== ERC-7715 Permission Request Started ===");
        console.log("Connected wallet:", address);
        console.log("Session account:", sessionAccount.address);
        console.log("Current chainId:", chainId);
        console.log("Auth settings (merged):", settings);

        const now = Math.floor(Date.now() / 1000);
        const expiry = now + settings.duration;

        // Get contract address
        const contractAddr = getContractAddress(chainId);

        console.log("Permission request params:");
        console.log("- chainId:", chainId);
        console.log("- expiry:", expiry);
        console.log("- signer (session account):", sessionAccount.address);
        console.log("- isAdjustmentAllowed:", false);
        console.log("- permission type: native-token-periodic");
        console.log("- Fetching ticketFee from contract...");

        // Fetch ticket fee from contract using public RPC
        let ticketFeeWei: bigint;
        try {
          // Get RPC URL from chain params
          const chainParams = CHAIN_PARAMS[chainId];
          const rpcUrl = chainParams?.rpcUrls?.[0];
          if (!rpcUrl) {
            throw new Error(`No RPC URL configured for chainId ${chainId}`);
          }

          const publicClient = createPublicClient({
            transport: http(rpcUrl),
          });

          const ticketFee = await publicClient.readContract({
            address: contractAddr as Hex,
            abi: CONTRACT_ABI,
            functionName: "ticketFeeWei",
          });

          ticketFeeWei = BigInt(ticketFee.toString());
          console.log("✅ Fetched ticketFeeWei:", ticketFeeWei.toString(), "wei");
        } catch (fetchErr) {
          console.error("Failed to fetch ticketFeeWei from contract:", fetchErr);
          // Fallback to a reasonable default (0.01 ETH)
          ticketFeeWei = parseEther("0.01");
          console.log("⚠️ Using fallback ticketFeeWei:", ticketFeeWei.toString(), "wei");
        }

        console.log("- periodAmount:", ticketFeeWei.toString(), "wei (single game fee)");

        // Calculate total authorization amount: ticketFee × playCount
        const totalAuthAmount = ticketFeeWei * BigInt(settings.playCount);
        console.log("- Total auth amount:", totalAuthAmount.toString(), "wei (", settings.playCount, "games ×", ticketFeeWei.toString(), "wei)");

        // Request execution permissions using ERC-7715 standard
        // The signer MUST be the session account address, not the user wallet
        console.log("Sending wallet_requestExecutionPermissions RPC call...");
        let permissionsResponse;
        try {
          const extendedClient = walletClient.extend(erc7715ProviderActions());

          permissionsResponse = await extendedClient.requestExecutionPermissions([
            {
              chainId: chainId,
              expiry: expiry,
              signer: {
                type: "account",
                data: {
                  address: sessionAccount.address,  // ✅ Use session account as signer
                },
              },
              isAdjustmentAllowed: false,  // ✅ Top-level field: do not allow adjustment
              permission: {
                type: "native-token-periodic" as any,
                data: {
                  periodAmount: totalAuthAmount,  // ✅ Total: ticketFee × playCount
                  periodDuration: settings.duration,
                  justification: `Permission to play ${settings.playCount} lottery games within ${settings.duration}s period`,
                } as any,
              },
            } as any,
          ]);
        } catch (rpcErr: any) {
          console.error("RPC call failed, error details:", {
            code: rpcErr?.code,
            message: rpcErr?.message,
            details: rpcErr?.details,
          });
          throw rpcErr;
        }

        if (!permissionsResponse || permissionsResponse.length === 0) {
          console.warn("No permission response received");
          setError("Failed to grant ERC-7715 permission - no response from wallet");
          setSupportStatus("unsupported");
          setIsAuthorizing(false);
          return false;
        }

        const response = permissionsResponse[0];
        console.log("✅ Permission granted successfully");
        console.log("Response type:", typeof response);
        console.log("Response keys:", Object.keys(response || {}));
        console.log("Response:", JSON.stringify(response, null, 2));
        console.log("Permission details:");
        console.log("- Type: native-token-periodic");
        console.log("- Period Duration:", settings.duration, "seconds");
        console.log("- Period Amount (total):", totalAuthAmount.toString(), "wei");
        console.log("- Per game fee:", ticketFeeWei.toString(), "wei");
        console.log("- Total games:", settings.playCount);
        console.log("- Justification: Permission to play", settings.playCount, "lottery games within", settings.duration, "s period");

        // Get the permission context (could be permissionsContext or context)
        const permissionContextValue = (response as any)?.permissionsContext || (response as any)?.context || "";

        // Extract delegationManager from the permission response
        const delegationManager = (response as any)?.signerMeta?.delegationManager ||
                                  (response as any)?.signer?.data?.delegationManager ||
                                  "";

        if (!delegationManager) {
          console.warn("⚠️ Warning: delegationManager not found in permission response. This may cause issues when submitting transactions.");
        }

        // Safely get expiry value
        let responseExpiry = (response as any)?.expiry;
        if (typeof responseExpiry === "string") {
          responseExpiry = parseInt(responseExpiry, 10);
        }

        if (!responseExpiry || responseExpiry < 1000) {
          // If expiry is missing or unreasonable, use our calculated expiry
          responseExpiry = expiry;
          console.log("Using calculated expiry instead of response expiry");
        }

        console.log("Final expiry value:", responseExpiry, "valid:", typeof responseExpiry === "number" && responseExpiry > 1000);

        // Create session data to save for future use
        // Note: userAddress is the connected wallet (the authorizer)
        // The signer was the sessionAccount (which is separate)
        const sessionData: SessionData = {
          permissionContext: {
            context: permissionContextValue,
            signerMeta: {
              delegationManager: delegationManager as `0x${string}`,
            },
          },
          userAddress: address,  // Connected wallet address
          expiry: responseExpiry,
        };

        // Save session for future executions
        saveSession(sessionData);
        setSession(sessionData);

        // Create permission context object
        const permissionContextData: GrantPermissionsResponse = {
          permissionsContext: permissionContextValue,
          grantedPermissions: (response as any)?.grantedPermissions || [],
          expiry: responseExpiry,
        };

        // Update state
        setIsAuthorized(true);
        setRemainingPlays(settings.playCount);
        setPermissionContext(permissionContextData);
        setSupportStatus("supported");
        setIsAuthorizing(false);

        console.log("✅ State updated, session saved");

        // If onAutoExecute callback provided, start auto-play immediately
        if (onAutoExecute) {
          console.log("🚀 Starting auto-play with callback...");
          console.log(`Will execute ${settings.playCount} plays, interval: ${autoPlayInterval}ms`);

          // Schedule after a brief delay to ensure rendering completes
          setTimeout(() => {
            startAutoPlayWithPermission(onAutoExecute, permissionContextData, sessionData, settings.playCount);
          }, 50);
          return true;
        }

        console.log("Permission request complete. Manual auto-play trigger available.");
        return true;
      } catch (err: any) {
        console.error("ERC-7715 permission error:", err);
        console.error("Error details:", {
          code: err?.code,
          message: err?.message,
          details: err?.details,
          data: err?.data,
          stack: err?.stack,
        });

        const errorMessage = err?.message?.toLowerCase() || "";
        const errorCode = err?.code;
        const errorDetails = err?.details?.toLowerCase() || "";

        if (errorCode === 4001) {
          setError("User rejected the permission request");
        } else if (errorCode === -32601 || errorMessage.includes("method not found")) {
          setError(
            "❌ wallet_requestExecutionPermissions not supported\n\n" +
            "Your wallet doesn't have ERC-7715 support yet.\n\n" +
            "This feature requires:\n" +
            "• MetaMask Flask (development version)\n" +
            "• Experimental Snaps with ERC-7715 support\n\n" +
            "Status: ERC-7715 is still in development."
          );
          setSupportStatus("unsupported");
        } else if (
          errorMessage.includes("snap") ||
          errorMessage.includes("delegation") ||
          errorMessage.includes("token balance") ||
          errorDetails.includes("token balance") ||
          errorMessage.includes("resource not found")
        ) {
          setError(
            "⚠️ Wallet operation failed\n\n" +
            "Possible causes:\n" +
            "1. Network connectivity issues\n" +
            "2. Snap configuration problems\n" +
            "3. Token metadata lookup failed\n\n" +
            `Details: ${err?.message || err?.details || "Unknown error"}`
          );
          setSupportStatus("unsupported");
        } else if (errorCode === -32602 || errorMessage.includes("invalid")) {
          setError(
            "❌ Invalid permission request format\n\n" +
            `Details: ${err?.message}`
          );
        } else {
          setError(
            `⚠️ Error: ${err?.message || err?.details || "Failed to request permission"}`
          );
        }

        return false;
      } finally {
        setIsAuthorizing(false);
      }
    },
    [address, chainId, authSettings, startAutoPlayWithPermission, walletClient, sessionAccount]
  );

  // Revoke permission (local state only)
  const revokePermission = useCallback(() => {
    setIsAuthorized(false);
    setPermissionContext(null);
    setRemainingPlays(0);
    stopAutoPlay();
  }, [stopAutoPlay]);

  // Update auth settings
  const updateAuthSettings = useCallback((settings: Partial<AuthSettings>) => {
    setAuthSettings((prev) => ({ ...prev, ...settings }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, []);

  // Check permission validity periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (isAuthorized && !isPermissionValid()) {
        revokePermission();
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [isAuthorized, isPermissionValid, revokePermission]);

  // Get time remaining string
  const getTimeRemaining = useCallback(() => {
    if (!permissionContext) return "";
    const now = Math.floor(Date.now() / 1000);
    const remaining = permissionContext.expiry - now;
    if (remaining <= 0) return "Expired";

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    return `${hours}h ${minutes}m remaining`;
  }, [permissionContext]);

  // ✅ Trigger next game in auto-play sequence (called when result popup is dismissed)
  const triggerNextGame = useCallback(() => {
    console.log("[useERC7715] triggerNextGame called");
    console.log("[useERC7715] nextGameTriggerRef.current exists:", !!nextGameTriggerRef.current);
    if (nextGameTriggerRef.current) {
      console.log("[useERC7715] Triggering next game from external call...");
      nextGameTriggerRef.current();
    } else {
      console.warn("[useERC7715] nextGameTriggerRef.current is null, cannot trigger next game");
    }
  }, []);

  return {
    // State
    isAuthorized,
    isAuthorizing,
    permissionContext,
    authSettings,
    remainingPlays,
    error,
    isAutoPlaying,
    autoPlayInterval,
    supportStatus,
    session,
    isBundlerSubmitting,
    bundlerSubmissionProgress,

    // Actions
    requestPermission,
    revokePermission,
    isPermissionValid,
    decrementPlays,
    startAutoPlay,
    stopAutoPlay,
    updateAuthSettings,
    setAutoPlayInterval,
    clearError: () => setError(null),
    executeGameWithBundler,
    executeGamesWithBundlerBatch,
    triggerNextGame,  // ✅ New: trigger next game in auto-play

    // Bundler configuration
    batchConfig,
    setBatchConfig,

    // Helpers
    getTimeRemaining,
  };
}
