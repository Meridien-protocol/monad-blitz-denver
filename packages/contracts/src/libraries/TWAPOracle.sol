// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title TWAPOracle
/// @notice Lagging TWAP oracle for manipulation-resistant welfare price readings.
/// @dev Implements clamped price updates (MAX_CHANGE_PER_BLOCK) and cumulative price accumulation.
///      The oracle tracks a "lagged observation" that can move at most MAX_CHANGE bps per block,
///      preventing sudden price jumps from affecting the TWAP.
library TWAPOracle {
    uint256 internal constant BPS = 10_000;

    struct State {
        uint128 priceCumulative; // Running sum of (observation * blocks_elapsed)
        uint48 lastUpdateBlock; // Last block the oracle was updated
        uint48 lastObservation; // Last recorded welfare (bps), clamped
        uint48 startBlock; // Block when oracle started (for TWAP window)
        uint48 startCumulative; // priceCumulative at startBlock (cast from uint128)
    }

    /// @notice Initialize oracle state for a new proposal.
    /// @param self Oracle state to initialize.
    /// @param blockNumber Current block number.
    function init(State storage self, uint256 blockNumber) internal {
        self.priceCumulative = 0;
        self.lastUpdateBlock = uint48(blockNumber);
        self.lastObservation = 5000; // 50% initial welfare
        self.startBlock = uint48(blockNumber);
        self.startCumulative = 0;
    }

    /// @notice Update the oracle before a trade. Call this BEFORE modifying reserves.
    /// @param self Oracle state.
    /// @param rawWelfare Current welfare from CPMM (in bps, before this trade).
    /// @param maxChangePerBlock Maximum bps the observation can move per block.
    /// @param blockNumber Current block number.
    function update(State storage self, uint256 rawWelfare, uint256 maxChangePerBlock, uint256 blockNumber) internal {
        uint256 lastBlock = uint256(self.lastUpdateBlock);
        if (blockNumber <= lastBlock) return; // One update per block max

        uint256 blocksElapsed = blockNumber - lastBlock;
        uint256 lastObs = uint256(self.lastObservation);

        // Accumulate the old observation over elapsed blocks
        self.priceCumulative += uint128(lastObs * blocksElapsed);

        // Compute clamped new observation
        uint256 newObs;
        if (rawWelfare > lastObs) {
            uint256 maxIncrease = maxChangePerBlock * blocksElapsed;
            uint256 delta = rawWelfare - lastObs;
            newObs = delta > maxIncrease ? lastObs + maxIncrease : rawWelfare;
        } else {
            uint256 maxDecrease = maxChangePerBlock * blocksElapsed;
            uint256 delta = lastObs - rawWelfare;
            newObs = delta > maxDecrease ? lastObs - maxDecrease : rawWelfare;
        }

        // Clamp to valid bps range
        if (newObs > BPS) newObs = BPS;

        self.lastObservation = uint48(newObs);
        self.lastUpdateBlock = uint48(blockNumber);
    }

    /// @notice Finalize the oracle at collapse time. Accumulates any remaining blocks.
    /// @param self Oracle state.
    /// @param blockNumber Current block number (should be >= deadline).
    function finalize(State storage self, uint256 blockNumber) internal {
        uint256 lastBlock = uint256(self.lastUpdateBlock);
        if (blockNumber > lastBlock) {
            uint256 blocksElapsed = blockNumber - lastBlock;
            self.priceCumulative += uint128(uint256(self.lastObservation) * blocksElapsed);
            self.lastUpdateBlock = uint48(blockNumber);
        }
    }

    /// @notice Read the TWAP welfare over the full trading period.
    /// @param self Oracle state (after finalize).
    /// @return twap Time-weighted average welfare in bps.
    function readTwap(State storage self) internal view returns (uint256 twap) {
        uint256 totalBlocks = uint256(self.lastUpdateBlock) - uint256(self.startBlock);
        if (totalBlocks == 0) return uint256(self.lastObservation);
        twap = (uint256(self.priceCumulative) - uint256(self.startCumulative)) / totalBlocks;
    }

    /// @notice Check if the oracle has been updated recently enough to be valid.
    /// @param self Oracle state.
    /// @param deadline Decision deadline block.
    /// @param staleThreshold Maximum blocks since last update before considered stale.
    /// @return valid True if the oracle is not stale.
    function isActive(State storage self, uint256 deadline, uint256 staleThreshold) internal view returns (bool valid) {
        valid = (deadline - uint256(self.lastUpdateBlock)) <= staleThreshold;
    }
}
