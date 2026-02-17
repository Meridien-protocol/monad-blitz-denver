// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MeridianMath
/// @notice Pure math functions for Meridian's CPMM.
/// @dev All amounts are in wei (1e18). Price values are in basis points [0, 10000].
library MeridianMath {
    uint256 internal constant BPS = 10_000;

    /// @notice Calculate output for a standard x*y=k swap.
    /// @param reserveIn Reserve of the input token.
    /// @param reserveOut Reserve of the output token.
    /// @param amountIn Amount of input token (after fees).
    /// @return amountOut Output tokens received.
    function calcSwapOutput(uint256 reserveIn, uint256 reserveOut, uint256 amountIn)
        internal
        pure
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "MeridianMath: zero input");
        require(reserveIn > 0 && reserveOut > 0, "MeridianMath: empty pool");
        amountOut = (reserveOut * amountIn) / (reserveIn + amountIn);
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

    /// @notice Compute the implied YES price of a pool in basis points.
    /// @dev yesPrice = noReserve * BPS / (yesReserve + noReserve)
    ///      Higher noReserve relative to yesReserve = higher YES price.
    /// @param yesReserve Current YES reserve.
    /// @param noReserve Current NO reserve.
    /// @return price YES price in basis points [0, 10000].
    function yesPrice(uint256 yesReserve, uint256 noReserve) internal pure returns (uint256 price) {
        require(yesReserve + noReserve > 0, "MeridianMath: empty pool");
        price = (noReserve * BPS) / (yesReserve + noReserve);
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
