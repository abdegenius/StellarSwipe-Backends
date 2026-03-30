# Deployments

Contract addresses are **deterministic**: running `scripts/deploy.ts` twice with the same
deployer key and salt always produces the same address.

## Address Derivation Formula

```
address = sha256( deployer_address || salt || wasm_hash )
```

Salts are defined as constants in [`scripts/deploy_config.ts`](scripts/deploy_config.ts).
Each contract has a unique base salt; each network appends a different suffix byte so
testnet and mainnet addresses never collide.

### Frontend Client-Side Derivation

```ts
import { Contract, xdr, hash } from '@stellar/stellar-sdk';
import { getSalt } from '../scripts/deploy_config';

// Reproduce the address without deploying:
const salt = Buffer.from(getSalt('user_portfolio', 'testnet'), 'hex');
// Pass salt + deployer + wasmHash to xdr.HashIdPreimage and hash it.
```

## Contracts

| Contract | Description |
|---|---|
| `user_portfolio` | User positions and P&L queries |
| `whsper_stellar` | Pending claim read-only interface |

---

<!-- Deployment records are appended below by scripts/deploy.ts -->
