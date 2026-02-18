export interface Decision {
  id: bigint;
  creator: `0x${string}`;
  title: string;
  deadline: bigint;
  createdAtBlock: bigint;
  proposalCount: number;
  totalDeposits: bigint;
  totalLPLiquidity: bigint;
  collectedFees: bigint;
  status: number;
  winningProposalId: number;
}

export interface Proposal {
  id: number;
  decisionId: bigint;
  lpProvider: `0x${string}`;
  title: string;
  yesReserve: bigint;
  noReserve: bigint;
  lpLiquidity: bigint;
  totalAllocated: bigint;
  totalVolume: bigint;
  lpRedeemed: boolean;
}

export interface Position {
  yesBalance: bigint;
  noBalance: bigint;
  allocated: bigint;
}

export interface OracleState {
  priceCumulative: bigint;
  lastUpdateBlock: bigint;
  lastObservation: bigint;
}

export interface SwapEvent {
  user: `0x${string}`;
  decisionId: bigint;
  proposalId: number;
  yesForNo: boolean;
  amountIn: bigint;
  amountOut: bigint;
  newYesPrice: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}
