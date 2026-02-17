// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MeridianMath
/// @notice Pure math functions for Meridian's virtual CPMM.
/// @dev All amounts are in wei (1e18). Welfare values are in basis points [0, 10000].
library MeridianMath {
    uint256 internal constant BPS = 10_000;

    /// @notice Calculate YES tokens out for a Buy YES trade.
    /// @dev YES_out = d * (yesR + noR + d) / (noR + d)
    ///      Derived from: mint d YES+NO, sell d NO to pool for YES.
    /// @param yesReserve Current YES reserve in the pool.
    /// @param noReserve Current NO reserve in the pool.
    /// @param d Amount of vMON to spend (after fees).
    /// @return yesOut YES tokens received.
    function calcBuyYes(uint256 yesReserve, uint256 noReserve, uint256 d) internal pure returns (uint256 yesOut) {
        require(d > 0, "MeridianMath: zero input");
        require(yesReserve > 0 && noReserve > 0, "MeridianMath: empty pool");
        // YES_out = d * (yesReserve + noReserve + d) / (noReserve + d)
        yesOut = (d * (yesReserve + noReserve + d)) / (noReserve + d);
    }

    /// @notice Calculate NO tokens out for a Buy NO trade.
    /// @dev NO_out = d * (yesR + noR + d) / (yesR + d)
    /// @param yesReserve Current YES reserve.
    /// @param noReserve Current NO reserve.
    /// @param d Amount of vMON to spend (after fees).
    /// @return noOut NO tokens received.
    function calcBuyNo(uint256 yesReserve, uint256 noReserve, uint256 d) internal pure returns (uint256 noOut) {
        require(d > 0, "MeridianMath: zero input");
        require(yesReserve > 0 && noReserve > 0, "MeridianMath: empty pool");
        // NO_out = d * (yesReserve + noReserve + d) / (yesReserve + d)
        noOut = (d * (yesReserve + noReserve + d)) / (yesReserve + d);
    }

    /// @notice Calculate vMON returned when selling q YES tokens.
    /// @dev Solves the quadratic: a = [(R+q) - sqrt((R+q)^2 - 4*noR*q)] / 2
    ///      where R = yesReserve + noReserve.
    /// @param yesReserve Current YES reserve.
    /// @param noReserve Current NO reserve.
    /// @param q YES tokens to sell.
    /// @return vMonOut vMON returned (number of YES+NO pairs redeemed).
    function calcSellYes(uint256 yesReserve, uint256 noReserve, uint256 q) internal pure returns (uint256 vMonOut) {
        require(q > 0, "MeridianMath: zero input");
        require(yesReserve > 0 && noReserve > 0, "MeridianMath: empty pool");
        uint256 R = yesReserve + noReserve + q;
        uint256 discriminant = R * R - 4 * noReserve * q;
        vMonOut = (R - sqrt(discriminant)) / 2;
    }

    /// @notice Calculate vMON returned when selling q NO tokens.
    /// @dev Symmetric to calcSellYes with yesReserve and noReserve swapped.
    /// @param yesReserve Current YES reserve.
    /// @param noReserve Current NO reserve.
    /// @param q NO tokens to sell.
    /// @return vMonOut vMON returned.
    function calcSellNo(uint256 yesReserve, uint256 noReserve, uint256 q) internal pure returns (uint256 vMonOut) {
        require(q > 0, "MeridianMath: zero input");
        require(yesReserve > 0 && noReserve > 0, "MeridianMath: empty pool");
        uint256 R = yesReserve + noReserve + q;
        uint256 discriminant = R * R - 4 * yesReserve * q;
        vMonOut = (R - sqrt(discriminant)) / 2;
    }

    /// @notice Apply trading fee, returning the effective amount and fee.
    /// @param amount Raw input amount.
    /// @param feeBps Fee in basis points (e.g. 30 = 0.3%).
    /// @return effective Amount after fee deduction.
    /// @return fee Fee amount retained.
    function applyFee(uint256 amount, uint256 feeBps) internal pure returns (uint256 effective, uint256 fee) {
        fee = (amount * feeBps) / BPS;
        effective = amount - fee;
    }

    /// @notice Compute the implied welfare of a pool in basis points.
    /// @dev welfare = noReserve * BPS / (yesReserve + noReserve)
    /// @param yesReserve Current YES reserve.
    /// @param noReserve Current NO reserve.
    /// @return w Welfare in basis points [0, 10000].
    function welfare(uint256 yesReserve, uint256 noReserve) internal pure returns (uint256 w) {
        require(yesReserve + noReserve > 0, "MeridianMath: empty pool");
        w = (noReserve * BPS) / (yesReserve + noReserve);
    }

    /// @notice Post-trade reserves for Buy YES.
    /// @dev yesR_new = k / (noR + d), noR_new = noR + d.
    ///      Since fee increases k: we recompute from new reserves.
    function reservesAfterBuyYes(uint256 yesReserve, uint256 noReserve, uint256 d, uint256 fee)
        internal
        pure
        returns (uint256 newYesReserve, uint256 newNoReserve)
    {
        // d is already fee-adjusted; fee goes into noReserve as additional liquidity
        newNoReserve = noReserve + d + fee;
        // k increases by the fee component: new k = yesReserve * (noReserve + d + fee) after YES leaves
        // Actually: user deposits d+fee total NO into pool (d effective + fee).
        // yesR_new = yesR * noR / (noR + d)  [from the d-effective swap]
        // But fee stays in pool, so noR_new = noR + d + fee
        // and yesR_new = yesR * noR / (noR + d)
        newYesReserve = (yesReserve * noReserve) / (noReserve + d);
    }

    /// @notice Post-trade reserves for Buy NO.
    function reservesAfterBuyNo(uint256 yesReserve, uint256 noReserve, uint256 d, uint256 fee)
        internal
        pure
        returns (uint256 newYesReserve, uint256 newNoReserve)
    {
        newYesReserve = yesReserve + d + fee;
        newNoReserve = (yesReserve * noReserve) / (yesReserve + d);
    }

    /// @notice Babylonian integer square root.
    /// @param x Value to take the square root of.
    /// @return z The floor of sqrt(x).
    function sqrt(uint256 x) internal pure returns (uint256 z) {
        if (x == 0) return 0;
        z = x;
        uint256 y = (z + 1) / 2;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
    }
}
