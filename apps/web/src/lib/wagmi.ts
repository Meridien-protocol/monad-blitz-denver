import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { MONAD_TESTNET_CHAIN_ID, MONAD_TESTNET_RPC } from "@meridian/shared";

export const monadTestnet = defineChain({
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [MONAD_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "Meridian",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "meridian-dev",
  chains: [monadTestnet],
  ssr: true,
});
