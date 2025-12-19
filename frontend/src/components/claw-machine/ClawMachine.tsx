"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Claw from "./Claw";
import PetPool, { Pet } from "./PetPool";
import CollectionBox, { CollectedPet } from "./CollectionBox";

interface ClawMachineProps {
  onPlay: () => Promise<void>;
  result: { a: number; b: number; c: number } | null;
  isPlaying: boolean;
  ticketFee: string;
  jackpot: string;
}

type PetType = "FOX" | "WOLF" | "FROG";

// Generate initial pet pool (24 pets: 8 FOX, 8 WOLF, 8 FROG)
function generatePetPool(): Pet[] {
  const pets: Pet[] = [];
  const types: PetType[] = ["FOX", "WOLF", "FROG"];

  let id = 0;
  types.forEach((type) => {
    for (let i = 0; i < 8; i++) {
      pets.push({
        id: id++,
        type,
        x: 30 + Math.random() * 280,
        y: 20 + Math.random() * 100, // Adjusted for smaller pet pool area
      });
    }
  });

  // Shuffle randomly
  return pets.sort(() => Math.random() - 0.5);
}

export default function ClawMachine({
  onPlay,
  result,
  isPlaying,
  ticketFee,
  jackpot,
}: ClawMachineProps) {
  const [mounted, setMounted] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [collected, setCollected] = useState<CollectedPet[]>([]);
  const [clawX, setClawX] = useState(0);
  const [clawY, setClawY] = useState(0);
  const [mouseClawX, setMouseClawX] = useState(0);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabbingPetId, setGrabbingPetId] = useState<number | null>(null);
  const [gamePhase, setGamePhase] = useState<"idle" | "grabbing" | "result">("idle");
  const [showResult, setShowResult] = useState(false);
  const processedResultRef = useRef<{ a: number; b: number; c: number } | null>(null);
  const machineRef = useRef<HTMLDivElement>(null);

  // Initialize after client mount
  useEffect(() => {
    setMounted(true);
    setPets(generatePetPool());
  }, []);

  // Mouse move handler for claw tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (gamePhase !== "idle" || isPlaying) return;

    const rect = machineRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate relative position within the machine
    const relativeX = e.clientX - rect.left - rect.width / 2;
    // Clamp to machine bounds
    const clampedX = Math.max(-140, Math.min(140, relativeX));
    setMouseClawX(clampedX);
  }, [gamePhase, isPlaying]);

  // Click handler to start game
  const handleMachineClick = useCallback(() => {
    if (gamePhase === "idle" && !isPlaying) {
      handlePlay();
    }
  }, [gamePhase, isPlaying]);

  // When result arrives, run grab animation
  useEffect(() => {
    if (!result) {
      processedResultRef.current = null;
      return;
    }

    // Only process if this is a new result (different from last processed)
    const isNewResult =
      !processedResultRef.current ||
      processedResultRef.current.a !== result.a ||
      processedResultRef.current.b !== result.b ||
      processedResultRef.current.c !== result.c;

    if (isNewResult && gamePhase === "idle") {
      processedResultRef.current = { ...result };
      console.log("New result received, starting animation:", result);
      runGrabAnimation(result);
    }
  }, [result, gamePhase]);

  // Grab animation sequence
  const runGrabAnimation = async (result: { a: number; b: number; c: number }) => {
    setGamePhase("grabbing");
    setCollected([]);

    // Determine pets to grab based on result
    // a, b, c are sorted counts, we randomly assign colors
    const types: PetType[] = ["FOX", "WOLF", "FROG"];
    const shuffledTypes = [...types].sort(() => Math.random() - 0.5);
    const toGrab: PetType[] = [];

    for (let i = 0; i < result.a; i++) toGrab.push(shuffledTypes[0]);
    for (let i = 0; i < result.b; i++) toGrab.push(shuffledTypes[1]);
    for (let i = 0; i < result.c; i++) toGrab.push(shuffledTypes[2]);

    // Shuffle grab order
    toGrab.sort(() => Math.random() - 0.5);

    const availablePets = [...pets];
    const newCollected: CollectedPet[] = [];

    for (let i = 0; i < 12; i++) {
      const targetType = toGrab[i];
      const targetPetIndex = availablePets.findIndex((p) => p.type === targetType);
      if (targetPetIndex === -1) continue;

      const targetPet = availablePets[targetPetIndex];
      availablePets.splice(targetPetIndex, 1);

      // Move claw to target position (pet pool is 56px below claw origin)
      setClawX(targetPet.x - 150);
      setClawY(targetPet.y + 55);
      await sleep(400);

      // Grab
      setIsGrabbing(true);
      setGrabbingPetId(targetPet.id);
      await sleep(300);

      // Lift up
      setClawY(0);
      await sleep(300);

      // Move to collection box
      setClawX(200);
      await sleep(300);

      // Release
      setIsGrabbing(false);
      setGrabbingPetId(null);

      newCollected.push({ id: targetPet.id, type: targetPet.type });
      setCollected([...newCollected]);

      // Remove from pool
      setPets((prev) => prev.filter((p) => p.id !== targetPet.id));

      await sleep(200);
    }

    // Reset claw
    setClawX(0);
    setClawY(0);

    // Show result
    setGamePhase("result");
    setShowResult(true);
  };

  // Reset game (for UI only, doesn't clear result tracking)
  const resetGame = () => {
    setPets(generatePetPool());
    setCollected([]);
    setGamePhase("idle");
    setShowResult(false);
    // Don't clear processedResultRef here - it prevents re-triggering animation
    // It will be cleared when result becomes null (new game starts)
  };

  // Start game
  const handlePlay = async () => {
    if (gamePhase !== "idle") return;
    // Clear the ref before starting new game so new result will trigger animation
    processedResultRef.current = null;
    resetGame();
    await onPlay();
  };

  // Only 5-4-3 loses, all other combinations win
  const isWinner = result && !(result.a === 5 && result.b === 4 && result.c === 3);
  const payoutInfo = result ? getPayoutInfo(result.a, result.b, result.c) : null;

  // Determine actual claw X position - follows mouse when idle, follows animation when grabbing
  const actualClawX = gamePhase === "idle" && !isPlaying ? mouseClawX : clawX;
  const isAnimating = gamePhase === "grabbing";
  const isIdle = gamePhase === "idle" && !isPlaying;

  return (
    <div className="relative">
      {/* Claw machine body */}
      <div
        ref={machineRef}
        className="relative w-[380px] h-[400px] bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 rounded-2xl border-6 border-yellow-500 shadow-2xl overflow-hidden cursor-pointer"
        onMouseMove={handleMouseMove}
        onClick={handleMachineClick}
      >
        {/* Top decoration - contains title and jackpot info */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 flex items-center justify-between px-4 z-30">
          <motion.h2
            className="text-lg font-bold text-white drop-shadow-lg"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            JACKPET
          </motion.h2>
          <div className="flex items-center gap-3 text-xs">
            <div className="text-center">
              <span className="text-white/80">TICKET:</span>
              <span className="text-white font-bold ml-1">{ticketFee}</span>
            </div>
            <div className="text-center">
              <span className="text-white/80">JACKPOT:</span>
              <motion.span
                className="text-white font-bold ml-1"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {jackpot}
              </motion.span>
            </div>
          </div>
        </div>

        {/* Claw track */}
        <div className="absolute top-12 left-0 right-0 h-6 bg-gray-800 border-b-2 border-gray-600">
          <div className="h-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700" />
        </div>

        {/* Mechanical claw - positioned to hang from the track */}
        <div className="absolute top-14 left-0 right-0 h-[180px] z-10">
          <Claw x={actualClawX} y={clawY} isGrabbing={isGrabbing} isAnimating={isAnimating} isIdle={isIdle} />
        </div>

        {/* Pet pool area - positioned below the claw track */}
        <div className="absolute top-28 left-3 right-3 h-[160px] bg-gradient-to-b from-blue-900/50 to-purple-900/50 rounded-lg border-2 border-blue-400/30">
          <PetPool pets={pets} grabbingPetId={grabbingPetId} />
        </div>

        {/* Click to play hint */}
        {isIdle && (
          <motion.div
            className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="px-4 py-2 rounded-full border-2 border-yellow-400/60 backdrop-blur-sm"
              animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-yellow-300 font-bold text-sm drop-shadow-lg">Click to Play!</span>
            </motion.div>
          </motion.div>
        )}

        {/* Neon border effect */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none">
          <motion.div
            className="absolute inset-0 rounded-2xl border-4 border-yellow-400/50"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </div>
      </div>

      {/* Collection box */}
      <div className="mt-2">
        <CollectionBox collected={collected} isAnimating={gamePhase === "grabbing"} />
      </div>

      {/* Start button */}
      <motion.button
        onClick={handlePlay}
        disabled={gamePhase !== "idle" || isPlaying}
        className={`mt-2 w-full py-3 rounded-xl font-bold text-lg transition-all ${
          gamePhase === "idle" && !isPlaying
            ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-lg hover:shadow-xl"
            : "bg-gray-600 text-gray-400 cursor-not-allowed"
        }`}
        whileHover={gamePhase === "idle" ? { scale: 1.02 } : {}}
        whileTap={gamePhase === "idle" ? { scale: 0.98 } : {}}
      >
        {gamePhase === "idle" && !isPlaying && "GRAB 12 PETS"}
        {gamePhase === "grabbing" && "GRABBING..."}
        {isPlaying && gamePhase === "idle" && "WAITING FOR VRF..."}
        {gamePhase === "result" && "PLAY AGAIN"}
      </motion.button>

      {gamePhase === "result" && (
        <button
          onClick={resetGame}
          className="mt-1 w-full py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 text-sm"
        >
          Reset
        </button>
      )}

      {/* Result popup */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              className={`p-8 rounded-2xl ${
                isWinner
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                  : "bg-gradient-to-br from-gray-700 to-gray-800"
              } text-center shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ rotate: isWinner ? [0, -10, 10, 0] : 0 }}
                transition={{ repeat: isWinner ? Infinity : 0, duration: 0.5 }}
              >
                {isWinner ? "🎉" : "😢"}
              </motion.div>
              <h3 className={`text-3xl font-bold mb-2 ${isWinner ? "text-white" : "text-gray-300"}`}>
                {isWinner ? "YOU WON!" : "Try Again!"}
              </h3>
              <div className="text-lg text-white/80 mb-4">
                Result: {result.a} - {result.b} - {result.c}
              </div>
              {payoutInfo && (
                <div className="text-xl font-bold text-white">
                  <span className="text-2xl">{payoutInfo.multiplier}</span>
                  {payoutInfo.jackpotShare !== "0%" && (
                    <span className="ml-2 text-yellow-300">+{payoutInfo.jackpotShare} JP</span>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setShowResult(false);
                  resetGame();
                }}
                className="mt-4 px-6 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-bold"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PayoutInfo {
  multiplier: string;
  jackpotShare: string;
}

function getPayoutInfo(a: number, b: number, c: number): PayoutInfo | null {
  // Payout rules matching PayoutTable.tsx
  if (a === 8 && b === 4 && c === 0) return { multiplier: "11x", jackpotShare: "99%" };
  if (a === 8 && b === 3 && c === 1) return { multiplier: "6x", jackpotShare: "30%" };
  if (a === 8 && b === 2 && c === 2) return { multiplier: "6x", jackpotShare: "30%" };
  if (a === 7 && b === 5 && c === 0) return { multiplier: "6x", jackpotShare: "30%" };
  if (a === 6 && b === 6 && c === 0) return { multiplier: "6x", jackpotShare: "30%" };
  if (a === 7 && b === 4 && c === 1) return { multiplier: "4x", jackpotShare: "10%" };
  if (a === 6 && b === 5 && c === 1) return { multiplier: "2x", jackpotShare: "10%" };
  if (a === 7 && b === 3 && c === 2) return { multiplier: "2x", jackpotShare: "10%" };
  if (a === 6 && b === 3 && c === 3) return { multiplier: "1.2x", jackpotShare: "0%" };
  if (a === 5 && b === 5 && c === 2) return { multiplier: "1.2x", jackpotShare: "0%" };
  if (a === 6 && b === 4 && c === 2) return { multiplier: "1.1x", jackpotShare: "0%" };
  if (a === 4 && b === 4 && c === 4) return { multiplier: "1.1x", jackpotShare: "0%" };
  // 5-4-3 is the only losing combination
  return null;
}
