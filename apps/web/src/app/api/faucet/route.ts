import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MONAD_TESTNET_CHAIN_ID, MONAD_TESTNET_RPC } from "@meridian/shared";

const DRIP_AMOUNT = parseEther("1");
const MIN_BALANCE_THRESHOLD = parseEther("0.01");
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per address

const chain = {
  id: MONAD_TESTNET_CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_TESTNET_RPC] } },
} as const;

const recentDrips = new Map<string, number>();

function cleanupOldEntries() {
  const now = Date.now();
  for (const [addr, ts] of recentDrips) {
    if (now - ts > COOLDOWN_MS) recentDrips.delete(addr);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!address || !isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const funderKey = process.env.FAUCET_PRIVATE_KEY;
    if (!funderKey) {
      return NextResponse.json(
        { error: "Faucet not configured" },
        { status: 503 }
      );
    }

    // Rate limit check
    cleanupOldEntries();
    const normalizedAddr = address.toLowerCase();
    const lastDrip = recentDrips.get(normalizedAddr);
    if (lastDrip && Date.now() - lastDrip < COOLDOWN_MS) {
      return NextResponse.json(
        { error: "Already funded recently, try again later" },
        { status: 429 }
      );
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(MONAD_TESTNET_RPC),
    });

    // Check recipient balance
    const balance = await publicClient.getBalance({ address });
    if (balance > MIN_BALANCE_THRESHOLD) {
      return NextResponse.json(
        { error: "Wallet already has funds" },
        { status: 400 }
      );
    }

    // Send drip
    const account = privateKeyToAccount(funderKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(MONAD_TESTNET_RPC),
    });

    const hash = await walletClient.sendTransaction({
      to: address,
      value: DRIP_AMOUNT,
    });

    recentDrips.set(normalizedAddr, Date.now());

    return NextResponse.json({ hash, amount: "1" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Faucet error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
