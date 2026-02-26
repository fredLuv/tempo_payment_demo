import { WebSocket } from 'ws';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { makePublicClient, tempoTestnet } from '../shared/chain.js';
import { loadConsumerConfig, txUrl } from '../shared/config.js';
import { formatAmount, tokenAbi, tokenConfig } from '../shared/token.js';

const consumerConfig = loadConsumerConfig();
const account = privateKeyToAccount(consumerConfig.privateKey);
const publicClient = makePublicClient();
const walletClient = createWalletClient({
  account,
  chain: tempoTestnet,
  transport: http(tempoTestnet.rpcUrls.default.http[0])
});

const seenInvoices = new Set();
let currentlyPaying = false;
const queue = [];

function enqueueInvoice(invoice) {
  if (!invoice || seenInvoices.has(invoice.id) || invoice.status !== 'pending') return;
  seenInvoices.add(invoice.id);
  queue.push(invoice);
  processQueue();
}

async function processQueue() {
  if (currentlyPaying) return;
  currentlyPaying = true;

  while (queue.length) {
    const invoice = queue.shift();
    try {
      await payInvoice(invoice);
    } catch (error) {
      console.error(`[consumer] failed invoice=${invoice.id}`, error.message);
    }
  }

  currentlyPaying = false;
}

async function payInvoice(invoice) {
  const amount = BigInt(invoice.amountUnits);
  const balance = await publicClient.readContract({
    address: tokenConfig.address,
    abi: tokenAbi,
    functionName: 'balanceOf',
    args: [account.address]
  });

  if (balance < amount) {
    throw new Error(
      `insufficient ${tokenConfig.symbol}: balance=${formatAmount(balance)} required=${invoice.amount}`
    );
  }

  console.log(`\n[consumer] accepting ${invoice.id}`);
  console.log(`[consumer] sending ${invoice.amount} ${tokenConfig.symbol} to ${invoice.merchantAddress}`);

  const hash = await walletClient.writeContract({
    address: tokenConfig.address,
    abi: tokenAbi,
    functionName: 'transferWithMemo',
    args: [invoice.merchantAddress, amount, invoice.memo]
  });

  console.log(`[consumer] tx submitted ${hash}`);
  console.log(`[consumer] explorer ${txUrl(hash)}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
    pollingInterval: 1_500
  });

  if (receipt.status !== 'success') {
    throw new Error(`transaction reverted: ${hash}`);
  }

  console.log(`[consumer] payment confirmed for ${invoice.id}`);
}

function connect() {
  const ws = new WebSocket(consumerConfig.merchantWsUrl);

  ws.on('open', () => {
    console.log(`[consumer] connected to merchant stream ${consumerConfig.merchantWsUrl}`);
    console.log(`[consumer] wallet ${account.address}`);
    console.log(`[consumer] auto-accept ${consumerConfig.autoAccept ? 'enabled' : 'disabled'}`);
  });

  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(String(raw));

      if (message.type === 'snapshot' && Array.isArray(message.invoices)) {
        if (!consumerConfig.autoAccept) return;
        message.invoices.forEach((invoice) => enqueueInvoice(invoice));
      }

      if (message.type === 'invoice.created' && message.invoice && consumerConfig.autoAccept) {
        enqueueInvoice(message.invoice);
      }

      if (message.type === 'invoice.paid' && message.invoice) {
        console.log(`[consumer] merchant marked paid ${message.invoice.id}`);
      }
    } catch (error) {
      console.error('[consumer] bad websocket message', error.message);
    }
  });

  ws.on('close', () => {
    console.log('[consumer] disconnected, retrying in 1.5s...');
    setTimeout(connect, 1500);
  });

  ws.on('error', (error) => {
    console.error('[consumer] websocket error', error.message);
  });
}

connect();
