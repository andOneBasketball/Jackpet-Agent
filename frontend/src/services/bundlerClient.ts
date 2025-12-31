import { createBundlerClient } from "viem/account-abstraction";
import { erc7710BundlerActions } from "@metamask/smart-accounts-kit/actions";
import { http } from "viem";

const pimlicoKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;

if (!pimlicoKey) {
  console.warn("NEXT_PUBLIC_PIMLICO_API_KEY is not set");
}

export const bundlerClient = (chainId: number) => {
  const apiKey = pimlicoKey || "test";

  return createBundlerClient({
    transport: http(
      `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apiKey}`
    ),
    paymaster: true,
  }).extend(erc7710BundlerActions());
};
