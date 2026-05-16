import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PricingTier, SaleRecord } from '@/types/hpp';
import type { BEPResult } from '@/lib/engine';
import { formatRp } from '@/lib/format';

// ─── Sales Report ─────────────────────────────────────────────────────────────

export interface SalesReportData {
  periodLabel: string;
  omzet: number;
  modal: number;
  labaKotor: number;
  labaBersih: number;
  opex: number;
  txCount: number;
  avgTx: number;
  margin: number;
  monthlyTarget?: number;
  topMenus: { name: string; qty: number; revenue: number }[];
  transactions: { timestamp: string; itemsLabel: string; tier: string; revenue: number; profit: number; note?: string; cancelled?: boolean; paymentMethod?: 'CASH' | 'QRIS' }[];
}

export function getPaymentSummary(records: SaleRecord[]): {
  totalCash: number;
  totalQRIS: number;
  totalCombined: number;
} {
  const active = records.filter(r => !r.cancelled);
  const totalCash = active
    .filter(r => (r.paymentMethod ?? 'CASH') === 'CASH')
    .reduce((s, r) => s + r.totalRevenue, 0);
  const totalQRIS = active
    .filter(r => r.paymentMethod === 'QRIS')
    .reduce((s, r) => s + r.totalRevenue, 0);
  return { totalCash, totalQRIS, totalCombined: totalCash + totalQRIS };
}

