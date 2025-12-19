import { useEffect, useState } from "react";
import { ethers } from "ethers";
import ABI from "@/abi/PlayContract.json";
import { getContractAddress, CHAIN_PARAMS, PREFERRED_CHAIN_ID } from "@/config/networks";

export type PlayResult = {
  requestId: string;
  player: string;
  a: number;
  b: number;
  c: number;
  ticketRate: number;
  payoutWei: string;
  jackpotPayout: string;
};

export const usePlayResult = (playerAddress: string | null) => {
  const [result, setResult] = useState<PlayResult | null>(null);

  useEffect(() => {
    if (!playerAddress) return;

    let rpcProvider: ethers.JsonRpcProvider | null = null;
    let contract: ethers.Contract | null = null;

    let mounted = true;

    const setup = async () => {
      try {
        // Prefer to detect user's current chain via injected wallet if present
        let chainIdNum = PREFERRED_CHAIN_ID;
        if ((window as any).ethereum) {
          try {
            const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
            const net = await browserProvider.getNetwork();
            chainIdNum = Number(net.chainId);
          } catch (e) {
            // fallback to preferred
            chainIdNum = PREFERRED_CHAIN_ID;
          }
        }

        // Resolve contract address for the detected chain, fallback to preferred
        let contractAddress = getContractAddress(chainIdNum) || getContractAddress(PREFERRED_CHAIN_ID);
        if (!contractAddress) return;

        // Get an RPC URL for reliable event listening
        const rpcUrl = (CHAIN_PARAMS[chainIdNum]?.rpcUrls?.[0]) || CHAIN_PARAMS[PREFERRED_CHAIN_ID]?.rpcUrls?.[0];
        if (!rpcUrl) return;

        rpcProvider = new ethers.JsonRpcProvider(rpcUrl);

        contract = new ethers.Contract(contractAddress, ABI, rpcProvider);

        // Polling approach to fetch logs because some RPC providers (e.g. certain HTTP endpoints)
        // don't support eth_newFilter / eth_subscribe. We'll poll for new blocks and call getLogs.
        const iface = contract.interface;

  // We'll fetch all logs for the contract and parse them locally.
  // This avoids constructing topics (and avoids RPCs that don't support certain filter helpers).

        let lastBlock = await rpcProvider.getBlockNumber();
        // Start slightly earlier to avoid missing immediately-recent logs
        if (lastBlock > 10) lastBlock = lastBlock - 5;

        const POLL_MS = 8000; // slightly larger to reduce RPC pressure
        const MAX_BLOCK_CHUNK = 500; // max blocks per getLogs call
        const MAX_RETRIES = 5;

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const isRateLimitError = (err: any) => {
          const msg = String(err?.message || err?.toString?.() || "").toLowerCase();
          if (err?.code === -32005) return true; // specific blast error code seen
          if (/rate limit/.test(msg) || /too many requests/.test(msg)) return true;
          return false;
        };

        const id = setInterval(async () => {
          try {
            const toBlock = await rpcProvider!.getBlockNumber();
            if (toBlock <= lastBlock) return;

            // Process in chunks to avoid large getLogs requests that trigger rate limits
            let from = lastBlock + 1;
            while (from <= toBlock) {
              const end = Math.min(from + MAX_BLOCK_CHUNK - 1, toBlock);

              // Retry loop with exponential backoff on rate-limit errors
              let attempt = 0;
              let logs: Array<any> | null = null;
              let lastErr: any = null;
              while (attempt < MAX_RETRIES) {
                try {
                  logs = await rpcProvider!.getLogs({
                    address: contractAddress,
                    fromBlock: from,
                    toBlock: end,
                  });
                  break; // success
                } catch (err) {
                  lastErr = err;
                  if (isRateLimitError(err)) {
                    const delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
                    console.warn(`getLogs rate-limited, retrying in ${delay}ms (attempt ${attempt + 1})`);
                    await sleep(delay);
                    attempt++;
                    continue;
                  } else {
                    // non-rate-limit error -> rethrow
                    throw err;
                  }
                }
              }

              if (logs === null) {
                // all retries failed; log and abort this poll cycle to avoid skipping
                console.warn("getLogs failed after retries", lastErr);
                return;
              }

              for (const log of logs) {
                try {
                  const parsed = iface.parseLog(log as any);
                  if (!parsed) continue;
                  if (parsed.name !== "PlayResult") continue;
                  const args = parsed.args as any;
                  const evtPlayer = ethers.getAddress(String(args[1] || "0x0"));
                  const wantPlayer = ethers.getAddress(playerAddress);
                  if (evtPlayer !== wantPlayer) continue;

                  const out: PlayResult = {
                    requestId: args[0]?.toString?.() ?? String(args[0]),
                    player: args[1],
                    a: Number(args[2]),
                    b: Number(args[3]),
                    c: Number(args[4]),
                    ticketRate: Number(args[5]),
                    payoutWei: args[6]?.toString?.() ?? String(args[6]),
                    jackpotPayout: args[7]?.toString?.() ?? String(args[7]),
                  };
                  if (mounted) setResult(out);
                } catch (e) {
                  console.error("Failed to parse log", e, log);
                }
              }

              // advance to next chunk only after processing
              from = end + 1;
            }

            // update lastBlock to highest scanned block
            lastBlock = toBlock;
          } catch (e) {
            // ignore transient errors but log
            console.warn("Polling logs error", e);
          }
        }, POLL_MS);

        // store id on contract for cleanup
        (contract as any).__pollId = id;
      } catch (err) {
        console.error("usePlayResult setup error", err);
      }
    };

    setup();

    return () => {
      mounted = false;
      try {
        if (contract) {
          contract.removeAllListeners();
        }
      } catch (e) {
        // ignore
      }
    };
  }, [playerAddress]);

  return result;
};
