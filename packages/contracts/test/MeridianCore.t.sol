// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MeridianCore.sol";

contract MeridianCoreTest is Test {
    MeridianCore core;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address lpAlice = makeAddr("lpAlice");
    address lpBob = makeAddr("lpBob");

    uint256 constant WAD = 1e18;
    uint256 constant LP_LIQ = 10 * WAD; // per proposal
    uint256 constant DURATION = 1000; // blocks

    function setUp() public {
        core = new MeridianCore();
        vm.deal(alice, 100 * WAD);
        vm.deal(bob, 100 * WAD);
        vm.deal(charlie, 100 * WAD);
        vm.deal(lpAlice, 100 * WAD);
        vm.deal(lpBob, 100 * WAD);
    }

    // ============ Decision Creation (2) ============

    function test_createDecision() public {
        uint256 id = core.createDecision("Hire Alice?", DURATION);
        assertEq(id, 0);

        (address creator,, uint256 deadline, uint256 createdAt,,,,,, ) = core.decisions(id);
        assertEq(creator, address(this));
        assertEq(deadline, block.number + DURATION);
        assertEq(createdAt, block.number);
    }

    function test_createDecision_revertsEmptyTitle() public {
        vm.expectRevert("empty title");
        core.createDecision("", DURATION);
    }

    // ============ Add Proposal (2) ============

    function test_addProposal() public {
        uint256 did = core.createDecision("Hire?", DURATION);

        vm.prank(lpAlice);
        uint256 pid = core.addProposal{value: LP_LIQ}(did, "Hire Alice");
        assertEq(pid, 0);

        (address lp, uint256 yesR, uint256 noR, uint256 lpLiq,,,, string memory title) = core.getProposal(did, pid);
        assertEq(lp, lpAlice);
        assertEq(yesR, LP_LIQ / 2);
        assertEq(noR, LP_LIQ / 2);
        assertEq(lpLiq, LP_LIQ);
        assertEq(title, "Hire Alice");
    }

    function test_addProposal_revertsInsufficientLiquidity() public {
        uint256 did = core.createDecision("Hire?", DURATION);

        vm.prank(lpAlice);
        vm.expectRevert("insufficient liquidity");
        core.addProposal{value: 0.01 ether}(did, "Too cheap");
    }

    // ============ Deposit / Withdraw (3) ============

    function test_deposit() public {
        uint256 did = core.createDecision("Test", DURATION);

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        assertEq(core.getBalance(alice, did), 10 * WAD);
    }

    function test_withdraw() public {
        uint256 did = core.createDecision("Test", DURATION);

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        core.withdraw(did, 5 * WAD);

        assertEq(core.getBalance(alice, did), 5 * WAD);
        assertEq(alice.balance, balBefore + 5 * WAD);
    }

    function test_withdraw_revertsInsufficientBalance() public {
        uint256 did = core.createDecision("Test", DURATION);

        vm.prank(alice);
        core.deposit{value: 5 * WAD}(did);

        vm.prank(alice);
        vm.expectRevert("insufficient balance");
        core.withdraw(did, 10 * WAD);
    }

    // ============ Split / Merge (5) ============

    function test_split() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        core.split(did, 0, 5 * WAD);

        // Fee = 5 * 30 / 10000 = 0.015 WAD
        uint256 expectedEffective = 5 * WAD - (5 * WAD * 30 / 10_000);
        (uint256 yes, uint256 no, uint256 alloc) = core.getPosition(alice, did, 0);
        assertEq(yes, expectedEffective);
        assertEq(no, expectedEffective);
        assertEq(alloc, expectedEffective);

        // Balance reduced by full amount
        assertEq(core.getBalance(alice, did), 5 * WAD);
    }

    function test_split_feeCheck() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        core.split(did, 0, 10 * WAD);

        uint256 fee = 10 * WAD * 30 / 10_000; // 0.03 WAD
        (,,,,,,, uint256 collectedFees,,) = core.decisions(did);
        assertEq(collectedFees, fee);
    }

    function test_merge_roundTrip() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        core.split(did, 0, 5 * WAD);

        uint256 effective = 5 * WAD - (5 * WAD * 30 / 10_000);

        // Merge back the full effective amount
        vm.prank(alice);
        core.merge(did, 0, effective);

        (uint256 yes, uint256 no, uint256 alloc) = core.getPosition(alice, did, 0);
        assertEq(yes, 0);
        assertEq(no, 0);
        assertEq(alloc, 0);

        // Balance = original 5 remaining + effective merged back
        assertEq(core.getBalance(alice, did), 5 * WAD + effective);
    }

    function test_split_revertsInsufficientBalance() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 1 * WAD}(did);

        vm.prank(alice);
        vm.expectRevert("insufficient balance");
        core.split(did, 0, 5 * WAD);
    }

    function test_split_revertsAfterDeadline() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.roll(block.number + DURATION + 1);

        vm.prank(alice);
        vm.expectRevert("past deadline");
        core.split(did, 0, 5 * WAD);
    }

    // ============ Swap (5) ============

    function test_swapYesForNo() public {
        uint256 did = _setupDecisionWithProposal();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);

        (uint256 yesBefore,,) = core.getPosition(alice, did, 0);

        vm.prank(alice);
        core.swapYesForNo(did, 0, yesBefore / 2, 0);

        (uint256 yesAfter, uint256 noAfter,) = core.getPosition(alice, did, 0);
        assertTrue(yesAfter < yesBefore, "YES should decrease");
        assertTrue(noAfter > yesBefore, "NO should increase from swap");
    }

    function test_swapNoForYes() public {
        uint256 did = _setupDecisionWithProposal();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);

        (,uint256 noBefore,) = core.getPosition(alice, did, 0);

        vm.prank(alice);
        core.swapNoForYes(did, 0, noBefore / 2, 0);

        (uint256 yesAfter, uint256 noAfter,) = core.getPosition(alice, did, 0);
        assertTrue(yesAfter > noBefore, "YES should increase from swap");
        assertTrue(noAfter < noBefore, "NO should decrease");
    }

    function test_swap_priceMovement() public {
        uint256 did = _setupDecisionWithProposal();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);

        uint256 priceBefore = core.getYesPrice(did, 0);

        // Swap YES for NO -> more YES in pool -> YES price drops
        (uint256 yesBal,,) = core.getPosition(alice, did, 0);
        vm.prank(alice);
        core.swapYesForNo(did, 0, yesBal / 2, 0);

        uint256 priceAfter = core.getYesPrice(did, 0);
        assertTrue(priceAfter < priceBefore, "YES price should drop after selling YES");
    }

    function test_swap_slippageRevert() public {
        uint256 did = _setupDecisionWithProposal();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);

        (uint256 yesBal,,) = core.getPosition(alice, did, 0);

        vm.prank(alice);
        vm.expectRevert("slippage");
        core.swapYesForNo(did, 0, yesBal / 2, type(uint256).max);
    }

    function test_swap_revertsInsufficientBalance() public {
        uint256 did = _setupDecisionWithProposal();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);

        vm.prank(alice);
        vm.expectRevert("insufficient YES");
        core.swapYesForNo(did, 0, 100 * WAD, 0);
    }

    // ============ Collapse (3) ============

    function test_collapse_correctWinner() public {
        uint256 did = _setupTwoProposalDecision();

        // Alice buys YES heavily on proposal 0 -> push YES price up
        _depositAndSplit(alice, did, 0, 20 * WAD, 10 * WAD);
        (uint256 yesBal,,) = core.getPosition(alice, did, 0);
        vm.roll(block.number + 1);
        vm.prank(alice);
        core.swapNoForYes(did, 0, yesBal / 4, 0);

        // Bob buys NO on proposal 1 -> push YES price down
        _depositAndSplit(bob, did, 1, 20 * WAD, 10 * WAD);
        (,uint256 noBal,) = core.getPosition(bob, did, 1);
        vm.roll(block.number + 1);
        vm.prank(bob);
        core.swapYesForNo(did, 1, noBal / 4, 0);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        (,,,,,,,,, uint256 winId) = core.decisions(did);
        assertEq(winId, 0, "proposal 0 should win (higher YES TWAP)");
    }

    function test_collapse_revertsBeforeDeadline() public {
        uint256 did = _setupTwoProposalDecision();

        vm.expectRevert("before deadline");
        core.collapse(did);
    }

    function test_collapse_staleOracle() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");

        // No trades at all -> oracle is stale at deadline
        // But STALE_THRESHOLD is 12500 and DURATION is 1000
        // so with init at block 1 and deadline at block 1001, gap = 1000 < 12500 -> still active
        // To test staleness we need DURATION > STALE_THRESHOLD
        uint256 longDuration = 15_000;
        uint256 did2 = core.createDecision("Long", longDuration);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did2, "A");

        // No trades -> last update at init block, gap = 15000 > 12500 -> stale
        vm.roll(block.number + longDuration);
        core.collapse(did2);

        (,,,,,,,,uint8 status,) = core.decisions(did2);
        assertEq(status, 1); // Still collapses (just no valid winner)
    }

    // ============ Settlement (6) ============

    function test_settle_winningYesRedeems() public {
        uint256 did = _setupAndCollapse();

        (,,,,,,,,, uint256 winId) = core.decisions(did);

        // Alice split into proposal 0 and swapped NO->YES
        (uint256 aliceYes,,) = core.getPosition(alice, did, 0);

        if (winId == 0 && aliceYes > 0) {
            uint256 balBefore = alice.balance;
            vm.prank(alice);
            core.settle(did);
            uint256 payout = alice.balance - balBefore;
            // Payout should include YES tokens (1:1) + unallocated balance
            assertTrue(payout > 0, "alice should get payout");
        }
    }

    function test_settle_losingRefunded() public {
        // Setup: alice in proposal 0, bob in proposal 1
        uint256 did = _setupAndCollapseWithWinner();

        (,,,,,,,,, uint256 winId) = core.decisions(did);

        // Bob split into losing proposal -> should get allocation refunded
        uint256 losingId = winId == 0 ? 1 : 0;
        address loser = winId == 0 ? bob : alice;

        (,,uint256 loserAlloc) = core.getPosition(loser, did, losingId);
        uint256 balBefore = loser.balance;

        vm.prank(loser);
        core.settle(did);
        uint256 payout = loser.balance - balBefore;

        // Loser should get their allocation back plus any unallocated balance
        assertTrue(payout >= loserAlloc, "loser should get at least their allocation back");
    }

    function test_settle_nonTrader_principalPreserved() public {
        uint256 did = core.createDecision("Test", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "B");

        // Charlie deposits but never trades
        vm.prank(charlie);
        core.deposit{value: 10 * WAD}(did);

        // Alice trades to create price movement
        vm.prank(alice);
        core.deposit{value: 5 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 3 * WAD);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        uint256 charlieBefore = charlie.balance;
        vm.prank(charlie);
        core.settle(did);

        assertEq(charlie.balance - charlieBefore, 10 * WAD, "non-trader gets exact deposit back");
    }

    function test_settle_balanceReturned() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        // Only split 3 WAD, leaving 7 WAD as balance
        vm.prank(alice);
        core.split(did, 0, 3 * WAD);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        core.settle(did);
        uint256 payout = alice.balance - balBefore;

        // Should get at least the 7 WAD unallocated balance
        assertTrue(payout >= 7 * WAD, "unallocated balance should be returned");
    }

    function test_settle_revertsDoublSettle() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        vm.prank(alice);
        core.settle(did);

        vm.prank(alice);
        vm.expectRevert("already settled");
        core.settle(did);
    }

    function test_redeemLP_winning_and_losing() public {
        uint256 did = core.createDecision("Test", DURATION);

        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "B");

        // Create some trading activity to influence winner
        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 5 * WAD);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        (,,,,,,,,, uint256 winId) = core.decisions(did);

        // Winning LP redeems
        address winLP = winId == 0 ? lpAlice : lpBob;
        address loseLP = winId == 0 ? lpBob : lpAlice;

        uint256 winBefore = winLP.balance;
        vm.prank(winLP);
        core.redeemLP(did, winId);
        assertTrue(winLP.balance > winBefore, "winning LP should get payout");

        // Losing LP gets full liquidity back
        uint256 loseBefore = loseLP.balance;
        uint256 losingId = winId == 0 ? 1 : 0;
        vm.prank(loseLP);
        core.redeemLP(did, losingId);
        assertEq(loseLP.balance - loseBefore, LP_LIQ, "losing LP gets full liquidity back");
    }

    // ============ Full Lifecycle (3) ============

    function test_fullLifecycle_multiUserMultiProposal() public {
        uint256 did = core.createDecision("Hire?", DURATION);

        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "Hire Alice");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "Hire Bob");

        // Alice deposits, splits into both proposals
        vm.prank(alice);
        core.deposit{value: 20 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 8 * WAD);
        vm.prank(alice);
        core.split(did, 1, 8 * WAD);

        // Bob deposits, splits into proposal 1
        vm.prank(bob);
        core.deposit{value: 15 * WAD}(did);
        vm.prank(bob);
        core.split(did, 1, 10 * WAD);

        // Some swapping
        (uint256 aliceYes0,,) = core.getPosition(alice, did, 0);
        vm.roll(block.number + 1);
        vm.prank(alice);
        core.swapNoForYes(did, 0, aliceYes0 / 4, 0);

        // Collapse
        vm.roll(block.number + DURATION);
        core.collapse(did);

        (,,,,,,,,uint8 status,) = core.decisions(did);
        assertEq(status, 1, "should be collapsed");

        // Settle everyone
        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);

        // LP redeems
        vm.prank(lpAlice);
        core.redeemLP(did, 0);
        vm.prank(lpBob);
        core.redeemLP(did, 1);
    }

    function test_mergeArbitrage() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        // Split to get YES + NO
        vm.prank(alice);
        core.split(did, 0, 5 * WAD);

        uint256 effective = 5 * WAD - (5 * WAD * 30 / 10_000);

        // Merge gets back credits at no fee
        vm.prank(alice);
        core.merge(did, 0, effective);

        // Balance = 5 (remaining) + effective (merged back)
        uint256 bal = core.getBalance(alice, did);
        assertEq(bal, 5 * WAD + effective);
    }

    function test_quantumProperty_oneDepositMultipleProposals() public {
        uint256 did = core.createDecision("Hire?", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "Hire Alice");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "Hire Bob");

        // One deposit can split into ALL proposals
        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        core.split(did, 0, 5 * WAD);

        vm.prank(alice);
        core.split(did, 1, 5 * WAD);

        // Both proposals have positions
        (uint256 yes0, uint256 no0,) = core.getPosition(alice, did, 0);
        (uint256 yes1, uint256 no1,) = core.getPosition(alice, did, 1);

        assertTrue(yes0 > 0 && no0 > 0, "should have tokens in proposal 0");
        assertTrue(yes1 > 0 && no1 > 0, "should have tokens in proposal 1");
        assertEq(core.getBalance(alice, did), 0, "all credits used");
    }

    // ============ Fee Claiming ============

    function test_claimFees() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);
        vm.prank(alice);
        core.split(did, 0, 10 * WAD);

        vm.roll(block.number + DURATION);
        core.collapse(did);

        uint256 expectedFee = 10 * WAD * 30 / 10_000;
        (,,,,,,, uint256 fees,,) = core.decisions(did);
        assertEq(fees, expectedFee);

        uint256 creatorBefore = address(this).balance;
        core.claimFees(did);
        assertEq(address(this).balance - creatorBefore, expectedFee);
    }

    // ============ Helpers ============

    function _setupDecisionWithProposal() internal returns (uint256 did) {
        did = core.createDecision("Test Decision", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "Proposal A");
    }

    function _setupTwoProposalDecision() internal returns (uint256 did) {
        did = core.createDecision("Test Decision", DURATION);
        vm.prank(lpAlice);
        core.addProposal{value: LP_LIQ}(did, "Proposal A");
        vm.prank(lpBob);
        core.addProposal{value: LP_LIQ}(did, "Proposal B");
    }

    function _depositAndSplit(address user, uint256 did, uint256 pid, uint256 depositAmt, uint256 splitAmt) internal {
        vm.prank(user);
        core.deposit{value: depositAmt}(did);
        vm.prank(user);
        core.split(did, pid, splitAmt);
    }

    function _setupAndCollapse() internal returns (uint256 did) {
        did = _setupDecisionWithProposal();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);
        vm.roll(block.number + DURATION);
        core.collapse(did);
    }

    function _setupAndCollapseWithWinner() internal returns (uint256 did) {
        did = _setupTwoProposalDecision();
        _depositAndSplit(alice, did, 0, 10 * WAD, 5 * WAD);
        _depositAndSplit(bob, did, 1, 10 * WAD, 5 * WAD);

        // Push proposal 0 YES price up
        (uint256 aliceYes,,) = core.getPosition(alice, did, 0);
        vm.roll(block.number + 1);
        vm.prank(alice);
        core.swapNoForYes(did, 0, aliceYes / 4, 0);

        vm.roll(block.number + DURATION);
        core.collapse(did);
    }

    receive() external payable {}
}
