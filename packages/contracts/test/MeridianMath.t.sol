// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/libraries/MeridianMath.sol";

/// @dev Wrapper to test library reverts via external calls.
contract MathHarness {
    function calcSwapOutput(uint256 reserveIn, uint256 reserveOut, uint256 amountIn) external pure returns (uint256) {
        return MeridianMath.calcSwapOutput(reserveIn, reserveOut, amountIn);
    }

    function yesPrice(uint256 yesR, uint256 noR) external pure returns (uint256) {
        return MeridianMath.yesPrice(yesR, noR);
    }
}

contract MeridianMathTest is Test {
    MathHarness harness;

    uint256 constant WAD = 1e18;
    uint256 constant BPS = 10_000;

    function setUp() public {
        harness = new MathHarness();
    }

    // ============ sqrt ============

    function test_sqrt_zero() public pure {
        assertEq(MeridianMath.sqrt(0), 0);
    }

    function test_sqrt_one() public pure {
        assertEq(MeridianMath.sqrt(1), 1);
    }

    function test_sqrt_four() public pure {
        assertEq(MeridianMath.sqrt(4), 2);
    }

    function test_sqrt_large() public pure {
        assertEq(MeridianMath.sqrt(10000 * WAD * WAD), 100 * WAD);
    }

    function testFuzz_sqrt_isFloor(uint256 x) public pure {
        x = bound(x, 0, type(uint128).max);
        uint256 z = MeridianMath.sqrt(x);
        assertTrue(z * z <= x, "sqrt too large");
        assertTrue((z + 1) * (z + 1) > x, "sqrt too small");
    }

    // ============ yesPrice ============

    function test_yesPrice_balanced() public pure {
        assertEq(MeridianMath.yesPrice(100 * WAD, 100 * WAD), 5000);
    }

    function test_yesPrice_yesHeavy() public pure {
        // More YES in reserve = cheaper YES = lower price
        assertEq(MeridianMath.yesPrice(200 * WAD, 100 * WAD), 3333);
    }

    function test_yesPrice_noHeavy() public pure {
        // More NO in reserve = expensive YES = higher price
        assertEq(MeridianMath.yesPrice(100 * WAD, 200 * WAD), 6666);
    }

    function testFuzz_yesPrice_inRange(uint256 yesR, uint256 noR) public pure {
        yesR = bound(yesR, 1, 1e30);
        noR = bound(noR, 1, 1e30);
        uint256 p = MeridianMath.yesPrice(yesR, noR);
        assertTrue(p <= BPS, "price > 10000");
    }

    function test_yesPrice_revertsOnEmptyPool() public {
        vm.expectRevert("MeridianMath: empty pool");
        harness.yesPrice(0, 0);
    }

    // ============ calcSwapOutput ============

    function test_calcSwapOutput_balanced() public pure {
        // Pool (100, 100), swap 10 in
        // out = 100 * 10 / (100 + 10) = 1000/110 = 9.0909...
        uint256 out = MeridianMath.calcSwapOutput(100 * WAD, 100 * WAD, 10 * WAD);
        assertApproxEqRel(out, 9090909090909090909, 1e12);
    }

    function test_calcSwapOutput_unbalanced() public pure {
        // Pool (200, 100), swap 10 in
        // out = 100 * 10 / (200 + 10) = 1000/210 = 4.7619...
        uint256 out = MeridianMath.calcSwapOutput(200 * WAD, 100 * WAD, 10 * WAD);
        assertApproxEqRel(out, 4761904761904761904, 1e12);
    }

    function testFuzz_calcSwapOutput_lessThanReserve(uint256 reserveIn, uint256 reserveOut, uint256 amountIn)
        public
        pure
    {
        reserveIn = bound(reserveIn, WAD, 1e30);
        reserveOut = bound(reserveOut, WAD, 1e30);
        amountIn = bound(amountIn, 1, 1e30);
        uint256 out = MeridianMath.calcSwapOutput(reserveIn, reserveOut, amountIn);
        assertTrue(out < reserveOut, "output >= reserveOut");
    }

    function testFuzz_calcSwapOutput_kInvariant(uint256 reserveIn, uint256 reserveOut, uint256 amountIn)
        public
        pure
    {
        reserveIn = bound(reserveIn, WAD, 1e27);
        reserveOut = bound(reserveOut, WAD, 1e27);
        amountIn = bound(amountIn, 1, 1e27);
        uint256 out = MeridianMath.calcSwapOutput(reserveIn, reserveOut, amountIn);

        uint256 kBefore = reserveIn * reserveOut;
        uint256 kAfter = (reserveIn + amountIn) * (reserveOut - out);
        // k should never decrease (may increase slightly due to rounding)
        assertTrue(kAfter >= kBefore, "k decreased");
    }

    function test_calcSwapOutput_revertsOnZeroInput() public {
        vm.expectRevert("MeridianMath: zero input");
        harness.calcSwapOutput(100 * WAD, 100 * WAD, 0);
    }

    function test_calcSwapOutput_revertsOnEmptyPool() public {
        vm.expectRevert("MeridianMath: empty pool");
        harness.calcSwapOutput(0, 100 * WAD, 10 * WAD);
    }

    // ============ applyFee ============

    function test_applyFee_thirtyBps() public pure {
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(1000 * WAD, 30);
        assertEq(fee, 3 * WAD);
        assertEq(effective, 997 * WAD);
    }

    function testFuzz_applyFee_sumIsOriginal(uint256 amount, uint256 feeBps) public pure {
        amount = bound(amount, 0, 1e30);
        feeBps = bound(feeBps, 0, BPS);
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(amount, feeBps);
        assertEq(effective + fee, amount, "fee + effective != original");
    }
}
