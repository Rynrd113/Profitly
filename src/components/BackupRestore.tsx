'use client';

import { useRef } from 'react';
import { Download, Upload, Database } from 'lucide-react';
import { toast } from 'sonner';
import { exportBackup, importBackup } from '@/lib/backup';

export function BackupRestore() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportBackup();
      toast.success('Backup berhasil diunduh');
    } catch {
      toast.error('Gagal mengekspor backup');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importBackup(file);
      toast.success('Data berhasil dipulihkan! Memuat ulang...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat backup');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Database size={14} className="text-[var(--text-3)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-4)]">
          Backup & Restore Data
        </span>
      </div>
      <p className="text-xs text-[var(--text-3)] mb-4">
        Ekspor semua data ke file JSON agar aman jika perangkat bermasalah.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            text-sm font-semibold bg-[#27B18A] border border-[#27B18A] text-white
            hover:bg-[#0E927A] transition-colors"
        >
          <Download size={15} />
          Export Backup
        </button>
        <label
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            text-sm font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)]
            hover:border-[#27B18A]/40 hover:text-[#27B18A] transition-colors cursor-pointer"
        >
          <Upload size={15} />
          Restore Backup
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </label>
      </div>
    </div>
  );
}
