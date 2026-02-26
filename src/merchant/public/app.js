const configEl = document.getElementById('config');
const invoicesEl = document.getElementById('invoices');
const createBtn = document.getElementById('createBtn');
const amountInput = document.getElementById('amount');
const noteInput = document.getElementById('note');

const invoiceMap = new Map();

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setConfig(config) {
  configEl.innerHTML = [
    `<div>Merchant: ${escapeHtml(config.merchantAddress)}</div>`,
    `<div>Token: ${escapeHtml(config.tokenSymbol)} (${escapeHtml(config.tokenAddress)})</div>`,
    `<div>Chain: ${config.chainId} | RPC: ${escapeHtml(config.rpcUrl)}</div>`
  ].join('');
}

function invoiceMarkup(invoice) {
  const txLink = invoice.txHash
    ? `<a href="${invoice.txUrl || '#'}" target="_blank" rel="noreferrer">${invoice.txHash.slice(0, 10)}...</a>`
    : '-';

  return `
    <article class="invoice">
      <div class="invoice-top">
        <div class="id">${escapeHtml(invoice.id)}</div>
        <span class="status ${invoice.status}">${invoice.status}</span>
      </div>
      <div class="row">
        <strong>${invoice.amount}</strong>
        <span class="muted">memo: ${escapeHtml(invoice.memo.slice(0, 18))}...</span>
      </div>
      <div class="row muted">
        <span>note: ${escapeHtml(invoice.note || '-')}</span>
        <span>payer: ${escapeHtml(invoice.payer || '-')}</span>
      </div>
      <div class="row muted">
        <span>created: ${new Date(invoice.createdAt).toLocaleTimeString()}</span>
        <span>tx: ${txLink}</span>
      </div>
    </article>
  `;
}

function renderInvoices() {
  const items = Array.from(invoiceMap.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );

  if (items.length === 0) {
    invoicesEl.innerHTML = '<div class="empty">No invoices yet. Create one from the left panel.</div>';
    return;
  }

  invoicesEl.innerHTML = items.map(invoiceMarkup).join('');
}

function upsertInvoice(invoice) {
  invoiceMap.set(invoice.id, invoice);
  renderInvoices();
}

async function loadInitial() {
  const [configRes, invoicesRes] = await Promise.all([
    fetch('/api/config'),
    fetch('/api/invoices')
  ]);

  const configData = await configRes.json();
  const invoiceData = await invoicesRes.json();

  setConfig(configData);
  (invoiceData.invoices || []).forEach((inv) => upsertInvoice(inv));
}

async function createInvoice() {
  createBtn.disabled = true;

  const payload = {
    amount: amountInput.value,
    note: noteInput.value
  };

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'failed to create invoice');
    }

    upsertInvoice(body.invoice);
    noteInput.value = '';
  } catch (error) {
    alert(`Could not create invoice: ${error.message}`);
  } finally {
    createBtn.disabled = false;
  }
}

function connectSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${proto}://${location.host}`);

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'snapshot' && Array.isArray(message.invoices)) {
      message.invoices.forEach((invoice) => upsertInvoice(invoice));
      return;
    }

    if ((message.type === 'invoice.created' || message.type === 'invoice.paid') && message.invoice) {
      if (message.txUrl) {
        message.invoice.txUrl = message.txUrl;
      }
      upsertInvoice(message.invoice);
    }
  });

  socket.addEventListener('close', () => {
    setTimeout(connectSocket, 1500);
  });
}

createBtn.addEventListener('click', createInvoice);
loadInitial().then(connectSocket).catch((error) => {
  console.error(error);
  alert('Failed to load checkout app. See browser console.');
});
