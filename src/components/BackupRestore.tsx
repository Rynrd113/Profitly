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
    <div className="bg-white rounded-2xl border border-[#E5E3DD] p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Database size={14} className="text-[#9CA3AF]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4BFBA]">
          Backup & Restore Data
        </span>
      </div>
      <p className="text-xs text-[#9CA3AF] mb-4">
        Ekspor semua data ke file JSON agar aman jika perangkat bermasalah.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleExport}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            text-sm font-semibold bg-[#1A6B3C] border border-[#1A6B3C] text-white
            hover:bg-[#15593A] transition-colors"
        >
          <Download size={15} />
          Export Backup
        </button>
        <label
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            text-sm font-semibold bg-white border border-[#E5E3DD] text-[#78716C]
            hover:border-[#1A6B3C]/40 hover:text-[#1A6B3C] transition-colors cursor-pointer"
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
