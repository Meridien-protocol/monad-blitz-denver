// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IWelfareOracle
/// @notice Minimal interface for external welfare metric oracles (Mode B resolution).
interface IWelfareOracle {
    /// @notice Returns the current welfare metric value.
    function getMetric() external view returns (uint256);

    /// @notice Returns the block number when the metric was last updated.
    function lastUpdated() external view returns (uint256);
}
