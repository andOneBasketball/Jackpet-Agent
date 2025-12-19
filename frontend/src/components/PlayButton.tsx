"use client";

import { useState } from "react";
import { ethers } from "ethers";
import ABI from "@/abi/PlayContract.json";
import { getContractAddress, CHAIN_PARAMS, PREFERRED_CHAIN_ID } from "@/config/networks";

export default function PlayButton({ setSpins }: { setSpins: (n: number) => void }) {
    const [loading, setLoading] = useState(false);
    const [mult, setMult] = useState(1);

    const play = async () => {
        if (!(window as any).ethereum) {
            alert("Please install a web3 wallet (e.g. MetaMask)");
            return;
        }
        setLoading(true);

        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            // Request accounts to ensure wallet is connected
            await provider.send("eth_requestAccounts", []);

            // Determine current network
            let network = await provider.getNetwork();
            // ethers v6 returns chainId as bigint; convert to number for our config lookup
            let chainId = Number(network.chainId);

            // If we don't have a configured address for this chain, try switching to preferred
            let contractAddress = getContractAddress(chainId);
            if (!contractAddress) {
                const desired = PREFERRED_CHAIN_ID;
                const params = CHAIN_PARAMS[desired];
                try {
                    await provider.send("wallet_switchEthereumChain", [{ chainId: params.chainId }]);
                    network = await provider.getNetwork();
                    chainId = Number(network.chainId);
                    contractAddress = getContractAddress(chainId);
                } catch (switchErr: any) {
                    // If chain not added, attempt to add it
                    if (switchErr?.code === 4902 && params) {
                        try {
                            await provider.send("wallet_addEthereumChain", [params]);
                            await provider.send("wallet_switchEthereumChain", [{ chainId: params.chainId }]);
                            network = await provider.getNetwork();
                            chainId = Number(network.chainId);
                            contractAddress = getContractAddress(chainId);
                        } catch (addErr: any) {
                            console.error("Failed to add/switch chain", addErr);
                            alert("Failed to switch to the required network.");
                            return;
                        }
                    } else {
                        console.error("Failed to switch chain", switchErr);
                        alert("Please switch to the correct network in your wallet.");
                        return;
                    }
                }
            }

            if (!contractAddress) {
                alert("No contract address configured for the connected network.");
                return;
            }

            // Verify contract exists on this network
            const code = await provider.getCode(contractAddress);
            if (!code || code === "0x") {
                alert("Contract not found on the connected network. Please check network or configuration.");
                return;
            }

            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, ABI, signer);

            // ticketRate is expressed in percent units in the contract (e.g., 100 => 1x)
            const ticketRate = 100 * mult;
            const value = ethers.parseEther((0.01 * mult).toString());
            const tx = await contract.play(ticketRate, { value });
            console.log("txHash", tx.hash);
            await tx.wait();
            setSpins(20 * mult); // increase animation with multiplier
        } catch (err: any) {
            console.error("Play error", err);
            alert(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <select
                value={mult}
                onChange={(e) => setMult(Number(e.target.value))}
                className="px-3 py-1 border rounded"
            >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
            </select>
            <button
                onClick={play}
                disabled={loading}
                className="px-6 py-2 bg-green-500 text-white rounded-md"
            >
                {loading ? "Playing..." : `Play ${mult}x`}
            </button>
        </div>
    );
}
