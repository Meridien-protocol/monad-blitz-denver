export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_WSS = "wss://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

// Contract addresses -- updated after deployment
export const MERIDIAN_CORE_ADDRESS = "0x6818442316ab3E222634E08768370abDd0fde833" as const;

// Protocol constants (must match MeridianCore.sol)
export const BPS = 10_000;
export const SPLIT_FEE_BPS = 30;
export const TRADE_FEE_BPS = 30;
export const MAX_CHANGE_PER_BLOCK = 2; // bps
export const MAX_PROPOSALS = 32;
export const STALE_THRESHOLD = 12_500;
export const MIN_LIQUIDITY = "100000000000000000"; // 0.1 MON in wei

// Decision status enum
export const DecisionStatus = {
  OPEN: 0,
  COLLAPSED: 1,
  SETTLED: 2,
} as const;
