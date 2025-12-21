"use client";

import { useReadContract, useWriteContract, useChainId, usePublicClient, useBalance } from "wagmi";
import { formatEther, decodeEventLog } from "viem";
import { useState, useCallback, useRef } from "react";
import { getContractAddress, CONTRACT_ABI } from "@/config/contract";

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<bigint | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Read contract state
  const { data: ticketFee } = useReadContract({
    address: getContractAddress(chainId),
    abi: CONTRACT_ABI,
    functionName: "ticketFeeWei",
  });

  const { data: jackpotPool, refetch: refetchJackpot } = useReadContract({
    address: getContractAddress(chainId),
    abi: CONTRACT_ABI,
    functionName: "jackpotPool",
  });

  const { data: maxTicketRate } = useReadContract({
    address: getContractAddress(chainId),
    abi: CONTRACT_ABI,
    functionName: "maxTicketRate",
  });

  // Read contract balance
  const { data: contractBalance, refetch: refetchBalance } = useBalance({
    address: getContractAddress(chainId),
  });

  // Write contract
  const { writeContractAsync } = useWriteContract();

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
      if (!publicClient) return;

      let attempts = 0;

      const poll = async () => {
        attempts++;
        console.log("Polling attempt", attempts, "for requestId:", requestId.toString());

        try {
          const outcome = await publicClient.readContract({
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
    [chainId, publicClient, stopPolling, refetchJackpot, refetchBalance]
  );

  // Start game
  const play = useCallback(
    async (ticketRate: number = 100) => {
      if (!ticketFee || !publicClient) return;

      setResult(null);
      setIsPlaying(true);
      stopPolling();

      try {
        const fee = (ticketFee * BigInt(ticketRate)) / 100n;

        const hash = await writeContractAsync({
          address: getContractAddress(chainId),
          abi: CONTRACT_ABI,
          functionName: "play",
          args: [ticketRate],
          value: fee,
        });

        console.log("Transaction hash:", hash);

        // Wait for transaction confirmation and get receipt
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

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
    [chainId, ticketFee, publicClient, writeContractAsync, stopPolling, pollOutcome]
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
