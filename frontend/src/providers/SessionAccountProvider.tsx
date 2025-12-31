"use client";

import { ReactNode, createContext, useContext, useState, useCallback } from "react";
import { usePublicClient } from "wagmi";
import {
  createPublicClient,
  http,
  Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  toMetaMaskSmartAccount,
  Implementation,
  MetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";

interface SessionAccountContextType {
  sessionAccount: MetaMaskSmartAccount | null;
  createSessionAccount: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const SessionAccountContext = createContext<SessionAccountContextType>({
  sessionAccount: null,
  createSessionAccount: async () => {},
  isLoading: false,
  error: null,
});

export function SessionAccountProvider({ children }: { children: ReactNode }) {
  const [sessionAccount, setSessionAccount] = useState<MetaMaskSmartAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSessionAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("📝 Creating session account...");

      // Create public client for Sepolia testnet
      const publicClient = createPublicClient({
        chain: sepolia,
        transport: http("https://api.zan.top/eth-sepolia"),
      });

      // Generate a new private key for the session account
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      console.log("🔑 Generated session private key, account:", account.address);

      // Save the private key to localStorage for later use
      if (typeof window !== "undefined") {
        localStorage.setItem("session_private_key", privateKey);
        console.log("💾 Session private key saved to localStorage");
      }

      // Create MetaMask SmartAccount from the session account
      // This creates a smart account that uses the session private key as signer
      const newSessionAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [account.address, [], [], []],
        deploySalt: "0x",
        signer: { account },
      });

      console.log("✅ Session account created:", newSessionAccount.address);
      setSessionAccount(newSessionAccount);
      setIsLoading(false);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create session account";
      console.error("❌ Error creating session account:", errorMessage);
      setError(errorMessage);
      setIsLoading(false);
    }
  }, []);

  return (
    <SessionAccountContext.Provider
      value={{
        sessionAccount,
        createSessionAccount,
        isLoading,
        error,
      }}
    >
      {children}
    </SessionAccountContext.Provider>
  );
}

export function useSessionAccount() {
  const context = useContext(SessionAccountContext);
  if (!context) {
    throw new Error("useSessionAccount must be used within SessionAccountProvider");
  }
  return context;
}
