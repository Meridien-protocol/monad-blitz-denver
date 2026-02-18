// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IMeridianCore.sol";
import "./libraries/MeridianMath.sol";
import "./libraries/TWAPOracle.sol";

/// @title MeridianCore
/// @notice Quantum Futarchy on Monad. Users deposit MON, split credits into
///         conditional YES/NO tokens per proposal, and the winning proposal is
///         determined by highest YES TWAP. Winner-takes-all settlement with
///         principal preservation for non-traders.
contract MeridianCore is IMeridianCore {
    using TWAPOracle for TWAPOracle.State;

    // ============ Constants ============

    uint256 public constant BPS = 10_000;
    uint256 public constant SPLIT_FEE_BPS = 30; // 0.3% on split
    uint256 public constant TRADE_FEE_BPS = 30; // 0.3% on swap
    uint256 public constant MAX_CHANGE_PER_BLOCK = 2; // bps
    uint256 public constant MAX_PROPOSALS = 32;
    uint256 public constant STALE_THRESHOLD = 12_500; // blocks (~1.4h on Monad)
    uint256 public constant MIN_LIQUIDITY = 1e17; // 0.1 MON

    // ============ Structs ============

    struct Decision {
        address creator;
        string title;
        uint256 deadline; // block number
        uint256 createdAtBlock;
        uint256 proposalCount;
        uint256 totalDeposits; // sum of all user deposits
        uint256 totalLPLiquidity; // sum of all LP liquidity
        uint256 collectedFees; // split+trade fees
        uint8 status; // 0=OPEN, 1=COLLAPSED, 2=SETTLED
        uint256 winningProposalId;
    }

    struct Proposal {
        address lpProvider; // who funded this AMM
        string title;
        uint256 yesReserve; // AMM reserve (real, funded by LP)
        uint256 noReserve; // AMM reserve (real, funded by LP)
        uint256 lpLiquidity; // initial MON provided by LP
        uint256 totalAllocated; // sum of user splits into this proposal
        uint256 totalVolume;
        bool lpRedeemed;
    }

    // ============ Storage ============

    uint256 public nextDecisionId;

    mapping(uint256 => Decision) public decisions;
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals;

    /// @notice User credits (unallocated balance) per decision.
    mapping(uint256 => mapping(address => uint256)) public balances;

    /// @notice Credits allocated per proposal per user (via split).
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public allocated;

    /// @notice YES token balance per proposal per user.
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public yesBalance;

    /// @notice NO token balance per proposal per user.
    mapping(uint256 => mapping(uint256 => mapping(address => uint256))) public noBalance;

    mapping(uint256 => mapping(uint256 => TWAPOracle.State)) internal oracles;
    mapping(uint256 => mapping(address => bool)) public settled;

    // ============ Decision Lifecycle ============

    function createDecision(string calldata title, uint256 durationInBlocks) external returns (uint256 decisionId) {
        require(bytes(title).length > 0, "empty title");
        require(durationInBlocks > 0, "zero duration");

        decisionId = nextDecisionId++;

        Decision storage d = decisions[decisionId];
        d.creator = msg.sender;
        d.title = title;
        d.deadline = block.number + durationInBlocks;
        d.createdAtBlock = block.number;

        emit DecisionCreated(decisionId, msg.sender, title, d.deadline);
    }

    function addProposal(uint256 decisionId, string calldata title)
        external
        payable
        returns (uint256 proposalId)
    {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number < d.deadline, "past deadline");
        require(d.proposalCount < MAX_PROPOSALS, "max proposals");
        require(bytes(title).length > 0, "empty title");
        require(msg.value >= MIN_LIQUIDITY, "insufficient liquidity");

        proposalId = d.proposalCount++;

        Proposal storage p = proposals[decisionId][proposalId];
        p.lpProvider = msg.sender;
        p.title = title;
        // Split LP liquidity equally between YES and NO reserves
        uint256 halfLiq = msg.value / 2;
        p.yesReserve = halfLiq;
        p.noReserve = msg.value - halfLiq; // handles odd wei
        p.lpLiquidity = msg.value;

        d.totalLPLiquidity += msg.value;

        oracles[decisionId][proposalId].init(block.number);

        emit ProposalAdded(decisionId, proposalId, msg.sender, title, msg.value);
    }

    // ============ Capital ============

    function deposit(uint256 decisionId) external payable {
        require(msg.value > 0, "zero deposit");
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");

        balances[decisionId][msg.sender] += msg.value;
        d.totalDeposits += msg.value;

        emit Deposited(msg.sender, decisionId, msg.value);
    }

    function withdraw(uint256 decisionId, uint256 amount) external {
        require(amount > 0, "zero amount");
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");

        uint256 bal = balances[decisionId][msg.sender];
        require(bal >= amount, "insufficient balance");

        balances[decisionId][msg.sender] = bal - amount;
        d.totalDeposits -= amount;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        emit Withdrawn(msg.sender, decisionId, amount);
    }

    // ============ Split / Merge ============

    function split(uint256 decisionId, uint256 proposalId, uint256 amount) external {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number < d.deadline, "past deadline");
        require(proposalId < d.proposalCount, "invalid proposal");
        require(amount > 0, "zero amount");

        uint256 bal = balances[decisionId][msg.sender];
        require(bal >= amount, "insufficient balance");

        // Apply split fee
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(amount, SPLIT_FEE_BPS);

        balances[decisionId][msg.sender] = bal - amount;
        d.collectedFees += fee;

        allocated[decisionId][proposalId][msg.sender] += effective;
        yesBalance[decisionId][proposalId][msg.sender] += effective;
        noBalance[decisionId][proposalId][msg.sender] += effective;

        Proposal storage p = proposals[decisionId][proposalId];
        p.totalAllocated += effective;

        // Update oracle before any price-affecting action
        _updateOracle(decisionId, proposalId, p);

        emit Split(msg.sender, decisionId, proposalId, effective, fee);
    }

    function merge(uint256 decisionId, uint256 proposalId, uint256 amount) external {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number < d.deadline, "past deadline");
        require(proposalId < d.proposalCount, "invalid proposal");
        require(amount > 0, "zero amount");

        require(yesBalance[decisionId][proposalId][msg.sender] >= amount, "insufficient YES");
        require(noBalance[decisionId][proposalId][msg.sender] >= amount, "insufficient NO");

        yesBalance[decisionId][proposalId][msg.sender] -= amount;
        noBalance[decisionId][proposalId][msg.sender] -= amount;
        allocated[decisionId][proposalId][msg.sender] -= amount;

        Proposal storage p = proposals[decisionId][proposalId];
        p.totalAllocated -= amount;

        // No fee on merge (enables arbitrage)
        balances[decisionId][msg.sender] += amount;

        // Update oracle
        _updateOracle(decisionId, proposalId, p);

        emit Merged(msg.sender, decisionId, proposalId, amount);
    }

    // ============ Swap ============

    function swapYesForNo(uint256 decisionId, uint256 proposalId, uint256 yesIn, uint256 minNoOut) external {
        _validateSwap(decisionId, proposalId, yesIn);
        require(yesBalance[decisionId][proposalId][msg.sender] >= yesIn, "insufficient YES");

        Proposal storage p = proposals[decisionId][proposalId];

        // Update oracle BEFORE modifying reserves
        _updateOracle(decisionId, proposalId, p);

        // Apply trade fee
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(yesIn, TRADE_FEE_BPS);

        // Swap: YES -> NO
        uint256 noOut = MeridianMath.calcSwapOutput(p.yesReserve, p.noReserve, effective);
        require(noOut >= minNoOut, "slippage");

        // Update reserves: input YES goes in, output NO comes out, fee stays in reserves
        p.yesReserve += effective + fee;
        p.noReserve -= noOut;

        // Update user balances
        yesBalance[decisionId][proposalId][msg.sender] -= yesIn;
        noBalance[decisionId][proposalId][msg.sender] += noOut;

        p.totalVolume += yesIn;

        uint256 price = MeridianMath.yesPrice(p.yesReserve, p.noReserve);
        emit Swapped(msg.sender, decisionId, proposalId, true, yesIn, noOut, price);
    }

    function swapNoForYes(uint256 decisionId, uint256 proposalId, uint256 noIn, uint256 minYesOut) external {
        _validateSwap(decisionId, proposalId, noIn);
        require(noBalance[decisionId][proposalId][msg.sender] >= noIn, "insufficient NO");

        Proposal storage p = proposals[decisionId][proposalId];

        // Update oracle BEFORE modifying reserves
        _updateOracle(decisionId, proposalId, p);

        // Apply trade fee
        (uint256 effective, uint256 fee) = MeridianMath.applyFee(noIn, TRADE_FEE_BPS);

        // Swap: NO -> YES
        uint256 yesOut = MeridianMath.calcSwapOutput(p.noReserve, p.yesReserve, effective);
        require(yesOut >= minYesOut, "slippage");

        // Update reserves
        p.noReserve += effective + fee;
        p.yesReserve -= yesOut;

        // Update user balances
        noBalance[decisionId][proposalId][msg.sender] -= noIn;
        yesBalance[decisionId][proposalId][msg.sender] += yesOut;

        p.totalVolume += noIn;

        uint256 price = MeridianMath.yesPrice(p.yesReserve, p.noReserve);
        emit Swapped(msg.sender, decisionId, proposalId, false, noIn, yesOut, price);
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

            // Check staleness BEFORE finalize
            bool active = oracle.isActive(d.deadline, STALE_THRESHOLD);

            oracle.finalize(d.deadline);

            if (!active) continue;

            uint256 twap = oracle.readTwap();
            if (twap > bestTwap) {
                bestTwap = twap;
                bestProposal = i;
            }
        }

        d.winningProposalId = bestProposal;
        d.status = 1; // COLLAPSED

        emit Collapsed(decisionId, bestProposal, bestTwap);
    }

    function settle(uint256 decisionId) external {
        Decision storage d = decisions[decisionId];
        require(d.status == 1, "not collapsed");
        require(!settled[decisionId][msg.sender], "already settled");

        // Must have had some involvement
        bool hasBalance = balances[decisionId][msg.sender] > 0;
        bool hasAllocation;
        for (uint256 i; i < d.proposalCount; i++) {
            if (allocated[decisionId][i][msg.sender] > 0) {
                hasAllocation = true;
                break;
            }
        }
        require(hasBalance || hasAllocation, "nothing to settle");

        settled[decisionId][msg.sender] = true;

        uint256 payout = _calcPayout(decisionId, d);

        if (payout > 0) {
            (bool ok,) = msg.sender.call{value: payout}("");
            require(ok, "transfer failed");
        }

        emit Settled(msg.sender, decisionId, payout);
    }

    function redeemLP(uint256 decisionId, uint256 proposalId) external {
        Decision storage d = decisions[decisionId];
        require(d.status == 1, "not collapsed");
        require(proposalId < d.proposalCount, "invalid proposal");

        Proposal storage p = proposals[decisionId][proposalId];
        require(msg.sender == p.lpProvider, "not LP");
        require(!p.lpRedeemed, "already redeemed");

        p.lpRedeemed = true;

        uint256 payout;
        if (proposalId == d.winningProposalId) {
            // Winning LP gets lpLiquidity/2 + yesReserve.
            // This ensures exact solvency: total user YES payouts + LP payout = totalAllocated + lpLiquidity.
            payout = p.lpLiquidity / 2 + p.yesReserve;
        } else {
            // Losing LP gets full liquidity back
            payout = p.lpLiquidity;
        }

        if (payout > 0) {
            (bool ok,) = msg.sender.call{value: payout}("");
            require(ok, "transfer failed");
        }

        emit LPRedeemed(msg.sender, decisionId, proposalId, payout);
    }

    function claimFees(uint256 decisionId) external {
        Decision storage d = decisions[decisionId];
        require(d.status == 1, "not collapsed");
        require(msg.sender == d.creator, "not creator");
        require(d.collectedFees > 0, "no fees");

        uint256 fees = d.collectedFees;
        d.collectedFees = 0;

        (bool ok,) = msg.sender.call{value: fees}("");
        require(ok, "transfer failed");

        emit FeesClaimed(msg.sender, decisionId, fees);
    }

    // ============ View ============

    function getYesPrice(uint256 decisionId, uint256 proposalId) external view returns (uint256) {
        Proposal storage p = proposals[decisionId][proposalId];
        if (p.yesReserve == 0 && p.noReserve == 0) return 5000;
        return MeridianMath.yesPrice(p.yesReserve, p.noReserve);
    }

    function getBalance(address user, uint256 decisionId) external view returns (uint256) {
        return balances[decisionId][user];
    }

    function getProposal(uint256 decisionId, uint256 proposalId)
        external
        view
        returns (
            address lpProvider,
            uint256 yesReserve,
            uint256 noReserve,
            uint256 lpLiquidity,
            uint256 totalAllocated,
            uint256 totalVolume,
            bool lpRedeemed,
            string memory title
        )
    {
        Proposal storage p = proposals[decisionId][proposalId];
        return (p.lpProvider, p.yesReserve, p.noReserve, p.lpLiquidity, p.totalAllocated, p.totalVolume, p.lpRedeemed, p.title);
    }

    function getPosition(address user, uint256 decisionId, uint256 proposalId)
        external
        view
        returns (uint256 yes, uint256 no, uint256 alloc)
    {
        yes = yesBalance[decisionId][proposalId][user];
        no = noBalance[decisionId][proposalId][user];
        alloc = allocated[decisionId][proposalId][user];
    }

    // ============ Internal ============

    function _validateSwap(uint256 decisionId, uint256 proposalId, uint256 amount) internal view {
        Decision storage d = decisions[decisionId];
        require(d.status == 0, "not open");
        require(block.number < d.deadline, "past deadline");
        require(proposalId < d.proposalCount, "invalid proposal");
        require(amount > 0, "zero amount");
    }

    function _updateOracle(uint256 decisionId, uint256 proposalId, Proposal storage p) internal {
        uint256 price = MeridianMath.yesPrice(p.yesReserve, p.noReserve);
        oracles[decisionId][proposalId].update(price, MAX_CHANGE_PER_BLOCK, block.number);
    }

    /// @dev Settlement: winning YES=1, losing proposals refunded, unallocated balance returned.
    function _calcPayout(uint256 decisionId, Decision storage d) internal view returns (uint256 payout) {
        uint256 winId = d.winningProposalId;

        for (uint256 i; i < d.proposalCount; i++) {
            if (i == winId) {
                // Winning proposal: YES tokens pay 1:1
                payout += yesBalance[decisionId][i][msg.sender];
                // NO tokens = 0 (worthless)
            } else {
                // Losing proposal: no-op, refund allocation
                payout += allocated[decisionId][i][msg.sender];
            }
        }

        // Add unallocated credits
        payout += balances[decisionId][msg.sender];
    }
}
