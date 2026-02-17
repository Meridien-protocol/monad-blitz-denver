export interface Decision {
  id: bigint;
  creator: `0x${string}`;
  title: string;
  deadline: bigint;
  createdAtBlock: bigint;
  totalDeposits: bigint;
  proposalCount: number;
  status: number;
  winningProposalId: number;
  virtualLiquidity: bigint;
  feeBps: number;
}

export interface Proposal {
  id: number;
  decisionId: bigint;
  title: string;
  yesReserve: bigint;
  noReserve: bigint;
  totalVMonMinted: bigint;
  totalVolume: bigint;
}

export interface Position {
  yesBalance: bigint;
  noBalance: bigint;
  vMonSpent: bigint;
}

export interface OracleState {
  priceCumulative: bigint;
  lastUpdateBlock: bigint;
  lastObservation: bigint;
}

export type TradeDirection = "YES" | "NO";

export interface TradeEvent {
  user: `0x${string}`;
  decisionId: bigint;
  proposalId: number;
  direction: TradeDirection;
  amountIn: bigint;
  amountOut: bigint;
  newWelfare: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}