export function generateSalesReport(data: SalesReportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PW = 210, PH = 297, ML = 20, MR = 20, CW = PW - ML - MR;
  const FOOT = PH - 14;
  let y = 18;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.green);
  doc.text('ProfitLy', ML, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text('Laporan Keuangan', ML, y + 12);

  const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  doc.text(dateStr, PW - MR, y + 6, { align: 'right' });

  const badgeW = 28;
  const badgeX = PW - MR - badgeW;
  doc.setFillColor(...C.greenLight);
  doc.roundedRect(badgeX, y + 8, badgeW, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.green);
  doc.text(data.periodLabel.toUpperCase(), badgeX + badgeW / 2, y + 12.3, { align: 'center' });

  y += 17;
  hRule(doc, ML, y, CW, C.green, 0.5);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.dark);
  doc.text('LAPORAN PENJUALAN & KEUANGAN', ML, y);
  y += 12;

  // KPI row 1
  const kw = (CW - 6) / 3;
  kpiBox(doc, ML,           y, kw, 17, 'Total Omzet',     formatRp(data.omzet),     C.green);
  kpiBox(doc, ML + kw + 3,  y, kw, 17, 'Total Modal',     formatRp(data.modal));
  kpiBox(doc, ML + kw*2+6,  y, kw, 17, 'Laba Kotor',      formatRp(data.labaKotor), data.labaKotor >= 0 ? C.green : C.red);
  y += 22;

  // KPI row 2
  kpiBox(doc, ML,           y, kw, 17, 'Profit Bersih',   formatRp(data.labaBersih), data.labaBersih >= 0 ? C.green : C.red);
  kpiBox(doc, ML + kw + 3,  y, kw, 17, 'Jumlah Transaksi', String(data.txCount));
  kpiBox(doc, ML + kw*2+6,  y, kw, 17, 'Rata-rata / Tx',  data.avgTx > 0 ? formatRp(data.avgTx) : '—');
  y += 22;

  // Payment breakdown
  if (data.txCount > 0) {
    const cashTotal = data.transactions
      .filter(t => !t.cancelled && (t.paymentMethod ?? 'CASH') === 'CASH')
      .reduce((s, t) => s + t.revenue, 0);
    const qrisTotal = data.transactions
      .filter(t => !t.cancelled && t.paymentMethod === 'QRIS')
      .reduce((s, t) => s + t.revenue, 0);
    sectionLabel(doc, 'Rekap Pembayaran', ML, y);
    y += 4;
    kpiBox(doc, ML,          y, kw, 17, 'Total CASH', formatRp(cashTotal));
    kpiBox(doc, ML + kw + 3, y, kw, 17, 'Total QRIS', formatRp(qrisTotal), C.green);
    kpiBox(doc, ML + kw*2+6, y, kw, 17, 'Grand Total', formatRp(cashTotal + qrisTotal), C.green);
    y += 22;
  }

  // Monthly target progress bar
  if (data.monthlyTarget && data.monthlyTarget > 0) {
    const pct = Math.min(1, data.omzet / data.monthlyTarget);
    doc.setFillColor(...C.beige);
    doc.roundedRect(ML, y, CW, 16, 2, 2, 'F');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, 16, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grayLight);
    doc.text(`TARGET BULANAN: ${formatRp(data.monthlyTarget)}`, ML + 4, y + 6);
    // progress track
    const trackX = ML + 4, trackY = y + 9.5, trackW = CW - 8, trackH = 3;
    doc.setFillColor(229, 231, 235);
    doc.roundedRect(trackX, trackY, trackW, trackH, 1, 1, 'F');
    if (pct > 0) {
      doc.setFillColor(...(pct >= 1 ? C.green : C.amber));
      doc.roundedRect(trackX, trackY, trackW * pct, trackH, 1, 1, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...(pct >= 1 ? C.green : C.amber));
    doc.text(`${(pct * 100).toFixed(1)}% tercapai`, PW - MR - 4, y + 6, { align: 'right' });
    y += 22;
  }

  // Top menus
  if (data.topMenus.length > 0) {
    sectionLabel(doc, 'Menu Terlaris', ML, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Nama Menu', 'Terjual', 'Pendapatan']],
      body: data.topMenus.slice(0, 5).map((m, i) => [
        String(i + 1),
        m.name,
        `${m.qty.toLocaleString('id-ID')}×`,
        formatRp(m.revenue),
      ]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 3, right: 5, bottom: 3, left: 5 }, lineColor: C.border, lineWidth: 0.2 },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right', cellWidth: 25 }, 3: { halign: 'right' } },
      bodyStyles: { textColor: C.dark },
      alternateRowStyles: { fillColor: C.beige },
      margin: { left: ML, right: MR },
    });
    y = (doc as any).lastAutoTable.finalY + 9;
  }

  // Transactions
  if (data.transactions.length > 0) {
    const activeTx = data.transactions.filter(t => !t.cancelled).slice(0, 20);
    if (activeTx.length > 0) {
      if (y + 40 > FOOT) { doc.addPage(); y = 20; }
      sectionLabel(doc, `Transaksi (${activeTx.length} terbaru)`, ML, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Waktu', 'Menu', 'Tier', 'Omzet', 'Laba', 'Catatan']],
        body: activeTx.map(t => [
          new Date(t.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          t.itemsLabel,
          t.tier,
          formatRp(t.revenue),
          formatRp(t.profit),
          t.note ?? '—',
        ]),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 2.5, right: 4, bottom: 2.5, left: 4 }, lineColor: C.border, lineWidth: 0.15 },
        headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 40 }, 2: { cellWidth: 18, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        bodyStyles: { textColor: C.dark },
        alternateRowStyles: { fillColor: C.beige },
        margin: { left: ML, right: MR },
      });
      y = (doc as any).lastAutoTable.finalY + 5;
    }
  }

  // Footer
  const totalPages: number = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    hRule(doc, ML, FOOT - 2, CW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grayLight);
    doc.text('Dibuat oleh ProfitLy · Semua angka adalah estimasi', ML, FOOT + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.green);
    doc.text('profitly.app', PW - MR, FOOT + 3, { align: 'right' });
    if (totalPages > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.grayLight);
      doc.text(`Hal. ${p} / ${totalPages}`, PW / 2, FOOT + 3, { align: 'center' });
    }
  }

  const filename = `Laporan_Penjualan_ProfitLy_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

// ─── Monthly Report ──────────────────────────────────────────────────────────

export interface MonthlyReportData {
  periodLabel: string;
  omzet: number;
  grossProfit: number;
  netProfit: number;
  txCount: number;
  totalItemsSold: number;
  opex: number;
  trend: { day: number; omzet: number; profit: number }[];
  menuEngineering: {
    name: string;
    category: 'star' | 'puzzle' | 'plowhorse' | 'dog';
    qty: number;
    margin: number;
    revenue: number;
  }[];
  lowStock: {
    name: string;
    unit: string;
    current: number;
    min: number;
  }[];
  transactions?: {
    timestamp: string;
    itemsLabel: string;
    tier: string;
    revenue: number;
    profit: number;
    note?: string;
    cancelled?: boolean;
    paymentMethod?: 'CASH' | 'QRIS';
  }[];
}

function drawDailyTrendChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  trend: { day: number; omzet: number; profit: number }[],
) {
  const maxV = Math.max(...trend.map(t => t.omzet), 1);
  const n = trend.length;
  const slotW = w / n;
  const barW = Math.max(1.5, slotW * 0.72);
  const barOffset = (slotW - barW) / 2;

  doc.setFillColor(...C.beige);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'S');

  for (let i = 1; i <= 3; i++) {
    const gy = y + (i / 4) * h;
    doc.setDrawColor(220, 220, 215);
    doc.setLineWidth(0.1);
    doc.line(x, gy, x + w, gy);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.grayLight);
    doc.text(formatAxis(maxV * (1 - i / 4)), x - 1, gy + 1.2, { align: 'right' });
  }

  for (let i = 0; i < n; i++) {
    const { omzet, profit } = trend[i];
    if (omzet <= 0) continue;
    const bx = x + i * slotW + barOffset;
    const omzetH = (omzet / maxV) * h;
    const profitH = Math.max(0, Math.min(omzetH, (profit / maxV) * h));
    doc.setFillColor(187, 247, 208);
    doc.rect(bx, y + h - omzetH, barW, omzetH, 'F');
    if (profitH > 0.3) {
      doc.setFillColor(...C.green);
      doc.rect(bx, y + h - profitH, barW, profitH, 'F');
    }
    if ((i + 1) % 5 === 0 || i === 0) {
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.grayLight);
      doc.text(String(i + 1), bx + barW / 2, y + h + 3.5, { align: 'center' });
    }
  }

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.line(x, y + h, x + w, y + h);

  const ly = y + h + 8;
  doc.setFillColor(187, 247, 208);
  doc.rect(x, ly - 1.5, 8, 2, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.gray);
  doc.text('Omzet', x + 10, ly);
  doc.setFillColor(...C.green);
  doc.rect(x + 38, ly - 1.5, 8, 2, 'F');
  doc.text('Profit', x + 48, ly);
}

export function generateMonthlyReport(data: MonthlyReportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const PW = 210, PH = 297, ML = 20, MR = 20, CW = PW - ML - MR;
  const FOOT = PH - 14;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.green);
  doc.text('ProfitLy', ML, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text('Laporan Bulanan', ML, y + 12);

  const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  doc.text(dateStr, PW - MR, y + 6, { align: 'right' });

  const badgeW = 34;
  const badgeX = PW - MR - badgeW;
  doc.setFillColor(...C.greenLight);
  doc.roundedRect(badgeX, y + 8, badgeW, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.green);
  doc.text(data.periodLabel.toUpperCase(), badgeX + badgeW / 2, y + 12.3, { align: 'center' });

  y += 17;
  hRule(doc, ML, y, CW, C.green, 0.5);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.dark);
  doc.text(`LAPORAN BULANAN · ${data.periodLabel.toUpperCase()}`, ML, y);
  y += 13;

  sectionLabel(doc, 'Ringkasan Keuangan', ML, y);
  y += 4;

  const kw = (CW - 9) / 4;
  kpiBox(doc, ML,         y, kw, 17, 'Total Omzet',   formatRp(data.omzet),        C.green);
  kpiBox(doc, ML+kw+3,    y, kw, 17, 'Laba Kotor',    formatRp(data.grossProfit),  data.grossProfit >= 0 ? C.green : C.red);
  kpiBox(doc, ML+kw*2+6,  y, kw, 17, 'Profit Bersih', formatRp(data.netProfit),    data.netProfit >= 0 ? C.green : C.red);
  kpiBox(doc, ML+kw*3+9,  y, kw, 17, 'Transaksi',     String(data.txCount));
  y += 22;

  if (data.trend.some(t => t.omzet > 0)) {
    sectionLabel(doc, 'Tren Omzet & Profit Harian', ML, y);
    y += 4;
    const chartX = ML + 8;
    const chartW = CW - 8;
    const chartH = 42;
    drawDailyTrendChart(doc, chartX, y, chartW, chartH, data.trend);
    y += chartH + 14;
  }

  if (data.menuEngineering.length > 0) {
    if (y + 40 > FOOT) { doc.addPage(); y = 20; }
    sectionLabel(doc, 'Menu Engineering (BCG Matrix)', ML, y);
    y += 4;

    const meLabels: Record<string, string> = {
      star: 'STAR', puzzle: 'PUZZLE', plowhorse: 'PLOWHORSE', dog: 'DOG',
    };
    const meAdvice: Record<string, string> = {
      star: 'Pertahankan kualitas', puzzle: 'Tingkatkan promosi',
      plowhorse: 'Naikkan harga / kurangi HPP', dog: 'Evaluasi atau hapus menu',
    };
    const meColors: Record<string, RGB> = {
      star: C.green, puzzle: [29, 78, 216] as RGB, plowhorse: C.amber, dog: C.red,
    };

    autoTable(doc, {
      startY: y,
      head: [['Menu', 'Kategori', 'Qty', 'Revenue', 'Margin', 'Saran Aksi']],
      body: data.menuEngineering.map(m => [
        m.name,
        meLabels[m.category] ?? m.category,
        `${m.qty}×`,
        formatRp(m.revenue),
        `${m.margin.toFixed(1)}%`,
        meAdvice[m.category] ?? '—',
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 3, right: 4, bottom: 3, left: 4 }, lineColor: C.border, lineWidth: 0.2 },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 24, fontStyle: 'bold', halign: 'center' },
        2: { cellWidth: 16, halign: 'right' },
        3: { halign: 'right' },
        4: { cellWidth: 18, halign: 'right' },
        5: { fontStyle: 'italic' },
      },
      bodyStyles: { textColor: C.dark },
      alternateRowStyles: { fillColor: C.beige },
      willDrawCell(hookData: any) {
        if (hookData.section === 'body' && hookData.column.index === 1) {
          const cat = data.menuEngineering[hookData.row.index]?.category;
          if (cat) hookData.cell.styles.textColor = meColors[cat] ?? C.dark;
        }
      },
      margin: { left: ML, right: MR },
    });
    y = (doc as any).lastAutoTable.finalY + 9;
  }

  if (data.lowStock.length > 0) {
    if (y + 35 > FOOT) { doc.addPage(); y = 20; }
    sectionLabel(doc, `Stok Menipis — Reminder Belanja (${data.lowStock.length} bahan)`, ML, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Bahan', 'Stok Saat Ini', 'Min. Stok', 'Kekurangan']],
      body: data.lowStock.map(s => [
        s.name,
        `${s.current.toLocaleString('id-ID')} ${s.unit}`,
        `${s.min.toLocaleString('id-ID')} ${s.unit}`,
        `${(s.min - s.current).toLocaleString('id-ID')} ${s.unit}`,
      ]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 3, right: 5, bottom: 3, left: 5 }, lineColor: C.border, lineWidth: 0.2 },
      headStyles: { fillColor: C.amber, textColor: C.white, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } },
      bodyStyles: { textColor: C.dark },
      alternateRowStyles: { fillColor: [255, 251, 235] as RGB },
      willDrawCell(hookData: any) {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          hookData.cell.styles.textColor = C.red;
        }
      },
      margin: { left: ML, right: MR },
    });
  }

  // Transaction detail table
  const txList = data.transactions ?? [];
  const activeTx = txList.filter(t => !t.cancelled);
  if (activeTx.length > 0) {
    if (y + 40 > FOOT) { doc.addPage(); y = 20; }
    sectionLabel(doc, `Detail Transaksi (${activeTx.length})`, ML, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Waktu', 'Menu', 'Tier', 'Metode', 'Omzet', 'Laba']],
      body: activeTx.map(t => [
        new Date(t.timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        t.itemsLabel,
        t.tier,
        t.paymentMethod ?? 'CASH',
        formatRp(t.revenue),
        formatRp(t.profit),
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 2.5, right: 4, bottom: 2.5, left: 4 }, lineColor: C.border, lineWidth: 0.15 },
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
      bodyStyles: { textColor: C.dark },
      alternateRowStyles: { fillColor: C.beige },
      margin: { left: ML, right: MR },
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  const totalPages: number = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    hRule(doc, ML, FOOT - 2, CW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grayLight);
    doc.text('Dibuat oleh ProfitLy · Semua angka adalah estimasi', ML, FOOT + 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.green);
    doc.text('profitly.app', PW - MR, FOOT + 3, { align: 'right' });
    if (totalPages > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.grayLight);
      doc.text(`Hal. ${p} / ${totalPages}`, PW / 2, FOOT + 3, { align: 'center' });
    }
  }

  doc.save(`Laporan_Bulanan_ProfitLy_${data.periodLabel.replace(/\s+/g, '_')}.pdf`);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportData {
  hpp: number;
  tiers: PricingTier[];
  bep: BEPResult | null;
  batch: number | null;
  fixedCost: number;
  targetUnits: number;
}

// ─── Color palette (RGB tuples for jsPDF) ────────────────────────────────────

type RGB = [number, number, number];

const C = {
  green:      [26, 107, 60]   as RGB,
  greenLight: [240, 249, 244] as RGB,
  dark:       [26, 26, 24]    as RGB,
  gray:       [107, 114, 128] as RGB,
  grayLight:  [156, 163, 175] as RGB,
  beige:      [248, 247, 242] as RGB,
  border:     [229, 227, 221] as RGB,
  red:        [220, 38, 38]   as RGB,
  amber:      [217, 119, 6]   as RGB,
  white:      [255, 255, 255] as RGB,
  coral:      [229, 115, 115] as RGB,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hRule(doc: jsPDF, x: number, y: number, w: number, color: RGB = C.border, weight = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(weight);
  doc.line(x, y, x + w, y);
}

function sectionLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.grayLight);
  doc.text(text.toUpperCase(), x, y);
}

function kpiBox(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string, valueColor: RGB = C.dark,
) {
  doc.setFillColor(...C.beige);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.grayLight);
  doc.text(label, x + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...valueColor);
  doc.text(value, x + 4, y + 13);
}

function formatAxis(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 500_000 === 0 ? 0 : 1)}jt`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
  return v.toFixed(0);
}

