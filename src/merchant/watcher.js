import { makePublicClient } from '../shared/chain.js';
import { parseAbiItem } from 'viem';
import { tokenConfig } from '../shared/token.js';
import { markInvoicePaid } from './invoiceStore.js';

export function startPaymentWatcher({ merchantAddress, onInvoicePaid }) {
  const publicClient = makePublicClient();
  const transferWithMemoEvent = parseAbiItem(
    'event TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 indexed memo)'
  );
  const pollIntervalMs = 1_500;
  let stopped = false;
  let nextFromBlock = null;

  async function pollLogs() {
    while (!stopped) {
      try {
        const latestBlock = await publicClient.getBlockNumber();
        if (nextFromBlock == null) {
          nextFromBlock = latestBlock > 64n ? latestBlock - 64n : 0n;
        }

        if (nextFromBlock <= latestBlock) {
          const logs = await publicClient.getLogs({
            address: tokenConfig.address,
            event: transferWithMemoEvent,
            args: { to: merchantAddress },
            fromBlock: nextFromBlock,
            toBlock: latestBlock
          });

          for (const log of logs) {
            const args = log.args;
            if (!args || !args.memo || !args.from || args.value == null) continue;

            const paidInvoice = markInvoicePaid({
              memo: args.memo,
              txHash: log.transactionHash,
              payer: args.from,
              paidValue: args.value
            });

            if (paidInvoice) {
              onInvoicePaid(paidInvoice);
            }
          }

          nextFromBlock = latestBlock + 1n;
        }
      } catch (error) {
        console.error('[watcher] error polling TransferWithMemo logs', error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  pollLogs().catch((error) => {
    console.error('[watcher] fatal polling error', error);
  });

  return () => {
    stopped = true;
  };
}
