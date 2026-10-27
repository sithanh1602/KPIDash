import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { apiExportExcel } from '../../api/client';
import { Modal } from '../common/Modal';
import { REPORT_SECTIONS, type ReportSectionKey } from '@shared/report-sections';
import { showToast } from '../../utils/toast';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekId: number | null;
  startDate?: string;
  onPrintPdf: (selectedSections: ReportSectionKey[]) => void;
}

export function ExportModal({ isOpen, onClose, weekId, startDate, onPrintPdf }: ExportModalProps) {
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');
  const [selected, setSelected] = useState<Record<ReportSectionKey, boolean>>({
    overview: true,
    kpi: true,
    ranking: true,
    quality: true,
    manual_qa: true,
    coaching: true,
    attitude: true,
  });
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAll = (value: boolean) => {
    const next: Record<ReportSectionKey, boolean> = { ...selected };
    REPORT_SECTIONS.forEach((s) => {
      next[s.key] = value;
    });
    setSelected(next);
  };

  const handleExport = async () => {
    const chosen = REPORT_SECTIONS.filter((s) => selected[s.key]).map((s) => s.key);
    if (chosen.length === 0) {
      setError('Vui lòng chọn ít nhất một phần báo cáo.');
      showToast.warning('Chưa chọn nội dung', 'Vui lòng chọn ít nhất một phần báo cáo.');
      return;
    }

    if (format === 'pdf') {
      showToast.info('Đang chuẩn bị bản in PDF', 'Hộp thoại in sẽ mở trong giây lát.');
      onPrintPdf(chosen);
      onClose();
      return;
    }

    if (!weekId) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await apiExportExcel(weekId, chosen);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-kpi-${startDate || 'tuan'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast.success('Xuất file Excel thành công', `Đã tải về báo cáo gồm ${chosen.length} phần.`);
      onClose();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      showToast.error('Không thể xuất báo cáo', msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xuất báo cáo tuần"
      subtitle="Chọn định dạng file và các phần nội dung cần xuất."
      maxWidth="md"
    >
      <div className="space-y-5 text-xs text-slate-300">
        {/* Format Selection */}
        <div>
          <label className="block font-semibold text-slate-200 mb-2">Định dạng xuất</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('excel')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                format === 'excel'
                  ? 'bg-emerald-500/15 border-emerald-500 text-white font-bold'
                  : 'bg-[#171b26] border-[#262c3d] text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet size={20} className={format === 'excel' ? 'text-emerald-400' : 'text-slate-500'} />
              <div>
                <div className="text-xs font-bold">Microsoft Excel (.xlsx)</div>
                <div className="text-[10px] text-slate-400 font-normal">Mỗi phần là 1 sheet có màu & định dạng</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('pdf')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                format === 'pdf'
                  ? 'bg-emerald-500/15 border-emerald-500 text-white font-bold'
                  : 'bg-[#171b26] border-[#262c3d] text-slate-400 hover:text-white'
              }`}
            >
              <FileText size={20} className={format === 'pdf' ? 'text-emerald-400' : 'text-slate-500'} />
              <div>
                <div className="text-xs font-bold">Tài liệu PDF / In</div>
                <div className="text-[10px] text-slate-400 font-normal">Xuất PDF nguyên khổ A4 qua trình duyệt</div>
              </div>
            </button>
          </div>
        </div>

        {/* Section selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-slate-200">Chọn nội dung cần xuất</label>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="text-emerald-400 hover:underline"
              >
                Chọn tất cả
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="text-slate-400 hover:underline"
              >
                Bỏ chọn
              </button>
            </div>
          </div>

          <div className="space-y-2 bg-[#171b26] p-3 rounded-xl border border-[#262c3d]">
            {REPORT_SECTIONS.map((sec) => (
              <label
                key={sec.key}
                className="flex items-center gap-2.5 p-1.5 hover:bg-[#1f2533] rounded-lg cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!!selected[sec.key]}
                  onChange={(e) => setSelected({ ...selected, [sec.key]: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-mono text-slate-500 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                  {sec.page}
                </span>
                <span className="font-medium text-slate-200 text-xs">{sec.label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#232836]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
          >
            {format === 'pdf' ? <Printer size={14} /> : <Download size={14} />}
            <span>{exporting ? 'Đang xuất...' : format === 'pdf' ? 'Mở cửa sổ in PDF' : 'Tải file Excel'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
