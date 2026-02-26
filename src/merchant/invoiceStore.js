import { randomUUID } from 'node:crypto';
import { padHex, stringToHex } from 'viem';
import { parseAmount, formatAmount } from '../shared/token.js';

const invoices = new Map();

function nowIso() {
  return new Date().toISOString();
}

export function createInvoice({ amount, merchantAddress, note = '' }) {
  const invoiceId = `INV-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const memo = padHex(stringToHex(invoiceId), { size: 32 });
  const amountUnits = parseAmount(amount);

  const invoice = {
    id: invoiceId,
    memo,
    note,
    merchantAddress,
    amount: formatAmount(amountUnits),
    amountUnits: amountUnits.toString(),
    status: 'pending',
    createdAt: nowIso(),
    paidAt: null,
    txHash: null,
    payer: null
  };

  invoices.set(invoiceId, invoice);
  return invoice;
}

export function markInvoicePaid({ memo, txHash, payer, paidValue }) {
  const memoLower = memo.toLowerCase();
  for (const invoice of invoices.values()) {
    if (invoice.memo.toLowerCase() !== memoLower) continue;
    if (invoice.status === 'paid') return null;
    if (BigInt(invoice.amountUnits) !== BigInt(paidValue)) return null;

    invoice.status = 'paid';
    invoice.paidAt = nowIso();
    invoice.txHash = txHash;
    invoice.payer = payer;

    invoices.set(invoice.id, invoice);
    return invoice;
  }
  return null;
}

export function getAllInvoices() {
  return Array.from(invoices.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}
