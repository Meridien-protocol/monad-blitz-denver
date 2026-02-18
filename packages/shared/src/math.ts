const BPS = BigInt(10_000);

/** Calculate output for a standard x*y=k swap */
export function calcSwapOutput(reserveIn: bigint, reserveOut: bigint, amountIn: bigint): bigint {
  return (reserveOut * amountIn) / (reserveIn + amountIn);
}

/** Calculate swap output with fee applied */
export function calcSwapWithFee(reserveIn: bigint, reserveOut: bigint, amountIn: bigint, feeBps: bigint): bigint {
  const fee = (amountIn * feeBps) / BPS;
  const effective = amountIn - fee;
  return calcSwapOutput(reserveIn, reserveOut, effective);
}

/** Apply fee, returning [effective, fee] */
export function applyFee(amount: bigint, feeBps: bigint): [bigint, bigint] {
  const fee = (amount * feeBps) / BPS;
  return [amount - fee, fee];
}

/** Calculate YES price in basis points */
export function yesPrice(yesReserve: bigint, noReserve: bigint): bigint {
  if (yesReserve + noReserve === BigInt(0)) return BigInt(5000);
  return (noReserve * BPS) / (yesReserve + noReserve);
}

/** Babylonian square root for bigint */
export function sqrt(x: bigint): bigint {
  if (x === BigInt(0)) return BigInt(0);
  let z = x;
  let y = (z + BigInt(1)) / BigInt(2);
  while (y < z) {
    z = y;
    y = (x / y + y) / BigInt(2);
  }
  return z;
}
