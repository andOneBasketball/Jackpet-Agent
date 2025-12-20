"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import foxImg from "@/assets/jackpet_fox_strategy.png";
import wolfImg from "@/assets/jackpet_wolf_fortune.png";
import frogImg from "@/assets/jackpet_frog_luck.png";

export interface Pet {
  id: number;
  type: "FOX" | "WOLF" | "FROG";
  x: number;
  y: number;
}

interface PetPoolProps {
  pets: Pet[];
  grabbingPetId: number | null;
  isAnimating?: boolean; // When true, disable random movement so claw can accurately grab
}

const petImages = {
  FOX: foxImg,
  WOLF: wolfImg,
  FROG: frogImg,
};

const petColors = {
  FOX: "from-yellow-400 to-orange-500",
  WOLF: "from-orange-400 to-red-500",
  FROG: "from-green-400 to-emerald-600",
};

// Generate random movement path
function generateRandomPath(seed: number) {
  const points = [];
  const numPoints = 4 + (seed % 3);
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: (Math.sin(seed * 0.1 + i * 1.5) * 15) + (Math.cos(seed * 0.2 + i) * 10),
      y: (Math.cos(seed * 0.15 + i * 1.2) * 12) + (Math.sin(seed * 0.25 + i) * 8),
    });
  }
  return points;
}

export default function PetPool({ pets, grabbingPetId, isAnimating = false }: PetPoolProps) {
  const [hoveredPetId, setHoveredPetId] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Periodically update movement target - pause during grab animation
  useEffect(() => {
    if (!mounted || isAnimating) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [mounted, isAnimating]);

  // Generate random movement parameters for each pet
  const petAnimParams = useMemo(() => {
    return pets.map((pet) => ({
      id: pet.id,
      path: generateRandomPath(pet.id),
      duration: 2 + (pet.id % 4) * 0.5,
      rotateRange: 8 + (pet.id % 5) * 3,
    }));
  }, [pets]);

  // Do not render dynamic content on server or when unmounted
  if (!mounted || pets.length === 0) {
    return <div className="relative w-full h-full overflow-hidden" />;
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {pets.map((pet) => {
        const isGrabbed = grabbingPetId === pet.id;
        const isHovered = hoveredPetId === pet.id;
        const params = petAnimParams.find((p) => p.id === pet.id);
        const pathIndex = tick % (params?.path.length || 1);
        // Disable random offset during grab animation so claw can accurately target
        const targetOffset = isAnimating ? { x: 0, y: 0 } : (params?.path[pathIndex] || { x: 0, y: 0 });

        return (
          <motion.div
            key={pet.id}
            className="absolute"
            style={{ left: pet.x, top: pet.y }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{
              scale: isGrabbed ? 1.3 : 1,
              opacity: isGrabbed ? 0 : 1,
              x: isGrabbed ? 0 : targetOffset.x,
              y: isGrabbed ? -50 : targetOffset.y,
              zIndex: isHovered ? 50 : 1,
            }}
            transition={{
              scale: { duration: 0.3 },
              opacity: { duration: 0.3 },
              x: { duration: isAnimating ? 0.3 : (params?.duration || 2), ease: "easeInOut" },
              y: { duration: isAnimating ? 0.3 : ((params?.duration || 2) * 0.9), ease: "easeInOut" },
            }}
            onMouseEnter={() => setHoveredPetId(pet.id)}
            onMouseLeave={() => setHoveredPetId(null)}
          >
            {/* Hover zoom popup effect */}
            <AnimatePresence>
              {isHovered && !isGrabbed && (
                <motion.div
                  className="absolute -inset-4 z-40"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                >
                  {/* Glowing background */}
                  <motion.div
                    className={`absolute inset-0 rounded-full bg-gradient-to-br ${petColors[pet.type]} blur-xl`}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.8, 0.6] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                  />
                  {/* Enlarged pet */}
                  <motion.div
                    className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${petColors[pet.type]} p-1 shadow-2xl`}
                    style={{ marginLeft: "-20px", marginTop: "-20px" }}
                    animate={{
                      rotate: [-5, 5, -5],
                      y: [0, -8, 0],
                    }}
                    transition={{
                      rotate: { repeat: Infinity, duration: 0.3 },
                      y: { repeat: Infinity, duration: 0.4 },
                    }}
                  >
                    <div className="w-full h-full rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                      <Image
                        src={petImages[pet.type]}
                        alt={pet.type}
                        width={64}
                        height={64}
                        className="object-contain"
                      />
                    </div>
                    {/* Sparkle effect */}
                    <motion.div
                      className="absolute top-1 left-3 w-4 h-4 bg-white/70 rounded-full blur-sm"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 0.5 }}
                    />
                  </motion.div>
                  {/* Particle effect */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-white rounded-full"
                      style={{
                        left: "50%",
                        top: "50%",
                      }}
                      initial={{ scale: 0, x: 0, y: 0 }}
                      animate={{
                        scale: [0, 1, 0],
                        x: Math.cos((i / 6) * Math.PI * 2) * 40,
                        y: Math.sin((i / 6) * Math.PI * 2) * 40,
                        opacity: [1, 0],
                      }}
                      transition={{
                        duration: 0.6,
                        delay: i * 0.05,
                        repeat: Infinity,
                        repeatDelay: 0.3,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Normal state pet */}
            <motion.div
              className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${petColors[pet.type]} p-0.5 shadow-lg cursor-pointer ${
                isHovered ? "opacity-0" : "opacity-100"
              }`}
              animate={{
                rotate: isGrabbed ? 0 : [-(params?.rotateRange || 8), params?.rotateRange || 8, -(params?.rotateRange || 8)],
                scale: isGrabbed ? 1 : [1, 1.05, 1],
              }}
              transition={{
                rotate: {
                  duration: (params?.duration || 2) * 0.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
                scale: {
                  duration: (params?.duration || 2) * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
            >
              <div className="w-full h-full rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                <motion.div
                  animate={{ y: isGrabbed ? 0 : [0, -2, 0, 2, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Image
                    src={petImages[pet.type]}
                    alt={pet.type}
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                </motion.div>
              </div>
              {/* Gloss effect */}
              <motion.div
                className="absolute top-0.5 left-1.5 w-2 h-2 bg-white/50 rounded-full blur-[2px]"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
