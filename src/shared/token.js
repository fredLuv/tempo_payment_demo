import { formatUnits, parseUnits } from 'viem';
import { loadTempoConfig } from './config.js';

const tempoConfig = loadTempoConfig();

export const tokenConfig = {
  address: tempoConfig.tokenAddress,
  symbol: tempoConfig.tokenSymbol,
  decimals: tempoConfig.tokenDecimals
};

// TIP-20 compatible subset used by this demo.
export const tokenAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'transferWithMemo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'memo', type: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'TransferWithMemo',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
      { indexed: true, name: 'memo', type: 'bytes32' }
    ]
  }
];

export function parseAmount(amountText) {
  return parseUnits(String(amountText), tokenConfig.decimals);
}

export function formatAmount(amount) {
  return formatUnits(amount, tokenConfig.decimals);
}
