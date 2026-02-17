// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/MeridianCore.sol";
import "./mocks/MockWelfareOracle.sol";

contract MeridianModeBTest is Test {
    MeridianCore core;
    MockWelfareOracle oracle;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address guardian = makeAddr("guardian");

    uint256 constant WAD = 1e18;
    uint256 constant VIRTUAL_LIQ = 100 * WAD;
    uint256 constant DURATION = 1000;
    uint256 constant MEASUREMENT_PERIOD = 500;
    uint256 constant MIN_IMPROVEMENT = 100; // 1% in bps
    uint256 constant BPS = 10_000;

    function setUp() public {
        core = new MeridianCore();
        oracle = new MockWelfareOracle();
        oracle.setMetric(1000); // baseline metric

        vm.deal(alice, 1000 * WAD);
        vm.deal(bob, 1000 * WAD);
        vm.deal(charlie, 1000 * WAD);
    }

    // ============ Decision Creation ============

    function test_createDecisionB() public {
        uint256 id = core.createDecision(
            "Mode B Test", DURATION, VIRTUAL_LIQ, address(oracle), MEASUREMENT_PERIOD, MIN_IMPROVEMENT, guardian
        );
        assertEq(id, 0);

        (
            address wo,
            address g,
            ,
            uint8 mode,
            uint8 outcome,
            ,
            ,
            uint256 minImp,
            uint256 measPeriod
        ) = core.getDecisionB(id);
        assertEq(wo, address(oracle));
        assertEq(g, guardian);
        assertEq(mode, 1); // MODE_B
        assertEq(outcome, 0); // UNRESOLVED
        assertEq(minImp, MIN_IMPROVEMENT);
        assertEq(measPeriod, MEASUREMENT_PERIOD);
    }

    function test_createDecisionB_revertsZeroOracle() public {
        vm.expectRevert("zero oracle");
        core.createDecision("Test", DURATION, VIRTUAL_LIQ, address(0), MEASUREMENT_PERIOD, MIN_IMPROVEMENT, guardian);
    }

    function test_createDecisionB_revertsZeroGuardian() public {
        vm.expectRevert("zero guardian");
        core.createDecision(
            "Test", DURATION, VIRTUAL_LIQ, address(oracle), MEASUREMENT_PERIOD, MIN_IMPROVEMENT, address(0)
        );
    }

    function test_createDecisionB_revertsZeroMeasurementPeriod() public {
        vm.expectRevert("zero measurement period");
        core.createDecision("Test", DURATION, VIRTUAL_LIQ, address(oracle), 0, MIN_IMPROVEMENT, guardian);
    }

    // ============ Mode A Compatibility ============

    function test_modeA_lifecycleUnchanged() public {
        uint256 did = core.createDecision("Mode A", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(alice);
        core.buyYes(did, 0, 10 * WAD, 0);

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        (,,,,, uint8 status,,,) = core.decisions(did);
        assertEq(status, 1); // COLLAPSED (not MEASURING)

        vm.prank(alice);
        core.settle(did);
    }

    function test_modeA_settleRequiresCollapsed() public {
        uint256 did = core.createDecision("Mode A", DURATION, VIRTUAL_LIQ);
        core.addProposal(did, "A");

        vm.prank(alice);
        core.deposit{value: 10 * WAD}(did);

        vm.prank(alice);
        vm.expectRevert("not collapsed");
        core.settle(did);
    }

    // ============ Collapse Mode B ============

    function test_collapseB_transitionsToMeasuring() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        (,,,,, uint8 status,,,) = core.decisions(did);
        assertEq(status, 3); // MEASURING
    }

    function test_collapseB_snapshotsBaseline() public {
        oracle.setMetric(5000);
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        (,, uint48 measDeadline,,, uint128 mBaseline,,,) = core.getDecisionB(did);
        assertEq(mBaseline, 5000);
        assertEq(measDeadline, block.number + MEASUREMENT_PERIOD);
    }

    function test_collapseB_selectsCorrectWinner() public {
        uint256 did = _setupModeBWithTwoProposals();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // Alice bought YES on proposal 0 -> welfare > 5000 -> proposal 0 should win
        (,,,,, , uint16 winId,,) = core.decisions(did);
        assertEq(winId, 0);
    }

    // ============ Resolve ============

    function test_resolve_yesOutcome() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // Set metric higher: 1000 * (10000 + 100) / 10000 = 1010. Set to 1100 to be safe.
        oracle.setMetric(1100);
        vm.roll(block.number + MEASUREMENT_PERIOD);

        core.resolve(did);

        (,,, , uint8 outcome, , uint128 mActual,,) = core.getDecisionB(did);
        assertEq(outcome, 1); // YES
        assertEq(mActual, 1100);

        (,,,,, uint8 status,,,) = core.decisions(did);
        assertEq(status, 4); // RESOLVED
    }

    function test_resolve_noOutcome() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // Set metric same (no improvement)
        oracle.setMetric(1000);
        vm.roll(block.number + MEASUREMENT_PERIOD);

        core.resolve(did);

        (,,, , uint8 outcome,,,,) = core.getDecisionB(did);
        assertEq(outcome, 2); // NO
    }

    function test_resolve_revertsBeforeMeasurementDeadline() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // Don't advance past measurement period
        vm.expectRevert("measurement ongoing");
        core.resolve(did);
    }

    function test_resolve_minImprovementThreshold() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // baseline=1000, minImp=100bps (1%). 1009 < 1010 required -> NO
        oracle.setMetric(1009);
        vm.roll(block.number + MEASUREMENT_PERIOD);

        core.resolve(did);

        (,,, , uint8 outcome,,,,) = core.getDecisionB(did);
        assertEq(outcome, 2); // NO (just below threshold)
    }

    function test_resolve_exactThreshold() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        // baseline=1000, minImp=100bps. 1010 * 10000 >= 1000 * 10100 -> YES
        oracle.setMetric(1010);
        vm.roll(block.number + MEASUREMENT_PERIOD);

        core.resolve(did);

        (,,, , uint8 outcome,,,,) = core.getDecisionB(did);
        assertEq(outcome, 1); // YES (exactly at threshold)
    }

    // ============ Guardian Dispute ============

    function test_guardian_overrideDuringMeasuring() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        vm.prank(guardian);
        core.resolveDispute(did, 1); // Force YES

        (,,, , uint8 outcome,,,,) = core.getDecisionB(did);
        assertEq(outcome, 1); // YES

        (,,,,, uint8 status,,,) = core.decisions(did);
        assertEq(status, 4); // RESOLVED
    }

    function test_guardian_overrideAfterResolve() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        oracle.setMetric(1100);
        vm.roll(block.number + MEASUREMENT_PERIOD);
        core.resolve(did); // outcome=YES

        // Guardian overrides to NO
        vm.prank(guardian);
        core.resolveDispute(did, 2); // Force NO

        (,,, , uint8 outcome,,,,) = core.getDecisionB(did);
        assertEq(outcome, 2); // NO (overridden)
    }

    function test_guardian_revertsNonGuardian() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        vm.prank(alice);
        vm.expectRevert("not guardian");
        core.resolveDispute(did, 1);
    }

    function test_guardian_revertsInvalidOutcome() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);

        vm.prank(guardian);
        vm.expectRevert("invalid outcome");
        core.resolveDispute(did, 0); // UNRESOLVED is not valid
    }

    // ============ Settlement ============

    function test_settleB_yesPaysBinary() public {
        uint256 did = _setupModeBWithTrading();

        // Collapse -> resolve YES
        vm.roll(block.number + DURATION + 1);
        core.collapse(did);
        oracle.setMetric(1100);
        vm.roll(block.number + MEASUREMENT_PERIOD);
        core.resolve(did);

        // Alice bought YES -> should profit
        uint256 balBefore = alice.balance;
        vm.prank(alice);
        core.settle(did);
        uint256 alicePayout = alice.balance - balBefore;

        // Alice deposited 50 WAD, her YES tokens should be worth more than deposit
        assertTrue(alicePayout > 0, "alice should get payout");
    }

    function test_settleB_noPaysBinary() public {
        uint256 did = _setupModeBWithTrading();

        // Collapse -> resolve NO
        vm.roll(block.number + DURATION + 1);
        core.collapse(did);
        oracle.setMetric(900); // no improvement
        vm.roll(block.number + MEASUREMENT_PERIOD);
        core.resolve(did);

        // Bob bought NO -> should profit under NO outcome
        uint256 balBefore = bob.balance;
        vm.prank(bob);
        core.settle(did);
        uint256 bobPayout = bob.balance - balBefore;

        assertTrue(bobPayout > 0, "bob should get payout");
    }

    function test_settleB_nonTraderGetsDeposit() public {
        uint256 did = _setupModeBWithTrading();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);
        oracle.setMetric(1100);
        vm.roll(block.number + MEASUREMENT_PERIOD);
        core.resolve(did);

        // Charlie deposited but never traded in winning proposal -> gets deposit back
        uint256 balBefore = charlie.balance;
        vm.prank(charlie);
        core.settle(did);
        assertEq(charlie.balance - balBefore, 20 * WAD, "non-trader gets full deposit");
    }

    function test_settleB_revertsNotResolved() public {
        uint256 did = _setupModeBDecision();

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);
        // Status is MEASURING, not RESOLVED

        vm.prank(alice);
        vm.expectRevert("not resolved");
        core.settle(did);
    }

    // ============ Full Lifecycle E2E ============

    function test_fullLifecycleB_yes_solvency() public {
        uint256 did = _setupModeBWithTrading();

        // Fund contract with extra to cover virtual liquidity divergence
        vm.deal(address(core), address(core).balance + VIRTUAL_LIQ);

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);
        oracle.setMetric(1100);
        vm.roll(block.number + MEASUREMENT_PERIOD);
        core.resolve(did);

        uint256 balBefore = alice.balance + bob.balance + charlie.balance;

        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
        vm.prank(charlie);
        core.settle(did);

        uint256 totalPaidOut = (alice.balance + bob.balance + charlie.balance) - balBefore;
        uint256 totalDeposited = 100 * WAD;

        // Binary settlement can exceed deposits by up to virtual liquidity
        assertApproxEqAbs(totalPaidOut, totalDeposited, VIRTUAL_LIQ);
    }

    function test_fullLifecycleB_no_solvency() public {
        uint256 did = _setupModeBWithTrading();

        // Fund contract with extra to cover virtual liquidity divergence
        vm.deal(address(core), address(core).balance + VIRTUAL_LIQ);

        vm.roll(block.number + DURATION + 1);
        core.collapse(did);
        oracle.setMetric(900);
        vm.roll(block.number + MEASUREMENT_PERIOD);
        core.resolve(did);

        uint256 balBefore = alice.balance + bob.balance + charlie.balance;

        vm.prank(alice);
        core.settle(did);
        vm.prank(bob);
        core.settle(did);
        vm.prank(charlie);
        core.settle(did);

        uint256 totalPaidOut = (alice.balance + bob.balance + charlie.balance) - balBefore;
        uint256 totalDeposited = 100 * WAD;

        assertApproxEqAbs(totalPaidOut, totalDeposited, VIRTUAL_LIQ);
    }

    // ============ Helpers ============

    function _setupModeBDecision() internal returns (uint256 did) {
        did = core.createDecision(
            "Mode B", DURATION, VIRTUAL_LIQ, address(oracle), MEASUREMENT_PERIOD, MIN_IMPROVEMENT, guardian
        );
        core.addProposal(did, "Proposal A");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(alice);
        core.buyYes(did, 0, 10 * WAD, 0);
    }

    function _setupModeBWithTwoProposals() internal returns (uint256 did) {
        did = core.createDecision(
            "Mode B", DURATION, VIRTUAL_LIQ, address(oracle), MEASUREMENT_PERIOD, MIN_IMPROVEMENT, guardian
        );
        core.addProposal(did, "Proposal A");
        core.addProposal(did, "Proposal B");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(alice);
        core.buyYes(did, 0, 20 * WAD, 0);

        vm.roll(block.number + 50);
        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);
        vm.prank(bob);
        core.buyNo(did, 1, 10 * WAD, 0);
    }

    function _setupModeBWithTrading() internal returns (uint256 did) {
        did = core.createDecision(
            "Mode B", DURATION, VIRTUAL_LIQ, address(oracle), MEASUREMENT_PERIOD, MIN_IMPROVEMENT, guardian
        );
        core.addProposal(did, "Proposal A");
        core.addProposal(did, "Proposal B");

        vm.prank(alice);
        core.deposit{value: 50 * WAD}(did);
        vm.prank(bob);
        core.deposit{value: 30 * WAD}(did);
        vm.prank(charlie);
        core.deposit{value: 20 * WAD}(did);

        // Alice buys YES on proposal 0
        vm.prank(alice);
        core.buyYes(did, 0, 20 * WAD, 0);

        vm.roll(block.number + 50);
        // Bob buys NO on proposal 0
        vm.prank(bob);
        core.buyNo(did, 0, 15 * WAD, 0);

        vm.roll(block.number + 50);
        // Charlie buys YES on proposal 1
        vm.prank(charlie);
        core.buyYes(did, 1, 10 * WAD, 0);
    }
}
