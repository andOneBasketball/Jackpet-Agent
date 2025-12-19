"use client";

import { useEffect, useState } from "react";
import fox from "@/assets/jackpet_fox_strategy.png";
import wolf from "@/assets/jackpet_wolf_fortune.png";
import frog from "@/assets/jackpet_frog_luck.png";

import { PlayResult } from "@/hooks/usePlayResult";

type Props = {
    spins: number;
    result?: PlayResult | null;
};

const images = [
    { name: "FOX", src: fox },
    { name: "WOLF", src: wolf },
    { name: "FROG", src: frog },
];

export default function PetWheel({ spins, result }: Props) {
    const [current, setCurrent] = useState(0);
    const [arrangement, setArrangement] = useState<string[]>([]);

    // Build 24-item array with 8 of each pet
    const buildBase = () => {
        const base: string[] = [];
        for (let i = 0; i < 8; i++) base.push("FOX");
        for (let i = 0; i < 8; i++) base.push("WOLF");
        for (let i = 0; i < 8; i++) base.push("FROG");
        return base;
    };

    // When a result arrives, shuffle and then mark the first a entries of the winning color, next b, next c
    useEffect(() => {
        if (!result) {
            setArrangement(buildBase());
            return;
        }

        // Start from base and shuffle deterministically using requestId if present
        const seed = parseInt(result.requestId.slice(-6)) || Math.floor(Math.random() * 1e6);
        const base = buildBase();
        // simple seeded shuffle (Fisher-Yates with seed)
        let m = base.length;
        let s = seed;
        while (m) {
            s = (s * 9301 + 49297) % 233280;
            const i = Math.floor((s / 233280) * m--);
            const tmp = base[m];
            base[m] = base[i];
            base[i] = tmp;
        }

        setArrangement(base);
    }, [result]);

    useEffect(() => {
        let count = 0;
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
            count++;
            if (count >= spins * images.length) clearInterval(interval);
        }, 100);

        return () => clearInterval(interval);
    }, [spins]);

    // Determine highlights: if result is present, we want to pick which color is 'a','b','c' totals.
    // The contract returns counts sorted descending (a>=b>=c) but doesn't say which color corresponds to a/b/c.
    // We'll show counts mapped to colors by choosing the highest count color as DOGE, next as SHIB, next as PEPE for display
    const highlights = new Set<number>();
    if (result && arrangement.length === 24) {
        // compute counts per color in arrangement order to map positions to colors
        // We'll assign colors by counting occurrences in arrangement and then marking first n positions of that color
        const colorOrder: { name: string; count: number }[] = [
            { name: "FOX", count: 0 },
            { name: "WOLF", count: 0 },
            { name: "FROG", count: 0 },
        ];
        arrangement.forEach((name) => {
            const idx = colorOrder.findIndex((c) => c.name === name);
            if (idx >= 0) colorOrder[idx].count++;
        });

        // Now pick color mapping by comparing color counts to result (a,b,c)
        // We'll choose the color with the largest count in arrangement to represent 'a', etc.
        const sortedColors = [...colorOrder].sort((x, y) => y.count - x.count);
        // Mark first result.a positions of color sortedColors[0].name, next result.b of sortedColors[1], etc.
        const toMark: { name: string; qty: number }[] = [
            { name: sortedColors[0].name, qty: result.a },
            { name: sortedColors[1].name, qty: result.b },
            { name: sortedColors[2].name, qty: result.c },
        ];

        // iterate arrangement and mark positions
        const remaining = { [toMark[0].name]: toMark[0].qty, [toMark[1].name]: toMark[1].qty, [toMark[2].name]: toMark[2].qty };
        arrangement.forEach((name, idx) => {
            if (remaining[name] && remaining[name] > 0) {
                highlights.add(idx);
                remaining[name] = remaining[name] - 1;
            }
        });
    }

    return (
        <div className="grid grid-cols-8 gap-4">
            {arrangement.length === 0
                ? // fallback: show 8 of each
                new Array(24).fill(0).map((_, idx) => {
                    const img = images[Math.floor(idx / 8)];
                    return (
                        <img key={idx} src={img.src.src} className="w-16 h-16 rounded-full border-2 border-gray-300" />
                    );
                })
                : arrangement.map((name, idx) => {
                    const img = images.find((i) => i.name === name)!;
                    const isHighlighted = highlights.has(idx);
                    return (
                        <img
                            key={idx}
                            src={img.src.src}
                            className={`w-16 h-16 rounded-full border-4 ${isHighlighted ? "border-yellow-400 scale-110" : "border-gray-300"}`}
                        />
                    );
                })}
        </div>
    );
}
