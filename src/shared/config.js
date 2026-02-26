import 'dotenv/config';

const defaultRpcUrl = 'https://rpc.moderato.tempo.xyz';
const defaultChainId = 42431;
const defaultExplorerUrl = 'https://explore.tempo.xyz';
const defaultTokenAddress = '0x20c0000000000000000000000000000000000001';
const defaultTokenSymbol = 'AlphaUSD';
const defaultTokenDecimals = 6;
const defaultMerchantPort = 8788;

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
}

function requireHexAddress(value, keyName) {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${keyName}. Expected a 20-byte hex address.`);
  }
  return value;
}

function requirePrivateKey(value, keyName) {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`Invalid ${keyName}. Expected a 32-byte private key (0x + 64 hex chars).`);
  }
  return value;
}

export function loadTempoConfig() {
  return {
    rpcUrl: process.env.TEMPO_RPC_URL || defaultRpcUrl,
    chainId: Number(process.env.TEMPO_CHAIN_ID || defaultChainId),
    explorerUrl: process.env.TEMPO_EXPLORER_URL || defaultExplorerUrl,
    tokenAddress: requireHexAddress(process.env.TEMPO_TOKEN_ADDRESS || defaultTokenAddress, 'TEMPO_TOKEN_ADDRESS'),
    tokenSymbol: process.env.TEMPO_TOKEN_SYMBOL || defaultTokenSymbol,
    tokenDecimals: Number(process.env.TEMPO_TOKEN_DECIMALS || defaultTokenDecimals)
  };
}

export function loadMerchantConfig() {
  return {
    port: Number(process.env.MERCHANT_PORT || defaultMerchantPort),
    address: requireHexAddress(process.env.MERCHANT_ADDRESS || '', 'MERCHANT_ADDRESS')
  };
}

export function loadConsumerConfig() {
  const merchantPort = Number(process.env.MERCHANT_PORT || defaultMerchantPort);
  return {
    privateKey: requirePrivateKey(process.env.CONSUMER_PRIVATE_KEY || '', 'CONSUMER_PRIVATE_KEY'),
    merchantWsUrl: process.env.MERCHANT_WS_URL || `ws://127.0.0.1:${merchantPort}`,
    autoAccept: parseBoolean(process.env.CONSUMER_AUTO_ACCEPT, true)
  };
}

export function txUrl(txHash) {
  const tempoConfig = loadTempoConfig();
  return `${tempoConfig.explorerUrl.replace(/\/$/, '')}/tx/${txHash}`;
}
