'use client';

import { useState } from 'react';
import { storageSet } from '@/lib/storage';
import type {
  SaleRecord, SavedRecipe, SavedRecipeIngredient,
  SavedRawIngredient, StockTransaction, Customer,
} from '@/types/hpp';

function uid() { return Math.random().toString(36).slice(2, 10); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function dateISO(y: number, mo: number, d: number, h = 10, mi = 0) {
  return new Date(y, mo - 1, d, h, mi).toISOString();
}
function isWeekend(y: number, mo: number, d: number) {
  const day = new Date(y, mo - 1, d).getDay();
  return day === 0 || day === 6;
}
function daysInMonth(y: number, mo: number) { return new Date(y, mo, 0).getDate(); }

// ─── Menu definitions ─────────────────────────────────────────────────────────
// HPP tuned for BCG matrix:
//   Kopi Susu Aren  = STAR    (high qty ~35%, margin 66%)
//   Croissant Butter= PLOWHORSE (high qty ~25%, margin 40% — HPP tinggi)
//   Matcha Croffle  = PUZZLE  (low qty ~6%,  margin 70%)

const MENUS = [
  { id:'r1', name:'Kopi Susu Aren',   hpp: 8500,  sell:25000, w_wd:0.35, w_we:0.40 },
  { id:'r2', name:'Croissant Butter', hpp:12000,  sell:20000, w_wd:0.25, w_we:0.26 },
  { id:'r3', name:'Es Teh Lemon',     hpp: 3500,  sell:15000, w_wd:0.14, w_we:0.08 },
  { id:'r4', name:'Choco Danish',     hpp:11000,  sell:18000, w_wd:0.12, w_we:0.10 },
  { id:'r5', name:'Es Matcha Latte',  hpp: 9000,  sell:28000, w_wd:0.08, w_we:0.10 },
  { id:'r6', name:'Matcha Croffle',   hpp: 9500,  sell:32000, w_wd:0.06, w_we:0.06 },
];

function pickMenu(weekend: boolean) {
  const r = Math.random();
  let cum = 0;
  for (const m of MENUS) {
    cum += weekend ? m.w_we : m.w_wd;
    if (r <= cum) return m;
  }
  return MENUS[0];
}

// ─── Sales records (Feb–May 2026, May 4-10 +15% spike) ───────────────────────

function buildSalesRecords(): SaleRecord[] {
  const records: SaleRecord[] = [];

  const periods: { year:number; month:number; dayEnd:number; spike?: { from:number; to:number } }[] = [
    { year:2026, month:2, dayEnd:28 },
    { year:2026, month:3, dayEnd:31 },
    { year:2026, month:4, dayEnd:30 },
    { year:2026, month:5, dayEnd:10, spike:{ from:4, to:10 } },
  ];

  for (const { year, month, dayEnd, spike } of periods) {
    for (let day = 1; day <= dayEnd; day++) {
      const we = isWeekend(year, month, day);
      const inSpike = spike && day >= spike.from && day <= spike.to;
      const base = we ? rand(9, 13) : rand(5, 9);
      const txCount = inSpike ? Math.ceil(base * 1.15) : base;

      for (let t = 0; t < txCount; t++) {
        const menu = pickMenu(we);
        const qty = rand(1, 3);
        const subtotal = menu.sell * qty;
        const hppTotal = menu.hpp * qty;
        records.push({
          id: uid(),
          timestamp: dateISO(year, month, day, rand(8, 20), rand(0, 59)),
          tier: 'standard',
          items: [{ recipeId: menu.id, recipeName: menu.name, qty, sellPrice: menu.sell, hpp: menu.hpp, subtotal }],
          totalRevenue: subtotal,
          totalHPP: hppTotal,
          grossProfit: subtotal - hppTotal,
        });
      }
    }
  }

  return records;
}

// ─── Recipes with full ingredient lists ──────────────────────────────────────

function ing(name:string, price:string, vol:string, unit:'gr'|'ml'|'pcs', usage:string): SavedRecipeIngredient {
  return { id: uid(), name, purchasePrice: price, purchaseVolume: vol, unit, usage, yieldFactor: '1' };
}

function buildRecipes(): SavedRecipe[] {
  return [
    {
      id:'r1', name:'Kopi Susu Aren', savedAt: dateISO(2026,1,31),
      mode:'satuan', batchSize:'1', fixedCost:'0', hpp: 8500, ops:[],
      ingredients:[
        ing('Biji Kopi',  '198000','1000','gr','15'),
        ing('Susu UHT',   '16500', '1000','ml','150'),
        ing('Gula Aren',  '22000', '500', 'gr','20'),
      ],
    },
    {
      id:'r2', name:'Croissant Butter', savedAt: dateISO(2026,1,31),
      mode:'satuan', batchSize:'1', fixedCost:'0', hpp:12000, ops:[],
      ingredients:[
        ing('Tepung Terigu','14000','1000','gr','80'),
        ing('Mentega',      '32000','250', 'gr','40'),
      ],
    },
    {
      id:'r3', name:'Es Teh Lemon', savedAt: dateISO(2026,1,31),
      mode:'satuan', batchSize:'1', fixedCost:'0', hpp: 3500, ops:[],
      ingredients:[
        ing('Teh Lemon','18000','100','pcs','2'),
      ],
    },
    {
      id:'r4', name:'Choco Danish', savedAt: dateISO(2026,1,31),
      mode:'satuan', batchSize:'1', fixedCost:'0', hpp:11000, ops:[],
      ingredients:[
        ing('Tepung Terigu','14000','1000','gr','60'),
        ing('Mentega',      '32000','250', 'gr','30'),
      ],
    },
    {
      id:'r5', name:'Es Matcha Latte', savedAt: dateISO(2026,1,31),
      mode:'satuan', batchSize:'1', fixedCost:'0', hpp: 9000, ops:[],
      ingredients:[
        ing('Matcha Powder','120000','200','gr','15'),
        ing('Susu UHT',     '16500', '1000','ml','150'),
      ],
    },
    {
      id:'r6', name:'Matcha Croffle', savedAt: dateISO(2026,4,1),
      mode:'satuan', batchSize:'1', fixedCost:'0', hpp: 9500, ops:[],
      ingredients:[
        ing('Tepung Terigu','14000','1000','gr','50'),
        ing('Mentega',      '32000','250', 'gr','20'),
        ing('Matcha Powder','120000','200','gr','10'),
      ],
    },
  ];
}

// ─── Raw ingredients — stock tuned for lifecycle variation ────────────────────
// Daily usage estimate (avg ~8 orders/day):
//   Biji Kopi:     15g × 0.35 × 8 ≈ 42g/day  → stock 168g  ≈ 4 hari ⚠
//   Susu UHT:     150ml × 0.43 × 8 ≈ 516ml/day → stock 5160ml ≈ 10 hari
//   Gula Aren:     20g × 0.35 × 8 ≈ 56g/day   → stock 1120g ≈ 20 hari ✓
//   Matcha Powder: 15g × 0.14 × 8 ≈ 17g/day   → stock 255g  ≈ 15 hari
//   Tepung Terigu:(80×0.25+60×0.12+50×0.06)×8 ≈ 254g/day → stock 760g ≈ 3 hari ⚠
//   Mentega:      (40×0.25+30×0.12+20×0.06)×8 ≈ 115g/day → stock 1610g ≈ 14 hari
//   Teh Lemon:      2 × 0.14 × 8 ≈ 2.24pcs/day → stock 7pcs ≈ 3 hari ⚠

function buildRawIngredients(): SavedRawIngredient[] {
  return [
    {
      name:'Biji Kopi', purchasePrice:198000, purchaseVolume:1000, unit:'gr',
      currentStock:168, minStock:300,
      priceHistory:[
        { price:180000, volume:1000, recordedAt: dateISO(2026,1,31) },
        { price:198000, volume:1000, recordedAt: dateISO(2026,3,3)  },
      ],
    },
    {
      name:'Susu UHT', purchasePrice:16500, purchaseVolume:1000, unit:'ml',
      currentStock:5160, minStock:2000,
      priceHistory:[
        { price:15000, volume:1000, recordedAt: dateISO(2026,1,31) },
        { price:16500, volume:1000, recordedAt: dateISO(2026,3,3)  },
      ],
    },
    {
      name:'Gula Aren', purchasePrice:22000, purchaseVolume:500, unit:'gr',
      currentStock:1120, minStock:300,
      priceHistory:[{ price:22000, volume:500, recordedAt: dateISO(2026,1,31) }],
    },
    {
      name:'Matcha Powder', purchasePrice:120000, purchaseVolume:200, unit:'gr',
      currentStock:255, minStock:100,
      priceHistory:[{ price:120000, volume:200, recordedAt: dateISO(2026,1,31) }],
    },
    {
      name:'Tepung Terigu', purchasePrice:14000, purchaseVolume:1000, unit:'gr',
      currentStock:760, minStock:500,
      priceHistory:[{ price:14000, volume:1000, recordedAt: dateISO(2026,1,31) }],
    },
    {
      name:'Mentega', purchasePrice:32000, purchaseVolume:250, unit:'gr',
      currentStock:1610, minStock:300,
      priceHistory:[{ price:32000, volume:250, recordedAt: dateISO(2026,1,31) }],
    },
    {
      name:'Teh Lemon', purchasePrice:18000, purchaseVolume:100, unit:'pcs',
      currentStock:7, minStock:20,
      priceHistory:[{ price:18000, volume:100, recordedAt: dateISO(2026,1,31) }],
    },
  ];
}

// ─── Stock transactions — weekly restock Feb–May ───────────────────────────

function buildStockTransactions(): StockTransaction[] {
  const txs: StockTransaction[] = [];
  const weeks = [
    { y:2026, mo:2,  d:2  },
    { y:2026, mo:2,  d:9  },
    { y:2026, mo:2,  d:16 },
    { y:2026, mo:2,  d:23 },
    { y:2026, mo:3,  d:2,  priceUp:true },
    { y:2026, mo:3,  d:9  },
    { y:2026, mo:3,  d:16 },
    { y:2026, mo:3,  d:23 },
    { y:2026, mo:3,  d:30 },
    { y:2026, mo:4,  d:6  },
    { y:2026, mo:4,  d:13 },
    { y:2026, mo:4,  d:20 },
    { y:2026, mo:4,  d:27 },
    { y:2026, mo:5,  d:4  },
  ];

  for (const w of weeks) {
    txs.push({
      id: uid(),
      timestamp: dateISO(w.y, w.mo, w.d, 8, 0),
      note: w.priceUp
        ? 'Restock mingguan — harga Biji Kopi & Susu naik 10%'
        : 'Restock mingguan',
      items: [
        { ingredientName:'Biji Kopi',     delta:1000, unit:'gr',  balanceBefore:100,  balanceAfter:1100 },
        { ingredientName:'Susu UHT',      delta:4000, unit:'ml',  balanceBefore:800,  balanceAfter:4800 },
        { ingredientName:'Gula Aren',     delta:500,  unit:'gr',  balanceBefore:150,  balanceAfter:650  },
        { ingredientName:'Tepung Terigu', delta:2000, unit:'gr',  balanceBefore:200,  balanceAfter:2200 },
        { ingredientName:'Mentega',       delta:500,  unit:'gr',  balanceBefore:100,  balanceAfter:600  },
        { ingredientName:'Matcha Powder', delta:200,  unit:'gr',  balanceBefore:80,   balanceAfter:280  },
        { ingredientName:'Teh Lemon',     delta:100,  unit:'pcs', balanceBefore:5,    balanceAfter:105  },
      ],
    });
  }

  return txs;
}

// ─── Customers ────────────────────────────────────────────────────────────────

function buildCustomers(): Customer[] {
  const names = [
    'Rina Kusuma','Budi Santoso','Dewi Anggraini','Eko Prasetyo','Fitri Rahayu',
    'Galih Wibowo','Hana Pertiwi','Irfan Maulana','Joko Susilo','Kartika Sari',
    'Lina Marlina','Maman Supriyadi','Nina Wahyuni','Oscar Halim','Putri Ayu',
    'Rizky Fauzi','Sari Indah','Tono Wijaya','Umi Salamah','Vino Pratama',
    'Wulan Sari','Yanto Prabowo','Zahra Nurul','Arini Dewi','Bagas Surya',
  ];
  return names.map(name => ({
    id: uid(),
    name,
    phone: `08${rand(100000000, 999999999)}`,
    stamps: rand(0, 10),
    totalOrders: rand(1, 40),
    createdAt: dateISO(2026, rand(1, 5), rand(1, 28)),
  }));
}

// ─── Investments + opex ───────────────────────────────────────────────────────

function buildInvestments() {
  return [
    { id: uid(), name: 'Mesin Espresso La Marzocco', cost: '32000000' },
    { id: uid(), name: 'Grinder Mazzer + Alat Barista', cost: '9500000' },
    { id: uid(), name: 'Renovasi & Interior Profitly', cost: '8500000' },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeedPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'cleared'>('idle');
  const [count, setCount] = useState(0);

  const runSeed = () => {
    setStatus('running');
    setTimeout(() => {
      const all = buildSalesRecords();
      const archivedMonths = [2, 3, 4];
      const archives = archivedMonths.map(mo => ({
        closedAt: new Date(2026, mo, 1, 0, 0).toISOString(),
        records: all.filter(r => new Date(r.timestamp).getMonth() + 1 === mo),
      }));
      const active = all.filter(r => new Date(r.timestamp).getMonth() + 1 === 5);
      storageSet('profitly-shift-archives',        archives);
      storageSet('profitly-sales-records',         active);
      storageSet('profitly-saved-recipes',         buildRecipes());
      storageSet('profitly-saved-raw-ingredients', buildRawIngredients());
      storageSet('profitly-stock-transactions',    buildStockTransactions());
      storageSet('profitly-customers',             buildCustomers());
      storageSet('profitly-investments',           buildInvestments());
      storageSet('profitly-monthly-opex',          7500000);
      setCount(all.length);
      setStatus('done');
    }, 50);
  };

  const clearAll = () => {
    [
      'profitly-sales-records','profitly-saved-recipes',
      'profitly-saved-raw-ingredients','profitly-stock-transactions',
      'profitly-customers','profitly-investments',
      'profitly-monthly-opex','profitly-shift-archives',
    ].forEach(k => localStorage.removeItem(k));
    setStatus('cleared');
  };

  const s: React.CSSProperties = { fontFamily: 'system-ui', maxWidth: 560, margin: '80px auto', padding: 24 };

  return (
    <div style={s}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Seed Data Dummy</h1>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
        Simulasi <strong>Feb–Mei 2026</strong> · 6 menu · 7 bahan baku · 25 pelanggan<br />
        Mei 4–10: spike +15% · BCG: STAR / PLOWHORSE / PUZZLE · Stok lifecycle 3–20 hari
      </p>

      <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:16, marginBottom:20, fontSize:12, color:'var(--text-2)' }}>
        <strong style={{ color:'var(--text)' }}>Menu Engineering (Mei):</strong><br />
        ⭐ STAR: Kopi Susu Aren (35% qty, margin 66%)<br />
        🐎 PLOWHORSE: Croissant Butter (25% qty, margin 40%)<br />
        🧩 PUZZLE: Matcha Croffle (6% qty, margin 70%)<br /><br />
        <strong style={{ color:'var(--text)' }}>Stok Lifecycle:</strong><br />
        ⚠ ~3 hari: Biji Kopi (168g), Tepung Terigu (760g), Teh Lemon (7pcs)<br />
        📦 ~10 hari: Susu UHT (5160ml)<br />
        ✓ ~14 hari: Mentega (1610g) · ~20 hari: Gula Aren (1120g)
      </div>

      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <button
          onClick={runSeed}
          disabled={status === 'running'}
          style={{
            background: status === 'running' ? 'var(--text-3)' : '#27B18A',
            color:'#fff', border:'none', borderRadius:12,
            padding:'10px 24px', fontSize:14, fontWeight:600, cursor:'pointer',
          }}
        >
          {status === 'running' ? 'Generating...' : 'Inject Data'}
        </button>
        <button
          onClick={clearAll}
          style={{
            background:'var(--tint-red)', color:'#DC2626', border:'1px solid #7F1D1D',
            borderRadius:12, padding:'10px 24px', fontSize:14, fontWeight:600, cursor:'pointer',
          }}
        >
          Clear Semua Data
        </button>
      </div>

      {status === 'done' && (
        <div style={{ marginTop:20, padding:14, background:'var(--tint-amber)', border:'1px solid #065F46', borderRadius:12 }}>
          <p style={{ color:'#27B18A', fontWeight:700, margin:0 }}>
            ✓ {count} transaksi diinjeksi · Feb–Mei 2026
          </p>
          <p style={{ color:'#27B18A', fontSize:12, margin:'4px 0 0', lineHeight:1.5 }}>
            Feb/Mar/Apr → shift-archives · Mei → active records<br />
            Buka /dashboard, /pos, /calculator, /financial-health untuk melihat hasil simulasi.
          </p>
        </div>
      )}
      {status === 'cleared' && (
        <p style={{ marginTop:20, color:'#DC2626', fontWeight:600 }}>✓ Semua data dihapus.</p>
      )}
    </div>
  );
}
