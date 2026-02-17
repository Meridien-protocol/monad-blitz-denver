// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MeridianCore.sol";

contract MeridianCoreTest is Test {
    MeridianCore core;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    uint256 constant WAD = 1e18;
    uint256 constant VIRTUAL_LIQ = 100 * WAD;
    uint256 constant DURATION = 1000; // blocks

    function setUp() public {
        core = new MeridianCore();
        vm.deal(alice, 100 * WAD);
        vm.deal(bob, 100 * WAD);
        vm.deal(charlie, 100 * WAD);
    }

    // ============ Decision Creation ============

    function test_createDecision() public {
        uint256 id = core.createDecision("Hire Alice?", DURATION, VIRTUAL_LIQ);
        assertEq(id, 0);

        (address creator, uint48 deadline,,,,,,, string memory title) = core.decisions(id);
        assertEq(creator, address(this));
        assertEq(deadline, block.number + DURATION);
        assertEq(title, "Hire Alice?");
    }

    function test_createDecision_revertsEmptyTitle() public {
        vm.expectRevert("empty title");
        core.createDecision("", DURATION, VIRTUAL_LIQ);
    }

    // ============ Add Proposal ============

    function test_addProposal() public {
        uint256 did = core.createDecision("Hire?", DURATION, VIRTUAL_LIQ);
        uint256 pid = core.addProposal(did, "Hire Alice");
        assertEq(pid, 0);

        (uint128 yesR, uint128 noR,,, string memory title) = core.getProposal(did, pid);
        assertEq(yesR, VIRTUAL_LIQ);
        assertEq(noR, VIRTUAL_LIQ);
        assertEq(title, "Hire Alice");
    }

    // ============ Deposit ============

    function test_deposit() public {
        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        assertEq(core.getUserDeposit(alice, did), 10 * WAD);
    }

    function test_withdraw() public {
        uint256 did = core.createDecision("Test", DURATION, VIRTUAL_LIQ);

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        core.withdraw(did, 5 * WAD);

        assertEq(core.getUserDeposit(alice, did), 5 * WAD);
        assertEq(alice.balance, balBefore + 5 * WAD);
    }

    function test_withdraw_revertsWithPositions() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        core.buyYes(did, 0, 1 * WAD, 0);

        vm.prank(alice);
        vm.expectRevert("active positions");
        core.withdraw(did, 1 * WAD);
    }

    // ============ Buy YES ============

    function test_buyYes() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        vm.prank(alice);
        core.buyYes(did, 0, 10 * WAD, 0);

        (uint128 yesB, uint128 noB, uint128 spent) = core.getPosition(alice, did, 0);
        assertTrue(yesB > 0, "should have YES tokens");
        assertEq(noB, 0);
        assertEq(spent, 10 * WAD);
    }

    function test_buyYes_slippage() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        // Require impossibly high minYesOut
        vm.prank(alice);
        vm.expectRevert("slippage");
        core.buyYes(did, 0, 10 * WAD, type(uint256).max);
    }

    // ============ Buy NO ============

    function test_buyNo() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);

        vm.prank(bob);
        core.buyNo(did, 0, 5 * WAD, 0);

        (uint128 yesB, uint128 noB, uint128 spent) = core.getPosition(bob, did, 0);
        assertEq(yesB, 0);
        assertTrue(noB > 0, "should have NO tokens");
        assertEq(spent, 5 * WAD);
    }

    // ============ Welfare Changes After Trades ============

    function test_welfare_movesUp_afterBuyYes() public {
        uint256 did = _setupDecisionWithProposal();

        uint256 welfareBefore = core.getWelfare(did, 0);
        assertEq(welfareBefore, 5000); // 50%

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        vm.prank(alice);
        core.buyYes(did, 0, 10 * WAD, 0);

        uint256 welfareAfter = core.getWelfare(did, 0);
        assertTrue(welfareAfter > welfareBefore, "welfare should increase after buying YES");
    }

    function test_welfare_movesDown_afterBuyNo() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);

        vm.prank(alice);
        core.buyNo(did, 0, 10 * WAD, 0);

        uint256 welfareAfter = core.getWelfare(did, 0);
        assertTrue(welfareAfter < 5000, "welfare should decrease after buying NO");
    }

    // ============ Quantum Property: Trade in Multiple Proposals ============

    function test_quantumProperty() public {
        uint256 did = core.createDecision("Hire?", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "Hire Alice");
        core.addProposal(did, "Hire Bob");
        core.addProposal(did, "Status Quo");

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        // Alice can trade her full deposit in ALL proposals
        vm.prank(alice);
        core.buyYes(did, 0, 5 * WAD, 0); // 5 vMON in proposal 0

        vm.prank(alice);
        core.buyYes(did, 1, 5 * WAD, 0); // 5 vMON in proposal 1

        vm.prank(alice);
        core.buyNo(did, 2, 5 * WAD, 0); // 5 vMON in proposal 2

        // Alice's claimable for proposal 0: 10 - 5 = 5
        assertEq(core.getClaimable(alice, did, 0), 5 * WAD);
        // Alice's claimable for proposal 1: 10 - 5 = 5
        assertEq(core.getClaimable(alice, did, 1), 5 * WAD);
        // Alice's claimable for proposal 2: 10 - 5 = 5
        assertEq(core.getClaimable(alice, did, 2), 5 * WAD);
    }

    // ============ Collapse ============

    function test_collapse() public {
        uint256 did = _setupFullDecision();

        // Advance past deadline
        vm.roll(block.number + DURATION + 1);

        core.collapse(did);

        (,,,,, uint8 status, uint16 winId,,) = core.decisions(did);
        assertEq(status, 1); // COLLAPSED
        assertTrue(core.winningTwapWelfare(did) > 0, "TWAP should be > 0");
    }

    function test_collapse_revertsBeforeDeadline() public {
        uint256 did = _setupFullDecision();

        vm.expectRevert("before deadline");
        core.collapse(did);
    }

    // ============ Full Lifecycle: Create -> Trade -> Collapse -> Settle ============

    function test_fullLifecycle() public {
        // Create decision with 2 proposals
        uint256 did = core.createDecision("Hire?", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "Hire Alice");
        core.addProposal(did, "Hire Bob");

        // Alice deposits 50 MON, buys YES on Proposal 0
        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(alice);
        core.buyYes(did, 0, 20 * WAD, 0);

        // Bob deposits 30 MON, buys NO on Proposal 0
        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);
        vm.prank(bob);
        core.buyNo(did, 0, 15 * WAD, 0);

        // Charlie deposits 20 MON, buys YES on Proposal 1
        vm.prank(charlie);
        core.deposit{value: 20 * WAD}(did);
        vm.prank(charlie);
        core.buyYes(did, 1, 10 * WAD, 0);

        // Advance blocks and collapse
        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // Verify it's collapsed
        (,,,,, uint8 status,,,) = core.decisions(did);
        assertEq(status, 1);

        // All three settle
        uint256 aliceBalBefore = alice.balance;
        uint256 bobBalBefore = bob.balance;
        uint256 charlieBalBefore = charlie.balance;

        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
        vm.prank(charlie);
        core.settle(did);

        uint256 alicePayout = alice.balance - aliceBalBefore;
        uint256 bobPayout = bob.balance - bobBalBefore;
        uint256 charliePayout = charlie.balance - charlieBalBefore;

        // Total payouts should be close to total deposits (100 MON)
        // May differ slightly due to virtual liquidity divergence
        uint256 totalPayouts = alicePayout + bobPayout + charliePayout;
        uint256 totalDeposits = 100 * WAD;

        // Should be within 5% of total deposits (virtual liquidity bound)
        assertApproxEqRel(totalPayouts, totalDeposits, 5e16); // 5%

        // Charlie traded only in losing proposal -> should get back deposit
        assertEq(charliePayout, 20 * WAD, "charlie should get full deposit back");
    }

    function test_settle_revertsIfNotCollapsed() public {
        uint256 did = _setupFullDecision();

        vm.prank(alice);
        vm.expectRevert("not collapsed");
        core.settle(did);
    }

    function test_settle_revertsIfAlreadySettled() public {
        uint256 did = _setupFullDecision();
        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        vm.prank(alice);
        core.settle(did);

        vm.prank(alice);
        vm.expectRevert("already settled");
        core.settle(did);
    }

    // ============ Multi-block trading ============

    function test_multiBlockTrading() public {
        uint256 did = _setupDecisionWithProposal();

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 50 * WAD}(did);

        // Trade across multiple blocks
        vm.prank(alice);
        core.buyYes(did, 0, 5 * WAD, 0);

        vm.roll(block.number + 10);
        vm.prank(bob);
        core.buyNo(did, 0, 5 * WAD, 0);

        vm.roll(block.number + 10);
        vm.prank(alice);
        core.buyYes(did, 0, 5 * WAD, 0);

        // Welfare should reflect the trades
        uint256 w = core.getWelfare(did, 0);
        assertTrue(w > 5000, "net YES buying should push welfare up");
    }

    // ============ Helpers ============

    function _setupDecisionWithProposal() internal returns (uint256 did) {
        did = core.createDecision("Test Decision", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "Proposal A");
    }

    function _setupFullDecision() internal returns (uint256 did) {
        did = core.createDecision("Test Decision", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "Proposal A");
        core.addProposal(did, "Proposal B");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(alice);
        core.buyYes(did, 0, 20 * WAD, 0);

        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);
        vm.prank(bob);
        core.buyNo(did, 0, 10 * WAD, 0);

        vm.prank(charlie);
        core.deposit{value: 20 * WAD}(did);
        vm.prank(charlie);
        core.buyYes(did, 1, 10 * WAD, 0);
    }
}
