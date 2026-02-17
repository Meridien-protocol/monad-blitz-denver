# Meridian: Quantum Futarchy

Governance intelligence through prediction markets on Monad.

Meridian implements **quantum markets** -- deposit once, trade in every proposal universe simultaneously. Only truth settles.

## How It Works

1. A **Decision** poses a governance question
2. Multiple **Proposals** compete to answer it
3. Traders deposit MON and receive full trading power across all proposal markets
4. Each market produces a welfare prediction via CPMM price discovery
5. The highest time-weighted welfare prediction wins (wave function collapse)
6. Losing markets fully revert -- capital returned

## Architecture

```
monad-blitz/
  packages/contracts/   Foundry -- MeridianCore.sol (singleton CPMM + TWAP oracle)
  packages/shared/      TypeScript types, ABI exports, math utils
  apps/web/             Next.js 15 + React 19 + RainbowKit + wagmi v2
```

## Quick Start

```bash
pnpm install

# contracts
cd packages/contracts
forge build
forge test -vvv

# frontend
pnpm dev
```

## Deployed

**Monad Testnet** (Chain ID: 10143)

| Contract | Address |
|----------|---------|
| MeridianCore | `0xb9E4C02923D50624031979cEB9F5EDb391Ce1601` |

## Key Properties

| Metric | Classical Futarchy | Quantum (Meridian) |
|--------|-------------------|--------------------|
| Capital per market | D/N | D |
| Capital efficiency | 1/N (degrades) | 1 (constant) |
| Adding a proposal | Requires liquidity | Zero marginal cost |

## Spec

See [MERIDIAN-SPEC.md](./MERIDIAN-SPEC.md) for the full formal specification.

## License

MIT
