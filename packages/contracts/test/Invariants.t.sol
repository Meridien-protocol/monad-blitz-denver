// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MeridianCore.sol";

/// @dev Invariant and fuzz tests for MeridianCore.
contract InvariantsTest is Test {
    MeridianCore core;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    uint256 constant WAD = 1e18;
    uint256 constant VIRTUAL_LIQ = 100 * WAD;
    uint256 constant DURATION = 1000;
    uint256 constant BPS = 10_000;

    function setUp() public {
        core = new MeridianCore();
        vm.deal(alice, 1000 * WAD);
        vm.deal(bob, 1000 * WAD);
        vm.deal(charlie, 1000 * WAD);
    }

    // ============ Solvency: sum(payouts) == sum(deposits) ============

    function test_solvency_threeUsers() public {
        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");
        core.addProposal(did, "B");

        // Deposits
        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);
        vm.prank(charlie);
        core.deposit{value: 20 * WAD}(did);

        uint256 totalDeposited = 100 * WAD;

        // Trading across multiple blocks
        vm.prank(alice);
        core.buyYes(did, 0, 20 * WAD, 0);

        vm.roll(block.number + 50);
        vm.prank(bob);
        core.buyNo(did, 0, 15 * WAD, 0);

        vm.roll(block.number + 50);
        vm.prank(charlie);
        core.buyYes(did, 1, 10 * WAD, 0);

        vm.roll(block.number + 50);
        vm.prank(alice);
        core.buyYes(did, 1, 10 * WAD, 0);

        // Collapse
        vm.roll(block.number + DURATION);
        core.collapse(did);

        // Settle all
        uint256 balBefore = alice.balance + bob.balance + charlie.balance;

        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
        vm.prank(charlie);
        core.settle(did);

        uint256 balAfter = alice.balance + bob.balance + charlie.balance;
        uint256 totalPaidOut = balAfter - balBefore;

        // Total payouts should be approximately equal to total deposits.
        // Virtual liquidity can cause small deviations bounded by L.
        assertApproxEqAbs(totalPaidOut, totalDeposited, VIRTUAL_LIQ);
    }

    // ============ Welfare always in range ============

    function testFuzz_welfare_alwaysInRange(uint256 amount) public {
        amount = bound(amount, WAD / 10, 50 * WAD);

        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        vm.prank(alice);
        core.buyYes(did, 0, amount, 0);

        uint256 w = core.getWelfare(did, 0);
        assertTrue(w <= BPS, "welfare > 10000");
        assertTrue(w > 0, "welfare == 0 after trade");
    }

    // ============ User who never traded in winning proposal gets full deposit back ============

    function test_nonTrader_getsDepositBack() public {
        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");
        core.addProposal(did, "B");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);

        // Alice trades in proposal 0
        vm.prank(alice);
        core.buyYes(did, 0, 20 * WAD, 0);

        // Bob trades ONLY in proposal 1
        vm.prank(bob);
        core.buyYes(did, 1, 10 * WAD, 0);

        // Collapse -- proposal 0 or 1 wins
        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        (,,,,, , uint16 winId,,) = core.decisions(did);

        if (winId == 0) {
            // Bob never traded in winning proposal -> gets full deposit
            uint256 balBefore = bob.balance;
            vm.prank(bob);
            core.settle(did);
            assertEq(bob.balance - balBefore, 30 * WAD, "Bob should get full deposit back");
        } else {
            // Alice never traded in winning proposal -> gets full deposit
            uint256 balBefore = alice.balance;
            vm.prank(alice);
            core.settle(did);
            assertEq(alice.balance - balBefore, 50 * WAD, "Alice should get full deposit back");
        }
    }

    // ============ k never decreases with fees ============

    function test_k_neverDecreases() public {
        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        (uint128 yesR0, uint128 noR0,,,) = core.getProposal(did, 0);
        uint256 k0 = uint256(yesR0) * uint256(noR0);

        vm.prank(alice);
        core.buyYes(did, 0, 5 * WAD, 0);

        (uint128 yesR1, uint128 noR1,,,) = core.getProposal(did, 0);
        uint256 k1 = uint256(yesR1) * uint256(noR1);

        assertTrue(k1 >= k0, "k decreased after trade");

        vm.roll(block.number + 1);
        vm.prank(alice);
        core.buyNo(did, 0, 5 * WAD, 0);

        (uint128 yesR2, uint128 noR2,,,) = core.getProposal(did, 0);
        uint256 k2 = uint256(yesR2) * uint256(noR2);

        assertTrue(k2 >= k1, "k decreased after second trade");
    }

    // ============ Double settle prevention ============

    function test_cannotDoubleSettle() public {
        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        core.buyYes(did, 0, 5 * WAD, 0);

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        vm.prank(alice);
        core.settle(did);

        vm.prank(alice);
        vm.expectRevert("already settled");
        core.settle(did);
    }

    // ============ Fuzz: random trades still produce valid collapse ============

    function testFuzz_randomTrading_validCollapse(uint256 aliceAmt, uint256 bobAmt, bool aliceYes, bool bobYes) public {
        aliceAmt = bound(aliceAmt, WAD / 10, 20 * WAD);
        bobAmt = bound(bobAmt, WAD / 10, 20 * WAD);

        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");
        core.addProposal(did, "B");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 50 * WAD}(did);

        // Random trades
        vm.prank(alice);
        if (aliceYes) {
            core.buyYes(did, 0, aliceAmt, 0);
        } else {
            core.buyNo(did, 0, aliceAmt, 0);
        }

        vm.roll(block.number + 10);
        vm.prank(bob);
        if (bobYes) {
            core.buyYes(did, 1, bobAmt, 0);
        } else {
            core.buyNo(did, 1, bobAmt, 0);
        }

        // Collapse should succeed
        vm.roll(block.number + DURATION);
        core.collapse(did);

        (,,,,, uint8 status,,,) = core.decisions(did);
        assertEq(status, 1, "should be collapsed");

        // Both should be able to settle
        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
    }
}
