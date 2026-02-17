export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_WSS = "wss://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

// Contract address -- updated after deployment
export const MERIDIAN_CORE_ADDRESS = "0xb9E4C02923D50624031979cEB9F5EDb391Ce1601" as const;

// Protocol constants (must match MeridianCore.sol)
export const FEE_BPS = 30;
export const BPS = 10_000;
export const MAX_CHANGE_PER_BLOCK = 2; // bps
export const MAX_PROPOSALS = 20;

// Decision status enum
export const DecisionStatus = {
  OPEN: 0,
  COLLAPSED: 1,
  SETTLED: 2,
} as const;
