// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../src/interfaces/IWelfareOracle.sol";

/// @dev Test mock for IWelfareOracle with manual setters.
contract MockWelfareOracle is IWelfareOracle {
    uint256 private _metric;
    uint256 private _lastUpdated;

    function setMetric(uint256 value) external {
        _metric = value;
        _lastUpdated = block.number;
    }

    function setLastUpdated(uint256 value) external {
        _lastUpdated = value;
    }

    function getMetric() external view override returns (uint256) {
        return _metric;
    }

    function lastUpdated() external view override returns (uint256) {
        return _lastUpdated;
    }
}
