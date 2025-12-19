import { http } from "wagmi";
import { bscTestnet, bsc, arbitrumSepolia, arbitrum } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = "1d754801990f26f9cc67788d7aa55591";

const configConfig = {
  appName: "Three Color Pets",
  projectId,
  chains: [arbitrumSepolia, arbitrum, bscTestnet, bsc],
  transports: {
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
    [bsc.id]: http("https://bsc-dataseed1.binance.org"),
  },
  ssr: true,
} as const;

// Fix for "WalletConnect Core is already initialized" error in development
declare global {
  var wagmiConfig: ReturnType<typeof getDefaultConfig> | undefined;
}

export const config = (globalThis as any).wagmiConfig || getDefaultConfig(configConfig);

if (process.env.NODE_ENV !== "production") {
  (globalThis as any).wagmiConfig = config;
}
