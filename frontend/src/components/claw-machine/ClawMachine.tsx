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
  contractBalance: string;
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
        x: 25 + Math.random() * 390,
        y: 15 + Math.random() * 190,
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
  contractBalance,
}: ClawMachineProps) {
  const [mounted, setMounted] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [collected, setCollected] = useState<CollectedPet[]>([]);
  const [clawX, setClawX] = useState(0);
  const [clawY, setClawY] = useState(0);
  const [mouseClawX, setMouseClawX] = useState(0);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabbingPetId, setGrabbingPetId] = useState<number | null>(null);
  const [showGrabEffect, setShowGrabEffect] = useState(false);
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
    const clampedX = Math.max(-200, Math.min(200, relativeX));
    setMouseClawX(clampedX);
  }, [gamePhase, isPlaying]);

  // Start game - don't regenerate pets here to avoid sudden position change
  const handlePlay = useCallback(async () => {
    if (gamePhase !== "idle") return;
    // Clear the ref before starting new game so new result will trigger animation
    processedResultRef.current = null;
    setCollected([]);
    setShowResult(false);
    await onPlay();
  }, [gamePhase, onPlay]);

  // Click handler to start game - claw grabs first then starts
  const handleMachineClick = useCallback(async () => {
    if (gamePhase === "idle" && !isPlaying) {
      // Show grab animation first
      setIsGrabbing(true);
      await sleep(300);
      setIsGrabbing(false);
      // Then start game
      await handlePlay();
    }
  }, [gamePhase, isPlaying, handlePlay]);

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

    // Wait for pets to stop random movement and return to original position (important for coordinate alignment)
    await sleep(400);

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

    // Use current pets state for accurate position tracking
    const currentPets = [...pets];
    const newCollected: CollectedPet[] = [];

    // Coordinate calculation:
    // Machine width: 480px, center: 240px
    // Pet pool: left-3(12px) + border-2(2px) = 14px offset
    // Pet size: 40px (w-10 h-10), half = 20px
    //
    // Y Layout analysis:
    // - Claw container starts at top-14 (56px)
    // - IMPORTANT: Claw movement is 2x the y value!
    //   Parent moves y pixels + cable extends y pixels = 2y total movement
    // - When y=0, claw tip is at ~157px (56 + 16 cable + 85 claw body)
    // - Pet pool starts at 122px (120px + 2px border)
    // - Pet center Y = 122 + pet.y + 20
    // - To reach pet: 157 + 2*y = 122 + pet.y + 20
    // - Solving: y = (pet.y - 15) / 2
    const machineCenter = 240;
    const petPoolLeftOffset = 14; // left-3 (12px) + border-2 (2px)
    const petHalfSize = 20;

    for (let i = 0; i < 12; i++) {
      const targetType = toGrab[i];
      const targetPetIndex = currentPets.findIndex((p) => p.type === targetType);
      if (targetPetIndex === -1) continue;

      const targetPet = currentPets[targetPetIndex];
      currentPets.splice(targetPetIndex, 1);

      // Calculate claw position to match pet center
      // Pet center X (relative to machine) = petPoolLeftOffset + pet.x + petHalfSize
      // Claw X is relative to machine center, so subtract machineCenter
      const clawTargetX = targetPet.x + petPoolLeftOffset + petHalfSize - machineCenter;

      // Y position: y = (pet.y - 15) / 2 (divided by 2 because claw moves 2x the y value)
      // Use Math.max to ensure y doesn't go negative
      const clawTargetY = Math.max(0, (targetPet.y - 15) / 2);

      // Move claw horizontally first
      setClawX(clawTargetX);
      await sleep(300);

      // Descend to pet position
      setClawY(clawTargetY);
      await sleep(400);

      // Show grabbing action - stay at pet position
      setIsGrabbing(true);
      setGrabbingPetId(targetPet.id);
      setShowGrabEffect(true);

      // Extended hold time for user to see the grabbing action
      await sleep(800);

      // Hide effect text but keep grabbing state
      setShowGrabEffect(false);

      // Lift up with pet
      setClawY(0);
      await sleep(400);

      // Move to collection box (right side)
      setClawX(260);
      await sleep(350);

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
  const resetGame = useCallback(() => {
    setPets(generatePetPool());
    setCollected([]);
    setGamePhase("idle");
    setShowResult(false);
  }, []);

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
        className="relative w-[480px] h-[380px] bg-gradient-to-b from-purple-900 via-purple-800 to-purple-900 rounded-2xl border-6 border-yellow-500 shadow-2xl overflow-hidden cursor-pointer"
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
              <span className="text-white/80">BALANCE:</span>
              <span className="text-white font-bold ml-1">{contractBalance}</span>
            </div>
            <div className="text-center">
              <span className="text-white/80">JACKPOOL:</span>
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
        {/* Container height covers entire pet pool area: from top-14(56px) to bottom-3(368px), needs 312px */}
        <div className="absolute top-14 left-0 right-0 h-[320px] z-10">
          <Claw x={actualClawX} y={clawY} isGrabbing={isGrabbing} isAnimating={isAnimating} isIdle={isIdle} showGrabEffect={showGrabEffect} />
        </div>

        {/* Upper empty area - visible space between claw and pet pool */}
        <div className="absolute top-[72px] left-3 right-3 h-[50px] bg-gradient-to-b from-purple-900/80 to-transparent rounded-t-lg" />

        {/* Pet pool area - positioned below the upper space */}
        <div className="absolute top-[120px] left-3 right-3 bottom-3 bg-gradient-to-b from-blue-900/50 to-purple-900/50 rounded-lg border-2 border-blue-400/30">
          <PetPool pets={pets} grabbingPetId={grabbingPetId} isAnimating={isAnimating} />
        </div>

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
        className={`mt-2 w-full py-3 rounded-xl font-bold text-lg transition-all ${gamePhase === "idle" && !isPlaying
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
              className={`p-8 rounded-2xl ${isWinner
                ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                : "bg-gradient-to-br from-gray-700 to-gray-800"
                } text-center shadow-2xl max-w-sm`}
              onClick={(e) => e.stopPropagation()}
            >
              {isWinner ? (
                <>
                  {/* Win animation effect */}
                  <motion.div
                    className="text-6xl mb-2"
                    animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  >
                    🎉
                  </motion.div>
                  <motion.h3
                    className="text-3xl font-bold text-white mb-1"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Congratulations!
                  </motion.h3>
                  <motion.p
                    className="text-xl text-white/90 mb-3"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    You&apos;re a Winner! 🏆
                  </motion.p>
                </>
              ) : (
                <>
                  {/* Lose animation effect */}
                  <motion.div
                    className="text-6xl mb-2"
                    animate={{ y: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    😢
                  </motion.div>
                  <motion.h3
                    className="text-2xl font-bold text-gray-300 mb-1"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    So Close!
                  </motion.h3>
                  <motion.p
                    className="text-lg text-gray-400 mb-3"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    Better Luck Next Time
                  </motion.p>
                </>
              )}
              <div className="text-lg text-white/80 mb-4">
                Result: {result.a} - {result.b} - {result.c}
              </div>
              {payoutInfo && (
                <motion.div
                  className="text-xl font-bold text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring" }}
                >
                  <span className="text-2xl">{payoutInfo.multiplier}</span>
                  {payoutInfo.jackpotShare !== "0%" && (
                    <span className="ml-2 text-yellow-300">+{payoutInfo.jackpotShare} JP</span>
                  )}
                </motion.div>
              )}
              <motion.button
                onClick={() => {
                  setShowResult(false);
                  resetGame();
                }}
                className={`mt-4 px-6 py-2 rounded-lg font-bold ${isWinner
                  ? "bg-white/20 hover:bg-white/30 text-white"
                  : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isWinner ? "Claim & Continue" : "Try Again"}
              </motion.button>
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
