export const CONTRACT_ADDRESSES = {
  421614: "0x1C827C89dF5490A4F58C0512fc476Acfd0ecDeB7",
  11155111: "0xa664B175c5867b4FCEDC4d1E31DC8E1eC0D61E19",
  //42161: "0x59E58F99ee4F93D0ea5f184aE1df896ddf50318A",
  //97: "0x567718FcDd5a7F880C55e50C5e7afF99d5Ef9BF9",
  //56: "0x59E58F99ee4F93D0ea5f184aE1df896ddf50318A",
} as const satisfies Record<number, `0x${string}`>;

export const CONTRACT_ADDRESS = CONTRACT_ADDRESSES[11155111];

export function getContractAddress(chainId?: number | string): `0x${string}` {
  if (chainId == null) return CONTRACT_ADDRESS;
  const id = typeof chainId === "string" ? Number(chainId) : chainId;
  if (Number.isNaN(id)) return CONTRACT_ADDRESS;
  return (CONTRACT_ADDRESSES as Record<number, `0x${string}`>)[id] ?? CONTRACT_ADDRESS;
}

export const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "uint32", name: "ticketRate", type: "uint32" }],
    name: "play",
    outputs: [{ internalType: "uint256", name: "requestId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "ticketFeeWei",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "jackpotPool",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "maxTicketRate",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "requestId", type: "uint256" },
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint8", name: "a", type: "uint8" },
      { indexed: false, internalType: "uint8", name: "b", type: "uint8" },
      { indexed: false, internalType: "uint8", name: "c", type: "uint8" },
      { indexed: false, internalType: "uint32", name: "ticketRate", type: "uint32" },
      { indexed: false, internalType: "uint256", name: "payoutWei", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "jackpotPayout", type: "uint256" },
    ],
    name: "PlayResult",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "requestId", type: "uint256" },
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "paid", type: "uint256" },
    ],
    name: "PlayRequested",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "requestId", type: "uint256" }],
    name: "getOutcome",
    outputs: [
      { internalType: "bool", name: "settled", type: "bool" },
      { internalType: "address", name: "player", type: "address" },
      { internalType: "uint8", name: "a", type: "uint8" },
      { internalType: "uint8", name: "b", type: "uint8" },
      { internalType: "uint8", name: "c", type: "uint8" },
      { internalType: "uint32", name: "ticketRate", type: "uint32" },
      { internalType: "uint256", name: "payoutWei", type: "uint256" },
      { internalType: "uint256", name: "jackpotPayout", type: "uint256" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
