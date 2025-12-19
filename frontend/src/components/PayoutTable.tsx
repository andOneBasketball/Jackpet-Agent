"use client";

import { motion } from "framer-motion";

interface PayoutRule {
  pattern: string;
  multiplier: string;
  jackpotShare: string;
  tier: "jackpot" | "big" | "medium" | "small";
}

const winningRules: PayoutRule[] = [
  { pattern: "8-4-0", multiplier: "11x", jackpotShare: "99%", tier: "jackpot" },
  { pattern: "8-3-1", multiplier: "6x", jackpotShare: "30%", tier: "big" },
  { pattern: "8-2-2", multiplier: "6x", jackpotShare: "30%", tier: "big" },
  { pattern: "7-5-0", multiplier: "6x", jackpotShare: "30%", tier: "big" },
  { pattern: "6-6-0", multiplier: "6x", jackpotShare: "30%", tier: "big" },
  { pattern: "7-4-1", multiplier: "4x", jackpotShare: "10%", tier: "medium" },
  { pattern: "6-5-1", multiplier: "2x", jackpotShare: "10%", tier: "medium" },
  { pattern: "7-3-2", multiplier: "2x", jackpotShare: "10%", tier: "medium" },
  { pattern: "6-3-3", multiplier: "1.2x", jackpotShare: "0%", tier: "small" },
  { pattern: "5-5-2", multiplier: "1.2x", jackpotShare: "0%", tier: "small" },
  { pattern: "6-4-2", multiplier: "1.1x", jackpotShare: "0%", tier: "small" },
  { pattern: "4-4-4", multiplier: "1.1x", jackpotShare: "0%", tier: "small" },
];

const tierStyles = {
  jackpot: {
    bg: "bg-gradient-to-r from-yellow-500/40 via-amber-400/40 to-yellow-500/40",
    border: "border-2 border-yellow-400",
    pattern: "text-yellow-300 font-extrabold",
    multiplier: "text-yellow-200 font-black drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]",
    jp: "bg-yellow-500/50 text-yellow-100 font-bold",
    glow: true,
  },
  big: {
    bg: "bg-gradient-to-r from-orange-600/30 to-red-600/30",
    border: "border border-orange-500/70",
    pattern: "text-orange-300 font-bold",
    multiplier: "text-orange-200 font-bold",
    jp: "bg-purple-600/50 text-purple-200",
    glow: false,
  },
  medium: {
    bg: "bg-gradient-to-r from-purple-600/25 to-pink-600/25",
    border: "border border-purple-500/50",
    pattern: "text-purple-300 font-semibold",
    multiplier: "text-purple-200 font-semibold",
    jp: "bg-purple-600/50 text-purple-200",
    glow: false,
  },
  small: {
    bg: "bg-gray-700/40",
    border: "border border-gray-600/50",
    pattern: "text-gray-300 font-medium",
    multiplier: "text-green-400 font-medium",
    jp: "",
    glow: false,
  },
};

export default function PayoutTable() {
  return (
    <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700 w-[420px]">
      <h3 className="text-xl font-bold text-white mb-3 text-center">Payout Rules</h3>

      {/* Prominent win rate hint */}
      <div className="mb-4 p-3 bg-gradient-to-r from-green-900/50 to-emerald-900/50 rounded-lg border border-green-600/50">
        <p className="text-center text-green-300 font-bold">
          12 out of 13 combinations WIN!
        </p>
        <p className="text-center text-green-400/80 text-sm">
          Only 5-4-3 loses your ticket
        </p>
      </div>

      {/* Winning combinations - 3 column layout */}
      <div className="grid grid-cols-3 gap-2">
        {winningRules.map((rule, index) => {
          const style = tierStyles[rule.tier];
          return (
            <motion.div
              key={rule.pattern}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
              className={`relative flex items-center justify-between px-2 py-1.5 rounded-lg ${style.bg} ${style.border} ${
                style.glow ? "shadow-[0_0_15px_rgba(251,191,36,0.4)]" : ""
              }`}
            >
              {/* Jackpot blinking effect */}
              {style.glow && (
                <motion.div
                  className="absolute inset-0 rounded-lg bg-yellow-400/20"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              <span className={`font-mono text-sm ${style.pattern} relative z-10 shrink-0`}>
                {rule.pattern}
              </span>
              <div className="flex items-center gap-1 relative z-10 shrink-0">
                <span className={`text-sm ${style.multiplier}`}>{rule.multiplier}</span>
                {rule.jackpotShare !== "0%" && (
                  <span className={`text-[9px] px-1 py-0.5 rounded ${style.jp}`}>
                    +{rule.jackpotShare}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* The only losing combination */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-red-900/20 border border-red-700/30"
        >
          <span className="font-mono text-gray-500 text-sm">5-4-3</span>
          <span className="text-red-400/60 text-sm">0x</span>
        </motion.div>
      </div>

      <div className="mt-3 p-2 bg-gray-700/50 rounded text-xs text-gray-400 text-center">
        Draw 12 pets from 24 (8 per color). Pattern shows sorted color counts.
      </div>
    </div>
  );
}
