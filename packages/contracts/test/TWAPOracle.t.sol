// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/libraries/TWAPOracle.sol";

/// @dev Harness to expose library storage functions for testing.
contract OracleHarness {
    using TWAPOracle for TWAPOracle.State;

    TWAPOracle.State public oracle;

    function init(uint256 blockNumber) external {
        oracle.init(blockNumber);
    }

    function update(uint256 rawPrice, uint256 maxChange, uint256 blockNumber) external {
        oracle.update(rawPrice, maxChange, blockNumber);
    }

    function finalize(uint256 blockNumber) external {
        oracle.finalize(blockNumber);
    }

    function readTwap() external view returns (uint256) {
        return oracle.readTwap();
    }

    function isActive(uint256 deadline, uint256 staleThreshold) external view returns (bool) {
        return oracle.isActive(deadline, staleThreshold);
    }

    function getState()
        external
        view
        returns (uint128 cumulative, uint48 lastBlock, uint48 lastObs, uint48 startBlock, uint48 startCum)
    {
        return (
            oracle.priceCumulative,
            oracle.lastUpdateBlock,
            oracle.lastObservation,
            oracle.startBlock,
            oracle.startCumulative
        );
    }
}

contract TWAPOracleTest is Test {
    OracleHarness harness;

    uint256 constant MAX_CHANGE = 2; // 2 bps per block

    function setUp() public {
        harness = new OracleHarness();
    }

    // ============ init ============

    function test_init() public {
        harness.init(100);
        (uint128 cumulative, uint48 lastBlock, uint48 lastObs, uint48 startBlock,) = harness.getState();
        assertEq(cumulative, 0);
        assertEq(lastBlock, 100);
        assertEq(lastObs, 5000);
        assertEq(startBlock, 100);
    }

    // ============ update: no clamping ============

    function test_update_noClamping() public {
        harness.init(100);

        // Small move: 5000 -> 5001 in 1 block. MAX_CHANGE=2, delta=1 <= 2. No clamping.
        harness.update(5001, MAX_CHANGE, 101);

        (, uint48 lastBlock, uint48 lastObs,,) = harness.getState();
        assertEq(lastBlock, 101);
        assertEq(lastObs, 5001);
    }

    // ============ update: clamping ============

    function test_update_clampedUp() public {
        harness.init(100);

        // Large jump: 5000 -> 6000. Only 2 bps allowed in 1 block.
        harness.update(6000, MAX_CHANGE, 101);

        (, , uint48 lastObs,,) = harness.getState();
        assertEq(lastObs, 5002); // clamped to 5000 + 2
    }

    function test_update_clampedDown() public {
        harness.init(100);

        // Large drop: 5000 -> 4000 in 1 block.
        harness.update(4000, MAX_CHANGE, 101);

        (, , uint48 lastObs,,) = harness.getState();
        assertEq(lastObs, 4998); // clamped to 5000 - 2
    }

    function test_update_clampedMultiBlock() public {
        harness.init(100);

        // 5 blocks elapsed, max move = 5 * 2 = 10 bps
        harness.update(6000, MAX_CHANGE, 105);

        (, , uint48 lastObs,,) = harness.getState();
        assertEq(lastObs, 5010); // 5000 + 10
    }

    // ============ update: same block ignored ============

    function test_update_sameBlock() public {
        harness.init(100);
        harness.update(6000, MAX_CHANGE, 100); // Same block as init

        (, , uint48 lastObs,,) = harness.getState();
        assertEq(lastObs, 5000); // Unchanged
    }

    // ============ cumulative accumulation ============

    function test_accumulation_simple() public {
        harness.init(100);

        // After 10 blocks at observation=5000, cumulative should be 50000
        harness.update(5000, MAX_CHANGE, 110);

        (uint128 cumulative,,,,) = harness.getState();
        assertEq(cumulative, 5000 * 10);
    }

    function test_accumulation_multiStep() public {
        harness.init(100);

        // Block 105: 5 blocks at 5000 -> cumulative += 25000
        harness.update(5004, MAX_CHANGE, 105);
        (uint128 cum1,,,,) = harness.getState();
        assertEq(cum1, 5000 * 5);

        // Block 110: 5 blocks at 5004 -> cumulative += 25020
        harness.update(5004, MAX_CHANGE, 110);
        (uint128 cum2,,,,) = harness.getState();
        assertEq(cum2, 25000 + 5004 * 5);
    }

    // ============ readTwap ============

    function test_readTwap_constantPrice() public {
        harness.init(100);

        // Welfare stays at 5000 for 100 blocks
        harness.update(5000, MAX_CHANGE, 200);
        harness.finalize(200);

        uint256 twap = harness.readTwap();
        assertEq(twap, 5000);
    }

    function test_readTwap_changingPrice() public {
        harness.init(100);

        // 50 blocks at 5000, then move to 5004 for 50 blocks
        harness.update(5004, MAX_CHANGE, 150);
        harness.update(5004, MAX_CHANGE, 200);
        harness.finalize(200);

        uint256 twap = harness.readTwap();
        // cumulative = 5000*50 + 5004*50 = 250000 + 250200 = 500200
        // twap = 500200 / 100 = 5002
        assertEq(twap, 5002);
    }

    function test_readTwap_zeroBlocks() public {
        // If finalize is called at init block, returns last observation
        harness.init(100);
        harness.finalize(100);

        uint256 twap = harness.readTwap();
        assertEq(twap, 5000);
    }

    // ============ finalize ============

    function test_finalize_accumulatesRemaining() public {
        harness.init(100);

        // Trade at block 150, moves obs to 5004
        harness.update(5004, MAX_CHANGE, 150);

        // Deadline at block 200, no more trades. Finalize accumulates 50 blocks of 5004.
        harness.finalize(200);

        (uint128 cumulative,,,,) = harness.getState();
        // 50 blocks at 5000 + 50 blocks at 5004 = 250000 + 250200 = 500200
        assertEq(cumulative, 500200);
    }

    // ============ isActive ============

    function test_isActive_fresh() public {
        harness.init(100);
        harness.update(5000, MAX_CHANGE, 150);

        // Deadline at 200, stale threshold 100. Last update at 150: gap=50 <= 100. Active.
        assertTrue(harness.isActive(200, 100));
    }

    function test_isActive_stale() public {
        harness.init(100);
        harness.update(5000, MAX_CHANGE, 105);

        // Deadline at 300, stale threshold 100. Last update at 105: gap=195 > 100. Stale.
        assertFalse(harness.isActive(300, 100));
    }

    // ============ Edge: observation clamped at BPS boundary ============

    function test_update_clampAtBPS() public {
        // Start at high welfare, try to push above 10000
        harness.init(100);
        // Set observation high first
        // Move over many blocks: 5000 + 2*2500 = 10000
        harness.update(10000, MAX_CHANGE, 2600);

        (, , uint48 lastObs,,) = harness.getState();
        assertEq(lastObs, 10000); // Clamped at max BPS
    }

    function test_update_clampAtZero() public {
        harness.init(100);
        // Move down: 5000 - 2*2500 = 0
        harness.update(0, MAX_CHANGE, 2600);

        (, , uint48 lastObs,,) = harness.getState();
        assertEq(lastObs, 0);
    }
}
