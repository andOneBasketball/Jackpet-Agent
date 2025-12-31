"use client";

import { useReadContract, useWriteContract, useChainId, usePublicClient, useBalance } from "wagmi";
import { formatEther, decodeEventLog } from "viem";
import { useState, useCallback, useRef, useEffect } from "react";
import { getContractAddress, CONTRACT_ABI } from "@/config/contract";
import { useBundler } from "@/hooks/useBundler";

export interface GameResult {
  a: number;
  b: number;
  c: number;
  payout: bigint;
  jackpotPayout: bigint;
}

interface OutcomeResult {
  settled: boolean;
  player: string;
  a: number;
  b: number;
  c: number;
  ticketRate: number;
  payoutWei: bigint;
  jackpotPayout: bigint;
  timestamp: bigint;
}

const POLL_INTERVAL = 2000; // Poll interval in ms
const MAX_POLL_ATTEMPTS = 150; // Max poll attempts (5 minutes)

export function useJackpet() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const publicClientForChain = usePublicClient({ chainId: chainId as number | undefined });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<bigint | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { submitWithBundler } = useBundler();

  // Read contract state
  const { data: ticketFee, refetch: refetchTicketFee } = useReadContract({
    address: getContractAddress(chainId),
    chainId: chainId as number | undefined,
    abi: CONTRACT_ABI,
    functionName: "ticketFeeWei",
  });

  const { data: jackpotPool, refetch: refetchJackpot } = useReadContract({
    address: getContractAddress(chainId),
    chainId: chainId as number | undefined,
    abi: CONTRACT_ABI,
    functionName: "jackpotPool",
  });

  const { data: maxTicketRate } = useReadContract({
    address: getContractAddress(chainId),
    chainId: chainId as number | undefined,
    abi: CONTRACT_ABI,
    functionName: "maxTicketRate",
  });

  // Read contract balance
  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: getContractAddress(chainId),
    chainId: chainId as number | undefined,
  });

  // Refetch balances when chain changes
  useEffect(() => {
    console.log("useJackpet: chain changed, refetching ticketFee/jackpot/balance", chainId);
    // refetch ticket fee, jackpot and balance when chain switches
    try {
      refetchTicketFee && refetchTicketFee();
    } catch (e) {
      console.warn("refetchTicketFee failed", e);
    }
    try {
      refetchJackpot && refetchJackpot();
    } catch (e) {
      console.warn("refetchJackpot failed", e);
    }
    try {
      refetchBalance && refetchBalance();
    } catch (e) {
      console.warn("refetchBalance failed", e);
    }
    // Also try a delayed refetch in case provider/chain state isn't fully ready
    const t = setTimeout(() => {
      try {
        refetchTicketFee && refetchTicketFee();
      } catch (e) {
        console.warn("delayed refetchTicketFee failed", e);
      }
      try {
        refetchJackpot && refetchJackpot();
      } catch (e) {
        console.warn("delayed refetchJackpot failed", e);
      }
      try {
        refetchBalance && refetchBalance();
      } catch (e) {
        console.warn("delayed refetchBalance failed", e);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [chainId, refetchTicketFee, refetchJackpot, refetchBalance]);

  // Direct provider read diagnostics using publicClientForChain
  useEffect(() => {
    const addr = getContractAddress(chainId);
    (async () => {
      try {
        if (!publicClientForChain) {
          console.warn("publicClientForChain not available for chainId", chainId);
          return;
        }

        console.log("diagnostic: using publicClientForChain for chainId", chainId);

        const tf = await publicClientForChain.readContract({
          address: addr,
          abi: CONTRACT_ABI,
          functionName: "ticketFeeWei",
        }).catch((e) => {
          console.error("diagnostic: readContract(ticketFeeWei) failed", e);
          return undefined;
        });

        const jp = await publicClientForChain.readContract({
          address: addr,
          abi: CONTRACT_ABI,
          functionName: "jackpotPool",
        }).catch((e) => {
          console.error("diagnostic: readContract(jackpotPool) failed", e);
          return undefined;
        });

        const bal = await publicClientForChain.getBalance({ address: addr }).catch((e) => {
          console.error("diagnostic: getBalance failed", e);
          return undefined;
        });

        console.log("diagnostic: direct reads", { ticketFee: tf, jackpotPool: jp, contractBalance: bal });
      } catch (e) {
        console.error("diagnostic read error", e);
      }
    })();
  }, [chainId, publicClientForChain]);

  // Log raw read values for debugging
  useEffect(() => {
    console.log("useJackpet: read values", {
      ticketFee,
      ticketFeeFormatted: ticketFee ? formatEther(ticketFee as bigint) : undefined,
      jackpotPool,
      jackpotPoolFormatted: jackpotPool ? formatEther(jackpotPool as bigint) : undefined,
      contractBalance,
    });
  }, [ticketFee, jackpotPool, contractBalance]);

  // Write contract
  const { writeContractAsync } = useWriteContract();
  const activePublicClient = publicClient;

  // Debug: log current chain and resolved contract address
  useEffect(() => {
    console.log("useJackpet: chainId=", chainId, "contract=", getContractAddress(chainId));
  }, [chainId]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Poll for game result
  const pollOutcome = useCallback(
    async (requestId: bigint) => {
      if (!activePublicClient) return;

      let attempts = 0;

      const poll = async () => {
        attempts++;
        console.log("Polling attempt", attempts, "for requestId:", requestId.toString());

        try {
          const outcome = await activePublicClient.readContract({
            address: getContractAddress(chainId),
            abi: CONTRACT_ABI,
            functionName: "getOutcome",
            args: [requestId],
          });

          console.log("Raw outcome:", outcome);

          // viem returns array for multi-value returns: [settled, player, a, b, c, ticketRate, payoutWei, jackpotPayout, timestamp]
          const [settled, , a, b, c, , payoutWei, jackpotPayout] = outcome as [
            boolean, string, number, number, number, number, bigint, bigint, bigint
          ];

          console.log("Parsed outcome:", { settled, a, b, c, payoutWei: String(payoutWei), jackpotPayout: String(jackpotPayout) });

          if (settled) {
            console.log("Game settled! Setting result...");
            setResult({
              a,
              b,
              c,
              payout: payoutWei,
              jackpotPayout,
            });
            setIsPlaying(false);
            stopPolling();
            // Refresh jackpot and balance data
            refetchJackpot();
            refetchBalance();
            return;
          }
        } catch (error) {
          console.error("Poll getOutcome error:", error);
        }

        // Not settled and within max attempts, continue polling
        if (attempts < MAX_POLL_ATTEMPTS) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL);
        } else {
          // Timeout handling
          console.error("Polling timeout - game result not received");
          setIsPlaying(false);
          stopPolling();
        }
      };

      poll();
    },
    [chainId, activePublicClient, stopPolling, refetchJackpot, refetchBalance]
  );

  // Start game
  const play = useCallback(
    async (ticketRate: number = 100, session?: any, useBundlerMode: boolean = false) => {
      console.log("play() called", { chainId, ticketFee, hasPublicClient: !!activePublicClient, hasWriter: !!writeContractAsync, hasSession: !!session, useBundler: useBundlerMode });
      // Ensure we have ticketFee; if not, try to refetch once (useful right after chain switch)
      let currentTicketFee = ticketFee as bigint | undefined;
      if (currentTicketFee == null) {
        try {
          console.log("play(): ticketFee missing, attempting refetch...");
          const refetched = await (refetchTicketFee ? refetchTicketFee() : Promise.resolve(undefined));
          currentTicketFee = (refetched as any) ?? undefined;
        } catch (e) {
          console.warn("play(): refetchTicketFee failed", e);
        }
      }

      if (currentTicketFee == null) {
        console.warn("play(): ticketFee missing - cannot play");
        return;
      }
      if (!activePublicClient) {
        console.warn("play(): public client missing - cannot play");
        return;
      }

      setResult(null);
      setIsPlaying(true);
      stopPolling();

      try {
        const fee = (currentTicketFee * BigInt(ticketRate)) / 100n;

        console.log("play(): submitting tx to chainId=", chainId, "address=", getContractAddress(chainId), { useSession: !!session, useBundler: useBundlerMode });

        let hash: string;

        // If session with permissionContext is provided and bundler mode is enabled
        if (session?.permissionContext?.context && useBundlerMode) {
          console.log("🚀 Using bundler with delegation for transaction execution");
          // Submit via bundler with delegation
          const bundlerResult = await submitWithBundler(
            session,
            ticketRate,
            currentTicketFee as bigint,
            chainId
          );

          if (bundlerResult.success && bundlerResult.txHash) {
            console.log("✅ Bundler transaction confirmed:", bundlerResult.txHash);

            // Wait a moment for chain state to update
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Parse event from the confirmed transaction
            const receipt = await activePublicClient.getTransactionReceipt({
              hash: bundlerResult.txHash as `0x${string}`,
            });

            if (receipt) {
              // Parse PlayRequested event from receipt to get requestId
              let requestId: bigint | null = null;
              for (const log of receipt.logs) {
                try {
                  const decoded = decodeEventLog({
                    abi: CONTRACT_ABI,
                    data: log.data,
                    topics: log.topics,
                  });
                  if (decoded.eventName === "PlayRequested") {
                    requestId = (decoded.args as { requestId: bigint }).requestId;
                    break;
                  }
                } catch {
                  // Ignore logs that cannot be parsed
                }
              }

              if (requestId !== null) {
                console.log("Request ID:", requestId.toString());
                setCurrentRequestId(requestId);
                // Start polling for result
                pollOutcome(requestId);
                return;
              }
            }

            // If we got here, bundler succeeded but we couldn't find requestId
            // This might happen if the contract emits different events
            console.warn("Bundler succeeded but couldn't find PlayRequested event");
            setIsPlaying(false);
            return;
          } else {
            // Bundler failed - throw error instead of fallback to wallet popup
            console.error("❌ Bundler submission failed:", bundlerResult.error);
            throw new Error(bundlerResult.error || "Bundler submission failed - auto-play requires working bundler");
          }
        }

        // If session exists but bundler mode is not enabled, this is likely a configuration error
        // for auto-play. We should not fallback to eth_sendTransaction which requires wallet popup.
        if (session?.permissionContext?.context) {
          console.error("❌ Session provided but bundler mode not enabled. Auto-play requires useBundlerMode=true");
          throw new Error("Auto-play configuration error: bundler mode must be enabled when using session");
        }

        // Standard play without ERC-7715 (manual play, will show wallet popup)
        hash = await writeContractAsync({
          address: getContractAddress(chainId),
          abi: CONTRACT_ABI,
          functionName: "play",
          args: [ticketRate],
          value: fee,
          chainId: chainId as number | undefined,
        });

        console.log("Transaction hash:", hash);

        // Wait for transaction confirmation and get receipt
        const receipt = await activePublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

        // Parse PlayRequested event from receipt to get requestId
        let requestId: bigint | null = null;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: CONTRACT_ABI,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "PlayRequested") {
              requestId = (decoded.args as { requestId: bigint }).requestId;
              break;
            }
          } catch {
            // Ignore logs that cannot be parsed
          }
        }

        if (requestId === null) {
          throw new Error("Failed to get requestId from transaction");
        }

        console.log("Request ID:", requestId.toString());
        setCurrentRequestId(requestId);

        // Start polling for result
        pollOutcome(requestId);
      } catch (error) {
        console.error("Play failed:", error);
        setIsPlaying(false);
        throw error;
      }
    },
    [chainId, ticketFee, activePublicClient, writeContractAsync, stopPolling, pollOutcome, submitWithBundler]
  );

  // Demo game (for demo/testing)
  const playDemo = useCallback(async () => {
    setResult(null);
    setIsPlaying(true);

    // Simulate VRF delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate random result
    const generateResult = (): { a: number; b: number; c: number } => {
      // Randomly pick 12 pets (8+8+8=24)
      const pool = [
        ...Array(8).fill(0),
        ...Array(8).fill(1),
        ...Array(8).fill(2),
      ];
      const counts = [0, 0, 0];

      for (let i = 0; i < 12; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        counts[pool[idx]]++;
        pool.splice(idx, 1);
      }

      // Sort
      counts.sort((a, b) => b - a);
      return { a: counts[0], b: counts[1], c: counts[2] };
    };

    const { a, b, c } = generateResult();

    setResult({
      a,
      b,
      c,
      payout: 0n,
      jackpotPayout: 0n,
    });

    setIsPlaying(false);
  }, []);

  return {
    ticketFee: ticketFee ? formatEther(ticketFee) : "0.01",
    jackpotPool: jackpotPool ? formatEther(jackpotPool) : "0",
    contractBalance: contractBalance ? contractBalance.formatted : "0",
    maxTicketRate: maxTicketRate || 1000,
    isPlaying,
    result,
    currentRequestId,
    play,
    playDemo,
    resetResult: () => setResult(null),
  };
}
