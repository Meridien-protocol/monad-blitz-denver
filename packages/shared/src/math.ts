const BPS = 10_000n;

/** Calculate YES tokens out for a given vMON input */
export function calcBuyYes(yesReserve: bigint, noReserve: bigint, amountIn: bigint, feeBps: bigint): bigint {
  const effective = (amountIn * (BPS - feeBps)) / BPS;
  return (effective * (yesReserve + noReserve + effective)) / (noReserve + effective);
}

/** Calculate NO tokens out for a given vMON input */
export function calcBuyNo(yesReserve: bigint, noReserve: bigint, amountIn: bigint, feeBps: bigint): bigint {
  const effective = (amountIn * (BPS - feeBps)) / BPS;
  return (effective * (yesReserve + noReserve + effective)) / (yesReserve + effective);
}

/** Calculate welfare in basis points */
export function welfare(yesReserve: bigint, noReserve: bigint): bigint {
  return (noReserve * BPS) / (yesReserve + noReserve);
}

/** Babylonian square root for bigint */
export function sqrt(x: bigint): bigint {
  if (x === 0n) return 0n;
  let z = x;
  let y = (z + 1n) / 2n;
  while (y < z) {
    z = y;
    y = (x / y + y) / 2n;
  }
  return z;
}

/** Calculate vMON out for selling YES tokens */
export function calcSellYes(yesReserve: bigint, noReserve: bigint, yesAmount: bigint): bigint {
  const R = yesReserve + noReserve + yesAmount;
  const discriminant = R * R - 4n * noReserve * yesAmount;
  return (R - sqrt(discriminant)) / 2n;
}

/** Calculate vMON out for selling NO tokens */
export function calcSellNo(yesReserve: bigint, noReserve: bigint, noAmount: bigint): bigint {
  const R = yesReserve + noReserve + noAmount;
  const discriminant = R * R - 4n * yesReserve * noAmount;
  return (R - sqrt(discriminant)) / 2n;
}
