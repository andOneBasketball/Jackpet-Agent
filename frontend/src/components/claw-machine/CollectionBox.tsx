"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import foxImg from "@/assets/jackpet_fox_strategy.png";
import wolfImg from "@/assets/jackpet_wolf_fortune.png";
import frogImg from "@/assets/jackpet_frog_luck.png";

export interface CollectedPet {
  id: number;
  type: "FOX" | "WOLF" | "FROG";
}

interface CollectionBoxProps {
  collected: CollectedPet[];
  isAnimating: boolean;
}

const petImages = {
  FOX: foxImg,
  WOLF: wolfImg,
  FROG: frogImg,
};

const petColors = {
  FOX: "border-yellow-400 bg-yellow-400/20",
  WOLF: "border-orange-400 bg-orange-400/20",
  FROG: "border-green-400 bg-green-400/20",
};

export default function CollectionBox({ collected }: CollectionBoxProps) {
  // Count each pet type
  const counts = {
    FOX: collected.filter((p) => p.type === "FOX").length,
    WOLF: collected.filter((p) => p.type === "WOLF").length,
    FROG: collected.filter((p) => p.type === "FROG").length,
  };

  return (
    <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-xl p-3 border-4 border-gray-600 shadow-2xl">
      {/* Title and collection grid side by side */}
      <div className="flex items-center gap-3">
        <span className="text-white font-bold text-sm whitespace-nowrap">
          Collected: {collected.length}/12
        </span>

        {/* Collection grid - single row */}
        <div className="flex gap-1 flex-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded border-2 flex items-center justify-center transition-all duration-300 ${
                collected[i]
                  ? petColors[collected[i].type]
                  : "border-gray-600 bg-gray-700/50"
              }`}
            >
              <AnimatePresence mode="wait">
                {collected[i] && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  >
                    <Image
                      src={petImages[collected[i].type]}
                      alt={collected[i].type}
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Stat bars - horizontal layout */}
      <div className="flex gap-3 mt-2">
        <StatBar label="FOX" count={counts.FOX} color="bg-yellow-400" icon={foxImg} />
        <StatBar label="WOLF" count={counts.WOLF} color="bg-orange-400" icon={wolfImg} />
        <StatBar label="FROG" count={counts.FROG} color="bg-green-400" icon={frogImg} />
      </div>
    </div>
  );
}

function StatBar({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: typeof foxImg;
}) {
  return (
    <div className="flex items-center gap-1 flex-1">
      <Image src={icon} alt={label} width={16} height={16} />
      <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${(count / 8) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-white font-mono text-xs w-4 text-right">{count}</span>
    </div>
  );
}
