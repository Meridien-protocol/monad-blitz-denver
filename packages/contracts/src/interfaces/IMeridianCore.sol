// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMeridianCore {
    // ============ Enums ============

    enum Status {
        OPEN, // 0
        COLLAPSED, // 1
        SETTLED, // 2
        MEASURING, // 3 (Mode B only)
        RESOLVED, // 4 (Mode B only)
        DISPUTED // 5 (Mode B only)
    }

    enum ResolutionMode {
        MODE_A, // 0 - Proportional TWAP
        MODE_B // 1 - Outcome-Based (welfare oracle)
    }

    enum Outcome {
        UNRESOLVED, // 0
        YES, // 1
        NO // 2
    }

    // ============ Events ============

    event DecisionCreated(
        uint256 indexed decisionId, address indexed creator, string title, uint256 deadline, uint256 virtualLiquidity
    );
    event DecisionCreatedB(
        uint256 indexed decisionId,
        address indexed creator,
        string title,
        uint256 deadline,
        uint256 virtualLiquidity,
        address welfareOracle,
        address guardian,
        uint256 measurementPeriod,
        uint256 minImprovement
    );
    event ProposalAdded(uint256 indexed decisionId, uint256 indexed proposalId, address indexed proposer, string title);
    event Deposited(address indexed user, uint256 indexed decisionId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed decisionId, uint256 amount);
    event Trade(
        address indexed user,
        uint256 indexed decisionId,
        uint256 indexed proposalId,
        bool isYes,
        uint256 amountIn,
        uint256 amountOut,
        uint256 newWelfare
    );
    event Collapsed(uint256 indexed decisionId, uint256 winningProposalId, uint256 winningTwapWelfare);
    event MeasurementStarted(
        uint256 indexed decisionId, uint256 winningProposalId, uint256 mBaseline, uint256 measuringDeadline
    );
    event Resolved(uint256 indexed decisionId, uint8 outcome, uint256 mBaseline, uint256 mActual);
    event DisputeResolved(uint256 indexed decisionId, address indexed guardian, uint8 outcome);
    event Settled(address indexed user, uint256 indexed decisionId, uint256 payout, int256 pnl);

    // ============ Decision Lifecycle ============

    function createDecision(string calldata title, uint256 durationInBlocks, uint256 virtualLiquidity)
        external
        returns (uint256 decisionId);

    function createDecision(
        string calldata title,
        uint256 durationInBlocks,
        uint256 virtualLiquidity,
        address welfareOracle,
        uint256 measurementPeriod,
        uint256 minImprovement,
        address guardian
    ) external returns (uint256 decisionId);

    function addProposal(uint256 decisionId, string calldata title) external returns (uint256 proposalId);

    function deposit(uint256 decisionId) external payable;

    function withdraw(uint256 decisionId, uint256 amount) external;

    // ============ Trading ============

    function buyYes(uint256 decisionId, uint256 proposalId, uint256 amount, uint256 minYesOut) external;

    function buyNo(uint256 decisionId, uint256 proposalId, uint256 amount, uint256 minNoOut) external;

    function sellYes(uint256 decisionId, uint256 proposalId, uint256 yesAmount, uint256 minVmonOut) external;

    function sellNo(uint256 decisionId, uint256 proposalId, uint256 noAmount, uint256 minVmonOut) external;

    // ============ Resolution ============

    function collapse(uint256 decisionId) external;

    function resolve(uint256 decisionId) external;

    function resolveDispute(uint256 decisionId, uint8 outcome) external;

    function settle(uint256 decisionId) external;

    // ============ View ============

    function getWelfare(uint256 decisionId, uint256 proposalId) external view returns (uint256);

    function getUserDeposit(address user, uint256 decisionId) external view returns (uint256);

    function getClaimable(address user, uint256 decisionId, uint256 proposalId) external view returns (uint256);
}
