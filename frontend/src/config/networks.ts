// Network-specific configuration: contract addresses and chain params
export const CONTRACT_ADDRESSES: Record<number, string> = {
  // BSC Testnet
  97: "0x567718fcdd5a7f880c55e50c5e7aff99d5ef9bf9",
  // add other networks here, e.g.:
  // 5: "0x...", // Goerli
};

// Preferred chain to switch to when current chain has no configured address
export const PREFERRED_CHAIN_ID = 97;

export function getContractAddress(chainId: number): string {
  return CONTRACT_ADDRESSES[chainId] ?? "";
}

export const CHAIN_PARAMS: Record<number, any> = {
  97: {
    chainId: "0x61",
    chainName: "BSC Testnet",
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrls: ["https://testnet.bscscan.com/"],
  },
};
