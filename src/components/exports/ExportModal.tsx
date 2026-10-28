import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Layers, Printer, Tag } from 'lucide-react';
import { apiExportExcel, apiExportProjectExcel, apiGetProjectTags } from '../../api/client';
import { useWeek } from '../../context/WeekContext';
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
  const { selectedQaTypes, report } = useWeek();
  const [scope, setScope] = useState<'week' | 'project'>('week');
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');
  const [projectTags, setProjectTags] = useState<string[]>(['VF-ADAS-2026']);
  const [selectedTag, setSelectedTag] = useState<string>('VF-ADAS-2026');
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

  useEffect(() => {
    if (isOpen) {
      apiGetProjectTags()
        .then((tags) => {
          if (tags.length > 0) {
            setProjectTags(tags);
            const currentTag = report?.week.projectTag;
            if (currentTag && tags.includes(currentTag)) {
              setSelectedTag(currentTag);
            } else {
              setSelectedTag(tags[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, report?.week.projectTag]);

  const toggleAll = (value: boolean) => {
    const next: Record<ReportSectionKey, boolean> = { ...selected };
    REPORT_SECTIONS.forEach((s) => {
      next[s.key] = value;
    });
    setSelected(next);
  };

  const handleExport = async () => {
    if (scope === 'project') {
      setExporting(true);
      setError(null);
      try {
        const blob = await apiExportProjectExcel(selectedTag, selectedQaTypes);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bao-cao-du-an-${selectedTag}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast.success('Xuất file Dự án thành công', `Đã tải về báo cáo toàn dự án "${selectedTag}".`);
        onClose();
      } catch (err) {
        const msg = (err as Error).message;
        setError(msg);
        showToast.error('Không thể xuất báo cáo dự án', msg);
      } finally {
        setExporting(false);
      }
      return;
    }

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
      const blob = await apiExportExcel(weekId, chosen, selectedQaTypes);
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
      title="Xuất báo cáo tuần / dự án"
      subtitle="Tùy chọn xuất theo tuần hiện tại hoặc tổng hợp lũy kế đa tuần theo Tag dự án."
      maxWidth="md"
    >
      <div className="space-y-5 text-xs text-slate-300">
        {/* Scope Selection: Tuần hiện tại vs Toàn bộ dự án */}
        <div>
          <label className="block font-semibold text-slate-200 mb-2">Phạm vi xuất báo cáo</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScope('week')}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                scope === 'week'
                  ? 'bg-emerald-500/15 border-emerald-500 text-white font-bold'
                  : 'bg-[#171b26] border-[#262c3d] text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet size={18} className={scope === 'week' ? 'text-emerald-400' : 'text-slate-500'} />
              <div>
                <div className="text-xs font-bold">Theo tuần hiện tại</div>
                <div className="text-[10px] text-slate-400 font-normal">
                  Tuần {report?.week.weekNumber || ''} ({startDate || ''})
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setScope('project');
                setFormat('excel');
              }}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                scope === 'project'
                  ? 'bg-purple-500/15 border-purple-500 text-white font-bold'
                  : 'bg-[#171b26] border-[#262c3d] text-slate-400 hover:text-white'
              }`}
            >
              <Layers size={18} className={scope === 'project' ? 'text-purple-400' : 'text-slate-500'} />
              <div>
                <div className="text-xs font-bold">Full Dự án (Tag dự án)</div>
                <div className="text-[10px] text-slate-400 font-normal">Lũy kế toàn bộ các tuần của dự án</div>
              </div>
            </button>
          </div>
        </div>

        {/* Project Tag Selector if scope === 'project' */}
        {scope === 'project' && (
          <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2">
            <label className="block font-semibold text-purple-200">Chọn Tag Dự án cần xuất full:</label>
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-purple-400 shrink-0" />
              <select
                aria-label="Chọn Tag Dự án"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full bg-[#12151d] border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-white outline-none font-mono"
              >
                {projectTags.map((tag) => (
                  <option key={tag} value={tag} className="bg-[#12151d] text-white">
                    Dự án: {tag}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-purple-300/80 leading-relaxed pt-1">
              Hệ thống sẽ tự động quét tất cả các tuần có Tag <strong>"{selectedTag}"</strong> (ví dụ từ cuối tháng 10 đến giữa tháng 11), tính tổng sản lượng lũy kế của từng Annotator, năng suất TB toàn dự án, tổng hợp lỗi QA và Issue.
            </p>
          </div>
        )}

        {/* Format Selection (Only shown for week scope) */}
        {scope === 'week' && (
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
                <FileSpreadsheet size={18} className={format === 'excel' ? 'text-emerald-400' : 'text-slate-500'} />
                <div>
                  <div className="text-xs font-bold">Microsoft Excel (.xlsx)</div>
                  <div className="text-[10px] text-slate-400 font-normal">Mỗi phần là 1 sheet chuẩn font Arial</div>
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
                <FileText size={18} className={format === 'pdf' ? 'text-emerald-400' : 'text-slate-500'} />
                <div>
                  <div className="text-xs font-bold">Tài liệu PDF / In</div>
                  <div className="text-[10px] text-slate-400 font-normal">Xuất PDF nguyên khổ A4 qua trình duyệt</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Section selection (Only shown for week scope) */}
        {scope === 'week' && (
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

            <div className="space-y-1.5 bg-[#161a24] p-3 rounded-xl border border-[#232836]">
              {REPORT_SECTIONS.map((sec) => (
                <label
                  key={sec.key}
                  className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected[sec.key]}
                      onChange={(e) => setSelected({ ...selected, [sec.key]: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-slate-200">{sec.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Trang {sec.page}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#232836]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800 transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className={`inline-flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-xl transition-all disabled:opacity-50 shadow-md ${
              scope === 'project'
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            <Download size={14} className={exporting ? 'animate-bounce' : ''} />
            <span>
              {exporting
                ? 'Đang xuất...'
                : scope === 'project'
                ? `Tải Excel Full Dự án "${selectedTag}"`
                : format === 'pdf'
                ? 'Mở cửa sổ in PDF'
                : 'Tải file Excel'}
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}