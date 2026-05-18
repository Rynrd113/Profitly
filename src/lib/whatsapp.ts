import type { SaleRecord } from '@/types/hpp';

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function buildReceiptText(record: SaleRecord): string {
  const date = new Date(record.timestamp).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const items = record.items
    .map(i => `  ${i.qty}× ${i.recipeName}: ${formatRp(i.subtotal)}`)
    .join('\n');

  const discount = (record.discountAmount && record.discountAmount > 0)
    ? `\nDiskon: −${formatRp(record.discountAmount)}`
    : '';

  const loyalty = record.loyaltyRedeemed ? '\n★ LOYALTY REWARD — GRATIS ★' : '';

  return [
    '🧾 *Struk ProfitLy*',
    `📅 ${date}`,
    record.customerName ? `👤 ${record.customerName}` : '',
    '─────────────────',
    items,
    discount,
    loyalty,
    '─────────────────',
    `*TOTAL: ${record.loyaltyRedeemed ? 'GRATIS' : formatRp(record.totalRevenue)}*`,
    `Pembayaran: ${record.paymentMethod ?? 'CASH'}`,
    '',
    'Terima kasih! 🙏',
    `Ref: #${record.id.slice(-8).toUpperCase()}`,
  ].filter(Boolean).join('\n');
}

export function sendReceipt(phoneNumber: string, record: SaleRecord): void {
  const digits = phoneNumber.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  const text = encodeURIComponent(buildReceiptText(record));
  window.open(`https://wa.me/${normalized}?text=${text}`, '_blank');
}
