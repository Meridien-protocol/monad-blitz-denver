export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_WSS = "wss://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadexplorer.com";

// Contract addresses -- updated after deployment
export const MERIDIAN_CORE_ADDRESS = "0xDf7aeeC34d40aD437717eD60D97c52a2988A5662" as const;
export const WELFARE_ORACLE_ADDRESS = "0x857B842076187Deb7ED930f09E0F2fD23AeC9c92" as const;
export const ORACLE_OWNER_ADDRESS = "0x30d5A633ab362b4bDd040BdECfefe2Ea3F29c00E" as const;

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
  MEASURING: 3,
  RESOLVED: 4,
  DISPUTED: 5,
} as const;

// Resolution mode enum
export const ResolutionMode = {
  MODE_A: 0,
  MODE_B: 1,
} as const;

// Outcome enum
export const Outcome = {
  UNRESOLVED: 0,
  YES: 1,
  NO: 2,
} as const;
