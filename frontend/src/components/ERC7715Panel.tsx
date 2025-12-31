"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionAccount } from "@/providers/SessionAccountProvider";
import type { AuthSettings } from "@/hooks/useERC7715";

// Props interface - receives all ERC7715 state from parent
interface ERC7715PanelProps {
  onAutoPlay: (session: any) => Promise<void>;
  isPlaying: boolean;  // Game is in progress (polling for result)
  hasResult: boolean;  // Game result popup is showing (hide Quick Start until dismissed)
  // ERC7715 state from parent
  isAuthorized: boolean;
  isAuthorizing: boolean;
  permissionContext: any;
  remainingPlays: number;
  error: string | null;
  isAutoPlaying: boolean;
  supportStatus: "unknown" | "supported" | "unsupported" | "checking";
  // ERC7715 actions from parent
  requestPermission: (
    onAutoExecute?: (session: any) => Promise<void>,
    overrideSettings?: Partial<AuthSettings>
  ) => Promise<boolean>;
  revokePermission: () => void;
  clearError: () => void;
  getTimeRemaining: () => string;
}

export default function ERC7715Panel({
  onAutoPlay,
  isPlaying,
  hasResult,
  isAuthorized,
  isAuthorizing,
  permissionContext,
  remainingPlays,
  error,
  isAutoPlaying,
  supportStatus,
  requestPermission,
  revokePermission,
  clearError,
  getTimeRemaining,
}: ERC7715PanelProps) {
  const { sessionAccount, createSessionAccount, isLoading: isCreatingSession, error: sessionError } = useSessionAccount();

  const [isExpanded, setIsExpanded] = useState(false);

  // Quick preset configurations
  interface QuickPreset {
    name: string;
    duration: number;
    playCount: number;
  }

  // Two presets: Super Quick (5min × 2) and Quick Test (15min × 5)
  // No fixed interval - each game waits for previous result
  const quickPresets: QuickPreset[] = [
    { name: "⚡ Super Quick (5m × 2)", duration: 300, playCount: 2 },
    { name: "🚀 Quick Test (15m × 5)", duration: 900, playCount: 5 },
  ];

  // Handle quick preset selection with auto-execution
  const handleQuickPreset = async (preset: QuickPreset) => {
    clearError();

    // Request permission with auto-execution callback
    // Pass preset values directly to avoid async state issues
    await requestPermission(onAutoPlay, {
      duration: preset.duration,
      playCount: preset.playCount,
    });
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
          {isAutoPlaying && (
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full animate-pulse">
              Playing {remainingPlays} left
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

              {/* Session Account Creation Section */}
              {!sessionAccount && (
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-xs font-medium mb-2">Step 1: Create Session Account</p>
                    <p className="text-yellow-300 text-xs leading-relaxed mb-3">
                      A session account is needed to execute transactions with delegation. This creates a temporary account with a burner private key.
                    </p>
                    <button
                      onClick={createSessionAccount}
                      disabled={isCreatingSession}
                      className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {isCreatingSession ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Creating Session Account...
                        </span>
                      ) : (
                        "Create Session Account"
                      )}
                    </button>
                    {sessionError && (
                      <p className="text-red-400 text-xs mt-2">{sessionError}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Session Account Created - Show Info */}
              {sessionAccount && !isAuthorized && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
                  <p className="text-green-400 text-xs font-medium">✓ Session Account Created</p>
                  <p className="text-green-300 text-xs break-all font-mono text-[10px]">{sessionAccount.address}</p>
                </div>
              )}

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

              {/* Authorization settings - when session account exists, not authorized, not auto-playing, not polling, and no result showing */}
              {sessionAccount && !isAuthorized && !isAutoPlaying && !isPlaying && !hasResult && (
                <div className="space-y-3">
                  <h4 className="text-white text-sm font-medium">Quick Start</h4>

                  {/* Quick presets */}
                  <div className="grid grid-cols-2 gap-2">
                    {quickPresets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleQuickPreset(preset)}
                        disabled={isAuthorizing}
                        className="px-3 py-2 bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>

                  <p className="text-gray-500 text-xs">
                    Select a preset to authorize and start auto-play immediately.
                  </p>
                </div>
              )}

              {/* Auto-playing state (show when auto-play is running or game is polling for result) */}
              {(isAutoPlaying || isPlaying) && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Status:</span>
                      <span className="text-blue-400 text-xs font-medium animate-pulse">
                        {isPlaying ? "Waiting for result..." : "Auto-Playing..."}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Remaining Plays:</span>
                      <span className="text-white text-xs font-medium">{remainingPlays}</span>
                    </div>
                    {permissionContext && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">Expires:</span>
                        <span className="text-white text-xs">{getTimeRemaining()}</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Authorized but not auto-playing and not polling state */}
              {isAuthorized && permissionContext && !isAutoPlaying && !isPlaying && (
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
