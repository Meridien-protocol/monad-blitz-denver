// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMeridianCore {
    // ============ Events ============

    event DecisionCreated(uint256 indexed decisionId, address indexed creator, string title, uint256 deadline);
    event ProposalAdded(
        uint256 indexed decisionId,
        uint256 indexed proposalId,
        address indexed lpProvider,
        string title,
        uint256 liquidity
    );
    event Deposited(address indexed user, uint256 indexed decisionId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed decisionId, uint256 amount);
    event Split(
        address indexed user, uint256 indexed decisionId, uint256 indexed proposalId, uint256 amount, uint256 fee
    );
    event Merged(address indexed user, uint256 indexed decisionId, uint256 indexed proposalId, uint256 amount);
    event Swapped(
        address indexed user,
        uint256 indexed decisionId,
        uint256 indexed proposalId,
        bool yesForNo,
        uint256 amountIn,
        uint256 amountOut,
        uint256 newYesPrice
    );
    event Collapsed(uint256 indexed decisionId, uint256 winningProposalId, uint256 winningTwap);
    event Settled(address indexed user, uint256 indexed decisionId, uint256 payout);
    event LPRedeemed(
        address indexed lpProvider, uint256 indexed decisionId, uint256 indexed proposalId, uint256 payout
    );
    event FeesClaimed(address indexed creator, uint256 indexed decisionId, uint256 amount);

    // ============ Decision Lifecycle ============

    function createDecision(string calldata title, uint256 durationInBlocks) external returns (uint256 decisionId);

    function addProposal(uint256 decisionId, string calldata title) external payable returns (uint256 proposalId);

    function deposit(uint256 decisionId) external payable;

    function withdraw(uint256 decisionId, uint256 amount) external;

    // ============ Trading ============

    function split(uint256 decisionId, uint256 proposalId, uint256 amount) external;

    function merge(uint256 decisionId, uint256 proposalId, uint256 amount) external;

    function swapYesForNo(uint256 decisionId, uint256 proposalId, uint256 yesIn, uint256 minNoOut) external;

    function swapNoForYes(uint256 decisionId, uint256 proposalId, uint256 noIn, uint256 minYesOut) external;

    // ============ Resolution ============

    function collapse(uint256 decisionId) external;

    function settle(uint256 decisionId) external;

    function redeemLP(uint256 decisionId, uint256 proposalId) external;

    function claimFees(uint256 decisionId) external;

    // ============ View ============

    function getYesPrice(uint256 decisionId, uint256 proposalId) external view returns (uint256);

    function getBalance(address user, uint256 decisionId) external view returns (uint256);
}
