import { defineChain, http, createPublicClient } from 'viem';
import { loadTempoConfig } from './config.js';

const tempoConfig = loadTempoConfig();

export const tempoTestnet = defineChain({
  id: tempoConfig.chainId,
  name: 'Tempo Moderato Testnet',
  nativeCurrency: {
    name: 'Tempo',
    symbol: 'TMP',
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [tempoConfig.rpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: 'Tempo Explorer',
      url: tempoConfig.explorerUrl
    }
  }
});

export function makePublicClient() {
  return createPublicClient({
    chain: tempoTestnet,
    transport: http(tempoConfig.rpcUrl)
  });
}
