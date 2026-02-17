// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IMeridianCore.sol";
import "./interfaces/IWelfareOracle.sol";
import "./libraries/MeridianMath.sol";
import "./libraries/TWAPOracle.sol";

/// @title MeridianCore
/// @notice Singleton contract for Quantum Futarchy on Monad.
///         Mode A: Proportional TWAP resolution. Mode B: Outcome-based oracle resolution.
/// @dev All deposits are real MON. All trading is in virtual units tracked internally.
contract MeridianCore is IMeridianCore {
    using TWAPOracle for TWAPOracle.State;

    // ============ Constants ============

    uint256 public constant BPS = 10_000;
    uint256 public constant FEE_BPS = 30; // 0.3%
    uint256 public constant MAX_CHANGE_PER_BLOCK = 2; // bps
    uint256 public constant MAX_PROPOSALS = 20;
    uint256 public constant STALE_THRESHOLD = 12_500; // blocks (~1.4h on Monad)

    // ============ Structs ============

    struct Decision {
        address creator;
        uint48 deadline;
        uint48 createdAtBlock;
        uint128 totalDeposits;
        uint16 proposalCount;
        uint8 status; // 0=OPEN, 1=COLLAPSED, 2=SETTLED, 3=MEASURING, 4=RESOLVED, 5=DISPUTED
        uint16 winningProposalId;
        uint128 virtualLiquidity;
        string title;
    }

    struct DecisionB {
        address welfareOracle;
        address guardian;
        uint48 measuringDeadline;
        uint8 resolutionMode; // 0=MODE_A, 1=MODE_B
        uint8 outcome; // 0=UNRESOLVED, 1=YES, 2=NO
        uint128 mBaseline;
        uint128 mActual;
        uint256 minImprovement; // in bps
        uint256 measurementPeriod; // in blocks
    }

    struct Proposal {
        uint128 yesReserve;
        uint128 noReserve;
        uint128 totalVMonMinted;
        uint128 totalVolume;
        string title;
    }

    struct Position {
        uint128 yesBalance;
        uint128 noBalance;
        uint128 vMonSpent;
    }

    // ============ Storage ============

    uint256 public nextDecisionId;

    mapping(uint256 => Decision) public decisions;
    mapping(uint256 => DecisionB) public decisionsB;
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals;
    mapping(uint256 => mapping(uint256 => TWAPOracle.State)) internal oracles;

    mapping(uint256 => mapping(address => uint256)) public deposits;
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public claimed;
    mapping(uint256 => mapping(uint256 => mapping(address => Position))) public positions;
    mapping(uint256 => mapping(address => bool)) public settled;
    mapping(uint256 => mapping(address => bool)) public hasPosition;
    mapping(uint256 => uint256) public winningTwapWelfare;

    // ============ Decision Lifecycle ============

    /// @notice Create a Mode A decision (proportional TWAP resolution).
    function createDecision(string calldata title, uint256 durationInBlocks, uint256 virtualLiquidity)
        external
        returns (uint256 decisionId)
    {
        require(bytes(title).length > 0, "empty title");
        require(durationInBlocks > 0, "zero duration");
        require(virtualLiquidity > 0, "zero liquidity");

        decisionId = nextDecisionId++;

        Decision storage d = decisions[decisionId];
        d.creator = msg.sender;
        d.deadline = uint48(block.number + durationInBlocks);
        d.createdAtBlock = uint48(block.number);
        d.virtualLiquidity = uint128(virtualLiquidity);
        d.title = title;
        // decisionsB[decisionId].resolutionMode defaults to 0 (MODE_A)

        emit DecisionCreated(decisionId, msg.sender, title, d.deadline, virtualLiquidity);
    }

    /// @notice Create a Mode B decision (outcome-based oracle resolution).
    function createDecision(
        string calldata title,
        uint256 durationInBlocks,
        uint256 virtualLiquidity,
        address welfareOracle,
        uint256 measurementPeriod,
        uint256 minImprovement,
        address guardian
    ) external returns (uint256 decisionId) {
        require(bytes(title).length > 0, "empty title");
        require(durationInBlocks > 0, "zero duration");
        require(virtualLiquidity > 0, "zero liquidity");
        require(welfareOracle != address(0), "zero oracle");
        require(guardian != address(0), "zero guardian");
        require(measurementPeriod > 0, "zero measurement period");

        decisionId = nextDecisionId++;

        Decision storage d = decisions[decisionId];
        d.creator = msg.sender;
        d.deadline = uint48(block.number + durationInBlocks);
        d.createdAtBlock = uint48(block.number);
        d.virtualLiquidity = uint128(virtualLiquidity);
        d.title = title;

        DecisionB storage db = decisionsB[decisionId];
        db.resolutionMode = uint8(ResolutionMode.MODE_B);
        db.welfareOracle = welfareOracle;
        db.guardian = guardian;
        db.measurementPeriod = measurementPeriod;
        db.minImprovement = minImprovement;

        emit DecisionCreatedB(
            decisionId,
            msg.sender,
            title,
            d.deadline,
            virtualLiquidity,
            welfareOracle,
            guardian,
            measurementPeriod,
            minImprovement
        );
    }

    function addProposal(uint256 decisionId, string calldata title) external returns (uint256 proposalId) {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number < d.deadline, "past deadline");
        require(d.proposalCount < MAX_PROPOSALS, "max proposals");
        require(bytes(title).length > 0, "empty title");

        proposalId = d.proposalCount++;
        uint256 L = uint256(d.virtualLiquidity);

        Proposal storage p = proposals[decisionId][proposalId];
        p.yesReserve = uint128(L);
        p.noReserve = uint128(L);
        p.title = title;

        oracles[decisionId][proposalId].init(block.number);

        emit ProposalAdded(decisionId, proposalId, msg.sender, title);
    }

    // ============ Capital ============

    function deposit(uint256 decisionId) external payable {
        require(msg.value > 0, "zero deposit");
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");

        deposits[decisionId][msg.sender] += msg.value;
        d.totalDeposits += uint128(msg.value);

        emit Deposited(msg.sender, decisionId, msg.value);
    }

    function withdraw(uint256 decisionId, uint256 amount) external {
        require(amount > 0, "zero amount");
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(!hasPosition[decisionId][msg.sender], "active positions");

        uint256 userDeposit = deposits[decisionId][msg.sender];
        require(userDeposit >= amount, "insufficient deposit");

        deposits[decisionId][msg.sender] = userDeposit - amount;
        d.totalDeposits -= uint128(amount);

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, decisionId, amount);
    }

    // ============ Trading ============

    function buyYes(uint256 decisionId, uint256 proposalId, uint256 amount, uint256 minYesOut) external {
        _validateTrade(decisionId, proposalId, amount);
        _claimVMon(decisionId, proposalId, msg.sender, amount);

        Proposal storage p = proposals[decisionId][proposalId];
        _updateOracle(decisionId, proposalId, p);

        uint256 yesOut = _executeBuyYes(p, amount);
        require(yesOut >= minYesOut, "slippage");

        Position storage pos = positions[decisionId][proposalId][msg.sender];
        pos.yesBalance += uint128(yesOut);
        pos.vMonSpent += uint128(amount);
        hasPosition[decisionId][msg.sender] = true;

        emit Trade(
            msg.sender,
            decisionId,
            proposalId,
            true,
            amount,
            yesOut,
            MeridianMath.welfare(uint256(p.yesReserve), uint256(p.noReserve))
        );
    }

    function buyNo(uint256 decisionId, uint256 proposalId, uint256 amount, uint256 minNoOut) external {
        _validateTrade(decisionId, proposalId, amount);
        _claimVMon(decisionId, proposalId, msg.sender, amount);

        Proposal storage p = proposals[decisionId][proposalId];
        _updateOracle(decisionId, proposalId, p);

        uint256 noOut = _executeBuyNo(p, amount);
        require(noOut >= minNoOut, "slippage");

        Position storage pos = positions[decisionId][proposalId][msg.sender];
        pos.noBalance += uint128(noOut);
        pos.vMonSpent += uint128(amount);
        hasPosition[decisionId][msg.sender] = true;

        emit Trade(
            msg.sender,
            decisionId,
            proposalId,
            false,
            amount,
            noOut,
            MeridianMath.welfare(uint256(p.yesReserve), uint256(p.noReserve))
        );
    }

    function sellYes(uint256 decisionId, uint256 proposalId, uint256 yesAmount, uint256 minVmonOut) external {
        _validateTrade(decisionId, proposalId, yesAmount);

        Position storage pos = positions[decisionId][proposalId][msg.sender];
        require(pos.yesBalance >= yesAmount, "insufficient YES");

        Proposal storage p = proposals[decisionId][proposalId];
        _updateOracle(decisionId, proposalId, p);

        uint256 vMonOut = MeridianMath.calcSellYes(uint256(p.yesReserve), uint256(p.noReserve), yesAmount);
        require(vMonOut >= minVmonOut, "slippage");

        // Update reserves: sell (yesAmount - vMonOut) YES to pool, redeem vMonOut pairs
        p.yesReserve += uint128(yesAmount - vMonOut);
        p.noReserve -= uint128(vMonOut);
        pos.yesBalance -= uint128(yesAmount);
        if (pos.yesBalance == 0 && pos.noBalance == 0) pos.vMonSpent = 0;

        claimed[decisionId][proposalId][msg.sender] -= vMonOut;

        emit Trade(
            msg.sender,
            decisionId,
            proposalId,
            true,
            yesAmount,
            vMonOut,
            MeridianMath.welfare(uint256(p.yesReserve), uint256(p.noReserve))
        );
    }

    function sellNo(uint256 decisionId, uint256 proposalId, uint256 noAmount, uint256 minVmonOut) external {
        _validateTrade(decisionId, proposalId, noAmount);

        Position storage pos = positions[decisionId][proposalId][msg.sender];
        require(pos.noBalance >= noAmount, "insufficient NO");

        Proposal storage p = proposals[decisionId][proposalId];
        _updateOracle(decisionId, proposalId, p);

        uint256 vMonOut = MeridianMath.calcSellNo(uint256(p.yesReserve), uint256(p.noReserve), noAmount);
        require(vMonOut >= minVmonOut, "slippage");

        p.noReserve += uint128(noAmount - vMonOut);
        p.yesReserve -= uint128(vMonOut);
        pos.noBalance -= uint128(noAmount);
        if (pos.yesBalance == 0 && pos.noBalance == 0) pos.vMonSpent = 0;

        claimed[decisionId][proposalId][msg.sender] -= vMonOut;

        emit Trade(
            msg.sender,
            decisionId,
            proposalId,
            false,
            noAmount,
            vMonOut,
            MeridianMath.welfare(uint256(p.yesReserve), uint256(p.noReserve))
        );
    }

    // ============ Resolution ============

    function collapse(uint256 decisionId) external {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number >= d.deadline, "before deadline");
        require(d.proposalCount > 0, "no proposals");

        uint256 bestProposal;
        uint256 bestTwap;

        for (uint256 i; i < d.proposalCount; i++) {
            TWAPOracle.State storage oracle = oracles[decisionId][i];

            // Check staleness BEFORE finalize (finalize updates lastUpdateBlock)
            bool active = oracle.isActive(d.deadline, STALE_THRESHOLD);

            oracle.finalize(d.deadline); // Finalize up to deadline, not current block

            if (!active) continue;

            uint256 twap = oracle.readTwap();
            if (twap > bestTwap) {
                bestTwap = twap;
                bestProposal = i;
            }
        }

        d.winningProposalId = uint16(bestProposal);
        winningTwapWelfare[decisionId] = bestTwap;

        DecisionB storage db = decisionsB[decisionId];
        if (db.resolutionMode == uint8(ResolutionMode.MODE_B)) {
            // Mode B: snapshot baseline metric, transition to MEASURING
            uint256 baseline = IWelfareOracle(db.welfareOracle).getMetric();
            db.mBaseline = uint128(baseline);
            db.measuringDeadline = uint48(block.number + db.measurementPeriod);
            d.status = uint8(Status.MEASURING);

            emit MeasurementStarted(decisionId, bestProposal, baseline, db.measuringDeadline);
        } else {
            // Mode A: standard collapse
            d.status = uint8(Status.COLLAPSED);

            emit Collapsed(decisionId, bestProposal, bestTwap);
        }
    }

    /// @notice Resolve a Mode B decision by reading the welfare oracle after measurement period.
    function resolve(uint256 decisionId) external {
        Decision storage d = decisions[decisionId];
        require(d.status == uint8(Status.MEASURING), "not measuring");

        DecisionB storage db = decisionsB[decisionId];
        require(block.number >= db.measuringDeadline, "measurement ongoing");

        uint256 actual = IWelfareOracle(db.welfareOracle).getMetric();
        db.mActual = uint128(actual);

        // YES if actual * BPS >= baseline * (BPS + minImprovement), else NO
        if (uint256(actual) * BPS >= uint256(db.mBaseline) * (BPS + db.minImprovement)) {
            db.outcome = uint8(Outcome.YES);
        } else {
            db.outcome = uint8(Outcome.NO);
        }

        d.status = uint8(Status.RESOLVED);

        emit Resolved(decisionId, db.outcome, db.mBaseline, uint128(actual));
    }

    /// @notice Guardian override for Mode B decisions (from MEASURING or RESOLVED state).
    function resolveDispute(uint256 decisionId, uint8 outcome) external {
        Decision storage d = decisions[decisionId];
        require(
            d.status == uint8(Status.MEASURING) || d.status == uint8(Status.RESOLVED),
            "not measuring or resolved"
        );

        DecisionB storage db = decisionsB[decisionId];
        require(msg.sender == db.guardian, "not guardian");
        require(outcome == uint8(Outcome.YES) || outcome == uint8(Outcome.NO), "invalid outcome");

        db.outcome = outcome;
        d.status = uint8(Status.RESOLVED);

        emit DisputeResolved(decisionId, msg.sender, outcome);
    }

    function settle(uint256 decisionId) external {
        Decision storage d = decisions[decisionId];
        DecisionB storage db = decisionsB[decisionId];

        if (db.resolutionMode == uint8(ResolutionMode.MODE_B)) {
            require(d.status == uint8(Status.RESOLVED), "not resolved");
        } else {
            require(d.status == uint8(Status.COLLAPSED), "not collapsed");
        }

        require(!settled[decisionId][msg.sender], "already settled");
        require(deposits[decisionId][msg.sender] > 0, "no deposit");

        settled[decisionId][msg.sender] = true;

        uint256 payout;
        if (db.resolutionMode == uint8(ResolutionMode.MODE_B)) {
            payout = _calcPayoutB(decisionId, d.winningProposalId, msg.sender, db.outcome);
        } else {
            payout = _calcPayout(decisionId, d.winningProposalId, msg.sender);
        }

        if (payout > 0) {
            (bool ok,) = msg.sender.call{value: payout}("");
            require(ok, "transfer failed");
        }

        int256 pnl = int256(payout) - int256(deposits[decisionId][msg.sender]);
        emit Settled(msg.sender, decisionId, payout, pnl);
    }

    // ============ View ============

    function getWelfare(uint256 decisionId, uint256 proposalId) external view returns (uint256) {
        Proposal storage p = proposals[decisionId][proposalId];
        if (p.yesReserve == 0 && p.noReserve == 0) return 5000;
        return MeridianMath.welfare(uint256(p.yesReserve), uint256(p.noReserve));
    }

    function getUserDeposit(address user, uint256 decisionId) external view returns (uint256) {
        return deposits[decisionId][user];
    }

    function getClaimable(address user, uint256 decisionId, uint256 proposalId) external view returns (uint256) {
        return deposits[decisionId][user] - claimed[decisionId][proposalId][user];
    }

    function getPosition(address user, uint256 decisionId, uint256 proposalId)
        external
        view
        returns (uint128 yesBalance, uint128 noBalance, uint128 vMonSpent)
    {
        Position storage pos = positions[decisionId][proposalId][user];
        return (pos.yesBalance, pos.noBalance, pos.vMonSpent);
    }

    function getProposal(uint256 decisionId, uint256 proposalId)
        external
        view
        returns (uint128 yesReserve, uint128 noReserve, uint128 totalVMonMinted, uint128 totalVolume, string memory title)
    {
        Proposal storage p = proposals[decisionId][proposalId];
        return (p.yesReserve, p.noReserve, p.totalVMonMinted, p.totalVolume, p.title);
    }

    function getDecisionB(uint256 decisionId)
        external
        view
        returns (
            address welfareOracle,
            address guardian,
            uint48 measuringDeadline,
            uint8 resolutionMode,
            uint8 outcome,
            uint128 mBaseline,
            uint128 mActual,
            uint256 minImprovement,
            uint256 measurementPeriod
        )
    {
        DecisionB storage db = decisionsB[decisionId];
        return (
            db.welfareOracle,
            db.guardian,
            db.measuringDeadline,
            db.resolutionMode,
            db.outcome,
            db.mBaseline,
            db.mActual,
            db.minImprovement,
            db.measurementPeriod
        );
    }

    // ============ Internal ============

    function _validateTrade(uint256 decisionId, uint256 proposalId, uint256 amount) internal view {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number < d.deadline, "past deadline");
        require(proposalId < d.proposalCount, "invalid proposal");
        require(amount > 0, "zero amount");
    }

    function _updateOracle(uint256 decisionId, uint256 proposalId, Proposal storage p) internal {
        uint256 w = MeridianMath.welfare(uint256(p.yesReserve), uint256(p.noReserve));
        oracles[decisionId][proposalId].update(w, MAX_CHANGE_PER_BLOCK, block.number);
    }

    function _executeBuyYes(Proposal storage p, uint256 amount) internal returns (uint256 yesOut) {
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(amount, FEE_BPS);
        yesOut = MeridianMath.calcBuyYes(uint256(p.yesReserve), uint256(p.noReserve), effective);

        (uint256 newYesR, uint256 newNoR) =
            MeridianMath.reservesAfterBuyYes(uint256(p.yesReserve), uint256(p.noReserve), effective, fee);
        p.yesReserve = uint128(newYesR);
        p.noReserve = uint128(newNoR);
        p.totalVMonMinted += uint128(amount);
        p.totalVolume += uint128(amount);
    }

    function _executeBuyNo(Proposal storage p, uint256 amount) internal returns (uint256 noOut) {
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(amount, FEE_BPS);
        noOut = MeridianMath.calcBuyNo(uint256(p.yesReserve), uint256(p.noReserve), effective);

        (uint256 newYesR, uint256 newNoR) =
            MeridianMath.reservesAfterBuyNo(uint256(p.yesReserve), uint256(p.noReserve), effective, fee);
        p.yesReserve = uint128(newYesR);
        p.noReserve = uint128(newNoR);
        p.totalVMonMinted += uint128(amount);
        p.totalVolume += uint128(amount);
    }

    function _claimVMon(uint256 decisionId, uint256 proposalId, address user, uint256 amount) internal {
        uint256 claimable = deposits[decisionId][user] - claimed[decisionId][proposalId][user];
        require(claimable >= amount, "insufficient vMON");
        claimed[decisionId][proposalId][user] += amount;
    }

    /// @dev Mode A payout: proportional TWAP settlement.
    function _calcPayout(uint256 decisionId, uint16 winningId, address user) internal view returns (uint256 payout) {
        uint256 userDeposit = deposits[decisionId][user];
        uint256 W = winningTwapWelfare[decisionId];

        Position storage pos = positions[decisionId][uint256(winningId)][user];
        int256 pnl;

        if (pos.yesBalance > 0 || pos.noBalance > 0) {
            uint256 yesValue = (uint256(pos.yesBalance) * W) / BPS;
            uint256 noValue = (uint256(pos.noBalance) * (BPS - W)) / BPS;
            pnl = int256(yesValue + noValue) - int256(uint256(pos.vMonSpent));
        }

        if (pnl >= 0) {
            payout = userDeposit + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            payout = loss >= userDeposit ? 0 : userDeposit - loss;
        }
    }

    /// @dev Mode B payout: binary settlement based on oracle outcome.
    ///      YES outcome: YES tokens pay 1:1, NO tokens pay 0.
    ///      NO outcome:  NO tokens pay 1:1, YES tokens pay 0.
    function _calcPayoutB(uint256 decisionId, uint16 winningId, address user, uint8 outcome)
        internal
        view
        returns (uint256 payout)
    {
        uint256 userDeposit = deposits[decisionId][user];

        Position storage pos = positions[decisionId][uint256(winningId)][user];
        int256 pnl;

        if (pos.yesBalance > 0 || pos.noBalance > 0) {
            uint256 tokenValue;
            if (outcome == uint8(Outcome.YES)) {
                tokenValue = uint256(pos.yesBalance);
            } else {
                tokenValue = uint256(pos.noBalance);
            }
            pnl = int256(tokenValue) - int256(uint256(pos.vMonSpent));
        }

        if (pnl >= 0) {
            payout = userDeposit + uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            payout = loss >= userDeposit ? 0 : userDeposit - loss;
        }
    }
}
