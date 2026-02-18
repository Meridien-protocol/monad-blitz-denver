// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MeridianCore.sol";

/// @dev Invariant and fuzz tests for MeridianCore v2 (Quantum Futarchy).
contract InvariantsTest is Test {
    MeridianCore core;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address lpAlice = makeAddr("lpAlice");
    address lpBob = makeAddr("lpBob");

    uint256 constant WAD = 1e18;
    uint256 constant LP_LIQ = 10 * WAD;
    uint256 constant DURATION = 1000;
    uint256 constant BPS = 10_000;

    function setUp() public {
        core = new MeridianCore();
        vm.deal(alice, 1000 * WAD);
        vm.deal(bob, 1000 * WAD);
        vm.deal(charlie, 1000 * WAD);
        vm.deal(lpAlice, 1000 * WAD);
        vm.deal(lpBob, 1000 * WAD);
    }

    // ============ Exact solvency: total payouts = total deposits + total LP liquidity ============

    function test_exactSolvency_threeUsers() public {
        uint256 did = core.createDecision("Test", DURATION);

        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "B");

        // Deposits
        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);
        vm.prank(charlie);
        core.deposit{value: 20 * WAD}(did);

        // Trading
        vm.prank(alice);
        core.split(did, 0, 20 * WAD);

        vm.roll(block.number + 50);
        vm.prank(bob);
        core.split(did, 0, 15 * WAD);

        vm.roll(block.number + 50);
        vm.prank(charlie);
        core.split(did, 1, 10 * WAD);

        // Some swaps
        (uint256 aliceYes,,) = core.getPosition(alice, did, 0);
        vm.roll(block.number + 1);
        vm.prank(alice);
        core.swapNoForYes(did, 0, aliceYes / 4, 0);

        // Collapse
        vm.roll(block.number + DURATION);
        core.collapse(did);

        // Settle all users
        uint256 balBefore = alice.balance + bob.balance + charlie.balance + lpAlice.balance + lpBob.balance
            + address(this).balance;

        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
        vm.prank(charlie);
        core.settle(did);

        // LP redeems
        vm.prank(lpAlice);
        core.redeemLP(did, 0);
        vm.prank(lpBob);
        core.redeemLP(did, 1);

        // Creator claims fees
        core.claimFees(did);

        uint256 balAfter = alice.balance + bob.balance + charlie.balance + lpAlice.balance + lpBob.balance
            + address(this).balance;
        uint256 totalPaidOut = balAfter - balBefore;
        uint256 totalIn = 100 * WAD + 2 * LP_LIQ; // deposits + LP liquidity

        // Should be exactly equal (no virtual liquidity leakage)
        assertEq(totalPaidOut, totalIn, "solvency: payouts != deposits + LP");
    }

    // ============ Fuzz solvency with random splits/swaps ============

    function testFuzz_solvency_randomSplitsSwaps(uint256 aliceAmt, uint256 bobAmt, bool aliceSwapDir) public {
        aliceAmt = bound(aliceAmt, WAD / 10, 20 * WAD);
        bobAmt = bound(bobAmt, WAD / 10, 20 * WAD);

        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "B");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 50 * WAD}(did);

        // Random splits
        vm.prank(alice);
        core.split(did, 0, aliceAmt);

        vm.roll(block.number + 10);
        vm.prank(bob);
        core.split(did, 1, bobAmt);

        // Optional swap
        (uint256 aliceYes, uint256 aliceNo,) = core.getPosition(alice, did, 0);
        if (aliceYes > WAD / 100 && aliceNo > WAD / 100) {
            vm.roll(block.number + 1);
            vm.prank(alice);
            if (aliceSwapDir) {
                core.swapYesForNo(did, 0, aliceYes / 4, 0);
            } else {
                core.swapNoForYes(did, 0, aliceNo / 4, 0);
            }
        }

        // Collapse + settle
        vm.roll(block.number + DURATION);
        core.collapse(did);

        uint256 totalBefore = alice.balance + bob.balance + lpAlice.balance + lpBob.balance + address(this).balance;

        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
        vm.prank(lpAlice);
        core.redeemLP(did, 0);
        vm.prank(lpBob);
        core.redeemLP(did, 1);
        core.claimFees(did);

        uint256 totalAfter = alice.balance + bob.balance + lpAlice.balance + lpBob.balance + address(this).balance;
        uint256 totalPaidOut = totalAfter - totalBefore;
        uint256 totalIn = 100 * WAD + 2 * LP_LIQ;

        assertEq(totalPaidOut, totalIn, "fuzz solvency failed");
    }

    // ============ Principal preservation: non-traders get exact deposit back ============

    function test_principalPreservation() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "B");

        // Charlie just deposits, never splits or trades
        vm.prank(charlie);
        core.deposit{value: 30 * WAD}(did);

        // Alice trades
        vm.prank(alice);
        core.deposit{value: 20 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 10 * WAD);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        uint256 charlieBefore = charlie.balance;
        vm.prank(charlie);
        core.settle(did);
        assertEq(charlie.balance - charlieBefore, 30 * WAD, "non-trader principal not preserved");
    }

    // ============ yesPrice always in [0, BPS] ============

    function testFuzz_yesPrice_alwaysInRange(uint256 amount) public {
        amount = bound(amount, WAD / 10, 20 * WAD);

        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        vm.prank(alice);
        core.split(did, 0, amount);

        (uint256 yesBal,,) = core.getPosition(alice, did, 0);
        if (yesBal > WAD / 100) {
            vm.roll(block.number + 1);
            vm.prank(alice);
            core.swapYesForNo(did, 0, yesBal / 2, 0);
        }

        uint256 p = core.getYesPrice(did, 0);
        assertTrue(p <= BPS, "price > 10000");
        assertTrue(p > 0, "price == 0 after trade");
    }

    // ============ k never decreases per proposal ============

    function test_k_neverDecreases() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");

        (, uint256 yesR0, uint256 noR0,,,,,) = core.getProposal(did, 0);
        uint256 k0 = yesR0 * noR0;

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 10 * WAD);

        // Swap YES for NO
        (uint256 yesBal,,) = core.getPosition(alice, did, 0);

        vm.roll(block.number + 1);
        vm.prank(alice);
        core.swapYesForNo(did, 0, yesBal / 2, 0);

        (, uint256 yesR1, uint256 noR1,,,,,) = core.getProposal(did, 0);
        uint256 k1 = yesR1 * noR1;

        assertTrue(k1 >= k0, "k decreased after swap");

        // Swap NO for YES (use current NO balance)
        vm.roll(block.number + 1);
        (,uint256 noBal,) = core.getPosition(alice, did, 0);
        vm.prank(alice);
        core.swapNoForYes(did, 0, noBal / 2, 0);

        (, uint256 yesR2, uint256 noR2,,,,,) = core.getProposal(did, 0);
        uint256 k2 = yesR2 * noR2;

        assertTrue(k2 >= k1, "k decreased after second swap");
    }

    // ============ Supply invariant per proposal ============
    // After split: totalAllocated = sum of user allocations
    // yesBalance + noBalance should be trackable

    function test_supplyInvariant() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");

        vm.prank(alice);
        core.deposit{value: 20 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 20 * WAD}(did);

        vm.prank(alice);
        core.split(did, 0, 10 * WAD);
        vm.prank(bob);
        core.split(did, 0, 8 * WAD);

        uint256 fee1 = 10 * WAD * 30 / BPS;
        uint256 fee2 = 8 * WAD * 30 / BPS;
        uint256 totalEffective = (10 * WAD - fee1) + (8 * WAD - fee2);

        (,,,, uint256 totalAllocated,,,) = core.getProposal(did, 0);
        assertEq(totalAllocated, totalEffective, "totalAllocated mismatch");
    }

    // ============ No-op property: losing proposal refunds = allocations ============

    function test_noOpProperty_losingRefund() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "B");

        // Alice in proposal 0, Bob in proposal 1
        vm.prank(alice);
        core.deposit{value: 20 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 10 * WAD);

        vm.prank(bob);
        core.deposit{value: 15 * WAD}(did);
        vm.prank(bob);
        core.split(did, 1, 10 * WAD);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        (,,,,,,,,, uint256 winId) = core.decisions(did);
        uint256 losingId = winId == 0 ? 1 : 0;
        address loser = winId == 0 ? bob : alice;

        (,,uint256 loserAlloc) = core.getPosition(loser, did, losingId);

        uint256 balBefore = loser.balance;
        vm.prank(loser);
        core.settle(did);

        uint256 payout = loser.balance - balBefore;
        // Payout should include allocation refund + unallocated balance
        assertTrue(payout >= loserAlloc, "losing refund should include allocation");
    }

    // ============ Double-redeem prevention ============

    function test_doubleRedeemPrevention() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        vm.prank(alice);
        core.settle(did);

        vm.prank(alice);
        vm.expectRevert("already settled");
        core.settle(did);

        // LP double redeem
        vm.prank(lpAlice);
        core.redeemLP(did, 0);

        vm.prank(lpAlice);
        vm.expectRevert("already redeemed");
        core.redeemLP(did, 0);
    }

    receive() external payable {}
}
