"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { useState } from "react";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [showMenu, setShowMenu] = useState(false);

  const isWrongNetwork = isConnected && chainId !== bscTestnet.id;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => {
            // If only one connector, connect directly
            if (connectors.length === 1) {
              connect({ connector: connectors[0] });
            } else {
              setShowMenu(!showMenu);
            }
          }}
          disabled={isPending}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all disabled:opacity-50"
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>

        {showMenu && connectors.length > 1 && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => {
                    connect({ connector });
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors"
                >
                  {connector.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Wrong network state
  if (isWrongNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: bscTestnet.id })}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all"
      >
        Switch to BSC Testnet
      </button>
    );
  }

  // Connected state
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-4 py-2 bg-gray-800 border border-gray-600 hover:border-gray-500 text-white rounded-lg transition-all flex items-center gap-2"
      >
        <span className="w-2 h-2 bg-green-500 rounded-full" />
        {formatAddress(address!)}
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700">
              BSC Testnet
            </div>
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
