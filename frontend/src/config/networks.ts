// Network-specific configuration: contract addresses and chain params
export const CONTRACT_ADDRESSES: Record<number, string> = {
  // BSC Testnet
  97: "0x567718fcdd5a7f880c55e50c5e7aff99d5ef9bf9",
  // Sepolia
  11155111: "0x95Af6c253E53fC8Ccb7D23911fEb291d22135F3B",
  // add other networks here, e.g.:
  // 5: "0x...", // Goerli
};

// Preferred chain to switch to when current chain has no configured address
export const PREFERRED_CHAIN_ID = 11155111;

export function getContractAddress(chainId: number): string {
  return CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[PREFERRED_CHAIN_ID] ?? "";
}

export const CHAIN_PARAMS: Record<number, any> = {
  97: {
    chainId: "0x61",
    chainName: "BSC Testnet",
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    blockExplorerUrls: ["https://testnet.bscscan.com/"],
  },
  11155111: {
    chainId: "0xaa36a7",
    chainName: "Sepolia",
    rpcUrls: ["https://api.zan.top/eth-sepolia"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    blockExplorerUrls: ["https://sepolia.etherscan.io/"],
  },
};
