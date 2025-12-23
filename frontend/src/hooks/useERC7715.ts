"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseEther } from "viem";
import { getContractAddress } from "@/config/contract";

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
  duration: number; // hours
  playCount: number; // max play times
  ethAmount: number; // ETH allowance
}

// Default authorization settings
const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  duration: 24,
  playCount: 10,
  ethAmount: 0.1,
};

// Support status enum
export type SupportStatus = "unknown" | "checking" | "supported" | "unsupported";

export function useERC7715() {
  const { address } = useAccount();
  const chainId = useChainId();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [permissionContext, setPermissionContext] = useState<GrantPermissionsResponse | null>(null);
  const [authSettings, setAuthSettings] = useState<AuthSettings>(DEFAULT_AUTH_SETTINGS);
  const [remainingPlays, setRemainingPlays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supportStatus, setSupportStatus] = useState<SupportStatus>("unknown");

  // Auto-play state
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(5000); // ms between plays
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get ethereum provider
  const getProvider = useCallback(() => {
    if (typeof window === "undefined") return null;
    return (window as any).ethereum;
  }, []);

  // Request ERC-7715 permission using MetaMask's implementation
  const requestPermission = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setError("No wallet provider found");
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

    try {
      const now = Math.floor(Date.now() / 1000);
      const expiry = now + authSettings.duration * 3600;
      const allowanceWei = parseEther(authSettings.ethAmount.toString());

      // Direct RPC call to wallet_grantPermissions
      console.log("Using direct wallet_grantPermissions RPC call");

      const permissionRequest = {
        chainId: `0x${chainId.toString(16)}`,
        address: address,
        expiry: expiry,
        signer: {
          type: "wallet",
          data: {},
        },
        permissions: [
          {
            type: "native-token-stream",
            data: {
              initialAmount: allowanceWei.toString(),
              amountPerSecond: parseEther("0.001").toString(),
              maxAmount: allowanceWei.toString(),
              startTime: now,
              justification: `Jackpet game: ${authSettings.playCount} plays`,
            },
            required: true,
          },
        ],
      };

      console.log("Direct RPC permission request:", permissionRequest);

      const response = await provider.request({
        method: "wallet_grantPermissions",
        params: [permissionRequest],
      });

      console.log("ERC-7715 permission response:", response);

      if (response) {
        setIsAuthorized(true);
        setRemainingPlays(authSettings.playCount);
        setPermissionContext(response);
        setSupportStatus("supported");
        return true;
      }

      setError("No permissions were granted");
      return false;
    } catch (err: any) {
      console.error("ERC-7715 permission error:", err);

      // Parse error and provide helpful message
      const errorMessage = err?.message?.toLowerCase() || "";
      const errorCode = err?.code;

      if (errorCode === 4001) {
        setError("User rejected the permission request");
      } else if (errorCode === -32601 || errorMessage.includes("method not found") || errorMessage.includes("unknown method")) {
        setSupportStatus("unsupported");
        setError(
          "wallet_grantPermissions not found. Please ensure you have:\n" +
          "1. MetaMask Flask installed (not regular MetaMask)\n" +
          "2. The Delegation Toolkit Snaps will be auto-installed on first use"
        );
      } else if (errorMessage.includes("snap")) {
        setError(
          "Snap error: " + err.message + "\n" +
          "Please ensure MetaMask Flask Snaps are properly configured."
        );
      } else if (errorCode === -32602) {
        setError("Invalid permission request format. The permission type may not be supported.");
      } else {
        setError(err?.message || "Failed to request permission");
      }

      return false;
    } finally {
      setIsAuthorizing(false);
    }
  }, [address, chainId, authSettings, getProvider]);

  // Revoke permission (local state only)
  const revokePermission = useCallback(() => {
    setIsAuthorized(false);
    setPermissionContext(null);
    setRemainingPlays(0);
    stopAutoPlay();
  }, []);

  // Check if permission is still valid
  const isPermissionValid = useCallback(() => {
    if (!permissionContext) return false;
    if (permissionContext.expiry < Math.floor(Date.now() / 1000)) {
      revokePermission();
      return false;
    }
    if (remainingPlays <= 0) {
      return false;
    }
    return true;
  }, [permissionContext, remainingPlays, revokePermission]);

  // Decrement remaining plays after each play
  const decrementPlays = useCallback(() => {
    setRemainingPlays((prev) => {
      const newValue = Math.max(0, prev - 1);
      if (newValue === 0) {
        stopAutoPlay();
      }
      return newValue;
    });
  }, []);

  // Stop auto-play
  const stopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
  }, []);

  // Start auto-play
  const startAutoPlay = useCallback(
    (onPlay: () => Promise<void>) => {
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
          await onPlay();
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
    [isPermissionValid, decrementPlays, autoPlayInterval, remainingPlays, stopAutoPlay]
  );

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

    // Helpers
    getTimeRemaining,
  };
}
