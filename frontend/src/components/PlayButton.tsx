"use client";

import { useState } from "react";
import { ethers } from "ethers";
import ABI from "@/abi/PlayContract.json";
import { getContractAddress, CHAIN_PARAMS, PREFERRED_CHAIN_ID } from "@/config/networks";

// ERC-7715 permission types
interface PermissionContext {
    expiry: number;
    signer: {
        type: string;
        data: {
            ids: string[];
        };
    };
}

interface NativeTokenPermission {
    type: "native-token-recurring-allowance";
    data: {
        allowance: string;
        start: number;
        period: number;
        validUntil: number;
    };
    policies: any[];
    required: boolean;
}

type PlayMode = "direct" | "erc7715";

export default function PlayButton({ setSpins }: { setSpins: (n: number) => void }) {
    const [loading, setLoading] = useState(false);
    const [mult, setMult] = useState(1);

    // ERC-7715 authorization mode settings
    const [playMode, setPlayMode] = useState<PlayMode>("direct");
    const [authDuration, setAuthDuration] = useState(24); // hours
    const [authPlayCount, setAuthPlayCount] = useState(10); // count
    const [authEthAmount, setAuthEthAmount] = useState(0.1); // ETH allowance
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [permissionContext, setPermissionContext] = useState<PermissionContext | null>(null);

    // Ensure correct network and return provider, contractAddress
    const ensureNetwork = async () => {
        if (!(window as any).ethereum) {
            alert("Please install a web3 wallet (e.g. MetaMask)");
            return null;
        }

        const provider = new ethers.BrowserProvider((window as any).ethereum);
        await provider.send("eth_requestAccounts", []);

        let network = await provider.getNetwork();
        let chainId = Number(network.chainId);
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
                        return null;
                    }
                } else {
                    console.error("Failed to switch chain", switchErr);
                    alert("Please switch to the correct network in your wallet.");
                    return null;
                }
            }
        }

        if (!contractAddress) {
            alert("No contract address configured for the connected network.");
            return null;
        }

        const code = await provider.getCode(contractAddress);
        if (!code || code === "0x") {
            alert("Contract not found on the connected network.");
            return null;
        }

        return { provider, contractAddress, chainId };
    };

    // Direct contract play call
    const playDirect = async () => {
        setLoading(true);
        try {
            const result = await ensureNetwork();
            if (!result) return;

            const { provider, contractAddress } = result;
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, ABI, signer);

            const ticketRate = 100 * mult;
            const value = ethers.parseEther((0.01 * mult).toString());
            const tx = await contract.play(ticketRate, { value });
            console.log("txHash", tx.hash);
            await tx.wait();
            setSpins(20 * mult);
        } catch (err: any) {
            console.error("Play error", err);
            alert(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    // ERC-7715 request permission
    const requestERC7715Permission = async () => {
        setLoading(true);
        try {
            const result = await ensureNetwork();
            if (!result) return;

            const { provider, contractAddress, chainId } = result;
            const signer = await provider.getSigner();
            const signerAddress = await signer.getAddress();

            const now = Math.floor(Date.now() / 1000);
            const validUntil = now + authDuration * 3600; // convert to seconds
            const allowanceWei = ethers.parseEther(authEthAmount.toString()).toString();

            // ERC-7715 wallet_grantPermissions request
            const permissionsRequest = {
                chainId: `0x${chainId.toString(16)}`,
                address: signerAddress,
                expiry: validUntil,
                signer: {
                    type: "key",
                    data: {
                        ids: [signerAddress]
                    }
                },
                permissions: [
                    {
                        type: "native-token-recurring-allowance",
                        data: {
                            allowance: allowanceWei,
                            start: now,
                            period: Math.floor(authDuration * 3600), // period equals authorization duration
                            validUntil: validUntil,
                        },
                        policies: [
                            {
                                type: "gas-limit",
                                data: {
                                    limit: "0x5F5E100" // 100M gas limit
                                }
                            },
                            {
                                type: "call-limit",
                                data: {
                                    count: authPlayCount
                                }
                            }
                        ],
                        required: true,
                    },
                    {
                        type: "contract-call",
                        data: {
                            address: contractAddress,
                            calls: [
                                {
                                    signature: "play(uint32)",
                                }
                            ]
                        },
                        policies: [
                            {
                                type: "call-limit",
                                data: {
                                    count: authPlayCount
                                }
                            }
                        ],
                        required: true,
                    }
                ],
            };

            console.log("Requesting ERC-7715 permissions:", permissionsRequest);

            const response = await provider.send("wallet_grantPermissions", [permissionsRequest]);

            console.log("ERC-7715 permission response:", response);

            if (response) {
                setIsAuthorized(true);
                setPermissionContext({
                    expiry: validUntil,
                    signer: {
                        type: "key",
                        data: {
                            ids: [signerAddress]
                        }
                    }
                });
                alert(`Authorization successful! You can play ${authPlayCount} times within ${authDuration} hours.`);
            }
        } catch (err: any) {
            console.error("ERC-7715 permission error", err);
            if (err?.code === 4001) {
                alert("User rejected the permission request.");
            } else if (err?.message?.includes("not supported")) {
                alert("ERC-7715 is not supported by your wallet. Please use MetaMask with ERC-7715 support enabled.");
            } else {
                alert(err?.message || String(err));
            }
        } finally {
            setLoading(false);
        }
    };

    // Play using granted permission
    const playWithPermission = async () => {
        if (!isAuthorized || !permissionContext) {
            alert("Please authorize first.");
            return;
        }

        // Check if authorization has expired
        if (permissionContext.expiry < Math.floor(Date.now() / 1000)) {
            setIsAuthorized(false);
            setPermissionContext(null);
            alert("Authorization has expired. Please authorize again.");
            return;
        }

        setLoading(true);
        try {
            const result = await ensureNetwork();
            if (!result) return;

            const { provider, contractAddress } = result;
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddress, ABI, signer);

            const ticketRate = 100 * mult;
            const value = ethers.parseEther((0.01 * mult).toString());

            // Use wallet_sendCalls for batch calls (used with ERC-7715)
            const tx = await contract.play(ticketRate, { value });
            console.log("txHash", tx.hash);
            await tx.wait();
            setSpins(20 * mult);
        } catch (err: any) {
            console.error("Play with permission error", err);
            alert(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = () => {
        if (playMode === "direct") {
            playDirect();
        } else if (isAuthorized) {
            playWithPermission();
        } else {
            requestERC7715Permission();
        }
    };

    return (
        <div className="flex flex-col space-y-4">
            {/* Mode selection */}
            <div className="flex items-center space-x-4">
                <label className="text-sm font-medium">Mode:</label>
                <select
                    value={playMode}
                    onChange={(e) => {
                        setPlayMode(e.target.value as PlayMode);
                        setIsAuthorized(false);
                        setPermissionContext(null);
                    }}
                    className="px-3 py-1 border rounded"
                >
                    <option value="direct">Direct Play</option>
                    <option value="erc7715">ERC-7715 Authorization</option>
                </select>
            </div>

            {/* ERC-7715 authorization settings */}
            {playMode === "erc7715" && !isAuthorized && (
                <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
                    <h3 className="font-semibold text-sm">Authorization Settings</h3>

                    <div className="flex items-center space-x-3">
                        <label className="text-sm w-24">Duration:</label>
                        <select
                            value={authDuration}
                            onChange={(e) => setAuthDuration(Number(e.target.value))}
                            className="px-3 py-1 border rounded flex-1"
                        >
                            <option value={1}>1 Hour</option>
                            <option value={6}>6 Hours</option>
                            <option value={12}>12 Hours</option>
                            <option value={24}>24 Hours</option>
                            <option value={72}>3 Days</option>
                            <option value={168}>7 Days</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-3">
                        <label className="text-sm w-24">Play Count:</label>
                        <select
                            value={authPlayCount}
                            onChange={(e) => setAuthPlayCount(Number(e.target.value))}
                            className="px-3 py-1 border rounded flex-1"
                        >
                            <option value={5}>5 times</option>
                            <option value={10}>10 times</option>
                            <option value={20}>20 times</option>
                            <option value={50}>50 times</option>
                            <option value={100}>100 times</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-3">
                        <label className="text-sm w-24">ETH Limit:</label>
                        <select
                            value={authEthAmount}
                            onChange={(e) => setAuthEthAmount(Number(e.target.value))}
                            className="px-3 py-1 border rounded flex-1"
                        >
                            <option value={0.05}>0.05 ETH</option>
                            <option value={0.1}>0.1 ETH</option>
                            <option value={0.5}>0.5 ETH</option>
                            <option value={1}>1 ETH</option>
                            <option value={5}>5 ETH</option>
                        </select>
                    </div>

                    <p className="text-xs text-gray-500">
                        Authorize MetaMask to allow up to {authPlayCount} plays within {authDuration} hours, spending max {authEthAmount} ETH.
                    </p>
                </div>
            )}

            {/* Authorized status display */}
            {playMode === "erc7715" && isAuthorized && permissionContext && (
                <div className="p-4 border rounded-lg bg-green-50 space-y-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-green-600">Authorized</span>
                        <button
                            onClick={() => {
                                setIsAuthorized(false);
                                setPermissionContext(null);
                            }}
                            className="text-xs text-red-500 underline"
                        >
                            Revoke
                        </button>
                    </div>
                    <p className="text-xs text-gray-600">
                        Expires: {new Date(permissionContext.expiry * 1000).toLocaleString()}
                    </p>
                </div>
            )}

            {/* Multiplier selection and play button */}
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
                    onClick={handlePlay}
                    disabled={loading}
                    className={`px-6 py-2 text-white rounded-md ${
                        playMode === "erc7715" && !isAuthorized
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-green-500 hover:bg-green-600"
                    } disabled:opacity-50`}
                >
                    {loading
                        ? "Processing..."
                        : playMode === "erc7715" && !isAuthorized
                        ? "Authorize & Play"
                        : `Play ${mult}x`}
                </button>
            </div>
        </div>
    );
}
