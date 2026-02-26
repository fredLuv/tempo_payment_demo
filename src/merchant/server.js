import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { loadMerchantConfig, loadTempoConfig, txUrl } from '../shared/config.js';
import { tokenConfig } from '../shared/token.js';
import { createInvoice, getAllInvoices } from './invoiceStore.js';
import { startPaymentWatcher } from './watcher.js';

const merchantConfig = loadMerchantConfig();
const tempoConfig = loadTempoConfig();

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_, res) => {
  res.json({
    merchantAddress: merchantConfig.address,
    tokenAddress: tokenConfig.address,
    tokenSymbol: tokenConfig.symbol,
    tokenDecimals: tokenConfig.decimals,
    rpcUrl: tempoConfig.rpcUrl,
    chainId: tempoConfig.chainId,
    explorerUrl: tempoConfig.explorerUrl
  });
});

app.get('/api/invoices', (_, res) => {
  res.json({ invoices: getAllInvoices().map(withTxUrl) });
});

app.post('/api/invoices', (req, res) => {
  const amount = req.body?.amount;
  const note = req.body?.note || '';

  if (amount == null || String(amount).trim() === '') {
    res.status(400).json({ error: 'amount is required' });
    return;
  }

  try {
    const invoice = createInvoice({
      amount,
      note,
      merchantAddress: merchantConfig.address
    });

    broadcast({
      type: 'invoice.created',
      invoice: withTxUrl(invoice)
    });

    res.status(201).json({ invoice: withTxUrl(invoice) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const server = app.listen(merchantConfig.port, '127.0.0.1', () => {
  console.log(`[merchant] checkout running at http://127.0.0.1:${merchantConfig.port}`);
  console.log(`[merchant] receiving ${tokenConfig.symbol} at ${merchantConfig.address}`);
});

const wss = new WebSocketServer({ server });

function withTxUrl(invoice) {
  return {
    ...invoice,
    txUrl: invoice.txHash ? txUrl(invoice.txHash) : null
  };
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'snapshot',
      invoices: getAllInvoices().map(withTxUrl)
    })
  );
});

const stopWatcher = startPaymentWatcher({
  merchantAddress: merchantConfig.address,
  onInvoicePaid: (invoice) => {
    console.log(`[merchant] invoice paid ${invoice.id} tx=${invoice.txHash}`);
    broadcast({
      type: 'invoice.paid',
      invoice: withTxUrl(invoice)
    });
  }
});

process.on('SIGINT', () => {
  stopWatcher();
  server.close(() => process.exit(0));
});