// ─── BEP Chart ───────────────────────────────────────────────────────────────

function drawBEPChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  hpp: number, sellPrice: number, fixedCost: number, bepUnit: number,
) {
  const maxUnits = Math.ceil(bepUnit * 2.2);
  const maxRevenue = sellPrice * maxUnits;
  const maxCost = fixedCost + hpp * maxUnits;
  const maxValue = Math.max(maxRevenue, maxCost) * 1.08;

  const toX = (u: number) => x + (u / maxUnits) * w;
  const toY = (v: number) => y + h - Math.min(1, v / maxValue) * h;

  // Chart background
  doc.setFillColor(...C.beige);
  doc.rect(x, y, w, h, 'F');
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'S');

  // Horizontal gridlines + Y-axis labels
  const yTicks = 4;
  for (let i = 1; i < yTicks; i++) {
    const gy = y + (i / yTicks) * h;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.15);
    doc.line(x, gy, x + w, gy);
    const val = maxValue * (1 - i / yTicks);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.grayLight);
    doc.text(formatAxis(val), x - 1, gy + 1.5, { align: 'right' });
  }

  // X-axis labels
  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const units = Math.round((maxUnits * i) / xTicks);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.grayLight);
    doc.text(units.toLocaleString('id-ID'), toX(units), y + h + 3.5, { align: 'center' });
  }
  doc.setFontSize(6.5);
  doc.text('porsi/bulan', x + w, y + h + 6.5, { align: 'right' });

  // Generate line point arrays (60 steps for smooth curves)
  const steps = 60;
  const biaya:  Array<[number, number]> = [];
  const pend:   Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const u = (maxUnits * i) / steps;
    biaya.push([toX(u), toY(fixedCost + hpp * u)]);
    pend.push([toX(u), toY(sellPrice * u)]);
  }

  // Total Biaya line (coral)
  doc.setDrawColor(...C.coral);
  doc.setLineWidth(0.7);
  for (let i = 1; i < biaya.length; i++) {
    doc.line(biaya[i - 1][0], biaya[i - 1][1], biaya[i][0], biaya[i][1]);
  }

  // Pendapatan line (green)
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.7);
  for (let i = 1; i < pend.length; i++) {
    doc.line(pend[i - 1][0], pend[i - 1][1], pend[i][0], pend[i][1]);
  }

  // BEP vertical dashed line
  const bx = toX(bepUnit);
  const by = toY(sellPrice * bepUnit);
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.35);
  const dash = 1.3;
  let cy = y;
  while (cy < y + h) {
    doc.line(bx, cy, bx, Math.min(cy + dash, y + h));
    cy += dash * 2;
  }

  // BEP dot (ring style)
  doc.setFillColor(...C.green);
  doc.circle(bx, by, 1.6, 'F');
  doc.setFillColor(...C.white);
  doc.circle(bx, by, 0.7, 'F');

  // BEP label
  const labelRight = bx < x + w * 0.65;
  const lx = labelRight ? bx + 2.5 : bx - 2.5;
  const align = labelRight ? 'left' : 'right';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.green);
  doc.text(`BEP: ${Math.ceil(bepUnit).toLocaleString('id-ID')} porsi`, lx, by - 2, { align });

  // Legend below chart
  const ly = y + h + 9;
  doc.setFillColor(...C.coral);
  doc.rect(x, ly - 1.5, 9, 1.8, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text('Total Biaya', x + 11, ly);

  doc.setFillColor(...C.green);
  doc.rect(x + 52, ly - 1.5, 9, 1.8, 'F');
  doc.text('Estimasi Pendapatan', x + 63, ly);
}

