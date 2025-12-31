"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { ClawMachine } from "@/components/claw-machine";
import PayoutTable from "@/components/PayoutTable";
import ERC7715Panel from "@/components/ERC7715Panel";
import { useJackpet } from "@/hooks/useJackpet";
import { useERC7715 } from "@/hooks/useERC7715";

// Custom ConnectButton to force display chain info
function CustomConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-colors"
                  >
                    Connect Wallet
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  {/* Chain info button */}
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    {chain.hasIcon && (
                      <div
                        className="w-5 h-5 rounded-full overflow-hidden"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? "Chain icon"}
                            src={chain.iconUrl}
                            className="w-5 h-5"
                          />
                        )}
                      </div>
                    )}
                    <span className="text-white text-sm font-medium">
                      {chain.name}
                    </span>
                  </button>

                  {/* Account info button */}
                  <button
                    onClick={openAccountModal}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    <span className="text-white text-sm">
                      {account.displayBalance && `${account.displayBalance} | `}
                      {account.displayName}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isConnected } = useAccount();
  const {
    ticketFee,
    jackpotPool,
    contractBalance,
    isPlaying,
    result,
    play,
    playDemo,
    resetResult,
  } = useJackpet();

  // ✅ Get ALL ERC7715 state from single hook instance (shared between page and ERC7715Panel)
  const erc7715 = useERC7715();
  const {
    isAutoPlaying,
    triggerNextGame,
    isAuthorized,
    isAuthorizing,
    permissionContext,
    remainingPlays,
    error,
    supportStatus,
    requestPermission,
    revokePermission,
    clearError,
    getTimeRemaining,
  } = erc7715;

  useEffect(() => {
    setMounted(true);
  }, []);

  const showConnectedView = mounted && isConnected;

  return (
    <div className="h-screen flex flex-col p-4 overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col max-w-7xl mx-auto w-full">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-4"
        >
          <div className="flex items-center gap-2">
            <motion.div
              className="text-3xl"
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <span role="img" aria-label="game">&#x1F3AE;</span>
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-white">Jackpet</h1>
              <p className="text-xs text-gray-400">Chainlink VRF Powered Lottery</p>
            </div>
          </div>

          {mounted && <CustomConnectButton />}
        </motion.header>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 items-start">
          {/* Left: Payout Table */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-shrink-0"
          >
            <PayoutTable />
          </motion.div>

          {/* Center: Claw Machine */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-1 flex justify-center"
          >
            {!showConnectedView ? (
              <div className="text-center py-10">
                <motion.div
                  className="text-6xl mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <span role="img" aria-label="slot">&#x1F3B0;</span>
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-3">
                  Connect Your Wallet to Play
                </h2>
                <p className="text-gray-400 mb-4 text-sm">
                  Experience the thrill of the claw machine lottery!
                </p>
                {mounted && <CustomConnectButton />}

                {/* Demo Mode */}
                <div className="mt-6">
                  <p className="text-xs text-gray-500 mb-2">Or try demo mode:</p>
                  <button
                    onClick={playDemo}
                    disabled={isPlaying}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                  >
                    {isPlaying ? "Playing..." : "Play Demo"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                {/* Left: Claw Machine */}
                <ClawMachine
                  onPlay={() => play()}
                  result={result ? { a: result.a, b: result.b, c: result.c } : null}
                  isPlaying={isPlaying}
                  ticketFee={ticketFee}
                  jackpot={jackpotPool}
                  contractBalance={contractBalance}
                  isAutoPlaying={isAutoPlaying}
                  onResultDismissed={() => {
                    resetResult();
                    triggerNextGame();
                  }}
                />
                {/* Right: ERC-7715 Auto-Play Panel */}
                <div className="w-[280px] flex-shrink-0">
                  <ERC7715Panel
                    onAutoPlay={(session) => play(100, session, true)}
                    isPlaying={isPlaying}
                    hasResult={result !== null}
                    isAuthorized={isAuthorized}
                    isAuthorizing={isAuthorizing}
                    permissionContext={permissionContext}
                    remainingPlays={remainingPlays}
                    error={error}
                    isAutoPlaying={isAutoPlaying}
                    supportStatus={supportStatus}
                    requestPermission={requestPermission}
                    revokePermission={revokePermission}
                    clearError={clearError}
                    getTimeRemaining={getTimeRemaining}
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-2 text-center text-gray-500 text-xs"
        >
          <p>Powered by Chainlink VRF | Play responsibly. 18+ only.</p>
        </motion.footer>
      </div>
    </div>
  );
}
