import type { SaleRecord } from '@/types/hpp';
import type { BusinessProfile } from '@/store/settingsStore';

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function buildReceiptHTML(record: SaleRecord, profile: BusinessProfile): string {
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
  .sub { text-align: center; font-size: 10px; margin-bottom: 1px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .total-row td { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 4px; }
  .footer { margin-top: 8px; text-align: center; font-size: 10px; }
  @media print {
    @page { margin: 0; size: 58mm auto; }
    body { width: 50mm; }
  }
</style>
</head>
<body>
  <h1>${profile.name}</h1>
  ${profile.tagline ? `<p class="sub">${profile.tagline}</p>` : ''}
  ${profile.address ? `<p class="sub" style="font-size:9px">${profile.address}</p>` : ''}
  ${profile.phone ? `<p class="sub" style="font-size:9px">Tel: ${profile.phone}</p>` : ''}
  <p class="sub">${date}</p>
  ${record.customerName ? `<p class="sub">Pelanggan: ${record.customerName}</p>` : ''}
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
  <p class="footer">${profile.footer || 'Terima kasih atas kunjungan Anda!'}</p>
  <p class="footer" style="font-size:9px">#${record.id.slice(-8).toUpperCase()}</p>
</body>
</html>`;
}

export function printReceipt(record: SaleRecord, profile: BusinessProfile = { name: 'ProfitLy', tagline: '', address: '', phone: '', footer: 'Terima kasih atas kunjungan Anda!', businessType: 'FNB' }): void {
  const html = buildReceiptHTML(record, profile);
  const win = window.open('', '_blank', 'width=360,height=600');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