// ─── Main report generator ───────────────────────────────────────────────────

export function generateReport(data: ReportData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const PW = 210;
  const PH = 297;
  const ML = 20;          // margin left
  const MR = 20;          // margin right
  const CW = PW - ML - MR; // content width = 170mm
  const FOOT = PH - 14;   // footer Y

  let y = 18;

  // ── HEADER ────────────────────────────────────────────────────────────────

  // Logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.green);
  doc.text('ProfitLy', ML, y + 6);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.gray);
  doc.text('Kalkulator HPP Otomatis', ML, y + 12);

  // Top-right: date + badge
  const dateStr = new Date().toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.dark);
  doc.text(dateStr, PW - MR, y + 6, { align: 'right' });

  // "KONFIDENSIAL" badge
  const badge = 'KONFIDENSIAL';
  const badgeW = 26;
  const badgeX = PW - MR - badgeW;
  doc.setFillColor(...C.greenLight);
  doc.roundedRect(badgeX, y + 8, badgeW, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.green);
  doc.text(badge, badgeX + badgeW / 2, y + 12.3, { align: 'center' });

  y += 17;
  hRule(doc, ML, y, CW, C.green, 0.5);
  y += 5;

  // Report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...C.dark);
  doc.text('LAPORAN ANALISIS HARGA POKOK PRODUKSI', ML, y);

  const modeLabel = data.batch
    ? `Mode Batch · ${data.batch} cup/sesi produksi`
    : 'Mode Satuan · per porsi';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.gray);
  doc.text(modeLabel, ML, y + 6);

  y += 14;

  // ── HPP HIGHLIGHT BOX ─────────────────────────────────────────────────────

  doc.setFillColor(...C.greenLight);
  doc.roundedRect(ML, y, CW, 21, 3, 3, 'F');
  doc.setDrawColor(...C.green);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 21, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.gray);
  doc.text('HPP PER PORSI', ML + 5, y + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.setTextColor(...C.dark);
  doc.text(formatRp(data.hpp), ML + 5, y + 16);

  if (data.batch) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gray);
    doc.text(
      `Total ${data.batch} cup: ${formatRp(data.hpp * data.batch)}`,
      PW - MR - 5, y + 13, { align: 'right' },
    );
  }

  y += 27;

  // ── SARAN HARGA JUAL TABLE ────────────────────────────────────────────────

  sectionLabel(doc, 'Saran Harga Jual', ML, y);
  y += 4;

  const tierNames: Record<string, string> = {
    competitive: 'Kompetitif',
    standard: 'Standar  ★',
    premium: 'Premium',
  };

  autoTable(doc, {
    startY: y,
    head: [['Tier', 'Harga Jual', 'Margin', 'Profit / Porsi']],
    body: data.tiers.map(t => [
      tierNames[t.label] ?? t.label,
      formatRp(t.sellPrice),
      `${Math.round(t.margin * 100)}%`,
      formatRp(t.profit),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      lineColor: C.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: C.green,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { halign: 'right' },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right' },
    },
    bodyStyles: { textColor: C.dark },
    alternateRowStyles: { fillColor: C.beige },
    willDrawCell(hookData: any) {
      if (hookData.section === 'body' && hookData.row.index === 1) {
        hookData.cell.styles.fillColor = C.greenLight;
        hookData.cell.styles.textColor = C.green;
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: ML, right: MR },
  });

  y = (doc as any).lastAutoTable.finalY + 9;

  // ── BEP ANALYSIS ──────────────────────────────────────────────────────────

  if (data.bep) {
    sectionLabel(doc, 'Analisis Titik Impas (BEP)', ML, y);
    y += 4;

    const kpiW = (CW - 6) / 3;
    kpiBox(doc, ML,              y, kpiW, 17, 'Biaya Tetap Bulanan',   formatRp(data.fixedCost));
    kpiBox(doc, ML + kpiW + 3,  y, kpiW, 17, 'Titik Impas',
      `${Math.ceil(data.bep.bepUnit).toLocaleString('id-ID')} porsi/bln`, C.green);
    kpiBox(doc, ML + kpiW * 2 + 6, y, kpiW, 17, 'Omzet Minimal',       formatRp(data.bep.bepRevenue));

    y += 23;

    // ── 4 SKENARIO PROFIT TABLE ───────────────────────────────────────────

    if (data.targetUnits > 0) {
      sectionLabel(doc, '4 Skenario Profit', ML, y);
      const sellPrice = data.tiers[1]?.sellPrice ?? data.tiers[0].sellPrice;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C.gray);
      doc.text(
        `Harga standar ${formatRp(sellPrice)}/porsi · target ${data.targetUnits.toLocaleString('id-ID')} porsi/bulan`,
        ML, y + 5,
      );
      y += 9;

      const scenarios = [
        { label: 'Sepi',   sub: '20% target',  units: Math.floor(data.targetUnits * 0.2) },
        { label: 'BEP',    sub: 'balik modal',  units: Math.ceil(data.bep.bepUnit) },
        { label: 'Target', sub: '100% target',  units: data.targetUnits },
        { label: 'Rame',   sub: '150% target',  units: Math.floor(data.targetUnits * 1.5) },
      ].map(s => ({
        ...s,
        revenue:   sellPrice * s.units,
        totalCost: data.fixedCost + data.hpp * s.units,
        profit:    (sellPrice - data.hpp) * s.units - data.fixedCost,
      }));

      autoTable(doc, {
        startY: y,
        head: [['Skenario', 'Porsi', 'Pendapatan', 'Total Biaya', 'Profit / Rugi']],
        body: scenarios.map(s => [
          s.label + '\n' + s.sub,
          s.units.toLocaleString('id-ID'),
          formatRp(s.revenue),
          formatRp(s.totalCost),
          s.profit >= 0 ? `+${formatRp(s.profit)}` : formatRp(s.profit),
        ]),
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: { top: 3.5, right: 6, bottom: 3.5, left: 6 },
          lineColor: C.border,
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: C.green,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 9,
        },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 38 },
          1: { halign: 'right', cellWidth: 22 },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
        },
        bodyStyles: { textColor: C.dark },
        alternateRowStyles: { fillColor: C.beige },
        willDrawCell(hookData: any) {
          if (hookData.section === 'body') {
            const s = scenarios[hookData.row.index];
            if (hookData.row.index === 2) hookData.cell.styles.fillColor = C.greenLight;
            if (hookData.column.index === 4) {
              hookData.cell.styles.textColor =
                s.profit < -1 ? C.red : s.profit <= 1 ? C.amber : C.green;
            }
          }
        },
        margin: { left: ML, right: MR },
      });

      y = (doc as any).lastAutoTable.finalY + 9;
    }

    // ── BEP CHART ─────────────────────────────────────────────────────────

    // Add a new page if chart won't fit
    const chartH = 50;
    const legendH = 14; // legend + x-axis labels
    if (y + chartH + legendH + 22 > FOOT) {
      doc.addPage();
      y = 20;
    }

    sectionLabel(doc, 'Grafik BEP — Total Biaya vs Estimasi Pendapatan', ML, y);
    y += 5;

    // Left margin for Y-axis labels
    const chartX = ML + 9;
    const chartW = CW - 9;

    drawBEPChart(
      doc,
      chartX, y, chartW, chartH,
      data.hpp,
      data.tiers[1]?.sellPrice ?? data.tiers[0].sellPrice,
      data.fixedCost,
      data.bep.bepUnit,
    );

    y += chartH + legendH;
  }

  // ── FOOTER (fixed at bottom of every page) ────────────────────────────────

  const totalPages: number = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    hRule(doc, ML, FOOT - 2, CW);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.grayLight);
    doc.text(
      'Dibuat oleh ProfitLy · Semua angka adalah estimasi · Tidak menggantikan konsultasi akuntansi profesional',
      ML, FOOT + 3,
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.green);
    doc.text('profitly.app', PW - MR, FOOT + 3, { align: 'right' });
    if (totalPages > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.grayLight);
      doc.text(`Hal. ${p} / ${totalPages}`, PW / 2, FOOT + 3, { align: 'center' });
    }
  }

  const filename = `Laporan_HPP_ProfitLy_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
