import type { SaleRecord } from '@/types/hpp';

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function line(char = '-', width = 32) {
  return char.repeat(width);
}

function buildReceiptHTML(record: SaleRecord): string {
  const date = new Date(record.timestamp).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const itemRows = record.items.map(i =>
    `<tr>
      <td>${i.qty}× ${i.recipeName}</td>
      <td style="text-align:right">${formatRp(i.subtotal)}</td>
    </tr>`
  ).join('');

  const discountRow = (record.discountAmount && record.discountAmount > 0)
    ? `<tr style="color:#c00">
        <td>Diskon${record.discountType === 'percent' ? ` (${record.discountValue}%)` : ''}</td>
        <td style="text-align:right">−${formatRp(record.discountAmount)}</td>
      </tr>`
    : '';

  const loyaltyRow = record.loyaltyRedeemed
    ? `<tr><td colspan="2" style="text-align:center;font-weight:bold">★ LOYALTY REWARD — GRATIS ★</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; padding: 8px; color: #000; }
  h1 { font-size: 16px; text-align: center; margin-bottom: 2px; }
  .center { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 4px; }
  .footer { margin-top: 8px; text-align: center; font-size: 10px; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { width: 72mm; }
  }
</style>
</head>
<body>
  <h1>ProfitLy</h1>
  <p class="center" style="font-size:10px">${date}</p>
  ${record.customerName ? `<p class="center" style="font-size:10px">Pelanggan: ${record.customerName}</p>` : ''}
  <div class="sep"></div>
  <table>
    <tbody>
      ${itemRows}
      ${discountRow}
      ${loyaltyRow}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:right">${record.loyaltyRedeemed ? 'GRATIS' : formatRp(record.totalRevenue)}</td>
      </tr>
      <tr>
        <td>Bayar</td>
        <td style="text-align:right">${record.paymentMethod ?? 'CASH'}</td>
      </tr>
    </tfoot>
  </table>
  <div class="sep"></div>
  <p class="footer">Terima kasih atas kunjungan Anda!</p>
  <p class="footer" style="font-size:9px">#${record.id.slice(-8).toUpperCase()}</p>
</body>
</html>`;
}

export function printReceipt(record: SaleRecord): void {
  const html = buildReceiptHTML(record);
  const win = window.open('', '_blank', 'width=360,height=600');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
