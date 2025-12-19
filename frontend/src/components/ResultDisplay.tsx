"use client";

import { PlayResult } from "@/hooks/usePlayResult";

export default function ResultDisplay({ result }: { result: PlayResult }) {
    return (
        <div className="text-center p-4 bg-white shadow rounded-md">
            <p>FOX: {result.a}</p>
            <p>WOLF: {result.b}</p>
            <p>FROG: {result.c}</p>
            <p>Payout: {result.payoutWei} wei</p>
            <p>Jackpot: {result.jackpotPayout} wei</p>
        </div>
    );
}
