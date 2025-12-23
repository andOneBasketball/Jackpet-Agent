"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useERC7715 } from "@/hooks/useERC7715";

interface ERC7715PanelProps {
  onAutoPlay: () => Promise<void>;
  isPlaying: boolean;
}

export default function ERC7715Panel({ onAutoPlay, isPlaying }: ERC7715PanelProps) {
  const {
    isAuthorized,
    isAuthorizing,
    permissionContext,
    authSettings,
    remainingPlays,
    error,
    isAutoPlaying,
    autoPlayInterval,
    supportStatus,
    requestPermission,
    revokePermission,
    startAutoPlay,
    stopAutoPlay,
    updateAuthSettings,
    setAutoPlayInterval,
    clearError,
    getTimeRemaining,
  } = useERC7715();

  const [isExpanded, setIsExpanded] = useState(false);

  // Handle authorize button click
  const handleAuthorize = async () => {
    clearError();
    await requestPermission();
  };

  // Handle auto-play toggle
  const handleAutoPlayToggle = () => {
    if (isAutoPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay(onAutoPlay);
    }
  };

  // Check if authorize button should be disabled
  const isAuthorizeDisabled = isAuthorizing || supportStatus === "unsupported";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-purple-900/80 to-blue-900/80 rounded-xl border border-purple-500/30 overflow-hidden"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F916;</span>
          <span className="font-semibold text-white text-sm">ERC-7715 Auto-Play</span>
          {isAuthorized && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              Active
            </span>
          )}
          {supportStatus === "unsupported" && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
              Unsupported
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="text-gray-400"
        >
          &#x25BC;
        </motion.span>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Info banner about ERC-7715 */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-300 text-xs leading-relaxed">
                  ERC-7715 enables permission-based auto-play. Requires{" "}
                  <a
                    href="https://metamask.io/flask/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-200"
                  >
                    MetaMask Flask
                  </a>{" "}
                  with{" "}
                  <a
                    href="https://metamask.io/developer/delegation-toolkit"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-200"
                  >
                    Delegation Toolkit Snaps
                  </a>
                  .
                </p>
              </div>

              {/* Error display */}
              {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-red-400 text-xs flex-1">{error}</p>
                    <button
                      onClick={clearError}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      &#x2715;
                    </button>
                  </div>
                </div>
              )}

              {/* Unsupported wallet warning */}
              {supportStatus === "unsupported" && !error && (
                <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-xs">
                    Your wallet does not support ERC-7715. Please install MetaMask Flask and the Delegation Toolkit Snaps to use this feature.
                  </p>
                </div>
              )}

              {/* Authorization settings (when not authorized) */}
              {!isAuthorized && (
                <div className="space-y-3">
                  <h4 className="text-white text-sm font-medium">Authorization Settings</h4>

                  {/* Duration */}
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">Duration:</label>
                    <select
                      value={authSettings.duration}
                      onChange={(e) => updateAuthSettings({ duration: Number(e.target.value) })}
                      className="px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-700"
                    >
                      <option value={1}>1 Hour</option>
                      <option value={6}>6 Hours</option>
                      <option value={12}>12 Hours</option>
                      <option value={24}>24 Hours</option>
                      <option value={72}>3 Days</option>
                      <option value={168}>7 Days</option>
                    </select>
                  </div>

                  {/* Play count */}
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">Max Plays:</label>
                    <select
                      value={authSettings.playCount}
                      onChange={(e) => updateAuthSettings({ playCount: Number(e.target.value) })}
                      className="px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-700"
                    >
                      <option value={5}>5 times</option>
                      <option value={10}>10 times</option>
                      <option value={20}>20 times</option>
                      <option value={50}>50 times</option>
                      <option value={100}>100 times</option>
                    </select>
                  </div>

                  {/* ETH limit */}
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">ETH Limit:</label>
                    <select
                      value={authSettings.ethAmount}
                      onChange={(e) => updateAuthSettings({ ethAmount: Number(e.target.value) })}
                      className="px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-700"
                    >
                      <option value={0.05}>0.05 ETH</option>
                      <option value={0.1}>0.1 ETH</option>
                      <option value={0.5}>0.5 ETH</option>
                      <option value={1}>1 ETH</option>
                      <option value={5}>5 ETH</option>
                    </select>
                  </div>

                  <p className="text-gray-500 text-xs">
                    Authorize up to {authSettings.playCount} plays within {authSettings.duration} hours,
                    spending max {authSettings.ethAmount} ETH.
                  </p>

                  <button
                    onClick={handleAuthorize}
                    disabled={isAuthorizeDisabled}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {isAuthorizing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">&#x23F3;</span>
                        Authorizing...
                      </span>
                    ) : (
                      "Request Permission"
                    )}
                  </button>
                </div>
              )}

              {/* Authorized state */}
              {isAuthorized && permissionContext && (
                <div className="space-y-3">
                  {/* Status info */}
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Status:</span>
                      <span className="text-green-400 text-xs font-medium">&#x2713; Authorized</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Remaining Plays:</span>
                      <span className="text-white text-xs font-medium">{remainingPlays}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Expires:</span>
                      <span className="text-white text-xs">{getTimeRemaining()}</span>
                    </div>
                  </div>

                  {/* Auto-play interval */}
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">Play Interval:</label>
                    <select
                      value={autoPlayInterval}
                      onChange={(e) => setAutoPlayInterval(Number(e.target.value))}
                      disabled={isAutoPlaying}
                      className="px-2 py-1 bg-gray-800 text-white text-xs rounded border border-gray-700 disabled:opacity-50"
                    >
                      <option value={3000}>3 seconds</option>
                      <option value={5000}>5 seconds</option>
                      <option value={10000}>10 seconds</option>
                      <option value={30000}>30 seconds</option>
                      <option value={60000}>1 minute</option>
                    </select>
                  </div>

                  {/* Auto-play toggle */}
                  <button
                    onClick={handleAutoPlayToggle}
                    disabled={isPlaying || remainingPlays <= 0}
                    className={`w-full py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                      isAutoPlaying
                        ? "bg-red-600 hover:bg-red-500"
                        : "bg-green-600 hover:bg-green-500"
                    } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                  >
                    {isAutoPlaying ? (
                      <>&#x23F9; Stop Auto-Play</>
                    ) : (
                      <>&#x25B6; Start Auto-Play</>
                    )}
                  </button>

                  {/* Revoke button */}
                  <button
                    onClick={revokePermission}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    Revoke Authorization
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
