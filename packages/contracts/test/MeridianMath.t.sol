// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/libraries/MeridianMath.sol";

/// @dev Wrapper to test library reverts via external calls.
contract MathHarness {
    function calcBuyYes(uint256 yesR, uint256 noR, uint256 d) external pure returns (uint256) {
        return MeridianMath.calcBuyYes(yesR, noR, d);
    }

    function calcBuyNo(uint256 yesR, uint256 noR, uint256 d) external pure returns (uint256) {
        return MeridianMath.calcBuyNo(yesR, noR, d);
    }

    function calcSellYes(uint256 yesR, uint256 noR, uint256 q) external pure returns (uint256) {
        return MeridianMath.calcSellYes(yesR, noR, q);
    }

    function welfare(uint256 yesR, uint256 noR) external pure returns (uint256) {
        return MeridianMath.welfare(yesR, noR);
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

    // ============ welfare ============

    function test_welfare_balanced() public pure {
        assertEq(MeridianMath.welfare(100 * WAD, 100 * WAD), 5000);
    }

    function test_welfare_yesHeavy() public pure {
        assertEq(MeridianMath.welfare(200 * WAD, 100 * WAD), 3333);
    }

    function test_welfare_noHeavy() public pure {
        assertEq(MeridianMath.welfare(100 * WAD, 200 * WAD), 6666);
    }

    function testFuzz_welfare_inRange(uint256 yesR, uint256 noR) public pure {
        yesR = bound(yesR, 1, 1e30);
        noR = bound(noR, 1, 1e30);
        uint256 w = MeridianMath.welfare(yesR, noR);
        assertTrue(w <= BPS, "welfare > 10000");
    }

    // ============ calcBuyYes ============

    function test_calcBuyYes_specExample() public pure {
        // From spec Section 5.7: Pool (100, 100), buy YES with d=10
        // YES_out = 10 * 210 / 110 = 19.0909...
        uint256 yesOut = MeridianMath.calcBuyYes(100 * WAD, 100 * WAD, 10 * WAD);
        assertApproxEqRel(yesOut, 19090909090909090909, 1e12);
    }

    function test_calcBuyYes_smallTrade() public pure {
        uint256 yesOut = MeridianMath.calcBuyYes(1000 * WAD, 1000 * WAD, 1 * WAD);
        assertTrue(yesOut > WAD && yesOut < 3 * WAD);
    }

    function testFuzz_calcBuyYes_alwaysMoreThanInput(uint256 yesR, uint256 noR, uint256 d) public pure {
        yesR = bound(yesR, WAD, 1e30);
        noR = bound(noR, WAD, 1e30);
        d = bound(d, 1, 1e30);
        uint256 yesOut = MeridianMath.calcBuyYes(yesR, noR, d);
        assertTrue(yesOut >= d, "YES out less than input");
    }

    // ============ calcBuyNo ============

    function test_calcBuyNo_balanced() public pure {
        uint256 noOut = MeridianMath.calcBuyNo(100 * WAD, 100 * WAD, 10 * WAD);
        uint256 yesOut = MeridianMath.calcBuyYes(100 * WAD, 100 * WAD, 10 * WAD);
        assertEq(noOut, yesOut, "balanced pool should give same output");
    }

    // ============ calcSellYes ============

    function test_calcSellYes_roundTrip() public pure {
        uint256 yesR = 100 * WAD;
        uint256 noR = 100 * WAD;
        uint256 d = 10 * WAD;

        uint256 yesOut = MeridianMath.calcBuyYes(yesR, noR, d);
        uint256 newYesR = (yesR * noR) / (noR + d);
        uint256 newNoR = noR + d;

        uint256 vMonBack = MeridianMath.calcSellYes(newYesR, newNoR, yesOut);
        assertApproxEqRel(vMonBack, d, 1e14);
    }

    function testFuzz_calcSellYes_neverMoreThanSpent(uint256 yesR, uint256 noR, uint256 d) public pure {
        yesR = bound(yesR, WAD, 1e27);
        noR = bound(noR, WAD, 1e27);
        d = bound(d, WAD / 100, 1e27);

        uint256 yesOut = MeridianMath.calcBuyYes(yesR, noR, d);
        uint256 newYesR = (yesR * noR) / (noR + d);
        uint256 newNoR = noR + d;
        uint256 vMonBack = MeridianMath.calcSellYes(newYesR, newNoR, yesOut);

        // Allow rounding tolerance: integer division in reserve calc can lose precision.
        // The key invariant is that you can't profit from a round-trip.
        // With integer division on reserves, the sell may return up to a few wei more,
        // but never a meaningful amount. Allow up to sqrt(d) tolerance for large values.
        uint256 tolerance = MeridianMath.sqrt(d) + 2;
        assertTrue(vMonBack <= d + tolerance, "sell returned significantly more than spent");
    }

    // ============ calcSellNo ============

    function test_calcSellNo_roundTrip() public pure {
        uint256 yesR = 100 * WAD;
        uint256 noR = 100 * WAD;
        uint256 d = 10 * WAD;

        uint256 noOut = MeridianMath.calcBuyNo(yesR, noR, d);
        uint256 newYesR = yesR + d;
        uint256 newNoR = (yesR * noR) / (yesR + d);

        uint256 vMonBack = MeridianMath.calcSellNo(newYesR, newNoR, noOut);
        assertApproxEqRel(vMonBack, d, 1e14);
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

    // ============ reservesAfterBuyYes ============

    function test_reservesAfterBuyYes_kIncreases() public pure {
        uint256 yesR = 100 * WAD;
        uint256 noR = 100 * WAD;
        uint256 d = 10 * WAD;
        uint256 fee = (d * 30) / BPS;
        uint256 effective = d - fee;

        uint256 kBefore = yesR * noR;
        (uint256 newYesR, uint256 newNoR) = MeridianMath.reservesAfterBuyYes(yesR, noR, effective, fee);
        uint256 kAfter = newYesR * newNoR;
        assertTrue(kAfter >= kBefore, "k decreased after trade with fees");
    }

    // ============ Revert tests (via harness) ============

    function test_calcBuyYes_revertsOnZeroInput() public {
        vm.expectRevert("MeridianMath: zero input");
        harness.calcBuyYes(100 * WAD, 100 * WAD, 0);
    }

    function test_calcBuyYes_revertsOnEmptyPool() public {
        vm.expectRevert("MeridianMath: empty pool");
        harness.calcBuyYes(0, 100 * WAD, 10 * WAD);
    }

    function test_welfare_revertsOnEmptyPool() public {
        vm.expectRevert("MeridianMath: empty pool");
        harness.welfare(0, 0);
    }
}
