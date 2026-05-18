import type { SaleRecord } from '@/types/hpp';
import type { SavedRawIngredient } from '@/types/hpp';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeCell(value: unknown): string {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function rowsToCSV(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\n');
}

function triggerDownload(content: string, filename: string, mime = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob(['﻿' + content], { type: mime }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sales export ────────────────────────────────────────────────────────────

const SALES_HEADERS = [
  'ID', 'Timestamp', 'Tier', 'Item', 'Qty', 'Harga Jual', 'HPP', 'Subtotal',
  'Total Revenue', 'Total HPP', 'Laba Kotor', 'Pembayaran', 'Diskon', 'Catatan', 'Status',
];

export function exportSalesCSV(records: SaleRecord[]): void {
  const rows: string[][] = [];
  for (const r of records) {
    if (r.items.length === 0) {
      rows.push([
        r.id, r.timestamp, r.tier, '', '', '', '', '',
        String(r.totalRevenue), String(r.totalHPP), String(r.grossProfit),
        r.paymentMethod ?? 'CASH',
        String(r.discountAmount ?? 0),
        r.note ?? '',
        r.cancelled ? 'CANCELLED' : 'OK',
      ]);
    } else {
      r.items.forEach((item, i) => {
        rows.push([
          i === 0 ? r.id : '',
          i === 0 ? r.timestamp : '',
          i === 0 ? r.tier : '',
          item.recipeName,
          String(item.qty),
          String(item.sellPrice),
          String(item.hpp),
          String(item.subtotal),
          i === 0 ? String(r.totalRevenue) : '',
          i === 0 ? String(r.totalHPP) : '',
          i === 0 ? String(r.grossProfit) : '',
          i === 0 ? (r.paymentMethod ?? 'CASH') : '',
          i === 0 ? String(r.discountAmount ?? 0) : '',
          i === 0 ? (r.note ?? '') : '',
          i === 0 ? (r.cancelled ? 'CANCELLED' : 'OK') : '',
        ]);
      });
    }
  }
  const filename = `profitly-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  triggerDownload(rowsToCSV(SALES_HEADERS, rows), filename);
}

// ─── Inventory export ────────────────────────────────────────────────────────

const INVENTORY_HEADERS = ['Nama', 'Harga Beli', 'Volume', 'Satuan', 'Stok Saat Ini', 'Stok Minimum'];

export function exportInventoryCSV(ingredients: SavedRawIngredient[]): void {
  const rows = ingredients.map((ing) => [
    ing.name,
    String(ing.purchasePrice),
    String(ing.purchaseVolume),
    ing.unit,
    String(ing.currentStock ?? ''),
    String(ing.minStock ?? ''),
  ]);
  const filename = `profitly-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  triggerDownload(rowsToCSV(INVENTORY_HEADERS, rows), filename);
}

// ─── Inventory import ────────────────────────────────────────────────────────

export function parseInventoryCSV(text: string): Partial<SavedRawIngredient>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (variants: string[]) =>
    variants.reduce((found, v) => (found >= 0 ? found : headers.indexOf(v)), -1);

  const iName   = idx(['nama', 'name']);
  const iPrice  = idx(['harga beli', 'harga', 'price', 'purchaseprice']);
  const iVol    = idx(['volume', 'purchasevolume']);
  const iUnit   = idx(['satuan', 'unit']);
  const iStock  = idx(['stok saat ini', 'currentstock', 'stok']);
  const iMin    = idx(['stok minimum', 'minstock', 'min']);

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const name = iName >= 0 ? cols[iName] : '';
    if (!name) return null;
    return {
      name,
      purchasePrice:  iPrice >= 0 ? Number(cols[iPrice])  : 0,
      purchaseVolume: iVol   >= 0 ? Number(cols[iVol])    : 1,
      unit:           (iUnit >= 0 ? cols[iUnit] : 'gr') as 'gr' | 'ml' | 'pcs',
      currentStock:   iStock >= 0 && cols[iStock] !== '' ? Number(cols[iStock]) : undefined,
      minStock:       iMin   >= 0 && cols[iMin]   !== '' ? Number(cols[iMin])   : undefined,
    };
  }).filter(Boolean) as Partial<SavedRawIngredient>[];
}
