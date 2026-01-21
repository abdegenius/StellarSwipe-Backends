import { registerAs } from '@nestjs/config';

export const stellarConfig = registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  horizonUrl:
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl:
    process.env.STELLAR_SOROBAN_RPC_URL ||
    'https://soroban-testnet.stellar.org:443',
  // For mainnet (uncomment when ready):
  // horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org',
  // sorobanRpcUrl: process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-mainnet.stellar.org:443',
  networkPassphrase:
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    'Test SDF Network ; September 2015',
  // For mainnet:
  // networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Public Global Stellar Network ; September 2015',
  apiTimeout: parseInt(process.env.STELLAR_API_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.STELLAR_MAX_RETRIES || '3', 10),
}));
